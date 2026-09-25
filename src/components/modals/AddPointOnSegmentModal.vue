<template>
  <FloatingDialog
    v-model="isOpen"
    max-width="500px"
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
  </FloatingDialog>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import FloatingDialog from '@/components/shared/FloatingDialog.vue';
import { useDrawingContext } from '@/composables/mapContext';
import { useProjectGeometry } from '@/composables/useProjectGeometry';
import { useLayersStore } from '@/stores/layers';
import { useUIStore } from '@/stores/ui';

const { getDistance, getSegmentEndpoint, interpolateLine, pointAtDistance } = useProjectGeometry();

const { t } = useI18n();
const uiStore = useUIStore();
const layersStore = useLayersStore();
const drawing = useDrawingContext();

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

  // Locate the midpoint on the selected path before measuring its distance.
  // Half the endpoint distance does not give the midpoint of a Mercator line.
  const midpoint = interpolateLine(segment.center, endpoint, 0.5);
  form.value.distance =
    getDistance([segment.center.lon, segment.center.lat], [midpoint.lon, midpoint.lat]) / 1000;
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

  if (!Number.isFinite(form.value.distance) || form.value.distance < 0) {
    uiStore.addToast(t('modals.addPointOnSegment.distancePositive'), 'error');
    return;
  }

  const pointOnSegment = pointAtDistance(
    segment.center,
    endpoint,
    form.value.distance,
    form.value.distanceFrom === 'end'
  );

  // Auto-generate clever name based on position
  let name = form.value.name.trim();
  if (!name) {
    const tolerance = 0.001; // 1 meter tolerance for detecting start/end
    const isAtStart =
      (form.value.distanceFrom === 'start' && form.value.distance < tolerance) ||
      (form.value.distanceFrom === 'end' &&
        Math.abs(form.value.distance - segmentLength) < tolerance);
    const isAtEnd =
      (form.value.distanceFrom === 'end' && form.value.distance < tolerance) ||
      (form.value.distanceFrom === 'start' &&
        Math.abs(form.value.distance - segmentLength) < tolerance);

    if (isAtStart) {
      name = t('modals.addPointOnSegment.startOfLine', { line: segment.name });
    } else if (isAtEnd) {
      name = t('modals.addPointOnSegment.endOfLine', { line: segment.name });
    } else {
      // Default: include distance info
      name = t('modals.addPointOnSegment.pointAtDistance', {
        line: segment.name,
        distance: form.value.distance.toFixed(2),
      });
    }
  }

  // Draw the point
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
        pointInStore.construction = {
          lineId: selectedSegmentId.value,
          distanceKm: form.value.distance,
          fromEnd: form.value.distanceFrom === 'end',
        };
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
