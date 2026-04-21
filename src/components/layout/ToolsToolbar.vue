<template>
  <Transition name="tools-toolbar">
    <div
      v-if="
        uiStore.tools.isToolbarOpen &&
        !uiStore.animationState.isPlaying &&
        !uiStore.viewCaptureState.isCapturing
      "
      class="tools-toolbar"
    >
      <v-btn
        :aria-label="$t('tools.ruler')"
        color="surface-bright"
        elevation="4"
        icon
        size="small"
        :title="$t('tools.ruler')"
        @click="selectRuler"
      >
        <v-icon>mdi-ruler</v-icon>
      </v-btn>
    </div>
  </Transition>
</template>

<script lang="ts" setup>
import { useUIStore } from '@/stores/ui';

const uiStore = useUIStore();

function selectRuler() {
  uiStore.startTool('ruler');
}
</script>

<style scoped>
.tools-toolbar {
  position: fixed;
  right: 16px;
  bottom: 80px;
  z-index: 1049;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 28px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.tools-toolbar-enter-active,
.tools-toolbar-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.tools-toolbar-enter-from,
.tools-toolbar-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
