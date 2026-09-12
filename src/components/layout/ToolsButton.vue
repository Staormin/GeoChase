<template>
  <v-btn
    v-if="!uiStore.animationState.isPlaying && !uiStore.viewCaptureState.isCapturing"
    :aria-label="$t('tools.toggle')"
    :aria-pressed="uiStore.tools.isToolbarOpen || !!uiStore.tools.activeTool"
    class="tools-button"
    :color="uiStore.tools.activeTool ? 'primary' : 'surface-bright'"
    elevation="6"
    icon
    size="small"
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

<style scoped>
@media (pointer: coarse) {
  .tools-button {
    width: 48px;
    height: 48px;
  }
}
</style>
