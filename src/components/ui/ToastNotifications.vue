<template>
  <v-snackbar
    v-for="toast in uiStore.toasts"
    :key="toast.id"
    :color="toast.type"
    :model-value="true"
    @update:model-value="uiStore.removeToast(toast.id)"
  >
    {{ toast.message }}
  </v-snackbar>
</template>

<script lang="ts" setup>
import { useUIStore } from '@/stores/ui';

const uiStore = useUIStore();
</script>
