<template>
  <ImageElementOverlay
    v-for="image in layers.images"
    :key="image.id"
    :image="image"
    :opacity-preview="selected?.id === image.id ? opacity / 100 : undefined"
    :rotation-preview="selected?.id === image.id ? rotationPreview : undefined"
  />

  <div
    v-if="selected && ui.canInteractWithLines"
    :aria-label="$t('imageElement.edit')"
    class="image-edit-bar"
    role="group"
    @keydown.esc="ui.selectedImageId = null"
    @pointerdown.stop
  >
    <label class="image-name-field">
      <span>{{ $t('common.name') }}</span>

      <input
        :key="selected.id"
        :aria-label="$t('imageElement.name')"
        :value="selected.name"
        @change="rename"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
      />
    </label>

    <label class="image-opacity-field">
      <span>{{ $t('imageElement.opacityValue', { value: opacity }) }}</span>

      <input
        v-model.number="opacity"
        :aria-label="$t('imageElement.opacity')"
        max="100"
        min="0"
        step="1"
        type="range"
        @change="layers.updateImage(selected.id, { opacity: opacity / 100 })"
      />
    </label>

    <label class="image-rotation-field">
      <span>{{ $t('imageElement.rotation') }}</span>

      <input
        :aria-label="$t('imageElement.rotation')"
        step="1"
        type="number"
        :value="rotationInput"
        @blur="rotate"
        @change="rotate"
        @input="previewRotation"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
        @wheel.stop.prevent="wheelRotate"
      />
    </label>

    <v-btn
      :aria-label="$t('imageElement.keepAspectRatio')"
      :aria-pressed="selected.keepAspectRatio"
      :color="selected.keepAspectRatio ? 'primary' : undefined"
      :icon="selected.keepAspectRatio ? 'mdi-link-variant' : 'mdi-link-variant-off'"
      size="small"
      :title="$t('imageElement.keepAspectRatio')"
      variant="text"
      @click="layers.updateImage(selected.id, { keepAspectRatio: !selected.keepAspectRatio })"
    />

    <v-btn color="primary" size="small" @click="ui.selectedImageId = null">{{
      $t('imageElement.done')
    }}</v-btn>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useMapContext } from '@/composables/mapContext';
import { useLayersStore } from '@/stores/layers';
import { useProjectsStore } from '@/stores/projects';
import { useUIStore } from '@/stores/ui';
import ImageElementOverlay from './ImageElementOverlay.vue';
const layers = useLayersStore();
const ui = useUIStore();
const projects = useProjectsStore();
const mapContainer = useMapContext();
const selected = computed(() =>
  layers.images.find(
    (image) => image.id === ui.selectedImageId && ui.isElementVisible('image', image.id)
  )
);
const opacity = ref(100);
const rotationPreview = ref<number>();
const rotationInput = ref('0');
watch(
  () => [selected.value?.id, selected.value?.rotation],
  () => {
    rotationPreview.value = undefined;
    rotationInput.value = String(Math.round((selected.value?.rotation ?? 0) * 10) / 10);
  },
  { immediate: true }
);
watch(
  () => [selected.value?.id, selected.value?.opacity],
  () => {
    opacity.value = Math.round((selected.value?.opacity ?? 1) * 100);
  },
  { immediate: true }
);
watch(
  () => projects.activeProjectId,
  () => {
    ui.selectedImageId = null;
  }
);
watch(
  mapContainer.map,
  (map, _, onCleanup) => {
    if (!map) return;
    const deselect = () => {
      ui.selectedImageId = null;
    };
    map.on('singleclick', deselect);
    onCleanup(() => map.un('singleclick', deselect));
  },
  { immediate: true }
);
function rename(event: Event) {
  if (!selected.value) return;
  const input = event.target as HTMLInputElement;
  const name = input.value.trim() || selected.value.name;
  layers.updateImage(selected.value.id, { name });
  input.value = name;
}
function rotate(event: Event) {
  if (!selected.value) return;
  const input = event.target as HTMLInputElement;
  const value = input.valueAsNumber;
  if (Number.isFinite(value))
    layers.updateImage(selected.value.id, { rotation: ((value % 360) + 360) % 360 });
  input.value = String(Math.round(selected.value.rotation * 10) / 10);
  rotationInput.value = input.value;
  rotationPreview.value = undefined;
}
function previewRotation(event: Event) {
  const input = event.target as HTMLInputElement;
  rotationInput.value = input.value;
  const value = input.valueAsNumber;
  rotationPreview.value = Number.isFinite(value) ? value : undefined;
}
function wheelRotate(event: WheelEvent) {
  if (!selected.value || event.deltaY === 0) return;
  const input = event.target as HTMLInputElement;
  input.focus({ preventScroll: true });
  if (!Number.isFinite(input.valueAsNumber)) input.value = String(selected.value.rotation);
  if (event.deltaY < 0) input.stepUp();
  else input.stepDown();
  previewRotation(event);
}
</script>
<style scoped>
.image-edit-bar {
  position: fixed;
  z-index: 1050;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  max-width: calc(100vw - 110px);
  padding: 10px;
  background: var(--bg);
  border: 1px solid var(--gc-border);
  border-radius: 12px;
  box-shadow: 0 4px 20px #2037451a;
}
.image-edit-bar label {
  display: grid;
  gap: 2px;
  font-size: 11px;
  color: var(--muted);
}
.image-edit-bar input {
  color: var(--text);
  font-size: 13px;
  min-width: 0;
  width: 100%;
}
.image-edit-bar input:not([type='range']) {
  border: 1px solid var(--gc-border);
  border-radius: 4px;
  padding: 3px 6px;
  background: var(--bg);
}
.image-name-field {
  width: 170px;
}
.image-opacity-field {
  width: 110px;
}
.image-rotation-field {
  width: 65px;
}
@media (max-width: 700px) {
  .image-edit-bar {
    left: 12px;
    right: 76px;
    max-width: none;
    transform: none;
    gap: 8px;
  }
  .image-name-field {
    width: 100%;
  }
  .image-opacity-field {
    flex: 1;
  }
}
</style>
