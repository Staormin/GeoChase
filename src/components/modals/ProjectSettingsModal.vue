<template>
  <v-dialog v-model="isOpen" max-width="480px" @keydown.esc="closeModal">
    <v-card>
      <v-card-title>{{ $t('project.settings') }}</v-card-title>

      <v-card-text>
        <ProjectionSelect v-model="projection" />
        <p class="mt-4 text-body-2">{{ $t('project.projection.changeHint') }}</p>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn @click="closeModal">{{ $t('common.cancel') }}</v-btn>

        <v-btn color="primary" data-testid="save-project-settings-btn" @click="saveSettings">
          {{ $t('common.save') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ProjectionSelect from '@/components/shared/ProjectionSelect.vue';
import { useDrawingContext, useNoteTooltipsContext } from '@/composables/mapContext';
import { changeProjectProjection } from '@/services/projectProjection';
import { useLayersStore } from '@/stores/layers';
import { useProjectsStore } from '@/stores/projects';
import { useUIStore } from '@/stores/ui';

const projects = useProjectsStore();
const layers = useLayersStore();
const ui = useUIStore();
const drawing = useDrawingContext();
const tooltips = useNoteTooltipsContext();
const { t } = useI18n();
const projection = ref(projects.activeProjection);
const isOpen = computed({
  get: () => ui.isModalOpen('projectSettingsModal'),
  set: (value) => {
    if (!value) closeModal();
  },
});

function closeModal() {
  ui.closeModal('projectSettingsModal');
}

function saveSettings() {
  if (!projects.activeProject) return;
  if (projection.value !== projects.activeProjection) {
    try {
      const data = changeProjectProjection(
        layers.exportLayers(),
        projects.activeProjection,
        projection.value
      );
      projects.autoSaveActiveProject(data, projection.value);
      layers.loadLayers(data);
      ui.stopAnimation();
      ui.stopNavigating();
      ui.stopFreeHandDrawing();
      ui.stopTool();
      ui.closeSearchAlong();
      tooltips.value?.clearAllTooltips();
      drawing.redrawAllElements({ fitBounds: false });
      tooltips.value?.updateNoteTooltips();
    } catch {
      ui.addToast(t('project.projection.changeError'), 'error');
      return;
    }
  }
  closeModal();
}
</script>
