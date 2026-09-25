<template>
  <v-dialog
    v-bind="$attrs"
    ref="dialog"
    aria-modal="false"
    class="floating-dialog"
    :content-props="{
      style: { translate: `${offset.x}px ${offset.y}px` },
      onPointerdown: startDrag,
    }"
    :model-value="modelValue"
    no-click-animation
    persistent
    :retain-focus="false"
    :scrim="false"
    scroll-strategy="none"
    :transition="false"
    @after-enter="observeContent"
    @keydown.esc="closeOnEscape"
  >
    <slot />
  </v-dialog>
</template>

<script setup lang="ts">
import type { VDialog } from 'vuetify/components';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

defineOptions({ inheritAttrs: false });
const props = defineProps<{ modelValue: boolean; persistent?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();
const dialog = ref<InstanceType<typeof VDialog>>();
const offset = ref({ x: 0, y: 0 });
let observer: ResizeObserver | undefined;
let stopDrag: (() => void) | undefined;

function clampPosition(position = offset.value) {
  const rect = dialog.value?.contentEl?.getBoundingClientRect();
  if (!rect) return;
  const margin = 12;
  offset.value = {
    x: Math.max(
      margin - rect.left + offset.value.x,
      Math.min(position.x, innerWidth - margin - rect.right + offset.value.x)
    ),
    y: Math.max(
      margin - rect.top + offset.value.y,
      Math.min(position.y, innerHeight - margin - rect.bottom + offset.value.y)
    ),
  };
}

function observeContent() {
  observer?.disconnect();
  const content = dialog.value?.contentEl;
  if (!content) return;
  observer = new ResizeObserver(() => clampPosition());
  observer.observe(content);
  content.focus({ preventScroll: true });
}

function closeOnEscape(event: KeyboardEvent) {
  // Menus inside the window handle Escape themselves.
  if (event.defaultPrevented || props.persistent) return;
  emit('update:modelValue', false);
}

function startDrag(event: PointerEvent) {
  const target = event.target;
  if (!(target instanceof Element) || event.button !== 0) return;
  const title = target.closest('.v-card-title');
  if (!title || target.closest('button, input, a, select, textarea, [role="button"]')) return;
  stopDrag?.();
  event.preventDefault();
  const start = { x: event.clientX, y: event.clientY, offset: { ...offset.value } };
  title.setPointerCapture(event.pointerId);
  title.classList.add('is-dragging');
  const move = (e: Event) => {
    const pointer = e as PointerEvent;
    if (pointer.pointerId !== event.pointerId) return;
    clampPosition({
      x: start.offset.x + pointer.clientX - start.x,
      y: start.offset.y + pointer.clientY - start.y,
    });
  };
  stopDrag = () => {
    title.removeEventListener('pointermove', move);
    title.removeEventListener('pointerup', finish);
    title.removeEventListener('pointercancel', finish);
    title.removeEventListener('lostpointercapture', finish);
    if (title.hasPointerCapture(event.pointerId)) title.releasePointerCapture(event.pointerId);
    title.classList.remove('is-dragging');
    stopDrag = undefined;
  };
  const finish = () => stopDrag?.();
  title.addEventListener('pointermove', move);
  title.addEventListener('pointerup', finish);
  title.addEventListener('pointercancel', finish);
  title.addEventListener('lostpointercapture', finish);
}

watch(
  () => props.modelValue,
  () => {
    stopDrag?.();
    observer?.disconnect();
    offset.value = { x: 0, y: 0 };
  }
);
const onResize = () => clampPosition();
onMounted(() => window.addEventListener('resize', onResize));
onBeforeUnmount(() => {
  stopDrag?.();
  observer?.disconnect();
  window.removeEventListener('resize', onResize);
});
</script>

<style>
.floating-dialog .v-card-title {
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.floating-dialog .v-card-title.is-dragging {
  cursor: grabbing;
}
</style>
