<template>
  <FloatingDialog v-model="open" max-height="min(760px, 85vh)" max-width="580" scrollable>
    <v-card class="theme-picker">
      <v-card-title class="theme-picker-heading">
        <span>{{ $t('workspace.themes') }}</span>

        <v-btn
          :aria-label="$t('common.close')"
          icon="mdi-close"
          variant="text"
          @click="open = false"
        />
      </v-card-title>

      <v-card-text>
        <p class="theme-picker-hint">{{ $t('workspace.themeHint') }}</p>

        <div :aria-label="$t('workspace.themes')" class="palette-grid" role="group">
          <button
            v-for="palette in palettes"
            :key="palette.id"
            :aria-pressed="selected === palette.id"
            class="palette-option"
            :class="{ selected: selected === palette.id }"
            :data-testid="`palette-${palette.id}`"
            type="button"
            @click="choose(palette)"
          >
            <span
              aria-hidden="true"
              class="palette-preview"
              :style="{
                background: preview(palette).background,
                color: preview(palette)['on-surface'],
                '--preview-panel': preview(palette).surface,
                '--preview-controls': preview(palette)['surface-bright'],
                '--preview-primary': preview(palette).primary,
                '--preview-secondary': preview(palette).secondary,
              }"
            >
              <span class="preview-header"
                ><span class="preview-dot" />

                <span class="preview-search"
              /></span>

              <span class="preview-body"
                ><span class="preview-sidebar"><i /><i /><i /></span>

                <span class="preview-map"><span /></span
              ></span>

              <v-icon
                v-if="selected === palette.id"
                class="preview-check"
                icon="mdi-check-circle"
                size="20"
              />
            </span>

            <span class="palette-name">{{ $t(`workspace.paletteNames.${palette.id}`) }}</span>
          </button>
        </div>
      </v-card-text>

      <v-card-actions
        ><v-spacer />

        <v-btn color="primary" variant="flat" @click="open = false">{{
          $t('common.close')
        }}</v-btn></v-card-actions
      >
    </v-card>
  </FloatingDialog>
</template>
<script setup lang="ts">
import type { Palette } from '@/services/themes';
import { computed } from 'vue';
import { useTheme } from 'vuetify';
import FloatingDialog from '@/components/shared/FloatingDialog.vue';
import { palettes, themes } from '@/services/themes';
const open = defineModel<boolean>({ default: false });
const theme = useTheme();
const selected = computed(() => palettes.find((p) => p.theme === theme.name.value)?.id);
function themeName(palette: Palette) {
  return palette.theme;
}
function preview(palette: Palette) {
  return themes[themeName(palette)]!.colors;
}
function choose(palette: Palette) {
  void theme.change(themeName(palette));
}
</script>
<style scoped>
.theme-picker {
  border: 1px solid var(--gc-border);
  border-radius: 18px !important;
}
.theme-picker-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--gc-border);
}
.theme-picker-hint {
  margin-bottom: 20px;
  color: var(--gc-muted);
  font-size: 14px;
  line-height: 1.6;
}
.palette-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.palette-option {
  border: 1px solid var(--gc-border);
  border-radius: 12px;
  padding: 0;
  overflow: hidden;
  text-align: left;
  font: inherit;
  background: var(--bg);
  color: var(--gc-ink);
  cursor: pointer;
}
.palette-option.selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}
.palette-preview {
  display: block;
  height: 86px;
  padding: 10px;
  position: relative;
}
.preview-header {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 16px;
  padding: 4px;
  background: var(--preview-panel);
}
.preview-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: var(--preview-primary);
}
.preview-search {
  width: 45%;
  height: 6px;
  margin: auto;
  border-radius: 2px;
  background: var(--preview-controls);
}
.preview-body {
  display: flex;
  height: 48px;
  gap: 6px;
  margin-top: 3px;
}
.preview-sidebar {
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: 30%;
  padding: 7px 5px;
  background: var(--preview-panel);
}
.preview-sidebar i {
  height: 4px;
  border-radius: 2px;
  background: var(--preview-controls);
}
.preview-sidebar i:first-child {
  background: var(--preview-primary);
}
.preview-map {
  flex: 1;
  position: relative;
}
.preview-map > span {
  display: block;
  width: 29px;
  height: 29px;
  margin: 7px auto;
  border-radius: 50%;
  border: 2px solid var(--preview-secondary);
}
.preview-check {
  position: absolute;
  right: 8px;
  bottom: 8px;
  color: var(--preview-primary);
}
.palette-name {
  display: block;
  padding: 10px 12px;
  font-size: 14px;
  font-weight: 500;
  border-top: 1px solid var(--gc-border);
}
.theme-picker .v-card-actions {
  padding: 12px 20px;
  border-top: 1px solid var(--gc-border);
}
@media (max-width: 520px) {
  .palette-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
