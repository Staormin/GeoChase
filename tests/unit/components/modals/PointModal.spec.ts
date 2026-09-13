import type { ReverseGeocodeResult } from '@/services/address';
import type { VueWrapper } from '@vue/test-utils';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VBtn, VTextField } from 'vuetify/components';
import PointModal from '@/components/modals/PointModal.vue';
import { drawingKey } from '@/composables/mapContext';
import { getReverseGeocodeAddress } from '@/services/address';
import { useUIStore } from '@/stores/ui';

vi.mock('@/services/address', () => ({ getReverseGeocodeAddress: vi.fn() }));

describe('PointModal reverse geocoding', () => {
  let wrapper: VueWrapper<InstanceType<typeof PointModal>>;
  const drawPoint = vi.fn();

  beforeEach(async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const ui = useUIStore();
    ui.startCreating('point', { lat: 48.8584, lon: 2.2945 });
    ui.openModal('pointModal');
    vi.mocked(getReverseGeocodeAddress).mockResolvedValue({
      address: 'Avenue Anatole France, 75007, Paris',
      city: 'Paris',
    });
    wrapper = mount(PointModal, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
        stubs: { VDialog: { template: '<div><slot /></div>' } },
        provide: { [drawingKey as symbol]: { drawPoint, deleteElement: vi.fn() } },
      },
    });
    await flushPromises();
  });

  afterEach(() => {
    if (wrapper.exists()) wrapper.unmount();
  });

  async function clickButton(name: string) {
    await wrapper
      .findAllComponents(VBtn)
      .find((button) => button.text() === name)!
      .trigger('click');
  }

  it('names a point placed on the map using only its reverse-geocoded city', async () => {
    await clickButton('Add');
    await flushPromises();
    expect(getReverseGeocodeAddress).toHaveBeenCalledWith(48.8584, 2.2945, expect.any(AbortSignal));
    expect(drawPoint).toHaveBeenCalledExactlyOnceWith(48.8584, 2.2945, 'Paris');
  });

  it('preserves a custom name without requesting an address', async () => {
    await wrapper.findAllComponents(VTextField)[0]!.setValue('  My landmark  ');
    await clickButton('Add');
    expect(getReverseGeocodeAddress).not.toHaveBeenCalled();
    expect(drawPoint).toHaveBeenCalledExactlyOnceWith(48.8584, 2.2945, 'My landmark');
  });

  it('uses an editable prefilled intersection name without reverse geocoding', async () => {
    useUIStore().startCreating('point', { lat: 47, lon: 2, name: 'intersection of line A and B' });
    await flushPromises();
    expect(wrapper.findAllComponents(VTextField)[0]!.props('modelValue')).toBe(
      'intersection of line A and B'
    );
    await clickButton('Add');
    expect(getReverseGeocodeAddress).not.toHaveBeenCalled();
    expect(drawPoint).toHaveBeenCalledExactlyOnceWith(47, 2, 'intersection of line A and B');
  });

  it.each([
    { address: null },
    { address: 'Avenue Anatole France, 75007' },
    { address: null, error: 'Network error' },
  ])('falls back to a numbered point when the lookup returns %j', async (result) => {
    vi.mocked(getReverseGeocodeAddress).mockResolvedValueOnce(result);
    await clickButton('Add');
    await flushPromises();
    expect(drawPoint).toHaveBeenCalledExactlyOnceWith(48.8584, 2.2945, 'Point 1');
  });

  it('prevents repeated submissions while the address is loading', async () => {
    const lookup = Promise.withResolvers<ReverseGeocodeResult>();
    vi.mocked(getReverseGeocodeAddress).mockReturnValueOnce(lookup.promise);
    await clickButton('Add');
    await wrapper.find('form').trigger('submit');
    expect(getReverseGeocodeAddress).toHaveBeenCalledTimes(1);
    expect(drawPoint).not.toHaveBeenCalled();
    lookup.resolve({ address: 'Paris' });
    await flushPromises();
    expect(drawPoint).toHaveBeenCalledTimes(1);
  });

  it.each(['cancel', 'unmount'])(
    'does not create a point after %s during a lookup',
    async (action) => {
      const lookup = Promise.withResolvers<ReverseGeocodeResult>();
      vi.mocked(getReverseGeocodeAddress).mockReturnValueOnce(lookup.promise);
      await clickButton('Add');
      const signal = vi.mocked(getReverseGeocodeAddress).mock.calls[0]?.[2];
      if (action === 'cancel') await clickButton('Cancel');
      else wrapper.unmount();
      expect(signal?.aborted).toBe(true);
      lookup.resolve({ address: 'Paris' });
      await flushPromises();
      expect(drawPoint).not.toHaveBeenCalled();
    }
  );

  it.each(['', ', 2', '48,', '48abc, 2', 'Infinity, 2', '91, 2', '48, 181'])(
    'rejects invalid coordinates %s before geocoding',
    async (coordinates) => {
      await wrapper.findAllComponents(VTextField)[1]!.setValue(coordinates);
      await clickButton('Add');
      expect(getReverseGeocodeAddress).not.toHaveBeenCalled();
      expect(drawPoint).not.toHaveBeenCalled();
      expect(useUIStore().isModalOpen('pointModal')).toBe(true);
    }
  );
});
