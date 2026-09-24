<template>
  <BaseModal
    :cancel-text="$t('common.cancel')"
    :is-open="true"
    :submit-disabled="busy || !validPoints"
    :submit-text="busy ? $t('route.calculating') : $t('route.calculate')"
    :title="$t('route.title')"
    @close="close"
    @submit="submit"
  >
    <p class="text-caption mb-4">{{ $t('route.info') }}</p>

    <v-alert v-if="layers.points.length < 2" class="mb-4" type="info">{{
      $t('route.needPoints')
    }}</v-alert>

    <v-text-field
      v-model="name"
      density="compact"
      :disabled="busy"
      :label="$t('route.name')"
      variant="outlined"
    />

    <CoordinateSelector
      v-model="start"
      :disabled="busy"
      :items="items"
      :label="$t('route.start')"
    />

    <div
      v-for="(step, index) in intermediates"
      :key="step.id"
      class="d-flex align-start ga-1"
      data-testid="route-step"
    >
      <CoordinateSelector
        v-model="step.value"
        class="flex-grow-1"
        :disabled="busy"
        :items="items"
        :label="$t('route.step', { number: index + 1 })"
        style="min-width: 0"
      />

      <v-btn
        :aria-label="$t('route.moveUp', { number: index + 1 })"
        :disabled="busy || index === 0"
        icon="mdi-arrow-up"
        size="small"
        variant="text"
        @click="moveStep(index, -1)"
      />

      <v-btn
        :aria-label="$t('route.moveDown', { number: index + 1 })"
        :disabled="busy || index === intermediates.length - 1"
        icon="mdi-arrow-down"
        size="small"
        variant="text"
        @click="moveStep(index, 1)"
      />

      <v-btn
        :aria-label="$t('route.removeStep', { number: index + 1 })"
        :disabled="busy"
        icon="mdi-close"
        size="small"
        variant="text"
        @click="intermediates.splice(index, 1)"
      />
    </div>

    <v-btn
      class="mb-4"
      :disabled="busy"
      prepend-icon="mdi-plus"
      variant="text"
      @click="intermediates.push({ id: uuidv4(), value: null })"
      >{{ $t('route.addStep') }}</v-btn
    >

    <CoordinateSelector v-model="end" :disabled="busy" :items="items" :label="$t('route.end')" />

    <v-select
      v-model="profile"
      density="compact"
      :disabled="busy"
      :items="profiles"
      :label="$t('route.profile')"
      variant="outlined"
    />

    <v-select
      v-model="optimization"
      density="compact"
      :disabled="busy"
      :items="optimizations"
      :label="$t('route.optimization')"
      variant="outlined"
    />

    <v-progress-linear v-if="busy" class="mb-4" color="primary" indeterminate />
    <v-alert v-if="error" role="alert" type="error">{{ error }}</v-alert>
  </BaseModal>
</template>

<script setup lang="ts">
import type { RouteData, RouteElement } from '@/types/project';
import { v4 as uuidv4 } from 'uuid';
import { computed, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '@/components/shared/BaseModal.vue';
import CoordinateSelector from '@/components/shared/CoordinateSelector.vue';
import { useDrawingContext, useMapContext } from '@/composables/mapContext';
import { calculateRoute, routeBounds } from '@/services/routing';
import { useLayersStore } from '@/stores/layers';
import { useUIStore } from '@/stores/ui';

const { t } = useI18n();
const layers = useLayersStore();
const ui = useUIStore();
const drawing = useDrawingContext();
const map = useMapContext();
const editing = layers.routes.find((line) => line.id === ui.editingElement?.id);
const coord = (point: { lat: number; lon: number }) => `${point.lat},${point.lon}`;
const name = ref(editing?.name ?? '');
const start = ref<string | null>(editing ? coord(editing.start) : null);
const end = ref<string | null>(editing?.end ? coord(editing.end) : null);
const intermediates = ref<Array<{ id: string; value: string | null }>>(
  (editing?.intermediates ?? []).map((point) => ({ id: uuidv4(), value: coord(point) }))
);
const orderedPoints = computed(() => [
  start.value,
  ...intermediates.value.map((step) => step.value),
  end.value,
]);
const validPoints = computed(() =>
  orderedPoints.value.every(
    (value, index, points) => !!value && (index === 0 || value !== points[index - 1])
  )
);
function moveStep(index: number, direction: -1 | 1) {
  const target = index + direction;
  if (busy.value || target < 0 || target >= intermediates.value.length) return;
  [intermediates.value[index], intermediates.value[target]] = [
    intermediates.value[target]!,
    intermediates.value[index]!,
  ];
}
const profile = ref<RouteData['profile']>(editing?.profile ?? 'pedestrian');
const optimization = ref<RouteData['optimization']>(editing?.optimization ?? 'shortest');
const busy = ref(false);
const error = ref('');
let controller: AbortController | undefined;
const profiles = computed(() => [
  { title: t('route.pedestrian'), value: 'pedestrian' },
  { title: t('route.car'), value: 'car' },
]);
const optimizations = computed(() => [
  { title: t('route.shortest'), value: 'shortest' },
  { title: t('route.fastest'), value: 'fastest' },
]);
const items = computed(() => {
  const result = layers.sortedPoints.map((point) => ({
    label: point.name,
    value: coord(point.coordinates),
  }));
  for (const value of orderedPoints.value) {
    if (value && !result.some((item) => item.value === value)) result.push({ label: value, value });
  }
  return result;
});
function close() {
  controller?.abort();
  ui.closeModal('routeModal');
  ui.stopEditing();
}
onBeforeUnmount(() => controller?.abort());
async function submit() {
  if (busy.value) return;
  if (!start.value || !end.value || !validPoints.value) {
    error.value = t('route.invalid');
    return;
  }
  const parse = (value: string) => {
    const [lat, lon] = value.split(',').map(Number);
    return { lat: lat!, lon: lon! };
  };
  const center = parse(start.value);
  const endpoint = parse(end.value);
  const waypoints = intermediates.value.map((step) => parse(step.value!));
  const routeName =
    name.value.trim() ||
    `${t('route.title')} · ${items.value.find((item) => item.value === start.value)?.label} → ${items.value.find((item) => item.value === end.value)?.label}`;
  controller = new AbortController();
  const request = controller;
  const timeout = window.setTimeout(() => request.abort(), 30_000);
  busy.value = true;
  error.value = '';
  try {
    const route = await calculateRoute(
      center,
      endpoint,
      profile.value,
      optimization.value,
      request.signal,
      waypoints
    );
    if (request.signal.aborted) return;
    const routeElement: RouteElement = {
      ...editing,
      id: editing?.id ?? uuidv4(),
      name: routeName,
      ...route,
      start: center,
      end: endpoint,
      intermediates: waypoints,
      color: editing?.color ?? '#1976D2',
    };
    if (editing) layers.updateRoute(routeElement.id, routeElement);
    else layers.addRoute(routeElement);
    if (ui.isElementVisible('route', routeElement.id)) drawing.redrawRoute(routeElement);
    map.flyToBoundsWithPanels(routeBounds(route));
    ui.addToast(t('route.created'), 'success');
    close();
  } catch (error_) {
    error.value =
      error_ instanceof Error && error_.message === 'rateLimit'
        ? t('route.rateLimit')
        : t('route.failed');
  } finally {
    window.clearTimeout(timeout);
    busy.value = false;
  }
}
</script>
