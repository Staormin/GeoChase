import type { AIAttachment } from './providers';

export interface ViewRegion {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export interface ViewMark {
  x: number;
  y: number;
  label: string;
}

const OUTPUT_SIDE = 1024;
const STEPS = [0.1, 0.05, 0.02, 0.01, 0.005, 0.002, 0.001, 0.0005, 0.0002, 0.0001];
const GRID = 'rgba(220, 0, 60, 0.6)';
const MARK = '#00a2ff';

/** Grid spacing giving 5–12 lines across the region's longest side. */
export function gridStep(region: ViewRegion) {
  const span = Math.max(region.x1 - region.x0, region.y1 - region.y0);
  return STEPS.find((step) => span / step >= 5) ?? STEPS.at(-1)!;
}

/**
 * Renders a region of an image with a grid labelled in full-image fractions
 * (x to the right, y downward), so a model can read positions precisely and
 * zoom in. Optional marks show where proposed positions fall.
 */
export async function renderOverlayView(
  blob: Blob,
  region: ViewRegion,
  marks: ViewMark[],
  name: string
): Promise<{ image: AIAttachment; step: number; size: [number, number] }> {
  const source = await createImageBitmap(blob);
  try {
    const sx = region.x0 * source.width;
    const sy = region.y0 * source.height;
    const sw = (region.x1 - region.x0) * source.width;
    const sh = (region.y1 - region.y0) * source.height;
    const ratio = OUTPUT_SIDE / Math.max(sw, sh);
    const width = Math.max(1, Math.round(sw * ratio));
    const height = Math.max(1, Math.round(sh * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.imageSmoothingQuality = 'high';
    context.drawImage(source, sx, sy, sw, sh, 0, 0, width, height);

    const toX = (x: number) => ((x - region.x0) / (region.x1 - region.x0)) * width;
    const toY = (y: number) => ((y - region.y0) / (region.y1 - region.y0)) * height;
    const step = gridStep(region);
    const decimals = Math.max(1, Math.ceil(-Math.log10(step) - 1e-9));
    const label = (text: string, x: number, y: number) => {
      context.font = 'bold 12px sans-serif';
      const metrics = context.measureText(text);
      const left = Math.min(Math.max(0, x - metrics.width / 2 - 3), width - metrics.width - 6);
      const top = Math.min(Math.max(0, y), height - 16);
      context.fillStyle = 'rgba(255, 255, 255, 0.85)';
      context.fillRect(left, top, metrics.width + 6, 16);
      context.fillStyle = GRID;
      context.fillText(text, left + 3, top + 12);
    };
    context.strokeStyle = GRID;
    context.lineWidth = 1;
    for (
      let value = Math.ceil(region.x0 / step) * step;
      value <= region.x1 + 1e-12;
      value += step
    ) {
      const x = Math.round(toX(value)) + 0.5;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
      label(`x=${value.toFixed(decimals)}`, x, 0);
    }
    for (
      let value = Math.ceil(region.y0 / step) * step;
      value <= region.y1 + 1e-12;
      value += step
    ) {
      const y = Math.round(toY(value)) + 0.5;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
      label(`y=${value.toFixed(decimals)}`, 40, y - 8);
    }
    for (const mark of marks) {
      const x = toX(mark.x);
      const y = toY(mark.y);
      context.strokeStyle = MARK;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(x, y, 10, 0, Math.PI * 2);
      context.moveTo(x - 16, y);
      context.lineTo(x + 16, y);
      context.moveTo(x, y - 16);
      context.lineTo(x, y + 16);
      context.stroke();
      context.font = 'bold 14px sans-serif';
      context.fillStyle = 'rgba(255, 255, 255, 0.85)';
      context.fillRect(x + 12, y - 28, context.measureText(mark.label).width + 6, 18);
      context.fillStyle = MARK;
      context.fillText(mark.label, x + 15, y - 14);
    }
    const url = canvas.toDataURL('image/jpeg', 0.9);
    canvas.width = canvas.height = 0;
    return {
      image: { name, mimeType: 'image/jpeg', data: url.slice(url.indexOf(',') + 1) },
      step,
      size: [source.width, source.height],
    };
  } finally {
    source.close();
  }
}
