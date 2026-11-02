import type { AIAttachment } from '@/services/assistant/providers';
import { transformExtent } from 'ol/proj';
import { AIError } from '@/services/assistant/providers';
import { useProjectsStore } from '@/stores/projects';
import { useMapContext } from '../mapContext';

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_CAPTURE_SIDE = 1568;
const FILE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'];
export const ATTACHMENT_ACCEPT = FILE_TYPES.join(',');
export const MAX_ATTACHMENTS = 4;

/** Builds request attachments; failures throw AIError('capture' | 'attachment'). */
export function useAssistantAttachments() {
  const map = useMapContext();
  const projects = useProjectsStore();

  /** Flattens every visible map canvas, like the map's own image export. */
  function captureMap(name: string): AIAttachment {
    const olMap = map.map.value;
    const size = olMap?.getSize();
    if (!olMap || !size) throw new AIError('capture');
    olMap.renderSync();
    const scale = Math.min(1, MAX_CAPTURE_SIDE / Math.max(size[0]!, size[1]!));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(size[0]! * scale);
    canvas.height = Math.round(size[1]! * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new AIError('capture');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    // Layers here use custom class names, so take every canvas in display order.
    for (const layer of olMap.getViewport()?.querySelectorAll<HTMLCanvasElement>('canvas') ?? []) {
      if (layer.width === 0 || layer.height === 0) continue;
      const opacity = layer.parentElement?.style.opacity || layer.style.opacity;
      context.globalAlpha = opacity === '' ? 1 : Number(opacity);
      const matrix = /^matrix\(([^(]*)\)$/.exec(layer.style.transform)?.[1]?.split(',').map(Number);
      context.setTransform(scale, 0, 0, scale, 0, 0);
      if (matrix?.length === 6)
        context.transform(...(matrix as [number, number, number, number, number, number]));
      context.drawImage(layer, 0, 0);
    }
    let url: string;
    try {
      url = canvas.toDataURL('image/jpeg', 0.85);
    } catch {
      // Tiles from a provider without CORS headers taint the canvas.
      throw new AIError('capture');
    }
    const [west, south, east, north] = transformExtent(
      olMap.getView().calculateExtent(size),
      'EPSG:3857',
      'EPSG:4326'
    ).map((value) => value.toFixed(5));
    return {
      name,
      mimeType: 'image/jpeg',
      data: url.slice(url.indexOf(',') + 1),
      description: `[Attached map capture: north ${north}, south ${south}, west ${west}, east ${east}, zoom ${olMap.getView().getZoom()?.toFixed(1)}. Project elements are listed in the project data with exact coordinates.]`,
    };
  }

  function projectPdf(): AIAttachment {
    const pdf = projects.getPdfData();
    if (!pdf || pdf.password) throw new AIError('attachment');
    const data = pdf.data.includes(',') ? pdf.data.slice(pdf.data.indexOf(',') + 1) : pdf.data;
    if (data.length * 0.75 > MAX_BYTES) throw new AIError('attachment');
    return { name: pdf.name || 'document.pdf', mimeType: 'application/pdf', data };
  }

  function readFile(file: File): Promise<AIAttachment> {
    if (file.size > MAX_BYTES || !FILE_TYPES.includes(file.type))
      return Promise.reject(new AIError('attachment'));
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        const url = String(reader.result);
        resolve({ name: file.name, mimeType: file.type, data: url.slice(url.indexOf(',') + 1) });
      });
      reader.addEventListener('error', () => reject(new AIError('attachment')));
      reader.readAsDataURL(file);
    });
  }

  return { captureMap, projectPdf, readFile };
}
