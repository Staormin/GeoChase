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
    <v-btn
      :aria-label="$t('map.zoomIn')"
      :disabled="scaleLocked"
      icon="mdi-plus"
      variant="text"
      @click="zoomBy(1)"
    />

    <span class="map-controls-separator" />

    <v-btn
      :aria-label="$t('map.zoomOut')"
      :disabled="scaleLocked"
      icon="mdi-minus"
      variant="text"
      @click="zoomBy(-1)"
    />

    <div
      v-if="uiStore.mapProvider !== 'image' && scaleDenominator !== null"
      class="map-scale-controls"
    >
      <v-menu
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
            :disabled="scaleLocked"
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

      <button
        :aria-label="$t(scaleLocked ? 'map.unlockScale' : 'map.lockScale')"
        :aria-pressed="scaleLocked"
        class="map-scale-lock"
        :class="{ 'map-scale-locked': scaleLocked }"
        data-testid="map-scale-lock"
        :title="$t(scaleLocked ? 'map.unlockScale' : 'map.lockScale')"
        type="button"
        @click="toggleScaleLock"
      >
        <v-icon :icon="scaleLocked ? 'mdi-lock' : 'mdi-lock-open-variant-outline'" size="16" />
      </button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { DoubleClickZoom, DragZoom, KeyboardZoom, MouseWheelZoom, PinchZoom } from 'ol/interaction';
import { getPointResolution } from 'ol/proj';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMapContext } from '@/composables/mapContext';
import { useProjectsStore } from '@/stores/projects';
import { useUIStore } from '@/stores/ui';
const mapContainer = useMapContext();
const uiStore = useUIStore();
const projectsStore = useProjectsStore();
const { locale } = useI18n();
const scaleDenominator = ref<number | null>(null);
const lockedScale = ref<number | null>(null);
const scaleLocked = computed(() => lockedScale.value !== null);
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
  if (scaleLocked.value) return;
  const resolution = resolutionForScale(denominator);
  if (resolution === null) return;
  mapContainer.map.value?.getView().animate({
    resolution,
    duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180,
  });
  scaleMenuOpen.value = false;
}

function toggleScaleLock() {
  scaleMenuOpen.value = false;
  mapContainer.map.value?.getView().cancelAnimations();
  lockedScale.value = scaleLocked.value ? null : scaleDenominator.value;
}

// A new project or an image map must keep its own viewport and zoom controls.
watch(
  () => [projectsStore.activeProjectId, uiStore.mapProvider === 'image'],
  () => {
    lockedScale.value = null;
  },
  { flush: 'sync' }
);

watch(
  [mapContainer.map, scaleLocked],
  ([map, locked], _, onCleanup) => {
    if (!map || !locked) return;
    const interactions = map
      .getInteractions()
      .getArray()
      .filter(
        (interaction) =>
          interaction instanceof DoubleClickZoom ||
          interaction instanceof DragZoom ||
          interaction instanceof KeyboardZoom ||
          interaction instanceof MouseWheelZoom ||
          interaction instanceof PinchZoom
      );
    const activeStates = interactions.map((interaction) => interaction.getActive());
    for (const interaction of interactions) interaction.setActive(false);
    onCleanup(() => {
      for (const [index, interaction] of interactions.entries())
        interaction.setActive(activeStates[index]!);
    });
  },
  { flush: 'sync' }
);

watch(
  mapContainer.map,
  (map, _, onCleanup) => {
    scaleDenominator.value = null;
    lockedScale.value = null;
    if (!map) return;

    const updateScale = () => {
      const view = map.getView();
      const center = view.getCenter();
      const resolution = view.getResolution();
      if (!center || resolution === undefined) {
        scaleDenominator.value = null;
        return;
      }

      if (lockedScale.value !== null) {
        // Mercator's ground scale varies with latitude: compensate when panning too.
        const lockedResolution = resolutionForScale(lockedScale.value);
        if (lockedResolution !== null) {
          if (Math.abs(resolution - lockedResolution) > lockedResolution * 1e-10) {
            view.setResolution(lockedResolution);
          }
          scaleDenominator.value = lockedScale.value;
          return;
        }
        lockedScale.value = null;
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
  if (scaleLocked.value) return;
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
.map-scale-controls {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  color: var(--text);
  background: var(--bg);
  border: 1px solid var(--gc-border);
  border-radius: 10px;
  box-shadow: 0 2px 8px #20374514;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  line-height: 18px;
  white-space: nowrap;
  overflow: hidden;
}
.map-scale,
.map-scale-lock {
  appearance: none;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  padding: 0;
  color: inherit;
  background: transparent;
  border: 0;
  border-radius: 7px;
  font: inherit;
  cursor: pointer;
}
.map-scale {
  padding: 0 7px;
  font-weight: 500;
}
.map-scale-lock {
  flex: 0 0 28px;
  color: var(--muted);
}
.map-scale:disabled {
  cursor: default;
}
.map-scale-locked {
  color: var(--accent);
  background: var(--gc-hover);
}
.map-scale:not(:disabled):hover,
.map-scale-lock:hover {
  background: var(--gc-hover);
}
.map-scale:focus-visible,
.map-scale-lock:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
@media (pointer: coarse) {
  .map-controls {
    width: 48px;
  }
  .map-controls .v-btn {
    height: 44px;
  }
  .map-controls-with-scale {
    bottom: 120px;
  }
  .map-controls-with-tools.map-controls-with-scale {
    bottom: 188px;
  }
  .map-scale,
  .map-scale-lock {
    min-height: 36px;
  }
  .map-scale-lock {
    min-width: 36px;
    flex-basis: 36px;
  }
}
</style>
