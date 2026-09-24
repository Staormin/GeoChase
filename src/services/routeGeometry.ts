import { fromLonLat, toLonLat } from 'ol/proj';
import { getDistance } from 'ol/sphere';

/** Cache cumulative ground distances once, then interpolate on the rendered road edge. */
export function createRouteTraversal(coordinates: [number, number][]) {
  const cumulative = [0];
  for (let i = 1; i < coordinates.length; i++) {
    cumulative.push(cumulative[i - 1]! + getDistance(coordinates[i - 1]!, coordinates[i]!));
  }
  const length = cumulative.at(-1) ?? 0;
  function at(distance: number): { lat: number; lon: number } {
    if (coordinates.length === 0) throw new Error('Empty route');
    const target = Math.max(0, Math.min(length, distance));
    let low = 0;
    let high = coordinates.length - 1;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (cumulative[mid]! < target) low = mid + 1;
      else high = mid;
    }
    const end = low;
    const start = Math.max(0, end - 1);
    const span = cumulative[end]! - cumulative[start]!;
    const fraction = span > 0 ? (target - cumulative[start]!) / span : 0;
    const a = fromLonLat(coordinates[start]!);
    const b = fromLonLat(coordinates[end]!);
    const [lon, lat] = toLonLat([
      a[0]! + (b[0]! - a[0]!) * fraction,
      a[1]! + (b[1]! - a[1]!) * fraction,
    ]);
    return { lat: lat!, lon: lon! };
  }
  return { length, at };
}
