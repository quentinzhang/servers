import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import cors from 'cors';
import { createServer } from "./github.js";

const app = express();

app.use(cors());

const { server } = createServer();

let transport: SSEServerTransport;

app.get("/sse", async (req, res) => {
  console.log("收到 SSE 连接请求");

  transport = new SSEServerTransport("/message", res);

  console.log("Query params:", req.query);

  // 获取 token 并传递给 transport
  const token = req.query.token as string;
  (transport as any).githubToken = token;

  console.log("Token set:", token);

  await server.connect(transport);
  console.log("SSE 连接已建立");
  
});

app.post("/message", async (req, res) => {
  console.log("收到 POST 请求体:");

  try {
    if (!transport) {
      throw new Error("SSE 连接未建立");
    }

    await transport.handlePostMessage(req, res);
    console.log("请求处理完成");
  } catch (error: any) {
    console.error("处理请求时出错:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = 8808;

app.listen(PORT, () => {
  console.log(`服务器已启动，监听端口 ${PORT}`);
});
