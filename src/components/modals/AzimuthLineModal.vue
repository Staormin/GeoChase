<template>
  <BaseModal
    :is-open="isOpen"
    :submit-text="isEditing ? $t('common.save') : $t('common.add')"
    :title="
      isEditing
        ? $t('line.editTitle') + ' (' + $t('line.azimuthTitle') + ')'
        : $t('line.azimuthTitle')
    "
    @close="closeModal"
    @submit="submitForm"
  >
    <v-form @submit.prevent="submitForm">
      <v-text-field
        v-model="form.name"
        class="mb-4"
        density="compact"
        :label="$t('line.name')"
        variant="outlined"
      />

      <CoordinateSelector
        v-model="form.startCoord"
        :items="coordinateItems"
        :label="$t('common.start') + ' ' + $t('common.point')"
        :placeholder="$t('line.selectPoint')"
      />

      <v-text-field
        v-model.number="form.azimuth"
        class="mb-4"
        density="compact"
        :label="$t('line.azimuth')"
        max="360"
        min="0"
        step="0.01"
        type="number"
        variant="outlined"
      />

      <v-text-field
        v-model.number="form.distance"
        class="mb-4"
        density="compact"
        :label="$t('line.distance')"
        min="0"
        step="0.1"
        type="number"
        variant="outlined"
      />

      <v-checkbox
        v-model="form.createEndpoint"
        class="mb-2"
        density="compact"
        :label="$t('point.createEndpoint')"
      />

      <v-text-field
        v-if="form.createEndpoint"
        v-model="form.endpointName"
        class="mb-4"
        density="compact"
        :label="$t('point.endpointName')"
        :placeholder="$t('point.endpointPlaceholder')"
        variant="outlined"
      />
    </v-form>
  </BaseModal>
</template>

<script lang="ts" setup>
import { computed, inject, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '@/components/shared/BaseModal.vue';
import CoordinateSelector from '@/components/shared/CoordinateSelector.vue';
import { useLineNameGeneration } from '@/composables/useLineNameGeneration';
import { destinationPoint } from '@/services/geometry';
import { useLayersStore } from '@/stores/layers';
import { useUIStore } from '@/stores/ui';

const { t } = useI18n();

const uiStore = useUIStore();
const layersStore = useLayersStore();
const coordinateItems = computed(() =>
  layersStore.sortedPoints.map((point) => ({
    label: `${point.name} (${point.coordinates.lat.toFixed(6)}, ${point.coordinates.lon.toFixed(6)})`,
    value: `${point.coordinates.lat},${point.coordinates.lon}`,
  }))
);
const { generateAzimuthName } = useLineNameGeneration();
const drawing = inject('drawing') as any;

const isOpen = computed(() => uiStore.isModalOpen('azimuthLineModal'));
const isEditing = computed(() => !!uiStore.editingElement);

const form = reactive({
  name: '',
  startCoord: null as string | null,
  azimuth: 0,
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
        form.azimuth = element.azimuth || 0;
        form.distance = element.distance || 0;
      }
    } else {
      form.name = '';
      form.startCoord = null;
      form.azimuth = 0;
      form.distance = 0;
      form.createEndpoint = false;
      form.endpointName = '';
    }
  }
});

function closeModal() {
  uiStore.closeModal('azimuthLineModal');
  uiStore.stopEditing();
}

async function submitForm() {
  if (!form.startCoord) {
    uiStore.addToast(t('line.errors.invalidCoordinates'), 'error');
    return;
  }

  const startCoords = form.startCoord.split(',').map(Number);
  const startLat = startCoords[0]!;
  const startLon = startCoords[1]!;

  // Auto-generate name if empty
  let name = form.name.trim();
  if (!name) {
    name = await generateAzimuthName(startLat, startLon, form.azimuth);
  }

  if (isEditing.value && uiStore.editingElement) {
    layersStore.updateLineSegment(uiStore.editingElement.id, {
      name,
      center: { lat: startLat, lon: startLon },
      mode: 'azimuth',
      azimuth: form.azimuth,
      distance: form.distance,
    });
    uiStore.addToast(t('line.updated'), 'success');
  } else {
    // Calculate endpoint from azimuth and distance
    const endpoint = destinationPoint(startLat, startLon, form.distance, form.azimuth);

    // Create new azimuth line
    drawing.drawLineSegment(
      startLat,
      startLon,
      endpoint.lat,
      endpoint.lon,
      name,
      'azimuth',
      form.distance,
      form.azimuth,
      undefined,
      undefined,
      undefined,
      form.createEndpoint,
      form.endpointName
    );
    uiStore.addToast(t('line.created'), 'success');
  }

  closeModal();
}
</script>
