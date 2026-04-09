// server/server.js
require('dotenv').config(); // 引入环境变量
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        if (!fs.existsSync('uploads/')) fs.mkdirSync('uploads/');
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// ⚠️ 从 .env 文件安全读取 KEY
const API_KEY = process.env.VOLC_API_KEY; 

let clients = [];

app.get('/api/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    clients.push(res);
    console.log("📻 一个网页客户端连接到了实时广播流");

    req.on('close', () => {
        clients = clients.filter(client => client !== res);
        console.log("📻 一个网页客户端断开了连接");
    });
});

app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: '没有收到文件' });
    
    // 局域网测试时，请将 localhost 替换为你的本机真实局域网 IP
    const imageUrl = `http://localhost:8080/uploads/${req.file.filename}`;
    
    console.log("📸 极速保存照片成功:", req.file.filename);

    const message = JSON.stringify({
        event: 'new_photo_from_camera',
        filename: req.file.filename,
        imageUrl: imageUrl,
        originalName: req.file.originalname
    });
    
    clients.forEach(client => {
        client.write(`data: ${message}\n\n`);
    });

    res.json({
        success: true,
        filename: req.file.filename,
        imageUrl: imageUrl
    });
});

app.post('/api/analyze', async (req, res) => {
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ success: false, message: '缺少文件名' });

    console.log("🧠 网页请求分析照片:", filename, "正在呼叫火山引擎...");

    try {
        const imagePath = `uploads/${filename}`;
        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

        const promptText = `你是一个专业的场景氛围与香气分析专家。请分析这张图片，提取3-5个场景语义标签，并从以下4个香气大类中选择最匹配的一个：LAVENDER（薰衣草/安静/助眠）、CITRUS（柑橘/活力/清新/阳光）、COFFEE（咖啡/温暖/醇厚/阴天）、SPACE（金属外太空/科幻/冰冷/赛博朋克）。
请严格以JSON格式输出，不要包含任何其他解释文字。格式必须完全如下：
{"semantics": ["标签1", "标签2", "标签3"], "scent": "LAVENDER"}`;

        const response = await axios.post("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
            "model": "ep-20260408151654-qw7h7",
            "messages": [
                { "role": "user", "content": [ { "type": "text", "text": promptText }, { "type": "image_url", "image_url": { "url": base64Image } } ] }
            ]
        }, {
            headers: { "Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json" }
        });

        let resultText = response.data.choices[0].message.content;
        resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
        const resultJson = JSON.parse(resultText);

        console.log("✅ 大模型解析成功：", resultJson);
        res.json({ success: true, analysis: resultJson });

    } catch (error) {
        console.error("❌ 大模型调用失败:", error.message);
        res.status(500).json({ success: false, message: "分析失败" });
    }
});

app.use('/uploads', express.static('uploads'));
app.listen(8080, '0.0.0.0', () => {
    console.log('🚀 分布式服务器已启动: http://0.0.0.0:8080');
});
