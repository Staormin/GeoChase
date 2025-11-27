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
      color="surface"
      elevation="4"
      location="top"
      permanent
      style="height: 64px !important"
    >
      <div class="d-flex align-center px-4 h-100">
        <!-- Left section: Title and Search -->
        <div class="d-flex align-center ga-4">
          <!-- App title -->
          <div class="text-h6 font-weight-bold">{{ $t('topbar.title') }}</div>

          <!-- Search bar next to title -->
          <div class="position-relative" style="width: 350px">
            <SidebarAddressSearch />
          </div>
        </div>

        <v-spacer />

        <!-- Map selector section -->
        <div class="d-flex align-center">
          <v-select
            v-model="uiStore.mapProvider"
            density="compact"
            hide-details
            :items="mapProviders"
            style="width: 220px"
            variant="outlined"
          >
            <template #prepend-inner>
              <v-icon size="small">mdi-map</v-icon>
            </template>
          </v-select>
        </div>

        <!-- Action buttons section -->
        <v-divider class="mx-2" vertical />

        <v-btn-group density="compact">
          <v-btn
            color="surface-bright"
            data-testid="coordinates-btn"
            icon="mdi-book-open-variant"
            variant="elevated"
            @click="uiStore.openModal('coordinatesModal')"
          >
            <v-icon>mdi-book-open-variant</v-icon>
            <v-tooltip activator="parent" location="bottom">{{
              $t('coordinates.title')
            }}</v-tooltip>
          </v-btn>

          <v-btn
            color="surface-bright"
            data-testid="create-note-btn"
            icon="mdi-note-text"
            variant="elevated"
            @click="handleCreateNote"
          >
            <v-icon>mdi-note-text</v-icon>
            <v-tooltip activator="parent" location="bottom">{{ $t('note.title') }}</v-tooltip>
          </v-btn>

          <v-menu location="bottom">
            <template #activator="{ props }">
              <v-btn
                color="surface-bright"
                data-testid="save-menu-btn"
                icon="mdi-content-save"
                variant="elevated"
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
            color="surface-bright"
            icon="mdi-download"
            variant="elevated"
            @click="handleExportGPX"
          >
            <v-icon>mdi-download</v-icon>
            <v-tooltip activator="parent" location="bottom"
              >{{ $t('project.exportProject') }}{{ ' ' }}GPX</v-tooltip
            >
          </v-btn>
        </v-btn-group>

        <v-divider class="mx-2" vertical />

        <!-- Animation button -->
        <v-btn
          color="surface-bright"
          data-testid="animation-btn"
          :icon="uiStore.animationState.isPlaying ? 'mdi-stop' : 'mdi-play'"
          variant="elevated"
          @click="handleAnimationToggle"
        >
          <v-icon>{{ uiStore.animationState.isPlaying ? 'mdi-stop' : 'mdi-play' }}</v-icon>
          <v-tooltip activator="parent" location="bottom">
            {{ uiStore.animationState.isPlaying ? $t('animation.stop') : $t('animation.play') }}
          </v-tooltip>
        </v-btn>

        <!-- Language button -->
        <v-btn
          color="surface-bright"
          icon="mdi-translate"
          variant="elevated"
          @click="uiStore.openModal('languageModal')"
        >
          <v-icon>mdi-translate</v-icon>
          <v-tooltip activator="parent" location="bottom">{{ $t('common.language') }}</v-tooltip>
        </v-btn>

        <!-- Help button -->
        <v-btn
          color="surface-bright"
          icon="mdi-help-circle"
          variant="elevated"
          @click="uiStore.setShowTutorial(true)"
        >
          <v-icon>mdi-help-circle</v-icon>
          <v-tooltip activator="parent" location="bottom">{{ $t('tutorial.title') }}</v-tooltip>
        </v-btn>

        <!-- PDF button -->
        <v-btn
          :color="projectsStore.hasPdf() ? 'primary' : 'surface-bright'"
          data-testid="pdf-btn"
          icon="mdi-file-pdf-box"
          variant="elevated"
          @click="handlePdfClick"
        >
          <v-icon>mdi-file-pdf-box</v-icon>
          <v-tooltip activator="parent" location="bottom">{{ $t('pdf.title') }}</v-tooltip>
        </v-btn>

        <!-- GitHub link -->
        <v-btn
          class="mr-2"
          color="surface-bright"
          href="https://github.com/Staormin/GeoChase"
          icon="mdi-github"
          target="_blank"
          variant="elevated"
        >
          <v-icon>mdi-github</v-icon>
          <v-tooltip activator="parent" location="bottom">{{ $t('topbar.github') }}</v-tooltip>
        </v-btn>

        <!-- Drawing tools - absolutely centered -->
        <div
          class="position-absolute top-0 start-0 w-100 h-100 d-flex justify-center align-center"
          style="pointer-events: none; overflow: hidden"
        >
          <v-btn-group
            density="compact"
            style="pointer-events: auto; position: relative; z-index: 1"
          >
            <v-btn
              color="surface-bright"
              data-testid="draw-circle-btn"
              icon="mdi-circle-outline"
              variant="elevated"
              @click="uiStore.openModal('circleModal')"
            >
              <v-icon>mdi-circle-outline</v-icon>
              <v-tooltip activator="parent" location="bottom">{{ $t('drawing.circle') }}</v-tooltip>
            </v-btn>

            <v-btn
              color="surface-bright"
              data-testid="draw-line-btn"
              icon="mdi-vector-line"
              variant="elevated"
              @click="uiStore.openModal('twoPointsLineModal')"
            >
              <v-icon>mdi-vector-line</v-icon>
              <v-tooltip activator="parent" location="bottom">{{
                $t('drawing.twoPoints')
              }}</v-tooltip>
            </v-btn>

            <v-btn
              color="surface-bright"
              icon="mdi-compass-outline"
              variant="elevated"
              @click="uiStore.openModal('azimuthLineModal')"
            >
              <v-icon>mdi-compass-outline</v-icon>
              <v-tooltip activator="parent" location="bottom">{{
                $t('drawing.azimuth')
              }}</v-tooltip>
            </v-btn>

            <v-btn
              color="surface-bright"
              icon
              variant="elevated"
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
              color="surface-bright"
              icon="mdi-minus"
              variant="elevated"
              @click="uiStore.openModal('parallelLineModal')"
            >
              <v-icon>mdi-minus</v-icon>
              <v-tooltip activator="parent" location="bottom">{{
                $t('drawing.parallel')
              }}</v-tooltip>
            </v-btn>

            <v-btn
              color="surface-bright"
              icon="mdi-gesture"
              variant="elevated"
              @click="uiStore.openModal('freeHandLineModal')"
            >
              <v-icon>mdi-gesture</v-icon>
              <v-tooltip activator="parent" location="bottom">{{
                $t('drawing.freehand')
              }}</v-tooltip>
            </v-btn>

            <v-btn
              color="surface-bright"
              data-testid="draw-point-btn"
              icon="mdi-map-marker"
              variant="elevated"
              @click="uiStore.openModal('pointModal')"
            >
              <v-icon>mdi-map-marker</v-icon>
              <v-tooltip activator="parent" location="bottom">{{ $t('drawing.point') }}</v-tooltip>
            </v-btn>

            <v-btn
              color="surface-bright"
              icon="mdi-angle-acute"
              variant="elevated"
              @click="uiStore.openModal('angleLineModal')"
            >
              <v-icon>mdi-angle-acute</v-icon>
              <v-tooltip activator="parent" location="bottom">{{
                $t('drawing.angleFromLine')
              }}</v-tooltip>
            </v-btn>

            <v-btn
              color="surface-bright"
              icon="mdi-pentagon-outline"
              variant="elevated"
              @click="uiStore.openModal('polygonModal')"
            >
              <v-icon>mdi-pentagon-outline</v-icon>
              <v-tooltip activator="parent" location="bottom">{{
                $t('drawing.polygon')
              }}</v-tooltip>
            </v-btn>
          </v-btn-group>
        </div>
      </div>
    </v-navigation-drawer>

    <!-- Collapse/Expand button (centered) -->
    <div
      class="position-fixed w-100 d-flex justify-center pt-2"
      :style="{
        top: uiStore.topBarOpen ? '64px' : '0',
        zIndex: 1050,
        pointerEvents: 'none',
        transition: 'top 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      }"
    >
      <v-btn
        :aria-label="uiStore.topBarOpen ? $t('topbar.collapseTopBar') : $t('topbar.expandTopBar')"
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
import { useI18n } from 'vue-i18n';
import SidebarAddressSearch from '@/components/sidebar/SidebarAddressSearch.vue';
import { downloadGPX, generateCompleteGPX, getTimestamp } from '@/services/gpx';
import { useCoordinatesStore } from '@/stores/coordinates';
import { useLayersStore } from '@/stores/layers';
import { useProjectsStore } from '@/stores/projects';
import { useUIStore } from '@/stores/ui';

const { t } = useI18n();
const uiStore = useUIStore();
const layersStore = useLayersStore();
const coordinatesStore = useCoordinatesStore();
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

function handleExportGPX() {
  const circles = layersStore.circles.map((c) => ({
    lat: c.center.lat,
    lon: c.center.lon,
    radius: c.radius,
    name: c.name,
  }));

  const radii = [...new Set(circles.map((c) => c.radius))];
  const lineSegments = layersStore.lineSegments;

  const gpx = generateCompleteGPX(circles, radii, 360, lineSegments, layersStore.points);

  const projectName = projectsStore.activeProject?.name || 'project';
  const sanitizedName = projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const filename = `${sanitizedName}_${getTimestamp()}.gpx`;

  downloadGPX(gpx, filename);
  uiStore.addToast('GPX exported successfully!', 'success');
}

function handleExportJSON() {
  const projectData = {
    circles: layersStore.circles,
    lineSegments: layersStore.lineSegments,
    points: layersStore.points,
    polygons: layersStore.polygons,
    notes: layersStore.notes,
    coordinates: coordinatesStore.savedCoordinates,
    exportedAt: new Date().toISOString(),
  };

  const jsonString = JSON.stringify(projectData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;

  const projectName = projectsStore.activeProject?.name || 'project';
  const sanitizedName = projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  link.download = `${sanitizedName}_${getTimestamp()}.json`;

  link.click();
  URL.revokeObjectURL(url);
  uiStore.addToast('Project exported as JSON successfully!', 'success');
}

async function handleImportJSON() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.addEventListener('change', async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      const projectData = JSON.parse(content);

      layersStore.clearLayers();
      coordinatesStore.clearCoordinates();

      if (projectData.circles && Array.isArray(projectData.circles)) {
        for (const circle of projectData.circles) {
          layersStore.addCircle({
            id: circle.id,
            name: circle.name,
            center: circle.center,
            radius: circle.radius,
            color: circle.color,
            mapElementId: circle.mapElementId,
          });
        }
      }

      if (projectData.lineSegments && Array.isArray(projectData.lineSegments)) {
        for (const line of projectData.lineSegments) {
          layersStore.addLineSegment({
            id: line.id,
            name: line.name,
            center: line.center,
            endpoint: line.endpoint,
            mode: line.mode,
            distance: line.distance,
            azimuth: line.azimuth,
            intersectionPoint: line.intersectionPoint,
            intersectionDistance: line.intersectionDistance,
            longitude: line.longitude,
            color: line.color,
            mapElementId: line.mapElementId,
          });
        }
      }

      if (projectData.points && Array.isArray(projectData.points)) {
        for (const point of projectData.points) {
          layersStore.addPoint({
            id: point.id,
            name: point.name,
            coordinates: point.coordinates,
            elevation: point.elevation,
            color: point.color,
            mapElementId: point.mapElementId,
          });
        }
      }

      if (projectData.polygons && Array.isArray(projectData.polygons)) {
        for (const polygon of projectData.polygons) {
          layersStore.addPolygon({
            id: polygon.id,
            name: polygon.name,
            pointIds: polygon.pointIds,
            color: polygon.color,
            mapElementId: polygon.mapElementId,
          });
        }
      }

      if (projectData.notes && Array.isArray(projectData.notes)) {
        for (const note of projectData.notes) {
          layersStore.addNote({
            id: note.id,
            title: note.title,
            content: note.content,
            linkedElementType: note.linkedElementType,
            linkedElementId: note.linkedElementId,
          });
        }
      }

      if (projectData.coordinates && Array.isArray(projectData.coordinates)) {
        for (const coord of projectData.coordinates) {
          coordinatesStore.addCoordinate(coord.name, coord.lat, coord.lon);
        }
      }

      uiStore.addToast('Project imported successfully!', 'success');
    } catch (error) {
      uiStore.addToast(
        `Error importing project: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      );
    }
  });
  input.click();
}

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
