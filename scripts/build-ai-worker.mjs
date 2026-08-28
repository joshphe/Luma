import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('public/ort', { recursive: true });
await build({
  entryPoints: ['app/enhancer.worker.ts'],
  outfile: 'public/ai-worker.js',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
  minify: true,
  sourcemap: false,
  define: { 'process.env.NODE_ENV': '"production"' },
});

for (const file of [
  'ort-wasm-simd-threaded.asyncify.mjs',
  'ort-wasm-simd-threaded.asyncify.wasm',
  'ort-wasm-simd-threaded.jsep.mjs',
  'ort-wasm-simd-threaded.jsep.wasm',
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.wasm',
]) {
  await copyFile(`node_modules/onnxruntime-web/dist/${file}`, `public/${file}`);
}
