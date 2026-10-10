'use client';

import { useRef, useState } from 'react';

const WIDTH = 2048;
const HEIGHT = 552;
const FONT = 'Arial, "PingFang SC", "Microsoft YaHei", sans-serif';

function downloadCanvas(canvas: HTMLCanvasElement) {
  const link = document.createElement('a');
  link.download = 'Luma-notification-demo.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export default function NotificationTemplate() {
  const [hours, setHours] = useState('2');
  const [amount, setAmount] = useState('1589.9');
  const [currency, setCurrency] = useState('美元');
  const [message, setMessage] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const safeHours = hours.trim() || '0';
  const safeAmount = amount.trim() || '0';

  const exportImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, WIDTH, HEIGHT);
    context.strokeStyle = '#eceef0';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(0, 155);
    context.lineTo(WIDTH, 155);
    context.moveTo(0, 470);
    context.lineTo(WIDTH, 470);
    context.stroke();

    context.textBaseline = 'alphabetic';
    context.font = `108px ${FONT}`;
    context.fillText('🎉', 102, 315);
    context.font = `76px ${FONT}`;
    context.fillStyle = '#17191f';
    context.fillText('你收到钱了！', 330, 300);
    context.font = `64px ${FONT}`;
    context.fillStyle = '#5d6471';
    context.fillText(`· ${safeHours}小时`, 833, 297);

    const detail = `${safeAmount} ${currency}已被存入你的账号。`;
    let detailSize = 70;
    context.font = `${detailSize}px ${FONT}`;
    while (context.measureText(detail).width > 1500 && detailSize > 42) {
      detailSize -= 2;
      context.font = `${detailSize}px ${FONT}`;
    }
    context.fillStyle = '#5d6471';
    context.fillText(detail, 330, 412);

    context.fillStyle = '#f1f2f3';
    context.beginPath();
    context.roundRect(1652, 184, 300, 56, 14);
    context.fill();
    context.font = `700 27px ${FONT}`;
    context.fillStyle = '#656b75';
    context.textAlign = 'center';
    context.fillText('示例 · 非真实凭证', 1802, 221);
    context.textAlign = 'start';
    downloadCanvas(canvas);
    setMessage('已导出 2048 × 552 PNG');
  };

  return <>
    <section className="canvas-area notice-area">
      <div className="canvas-head"><div><span className="eyebrow">NOTICE TEMPLATE</span><h1>生成一张清晰、统一的演示通知。</h1></div></div>
      <div className="notice-stage">
        <div className="notice-preview" role="img" aria-label={`演示通知：${safeAmount} ${currency}，${safeHours}小时`}>
          <div className="notice-demo-mark">示例 · 非真实凭证</div>
          <div className="notice-line top" />
          <div className="notice-icon" aria-hidden="true">🎉</div>
          <div className="notice-copy"><div className="notice-title"><strong>你收到钱了！</strong><span>· {safeHours}小时</span></div><div className="notice-detail">{safeAmount} {currency}已被存入你的账号。</div></div>
          <div className="notice-line bottom" />
        </div>
      </div>
      <div className="stage-footer"><span>2048 × 552 PNG</span><span>纯前端生成 · 固定演示标识</span></div>
      <canvas ref={canvasRef} hidden />
    </section>
    <aside className="filter-panel notice-panel">
      <div className="panel-title"><div><span className="eyebrow">TEMPLATE</span><h2>通知模板</h2></div><span className="secure-dot">✓</span></div>
      <div className="notice-safety"><strong>演示用途</strong><p>生成结果固定带有“非真实凭证”标识，适合产品原型和内容演示。</p></div>
      <label className="notice-field"><span>时间（小时）</span><input inputMode="decimal" maxLength={8} value={hours} onChange={(event) => setHours(event.target.value.replace(/[^0-9.]/g, ''))} placeholder="2" /></label>
      <label className="notice-field"><span>金额</span><input inputMode="decimal" maxLength={16} value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9.,]/g, ''))} placeholder="1589.9" /></label>
      <label className="notice-field"><span>货币</span><select value={currency} onChange={(event) => setCurrency(event.target.value)}><option>美元</option><option>人民币</option><option>欧元</option><option>英镑</option><option>日元</option><option>港币</option></select></label>
      {message ? <div className="collage-message">{message}</div> : null}
      <div className="export-wrap"><button className="export-button" onClick={exportImage}>导出演示 PNG <span>↓</span></button><p>无需 AI · 无接口费用 · 本地生成</p></div>
    </aside>
  </>;
}
