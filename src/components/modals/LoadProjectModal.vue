<template>
  <FloatingDialog v-model="isOpen" max-width="500px" @keydown.esc="closeModal">
    <v-card>
      <v-card-title>{{ $t('project.loadProject') }}</v-card-title>

      <v-card-text>
        <div v-if="projectsStore.projectCount === 0" class="text-center py-8">
          <p class="text-medium-emphasis">{{ $t('sidebar.noProjects') }}</p>
        </div>

        <v-list v-else data-testid="projects-list">
          <v-list-item
            v-for="project in projectsStore.sortedProjects"
            :key="project.id"
            class="mb-2"
            :data-testid="`project-item-${project.id}`"
          >
            <template #default>
              <div class="w-full">
                <div class="font-weight-medium" :data-testid="`project-name-${project.id}`">
                  {{ project.name }}
                </div>

                <div class="text-caption text-medium-emphasis">
                  {{ $t('layers.circles') }}: {{ project.data.circles?.length || 0 }} |
                  {{ $t('layers.lines') }}: {{ project.data.lineSegments?.length || 0 }} |
                  {{ $t('route.plural') }}: {{ project.data.routes?.length || 0 }} |
                  {{ $t('layers.points') }}:
                  {{ project.data.points?.length || 0 }}
                  <span v-if="project.data.polygons && project.data.polygons.length > 0">
                    | {{ $t('layers.polygons') }}: {{ project.data.polygons.length }}
                  </span>
                </div>

                <div v-if="project.updatedAt" class="text-caption text-disabled">
                  {{ new Date(project.updatedAt).toLocaleString() }}
                </div>
              </div>
            </template>

            <template #append>
              <v-btn-group size="x-small">
                <v-btn
                  v-if="project.id"
                  color="primary"
                  :data-testid="`load-project-${project.id}`"
                  icon="mdi-folder-open"
                  @click="loadProject(project.id)"
                />

                <v-btn
                  v-if="project.id"
                  color="error"
                  :data-testid="`delete-project-${project.id}`"
                  icon="mdi-delete"
                  @click="deleteProject(project.id)"
                />
              </v-btn-group>
            </template>
          </v-list-item>
        </v-list>
      </v-card-text>

      <v-card-actions>
        <v-spacer />

        <v-btn data-testid="close-load-modal-btn" text @click="closeModal">{{
          $t('common.close')
        }}</v-btn>
      </v-card-actions>
    </v-card>
  </FloatingDialog>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import FloatingDialog from '@/components/shared/FloatingDialog.vue';
import { useDrawingContext, useMapContext, useNoteTooltipsContext } from '@/composables/mapContext';
import { useLayersStore } from '@/stores/layers';
import { useProjectsStore } from '@/stores/projects';
import { useUIStore } from '@/stores/ui';

const uiStore = useUIStore();
const layersStore = useLayersStore();
const projectsStore = useProjectsStore();
const mapContainer = useMapContext();
const drawing = useDrawingContext();
const noteTooltipsRef = useNoteTooltipsContext();
const { t } = useI18n();

const isOpen = computed({
  get: () => uiStore.isModalOpen('loadProjectModal'),
  set: (value) => {
    if (!value) {
      closeModal();
    }
  },
});

function loadProject(projectId: string) {
  const project = projectsStore.projects.find((p) => p.id === projectId);
  if (project) {
    try {
      projectsStore.autoSaveActiveProject(layersStore.exportLayers());

      // Clear note tooltips before clearing layers
      const noteTooltips = noteTooltipsRef?.value;
      if (noteTooltips) {
        noteTooltips.clearAllTooltips();
      }

      // Clear current map layers and store
      mapContainer.clearLayers();
      layersStore.clearLayers();

      // Load new layers from project (including migration of savedCoordinates to points)
      layersStore.loadLayers({
        ...project.data,
        savedCoordinates: project.data.savedCoordinates || [],
      });

      // Select the geometry policy before rendering the new project.
      projectsStore.setActiveProject(projectId);

      // Redraw on map
      drawing.redrawAllElements();

      uiStore.addToast(t('project.loaded'), 'success');
      closeModal();
    } catch {
      uiStore.addToast(t('project.errors.loadFailed'), 'error', 5000);

      // Revert to clean state
      mapContainer.clearLayers();
      layersStore.clearLayers();
    }
  }
}

function deleteProject(projectId: string) {
  const project = projectsStore.projects.find((p) => p.id === projectId);
  if (project && confirm(`${t('common.delete')} "${project.name}"?`)) {
    const index = projectsStore.projects.findIndex((p) => p.id === projectId);
    if (index !== -1) {
      projectsStore.deleteProject(index);
      uiStore.addToast(t('project.deleted'), 'success');
    }
  }
}

function closeModal() {
  uiStore.closeModal('loadProjectModal');
}
</script>
