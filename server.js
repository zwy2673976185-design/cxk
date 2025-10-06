const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static('./')); // 托管静态文件（前端页面）

// 配置文件上传存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './upload';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname); // 保持原文件名
  }
});
const upload = multer({ storage });

// 接口1：文件上传
app.post('/uploadNewFile', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).send('无文件上传');
  
  // 更新公告信息（持久化到file_info.json）
  const noticeInfo = {
    fileName: req.file.originalname,
    uploadTime: new Date().toLocaleString()
  };
  fs.writeFileSync('./file_info.json', JSON.stringify(noticeInfo, null, 2));
  
  res.send('文件上传成功');
});

// 接口2：获取公告信息
app.get('/getNoticeInfo', (req, res) => {
  let noticeInfo = { fileName: '无', uploadTime: '无' };
  if (fs.existsSync('./file_info.json')) {
    noticeInfo = JSON.parse(fs.readFileSync('./file_info.json', 'utf8'));
  }
  res.json(noticeInfo);
});

// 接口3：文件下载（重定向到文件路径）
app.get('/downloadLatestFile', (req, res) => {
  const info = fs.existsSync('./file_info.json') 
    ? JSON.parse(fs.readFileSync('./file_info.json', 'utf8')) 
    : { fileName: '' };
  if (!info.fileName) return res.status(404).send('无文件可下载');
  
  const filePath = path.join('./upload', info.fileName);
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).send('文件不存在');
  }
});

// 监听端口（适配Render环境变量）
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`服务启动于端口 ${port}`);
});
