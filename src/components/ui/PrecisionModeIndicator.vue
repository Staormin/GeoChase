<template>
  <div v-if="precisionLens.isActive.value" class="precision-mode-indicator">
    <v-icon size="small">mdi-magnify-plus</v-icon>
    <span>Precision Mode (Z)</span>
  </div>
</template>

<script lang="ts" setup>
import type { usePrecisionLens } from '@/composables/usePrecisionLens';

interface Props {
  precisionLens: ReturnType<typeof usePrecisionLens>;
}

defineProps<Props>();
</script>

<style scoped>
/* Precision mode indicator */
.precision-mode-indicator {
  position: fixed;
  top: 80px;
  right: 16px;
  z-index: 1000;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  padding: 8px 16px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
  animation: pulse-glow 2s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%,
  100% {
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
  }
  50% {
    box-shadow: 0 4px 20px rgba(99, 102, 241, 0.7);
  }
}
</style>
