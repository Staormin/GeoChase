<template>
  <div class="image-overlay-mount">
    <div ref="anchor" class="image-anchor" @contextmenu.stop.prevent>
      <div
        v-if="url"
        v-show="visible"
        :aria-label="selected ? $t('imageElement.manipulate', { name: image.name }) : undefined"
        class="map-image"
        :class="{ 'map-image-selected': selected, 'map-image-highlighted': highlighted }"
        :data-image-id="image.id"
        :role="selected ? 'group' : undefined"
        :style="imageStyle"
        :tabindex="selected ? 0 : -1"
        @click.stop
        @keydown="handleKey"
        @lostpointercapture="cancel"
        @pointercancel="cancel"
        @pointerdown="start($event, 'move')"
        @pointermove="move"
        @pointerup="finish"
      >
        <img
          :alt="image.name"
          draggable="false"
          :src="url"
          :style="{ opacity: opacityPreview ?? placement.opacity }"
          @dragstart.prevent
        />

        <template v-if="selected && interactive">
          <button
            v-for="handle in imageHandles"
            :key="handle.join(',')"
            :aria-label="$t('imageElement.resize')"
            class="image-resize-handle"
            :data-image-handle="handle.join(',')"
            :style="{ left: `${(handle[0] + 1) * 50}%`, top: `${(handle[1] + 1) * 50}%` }"
            :title="$t('imageElement.resize')"
            type="button"
            @pointerdown.stop="start($event, 'resize', handle)"
          />

          <button
            :aria-label="$t('imageElement.rotate')"
            class="image-rotate-handle"
            data-image-handle="rotate"
            :title="$t('imageElement.rotate')"
            type="button"
            @pointerdown.stop="start($event, 'rotate')"
          >
            <v-icon icon="mdi-rotate-right" size="20" />
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import type { ImageHandle } from '@/services/imageElements';
import type { ImageElement } from '@/types/project';
import Overlay from 'ol/Overlay';
import { fromLonLat, toLonLat } from 'ol/proj';
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMapContext } from '@/composables/mapContext';
import { readImageAsset } from '@/services/imageAssets';
import { imageHandles, resizeImage } from '@/services/imageElements';
import { useLayersStore } from '@/stores/layers';
import { useUIStore } from '@/stores/ui';

const props = defineProps<{
  image: ImageElement;
  opacityPreview?: number;
  rotationPreview?: number;
}>();
const mapContainer = useMapContext();
const ui = useUIStore();
const layers = useLayersStore();
const { t } = useI18n();
const anchor = ref<HTMLElement | null>(null);
const url = ref('');
const preview = shallowRef<ImageElement | null>(null);
const resolution = ref(1);
const viewRotation = ref(0);
// Pointer gestures are stopped by start(); wheel events must reach the map so
// zoom remains available over the image while its editing controls are active.
const overlay = new Overlay({ positioning: 'center-center', stopEvent: false, insertFirst: false });
overlay.set('imageElement', true);
const placement = computed(() => preview.value ?? props.image);
const selected = computed(() => ui.selectedImageId === props.image.id && interactive.value);
const visible = computed(() => ui.isElementVisible('image', props.image.id));
const interactive = computed(
  () => ui.canInteractWithLines && !ui.intersectionLineEdit && ui.drawingMode === 'none'
);
const highlighted = computed(
  () =>
    ui.sidebarHoverRequest?.elementType === 'image' &&
    ui.sidebarHoverRequest.elementId === props.image.id
);
const imageStyle = computed(() => ({
  width: `${placement.value.width / resolution.value}px`,
  height: `${placement.value.height / resolution.value}px`,
  transform: `translate(-50%, -50%) rotate(${(props.rotationPreview ?? placement.value.rotation) + (viewRotation.value * 180) / Math.PI}deg)`,
  pointerEvents: selected.value ? ('auto' as const) : ('none' as const),
}));
let gesture: {
  pointerId: number;
  target: HTMLElement;
  mode: 'move' | 'resize' | 'rotate';
  start: ImageElement;
  coordinate: number[];
  angle: number;
  handle: ImageHandle;
} | null = null;

watch(
  () => props.image.assetId,
  async (id, _, onCleanup) => {
    let disposed = false;
    let objectURL = '';
    url.value = '';
    onCleanup(() => {
      disposed = true;
      URL.revokeObjectURL(objectURL);
    });
    try {
      const blob = await readImageAsset(id);
      if (disposed) return;
      objectURL = URL.createObjectURL(blob);
      url.value = objectURL;
    } catch {
      if (!disposed) ui.addToast(t('imageElement.loadError', { name: props.image.name }), 'error');
    }
  },
  { immediate: true }
);

watch(
  [mapContainer.map, anchor],
  ([map, element], _, onCleanup) => {
    if (!map || !element) return;
    overlay.setElement(element);
    map.addOverlay(overlay);
    const update = () => {
      resolution.value = map.getView().getResolution() ?? 1;
      viewRotation.value = map.getView().getRotation();
    };
    update();
    map.on('postrender', update);
    onCleanup(() => {
      cancel();
      map.un('postrender', update);
      map.removeOverlay(overlay);
    });
  },
  { immediate: true }
);
watch(
  () => [placement.value.center.lon, placement.value.center.lat],
  ([lon, lat]) => {
    overlay.setPosition(fromLonLat([lon!, lat!]));
  },
  { immediate: true }
);
watch(
  [selected, highlighted, anchor],
  () => {
    if (anchor.value?.parentElement)
      anchor.value.parentElement.style.zIndex = selected.value || highlighted.value ? '2' : '0';
  },
  { flush: 'post' }
);
watch([selected, visible, () => props.image], () => {
  if (gesture) cancel();
});

function eventCoordinate(event: PointerEvent) {
  const map = mapContainer.map.value;
  return map?.getCoordinateFromPixel(map.getEventPixel(event));
}
function start(
  event: PointerEvent,
  mode: 'move' | 'resize' | 'rotate',
  handle: ImageHandle = [1, 1]
) {
  if (!selected.value || event.button !== 0 || ui.imageTransformActive) return;
  const coordinate = eventCoordinate(event);
  if (!coordinate) return;
  event.preventDefault();
  event.stopPropagation();
  ui.sidebarElementRequest = { elementType: 'image', elementId: props.image.id };
  const center = fromLonLat([props.image.center.lon, props.image.center.lat]);
  const target = event.currentTarget as HTMLElement;
  target.focus({ preventScroll: true });
  target.setPointerCapture(event.pointerId);
  gesture = {
    pointerId: event.pointerId,
    target,
    mode,
    handle,
    start: { ...props.image, center: { ...props.image.center } },
    coordinate,
    angle: Math.atan2(center[1]! - coordinate[1]!, coordinate[0]! - center[0]!),
  };
  ui.imageTransformActive = true;
}
function move(event: PointerEvent) {
  if (!gesture || event.pointerId !== gesture.pointerId) return;
  const coordinate = eventCoordinate(event);
  if (!coordinate) return;
  const { start: original, mode, handle } = gesture;
  const center = fromLonLat([original.center.lon, original.center.lat]);
  let next: ImageElement;
  if (mode === 'move') {
    const [lon, lat] = toLonLat([
      center[0]! + coordinate[0]! - gesture.coordinate[0]!,
      center[1]! + coordinate[1]! - gesture.coordinate[1]!,
    ]);
    next = { ...original, center: { lon: lon!, lat: lat! } };
  } else if (mode === 'resize') {
    next = {
      ...original,
      ...resizeImage(
        original,
        coordinate,
        handle,
        resolution.value * 8,
        event.shiftKey ? !original.keepAspectRatio : original.keepAspectRatio
      ),
    };
  } else {
    const angle = Math.atan2(center[1]! - coordinate[1]!, coordinate[0]! - center[0]!);
    let rotation = original.rotation + ((angle - gesture.angle) * 180) / Math.PI;
    if (event.shiftKey) rotation = Math.round(rotation / 15) * 15;
    next = { ...original, rotation: ((rotation % 360) + 360) % 360 };
  }
  if (
    Math.abs(next.center.lat) <= 85.06 &&
    Number.isFinite(next.width) &&
    Number.isFinite(next.height)
  )
    preview.value = next;
}
function release() {
  const active = gesture;
  if (!active) return;
  gesture = null;
  ui.imageTransformActive = false;
  if (active?.target.hasPointerCapture(active.pointerId))
    active.target.releasePointerCapture(active.pointerId);
}
function finish(event: PointerEvent) {
  if (!gesture || event.pointerId !== gesture.pointerId) return;
  const updated = preview.value;
  release();
  // Commit once per gesture so Undo restores the complete previous placement.
  if (updated)
    layers.updateImage(props.image.id, {
      center: updated.center,
      width: updated.width,
      height: updated.height,
      rotation: updated.rotation,
    });
  preview.value = null;
}
function cancel() {
  release();
  preview.value = null;
}
function handleKey(event: KeyboardEvent) {
  if (!selected.value) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    if (gesture) cancel();
    else ui.selectedImageId = null;
    return;
  }
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) || gesture) return;
  event.preventDefault();
  event.stopPropagation();
  const delta = resolution.value * (event.shiftKey ? 10 : 1);
  const center = fromLonLat([props.image.center.lon, props.image.center.lat]);
  const dx = event.key === 'ArrowLeft' ? -delta : event.key === 'ArrowRight' ? delta : 0;
  const dy = event.key === 'ArrowDown' ? -delta : event.key === 'ArrowUp' ? delta : 0;
  const [lon, lat] = toLonLat([center[0]! + dx, center[1]! + dy]);
  if (Math.abs(lat!) <= 85.06)
    layers.updateImage(props.image.id, { center: { lon: lon!, lat: lat! } });
}
onBeforeUnmount(cancel);
</script>
<style scoped>
.image-overlay-mount {
  display: none;
}
.image-anchor {
  width: 0;
  height: 0;
}
.map-image {
  position: absolute;
  transform-origin: center;
  user-select: none;
}
.map-image-selected {
  cursor: move;
  touch-action: none;
}
.map-image img {
  display: block;
  width: 100%;
  height: 100%;
  max-width: none;
  pointer-events: none;
}
.map-image-selected,
.map-image-highlighted,
.map-image:focus-visible {
  outline: 2px solid var(--accent);
}
.image-resize-handle,
.image-rotate-handle {
  position: absolute;
  z-index: 1;
  background: var(--bg);
  border: 2px solid var(--accent);
  color: var(--accent);
  transform: translate(-50%, -50%);
  touch-action: none;
}
.image-resize-handle {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  cursor: nwse-resize;
}
.image-rotate-handle {
  top: -32px;
  left: 50%;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: grab;
  font-size: 20px;
  line-height: 20px;
}
.image-rotate-handle::after {
  content: '';
  position: absolute;
  width: 2px;
  height: 18px;
  background: var(--accent);
  left: 50%;
  top: 100%;
  pointer-events: none;
}
@media (pointer: coarse) {
  .image-resize-handle {
    width: 24px;
    height: 24px;
  }
  .image-rotate-handle {
    width: 36px;
    height: 36px;
    top: -44px;
  }
}
</style>
