import { flushPromises, mount } from '@vue/test-utils';
import { fromLonLat, toLonLat } from 'ol/proj';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AddPointOnSegmentModal from '@/components/modals/AddPointOnSegmentModal.vue';
import { drawingKey } from '@/composables/mapContext';
import { geodesicIntermediate, geodesicInverse } from '@/services/geodesy';
import { useLayersStore } from '@/stores/layers';
import { useProjectsStore } from '@/stores/projects';
import { useUIStore } from '@/stores/ui';

vi.unmock('ol/proj');

describe('AddPointOnSegmentModal.vue', () => {
  let wrapper: any;
  let uiStore: any;
  let layersStore: any;
  let pinia: any;
  let mockDrawing: any;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);

    uiStore = useUIStore();
    layersStore = useLayersStore();

    // Mock drawing composable that also adds point to store
    mockDrawing = {
      drawPoint: vi.fn((lat: number, lon: number, name?: string) => {
        const point = {
          id: 'point-123',
          name: name || 'Test Point',
          coordinates: { lat, lon },
          color: '#000000',
        };
        // Add point to store to simulate real behavior
        layersStore.addPoint(point);
        return point;
      }),
    };

    // Create a test line segment
    layersStore.addLineSegment({
      id: 'line-456',
      name: 'Test Line',
      center: { lat: 48.8566, lon: 2.3522 },
      endpoint: { lat: 48.86, lon: 2.355 },
      mode: 'coordinate',
    });

    // Open the modal and select the segment
    uiStore.openModal('addPointOnSegmentModal');
    uiStore.setSelectedSegmentForPointCreation('line-456');

    wrapper = mount(AddPointOnSegmentModal, {
      global: {
        plugins: [pinia],
        provide: {
          [drawingKey as symbol]: mockDrawing,
        },
      },
    });
  });

  describe('Bidirectional relationship: Point <-> Line', () => {
    it('adds point to line pointsOnLine array when point is created', async () => {
      // Set form values (use small distance that won't exceed segment length)
      (wrapper.vm as any).form.distance = 0.2;
      (wrapper.vm as any).form.distanceFrom = 'start';
      (wrapper.vm as any).form.name = 'Midpoint';

      // Submit form
      await (wrapper.vm as any).submitForm();
      await flushPromises();

      // Verify the line segment has the point in its pointsOnLine array
      const line = layersStore.lineSegments.find((l: any) => l.id === 'line-456');
      expect(line).toBeDefined();
      expect(line.pointsOnLine).toBeDefined();
      expect(line.pointsOnLine).toContain('point-123');
    });

    it('sets point lineId to reference the parent line', async () => {
      // Set form values (use small distance that won't exceed segment length)
      (wrapper.vm as any).form.distance = 0.2;
      (wrapper.vm as any).form.distanceFrom = 'start';
      (wrapper.vm as any).form.name = 'Midpoint';

      // Submit form
      await (wrapper.vm as any).submitForm();
      await flushPromises();

      // Verify the point has lineId set to the line
      const point = layersStore.points.find((p: any) => p.id === 'point-123');
      expect(point).toBeDefined();
      expect(point.lineId).toBe('line-456');
    });

    it('initializes pointsOnLine array if not present', async () => {
      // Create a line without pointsOnLine array
      layersStore.addLineSegment({
        id: 'line-789',
        name: 'Line Without Points Array',
        center: { lat: 48.85, lon: 2.35 },
        endpoint: { lat: 48.855, lon: 2.358 },
        mode: 'coordinate',
      });

      // Remove the pointsOnLine array
      const lineBefore = layersStore.lineSegments.find((l: any) => l.id === 'line-789');
      delete lineBefore.pointsOnLine;
      expect(lineBefore.pointsOnLine).toBeUndefined();

      // Set form values and select the new line
      uiStore.setSelectedSegmentForPointCreation('line-789');
      (wrapper.vm as any).form.distance = 0.05;
      (wrapper.vm as any).form.distanceFrom = 'start';

      // Submit form
      await (wrapper.vm as any).submitForm();
      await flushPromises();

      // Verify pointsOnLine array was initialized
      const lineAfter = layersStore.lineSegments.find((l: any) => l.id === 'line-789');
      expect(lineAfter.pointsOnLine).toBeDefined();
      expect(Array.isArray(lineAfter.pointsOnLine)).toBe(true);
    });

    it('supports multiple points on the same line', async () => {
      // Add first point (use small distance)
      (wrapper.vm as any).form.distance = 0.1;
      (wrapper.vm as any).form.distanceFrom = 'start';
      await (wrapper.vm as any).submitForm();
      await flushPromises();

      // Mock drawing to return a different point
      mockDrawing.drawPoint = vi.fn((lat: number, lon: number, name?: string) => {
        const point = {
          id: 'point-789',
          name: name || 'Second Point',
          coordinates: { lat, lon },
          color: '#000000',
        };
        layersStore.addPoint(point);
        return point;
      });

      // Reopen modal
      uiStore.openModal('addPointOnSegmentModal');
      uiStore.setSelectedSegmentForPointCreation('line-456');

      // Add second point (use small distance)
      (wrapper.vm as any).form.distance = 0.3;
      (wrapper.vm as any).form.distanceFrom = 'start';
      await (wrapper.vm as any).submitForm();
      await flushPromises();

      // Verify the line has both points
      const line = layersStore.lineSegments.find((l: any) => l.id === 'line-456');
      expect(line.pointsOnLine).toContain('point-123');
      expect(line.pointsOnLine).toContain('point-789');
      expect(line.pointsOnLine.length).toBe(2);
    });
  });

  describe('Point calculation', () => {
    it.each(['mercator', 'geodesic'] as const)(
      'creates the same Brest–Kyiv midpoint in both directions in %s',
      async (projection) => {
        useProjectsStore().createAndSwitchProject('Midpoint regression', projection);
        const brest = { lat: 48.3904, lon: -4.4861 };
        const kyiv = { lat: 50.4501, lon: 30.5234 };
        const a = fromLonLat([brest.lon, brest.lat]);
        const b = fromLonLat([kyiv.lon, kyiv.lat]);
        const [lon, lat] = toLonLat([(a[0]! + b[0]!) / 2, (a[1]! + b[1]!) / 2]);
        const expected =
          projection === 'mercator' ? { lat, lon } : geodesicIntermediate(brest, kyiv, 0.5);

        for (const [center, endpoint] of [
          [brest, kyiv],
          [kyiv, brest],
        ]) {
          const segment = layersStore.lineSegments.find((line: any) => line.id === 'line-456');
          segment.center = center;
          segment.endpoint = endpoint;
          uiStore.openModal('addPointOnSegmentModal');
          uiStore.setSelectedSegmentForPointCreation(segment.id);
          await wrapper.vm.calculateMidpoint();
          await wrapper.vm.submitForm();

          const [actualLat, actualLon] = mockDrawing.drawPoint.mock.calls.at(-1);
          expect(actualLat).toBeCloseTo(expected.lat!, 7);
          expect(actualLon).toBeCloseTo(expected.lon!, 7);
          if (projection === 'geodesic') {
            const actual = { lat: actualLat, lon: actualLon };
            const half = geodesicInverse(brest, kyiv).distance / 2;
            expect(geodesicInverse(brest, actual).distance).toBeCloseTo(half, 5);
            expect(geodesicInverse(actual, kyiv).distance).toBeCloseTo(half, 5);
          }
        }
      }
    );

    it('calculates midpoint correctly', async () => {
      await (wrapper.vm as any).calculateMidpoint();

      // The distance is measured from the start to the selected path's midpoint.
      expect((wrapper.vm as any).form.distance).toBeGreaterThan(0);
      expect((wrapper.vm as any).form.distanceFrom).toBe('start');
      // Name uses i18n translation: "Midpoint of {segment}" where segment is "Test Line"
      expect((wrapper.vm as any).form.name).toBe('Midpoint of Test Line');
    });

    it('draws point with correct coordinates using binary search from start', async () => {
      (wrapper.vm as any).form.distance = 0.1;
      (wrapper.vm as any).form.distanceFrom = 'start';

      await (wrapper.vm as any).submitForm();

      // Verify drawPoint was called
      expect(mockDrawing.drawPoint).toHaveBeenCalled();
      const [lat, lon, name] = mockDrawing.drawPoint.mock.calls[0];
      expect(typeof lat).toBe('number');
      expect(typeof lon).toBe('number');
      // Name uses auto-generated format: "{line} at {distance} km"
      expect(name).toBe('Test Line at 0.10 km');
    });

    it('draws point using binary search from end', async () => {
      (wrapper.vm as any).form.distance = 0.1;
      (wrapper.vm as any).form.distanceFrom = 'end';

      await (wrapper.vm as any).submitForm();

      // Verify drawPoint was called
      expect(mockDrawing.drawPoint).toHaveBeenCalled();
      const [lat, lon] = mockDrawing.drawPoint.mock.calls[0];
      expect(typeof lat).toBe('number');
      expect(typeof lon).toBe('number');
    });

    it('rejects distance exceeding segment length', async () => {
      const addToastSpy = vi.spyOn(uiStore, 'addToast');

      (wrapper.vm as any).form.distance = 999;
      (wrapper.vm as any).form.distanceFrom = 'start';

      await (wrapper.vm as any).submitForm();

      expect(addToastSpy).toHaveBeenCalledWith(
        expect.stringContaining('Distance exceeds line length'),
        'error'
      );
      expect(mockDrawing.drawPoint).not.toHaveBeenCalled();
    });

    it('rejects negative distance', async () => {
      const addToastSpy = vi.spyOn(uiStore, 'addToast');

      (wrapper.vm as any).form.distance = -1;
      (wrapper.vm as any).form.distanceFrom = 'start';

      await (wrapper.vm as any).submitForm();

      expect(addToastSpy).toHaveBeenCalledWith('Distance must be positive', 'error');
      expect(mockDrawing.drawPoint).not.toHaveBeenCalled();
    });
  });

  describe('Modal behavior', () => {
    it('closes modal after successful submission', async () => {
      const closeModalSpy = vi.spyOn(uiStore, 'closeModal');

      (wrapper.vm as any).form.distance = 0.2;

      await (wrapper.vm as any).submitForm();

      expect(closeModalSpy).toHaveBeenCalledWith('addPointOnSegmentModal');
    });

    it('shows success toast after adding point', async () => {
      const addToastSpy = vi.spyOn(uiStore, 'addToast');

      (wrapper.vm as any).form.distance = 0.2;

      await (wrapper.vm as any).submitForm();

      // Toast message uses i18n translation: "Point added successfully"
      expect(addToastSpy).toHaveBeenCalledWith('Point added successfully', 'success');
    });

    it('resets form when modal is closed', async () => {
      (wrapper.vm as any).form.name = 'Test';
      (wrapper.vm as any).form.distance = 5;

      await (wrapper.vm as any).closeModal();

      expect((wrapper.vm as any).form.name).toBe('');
      expect((wrapper.vm as any).form.distance).toBe(0);
      expect((wrapper.vm as any).form.distanceFrom).toBe('start');
    });
  });
});
