const WebSocket = require('ws');
const express = require('express');
const app = express();
const httpServer = app.listen(8080);
const wss = new WebSocket.Server({ server: httpServer });

// 存储所有接收端客户端
const clients = new Set();
// 静态文件服务（适配前端页面访问）
app.use(express.static(__dirname));

// 简化：直接转发消息，不做多余处理（避免格式出错）
wss.on('connection', (ws) => {
  console.log(`✅ 新设备连接（IP：${ws._socket.remoteAddress}）`);
  clients.add(ws);

  // 接收发送端消息，直接转发给所有接收端
  ws.on('message', (data) => {
    const msgStr = data.toString();
    console.log(`📤 收到发送端消息：${msgStr}`); // 日志：方便排查是否收到消息
    // 转发给所有接收端（排除发送端自己）
    clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(msgStr);
        console.log(`📥 已转发给接收端`);
      }
    });
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`❌ 设备断开，当前在线：${clients.size}`);
  });

  ws.onerror = (err) => {
    console.log(`❌ 连接错误：${err.message}`);
  };
});

// 启动成功提示
console.log(`🚀 服务器启动完成`);
console.log(`WebSocket地址：wss://cxk-z875.onrender.com`);
console.log(`前端访问地址：https://cxk-z875.onrender.com/发送.html`);
console.log(`接收端地址：https://cxk-z875.onrender.com/前端.html`);
