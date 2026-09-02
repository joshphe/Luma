'use client';
/* eslint-disable @next/next/no-img-element -- blob: URLs are local previews and cannot use Next Image optimization. */

import { CSSProperties, useState } from 'react';

type CompareSliderProps = {
  original: string;
  processed: string;
  processedFilter?: string;
  processedLabel: string;
  processing?: boolean;
  progress?: number;
};

export default function CompareSlider({ original, processed, processedFilter = 'none', processedLabel, processing, progress = 0 }: CompareSliderProps) {
  const [position, setPosition] = useState(50);

  return <div className="compare-slider" style={{ '--split': `${position}%` } as CSSProperties}>
    <div className="compare-layer processed-layer"><img src={processed} alt="处理后的图片" style={{ filter: processedFilter }} /></div>
    <div className="compare-layer original-layer"><img src={original} alt="原始图片" /></div>
    <span className="compare-label original-label">原图</span>
    <span className="compare-label processed-label">{processedLabel}</span>
    <div className="compare-handle" aria-hidden="true"><span>↔</span></div>
    <input className="compare-range" type="range" min="0" max="100" value={position} onChange={(event) => setPosition(Number(event.target.value))} aria-label="拖动查看修改前后效果" />
    {processing && <div className="processing-mask"><span className="spinner" /><strong>{progress}%</strong></div>}
  </div>;
}
