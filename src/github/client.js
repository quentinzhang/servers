import { EventSource } from 'eventsource';
import axios from 'axios';

const TOKEN = '';
const SSE_URL = `http://localhost:8808/sse?token=${TOKEN}`;
const MESSAGE_URL = 'http://localhost:8808/message';

let isSSEConnected = false;

// 建立 SSE 连接
const es = new EventSource(SSE_URL);

es.onopen = () => {
    console.log('SSE 连接已建立');
    isSSEConnected = true;
};

es.onmessage = (event) => {
    console.log('SSE 消息:', event.data);
};

es.onerror = (err) => {
    console.error('SSE 连接错误:', err);
    es.close();
};

// 延迟以确保连接建立
const sendRequest = async () => {
    while (!isSSEConnected) {
        console.log('等待 SSE 连接...');
        await new Promise(res => setTimeout(res, 100)); // 每100毫秒检查一次
    }

    // 发送 ListTools 请求
    const request = {
        jsonrpc: "2.0",
        method: "listTools",
        params: {},
        id: 1
    };

    try {
        const response = await axios.post(MESSAGE_URL, request, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        console.log('请求成功:', response);
        
    } catch (error) {
        console.error('请求错误:', error.response ? error.response.data : error.message);
    } finally {
        es.close();
    }
};

sendRequest();