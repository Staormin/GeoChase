<template>
  <div
    v-if="
      !uiStore.navigatingElement &&
      !uiStore.freeHandDrawing.isDrawing &&
      !uiStore.animationState.isPlaying
    "
  >
    <!-- Top navigation drawer -->
    <v-navigation-drawer
      v-model="uiStore.topBarOpen"
      class="topbar"
      color="surface"
      data-testid="topbar"
      elevation="4"
      location="top"
      permanent
      :width="toolbarHeight"
    >
      <div ref="toolbarContent" class="topbar-content">
        <!-- Left section: Title and Search -->
        <div class="topbar-search">
          <!-- App title -->
          <div class="topbar-title font-weight-bold">{{ $t('topbar.title') }}</div>

          <!-- Search bar next to title -->
          <div class="topbar-address">
            <SidebarAddressSearch />
          </div>
        </div>

        <!-- Drawing tools stay in the layout so they cannot cover other controls. -->
        <div
          :aria-label="$t('sidebar.drawings')"
          class="topbar-drawing topbar-buttons"
          role="group"
        >
          <v-btn
            :aria-label="$t('drawing.circle')"
            color="surface-bright"
            data-testid="draw-circle-btn"
            icon="mdi-circle-outline"
            variant="flat"
            @click="uiStore.openModal('circleModal')"
          >
            <v-icon>mdi-circle-outline</v-icon>
            <v-tooltip activator="parent" location="bottom">{{ $t('drawing.circle') }}</v-tooltip>
          </v-btn>

          <v-btn
            :aria-label="$t('drawing.twoPoints')"
            color="surface-bright"
            data-testid="draw-line-btn"
            icon="mdi-vector-line"
            variant="flat"
            @click="uiStore.openModal('twoPointsLineModal')"
          >
            <v-icon>mdi-vector-line</v-icon>

            <v-tooltip activator="parent" location="bottom">{{
              $t('drawing.twoPoints')
            }}</v-tooltip>
          </v-btn>

          <v-btn
            :aria-label="$t('drawing.azimuth')"
            color="surface-bright"
            icon="mdi-compass-outline"
            variant="flat"
            @click="uiStore.openModal('azimuthLineModal')"
          >
            <v-icon>mdi-compass-outline</v-icon>
            <v-tooltip activator="parent" location="bottom">{{ $t('drawing.azimuth') }}</v-tooltip>
          </v-btn>

          <v-btn
            :aria-label="$t('drawing.intersection')"
            color="surface-bright"
            icon
            variant="flat"
            @click="uiStore.openModal('intersectionLineModal')"
          >
            <v-icon>
              <svg
                fill="currentColor"
                height="24"
                viewBox="0 0 24 24"
                width="24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <!-- Diagonal line -->
                <path d="M4,20 L20,4" fill="none" stroke="currentColor" stroke-width="2" />
                <!-- Center point/circle -->
                <circle cx="12" cy="12" fill="currentColor" r="3" />
              </svg>
            </v-icon>

            <v-tooltip activator="parent" location="bottom">{{
              $t('drawing.intersection')
            }}</v-tooltip>
          </v-btn>

          <v-btn
            :aria-label="$t('drawing.parallel')"
            color="surface-bright"
            icon="mdi-minus"
            variant="flat"
            @click="uiStore.openModal('parallelLineModal')"
          >
            <v-icon>mdi-minus</v-icon>
            <v-tooltip activator="parent" location="bottom">{{ $t('drawing.parallel') }}</v-tooltip>
          </v-btn>

          <v-btn
            :aria-label="$t('drawing.freehand')"
            color="surface-bright"
            icon="mdi-gesture"
            variant="flat"
            @click="uiStore.openModal('freeHandLineModal')"
          >
            <v-icon>mdi-gesture</v-icon>
            <v-tooltip activator="parent" location="bottom">{{ $t('drawing.freehand') }}</v-tooltip>
          </v-btn>

          <v-btn
            :aria-label="$t('drawing.point')"
            color="surface-bright"
            data-testid="draw-point-btn"
            icon="mdi-map-marker"
            variant="flat"
            @click="uiStore.openModal('pointModal')"
          >
            <v-icon>mdi-map-marker</v-icon>
            <v-tooltip activator="parent" location="bottom">{{ $t('drawing.point') }}</v-tooltip>
          </v-btn>

          <v-btn
            :aria-label="$t('drawing.angleFromLine')"
            color="surface-bright"
            icon="mdi-angle-acute"
            variant="flat"
            @click="uiStore.openModal('angleLineModal')"
          >
            <v-icon>mdi-angle-acute</v-icon>

            <v-tooltip activator="parent" location="bottom">{{
              $t('drawing.angleFromLine')
            }}</v-tooltip>
          </v-btn>

          <v-btn
            :aria-label="$t('drawing.polygon')"
            color="surface-bright"
            icon="mdi-pentagon-outline"
            variant="flat"
            @click="uiStore.openModal('polygonModal')"
          >
            <v-icon>mdi-pentagon-outline</v-icon>
            <v-tooltip activator="parent" location="bottom">{{ $t('drawing.polygon') }}</v-tooltip>
          </v-btn>
        </div>

        <!-- Map selector section -->
        <div class="topbar-provider">
          <v-select
            v-model="uiStore.mapProvider"
            :aria-label="$t('map.provider')"
            density="compact"
            hide-details
            :items="mapProviders"
            variant="outlined"
          >
            <template #prepend-inner>
              <v-icon size="small">mdi-map</v-icon>
            </template>
          </v-select>
        </div>

        <!-- Project and application actions -->
        <div class="topbar-actions topbar-buttons">
          <div class="topbar-buttons">
            <v-btn
              :aria-label="$t('note.title')"
              color="surface-bright"
              data-testid="create-note-btn"
              icon="mdi-note-text"
              variant="flat"
              @click="handleCreateNote"
            >
              <v-icon>mdi-note-text</v-icon>
              <v-tooltip activator="parent" location="bottom">{{ $t('note.title') }}</v-tooltip>
            </v-btn>

            <v-menu location="bottom">
              <template #activator="{ props }">
                <v-btn
                  :aria-label="$t('project.title')"
                  color="surface-bright"
                  data-testid="save-menu-btn"
                  icon="mdi-content-save"
                  variant="flat"
                  v-bind="props"
                >
                  <v-icon>mdi-content-save</v-icon>

                  <v-tooltip activator="parent" location="bottom">{{
                    $t('project.title')
                  }}</v-tooltip>
                </v-btn>
              </template>

              <v-list data-testid="save-menu-dropdown" density="compact">
                <v-list-item data-testid="new-project-btn" @click="handleNewProject">
                  <template #prepend>
                    <v-icon size="small">mdi-plus-circle</v-icon>
                  </template>

                  <v-list-item-title>{{ $t('project.newProject') }}</v-list-item-title>
                </v-list-item>

                <v-list-item data-testid="load-project-btn" @click="handleLoadProject">
                  <template #prepend>
                    <v-icon size="small">mdi-folder-open</v-icon>
                  </template>

                  <v-list-item-title>{{ $t('project.loadProject') }}</v-list-item-title>
                </v-list-item>

                <v-divider />

                <v-list-item data-testid="export-json-btn" @click="handleExportJSON">
                  <template #prepend>
                    <v-icon size="small">mdi-file-export</v-icon>
                  </template>

                  <v-list-item-title>{{ $t('project.exportProject') }}</v-list-item-title>
                </v-list-item>

                <v-list-item data-testid="import-json-btn" @click="handleImportJSON">
                  <template #prepend>
                    <v-icon size="small">mdi-file-import</v-icon>
                  </template>

                  <v-list-item-title>{{ $t('project.importProject') }}</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>

            <v-btn
              :aria-label="`${$t('project.exportProject')} GPX`"
              color="surface-bright"
              icon="mdi-download"
              variant="flat"
              @click="handleExportGPX"
            >
              <v-icon>mdi-download</v-icon>

              <v-tooltip activator="parent" location="bottom"
                >{{ $t('project.exportProject') }}{{ ' ' }}GPX</v-tooltip
              >
            </v-btn>
          </div>

          <!-- Animation button -->
          <v-btn
            :aria-label="
              uiStore.animationState.isPlaying ? $t('animation.stop') : $t('animation.play')
            "
            color="surface-bright"
            data-testid="animation-btn"
            :icon="uiStore.animationState.isPlaying ? 'mdi-stop' : 'mdi-play'"
            variant="flat"
            @click="handleAnimationToggle"
          >
            <v-icon>{{ uiStore.animationState.isPlaying ? 'mdi-stop' : 'mdi-play' }}</v-icon>

            <v-tooltip activator="parent" location="bottom">
              {{ uiStore.animationState.isPlaying ? $t('animation.stop') : $t('animation.play') }}
            </v-tooltip>
          </v-btn>

          <!-- Language button -->
          <v-btn
            :aria-label="$t('common.language')"
            color="surface-bright"
            icon="mdi-translate"
            variant="flat"
            @click="uiStore.openModal('languageModal')"
          >
            <v-icon>mdi-translate</v-icon>
            <v-tooltip activator="parent" location="bottom">{{ $t('common.language') }}</v-tooltip>
          </v-btn>

          <!-- Help button -->
          <v-btn
            :aria-label="$t('tutorial.title')"
            color="surface-bright"
            icon="mdi-help-circle"
            variant="flat"
            @click="uiStore.setShowTutorial(true)"
          >
            <v-icon>mdi-help-circle</v-icon>
            <v-tooltip activator="parent" location="bottom">{{ $t('tutorial.title') }}</v-tooltip>
          </v-btn>

          <!-- PDF button -->
          <v-btn
            :aria-label="$t('pdf.title')"
            color="surface-bright"
            data-testid="pdf-btn"
            icon="mdi-file-pdf-box"
            variant="flat"
            @click="handlePdfClick"
          >
            <v-icon>mdi-file-pdf-box</v-icon>
            <v-tooltip activator="parent" location="bottom">{{ $t('pdf.title') }}</v-tooltip>
          </v-btn>

          <!-- GitHub link -->
          <v-btn
            :aria-label="$t('topbar.github')"
            color="surface-bright"
            href="https://github.com/Staormin/GeoChase"
            icon="mdi-github"
            target="_blank"
            variant="flat"
          >
            <v-icon>mdi-github</v-icon>
            <v-tooltip activator="parent" location="bottom">{{ $t('topbar.github') }}</v-tooltip>
          </v-btn>
        </div>
      </div>
    </v-navigation-drawer>

    <!-- Collapse/Expand button (centered) -->
    <div
      class="position-fixed w-100 d-flex justify-center"
      :style="{
        top: uiStore.topBarOpen ? `${toolbarHeight}px` : '0',
        zIndex: 1050,
        pointerEvents: 'none',
        transition: 'top 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      }"
    >
      <v-btn
        :aria-label="uiStore.topBarOpen ? $t('topbar.collapseTopBar') : $t('topbar.expandTopBar')"
        class="topbar-toggle"
        color="surface-bright"
        elevation="4"
        :icon="uiStore.topBarOpen ? 'mdi-chevron-up' : 'mdi-chevron-down'"
        size="small"
        style="pointer-events: auto"
        variant="elevated"
        @click="uiStore.toggleTopBar()"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import SidebarAddressSearch from '@/components/sidebar/SidebarAddressSearch.vue';
import { useProjectFiles } from '@/composables/useProjectFiles';
import { useProjectsStore } from '@/stores/projects';
import { useUIStore } from '@/stores/ui';

const emit = defineEmits<{ resize: [height: number] }>();
const toolbarContent = ref<HTMLElement | null>(null);
const toolbarHeight = ref(64);

watch(toolbarContent, (element, _, onCleanup) => {
  if (!element) return;

  const updateHeight = () => {
    toolbarHeight.value = Math.ceil(element.getBoundingClientRect().height);
    emit('resize', toolbarHeight.value);
  };
  const observer = new ResizeObserver(updateHeight);
  observer.observe(element);
  updateHeight();
  onCleanup(() => observer.disconnect());
});

const { t } = useI18n();
const uiStore = useUIStore();
const projectsStore = useProjectsStore();

const mapProviders = [
  { title: 'Geoportail (IGN)', value: 'geoportail' },
  { title: 'OpenStreetMap', value: 'osm' },
  { title: 'Google - Plan', value: 'google-plan' },
  { title: 'Google - Satellite', value: 'google-satellite' },
  { title: 'Google - Relief', value: 'google-relief' },
];

function handleNewProject() {
  uiStore.openModal('newProjectModal');
}

function handleLoadProject() {
  uiStore.openModal('loadProjectModal');
}

function handleCreateNote() {
  uiStore.clearNotePreFill();
  uiStore.openModal('noteModal');
}

function handleAnimationToggle() {
  if (uiStore.animationState.isPlaying) {
    uiStore.stopAnimation();
  } else {
    uiStore.openModal('animationModal');
  }
}

const {
  exportGPX: handleExportGPX,
  exportJSON: handleExportJSON,
  importJSON: handleImportJSON,
} = useProjectFiles();

function handlePdfClick() {
  // If no active project, show error
  if (!projectsStore.activeProjectId) {
    uiStore.addToast(t('pdf.noProject'), 'error');
    return;
  }

  // If project has PDF, toggle the panel
  if (projectsStore.hasPdf()) {
    uiStore.togglePdfPanel();
    return;
  }

  // Otherwise, open file picker to upload PDF
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/pdf';
  input.addEventListener('change', async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }

    // Check file size (limit to 50MB for IndexedDB)
    const MAX_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_SIZE) {
      uiStore.addToast(t('pdf.tooLarge'), 'error');
      return;
    }

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.addEventListener('load', async () => {
        const base64 = reader.result as string;
        await projectsStore.updatePdf(base64, file.name);
        uiStore.setPdfPanelOpen(true);
        uiStore.addToast(t('pdf.uploaded'), 'success');
      });
      reader.addEventListener('error', () => {
        uiStore.addToast(t('pdf.uploadError'), 'error');
      });
      reader.readAsDataURL(file);
    } catch (error) {
      uiStore.addToast(
        `${t('pdf.uploadError')}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      );
    }
  });
  input.click();
}
</script>

<style scoped>
.topbar-content {
  --toolbar-button-size: 32px;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 6px 10px;
}

.topbar-search {
  display: flex;
  flex: 1 1 320px;
  align-items: center;
  gap: 8px;
  min-width: 200px;
  max-width: 420px;
}

.topbar-title {
  flex-shrink: 0;
  font-size: 1rem;
}

.topbar-address {
  flex: 1;
  min-width: 0;
}

.topbar-provider {
  flex: 1 1 180px;
  min-width: 140px;
  max-width: 200px;
}

.topbar-drawing {
  margin-inline: auto;
}

.topbar-drawing,
.topbar-actions {
  flex-shrink: 0;
}

.topbar-buttons {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}

.topbar-buttons :deep(.v-btn) {
  flex: 0 0 auto;
  width: var(--toolbar-button-size);
  min-width: var(--toolbar-button-size);
  height: var(--toolbar-button-size);
  border-radius: 4px;
}

.topbar :deep(.v-icon) {
  font-size: 1.25rem;
}

.topbar-buttons :deep(svg) {
  width: 1em;
  height: 1em;
}

.topbar :deep(.v-field) {
  --v-input-control-height: 32px;
  --v-field-input-padding-top: 4px;
  --v-field-input-padding-bottom: 4px;
  font-size: 0.875rem;
}

.topbar :deep(.v-field__input) {
  min-width: 0;
}

.topbar-toggle {
  width: 36px;
  height: 24px;
  border-radius: 0 0 6px 6px;
}

@media (max-width: 1023px), (pointer: coarse) and (max-width: 1199px) {
  .topbar-content {
    display: grid;
    grid-template-areas: 'search provider' 'drawing actions';
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 6px 8px;
  }

  .topbar-search {
    grid-area: search;
    min-width: 0;
    max-width: none;
  }

  .topbar-provider {
    grid-area: provider;
    justify-self: end;
    width: 180px;
  }

  .topbar-drawing {
    grid-area: drawing;
    margin: 0;
  }

  .topbar-actions {
    grid-area: actions;
    justify-content: flex-end;
  }
}

@media (max-width: 639px), (pointer: coarse) and (max-width: 839px) {
  .topbar-content {
    grid-template-areas: 'search provider' 'drawing drawing' 'actions actions';
    grid-template-columns: minmax(0, 1fr) 140px;
    padding-inline: 8px;
  }

  .topbar-title {
    display: none;
  }

  .topbar-provider {
    width: 100%;
  }

  .topbar-drawing,
  .topbar-actions {
    justify-content: center;
    flex-wrap: wrap;
  }
}

@media (pointer: coarse) {
  .topbar-content {
    --toolbar-button-size: 44px;
  }

  .topbar :deep(.v-field) {
    --v-input-control-height: 44px;
  }

  .topbar-toggle {
    width: 44px;
    height: 44px;
  }
}
</style>
