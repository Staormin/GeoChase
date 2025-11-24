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
        :label="$t('modals.intersectionLine.startCoordinates')"
        :placeholder="$t('modals.intersectionLine.selectCoordinate')"
      />

      <CoordinateSelector
        v-model="form.intersectCoord"
        :items="coordinateItems"
        :label="$t('modals.intersectionLine.intersectionCoordinates')"
        :placeholder="$t('modals.intersectionLine.selectCoordinate')"
      />

      <v-text-field
        v-model.number="form.distance"
        class="mb-4"
        density="compact"
        :label="$t('modals.intersectionLine.distance')"
        min="0"
        step="0.1"
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
import { getDistance } from 'ol/sphere';
import { computed, inject, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '@/components/shared/BaseModal.vue';
import CoordinateSelector from '@/components/shared/CoordinateSelector.vue';
import { useCoordinateItems } from '@/composables/useCoordinateItems';
import { useLineNameGeneration } from '@/composables/useLineNameGeneration';
import { endpointFromIntersection } from '@/services/geometry';
import { useLayersStore } from '@/stores/layers';
import { useUIStore } from '@/stores/ui';

const { t } = useI18n();
const uiStore = useUIStore();
const layersStore = useLayersStore();
const { coordinateItems } = useCoordinateItems();
const { generateIntersectionName } = useLineNameGeneration();
const drawing = inject('drawing') as any;

const isOpen = computed(() => uiStore.isModalOpen('intersectionLineModal'));
const isEditing = computed(() => !!uiStore.editingElement);

const form = reactive({
  name: '',
  startCoord: null as string | null,
  intersectCoord: null as string | null,
  distance: 0,
  createEndpoint: false,
  endpointName: '',
});

watch(isOpen, (newVal) => {
  if (newVal) {
    if (isEditing.value && uiStore.editingElement) {
      const element = layersStore.lineSegments.find((l) => l.id === uiStore.editingElement?.id);
      if (element) {
        form.name = element.name;
        form.startCoord = `${element.center.lat},${element.center.lon}`;
        form.intersectCoord = element.intersectionPoint
          ? `${element.intersectionPoint.lat},${element.intersectionPoint.lon}`
          : null;
        form.distance = element.intersectionDistance || 0;
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
});

function closeModal() {
  uiStore.closeModal('intersectionLineModal');
  uiStore.stopEditing();
}

async function submitForm() {
  if (!form.startCoord || !form.intersectCoord) {
    uiStore.addToast(t('modals.intersectionLine.selectBothCoordinates'), 'error');
    return;
  }

  const startCoords = form.startCoord.split(',').map(Number);
  const intersectCoords = form.intersectCoord.split(',').map(Number);
  const startLat = startCoords[0]!;
  const startLon = startCoords[1]!;
  const intersectLat = intersectCoords[0]!;
  const intersectLon = intersectCoords[1]!;

  // Validate distance is >= distance to intersection point (getDistance returns meters, convert to km)
  const distToIntersection = getDistance([startLon, startLat], [intersectLon, intersectLat]) / 1000;
  if (form.distance < distToIntersection - 1e-6) {
    uiStore.addToast(
      t('modals.intersectionLine.distanceError', { distance: distToIntersection.toFixed(2) }),
      'error'
    );
    return;
  }

  // Calculate endpoint from intersection
  const endpoint = endpointFromIntersection(
    startLat,
    startLon,
    intersectLat,
    intersectLon,
    form.distance
  );

  // Auto-generate name if empty
  let name = form.name.trim();
  if (!name) {
    name = await generateIntersectionName(startLat, startLon, intersectLat, intersectLon);
  }

  if (isEditing.value && uiStore.editingElement) {
    layersStore.updateLineSegment(uiStore.editingElement.id, {
      name,
      center: { lat: startLat, lon: startLon },
      mode: 'intersection',
      intersectionPoint: { lat: intersectLat, lon: intersectLon },
      intersectionDistance: form.distance,
    });
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
      form.distance,
      undefined,
      intersectLat,
      intersectLon,
      undefined,
      form.createEndpoint,
      form.endpointName
    );
    uiStore.addToast(t('messages.lineAdded'), 'success');
  }

  closeModal();
}
</script>
