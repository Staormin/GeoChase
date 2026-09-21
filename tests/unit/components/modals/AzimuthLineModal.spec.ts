import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AzimuthLineModal from '@/components/modals/AzimuthLineModal.vue';
import { drawingKey } from '@/composables/mapContext';
import { useLayersStore } from '@/stores/layers';
import { useUIStore } from '@/stores/ui';

vi.unmock('ol/proj');

describe('AzimuthLineModal cartes.gouv compatibility', () => {
  beforeEach(() => setActivePinia(createPinia()));

  function setup() {
    const drawing = { drawLineSegment: vi.fn(), updateLineSegment: vi.fn() };
    const wrapper = mount(AzimuthLineModal, {
      global: { provide: { [drawingKey as symbol]: drawing } },
    });
    return { wrapper, drawing, vm: wrapper.vm as any };
  }

  it('creates the endpoint verified against the actual cartes.gouv controls', async () => {
    const { wrapper, drawing, vm } = setup();
    Object.assign(vm.form, {
      name: 'Brest east',
      startCoord: '48.3904,-4.4861',
      distance: 100,
      azimuth: 90,
    });
    await vm.submitForm();
    const call = drawing.drawLineSegment.mock.calls[0]!;
    expect(call[2]).toBeCloseTo(48.39036026480809, 8);
    expect(call[3]).toBeCloseTo(-3.131789801679117, 8);
    wrapper.unmount();
  });

  it('re-measures an old segment so editing its name does not move the endpoint', async () => {
    const oldEnd = { lat: 48.382453926466766, lon: -3.131945991238757 };
    useLayersStore().addLineSegment({
      id: 'old',
      name: 'Old line',
      mode: 'azimuth',
      center: { lat: 48.3904, lon: -4.4861 },
      endpoint: oldEnd,
      distance: 100,
      azimuth: 90,
    });
    const { wrapper, drawing, vm } = setup();
    useUIStore().startEditing('lineSegment', 'old');
    useUIStore().openModal('azimuthLineModal');
    await flushPromises();
    expect(vm.form.azimuth).toBeCloseTo(90.50371314167153, 8);
    vm.form.name = 'Renamed';
    await vm.submitForm();
    const call = drawing.updateLineSegment.mock.calls[0]!;
    expect(call[3]).toBeCloseTo(oldEnd.lat, 8);
    expect(call[4]).toBeCloseTo(oldEnd.lon, 8);
    wrapper.unmount();
  });

  it('reports an unreachable destination without creating a wrong line', async () => {
    const { wrapper, drawing, vm } = setup();
    Object.assign(vm.form, { name: 'Impossible', startCoord: '89,0', distance: 1000, azimuth: 0 });
    const toast = vi.spyOn(useUIStore(), 'addToast');
    await vm.submitForm();
    expect(drawing.drawLineSegment).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('Cannot construct'), 'error');
    wrapper.unmount();
  });
});
