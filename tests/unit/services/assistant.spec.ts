import type { ProjectContext } from '@/services/assistant/plan';
import { fromLonLat } from 'ol/proj';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAssistantExecutor, runAssistant } from '@/services/assistant/agent';
import { searchAssistantPlaces } from '@/services/assistant/geocoding';
import {
  appendResults,
  detectProvider,
  effortOptions,
  listModels,
  parseTurn,
  safeSource,
} from '@/services/assistant/providers';
import { createProjectGeometry } from '@/services/projectGeometry';

vi.mock('@/services/assistant/geocoding', () => ({ searchAssistantPlaces: vi.fn() }));
const settings = {
  provider: 'openai' as const,
  apiKey: 'test-secret',
  model: 'gpt-4.1-mini',
  effort: 'auto',
};
const context = { name: 'Test', points: [], circles: [], lines: [] };
beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.mocked(searchAssistantPlaces).mockResolvedValue([
    { main: 'Fontainebleau, Seine-et-Marne', coordinates: { lat: 48.4, lon: 2.7 } },
  ]);
});

describe('assistant providers', () => {
  it('only detects distinctive key prefixes', () => {
    expect(detectProvider('sk-ant-test')).toBe('anthropic');
    expect(detectProvider('AIza-test')).toBe('gemini');
    expect(detectProvider(' sk-proj-test ')).toBe('openai');
    expect(detectProvider('sk-ambiguous')).toBeNull();
    expect(detectProvider('sk-or-v1-foreign')).toBeNull();
  });
  it('only offers effort options for supported model families', () => {
    expect(effortOptions('openai', 'gpt-4.1-mini')).toEqual(['auto']);
    expect(effortOptions('openai', 'gpt-5-mini')).toContain('high');
    expect(effortOptions('gemini', 'gemini-3-pro-preview')).not.toContain('medium');
    expect(effortOptions('anthropic', 'claude-haiku-4-5')).toEqual(['auto']);
    expect(effortOptions('anthropic', 'claude-haiku-5-5')).toContain('high');
  });
  it('rejects executable and credential-bearing citation URLs', () => {
    expect(safeSource('javascript:alert(1)')).toBeNull();
    expect(safeSource('https://user:secret@example.org')).toBeNull();
    expect(safeSource('https://example.org/source', 'Source')?.title).toBe('Source');
  });
  it('retains reasoning and Gemini signatures across tool calls', () => {
    const turn = parseTurn('openai', {
      output: [
        { type: 'reasoning', id: 'reasoning1', summary: [] },
        { type: 'function_call', call_id: 'call1', name: 'read_project', arguments: '{}' },
      ],
    });
    const history: Record<string, unknown>[] = [];
    appendResults('openai', history, turn, [{ call: turn.calls[0]!, output: { points: [] } }]);
    expect(history[0]).toEqual(turn.raw[0]);
    expect(history[2]).toMatchObject({ type: 'function_call_output', call_id: 'call1' });
    const gemini = parseTurn('gemini', {
      candidates: [
        {
          content: {
            parts: [
              { thoughtSignature: 'signature', functionCall: { name: 'read_project', args: {} } },
            ],
          },
          finishReason: 'STOP',
        },
      ],
    });
    const geminiHistory: Record<string, unknown>[] = [];
    appendResults('gemini', geminiHistory, gemini, [{ call: gemini.calls[0]!, output: {} }]);
    expect(geminiHistory[0]).toEqual({ role: 'model', parts: gemini.raw });
  });
  it('fails closed on truncated output and malformed function arguments', () => {
    expect(() => parseTurn('openai', { status: 'incomplete', output: [] })).toThrow();
    expect(() =>
      parseTurn('openai', { output: [{ type: 'function_call', arguments: 'broken' }] })
    ).toThrow();
    expect(() => parseTurn('anthropic', { stop_reason: 'max_tokens', content: [] })).toThrow();
    expect(() => parseTurn('gemini', { candidates: [{ finishReason: 'MAX_TOKENS' }] })).toThrow();
  });
  it('uses the live catalogue, keeps new text models and excludes retired/specialized models', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-01T12:00:00Z'));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          data: [
            { id: 'gpt-4o', created: 10, shutdown_date: null },
            { id: 'gpt-7-mini', created: 30 },
            { id: 'gpt-5.4-pro', created: 20 },
            { id: 'gpt-5.3-codex', created: 20 },
            { id: 'gpt-5-mini', shutdown_date: '2026-12-11' },
            { id: 'o4-mini', shutdown_date: '2026-10-23' },
            { id: 'gpt-4.1-nano', shutdown_date: '2026-11-01' },
            { id: 'gpt-4o-mini-tts' },
            { id: 'gpt-3.5-turbo' },
            { id: 'text-embedding-3-small' },
            { id: 'gpt-5-search-api' },
            { id: null },
          ],
        })
      )
    );
    expect(await listModels(settings, new AbortController().signal)).toEqual([
      'gpt-7-mini',
      'gpt-5.4-pro',
      'gpt-5.3-codex',
      'gpt-4o',
      'gpt-5-mini',
    ]);
  });
  it('loads every Anthropic page and removes retired models without guessing version names', async () => {
    let page = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => {
        page++;
        return Response.json({
          data: [
            { id: `claude-future-${page}`, lifecycle: 'active' },
            { id: 'claude-old', lifecycle: 'retired' },
          ],
          has_more: page < 11,
          last_id: `cursor-${page}`,
        });
      })
    );
    const models = await listModels(
      { ...settings, provider: 'anthropic' },
      new AbortController().signal
    );
    expect(models).toHaveLength(11);
    expect(models).not.toContain('claude-old');
    expect(fetch).toHaveBeenLastCalledWith(
      'https://api.anthropic.com/v1/models?limit=100&after_id=cursor-10',
      expect.anything()
    );
  });
  it('uses Gemini generation metadata and follows encoded page tokens', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({
            models: [
              { name: 'models/gemini-next-flash', supportedGenerationMethods: ['generateContent'] },
              { name: 'models/gemini-embedding', supportedGenerationMethods: ['embedContent'] },
            ],
            nextPageToken: 'next/page',
          })
        )
        .mockResolvedValueOnce(
          Response.json({
            models: [
              { name: 'models/gemini-next-pro', supportedGenerationMethods: ['generateContent'] },
              { name: 'models/gemini-next-flash', supportedGenerationMethods: ['generateContent'] },
              { name: 'models/gemini-image', supportedGenerationMethods: ['generateContent'] },
            ],
          })
        )
    );
    expect(
      await listModels({ ...settings, provider: 'gemini' }, new AbortController().signal)
    ).toEqual(['gemini-next-pro', 'gemini-next-flash']);
    expect(fetch).toHaveBeenLastCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models?pageSize=100&pageToken=next%2Fpage',
      expect.anything()
    );
  });
  it('rejects repeated cursors instead of returning a partial catalogue', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(async () =>
          Response.json({ data: [{ id: 'claude-test' }], has_more: true, last_id: 'same' })
        )
    );
    await expect(
      listModels({ ...settings, provider: 'anthropic' }, new AbortController().signal)
    ).rejects.toThrow('response');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('never echoes an API key from provider errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ error: { message: 'Invalid key test-secret' } }, { status: 401 })
        )
    );
    await expect(listModels(settings, new AbortController().signal)).rejects.toThrow('auth');
    const call = vi.mocked(fetch).mock.calls[0]!;
    expect(call[0]).toBe('https://api.openai.com/v1/models');
    expect(call[1]?.redirect).toBe('error');
  });
});

describe('staged map tools', () => {
  it.each(['mercator', 'geodesic'] as const)(
    'uses the manual geometry for fractions and distances (%s)',
    async (projection) => {
      const line = {
        id: 'ab',
        name: 'AB',
        mode: 'coordinate' as const,
        center: { lat: 30, lon: -10 },
        endpoint: { lat: 65, lon: 40 },
      };
      const project: ProjectContext = { ...context, projection, lines: [line] };
      const executor = createAssistantExecutor(project, settings, new AbortController().signal);
      const geometry = createProjectGeometry(() => projection);
      for (const [position, fromEnd, name] of [
        [0.5, false, 'Middle'],
        [1 / 3, false, 'Third'],
        [1 / 3, true, 'Reverse third'],
      ] as const) {
        const args = { line_id: 'ab', name, position, unit: 'fraction', from_end: fromEnd };
        await executor.execute('create_point_on_line', args);
        await executor.execute('create_point_on_line', args); // Replayed calls must not duplicate points.
        const p = executor.plan.points.at(-1)!;
        const fraction = fromEnd ? 1 - position : position;
        if (projection === 'mercator') {
          const start = fromLonLat([line.center.lon, line.center.lat]);
          const end = fromLonLat([line.endpoint.lon, line.endpoint.lat]);
          const actual = fromLonLat([p.coordinates.lon, p.coordinates.lat]);
          expect(actual[0]).toBeCloseTo(start[0]! + (end[0]! - start[0]!) * fraction, 5);
          expect(actual[1]).toBeCloseTo(start[1]! + (end[1]! - start[1]!) * fraction, 5);
        } else {
          const total = geometry.getDistance(
            [line.center.lon, line.center.lat],
            [line.endpoint.lon, line.endpoint.lat]
          );
          expect(
            geometry.getDistance(
              [line.center.lon, line.center.lat],
              [p.coordinates.lon, p.coordinates.lat]
            ) / total
          ).toBeCloseTo(fraction, 8);
        }
        // Reload/reconstruction follows exactly the same distance metadata as manual points.
        const rebuilt = geometry.pointAtDistance(
          line.center,
          line.endpoint,
          p.construction!.distanceKm!,
          fromEnd
        );
        expect(rebuilt.lat).toBeCloseTo(p.coordinates.lat, 5);
        expect(rebuilt.lon).toBeCloseTo(p.coordinates.lon, 5);
      }
      await executor.execute('create_point_on_line', {
        line_id: 'ab',
        name: '10 km',
        position: 10,
        unit: 'kilometers',
        from_end: false,
      });
      expect(executor.plan.points).toHaveLength(4);
      expect(project.points).toHaveLength(0);
      expect(line).not.toHaveProperty('pointsOnLine');
    }
  );
  it('rejects invalid fractions, unknown lines and unbounded parallels without staging points', async () => {
    const executor = createAssistantExecutor(
      {
        ...context,
        lines: [
          {
            id: 'ab',
            name: 'AB',
            mode: 'azimuth',
            center: { lat: 45, lon: 2 },
            distance: 10,
            azimuth: 90,
          },
          { id: 'parallel', name: 'Parallel', mode: 'parallel', center: { lat: 45, lon: 2 } },
        ],
      },
      settings,
      new AbortController().signal
    );
    const args = {
      line_id: 'ab',
      name: 'Third',
      position: 1 / 3,
      unit: 'fraction',
      from_end: false,
    };
    for (const invalid of [
      { position: -1 },
      { position: 1.1 },
      { position: Number.NaN },
      { position: 100, unit: 'kilometers' },
      { line_id: 'unknown' },
      { line_id: 'parallel' },
    ]) {
      await expect(
        executor.execute('create_point_on_line', { ...args, ...invalid })
      ).rejects.toThrow();
    }
    expect(executor.plan.points).toHaveLength(0);
    await executor.execute('create_point_on_line', args);
    expect(executor.plan.points).toHaveLength(1);
  });
  it('validates the whole batch, rejects invented coordinates and does not change the project', async () => {
    const executor = createAssistantExecutor(context, settings, new AbortController().signal);
    await executor.execute('search_places', { query: 'Fontainebleau' });
    await expect(
      executor.execute('create_points', {
        points: [
          { location_id: 'place-1', name: 'Valid', source_urls: [] },
          { location_id: 'invented', name: 'Invalid', source_urls: [] },
        ],
      })
    ).rejects.toThrow('Unknown location');
    expect(executor.plan.points).toHaveLength(0);
    await executor.execute('create_points', {
      points: [{ location_id: 'place-1', name: 'Fontainebleau', source_urls: [] }],
    });
    expect(executor.plan.points).toHaveLength(1);
    expect(context.points).toHaveLength(0);
    const id = executor.plan.points[0]!.id;
    await executor.execute('create_circle', { point_id: id, radius_km: 10, name: 'Circle' });
    expect(executor.plan.circles[0]?.radius).toBe(10);
    await expect(
      executor.execute('create_circle', { point_id: id, radius_km: -1, name: 'Bad' })
    ).rejects.toThrow();
    await expect(
      executor.execute('create_line', { start_point_id: id, end_point_id: id, name: 'Bad' })
    ).rejects.toThrow();
  });
  it('deduplicates replayed creations and refuses invented sources', async () => {
    const executor = createAssistantExecutor(context, settings, new AbortController().signal);
    await executor.execute('search_places', { query: 'Fontainebleau' });
    const args = { points: [{ location_id: 'place-1', name: 'Fontainebleau', source_urls: [] }] };
    await executor.execute('create_points', args);
    await executor.execute('create_points', args);
    expect(executor.plan.points).toHaveLength(1);
    await expect(
      executor.execute('create_points', {
        points: [
          { location_id: 'place-1', name: 'Other', source_urls: ['https://invented.example'] },
        ],
      })
    ).rejects.toThrow('Only URLs');
    expect(executor.plan.points).toHaveLength(1);
  });
  it('does not stage anything when a geocoding request completes after stop', async () => {
    const controller = new AbortController();
    vi.mocked(searchAssistantPlaces).mockImplementation(async () => {
      controller.abort();
      return [{ main: 'Paris', coordinates: { lat: 48.8, lon: 2.3 } }];
    });
    const executor = createAssistantExecutor(context, settings, controller.signal);
    await expect(executor.execute('search_places', { query: 'Paris' })).rejects.toThrow();
    expect(executor.plan.points).toHaveLength(0);
  });
  it('bounds a model stuck in a tool loop', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () =>
        Response.json({
          output: [
            { type: 'function_call', call_id: 'loop', name: 'read_project', arguments: '{}' },
          ],
        })
      )
    );
    await expect(
      runAssistant({
        settings,
        context,
        prompt: 'Loop',
        conversation: [],
        locale: 'en',
        signal: new AbortController().signal,
        onActivity: vi.fn(),
      })
    ).rejects.toThrow('limit');
    expect(fetch).toHaveBeenCalledTimes(12);
  });
});

describe('assistant construction and correction tools', () => {
  const project: ProjectContext = {
    name: 'Geometry',
    projection: 'mercator',
    selection: [{ type: 'lineSegment', id: 'ab', name: 'AB' }],
    recent: [{ type: 'point', id: 'p', name: 'P' }],
    points: [
      { id: 'p', name: 'P', coordinates: { lat: 48, lon: 2 } },
      { id: 'q', name: 'Q', coordinates: { lat: 48, lon: 8 } },
    ],
    lines: [
      {
        id: 'ab',
        name: 'AB',
        mode: 'coordinate',
        center: { lat: 48, lon: 2 },
        endpoint: { lat: 48, lon: 8 },
      },
      {
        id: 'cd',
        name: 'CD',
        mode: 'coordinate',
        center: { lat: 46, lon: 5 },
        endpoint: { lat: 50, lon: 5 },
      },
    ],
    circles: [{ id: 'c', name: 'Circle', center: { lat: 48, lon: 2 }, radius: 10 }],
  };
  const execute = () =>
    createAssistantExecutor(structuredClone(project), settings, new AbortController().signal);
  it('exposes selection/recent IDs and calculates measures, angles, azimuths, parallels and crossings', async () => {
    const runner = execute();
    expect(runner.project()).toMatchObject({
      selection: project.selection,
      recent: project.recent,
    });
    const measurement = (await runner.execute('measure', {
      start_point_id: 'p',
      end_point_id: 'q',
    })) as { distance_km: number };
    expect(measurement.distance_km).toBeGreaterThan(440);
    expect(measurement.distance_km).toBeLessThan(450);
    await runner.execute('create_angle_line', {
      point_id: 'p',
      line_id: 'ab',
      angle_degrees: -90,
      distance_km: 10,
      name: 'Perpendicular',
    });
    expect(
      Math.min(runner.plan.lines[0]!.azimuth!, 360 - runner.plan.lines[0]!.azimuth!)
    ).toBeLessThan(0.01);
    expect(runner.plan.lines[0]!.endpoint!.lat).toBeGreaterThan(48);
    expect(runner.plan.lines[0]?.angleFrom).toEqual({ lineId: 'ab', degrees: -90 });
    await runner.execute('create_azimuth_line', {
      point_id: 'q',
      azimuth: 180,
      distance_km: 10,
      name: 'South',
    });
    expect(runner.plan.lines[1]!.endpoint!.lat).toBeLessThan(48);
    await runner.execute('create_parallel', { point_id: 'p', name: 'Latitude' });
    expect(runner.plan.lines[2]).toMatchObject({ mode: 'parallel', longitude: 48 });
    await runner.execute('create_intersection_point', {
      first_line_id: 'ab',
      second_line_id: 'cd',
      name: 'Crossing',
    });
    expect(runner.plan.points[0]!.coordinates.lat).toBeCloseTo(48, 7);
    expect(runner.plan.points[0]!.coordinates.lon).toBeCloseTo(5, 7);
  });
  it('chooses the perpendicular side from a compass direction without model arithmetic', async () => {
    const runner = execute();
    await runner.execute('create_perpendicular', {
      point_id: 'p',
      line_id: 'ab',
      distance_km: 10,
      direction: 'north',
      name: 'North',
    });
    await runner.execute('create_perpendicular', {
      point_id: 'p',
      line_id: 'ab',
      distance_km: 10,
      direction: 'south',
      name: 'South',
    });
    expect(runner.plan.lines[0]!.endpoint!.lat).toBeGreaterThan(48);
    expect(runner.plan.lines[1]!.endpoint!.lat).toBeLessThan(48);
    expect(runner.plan.lines[0]!.angleFrom?.degrees).toBe(-90);
  });
  it('stages corrections against current tool state, keeps IDs and never mutates the original', async () => {
    const original = structuredClone(project);
    const runner = createAssistantExecutor(original, settings, new AbortController().signal);
    await runner.execute('reposition_point_on_line', {
      point_id: 'p',
      line_id: 'ab',
      unit: 'fraction',
      position: 1 / 3,
      from_end: true,
    });
    await runner.execute('rename_element', {
      element_type: 'point',
      element_id: 'p',
      name: 'Corrected',
    });
    const changed = runner.project().points.find((p) => p.id === 'p');
    expect(changed?.name).toBe('Corrected');
    expect(changed?.coordinates.lon).toBeCloseTo(6, 8);
    expect(runner.plan.edits).toHaveLength(1);
    expect(runner.plan.edits[0]?.before.name).toBe('P');
    await runner.execute('resize_circle', { circle_id: 'c', radius_km: 12 });
    expect(runner.project().circles[0]?.radius).toBe(12);
    await runner.execute('delete_element', { element_type: 'circle', element_id: 'c' });
    expect(runner.project().circles).toHaveLength(0);
    expect(original).toEqual(project);
    await expect(
      runner.execute('rename_element', { element_type: 'circle', element_id: 'c', name: 'Gone' })
    ).rejects.toThrow('Unknown');
    await expect(
      runner.execute('delete_element', { element_type: 'lineSegment', element_id: 'ab' })
    ).rejects.toThrow('dependent');
  });
  it('reverses the recorded fraction across requests without model arithmetic', async () => {
    const first = execute();
    await first.execute('create_point_on_line', {
      line_id: 'ab',
      name: 'Third',
      position: 1 / 3,
      unit: 'fraction',
      from_end: false,
    });
    const p = first.plan.points[0]!;
    const next = createAssistantExecutor(
      {
        ...project,
        points: [...project.points, p],
        recent: [{ type: 'point', id: p.id, name: p.name, placement: first.plan.placements[p.id] }],
      },
      settings,
      new AbortController().signal
    );
    await next.execute('reverse_point_origin', { point_id: p.id });
    expect(next.project().points.find((point) => point.id === p.id)?.coordinates.lon).toBeCloseTo(
      6,
      8
    );
    await next.execute('reverse_point_origin', { point_id: p.id });
    expect(next.project().points.find((point) => point.id === p.id)?.coordinates.lon).toBeCloseTo(
      4,
      8
    );
  });
  it('preserves a fractional position after reload without conversation memory', async () => {
    const line = {
      id: 'slope',
      name: 'Slope',
      mode: 'coordinate' as const,
      center: { lat: 30, lon: -10 },
      endpoint: { lat: 65, lon: 40 },
    };
    const first = createAssistantExecutor(
      { ...context, lines: [line] },
      settings,
      new AbortController().signal
    );
    await first.execute('create_point_on_line', {
      line_id: line.id,
      name: 'Third',
      position: 1 / 3,
      unit: 'fraction',
      from_end: false,
    });
    const serialized = JSON.stringify(first.plan.points);
    const saved = JSON.parse(serialized);
    const reloaded = createAssistantExecutor(
      { ...context, lines: [line], points: saved },
      settings,
      new AbortController().signal
    );
    await reloaded.execute('reverse_point_origin', { point_id: saved[0].id });
    const expected = createProjectGeometry(() => 'mercator').interpolateLine(
      line.center,
      line.endpoint,
      2 / 3
    );
    const result = reloaded.project().points[0]!.coordinates;
    expect(result.lon).toBeCloseTo(expected.lon, 7);
    expect(result.lat).toBeCloseTo(expected.lat, 7);
  });
  it('validates choice IDs and rejects incorrect constructions', async () => {
    const runner = execute();
    await expect(
      runner.execute('create_intersection_point', {
        first_line_id: 'ab',
        second_line_id: 'ab',
        name: 'No crossing',
      })
    ).rejects.toThrow();
    await expect(
      runner.execute('create_angle_line', {
        point_id: 'p',
        line_id: 'cd',
        angle_degrees: 90,
        distance_km: 10,
        name: 'Off line',
      })
    ).rejects.toThrow();
    await expect(
      runner.execute('resize_circle', { circle_id: 'c', radius_km: -1 })
    ).rejects.toThrow();
    await runner.execute('choose_elements', {
      question: 'Which line?',
      elements: [
        { element_type: 'lineSegment', element_id: 'ab' },
        { element_type: 'lineSegment', element_id: 'cd' },
      ],
    });
    expect(runner.plan.choice?.elements.map((r) => r.id)).toEqual(['ab', 'cd']);
    expect(runner.plan.points).toHaveLength(0);
    expect(runner.plan.edits).toHaveLength(0);
  });
});
