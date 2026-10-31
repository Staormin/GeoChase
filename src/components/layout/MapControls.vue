<template>
  <div
    v-if="!uiStore.gameMode"
    :aria-label="$t('workspace.mapNavigation')"
    class="map-controls"
    :class="{
      'map-controls-with-tools': uiStore.tools.isToolbarOpen,
      'map-controls-with-scale': uiStore.mapProvider !== 'image' && scaleDenominator !== null,
    }"
    role="group"
  >
    <v-btn :aria-label="$t('map.zoomIn')" icon="mdi-plus" variant="text" @click="zoomBy(1)" />
    <span class="map-controls-separator" />
    <v-btn :aria-label="$t('map.zoomOut')" icon="mdi-minus" variant="text" @click="zoomBy(-1)" />

    <v-menu
      v-if="uiStore.mapProvider !== 'image' && scaleDenominator !== null"
      v-model="scaleMenuOpen"
      :close-on-content-click="false"
      location="top end"
      :offset="8"
    >
      <template #activator="{ props }">
        <button
          v-bind="props"
          :aria-label="`${$t('map.scale')} ${scaleLabel}`"
          class="map-scale"
          data-testid="map-scale"
          :title="$t('map.scale')"
          type="button"
        >
          {{ scaleLabel }}
        </button>
      </template>

      <v-card width="260">
        <v-list density="compact">
          <v-list-item
            v-for="denominator in [25000, 1000000]"
            :key="denominator"
            :title="`1:${denominator.toLocaleString(locale)}`"
            @click="setScale(denominator)"
          />
        </v-list>

        <v-divider />

        <form class="pa-3" @submit.prevent="setScale(customScaleDenominator)">
          <v-text-field
            v-model="customScale"
            density="compact"
            :error-messages="customScale && !customScaleValid ? $t('map.invalidScale') : []"
            inputmode="numeric"
            :label="$t('map.customScale')"
            prefix="1:"
            variant="outlined"
          />

          <v-btn block color="primary" :disabled="!customScaleValid" type="submit">
            {{ $t('common.apply') }}
          </v-btn>
        </form>
      </v-card>
    </v-menu>
  </div>
</template>
<script setup lang="ts">
import { getPointResolution } from 'ol/proj';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMapContext } from '@/composables/mapContext';
import { useUIStore } from '@/stores/ui';
const mapContainer = useMapContext();
const uiStore = useUIStore();
const { locale } = useI18n();
const scaleDenominator = ref<number | null>(null);
const scaleLabel = computed(() => `1:${scaleDenominator.value?.toLocaleString(locale.value)}`);
const scaleMenuOpen = ref(false);
const customScale = ref('');
const customScaleDenominator = computed(() => {
  const digits = customScale.value.replace(/\s/g, '');
  return /^\d+$/.test(digits) ? Number(digits) : Number.NaN;
});
const customScaleValid = computed(() => {
  // Recheck the zoom limits when the map moves while the menu is open.
  if (scaleDenominator.value === null) return false;
  return resolutionForScale(customScaleDenominator.value) !== null;
});

watch(scaleMenuOpen, (open) => {
  if (open) customScale.value = String(scaleDenominator.value ?? '');
});

function resolutionForScale(denominator: number): number | null {
  const view = mapContainer.map.value?.getView();
  const center = view?.getCenter();
  if (!view || !center || !Number.isSafeInteger(denominator) || denominator < 1) return null;
  const metersPerMapUnit = getPointResolution(view.getProjection(), 1, center, 'm');
  const resolution = (denominator * 0.0254) / (96 * metersPerMapUnit);
  return resolution >= view.getMinResolution() && resolution <= view.getMaxResolution()
    ? resolution
    : null;
}

function setScale(denominator: number) {
  const resolution = resolutionForScale(denominator);
  if (resolution === null) return;
  mapContainer.map.value?.getView().animate({
    resolution,
    duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180,
  });
  scaleMenuOpen.value = false;
}

watch(
  mapContainer.map,
  (map, _, onCleanup) => {
    scaleDenominator.value = null;
    if (!map) return;

    const updateScale = () => {
      const view = map.getView();
      const center = view.getCenter();
      const resolution = view.getResolution();
      if (!center || resolution === undefined) {
        scaleDenominator.value = null;
        return;
      }

      const metersPerPixel = getPointResolution(view.getProjection(), resolution, center, 'm');
      // CSS reference pixels use 96 pixels per inch, independently of device pixel ratio.
      const denominator = (metersPerPixel * 96) / 0.0254;
      scaleDenominator.value = Number.isFinite(denominator)
        ? Math.max(1, Math.round(denominator))
        : null;
    };

    updateScale();
    map.on('postrender', updateScale);
    onCleanup(() => map.un('postrender', updateScale));
  },
  { immediate: true }
);

function zoomBy(delta: number) {
  const view = mapContainer?.map.value?.getView();
  if (!view) return;
  const zoom = Math.max(
    view.getMinZoom(),
    Math.min(view.getMaxZoom(), (view.getZoom() ?? 6) + delta)
  );
  view.animate({
    zoom,
    duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180,
  });
}
</script>
<style scoped>
.map-controls {
  position: fixed;
  right: 16px;
  bottom: 76px;
  z-index: 1048;
  display: flex;
  flex-direction: column;
  width: 40px;
  padding: 0;
  background: var(--bg);
  border: 1px solid var(--gc-border);
  border-radius: 13px;
  box-shadow: 0 4px 20px #2037451a;
}
.map-controls .v-btn {
  width: 100%;
  height: 40px;
}
.map-controls-separator {
  height: 1px;
  margin: 0 8px;
  background: var(--gc-border);
}
.map-controls-with-tools {
  bottom: 144px;
}
.map-controls-with-scale {
  bottom: 112px;
}
.map-controls-with-tools.map-controls-with-scale {
  bottom: 180px;
}
.map-scale {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  padding: 4px 8px;
  color: var(--text);
  background: var(--bg);
  border: 1px solid var(--gc-border);
  border-radius: 6px;
  box-shadow: 0 4px 20px #2037451a;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  line-height: 18px;
  white-space: nowrap;
  cursor: pointer;
}
.map-scale:hover {
  background: var(--gc-hover);
}
.map-scale:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
@media (pointer: coarse) {
  .map-controls {
    width: 48px;
  }
  .map-controls .v-btn {
    height: 44px;
  }
  .map-scale {
    min-height: 36px;
  }
}
</style>
