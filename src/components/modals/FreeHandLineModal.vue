<template>
  <v-dialog
    v-model="isOpen"
    max-width="600px"
    @click:outside="closeModal"
    @keydown.esc="closeModal"
  >
    <v-card>
      <v-card-title>{{ $t('line.freeHandTitle') }}</v-card-title>

      <v-card-text>
        <v-form @submit.prevent="submitForm">
          <v-text-field
            v-model="form.name"
            class="mb-4"
            density="compact"
            :label="$t('line.name') + ' (' + $t('common.optional') + ')'"
            variant="outlined"
          />

          <CoordinateSelector
            v-model="form.startCoord"
            :items="coordinateItems"
            :label="
              $t('common.start') +
              ' ' +
              $t('common.coordinates') +
              ' (' +
              $t('common.optional') +
              ')'
            "
            :placeholder="$t('line.selectOrClickMap')"
          />

          <v-text-field
            v-model.number="form.azimuth"
            class="mb-4"
            density="compact"
            :label="$t('line.azimuth') + ' (' + $t('common.optional') + ')'"
            max="360"
            min="0"
            :placeholder="$t('line.freeDirectionPlaceholder')"
            step="0.01"
            type="number"
            variant="outlined"
          />

          <v-alert class="mb-0" density="compact" type="info">
            {{ $t('line.freeHandInstructions') }}
          </v-alert>
        </v-form>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn @click="closeModal">{{ $t('common.cancel') }}</v-btn>
        <v-btn color="primary" @click="submitForm">{{ $t('line.startDrawing') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { computed, reactive, watch } from 'vue';
import CoordinateSelector from '@/components/shared/CoordinateSelector.vue';
import { useLayersStore } from '@/stores/layers';
import { useUIStore } from '@/stores/ui';

const uiStore = useUIStore();
const layersStore = useLayersStore();

const isOpen = computed(() => uiStore.isModalOpen('freeHandLineModal'));

const form = reactive({
  name: '',
  startCoord: null as string | null,
  azimuth: undefined as number | undefined,
});

const coordinateItems = computed(() => {
  return layersStore.sortedPoints.map((point) => ({
    label: `${point.name} (${point.coordinates.lat.toFixed(6)}, ${point.coordinates.lon.toFixed(6)})`,
    value: `${point.coordinates.lat},${point.coordinates.lon}`,
  }));
});

watch(isOpen, (newVal) => {
  if (newVal) {
    form.name = '';
    form.startCoord = null;
    form.azimuth = undefined;
  }
});

function closeModal() {
  uiStore.closeModal('freeHandLineModal');
}

function submitForm() {
  uiStore.startFreeHandDrawing(form.startCoord, form.azimuth, form.name);
  closeModal();
}
</script>
