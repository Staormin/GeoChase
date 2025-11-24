<template>
  <BaseModal
    :is-open="isOpen"
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
        :items="pointsOnLineItems"
        :label="$t('modals.angleLine.pointOnLine')"
        variant="outlined"
      >
        <template #prepend-inner>
          <v-icon size="small">mdi-map-marker</v-icon>
        </template>
      </v-select>

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
import type { PointElement } from '@/services/storage';
import { computed, inject, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '@/components/shared/BaseModal.vue';
import { destinationPoint } from '@/services/geometry';
import { useLayersStore } from '@/stores/layers';
import { useUIStore } from '@/stores/ui';

const { t } = useI18n();
const uiStore = useUIStore();
const layersStore = useLayersStore();
const drawing = inject('drawing') as any;

const isOpen = computed(() => uiStore.isModalOpen('angleLineModal'));

const form = reactive({
  name: '',
  pointId: null as string | null,
  angle: 90,
  distance: 1,
  createEndpoint: false,
  endpointName: '',
});

// Get all points that are on a line (have lineId set)
const pointsOnLineItems = computed(() => {
  return layersStore.points
    .filter((point: PointElement) => point.lineId !== undefined)
    .map((point: PointElement) => {
      const line = layersStore.lineSegments.find((l) => l.id === point.lineId);
      const lineName = line?.name || t('common.unknownLine');
      return {
        title: `${point.name} (${t('modals.angleLine.onLine', { line: lineName })})`,
        value: point.id,
      };
    });
});

watch(isOpen, (newVal) => {
  if (newVal) {
    // Reset form when opening
    form.name = '';
    form.pointId = null;
    form.angle = 90;
    form.distance = 1;
    form.createEndpoint = false;
    form.endpointName = '';
  }
});

function calculateLineBearingAtPoint(pointId: string): number | null {
  const point = layersStore.points.find((p) => p.id === pointId);
  if (!point || !point.lineId) {
    return null;
  }

  const line = layersStore.lineSegments.find((l) => l.id === point.lineId);
  if (!line) {
    return null;
  }

  // Get the endpoint of the line
  let endpoint: { lat: number; lon: number } | null = null;

  switch (line.mode) {
    case 'coordinate': {
      endpoint = line.endpoint || null;
      break;
    }
    case 'azimuth': {
      if (line.distance !== undefined && line.azimuth !== undefined) {
        endpoint = destinationPoint(line.center.lat, line.center.lon, line.distance, line.azimuth);
      }
      break;
    }
    case 'intersection': {
      endpoint = line.endpoint || null;
      break;
    }
    case 'parallel': {
      // For parallel lines, we don't have a specific endpoint
      // Use azimuth 90 degrees (perpendicular to longitude)
      return 90;
    }
  }

  if (!endpoint) {
    return null;
  }

  // Calculate bearing from start to end of the line
  const startLat = (line.center.lat * Math.PI) / 180;
  const startLon = (line.center.lon * Math.PI) / 180;
  const endLat = (endpoint.lat * Math.PI) / 180;
  const endLon = (endpoint.lon * Math.PI) / 180;

  const dLon = endLon - startLon;
  const y = Math.sin(dLon) * Math.cos(endLat);
  const x =
    Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLon);
  let bearing = Math.atan2(y, x);

  // Convert to degrees
  bearing = (bearing * 180) / Math.PI;
  // Normalize to 0-360
  bearing = (bearing + 360) % 360;

  return bearing;
}

function submitForm() {
  if (!form.pointId) {
    uiStore.addToast(t('modals.angleLine.selectPointError'), 'error');
    return;
  }

  const point = layersStore.points.find((p) => p.id === form.pointId);
  if (!point) {
    uiStore.addToast(t('modals.angleLine.pointNotFoundError'), 'error');
    return;
  }

  // Calculate the bearing of the line at this point
  const lineBearing = calculateLineBearingAtPoint(form.pointId);
  if (lineBearing === null) {
    uiStore.addToast(t('modals.angleLine.bearingError'), 'error');
    return;
  }

  // Calculate the final bearing (line bearing + angle)
  const finalBearing = (lineBearing + form.angle) % 360;

  // Calculate the endpoint using the final bearing and distance
  const endpoint = destinationPoint(
    point.coordinates.lat,
    point.coordinates.lon,
    form.distance,
    finalBearing
  );

  // Generate line name if not provided
  const lineName =
    form.name.trim() ||
    t('modals.angleLine.generatedName', {
      angle: form.angle,
      pointName: point.name,
      distance: form.distance.toFixed(1),
    });

  // Draw the line
  drawing.drawLineSegment(
    point.coordinates.lat,
    point.coordinates.lon,
    endpoint.lat,
    endpoint.lon,
    lineName,
    undefined // color
  );

  // Create endpoint if requested
  if (form.createEndpoint) {
    const endpointName =
      form.endpointName.trim() ||
      t('modals.angleLine.generatedEndpointName', {
        pointName: point.name,
        angle: form.angle,
        distance: form.distance,
      });
    drawing.drawPoint(endpoint.lat, endpoint.lon, endpointName);
  }

  uiStore.addToast(t('modals.angleLine.success'), 'success');
  closeModal();
}

function closeModal() {
  uiStore.closeModal('angleLineModal');
  form.name = '';
  form.pointId = null;
  form.angle = 90;
  form.distance = 1;
  form.createEndpoint = false;
  form.endpointName = '';
}
</script>
