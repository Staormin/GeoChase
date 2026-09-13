import type { LineSegmentElement } from '@/types/project';
import type { VueWrapper } from '@vue/test-utils';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VBtn, VSelect } from 'vuetify/components';
import AngleLineModal from '@/components/modals/AngleLineModal.vue';
import { drawingKey } from '@/composables/mapContext';
import { createProjectGeometry } from '@/services/projectGeometry';
import { useLayersStore } from '@/stores/layers';
import { useProjectsStore } from '@/stores/projects';
import { useUIStore } from '@/stores/ui';

vi.unmock('ol/proj');

describe('AngleLineModal', () => {
  let wrapper: VueWrapper<InstanceType<typeof AngleLineModal>>;
  const drawLineSegment = vi.fn(
    (
      lat: number,
      lon: number,
      endLat: number,
      endLon: number,
      name: string,
      mode: 'azimuth',
      distance: number,
      azimuth: number
    ) => {
      const line: LineSegmentElement = {
        id: 'angle-line',
        name,
        mode,
        distance,
        azimuth,
        center: { lat, lon },
        endpoint: { lat: endLat, lon: endLon },
      };
      useLayersStore().addLineSegment(line);
      return line;
    }
  );
  const pointSelect = () => wrapper.findAllComponents(VSelect)[0]!;
  const lineSelect = () => wrapper.findAllComponents(VSelect)[1]!;
  const addButton = () =>
    wrapper.findAllComponents(VBtn).find((button) => button.text() === 'Add')!;

  beforeEach(async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const layers = useLayersStore();
    layers.lineSegments = [
      {
        id: 'east',
        name: 'East',
        mode: 'coordinate',
        center: { lat: 0, lon: -1 },
        endpoint: { lat: 0, lon: 1 },
      },
      {
        id: 'north',
        name: 'North',
        mode: 'coordinate',
        center: { lat: -1, lon: 0 },
        endpoint: { lat: 1, lon: 0 },
      },
    ];
    layers.points = [
      { id: 'crossing', name: 'Crossing', coordinates: { lat: 0, lon: 0 } },
      { id: 'endpoint', name: 'Endpoint', coordinates: { lat: 0, lon: 1 } },
      { id: 'elsewhere', name: 'Elsewhere', coordinates: { lat: 10, lon: 10 }, lineId: 'east' },
    ];
    wrapper = mount(AngleLineModal, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
        stubs: { VDialog: { template: '<div><slot /></div>' } },
        provide: { [drawingKey as symbol]: { drawLineSegment, drawPoint: vi.fn() } },
      },
    });
    useUIStore().openModal('angleLineModal');
    await flushPromises();
  });

  afterEach(() => wrapper.unmount());

  it('lists every point, including unlinked crossings and endpoints', () => {
    expect(pointSelect().props('items')).toEqual([
      { title: 'Crossing', value: 'crossing' },
      { title: 'Endpoint', value: 'endpoint' },
      { title: 'Elsewhere', value: 'elsewhere' },
    ]);
  });

  it.each([
    ['east', 180],
    ['north', 90],
  ] as const)('uses the chosen %s reference at a crossing', async (lineId, expectedBearing) => {
    await pointSelect().setValue('crossing');
    expect(lineSelect().props('items')).toEqual([
      { title: 'East', value: 'east' },
      { title: 'North', value: 'north' },
    ]);
    expect(addButton().props('disabled')).toBe(true);
    await lineSelect().setValue(lineId);
    expect(addButton().props('disabled')).toBe(false);
    await addButton().trigger('click');
    expect(drawLineSegment).toHaveBeenCalledExactlyOnceWith(
      0,
      0,
      expect.any(Number),
      expect.any(Number),
      expect.any(String),
      'azimuth',
      1,
      expectedBearing
    );
    expect(useLayersStore().lineSegments.at(-1)?.angleFrom).toEqual({ lineId, degrees: 90 });
  });

  it('automatically selects the only line through an endpoint without a lineId', async () => {
    await pointSelect().setValue('endpoint');
    expect(lineSelect().props('modelValue')).toBe('east');
    await addButton().trigger('click');
    expect(drawLineSegment).toHaveBeenCalledTimes(1);
  });

  it('offers both lines at a shared endpoint, even with a legacy single lineId', async () => {
    const layers = useLayersStore();
    layers.lineSegments[1]!.center = { lat: 0, lon: 1 };
    layers.points[1]!.lineId = 'east';
    await pointSelect().setValue('endpoint');
    expect(lineSelect().props('items')).toHaveLength(2);
    expect(lineSelect().props('modelValue')).toBeNull();
  });

  it('clears an incompatible reference and explains why an off-line point cannot be used', async () => {
    await pointSelect().setValue('endpoint');
    await pointSelect().setValue('elsewhere');
    expect(lineSelect().props('items')).toEqual([]);
    expect(lineSelect().props('modelValue')).toBeNull();
    expect(wrapper.text()).toContain('No line passes through this point');
    expect(addButton().props('disabled')).toBe(true);
    await wrapper.find('form').trigger('submit');
    expect(drawLineSegment).not.toHaveBeenCalled();
    expect(useUIStore().isModalOpen('angleLineModal')).toBe(true);
  });

  it('invalidates a reference removed while the modal is open', async () => {
    await pointSelect().setValue('endpoint');
    useLayersStore().lineSegments = [];
    await flushPromises();
    expect(lineSelect().props('modelValue')).toBeNull();
    expect(addButton().props('disabled')).toBe(true);
  });

  it('resets point and reference selections when reopened', async () => {
    await pointSelect().setValue('endpoint');
    useUIStore().closeModal('angleLineModal');
    await flushPromises();
    useUIStore().openModal('angleLineModal');
    await flushPromises();
    expect(pointSelect().props('modelValue')).toBeNull();
    expect(lineSelect().props('modelValue')).toBeNull();
  });

  it('uses the local geodesic direction for an unlinked interior point', async () => {
    useProjectsStore().createAndSwitchProject('Geodesic', 'geodesic');
    const geometry = createProjectGeometry(() => 'geodesic');
    const center = { lat: 60, lon: -60 };
    const endpoint = { lat: 60, lon: 60 };
    const coordinates = geometry.interpolateLine(center, endpoint, 0.5);
    const reference: LineSegmentElement = {
      id: 'arc',
      name: 'Arc',
      mode: 'coordinate',
      center,
      endpoint,
    };
    useLayersStore().lineSegments = [reference];
    useLayersStore().points = [{ id: 'midpoint', name: 'Midpoint', coordinates }];
    await pointSelect().setValue('midpoint');
    expect(lineSelect().props('modelValue')).toBe('arc');
    await addButton().trigger('click');
    expect(drawLineSegment.mock.calls[0]?.[7]).toBeCloseTo(180, 6);
    expect(useLayersStore().lineSegments.at(-1)?.angleFrom).toEqual({ lineId: 'arc', degrees: 90 });
  });
});
