import React, { useState, useRef } from 'react';
import { 
  Camera, ImagePlus, Album, Aperture, Database, X, 
  Zap, CheckCircle, XCircle, Moon, Sun, Coffee, Rocket, 
  Wind, Code, Image as ImageIcon 
} from 'lucide-react';

// --- 核心配置与模拟数据 ---
const SCENT_CATEGORIES = {
  'LAVENDER': { id: 'lavender', name: '薰衣草', color: 'bg-purple-500', icon: Moon, colorCode: '#a855f7', shadow: 'shadow-purple-500/50' },
  'CITRUS': { id: 'citrus', name: '柑橘', color: 'bg-orange-500', icon: Sun, colorCode: '#f97316', shadow: 'shadow-orange-500/50' },
  'COFFEE': { id: 'coffee', name: '咖啡', color: 'bg-amber-700', icon: Coffee, colorCode: '#b45309', shadow: 'shadow-amber-700/50' },
  'SPACE': { id: 'space', name: '金属外太空', color: 'bg-cyan-500', icon: Rocket, colorCode: '#06b6d4', shadow: 'shadow-cyan-500/50' }
};

const MOCK_VL_RESPONSES = [
  { semantics: ["海边", "日落", "冲浪", "暖光", "活力"], scent: 'CITRUS' },
  { semantics: ["咖啡馆", "阴天", "阅读", "温暖", "醇厚", "木质"], scent: 'COFFEE' },
  { semantics: ["夜晚", "卧室", "安静", "助眠", "紫色调", "微风"], scent: 'LAVENDER' },
  { semantics: ["科幻", "夜景", "霓虹灯", "赛博朋克", "冰冷", "未来感"], scent: 'SPACE' },
  { semantics: ["早晨", "花园", "露水", "清新", "阳光"], scent: 'CITRUS' },
  { semantics: ["太空舱", "失重", "机械", "星轨", "孤独"], scent: 'SPACE' }
];

export default function App() {
  const [photos, setPhotos] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [exifData, setExifData] = useState(null);
  const fileInputRef = useRef(null);

  // --- 逻辑处理 ---
  const showToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

// ✅ 粘贴这段真实 API 调用代码
  // --- 真实的豆包 VL 模型 API 调用 ---
  const callDoubaoAPI = async (base64ImageUrl) => {
    // ⚠️ 请在这里填入你新生成的 API Key
    const API_KEY = "f4531619-4c26-468e-9056-cf38c4b57abd"; 
    
    const promptText = `你是一个专业的场景氛围与香气分析专家。请分析这张图片，提取3-5个场景语义标签，并从以下4个香气大类中选择最匹配的一个：LAVENDER（薰衣草/安静/助眠）、CITRUS（柑橘/活力/清新/阳光）、COFFEE（咖啡/温暖/醇厚/阴天）、SPACE（金属外太空/科幻/冰冷/赛博朋克）。
请严格以JSON格式输出，不要包含任何其他解释文字。格式必须完全如下：
{"semantics": ["标签1", "标签2", "标签3"], "scent": "LAVENDER"}`;

    // 【修改点 1 & 2】使用标准的 messages 和 image_url 嵌套格式
    const requestBody = {
      "model": "ep-20260408151654-qw7h7",
      "messages": [
        {
          "role": "user",
          "content": [
            {
              "type": "text",
              "text": promptText
            },
            {
              "type": "image_url",
              "image_url": {
                // FileReader 提取的 base64ImageUrl 已经自带了 data:image/jpeg;base64, 前缀，符合 API 要求
                "url": base64ImageUrl 
              }
            }
          ]
        }
      ]
    };

    try {
      // 【修改点 3】将请求路径改为标准的 /api/v3/chat/completions
      const response = await fetch("/api/v3/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        // 增加详细的错误日志打印，如果再失败可以看浏览器的控制台 (F12) 查明具体原因
        const errorData = await response.text();
        console.error("API 报错详细信息:", errorData);
        throw new Error(`API 请求失败: ${response.status}`);
      }

      const data = await response.json();
      
      // 【修改点 4】解析标准格式的数据返回路径 (data.choices[0].message.content)
      let resultText = data.choices[0].message.content || "";
      
      // 清理大模型可能自带的 markdown 代码块标记
      resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const resultJson = JSON.parse(resultText);

      return {
        semantics: resultJson.semantics || ["未知场景"],
        scent: resultJson.scent || "CITRUS" 
      };

    } catch (error) {
      console.error("调用火山引擎 API 出错:", error);
      throw error;
    }
  };

  const processNewImage = async (imageUrl, fileName) => {
    const photoId = 'img_' + Date.now() + Math.random().toString(36).substr(2, 5);
    
    // 1. 添加分析中的占位记录
    const newPhoto = {
      id: photoId,
      url: imageUrl,
      fileName: fileName,
      status: 'analyzing',
      semantics: [],
      scentKey: null,
      timestamp: new Date().toLocaleString()
    };
    
    setPhotos(prev => [newPhoto, ...prev]);
    // 2. 调用真实的 API
    try {
      const vlResult = await callDoubaoAPI(imageUrl); 
      
      // 3. 更新为完成状态
      setPhotos(prev => prev.map(p => {
        if (p.id === photoId) {
          return { ...p, status: 'complete', semantics: vlResult.semantics, scentKey: vlResult.scent };
        }
        return p;
      }));
      showToast(`解析完成: 检测到【${SCENT_CATEGORIES[vlResult.scent].name}】氛围`, 'success');
    } catch (error) {
      console.error("VL模型解析失败", error);
      showToast("模型解析失败，请重试", 'error');
      setPhotos(prev => prev.filter(p => p.id !== photoId));
    }
  };

  const handleFileUpload = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
        await processNewImage(event.target.result, file.name);
      };
      reader.readAsDataURL(file);
    });
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const simulateCameraCapture = async () => {
    const randomId = Math.floor(Math.random() * 1000);
    const imageUrl = `https://picsum.photos/seed/${randomId}/800/600`;
    await processNewImage(imageUrl, `Capture_${randomId}.jpg`);
  };

  const triggerScentDevice = (photo, event) => {
    if (!photo || !photo.scentKey) return;
    const scentInfo = SCENT_CATEGORIES[photo.scentKey];
    
    console.log(`[HARDWARE SIGNAL] COMMAND: EMIT_SCENT | CODE: ${scentInfo.id} | DURATION: 5s`);
    showToast(`正在给硬件发送信号...释放【${scentInfo.name}】`, 'info');

    // 粒子动画效果
    const btn = event.currentTarget;
    const rect = btn.getBoundingClientRect();
    for(let i=0; i<5; i++) {
      createParticle(rect.left + rect.width/2, rect.top, scentInfo.colorCode);
    }
  };

  const createParticle = (x, y, color) => {
    const particle = document.createElement('div');
    particle.className = 'scent-particle';
    particle.style.backgroundColor = color;
    particle.style.left = (x + (Math.random() * 40 - 20)) + 'px';
    particle.style.top = y + 'px';
    particle.style.boxShadow = `0 0 10px ${color}`;
    document.body.appendChild(particle);
    setTimeout(() => particle.remove(), 1500);
  };

  const openExifModal = (photo) => {
    const exifMock = {
      "Image": {
        "Make": "Scent_Memory_Capsule_System",
        "Model": "VL_Auto_Tagger_V1",
        "DateTime": photo.timestamp
      },
      "Scent_Metadata": {
        "Scent_Code": photo.scentKey,
        "Scent_Name": SCENT_CATEGORIES[photo.scentKey].name,
        "Hardware_Hex": "0x" + photo.scentKey.split('').map(c => c.charCodeAt(0).toString(16)).join(''),
        "Semantic_Analysis": photo.semantics,
        "Confidence": (0.85 + Math.random() * 0.14).toFixed(4),
        "Model_Version": "vl-multimodal-v2.5"
      }
    };
    setExifData(exifMock);
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden font-sans transition-colors duration-300 global-theme-wrapper pb-20">
      {/* 注入全局样式和 Insta360 主题变量 */}
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --insta-primary-yellow: #FFD200;
          --insta-primary-yellow-hover: #FFE04D;
          --insta-primary-yellow-active: #E6B800;
          --insta-primary-yellow-disabled: #FFF0B3;
          --insta-primary-red: #D50000;
          --insta-tech-blue: #00A3FF;
          --insta-bg-main: #FFFFFF;
          --insta-bg-card: #F8F8F8;
          --insta-text-primary: #121212;
          --insta-text-secondary: #333333;
          --insta-text-minor: #666666;
          --insta-text-disabled: #999999;
          --insta-border-light: #F0F0F0;
          --insta-border-dark: #E5E5E5;
          --insta-success: #00B42A;
          --insta-error: #F53F3F;
        }

        @media (prefers-color-scheme: dark) {
          :root {
            --insta-bg-main: #0A0A0A;
            --insta-bg-card: #121212;
            --insta-text-primary: #FFFFFF;
            --insta-text-secondary: #F5F5F5;
            --insta-text-minor: #CCCCCC;
            --insta-border-light: #1E1E1E;
            --insta-border-dark: #2A2A2A;
          }
        }

        .global-theme-wrapper {
          background-color: var(--insta-bg-main);
          color: var(--insta-text-primary);
        }

        .btn-primary {
          background-color: var(--insta-primary-yellow);
          color: #121212;
          border: none;
          transition: all 0.2s ease;
        }
        .btn-primary:hover {
          background-color: var(--insta-primary-yellow-hover);
          transform: scale(1.02);
          box-shadow: 0 10px 25px -5px rgba(255, 210, 0, 0.4);
        }
        .btn-primary:active {
          background-color: var(--insta-primary-yellow-active);
          transform: scale(0.98);
        }

        @keyframes floatUp {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-50px) scale(2); opacity: 0; }
        }
        .scent-particle {
          position: absolute;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          pointer-events: none;
          animation: floatUp 1.5s ease-out forwards;
          z-index: 100;
        }
        
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: var(--insta-bg-main); }
        ::-webkit-scrollbar-thumb { background: var(--insta-border-dark); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--insta-text-minor); }
      `}} />

      <div className="max-w-6xl mx-auto px-4 py-10">
        
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight" style={{ color: 'var(--insta-text-primary)' }}>
            可闻的记忆胶囊
          </h1>
          <p className="max-w-2xl mx-auto text-sm md:text-base leading-relaxed" style={{ color: 'var(--insta-text-minor)' }}>
            全自动多模态香气标记系统。按下运动相机快门瞬间，VL模型将提取「场景语义 + 情绪氛围」，自动赋予专属香气标签。
          </p>
        </header>

        {/* 控制台区域 */}
        <section 
          className="border rounded-2xl p-8 mb-12 shadow-sm transition-colors duration-300 flex flex-col items-center justify-center gap-8 relative overflow-hidden"
          style={{ backgroundColor: 'var(--insta-bg-card)', borderColor: 'var(--insta-border-light)' }}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#FFD200] to-transparent opacity-10 rounded-bl-full pointer-events-none"></div>

          <div className="text-center w-full max-w-2xl z-10">
            <h2 className="text-2xl font-bold flex items-center justify-center gap-2 mb-3" style={{ color: 'var(--insta-text-primary)' }}>
              <Aperture style={{ color: 'var(--insta-primary-red)' }} /> 实时感知与标记系统
            </h2>
            <p className="text-sm" style={{ color: 'var(--insta-text-minor)' }}>
              核心主力模式：完美适配运动相机使用场景。用户按快门，系统全自动完成解析、标记与香气控制，零学习成本。
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-5 w-full justify-center items-center z-10">
            <button onClick={simulateCameraCapture} className="btn-primary w-full sm:w-auto flex items-center justify-center gap-3 font-bold px-10 py-4 rounded-xl text-lg">
              <Camera className="w-6 h-6" />
              <span>按下快门 (实时生成香气)</span>
            </button>

            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" multiple className="hidden" />
            
            <button 
              onClick={() => fileInputRef.current?.click()} 
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-transparent border px-6 py-4 rounded-xl transition-all"
              style={{ borderColor: 'var(--insta-border-dark)', color: 'var(--insta-text-minor)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--insta-text-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--insta-text-minor)'}
            >
              <ImagePlus className="w-5 h-5" />
              <span className="text-sm font-medium">补加老照片标签</span>
            </button>
          </div>
        </section>

        {/* 画廊区域 */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-medium flex items-center gap-2" style={{ color: 'var(--insta-text-primary)' }}>
            <Album style={{ color: 'var(--insta-primary-red)' }} /> 记忆图库
          </h3>
          <span className="text-sm" style={{ color: 'var(--insta-text-minor)' }}>共 {photos.length} 张照片</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {photos.length === 0 && (
            <div 
              className="col-span-full py-20 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl"
              style={{ borderColor: 'var(--insta-border-light)', backgroundColor: 'var(--insta-bg-card)', color: 'var(--insta-text-minor)' }}
            >
              <ImageIcon className="w-16 h-16 mb-4 opacity-50" />
              <p>暂无记忆胶囊，请导入照片开始分析</p>
            </div>
          )}

          {photos.map(photo => (
            <PhotoCard 
              key={photo.id} 
              photo={photo} 
              onTriggerScent={triggerScentDevice} 
              onOpenExif={openExifModal} 
            />
          ))}
        </div>
      </div>

      {/* Toast 提示容器 */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </div>

      {/* EXIF 模拟弹窗 */}
      {exifData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
          <div 
            className="border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
            style={{ backgroundColor: 'var(--insta-bg-main)', borderColor: 'var(--insta-border-dark)' }}
          >
            <div className="flex justify-between items-center p-4 border-b" style={{ borderColor: 'var(--insta-border-light)' }}>
              <h4 className="font-medium flex items-center gap-2" style={{ color: 'var(--insta-text-primary)' }}>
                <Database className="w-4 h-4" style={{ color: 'var(--insta-tech-blue)' }} /> 底层元数据 (EXIF) 预览
              </h4>
              <button onClick={() => setExifData(null)} style={{ color: 'var(--insta-text-minor)' }} className="hover:opacity-70 transition-opacity">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <pre 
                className="p-4 rounded-lg text-xs font-mono overflow-x-auto overflow-y-auto max-h-64 border"
                style={{ backgroundColor: 'var(--insta-bg-card)', color: 'var(--insta-text-secondary)', borderColor: 'var(--insta-border-light)' }}
              >
                {JSON.stringify(exifData, null, 2)}
              </pre>
            </div>
            <div className="p-4 border-t flex justify-end" style={{ borderColor: 'var(--insta-border-light)', backgroundColor: 'var(--insta-bg-card)' }}>
              <button 
                onClick={() => setExifData(null)} 
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ backgroundColor: 'var(--insta-primary-yellow)', color: '#121212' }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- 子组件：图片卡片 ---
function PhotoCard({ photo, onTriggerScent, onOpenExif }) {
  return (
    <div 
      className="border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all hover:-translate-y-1 group flex flex-col"
      style={{ backgroundColor: 'var(--insta-bg-card)', borderColor: 'var(--insta-border-light)' }}
    >
      <div className="relative w-full h-48 bg-[#000] overflow-hidden">
        <img src={photo.url} alt="memory" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-90 group-hover:opacity-100" />
        
        {photo.status === 'analyzing' && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-10">
            <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mb-2" style={{ borderColor: 'var(--insta-primary-yellow)', borderTopColor: 'transparent' }}></div>
            <span className="text-sm font-medium text-white animate-pulse">VL模型多模态解析中...</span>
          </div>
        )}
      </div>

      <div className="p-5 flex-1 flex flex-col">
        {photo.status === 'complete' ? (
          <>
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2">
                <span className={`flex items-center justify-center w-8 h-8 rounded-full ${SCENT_CATEGORIES[photo.scentKey].color} shadow-sm text-white`}>
                  {React.createElement(SCENT_CATEGORIES[photo.scentKey].icon, { size: 16 })}
                </span>
                <h4 className="font-bold text-lg" style={{ color: 'var(--insta-text-primary)' }}>
                  {SCENT_CATEGORIES[photo.scentKey].name}
                </h4>
              </div>
              <button 
                onClick={() => onOpenExif(photo)} 
                className="text-xs flex items-center gap-1 transition-colors hover:opacity-70"
                style={{ color: 'var(--insta-text-minor)' }}
                title="查看底层元数据"
              >
                <Code className="w-3 h-3" /> EXIF
              </button>
            </div>
            
            <div className="flex flex-wrap gap-2 mb-4">
              {photo.semantics.map((tag, idx) => (
                <span 
                  key={idx} 
                  className="px-2 py-1 border rounded-md text-xs"
                  style={{ backgroundColor: 'var(--insta-bg-main)', borderColor: 'var(--insta-border-light)', color: 'var(--insta-text-secondary)' }}
                >
                  #{tag}
                </span>
              ))}
            </div>
            
            <div className="mt-auto pt-4 border-t" style={{ borderColor: 'var(--insta-border-light)' }}>
              <button 
                onClick={(e) => onTriggerScent(photo, e)} 
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-colors text-sm font-medium hover:bg-[var(--insta-primary-yellow)] hover:border-[var(--insta-primary-yellow)] hover:text-[#121212]"
                style={{ backgroundColor: 'var(--insta-bg-main)', borderColor: 'var(--insta-border-dark)', color: 'var(--insta-text-primary)' }}
              >
                <Wind className="w-4 h-4" />
                释放香气信号
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Loading 骨架屏 */}
            <div className="h-6 rounded w-1/3 mb-4 animate-pulse" style={{ backgroundColor: 'var(--insta-border-light)' }}></div>
            <div className="flex gap-2 mb-4">
              <div className="h-6 rounded w-16 animate-pulse" style={{ backgroundColor: 'var(--insta-border-light)' }}></div>
              <div className="h-6 rounded w-20 animate-pulse" style={{ backgroundColor: 'var(--insta-border-light)' }}></div>
            </div>
            <div className="mt-auto pt-4 border-t" style={{ borderColor: 'var(--insta-border-light)' }}>
              <div className="h-10 rounded-xl w-full animate-pulse" style={{ backgroundColor: 'var(--insta-border-light)' }}></div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --- 子组件：Toast 提示 ---
function ToastItem({ toast }) {
  let iconColor = 'var(--insta-tech-blue)';
  let Icon = Zap;

  if (toast.type === 'success') {
    Icon = CheckCircle;
    iconColor = 'var(--insta-success)';
  } else if (toast.type === 'error') {
    Icon = XCircle;
    iconColor = 'var(--insta-error)';
  } else if (toast.type === 'info') {
    iconColor = 'var(--insta-primary-yellow)';
  }

  return (
    <div 
      className="flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg animate-in slide-in-from-bottom-5 fade-in duration-300 pointer-events-auto"
      style={{ backgroundColor: 'var(--insta-bg-card)', borderColor: 'var(--insta-border-light)' }}
    >
      <span style={{ color: iconColor }}>
        <Icon className="w-5 h-5" />
      </span>
      <span className="text-sm font-medium" style={{ color: 'var(--insta-text-primary)' }}>
        {toast.message}
      </span>
    </div>
  );
}
