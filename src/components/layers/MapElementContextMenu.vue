<template>
  <LayerContextMenu
    v-model="open"
    :element-id="selection.elementId"
    :element-type="selection.elementType"
    :position="selection.position"
    @delete="drawing.deleteElement"
    @edit="edit"
  />
</template>

<script setup lang="ts">
import type { MapElementSelection } from '@/composables/useMapEventHandlers';
import { ref, watch } from 'vue';
import { useDrawingContext } from '@/composables/mapContext';
import { useLayersStore } from '@/stores/layers';
import { useUIStore } from '@/stores/ui';
import LayerContextMenu from './LayerContextMenu.vue';

const props = defineProps<{ selection: MapElementSelection }>();
const open = ref(true);
const drawing = useDrawingContext();
const ui = useUIStore();
const layers = useLayersStore();
watch(
  () => props.selection,
  () => {
    open.value = true;
  }
);

function edit() {
  const { elementType, elementId } = props.selection;
  if (elementType === 'polygon') return;
  ui.startEditing(elementType, elementId);
  if (elementType === 'lineSegment') {
    const line = layers.lineSegments.find((item) => item.id === elementId);
    if (!line) return;
    const modals = {
      coordinate: 'twoPointsLineModal',
      azimuth: 'azimuthLineModal',
      intersection: 'intersectionLineModal',
      parallel: 'parallelLineModal',
    };
    ui.openModal(modals[line.mode]);
  } else {
    ui.openModal(`${elementType}Modal`);
  }
}
</script>
