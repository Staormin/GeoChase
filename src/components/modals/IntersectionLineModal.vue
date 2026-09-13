<template>
  <BaseModal
    :is-open="isOpen"
    :submit-text="isEditing ? $t('common.update') : $t('common.add')"
    :title="
      isEditing ? $t('modals.intersectionLine.editTitle') : $t('modals.intersectionLine.title')
    "
    @close="closeModal"
    @submit="submitForm"
  >
    <v-form @submit.prevent="submitForm">
      <v-text-field
        v-model="form.name"
        class="mb-4"
        density="compact"
        :label="$t('common.name')"
        variant="outlined"
      />

      <CoordinateSelector
        v-model="form.startCoord"
        :items="coordinateItems"
        :label="$t('modals.intersectionLine.startPoint')"
        :placeholder="$t('modals.intersectionLine.selectPoint')"
      />

      <CoordinateSelector
        v-model="form.intersectCoord"
        :items="coordinateItems"
        :label="$t('modals.intersectionLine.intersectionPoint')"
        :placeholder="$t('modals.intersectionLine.selectPoint')"
      />

      <v-text-field
        v-model.number="form.distance"
        class="mb-4"
        density="compact"
        :hint="$t('modals.intersectionLine.distanceHint')"
        :label="$t('modals.intersectionLine.distance')"
        min="0"
        persistent-hint
        step="any"
        type="number"
        variant="outlined"
      />

      <v-checkbox
        v-model="form.createEndpoint"
        class="mb-2"
        density="compact"
        :label="$t('modals.intersectionLine.createEndpoint')"
      />

      <v-text-field
        v-if="form.createEndpoint"
        v-model="form.endpointName"
        class="mb-4"
        density="compact"
        :label="$t('modals.intersectionLine.endpointName')"
        :placeholder="$t('modals.intersectionLine.endpointPlaceholder')"
        variant="outlined"
      />
    </v-form>
  </BaseModal>
</template>

<script lang="ts" setup>
import type { LatLon } from '@/services/geometry';
import { computed, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '@/components/shared/BaseModal.vue';
import CoordinateSelector from '@/components/shared/CoordinateSelector.vue';
import { useDrawingContext } from '@/composables/mapContext';
import { useLineNameGeneration } from '@/composables/useLineNameGeneration';
import { useProjectGeometry } from '@/composables/useProjectGeometry';
import { useLayersStore } from '@/stores/layers';
import { useUIStore } from '@/stores/ui';

const { getDistance, endpointFromIntersection } = useProjectGeometry();

const { t } = useI18n();
const uiStore = useUIStore();
const layersStore = useLayersStore();
const coordinateItems = computed(() =>
  layersStore.sortedPoints.map((point) => ({
    label: `${point.name} (${point.coordinates.lat.toFixed(6)}, ${point.coordinates.lon.toFixed(6)})`,
    value: `${point.coordinates.lat},${point.coordinates.lon}`,
  }))
);
const { generateIntersectionName } = useLineNameGeneration();
const drawing = useDrawingContext();

const isOpen = computed(() => uiStore.isModalOpen('intersectionLineModal'));
const isEditing = computed(() => !!uiStore.editingElement);

const form = reactive({
  name: '',
  startCoord: null as string | null,
  intersectCoord: null as string | null,
  distance: 0 as number | string,
  createEndpoint: false,
  endpointName: '',
});

watch(
  isOpen,
  (newVal) => {
    if (newVal) {
      if (isEditing.value && uiStore.editingElement) {
        const element = layersStore.lineSegments.find((l) => l.id === uiStore.editingElement?.id);
        if (element) {
          form.name = element.name;
          form.startCoord = `${element.center.lat},${element.center.lon}`;
          form.intersectCoord = element.intersectionPoint
            ? `${element.intersectionPoint.lat},${element.intersectionPoint.lon}`
            : null;
          // Derive the extension from the saved geometry, including older projects
          // whose distance metadata described the total distance from the start.
          form.distance =
            element.intersectionPoint && element.endpoint
              ? Number(
                  (
                    getDistance(
                      [element.intersectionPoint.lon, element.intersectionPoint.lat],
                      [element.endpoint.lon, element.endpoint.lat]
                    ) / 1000
                  ).toFixed(6)
                )
              : 0;
        }
      } else {
        form.name = '';
        form.startCoord = null;
        form.intersectCoord = null;
        form.distance = 0;
        form.createEndpoint = false;
        form.endpointName = '';
      }
    }
  },
  { immediate: true }
);

function closeModal() {
  uiStore.closeModal('intersectionLineModal');
  uiStore.stopEditing();
}

async function submitForm() {
  if (!form.startCoord || !form.intersectCoord) {
    uiStore.addToast(t('modals.intersectionLine.selectBothPoints'), 'error');
    return;
  }

  const startCoords = form.startCoord.split(',').map(Number);
  const intersectCoords = form.intersectCoord.split(',').map(Number);
  const startLat = startCoords[0]!;
  const startLon = startCoords[1]!;
  const intersectLat = intersectCoords[0]!;
  const intersectLon = intersectCoords[1]!;

  const distance = Number(form.distance);
  if (String(form.distance).trim() === '' || !Number.isFinite(distance) || distance < 0) {
    uiStore.addToast(t('modals.intersectionLine.distanceError'), 'error');
    return;
  }

  if (startLat === intersectLat && startLon === intersectLon) {
    uiStore.addToast(t('modals.intersectionLine.distinctPoints'), 'error');
    return;
  }

  let endpoint: LatLon;
  try {
    endpoint = endpointFromIntersection(startLat, startLon, intersectLat, intersectLon, distance);
  } catch {
    uiStore.addToast(t('modals.intersectionLine.unreachableDistance'), 'error');
    return;
  }

  // Preserve the existing total-distance metadata contract for saved projects.
  const totalDistance = getDistance([startLon, startLat], [endpoint.lon, endpoint.lat]) / 1000;

  // Auto-generate name if empty
  let name = form.name.trim();
  if (!name) {
    name = await generateIntersectionName(startLat, startLon, intersectLat, intersectLon);
  }

  if (isEditing.value && uiStore.editingElement) {
    drawing.updateLineSegment(
      uiStore.editingElement.id,
      startLat,
      startLon,
      endpoint.lat,
      endpoint.lon,
      name,
      'intersection',
      totalDistance,
      undefined,
      intersectLat,
      intersectLon,
      totalDistance
    );
    uiStore.addToast(t('messages.lineUpdated'), 'success');
  } else {
    // Create new intersection line
    drawing.drawLineSegment(
      startLat,
      startLon,
      endpoint.lat,
      endpoint.lon,
      name,
      'intersection',
      totalDistance,
      undefined,
      intersectLat,
      intersectLon,
      totalDistance,
      form.createEndpoint,
      form.endpointName
    );
    uiStore.addToast(t('messages.lineAdded'), 'success');
  }

  closeModal();
}
</script>
