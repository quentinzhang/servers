import asyncio
from dataclasses import dataclass
from urllib.parse import urlparse

import click
import httpx
import mcp.types as types
from mcp.server import NotificationOptions, Server
from mcp.server.models import InitializationOptions
from mcp.shared.exceptions import McpError
from mcp.server.sse import SseServerTransport
from starlette.applications import Starlette
from starlette.routing import Route

import logging
from starlette.responses import Response
import uvicorn

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

SENTRY_API_BASE = "https://sentry.io/api/0/organizations/4507315210616832/"
MISSING_AUTH_TOKEN_MESSAGE = (
    """Sentry authentication token not found. Please specify your Sentry auth token."""
)


@dataclass
class SentryIssueData:
    title: str
    issue_id: str
    status: str
    level: str
    first_seen: str
    last_seen: str
    count: int
    stacktrace: str

    def to_text(self) -> str:
        return f"""
Sentry Issue: {self.title}
Issue ID: {self.issue_id}
Status: {self.status}
Level: {self.level}
First Seen: {self.first_seen}
Last Seen: {self.last_seen}
Event Count: {self.count}

{self.stacktrace}
        """

    def to_prompt_result(self) -> types.GetPromptResult:
        return types.GetPromptResult(
            description=f"Sentry Issue: {self.title}",
            messages=[
                types.PromptMessage(
                    role="user", content=types.TextContent(type="text", text=self.to_text())
                )
            ],
        )

    def to_tool_result(self) -> list[types.TextContent | types.ImageContent | types.EmbeddedResource]:
        return [types.TextContent(type="text", text=self.to_text())]


class SentryError(Exception):
    pass


def extract_issue_id(issue_id_or_url: str) -> str:
    """
    Extracts the Sentry issue ID from either a full URL or a standalone ID.

    This function validates the input and returns the numeric issue ID.
    It raises SentryError for invalid inputs, including empty strings,
    non-Sentry URLs, malformed paths, and non-numeric IDs.
    """
    if not issue_id_or_url:
        raise SentryError("Missing issue_id_or_url argument")

    if issue_id_or_url.startswith(("http://", "https://")):
        parsed_url = urlparse(issue_id_or_url)
        if not parsed_url.hostname or not parsed_url.hostname.endswith(".sentry.io"):
            raise SentryError("Invalid Sentry URL. Must be a URL ending with .sentry.io")

        path_parts = parsed_url.path.strip("/").split("/")
        if len(path_parts) < 2 or path_parts[0] != "issues":
            raise SentryError(
                "Invalid Sentry issue URL. Path must contain '/issues/{issue_id}'"
            )

        issue_id = path_parts[-1]
    else:
        issue_id = issue_id_or_url

    if not issue_id.isdigit():
        raise SentryError("Invalid Sentry issue ID. Must be a numeric value.")

    return issue_id


def create_stacktrace(latest_event: dict) -> str:
    """
    Creates a formatted stacktrace string from the latest Sentry event.

    This function extracts exception information and stacktrace details from the
    provided event dictionary, formatting them into a human-readable string.
    It handles multiple exceptions and includes file, line number, and function
    information for each frame in the stacktrace.

    Args:
        latest_event (dict): A dictionary containing the latest Sentry event data.

    Returns:
        str: A formatted string containing the stacktrace information,
             or "No stacktrace found" if no relevant data is present.
    """
    stacktraces = []
    for entry in latest_event.get("entries", []):
        if entry["type"] != "exception":
            continue

        exception_data = entry["data"]["values"]
        for exception in exception_data:
            exception_type = exception.get("type", "Unknown")
            exception_value = exception.get("value", "")
            stacktrace = exception.get("stacktrace")

            stacktrace_text = f"Exception: {exception_type}: {exception_value}\n\n"
            if stacktrace:
                stacktrace_text += "Stacktrace:\n"
                for frame in stacktrace.get("frames", []):
                    filename = frame.get("filename", "Unknown")
                    lineno = frame.get("lineNo", "?")
                    function = frame.get("function", "Unknown")

                    stacktrace_text += f"{filename}:{lineno} in {function}\n"

                    if "context" in frame:
                        context = frame["context"]
                        for ctx_line in context:
                            stacktrace_text += f"    {ctx_line[1]}\n"

                    stacktrace_text += "\n"

            stacktraces.append(stacktrace_text)

    return "\n".join(stacktraces) if stacktraces else "No stacktrace found"


async def handle_sentry_issue(
    http_client: httpx.AsyncClient, auth_token: str, issue_id_or_url: str
) -> SentryIssueData:
    try:
        issue_id = extract_issue_id(issue_id_or_url)

        response = await http_client.get(
            f"issues/{issue_id}/", headers={"Authorization": f"Bearer {auth_token}"}
        )
        if response.status_code == 401:
            raise McpError(
                "Error: Unauthorized. Please check your MCP_SENTRY_AUTH_TOKEN token."
            )
        response.raise_for_status()
        issue_data = response.json()

        # Get issue hashes
        hashes_response = await http_client.get(
            f"issues/{issue_id}/hashes/",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        hashes_response.raise_for_status()
        hashes = hashes_response.json()

        if not hashes:
            raise McpError("No Sentry events found for this issue")

        latest_event = hashes[0]["latestEvent"]
        stacktrace = create_stacktrace(latest_event)

        return SentryIssueData(
            title=issue_data["title"],
            issue_id=issue_id,
            status=issue_data["status"],
            level=issue_data["level"],
            first_seen=issue_data["firstSeen"],
            last_seen=issue_data["lastSeen"],
            count=issue_data["count"],
            stacktrace=stacktrace
        )

    except SentryError as e:
        raise McpError(str(e))
    except httpx.HTTPStatusError as e:
        raise McpError(f"Error fetching Sentry issue: {str(e)}")
    except Exception as e:
        raise McpError(f"An error occurred: {str(e)}")


def serve(default_auth_token: str | None = None) -> None:
    """Run the Sentry MCP server with SSE transport."""
    app = Server("sentry")
    http_client = httpx.AsyncClient(base_url=SENTRY_API_BASE)
    current_auth_token = None  # 存储当前会话的 token

    async def get_auth_token(request) -> str:
        """Get auth token from request params or default value"""
        nonlocal current_auth_token
        if current_auth_token:
            return current_auth_token
            
        auth_token = request.query_params.get("auth_token", default_auth_token)
        if not auth_token:
            raise McpError(MISSING_AUTH_TOKEN_MESSAGE)
        current_auth_token = auth_token  # 保存 token
        return auth_token

    @app.list_prompts()
    async def handle_list_prompts() -> list[types.Prompt]:
        return [
            types.Prompt(
                name="sentry-issue",
                description="Retrieve a Sentry issue by ID or URL",
                arguments=[
                    types.PromptArgument(
                        name="issue_id_or_url",
                        description="Sentry issue ID or URL",
                        required=True,
                    )
                ],
            )
        ]

    @app.get_prompt()
    async def handle_get_prompt(
        name: str, arguments: dict[str, str] | None
    ) -> types.GetPromptResult:
        nonlocal current_auth_token  # 使用当前会话的 token
        
        if name != "sentry-issue":
            raise ValueError(f"Unknown prompt: {name}")

        if not current_auth_token:
            raise McpError(MISSING_AUTH_TOKEN_MESSAGE)

        issue_id_or_url = (arguments or {}).get("issue_id_or_url", "")
        issue_data = await handle_sentry_issue(http_client, current_auth_token, issue_id_or_url)
        return issue_data.to_prompt_result()

    @app.list_tools()
    async def handle_list_tools() -> list[types.Tool]:
        return [
            types.Tool(
                name="get_sentry_issue",
                description="""Retrieve and analyze a Sentry issue by ID or URL. Use this tool when you need to:
                - Investigate production errors and crashes
                - Access detailed stacktraces from Sentry
                - Analyze error patterns and frequencies
                - Get information about when issues first/last occurred
                - Review error counts and status""",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "issue_id_or_url": {
                            "type": "string",
                            "description": "Sentry issue ID or URL to analyze"
                        }
                    },
                    "required": ["issue_id_or_url"]
                }
            )
        ]

    @app.call_tool()
    async def handle_call_tool(
        name: str, arguments: dict | None
    ) -> list[types.TextContent | types.ImageContent | types.EmbeddedResource]:
        nonlocal current_auth_token  # 使用当前会话的 token
        
        if name != "get_sentry_issue":
            raise ValueError(f"Unknown tool: {name}")

        if not arguments or "issue_id_or_url" not in arguments:
            raise ValueError("Missing issue_id_or_url argument")

        if not current_auth_token:
            raise McpError(MISSING_AUTH_TOKEN_MESSAGE)

        issue_data = await handle_sentry_issue(
            http_client, 
            current_auth_token,  # 使用当前会话的 token
            arguments["issue_id_or_url"]
        )
        return issue_data.to_tool_result()

    # 创建 SSE 传输实例
    sse = SseServerTransport("/messages")

    async def handle_sse(request):
        """Handle SSE connection requests"""
        try:
            # 在 SSE 连接时获取并保存 token
            await get_auth_token(request)
            
            async with sse.connect_sse(
                request.scope, request.receive, request._send
            ) as streams:
                await app.run(
                    streams[0],
                    streams[1],
                    InitializationOptions(
                        server_name="sentry",
                        server_version="0.4.1",
                        capabilities=app.get_capabilities(
                            notification_options=NotificationOptions(),
                            experimental_capabilities={},
                        ),
                    ),
                )
        except Exception as e:
            logger.exception("Error in SSE connection")
            return Response(status_code=401, content=str(e))

    async def handle_messages(request):
        """Handle incoming messages"""
        logger.debug(f"Handling message request: {request.url}")
        try:
            await sse.handle_post_message(
                scope=request.scope,
                receive=request.receive,
                send=request._send
            )
            
        except Exception as e:
            logger.exception("Error handling message")
            return Response(status_code=500, content=str(e))

    # 创建 Starlette 应用
    starlette_app = Starlette(
        routes=[
            Route("/sse", endpoint=handle_sse),
            Route("/messages", endpoint=handle_messages, methods=["POST"]),
        ]
    )

    # 运行服务器
    uvicorn.run(starlette_app, host="0.0.0.0", port=8200, log_level="debug")


@click.command()
@click.option(
    "--auth-token",
    envvar="SENTRY_TOKEN",
    help="Default Sentry authentication token (can be overridden by request params)",
)
def main(auth_token: str | None = None):
    """Entry point for the Sentry MCP server"""
    asyncio.run(serve(auth_token))

# Make serve available for import
__all__ = ['serve']
