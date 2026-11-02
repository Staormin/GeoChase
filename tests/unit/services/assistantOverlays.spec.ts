import type { ProjectContext } from '@/services/assistant/plan';
import type { ImageElement } from '@/types/project';
import { toLonLat } from 'ol/proj';
import { getDistance } from 'ol/sphere';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAssistantExecutor } from '@/services/assistant/agent';
import { renderOverlayView } from '@/services/assistant/overlayView';
import { appendResults } from '@/services/assistant/providers';
import { imageLocalToMap } from '@/services/imageElements';

vi.mock('@/services/assistant/geocoding', () => ({ searchAssistantPlaces: vi.fn() }));
vi.mock('@/services/assistant/overlayView', () => ({
  renderOverlayView: vi.fn(async () => ({
    image: { name: 'view', mimeType: 'image/jpeg', data: 'VklFVw==' },
    step: 0.1,
    size: [2480, 3508],
  })),
}));
vi.mock('@/services/imageAssets', () => ({
  readImageAsset: vi.fn(async () => new Blob(['stored'], { type: 'image/png' })),
  inspectImageAsset: vi.fn(async () => ({ width: 2480, height: 3508 })),
}));
vi.mock('@/services/pdfImage', () => ({
  openPdfImage: vi.fn(async () => ({ numPages: 1, loadingTask: { destroy: vi.fn() } })),
  renderPdfImage: vi.fn(async () => ({
    blob: new Blob(['page'], { type: 'image/png' }),
    paperWidth: 0.21,
    paperHeight: 0.297,
  })),
}));

const settings = { provider: 'openai' as const, apiKey: 'k', model: 'gpt-5-mini', effort: 'auto' };
const fontainebleau = { lat: 48.4047, lon: 2.7016 };
const chambord = { lat: 47.6161, lon: 1.517 };
// An A4 PDF overlay as the import leaves it: somewhere, at some scale, upright.
const sheet: ImageElement = {
  id: 'sheet',
  name: 'Notes sous les pins',
  assetId: 'asset-1',
  center: { lat: 48.85, lon: 2.35 },
  width: 30_000,
  height: (30_000 * 3508) / 2480,
  rotation: 0,
  opacity: 1,
  keepAspectRatio: true,
  paper: { width: 0.21, height: 0.297 },
};
function project(image: ImageElement = sheet): ProjectContext {
  return {
    name: 'Hunt',
    points: [
      { id: 'fb', name: 'Fontainebleau', coordinates: fontainebleau },
      { id: 'ch', name: 'Chambord', coordinates: chambord },
    ],
    lines: [],
    circles: [],
    images: [image],
  };
}
function run(context = project(), documents = []) {
  return createAssistantExecutor(context, settings, new AbortController().signal, documents);
}
function landing(image: ImageElement, x: number, y: number) {
  const [lon, lat] = toLonLat(
    imageLocalToMap(image, (x - 0.5) * image.width, (y - 0.5) * image.height)
  );
  return { lat: lat!, lon: lon! };
}
// Top of the left pole and the ring above the ball, as fractions of the A4 page.
const poleTop = { x: 0.0524, y: 0.0165 };
const ring = { x: 0.0524, y: 0.4356 };

beforeEach(() => vi.clearAllMocks());

describe('overlay georeferencing tools', () => {
  it('pins two image positions on two places at a printed scale', async () => {
    const runner = run();
    const result = (await runner.execute('place_overlay', {
      image_id: 'sheet',
      anchors: [
        { ...poleTop, target_id: 'fb' },
        { ...ring, target_id: 'ch' },
      ],
      scale_denominator: 1_000_000,
      paper_width_cm: 0,
    })) as {
      scale: string;
      anchors_imply_scale: string;
      anchor_errors_m: { error_m: number }[];
      status: string;
    };
    expect(result.status).toBe('placement_prepared');
    expect(result.scale).toBe('1:1000000');
    const placed = runner.plan.imageEdits[0]!.after;
    // The pole top lands exactly on Fontainebleau…
    const top = landing(placed, poleTop.x, poleTop.y);
    expect(getDistance([top.lon, top.lat], [fontainebleau.lon, fontainebleau.lat])).toBeLessThan(1);
    // …and the pole points at Chambord; at 1:1 000 000 the ring falls within a few km of it.
    expect(result.anchor_errors_m[0]!.error_m).toBe(0);
    expect(result.anchor_errors_m[1]!.error_m).toBeLessThan(5000);
    expect(Number(result.anchors_imply_scale.slice(2))).toBeGreaterThan(950_000);
    expect(Number(result.anchors_imply_scale.slice(2))).toBeLessThan(1_050_000);
    // Rotation turns around the first anchor afterwards.
    expect(placed).toMatchObject({ pivot: poleTop, pivotPointId: 'fb' });
    // Measured at the sheet's centre, where Mercator's scale differs slightly from the anchors'.
    const summary = Number(runner.project().overlays[0]!.scale_at_center!.slice(2));
    expect(Math.abs(summary / 1_000_000 - 1)).toBeLessThan(0.03);
  });

  it('fits two anchors exactly without a scale and accepts geocoded locations', async () => {
    const runner = run();
    const result = (await runner.execute('place_overlay', {
      image_id: 'sheet',
      anchors: [
        { ...poleTop, target_id: 'fb' },
        { ...ring, target_id: 'ch' },
      ],
      scale_denominator: 0,
      paper_width_cm: 0,
    })) as { anchor_errors_m: { error_m: number }[] };
    expect(result.anchor_errors_m.map((a) => a.error_m)).toEqual([0, 0]);
    const placed = runner.plan.imageEdits[0]!.after;
    const bottom = landing(placed, ring.x, ring.y);
    expect(getDistance([bottom.lon, bottom.lat], [chambord.lon, chambord.lat])).toBeLessThan(1);
  });

  it('refuses a scale without a paper size and a lone anchor without scale', async () => {
    const runner = run(project({ ...sheet, paper: undefined }));
    const anchor = { ...poleTop, target_id: 'fb' };
    await expect(
      runner.execute('place_overlay', {
        image_id: 'sheet',
        anchors: [anchor, { ...ring, target_id: 'ch' }],
        scale_denominator: 1_000_000,
        paper_width_cm: 0,
      })
    ).rejects.toThrow('paper size');
    await expect(
      runner.execute('place_overlay', {
        image_id: 'sheet',
        anchors: [anchor],
        scale_denominator: 0,
        paper_width_cm: 0,
      })
    ).rejects.toThrow('single anchor');
    // A printed width given by the user makes the scale usable.
    await runner.execute('place_overlay', {
      image_id: 'sheet',
      anchors: [anchor],
      scale_denominator: 1_000_000,
      paper_width_cm: 21,
    });
    expect(runner.plan.imageEdits[0]!.after.paper?.width).toBeCloseTo(0.21, 6);
  });

  it('shows the overlay, zoomed and marked, to the model as an image', async () => {
    const runner = run();
    const output = await runner.execute('view_overlay', {
      image_id: 'sheet',
      region: { x0: 0, y0: 0, x1: 0.1, y1: 0.05 },
      marks: [{ ...poleTop, label: 'A' }],
    });
    expect(renderOverlayView).toHaveBeenCalledWith(
      expect.any(Blob),
      { x0: 0, y0: 0, x1: 0.1, y1: 0.05 },
      [{ ...poleTop, label: 'A' }],
      expect.stringContaining('Notes sous les pins')
    );
    const sent: Record<string, unknown>[] = [];
    appendResults('openai', sent, { text: '', calls: [], sources: [], raw: [] }, [
      { call: { id: 'c', name: 'view_overlay', args: {} }, output },
    ]);
    expect((sent[0]!.output as unknown[])[1]).toEqual({
      type: 'input_image',
      image_url: 'data:image/jpeg;base64,VklFVw==',
    });
    await expect(
      runner.execute('view_overlay', {
        image_id: 'sheet',
        region: { x0: 0.5, y0: 0, x1: 0.5, y1: 1 },
        marks: [],
      })
    ).rejects.toThrow('Region');
  });

  it('creates an overlay from an attached PDF, keeping its paper size, then places it', async () => {
    const runner = run(project(), [
      { name: 'notes.pdf', mimeType: 'application/pdf', data: btoa('%PDF-1.3') },
    ] as never);
    const created = (await runner.execute('create_overlay', {
      document_name: 'notes.pdf',
      page: 1,
      name: 'Notes',
    })) as { id: string; paper_cm: number[]; status: string };
    expect(created).toMatchObject({ paper_cm: [21, 29.7], status: 'prepared_provisionally' });
    expect(runner.plan.imageAssets[runner.plan.images[0]!.assetId]).toBeInstanceOf(Blob);
    await runner.execute('place_overlay', {
      image_id: created.id,
      anchors: [
        { ...poleTop, target_id: 'fb' },
        { ...ring, target_id: 'ch' },
      ],
      scale_denominator: 1_000_000,
      paper_width_cm: 0,
    });
    // A staged overlay is placed in place: no edit, no preview needed.
    expect(runner.plan.images).toHaveLength(1);
    expect(runner.plan.imageEdits).toHaveLength(0);
    expect(runner.plan.images[0]!.pivotPointId).toBe('fb');
    await expect(
      runner.execute('create_overlay', { document_name: 'missing.pdf', page: 1, name: 'X' })
    ).rejects.toThrow('Available: notes.pdf');
  });
});
