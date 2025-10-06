const express = require('express');
const multer = require('multer');
const fs = require('fs');
const cors = require('cors');
const WebSocket = require('ws'); // 确保依赖正确
const app = express();

const port = process.env.PORT || 3000;
const wsDomain = "cxk-z875"; // 你的Render服务名，和接收端一致

// 1. 核心修复：数据持久化存储（Render重启不丢失，支持离线补收）
// 存储路径：用Render临时目录+固定文件名，服务重启后仍能读取
const storageDir = '/tmp/announcement_storage';
const latestAnnouncementPath = `${storageDir}/latest_announcement.json`; // 存储最新公告（含文件）
const fileStoragePath = `${storageDir}/latest_file.html`; // 存储最新HTML文件
// 确保存储目录存在
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
  console.log(`✅ 初始化存储目录：${storageDir}`);
}

// 2. 跨域配置（确保和接收端/发送端域名一致）
app.use(cors({
  origin: `https://${wsDomain}.onrender.com`,
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.static('./'));

// 3. 文件上传配置（接收发送端的HTML文件）
const upload = multer({ 
  dest: `${storageDir}/temp/`, // 临时上传目录
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB限制
});

// 4. WebSocket核心：维护在线客户端列表，发送端上传后全员推送
let wss; // WebSocket服务实例
let onlineClients = new Set(); // 在线接收端客户端集合

// 初始化WebSocket服务
function initWebSocket(server) {
  wss = new WebSocket.Server({ server });
  console.log('✅ WebSocket服务启动（支持全员实时推送）');

  // 接收端连接成功：加入在线列表 + 立即推送最新公告（离线补收）
  wss.on('connection', (ws) => {
    const clientId = Date.now().toString();
    onlineClients.add(ws);
    console.log(`📱 接收端${clientId}上线，当前在线：${onlineClients.size}个`);

    // 连接成功后，主动向该接收端推送最新公告（离线后上线补收关键）
    sendLatestAnnouncementToClient(ws);

    // 接收端断开连接：移除在线列表
    ws.on('close', () => {
      onlineClients.delete(ws);
      console.log(`📱 接收端${clientId}下线，当前在线：${onlineClients.size}个`);
    });

    // 错误处理
    ws.on('error', (err) => {
      console.error('❌ WebSocket客户端错误：', err);
      onlineClients.delete(ws);
    });
  });
}

// 向单个接收端推送最新公告
function sendLatestAnnouncementToClient(ws) {
  try {
    // 读取后端存储的最新公告（含文件）
    if (fs.existsSync(latestAnnouncementPath) && fs.existsSync(fileStoragePath)) {
      const announcement = JSON.parse(fs.readFileSync(latestAnnouncementPath, 'utf8'));
      const fileContent = fs.readFileSync(fileStoragePath, 'utf8');
      const fileStats = fs.statSync(fileStoragePath); // 获取文件大小

      // 组装完整数据（含文件内容，接收端可直接用）
      const data = JSON.stringify({
        type: 'notice',
        title: announcement.title || `HTML文件更新（${announcement.updateTime}）`,
        content: announcement.content || '新的HTML文件已上传，可下载更新',
        date: announcement.updateTime,
        file: {
          name: announcement.fileName,
          size: fileStats.size, // 文件真实大小（字节）
          content: fileContent // 文件内容（接收端无需再拉取）
        }
      });

      // 推送数据到接收端
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
        console.log('📤 向接收端推送最新公告成功');
      }
    } else {
      console.log('ℹ️ 暂无存储的公告，无需推送');
    }
  } catch (err) {
    console.error('❌ 推送最新公告失败：', err);
  }
}

// 向所有在线接收端推送公告（发送端上传后触发）
function broadcastToAllClients(data) {
  onlineClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
  console.log(`📢 向${onlineClients.size}个在线接收端广播公告`);
}

// 5. 接口1：发送端上传文件（上传后自动存储+全员推送）
app.post('/uploadNewFile', upload.single('updateHtml'), (req, res) => {
  try {
    if (!req.file) {
      return res.send({ success: false, msg: '未接收到文件' });
    }

    // ① 读取上传的文件内容
    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    // ② 存储文件到持久化路径（覆盖旧文件）
    fs.writeFileSync(fileStoragePath, fileContent);
    // ③ 存储公告信息（含文件名、时间，供离线补收）
    const announcement = {
      fileName: req.file.originalname,
      updateTime: new Date().toLocaleString(), // 精确到分秒
      content: `HTML文件更新通知：${req.file.originalname}（${(req.file.size / 1024).toFixed(2)}KB）`
    };
    fs.writeFileSync(latestAnnouncementPath, JSON.stringify(announcement));

    // ④ 组装数据，向所有在线接收端实时推送
    const broadcastData = JSON.stringify({
      type: 'notice',
      title: `新文件上传：${req.file.originalname}`,
      content: announcement.content,
      date: announcement.updateTime,
      file: {
        name: req.file.originalname,
        size: req.file.size,
        content: fileContent
      }
    });
    broadcastToAllClients(broadcastData);

    // ⑤ 告知发送端上传成功
    res.send({ success: true, msg: '文件上传成功，已向所有接收端推送更新' });
    console.log(`✅ 接收发送端文件：${req.file.originalname}，已存储并广播`);

  } catch (err) {
    console.error('❌ 上传文件失败：', err);
    res.send({ success: false, msg: '推送失败：' + err.message });
  }
});

// 6. 接口2：接收端自动拉取最新公告（离线上线补收兜底）
app.get('/getLatestAnnouncement', (req, res) => {
  try {
    if (fs.existsSync(latestAnnouncementPath) && fs.existsSync(fileStoragePath)) {
      const announcement = JSON.parse(fs.readFileSync(latestAnnouncementPath, 'utf8'));
      const fileContent = fs.readFileSync(fileStoragePath, 'utf8');
      const fileStats = fs.statSync(fileStoragePath);

      res.send({
        success: true,
        data: {
          type: 'notice',
          title: announcement.title || `HTML文件更新（${announcement.updateTime}）`,
          content: announcement.content,
          date: announcement.updateTime,
          file: {
            name: announcement.fileName,
            size: fileStats.size,
            content: fileContent
          }
        }
      });
    } else {
      res.send({ success: false, data: '暂无最新公告' });
    }
  } catch (err) {
    console.error('❌ 拉取公告失败：', err);
    res.send({ success: false, msg: '拉取失败：' + err.message });
  }
});

// 7. 接口3：下载文件（备用，接收端优先用推送的文件内容）
app.get('/downloadLatestFile', (req, res) => {
  try {
    if (fs.existsSync(fileStoragePath) && fs.existsSync(latestAnnouncementPath)) {
      const announcement = JSON.parse(fs.readFileSync(latestAnnouncementPath, 'utf8'));
      res.download(fileStoragePath, announcement.fileName, (err) => {
        if (err) res.send({ success: false, msg: '下载失败：' + err.message });
      });
    } else {
      res.send({ success: false, msg: '无文件可下载' });
    }
  } catch (err) {
    res.send({ success: false, msg: '下载出错：' + err.message });
  }
});

// 8. 启动服务（同时启动HTTP和WebSocket）
const server = app.listen(port, () => {
  console.log(`✅ 后端服务启动于端口 ${port}（支持文件上传+公告推送）`);
  initWebSocket(server); // 关联WebSocket服务
});

// 异常退出时清理临时文件
process.on('exit', () => {
  console.log('📤 服务退出，清理临时文件');
  if (fs.existsSync(`${storageDir}/temp`)) {
    fs.rmSync(`${storageDir}/temp`, { recursive: true, force: true });
  }
});
