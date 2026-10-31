<template>
  <div class="image-overlay-mount">
    <div ref="anchor" class="image-anchor" @contextmenu.stop.prevent>
      <div
        v-if="url"
        v-show="visible"
        :aria-label="selected ? $t('imageElement.manipulate', { name: image.name }) : undefined"
        class="map-image"
        :class="{
          'map-image-selected': selected,
          'map-image-highlighted': highlighted,
          'map-image-placing-pivot': selected && placingPivot,
        }"
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
            v-if="placement.pivot || placement.pivotPointId || placingPivot"
            :aria-label="$t('imageElement.movePivot')"
            class="image-pivot-handle"
            :class="{ 'image-pivot-linked': pivotPoint }"
            data-image-handle="pivot"
            :style="{ left: `${pivotPosition.x * 100}%`, top: `${pivotPosition.y * 100}%` }"
            :title="
              pivotPoint
                ? $t('imageElement.anchoredPivot', { name: pivotPoint.name })
                : $t('imageElement.movePivot')
            "
            type="button"
            @pointerdown.stop="start($event, 'pivot')"
          >
            <v-icon icon="mdi-crosshairs-gps" size="18" />
          </button>

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
import {
  imageHandles,
  imagePivotCoordinate,
  imagePivotFromMap,
  resizeImage,
  rotateImage,
  snapImagePivot,
} from '@/services/imageElements';
import { useLayersStore } from '@/stores/layers';
import { useUIStore } from '@/stores/ui';

const props = defineProps<{
  image: ImageElement;
  opacityPreview?: number;
  rotationPreview?: number;
  placingPivot?: boolean;
}>();
const emit = defineEmits<{ 'pivot-placed': []; 'cancel-pivot': [] }>();
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
const placement = computed(
  () =>
    preview.value ??
    (props.rotationPreview === undefined
      ? props.image
      : { ...props.image, ...rotateImage(props.image, props.rotationPreview, layers.points) })
);
const pivotPosition = computed(() =>
  imagePivotFromMap(placement.value, imagePivotCoordinate(placement.value, layers.points), false)
);
const pivotPoint = computed(() =>
  layers.points.find((point) => point.id === placement.value.pivotPointId)
);
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
  transform: `translate(-50%, -50%) rotate(${placement.value.rotation + (viewRotation.value * 180) / Math.PI}deg)`,
  pointerEvents: selected.value ? ('auto' as const) : ('none' as const),
}));
let gesture: {
  pointerId: number;
  target: HTMLElement;
  mode: 'move' | 'resize' | 'rotate' | 'pivot';
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
    const placeFromMap = (event: { coordinate: number[] }) => {
      if (!selected.value || !props.placingPivot) return;
      layers.updateImage(props.image.id, pivotAt(props.image, event.coordinate));
      emit('pivot-placed');
    };
    map.on('singleclick', placeFromMap);
    onCleanup(() => {
      cancel();
      map.un('postrender', update);
      map.un('singleclick', placeFromMap);
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
function pivotAt(image: ImageElement, coordinate: number[]) {
  const map = mapContainer.map.value!;
  return snapImagePivot(
    image,
    coordinate,
    layers.points.filter((point) => ui.isElementVisible('point', point.id)),
    (coordinate) => map.getPixelFromCoordinate(coordinate)
  );
}
function start(
  event: PointerEvent,
  mode: 'move' | 'resize' | 'rotate' | 'pivot',
  handle: ImageHandle = [1, 1]
) {
  if (!selected.value || event.button !== 0 || ui.imageTransformActive) return;
  const coordinate = eventCoordinate(event);
  if (!coordinate) return;
  event.preventDefault();
  event.stopPropagation();
  ui.sidebarElementRequest = { elementType: 'image', elementId: props.image.id };
  const target = event.currentTarget as HTMLElement;
  target.focus({ preventScroll: true });
  if (props.placingPivot && mode !== 'pivot') {
    layers.updateImage(props.image.id, pivotAt(props.image, coordinate));
    emit('pivot-placed');
    return;
  }
  const pivot = imagePivotCoordinate(props.image, layers.points);
  target.setPointerCapture(event.pointerId);
  gesture = {
    pointerId: event.pointerId,
    target,
    mode,
    handle,
    start: { ...props.image, center: { ...props.image.center } },
    coordinate,
    angle: Math.atan2(pivot[1]! - coordinate[1]!, coordinate[0]! - pivot[0]!),
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
  switch (mode) {
    case 'move': {
      const [lon, lat] = toLonLat([
        center[0]! + coordinate[0]! - gesture.coordinate[0]!,
        center[1]! + coordinate[1]! - gesture.coordinate[1]!,
      ]);
      next = { ...original, center: { lon: lon!, lat: lat! } };

      break;
    }
    case 'pivot': {
      next = { ...original, ...pivotAt(original, coordinate) };

      break;
    }
    case 'resize': {
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

      break;
    }
    default: {
      const pivot = imagePivotCoordinate(original, layers.points);
      const angle = Math.atan2(pivot[1]! - coordinate[1]!, coordinate[0]! - pivot[0]!);
      let rotation = original.rotation + ((angle - gesture.angle) * 180) / Math.PI;
      if (event.shiftKey) rotation = Math.round(rotation / 15) * 15;
      next = { ...original, ...rotateImage(original, rotation, layers.points) };
    }
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
  const movedPivot = gesture.mode === 'pivot';
  const updated =
    preview.value ??
    (movedPivot ? { ...gesture.start, ...pivotAt(gesture.start, gesture.coordinate) } : null);
  release();
  // Commit once per gesture so Undo restores the complete previous placement.
  if (updated)
    layers.updateImage(props.image.id, {
      center: updated.center,
      width: updated.width,
      height: updated.height,
      rotation: updated.rotation,
      pivot: updated.pivot,
      pivotPointId: updated.pivotPointId,
    });
  preview.value = null;
  if (movedPivot) emit('pivot-placed');
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
    else if (props.placingPivot) emit('cancel-pivot');
    else ui.selectedImageId = null;
    return;
  }
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) || gesture) return;
  event.preventDefault();
  event.stopPropagation();
  if ((event.target as HTMLElement).closest('[data-image-handle="pivot"]')) {
    const pivot = pivotPosition.value;
    const step = resolution.value * (event.shiftKey ? 10 : 1);
    layers.updateImage(props.image.id, {
      pivotPointId: undefined,
      pivot: {
        x:
          pivot.x +
          (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0) /
            props.image.width,
        y:
          pivot.y +
          (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0) /
            props.image.height,
      },
    });
    return;
  }
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
.map-image-placing-pivot {
  cursor: crosshair;
}
.image-pivot-handle {
  position: absolute;
  z-index: 2;
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  padding: 0;
  transform: translate(-50%, -50%);
  border: 0;
  background: transparent;
  color: var(--accent);
  cursor: grab;
  touch-action: none;
}
.image-pivot-linked {
  color: var(--text);
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
  display: grid;
  place-items: center;
  padding: 0;
  border-radius: 50%;
  cursor: grab;
}
.image-rotate-handle::after {
  content: '';
  position: absolute;
  width: 2px;
  height: 18px;
  background: var(--accent);
  left: 50%;
  top: 100%;
  transform: translateX(-50%);
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
