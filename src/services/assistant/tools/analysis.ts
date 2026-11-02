import type { LatLon } from '../../geometry';
import type { ToolContext } from '../context';
import type { AssistantTool } from './shared';
import { normalizeName } from '@/utils/names';
import { fetchElevations } from '../../geoportail';
import { calculateRoute } from '../../routing';
import { idList, number, text } from '../context';
import { isInsidePolygon } from '../geometry';
import { searchOsmPlaces } from '../osm';
import { findPlacePhoto } from '../photos';
import { withImages } from '../providers';
import { defineTool, ids, num, str } from './shared';

async function elevations(ctx: ToolContext, points: LatLon[]) {
  ctx.budget('network');
  const map = await fetchElevations(points);
  ctx.signal.throwIfAborted();
  return points.map((p) => map.get(`${p.lat.toFixed(6)}_${p.lon.toFixed(6)}`) ?? null);
}

export const analysisTools: AssistantTool[] = [
  defineTool(
    'get_place_photos',
    'Fetch a real photo (Wikidata/Wikimedia Commons) of 1–6 project points and see them as images. Use it to compare places visually, e.g. with an attached image. A wikidata photo shows the named place; a commons_nearby photo was only taken near the point and may show its surroundings. Points without a photo are listed as missing.',
    { point_ids: ids },
    {
      activity: 'photos',
      writes: false,
      async run(ctx, input) {
        const points = idList(input.point_ids, 1, 6).map((id) => ctx.point(id));
        ctx.budget('network');
        const found = await Promise.all(points.map((point) => findPlacePhoto(point, ctx.signal)));
        ctx.signal.throwIfAborted();
        const photos = points.flatMap((point, index) => {
          const photo = found[index];
          return photo ? [{ point, photo }] : [];
        });
        for (const { photo } of photos)
          ctx.references.set(photo.page, { title: `Photo : ${photo.subject}`, url: photo.page });
        ctx.plan.sources = [...ctx.references.values()];
        return withImages(
          {
            photos: photos.map(({ point, photo }, index) => ({
              image_index: index + 1,
              point_id: point.id,
              point_name: point.name,
              shows: photo.subject,
              source: photo.source,
              distance_m: photo.distanceM,
            })),
            missing: points
              .filter((_, index) => !found[index])
              .map((point) => ({ point_id: point.id, point_name: point.name })),
          },
          photos.map(({ photo }) => photo.image)
        );
      },
    }
  ),
  defineTool(
    'measure',
    'Measure distance in kilometers and bearing in degrees between two project points. Use the returned numbers, never guess.',
    { start_point_id: str, end_point_id: str },
    {
      activity: 'read',
      writes: false,
      run(ctx, input) {
        const a = ctx.point(input.start_point_id).coordinates;
        const b = ctx.point(input.end_point_id).coordinates;
        return {
          distance_km: ctx.distanceKm(a, b),
          bearing_degrees: ctx.geometry.calculateBearing(a.lat, a.lon, b.lat, b.lon),
        };
      },
    }
  ),
  defineTool(
    'measure_polygon',
    'Measure area (km²) and perimeter (km) of the zone formed by points.',
    { point_ids: ids },
    {
      activity: 'read',
      writes: false,
      run(ctx, input) {
        const vertices = idList(input.point_ids, 3, 50).map((id) => ctx.point(id).coordinates);
        const perimeter = vertices.reduce(
          (sum, p, index) => sum + ctx.distanceKm(p, vertices[(index + 1) % vertices.length]!),
          0
        );
        return {
          area_km2: ctx.geometry.polygonArea(vertices) / 1_000_000,
          perimeter_km: perimeter,
        };
      },
    }
  ),
  defineTool(
    'find_points_in_area',
    'List the project points inside ALL given circles and the polygon (polygon_id may be empty). Use to answer “which points are in both circles / in this zone”.',
    { circle_ids: ids, polygon_id: str },
    {
      activity: 'read',
      writes: false,
      run(ctx, input) {
        const circles = idList(input.circle_ids, 0, 10).map((id) => ctx.circle(id));
        const polygonId = typeof input.polygon_id === 'string' ? input.polygon_id.trim() : '';
        const polygon = polygonId ? ctx.polygon(polygonId) : undefined;
        if (circles.length === 0 && !polygon)
          throw new Error('Give at least one circle or polygon');
        const vertices = polygon?.pointIds.map((id) => ctx.point(id).coordinates) ?? [];
        const { points } = ctx.current();
        const inside = points.filter(
          (p) =>
            !polygon?.pointIds.includes(p.id) &&
            circles.every((c) => ctx.distanceKm(p.coordinates, c.center) <= c.radius + 1e-6) &&
            (!polygon || isInsidePolygon(p.coordinates, vertices))
        );
        return {
          count: inside.length,
          points: inside.slice(0, 200).map((p) => ({ id: p.id, name: p.name })),
        };
      },
    }
  ),
  defineTool(
    'get_elevations',
    'Return the ground elevation in meters (IGN) of 1–50 points.',
    { point_ids: ids },
    {
      activity: 'elevation',
      writes: false,
      async run(ctx, input) {
        const points = idList(input.point_ids, 1, 50).map((id) => ctx.point(id));
        const values = await elevations(
          ctx,
          points.map((p) => p.coordinates)
        );
        return points.map((p, index) => ({ id: p.id, name: p.name, elevation_m: values[index] }));
      },
    }
  ),
  defineTool(
    'elevation_profile',
    'Sample the elevation along a finite line: start, end, min, max, ascent, descent. Returns location IDs for the highest and lowest samples, usable with create_points.',
    { line_id: str },
    {
      activity: 'elevation',
      writes: false,
      async run(ctx, input) {
        const segment = ctx.line(input.line_id);
        const end = ctx.geometry.getSegmentEndpoint(segment);
        if (segment.mode === 'parallel' || !end) throw new Error('Choose a finite line');
        const samples = ctx.geometry
          .sampleLine(segment.center.lat, segment.center.lon, end.lat, end.lon, 100)
          .map((p) => ({ lat: p.lat, lon: p.lon }));
        const values = await elevations(ctx, samples);
        const known = values.flatMap((z, index) => (z === null ? [] : [{ z, index }]));
        if (known.length < 2) throw new Error('Elevation unavailable along this line');
        let ascent = 0;
        let descent = 0;
        for (let i = 1; i < known.length; i++) {
          const delta = known[i]!.z - known[i - 1]!.z;
          if (delta > 0) ascent += delta;
          else descent -= delta;
        }
        const extreme = (pick: (a: number, b: number) => boolean) => {
          const best = known.reduce((a, b) => (pick(b.z, a.z) ? b : a));
          const position = samples[best.index]!;
          return {
            elevation_m: best.z,
            distance_from_start_km: ctx.distanceKm(segment.center, position),
            location_id: ctx.registerLocation({
              ...position,
              label: `${segment.name} — ${best.z} m`,
            }),
          };
        };
        return {
          start_m: values[0],
          end_m: values.at(-1),
          highest: extreme((a, b) => a > b),
          lowest: extreme((a, b) => a < b),
          ascent_m: Math.round(ascent),
          descent_m: Math.round(descent),
        };
      },
    }
  ),
  defineTool(
    'create_route',
    'Compute and prepare an IGN route (France) between two points. Returns real distance and duration.',
    {
      start_point_id: str,
      end_point_id: str,
      profile: { type: 'string', enum: ['pedestrian', 'car'] },
      optimization: { type: 'string', enum: ['shortest', 'fastest'] },
      name: str,
    },
    {
      activity: 'route',
      writes: true,
      async run(ctx, input) {
        const start = ctx.point(input.start_point_id);
        const end = ctx.point(input.end_point_id);
        if (start.id === end.id) throw new Error('Choose two different points');
        const name = text(input.name);
        const profile = input.profile === 'car' ? 'car' : 'pedestrian';
        const optimization = input.optimization === 'fastest' ? 'fastest' : 'shortest';
        ctx.budget('network');
        let route;
        try {
          route = await calculateRoute(
            start.coordinates,
            end.coordinates,
            profile,
            optimization,
            ctx.signal
          );
        } catch (error) {
          ctx.signal.throwIfAborted();
          throw new Error(
            error instanceof Error && error.message === 'rateLimit'
              ? 'The IGN route service is busy, try again later'
              : 'No route found between these points (IGN covers France)',
            { cause: error }
          );
        }
        ctx.signal.throwIfAborted();
        return {
          distance_km: route.distance / 1000,
          duration_minutes: Math.round(route.duration / 60),
          ...ctx.stageRoute({
            ...route,
            name,
            start: { ...start.coordinates },
            end: { ...end.coordinates },
          }),
        };
      },
    }
  ),
  defineTool(
    'search_osm',
    'Find named OpenStreetMap objects with a tag around a point or inside a circle (area_type circle uses its radius; radius_km is then ignored). Examples: amenity=place_of_worship, historic=*, natural=peak, amenity=fountain, tourism=museum, man_made=lighthouse. Results have location IDs usable with create_points.',
    {
      tag_key: str,
      tag_value: { type: 'string', description: 'Tag value, or * for any value.' },
      name_contains: { type: 'string', description: 'Optional name filter, or empty.' },
      area_type: { type: 'string', enum: ['point', 'circle'] },
      area_id: str,
      radius_km: num,
    },
    {
      activity: 'osm',
      writes: false,
      async run(ctx, input) {
        const area =
          input.area_type === 'circle'
            ? (() => {
                const c = ctx.circle(input.area_id);
                return { center: c.center, radiusKm: c.radius };
              })()
            : {
                center: ctx.point(input.area_id).coordinates,
                radiusKm: number(input.radius_km, 0, 50),
              };
        ctx.budget('network');
        const places = await searchOsmPlaces(
          {
            key: text(input.tag_key, 40),
            value: text(input.tag_value, 60),
            center: area.center,
            radiusKm: area.radiusKm,
          },
          ctx.signal
        );
        ctx.signal.throwIfAborted();
        const filter =
          typeof input.name_contains === 'string' ? normalizeName(input.name_contains.trim()) : '';
        const matches = places
          .filter((p) => !filter || normalizeName(p.name).includes(filter))
          .map((p) => ({ ...p, distance: ctx.distanceKm(area.center, p.coordinates) }))
          .filter((p) => p.distance <= area.radiusKm + 0.001)
          .toSorted((a, b) => a.distance - b.distance);
        return {
          count: matches.length,
          results: matches.slice(0, 25).map((p) => ({
            location_id: ctx.registerLocation({ ...p.coordinates, label: p.name }),
            name: p.name,
            tag: p.tag,
            distance_km: Math.round(p.distance * 1000) / 1000,
          })),
        };
      },
    }
  ),
];
