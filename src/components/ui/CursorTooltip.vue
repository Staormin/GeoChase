<template>
  <div
    v-if="tooltip.visible"
    class="cursor-tooltip"
    :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
  >
    <div class="cursor-tooltip-content">
      <div class="cursor-tooltip-row">
        <span class="cursor-tooltip-label">{{ $t('common.distance') }}:</span>
        <span class="cursor-tooltip-value">{{ tooltip.distance }}</span>
      </div>
      <div class="cursor-tooltip-row">
        <span class="cursor-tooltip-label">{{ $t('common.azimuth') }}:</span>
        <span class="cursor-tooltip-value">{{ tooltip.azimuth }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
interface CursorTooltipData {
  visible: boolean;
  x: number;
  y: number;
  distance: string;
  azimuth: string;
}

interface Props {
  tooltip: CursorTooltipData;
}

defineProps<Props>();
</script>
<style scoped>
/* Cursor tooltip for free hand drawing */
.cursor-tooltip {
  position: fixed;
  z-index: 10000;
  pointer-events: none;
}

.cursor-tooltip-content {
  background: rgb(var(--v-theme-surface));
  border: 2px solid rgb(var(--v-theme-primary));
  border-radius: 6px;
  padding: 8px 12px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
  font-size: 13px;
  min-width: 160px;
}

.cursor-tooltip-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin: 2px 0;
}

.cursor-tooltip-label {
  color: rgba(var(--v-theme-on-surface), 0.7);
  font-weight: 500;
}

.cursor-tooltip-value {
  color: rgb(var(--v-theme-on-surface));
  font-weight: 600;
  font-family: monospace;
}
</style>
