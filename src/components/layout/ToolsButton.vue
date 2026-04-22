<template>
  <v-btn
    v-if="!uiStore.animationState.isPlaying && !uiStore.viewCaptureState.isCapturing"
    :aria-label="$t('tools.toggle')"
    :aria-pressed="uiStore.tools.isToolbarOpen || !!uiStore.tools.activeTool"
    :color="uiStore.tools.activeTool ? 'primary' : 'surface-bright'"
    elevation="6"
    icon
    size="large"
    :style="{
      position: 'fixed',
      bottom: '16px',
      right: '16px',
      zIndex: 1050,
    }"
    @click="handleClick"
  >
    <v-icon>{{ uiStore.tools.activeTool ? 'mdi-close' : 'mdi-tools' }}</v-icon>
  </v-btn>
</template>

<script lang="ts" setup>
import { useUIStore } from '@/stores/ui';

const uiStore = useUIStore();

function handleClick() {
  if (uiStore.tools.activeTool) {
    uiStore.stopTool();
    return;
  }
  uiStore.toggleToolbar();
}
</script>
