import type { ProjectContext } from '@/services/assistant/plan';
import type { ProjectProjection } from '@/types/project';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAssistantExecutor, runAssistant } from '@/services/assistant/agent';
import { bisectorBearing, isInsidePolygon } from '@/services/assistant/geometry';
import { planSize } from '@/services/assistant/plan';
import { appendResults, getTurn, userMessage, withImages } from '@/services/assistant/providers';
import { createProjectGeometry } from '@/services/projectGeometry';

vi.mock('@/services/assistant/geocoding', () => ({ searchAssistantPlaces: vi.fn() }));
const settings = { provider: 'openai' as const, apiKey: 'k', model: 'gpt-5-mini', effort: 'auto' };

function project(projection: ProjectProjection): ProjectContext {
  return {
    name: 'Hunt',
    projection,
    points: [
      { id: 'a', name: 'A', coordinates: { lat: 48, lon: 2 } },
      { id: 'b', name: 'B', coordinates: { lat: 48, lon: 2.8 } },
      { id: 'c', name: 'C', coordinates: { lat: 48.5, lon: 2.4 } },
      { id: 'inside', name: 'Inside', coordinates: { lat: 48.1, lon: 2.4 } },
      { id: 'far', name: 'Far', coordinates: { lat: 45, lon: 6 } },
    ],
    lines: [
      {
        id: 'ab',
        name: 'AB',
        mode: 'coordinate',
        center: { lat: 48, lon: 2 },
        endpoint: { lat: 48, lon: 2.8 },
        startPointId: 'a',
        endPointId: 'b',
      },
      {
        id: 'short',
        name: 'Short',
        mode: 'coordinate',
        center: { lat: 48, lon: 2 },
        endpoint: { lat: 48, lon: 3 },
      },
      {
        id: 'vertical',
        name: 'Vertical',
        mode: 'coordinate',
        center: { lat: 46, lon: 5 },
        endpoint: { lat: 47, lon: 5 },
      },
    ],
    circles: [
      { id: 'ca', name: 'Around A', center: { lat: 48, lon: 2 }, radius: 40 },
      { id: 'cb', name: 'Around B', center: { lat: 48, lon: 2.8 }, radius: 35 },
      { id: 'tiny', name: 'Tiny', center: { lat: 45, lon: 6 }, radius: 1 },
      { id: 'mid', name: 'Mid', center: { lat: 48, lon: 2.5 }, radius: 20 },
    ],
    polygons: [],
    routes: [],
    notes: [
      {
        id: 'n',
        title: 'Clue',
        content: 'First',
        linkedElementType: 'point',
        linkedElementId: 'c',
      },
    ],
  };
}
function run(projection: ProjectProjection = 'mercator') {
  return createAssistantExecutor(project(projection), settings, new AbortController().signal);
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe.each(['mercator', 'geodesic'] as const)('constructions in %s projects', (projection) => {
  const geometry = createProjectGeometry(() => projection);
  const km = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) =>
    geometry.getDistance([a.lon, a.lat], [b.lon, b.lat]) / 1000;

  it('crosses two circles at their exact radii and keeps the requested side', async () => {
    const runner = run(projection);
    const result = (await runner.execute('create_circle_intersections', {
      first_circle_id: 'ca',
      second_circle_id: 'cb',
      keep: 'all',
      name: 'X',
    })) as { crossings_found: number };
    expect(result.crossings_found).toBe(2);
    expect(runner.plan.points.map((p) => p.name)).toEqual(['X 1', 'X 2']);
    for (const point of runner.plan.points) {
      expect(km(point.coordinates, { lat: 48, lon: 2 })).toBeCloseTo(40, 4);
      expect(km(point.coordinates, { lat: 48, lon: 2.8 })).toBeCloseTo(35, 4);
    }
    const north = run(projection);
    await north.execute('create_circle_intersections', {
      first_circle_id: 'ca',
      second_circle_id: 'cb',
      keep: 'north',
      name: 'N',
    });
    expect(north.plan.points).toHaveLength(1);
    expect(north.plan.points[0]!.coordinates.lat).toBeGreaterThan(48);
    await expect(
      north.execute('create_circle_intersections', {
        first_circle_id: 'ca',
        second_circle_id: 'tiny',
        keep: 'all',
        name: 'None',
      })
    ).rejects.toThrow('do not cross');
  });

  it('crosses a circle and a displayed line on the line', async () => {
    const runner = run(projection);
    await runner.execute('create_circle_line_intersections', {
      circle_id: 'mid',
      line_id: 'short',
      keep: 'all',
      name: 'Y',
    });
    expect(runner.plan.points).toHaveLength(2);
    const line = project(projection).lines[1]!;
    for (const point of runner.plan.points) {
      expect(km(point.coordinates, { lat: 48, lon: 2.5 })).toBeCloseTo(20, 4);
      expect(geometry.isPointOnLine(line, point.coordinates)).toBe(true);
    }
  });

  it('prolongs lines to find a crossing beyond their segments', async () => {
    const runner = run(projection);
    const result = (await runner.execute('create_extended_intersection', {
      first_line_id: 'short',
      second_line_id: 'vertical',
      name: 'Far crossing',
    })) as { on_first_segment: boolean; on_second_segment: boolean };
    expect(result).toMatchObject({ on_first_segment: false, on_second_segment: false });
    const point = runner.plan.points[0]!.coordinates;
    expect(point.lon).toBeCloseTo(5, 3);
    expect(point.lat).toBeGreaterThan(47.8);
    expect(point.lat).toBeLessThan(48.2);
  });

  it('builds bearing points, midpoints, centroids, bisectors and extensions', async () => {
    const runner = run(projection);
    await runner.execute('create_point_at_bearing', {
      point_id: 'a',
      azimuth: 0,
      distance_km: 10,
      name: 'North of A',
    });
    expect(km(runner.plan.points[0]!.coordinates, { lat: 48, lon: 2 })).toBeCloseTo(10, 3);
    expect(runner.plan.points[0]!.coordinates.lon).toBeCloseTo(2, 6);
    await runner.execute('create_midpoint', {
      first_point_id: 'a',
      second_point_id: 'b',
      name: 'Middle',
    });
    const middle = runner.plan.points[1]!.coordinates;
    expect(km(middle, { lat: 48, lon: 2 })).toBeCloseTo(km(middle, { lat: 48, lon: 2.8 }), 6);
    await runner.execute('create_centroid', { point_ids: ['a', 'b', 'c'], name: 'G' });
    expect(runner.plan.points[2]!.coordinates.lon).toBeCloseTo(2.4, 2);
    await runner.execute('create_perpendicular_bisector', {
      first_point_id: 'a',
      second_point_id: 'b',
      length_km: 20,
      name: 'Médiatrice',
    });
    const bisector = runner.plan.lines[0]!;
    for (const end of [bisector.center, bisector.endpoint!]) {
      expect(km(end, { lat: 48, lon: 2 })).toBeCloseTo(km(end, { lat: 48, lon: 2.8 }), 6);
      expect(km(end, runner.plan.points[1]!.coordinates)).toBeCloseTo(10, 6);
    }
    await runner.execute('extend_line', {
      line_id: 'ab',
      distance_km: 5,
      beyond_end: true,
      name: 'Beyond B',
    });
    expect(runner.plan.lines[1]).toMatchObject({ mode: 'azimuth', distance: 5, startPointId: 'b' });
    expect(runner.plan.lines[1]!.center).toEqual({ lat: 48, lon: 2.8 });
    expect(runner.plan.lines[1]!.endpoint!.lon).toBeGreaterThan(2.8);
    await runner.execute('extend_line', {
      line_id: 'ab',
      distance_km: 5,
      beyond_end: false,
      name: 'Before A',
    });
    expect(runner.plan.lines[2]!.endpoint!.lon).toBeLessThan(2);
  });
});

describe('staging safeguards', () => {
  it('returns the prepared element when a construction call is replayed', async () => {
    const runner = run();
    const args = { first_point_id: 'a', second_point_id: 'b', name: 'Middle' };
    const first = (await runner.execute('create_midpoint', args)) as { id: string };
    expect(await runner.execute('create_midpoint', args)).toMatchObject({
      id: first.id,
      status: 'already_exists',
    });
    const crossing = { first_circle_id: 'ca', second_circle_id: 'cb', keep: 'all', name: 'X' };
    await runner.execute('create_circle_intersections', crossing);
    await runner.execute('create_circle_intersections', crossing);
    expect(runner.plan.points.map((p) => p.name)).toEqual(['Middle', 'X 1', 'X 2']);
    const zone = { point_ids: ['a', 'b', 'c'], name: 'Zone' };
    await runner.execute('create_polygon', zone);
    await runner.execute('create_polygon', zone);
    expect(runner.plan.polygons).toHaveLength(1);
  });

  it('refuses to delete a vertex of a polygon prepared in the same request', async () => {
    const runner = run();
    await runner.execute('create_polygon', { point_ids: ['a', 'b', 'c'], name: 'Zone' });
    await expect(
      runner.execute('delete_element', { element_type: 'point', element_id: 'c' })
    ).rejects.toThrow('belongs to a polygon');
    expect(runner.plan.edits).toEqual([]);
  });

  it('adds attachment descriptions to the request text', () => {
    const capture = {
      name: 'Map',
      mimeType: 'image/jpeg',
      data: 'AAA',
      description: '[Attached map capture: north 49]',
    };
    expect(userMessage('openai', 'Where?', [capture]).content).toContainEqual({
      type: 'input_text',
      text: 'Where?\n\n[Attached map capture: north 49]',
    });
  });
});

describe('zones and analysis', () => {
  it('creates polygons and filters points inside circles and zones', async () => {
    const runner = run();
    const zone = (await runner.execute('create_polygon', {
      point_ids: ['a', 'b', 'c'],
      name: 'Zone',
    })) as { id: string; area_km2: number };
    expect(zone.area_km2).toBeGreaterThan(500);
    expect(runner.project().polygons).toEqual([
      { id: zone.id, name: 'Zone', pointIds: ['a', 'b', 'c'] },
    ]);
    expect(
      await runner.execute('find_points_in_area', { circle_ids: [], polygon_id: zone.id })
    ).toEqual({ count: 1, points: [{ id: 'inside', name: 'Inside' }] });
    const both = (await runner.execute('find_points_in_area', {
      circle_ids: ['ca', 'cb'],
      polygon_id: '',
    })) as { points: { id: string }[] };
    expect(both.points.map((p) => p.id)).toEqual(['inside']);
    const measured = (await runner.execute('measure_polygon', {
      point_ids: ['a', 'b', 'c'],
    })) as { perimeter_km: number };
    expect(measured.perimeter_km).toBeGreaterThan(150);
    await expect(
      runner.execute('create_polygon', { point_ids: ['a', 'a', 'b'], name: 'Bad' })
    ).rejects.toThrow('Duplicate');
  });

  it('computes bisector bearings inside the angle and polygon membership', () => {
    expect(bisectorBearing(90, 0)).toBe(45);
    expect(bisectorBearing(350, 10)).toBe(0);
    expect(
      isInsidePolygon({ lat: 1, lon: 1 }, [
        { lat: 0, lon: 0 },
        { lat: 0, lon: 2 },
        { lat: 2, lon: 2 },
        { lat: 2, lon: 0 },
      ])
    ).toBe(true);
  });

  it('reads elevations and exposes the highest sample as a location', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body)) as { lat: string; lon: string };
        const lats = body.lat.split('|').map(Number);
        const lons = body.lon.split('|').map(Number);
        return Response.json({
          elevations: lats.map((lat, i) => ({ lat, lon: lons[i], z: 100 + lons[i]! * 1000 })),
        });
      })
    );
    const runner = run();
    const elevations = (await runner.execute('get_elevations', { point_ids: ['a', 'b'] })) as {
      elevation_m: number;
    }[];
    expect(elevations.map((e) => e.elevation_m)).toEqual([2100, 2900]);
    const profile = (await runner.execute('elevation_profile', { line_id: 'ab' })) as {
      highest: { elevation_m: number; location_id: string };
      ascent_m: number;
    };
    expect(profile.highest.elevation_m).toBe(2900);
    expect(profile.ascent_m).toBe(800);
    await runner.execute('create_points', {
      points: [{ location_id: profile.highest.location_id, name: 'Summit', source_urls: [] }],
    });
    expect(runner.plan.points[0]!.coordinates.lon).toBeCloseTo(2.8, 4);
  });

  it('stages IGN routes and OpenStreetMap results without touching the project', async () => {
    const fetch = vi.fn(async (url: string) =>
      url.includes('itineraire')
        ? Response.json({
            geometry: {
              type: 'LineString',
              coordinates: [
                [2, 48],
                [2.4, 48.2],
                [2.8, 48],
              ],
            },
            distance: 70_000,
            duration: 50_000,
          })
        : Response.json({
            elements: [
              {
                type: 'node',
                lat: 48.01,
                lon: 2.01,
                tags: { name: 'Église Saint-Pierre', amenity: 'place_of_worship' },
              },
              {
                type: 'way',
                center: { lat: 48.2, lon: 2.1 },
                tags: { name: 'Chapelle', amenity: 'place_of_worship' },
              },
              {
                type: 'node',
                lat: 49,
                lon: 3,
                tags: { name: 'Hors zone', amenity: 'place_of_worship' },
              },
              { type: 'node', lat: 48, lon: 2, tags: { amenity: 'place_of_worship' } },
            ],
          })
    );
    vi.stubGlobal('fetch', fetch);
    const runner = run();
    expect(
      await runner.execute('create_route', {
        start_point_id: 'a',
        end_point_id: 'b',
        profile: 'pedestrian',
        optimization: 'shortest',
        name: 'Walk',
      })
    ).toMatchObject({ distance_km: 70, duration_minutes: 833, status: 'prepared' });
    expect(runner.plan.routes[0]).toMatchObject({ name: 'Walk', profile: 'pedestrian' });
    const found = (await runner.execute('search_osm', {
      tag_key: 'amenity',
      tag_value: 'place_of_worship',
      name_contains: 'eglise',
      area_type: 'circle',
      area_id: 'ca',
      radius_km: 0,
    })) as { count: number; results: { location_id: string; name: string }[] };
    expect(found.count).toBe(1);
    expect(found.results[0]!.name).toBe('Église Saint-Pierre');
    const query = String((fetch.mock.calls[1]![1] as RequestInit).body);
    expect(decodeURIComponent(query)).toContain(
      'nwr["amenity"="place_of_worship"]["name"](around:40000,48,2)'
    );
    await expect(
      runner.execute('search_osm', {
        tag_key: 'amenity"];out;',
        tag_value: '*',
        name_contains: '',
        area_type: 'point',
        area_id: 'a',
        radius_km: 2,
      })
    ).rejects.toThrow('Invalid OpenStreetMap tag key');
  });

  it('stages map control, colours, notes and export for the apply step', async () => {
    const runner = run();
    await runner.execute('create_midpoint', {
      first_point_id: 'a',
      second_point_id: 'b',
      name: 'M',
    });
    const created = runner.plan.points[0]!.id;
    await expect(
      runner.execute('set_color', { element_type: 'point', element_id: created, color: '#ff0000' })
    ).rejects.toThrow('fixed style');
    await runner.execute('create_line', {
      start_point_id: 'a',
      end_point_id: 'b',
      name: 'Red line',
    });
    await runner.execute('set_color', {
      element_type: 'lineSegment',
      element_id: runner.plan.lines[0]!.id,
      color: '#FF0000',
    });
    expect(runner.plan.lines[0]!.color).toBe('#ff0000');
    await runner.execute('set_color', {
      element_type: 'circle',
      element_id: 'ca',
      color: '#00ff00',
    });
    await runner.execute('set_visibility', {
      element_type: 'circle',
      element_id: 'tiny',
      visible: false,
    });
    await runner.execute('focus_element', { element_type: 'point', element_id: created });
    await runner.execute('add_note', {
      element_type: 'point',
      element_id: 'c',
      title: 'Clue',
      content: 'Second',
    });
    await runner.execute('add_note', {
      element_type: 'point',
      element_id: created,
      title: 'Why',
      content: 'Middle of AB',
    });
    await runner.execute('export_gpx', {});
    expect(runner.plan).toMatchObject({
      styles: [{ type: 'circle', id: 'ca', color: '#00ff00' }],
      visibility: [{ type: 'circle', id: 'tiny', visible: false }],
      effects: { focus: { type: 'point', id: created }, exportGpx: true },
      noteUpdates: [{ id: 'n', content: 'First\n\nSecond' }],
      notes: [{ linkedElementId: created, content: 'Middle of AB' }],
    });
    expect(planSize(runner.plan)).toBe(6);
    await expect(
      runner.execute('set_color', { element_type: 'circle', element_id: 'ca', color: 'red' })
    ).rejects.toThrow('#rrggbb');
  });
});

function stream(events: unknown[]) {
  const body = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('');
  // Split mid-event to exercise buffering across chunks.
  const chunks = [body.slice(0, 37), body.slice(37)];
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
        controller.close();
      },
    }),
    { headers: { 'content-type': 'text/event-stream' } }
  );
}

describe('streaming and attachments', () => {
  it('streams OpenAI text and keeps the completed response', async () => {
    const fetch = vi.fn(async () =>
      stream([
        { type: 'response.output_text.delta', delta: 'Bon' },
        { type: 'response.output_text.delta', delta: 'jour' },
        {
          type: 'response.completed',
          response: {
            status: 'completed',
            output: [{ type: 'message', content: [{ type: 'output_text', text: 'Bonjour' }] }],
          },
        },
      ])
    );
    vi.stubGlobal('fetch', fetch);
    const deltas: string[] = [];
    const turn = await getTurn(settings, 'system', [], [], new AbortController().signal, {
      onText: (delta) => deltas.push(delta),
    });
    expect(deltas).toEqual(['Bon', 'jour']);
    expect(turn.text).toBe('Bonjour');
    expect(
      JSON.parse(String((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body))
    ).toMatchObject({ stream: true });
  });

  it('rebuilds Anthropic tool calls and thinking signatures from stream events', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        stream([
          { type: 'message_start', message: { role: 'assistant', content: [] } },
          {
            type: 'content_block_start',
            index: 0,
            content_block: { type: 'thinking', thinking: '' },
          },
          {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'thinking_delta', thinking: 'Hmm' },
          },
          {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'signature_delta', signature: 'sig' },
          },
          { type: 'content_block_stop', index: 0 },
          { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
          {
            type: 'content_block_delta',
            index: 1,
            delta: { type: 'text_delta', text: 'Je mesure.' },
          },
          { type: 'content_block_stop', index: 1 },
          {
            type: 'content_block_start',
            index: 2,
            content_block: { type: 'tool_use', id: 't1', name: 'measure', input: {} },
          },
          {
            type: 'content_block_delta',
            index: 2,
            delta: { type: 'input_json_delta', partial_json: '{"start_point_id":' },
          },
          {
            type: 'content_block_delta',
            index: 2,
            delta: { type: 'input_json_delta', partial_json: '"a","end_point_id":"b"}' },
          },
          { type: 'content_block_stop', index: 2 },
          { type: 'message_delta', delta: { stop_reason: 'tool_use' } },
          { type: 'message_stop' },
        ])
      )
    );
    const turn = await getTurn(
      { ...settings, provider: 'anthropic', model: 'claude-sonnet-5-5' },
      'system',
      [],
      [],
      new AbortController().signal,
      { onText: () => {} }
    );
    expect(turn.text).toBe('Je mesure.');
    expect(turn.calls).toEqual([
      { id: 't1', name: 'measure', args: { start_point_id: 'a', end_point_id: 'b' } },
    ]);
    expect(turn.raw[0]).toEqual({ type: 'thinking', thinking: 'Hmm', signature: 'sig' });
  });

  it('rejects streams cut before their end marker instead of a truncated answer', async () => {
    const signal = new AbortController().signal;
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          stream([
            { type: 'message_start', message: { role: 'assistant', content: [] } },
            { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
            { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Half' } },
          ])
        )
        .mockResolvedValueOnce(
          stream([{ candidates: [{ content: { parts: [{ text: 'Half' }] } }] }])
        )
    );
    const anthropic = { ...settings, provider: 'anthropic' as const, model: 'claude-sonnet-5-5' };
    await expect(getTurn(anthropic, 's', [], [], signal, { onText: () => {} })).rejects.toThrow(
      'response'
    );
    const gemini = { ...settings, provider: 'gemini' as const, model: 'gemini-3-flash' };
    await expect(getTurn(gemini, 's', [], [], signal, { onText: () => {} })).rejects.toThrow(
      'response'
    );
  });

  it('concatenates Gemini stream parts and falls back to JSON bodies', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        stream([
          { candidates: [{ content: { parts: [{ text: 'Sal' }] } }] },
          {
            candidates: [
              {
                content: {
                  parts: [{ text: 'ut' }, { functionCall: { name: 'read_project', args: {} } }],
                },
                finishReason: 'STOP',
              },
            ],
          },
        ])
      )
      .mockResolvedValueOnce(
        Response.json({
          status: 'completed',
          output: [{ type: 'message', content: [{ type: 'output_text', text: 'JSON' }] }],
        })
      );
    vi.stubGlobal('fetch', fetch);
    const turn = await getTurn(
      { ...settings, provider: 'gemini', model: 'gemini-3-flash' },
      'system',
      [],
      [],
      new AbortController().signal,
      { onText: () => {} }
    );
    expect(String(fetch.mock.calls[0]![0])).toContain(':streamGenerateContent?alt=sse');
    expect(turn.text).toBe('Sal\nut');
    expect(turn.calls[0]!.name).toBe('read_project');
    const fallback = await getTurn(settings, 'system', [], [], new AbortController().signal, {
      onText: () => {},
    });
    expect(fallback.text).toBe('JSON');
  });

  it('formats image and PDF attachments for each provider', () => {
    const files = [
      { name: 'map.jpg', mimeType: 'image/jpeg', data: 'AAA' },
      { name: 'riddle.pdf', mimeType: 'application/pdf', data: 'BBB' },
    ];
    expect(userMessage('openai', 'Look', files)).toEqual({
      role: 'user',
      content: [
        { type: 'input_text', text: 'Look' },
        { type: 'input_image', image_url: 'data:image/jpeg;base64,AAA' },
        {
          type: 'input_file',
          filename: 'riddle.pdf',
          file_data: 'data:application/pdf;base64,BBB',
        },
      ],
    });
    expect(userMessage('anthropic', 'Look', files).content).toEqual([
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAA' } },
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'BBB' } },
      { type: 'text', text: 'Look' },
    ]);
    expect(userMessage('gemini', 'Look', files).parts).toEqual([
      { inlineData: { mimeType: 'image/jpeg', data: 'AAA' } },
      { inlineData: { mimeType: 'application/pdf', data: 'BBB' } },
      { text: 'Look' },
    ]);
    expect(userMessage('openai', 'Plain')).toEqual({ role: 'user', content: 'Plain' });
  });
});

describe('images in tool results, place photos and image memory', () => {
  const image = { name: 'Photo', mimeType: 'image/jpeg', data: 'QUJD' };
  const turn = { text: '', calls: [], sources: [], raw: [] };
  const call = { id: 'c1', name: 'get_place_photos', args: {} };

  it('shows tool images natively to every provider, keeping the JSON part', () => {
    const output = withImages({ photos: [{ point_name: 'A' }] }, [image]);
    const openai: Record<string, unknown>[] = [];
    appendResults('openai', openai, turn, [{ call, output }]);
    expect(openai[0]).toEqual({
      type: 'function_call_output',
      call_id: 'c1',
      output: [
        { type: 'input_text', text: '{"photos":[{"point_name":"A"}]}' },
        { type: 'input_image', image_url: 'data:image/jpeg;base64,QUJD' },
      ],
    });
    const anthropic: Record<string, unknown>[] = [];
    appendResults('anthropic', anthropic, turn, [{ call, output }]);
    expect((anthropic[1]!.content as unknown[])[0]).toMatchObject({
      type: 'tool_result',
      content: [
        { type: 'text', text: '{"photos":[{"point_name":"A"}]}' },
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'QUJD' } },
      ],
    });
    const gemini: Record<string, unknown>[] = [];
    appendResults('gemini', gemini, turn, [{ call, output }]);
    expect(gemini[1]!.parts).toEqual([
      { functionResponse: { name: 'get_place_photos', response: { result: output } } },
      { inlineData: { mimeType: 'image/jpeg', data: 'QUJD' } },
    ]);
    const plain: Record<string, unknown>[] = [];
    appendResults('openai', plain, turn, [{ call, output: { ok: true } }]);
    expect(plain[0]!.output).toBe('{"ok":true}');
  });

  function wikimedia(bindings: unknown[], geosearch: unknown[] = []) {
    const fetch = vi.fn(async (url: string) => {
      if (url.startsWith('https://query.wikidata.org'))
        return Response.json({ results: { bindings } });
      if (url.includes('list=geosearch')) return Response.json({ query: { geosearch } });
      if (url.includes('prop=imageinfo')) {
        const file = new URL(url).searchParams.get('titles')!;
        return Response.json({
          query: {
            pages: {
              1: {
                imageinfo: [
                  {
                    thumburl: `https://upload.example/${encodeURIComponent(file)}`,
                    descriptionurl: `https://commons.wikimedia.org/wiki/${file}`,
                  },
                ],
              },
            },
          },
        });
      }
      return new Response(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }));
    });
    vi.stubGlobal('fetch', fetch);
    return fetch;
  }
  const binding = (label: string, file: string, dist: string) => ({
    itemLabel: { value: label },
    image: {
      value: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}`,
    },
    dist: { value: dist },
  });

  it('picks the photo whose name matches the point, not the nearest building', async () => {
    wikimedia([
      binding('hôtel de ville de Melun', 'Melun Hotel de Ville.JPG', '0.071'),
      binding('église Saint-Aspais', 'Melun st aspais.JPG', '0.086'),
    ]);
    const runner = createAssistantExecutor(
      {
        name: 'Hunt',
        points: [
          { id: 'church', name: 'Église Saint-Aspais', coordinates: { lat: 48.539, lon: 2.66 } },
          { id: 'void', name: 'Nowhere', coordinates: { lat: 0, lon: 0 } },
        ],
        lines: [],
        circles: [],
      },
      settings,
      new AbortController().signal
    );
    // Nothing named like "Nowhere" around the second point, and no Commons photo either.
    const output = (await runner.execute('get_place_photos', {
      point_ids: ['church', 'void'],
    })) as {
      photos: { point_id: string; shows: string; source: string; distance_m: number }[];
      missing: { point_id: string }[];
    };
    expect(output.photos).toEqual([
      {
        image_index: 1,
        point_id: 'church',
        point_name: 'Église Saint-Aspais',
        shows: 'église Saint-Aspais',
        source: 'wikidata',
        distance_m: 86,
      },
    ]);
    expect(output.missing).toEqual([{ point_id: 'void', point_name: 'Nowhere' }]);
    const sent: Record<string, unknown>[] = [];
    appendResults('openai', sent, turn, [{ call, output }]);
    expect((sent[0]!.output as { type: string; image_url?: string }[])[1]).toEqual({
      type: 'input_image',
      image_url: 'data:image/jpeg;base64,AQID',
    });
    expect(runner.plan.sources).toEqual([
      {
        title: 'Photo : église Saint-Aspais',
        url: 'https://commons.wikimedia.org/wiki/File:Melun st aspais.JPG',
      },
    ]);
  });

  it('does not match another building through the town name alone', async () => {
    wikimedia(
      [
        binding('couvent des Récollets de Melun', 'Recollets.jpg', '0.177'),
        binding('hôtel de ville de Melun', 'Hotel.JPG', '0.2'),
        binding('gare de Melun', 'Gare.jpg', '0.25'),
      ],
      [{ title: 'File:Rue près du temple.jpg', dist: 20 }]
    );
    const runner = createAssistantExecutor(
      {
        name: 'Hunt',
        points: [
          { id: 'p', name: 'Église Pentecôtiste de Melun', coordinates: { lat: 48, lon: 2 } },
        ],
        lines: [],
        circles: [],
      },
      settings,
      new AbortController().signal
    );
    expect(await runner.execute('get_place_photos', { point_ids: ['p'] })).toMatchObject({
      photos: [{ shows: 'Rue près du temple', source: 'commons_nearby' }],
    });
  });

  it('falls back to a Commons photo taken near the point', async () => {
    wikimedia(
      [binding('hôtel de ville', 'Hotel.JPG', '0.05')],
      [{ title: 'File:Chapelle du hameau.jpg', dist: 42 }]
    );
    const runner = createAssistantExecutor(
      {
        name: 'Hunt',
        points: [{ id: 'p', name: 'Chapelle Sainte-Anne', coordinates: { lat: 48, lon: 2 } }],
        lines: [],
        circles: [],
      },
      settings,
      new AbortController().signal
    );
    expect(await runner.execute('get_place_photos', { point_ids: ['p'] })).toMatchObject({
      photos: [{ shows: 'Chapelle du hameau', source: 'commons_nearby', distance_m: 42 }],
      missing: [],
    });
  });

  it('sends earlier attachments again, marked as earlier, with the new request', async () => {
    const fetch = vi.fn(async () =>
      Response.json({
        status: 'completed',
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'Same church.' }] }],
      })
    );
    vi.stubGlobal('fetch', fetch);
    await runAssistant({
      settings,
      context: { name: 'Hunt', points: [], lines: [], circles: [] },
      prompt: 'Which church is it?',
      conversation: [{ role: 'user', text: 'Here is the photo' }],
      locale: 'fr',
      signal: new AbortController().signal,
      onActivity: () => {},
      earlierAttachments: [{ name: 'Image collée.png', mimeType: 'image/png', data: 'UE5H' }],
    });
    const body = JSON.parse(
      String((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body)
    );
    expect(body.input.at(-1).content).toEqual([
      {
        type: 'input_text',
        text: 'Which church is it?\n\n[Attached earlier in this conversation: Image collée.png]',
      },
      { type: 'input_image', image_url: 'data:image/png;base64,UE5H' },
    ]);
  });
});
