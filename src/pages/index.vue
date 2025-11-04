<template>
  <!-- Top bar (only shown when not in navigation/free hand mode or view capture mode) -->
  <TopBar v-if="!uiStore.viewCaptureState.isCapturing" />

  <!-- Navigation bar (shown during navigation/free hand modes) -->
  <NavigationBar v-if="!uiStore.viewCaptureState.isCapturing" />

  <!-- Fullscreen map -->
  <div id="map" :class="{ 'freehand-drawing': uiStore.freeHandDrawing.isDrawing }" />

  <!-- Sidebar -->
  <v-navigation-drawer
    v-if="!uiStore.viewCaptureState.isCapturing"
    v-model="sidebarOpen"
    location="left"
    style="top: 64px; height: calc(100vh - 64px)"
    :width="640"
  >
    <!-- Search Along Panel (when active) -->
    <SearchAlongPanelInline v-if="uiStore.searchAlongPanel.isOpen" />

    <!-- Normal sidebar content (when not in search mode) -->
    <SidebarLayersPanel v-else />
  </v-navigation-drawer>

  <!-- Sidebar toggle button -->
  <SidebarToggleButton v-if="!uiStore.viewCaptureState.isCapturing" v-model="sidebarOpen" />

  <!-- Modals -->
  <ModalsContainer />
  <AnimationCountdown />

  <!-- Toast notifications -->
  <ToastNotifications />

  <!-- Free hand drawing cursor tooltip -->
  <CursorTooltip :tooltip="cursorTooltip" />

  <!-- Precision mode indicator -->
  <PrecisionModeIndicator :precision-lens="precisionLens" />

  <!-- View capture helper -->
  <ViewCaptureHelper />
</template>

<script lang="ts" setup>
import type { useNoteTooltips } from '@/composables/useNoteTooltips';
import { onMounted, provide, ref, watch } from 'vue';
import NavigationBar from '@/components/layout/NavigationBar.vue';
import TopBar from '@/components/layout/TopBar.vue';
import SearchAlongPanelInline from '@/components/search/SearchAlongPanel.vue';
import AnimationCountdown from '@/components/shared/AnimationCountdown.vue';
import SidebarLayersPanel from '@/components/sidebar/SidebarLayersPanel.vue';
import CursorTooltip from '@/components/ui/CursorTooltip.vue';
import ModalsContainer from '@/components/ui/ModalsContainer.vue';
import PrecisionModeIndicator from '@/components/ui/PrecisionModeIndicator.vue';
import SidebarToggleButton from '@/components/ui/SidebarToggleButton.vue';
import ToastNotifications from '@/components/ui/ToastNotifications.vue';
import ViewCaptureHelper from '@/components/ui/ViewCaptureHelper.vue';
import { useAnimation } from '@/composables/useAnimation';
import { useAppSetup } from '@/composables/useAppSetup';
import { useAutoSave } from '@/composables/useAutoSave';
import { useDrawing } from '@/composables/useDrawing';
import { useMap } from '@/composables/useMap';
import { usePrecisionLens } from '@/composables/usePrecisionLens';
import { useViewDataSync } from '@/composables/useViewDataSync';
import { useUIStore } from '@/stores/ui';

const uiStore = useUIStore();

const mapContainer = useMap('map', uiStore);
const drawing = useDrawing(mapContainer);
const precisionLens = usePrecisionLens(mapContainer);
const viewDataSync = useViewDataSync(mapContainer);

// Create a ref for note tooltips (will be initialized after map is ready)
const noteTooltipsRef = ref<ReturnType<typeof useNoteTooltips> | null>(null);

// Provide the map container, drawing functions, and note tooltips to all child components
provide('mapContainer', mapContainer);
provide('drawing', drawing);
provide('noteTooltips', noteTooltipsRef);

const sidebarOpen = ref(true);
const topBarOpen = ref(true);

// Sync local sidebarOpen with uiStore
watch(
  () => uiStore.sidebarOpen,
  (newValue) => {
    sidebarOpen.value = newValue;
  }
);

// Sync local topBarOpen with uiStore
watch(
  () => uiStore.topBarOpen,
  (newValue) => {
    topBarOpen.value = newValue;
  }
);

// Watch local sidebarOpen and refit map when it changes
watch(sidebarOpen, async (newValue, oldValue) => {
  console.log('Sidebar state changed - Old:', oldValue, 'New:', newValue);

  // Sync to uiStore
  uiStore.sidebarOpen = newValue;

  // Refit map when sidebar opens/closes (after DOM updates)
  if (oldValue !== undefined && mapContainer.isMapInitialized.value) {
    // Wait for Vue to update the DOM
    await nextTick();

    // Force map to update its size calculation
    if (mapContainer.map.value) {
      mapContainer.map.value.updateSize();
    }

    // Refit immediately for snappy response
    console.log('Refitting map - Previous sidebar state:', oldValue, 'New state:', newValue);
    mapContainer.refitMap(oldValue, newValue, undefined, undefined);
  }
});

// Watch local topBarOpen and refit map when it changes
watch(topBarOpen, async (newValue, oldValue) => {
  console.log('Top bar state changed - Old:', oldValue, 'New:', newValue);

  // Sync to uiStore
  uiStore.topBarOpen = newValue;

  // Refit map when top bar opens/closes (after DOM updates)
  if (oldValue !== undefined && mapContainer.isMapInitialized.value) {
    // Wait for Vue to update the DOM
    await nextTick();

    // Force map to update its size calculation
    if (mapContainer.map.value) {
      mapContainer.map.value.updateSize();
    }

    // Refit immediately for snappy response
    console.log('Refitting map - Previous top bar state:', oldValue, 'New state:', newValue);
    mapContainer.refitMap(undefined, undefined, oldValue, newValue);
  }
});

// Free hand drawing cursor tooltip
const cursorTooltip = ref<{
  visible: boolean;
  x: number;
  y: number;
  distance: string;
  azimuth: string;
}>({
  visible: false,
  x: 0,
  y: 0,
  distance: '',
  azimuth: '',
});

// Auto-save logic
useAutoSave();

// Animation logic
useAnimation(mapContainer, drawing, sidebarOpen);

// Initialize map on mount
onMounted(async () => {
  await useAppSetup(mapContainer, drawing, noteTooltipsRef, cursorTooltip)();

  // Setup view data sync watchers after map is initialized
  // The initial view has already been restored during map initialization
  viewDataSync.setupWatchers();
});
</script>

<style scoped>
/* Use Vuetify theme colors via RGB */

/* Global styles for keyboard hints */
:global(.kbd-hint) {
  display: inline-block;
  padding: 2px 6px;
  margin-left: 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.4);
  color: rgba(255, 255, 255, 0.95);
  font-family: monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
}

/* Fix tooltip text color */
:global(.v-tooltip > .v-overlay__content) {
  color: rgba(255, 255, 255, 0.95) !important;
}

html,
body,
:global(#app) {
  height: 100%;
  margin: 0;
  padding: 0;
  background: rgb(var(--v-theme-background));
  overflow: hidden;
}

#map {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
}

:global(.ol-viewport) {
  background: rgb(var(--v-theme-background));
}

/* Cursor change for free hand drawing */
#map.freehand-drawing {
  cursor: crosshair !important;
}

#map.freehand-drawing * {
  cursor: crosshair !important;
}
</style>
