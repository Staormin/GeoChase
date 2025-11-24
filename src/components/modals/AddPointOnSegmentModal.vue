<template>
  <v-dialog
    v-model="isOpen"
    max-width="500px"
    @click:outside="closeModal"
    @keydown.enter="submitForm"
    @keydown.esc="closeModal"
  >
    <v-card>
      <v-card-title>{{ $t('modals.addPointOnSegment.title') }}</v-card-title>
      <v-card-text>
        <v-form @submit.prevent="submitForm">
          <v-text-field
            v-model="form.name"
            class="mb-4"
            density="compact"
            :label="$t('modals.addPointOnSegment.pointName')"
            :placeholder="$t('modals.addPointOnSegment.pointNamePlaceholder')"
            variant="outlined"
          />

          <v-select
            v-model="form.distanceFrom"
            class="mb-4"
            density="compact"
            :items="distanceFromOptions"
            :label="$t('modals.addPointOnSegment.distanceFrom')"
            variant="outlined"
          />

          <div class="d-flex gap-2 mb-4">
            <v-text-field
              v-model.number="form.distance"
              class="flex-grow-1"
              density="compact"
              :label="$t('modals.addPointOnSegment.distance')"
              min="0"
              placeholder="0.0"
              step="0.01"
              type="number"
              variant="outlined"
            />
            <v-btn class="mt-1" color="secondary" @click="calculateMidpoint">
              {{ $t('modals.addPointOnSegment.midpoint') }}
            </v-btn>
          </div>
        </v-form>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn text @click="closeModal">{{ $t('common.cancel') }}</v-btn>
        <v-btn color="primary" @click="submitForm">{{
          $t('modals.addPointOnSegment.addPoint')
        }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { fromLonLat, toLonLat } from 'ol/proj';
import { getDistance } from 'ol/sphere';
import { computed, inject, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { destinationPoint } from '@/services/geometry';
import { useCoordinatesStore } from '@/stores/coordinates';
import { useLayersStore } from '@/stores/layers';
import { useUIStore } from '@/stores/ui';

const { t } = useI18n();
const uiStore = useUIStore();
const layersStore = useLayersStore();
const coordinatesStore = useCoordinatesStore();
const drawing = inject('drawing') as any;

const distanceFromOptions = computed(() => [
  { title: t('modals.addPointOnSegment.start'), value: 'start' },
  { title: t('modals.addPointOnSegment.end'), value: 'end' },
]);

const form = ref({
  name: '',
  distanceFrom: 'start' as 'start' | 'end',
  distance: 0,
});

const isOpen = computed({
  get: () => uiStore.isModalOpen('addPointOnSegmentModal'),
  set: (value) => {
    if (!value) {
      closeModal();
    }
  },
});

const selectedSegmentId = computed(() => uiStore.selectedSegmentForPointCreation);

function getSegmentEndpoint(segment: any) {
  switch (segment.mode) {
    case 'coordinate': {
      return segment.endpoint;
    }
    case 'azimuth': {
      return destinationPoint(
        segment.center.lat,
        segment.center.lon,
        segment.distance,
        segment.azimuth
      );
    }
    case 'intersection': {
      return segment.endpoint;
    }
    // No default
  }
  return null;
}

function calculateMidpoint() {
  if (!selectedSegmentId.value) {
    return;
  }

  const segment = layersStore.lineSegments.find((s) => s.id === selectedSegmentId.value);
  if (!segment) {
    return;
  }

  const endpoint = getSegmentEndpoint(segment);
  if (!endpoint) {
    return;
  }

  // Calculate total haversine distance (getDistance returns meters, convert to km)
  const totalDistance =
    getDistance([segment.center.lon, segment.center.lat], [endpoint.lon, endpoint.lat]) / 1000;

  // The midpoint distance is half of total haversine distance
  // This will be placed using binary search in submitForm to ensure consistency
  form.value.distance = totalDistance / 2;
  form.value.distanceFrom = 'start';

  // Auto-name the point as "{line name} - Midpoint"
  form.value.name = t('modals.addPointOnSegment.midpointName', { segment: segment.name });
}

function submitForm() {
  if (!selectedSegmentId.value) {
    return;
  }

  const segment = layersStore.lineSegments.find((s) => s.id === selectedSegmentId.value);
  if (!segment) {
    uiStore.addToast(t('modals.addPointOnSegment.segmentNotFound'), 'error');
    return;
  }

  const endpoint = getSegmentEndpoint(segment);
  if (!endpoint) {
    uiStore.addToast(t('modals.addPointOnSegment.endpointError'), 'error');
    return;
  }

  // Use Haversine distance for validation and display consistency (getDistance returns meters, convert to km)
  const segmentLength =
    getDistance([segment.center.lon, segment.center.lat], [endpoint.lon, endpoint.lat]) / 1000;

  if (form.value.distance > segmentLength) {
    const msg = t('modals.addPointOnSegment.distanceExceeds', { length: segmentLength.toFixed(2) });
    uiStore.addToast(msg, 'error');
    return;
  }

  if (form.value.distance < 0) {
    uiStore.addToast(t('modals.addPointOnSegment.distancePositive'), 'error');
    return;
  }

  // Find point on the Web Mercator line that corresponds to the target Haversine distance
  // Use binary search in Web Mercator space to find the exact point
  const startProj = fromLonLat([segment.center.lon, segment.center.lat]);
  const startProjX = startProj[0]!;
  const startProjY = startProj[1]!;
  const endProj = fromLonLat([endpoint.lon, endpoint.lat]);
  const endProjX = endProj[0]!;
  const endProjY = endProj[1]!;
  const dx = endProjX - startProjX;
  const dy = endProjY - startProjY;

  let pointOnSegment;

  if (form.value.distanceFrom === 'start') {
    // Binary search to find fraction that matches target haversine distance
    let minFraction = 0;
    let maxFraction = 1;
    let targetFraction = 0.5;
    let iterations = 0;
    const maxIterations = 30;

    while (iterations < maxIterations) {
      const testProjX = startProjX + targetFraction * dx;
      const testProjY = startProjY + targetFraction * dy;
      const testCoords = toLonLat([testProjX, testProjY]);
      const testPoint = { lat: testCoords[1]!, lon: testCoords[0]! };

      // getDistance returns meters, convert to km
      const testDistance =
        getDistance([segment.center.lon, segment.center.lat], [testPoint.lon, testPoint.lat]) /
        1000;
      const tolerance = 0.0001; // 0.1 meter tolerance

      if (Math.abs(testDistance - form.value.distance) < tolerance) {
        pointOnSegment = testPoint;
        break;
      } else if (testDistance < form.value.distance) {
        minFraction = targetFraction;
      } else {
        maxFraction = targetFraction;
      }

      targetFraction = (minFraction + maxFraction) / 2;
      iterations++;
    }

    // If we didn't converge, use the last calculated point
    if (!pointOnSegment) {
      const projX = startProjX + targetFraction * dx;
      const projY = startProjY + targetFraction * dy;
      const coords = toLonLat([projX, projY]);
      pointOnSegment = { lat: coords[1]!, lon: coords[0]! };
    }
  } else {
    // Binary search from endpoint
    let minFraction = 0;
    let maxFraction = 1;
    let targetFraction = 0.5;
    let iterations = 0;
    const maxIterations = 30;

    while (iterations < maxIterations) {
      const testProjX = endProjX - targetFraction * dx;
      const testProjY = endProjY - targetFraction * dy;
      const testCoords = toLonLat([testProjX, testProjY]);
      const testPoint = { lat: testCoords[1]!, lon: testCoords[0]! };

      // getDistance returns meters, convert to km
      const testDistance =
        getDistance([endpoint.lon, endpoint.lat], [testPoint.lon, testPoint.lat]) / 1000;
      const tolerance = 0.0001; // 0.1 meter tolerance

      if (Math.abs(testDistance - form.value.distance) < tolerance) {
        pointOnSegment = testPoint;
        break;
      } else if (testDistance < form.value.distance) {
        minFraction = targetFraction;
      } else {
        maxFraction = targetFraction;
      }

      targetFraction = (minFraction + maxFraction) / 2;
      iterations++;
    }

    // If we didn't converge, use the last calculated point
    if (!pointOnSegment) {
      const projX = endProjX - targetFraction * dx;
      const projY = endProjY - targetFraction * dy;
      const coords = toLonLat([projX, projY]);
      pointOnSegment = { lat: coords[1]!, lon: coords[0]! };
    }
  }

  const name =
    form.value.name.trim() || t('common.pointName', { count: layersStore.pointCount + 1 });

  // Create a simpler coordinate name (without the full line segment details)
  let coordinateName = name;
  if (form.value.name.trim()) {
    if (name.includes(t('modals.addPointOnSegment.midpointSuffix'))) {
      // For midpoint, extract just the essential part
      coordinateName = t('modals.addPointOnSegment.midpointCoordinateName', {
        count: layersStore.pointCount + 1,
      });
    }
  } else {
    // If auto-generated, use a simple format
    coordinateName = t('common.pointName', { count: layersStore.pointCount + 1 });
  }

  // Save the coordinate first
  coordinatesStore.addCoordinate(coordinateName, pointOnSegment.lat, pointOnSegment.lon);

  // Then draw the point (use the full name for the point on the map)
  const newPoint = drawing.drawPoint(pointOnSegment.lat, pointOnSegment.lon, name);

  // Update bidirectional relationship: line -> point and point -> line
  if (newPoint && selectedSegmentId.value) {
    const updatedSegment = layersStore.lineSegments.find((s) => s.id === selectedSegmentId.value);
    if (updatedSegment) {
      // Initialize pointsOnLine array if not present
      if (!updatedSegment.pointsOnLine) {
        updatedSegment.pointsOnLine = [];
      }
      // Add the new point ID to the line's pointsOnLine array
      updatedSegment.pointsOnLine.push(newPoint.id);

      // Also update the point to reference this line (bidirectional relationship: 1 point => 0 or 1 line)
      const pointInStore = layersStore.points.find((p) => p.id === newPoint.id);
      if (pointInStore) {
        pointInStore.lineId = selectedSegmentId.value;
      }
    }
  }

  uiStore.addToast(t('modals.addPointOnSegment.success'), 'success');
  closeModal();
}

function closeModal() {
  uiStore.closeModal('addPointOnSegmentModal');
  uiStore.setSelectedSegmentForPointCreation(null);
  form.value = {
    name: '',
    distanceFrom: 'start',
    distance: 0,
  };
}
</script>
