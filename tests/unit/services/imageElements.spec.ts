import type { ImageElement } from '@/types/project';
import { describe, expect, it } from 'vitest';
import { parseProjectJSON } from '@/domain/layers';
import {
  imageCorners,
  imageLocalToMap,
  imagePivotCoordinate,
  imagePivotFromMap,
  resizeImage,
  rotateImage,
  snapImagePivot,
} from '@/services/imageElements';

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
      { pivot: null },
      { pivot: { x: null, y: 0.5 } },
      { pivotPointId: 3 },
      { pivotPointId: '' },
      { pivot: { x: '0.5', y: 0.5 } },
      { pivot: { x: 0.5 } },
    ])
      expect(() => parseProjectJSON(json({ ...image, ...invalid }))).toThrow();
  });
});

describe('image rotation pivot', () => {
  it('keeps a custom pivot fixed through clockwise, counterclockwise and full-turn rotations', () => {
    const original = { ...image, pivot: { x: 0.17, y: 0.73 } };
    const pivot = imagePivotCoordinate(original);
    for (const angle of [-721, -90, 0, 37, 90, 359, 360, 721]) {
      const rotated = { ...original, ...rotateImage(original, angle) };
      closePoint(imagePivotCoordinate(rotated), pivot);
      const corners = imageCorners(rotated);
      expect(
        Math.hypot(corners[1]![0]! - corners[0]![0]!, corners[1]![1]! - corners[0]![1]!)
      ).toBeCloseTo(image.width, 6);
      const restored = { ...rotated, ...rotateImage(rotated, image.rotation) };
      closePoint([restored.center.lon, restored.center.lat], [image.center.lon, image.center.lat]);
    }
  });
  it('finds the clicked point in rotated image coordinates and clamps it to the image', () => {
    const point = imageLocalToMap(image, -image.width * 0.3, image.height * 0.2);
    const pivot = imagePivotFromMap(image, point);
    expect(pivot.x).toBeCloseTo(0.2, 8);
    expect(pivot.y).toBeCloseTo(0.7, 8);
    expect(
      imagePivotFromMap(image, imageLocalToMap(image, -2 * image.width, 2 * image.height))
    ).toEqual({ x: 0, y: 1 });
  });
  it('keeps legacy centre rotation and preserves the pivot through project import', () => {
    expect(rotateImage(image, 450)).toEqual({ center: image.center, rotation: 90 });
    const anchored = { ...image, pivot: { x: 0, y: 1 } };
    expect(
      parseProjectJSON(JSON.stringify({ data: { images: [anchored] } })).data.images?.[0]?.pivot
    ).toEqual(anchored.pivot);
  });
});

it('rotates around a referenced map point even outside the image or after the point moves', () => {
  const points = [{ id: 'pivot', name: 'Landmark', coordinates: { lon: 3, lat: 49 } }];
  const anchored = { ...image, pivotPointId: 'pivot', pivot: { x: 0.5, y: 0.5 } };
  for (const lat of [49, 50]) {
    points[0]!.coordinates.lat = lat;
    const fixed = imagePivotCoordinate(anchored, points);
    const local = imagePivotFromMap(anchored, fixed, false);
    const rotated = { ...anchored, pivot: local, ...rotateImage(anchored, 90, points) };
    // Check the rotated image's local position, independently of resolving its linked point.
    closePoint(imagePivotCoordinate({ ...rotated, pivotPointId: undefined }), fixed);
  }
});

it('snaps within a fixed pixel radius at different zooms and leaves distant pivots free', () => {
  const points = [{ id: 'point', name: 'Target', coordinates: { ...image.center } }];
  const center = imageLocalToMap(image, 0, 0);
  for (const resolution of [1, 100]) {
    const toPixel = (coordinate: number[]) => [
      (coordinate[0]! - center[0]!) / resolution,
      (coordinate[1]! - center[1]!) / resolution,
    ];
    const snapped = snapImagePivot(
      image,
      [center[0]! + 9 * resolution, center[1]!],
      points,
      toPixel
    );
    expect(snapped.pivotPointId).toBe('point');
    closePoint(imagePivotCoordinate({ ...image, ...snapped }), center);
    const free = snapImagePivot(image, [center[0]! + 15 * resolution, center[1]!], points, toPixel);
    expect(free.pivotPointId).toBeUndefined();
  }
});
