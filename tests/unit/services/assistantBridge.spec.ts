import type { ProjectContext } from '@/services/assistant/plan';
import { describe, expect, it, vi } from 'vitest';
import { createAssistantExecutor } from '@/services/assistant/agent';
import {
  bridgeError,
  bridgeResult,
  bridgeTools,
  CAPTURE_MAP,
  uniqueReferences,
} from '@/services/assistant/bridge';
import { createToolMemory } from '@/services/assistant/context';
import { searchAssistantPlaces } from '@/services/assistant/geocoding';
import { LIMITS } from '@/services/assistant/limits';
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
    const memory = createToolMemory(true);
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
    const full = (rolling: boolean) => {
      const memory = createToolMemory(rolling);
      for (let i = 1; i <= LIMITS.locations; i++)
        memory.locations.set(`place-${i}`, { lat: 0, lon: 0, label: '' });
      memory.lastLocation = LIMITS.locations;
      return memory;
    };

    const rolling = full(true);
    const [found] = (await call(rolling).execute('search_places', { query: 'Chambord' })) as {
      location_id: string;
    }[];
    expect(found!.location_id).toBe(`place-${LIMITS.locations + 1}`);
    expect(rolling.locations.has('place-1')).toBe(false);
    expect(rolling.locations.size).toBe(LIMITS.locations);
    // A chat request keeps its hard limit.
    await expect(
      call(full(false)).execute('search_places', { query: 'Chambord' })
    ).rejects.toThrow();
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
    const memory = createToolMemory(true);
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
      createToolMemory(true)
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
});
