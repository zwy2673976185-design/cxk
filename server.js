const WebSocket = require('ws');
const express = require('express');
const app = express();
const httpServer = app.listen(8080);

// 1. 正确初始化 WebSocket 服务器实例（新增这行！）
const wss = new WebSocket.Server({ server: httpServer });

const SENDER_TOKEN = 'ios-notice-123';
const iosReceivers = new Set();

wss.on('connection', (ws, req) => {
  const params = new URL(req.url, 'ws://localhost').searchParams;
  const isSender = params.get('token') === SENDER_TOKEN;

  if (isSender) {
    ws.on('message', (data) => {
      const notice = JSON.parse(data);
      const iosNoticeUrl = `notice://new?title=${encodeURIComponent(notice.title)}&content=${encodeURIComponent(notice.content)}`;
      iosReceivers.forEach(receiver => {
        if (receiver.readyState === WebSocket.OPEN) receiver.send(iosNoticeUrl);
      });
      console.log(`公告转发成功：${notice.title}`);
    });
  } else {
    iosReceivers.add(ws);
    ws.on('close', () => iosReceivers.delete(ws));
    console.log(`iOS设备上线，当前在线：${iosReceivers.size}台`);
  }
});

app.use(express.static(__dirname));
console.log('✅ 中转服务器启动完成');
