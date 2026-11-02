import type { LatLon } from '../../geometry';
import type { ToolContext } from '../context';
import type { OverlayAnchor } from '../overlayFit';
import type { AssistantTool } from './shared';
import type { ImageElement } from '@/types/project';
import { isRecord } from '@/utils/guards';
import { inspectImageAsset } from '../../imageAssets';
import { number, text } from '../context';
import { fitOverlay, scaleOfWidth, widthAtScale } from '../overlayFit';
import { renderOverlayView } from '../overlayView';
import { withImages } from '../providers';
import { defineTool, num, str } from './shared';

export const PROJECT_PDF = 'project PDF';
const fraction = {
  type: 'number',
  description: 'Fraction of the full image: 0 left/top, 1 right/bottom.',
};

function decode(data: string) {
  return Uint8Array.from(atob(data), (c) => c.codePointAt(0)!);
}

/** Image to overlay from a document, with the physical page size for PDFs. */
async function documentImage(ctx: ToolContext, name: string, page: number) {
  const document = ctx.documents.find((file) => file.name === name);
  if (!document)
    throw new Error(
      `No document named "${name}". Available: ${ctx.documents.map((file) => file.name).join(', ') || 'none'}`
    );
  if (document.mimeType !== 'application/pdf')
    return { blob: new Blob([decode(document.data)], { type: document.mimeType }) };
  const { openPdfImage, renderPdfImage } = await import('../../pdfImage');
  const pdf = await openPdfImage(
    new File([decode(document.data)], name, { type: 'application/pdf' })
  );
  try {
    if (!Number.isInteger(page) || page < 1 || page > pdf.numPages)
      throw new Error(`Choose a page between 1 and ${pdf.numPages}`);
    const rendered = await renderPdfImage(pdf, page);
    return {
      blob: rendered.blob,
      paper: { width: rendered.paperWidth, height: rendered.paperHeight },
    };
  } finally {
    await pdf.loadingTask.destroy();
  }
}

function targetOf(ctx: ToolContext, id: unknown): { coordinates: LatLon; pointId?: string } {
  try {
    const point = ctx.point(id);
    return { coordinates: point.coordinates, pointId: point.id };
  } catch {
    try {
      const location = ctx.location(id);
      return { coordinates: { lat: location.lat, lon: location.lon } };
    } catch {
      throw new Error(
        'Unknown target: give a project point ID or a location ID from search_places'
      );
    }
  }
}

function overlaySummary(image: ImageElement) {
  return {
    id: image.id,
    name: image.name,
    rotation_degrees: image.rotation,
    paper_cm: image.paper
      ? [Math.round(image.paper.width * 1000) / 10, Math.round(image.paper.height * 1000) / 10]
      : null,
    // Mercator: a large sheet's scale varies with latitude; this is its value at the centre.
    scale_at_center: image.paper
      ? `1:${Math.round(scaleOfWidth(image.paper.width, image.width, image.center))}`
      : null,
  };
}

export const overlayTools: AssistantTool[] = [
  defineTool(
    'create_overlay',
    `Add an image overlay from a document: an attached image or PDF (by its name) or the "${PROJECT_PDF}". PDF pages keep their paper size, so they can be set to a map scale. The overlay is placed provisionally: call place_overlay next.`,
    { document_name: str, page: num, name: str },
    {
      activity: 'overlay',
      writes: true,
      async run(ctx, input) {
        const { blob, paper } = await documentImage(
          ctx,
          text(input.document_name),
          typeof input.page === 'number' ? input.page : 1
        );
        ctx.signal.throwIfAborted();
        const pixels = await inspectImageAsset(blob);
        const points = ctx.current().points;
        const center = points[0]?.coordinates ?? { lat: 46.6, lon: 2.4 };
        const width = paper ? widthAtScale(paper.width, 100_000, center) : 10_000;
        const image: ImageElement = {
          id: crypto.randomUUID(),
          assetId: crypto.randomUUID(),
          name: text(input.name),
          center: { ...center },
          width,
          height: (width * pixels.height) / pixels.width,
          rotation: 0,
          opacity: 1,
          keepAspectRatio: true,
          createdAt: Date.now(),
          ...(paper ? { paper } : {}),
        };
        ctx.stageImage(image, blob);
        return {
          ...overlaySummary(image),
          image_pixels: [pixels.width, pixels.height],
          status: 'prepared_provisionally',
        };
      },
    }
  ),
  defineTool(
    'view_overlay',
    'See an image overlay, or a zoomed region of it, with a grid labelled in fractions of the full image (x right, y down). Narrow the region to zoom and read positions precisely; pass marks to check where proposed anchor positions fall before placing. Use [0,0,1,1] for the whole image.',
    {
      image_id: str,
      region: {
        type: 'object',
        properties: { x0: fraction, y0: fraction, x1: fraction, y1: fraction },
        required: ['x0', 'y0', 'x1', 'y1'],
        additionalProperties: false,
      },
      marks: {
        type: 'array',
        items: {
          type: 'object',
          properties: { x: fraction, y: fraction, label: str },
          required: ['x', 'y', 'label'],
          additionalProperties: false,
        },
      },
    },
    {
      activity: 'overlay',
      writes: false,
      async run(ctx, input) {
        const image = ctx.image(input.image_id);
        const region = isRecord(input.region) ? input.region : {};
        const view = {
          x0: number(region.x0, 0, 1),
          y0: number(region.y0, 0, 1),
          x1: number(region.x1, 0, 1),
          y1: number(region.y1, 0, 1),
        };
        if (view.x1 - view.x0 < 0.001 || view.y1 - view.y0 < 0.001)
          throw new Error('Region must be at least 0.001 wide and high, with x1 > x0 and y1 > y0');
        const marks = (Array.isArray(input.marks) ? input.marks : []).slice(0, 8).map((mark) => {
          if (!isRecord(mark)) throw new Error('Invalid mark');
          return {
            x: number(mark.x, -0.5, 1.5),
            y: number(mark.y, -0.5, 1.5),
            label: text(mark.label, 20),
          };
        });
        const rendered = await renderOverlayView(
          await ctx.imageBlob(image),
          view,
          marks,
          `${image.name} [${view.x0}, ${view.y0}, ${view.x1}, ${view.y1}]`
        );
        ctx.signal.throwIfAborted();
        return withImages(
          {
            image_id: image.id,
            region: view,
            grid_step: rendered.step,
            image_pixels: rendered.size,
          },
          [rendered.image]
        );
      },
    }
  ),
  defineTool(
    'place_overlay',
    'Georeference an image overlay: each anchor pins a position of the image (fractions, as read with view_overlay) onto a project point or a location ID. scale_denominator (e.g. 1000000 for 1:1 000 000, 0 to derive it from the anchors) fixes the size; it needs the paper size, known for PDF pages, else give paper_width_cm. One anchor needs a scale. Two anchors without scale fit exactly; with a scale the first anchor is exact and the second sets the direction. Three or more are fitted in least squares. Returns the error at each anchor. This is previewed before applying.',
    {
      image_id: str,
      anchors: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            x: fraction,
            y: fraction,
            target_id: { type: 'string', description: 'Project point ID or location ID.' },
          },
          required: ['x', 'y', 'target_id'],
          additionalProperties: false,
        },
      },
      scale_denominator: num,
      paper_width_cm: {
        type: 'number',
        description: 'Printed width in cm, or 0 for the stored size.',
      },
    },
    {
      activity: 'overlay',
      writes: true,
      run(ctx, input) {
        const image = ctx.image(input.image_id);
        if (!Array.isArray(input.anchors) || input.anchors.length === 0 || input.anchors.length > 8)
          throw new Error('Give between 1 and 8 anchors');
        const targets: (ReturnType<typeof targetOf> & { label: string })[] = [];
        const anchors: OverlayAnchor[] = input.anchors.map((item: unknown) => {
          if (!isRecord(item)) throw new Error('Invalid anchor');
          const target = targetOf(ctx, item.target_id);
          targets.push({ ...target, label: text(item.target_id) });
          return {
            x: number(item.x, -0.5, 1.5),
            y: number(item.y, -0.5, 1.5),
            target: target.coordinates,
          };
        });
        const denominator = number(input.scale_denominator ?? 0, 0, 1e9);
        const paperWidthCm = number(input.paper_width_cm ?? 0, 0, 10_000);
        const paperWidth = paperWidthCm > 0 ? paperWidthCm / 100 : image.paper?.width;
        if (denominator > 0 && !paperWidth)
          throw new Error(
            'The paper size of this image is unknown: ask the user for its printed width'
          );
        if (anchors.length === 1 && denominator === 0)
          throw new Error('A single anchor needs a scale_denominator');
        const at = {
          lat: anchors.reduce((sum, a) => sum + a.target.lat, 0) / anchors.length,
          lon: anchors.reduce((sum, a) => sum + a.target.lon, 0) / anchors.length,
        };
        const { frame, residualsM, anchorWidth } = fitOverlay(
          image,
          anchors,
          denominator > 0 ? widthAtScale(paperWidth!, denominator, at) : undefined
        );
        const first = targets[0]!;
        const after: ImageElement = {
          ...image,
          ...frame,
          ...(paperWidth
            ? { paper: { width: paperWidth, height: (paperWidth * image.height) / image.width } }
            : {}),
          // Later manual rotations turn around the first anchor.
          pivot: { x: anchors[0]!.x, y: anchors[0]!.y },
          pivotPointId: first.pointId,
        };
        ctx.placeImage(image.id, after);
        return {
          image_id: image.id,
          status: 'placement_prepared',
          rotation_degrees: Math.round(frame.rotation * 100) / 100,
          scale: paperWidth ? `1:${Math.round(scaleOfWidth(paperWidth, frame.width, at))}` : null,
          anchors_imply_scale:
            paperWidth && anchorWidth
              ? `1:${Math.round(scaleOfWidth(paperWidth, anchorWidth, at))}`
              : null,
          anchor_errors_m: targets.map((target, index) => ({
            target_id: target.label,
            error_m: Math.round(residualsM[index]!),
          })),
        };
      },
    }
  ),
];

export { overlaySummary };
