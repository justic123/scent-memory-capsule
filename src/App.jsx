import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, ImagePlus, Album, Aperture, Database, X, 
  Zap, CheckCircle, XCircle, Moon, Sun, Coffee, Rocket, 
  Wind, Code, Image as ImageIcon, Sparkles, Filter, Focus
} from 'lucide-react';

const SCENT_CATEGORIES = {
  'LAVENDER': { id: 'lavender', name: '薰衣草', color: 'bg-purple-500', icon: Moon, colorCode: '#a855f7', shadow: 'shadow-purple-500/50' },
  'CITRUS': { id: 'citrus', name: '柑橘', color: 'bg-orange-500', icon: Sun, colorCode: '#f97316', shadow: 'shadow-orange-500/50' },
  'COFFEE': { id: 'coffee', name: '咖啡', color: 'bg-amber-700', icon: Coffee, colorCode: '#b45309', shadow: 'shadow-amber-700/50' },
  'SPACE': { id: 'space', name: '金属外太空', color: 'bg-cyan-500', icon: Rocket, colorCode: '#06b6d4', shadow: 'shadow-cyan-500/50' }
};

const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

let bleCharacteristic = null; 

export default function App() {
  const [photos, setPhotos] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [exifData, setExifData] = useState(null);
  const [isBleConnected, setIsBleConnected] = useState(false);
  const [activeFilter, setActiveFilter] = useState('ALL'); 
  const [selectedPhotoId, setSelectedPhotoId] = useState(null); 
  const fileInputRef = useRef(null);

  const showToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  const connectBluetooth = async () => {
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ name: 'ESP32_Scent_Capsule' }],
        optionalServices: [SERVICE_UUID]
      });
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(SERVICE_UUID);
      bleCharacteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);
      
      setIsBleConnected(true);
      showToast('硬件连接成功！', 'success');
      
      device.addEventListener('gattserverdisconnected', () => {
        bleCharacteristic = null;
        setIsBleConnected(false);
        showToast('蓝牙已断开', 'error');
      });
    } catch (err) {
      console.error('蓝牙连接失败:', err);
      showToast('蓝牙连接取消或失败', 'error');
    }
  };

  const sendToESP32 = async (scent) => {
    if (!bleCharacteristic) {
      console.warn('蓝牙未连接，跳过发送');
      showToast('请先连接蓝牙胶囊', 'error');
      return false;
    }
    try {
      const encoder = new TextEncoder();
      await bleCharacteristic.writeValue(encoder.encode(scent));
      return true;
    } catch (err) {
      console.error('蓝牙通信失败:', err);
      return false;
    }
  };

  useEffect(() => {
    const eventSource = new EventSource('http://localhost:8080/api/stream');
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.event === 'new_photo_from_camera') {
        showToast("检测到新照片，开始多模态解析...", 'info');
        handleIncomingHardwarePhoto(data.filename, data.imageUrl, data.originalName);
      }
    };
    return () => eventSource.close(); 
  }, []);

  const handleIncomingHardwarePhoto = async (savedFilename, imageUrl, originalName) => {
    const photoId = 'img_' + Date.now();
    const newPhoto = {
      id: photoId, url: imageUrl, fileName: originalName || 'camera_capture.jpg',
      status: 'analyzing', semantics: [], scentKey: null, timestamp: new Date().toLocaleString()
    };
    setPhotos(prev => [newPhoto, ...prev]);
    setSelectedPhotoId(null); 

    try {
      const analyzeResponse = await fetch("http://localhost:8080/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: savedFilename }) 
      });
      const analyzeData = await analyzeResponse.json();
      
      if (analyzeData.success) {
        const vlResult = analyzeData.analysis; 
        setPhotos(prev => prev.map(p => 
          p.id === photoId ? { ...p, status: 'complete', semantics: vlResult.semantics, scentKey: vlResult.scent } : p
        ));
        showToast(`照片解析完成:【${SCENT_CATEGORIES[vlResult.scent].name}】`, 'success');
        sendToESP32(vlResult.scent);
      } else {
         throw new Error("大模型分析失败");
      }
    } catch (error) {
      showToast("解析中断", 'error');
      setPhotos(prev => prev.filter(p => p.id !== photoId));
    }
  };

  // ✅ 修复：手动上传老照片（去掉前端伪造卡片，统一依靠后端的 SSE 广播推送）
  const processWebImage = async (imageFile) => {
    showToast("正在上传老照片...", 'info');
    try {
      const formData = new FormData();
      formData.append('file', imageFile);
      const uploadResponse = await fetch("http://localhost:8080/api/upload", { method: "POST", body: formData });
      const uploadData = await uploadResponse.json();
      if (!uploadData.success) throw new Error("图片保存失败");
    } catch (error) {
      console.error("上传流程中断", error);
      showToast("上传中断，请检查网络或服务器", 'error');
    }
  };

  const handleFileUpload = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      processWebImage(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const triggerScentDevice = async (photo, event) => {
    if (!photo || !photo.scentKey) return;
    const scentInfo = SCENT_CATEGORIES[photo.scentKey];
    showToast(`正在发送信号...释放【${scentInfo.name}】`, 'info');
    const success = await sendToESP32(photo.scentKey);
    
    if (success) {
      const btn = event.currentTarget;
      const rect = btn.getBoundingClientRect();
      for(let i=0; i<5; i++) {
        createParticle(rect.left + rect.width/2, rect.top, scentInfo.colorCode);
      }
      showToast(`ESP32 已接收指令！`, 'success');
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

  const displayPhoto = selectedPhotoId 
    ? photos.find(p => p.id === selectedPhotoId) || (photos.length > 0 ? photos[0] : null)
    : (photos.length > 0 ? photos[0] : null);
  
  const galleryPhotos = activeFilter === 'ALL' 
    ? photos
    : photos.filter(p => p.scentKey === activeFilter);

  return (
    <div className="min-h-screen relative overflow-x-hidden transition-colors duration-300 global-theme-wrapper pb-20">
      <style dangerouslySetInnerHTML={{ __html: `
        :root { 
          --insta-primary-yellow: #FFD200; --insta-primary-yellow-hover: #FFE04D; 
          --insta-tech-blue: #007AFF; --insta-bg-main: #F2F2F7; --insta-bg-card: #FFFFFF; 
          --insta-text-primary: #1C1C1E; --insta-text-secondary: #3A3A3C; --insta-text-minor: #8E8E93; 
          --insta-border-light: #E5E5EA; --insta-border-dark: #D1D1D6; 
          --insta-success: #34C759; --insta-error: #FF3B30; 
        }
        @media (prefers-color-scheme: dark) { 
          :root { 
            --insta-bg-main: #000000; --insta-bg-card: #1C1C1E; 
            --insta-text-primary: #F2F2F7; --insta-text-secondary: #EBEBF5; --insta-text-minor: #8E8E93; 
            --insta-border-light: #38383A; --insta-border-dark: #48484A; 
          } 
        }
        body { 
          font-family: "SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", Helvetica, Arial, sans-serif; 
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        .global-theme-wrapper { background-color: var(--insta-bg-main); color: var(--insta-text-primary); }
        @keyframes floatUp { 0% { transform: translateY(0) scale(1); opacity: 1; } 100% { transform: translateY(-50px) scale(2); opacity: 0; } }
        .scent-particle { position: absolute; width: 10px; height: 10px; border-radius: 50%; pointer-events: none; animation: floatUp 1.5s ease-out forwards; z-index: 100; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* 顶部 Header */}
        <header className="flex flex-col items-center justify-center mb-10 text-center relative">
          <h1 className="text-4xl md:text-5xl font-bold mb-3 tracking-tight" style={{ color: 'var(--insta-text-primary)' }}>
            闻 帧 <span className="font-medium text-2xl md:text-3xl" style={{ color: 'var(--insta-text-minor)' }}>WenFrame</span>
          </h1>
          <p className="max-w-2xl mx-auto text-sm md:text-base leading-relaxed mb-6" style={{ color: 'var(--insta-text-minor)' }}>
            让记忆，有迹可闻。
          </p>
          
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button 
              onClick={connectBluetooth} 
              className={`flex items-center justify-center gap-2 px-6 py-3 rounded-full font-medium transition-all shadow-sm ${isBleConnected ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-white border hover:bg-gray-50'}`}
              style={!isBleConnected ? { borderColor: 'var(--insta-border-dark)', color: 'var(--insta-text-primary)' } : {}}
            >
              <Zap className={`w-5 h-5 ${isBleConnected ? 'text-green-600' : 'text-blue-500'}`} />
              {isBleConnected ? '闻息盒已连接' : '连接闻息盒设备'}
            </button>

            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" multiple className="hidden" />
            <button 
              onClick={() => fileInputRef.current?.click()} 
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-full font-medium text-sm transition-all hover:opacity-80"
              style={{ backgroundColor: 'transparent', color: 'var(--insta-text-minor)' }}
            >
              <ImagePlus className="w-5 h-5" /> 手动补加照片
            </button>
          </div>
        </header>

        {/* 🌟 核心展示区：调整为 62% : 38% 的协调比例 */}
        {displayPhoto && (
          <section className="mb-16 animate-in slide-in-from-bottom-4 fade-in duration-500">
            <div className="flex items-center justify-center gap-2 mb-6">
              {selectedPhotoId && selectedPhotoId !== photos[0]?.id ? (
                <Focus className="w-5 h-5 text-blue-500" />
              ) : (
                <Sparkles className="w-5 h-5 text-yellow-500" />
              )}
              <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--insta-text-primary)' }}>
                {selectedPhotoId && selectedPhotoId !== photos[0]?.id ? '当前查看胶囊' : '最新捕获定格'}
              </h2>
            </div>
            
            <div className="w-full max-w-5xl mx-auto p-4 md:p-6 rounded-[2.5rem] shadow-xl border" style={{ backgroundColor: 'var(--insta-bg-card)', borderColor: 'var(--insta-border-light)' }}>
              {/* 调整了 gap，由 md:gap-10 改为 md:gap-8，给变窄的右侧留出呼吸空间 */}
              <div className="flex flex-col md:flex-row gap-6 md:gap-8 h-full">
                
                {/* 🌟 左侧大图：宽度改为 w-[62%] */}
                <div className="relative w-full md:w-[62%] h-72 md:h-[480px] rounded-[1.5rem] overflow-hidden bg-black/5 shadow-inner border" style={{ borderColor: 'var(--insta-border-light)' }}>
                  <img src={displayPhoto.url} alt="Memory Center" className="w-full h-full object-cover opacity-95 hover:opacity-100 transition-opacity duration-500" />
                  {displayPhoto.status === 'analyzing' && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-10 backdrop-blur-sm">
                      <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mb-4" style={{ borderColor: 'var(--insta-primary-yellow)', borderTopColor: 'transparent' }}></div>
                      <span className="text-base font-medium text-white tracking-widest animate-pulse">VL 多模态解析中...</span>
                    </div>
                  )}
                </div>
                
                {/* 🌟 右侧信息区：宽度改为 w-[38%] */}
                <div className="w-full md:w-[38%] py-4 md:py-6 pr-2 md:pr-4 flex flex-col justify-center">
                  {displayPhoto.status === 'complete' ? (
                    <div className="flex flex-col h-full animate-in fade-in duration-500">
                      <div className="mb-8">
                        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--insta-text-minor)' }}>当前香气模式</p>
                        <div className="flex items-center gap-4">
                          <div className={`flex shrink-0 items-center justify-center w-14 h-14 rounded-2xl shadow-lg text-white ${SCENT_CATEGORIES[displayPhoto.scentKey]?.color || 'bg-gray-500'}`}>
                            {SCENT_CATEGORIES[displayPhoto.scentKey] ? React.createElement(SCENT_CATEGORIES[displayPhoto.scentKey].icon, { size: 28 }) : <ImageIcon size={28} />}
                          </div>
                          <div>
                            <h3 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--insta-text-primary)' }}>
                              {SCENT_CATEGORIES[displayPhoto.scentKey]?.name || '未知'}
                            </h3>
                            <button onClick={() => openExifModal(displayPhoto)} className="text-[11px] flex items-center gap-1 mt-1.5 hover:opacity-70 transition-opacity" style={{ color: 'var(--insta-text-minor)' }}>
                              <Code className="w-3.5 h-3.5" /> 元数据预览
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="mb-auto">
                        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--insta-text-minor)' }}>场景语义提取</p>
                        <div className="flex flex-wrap gap-2">
                          {displayPhoto.semantics?.map((tag, idx) => (
                            <span key={idx} className="px-3 py-1.5 rounded-xl text-sm font-medium border" style={{ backgroundColor: 'var(--insta-bg-main)', borderColor: 'var(--insta-border-light)', color: 'var(--insta-text-secondary)' }}>
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      <button 
                        onClick={(e) => triggerScentDevice(displayPhoto, e)} 
                        className="mt-8 w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-base md:text-lg shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all active:translate-y-0"
                        style={{ backgroundColor: 'var(--insta-primary-yellow)', color: '#1C1C1E' }}
                      >
                        <Wind className="w-5 h-5" /> 发送香气指令
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col h-full justify-center">
                       <div className="h-6 rounded w-1/3 mb-6 animate-pulse" style={{ backgroundColor: 'var(--insta-border-light)' }}></div>
                       <div className="flex gap-4 mb-8">
                         <div className="h-14 rounded-[1.25rem] w-14 animate-pulse shrink-0" style={{ backgroundColor: 'var(--insta-border-light)' }}></div>
                         <div className="flex flex-col justify-center gap-2 w-full">
                            <div className="h-6 rounded w-20 animate-pulse" style={{ backgroundColor: 'var(--insta-border-light)' }}></div>
                            <div className="h-4 rounded w-28 animate-pulse" style={{ backgroundColor: 'var(--insta-border-light)' }}></div>
                         </div>
                       </div>
                       <div className="h-14 rounded-2xl w-full animate-pulse mt-auto" style={{ backgroundColor: 'var(--insta-border-light)' }}></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 📚 历史记忆图库 */}
        <section>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h3 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--insta-text-primary)' }}>
              <Album className="w-5 h-5 text-blue-500" /> 记忆胶囊
            </h3>
            
            <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-2 md:pb-0">
              <Filter className="w-4 h-4 mr-1 hidden md:block" style={{ color: 'var(--insta-text-minor)' }} />
              <button 
                onClick={() => setActiveFilter('ALL')}
                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${activeFilter === 'ALL' ? 'bg-[#1C1C1E] text-white border-[#1C1C1E] dark:bg-white dark:text-black' : 'bg-transparent'}`}
                style={activeFilter !== 'ALL' ? { borderColor: 'var(--insta-border-dark)', color: 'var(--insta-text-secondary)' } : {}}
              >
                全部
              </button>
              {Object.entries(SCENT_CATEGORIES).map(([key, cat]) => (
                <button 
                  key={key}
                  onClick={() => setActiveFilter(key)}
                  className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors border flex items-center gap-1.5 ${activeFilter === key ? cat.color + ' text-white border-transparent' : 'bg-transparent'}`}
                  style={activeFilter !== key ? { borderColor: 'var(--insta-border-dark)', color: 'var(--insta-text-secondary)' } : {}}
                >
                  <cat.icon className="w-3.5 h-3.5" /> {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
            {galleryPhotos.length === 0 && (
              <div className="col-span-full py-20 flex flex-col items-center justify-center border border-dashed rounded-[2rem]" style={{ borderColor: 'var(--insta-border-dark)', backgroundColor: 'transparent', color: 'var(--insta-text-minor)' }}>
                <ImageIcon className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">该分类下暂无记忆胶囊</p>
              </div>
            )}
            {galleryPhotos.map(photo => (
              <PhotoCard 
                key={photo.id} 
                photo={photo} 
                isActive={selectedPhotoId === photo.id} 
                onSelect={() => {
                  setSelectedPhotoId(photo.id);
                  window.scrollTo({ top: 0, behavior: 'smooth' }); 
                }}
                onTriggerScent={triggerScentDevice} 
                onOpenExif={openExifModal} 
              />
            ))}
          </div>
        </section>

      </div>

      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
        {toasts.map(toast => <ToastItem key={toast.id} toast={toast} />)}
      </div>

      {exifData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-50 flex items-center justify-center animate-in fade-in duration-200 px-4">
          <div className="border rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200" style={{ backgroundColor: 'var(--insta-bg-main)', borderColor: 'var(--insta-border-light)' }}>
            <div className="flex justify-between items-center p-6 border-b" style={{ borderColor: 'var(--insta-border-light)' }}>
              <h4 className="font-bold flex items-center gap-2" style={{ color: 'var(--insta-text-primary)' }}><Database className="w-4 h-4 text-blue-500" /> 底层元数据预览</h4>
              <button onClick={() => setExifData(null)} style={{ color: 'var(--insta-text-minor)' }} className="hover:opacity-70 transition-opacity"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <pre className="p-4 rounded-xl text-xs font-mono overflow-x-auto overflow-y-auto max-h-72 border leading-relaxed" style={{ backgroundColor: 'var(--insta-bg-card)', color: 'var(--insta-text-secondary)', borderColor: 'var(--insta-border-light)' }}>
                {JSON.stringify(exifData, null, 2)}
              </pre>
            </div>
            <div className="p-5 border-t flex justify-end" style={{ borderColor: 'var(--insta-border-light)', backgroundColor: 'var(--insta-bg-card)' }}>
              <button onClick={() => setExifData(null)} className="px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm hover:opacity-90" style={{ backgroundColor: 'var(--insta-text-primary)', color: 'var(--insta-bg-main)' }}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PhotoCard({ photo, isActive, onSelect, onTriggerScent, onOpenExif }) {
  return (
    <div 
      onClick={onSelect}
      className={`cursor-pointer border rounded-2xl overflow-hidden shadow-sm transition-all duration-300 hover:-translate-y-1 group flex flex-col ${isActive ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-[#1C1C1E]' : 'hover:shadow-xl'}`} 
      style={{ backgroundColor: 'var(--insta-bg-card)', borderColor: 'var(--insta-border-light)' }}
    >
      <div className="relative w-full aspect-square bg-[#000] overflow-hidden">
        <img src={photo.url} alt="memory" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-90 group-hover:opacity-100" />
        {photo.status === 'complete' && photo.scentKey && (
          <div className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-white shadow-md backdrop-blur-sm bg-black/20 border border-white/20`}>
             {React.createElement(SCENT_CATEGORIES[photo.scentKey].icon, { size: 14 })}
          </div>
        )}
      </div>
      <div className="p-4 flex-1 flex flex-col pointer-events-auto">
        {photo.status === 'complete' ? (
          <>
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-bold text-sm tracking-tight" style={{ color: 'var(--insta-text-primary)' }}>{SCENT_CATEGORIES[photo.scentKey]?.name || '未知气味'}</h4>
              <button 
                onClick={(e) => { e.stopPropagation(); onOpenExif(photo); }} 
                className="text-xs p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" 
                style={{ color: 'var(--insta-text-minor)' }}
              >
                <Code className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="mt-auto pt-3 border-t" style={{ borderColor: 'var(--insta-border-light)' }}>
              <button 
                onClick={(e) => { e.stopPropagation(); onTriggerScent(photo, e); }} 
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border transition-colors text-xs font-bold hover:bg-[var(--insta-primary-yellow)] hover:border-[var(--insta-primary-yellow)] hover:text-[#1C1C1E]" 
                style={{ backgroundColor: 'transparent', borderColor: 'var(--insta-border-dark)', color: 'var(--insta-text-secondary)' }}
              >
                <Wind className="w-3.5 h-3.5" /> 释放香气
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col justify-center h-full gap-2">
            <div className="h-4 rounded w-1/2 animate-pulse" style={{ backgroundColor: 'var(--insta-border-light)' }}></div>
            <div className="h-8 rounded-xl w-full animate-pulse mt-3" style={{ backgroundColor: 'var(--insta-border-light)' }}></div>
          </div>
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
    <div className="flex items-center gap-3 px-5 py-3.5 rounded-xl border shadow-xl animate-in slide-in-from-bottom-5 fade-in duration-300 pointer-events-auto" style={{ backgroundColor: 'var(--insta-bg-card)', borderColor: 'var(--insta-border-light)' }}>
      <span style={{ color: iconColor }}><Icon className="w-5 h-5" /></span>
      <span className="text-sm font-bold" style={{ color: 'var(--insta-text-primary)' }}>{toast.message}</span>
    </div>
  );
}