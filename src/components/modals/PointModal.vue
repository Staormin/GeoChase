<template>
  <v-dialog
    v-model="isOpen"
    max-width="500px"
    @click:outside="closeModal"
    @keydown.enter="submitForm"
    @keydown.esc="closeModal"
  >
    <v-card>
      <v-card-title>{{ isEditing ? $t('point.editTitle') : $t('point.title') }}</v-card-title>

      <v-card-text>
        <v-form @submit.prevent="submitForm">
          <v-text-field
            v-model="form.name"
            class="mb-4"
            density="compact"
            :disabled="isSubmitting"
            :label="$t('point.name')"
            variant="outlined"
          />

          <!-- Coordinates with picker -->
          <v-menu>
            <template #activator="{ props }">
              <v-text-field
                v-model="form.coordinates"
                append-inner-icon="mdi-map-marker"
                class="mb-4"
                density="compact"
                :disabled="isSubmitting"
                :label="$t('common.coordinates')"
                placeholder="48.8566, 2.3522"
                variant="outlined"
                v-bind="props"
                @click:append-inner="() => {}"
              />
            </template>

            <v-list>
              <v-list-item v-if="layersStore.sortedPoints.length === 0" disabled>
                <v-list-item-title class="text-caption">{{
                  $t('sidebar.noPoints')
                }}</v-list-item-title>
              </v-list-item>

              <v-list-item
                v-for="point in layersStore.sortedPoints"
                :key="point.id"
                @click="selectPoint(point)"
              >
                <v-list-item-title class="text-sm">
                  {{ point.name }}
                </v-list-item-title>

                <v-list-item-subtitle class="text-xs">
                  {{ point.coordinates.lat.toFixed(6) }}, {{ point.coordinates.lon.toFixed(6) }}
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-menu>
        </v-form>
      </v-card-text>

      <v-card-actions class="px-4 pb-4">
        <v-spacer />
        <v-btn variant="text" @click="closeModal">{{ $t('common.cancel') }}</v-btn>

        <v-btn color="primary" :loading="isSubmitting" variant="flat" @click="submitForm">{{
          isEditing ? $t('common.save') : $t('common.add')
        }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import type { PointElement } from '@/types/project';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDrawingContext } from '@/composables/mapContext';
import { getReverseGeocodeAddress } from '@/services/address';
import { useLayersStore } from '@/stores/layers';
import { useUIStore } from '@/stores/ui';

const uiStore = useUIStore();
const layersStore = useLayersStore();
const drawing = useDrawingContext();
const { t } = useI18n();
const isSubmitting = ref(false);
let lookupController: AbortController | undefined;

onBeforeUnmount(() => lookupController?.abort());

const form = ref({
  name: '',
  coordinates: '48.8566, 2.3522',
});

const isOpen = computed({
  get: () => uiStore.isModalOpen('pointModal'),
  set: (value) => {
    if (!value) {
      closeModal();
    }
  },
});

const isEditing = computed(() => {
  return uiStore.isEditing('point', uiStore.editingElement?.id || '');
});

// Watch for modal opening - pre-fill form with current element data
watch(
  () => isOpen.value,
  (newValue) => {
    if (newValue && uiStore.editingElement?.type === 'point') {
      const point = layersStore.points.find((p) => p.id === uiStore.editingElement?.id);
      if (point) {
        form.value = {
          name: point.name,
          coordinates: `${point.coordinates.lat}, ${point.coordinates.lon}`,
        };
      }
    }
  },
  { immediate: true }
);

// Watch for creating state changes with pre-fill values (e.g., from right-click)
watch(
  () => uiStore.creatingElement,
  (newValue) => {
    if (newValue?.type === 'point') {
      // Reset form to defaults
      form.value = {
        name: '',
        coordinates: '48.8566, 2.3522',
      };

      // Apply pre-fill values if they exist
      if (newValue.prefill) {
        const prefill = newValue.prefill;
        form.value.name = prefill.name ?? '';
        form.value.coordinates = `${prefill.lat.toFixed(6)}, ${prefill.lon.toFixed(6)}`;
      }
    }
  },
  { immediate: true }
);

function selectPoint(point: PointElement) {
  form.value.coordinates = `${point.coordinates.lat}, ${point.coordinates.lon}`;
  form.value.name = point.name;
}

async function submitForm() {
  if (isSubmitting.value || !isOpen.value) return;

  // Parse coordinates
  const parts = form.value.coordinates.split(',').map((part) => part.trim());
  const lat = Number(parts[0]);
  const lon = Number(parts[1]);
  if (
    parts.length !== 2 ||
    parts.some((part) => !part) ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180
  ) {
    uiStore.addToast(t('point.errors.invalidCoordinates'), 'error');
    return;
  }

  const controller = new AbortController();
  lookupController = controller;
  isSubmitting.value = true;
  const editingId = isEditing.value ? uiStore.editingElement?.id : undefined;

  try {
    let name = form.value.name.trim();
    if (!name) {
      const { city } = await getReverseGeocodeAddress(lat, lon, controller.signal);
      name = city || `${t('common.point')} ${layersStore.pointCount + 1}`;
    }
    // Cancelling or unmounting the dialog must never create a point later.
    if (controller.signal.aborted || !isOpen.value) return;

    if (editingId) {
      // Note: Point update not yet implemented in useDrawing
      // For now, delete and recreate
      drawing.deleteElement('point', editingId);
      drawing.drawPoint(lat, lon, name);
      uiStore.addToast(t('point.updated'), 'success');
      uiStore.stopEditing();
    } else {
      // Add new point
      drawing.drawPoint(lat, lon, name);
      uiStore.addToast(t('point.created'), 'success');
    }
    closeModal();
    resetForm();
  } finally {
    isSubmitting.value = false;
    lookupController = undefined;
  }
}

function closeModal() {
  lookupController?.abort();
  uiStore.closeModal('pointModal');
  uiStore.stopEditing();
  uiStore.stopCreating();
}

function resetForm() {
  form.value = {
    name: '',
    coordinates: '48.8566, 2.3522',
  };
}
</script>
