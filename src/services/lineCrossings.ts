export interface CrossingLine {
  id: string;
  name: string;
  coordinates: number[][];
  endpoints: number[][];
}

export interface LineCrossing {
  coordinate: number[];
  lines: [CrossingLine, CrossingLine];
}

const WORLD_WIDTH = 40_075_016.68557849;

function squaredDistance(a: number[], b: number[]): number {
  return (a[0]! - b[0]!) ** 2 + (a[1]! - b[1]!) ** 2;
}

function inSameWorld(coordinate: number[], reference: number[]): number[] {
  const shift = Math.round((reference[0]! - coordinate[0]!) / WORLD_WIDTH) * WORLD_WIDTH;
  return [coordinate[0]! + shift, coordinate[1]!];
}

/** Find a crossing of the displayed paths near the pointer, excluding line endpoints. */
export function findNearestLineCrossing(
  lines: CrossingLine[],
  pointer: number[],
  tolerance: number,
  endpointTolerance = 0.01
): LineCrossing | null {
  const nearEndpoint = (line: CrossingLine, coordinate: number[]) =>
    line.endpoints.some(
      (endpoint) =>
        squaredDistance(inSameWorld(endpoint, coordinate), coordinate) <= endpointTolerance ** 2
    );
  // Leave the entire endpoint hit area available to the existing endpoint interaction.
  if (lines.some((line) => nearEndpoint(line, pointer))) return null;

  const nearby = lines
    .map((line) => {
      const segments: Array<{ start: number[]; end: number[] }> = [];
      for (let index = 1; index < line.coordinates.length; index++) {
        const a = line.coordinates[index - 1]!;
        const b = line.coordinates[index]!;
        const midpoint = [(a[0]! + b[0]!) / 2, (a[1]! + b[1]!) / 2];
        const shift = inSameWorld(midpoint, pointer)[0]! - midpoint[0]!;
        const start = [a[0]! + shift, a[1]!];
        const end = [b[0]! + shift, b[1]!];
        if (
          Math.max(start[0]!, end[0]!) < pointer[0]! - tolerance ||
          Math.min(start[0]!, end[0]!) > pointer[0]! + tolerance ||
          Math.max(start[1]!, end[1]!) < pointer[1]! - tolerance ||
          Math.min(start[1]!, end[1]!) > pointer[1]! + tolerance
        )
          continue;
        segments.push({ start, end });
      }
      return { line, segments };
    })
    .filter((item) => item.segments.length > 0);

  let nearest: LineCrossing | null = null;
  let bestDistance = tolerance ** 2;
  for (let i = 0; i < nearby.length; i++) {
    const first = nearby[i]!;
    for (let j = i + 1; j < nearby.length; j++) {
      const second = nearby[j]!;
      if (first.line.id === second.line.id) continue;
      for (const a of first.segments) {
        for (const b of second.segments) {
          const rx = a.end[0]! - a.start[0]!;
          const ry = a.end[1]! - a.start[1]!;
          const sx = b.end[0]! - b.start[0]!;
          const sy = b.end[1]! - b.start[1]!;
          const denominator = rx * sy - ry * sx;
          // Parallel, overlapping and zero-length segments have no unique crossing.
          if (
            Math.abs(denominator) <=
            Number.EPSILON * 16 * Math.hypot(rx, ry) * Math.hypot(sx, sy)
          )
            continue;
          const dx = b.start[0]! - a.start[0]!;
          const dy = b.start[1]! - a.start[1]!;
          const t = (dx * sy - dy * sx) / denominator;
          const u = (dx * ry - dy * rx) / denominator;
          if (t < -1e-10 || t > 1 + 1e-10 || u < -1e-10 || u > 1 + 1e-10) continue;
          const coordinate = [a.start[0]! + t * rx, a.start[1]! + t * ry];
          const distance = squaredDistance(coordinate, pointer);
          if (
            distance > bestDistance ||
            nearEndpoint(first.line, coordinate) ||
            nearEndpoint(second.line, coordinate)
          )
            continue;
          if (!nearest || distance < bestDistance) {
            nearest = { coordinate, lines: [first.line, second.line] };
            bestDistance = distance;
          }
        }
      }
    }
  }
  return nearest;
}
