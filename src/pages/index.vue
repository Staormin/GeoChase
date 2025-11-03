<template>
  <!-- Top bar (only shown when not in navigation/free hand mode) -->
  <TopBar />

  <!-- Navigation bar (shown during navigation/free hand modes) -->
  <NavigationBar />

  <!-- Fullscreen map -->
  <div id="map" :class="{ 'freehand-drawing': uiStore.freeHandDrawing.isDrawing }" />

  <!-- Sidebar -->
  <v-navigation-drawer
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
  <SidebarToggleButton v-model="sidebarOpen" />

  <!-- Modals -->
  <ModalsContainer />
  <AnimationCountdown />

  <!-- Toast notifications -->
  <ToastNotifications />

  <!-- Free hand drawing cursor tooltip -->
  <CursorTooltip :tooltip="cursorTooltip" />

  <!-- Precision mode indicator -->
  <PrecisionModeIndicator :precision-lens="precisionLens" />
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
import { useAnimation } from '@/composables/useAnimation';
import { useAppSetup } from '@/composables/useAppSetup';
import { useAutoSave } from '@/composables/useAutoSave';
import { useDrawing } from '@/composables/useDrawing';
import { useMap } from '@/composables/useMap';
import { usePrecisionLens } from '@/composables/usePrecisionLens';
import { useUIStore } from '@/stores/ui';

const uiStore = useUIStore();

const mapContainer = useMap('map');
const drawing = useDrawing(mapContainer);
const precisionLens = usePrecisionLens(mapContainer);

// Create a ref for note tooltips (will be initialized after map is ready)
const noteTooltipsRef = ref<ReturnType<typeof useNoteTooltips> | null>(null);

// Provide the map container, drawing functions, and note tooltips to all child components
provide('mapContainer', mapContainer);
provide('drawing', drawing);
provide('noteTooltips', noteTooltipsRef);

const sidebarOpen = ref(true);
watch(
  () => uiStore.sidebarOpen,
  (newValue) => {
    sidebarOpen.value = newValue;
  }
);

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
onMounted(useAppSetup(mapContainer, drawing, noteTooltipsRef, cursorTooltip));
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
  letter-spacing: 0.5px;
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

:global(.leaflet-container) {
  background: rgb(var(--v-theme-background));
}

:global(.leaflet-grab),
:global(.leaflet-grab:active) {
  cursor: default !important;
}

/* Cursor change for free hand drawing */
#map.freehand-drawing {
  cursor: crosshair !important;
}

#map.freehand-drawing * {
  cursor: crosshair !important;
}
</style>
