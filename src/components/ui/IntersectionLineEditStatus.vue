<template>
  <div
    v-if="ui.intersectionLineEdit"
    class="intersection-edit-status"
    data-testid="intersection-edit-status"
    role="status"
  >
    <strong>{{ $t('intersectionEdit.title', { name: ui.intersectionLineEdit.name }) }}</strong>

    <div>
      {{
        $t('intersectionEdit.distance', { distance: ui.intersectionLineEdit.distanceKm.toFixed(3) })
      }}
    </div>

    <div
      v-if="ui.intersectionLineEdit.snappedTo"
      class="text-success"
      data-testid="intersection-snap-status"
    >
      {{ $t('intersectionEdit.snapped', { name: ui.intersectionLineEdit.snappedTo }) }}
    </div>

    <div class="text-caption">{{ $t('intersectionEdit.instructions') }}</div>

    <v-btn
      data-testid="cancel-intersection-edit"
      size="small"
      variant="text"
      @click="ui.intersectionLineEdit = null"
    >
      {{ $t('common.cancel') }}
    </v-btn>
  </div>
</template>

<script setup lang="ts">
import { useUIStore } from '@/stores/ui';
const ui = useUIStore();
</script>

<style scoped>
.intersection-edit-status {
  position: fixed;
  z-index: 1050;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  width: max-content;
  max-width: calc(100vw - 120px);
  padding: 10px 16px;
  border: 2px solid rgb(var(--v-theme-primary));
  border-radius: 8px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  box-shadow: 0 4px 12px #0005;
  text-align: center;
  overflow-wrap: anywhere;
}
</style>
