
```markdown
# 📷 Scent Memory Capsule | 可闻的记忆胶囊

> **2026 小红书巅峰黑客松（XHS Peak Hackathon）参赛项目**
>
> *“让记忆不仅能被看见，更能被闻见。”*

「可闻的记忆胶囊」是一款打破感官边界的创新记忆记录系统。它将视觉影像与嗅觉维度深度融合，通过 VL 多模态模型实现从“画面解析”到“香气释放”的全链路自动化。

目前已针对 **Insta360 Ace Pro 2** 运动相机完成深度适配，旨在为户外运动、旅行记录提供沉浸式的多维感官回溯体验。

```text
scent-memory/
├── src/            # React 前端代码
├── server/         # Node.js 后端代码
│   ├── uploads/   
│   ├── .env        # (存放你API Key)
│   └── server.js
├── public/
├── package.json
├── README.md       
└── .gitignore      

---

## 🌟 核心亮点

### 1. 影石 Ace Pro 2 实时生态适配
针对运动相机高频、即时的拍摄场景，实现了“拍完即闻”的无感化体验。相机快门触发后，系统毫秒级捕捉画面并同步触发感官反馈。

### 2. VL 模型全自动语义标记
利用前沿的 **VL (Vision-Language) 多模态大模型**，自动解析画面的“场景语义”与“情绪氛围”。无需人工干预，系统会自动从四大标准化维度（**LAVENDER / CITRUS / COFFEE / SPACE**）匹配专属香气。

### 3. “记忆胶囊”老照片补完计划
核心优势不仅在于实时，更在于“跨越时空”。通过 Web 端导入接口，即便是几年前拍摄的老照片，也能通过模型解析补入香气元数据，让陈旧的影像重新焕发嗅觉记忆。

### 4. 分布式实时广播架构
采用 **Node.js + Server-Sent Events (SSE)** 技术，构建了一套分布式中央枢纽。拍摄端上传与前端展示端、硬件控制端完全解耦，确保了多终端联动的极速响应。

---

## 🛠 技术架构

- **前端 (Frontend)**: React 18 + Tailwind CSS + Lucide Icons
- **后端 (Backend)**: Node.js + Express (SSE 实时流广播)
- **多模态能力**: VL 大模型交互 (基于 JSON 结构化输出控制指令)
- **硬件通讯**: Web Bluetooth API (控制外置气味魔盒)
- **设备支持**: Insta360 Ace Pro 2 深度适配

---

## 📡 快速启动

### 后端服务 (Central Hub)
```bash
cd server
npm install
node server.js
```
*服务启动于 `http://0.0.0.0:8080`，负责接收相机推送并向网页广播。*

### 前端面板 (Control Panel)
```bash
# 返回根目录
npm install
npm run dev
```
*访问 `http://localhost:5173`。确保浏览器支持蓝牙并已开启，用于连接气味控制硬件。*

---

## 🧠 感官映射逻辑

系统将 VL 模型提取的语义特征自动映射至以下嗅觉矩阵：

| 香气标签 | 场景语义特征 (Model Logic) | 情绪氛围 | 硬件信号 |
| :--- | :--- | :--- | :--- |
| **LAVENDER** | 卧室、夜晚、安静、紫色调、微风 | 治愈/助眠 | `0x01` |
| **CITRUS** | 海边、日落、冲浪、阳光、草地 | 活力/清新 | `0x02` |
| **COFFEE** | 咖啡馆、阴天、壁炉、醇厚、木质 | 温暖/思考 | `0x03` |
| **SPACE** | 霓虹、科幻、冷色调、金属、赛博朋克 | 探索/未来 | `0x04` |

---

## 🚀 参赛声明
本项目致力于探索 Embodied Intelligence (嵌入式智能) 在生活方式记录领域的无限可能，通过多模态 AI 技术赋能下一代智能硬件生态。

---
© 2026 Scent Memory Team. Created for XHS Peak Hackathon.
```






