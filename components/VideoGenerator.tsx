
import React, { useState, useRef, useEffect } from 'react';
import { VideoMode, Resolution, AspectRatio, GenerationHistory, UserProfile } from '../types';
import { generateVeoVideo } from '../services/gemini';
import { 
  DIRECTOR_MODE_INSTRUCTION, 
  LINK_ANALYSIS_INSTRUCTION,
  SEAMLESS_FLOW_INSTRUCTION,
  SUBSCRIPTION_PLANS
} from '../constants';
import { GoogleGenAI } from "@google/genai";

interface VideoGeneratorProps {
  onGenerated: (item: GenerationHistory) => void;
  history: GenerationHistory[];
  onOpenPricing: () => void;
  profile: UserProfile;
  onKeyError: () => void;
  analyzedScript: string;
  setAnalyzedScript: (s: string) => void;
  directorScript: string;
  setDirectorScript: (s: string) => void;
  seamlessScript: string;
  setSeamlessScript: (s: string) => void;
  targetLink: string;
  setTargetLink: (l: string) => void;
}

enum ToolMode {
  NONE = 'NONE',
  DIRECTOR = 'DIRECTOR',
  LINK_ANALYSER = 'LINK_ANALYSER',
  SEAMLESS_FLOW = 'SEAMLESS_FLOW'
}

interface HistoryState {
  prompts: Record<VideoMode, string>;
  images: Record<VideoMode, {url: string, name: string}[]>;
}

export const VideoGenerator: React.FC<VideoGeneratorProps> = ({ 
  onGenerated, history, onOpenPricing, profile, onKeyError,
  analyzedScript, setAnalyzedScript, directorScript, setDirectorScript,
  seamlessScript, setSeamlessScript, targetLink, setTargetLink
}) => {
  const [mode, setMode] = useState<VideoMode>(VideoMode.TEXT_TO_VIDEO);
  const [toolMode, setToolMode] = useState<ToolMode>(ToolMode.NONE);
  const [concurrentRenderCount, setConcurrentRenderCount] = useState<0 | 3 | 5>(0);
  const [showStitchModal, setShowStitchModal] = useState(false);
  const [isFullVideoRendering, setIsFullVideoRendering] = useState(false);
  const [outputLanguage, setOutputLanguage] = useState<'EN' | 'VN'>('EN');

  const [modePrompts, setModePrompts] = useState<Record<VideoMode, string>>({
    [VideoMode.TEXT_TO_VIDEO]: '',
    [VideoMode.IMAGE_TO_VIDEO]: '',
    [VideoMode.INTERPOLATION]: '',
    [VideoMode.CONSISTENCY]: ''
  });

  const [modeImages, setModeImages] = useState<Record<VideoMode, {url: string, name: string}[]>>({
    [VideoMode.TEXT_TO_VIDEO]: [],
    [VideoMode.IMAGE_TO_VIDEO]: [],
    [VideoMode.INTERPOLATION]: [],
    [VideoMode.CONSISTENCY]: []
  });

  const [historyStack, setHistoryStack] = useState<HistoryState[]>([]);

  const pushToHistory = () => {
    const newState: HistoryState = { prompts: { ...modePrompts }, images: { ...modeImages } };
    setHistoryStack(prev => [...prev, JSON.parse(JSON.stringify(newState))].slice(-50));
  };

  const undo = () => {
    if (historyStack.length === 0) return;
    const lastState = historyStack[historyStack.length - 1];
    setModePrompts({ ...lastState.prompts });
    setModeImages({ ...lastState.images });
    setHistoryStack(prev => prev.slice(0, -1));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyStack]);

  const [concurrentPrompts, setConcurrentPrompts] = useState<string[]>(['', '', '', '', '']);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [stopCountdown, setStopCountdown] = useState(20);
  const [activeTasks, setActiveTasks] = useState<GenerationHistory[]>([]);

  const [directorForm, setDirectorForm] = useState({ genre: 'Hành động', plot: '', mainChar: '', promptCount: '10' });
  const [seamlessForm, setSeamlessForm] = useState({ script: '', count: '10', dna: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const specificSlotRef = useRef<{ index: number; subIndex?: number } | null>(null);
  const [aspectRatio] = useState<AspectRatio>(AspectRatio.LANDSCAPE);
  const [showZaloQR, setShowZaloQR] = useState(false);

  const currentImages = modeImages[mode];
  const currentPromptText = modePrompts[mode];

  useEffect(() => {
    let timer: any;
    if (isStopping && stopCountdown > 0) {
      timer = setInterval(() => setStopCountdown(prev => prev - 1), 1000);
    } else if (stopCountdown === 0) {
      setIsStopping(false); setIsGenerating(false); setIsFullVideoRendering(false); setStopCountdown(20);
    }
    return () => clearInterval(timer);
  }, [isStopping, stopCountdown]);

  const updatePromptForMode = (newText: string) => setModePrompts(prev => ({ ...prev, [mode]: newText }));

  const runGenerationTask = async (prompt: string, index: number, total: number, laneId: string = '', prevVideoRef?: any) => {
    const taskId = `vpro-${Date.now()}-${laneId}-${index}`;
    const task: GenerationHistory = { id: taskId, url: '', prompt, timestamp: Date.now(), mode, progress: 5, status: `${laneId ? `Luồng ${laneId}: ` : ''}Đang tạo...` };
    setActiveTasks(prev => [task, ...prev]);
    try {
      let reqImages: string[] = [];
      if (!prevVideoRef) {
        if (mode === VideoMode.IMAGE_TO_VIDEO) reqImages = [currentImages[index]?.url].filter(Boolean) as string[];
        else if (mode === VideoMode.INTERPOLATION) reqImages = [currentImages[index*2]?.url, currentImages[index*2+1]?.url].filter(Boolean) as string[];
        else if (mode === VideoMode.CONSISTENCY) reqImages = currentImages.map(img => img.url).filter(Boolean);
      }
      
      const customKey = sessionStorage.getItem('veopro_use_custom') === 'true' 
        ? sessionStorage.getItem('veopro_custom_key') || undefined 
        : undefined;
      
      const result = await generateVeoVideo({ 
        mode, prompt, resolution: Resolution.R720P, aspectRatio, images: reqImages, 
        previousVideo: prevVideoRef,
        customApiKey: customKey,
        onProgress: (msg) => {
          setActiveTasks(cur => cur.map(t => t.id === taskId ? { ...t, status: `${laneId ? `Luồng ${laneId}: ` : ''}${msg}`, progress: Math.min((t.progress || 5) + 3, 99) } : t));
        }
      });
      
      const completed = { ...task, url: result.finalUrl, status: 'Hoàn thành', progress: 100 };
      onGenerated(completed);
      setActiveTasks(cur => cur.map(t => t.id === taskId ? completed : t));
      return result.response?.generatedVideos?.[0]?.video;
    } catch (err: any) {
      setActiveTasks(cur => cur.map(t => t.id === taskId ? { ...t, status: 'Lỗi', progress: 0 } : t));
      if (err.message.includes("API Key")) onKeyError();
      return null;
    }
  };

  const handleRunFullVideo = async () => {
    const prompts = currentPromptText.split('\n').map(p => p.trim()).filter(p => p !== '');
    if (prompts.length === 0) { alert("Vui lòng nhập kịch bản hoặc phân tích link trước."); return; }
    setIsFullVideoRendering(true); setIsGenerating(true); setIsStopping(false);
    let lastVideoRef = null;
    for (let i = 0; i < prompts.length; i++) {
      if (isStopping) break;
      lastVideoRef = await runGenerationTask(prompts[i], i, prompts.length, 'CinemaFlow', lastVideoRef);
    }
    setIsFullVideoRendering(false); setIsGenerating(false);
  };

  const handleToolGenerate = async (tMode: ToolMode) => {
    setIsGenerating(true);
    try {
      const apiKey = (sessionStorage.getItem('veopro_use_custom') === 'true' && sessionStorage.getItem('veopro_custom_key')) 
        ? sessionStorage.getItem('veopro_custom_key')! 
        : process.env.API_KEY;
      
      const ai = new GoogleGenAI({ apiKey });
      let instruction = '';
      let content = '';
      if (tMode === ToolMode.DIRECTOR) {
        instruction = DIRECTOR_MODE_INSTRUCTION;
        content = `Thể loại: ${directorForm.genre}. Cốt truyện: ${directorForm.plot}. DNA: ${directorForm.mainChar}. Số cảnh: ${directorForm.promptCount}. Ngôn ngữ: ${outputLanguage}.`;
      } else if (tMode === ToolMode.LINK_ANALYSER) {
        instruction = LINK_ANALYSIS_INSTRUCTION;
        content = `Link Youtube: ${targetLink}. Ngôn ngữ: ${outputLanguage}.`;
      } else if (tMode === ToolMode.SEAMLESS_FLOW) {
        instruction = SEAMLESS_FLOW_INSTRUCTION;
        content = `Kịch bản: ${seamlessForm.script}. DNA: ${seamlessForm.dna}. Số cảnh: ${seamlessForm.count}. Ngôn ngữ: ${outputLanguage}.`;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: content,
        config: { systemInstruction: instruction, tools: tMode === ToolMode.LINK_ANALYSER ? [{ googleSearch: {} }] : undefined }
      });

      const text = response.text || '';
      if (tMode === ToolMode.DIRECTOR) setDirectorScript(text);
      else if (tMode === ToolMode.LINK_ANALYSER) setAnalyzedScript(text);
      else if (tMode === ToolMode.SEAMLESS_FLOW) setSeamlessScript(text);

      const extracted = text.match(/\[.*?\]/g);
      if (extracted) updatePromptForMode(extracted.map(p => p.slice(1, -1)).join('\n'));
    } catch (err) { alert("Lỗi khi xử lý dữ liệu AI."); }
    finally { setIsGenerating(false); }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setIsStopping(false);
    try {
      if (concurrentRenderCount > 0) {
        const activePrompts = concurrentPrompts.filter(p => p.trim() !== '');
        await Promise.all(activePrompts.map((p, i) => runGenerationTask(p, i, activePrompts.length, (i + 1).toString())));
      } else {
        const prompts = currentPromptText.split('\n').map(p => p.trim()).filter(p => p !== '');
        if (prompts.length === 0) {
          alert("Vui lòng nhập kịch bản.");
          return;
        }
        for (let i = 0; i < prompts.length; i++) {
          if (isStopping) break;
          await runGenerationTask(prompts[i], i, prompts.length);
        }
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        if (base64) {
          if (specificSlotRef.current) {
             const { index, subIndex } = specificSlotRef.current;
             setModeImages(prev => {
                const updated = [...prev[mode]];
                let targetIdx = index;
                if (mode === VideoMode.INTERPOLATION && subIndex !== undefined) targetIdx = index * 2 + subIndex;
                while (updated.length <= targetIdx) updated.push({ url: '', name: '' });
                updated[targetIdx] = { url: base64, name: file.name.split('.')[0] };
                return { ...prev, [mode]: updated };
             });
             specificSlotRef.current = null;
          } else {
            setModeImages(prev => ({
              ...prev,
              [mode]: [...prev[mode], { url: base64, name: file.name.split('.')[0] }]
            }));
          }
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const renderScriptView = (text: string, title: string) => (
    <div className="flex-1 bg-white p-8 md:p-12 font-serif leading-relaxed text-slate-900 overflow-y-auto custom-scrollbar shadow-inner min-h-0">
      <h3 className="text-2xl md:text-3xl font-black text-center mb-10 tracking-tighter uppercase underline decoration-4 underline-offset-8 decoration-indigo-500 italic">{title}</h3>
      <div className="space-y-6">
        {text ? text.split('\n').map((line, idx) => (
          <p key={idx} className={line.startsWith('[') ? 'bg-indigo-50 p-5 rounded-2xl border border-indigo-100 italic font-medium shadow-sm' : 'text-slate-700'}>{line}</p>
        )) : <div className="h-full flex items-center justify-center text-slate-300 italic font-black text-xl uppercase tracking-widest opacity-30">Studio Output...</div>}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-[#f8fafc] p-3 overflow-hidden font-sans text-slate-800 min-h-0">
      {/* Top Header Controls */}
      <div className="flex justify-between items-center mb-3 px-6 bg-white py-3 rounded-[2.5rem] border border-slate-200 shadow-xl flex-shrink-0">
        <div className="flex items-center space-x-3">
          <button onClick={() => { setToolMode(ToolMode.DIRECTOR); setConcurrentRenderCount(0); }} className={`px-6 py-3 rounded-full text-[11px] font-black uppercase transition-all border-2 active:scale-95 shadow-md ${toolMode === ToolMode.DIRECTOR ? 'bg-indigo-600 text-white border-indigo-700 shadow-indigo-200' : 'bg-white text-indigo-600 border-indigo-50 hover:bg-slate-50'}`}>🎬 Đạo diễn Hollywood</button>
          <button onClick={() => { setToolMode(ToolMode.LINK_ANALYSER); setConcurrentRenderCount(0); }} className={`px-6 py-3 rounded-full text-[11px] font-black uppercase transition-all border-2 active:scale-95 shadow-md ${toolMode === ToolMode.LINK_ANALYSER ? 'bg-blue-600 text-white border-blue-700 shadow-blue-200' : 'bg-white text-blue-600 border-blue-50 hover:bg-slate-50'}`}>🔗 Phân tích Link Youtube (Dán thêm tiêu đề cho việc phân tích)</button>
          <button onClick={() => { setToolMode(ToolMode.SEAMLESS_FLOW); setConcurrentRenderCount(0); }} className={`px-6 py-3 rounded-full text-[11px] font-black uppercase transition-all border-2 active:scale-95 shadow-md ${toolMode === ToolMode.SEAMLESS_FLOW ? 'bg-emerald-600 text-white border-emerald-700 shadow-emerald-200' : 'bg-white text-emerald-600 border-emerald-50 hover:bg-slate-50'}`}>🔗 Prompt liền mạch nối cảnh</button>
        </div>
        <div className="flex items-center space-x-3">
           <button onClick={() => setShowStitchModal(true)} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-2 border-emerald-200 px-5 py-2 rounded-full text-[10px] font-black uppercase transition shadow-md active:scale-95">Nối video</button>
           <button onClick={() => alert("Hệ thống đồng bộ...")} className="bg-amber-50 hover:bg-amber-100 text-amber-700 border-2 border-amber-200 px-5 py-2 rounded-full text-[10px] font-black uppercase transition shadow-md active:scale-95">Tạo lại</button>
           <span className="w-px h-6 bg-slate-200 mx-2"></span>
           <button onClick={() => setShowZaloQR(true)} className="flex items-center space-x-2 text-[11px] text-blue-600 font-black bg-white px-5 py-2 rounded-full border-2 border-blue-100 shadow-lg hover:bg-slate-50 transition active:scale-95">
             <span className="bg-blue-600 text-white rounded-full px-2 py-0.5 text-[9px]">Hỗ trợ</span>
             <span>KỸ THUẬT AI</span>
           </button>
        </div>
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        {/* Left Column - Input/Scripts */}
        <div className="flex-[1.2] flex flex-col min-w-0 h-full">
          <div className="bg-white border-2 border-slate-200 rounded-[2.5rem] shadow-2xl flex flex-col flex-1 overflow-hidden relative border-t-[6px] border-t-indigo-600 min-h-0">
            {/* Tabs */}
            <div className="flex bg-slate-50/50 border-b-2 border-slate-100 flex-shrink-0">
              {['📝 Văn bản', '🖼️ Ảnh sang Video', '🎞️ Ảnh Đầu-Cuối', '🎭 Nhân vật DNA'].map((lbl, idx) => (
                <button key={idx} onClick={() => { setMode(Object.values(VideoMode)[idx]); setToolMode(ToolMode.NONE); setConcurrentRenderCount(0); }} className={`px-6 py-5 text-[11px] font-black border-r-2 border-slate-100 uppercase tracking-tighter transition-all flex-1 ${mode === Object.values(VideoMode)[idx] && toolMode === ToolMode.NONE && concurrentRenderCount === 0 ? 'bg-white text-indigo-600 shadow-[inset_0_4px_0_#4f46e5]' : 'text-slate-400 hover:bg-white/50'}`}>{lbl}</button>
              ))}
            </div>
            
            <div className="flex-1 flex flex-col min-h-0 bg-slate-50/20 overflow-hidden">
              {concurrentRenderCount > 0 ? (
                <div className="flex flex-col h-full p-6 space-y-4 min-h-0 overflow-hidden">
                  <div className="flex justify-between items-center bg-amber-600 text-white p-4 rounded-2xl shadow-xl flex-shrink-0">
                    <span className="text-xs font-black uppercase tracking-widest italic">⚡ RENDER {concurrentRenderCount} LUỒNG SONG SONG</span>
                    <button onClick={() => setConcurrentRenderCount(0)} className="bg-white/20 px-4 py-1.5 rounded-xl text-[10px] font-black hover:bg-white/40 transition">✕ ĐÓNG</button>
                  </div>
                  {/* LEFT 5-COLUMN LAYOUT */}
                  <div className={`flex-1 overflow-x-auto custom-scrollbar flex min-h-0 divide-x-4 divide-slate-100 bg-white/50 rounded-[2.5rem] border-2 border-slate-100`}>
                    {Array.from({ length: concurrentRenderCount }).map((_, i) => (
                      <div key={i} className="flex-1 min-w-[220px] flex flex-col p-6 group transition-colors">
                        <label className="text-[10px] font-black text-slate-500 uppercase mb-4 flex items-center space-x-2 tracking-widest"><span className="w-3 h-3 bg-amber-500 rounded-full animate-pulse"></span><span>Luồng #{i+1}</span></label>
                        <textarea value={concurrentPrompts[i]} onChange={e => { const u = [...concurrentPrompts]; u[i] = e.target.value; setConcurrentPrompts(u); }} className="flex-1 bg-white text-black border-2 border-slate-100 outline-none text-[13px] font-bold leading-relaxed resize-none custom-scrollbar p-4 rounded-2xl focus:border-indigo-400 shadow-inner" placeholder={`Nhập kịch bản cho luồng #${i+1}...`} spellCheck={false} />
                      </div>
                    ))}
                  </div>
                </div>
              ) : toolMode !== ToolMode.NONE ? (
                <div className="p-6 md:p-10 space-y-6 h-full flex flex-col overflow-hidden min-h-0">
                  <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6">
                    <div className="flex-1 flex flex-col space-y-4 overflow-y-auto custom-scrollbar pr-2">
                      {toolMode === ToolMode.DIRECTOR && <>
                        <div className="flex flex-col space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">📖 CỐT TRUYỆN CHI TIẾT</label>
                          <textarea value={directorForm.plot} onChange={e => setDirectorForm({...directorForm, plot: e.target.value})} className="h-48 bg-white border-2 border-slate-200 rounded-[2rem] p-6 text-sm font-medium outline-none shadow-sm focus:border-indigo-400 transition-all resize-none" placeholder="Nhập tóm tắt cốt truyện của bạn..." />
                        </div>
                        <div className="flex flex-col space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">🎭 THỂ LOẠI</label>
                          <select value={directorForm.genre} onChange={e => setDirectorForm({...directorForm, genre: e.target.value})} className="w-full bg-white border-2 border-slate-200 rounded-2xl px-6 py-3 text-sm font-black outline-none shadow-sm">
                            <option>Hành động</option><option>Tình cảm</option><option>Kinh dị</option><option>Viễn tưởng</option><option>Hài hước</option>
                          </select>
                        </div>
                        <div className="flex flex-col space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">🌟 DNA NHÂN VẬT GỐC</label>
                          <textarea value={directorForm.mainChar} onChange={e => setDirectorForm({...directorForm, mainChar: e.target.value})} className="h-28 bg-white border-2 border-slate-200 rounded-[2rem] p-6 text-sm font-medium outline-none shadow-sm focus:border-indigo-400 transition-all resize-none" placeholder="Mô tả ngoại hình nhân vật chính..." />
                        </div>
                      </>}
                      {toolMode === ToolMode.LINK_ANALYSER && (
                        <div className="flex flex-col space-y-4">
                           <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4 italic">🔗 DÁN LINK YOUTUBE HOẶC TIÊU ĐỀ VIDEO</label>
                           <input value={targetLink} onChange={e => setTargetLink(e.target.value)} className="bg-white border-2 border-slate-200 rounded-2xl px-6 py-5 text-sm font-bold outline-none shadow-lg focus:border-blue-400" placeholder="https://youtube.com/watch?v=..." />
                        </div>
                      )}
                      {toolMode === ToolMode.SEAMLESS_FLOW && <>
                        <div className="flex flex-col space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">🎬 KỊCH BẢN NỐI MẠCH</label>
                          <textarea value={seamlessForm.script} onChange={e => setSeamlessForm({...seamlessForm, script: e.target.value})} className="h-48 bg-white border-2 border-slate-200 rounded-[2rem] p-6 text-sm font-medium outline-none shadow-sm focus:border-emerald-400 transition-all resize-none" placeholder="Dán nội dung kịch bản cần nối cảnh..." />
                        </div>
                        <div className="flex flex-col space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">🧬 DNA CỐ ĐỊNH</label>
                          <textarea value={seamlessForm.dna} onChange={e => setSeamlessForm({...seamlessForm, dna: e.target.value})} className="h-28 bg-white border-2 border-slate-200 rounded-[2rem] p-6 text-sm font-medium outline-none shadow-sm focus:border-emerald-400 transition-all resize-none" placeholder="DNA nhân vật cho toàn bộ mạch video..." />
                        </div>
                      </>}
                    </div>
                    <div className="flex-[1.5] min-h-0 flex flex-col border-2 border-slate-100 rounded-[3rem] overflow-hidden shadow-2xl">
                      {renderScriptView(toolMode === ToolMode.DIRECTOR ? directorScript : toolMode === ToolMode.LINK_ANALYSER ? analyzedScript : seamlessScript, "Studio Hollywood Script")}
                    </div>
                  </div>
                  <div className="flex gap-3 flex-shrink-0">
                    <button onClick={() => setOutputLanguage('EN')} className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase border-2 transition-all active:scale-95 shadow-md ${outputLanguage === 'EN' ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-indigo-600 border-slate-100'}`}>English Output</button>
                    <button onClick={() => setOutputLanguage('VN')} className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase border-2 transition-all active:scale-95 shadow-md ${outputLanguage === 'VN' ? 'bg-red-600 text-white border-red-700' : 'bg-white text-red-600 border-slate-100'}`}>Tiếng Việt Output</button>
                    <button onClick={() => handleToolGenerate(toolMode)} disabled={isGenerating} className={`flex-[3] py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95 relative overflow-hidden group ${toolMode === ToolMode.SEAMLESS_FLOW ? 'bg-emerald-600' : 'bg-indigo-600'} text-white`}>
                      <span className="relative z-10 italic">{isGenerating ? 'ĐANG XỬ LÝ DỮ LIỆU...' : '⚡ XUẤT PROMPTS HOLLYWOOD STUDIO'}</span>
                      <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 p-4 overflow-y-auto custom-scrollbar min-h-0 bg-slate-50/10">
                  <div className="space-y-4">
                    {currentPromptText.split('\n').map((line, i) => (
                      <div key={i} className="flex flex-col group">
                        <div className={`flex gap-3 p-4 bg-white border-2 rounded-[2rem] shadow-sm transition-all relative hover:shadow-md ${line ? 'border-indigo-100' : 'border-slate-100'}`}>
                           <div className="flex flex-col items-center justify-start pt-3">
                              <span className="text-xs font-black text-indigo-600 italic">#{i+1}</span>
                           </div>
                           
                           {/* Media Slots Inline for I2V and Interpolation */}
                           {(mode === VideoMode.IMAGE_TO_VIDEO) && (
                              <div className="flex-shrink-0 flex items-center">
                                <div 
                                  className="w-24 h-24 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden cursor-pointer hover:border-indigo-400 transition-colors flex items-center justify-center shadow-inner"
                                  onClick={() => { specificSlotRef.current = { index: i }; fileInputRef.current?.click(); }}
                                >
                                  {currentImages[i]?.url ? <img src={currentImages[i].url} className="w-full h-full object-cover" /> : <span className="text-[10px] font-black text-slate-300 uppercase italic">ẢNH</span>}
                                </div>
                              </div>
                           )}

                           {(mode === VideoMode.INTERPOLATION) && (
                              <div className="flex-shrink-0 flex items-center gap-3">
                                <div 
                                  className="w-20 h-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden cursor-pointer hover:border-indigo-400 transition-colors flex items-center justify-center shadow-inner"
                                  onClick={() => { specificSlotRef.current = { index: i, subIndex: 0 }; fileInputRef.current?.click(); }}
                                >
                                  {currentImages[i*2]?.url ? <img src={currentImages[i*2].url} className="w-full h-full object-cover" /> : <span className="text-[9px] font-black text-slate-300 uppercase italic">ĐẦU</span>}
                                </div>
                                <div 
                                  className="w-20 h-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden cursor-pointer hover:border-indigo-400 transition-colors flex items-center justify-center shadow-inner"
                                  onClick={() => { specificSlotRef.current = { index: i, subIndex: 1 }; fileInputRef.current?.click(); }}
                                >
                                  {currentImages[i*2+1]?.url ? <img src={currentImages[i*2+1].url} className="w-full h-full object-cover" /> : <span className="text-[9px] font-black text-slate-300 uppercase italic">CUỐI</span>}
                                </div>
                              </div>
                           )}

                           <textarea 
                             value={line} 
                             onChange={e => { pushToHistory(); const n = currentPromptText.split('\n'); n[i] = e.target.value; updatePromptForMode(n.join('\n')); }} 
                             className="flex-1 bg-white text-black border-2 border-slate-100 outline-none text-[13px] font-bold leading-relaxed resize-none py-4 px-5 h-24 rounded-[1.5rem] custom-scrollbar shadow-inner focus:border-indigo-400 transition-colors" 
                             placeholder={`Nhập kịch bản Hollywood cho cảnh #${i+1}...`} 
                             spellCheck={false}
                           />
                           
                           <button onClick={() => { pushToHistory(); const n = currentPromptText.split('\n'); n.splice(i, 1); updatePromptForMode(n.join('\n')); }} className="absolute -right-2 -top-2 bg-red-500 text-white w-7 h-7 rounded-full text-xs font-black shadow-lg opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center active:scale-90 z-20">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* THÊM CẢNH - THU NHỎ VÀ SÁT DƯỚI Ô */}
                  <div className="mt-2 pl-12 flex items-center justify-start">
                    <button 
                      onClick={() => { pushToHistory(); updatePromptForMode(currentPromptText + (currentPromptText ? '\n' : '')); }} 
                      className="py-1 px-4 border-2 border-dashed border-indigo-200 rounded-xl text-[9px] font-black text-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all uppercase tracking-widest italic"
                    >
                      + THÊM CẢNH
                    </button>
                  </div>
                  
                  {mode === VideoMode.CONSISTENCY && (
                    <div className="mt-8 p-6 bg-indigo-50/50 rounded-[2.5rem] border-2 border-indigo-100 shadow-inner">
                      <div className="flex justify-between items-center mb-6 px-4">
                        <span className="text-[10px] font-black uppercase text-indigo-800 italic tracking-widest">🧬 KHO DNA NHÂN VẬT ({currentImages.length})</span>
                        <button onClick={() => fileInputRef.current?.click()} className="bg-indigo-600 text-white px-6 py-2 rounded-full text-[10px] font-black uppercase shadow-lg hover:bg-indigo-700 transition active:scale-95">TẢI DNA</button>
                      </div>
                      <div className="flex gap-4 overflow-x-auto pb-6 custom-scrollbar px-2">
                        {currentImages.map((img, idx) => (
                          <div key={idx} className="relative flex-shrink-0 group w-36 bg-white p-3 rounded-[2rem] border-2 border-indigo-100 shadow-xl transition-all hover:border-indigo-400">
                            <img src={img.url} alt={img.name} className="w-full aspect-square object-cover rounded-[1.5rem] border-4 border-white shadow-md transition-transform group-hover:scale-105 mb-3" />
                            {/* DNA RENAME SUPPORT */}
                            <input 
                              value={img.name} 
                              onChange={e => {
                                const newImgs = [...currentImages];
                                newImgs[idx].name = e.target.value;
                                setModeImages(prev => ({ ...prev, [mode]: newImgs }));
                              }}
                              className="w-full text-[10px] font-black text-center text-indigo-600 bg-slate-50 border-2 border-slate-100 rounded-xl py-1.5 outline-none uppercase shadow-inner focus:border-indigo-300"
                              placeholder="Đặt tên DNA..."
                            />
                            <button onClick={() => setModeImages(prev => ({ ...prev, [mode]: prev[mode].filter((_, i) => i !== idx) }))} className="absolute -top-3 -right-3 bg-red-500 text-white w-8 h-8 rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-2xl font-black z-30">✕</button>
                          </div>
                        ))}
                        {currentImages.length === 0 && <div className="w-full py-12 text-center text-indigo-300 text-[11px] font-black uppercase tracking-[0.4em] italic opacity-50">Sẵn sàng lưu trữ DNA nhân vật...</div>}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Main Action Footer */}
            <div className="p-6 bg-white border-t-2 border-slate-50 flex items-center justify-between flex-shrink-0 shadow-2xl">
              <button onClick={handleGenerate} disabled={isGenerating || isStopping} className={`bg-gradient-to-r from-indigo-600 via-indigo-700 to-blue-700 text-white px-10 py-5 rounded-[2rem] font-black text-sm shadow-2xl uppercase tracking-[0.2em] transition-all active:scale-95 flex-1 max-w-[280px] mr-3 relative overflow-hidden group ${isGenerating ? 'opacity-80 cursor-not-allowed' : ''}`}>
                <span className="relative z-10 italic">{isGenerating ? '⚡ ĐANG RENDER...' : '🚀 BẮT ĐẦU TẠO VIDEO'}</span>
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              </button>
              {isGenerating && <button onClick={() => setIsStopping(true)} className="bg-red-500 hover:bg-red-600 text-white px-6 py-5 rounded-[2rem] font-black text-xs uppercase animate-pulse shadow-xl transition active:scale-95 mr-3 italic">🛑 DỪNG ({stopCountdown}S)</button>}
              <button onClick={onOpenPricing} className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-8 py-5 rounded-[2rem] font-black text-xs uppercase shadow-2xl transition-all active:scale-95 flex-1 max-w-[280px] italic tracking-widest">💳 BẢN QUYỀN STUDIO</button>
            </div>
          </div>
        </div>

        {/* Right Column - Studio Supervision */}
        <div className="flex-[0.8] flex flex-col min-w-0 h-full">
          <div className="bg-white border-2 border-slate-200 rounded-[3rem] shadow-2xl flex flex-col flex-1 border-t-[6px] border-t-blue-600 overflow-hidden min-h-0 relative">
            <div className="bg-slate-900 text-white p-5 border-b border-white/5 flex justify-between items-center flex-shrink-0 shadow-lg">
              <div className="flex items-center space-x-3">
                <span className="w-3 h-3 bg-blue-500 rounded-full animate-pulse shadow-[0_0_10px_#3b82f6]"></span>
                <span className="text-sm font-black uppercase italic tracking-widest">Studio Supervision</span>
              </div>
              <div className="flex gap-3">
                 <button onClick={() => { setConcurrentRenderCount(3); setConcurrentPrompts(['','','']); }} className={`text-[10px] font-black px-4 py-2 rounded-xl border-2 transition-all active:scale-95 uppercase ${concurrentRenderCount === 3 ? 'bg-amber-500 border-amber-600 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}>3 Luồng</button>
                 <button onClick={() => { setConcurrentRenderCount(5); setConcurrentPrompts(['','','','','']); }} className={`text-[10px] font-black px-4 py-2 rounded-xl border-2 transition-all active:scale-95 uppercase ${concurrentRenderCount === 5 ? 'bg-amber-500 border-amber-600 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}>5 Luồng</button>
              </div>
            </div>
            
            <div className="flex-1 overflow-hidden bg-slate-50/50 flex min-h-0">
              {concurrentRenderCount === 0 ? (
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar h-full">
                  {activeTasks.map((task, idx) => (
                    <div key={task.id} className={`p-6 border-2 rounded-[2.5rem] bg-white shadow-xl transition-all relative overflow-hidden border-indigo-50 hover:border-blue-300`}>
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1 pr-6">
                          <p className="text-[11px] font-black text-slate-800 line-clamp-1 italic mb-2 uppercase tracking-tighter">#{activeTasks.length - idx}: {task.prompt}</p>
                          <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest italic">{task.status}</p>
                        </div>
                        <div className="text-sm font-black text-indigo-400 font-mono italic">{task.progress}%</div>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mb-4 shadow-inner border border-slate-50"><div className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-1000" style={{ width: `${task.progress}%` }}></div></div>
                      {task.url && <video src={task.url} controls playsInline crossOrigin="anonymous" className="w-full rounded-[1.5rem] shadow-2xl border-4 border-white bg-black" />}
                    </div>
                  ))}
                  {activeTasks.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-40">
                      <span className="text-6xl mb-6">🎬</span>
                      <span className="text-sm font-black uppercase tracking-[0.5em] italic">Waiting for CinemaFlow...</span>
                    </div>
                  )}
                </div>
              ) : (
                /* RIGHT MULTI-LANE DISPLAY */
                <div 
                  className="flex h-full w-full divide-x-2 divide-slate-200 overflow-x-auto custom-scrollbar"
                >
                  {Array.from({ length: concurrentRenderCount }).map((_, lIdx) => {
                    const laneId = (lIdx + 1).toString();
                    const laneTasks = activeTasks.filter(t => t.status?.includes(`Luồng ${laneId}:`));
                    return (
                      <div key={lIdx} className="flex-1 flex flex-col min-w-[200px] h-full bg-white/60">
                        <div className="p-3 bg-slate-100 border-b-2 border-slate-200 text-center shadow-sm">
                          <span className="text-[10px] font-black text-indigo-600 uppercase italic tracking-widest">LUỒNG {laneId}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                          {laneTasks.map((task, idx) => (
                             <div key={task.id} className="p-4 border-2 border-indigo-50 rounded-[1.5rem] bg-white shadow-lg">
                                <p className="text-[9px] font-black text-slate-700 line-clamp-2 mb-2 uppercase tracking-tighter italic">Cảnh: {task.prompt}</p>
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-[8px] font-black text-blue-500 italic uppercase">{task.status?.split(': ')[1]}</span>
                                  <span className="text-[10px] font-black text-indigo-400 italic">{task.progress}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full mb-3 overflow-hidden shadow-inner"><div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500" style={{ width: `${task.progress}%` }}></div></div>
                                {task.url && <video src={task.url} controls playsInline crossOrigin="anonymous" className="w-full rounded-xl bg-black shadow-lg border-2 border-white" />}
                             </div>
                          ))}
                          {laneTasks.length === 0 && (
                             <div className="h-full flex items-center justify-center opacity-10">
                                <span className="text-[10px] font-black uppercase tracking-widest">Sẵn sàng...</span>
                             </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="p-8 bg-gradient-to-br from-slate-900 to-slate-950 border-t-[6px] border-t-emerald-500 shadow-2xl flex-shrink-0">
               <div className="flex items-center justify-between mb-4">
                  <div className="flex flex-col">
                    <h4 className="text-lg font-black text-emerald-400 uppercase tracking-[0.2em] italic leading-none mb-1">Cinema Flow Studio v3.8</h4>
                    <span className="text-[9px] text-white/30 font-bold uppercase tracking-widest">NATIVE VEO 3.1 CONTINUITY ENGINE</span>
                  </div>
                  {isFullVideoRendering && (
                    <div className="flex items-center space-x-2 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
                       <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping"></span>
                       <span className="text-[10px] font-black text-emerald-400 uppercase italic tracking-tighter">ĐANG NỐI MẠCH PHIM...</span>
                    </div>
                  )}
               </div>
               <button 
                  onClick={handleRunFullVideo} 
                  disabled={isGenerating || isStopping}
                  className={`w-full py-6 rounded-[2rem] font-black text-sm uppercase tracking-[0.3em] transition-all relative overflow-hidden shadow-2xl active:scale-95 group ${isFullVideoRendering ? 'bg-emerald-500/20 text-emerald-500 border-2 border-emerald-500/50 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 text-white'}`}
               >
                  <span className="relative z-10 italic">{isFullVideoRendering ? 'STUDIO RENDERING...' : '▶ RUN FULL VIDEO'}</span>
                  <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
               </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showZaloQR && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-2xl flex items-center justify-center p-4 z-[500]">
          <div className="bg-white rounded-[4rem] p-12 max-w-sm w-full text-center relative shadow-[0_0_80px_rgba(59,130,246,0.3)] animate-in zoom-in-95 border-8 border-indigo-50">
            <button onClick={() => setShowZaloQR(false)} className="absolute top-8 right-8 font-black text-3xl text-slate-300 hover:text-red-500 transition-colors">✕</button>
            <h3 className="text-3xl font-black mb-8 italic uppercase tracking-tighter">HỖ TRỢ KỸ THUẬT AI</h3>
            <div className="p-4 bg-slate-50 rounded-[3rem] shadow-inner mb-8 border-2 border-slate-100">
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://zalo.me/0973480488`} className="mx-auto rounded-[2.5rem] shadow-2xl border-4 border-white" />
            </div>
            <p className="text-3xl font-black text-blue-600 italic tracking-tighter drop-shadow-md">0973.480.488</p>
            <p className="mt-4 text-[10px] font-black text-slate-300 uppercase tracking-widest italic">YOHU-PRO STUDIO PARTNER</p>
          </div>
        </div>
      )}

      {showStitchModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-2xl z-[600] flex items-center justify-center p-4">
           <div className="bg-white rounded-[4rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] w-full max-w-2xl overflow-hidden animate-in zoom-in-95 border-8 border-emerald-50 flex flex-col max-h-[90vh]">
              <div className="bg-slate-900 text-white px-10 py-8 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center space-x-5">
                  <div className="w-5 h-5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_15px_#34d399]"></div>
                  <h3 className="text-3xl font-black uppercase tracking-tighter italic">🔄 Cinema Stitcher</h3>
                </div>
                <button onClick={() => setShowStitchModal(false)} className="bg-white/10 hover:bg-red-500 text-white w-12 h-12 rounded-2xl flex items-center justify-center transition-all font-black text-2xl">✕</button>
              </div>
              <div className="p-12 overflow-y-auto bg-slate-50/50 custom-scrollbar">
                 <div className="bg-indigo-50 border-4 border-indigo-100 p-10 rounded-[3.5rem] mb-10 shadow-inner">
                    <p className="text-indigo-950 font-bold leading-relaxed mb-8 text-lg">
                       Hệ thống AI v3.8 sẽ tự động thực hiện quy trình đồng nhất mạch video Hollywood:
                       <br/><br/>
                       <span className="text-emerald-700 font-black italic underline decoration-emerald-200 decoration-4">● Quy trình:</span> Nối tất cả các cảnh quay đã hoàn thành trong kho Supervision thành 1 tệp video duy nhất.
                       <br/>
                       <span className="text-emerald-700 font-black italic underline decoration-emerald-200 decoration-4">● Công nghệ:</span> Áp dụng Match Cut Engine để triệt tiêu hiện tượng nhấp nháy frame.
                       <br/><br/>
                       <span className="text-slate-500 font-bold italic leading-relaxed text-sm block border-t border-indigo-100 pt-6">Lưu ý: Thời gian xử lý phụ thuộc vào độ dài video (từ 1-3 phút).</span>
                    </p>
                 </div>
                 <button onClick={() => { alert("Đang bắt đầu nối video..."); setShowStitchModal(false); }} className="w-full bg-indigo-600 text-white py-6 rounded-[2.5rem] font-black text-xl uppercase shadow-2xl hover:bg-indigo-700 transition active:scale-95 italic tracking-widest">BẮT ĐẦU NỐI MẠCH VIDEO 🚀</button>
              </div>
           </div>
        </div>
      )}

      <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple hidden accept="image/*" />
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; } 
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 20px; border: 3px solid #fff; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        textarea { scrollbar-gutter: stable; }
      `}</style>
    </div>
  );
};
