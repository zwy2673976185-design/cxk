const express = require('express');
const multer = require('multer');
const fs = require('fs');
const cors = require('cors');
const app = express();
const port = 3000; // 可修改，需确保服务器开放该端口，且和前后端端口一致

// 基础配置：解决跨域+允许访问前端HTML文件
app.use(cors());
app.use(express.static('./')); // 关键：让浏览器能访问发送端、接收端HTML

// 核心设置：只存1个最新更新文件（新文件上传自动覆盖，旧文件直接替换）
const updateDir = './latest_update'; // 服务器存储最新文件的文件夹（自动创建）
const latestFilePath = `${updateDir}/latest_update.html`; // 固定最新文件路径，确保唯一
const fileInfoPath = `${updateDir}/file_info.json`; // 存储文件信息（供前端公告显示）
if (!fs.existsSync(updateDir)) fs.mkdirSync(updateDir);

// 接口1：接收发送端上传的新文件（自动覆盖旧文件，更新公告信息）
const upload = multer({ 
  dest: updateDir + '/', 
  limits: { fileSize: 10 * 1024 * 1024 } // 限制文件最大10MB，可修改
});
app.post('/uploadNewFile', upload.single('updateHtml'), (req, res) => {
  try {
    // 1. 覆盖旧文件，保留最新版
    fs.renameSync(req.file.path, latestFilePath);
    // 2. 记录文件信息（前端公告要显示的内容：文件名、大小、推送时间）
    const fileInfo = {
      fileName: req.file.originalname,
      size: (req.file.size / 1024).toFixed(2) + 'KB',
      updateTime: new Date().toLocaleString()
    };
    fs.writeFileSync(fileInfoPath, JSON.stringify(fileInfo)); // 保存信息到服务器
    
    res.send({ success: true, msg: '新文件推送成功！已覆盖旧文件，前端公告将显示最新内容' });
  } catch (err) {
    res.send({ success: false, msg: '文件推送失败：' + err.message });
  }
});

// 接口2：给前端提供公告信息（前端打开页面时自动请求，未更新则一直显示）
app.get('/getNoticeInfo', (req, res) => {
  try {
    // 检查文件是否存在：存在则返回公告信息，不存在则提示无文件
    if (fs.existsSync(fileInfoPath) && fs.existsSync(latestFilePath)) {
      const info = JSON.parse(fs.readFileSync(fileInfoPath, 'utf8'));
      res.send({ success: true, notice: info });
    } else {
      res.send({ success: false, notice: '📢 暂无待更新文件' });
    }
  } catch (err) {
    res.send({ success: false, notice: '公告加载失败：' + err.message });
  }
});

// 接口3：前端下载最新文件（点击下载按钮时调用，下载后公告仍显示）
app.get('/downloadLatestFile', (req, res) => {
  try {
    if (fs.existsSync(latestFilePath) && fs.existsSync(fileInfoPath)) {
      const info = JSON.parse(fs.readFileSync(fileInfoPath, 'utf8'));
      // 下载文件：文件名用原文件名，方便识别
      res.download(latestFilePath, info.fileName, (err) => {
        if (err) res.send({ success: false, msg: '文件下载失败：' + err.message });
      });
    } else {
      res.send({ success: false, msg: '暂无待更新文件，无法下载' });
    }
  } catch (err) {
    res.send({ success: false, msg: '下载出错：' + err.message });
  }
});

// 启动服务（服务器端执行命令后，会显示访问地址）
app.listen(port, () => {
  console.log(`✅ 服务已启动！访问地址：http://你的服务器IP:${port}`);
  console.log(`📌 关键操作：1. 打开 sender.html 推送文件 2. 打开 index.html 接收更新`);
});
