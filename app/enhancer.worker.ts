/// <reference lib="webworker" />
import * as ort from 'onnxruntime-web/webgpu';

const scope = self as unknown as DedicatedWorkerGlobalScope;

// Keep the runtime fully same-origin and avoid spawning a nested proxy worker.
// A single thread works without cross-origin isolation and is the safest fallback.
ort.env.wasm.wasmPaths = `${scope.location.origin}/`;
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;

function fromFloat16(value: number) {
  const sign = (value & 0x8000) << 16; let exponent = (value >>> 10) & 0x1f; let mantissa = value & 0x3ff;
  if (exponent === 0) { if (mantissa === 0) { const u = new Uint32Array([sign]); return new Float32Array(u.buffer)[0]; } while (!(mantissa & 0x400)) { mantissa <<= 1; exponent--; } exponent++; mantissa &= ~0x400; }
  else if (exponent === 31) { const u = new Uint32Array([sign | 0x7f800000 | (mantissa << 13)]); return new Float32Array(u.buffer)[0]; }
  exponent = exponent + (127 - 15); const u = new Uint32Array([sign | (exponent << 23) | (mantissa << 13)]); return new Float32Array(u.buffer)[0];
}

scope.onmessage = async (event: MessageEvent<{ type: string; model: ArrayBuffer; image: File; useGpu: boolean }>) => {
  if (event.data.type !== 'run') return;
  try {
    const executionProviders = event.data.useGpu ? ['webgpu', 'wasm'] : ['wasm'];
    const provider = event.data.useGpu ? 'WebGPU / WASM 自动选择' : 'WASM CPU';
    const session = await ort.InferenceSession.create(event.data.model, { executionProviders, graphOptimizationLevel: 'all' });
    const bitmap = await createImageBitmap(event.data.image);
    const limit = 2048; const ratio = Math.min(1, limit / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * ratio)); const height = Math.max(1, Math.round(bitmap.height * ratio));
    const source = new OffscreenCanvas(width, height); const sourceContext = source.getContext('2d', { willReadFrequently: true });
    if (!sourceContext) throw new Error('无法读取图片');
    sourceContext.imageSmoothingEnabled = true; sourceContext.imageSmoothingQuality = 'high'; sourceContext.drawImage(bitmap, 0, 0, width, height); bitmap.close();
    const output = new OffscreenCanvas(width * 2, height * 2); const outputContext = output.getContext('2d'); if (!outputContext) throw new Error('无法创建输出图片');
    const tileSize = 128; const columns = Math.ceil(width / tileSize); const rows = Math.ceil(height / tileSize); const total = columns * rows; let completed = 0;
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const x = column * tileSize; const y = row * tileSize; const tileWidth = Math.min(tileSize, width - x); const tileHeight = Math.min(tileSize, height - y);
      const pixels = sourceContext.getImageData(x, y, tileWidth, tileHeight).data; const plane = tileSize * tileSize; const input = new Float32Array(plane * 3);
      for (let py = 0; py < tileSize; py++) for (let px = 0; px < tileSize; px++) { const sourceX = Math.min(px, tileWidth - 1); const sourceY = Math.min(py, tileHeight - 1); const sourceIndex = (sourceY * tileWidth + sourceX) * 4; const index = py * tileSize + px; input[index] = pixels[sourceIndex] / 255; input[plane + index] = pixels[sourceIndex + 1] / 255; input[plane * 2 + index] = pixels[sourceIndex + 2] / 255; }
      const tensor = new ort.Tensor('float32', input, [1, 3, tileSize, tileSize]); const feeds: Record<string, ort.Tensor> = { [session.inputNames[0]]: tensor };
      const results = await session.run(feeds); const result = results[session.outputNames[0]]; const values = result.data as Float32Array | Uint16Array; const outWidth = tileSize * 2; const outHeight = tileSize * 2; const outPlane = outWidth * outHeight; const rgba = new Uint8ClampedArray(outPlane * 4); const read = result.type === 'float16' ? (index: number) => fromFloat16(values[index]) : (index: number) => values[index];
      for (let i = 0; i < outPlane; i++) { rgba[i * 4] = Math.max(0, Math.min(255, Math.round(read(i) * 255))); rgba[i * 4 + 1] = Math.max(0, Math.min(255, Math.round(read(outPlane + i) * 255))); rgba[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(read(outPlane * 2 + i) * 255))); rgba[i * 4 + 3] = 255; }
      const tile = new OffscreenCanvas(outWidth, outHeight); tile.getContext('2d')?.putImageData(new ImageData(rgba, outWidth, outHeight), 0, 0); outputContext.drawImage(tile, x * 2, y * 2);
      completed++; scope.postMessage({ type: 'progress', value: Math.round(completed / total * 98) });
    }
    const blob = await output.convertToBlob({ type: 'image/png' }); scope.postMessage({ type: 'done', blob, provider });
  } catch (error) { scope.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error || 'AI 增强失败') }); }
};

export {};
