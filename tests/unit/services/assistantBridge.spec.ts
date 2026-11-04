import type { ProjectContext } from '@/services/assistant/plan';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAssistantExecutor } from '@/services/assistant/agent';
import {
  bridgeError,
  bridgeResult,
  bridgeTools,
  CAPTURE_MAP,
  REDO,
  UNDO,
  uniqueReferences,
} from '@/services/assistant/bridge';
import { createToolMemory } from '@/services/assistant/context';
import { searchAssistantPlaces } from '@/services/assistant/geocoding';
import { LIMITS } from '@/services/assistant/limits';
import { searchOsmPlaces } from '@/services/assistant/osm';
import { planSize } from '@/services/assistant/plan';
import { withImages } from '@/services/assistant/providers';

vi.mock('@/services/assistant/geocoding', () => ({ searchAssistantPlaces: vi.fn() }));
const settings = { provider: 'openai' as const, apiKey: '', model: '', effort: 'auto' };
function project(): ProjectContext {
  return {
    name: 'Bridge',
    projection: 'mercator',
    points: [],
    circles: [],
    lines: [],
    polygons: [],
    routes: [],
    notes: [],
    images: [],
  };
}
function call(memory: ReturnType<typeof createToolMemory>) {
  return createAssistantExecutor(project(), settings, new AbortController().signal, [], memory);
}

describe('Claude bridge', () => {
  it('offers the assistant tools except those tied to the in-app chat, plus a map capture', () => {
    const names = bridgeTools().map((tool) => tool.name);
    expect(names).toContain('search_places');
    expect(names).toContain('create_points');
    expect(names).toContain(CAPTURE_MAP);
    expect(names).not.toContain('research_places');
    expect(names).not.toContain('choose_elements');
  });

  it('keeps location IDs from one call to the next', async () => {
    vi.mocked(searchAssistantPlaces).mockResolvedValue([
      { main: 'Fontainebleau', coordinates: { lat: 48.404, lon: 2.701 } },
    ] as Awaited<ReturnType<typeof searchAssistantPlaces>>);
    const memory = createToolMemory('test');
    const [found] = (await call(memory).execute('search_places', { query: 'Fontainebleau' })) as {
      location_id: string;
    }[];

    const executor = call(memory);
    await executor.execute('create_points', {
      points: [{ location_id: found!.location_id, name: 'Château', source_urls: [] }],
    });
    expect(executor.plan.points).toHaveLength(1);
    expect(executor.plan.points[0]!.coordinates).toEqual({ lat: 48.404, lon: 2.701 });
  });

  it('forgets the oldest places instead of failing when its memory is full', async () => {
    vi.mocked(searchAssistantPlaces).mockResolvedValue([
      { main: 'Chambord', coordinates: { lat: 47.616, lon: 1.517 } },
    ] as Awaited<ReturnType<typeof searchAssistantPlaces>>);
    const full = (session?: string) => {
      const memory = createToolMemory(session);
      for (let i = 1; i <= LIMITS.locations; i++)
        memory.locations.set(`place-${i}`, { lat: 0, lon: 0, label: '' });
      memory.lastLocation = LIMITS.locations;
      return memory;
    };

    const rolling = full('test');
    const [found] = (await call(rolling).execute('search_places', { query: 'Chambord' })) as {
      location_id: string;
    }[];
    expect(found!.location_id).toBe(`place-test-${LIMITS.locations + 1}`);
    expect(rolling.locations.has('place-1')).toBe(false);
    expect(rolling.locations.size).toBe(LIMITS.locations);
    // A chat request keeps its hard limit.
    await expect(call(full()).execute('search_places', { query: 'Chambord' })).rejects.toThrow();
  });

  it('reports what a call applied, and passes images through', () => {
    const output = withImages({ map: 'bounds' }, [
      { name: 'map.jpg', mimeType: 'image/jpeg', data: 'abc' },
    ]);
    const result = bridgeResult('1', output);
    expect(result).toMatchObject({ id: '1', isError: false, text: '{"map":"bounds"}' });
    expect(result.images).toEqual([{ mimeType: 'image/jpeg', data: 'abc' }]);
    expect(bridgeError('2', 'No project')).toMatchObject({ isError: true, text: 'No project' });
  });

  it('lists the elements a writing call applied to the map', async () => {
    vi.mocked(searchAssistantPlaces).mockResolvedValue([
      { main: 'Blois', coordinates: { lat: 47.586, lon: 1.335 } },
    ] as Awaited<ReturnType<typeof searchAssistantPlaces>>);
    const memory = createToolMemory('test');
    const [found] = (await call(memory).execute('search_places', { query: 'Blois' })) as {
      location_id: string;
    }[];
    const executor = call(memory);
    const output = await executor.execute('create_points', {
      points: [{ location_id: found!.location_id, name: 'Blois', source_urls: [] }],
    });
    const text = JSON.parse(bridgeResult('3', output, executor.plan).text);
    expect(text.applied_to_map).toEqual({
      created: [{ type: 'point', id: executor.plan.points[0]!.id, name: 'Blois' }],
      updated: [],
      deleted: [],
    });
  });

  it('reports deletions, which a tool output only calls prepared', async () => {
    const executor = createAssistantExecutor(
      { ...project(), points: [{ id: 'p', name: 'Old', coordinates: { lat: 48, lon: 2 } }] },
      settings,
      new AbortController().signal,
      [],
      createToolMemory('test')
    );
    const output = await executor.execute('delete_element', {
      element_type: 'point',
      element_id: 'p',
    });
    const text = JSON.parse(bridgeResult('4', output, executor.plan).text);
    expect(text.applied_to_map.deleted).toEqual([{ type: 'point', id: 'p', name: 'Old' }]);
  });

  it('keeps each recent element once, at its latest position', () => {
    const ref = (id: string, name = id) => ({ type: 'point' as const, id, name });
    expect(uniqueReferences([ref('a'), ref('b'), ref('a', 'renamed')])).toEqual([
      ref('b'),
      ref('a', 'renamed'),
    ]);
    expect(uniqueReferences([ref('a'), ref('b'), ref('c')], 2)).toEqual([ref('b'), ref('c')]);
  });

  it('refuses a location ID from an earlier session instead of reusing it', async () => {
    vi.mocked(searchAssistantPlaces).mockResolvedValue([
      { main: 'Tours', coordinates: { lat: 47.39, lon: 0.69 } },
    ] as Awaited<ReturnType<typeof searchAssistantPlaces>>);
    const search = async (memory: ReturnType<typeof createToolMemory>) => {
      const [found] = (await call(memory).execute('search_places', { query: 'Tours' })) as {
        location_id: string;
      }[];
      return found!.location_id;
    };
    const earlier = await search(createToolMemory('first'));
    const memory = createToolMemory('second');
    await search(memory);

    await expect(
      call(memory).execute('create_points', {
        points: [{ location_id: earlier, name: 'Tours', source_urls: [] }],
      })
    ).rejects.toThrow(/reloads/);
  });

  it('describes tools as they behave here, not as in the chat', () => {
    const tools = bridgeTools();
    for (const tool of tools)
      expect(JSON.stringify(tool)).not.toMatch(
        /prepar|preview|confirmation|research_places|once the request|apply after|attached image/i
      );
    expect(tools.map((tool) => tool.name)).not.toContain('delete_element');
    expect(tools.map((tool) => tool.name)).toEqual(expect.arrayContaining([UNDO, REDO]));
  });

  it('accepts source URLs from Claude, but not from the chat', async () => {
    vi.mocked(searchAssistantPlaces).mockResolvedValue([
      { main: 'Roncevaux', coordinates: { lat: 43, lon: -1.3 } },
    ] as Awaited<ReturnType<typeof searchAssistantPlaces>>);
    const create = async (memory: ReturnType<typeof createToolMemory>) => {
      const [found] = (await call(memory).execute('search_places', { query: 'Roncevaux' })) as {
        location_id: string;
      }[];
      const executor = call(memory);
      await executor.execute('create_points', {
        points: [
          {
            location_id: found!.location_id,
            name: 'Roncevaux',
            source_urls: ['https://example.org/roncevaux'],
          },
        ],
      });
      return executor.plan;
    };
    expect((await create(createToolMemory('test'))).notes[0]!.content).toContain(
      'https://example.org/roncevaux'
    );
    await expect(create(createToolMemory())).rejects.toThrow(/research_places/);
  });
});

describe('tool results', () => {
  it('reports done work, not work staged for the chat', () => {
    const parsed = (output: unknown) => JSON.parse(bridgeResult('1', output).text);
    expect(parsed({ status: 'update_prepared' })).toEqual({ status: 'updated' });
    expect(parsed({ status: 'will_focus' })).toEqual({ status: 'focused' });
    expect(parsed([{ id: 'a', status: 'prepared' }])).toEqual([{ id: 'a', status: 'created' }]);
    expect(parsed({ status: 'already_exists' })).toEqual({ status: 'already_exists' });
    expect(parsed({ status: 'prepared_provisionally' })).toEqual({ status: 'created' });
  });
});

describe('every kind of element', () => {
  const start = { lat: 48, lon: 2 };
  const image = {
    id: 'i',
    name: 'Calque',
    assetId: 'asset',
    center: start,
    width: 1000,
    height: 1000,
    rotation: 0,
    opacity: 1,
    keepAspectRatio: true,
  };
  const context = (): ProjectContext => ({
    ...project(),
    points: [{ id: 'p', name: 'P', coordinates: start }],
    polygons: [{ id: 'z', name: 'Z', pointIds: [] }],
    routes: [
      { id: 'r', name: 'R', start, end: start, profile: 'car', coordinates: [], distance: 1000 },
    ] as unknown as ProjectContext['routes'],
    notes: [
      { id: 'n', title: 'Free', content: '' },
      {
        id: 'linked',
        title: 'On point',
        content: '',
        linkedElementType: 'point',
        linkedElementId: 'p',
      },
    ],
    images: [image] as unknown as ProjectContext['images'],
  });
  const runner = () =>
    createAssistantExecutor(
      context(),
      settings,
      new AbortController().signal,
      [],
      createToolMemory('test')
    );

  it.each([
    ['polygon', 'z', 'polygons'],
    ['route', 'r', 'routes'],
    ['image', 'i', 'overlays'],
  ] as const)('renames a %s', async (element_type, element_id, list) => {
    const executor = runner();
    const output = await executor.execute('rename_element', {
      element_type,
      element_id,
      name: 'Nouveau',
    });
    const text = JSON.parse(bridgeResult('1', output, executor.plan).text);
    expect(text.applied_to_map.updated).toEqual([
      { type: element_type, id: element_id, name: 'Nouveau' },
    ]);
    const items = executor.project()[list] as { name: string }[];
    expect(items[0]!.name).toBe('Nouveau');
  });

  it('renames a note through its title', async () => {
    const executor = runner();
    await executor.execute('rename_element', {
      element_type: 'note',
      element_id: 'n',
      name: 'Titre',
    });
    expect(executor.project().notes[0]!.title).toBe('Titre');
  });

  it('deletes an image overlay', async () => {
    const executor = runner();
    await executor.execute('delete_elements', {
      elements: [{ element_type: 'image', element_id: 'i' }],
    });
    expect(executor.plan.removals).toEqual([{ type: 'image', id: 'i', name: 'Calque' }]);
    expect(executor.project().overlays).toEqual([]);
  });

  it('hides notes and overlays', async () => {
    const executor = runner();
    for (const [element_type, element_id] of [
      ['note', 'n'],
      ['image', 'i'],
    ]) {
      const output = await executor.execute('set_visibility', {
        element_type,
        element_id,
        visible: false,
      });
      expect(JSON.parse(bridgeResult('1', output).text)).toEqual({ status: 'updated' });
    }
    expect(executor.plan.visibility).toEqual([
      { type: 'note', id: 'n', visible: false },
      { type: 'image', id: 'i', visible: false },
    ]);
  });

  it('focuses an overlay, and a note through its element', async () => {
    const focus = async (element_type: string, element_id: string) => {
      const executor = runner();
      await executor.execute('focus_element', { element_type, element_id });
      return executor.plan.effects.focus;
    };
    await expect(focus('image', 'i')).resolves.toEqual({ type: 'image', id: 'i' });
    await expect(focus('note', 'linked')).resolves.toEqual({ type: 'point', id: 'p' });
    await expect(focus('note', 'n')).rejects.toThrow(/not attached/);
  });

  it('attaches a note to an overlay', async () => {
    const executor = runner();
    await executor.execute('add_note', {
      element_type: 'image',
      element_id: 'i',
      title: 'Source',
      content: 'Carte de 1872',
    });
    expect(executor.plan.notes[0]).toMatchObject({
      linkedElementType: 'image',
      linkedElementId: 'i',
    });
  });
});

describe('list_elements', () => {
  const many = (count: number): ProjectContext => ({
    ...project(),
    points: Array.from({ length: count }, (_, i) => ({
      id: `p${i}`,
      name: `P${i}`,
      coordinates: { lat: 48, lon: i / 1000 },
    })),
  });
  const runner = (count: number) =>
    createAssistantExecutor(many(count), settings, new AbortController().signal);

  it('reaches what read_project leaves out', async () => {
    const executor = runner(250);
    expect(executor.project()).toMatchObject({ truncated: true, totals: { point: 250 } });
    expect(executor.project().points).toHaveLength(200);

    const list = (offset: number) =>
      executor.execute('list_elements', { element_type: 'point', offset, limit: 200 }) as Promise<{
        items: { id: string }[];
        next_offset: number | null;
        total: number;
      }>;
    const first = await list(0);
    expect(first).toMatchObject({ total: 250, next_offset: 200 });
    expect(first.items[0]!.id).toBe('p0');
    const second = await list(200);
    expect(second.items).toHaveLength(50);
    expect(second.next_offset).toBeNull();
  });

  it('rejects an unknown type and an oversized page', async () => {
    const executor = runner(1);
    await expect(
      executor.execute('list_elements', { element_type: 'nope', offset: 0, limit: 10 })
    ).rejects.toThrow('Unknown element type');
    await expect(
      executor.execute('list_elements', { element_type: 'point', offset: 0, limit: 500 })
    ).rejects.toThrow();
  });
});

describe('delete_elements', () => {
  const start = { lat: 48, lon: 2 };
  const end = { lat: 48, lon: 3 };
  const line = { id: 'l', name: 'L', mode: 'coordinate', center: start, endpoint: end };
  const context = (): ProjectContext => ({
    ...project(),
    points: [
      { id: 'a', name: 'A', coordinates: start },
      { id: 'b', name: 'B', coordinates: end },
      { id: 'c', name: 'C', coordinates: { lat: 48.5, lon: 2.5 } },
      { id: 'on', name: 'On', coordinates: start, construction: { lineId: 'l', fraction: 0 } },
    ],
    lines: [line as ProjectContext['lines'][number]],
    circles: [{ id: 'k', name: 'K', center: start, radius: 5 }],
    polygons: [{ id: 'z', name: 'Z', pointIds: ['a', 'b', 'c'] }],
    routes: [
      {
        id: 'r',
        name: 'R',
        start,
        end,
        profile: 'car',
        coordinates: [],
        distance: 1000,
      } as unknown as NonNullable<ProjectContext['routes']>[number],
    ],
    notes: [{ id: 'n', title: 'N', content: '' }],
  });
  const run = (elements: unknown[], memory = createToolMemory('test')) => {
    const executor = createAssistantExecutor(
      context(),
      settings,
      new AbortController().signal,
      [],
      memory
    );
    return { executor, result: executor.execute('delete_elements', { elements }) };
  };
  const target = (element_type: string, element_id: string) => ({ element_type, element_id });

  it('deletes every kind of element in one call', async () => {
    const { executor, result } = run([
      target('circle', 'k'),
      target('polygon', 'z'),
      target('route', 'r'),
      target('note', 'n'),
      target('point', 'c'),
    ]);
    const output = await result;
    expect(output).toEqual({ status: 'deleted', count: 5 });
    const text = JSON.parse(bridgeResult('1', output, executor.plan).text);
    expect(text.applied_to_map.deleted.map((item: { id: string }) => item.id).toSorted()).toEqual([
      'c',
      'k',
      'n',
      'r',
      'z',
    ]);
    expect(executor.project()).toMatchObject({ polygons: [], routes: [], notes: [], circles: [] });
  });

  it('allows a used element only if what uses it goes too, and stages nothing otherwise', async () => {
    const blocked = run([target('circle', 'k'), target('point', 'a')]);
    await expect(blocked.result).rejects.toThrow(/polygon Z/);
    expect(planSize(blocked.executor.plan)).toBe(0);

    await expect(run([target('lineSegment', 'l')]).result).rejects.toThrow(/point On/);
    await expect(
      run([target('lineSegment', 'l'), target('point', 'on')]).result
    ).resolves.toMatchObject({ count: 2 });
    await expect(run([target('point', 'a'), target('polygon', 'z')]).result).resolves.toMatchObject(
      { count: 2 }
    );
  });

  it('rejects unknown, duplicate and empty lists', async () => {
    await expect(run([target('route', 'nope')]).result).rejects.toThrow(/Unknown route/);
    await expect(run([target('note', 'n'), target('note', 'n')]).result).rejects.toThrow(
      /Duplicate/
    );
    await expect(run([]).result).rejects.toThrow(/between 1/);
  });

  it('is not available to the in-app chat', async () => {
    await expect(run([target('note', 'n')], createToolMemory()).result).rejects.toThrow(
      'Unknown tool'
    );
  });
});

describe('lines and distances', () => {
  const start = { lat: 48, lon: 2 };
  const end = { lat: 48, lon: 3 };
  const context = (): ProjectContext => ({
    ...project(),
    points: [
      { id: 'above', name: 'Above', coordinates: { lat: 48.2, lon: 2.5 } },
      { id: 'beyond', name: 'Beyond', coordinates: { lat: 48.2, lon: 3.5 } },
      { id: 'on', name: 'On', coordinates: { lat: 48, lon: 2.5 } },
    ],
    lines: [
      { id: 'l', name: 'L', mode: 'coordinate', center: start, endpoint: end },
    ] as ProjectContext['lines'],
  });
  const executor = () =>
    createAssistantExecutor(
      context(),
      settings,
      new AbortController().signal,
      [],
      createToolMemory('test')
    );

  it('measures a line that has no point at its ends', async () => {
    const result = (await executor().execute('measure_line', { line_id: 'l' })) as {
      length_km: number;
      bearing_degrees: number;
    };
    expect(result.length_km).toBeCloseTo(74.4, 0);
    expect(Math.abs(result.bearing_degrees - 90)).toBeLessThan(1);
  });

  it('measures the distance from a point to a line', async () => {
    const inside = (await executor().execute('measure_point_to_line', {
      point_id: 'above',
      line_id: 'l',
    })) as { distance_km: number; foot_on_line: boolean; lon: number };
    expect(inside.distance_km).toBeCloseTo(22.2, 0);
    expect(inside.foot_on_line).toBe(true);
    expect(inside.lon).toBeCloseTo(2.5, 2);

    const outside = (await executor().execute('measure_point_to_line', {
      point_id: 'beyond',
      line_id: 'l',
    })) as { foot_on_line: boolean };
    expect(outside.foot_on_line).toBe(false);
  });

  it('drops a perpendicular from a point outside the line', async () => {
    const runner = executor();
    const result = (await runner.execute('create_perpendicular_from_point', {
      point_id: 'above',
      line_id: 'l',
      name: 'Perp',
      foot_name: 'Foot',
    })) as { foot_point_id: string; distance_km: number };
    const foot = runner.plan.points.find((point) => point.id === result.foot_point_id)!;
    expect(foot.construction?.lineId).toBe('l');
    expect(foot.coordinates.lon).toBeCloseTo(2.5, 2);
    expect(result.distance_km).toBeCloseTo(22.2, 0);
    expect(runner.plan.lines[0]).toMatchObject({ name: 'Perp', startPointId: 'above' });
  });

  it('refuses a foot beyond the line, and a point already on it', async () => {
    const drop = (point_id: string) =>
      executor().execute('create_perpendicular_from_point', {
        point_id,
        line_id: 'l',
        name: 'Perp',
        foot_name: 'Foot',
      });
    await expect(drop('beyond')).rejects.toThrow(/extend_line/);
    await expect(drop('on')).rejects.toThrow(/create_perpendicular/);
  });
});

describe('OpenStreetMap failures', () => {
  const options = { key: 'historic', value: '*', center: { lat: 48, lon: 2 }, radiusKm: 5 };
  const answer = (body: unknown, status = 200) => Promise.resolve(Response.json(body, { status }));
  const signal = new AbortController().signal;
  const element = { type: 'node', lat: 48, lon: 2, tags: { name: 'Croix', historic: 'cross' } };
  const remark = 'runtime error: Query timed out in "query" at line 1 after 21 seconds.';

  afterEach(() => vi.unstubAllGlobals());

  it('returns complete results when a later server completes the search', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementationOnce(() => answer({ elements: [], remark }))
        .mockImplementation(() => answer({ elements: [element] }))
    );
    await expect(searchOsmPlaces(options, signal)).resolves.toMatchObject({
      partial: false,
      places: [{ name: 'Croix' }],
    });
  });

  it('flags results cut short by the time limit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => answer({ elements: [element], remark }))
    );
    await expect(searchOsmPlaces(options, signal)).resolves.toMatchObject({ partial: true });
  });

  it('tells a search that is too broad from busy or unreachable servers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => answer({ elements: [], remark }))
    );
    await expect(searchOsmPlaces(options, signal)).rejects.toThrow(/too broad/);

    vi.stubGlobal(
      'fetch',
      vi.fn(() => answer({}, 429))
    );
    await expect(searchOsmPlaces(options, signal)).rejects.toThrow(/busy/);

    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('network')))
    );
    await expect(searchOsmPlaces(options, signal)).rejects.toThrow(/did not answer/);
  });
});
