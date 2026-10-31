import type { ImageElement } from '@/types/project';
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
