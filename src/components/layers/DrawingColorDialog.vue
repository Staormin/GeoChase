<template>
  <v-dialog v-model="isOpen" max-width="360">
    <v-card :title="$t('drawingColor.title')">
      <v-card-text>
        <div class="text-caption mb-2">{{ $t('drawingColor.palette') }}</div>

        <div class="color-swatches mb-4">
          <button
            v-for="swatch in DRAWING_PALETTE"
            :key="swatch"
            :aria-label="swatch"
            :aria-pressed="selected.toUpperCase() === swatch"
            class="color-swatch"
            :style="{ backgroundColor: swatch }"
            type="button"
            @click="selected = swatch"
          />
        </div>

        <template v-if="recent.length > 0">
          <div class="text-caption mb-2">{{ $t('drawingColor.recent') }}</div>

          <div class="color-swatches mb-4" data-testid="recent-drawing-colors">
            <button
              v-for="swatch in recent"
              :key="swatch"
              :aria-label="swatch"
              :aria-pressed="selected.toUpperCase() === swatch"
              class="color-swatch"
              :style="{ backgroundColor: swatch }"
              type="button"
              @click="selected = swatch"
            />
          </div>
        </template>

        <v-color-picker v-model="selected" elevation="0" hide-inputs mode="hex" width="100%" />

        <v-text-field
          v-model="selected"
          class="mt-4"
          density="compact"
          :error-messages="valid ? [] : [$t('drawingColor.invalid')]"
          :label="$t('drawingColor.custom')"
          maxlength="7"
          variant="outlined"
        />
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn @click="isOpen = false">{{ $t('common.cancel') }}</v-btn>
        <v-btn color="primary" :disabled="!valid" @click="save">{{ $t('common.save') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  DRAWING_PALETTE,
  getRecentDrawingColors,
  isDrawingColor,
  rememberDrawingColor,
} from '@/services/drawingColors';
const isOpen = defineModel<boolean>({ default: false });
const props = defineProps<{ color: string }>();
const emit = defineEmits<{ save: [color: string] }>();
const selected = ref('#000000');
const recent = ref<string[]>([]);
const valid = computed(() => isDrawingColor(selected.value));
watch(isOpen, (open) => {
  if (open) {
    selected.value = isDrawingColor(props.color) ? props.color : '#000000';
    recent.value = getRecentDrawingColors();
  }
});
function save() {
  if (!valid.value) return;
  const color = selected.value.toUpperCase();
  emit('save', color);
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
