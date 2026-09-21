import { beforeEach, expect, it } from 'vitest';
import { getRecentDrawingColors, rememberDrawingColor } from '@/services/drawingColors';
import { exportProjectAsJSON, importProjectFromJSON } from '@/services/storage';

beforeEach(() => localStorage.clear());

it('persists the eight latest distinct colors and ignores invalid data', () => {
  localStorage.setItem('geochase_recentDrawingColors', '{broken');
  expect(getRecentDrawingColors()).toEqual([]);
  for (let index = 0; index < 10; index++) rememberDrawingColor(`#00000${index}`);
  rememberDrawingColor('#abcdef');
  rememberDrawingColor('#ABCDEF');
  rememberDrawingColor('invalid');
  expect(getRecentDrawingColors()).toEqual([
    '#ABCDEF',
    '#000009',
    '#000008',
    '#000007',
    '#000006',
    '#000005',
    '#000004',
    '#000003',
  ]);
});

it('round trips colors through the project JSON exporter and importer', () => {
  const data = {
    circles: [
      { id: 'c', name: 'Circle', center: { lat: 48, lon: 2 }, radius: 5, color: '#6366F1' },
    ],
    lineSegments: [
      {
        id: 'l',
        name: 'Line',
        center: { lat: 48, lon: 2 },
        endpoint: { lat: 49, lon: 3 },
        mode: 'coordinate' as const,
        color: '#0891B2',
      },
    ],
    points: [0, 1, 2].map((index) => ({
      id: `p${index}`,
      name: 'Point',
      coordinates: { lat: 48 + index, lon: 2 + index },
    })),
    polygons: [{ id: 'poly', name: 'Polygon', pointIds: ['p0', 'p1', 'p2'], color: '#DB2777' }],
    notes: [],
  };
  const imported = importProjectFromJSON(exportProjectAsJSON({ name: 'Colors', data }));
  expect(imported?.data.circles[0]?.color).toBe('#6366F1');
  expect(imported?.data.lineSegments[0]?.color).toBe('#0891B2');
  expect(imported?.data.polygons[0]?.color).toBe('#DB2777');
});
