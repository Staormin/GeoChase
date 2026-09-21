<template>
  <BaseModal
    :is-open="isOpen"
    :submit-disabled="!selectedPoint || !form.lineId"
    :submit-text="$t('common.add')"
    :title="$t('modals.angleLine.title')"
    @close="closeModal"
    @submit="submitForm"
  >
    <v-form @submit.prevent="submitForm">
      <v-text-field
        v-model="form.name"
        class="mb-4"
        density="compact"
        :label="$t('modals.angleLine.lineName')"
        :placeholder="$t('modals.angleLine.lineNamePlaceholder')"
        variant="outlined"
      />

      <v-select
        v-model="form.pointId"
        class="mb-4"
        density="compact"
        :items="pointItems"
        :label="$t('modals.angleLine.startPoint')"
        variant="outlined"
      >
        <template #prepend-inner>
          <v-icon size="small">mdi-map-marker</v-icon>
        </template>
      </v-select>

      <v-select
        v-model="form.lineId"
        class="mb-4"
        density="compact"
        :disabled="referenceLines.length === 0"
        :hint="$t('modals.angleLine.referenceLineHint')"
        :items="referenceLineItems"
        :label="$t('modals.angleLine.referenceLine')"
        persistent-hint
        variant="outlined"
      />

      <v-alert
        v-if="selectedPoint && referenceLines.length === 0"
        class="mb-4"
        density="compact"
        :text="$t('modals.angleLine.noLineAtPoint')"
        type="info"
        variant="tonal"
      />

      <v-text-field
        v-model.number="form.angle"
        class="mb-4"
        density="compact"
        :hint="$t('modals.angleLine.angleHint')"
        :label="$t('modals.angleLine.angle')"
        max="360"
        min="-360"
        persistent-hint
        step="0.01"
        type="number"
        variant="outlined"
      />

      <v-text-field
        v-model.number="form.distance"
        class="mb-4"
        density="compact"
        :label="$t('modals.angleLine.distance')"
        min="0"
        step="0.1"
        type="number"
        variant="outlined"
      />

      <v-checkbox
        v-model="form.createEndpoint"
        class="mb-2"
        density="compact"
        :label="$t('modals.angleLine.createEndpoint')"
      />

      <v-text-field
        v-if="form.createEndpoint"
        v-model="form.endpointName"
        class="mb-4"
        density="compact"
        :label="$t('modals.angleLine.endpointName')"
        :placeholder="$t('modals.angleLine.endpointPlaceholder')"
        variant="outlined"
      />
    </v-form>
  </BaseModal>
</template>

<script lang="ts" setup>
import { computed, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '@/components/shared/BaseModal.vue';
import { useDrawingContext } from '@/composables/mapContext';
import { useProjectGeometry } from '@/composables/useProjectGeometry';
import { useLayersStore } from '@/stores/layers';
import { useUIStore } from '@/stores/ui';

const { destinationPoint, bearingAtPoint, isPointOnLine } = useProjectGeometry();

const { t } = useI18n();
const uiStore = useUIStore();
const layersStore = useLayersStore();
const drawing = useDrawingContext();

const isOpen = computed(() => uiStore.isModalOpen('angleLineModal'));

const form = reactive({
  name: '',
  pointId: null as string | null,
  lineId: null as string | null,
  angle: 90,
  distance: 1,
  createEndpoint: false,
  endpointName: '',
});

const pointItems = computed(() =>
  layersStore.points.map((point) => ({ title: point.name, value: point.id }))
);
const selectedPoint = computed(() => layersStore.points.find((point) => point.id === form.pointId));
const referenceLines = computed(() => {
  const point = selectedPoint.value;
  return isOpen.value && point
    ? layersStore.lineSegments.filter((line) => isPointOnLine(line, point.coordinates))
    : [];
});
const referenceLineItems = computed(() =>
  referenceLines.value.map((line) => ({ title: line.name, value: line.id }))
);

watch(referenceLines, (lines) => {
  if (!lines.some((line) => line.id === form.lineId)) {
    form.lineId = lines.length === 1 ? lines[0]!.id : null;
  }
});

watch(isOpen, (newVal) => {
  if (newVal) {
    // Reset form when opening
    form.name = '';
    form.pointId = null;
    form.lineId = null;
    form.angle = 90;
    form.distance = 1;
    form.createEndpoint = false;
    form.endpointName = '';
  }
});

function submitForm() {
  if (!form.pointId) {
    uiStore.addToast(t('modals.angleLine.selectPointError'), 'error');
    return;
  }

  const point = selectedPoint.value;
  if (!point) {
    uiStore.addToast(t('modals.angleLine.pointNotFoundError'), 'error');
    return;
  }

  const referenceLine = referenceLines.value.find((line) => line.id === form.lineId);
  if (!referenceLine) {
    uiStore.addToast(t('modals.angleLine.selectLineError'), 'error');
    return;
  }

  // Use the selected reference, since a crossing or shared endpoint belongs to several lines.
  const lineBearing = bearingAtPoint(referenceLine, point.coordinates);
  if (lineBearing === null) {
    uiStore.addToast(t('modals.angleLine.bearingError'), 'error');
    return;
  }

  // Calculate the final bearing (line bearing + angle)
  const finalBearing = (lineBearing + form.angle + 360) % 360;

  // Calculate the endpoint using the final bearing and distance
  let endpoint;
  try {
    endpoint = destinationPoint(
      point.coordinates.lat,
      point.coordinates.lon,
      form.distance,
      finalBearing
    );
  } catch {
    uiStore.addToast(t('line.errors.unreachableDestination'), 'error');
    return;
  }

  // Generate line name if not provided
  const lineName =
    form.name.trim() ||
    t('modals.angleLine.generatedName', {
      angle: form.angle,
      pointName: point.name,
      distance: form.distance.toFixed(1),
    });

  const referenceLineId = referenceLine.id;

  // Draw the line
  const createdLine = drawing.drawLineSegment(
    point.coordinates.lat,
    point.coordinates.lon,
    endpoint.lat,
    endpoint.lon,
    lineName,
    'azimuth',
    form.distance,
    finalBearing
  );

  if (createdLine && referenceLineId) {
    layersStore.updateLineSegment(createdLine.id, {
      angleFrom: { lineId: referenceLineId, degrees: form.angle },
    });
  }

  // Create endpoint if requested
  if (form.createEndpoint) {
    const endpointName =
      form.endpointName.trim() ||
      t('modals.angleLine.generatedEndpointName', {
        pointName: point.name,
        angle: form.angle,
        distance: form.distance,
      });
    const createdPoint = drawing.drawPoint(endpoint.lat, endpoint.lon, endpointName);
    if (createdPoint && createdLine)
      layersStore.updatePoint(createdPoint.id, { construction: { lineId: createdLine.id } });
  }

  uiStore.addToast(t('modals.angleLine.success'), 'success');
  closeModal();
}

function closeModal() {
  uiStore.closeModal('angleLineModal');
  form.name = '';
  form.pointId = null;
  form.lineId = null;
  form.angle = 90;
  form.distance = 1;
  form.createEndpoint = false;
  form.endpointName = '';
}
</script>
