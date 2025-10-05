const WebSocket = require('ws');
const express = require('express');
const app = express();
const httpServer = app.listen(8080);
const wss = new WebSocket.Server({ server: httpServer });

// 存储：发送端集合 + 接收端集合（分离管理，避免消息循环）
const senders = new Set();   // 仅存储发送端连接
const receivers = new Set(); // 仅存储接收端连接
app.use(express.static(__dirname)); // 静态文件服务（前端页面访问）

wss.on('connection', (ws) => {
  console.log(`✅ 新设备连接（IP：${ws._socket.remoteAddress}）`);
  let clientType = 'unknown'; // 标记连接类型（sender/receiver/unknown）
  let heartBeatInterval;      // 心跳检测定时器
  let isAlive = true;         // 客户端存活标记

  // 1. 类型握手：客户端必须先发送类型（sender/receiver），否则断开
  ws.once('message', (data) => {
    const type = data.toString().trim();
    if (type === 'sender') {
      clientType = 'sender';
      senders.add(ws);
      console.log(`🔵 标记为发送端，当前发送端数：${senders.size}`);
    } else if (type === 'receiver') {
      clientType = 'receiver';
      receivers.add(ws);
      console.log(`🟢 标记为接收端，当前接收端数：${receivers.size}`);
    } else {
      ws.close(1003, '类型错误，仅支持sender/receiver');
      console.log(`❌ 无效类型：${type}，已断开连接`);
      return;
    }

    // 2. 心跳检测：30秒发一次ping，5秒无响应则断开
    heartBeatInterval = setInterval(() => {
      if (!isAlive) {
        clearInterval(heartBeatInterval);
        ws.terminate(); // 强制断开无效连接
        return;
      }
      isAlive = false;
      ws.ping(); // 发送ping包
    }, 30000); // 30秒一次心跳检测

    // 接收发送端消息，仅转发给接收端
    ws.on('message', (data) => {
      const msgStr = data.toString();
      console.log(`📤 收到发送端消息：${msgStr}`);
      // 只转发给接收端
      receivers.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(msgStr);
          console.log(`📥 已转发给接收端`);
        }
      });
    });
  });

  // 处理pong响应（心跳存活标记）
  ws.on('pong', () => {
    isAlive = true;
  });

  // 连接关闭时清理资源
  ws.on('close', () => {
    clearInterval(heartBeatInterval); // 清除心跳定时器
    if (clientType === 'sender') senders.delete(ws);
    if (clientType === 'receiver') receivers.delete(ws);
    console.log(`❌ 设备断开（${clientType}），当前发送端：${senders.size}，接收端：${receivers.size}`);
  });

  // 连接错误处理
  ws.onerror = (err) => {
    console.log(`❌ 连接错误：${err.message}`);
  };
});

// 启动成功提示
console.log(`🚀 服务器启动完成`);
console.log(`WebSocket地址：wss://cxk-z875.onrender.com`);
console.log(`前端访问地址：https://cxk-z875.onrender.com/发送.html`);
console.log(`接收端地址：https://cxk-z875.onrender.com/前端.html`);
