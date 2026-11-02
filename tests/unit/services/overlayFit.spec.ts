import type { ImageElement } from '@/types/project';
import { toLonLat } from 'ol/proj';
import { describe, expect, it } from 'vitest';
import { fitOverlay, scaleOfWidth, widthAtScale } from '@/services/assistant/overlayFit';
import { imageLocalToMap } from '@/services/imageElements';

const placed: ImageElement = {
  id: 'img',
  name: 'Sheet',
  assetId: 'asset',
  center: { lat: 48.1, lon: 2.2 },
  width: 30_000,
  height: 42_000,
  rotation: 33,
  opacity: 1,
  keepAspectRatio: true,
};
/** Where a fraction of the image lands on the map, using the app's own drawing math. */
function landing(image: ImageElement, x: number, y: number) {
  const [lon, lat] = toLonLat(
    imageLocalToMap(image, (x - 0.5) * image.width, (y - 0.5) * image.height)
  );
  return { lat: lat!, lon: lon! };
}
// The image as imported: right aspect ratio, wrong place, size and rotation.
const imported = { width: 3000, height: 4200, rotation: 0 };

describe('fitOverlay', () => {
  it('recovers position, size and rotation exactly from two anchors', () => {
    const anchors = [
      { x: 0.05, y: 0.02, target: landing(placed, 0.05, 0.02) },
      { x: 0.05, y: 0.44, target: landing(placed, 0.05, 0.44) },
    ];
    const { frame, residualsM } = fitOverlay(imported, anchors);
    expect(frame.width).toBeCloseTo(placed.width, 3);
    expect(frame.height).toBeCloseTo(placed.height, 3);
    expect(frame.rotation).toBeCloseTo(placed.rotation, 6);
    expect(frame.center.lat).toBeCloseTo(placed.center.lat, 9);
    expect(frame.center.lon).toBeCloseTo(placed.center.lon, 9);
    for (const residual of residualsM) expect(residual).toBeLessThan(0.001);
    // The fitted frame puts the anchors exactly where the map draws them.
    const fitted = { ...placed, ...frame };
    expect(landing(fitted, 0.05, 0.44).lat).toBeCloseTo(anchors[1]!.target.lat, 9);
  });

  it('keeps the first anchor exact and the direction of the second at a forced scale', () => {
    const anchors = [
      { x: 0.2, y: 0.1, target: landing(placed, 0.2, 0.1) },
      { x: 0.8, y: 0.9, target: landing(placed, 0.8, 0.9) },
    ];
    const { frame, residualsM, anchorWidth } = fitOverlay(imported, anchors, placed.width * 1.01);
    expect(anchorWidth).toBeCloseTo(placed.width, 3);
    expect(frame.width).toBeCloseTo(placed.width * 1.01, 3);
    expect(frame.rotation).toBeCloseTo(placed.rotation, 6);
    expect(residualsM[0]).toBeLessThan(0.001);
    // A 1 % larger sheet moves the second anchor by 1 % of the anchor spacing.
    expect(residualsM[1]).toBeGreaterThan(100);
  });

  it('fits three or more anchors in least squares and reports each residual', () => {
    const anchors = [
      { x: 0.1, y: 0.1, target: landing(placed, 0.1, 0.1) },
      { x: 0.9, y: 0.1, target: landing(placed, 0.9, 0.1) },
      { x: 0.5, y: 0.9, target: { ...landing(placed, 0.5, 0.9) } },
    ];
    anchors[2]!.target.lat += 0.001; // ~110 m of error on one anchor
    const { frame, residualsM } = fitOverlay(imported, anchors);
    expect(frame.rotation).toBeCloseTo(placed.rotation, 0);
    expect(Math.max(...residualsM)).toBeGreaterThan(20);
    expect(Math.max(...residualsM)).toBeLessThan(110);
  });

  it('moves a single anchor into place at a given scale without rotating', () => {
    const target = { lat: 47.6, lon: 1.5 };
    const { frame, residualsM } = fitOverlay(
      { width: 3000, height: 4200, rotation: 12 },
      [{ x: 0, y: 0, target }],
      60_000
    );
    expect(frame.rotation).toBeCloseTo(12, 9);
    expect(frame.width).toBeCloseTo(60_000, 6);
    expect(residualsM[0]).toBeLessThan(0.001);
    expect(() => fitOverlay(imported, [anchorsAt(0.5), anchorsAt(0.5)])).toThrow('distinct');
  });

  it('converts between a map scale and an image width like the PDF import', () => {
    const at = { lat: 48, lon: 2 };
    const width = widthAtScale(0.21, 1_000_000, at);
    expect(width * Math.cos((48 * Math.PI) / 180)).toBeCloseTo(210_000, -2);
    expect(scaleOfWidth(0.21, width, at)).toBeCloseTo(1_000_000, 3);
  });
});

function anchorsAt(x: number) {
  return { x, y: x, target: { lat: 48, lon: 2 } };
}
