import type { Payouts } from './payouts-data';

export const PAYOUT_WIDTH = 1206;
export const PAYOUT_ROW_STEP = 208;
export const payoutHeight = (count: number) => 1014 + count * PAYOUT_ROW_STEP;
const FONT = '-apple-system, BlinkMacSystemFont, "Luma Payouts"';

type Assets = { background: HTMLImageElement; bag: HTMLImageElement; nativeAppleFont: boolean };
let assetsPromise: Promise<Assets> | undefined;

function loadImage(src: string) {
  const image = new Image();
  image.src = src;
  return image.decode().then(() => image);
}

export function loadPayoutAssets(): Promise<Assets> {
  if (!assetsPromise) {
    const nativeAppleFont = /iPhone|iPad|iPod|Mac/.test(navigator.platform);
    assetsPromise = Promise.all([
      Promise.all([loadImage('/payouts-background.png'), loadImage('/payouts-bag.png')]),
      nativeAppleFont ? document.fonts.ready : Promise.all([['regular', '400'], ['medium', '500'], ['bold', '700']].map(async ([name, weight]) => {
        const font = new FontFace('Luma Payouts', `url(/fonts/payouts-${name}.ttf)`, { weight });
        document.fonts.add(await font.load());
      })),
    ]).then(([[background, bag]]) => ({ background, bag, nativeAppleFont })).catch((error) => {
      assetsPromise = undefined;
      throw error;
    });
  }
  return assetsPromise;
}

function drawText(context: CanvasRenderingContext2D, text: string, x: number, y: number,
  size: number, weight: number, color: string, maxWidth: number, horizontalScale = 1) {
  context.font = `${weight} ${size}px ${FONT}`;
  // Long user-entered amounts stay within their text column without touching the icons.
  const width = context.measureText(text).width * horizontalScale;
  if (width > maxWidth) context.font = `${weight} ${size * maxWidth / width}px ${FONT}`;
  context.fillStyle = color;
  context.save();
  context.translate(x, y);
  context.scale(horizontalScale, 1);
  context.fillText(text, 0, 0);
  context.restore();
}

export function drawPayouts(canvas: HTMLCanvasElement, payouts: Payouts, assets: Assets) {
  canvas.width = PAYOUT_WIDTH;
  canvas.height = payoutHeight(payouts.records.length);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法创建图像画布。');
  context.fillStyle = '#000';
  context.fillRect(0, 0, canvas.width, canvas.height);
  // Static headings and icons come directly from the supplied reference.
  // The source asset contains no amounts or dates; all variable text is rendered here.
  context.drawImage(assets.background, 0, 0);
  context.textBaseline = 'alphabetic';
  context.textAlign = 'center';
  drawText(context, payouts.total, 603, 388, assets.nativeAppleFont ? 104 : 103, 700, '#fff', 1090);
  context.textAlign = 'left';
  const dateScale = assets.nativeAppleFont ? 1 : .966;
  drawText(context, payouts.latestDate, 162, 856, 42, 400, '#737373', 997, dateScale);
  payouts.records.forEach((record, index) => {
    const offset = index * PAYOUT_ROW_STEP;
    context.drawImage(assets.bag, 52, 985 + offset);
    drawText(context, record.amount, 161, 1009 + offset, 48, 500, '#fff', 997);
    drawText(context, record.date, 162, 1063 + offset, 42, 400, '#737373', 997, dateScale);
  });
}
