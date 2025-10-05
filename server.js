const WebSocket = require('ws');
const express = require('express');
const app = express();
const httpServer = app.listen(8080); // 固定端口，匹配Render配置

// 1. 区分发送端（带token）和iOS接收端
const iosReceivers = new Set(); // 存储在线的iOS设备
const SENDER_TOKEN = 'your-ios-token'; // 自定义token，防止别人乱发，比如填“ios-notice-123”

// 2. 启动WebSocket服务（中转公告）
const wss = new WebSocket.Server({ server: httpServer });
wss.on('connection', (ws, req) => {
  // 解析链接参数，判断是发送端还是接收端
  const params = new URL(req.url, 'ws://localhost').searchParams;
  const isSender = params.get('token') === SENDER_TOKEN;

  if (isSender) {
    // 发送端：接收公告，转发给所有iOS设备
    ws.on('message', (data) => {
      try {
        const notice = JSON.parse(data);
        // 生成iOS快捷指令能识别的URL（自动弹通知）
        const iosNoticeUrl = `notice://new?title=${encodeURIComponent(notice.title)}&content=${encodeURIComponent(notice.content)}`;
        // 转发给所有在线iOS设备
        iosReceivers.forEach(receiver => {
          if (receiver.readyState === WebSocket.OPEN) receiver.send(iosNoticeUrl);
        });
        console.log(`公告转发成功：${notice.title}`);
      } catch (err) {
        console.error('公告解析失败：', err);
      }
    });
  } else {
    // iOS接收端：加入在线列表，断开时移除
    iosReceivers.add(ws);
    console.log(`iOS设备上线，当前在线：${iosReceivers.size}台`);
    ws.on('close', () => {
      iosReceivers.delete(ws);
      console.log(`iOS设备下线，当前在线：${iosReceivers.size}台`);
    });
  }
});

// 3. 静态文件服务（手机打开发送页用）
app.use(express.static(__dirname));
console.log('✅ 中转服务器启动完成');
console.log('发送页访问：https://你的Render地址');
console.log('发送端WebSocket：wss://你的Render地址?token=' + SENDER_TOKEN);
console.log('iOS接收端WebSocket：wss://你的Render地址');
