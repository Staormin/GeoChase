import type { LatLon } from '../../geometry';
import type { ToolContext } from '../context';
import type { AssistantTool } from './shared';
import { fromLonLat, toLonLat } from 'ol/proj';
import { isRecord } from '@/utils/guards';
import { findNearestLineCrossing } from '../../lineCrossings';
import { idList, number, text } from '../context';
import {
  bisectorBearing,
  centroid,
  circleIntersections,
  circleLineIntersections,
  closestOnLine,
  equidistantMidpoint,
  equidistantPoint,
  extendedLineIntersection,
  pointOnLine,
} from '../geometry';
import { LIMITS } from '../limits';
import { planSize } from '../plan';
import { bool, defineTool, ids, num, schema, str } from './shared';

const keep = {
  type: 'string',
  enum: ['all', 'north', 'south', 'east', 'west'],
  description: 'Which crossing to keep when there are two; all keeps every crossing.',
};
const prepare = { activity: 'prepare', writes: true } as const;

function azimuthLine(ctx: ToolContext, input: Record<string, unknown>, relative: boolean) {
  const start = ctx.point(input.point_id);
  const distance = number(input.distance_km, 0.000001, 20_000);
  let azimuth = number(relative ? input.angle_degrees : input.azimuth, -360, 360);
  let angleFrom;
  if (relative) {
    const ref = ctx.line(input.line_id);
    if (!ctx.geometry.isPointOnLine(ref, start.coordinates))
      throw new Error('The angle-line tool requires a point on the reference line');
    const bearing = ctx.geometry.bearingAtPoint(ref, start.coordinates);
    if (bearing === null) throw new Error('Reference bearing unavailable');
    angleFrom = { lineId: ref.id, degrees: azimuth };
    azimuth += bearing;
  }
  azimuth = (azimuth + 720) % 360;
  const endpoint = ctx.geometry.destinationPoint(
    start.coordinates.lat,
    start.coordinates.lon,
    distance,
    azimuth
  );
  if (
    !Number.isFinite(endpoint.lat) ||
    !Number.isFinite(endpoint.lon) ||
    Math.abs(endpoint.lat) > 85
  )
    throw new Error('Unreachable endpoint');
  return ctx.stageLine({
    name: text(input.name),
    mode: 'azimuth',
    center: { ...start.coordinates },
    endpoint,
    azimuth,
    distance,
    startPointId: start.id,
    angleFrom,
  });
}

/** The line from a point down to the closest place of a line, with a point at its foot. */
function perpendicularFromPoint(ctx: ToolContext, input: Record<string, unknown>) {
  const from = ctx.point(input.point_id);
  const line = ctx.line(input.line_id);
  const name = text(input.name);
  const end = ctx.geometry.getSegmentEndpoint(line);
  if (line.mode === 'parallel' || !end) throw new Error('Choose a finite segment');
  if (ctx.geometry.isPointOnLine(line, from.coordinates))
    throw new Error('This point is on the line. Use create_perpendicular.');
  const foot = closestOnLine(line.center, end, from.coordinates, ctx.geometry);
  if (!foot.withinLine)
    throw new Error(
      'The foot of the perpendicular is beyond an end of this line. Use extend_line first.'
    );
  const { coordinates, construction } = pointOnLine(
    line,
    { position: foot.fraction, unit: 'fraction', from_end: false },
    ctx.geometry
  );
  const staged = ctx.stagePoint({
    name: text(input.foot_name),
    coordinates,
    lineId: line.id,
    construction,
  });
  const drawn = ctx.stageLine({
    name,
    mode: 'coordinate',
    center: { ...from.coordinates },
    endpoint: { ...coordinates },
    startPointId: from.id,
    endPointId: staged.id,
  });
  return { ...drawn, foot_point_id: staged.id, coordinates, distance_km: foot.distanceKm };
}

/** All or nothing: every pair is checked before any line is staged. */
function createLines(ctx: ToolContext, input: Record<string, unknown>) {
  const { lines } = input;
  if (
    !Array.isArray(lines) ||
    lines.length === 0 ||
    lines.length + planSize(ctx.plan) > LIMITS.changes
  )
    throw new Error(`Provide between 1 and ${LIMITS.changes} lines`);
  const pairs = lines.map((item: unknown) => {
    if (!isRecord(item)) throw new Error('Invalid line');
    const start = ctx.point(item.start_point_id);
    const end = ctx.point(item.end_point_id);
    if (start.id === end.id) throw new Error('Choose two different points');
    return { start, end, name: text(item.name) };
  });
  return pairs.map(({ start, end, name }) => ({
    name,
    ...ctx.stageLine({
      name,
      mode: 'coordinate',
      center: { ...start.coordinates },
      endpoint: { ...end.coordinates },
      startPointId: start.id,
      endPointId: end.id,
    }),
  }));
}

function perpendicular(ctx: ToolContext, input: Record<string, unknown>) {
  const start = ctx.point(input.point_id);
  const ref = ctx.line(input.line_id);
  const bearing = ctx.geometry.bearingAtPoint(ref, start.coordinates);
  if (bearing === null || !ctx.geometry.isPointOnLine(ref, start.coordinates))
    throw new Error('Choose a point on the reference line');
  const direction = text(input.direction);
  if (!['north', 'south', 'east', 'west'].includes(direction))
    throw new Error('Choose a compass direction');
  const distance = number(input.distance_km, 0.000001, 20_000);
  const choices = [-90, 90]
    .map((angle) => {
      const end = ctx.geometry.destinationPoint(
        start.coordinates.lat,
        start.coordinates.lon,
        distance,
        (bearing + angle + 360) % 360
      );
      const latitude = end.lat - start.coordinates.lat;
      const longitude = ((end.lon - start.coordinates.lon + 540) % 360) - 180;
      const score =
        direction === 'north'
          ? latitude
          : direction === 'south'
            ? -latitude
            : direction === 'east'
              ? longitude
              : -longitude;
      return { angle, score };
    })
    .toSorted((a, b) => b.score - a.score);
  if (choices[0]!.score <= 1e-8)
    throw new Error(
      'This perpendicular does not head in that direction. Choose another compass direction.'
    );
  return azimuthLine(ctx, { ...input, angle_degrees: choices[0]!.angle }, true);
}

function segmentCrossing(ctx: ToolContext, input: Record<string, unknown>) {
  const paths = [ctx.line(input.first_line_id), ctx.line(input.second_line_id)].map((item) => {
    const endpoint = ctx.geometry.getSegmentEndpoint(item);
    const coordinates =
      item.mode === 'parallel'
        ? [
            fromLonLat([-180, item.longitude ?? item.center.lat]),
            fromLonLat([180, item.longitude ?? item.center.lat]),
          ]
        : endpoint
          ? ctx.geometry.lineCoordinates(item.center, endpoint)
          : [];
    if (coordinates.length === 0) throw new Error('Line endpoint unavailable');
    return { id: item.id, name: item.name, coordinates, endpoints: [] };
  });
  // Same segment intersection and world-wrapping policy as the pointer tool.
  const pointer = paths[0]!.coordinates[Math.floor(paths[0]!.coordinates.length / 2)]!;
  const crossing = findNearestLineCrossing(paths, pointer, 80_000_000, 0);
  if (!crossing) throw new Error('No unique crossing between these displayed segments');
  const [lon, lat] = toLonLat(crossing.coordinate);
  return ctx.stagePoint({ name: text(input.name), coordinates: { lon: lon!, lat: lat! } });
}

function keepCrossings(ctx: ToolContext, points: LatLon[], choice: unknown, name: string) {
  if (points.length === 0) throw new Error('These elements do not cross');
  const mode = String(choice);
  if (!['all', 'north', 'south', 'east', 'west'].includes(mode)) throw new Error('Invalid keep');
  const kept =
    mode === 'all'
      ? points
      : [
          points.toSorted((a, b) =>
            mode === 'north'
              ? b.lat - a.lat
              : mode === 'south'
                ? a.lat - b.lat
                : mode === 'east'
                  ? b.lon - a.lon
                  : a.lon - b.lon
          )[0]!,
        ];
  return {
    crossings_found: points.length,
    points: kept.map((coordinates, index) => {
      const pointName = kept.length > 1 ? `${name} ${index + 1}` : name;
      return { name: pointName, ...ctx.stagePoint({ name: pointName, coordinates }) };
    }),
  };
}

export const constructionTools: AssistantTool[] = [
  defineTool(
    'create_point_on_line',
    'Create a point on an existing or prepared line. position is a fraction of the displayed path (0.5 for midpoint, 1/3 for one third) or a distance in kilometers. from_end reverses the origin. Default to the line start unless the user specifies the end. Read the project to identify the line; ask if ambiguous. No geocoding is needed.',
    {
      line_id: str,
      name: str,
      position: num,
      unit: { type: 'string', enum: ['fraction', 'kilometers'] },
      from_end: bool,
    },
    {
      ...prepare,
      run(ctx, input) {
        const line = ctx.line(input.line_id);
        const name = text(input.name);
        const { coordinates, construction } = pointOnLine(line, input, ctx.geometry);
        const staged = ctx.stagePoint({ name, coordinates, lineId: line.id, construction });
        if (staged.status === 'prepared')
          ctx.plan.placements[staged.id] = {
            lineId: line.id,
            position: input.position as number,
            unit: input.unit as 'fraction' | 'kilometers',
            fromEnd: input.from_end as boolean,
          };
        return { ...staged, name };
      },
    }
  ),
  defineTool(
    'create_circle',
    'Prepare a circle around an existing or prepared point. Radius is in kilometers.',
    { point_id: str, radius_km: num, name: str },
    {
      ...prepare,
      run(ctx, input) {
        const center = ctx.point(input.point_id);
        return ctx.stageCircle({
          name: text(input.name),
          center: { ...center.coordinates },
          radius: number(input.radius_km, 0.000001, 20_000),
        });
      },
    }
  ),
  defineTool(
    'create_line',
    'Prepare a straight line between two existing or prepared points.',
    { start_point_id: str, end_point_id: str, name: str },
    {
      ...prepare,
      run(ctx, input) {
        const start = ctx.point(input.start_point_id);
        const end = ctx.point(input.end_point_id);
        if (start.id === end.id) throw new Error('Choose two different points');
        return ctx.stageLine({
          name: text(input.name),
          mode: 'coordinate',
          center: { ...start.coordinates },
          endpoint: { ...end.coordinates },
          startPointId: start.id,
          endPointId: end.id,
        });
      },
    }
  ),
  defineTool(
    'create_lines',
    `Create several straight lines between existing or prepared points in one undo step, ${LIMITS.changes} at most per call. Either all are created or none.`,
    {
      lines: {
        type: 'array',
        items: schema({ start_point_id: str, end_point_id: str, name: str }),
      },
    },
    { ...prepare, run: createLines }
  ),
  defineTool(
    'create_azimuth_line',
    'Create a line from a point using an absolute bearing in degrees and length in km. Ask for missing distance or direction.',
    { point_id: str, azimuth: num, distance_km: num, name: str },
    { ...prepare, run: (ctx, input) => azimuthLine(ctx, input, false) }
  ),
  defineTool(
    'create_perpendicular_from_point',
    'Drop a perpendicular from a point that is NOT on a line: creates the point at its foot on the line and the segment joining them, the shortest ground distance to the line. Fails when the foot is beyond an end of the line. To only get the distance, use measure_point_to_line.',
    { point_id: str, line_id: str, name: str, foot_name: str },
    { ...prepare, run: perpendicularFromPoint }
  ),
  defineTool(
    'create_perpendicular',
    'Create a perpendicular from a point ON a reference line, choosing north/south/east/west in GeoChase. Always use this tool for a perpendicular with a compass direction: do not guess +90 versus -90. Ask which direction when unspecified.',
    {
      point_id: str,
      line_id: str,
      distance_km: num,
      direction: { type: 'string', enum: ['north', 'south', 'east', 'west'] },
      name: str,
    },
    { ...prepare, run: perpendicular }
  ),
  defineTool(
    'create_angle_line',
    'Create a line from a point ON a reference line: rotate its local bearing by angle_degrees (0 parallel; use create_perpendicular for a compass-directed perpendicular), extend distance_km. Ask for missing distance or side.',
    { point_id: str, line_id: str, angle_degrees: num, distance_km: num, name: str },
    { ...prepare, run: (ctx, input) => azimuthLine(ctx, input, true) }
  ),
  defineTool(
    'create_parallel',
    'Create a latitude parallel through a project point: an east–west circle of latitude, not a line parallel to an arbitrary segment.',
    { point_id: str, name: str },
    {
      ...prepare,
      run(ctx, input) {
        const start = ctx.point(input.point_id);
        return ctx.stageLine({
          name: text(input.name),
          mode: 'parallel',
          center: { ...start.coordinates },
          longitude: start.coordinates.lat,
        });
      },
    }
  ),
  defineTool(
    'create_intersection_point',
    'Create a point at the crossing of two displayed finite line segments, using the same crossing geometry as the map. Does not extend lines. Fails if no crossing exists.',
    { first_line_id: str, second_line_id: str, name: str },
    { ...prepare, run: segmentCrossing }
  ),
  defineTool(
    'create_extended_intersection',
    'Create the crossing of two lines prolonged beyond their endpoints, when create_intersection_point fails because the displayed segments do not touch.',
    { first_line_id: str, second_line_id: str, name: str },
    {
      ...prepare,
      run(ctx, input) {
        const a = ctx.line(input.first_line_id);
        const b = ctx.line(input.second_line_id);
        if (a.id === b.id) throw new Error('Choose two different lines');
        const crossing = extendedLineIntersection(ctx.geometry, a, b);
        if (!crossing) throw new Error('These lines are parallel or never cross');
        const within = (f: number) => f >= -1e-9 && f <= 1 + 1e-9;
        return {
          on_first_segment: within(crossing.firstFraction),
          on_second_segment: within(crossing.secondFraction),
          ...ctx.stagePoint({ name: text(input.name), coordinates: crossing.point }),
        };
      },
    }
  ),
  defineTool(
    'create_circle_intersections',
    'Create the crossing point(s) of two circles, e.g. “12 km from A and 8 km from B”. Fails if the circles do not cross. Point names get a 1/2 suffix when two are kept.',
    { first_circle_id: str, second_circle_id: str, keep, name: str },
    {
      ...prepare,
      run(ctx, input) {
        const a = ctx.circle(input.first_circle_id);
        const b = ctx.circle(input.second_circle_id);
        if (a.id === b.id) throw new Error('Choose two different circles');
        const points = circleIntersections(
          ctx.geometry,
          { center: a.center, radiusKm: a.radius },
          { center: b.center, radiusKm: b.radius }
        );
        return keepCrossings(ctx, points, input.keep, text(input.name));
      },
    }
  ),
  defineTool(
    'create_circle_line_intersections',
    'Create the crossing point(s) of a circle and a displayed line (segment or latitude parallel). Point names get a 1/2 suffix when several are kept.',
    { circle_id: str, line_id: str, keep, name: str },
    {
      ...prepare,
      run(ctx, input) {
        const c = ctx.circle(input.circle_id);
        const points = circleLineIntersections(
          ctx.geometry,
          { center: c.center, radiusKm: c.radius },
          ctx.line(input.line_id)
        );
        return keepCrossings(ctx, points, input.keep, text(input.name));
      },
    }
  ),
  defineTool(
    'create_point_at_bearing',
    'Create a point at distance_km from a point along an absolute bearing in degrees (0 north, 90 east). No line is drawn.',
    { point_id: str, azimuth: num, distance_km: num, name: str },
    {
      ...prepare,
      run(ctx, input) {
        const start = ctx.point(input.point_id).coordinates;
        const end = ctx.geometry.destinationPoint(
          start.lat,
          start.lon,
          number(input.distance_km, 0.000001, 20_000),
          (number(input.azimuth, -360, 360) + 720) % 360
        );
        if (Math.abs(end.lat) > 85) throw new Error('Unreachable position');
        return ctx.stagePoint({ name: text(input.name), coordinates: end });
      },
    }
  ),
  defineTool(
    'create_midpoint',
    'Create the midpoint between two points: on the displayed line, at equal ground distance from both.',
    { first_point_id: str, second_point_id: str, name: str },
    {
      ...prepare,
      run(ctx, input) {
        const a = ctx.point(input.first_point_id).coordinates;
        const b = ctx.point(input.second_point_id).coordinates;
        return ctx.stagePoint({
          name: text(input.name),
          coordinates: equidistantMidpoint(ctx.geometry, a, b),
        });
      },
    }
  ),
  defineTool(
    'create_centroid',
    'Create the barycentre (mean position) of 2–50 points.',
    { point_ids: ids, name: str },
    {
      ...prepare,
      run(ctx, input) {
        const points = idList(input.point_ids, 2, 50).map((id) => ctx.point(id).coordinates);
        return ctx.stagePoint({
          name: text(input.name),
          coordinates: centroid(ctx.geometry, points),
        });
      },
    }
  ),
  defineTool(
    'create_bisector',
    'Create the angle bisector at vertex_point_id between the directions to first_point_id and second_point_id, as a line of distance_km from the vertex inside the angle.',
    {
      vertex_point_id: str,
      first_point_id: str,
      second_point_id: str,
      distance_km: num,
      name: str,
    },
    {
      ...prepare,
      run(ctx, input) {
        const vertex = ctx.point(input.vertex_point_id);
        const a = ctx.point(input.first_point_id).coordinates;
        const b = ctx.point(input.second_point_id).coordinates;
        const v = vertex.coordinates;
        if (ctx.distanceKm(v, a) === 0 || ctx.distanceKm(v, b) === 0)
          throw new Error('The vertex must differ from both points');
        const azimuth = bisectorBearing(
          ctx.geometry.calculateBearing(v.lat, v.lon, a.lat, a.lon),
          ctx.geometry.calculateBearing(v.lat, v.lon, b.lat, b.lon)
        );
        const distance = number(input.distance_km, 0.000001, 20_000);
        return {
          bearing_degrees: azimuth,
          ...ctx.stageLine({
            name: text(input.name),
            mode: 'azimuth',
            center: { ...v },
            endpoint: ctx.geometry.destinationPoint(v.lat, v.lon, distance, azimuth),
            azimuth,
            distance,
            startPointId: vertex.id,
          }),
        };
      },
    }
  ),
  defineTool(
    'create_perpendicular_bisector',
    'Create the perpendicular bisector (médiatrice) of two points: a line of length_km centred on their midpoint, every point at equal ground distance from both.',
    { first_point_id: str, second_point_id: str, length_km: num, name: str },
    {
      ...prepare,
      run(ctx, input) {
        const a = ctx.point(input.first_point_id).coordinates;
        const b = ctx.point(input.second_point_id).coordinates;
        if (ctx.distanceKm(a, b) === 0) throw new Error('Choose two distinct points');
        const length = number(input.length_km, 0.000001, 20_000);
        const middle = equidistantMidpoint(ctx.geometry, a, b);
        const bearing = ctx.geometry.calculateBearing(middle.lat, middle.lon, b.lat, b.lon);
        // Ends are equidistant from both points, not only perpendicular in the projected plane.
        const [start, end] = [-90, 90].map((turn) =>
          equidistantPoint(
            ctx.geometry,
            a,
            b,
            middle,
            length / 2,
            ctx.geometry.destinationPoint(middle.lat, middle.lon, length / 2, bearing + turn)
          )
        );
        return {
          midpoint: middle,
          ...ctx.stageLine({
            name: text(input.name),
            mode: 'coordinate',
            center: start!,
            endpoint: end!,
          }),
        };
      },
    }
  ),
  defineTool(
    'extend_line',
    'Prolong a finite line by distance_km as a new line on the same direction. beyond_end true continues past its end, false continues before its start.',
    { line_id: str, distance_km: num, beyond_end: bool, name: str },
    {
      ...prepare,
      run(ctx, input) {
        const segment = ctx.line(input.line_id);
        const end = ctx.geometry.getSegmentEndpoint(segment);
        if (segment.mode === 'parallel' || !end) throw new Error('Choose a finite line');
        const distance = number(input.distance_km, 0.000001, 20_000);
        if (typeof input.beyond_end !== 'boolean') throw new Error('beyond_end must be a boolean');
        const beyondEnd = input.beyond_end;
        const origin = beyondEnd ? end : segment.center;
        const azimuth = beyondEnd
          ? ctx.geometry.bearingAtPoint(segment, end)
          : (ctx.geometry.calculateBearing(
              segment.center.lat,
              segment.center.lon,
              end.lat,
              end.lon
            ) +
              180) %
            360;
        if (azimuth === null) throw new Error('Line bearing unavailable');
        const endpoint = ctx.geometry.destinationPoint(origin.lat, origin.lon, distance, azimuth);
        if (Math.abs(endpoint.lat) > 85) throw new Error('Unreachable endpoint');
        const anchor = beyondEnd ? segment.endPointId : segment.startPointId;
        return ctx.stageLine({
          name: text(input.name),
          mode: 'azimuth',
          center: { ...origin },
          endpoint,
          azimuth,
          distance,
          ...(anchor ? { startPointId: anchor } : {}),
        });
      },
    }
  ),
  defineTool(
    'create_polygon',
    'Create a polygon (search zone) from 3–50 existing or prepared point IDs, in drawing order.',
    { point_ids: ids, name: str },
    {
      ...prepare,
      run(ctx, input) {
        const pointIds = idList(input.point_ids, 3, 50);
        const vertices = pointIds.map((id) => ctx.point(id).coordinates);
        return {
          area_km2: ctx.geometry.polygonArea(vertices) / 1_000_000,
          ...ctx.stagePolygon({ name: text(input.name), pointIds }),
        };
      },
    }
  ),
];
