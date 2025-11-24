<template>
  <v-dialog
    v-model="isOpen"
    max-width="400px"
    @click:outside="closeModal"
    @keydown.enter="submitForm"
    @keydown.esc="closeModal"
  >
    <v-card>
      <v-card-title>{{ $t('project.newProject') }}</v-card-title>
      <v-card-text>
        <v-form @submit.prevent="submitForm">
          <v-text-field
            v-model="projectName"
            autofocus
            class="mb-4"
            data-testid="project-name-input"
            density="compact"
            :label="$t('project.projectName')"
            :placeholder="$t('project.projectName')"
            variant="outlined"
          />
        </v-form>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn data-testid="cancel-project-btn" text @click="closeModal">{{
          $t('common.cancel')
        }}</v-btn>
        <v-btn color="primary" data-testid="create-project-btn" @click="submitForm">
          {{ $t('common.add') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { computed, inject, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useCoordinatesStore } from '@/stores/coordinates';
import { useLayersStore } from '@/stores/layers';
import { useProjectsStore } from '@/stores/projects';
import { useUIStore } from '@/stores/ui';

const uiStore = useUIStore();
const layersStore = useLayersStore();
const projectsStore = useProjectsStore();
const coordinatesStore = useCoordinatesStore();
const mapContainer = inject('mapContainer') as any;
const { t } = useI18n();

const projectName = ref('');

const isOpen = computed({
  get: () => uiStore.isModalOpen('newProjectModal'),
  set: (value) => {
    if (!value) {
      closeModal();
    }
  },
});

function submitForm() {
  if (projectName.value.trim()) {
    // Save current project if active before creating new one
    if (projectsStore.activeProjectId) {
      const currentProject = projectsStore.activeProject;
      if (currentProject) {
        const layerData = layersStore.exportLayers();
        projectsStore.updateProject(
          projectsStore.projects.indexOf(currentProject),
          currentProject.name,
          {
            circles: layerData.circles,
            lineSegments: layerData.lineSegments,
            points: layerData.points,
            polygons: layerData.polygons,
            savedCoordinates: coordinatesStore.sortedCoordinates,
            notes: layerData.notes,
          }
        );
      }
    }

    // Create and switch to new project
    projectsStore.createAndSwitchProject(projectName.value, {
      circles: [],
      lineSegments: [],
      points: [],
      polygons: [],
      savedCoordinates: [],
      notes: [],
    });

    // Clear the current view
    layersStore.clearLayers();
    coordinatesStore.clearCoordinates();

    // Clear OpenLayers map layers
    if (mapContainer) {
      mapContainer.clearLayers();
    }

    uiStore.addToast(t('project.created'), 'success');
    closeModal();
    projectName.value = '';
  } else {
    uiStore.addToast(t('project.errors.invalidName'), 'error');
  }
}

function closeModal() {
  uiStore.closeModal('newProjectModal');
}
</script>
