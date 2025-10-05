const WebSocket = require('ws');
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const httpServer = app.listen(8080);
const wss = new WebSocket.Server({ server: httpServer });

// 存储所有在线接收端（你的Y接收端）
const clients = new Set();
// 静态文件服务：适配你上传的HTML文件访问
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('新客户端连接（Y接收端/发送端），当前在线：', clients.size);

    // 转发消息：发送端→接收端
    ws.on('message', (data) => {
        const payload = JSON.parse(data.toString());
        // 转发“发布公告”指令
        if (payload.type === 'notice') {
            clients.forEach((client) => {
                // 只转发给接收端（排除发送端自己）
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(payload));
                }
            });
            console.log('公告已转发，标题：', payload.data.title);
        }
        // 转发“清除公告”指令
        else if (payload.type === 'clear') {
            clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(payload));
                }
            });
            console.log('公告已清除，接收端已同步');
        }
    });

    ws.on('close', () => {
        clients.delete(ws);
        console.log('客户端断开，当前在线：', clients.size);
    });
});

console.log('中转服务器启动成功（适配YY发送端/Y接收端）');
console.log('WebSocket地址：wss://cxk-z875.onrender.com');
