'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { createPayouts, type Payouts } from './payouts-data';
import { drawPayouts, loadPayoutAssets, payoutHeight, PAYOUT_WIDTH } from './payouts-renderer';

type Props = {
  categoryField: ReactNode;
  amounts: string[];
  latestDate: string;
  onAmountsChange: (amounts: string[]) => void;
  onDateChange: (date: string) => void;
};
type Rendered = { signature: string; image: string; error: string };

function validate(amounts: string[], latestDate: string): { payouts: Payouts | null; error: string } {
  try { return { payouts: createPayouts(amounts, latestDate), error: '' }; }
  catch (error) { return { payouts: null, error: error instanceof Error ? error.message : '请检查输入。' }; }
}

export default function PayoutTemplate({ categoryField, amounts, latestDate, onAmountsChange, onDateChange }: Props) {
  const [rendered, setRendered] = useState<Rendered>({ signature: '', image: '', error: '' });
  const [message, setMessage] = useState('');
  const signature = JSON.stringify([amounts, latestDate]);
  const { payouts, error: inputError } = validate(amounts, latestDate);
  const current = rendered.signature === signature;
  const image = current && !inputError ? rendered.image : '';
  const error = inputError || (current ? rendered.error : '');
  const height = payoutHeight(amounts.length);

  useEffect(() => {
    let cancelled = false;
    const data = validate(amounts, latestDate);
    if (!data.payouts) return;
    const render = async () => {
      try {
        const assets = await loadPayoutAssets();
        if (cancelled) return;
        const canvas = document.createElement('canvas');
        drawPayouts(canvas, data.payouts!, assets);
        // Preview and export share these exact pixels, including the loaded local font.
        setRendered({ signature, image: canvas.toDataURL('image/png'), error: '' });
      } catch {
        if (!cancelled) setRendered({ signature, image: '', error: '图片素材加载失败，请重新打开此类别重试。' });
      }
    };
    void render();
    return () => { cancelled = true; };
  }, [amounts, latestDate, signature]);

  const exportImage = () => {
    if (!image || error) return;
    const link = document.createElement('a');
    link.download = 'Luma-original-content-rewards.png';
    link.href = image;
    link.click();
    setMessage(`已导出 ${PAYOUT_WIDTH} × ${height} PNG`);
  };
  const updateAmount = (index: number, value: string) => {
    setMessage('');
    onAmountsChange(amounts.map((amount, i) => i === index ? value : amount));
  };

  return <>
    <section className="canvas-area notice-area payouts-area">
      <div className="canvas-head"><div><span className="eyebrow">PAYOUTS TEMPLATE</span><h1>Original Content Rewards</h1></div></div>
      <div className="payouts-stage">
        <div className="payouts-preview" style={{ aspectRatio: `${PAYOUT_WIDTH} / ${height}` }}>
          {image ? <Image src={image} width={PAYOUT_WIDTH} height={height} unoptimized
            alt={`Original Content Rewards，总额 ${payouts?.total}，${amounts.length} 条记录，最晚日期 ${payouts?.latestDate}`} />
            : <div className="payouts-placeholder" role="status">{error || '正在生成预览…'}</div>}
        </div>
      </div>
      <div className="stage-footer"><span>{PAYOUT_WIDTH} × {height} PNG</span><span>日期间隔 14 天 · 金额自动汇总</span></div>
    </section>
    <aside className="filter-panel notice-panel payouts-panel">
      <div className="panel-title"><div><span className="eyebrow">TEMPLATE</span><h2>通知模板</h2></div><span className="secure-dot">✓</span></div>
      {categoryField}
      <label className="notice-field"><span>最晚日期</span><input type="date" min="0001-01-29" max="9999-12-31" value={latestDate}
        onChange={(event) => { setMessage(''); onDateChange(event.target.value); }} /></label>
      <p className="payouts-hint">Next payout 与最新记录使用此日期，其余记录依次提前 14 天。</p>
      <div className="payouts-record-heading"><strong>过往金额记录</strong><span>{amounts.length} / 3</span></div>
      <div className="payouts-records">
        {amounts.map((amount, index) => <div className="payouts-record" key={index}>
          <div className="payouts-record-top"><span>{index === 0 ? '最新记录' : `提前 ${index * 14} 天`}</span>
            <button type="button" disabled={amounts.length === 1} aria-label={`删除第 ${index + 1} 条记录`}
              onClick={() => { setMessage(''); onAmountsChange(amounts.filter((_, i) => i !== index)); }}>删除</button></div>
          <label className="notice-field"><span>金额 {index + 1}（美元）</span><input inputMode="decimal" maxLength={18}
            placeholder="0.00" value={amount} onChange={(event) => updateAmount(index, event.target.value)} /></label>
          {payouts ? <div className="payouts-record-date">{payouts.records[index].date}</div> : null}
        </div>)}
      </div>
      <button type="button" className="payouts-add" disabled={amounts.length === 3}
        onClick={() => { setMessage(''); onAmountsChange([...amounts, '0.00']); }}>＋ 添加记录</button>
      <div className="payouts-total"><span>Total payouts</span><strong>{payouts?.total || '—'}</strong></div>
      <div className="collage-message" role="status">{error || message}</div>
      <div className="export-wrap"><button className="export-button" onClick={exportImage} disabled={!image || !!error}>导出 PNG <span>↓</span></button><p>最多 3 条记录 · 本地生成</p></div>
    </aside>
  </>;
}
