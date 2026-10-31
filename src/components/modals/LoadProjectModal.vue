<template>
  <FloatingDialog
    v-model="isOpen"
    :blocking="!projectsStore.activeProject"
    max-width="600px"
    :persistent="!projectsStore.activeProject"
    @keydown.esc="closeModal"
  >
    <v-card class="project-library">
      <v-card-title>{{ $t('project.loadProject') }}</v-card-title>

      <v-card-text class="project-library-body">
        <div v-if="projectsStore.projectCount === 0" class="project-library-empty">
          <v-icon icon="mdi-folder-open-outline" size="36" />
          <p>{{ $t('sidebar.noProjects') }}</p>
        </div>

        <ul v-else class="project-library-list" data-testid="projects-list">
          <li
            v-for="project in projectsStore.sortedProjects"
            :key="project.id"
            class="project-library-row"
            :class="{ 'is-current': project.id === projectsStore.activeProjectId }"
            :data-testid="`project-item-${project.id}`"
          >
            <button
              :aria-label="`${$t('project.loadProject')} : ${project.name}`"
              class="project-library-open"
              :data-testid="`load-project-${project.id}`"
              @click="project.id && loadProject(project.id)"
            >
              <span class="project-library-icon"><v-icon icon="mdi-map-outline" size="24" /></span>

              <span class="project-library-details">
                <span class="project-library-name" :data-testid="`project-name-${project.id}`">{{
                  project.name
                }}</span>

                <span
                  v-if="project.id === projectsStore.activeProjectId"
                  class="project-library-current"
                  >{{ $t('project.currentProject') }}</span
                >

                <span class="project-library-stats">
                  <span v-for="stat in projectStats(project)" :key="stat.label"
                    >{{ stat.count }} {{ $t(stat.label).toLocaleLowerCase(locale) }}</span
                  >

                  <span v-if="projectStats(project).length === 0">{{
                    $t('project.elements', { count: 0 })
                  }}</span>
                </span>

                <time
                  v-if="project.updatedAt"
                  class="project-library-date"
                  :datetime="new Date(project.updatedAt).toISOString()"
                  :title="$t('project.lastModified')"
                  >{{ formatDate(project.updatedAt) }}</time
                >
              </span>

              <v-icon class="project-library-arrow" icon="mdi-chevron-right" size="20" />
            </button>

            <v-btn
              v-if="project.id"
              :aria-label="`${$t('common.delete')} : ${project.name}`"
              class="project-library-delete"
              :data-testid="`delete-project-${project.id}`"
              icon="mdi-trash-can-outline"
              size="small"
              :title="`${$t('common.delete')} : ${project.name}`"
              variant="text"
              @click="deleteProject(project.id)"
            />
          </li>
        </ul>
      </v-card-text>

      <v-card-actions>
        <v-spacer />

        <v-btn
          data-testid="close-load-modal-btn"
          :disabled="!projectsStore.activeProject"
          variant="text"
          @click="closeModal"
          >{{ $t('common.close') }}</v-btn
        >
      </v-card-actions>
    </v-card>
  </FloatingDialog>
</template>

<script lang="ts" setup>
import type { ProjectData } from '@/types/project';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import FloatingDialog from '@/components/shared/FloatingDialog.vue';
import { useDrawingContext, useMapContext, useNoteTooltipsContext } from '@/composables/mapContext';
import { clearUnassignedWork } from '@/services/projectRecovery';
import { useLayersStore } from '@/stores/layers';
import { useProjectsStore } from '@/stores/projects';
import { useUIStore } from '@/stores/ui';

const uiStore = useUIStore();
const layersStore = useLayersStore();
const projectsStore = useProjectsStore();
const mapContainer = useMapContext();
const drawing = useDrawingContext();
const noteTooltipsRef = useNoteTooltipsContext();
const { t, locale } = useI18n();

function projectStats(project: ProjectData) {
  return [
    { label: 'imageElement.plural', count: project.data.images?.length || 0 },
    { label: 'layers.points', count: project.data.points?.length || 0 },
    { label: 'layers.lines', count: project.data.lineSegments?.length || 0 },
    { label: 'layers.circles', count: project.data.circles?.length || 0 },
    { label: 'route.plural', count: project.data.routes?.length || 0 },
    { label: 'layers.polygons', count: project.data.polygons?.length || 0 },
    { label: 'layers.notes', count: project.data.notes?.length || 0 },
  ].filter((stat) => stat.count > 0);
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp);
}

const isOpen = computed({
  get: () => uiStore.isModalOpen('loadProjectModal'),
  set: (value) => {
    if (!value) {
      closeModal();
    }
  },
});

function loadProject(projectId: string) {
  // Keep the live state and redo branch when selecting the project already open.
  if (projectId === projectsStore.activeProjectId) {
    closeModal();
    return;
  }
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
      const wasActive = projectsStore.activeProjectId === projectId;
      projectsStore.deleteProject(index);
      if (wasActive) {
        noteTooltipsRef.value?.clearAllTooltips();
        mapContainer.clearLayers();
        layersStore.clearLayers();
        projectsStore.setActiveProject(null);
        clearUnassignedWork();
      }
      if (projectsStore.projectCount === 0) {
        uiStore.closeModal('loadProjectModal');
        uiStore.openModal('newProjectModal');
      }
      uiStore.addToast(t('project.deleted'), 'success');
    }
  }
}

function closeModal() {
  if (!projectsStore.activeProject) return;
  uiStore.closeModal('loadProjectModal');
}
</script>

<style scoped>
.project-library .project-library-body {
  padding: 12px;
}
.project-library-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.project-library-row {
  display: flex;
  align-items: center;
  border-radius: 12px;
}
.project-library-row + .project-library-row {
  margin-top: 4px;
}
.project-library-row.is-current {
  background: var(--gc-subtle);
}
.project-library-open {
  border: 0;
  background: transparent;
  font: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  min-width: 0;
  padding: 18px 12px;
  text-align: left;
  color: var(--gc-ink);
  border-radius: 12px;
}
.project-library-open:hover {
  background: var(--gc-hover);
}
.project-library-icon {
  display: grid;
  place-items: center;
  flex: 0 0 44px;
  height: 48px;
  border: 1px solid var(--gc-border);
  border-radius: 10px;
  color: var(--accent);
}
.project-library-details {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  flex: 1;
  min-width: 0;
}
.project-library-name {
  font-size: 16px;
  line-height: 1.4;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.project-library-current {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
}
.project-library-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--gc-muted);
}
.project-library-date {
  font-size: 12px;
  line-height: 1.5;
  color: var(--gc-muted);
}
.project-library-arrow {
  color: var(--accent);
  flex-shrink: 0;
}
.project-library-delete {
  color: var(--gc-muted);
  margin-inline: 4px 8px;
  flex-shrink: 0;
}
.project-library-delete:hover {
  color: var(--danger);
}
.project-library-empty {
  display: grid;
  justify-items: center;
  gap: 16px;
  padding: 40px 16px;
  color: var(--gc-muted);
  font-size: 14px;
}
@media (max-width: 480px) {
  .project-library-open {
    border: 0;
    background: transparent;
    font: inherit;
    cursor: pointer;
    gap: 10px;
    padding: 16px 8px;
  }
  .project-library-icon {
    display: none;
  }
  .project-library-arrow {
    display: none;
  }
  .project-library-delete {
    margin-inline: 0;
  }
}
</style>
