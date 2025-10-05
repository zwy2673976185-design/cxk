const WebSocket = require('ws');
const express = require('express');
const app = express();
const httpServer = app.listen(8080);
const wss = new WebSocket.Server({ server: httpServer });

// 存储：发送端集合 + 接收端集合
const senders = new Set();
const receivers = new Set();
app.use(express.static(__dirname));

// 全局记录当前公告（用于接收端常驻显示，非本地存储）
let currentAnnouncement = null; // 存储当前未清除的公告

wss.on('connection', (ws) => {
  console.log(`✅ 新设备连接（IP：${ws._socket.remoteAddress}）`);
  let clientType = 'unknown';
  let heartBeatInterval;
  let isAlive = true;

  // 1. 类型握手（sender/receiver）
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
      // 接收端刚连接时，主动推送当前未清除的公告（确保未更新的不消失）
      if (currentAnnouncement) {
        ws.send(JSON.stringify(currentAnnouncement));
        console.log(`📥 向新接收端推送历史公告`);
      }
    } else {
      ws.close(1003, '类型错误，仅支持sender/receiver');
      console.log(`❌ 无效类型：${type}，已断开`);
      return;
    }

    // 2. 心跳检测（30秒/次）
    heartBeatInterval = setInterval(() => {
      if (!isAlive) {
        clearInterval(heartBeatInterval);
        ws.terminate();
        return;
      }
      isAlive = false;
      ws.ping();
    }, 30000);

    // 3. 消息处理（区分“新增公告”“清除全部”“覆盖旧公告”指令）
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        // 仅处理发送端的指令
        if (clientType !== 'sender') return;

        // 指令1：新增公告（保留旧公告，新公告追加，暂不实现，默认用“覆盖/清除”）
        // 指令2：覆盖旧公告（新公告替换旧的，旧公告消失）
        if (msg.type === 'notice' && msg.coverOld) {
          currentAnnouncement = msg; // 用新公告覆盖旧的
          console.log(`📤 发送端推送公告（覆盖旧的）：${msg.title}`);
        }
        // 指令3：保留旧公告（新公告不替换，旧的仍在，接收端显示最新的）
        else if (msg.type === 'notice' && !msg.coverOld) {
          currentAnnouncement = msg; // 虽不“覆盖”，但接收端只显示最新的（需旧的常驻可改数组）
          console.log(`📤 发送端推送公告（保留旧的）：${msg.title}`);
        }
        // 指令4：清除全部公告（所有未更新的公告都消失）
        else if (msg.type === 'clearAll') {
          currentAnnouncement = null;
          console.log(`📤 发送端指令：清除全部公告`);
        }

        // 转发指令给所有接收端
        receivers.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(msg));
            console.log(`📥 已转发指令给接收端`);
          }
        });
      } catch (err) {
        console.error(`❌ 消息解析错误：${err.message}`);
      }
    });
  });

  // 心跳响应
  ws.on('pong', () => { isAlive = true; });

  // 连接关闭清理
  ws.on('close', () => {
    clearInterval(heartBeatInterval);
    senders.delete(ws);
    receivers.delete(ws);
    console.log(`❌ 设备断开（${clientType}），发送端：${senders.size}，接收端：${receivers.size}`);
  });

  ws.onerror = (err) => { console.log(`❌ 连接错误：${err.message}`); };
});

// 启动提示
console.log(`🚀 服务器启动完成`);
console.log(`WebSocket地址：wss://cxk-z875.onrender.com`);
console.log(`发送端：https://cxk-z875.onrender.com/发送.html`);
console.log(`接收端：https://cxk-z875.onrender.com/前端.html`);
