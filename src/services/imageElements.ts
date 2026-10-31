import type { ImageElement, PointElement } from '@/types/project';
import { fromLonLat, toLonLat } from 'ol/proj';

export type ImageHandle = [number, number];
export const imageHandles: ImageHandle[] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
];

export function imageLocalToMap(image: ImageElement, x: number, y: number): number[] {
  const center = fromLonLat([image.center.lon, image.center.lat]);
  const angle = (image.rotation * Math.PI) / 180;
  return [
    center[0]! + x * Math.cos(angle) - y * Math.sin(angle),
    center[1]! - x * Math.sin(angle) - y * Math.cos(angle),
  ];
}

export function imageCorners(image: ImageElement): number[][] {
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([x, y]) => imageLocalToMap(image, (x! * image.width) / 2, (y! * image.height) / 2));
}

export function imagePivotCoordinate(image: ImageElement, points: PointElement[] = []): number[] {
  const point = points.find((point) => point.id === image.pivotPointId);
  if (point) return fromLonLat([point.coordinates.lon, point.coordinates.lat]);
  const pivot = image.pivot ?? { x: 0.5, y: 0.5 };
  return imageLocalToMap(image, (pivot.x - 0.5) * image.width, (pivot.y - 0.5) * image.height);
}

export function imagePivotFromMap(
  image: ImageElement,
  coordinate: number[],
  clamp = true
): NonNullable<ImageElement['pivot']> {
  const center = fromLonLat([image.center.lon, image.center.lat]);
  const angle = (image.rotation * Math.PI) / 180;
  const dx = coordinate[0]! - center[0]!;
  const dy = center[1]! - coordinate[1]!;
  const x = 0.5 + (dx * Math.cos(angle) + dy * Math.sin(angle)) / image.width;
  const y = 0.5 + (-dx * Math.sin(angle) + dy * Math.cos(angle)) / image.height;
  return clamp ? { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) } : { x, y };
}

/** Snap in screen pixels so the capture radius stays consistent at every zoom. */
export function snapImagePivot(
  image: ImageElement,
  coordinate: number[],
  points: PointElement[],
  toPixel: (coordinate: number[]) => number[] | null,
  tolerance = 12
): Pick<ImageElement, 'pivot' | 'pivotPointId'> {
  const pixel = toPixel(coordinate);
  let nearest: PointElement | undefined;
  let distance = tolerance;
  if (pixel) {
    for (const point of points) {
      const candidate = toPixel(fromLonLat([point.coordinates.lon, point.coordinates.lat]));
      if (!candidate) continue;
      const delta = Math.hypot(candidate[0]! - pixel[0]!, candidate[1]! - pixel[1]!);
      if (delta <= distance) {
        nearest = point;
        distance = delta;
      }
    }
  }
  const target = nearest
    ? fromLonLat([nearest.coordinates.lon, nearest.coordinates.lat])
    : coordinate;
  return { pivot: imagePivotFromMap(image, target, false), pivotPointId: nearest?.id };
}

/** Rotate around a fixed map coordinate, translating the centre to keep the pivot stationary. */
export function rotateImage(
  image: ImageElement,
  angle: number,
  points: PointElement[] = []
): Pick<ImageElement, 'center' | 'rotation'> {
  const rotation = ((angle % 360) + 360) % 360;
  if (!image.pivotPointId && (!image.pivot || (image.pivot.x === 0.5 && image.pivot.y === 0.5)))
    return { center: { ...image.center }, rotation };
  const pivot = imagePivotCoordinate(image, points);
  const center = fromLonLat([image.center.lon, image.center.lat]);
  const delta = ((rotation - image.rotation) * Math.PI) / 180;
  const dx = center[0]! - pivot[0]!;
  const dy = center[1]! - pivot[1]!;
  const [lon, lat] = toLonLat([
    pivot[0]! + dx * Math.cos(delta) + dy * Math.sin(delta),
    pivot[1]! - dx * Math.sin(delta) + dy * Math.cos(delta),
  ]);
  return { center: { lon: lon!, lat: lat! }, rotation };
}

export function resizeImage(
  image: ImageElement,
  coordinate: number[],
  handle: ImageHandle,
  minimumSize: number,
  keepAspectRatio = image.keepAspectRatio
): Pick<ImageElement, 'center' | 'width' | 'height'> {
  const center = fromLonLat([image.center.lon, image.center.lat]);
  const angle = (image.rotation * Math.PI) / 180;
  const dx = coordinate[0]! - center[0]!;
  const dy = center[1]! - coordinate[1]!;
  const x = dx * Math.cos(angle) + dy * Math.sin(angle);
  const y = -dx * Math.sin(angle) + dy * Math.cos(angle);
  const [hx, hy] = handle;
  const anchorX = (-hx * image.width) / 2;
  const anchorY = (-hy * image.height) / 2;
  let width = hx ? Math.max(minimumSize, (x - anchorX) * hx) : image.width;
  let height = hy ? Math.max(minimumSize, (y - anchorY) * hy) : image.height;
  if (keepAspectRatio && hx && hy) {
    const scale = Math.max(width / image.width, height / image.height);
    width = image.width * scale;
    height = image.height * scale;
  }
  const midpoint = imageLocalToMap(
    image,
    hx ? anchorX + (hx * width) / 2 : 0,
    hy ? anchorY + (hy * height) / 2 : 0
  );
  const [lon, lat] = toLonLat(midpoint);
  return { center: { lat: lat!, lon: lon! }, width, height };
}
