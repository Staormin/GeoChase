<template>
  <v-btn
    v-if="!uiStore.animationState.isPlaying"
    :aria-label="modelValue ? 'Close sidebar' : 'Open sidebar'"
    :aria-pressed="modelValue"
    color="surface-bright"
    elevation="4"
    icon
    size="small"
    :style="{
      position: 'fixed',
      top: '50%',
      left: modelValue ? '648px' : '8px',
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
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
}

defineProps<Props>();
defineEmits<Emits>();

const uiStore = useUIStore();
</script>
