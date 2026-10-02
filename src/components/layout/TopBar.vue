<template>
  <div>
    <v-navigation-drawer
      class="topbar"
      color="surface"
      data-testid="topbar"
      location="top"
      :model-value="uiStore.topBarOpen || uiStore.toolInstructionsVisible"
      permanent
      :width="toolbarHeight"
    >
      <div ref="toolbarContent" class="topbar-content">
        <Transition name="tool-instructions">
          <div v-if="uiStore.toolInstructionsVisible" class="tool-instructions-layer">
            <NavigationBar :style="{ minHeight: `${normalToolbarHeight / 2}px` }" />
          </div>
        </Transition>

        <div
          ref="normalToolbarContent"
          :aria-hidden="uiStore.toolInstructionsVisible || undefined"
          class="normal-toolbar"
          :class="{ 'normal-toolbar-hidden': uiStore.toolInstructionsVisible }"
          :inert="uiStore.toolInstructionsVisible"
        >
          <header
            class="workspace-header"
            :class="{ 'workspace-header-without-search': !imageMaps.canSearch }"
          >
            <div aria-label="GeoChase" class="brand">
              <span class="brand-symbol"><v-icon icon="mdi-compass-outline" size="27" /></span>

              <div>
                <strong>{{ $t('topbar.title') }}</strong>
              </div>
            </div>

            <div v-if="imageMaps.canSearch" class="topbar-address"><SidebarAddressSearch /></div>

            <div class="header-actions">
              <v-menu location="bottom end">
                <template #activator="{ props }">
                  <v-btn
                    v-bind="props"
                    append-icon="mdi-chevron-down"
                    :aria-label="$t('project.title')"
                    class="project-menu"
                    color="primary"
                    data-testid="save-menu-btn"
                    prepend-icon="mdi-folder-outline"
                    variant="tonal"
                    >{{ $t('project.title') }}</v-btn
                  >
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

                  <v-list-item
                    v-if="!imageMaps.isImageProject"
                    data-testid="project-settings-btn"
                    :disabled="!projectsStore.activeProject"
                    @click="uiStore.openModal('projectSettingsModal')"
                  >
                    <template #prepend><v-icon size="small">mdi-cog</v-icon></template>
                    <v-list-item-title>{{ $t('project.settings') }}</v-list-item-title>
                  </v-list-item>

                  <v-divider />

                  <v-list-item
                    data-testid="export-gpx-btn"
                    prepend-icon="mdi-download"
                    :title="`${$t('project.exportProject')} GPX`"
                    @click="handleExportGPX"
                  />

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
                :aria-label="$t('tutorial.title')"
                class="help-button"
                icon="mdi-help-circle-outline"
                variant="text"
                @click="uiStore.setShowTutorial(true)"
              />

              <v-menu location="bottom end">
                <template #activator="{ props }"
                  ><v-btn
                    v-bind="props"
                    :aria-label="$t('common.more')"
                    icon="mdi-dots-horizontal"
                    variant="text"
                /></template>

                <v-list>
                  <v-list-item
                    data-testid="theme-picker-btn"
                    prepend-icon="mdi-palette-outline"
                    :title="$t('workspace.themes')"
                    @click="themePickerOpen = true"
                  />

                  <v-divider class="my-1" />

                  <v-list-item
                    prepend-icon="mdi-translate"
                    :title="$t('common.language')"
                    @click="uiStore.openModal('languageModal')"
                  />

                  <v-list-item
                    href="https://github.com/Staormin/GeoChase"
                    prepend-icon="mdi-github"
                    rel="noopener noreferrer"
                    target="_blank"
                    :title="$t('topbar.github')"
                  />
                </v-list>
              </v-menu>
            </div>
          </header>

          <div class="workspace-toolbar">
            <div :aria-label="$t('sidebar.drawings')" class="drawing-tools" role="group">
              <v-btn
                v-for="tool in primaryTools"
                :key="tool.modal"
                :aria-label="$t(tool.title)"
                :data-testid="tool.testId"
                :prepend-icon="tool.icon"
                variant="text"
                @click="uiStore.openModal(tool.modal)"
                >{{ $t(tool.label) }}</v-btn
              >

              <v-menu location="bottom start">
                <template #activator="{ props }"
                  ><v-btn
                    v-bind="props"
                    append-icon="mdi-chevron-down"
                    data-testid="advanced-tools-btn"
                    prepend-icon="mdi-vector-combine"
                    variant="text"
                    >{{ $t('workspace.construct') }}</v-btn
                  ></template
                >

                <v-list class="construction-menu">
                  <v-list-subheader>{{ $t('workspace.advancedTools') }}</v-list-subheader>

                  <v-list-item
                    v-for="tool in advancedTools"
                    :key="tool.modal"
                    :prepend-icon="tool.icon"
                    :title="$t(tool.title)"
                    @click="uiStore.openModal(tool.modal)"
                  />
                </v-list>
              </v-menu>

              <span aria-hidden="true" class="tool-divider" />

              <v-btn
                :aria-label="$t('note.title')"
                data-testid="create-note-btn"
                prepend-icon="mdi-note-text-outline"
                variant="text"
                @click="handleCreateNote"
                >{{ $t('common.note') }}</v-btn
              >

              <v-btn
                :aria-label="$t('pdf.title')"
                data-testid="pdf-btn"
                prepend-icon="mdi-file-document-outline"
                variant="text"
                @click="handlePdfClick"
                >{{ $t('workspace.pdf') }}</v-btn
              >
            </div>

            <div
              class="topbar-provider"
              :class="{ 'topbar-provider-image': imageMaps.isImageProject }"
            >
              <v-select
                v-if="!imageMaps.isImageProject"
                :aria-label="$t('map.provider')"
                density="compact"
                hide-details
                :items="mapProviders"
                :model-value="uiStore.mapProvider"
                prepend-inner-icon="mdi-map-outline"
                variant="outlined"
                @update:model-value="selectMapProvider"
              />

              <v-btn
                v-else
                :disabled="imageMaps.loading"
                prepend-icon="mdi-tune"
                variant="outlined"
                @click="openRecalibration"
              >
                {{ t('imageMap.recalibrate') }}
              </v-btn>
            </div>
          </div>
        </div>
      </div>
    </v-navigation-drawer>

    <v-menu
      data-testid="quick-tools-context-menu"
      location="bottom"
      :model-value="Boolean(uiStore.quickToolsMenuPosition)"
      :target="quickToolsMenuTarget"
      @update:model-value="setQuickToolsMenuVisibility"
    >
      <v-list density="compact" min-width="220">
        <v-list-item
          v-for="tool in primaryTools"
          :key="tool.modal"
          :data-testid="`quick-${tool.testId}`"
          :prepend-icon="tool.icon"
          :title="$t(tool.label)"
          @click="uiStore.openModal(tool.modal)"
        />

        <v-divider class="my-1" />
        <v-list-subheader>{{ $t('workspace.construct') }}</v-list-subheader>

        <v-list-item
          v-for="tool in advancedTools"
          :key="tool.modal"
          :data-testid="`quick-${tool.modal}-btn`"
          :prepend-icon="tool.icon"
          :title="$t(tool.title)"
          @click="uiStore.openModal(tool.modal)"
        />

        <v-divider class="my-1" />

        <v-list-item
          data-testid="quick-create-note-btn"
          prepend-icon="mdi-note-text-outline"
          :title="$t('common.note')"
          @click="handleCreateNote"
        />

        <v-list-item
          data-testid="quick-pdf-btn"
          prepend-icon="mdi-file-document-outline"
          :title="$t('workspace.pdf')"
          @click="handlePdfClick"
        />
      </v-list>
    </v-menu>

    <div
      v-if="!uiStore.toolInstructionsVisible"
      class="topbar-toggle-wrap"
      :style="{ top: uiStore.topBarOpen ? `${toolbarHeight}px` : '0' }"
    >
      <v-btn
        :aria-label="uiStore.topBarOpen ? $t('topbar.collapseTopBar') : $t('topbar.expandTopBar')"
        class="topbar-toggle"
        color="surface"
        :icon="uiStore.topBarOpen ? 'mdi-chevron-up' : 'mdi-chevron-down'"
        size="small"
        variant="flat"
        @click="uiStore.toggleTopBar()"
      />
    </div>
  </div>

  <ThemePicker v-model="themePickerOpen" />
  <ImageMapModal v-if="imageMapOpen" @close="closeImageMap" />
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import NavigationBar from '@/components/layout/NavigationBar.vue';
import ThemePicker from '@/components/layout/ThemePicker.vue';
import ImageMapModal from '@/components/modals/ImageMapModal.vue';
import SidebarAddressSearch from '@/components/sidebar/SidebarAddressSearch.vue';
import { useProjectFiles } from '@/composables/useProjectFiles';
import { useImageMapStore } from '@/stores/imageMap';
import { useProjectsStore } from '@/stores/projects';
import { useUIStore } from '@/stores/ui';

const themePickerOpen = ref(false);

const emit = defineEmits<{ resize: [height: number] }>();
const toolbarContent = ref<HTMLElement | null>(null);
const toolbarHeight = ref(64);
const normalToolbarContent = ref<HTMLElement | null>(null);
const normalToolbarHeight = ref(134);

watch(normalToolbarContent, (element, _, onCleanup) => {
  if (!element) return;
  const updateHeight = () => {
    normalToolbarHeight.value = Math.ceil(element.getBoundingClientRect().height);
  };
  const observer = new ResizeObserver(updateHeight);
  observer.observe(element);
  updateHeight();
  onCleanup(() => observer.disconnect());
});

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
const quickToolsMenuTarget = computed<[number, number] | undefined>(() => {
  const position = uiStore.quickToolsMenuPosition;
  return position ? [position.x, position.y] : undefined;
});

function setQuickToolsMenuVisibility(open: boolean) {
  if (!open) uiStore.quickToolsMenuPosition = null;
}

const primaryTools = [
  {
    label: 'common.point',
    title: 'drawing.point',
    icon: 'mdi-map-marker-outline',
    modal: 'pointModal',
    testId: 'draw-point-btn',
  },
  {
    label: 'common.circle',
    title: 'drawing.circle',
    icon: 'mdi-circle-outline',
    modal: 'circleModal',
    testId: 'draw-circle-btn',
  },
  {
    label: 'common.line',
    title: 'drawing.twoPoints',
    icon: 'mdi-vector-line',
    modal: 'twoPointsLineModal',
    testId: 'draw-line-btn',
  },
  {
    label: 'route.title',
    title: 'route.title',
    icon: 'mdi-routes',
    modal: 'routeModal',
    testId: 'draw-route-btn',
  },
  {
    label: 'common.polygon',
    title: 'drawing.polygon',
    icon: 'mdi-pentagon-outline',
    modal: 'polygonModal',
    testId: 'draw-polygon-btn',
  },
] as const;
const advancedTools = [
  { title: 'drawing.azimuth', icon: 'mdi-compass-outline', modal: 'azimuthLineModal' },
  {
    title: 'drawing.intersection',
    icon: 'mdi-vector-intersection',
    modal: 'intersectionLineModal',
  },
  { title: 'drawing.parallel', icon: 'mdi-menu', modal: 'parallelLineModal' },
  { title: 'drawing.freehand', icon: 'mdi-gesture', modal: 'freeHandLineModal' },
  { title: 'drawing.angleFromLine', icon: 'mdi-angle-acute', modal: 'angleLineModal' },
] as const;
const imageMaps = useImageMapStore();
const imageMapOpen = ref(false);
function closeImageMap() {
  imageMapOpen.value = false;
  uiStore.closeModal('imageMapModal');
}
function openRecalibration() {
  imageMapOpen.value = true;
  uiStore.openModal('imageMapModal');
}
function selectMapProvider(provider: typeof uiStore.mapProvider) {
  if (imageMaps.isImageProject || provider === 'image') return;
  uiStore.mapProvider = provider;
}
const mapProviders = computed(() => [
  { title: 'Geoportail (IGN)', value: 'geoportail' },
  { title: 'OpenStreetMap', value: 'osm' },
  { title: 'Google - Plan', value: 'google-plan' },
  { title: 'Google - Satellite', value: 'google-satellite' },
  { title: 'Google - Relief', value: 'google-relief' },
]);

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
.topbar {
  border-bottom: 1px solid var(--gc-border);
  box-shadow: 0 2px 12px #173b4510;
}
.topbar-content {
  position: relative;
  overflow: hidden;
}
.normal-toolbar {
  transform: translateY(0);
  opacity: 1;
  transition:
    transform 280ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 180ms ease,
    visibility 0s;
}
.normal-toolbar-hidden {
  position: absolute;
  inset: 0 0 auto;
  visibility: hidden;
  pointer-events: none;
  transform: translateY(-100%);
  opacity: 0;
  transition:
    transform 240ms cubic-bezier(0.4, 0, 1, 1),
    opacity 180ms ease,
    visibility 0s 240ms;
}
.tool-instructions-enter-active,
.tool-instructions-leave-active {
  transition:
    transform 320ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 240ms ease;
}
.tool-instructions-enter-active {
  transition-delay: 80ms;
}
.tool-instructions-leave-active {
  position: absolute;
  inset: 0 0 auto;
  pointer-events: none;
}
.tool-instructions-enter-from,
.tool-instructions-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .normal-toolbar,
  .normal-toolbar-hidden,
  .tool-instructions-enter-active,
  .tool-instructions-leave-active {
    transition: none;
  }
}
.workspace-header {
  min-height: 76px;
  padding: 14px 24px;
  display: grid;
  grid-template-columns: minmax(200px, 1fr) minmax(200px, 540px) minmax(200px, 1fr);
  align-items: center;
  gap: 32px;
}
.workspace-header-without-search {
  grid-template-columns: minmax(0, 1fr) auto;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 250px;
}
.brand-symbol {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  border-radius: 13px 13px 13px 3px;
}
.brand strong {
  display: block;
  font-size: 23px;
  letter-spacing: -1px;
  line-height: 1.15;
}
.topbar-address {
  width: 100%;
  justify-self: center;
  min-width: 120px;
  max-width: 540px;
}
.header-actions {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-left: auto;
}
.header-actions > .v-btn--icon {
  width: 40px;
  height: 40px;
}
.workspace-toolbar {
  min-height: 58px;
  padding: 7px 24px;
  border-top: 1px solid var(--gc-border);
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--gc-toolbar);
}
.drawing-tools {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}
.drawing-tools .v-btn {
  padding-inline: 11px;
  height: 40px;
  font-size: 12px;
  color: var(--gc-ink);
}
.drawing-tools .v-btn:hover {
  color: var(--accent);
  background: var(--gc-hover);
}
.tool-divider {
  height: 24px;
  border-left: 1px solid var(--gc-border);
  margin: 0 7px;
}
.topbar-provider {
  display: flex;
  align-items: center;
  margin-left: auto;
  flex: 0 0 192px;
}
.topbar-provider :deep(.v-field) {
  font-size: 12px;
  --v-input-control-height: 38px;
}
.topbar :deep(.v-field__input) {
  min-width: 0;
}
.topbar-toggle-wrap {
  position: fixed;
  left: 50%;
  z-index: 1050;
  transform: translateX(-50%);
}
.topbar-toggle {
  width: 40px;
  height: 24px;
  border: 1px solid var(--gc-border);
  border-top: 0;
  border-radius: 0 0 10px 10px;
}
@media (max-width: 1199px) {
  .workspace-header {
    gap: 20px;
    padding-inline: 16px;
  }
  .brand {
    flex-basis: 190px;
  }
  .workspace-toolbar {
    padding-inline: 12px;
    gap: 8px;
  }
  .drawing-tools .v-btn {
    padding-inline: 8px;
  }
  .topbar-provider {
    display: flex;
    align-items: center;
    flex-basis: 165px;
  }
}
@media (max-width: 959px) {
  .workspace-header {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
  }
  .brand {
    flex: 1;
  }
  .topbar-address {
    order: 3;
    grid-column: 1 / -1;
    max-width: none;
  }
  .workspace-toolbar {
    flex-wrap: wrap;
  }
  .drawing-tools {
    flex: 1 1 100%;
    flex-wrap: wrap;
  }
  .topbar-provider {
    display: flex;
    align-items: center;
    flex: 1;
    max-width: 230px;
    margin-left: 0;
  }
}
@media (max-width: 599px) {
  .workspace-header {
    padding: 12px;
    gap: 10px;
  }
  .brand {
    flex-basis: 130px;
    gap: 8px;
  }
  .brand strong {
    font-size: 20px;
  }
  .brand-symbol {
    width: 34px;
    height: 34px;
  }
  .help-button {
    display: none;
  }
  .header-actions {
    gap: 0;
  }
  .project-menu {
    padding-inline: 10px;
    font-size: 12px;
  }
  .workspace-toolbar {
    padding: 6px 8px;
  }
  .drawing-tools {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 4px;
    scrollbar-width: thin;
  }
  .drawing-tools .v-btn {
    flex-shrink: 0;
    height: 44px;
  }
  .topbar-provider {
    display: flex;
    align-items: center;
    max-width: none;
  }
  .topbar-provider :deep(.v-field) {
    --v-input-control-height: 36px;
  }
}
.topbar-provider-image {
  flex: 0 0 auto;
  margin-left: auto;
  justify-content: flex-end;
}
</style>
