const express = require('express');
const multer = require('multer');
const fs = require('fs');
const cors = require('cors');
const app = express();

const port = process.env.PORT || 3000;

// 跨域配置：允许Render前端域名访问
app.use(cors({
  origin: "https://cxk-z875.onrender.com", // 替换为你的实际Render域名
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.static('./'));

const updateDir = './latest_update';
const latestFilePath = `${updateDir}/latest_update.html`;
const fileInfoPath = `${updateDir}/file_info.json`;
if (!fs.existsSync(updateDir)) fs.mkdirSync(updateDir);

const upload = multer({ 
  dest: updateDir + '/', 
  limits: { fileSize: 10 * 1024 * 1024 } 
});
app.post('/uploadNewFile', upload.single('updateHtml'), (req, res) => {
  try {
    fs.renameSync(req.file.path, latestFilePath);
    const fileInfo = {
      fileName: req.file.originalname,
      size: (req.file.size / 1024).toFixed(2) + 'KB',
      updateTime: new Date().toLocaleString()
    };
    fs.writeFileSync(fileInfoPath, JSON.stringify(fileInfo));
    res.send({ success: true, msg: '文件推送成功' });
  } catch (err) {
    res.send({ success: false, msg: '推送失败：' + err.message });
  }
});

app.get('/getNoticeInfo', (req, res) => {
  try {
    if (fs.existsSync(fileInfoPath) && fs.existsSync(latestFilePath)) {
      const info = JSON.parse(fs.readFileSync(fileInfoPath, 'utf8'));
      res.send({ success: true, notice: info });
    } else {
      res.send({ success: false, notice: '暂无待更新文件' });
    }
  } catch (err) {
    res.send({ success: false, notice: '公告加载失败：' + err.message });
  }
});

app.get('/downloadLatestFile', (req, res) => {
  try {
    if (fs.existsSync(latestFilePath) && fs.existsSync(fileInfoPath)) {
      const info = JSON.parse(fs.readFileSync(fileInfoPath, 'utf8'));
      res.download(latestFilePath, info.fileName, (err) => {
        if (err) res.send({ success: false, msg: '下载失败：' + err.message });
      });
    } else {
      res.send({ success: false, msg: '无文件可下载' });
    }
  } catch (err) {
    res.send({ success: false, msg: '下载出错：' + err.message });
  }
});

app.listen(port, () => {
  console.log(`服务启动于端口 ${port}`);
});
