'use client';

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react';

type Preset = { name: string; label: string; filter: (amount: number) => string; colors: [string, string] };
type Mode = 'filter' | 'enhance';
type EnhanceMode = 'quick' | 'ai';
type Status = 'idle' | 'downloading' | 'processing' | 'done' | 'error';

const MODEL_URL = '/models/realesrgan-x2-fp16.onnx';
const MODEL_SHA256 = '0b1770bcb31b3a9021d4251b538da4eb47c84f42706504d44a76d17e8c267606';
const MODEL_BYTES = 33_600_000;
const CACHE_NAME = 'luma-ai-models-v1';

const presets: Preset[] = [
  { name: 'original', label: '原图', filter: () => 'none', colors: ['#868991', '#34363c'] },
  { name: 'vivid', label: '鲜明', filter: (a) => `saturate(${1 + a * .012}) contrast(${1 + a * .0025})`, colors: ['#ff7a44', '#d92875'] },
  { name: 'film', label: '胶片', filter: (a) => `sepia(${a * .0035}) contrast(${1 + a * .0015}) saturate(${1 - a * .002})`, colors: ['#d7b878', '#73583d'] },
  { name: 'cool', label: '冷调', filter: (a) => `saturate(${1 + a * .003}) hue-rotate(${a * .18}deg)`, colors: ['#66d9ff', '#3c57c9'] },
  { name: 'warm', label: '暖阳', filter: (a) => `sepia(${a * .003}) saturate(${1 + a * .005}) hue-rotate(${-a * .08}deg)`, colors: ['#ffd05a', '#f05a3b'] },
  { name: 'mono', label: '黑白', filter: (a) => `grayscale(${a * .01}) contrast(${1 + a * .0025})`, colors: ['#e5e5e5', '#242424'] },
  { name: 'fade', label: '褪色', filter: (a) => `saturate(${1 - a * .005}) contrast(${1 - a * .0015}) brightness(${1 + a * .001})`, colors: ['#cebfae', '#827a72'] },
  { name: 'cyber', label: '震荡', filter: (a) => `saturate(${1 + a * .014}) contrast(${1 + a * .003}) hue-rotate(${a * .28}deg)`, colors: ['#7a55ff', '#26f4c5'] },
];

const hex = (buffer: ArrayBuffer) => Array.from(new Uint8Array(buffer)).map((v) => v.toString(16).padStart(2, '0')).join('');

export default function Studio() {
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [fileName, setFileName] = useState('未选择图片');
  const [mode, setMode] = useState<Mode>('filter');
  const [enhanceMode, setEnhanceMode] = useState<EnhanceMode>('quick');
  const [preset, setPreset] = useState(presets[1]);
  const [amount, setAmount] = useState(65);
  const [sharpness, setSharpness] = useState(55);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [modelCached, setModelCached] = useState(false);
  const [gpu, setGpu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    setGpu('gpu' in navigator);
    caches.open(CACHE_NAME).then((cache) => cache.match(MODEL_URL)).then(Boolean).then(setModelCached).catch(() => {});
    return () => workerRef.current?.terminate();
  }, []);
  useEffect(() => () => { if (image) URL.revokeObjectURL(image); if (result) URL.revokeObjectURL(result); }, [image, result]);

  const resetResult = () => { if (result) URL.revokeObjectURL(result); setResult(null); setStatus('idle'); setProgress(0); setMessage(''); };
  const acceptFile = (file?: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    setImage((current) => { if (current) URL.revokeObjectURL(current); return URL.createObjectURL(file); });
    setImageFile(file); setFileName(file.name); resetResult();
  };
  const onFile = (event: ChangeEvent<HTMLInputElement>) => acceptFile(event.target.files?.[0]);
  const onDrop = (event: DragEvent) => { event.preventDefault(); setDragging(false); acceptFile(event.dataTransfer.files?.[0]); };

  const quickEnhance = async () => {
    if (!imageFile) return;
    setStatus('processing'); setProgress(20); setMessage('正在使用本地图像管线…');
    const bitmap = await createImageBitmap(imageFile);
    const scale = 2;
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width * scale; canvas.height = bitmap.height * scale;
    const context = canvas.getContext('2d'); if (!context) return;
    context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
    context.filter = `contrast(${1 + sharpness * .0015}) saturate(${1 + sharpness * .0007})`;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close(); setProgress(80);
    canvas.toBlob((blob) => { if (!blob) return; resetResult(); setResult(URL.createObjectURL(blob)); setStatus('done'); setProgress(100); setMessage('已完成 2× 快速增强'); }, 'image/png');
  };

  const getVerifiedModel = async () => {
    const cache = await caches.open(CACHE_NAME);
    let response = await cache.match(MODEL_URL);
    if (!response) {
      setStatus('downloading'); setMessage('首次使用：正在下载 33.6 MB AI 模型…');
      const network = await fetch(MODEL_URL, { cache: 'no-store' });
      if (!network.ok || !network.body) throw new Error('模型下载失败');
      const reader = network.body.getReader(); const chunks: Uint8Array[] = []; let received = 0;
      while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); received += value.length; setProgress(Math.min(95, Math.round(received / MODEL_BYTES * 100))); }
      const bytes = new Uint8Array(received); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      const digest = hex(await crypto.subtle.digest('SHA-256', bytes));
      if (digest !== MODEL_SHA256) throw new Error('模型安全校验未通过');
      response = new Response(bytes, { headers: { 'content-type': 'application/octet-stream', 'x-luma-sha256': digest } });
      await cache.put(MODEL_URL, response.clone()); setModelCached(true);
    }
    const bytes = await response.arrayBuffer();
    const digest = hex(await crypto.subtle.digest('SHA-256', bytes));
    if (digest !== MODEL_SHA256) { await cache.delete(MODEL_URL); setModelCached(false); throw new Error('本地模型已损坏，请重新下载'); }
    return bytes;
  };

  const aiEnhance = async () => {
    if (!imageFile) return;
    try {
      setProgress(0); setStatus('downloading');
      const model = await getVerifiedModel();
      setStatus('processing'); setProgress(2); setMessage(`正在使用${gpu ? ' WebGPU' : ' CPU'}本地增强…`);
      workerRef.current?.terminate();
      const worker = new Worker('/ai-worker.js', { type: 'module', name: 'luma-ai-enhancer' }); workerRef.current = worker;
      worker.onmessage = (event) => {
        const data = event.data;
        if (data.type === 'progress') setProgress(data.value);
        if (data.type === 'done') { resetResult(); setResult(URL.createObjectURL(data.blob)); setStatus('done'); setProgress(100); setMessage(`AI 2× 增强完成 · ${data.provider}`); worker.terminate(); }
        if (data.type === 'error') { setStatus('error'); setMessage(data.message); worker.terminate(); }
      };
      worker.postMessage({ type: 'run', model, image: imageFile, useGpu: gpu }, [model]);
    } catch (error) { setStatus('error'); setMessage(error instanceof Error ? error.message : '增强失败'); }
  };
  const enhance = () => enhanceMode === 'quick' ? quickEnhance() : aiEnhance();
  const cancel = () => { workerRef.current?.terminate(); workerRef.current = null; setStatus('idle'); setProgress(0); setMessage('已取消'); };
  const clearModel = async () => { const cache = await caches.open(CACHE_NAME); await cache.delete(MODEL_URL); setModelCached(false); setMessage('本地 AI 模型已删除'); };

  const exportImage = () => {
    const sourceUrl = mode === 'enhance' && result ? result : image; if (!sourceUrl) return;
    if (mode === 'enhance' && result) { const link = document.createElement('a'); link.download = `Luma-enhanced-${fileName.replace(/\.[^.]+$/, '')}.png`; link.href = result; link.click(); return; }
    const source = new Image(); source.onload = () => { const canvas = document.createElement('canvas'); canvas.width = source.naturalWidth; canvas.height = source.naturalHeight; const context = canvas.getContext('2d'); if (!context) return; context.filter = preset.filter(amount); context.drawImage(source, 0, 0); const link = document.createElement('a'); link.download = `Luma-${fileName.replace(/\.[^.]+$/, '')}.png`; link.href = canvas.toDataURL('image/png'); link.click(); }; source.src = sourceUrl;
  };

  const rightImage = mode === 'enhance' ? (result || image) : image;
  return <main className="app-shell">
    <header className="topbar"><a className="brand" href="#" aria-label="Luma 首页"><span className="brand-mark">◐</span><span>Luma</span></a><nav aria-label="主导航"><a className="active" href="#editor">编辑器</a><a href="#features">功能</a><a href="#about">关于</a></nav><div className="local-chip"><span /> 本地处理</div></header>
    <section className="workspace" id="editor">
      <aside className="tool-rail" aria-label="编辑工具">
        <button className={`tool ${mode === 'filter' ? 'active' : ''}`} onClick={() => setMode('filter')}><span>◑</span>滤镜</button>
        <button className={`tool ${mode === 'enhance' ? 'active' : ''}`} onClick={() => setMode('enhance')}><span>✦</span>清晰增强</button>
        <button className="tool" disabled><span>⌗</span>裁剪</button>
      </aside>
      <section className="canvas-area">
        <div className="canvas-head"><div><span className="eyebrow">IMAGE STUDIO</span><h1>{mode === 'enhance' ? '本地算力，重塑清晰细节。' : '让每张照片，更接近你看到的样子。'}</h1></div>{image && <button className="replace-button" onClick={() => inputRef.current?.click()}>替换图片</button>}</div>
        <div className={`image-stage ${dragging ? 'dragging' : ''} ${image ? 'has-image' : ''}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
          {image ? <div className="compare-view"><figure className="compare-pane"><figcaption><span>原图</span><small>ORIGINAL</small></figcaption><div className="compare-image-wrap"><img src={image} alt="原始图片" /></div></figure><div className="compare-divider"><span>⇄</span></div><figure className="compare-pane result-pane"><figcaption><span>{mode === 'enhance' ? (result ? '增强结果' : '待增强') : preset.label}</span><small>{mode === 'enhance' ? (result ? '2×' : '—') : `${amount}%`}</small></figcaption><div className="compare-image-wrap"><img src={rightImage!} alt="处理结果" style={{ filter: mode === 'filter' ? preset.filter(amount) : 'none' }} />{status === 'processing' && <div className="processing-mask"><span className="spinner" /><strong>{progress}%</strong></div>}</div></figure></div> : <button className="upload-card" onClick={() => inputRef.current?.click()}><span className="upload-icon">↑</span><strong>拖入一张图片</strong><span>或点击从电脑选择</span><small>JPG、PNG、WEBP · 图片仅在本机处理</small></button>}
          <input ref={inputRef} type="file" accept="image/*" onChange={onFile} hidden />
        </div><div className="stage-footer"><span>{fileName}</span>{image && <span>左侧原图 · 右侧实时效果</span>}</div>
      </section>
      <aside className="filter-panel">
        {mode === 'filter' ? <><div className="panel-title"><div><span className="eyebrow">FILTERS</span><h2>选择滤镜</h2></div><span className="count">{presets.length}</span></div><div className="preset-grid">{presets.map((item) => <button key={item.name} className={`preset ${preset.name === item.name ? 'selected' : ''}`} onClick={() => setPreset(item)}><span className="preset-preview" style={{ background: `linear-gradient(135deg, ${item.colors[0]}, ${item.colors[1]})` }}><i /></span><span>{item.label}</span></button>)}</div><div className="intensity"><div><label htmlFor="amount">滤镜强度</label><output>{amount}%</output></div><input id="amount" type="range" min="0" max="100" value={amount} onChange={(e) => setAmount(Number(e.target.value))} style={{ '--value': `${amount}%` } as React.CSSProperties} /></div></> : <><div className="panel-title"><div><span className="eyebrow">LOCAL UPSCALE</span><h2>清晰度增强</h2></div><span className="secure-dot">✓</span></div><div className="enhance-tabs"><button className={enhanceMode === 'quick' ? 'selected' : ''} onClick={() => setEnhanceMode('quick')}>快速清晰</button><button className={enhanceMode === 'ai' ? 'selected' : ''} onClick={() => setEnhanceMode('ai')}>AI 超分</button></div>{enhanceMode === 'quick' ? <div className="enhance-card"><span className="enhance-icon">◇</span><h3>2× 快速增强</h3><p>使用高质量采样与局部清晰化，无需下载模型。</p><div className="intensity compact"><div><label htmlFor="sharpness">清晰强度</label><output>{sharpness}%</output></div><input id="sharpness" type="range" min="0" max="100" value={sharpness} onChange={(e) => setSharpness(Number(e.target.value))} style={{ '--value': `${sharpness}%` } as React.CSSProperties} /></div></div> : <div className="enhance-card ai-card"><div className="model-row"><span className="enhance-icon">✦</span><div><h3>Real-ESRGAN 2×</h3><p>{modelCached ? '模型已安全缓存' : '首次下载 33.6 MB'}</p></div><span className="model-state">{modelCached ? '已就绪' : '按需'}</span></div><ul><li><span />SHA-256 完整性校验</li><li><span />{gpu ? 'WebGPU 图形加速' : 'WASM CPU 兼容模式'}</li><li><span />图片全程不上传</li></ul>{modelCached && <button className="clear-model" onClick={clearModel}>删除本地模型</button>}</div>}{message && <div className={`status-box ${status}`}><div><span>{message}</span><strong>{progress > 0 ? `${progress}%` : ''}</strong></div>{(status === 'downloading' || status === 'processing') && <i style={{ width: `${progress}%` }} />}</div>}<button className="enhance-button" onClick={enhance} disabled={!image || status === 'processing' || status === 'downloading'}>{status === 'processing' || status === 'downloading' ? '正在处理…' : result ? '重新增强' : '开始增强'}</button>{(status === 'processing' || status === 'downloading') && <button className="cancel-button" onClick={cancel}>取消处理</button>}<p className="truth-note">AI 会推测合理细节，不等同于还原真实信息。</p></>}
        <div className="export-wrap"><button className="export-button" onClick={exportImage} disabled={!image || (mode === 'enhance' && !result)}>导出图片 <span>↓</span></button><p>{mode === 'enhance' && result ? '2× 高清 PNG' : '高清 PNG · 本地导出'}</p></div>
      </aside>
    </section>
  </main>;
}
