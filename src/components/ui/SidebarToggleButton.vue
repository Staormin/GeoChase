<template>
  <v-btn
    v-if="!uiStore.animationState.isPlaying"
    :aria-label="modelValue ? 'Close sidebar' : 'Open sidebar'"
    :aria-pressed="modelValue"
    class="sidebar-toggle"
    color="surface-bright"
    elevation="4"
    icon
    size="small"
    :style="{
      position: 'fixed',
      top: '50%',
      left: modelValue ? `${sidebarWidth + 8}px` : '8px',
      transform: 'translateY(-50%)',
      zIndex: 1050,
      transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    }"
    @click="$emit('update:modelValue', !modelValue)"
  >
    <v-icon>{{ modelValue ? 'mdi-chevron-left' : 'mdi-chevron-right' }}</v-icon>
  </v-btn>
</template>

<script lang="ts" setup>
import { useUIStore } from '@/stores/ui';

interface Props {
  modelValue: boolean;
  sidebarWidth: number;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
}

defineProps<Props>();
defineEmits<Emits>();

const uiStore = useUIStore();
</script>

<style scoped>
.sidebar-toggle {
  width: 32px;
  height: 32px;
}

@media (pointer: coarse) {
  .sidebar-toggle {
    width: 44px;
    height: 44px;
  }
}
</style>
