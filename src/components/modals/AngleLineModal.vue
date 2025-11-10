<template>
  <BaseModal
    :is-open="isOpen"
    submit-text="Add"
    title="Add Angle Line"
    @close="closeModal"
    @submit="submitForm"
  >
    <v-form @submit.prevent="submitForm">
      <v-text-field
        v-model="form.name"
        class="mb-4"
        density="compact"
        label="Line Name (optional)"
        placeholder="Leave empty for auto-generated name"
        variant="outlined"
      />

      <v-select
        v-model="form.pointId"
        class="mb-4"
        density="compact"
        :items="pointsOnLineItems"
        label="Point on Line"
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
        hint="Angle from the line direction (0° = along the line, 90° = perpendicular)"
        label="Angle (degrees)"
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
        label="Distance (km)"
        min="0"
        step="0.1"
        type="number"
        variant="outlined"
      />

      <v-checkbox
        v-model="form.createEndpoint"
        class="mb-2"
        density="compact"
        label="Create point at endpoint"
      />

      <v-text-field
        v-if="form.createEndpoint"
        v-model="form.endpointName"
        class="mb-4"
        density="compact"
        label="Endpoint name (optional)"
        placeholder="Leave empty for auto-generated name"
        variant="outlined"
      />
    </v-form>
  </BaseModal>
</template>

<script lang="ts" setup>
import type { PointElement } from '@/services/storage';
import { computed, inject, reactive, watch } from 'vue';
import BaseModal from '@/components/shared/BaseModal.vue';
import { destinationPoint } from '@/services/geometry';
import { useLayersStore } from '@/stores/layers';
import { useUIStore } from '@/stores/ui';

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
      const lineName = line?.name || 'Unknown Line';
      return {
        title: `${point.name} (on ${lineName})`,
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
    uiStore.addToast('Please select a point on a line', 'error');
    return;
  }

  const point = layersStore.points.find((p) => p.id === form.pointId);
  if (!point) {
    uiStore.addToast('Point not found', 'error');
    return;
  }

  // Calculate the bearing of the line at this point
  const lineBearing = calculateLineBearingAtPoint(form.pointId);
  if (lineBearing === null) {
    uiStore.addToast('Could not calculate line bearing', 'error');
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
    form.name.trim() || `Angle ${form.angle}° from ${point.name} (${form.distance.toFixed(1)} km)`;

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
      form.endpointName.trim() || `${point.name} + ${form.angle}° (${form.distance} km)`;
    drawing.drawPoint(endpoint.lat, endpoint.lon, endpointName);
  }

  uiStore.addToast('Angle line created successfully!', 'success');
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
