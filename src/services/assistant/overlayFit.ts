import type { LatLon } from '../geometry';
import type { ImageElement } from '@/types/project';
import { fromLonLat, toLonLat } from 'ol/proj';
import { getDistance } from 'ol/sphere';

/** A position on the image, as fractions of its width and height from the top-left corner. */
export interface OverlayAnchor {
  x: number;
  y: number;
  target: LatLon;
}
export type OverlayFrame = Pick<ImageElement, 'center' | 'width' | 'height' | 'rotation'>;

type Complex = [number, number];
const add = (a: Complex, b: Complex): Complex => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Complex, b: Complex): Complex => [a[0] - b[0], a[1] - b[1]];
function mul(a: Complex, b: Complex): Complex {
  return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
}
const conj = (a: Complex): Complex => [a[0], -a[1]];
const abs = (a: Complex) => Math.hypot(a[0], a[1]);
const scale = (a: Complex, k: number): Complex => [a[0] * k, a[1] * k];
function mean(values: Complex[]) {
  return scale(
    values.reduce((sum, value) => add(sum, value)),
    1 / values.length
  );
}

/**
 * Ground metres per EPSG:3857 unit at a place: OpenLayers' point resolution for
 * Web Mercator (1 / cosh(y / R)), i.e. the factor the PDF import also uses.
 */
export function metersPerMapUnit(at: LatLon) {
  return Math.cos((at.lat * Math.PI) / 180);
}

/**
 * Places an image so its anchors land on their targets, in the map plane where
 * overlays are drawn. The image keeps its aspect ratio; `width` forces its size
 * (from a map scale) and the anchors then only set position and rotation.
 *
 * With map = centre + a · (x, -y) for a local offset (x, y) measured right and
 * down, a = size × e^(−i·rotation): two anchors give `a` exactly, more anchors a
 * least-squares fit. With a forced size and two anchors the first anchor is
 * exact and the second sets the direction.
 */
export function fitOverlay(
  image: Pick<ImageElement, 'width' | 'height' | 'rotation'>,
  anchors: OverlayAnchor[],
  width?: number
): { frame: OverlayFrame; residualsM: number[]; anchorWidth?: number } {
  if (anchors.length === 0) throw new Error('Give at least one anchor');
  const local = anchors.map((anchor): Complex => [
    (anchor.x - 0.5) * image.width,
    -(anchor.y - 0.5) * image.height,
  ]);
  const map = anchors.map((anchor): Complex => {
    const [x, y] = fromLonLat([anchor.target.lon, anchor.target.lat]);
    return [x!, y!];
  });
  const size = width === undefined ? undefined : width / image.width;
  let a: Complex;
  let c: Complex;
  let anchorWidth: number | undefined;
  if (anchors.length === 1) {
    const angle = (-image.rotation * Math.PI) / 180;
    a = scale([Math.cos(angle), Math.sin(angle)], size ?? 1);
    c = sub(map[0]!, mul(a, local[0]!));
  } else {
    const localMean = mean(local);
    const mapMean = mean(map);
    let numerator: Complex = [0, 0];
    let denominator = 0;
    for (let i = 0; i < anchors.length; i++) {
      const u = sub(local[i]!, localMean);
      numerator = add(numerator, mul(sub(map[i]!, mapMean), conj(u)));
      denominator += u[0] ** 2 + u[1] ** 2;
    }
    if (denominator < 1e-12 || abs(numerator) < 1e-12)
      throw new Error('Anchors must be at distinct positions on the image and on the map');
    const free = scale(numerator, 1 / denominator);
    anchorWidth = abs(free) * image.width;
    a = size === undefined ? free : scale(free, size / abs(free));
    c =
      anchors.length === 2 && size !== undefined
        ? sub(map[0]!, mul(a, local[0]!))
        : sub(mapMean, mul(a, localMean));
  }
  const residualsM = local.map((u, i) => {
    const predicted = toLonLat(add(c, mul(a, u)));
    return getDistance(predicted, [anchors[i]!.target.lon, anchors[i]!.target.lat]);
  });
  const [lon, lat] = toLonLat(c);
  const rotation = ((((-Math.atan2(a[1], a[0]) * 180) / Math.PI) % 360) + 360) % 360;
  return {
    frame: {
      center: { lat: lat!, lon: lon! },
      width: abs(a) * image.width,
      height: abs(a) * image.height,
      rotation,
    },
    residualsM,
    anchorWidth,
  };
}

/** Width in map units of a sheet printed at 1:denominator, at a place. */
export function widthAtScale(paperWidthM: number, denominator: number, at: LatLon) {
  return (paperWidthM * denominator) / metersPerMapUnit(at);
}
/** Map scale denominator of an image of this width, at a place. */
export function scaleOfWidth(paperWidthM: number, width: number, at: LatLon) {
  return (width * metersPerMapUnit(at)) / paperWidthM;
}
