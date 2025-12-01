<template>
  <BaseModal
    :is-open="isOpen"
    :submit-text="isEditing ? $t('common.save') : $t('common.add')"
    :title="
      isEditing
        ? $t('line.editTitle') + ' (' + $t('line.twoPointsTitle') + ')'
        : $t('line.twoPointsTitle')
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
        :label="$t('line.startLat') + ' / ' + $t('line.startLon')"
        :placeholder="$t('coordinates.selectFromPoint')"
      />

      <CoordinateSelector
        v-model="form.endCoord"
        :items="coordinateItems"
        :label="$t('line.endLat') + ' / ' + $t('line.endLon')"
        :placeholder="$t('coordinates.selectFromPoint')"
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
const { generateTwoPointsName } = useLineNameGeneration();
const drawing = inject('drawing') as any;

const isOpen = computed(() => uiStore.isModalOpen('twoPointsLineModal'));
const isEditing = computed(() => !!uiStore.editingElement);

const form = reactive({
  name: '',
  startCoord: null as string | null,
  endCoord: null as string | null,
});

watch(isOpen, (newVal) => {
  if (newVal) {
    if (isEditing.value && uiStore.editingElement) {
      const element = layersStore.lineSegments.find((l) => l.id === uiStore.editingElement?.id);
      if (element) {
        form.name = element.name;
        form.startCoord = `${element.center.lat},${element.center.lon}`;
        form.endCoord = element.endpoint ? `${element.endpoint.lat},${element.endpoint.lon}` : null;
      }
    } else {
      form.name = '';
      form.startCoord = null;
      form.endCoord = null;
    }
  }
});

function closeModal() {
  uiStore.closeModal('twoPointsLineModal');
  uiStore.stopEditing();
}

async function submitForm() {
  if (!form.startCoord || !form.endCoord) {
    uiStore.addToast(t('line.errors.invalidCoordinates'), 'error');
    return;
  }

  const startCoords = form.startCoord.split(',').map(Number);
  const endCoords = form.endCoord.split(',').map(Number);
  const startLat = startCoords[0]!;
  const startLon = startCoords[1]!;
  const endLat = endCoords[0]!;
  const endLon = endCoords[1]!;

  // Auto-generate name if empty
  let name = form.name.trim();
  if (!name) {
    name = await generateTwoPointsName(startLat, startLon, endLat, endLon);
  }

  if (isEditing.value && uiStore.editingElement) {
    layersStore.updateLineSegment(uiStore.editingElement.id, {
      name,
      center: { lat: startLat, lon: startLon },
      endpoint: { lat: endLat, lon: endLon },
      mode: 'coordinate',
    });
    uiStore.addToast(t('line.updated'), 'success');
  } else {
    // Create new two-points line
    drawing.drawLineSegment(
      startLat,
      startLon,
      endLat,
      endLon,
      name,
      'coordinate',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    );
    uiStore.addToast(t('line.created'), 'success');
  }

  closeModal();
}
</script>
