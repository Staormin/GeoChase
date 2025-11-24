<template>
  <v-dialog
    v-model="isOpen"
    max-width="600px"
    @click:outside="closeModal"
    @keydown.esc="closeModal"
  >
    <v-card>
      <v-card-title>{{ $t('polygon.title') }}</v-card-title>
      <v-card-text>
        <v-form @submit.prevent="submitForm">
          <v-text-field
            v-model="form.name"
            class="mb-4"
            density="compact"
            :label="$t('polygon.name')"
            variant="outlined"
          />

          <!-- Points Selection -->
          <div class="mb-4">
            <div class="text-subtitle-2 mb-2">{{ $t('polygon.selectPoints') }}</div>
            <v-chip-group v-model="selectedPoints" column multiple>
              <v-chip
                v-for="point in layersStore.sortedPoints"
                :key="point.id"
                filter
                :value="point.id"
                variant="outlined"
              >
                {{ point.name }}
              </v-chip>
            </v-chip-group>

            <v-alert
              v-if="layersStore.points.length === 0"
              class="mt-2"
              density="compact"
              type="info"
              variant="tonal"
            >
              {{ $t('polygon.errors.minimumPoints') }}
            </v-alert>

            <v-alert
              v-if="selectedPoints.length > 0 && selectedPoints.length < 3"
              class="mt-2"
              density="compact"
              type="warning"
              variant="tonal"
            >
              {{ $t('polygon.pointsSelected', { count: selectedPoints.length }) }}
            </v-alert>
          </div>
        </v-form>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn text @click="closeModal">{{ $t('common.cancel') }}</v-btn>
        <v-btn color="primary" :disabled="selectedPoints.length < 3" @click="submitForm">
          {{ $t('common.add') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { computed, inject, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useLayersStore } from '@/stores/layers';
import { useUIStore } from '@/stores/ui';

const uiStore = useUIStore();
const layersStore = useLayersStore();
inject('mapContainer');
const drawing = inject('drawing') as any;
const { t } = useI18n();

const form = ref({
  name: '',
});

const selectedPoints = ref<string[]>([]);

const isOpen = computed({
  get: () => uiStore.isModalOpen('polygonModal'),
  set: (value) => {
    if (!value) {
      closeModal();
    }
  },
});

function submitForm() {
  if (selectedPoints.value.length < 3) {
    uiStore.addToast(t('polygon.errors.minimumPoints'), 'error');
    return;
  }

  // Autogenerate name if empty
  const name = form.value.name.trim() || `${t('common.polygon')} ${layersStore.polygonCount + 1}`;

  // Draw polygon with point IDs (no coordinate extraction needed)
  drawing.drawPolygon(selectedPoints.value, name, '#90EE90');
  uiStore.addToast(t('polygon.created'), 'success');

  closeModal();
  resetForm();
}

function closeModal() {
  uiStore.closeModal('polygonModal');
}

function resetForm() {
  form.value = {
    name: '',
  };
  selectedPoints.value = [];
}
</script>
