import type { ProjectLayerData } from '@/types/project';
import { describe, expect, it } from 'vitest';
import { parseLayersJSON } from '@/domain/layers';
import { exportProjectAsJSON } from '@/services/storage';

describe('project layer import', () => {
  it.each(['{}', 'null', '[]', '{"points":{}}', '{"points":[{"id":"broken"}]}'])(
    'rejects an invalid project before replacing layers: %s',
    (json) => expect(() => parseLayersJSON(json)).toThrow()
  );

  it('round-trips names, relationships, notes, and timestamps through the project exporter', () => {
    const data: ProjectLayerData = {
      circles: [],
      lineSegments: [
        {
          id: 'line',
          name: 'Route',
          center: { lat: 48, lon: 2 },
          endpoint: { lat: 49, lon: 3 },
          mode: 'coordinate',
          startPointId: 'point',
          pointsOnLine: ['middle'],
          createdAt: 1,
        },
      ],
      points: [
        {
          id: 'point',
          name: 'Start',
          coordinates: { lat: 48, lon: 2 },
          lineId: 'line',
          createdAt: 2,
        },
        {
          id: 'middle',
          name: 'Clue',
          coordinates: { lat: 48.5, lon: 2.5 },
          lineId: 'line',
          noteId: 'note',
          createdAt: 3,
        },
      ],
      polygons: [],
      notes: [
        {
          id: 'note',
          title: 'Clue',
          content: 'Keep this',
          linkedElementType: 'point',
          linkedElementId: 'middle',
          createdAt: 4,
        },
      ],
    };
    expect(parseLayersJSON(exportProjectAsJSON({ name: 'Hunt', data }))).toEqual(data);
  });

  it('accepts old layer-only exports and preserves legacy coordinate IDs', () => {
    const result = parseLayersJSON(
      JSON.stringify({
        coordinates: [{ id: 'legacy', name: 'Old clue', lat: 48, lon: 2 }],
      })
    );
    expect(result.points).toMatchObject([
      { id: 'legacy', name: 'Old clue', coordinates: { lat: 48, lon: 2 } },
    ]);
  });

  it('migrates old polygon coordinates to referenced points', () => {
    const result = parseLayersJSON(
      JSON.stringify({
        polygons: [
          {
            id: 'area',
            name: 'Area',
            points: [
              { lat: 48, lon: 2 },
              { lat: 49, lon: 3 },
              { lat: 48, lon: 4 },
            ],
          },
        ],
      })
    );
    expect(result.points).toHaveLength(3);
    expect(result.polygons[0]?.pointIds).toEqual(result.points.map((point) => point.id));
  });

  it('rejects unsupported line modes instead of asserting an invalid type', () => {
    expect(() =>
      parseLayersJSON(
        JSON.stringify({
          lineSegments: [
            {
              id: 'line',
              name: 'Invalid',
              mode: 'unsupported',
              center: { lat: 48, lon: 2 },
              endpoint: { lat: 49, lon: 3 },
            },
          ],
        })
      )
    ).toThrow('Invalid project field: lineSegments');
  });

  it('accepts an explicitly empty project', () => {
    expect(
      parseLayersJSON('{"circles":[],"lineSegments":[],"points":[],"polygons":[],"notes":[]}')
    ).toEqual({ circles: [], lineSegments: [], points: [], polygons: [], notes: [] });
  });

  it.each([42, 'point', null, {}, ['point', 42]].map((value) => [value]))(
    'rejects malformed line point references before loading: %j',
    (pointsOnLine) => {
      expect(() =>
        parseLayersJSON(
          JSON.stringify({
            lineSegments: [
              {
                id: 'line',
                name: 'Route',
                mode: 'coordinate',
                center: { lat: 48, lon: 2 },
                endpoint: { lat: 49, lon: 3 },
                pointsOnLine,
              },
            ],
          })
        )
      ).toThrow('Invalid project field: lineSegments');
    }
  );

  it.each([42, 'polygon', null, {}, ['polygon', 42]].map((value) => [value]))(
    'rejects malformed point polygon references before loading: %j',
    (polygonIds) => {
      expect(() =>
        parseLayersJSON(
          JSON.stringify({
            points: [
              {
                id: 'point',
                name: 'Clue',
                coordinates: { lat: 48, lon: 2 },
                polygonIds,
              },
            ],
          })
        )
      ).toThrow('Invalid project field: points');
    }
  );

  it.each([undefined, [], ['related-id']].map((value) => [value]))(
    'preserves valid optional relationship lists: %j',
    (ids) => {
      const result = parseLayersJSON(
        JSON.stringify({
          points: [
            { id: 'point', name: 'Clue', coordinates: { lat: 48, lon: 2 }, polygonIds: ids },
          ],
          lineSegments: [
            {
              id: 'line',
              name: 'Route',
              mode: 'coordinate',
              center: { lat: 48, lon: 2 },
              endpoint: { lat: 49, lon: 3 },
              pointsOnLine: ids,
            },
          ],
        })
      );
      expect(result.points[0]?.polygonIds).toEqual(ids);
      expect(result.lineSegments[0]?.pointsOnLine).toEqual(ids);
    }
  );
});
