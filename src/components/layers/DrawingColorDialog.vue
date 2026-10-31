<template>
  <FloatingDialog v-model="isOpen" max-width="360">
    <v-card :title="$t('drawingColor.title')">
      <v-card-text>
        <!-- Section Couleur -->
        <div class="text-caption mb-2">{{ $t('drawingColor.palette') }}</div>

        <div class="color-swatches mb-4">
          <button
            v-for="swatch in DRAWING_PALETTE"
            :key="swatch"
            :aria-label="swatch"
            :aria-pressed="selectedColor.toUpperCase() === swatch"
            class="color-swatch"
            :style="{ backgroundColor: swatch }"
            type="button"
            @click="selectedColor = swatch"
          />
        </div>

        <template v-if="recent.length > 0">
          <div class="text-caption mb-2">{{ $t('drawingColor.recent') }}</div>

          <div class="color-swatches mb-4" data-testid="recent-drawing-colors">
            <button
              v-for="swatch in recent"
              :key="swatch"
              :aria-label="swatch"
              :aria-pressed="selectedColor.toUpperCase() === swatch"
              class="color-swatch"
              :style="{ backgroundColor: swatch }"
              type="button"
              @click="selectedColor = swatch"
            />
          </div>
        </template>

        <v-color-picker v-model="selectedColor" elevation="0" hide-inputs mode="hex" width="100%" />

        <v-text-field
          v-model="selectedColor"
          class="mt-4"
          density="compact"
          :error-messages="validColor ? [] : [$t('drawingColor.invalid')]"
          :label="$t('drawingColor.custom')"
          maxlength="7"
          variant="outlined"
        />

        <!-- Section Épaisseur / Trait -->
        <v-divider class="my-4" />

        <div class="d-flex justify-space-between align-center mb-1">
          <span class="text-caption">{{ $t('route.weight') }}</span>
          <span class="text-caption font-weight-bold text-primary">{{ selectedWeight }} px</span>
        </div>

        <v-slider
          v-model="selectedWeight"
          color="primary"
          density="compact"
          hide-details
          :max="20"
          :min="1"
          :step="1"
        />
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn @click="isOpen = false">{{ $t('common.cancel') }}</v-btn>
        <v-btn color="primary" :disabled="!validColor" @click="save">{{ $t('common.save') }}</v-btn>
      </v-card-actions>
    </v-card>
  </FloatingDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import FloatingDialog from '@/components/shared/FloatingDialog.vue';
import {
  DRAWING_PALETTE,
  getRecentDrawingColors,
  isDrawingColor,
  rememberDrawingColor,
} from '@/services/drawingColors';

const isOpen = defineModel<boolean>({ default: false });
const props = defineProps<{ color: string; weight?: number | string }>();
const emit = defineEmits<{ save: [color: string, weight: number] }>();

const selectedColor = ref('#000000');
const selectedWeight = ref(4);
const recent = ref<string[]>([]);

const validColor = computed(() => isDrawingColor(selectedColor.value));

watch(isOpen, (open) => {
  if (open) {
    selectedColor.value = isDrawingColor(props.color) ? props.color : '#000000';
    selectedWeight.value = Number(props.weight ?? 4);
    recent.value = getRecentDrawingColors();
  }
});

function save() {
  if (!validColor.value) return;
  const color = selectedColor.value.toUpperCase();
  emit('save', color, Number(selectedWeight.value));
  rememberDrawingColor(color);
  isOpen.value = false;
}
</script>

<style scoped>
.color-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.color-swatch {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.35);
  cursor: pointer;
}
.color-swatch[aria-pressed='true'],
.color-swatch:focus-visible {
  outline: 2px solid rgb(var(--v-theme-on-surface));
  outline-offset: 3px;
}
</style>
