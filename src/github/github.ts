import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fetch from "node-fetch";
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
    CreateBranchOptionsSchema,
    CreateBranchSchema,
    CreateIssueOptionsSchema,
    CreateIssueSchema,
    CreateOrUpdateFileSchema,
    CreatePullRequestOptionsSchema,
    CreatePullRequestSchema,
    CreateRepositoryOptionsSchema,
    CreateRepositorySchema,
    ForkRepositorySchema,
    GetFileContentsSchema,
    GetIssueSchema,
    GitHubCommitSchema,
    GitHubContentSchema,
    GitHubCreateUpdateFileResponseSchema,
    GitHubForkSchema,
    GitHubIssueSchema,
    GitHubListCommits,
    GitHubListCommitsSchema,
    GitHubPullRequestSchema,
    GitHubReferenceSchema,
    GitHubRepositorySchema,
    GitHubSearchResponseSchema,
    GitHubTreeSchema,
    IssueCommentSchema,
    ListCommitsSchema,
    ListIssuesOptionsSchema,
    PushFilesSchema,
    SearchCodeResponseSchema,
    SearchCodeSchema,
    SearchIssuesResponseSchema,
    SearchIssuesSchema,
    SearchRepositoriesSchema,
    SearchUsersResponseSchema,
    SearchUsersSchema,
    UpdateIssueOptionsSchema,
    type FileOperation,
    type GitHubCommit,
    type GitHubContent,
    type GitHubCreateUpdateFileResponse,
    type GitHubFork,
    type GitHubIssue,
    type GitHubPullRequest,
    type GitHubReference,
    type GitHubRepository,
    type GitHubSearchResponse,
    type GitHubTree,
    type SearchCodeResponse,
    type SearchIssuesResponse,
    type SearchUsersResponse
} from './schemas.js';

export const createServer = () => {

    const server = new Server(
        {
            name: "github-mcp-server",
            version: "0.1.0",
        },
        {
            capabilities: {
                tools: {},
            },
        }
    );

    let currentTransport: any = null;

    const originalConnect = server.connect.bind(server);
    server.connect = async (transport: any) => {
        currentTransport = transport;
        return await originalConnect(transport);
    };

    async function forkRepository(
        owner: string,
        repo: string,
        organization: string | undefined,
        token: string,
    ): Promise<GitHubFork> {
        const url = organization
            ? `https://api.github.com/repos/${owner}/${repo}/forks?organization=${organization}`
            : `https://api.github.com/repos/${owner}/${repo}/forks`;

        const response = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `token ${token}`,
                Accept: "application/vnd.github.v3+json",
                "User-Agent": "github-mcp-server",
            },
        });

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.statusText}`);
        }

        return GitHubForkSchema.parse(await response.json());
    }

    async function createBranch(
        owner: string,
        repo: string,
        options: z.infer<typeof CreateBranchOptionsSchema>,
        token: string,
    ): Promise<GitHubReference> {
        const fullRef = `refs/heads/${options.ref}`;

        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/git/refs`,
            {
                method: "POST",
                headers: {
                    Authorization: `token ${token}`,
                    Accept: "application/vnd.github.v3+json",
                    "User-Agent": "github-mcp-server",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    ref: fullRef,
                    sha: options.sha,
                }),
            }
        );

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.statusText}`);
        }

        return GitHubReferenceSchema.parse(await response.json());
    }

    async function getDefaultBranchSHA(
        owner: string,
        repo: string,
        token: string
    ): Promise<string> {
        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/main`,
            {
                headers: {
                    Authorization: `token ${token}`,
                    Accept: "application/vnd.github.v3+json",
                    "User-Agent": "github-mcp-server",
                },
            }
        );

        if (!response.ok) {
            const masterResponse = await fetch(
                `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/master`,
                {
                    headers: {
                        Authorization: `token ${token}`,
                        Accept: "application/vnd.github.v3+json",
                        "User-Agent": "github-mcp-server",
                    },
                }
            );

            if (!masterResponse.ok) {
                throw new Error(
                    "Could not find default branch (tried 'main' and 'master')"
                );
            }

            const data = GitHubReferenceSchema.parse(await masterResponse.json());
            return data.object.sha;
        }

        const data = GitHubReferenceSchema.parse(await response.json());
        return data.object.sha;
    }

    async function getFileContents(
        owner: string,
        repo: string,
        path: string,
        branch: string | undefined,
        token: string
    ): Promise<GitHubContent> {
        let url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
        if (branch) {
            url += `?ref=${branch}`;
        }

        const response = await fetch(url, {
            headers: {
                Authorization: `token ${token}`,
                Accept: "application/vnd.github.v3+json",
                "User-Agent": "github-mcp-server",
            },
        });

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.statusText}`);
        }

        const data = GitHubContentSchema.parse(await response.json());

        // If it's a file, decode the content
        if (!Array.isArray(data) && data.content) {
            data.content = Buffer.from(data.content, "base64").toString("utf8");
        }

        return data;
    }

    async function createIssue(
        owner: string,
        repo: string,
        options: z.infer<typeof CreateIssueOptionsSchema>,
        token: string,
    ): Promise<GitHubIssue> {
        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/issues`,
            {
                method: "POST",
                headers: {
                    Authorization: `token ${token}`,
                    Accept: "application/vnd.github.v3+json",
                    "User-Agent": "github-mcp-server",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(options),
            }
        );

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.statusText}`);
        }

        return GitHubIssueSchema.parse(await response.json());
    }

    async function createPullRequest(
        owner: string,
        repo: string,
        options: z.infer<typeof CreatePullRequestOptionsSchema>,
        token: string
    ): Promise<GitHubPullRequest> {
        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/pulls`,
            {
                method: "POST",
                headers: {
                    Authorization: `token ${token}`,
                    Accept: "application/vnd.github.v3+json",
                    "User-Agent": "github-mcp-server",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(options),
            }
        );

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.statusText}`);
        }

        return GitHubPullRequestSchema.parse(await response.json());
    }

    async function createOrUpdateFile(
        owner: string,
        repo: string,
        path: string,
        content: string,
        message: string,
        branch: string,
        sha: string | undefined,
        token: string,
    ): Promise<GitHubCreateUpdateFileResponse> {
        const encodedContent = Buffer.from(content).toString("base64");

        let currentSha = sha;
        if (!currentSha) {
            try {
                const existingFile = await getFileContents(owner, repo, path, branch, token);
                if (!Array.isArray(existingFile)) {
                    currentSha = existingFile.sha;
                }
            } catch (error) {
                console.error(
                    "Note: File does not exist in branch, will create new file"
                );
            }
        }

        const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

        const body = {
            message,
            content: encodedContent,
            branch,
            ...(currentSha ? { sha: currentSha } : {}),
        };

        const response = await fetch(url, {
            method: "PUT",
            headers: {
                Authorization: `token ${token}`,
                Accept: "application/vnd.github.v3+json",
                "User-Agent": "github-mcp-server",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.statusText}`);
        }

        return GitHubCreateUpdateFileResponseSchema.parse(await response.json());
    }

    async function createTree(
        owner: string,
        repo: string,
        files: FileOperation[],
        baseTree: string,
        token: string
    ): Promise<GitHubTree> {
        const tree = files.map((file) => ({
            path: file.path,
            mode: "100644" as const,
            type: "blob" as const,
            content: file.content,
        }));

        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/git/trees`,
            {
                method: "POST",
                headers: {
                    Authorization: `token ${token}`,
                    Accept: "application/vnd.github.v3+json",
                    "User-Agent": "github-mcp-server",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    tree,
                    base_tree: baseTree,
                }),
            }
        );

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.statusText}`);
        }

        return GitHubTreeSchema.parse(await response.json());
    }

    async function createCommit(
        owner: string,
        repo: string,
        message: string,
        tree: string,
        parents: string[],
        token: string
    ): Promise<GitHubCommit> {
        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/git/commits`,
            {
                method: "POST",
                headers: {
                    Authorization: `token ${token}`,
                    Accept: "application/vnd.github.v3+json",
                    "User-Agent": "github-mcp-server",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message,
                    tree,
                    parents,
                }),
            }
        );

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.statusText}`);
        }

        return GitHubCommitSchema.parse(await response.json());
    }

    async function updateReference(
        owner: string,
        repo: string,
        ref: string,
        sha: string,
        token: string
    ): Promise<GitHubReference> {
        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/git/refs/${ref}`,
            {
                method: "PATCH",
                headers: {
                    Authorization: `token ${token}`,
                    Accept: "application/vnd.github.v3+json",
                    "User-Agent": "github-mcp-server",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    sha,
                    force: true,
                }),
            }
        );

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.statusText}`);
        }

        return GitHubReferenceSchema.parse(await response.json());
    }

    async function pushFiles(
        owner: string,
        repo: string,
        branch: string,
        files: FileOperation[],
        message: string,
        token: string
    ): Promise<GitHubReference> {
        const refResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`,
            {
                headers: {
                    Authorization: `token ${token}`,
                    Accept: "application/vnd.github.v3+json",
                    "User-Agent": "github-mcp-server",
                },
            }
        );

        if (!refResponse.ok) {
            throw new Error(`GitHub API error: ${refResponse.statusText}`);
        }

        const ref = GitHubReferenceSchema.parse(await refResponse.json());
        const commitSha = ref.object.sha;

        const tree = await createTree(owner, repo, files, commitSha, token);
        const commit = await createCommit(owner, repo, message, tree.sha, [
            commitSha,
        ], token);
        return await updateReference(owner, repo, `heads/${branch}`, commit.sha, token);
    }

    async function searchRepositories(
        query: string,
        page: number = 1,
        perPage: number = 30,
        token: string
    ): Promise<GitHubSearchResponse> {
        const url = new URL("https://api.github.com/search/repositories");
        url.searchParams.append("q", query);
        url.searchParams.append("page", page.toString());
        url.searchParams.append("per_page", perPage.toString());

        const response = await fetch(url.toString(), {
            headers: {
                Authorization: `token ${token}`,
                Accept: "application/vnd.github.v3+json",
                "User-Agent": "github-mcp-server",
            },
        });

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.statusText}`);
        }

        return GitHubSearchResponseSchema.parse(await response.json());
    }

    async function createRepository(
        options: z.infer<typeof CreateRepositoryOptionsSchema>,
        token: string
    ): Promise<GitHubRepository> {
        const response = await fetch("https://api.github.com/user/repos", {
            method: "POST",
            headers: {
                Authorization: `token ${token}`,
                Accept: "application/vnd.github.v3+json",
                "User-Agent": "github-mcp-server",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(options),
        });

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.statusText}`);
        }

        return GitHubRepositorySchema.parse(await response.json());
    }

    async function listCommits(
        owner: string,
        repo: string,
        page: number = 1,
        perPage: number = 30,
        sha: string | undefined,
        token: string
    ): Promise<GitHubListCommits> {
        const url = new URL(`https://api.github.com/repos/${owner}/${repo}/commits`);
        url.searchParams.append("page", page.toString());
        url.searchParams.append("per_page", perPage.toString());
        if (sha) {
            url.searchParams.append("sha", sha);
        }

        const response = await fetch(
            url.toString(),
            {
                method: "GET",
                headers: {
                    "Authorization": `token ${token}`,
                    "Accept": "application/vnd.github.v3+json",
                    "User-Agent": "github-mcp-server",
                    "Content-Type": "application/json"
                },
            }
        );

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.statusText}`);
        }

        return GitHubListCommitsSchema.parse(await response.json());
    }

    async function listIssues(
        owner: string,
        repo: string,
        options: Omit<z.infer<typeof ListIssuesOptionsSchema>, 'owner' | 'repo'>,
        token: string
    ): Promise<GitHubIssue[]> {
        const url = new URL(`https://api.github.com/repos/${owner}/${repo}/issues`);

        // Add query parameters
        if (options.state) url.searchParams.append('state', options.state);
        if (options.labels) url.searchParams.append('labels', options.labels.join(','));
        if (options.sort) url.searchParams.append('sort', options.sort);
        if (options.direction) url.searchParams.append('direction', options.direction);
        if (options.since) url.searchParams.append('since', options.since);
        if (options.page) url.searchParams.append('page', options.page.toString());
        if (options.per_page) url.searchParams.append('per_page', options.per_page.toString());

        const response = await fetch(url.toString(), {
            headers: {
                "Authorization": `token ${token}`,
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "github-mcp-server"
            }
        });

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.statusText}`);
        }

        return z.array(GitHubIssueSchema).parse(await response.json());
    }

    async function updateIssue(
        owner: string,
        repo: string,
        issueNumber: number,
        options: Omit<z.infer<typeof UpdateIssueOptionsSchema>, 'owner' | 'repo' | 'issue_number'>,
        token: string
    ): Promise<GitHubIssue> {
        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`,
            {
                method: "PATCH",
                headers: {
                    "Authorization": `token ${token}`,
                    "Accept": "application/vnd.github.v3+json",
                    "User-Agent": "github-mcp-server",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    title: options.title,
                    body: options.body,
                    state: options.state,
                    labels: options.labels,
                    assignees: options.assignees,
                    milestone: options.milestone
                })
            }
        );

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.statusText}`);
        }

        return GitHubIssueSchema.parse(await response.json());
    }

    async function addIssueComment(
        owner: string,
        repo: string,
        issueNumber: number,
        body: string,
        token: string
    ): Promise<z.infer<typeof IssueCommentSchema>> {
        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
            {
                method: "POST",
                headers: {
                    "Authorization": `token ${token}`,
                    "Accept": "application/vnd.github.v3+json",
                    "User-Agent": "github-mcp-server",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ body })
            }
        );

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.statusText}`);
        }

        return IssueCommentSchema.parse(await response.json());
    }

    async function searchCode(
        params: z.infer<typeof SearchCodeSchema>,
        token: string
    ): Promise<SearchCodeResponse> {
        const url = new URL("https://api.github.com/search/code");
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.append(key, value.toString());
            }
        });

        const response = await fetch(url.toString(), {
            headers: {
                Authorization: `token ${token}`,
                Accept: "application/vnd.github.v3+json",
                "User-Agent": "github-mcp-server",
            },
        });

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.statusText}`);
        }

        return SearchCodeResponseSchema.parse(await response.json());
    }

    async function searchIssues(
        params: z.infer<typeof SearchIssuesSchema>,
        token: string
    ): Promise<SearchIssuesResponse> {
        const url = new URL("https://api.github.com/search/issues");
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.append(key, value.toString());
            }
        });

        const response = await fetch(url.toString(), {
            headers: {
                Authorization: `token ${token}`,
                Accept: "application/vnd.github.v3+json",
                "User-Agent": "github-mcp-server",
            },
        });

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.statusText}`);
        }

        return SearchIssuesResponseSchema.parse(await response.json());
    }

    async function searchUsers(
        params: z.infer<typeof SearchUsersSchema>,
        token: string
    ): Promise<SearchUsersResponse> {
        const url = new URL("https://api.github.com/search/users");
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.append(key, value.toString());
            }
        });

        const response = await fetch(url.toString(), {
            headers: {
                Authorization: `token ${token}`,
                Accept: "application/vnd.github.v3+json",
                "User-Agent": "github-mcp-server",
            },
        });

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.statusText}`);
        }

        return SearchUsersResponseSchema.parse(await response.json());
    }

    async function getIssue(
        owner: string,
        repo: string,
        issueNumber: number,
        token: string
    ): Promise<GitHubIssue> {
        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`,
            {
                headers: {
                    Authorization: `token ${token}`,
                    Accept: "application/vnd.github.v3+json",
                    "User-Agent": "github-mcp-server",
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Github API error: ${response.statusText}`);
        }

        return GitHubIssueSchema.parse(await response.json());
    }

    const AddSchema = z.object({
        a: z.number().describe("First number"),
        b: z.number().describe("Second number"),
    });

    const LongRunningOperationSchema = z.object({
        duration: z
            .number()
            .default(10)
            .describe("Duration of the operation in seconds"),
        steps: z.number().default(5).describe("Number of steps in the operation"),
    });

    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
            tools: [
                {
                    name: "add",
                    description: "Adds two numbers",
                    inputSchema: zodToJsonSchema(AddSchema),
                },
                {
                    name: "longRunningOperation",
                    description: "Demonstrates a long running operation with progress updates",
                    inputSchema: zodToJsonSchema(LongRunningOperationSchema),
                },
                {
                    name: "create_or_update_file",
                    description: "Create or update a single file in a GitHub repository",
                    inputSchema: zodToJsonSchema(CreateOrUpdateFileSchema),
                },
                {
                    name: "search_repositories",
                    description: "Search for GitHub repositories",
                    inputSchema: zodToJsonSchema(SearchRepositoriesSchema),
                },
                {
                    name: "create_repository",
                    description: "Create a new GitHub repository in your account",
                    inputSchema: zodToJsonSchema(CreateRepositorySchema),
                },
                {
                    name: "get_file_contents",
                    description:
                        "Get the contents of a file or directory from a GitHub repository",
                    inputSchema: zodToJsonSchema(GetFileContentsSchema),
                },
                {
                    name: "push_files",
                    description:
                        "Push multiple files to a GitHub repository in a single commit",
                    inputSchema: zodToJsonSchema(PushFilesSchema),
                },
                {
                    name: "create_issue",
                    description: "Create a new issue in a GitHub repository",
                    inputSchema: zodToJsonSchema(CreateIssueSchema),
                },
                {
                    name: "create_pull_request",
                    description: "Create a new pull request in a GitHub repository",
                    inputSchema: zodToJsonSchema(CreatePullRequestSchema),
                },
                {
                    name: "fork_repository",
                    description:
                        "Fork a GitHub repository to your account or specified organization",
                    inputSchema: zodToJsonSchema(ForkRepositorySchema),
                },
                {
                    name: "create_branch",
                    description: "Create a new branch in a GitHub repository",
                    inputSchema: zodToJsonSchema(CreateBranchSchema),
                },
                {
                    name: "list_commits",
                    description: "Get list of commits of a branch in a GitHub repository",
                    inputSchema: zodToJsonSchema(ListCommitsSchema)
                },
                {
                    name: "list_issues",
                    description: "List issues in a GitHub repository with filtering options",
                    inputSchema: zodToJsonSchema(ListIssuesOptionsSchema)
                },
                {
                    name: "update_issue",
                    description: "Update an existing issue in a GitHub repository",
                    inputSchema: zodToJsonSchema(UpdateIssueOptionsSchema)
                },
                {
                    name: "add_issue_comment",
                    description: "Add a comment to an existing issue",
                    inputSchema: zodToJsonSchema(IssueCommentSchema)
                },
                {
                    name: "search_code",
                    description: "Search for code across GitHub repositories",
                    inputSchema: zodToJsonSchema(SearchCodeSchema),
                },
                {
                    name: "search_issues",
                    description:
                        "Search for issues and pull requests across GitHub repositories",
                    inputSchema: zodToJsonSchema(SearchIssuesSchema),
                },
                {
                    name: "search_users",
                    description: "Search for users on GitHub",
                    inputSchema: zodToJsonSchema(SearchUsersSchema),
                },
                {
                    name: "get_issue",
                    description: "Get details of a specific issue in a GitHub repository.",
                    inputSchema: zodToJsonSchema(GetIssueSchema)
                }
            ],
        };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        try {
            if (!request.params.arguments) {
                throw new Error("Arguments are required");
            }
            console.log("currentTransport?.githubToken:", currentTransport?.githubToken);

            // 获取当前连接的 GitHub 令牌
            const GITHUB_PERSONAL_ACCESS_TOKEN = currentTransport?.githubToken;
            if (!GITHUB_PERSONAL_ACCESS_TOKEN) {
                throw new Error("GitHub token is not provided");
            }

            const { name, arguments: args } = request.params;
            switch (name) {
                case "add": {
                    const validatedArgs = AddSchema.parse(args);
                    const sum = validatedArgs.a + validatedArgs.b;
                    return {
                        content: [
                            {
                                type: "text",
                                text: `The sum of ${validatedArgs.a} and ${validatedArgs.b} is ${sum}.`,
                            },
                        ],
                    };
                }
                case "longRunningOperation": {
                    const validatedArgs = LongRunningOperationSchema.parse(args);
                    const { duration, steps } = validatedArgs;
                    const stepDuration = duration / steps;
                    const progressToken = request.params._meta?.progressToken;

                    for (let i = 1; i < steps + 1; i++) {
                        await new Promise((resolve) =>
                            setTimeout(resolve, stepDuration * 1000),
                        );

                        if (progressToken !== undefined) {
                            await server.notification({
                                method: "notifications/progress",
                                params: {
                                    progress: i,
                                    total: steps,
                                    progressToken,
                                },
                            });
                        }
                    }

                    return {
                        content: [
                            {
                                type: "text",
                                text: `Long running operation completed. Duration: ${duration} seconds, Steps: ${steps}.`,
                            },
                        ],
                    };
                }
                case "fork_repository": {
                    const args = ForkRepositorySchema.parse(request.params.arguments);
                    const fork = await forkRepository(
                        args.owner,
                        args.repo,
                        args.organization,
                        GITHUB_PERSONAL_ACCESS_TOKEN,
                    );
                    return {
                        content: [{ type: "text", text: JSON.stringify(fork, null, 2) }],
                    };
                }

                case "create_branch": {
                    const args = CreateBranchSchema.parse(request.params.arguments);
                    let sha: string;
                    if (args.from_branch) {
                        const response = await fetch(
                            `https://api.github.com/repos/${args.owner}/${args.repo}/git/refs/heads/${args.from_branch}`,
                            {
                                headers: {
                                    Authorization: `token ${GITHUB_PERSONAL_ACCESS_TOKEN}`,
                                    Accept: "application/vnd.github.v3+json",
                                    "User-Agent": "github-mcp-server",
                                },
                            }
                        );

                        if (!response.ok) {
                            throw new Error(`Source branch '${args.from_branch}' not found`);
                        }

                        const data = GitHubReferenceSchema.parse(await response.json());
                        sha = data.object.sha;
                    } else {
                        sha = await getDefaultBranchSHA(args.owner, args.repo, GITHUB_PERSONAL_ACCESS_TOKEN);
                    }

                    const branch = await createBranch(args.owner, args.repo, {
                        ref: args.branch,
                        sha,
                    }, GITHUB_PERSONAL_ACCESS_TOKEN);

                    return {
                        content: [{ type: "text", text: JSON.stringify(branch, null, 2) }],
                    };
                }

                case "search_repositories": {
                    const args = SearchRepositoriesSchema.parse(request.params.arguments);
                    const results = await searchRepositories(
                        args.query,
                        args.page,
                        args.perPage,
                        GITHUB_PERSONAL_ACCESS_TOKEN
                    );
                    return {
                        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
                    };
                }

                case "create_repository": {
                    const args = CreateRepositorySchema.parse(request.params.arguments);
                    const repository = await createRepository(args, GITHUB_PERSONAL_ACCESS_TOKEN);
                    return {
                        content: [
                            { type: "text", text: JSON.stringify(repository, null, 2) },
                        ],
                    };
                }

                case "get_file_contents": {
                    const args = GetFileContentsSchema.parse(request.params.arguments);
                    const contents = await getFileContents(
                        args.owner,
                        args.repo,
                        args.path,
                        args.branch,
                        GITHUB_PERSONAL_ACCESS_TOKEN
                    );
                    return {
                        content: [{ type: "text", text: JSON.stringify(contents, null, 2) }],
                    };
                }

                case "create_or_update_file": {
                    const args = CreateOrUpdateFileSchema.parse(request.params.arguments);
                    const result = await createOrUpdateFile(
                        args.owner,
                        args.repo,
                        args.path,
                        args.content,
                        args.message,
                        args.branch,
                        args.sha,
                        GITHUB_PERSONAL_ACCESS_TOKEN
                    );
                    return {
                        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                    };
                }

                case "push_files": {
                    const args = PushFilesSchema.parse(request.params.arguments);
                    const result = await pushFiles(
                        args.owner,
                        args.repo,
                        args.branch,
                        args.files,
                        args.message,
                        GITHUB_PERSONAL_ACCESS_TOKEN
                    );
                    return {
                        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                    };
                }

                case "create_issue": {
                    const args = CreateIssueSchema.parse(request.params.arguments);
                    const { owner, repo, ...options } = args;
                    const issue = await createIssue(owner, repo, options, GITHUB_PERSONAL_ACCESS_TOKEN);
                    return {
                        content: [{ type: "text", text: JSON.stringify(issue, null, 2) }],
                    };
                }

                case "create_pull_request": {
                    const args = CreatePullRequestSchema.parse(request.params.arguments);
                    const { owner, repo, ...options } = args;
                    const pullRequest = await createPullRequest(owner, repo, options, GITHUB_PERSONAL_ACCESS_TOKEN);
                    return {
                        content: [
                            { type: "text", text: JSON.stringify(pullRequest, null, 2) },
                        ],
                    };
                }

                case "search_code": {
                    const args = SearchCodeSchema.parse(request.params.arguments);
                    const results = await searchCode(args, GITHUB_PERSONAL_ACCESS_TOKEN);
                    return {
                        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
                    };
                }

                case "search_issues": {
                    const args = SearchIssuesSchema.parse(request.params.arguments);
                    const results = await searchIssues(args, GITHUB_PERSONAL_ACCESS_TOKEN);
                    return {
                        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
                    };
                }

                case "search_users": {
                    const args = SearchUsersSchema.parse(request.params.arguments);
                    const results = await searchUsers(args, GITHUB_PERSONAL_ACCESS_TOKEN);
                    return {
                        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
                    };
                }

                case "list_issues": {
                    const args = ListIssuesOptionsSchema.parse(request.params.arguments);
                    const { owner, repo, ...options } = args;
                    const issues = await listIssues(owner, repo, options, GITHUB_PERSONAL_ACCESS_TOKEN);
                    return { toolResult: issues };
                }

                case "update_issue": {
                    const args = UpdateIssueOptionsSchema.parse(request.params.arguments);
                    const { owner, repo, issue_number, ...options } = args;
                    const issue = await updateIssue(owner, repo, issue_number, options, GITHUB_PERSONAL_ACCESS_TOKEN);
                    return { toolResult: issue };
                }

                case "add_issue_comment": {
                    const args = IssueCommentSchema.parse(request.params.arguments);
                    const { owner, repo, issue_number, body } = args;
                    const comment = await addIssueComment(owner, repo, issue_number, body, GITHUB_PERSONAL_ACCESS_TOKEN);
                    return { toolResult: comment };
                }

                case "list_commits": {
                    const args = ListCommitsSchema.parse(request.params.arguments);
                    const results = await listCommits(args.owner, args.repo, args.page, args.perPage, args.sha, GITHUB_PERSONAL_ACCESS_TOKEN);
                    return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
                }

                case "get_issue": {
                    const args = z.object({
                        owner: z.string(),
                        repo: z.string(),
                        issue_number: z.number()
                    }).parse(request.params.arguments);
                    const issue = await getIssue(args.owner, args.repo, args.issue_number, GITHUB_PERSONAL_ACCESS_TOKEN);
                    return { toolResult: issue };
                }

                default:
                    throw new Error(`Unknown tool: ${request.params.name}`);
            }
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new Error(
                    `Invalid arguments: ${error.errors
                        .map(
                            (e: z.ZodError["errors"][number]) =>
                                `${e.path.join(".")}: ${e.message}`
                        )
                        .join(", ")}`
                );
            }
            throw error;
        }
    });

    return { server };
};