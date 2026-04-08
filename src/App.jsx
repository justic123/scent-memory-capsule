import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, ImagePlus, Album, Aperture, Database, X, 
  Zap, CheckCircle, XCircle, Moon, Sun, Coffee, Rocket, 
  Wind, Code, Image as ImageIcon 
} from 'lucide-react';

const SCENT_CATEGORIES = {
  'LAVENDER': { id: 'lavender', name: '薰衣草', color: 'bg-purple-500', icon: Moon, colorCode: '#a855f7', shadow: 'shadow-purple-500/50' },
  'CITRUS': { id: 'citrus', name: '柑橘', color: 'bg-orange-500', icon: Sun, colorCode: '#f97316', shadow: 'shadow-orange-500/50' },
  'COFFEE': { id: 'coffee', name: '咖啡', color: 'bg-amber-700', icon: Coffee, colorCode: '#b45309', shadow: 'shadow-amber-700/50' },
  'SPACE': { id: 'space', name: '金属外太空', color: 'bg-cyan-500', icon: Rocket, colorCode: '#06b6d4', shadow: 'shadow-cyan-500/50' }
};

export default function App() {
  const [photos, setPhotos] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [exifData, setExifData] = useState(null);
  const fileInputRef = useRef(null);

  const showToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  // ⚠️ 核心新增：监听来自 Node.js 的实时广播
  useEffect(() => {
    // 如果网页运行在电脑以外的设备，记得改 IP
    const eventSource = new EventSource('http://localhost:8080/api/stream');

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.event === 'new_photo_from_camera') {
        console.log("📸 监听到硬件相机传来了新照片！", data);
        showToast("检测到相机新照片，开始分析...", 'info');
        
        // 收到硬件图片后，直接走第二步分析流程
        handleIncomingHardwarePhoto(data.filename, data.imageUrl, data.originalName);
      }
    };

    return () => eventSource.close(); // 组件卸载时关闭连接
  }, []);

  // 专门处理从硬件（或后台广播）传来的图片
  const handleIncomingHardwarePhoto = async (savedFilename, imageUrl, originalName) => {
    const photoId = 'img_' + Date.now();
    
    // 图片立刻上屏展示
    const newPhoto = {
      id: photoId,
      url: imageUrl, 
      fileName: originalName || 'camera_capture.jpg',
      status: 'analyzing',
      semantics: [],
      scentKey: null,
      timestamp: new Date().toLocaleString()
    };
    setPhotos(prev => [newPhoto, ...prev]);

    try {
      // 网页主动命令 Node.js 去调用大模型分析
      const analyzeResponse = await fetch("http://localhost:8080/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: savedFilename }) 
      });
      
      const analyzeData = await analyzeResponse.json();
      
      if (analyzeData.success) {
        const vlResult = analyzeData.analysis; 
        setPhotos(prev => prev.map(p => 
          p.id === photoId ? { ...p, status: 'complete', semantics: vlResult.semantics, scentKey: vlResult.scent } : p
        ));
        showToast(`硬件照片解析完成:【${SCENT_CATEGORIES[vlResult.scent].name}】`, 'success');
      } else {
         throw new Error("大模型分析失败");
      }
    } catch (error) {
      console.error("处理硬件照片中断", error);
      showToast("解析中断", 'error');
      setPhotos(prev => prev.filter(p => p.id !== photoId));
    }
  };

  // 处理网页端主动发起的本地上传或模拟拍照
  const processWebImage = async (imageFile, previewUrl) => {
    const photoId = 'img_' + Date.now();
    
    const newPhoto = {
      id: photoId,
      url: previewUrl, 
      fileName: imageFile.name || 'web_upload.jpg',
      status: 'analyzing',
      semantics: [],
      scentKey: null,
      timestamp: new Date().toLocaleString()
    };
    setPhotos(prev => [newPhoto, ...prev]);

    try {
      const formData = new FormData();
      formData.append('file', imageFile);

      const uploadResponse = await fetch("http://localhost:8080/api/upload", {
        method: "POST",
        body: formData 
      });
      const uploadData = await uploadResponse.json();

      if (!uploadData.success) throw new Error("图片保存失败");

      // ⚠️ 这里有一个小细节：网页端主动上传图片，Node 也会广播。
      // 为了防止网页“自己上传的图片，又因为听到广播而重复分析一遍”，
      // 我们实际上可以把 analyze 的请求留给广播处理，或者在网页端做个去重过滤。
      // 但现在我们直接把网页上传的分析也扔给 handleIncomingHardwarePhoto 处理，保持统一！
      
      // 意思是：我们传完就不用管了，Node 会广播，网页监听到广播会自动去展示和分析！
      // 为了不让本网页卡顿，先把之前放进去的占位图删掉，等待广播送来真实的图
      setPhotos(prev => prev.filter(p => p.id !== photoId));

    } catch (error) {
      console.error("上传流程中断", error);
      showToast("上传中断，请检查网络或服务器", 'error');
      setPhotos(prev => prev.filter(p => p.id !== photoId));
    }
  };

  const handleFileUpload = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const previewUrl = URL.createObjectURL(file);
      processWebImage(file, previewUrl);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const simulateCameraCapture = async () => {
    const randomId = Math.floor(Math.random() * 1000);
    const imageUrl = `https://picsum.photos/seed/${randomId}/800/600`;
    showToast("正在获取模拟照片...", 'info');
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const file = new File([blob], `Capture_${randomId}.jpg`, { type: 'image/jpeg' });
      await processWebImage(file, imageUrl);
    } catch (error) {
      showToast("获取模拟图片失败", 'error');
    }
  };

  const triggerScentDevice = (photo, event) => {
    if (!photo || !photo.scentKey) return;
    const scentInfo = SCENT_CATEGORIES[photo.scentKey];
    console.log(`[HARDWARE SIGNAL] COMMAND: EMIT_SCENT | CODE: ${scentInfo.id} | DURATION: 5s`);
    showToast(`正在给硬件发送信号...释放【${scentInfo.name}】`, 'info');

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
    setExifData({
      "Image": { "Make": "Scent_Memory_Capsule_System", "Model": "VL_Auto_Tagger_V1", "DateTime": photo.timestamp },
      "Scent_Metadata": {
        "Scent_Code": photo.scentKey, "Scent_Name": SCENT_CATEGORIES[photo.scentKey]?.name,
        "Hardware_Hex": "0x" + (photo.scentKey || '').split('').map(c => c.charCodeAt(0).toString(16)).join(''),
        "Semantic_Analysis": photo.semantics, "Confidence": (0.85 + Math.random() * 0.14).toFixed(4),
        "Model_Version": "vl-multimodal-v2.5"
      }
    });
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden font-sans transition-colors duration-300 global-theme-wrapper pb-20">
      <style dangerouslySetInnerHTML={{ __html: `
        :root { --insta-primary-yellow: #FFD200; --insta-primary-yellow-hover: #FFE04D; --insta-primary-yellow-active: #E6B800; --insta-primary-red: #D50000; --insta-tech-blue: #00A3FF; --insta-bg-main: #FFFFFF; --insta-bg-card: #F8F8F8; --insta-text-primary: #121212; --insta-text-secondary: #333333; --insta-text-minor: #666666; --insta-border-light: #F0F0F0; --insta-border-dark: #E5E5E5; --insta-success: #00B42A; --insta-error: #F53F3F; }
        @media (prefers-color-scheme: dark) { :root { --insta-bg-main: #0A0A0A; --insta-bg-card: #121212; --insta-text-primary: #FFFFFF; --insta-text-secondary: #F5F5F5; --insta-text-minor: #CCCCCC; --insta-border-light: #1E1E1E; --insta-border-dark: #2A2A2A; } }
        .global-theme-wrapper { background-color: var(--insta-bg-main); color: var(--insta-text-primary); }
        .btn-primary { background-color: var(--insta-primary-yellow); color: #121212; border: none; transition: all 0.2s ease; }
        .btn-primary:hover { background-color: var(--insta-primary-yellow-hover); transform: scale(1.02); box-shadow: 0 10px 25px -5px rgba(255, 210, 0, 0.4); }
        .btn-primary:active { background-color: var(--insta-primary-yellow-active); transform: scale(0.98); }
        @keyframes floatUp { 0% { transform: translateY(0) scale(1); opacity: 1; } 100% { transform: translateY(-50px) scale(2); opacity: 0; } }
        .scent-particle { position: absolute; width: 10px; height: 10px; border-radius: 50%; pointer-events: none; animation: floatUp 1.5s ease-out forwards; z-index: 100; }
      `}} />

      <div className="max-w-6xl mx-auto px-4 py-10">
        <header className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight" style={{ color: 'var(--insta-text-primary)' }}>留息——</h1>
          <p className="max-w-2xl mx-auto text-sm md:text-base leading-relaxed" style={{ color: 'var(--insta-text-minor)' }}>全自动多模态香气标记系统。按下运动相机快门瞬间，VL模型将提取「场景语义 + 情绪氛围」，自动赋予专属香气标签。</p>
        </header>

        <section className="border rounded-2xl p-8 mb-12 shadow-sm transition-colors duration-300 flex flex-col items-center justify-center gap-8 relative overflow-hidden" style={{ backgroundColor: 'var(--insta-bg-card)', borderColor: 'var(--insta-border-light)' }}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#FFD200] to-transparent opacity-10 rounded-bl-full pointer-events-none"></div>
          <div className="text-center w-full max-w-2xl z-10">
            <h2 className="text-2xl font-bold flex items-center justify-center gap-2 mb-3" style={{ color: 'var(--insta-text-primary)' }}><Aperture style={{ color: 'var(--insta-primary-red)' }} /> 实时感知与标记系统</h2>
            <p className="text-sm" style={{ color: 'var(--insta-text-minor)' }}>核心主力模式：完美适配运动相机使用场景。用户按快门，系统全自动完成解析、标记与香气控制，零学习成本。</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-5 w-full justify-center items-center z-10">
            <button onClick={simulateCameraCapture} className="btn-primary w-full sm:w-auto flex items-center justify-center gap-3 font-bold px-10 py-4 rounded-xl text-lg">
              <Camera className="w-6 h-6" /><span>按下快门 (实时生成香气)</span>
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" multiple className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-transparent border px-6 py-4 rounded-xl transition-all hover:text-[var(--insta-text-primary)]" style={{ borderColor: 'var(--insta-border-dark)', color: 'var(--insta-text-minor)' }}>
              <ImagePlus className="w-5 h-5" /><span className="text-sm font-medium">补加老照片标签</span>
            </button>
          </div>
        </section>

        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-medium flex items-center gap-2" style={{ color: 'var(--insta-text-primary)' }}><Album style={{ color: 'var(--insta-primary-red)' }} /> 记忆图库</h3>
          <span className="text-sm" style={{ color: 'var(--insta-text-minor)' }}>共 {photos.length} 张照片</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {photos.length === 0 && (
            <div className="col-span-full py-20 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl" style={{ borderColor: 'var(--insta-border-light)', backgroundColor: 'var(--insta-bg-card)', color: 'var(--insta-text-minor)' }}>
              <ImageIcon className="w-16 h-16 mb-4 opacity-50" /><p>暂无记忆胶囊，请等待相机按下快门</p>
            </div>
          )}
          {photos.map(photo => <PhotoCard key={photo.id} photo={photo} onTriggerScent={triggerScentDevice} onOpenExif={openExifModal} />)}
        </div>
      </div>

      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
        {toasts.map(toast => <ToastItem key={toast.id} toast={toast} />)}
      </div>

      {exifData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
          <div className="border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200" style={{ backgroundColor: 'var(--insta-bg-main)', borderColor: 'var(--insta-border-dark)' }}>
            <div className="flex justify-between items-center p-4 border-b" style={{ borderColor: 'var(--insta-border-light)' }}>
              <h4 className="font-medium flex items-center gap-2" style={{ color: 'var(--insta-text-primary)' }}><Database className="w-4 h-4" style={{ color: 'var(--insta-tech-blue)' }} /> 底层元数据 (EXIF) 预览</h4>
              <button onClick={() => setExifData(null)} style={{ color: 'var(--insta-text-minor)' }} className="hover:opacity-70 transition-opacity"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4"><pre className="p-4 rounded-lg text-xs font-mono overflow-x-auto overflow-y-auto max-h-64 border" style={{ backgroundColor: 'var(--insta-bg-card)', color: 'var(--insta-text-secondary)', borderColor: 'var(--insta-border-light)' }}>{JSON.stringify(exifData, null, 2)}</pre></div>
            <div className="p-4 border-t flex justify-end" style={{ borderColor: 'var(--insta-border-light)', backgroundColor: 'var(--insta-bg-card)' }}>
              <button onClick={() => setExifData(null)} className="px-4 py-2 rounded-lg text-sm font-medium transition-colors" style={{ backgroundColor: 'var(--insta-primary-yellow)', color: '#121212' }}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PhotoCard({ photo, onTriggerScent, onOpenExif }) {
  return (
    <div className="border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all hover:-translate-y-1 group flex flex-col" style={{ backgroundColor: 'var(--insta-bg-card)', borderColor: 'var(--insta-border-light)' }}>
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
                <span className={`flex items-center justify-center w-8 h-8 rounded-full ${SCENT_CATEGORIES[photo.scentKey]?.color || 'bg-gray-500'} shadow-sm text-white`}>
                  {SCENT_CATEGORIES[photo.scentKey] ? React.createElement(SCENT_CATEGORIES[photo.scentKey].icon, { size: 16 }) : <ImageIcon size={16} />}
                </span>
                <h4 className="font-bold text-lg" style={{ color: 'var(--insta-text-primary)' }}>{SCENT_CATEGORIES[photo.scentKey]?.name || '未知气味'}</h4>
              </div>
              <button onClick={() => onOpenExif(photo)} className="text-xs flex items-center gap-1 transition-colors hover:opacity-70" style={{ color: 'var(--insta-text-minor)' }}><Code className="w-3 h-3" /> EXIF</button>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {photo.semantics?.map((tag, idx) => (
                <span key={idx} className="px-2 py-1 border rounded-md text-xs" style={{ backgroundColor: 'var(--insta-bg-main)', borderColor: 'var(--insta-border-light)', color: 'var(--insta-text-secondary)' }}>#{tag}</span>
              ))}
            </div>
            <div className="mt-auto pt-4 border-t" style={{ borderColor: 'var(--insta-border-light)' }}>
              <button onClick={(e) => onTriggerScent(photo, e)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-colors text-sm font-medium hover:bg-[var(--insta-primary-yellow)] hover:border-[var(--insta-primary-yellow)] hover:text-[#121212]" style={{ backgroundColor: 'var(--insta-bg-main)', borderColor: 'var(--insta-border-dark)', color: 'var(--insta-text-primary)' }}>
                <Wind className="w-4 h-4" />释放香气信号
              </button>
            </div>
          </>
        ) : (
          <>
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

function ToastItem({ toast }) {
  let iconColor = 'var(--insta-tech-blue)';
  let Icon = Zap;
  if (toast.type === 'success') { Icon = CheckCircle; iconColor = 'var(--insta-success)'; } 
  else if (toast.type === 'error') { Icon = XCircle; iconColor = 'var(--insta-error)'; } 
  else if (toast.type === 'info') { iconColor = 'var(--insta-primary-yellow)'; }

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg animate-in slide-in-from-bottom-5 fade-in duration-300 pointer-events-auto" style={{ backgroundColor: 'var(--insta-bg-card)', borderColor: 'var(--insta-border-light)' }}>
      <span style={{ color: iconColor }}><Icon className="w-5 h-5" /></span>
      <span className="text-sm font-medium" style={{ color: 'var(--insta-text-primary)' }}>{toast.message}</span>
    </div>
  );
}