import type { ImageElement } from '@/types/project';
import { describe, expect, it } from 'vitest';
import { parseProjectJSON } from '@/domain/layers';
import { imageCorners, imageLocalToMap, resizeImage } from '@/services/imageElements';

const image: ImageElement = {
  id: 'image',
  name: 'map.png',
  assetId: 'asset',
  center: { lon: 2, lat: 48 },
  width: 2000,
  height: 1000,
  rotation: 37,
  opacity: 0.5,
  keepAspectRatio: true,
};
function closePoint(actual: number[], expected: number[]) {
  expect(actual[0]).toBeCloseTo(expected[0]!, 6);
  expect(actual[1]).toBeCloseTo(expected[1]!, 6);
}
describe('image placement', () => {
  it('keeps the opposite corner fixed while resizing a rotated image proportionally', () => {
    const pointer = imageLocalToMap(image, 1800, 900);
    const resized = { ...image, ...resizeImage(image, pointer, [1, 1], 10) };
    expect(resized.width / resized.height).toBeCloseTo(2);
    expect(resized.width).toBeGreaterThan(image.width);
    closePoint(imageCorners(resized)[0]!, imageCorners(image)[0]!);
  });
  it('resizes freely with proportions disabled and preserves the opposite anchor', () => {
    const pointer = imageLocalToMap(image, 1400, 1300);
    const resized = { ...image, ...resizeImage(image, pointer, [1, 1], 10, false) };
    expect(resized.width).toBeCloseTo(2400);
    expect(resized.height).toBeCloseTo(1800);
    closePoint(imageCorners(resized)[0]!, imageCorners(image)[0]!);
    closePoint(imageCorners(resized)[2]!, pointer);
  });
  it('stretches only one axis from a side handle and prevents inverted dimensions', () => {
    const resized = resizeImage(image, imageLocalToMap(image, 1500, 2000), [1, 0], 10);
    expect(resized.width).toBeCloseTo(2500);
    expect(resized.height).toBe(image.height);
    const crossed = resizeImage(image, imageLocalToMap(image, -5000, -5000), [1, 1], 10, false);
    expect(crossed.width).toBe(10);
    expect(crossed.height).toBe(10);
  });
  it('preserves image metadata on import and rejects malformed placements', () => {
    const json = (entry: unknown) => JSON.stringify({ data: { images: [entry] } });
    expect(parseProjectJSON(json(image)).data.images).toEqual([expect.objectContaining(image)]);
    for (const invalid of [
      { width: 0 },
      { height: -1 },
      { opacity: 2 },
      { rotation: '90' },
      { assetId: '' },
    ])
      expect(() => parseProjectJSON(json({ ...image, ...invalid }))).toThrow();
  });
});
