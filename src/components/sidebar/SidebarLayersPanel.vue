<template>
  <div class="layers-panel">
    <!-- Title -->
    <h3 class="layers-panel-title">Layers</h3>

    <!-- Search bar (only show when there are elements) -->
    <div v-if="!layersStore.isEmpty" class="mb-3">
      <v-text-field
        v-model="searchQuery"
        class="layers-search"
        clearable
        density="compact"
        hide-details
        placeholder="Filter layers..."
        prepend-inner-icon="mdi-magnify"
        variant="outlined"
      />
    </div>

    <!-- Empty state -->
    <div v-if="layersStore.isEmpty" class="layers-empty">
      <p>No elements added yet. Use the buttons above to add circles, line segments, or points.</p>
    </div>

    <!-- No results state -->
    <div
      v-else-if="
        filteredCircles.length === 0 &&
        filteredLines.length === 0 &&
        filteredPoints.length === 0 &&
        filteredNotes.length === 0
      "
      class="layers-empty"
    >
      <p>No layers match "{{ searchQuery }}"</p>
    </div>

    <!-- Layers list -->
    <div v-else class="layers-list">
      <!-- Circles -->
      <div v-if="filteredCircles.length > 0">
        <div class="layers-section-header">
          <span class="layers-section-title" @click="circlesExpanded = !circlesExpanded"
            >Circles ({{ filteredCircles.length
            }}{{ searchQuery ? ` of ${layersStore.circleCount}` : '' }})</span
          >
          <div class="layers-section-actions">
            <v-btn
              color="primary"
              :icon="allCirclesVisible ? 'mdi-eye-off' : 'mdi-eye'"
              size="x-small"
              :title="allCirclesVisible ? 'Hide all circles' : 'Show all circles'"
              variant="text"
              @click.stop="toggleAllElementsOfType('circle')"
            />
            <span class="collapse-icon" @click="circlesExpanded = !circlesExpanded">{{
              circlesExpanded ? '▼' : '▶'
            }}</span>
          </div>
        </div>
        <div v-show="circlesExpanded" class="layer-items">
          <div
            v-for="circle in filteredCircles"
            :key="circle.id"
            class="layer-item"
            :class="{
              'layer-item-hidden': circle.id && !uiStore.isElementVisible('circle', circle.id),
            }"
          >
            <div class="layer-item-info" @click="handleGoTo('circle', circle)">
              <div class="layer-item-name">{{ circle.name }}</div>
              <div class="layer-item-type">{{ circle.radius }}km radius</div>
            </div>
            <div class="layer-item-actions">
              <LayerContextMenu
                v-if="circle.id"
                :element-id="circle.id"
                element-type="circle"
                @delete="handleDeleteElement"
                @edit="handleEditCircle(circle)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Line segments -->
      <div v-if="filteredLines.length > 0">
        <div class="layers-section-header">
          <span class="layers-section-title" @click="linesExpanded = !linesExpanded"
            >Lines ({{ filteredLines.length
            }}{{ searchQuery ? ` of ${layersStore.lineSegmentCount}` : '' }})</span
          >
          <div class="layers-section-actions">
            <v-btn
              color="primary"
              :icon="allLinesVisible ? 'mdi-eye-off' : 'mdi-eye'"
              size="x-small"
              :title="allLinesVisible ? 'Hide all lines' : 'Show all lines'"
              variant="text"
              @click.stop="toggleAllElementsOfType('lineSegment')"
            />
            <span class="collapse-icon" @click="linesExpanded = !linesExpanded">{{
              linesExpanded ? '▼' : '▶'
            }}</span>
          </div>
        </div>
        <div v-show="linesExpanded" class="layer-items">
          <div
            v-for="line in filteredLines"
            :key="line.id"
            class="layer-item"
            :class="{
              'layer-item-hidden': line.id && !uiStore.isElementVisible('lineSegment', line.id),
            }"
          >
            <div class="layer-item-info" @click="handleGoTo('lineSegment', line)">
              <div class="layer-item-name">{{ line.name }}</div>
              <div class="layer-item-type">Line segment • {{ getLineInfo(line) }}</div>
            </div>
            <div class="layer-item-actions">
              <LayerContextMenu
                v-if="line.id"
                :element-id="line.id"
                element-type="lineSegment"
                @delete="handleDeleteElement"
                @edit="handleEditLineSegment(line)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Points -->
      <div v-if="filteredPoints.length > 0">
        <div class="layers-section-header">
          <span class="layers-section-title" @click="pointsExpanded = !pointsExpanded"
            >Points ({{ filteredPoints.length
            }}{{ searchQuery ? ` of ${layersStore.pointCount}` : '' }})</span
          >
          <div class="layers-section-actions">
            <v-btn
              color="primary"
              :icon="allPointsVisible ? 'mdi-eye-off' : 'mdi-eye'"
              size="x-small"
              :title="allPointsVisible ? 'Hide all points' : 'Show all points'"
              variant="text"
              @click.stop="toggleAllElementsOfType('point')"
            />
            <span class="collapse-icon" @click="pointsExpanded = !pointsExpanded">{{
              pointsExpanded ? '▼' : '▶'
            }}</span>
          </div>
        </div>
        <div v-show="pointsExpanded" class="layer-items">
          <div
            v-for="point in filteredPoints"
            :key="point.id"
            class="layer-item"
            :class="{
              'layer-item-hidden': point.id && !uiStore.isElementVisible('point', point.id),
              'drag-over': dragOverPointId === point.id,
            }"
            draggable="true"
            @click="handlePointClick($event, point)"
            @dragend="handleDragEnd"
            @dragenter.prevent
            @dragleave="handleDragLeave($event, point)"
            @dragover.prevent="handleDragOver($event, point)"
            @dragstart="handleDragStart($event, point)"
            @drop.prevent="handleDrop($event, point)"
          >
            <div class="layer-item-info">
              <div class="layer-item-name">{{ point.name }}</div>
              <div class="layer-item-type">Point</div>
            </div>
            <div class="layer-item-actions" @click.stop>
              <LayerContextMenu
                v-if="point.id"
                :element-id="point.id"
                element-type="point"
                @delete="handleDeleteElement"
                @edit="handleEditPoint(point)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Polygons -->
      <div v-if="filteredPolygons.length > 0">
        <div class="layers-section-header">
          <span class="layers-section-title" @click="polygonsExpanded = !polygonsExpanded"
            >Polygons ({{ filteredPolygons.length
            }}{{ searchQuery ? ` of ${layersStore.polygonCount}` : '' }})</span
          >
          <div class="layers-section-actions">
            <v-btn
              color="primary"
              :icon="allPolygonsVisible ? 'mdi-eye-off' : 'mdi-eye'"
              size="x-small"
              :title="allPolygonsVisible ? 'Hide all polygons' : 'Show all polygons'"
              variant="text"
              @click.stop="toggleAllElementsOfType('polygon')"
            />
            <span class="collapse-icon" @click="polygonsExpanded = !polygonsExpanded">{{
              polygonsExpanded ? '▼' : '▶'
            }}</span>
          </div>
        </div>
        <div v-show="polygonsExpanded" class="layer-items">
          <div
            v-for="polygon in filteredPolygons"
            :key="polygon.id"
            class="layer-item"
            :class="{
              'layer-item-hidden': polygon.id && !uiStore.isElementVisible('polygon', polygon.id),
            }"
            @click="handlePolygonClick($event, polygon)"
          >
            <div class="layer-item-info">
              <div class="layer-item-name">{{ polygon.name }}</div>
              <div class="layer-item-type">Polygon ({{ polygon.points.length }} points)</div>
            </div>
            <div class="layer-item-actions" @click.stop>
              <LayerContextMenu
                v-if="polygon.id"
                :element-id="polygon.id"
                element-type="polygon"
                @delete="handleDeleteElement"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Notes -->
      <div v-if="filteredNotes.length > 0">
        <div class="layers-section-header" @click="notesExpanded = !notesExpanded">
          <span class="layers-section-title"
            >Notes ({{ filteredNotes.length
            }}{{ searchQuery ? ` of ${layersStore.noteCount}` : '' }})</span
          >
          <span class="collapse-icon">{{ notesExpanded ? '▼' : '▶' }}</span>
        </div>
        <div v-show="notesExpanded" class="layer-items">
          <div
            v-for="note in filteredNotes"
            :key="note.id"
            class="layer-item"
            @click="handleNoteClick(note)"
          >
            <div class="layer-item-info">
              <div class="layer-item-name">{{ note.title }}</div>
              <div class="layer-item-type">
                {{
                  note.linkedElementType ? `Linked to ${note.linkedElementType}` : 'Standalone note'
                }}
              </div>
            </div>
            <div class="layer-item-actions" @click.stop>
              <v-menu location="bottom">
                <template #activator="{ props }">
                  <v-btn icon="mdi-dots-vertical" size="x-small" variant="text" v-bind="props" />
                </template>
                <v-list density="compact">
                  <v-list-item @click="handleEditNote(note)">
                    <template #prepend>
                      <v-icon icon="mdi-pencil" size="small" />
                    </template>
                    <v-list-item-title>Edit</v-list-item-title>
                  </v-list-item>
                  <v-list-item class="text-error" @click="handleDeleteNote(note)">
                    <template #prepend>
                      <v-icon color="error" icon="mdi-delete" size="small" />
                    </template>
                    <v-list-item-title>Delete</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type {
  CircleElement,
  LineSegmentElement,
  NoteElement,
  PointElement,
  PolygonElement,
} from '@/services/storage';
import { getDistance } from 'ol/sphere';
import { computed, inject, ref } from 'vue';
import LayerContextMenu from '@/components/layers/LayerContextMenu.vue';
import { calculateBearing, destinationPoint } from '@/services/geometry';
import { useLayersStore } from '@/stores/layers';
import { useUIStore } from '@/stores/ui';

const layersStore = useLayersStore();
const uiStore = useUIStore();
const drawing = inject('drawing') as any;
const mapContainer = inject('mapContainer') as any;

const searchQuery = ref('');
const draggedPoint = ref<PointElement | null>(null);
const dragOverPointId = ref<string | null>(null);
const isDragging = ref(false);
const lastDropTarget = ref<PointElement | null>(null);
let dragLeaveTimeout: ReturnType<typeof setTimeout> | null = null;

// Filtered lists based on search query (using sorted arrays)
const filteredCircles = computed(() => {
  if (!searchQuery.value) return layersStore.sortedCircles;
  const query = searchQuery.value.toLowerCase();
  return layersStore.sortedCircles.filter((c) => c.name.toLowerCase().includes(query));
});

const filteredLines = computed(() => {
  if (!searchQuery.value) return layersStore.sortedLineSegments;
  const query = searchQuery.value.toLowerCase();
  return layersStore.sortedLineSegments.filter((l) => l.name.toLowerCase().includes(query));
});

const filteredPoints = computed(() => {
  if (!searchQuery.value) return layersStore.sortedPoints;
  const query = searchQuery.value.toLowerCase();
  return layersStore.sortedPoints.filter((p) => p.name.toLowerCase().includes(query));
});

const filteredPolygons = computed(() => {
  if (!searchQuery.value) return layersStore.sortedPolygons;
  const query = searchQuery.value.toLowerCase();
  return layersStore.sortedPolygons.filter((p) => p.name.toLowerCase().includes(query));
});

const filteredNotes = computed(() => {
  if (!searchQuery.value) return layersStore.sortedNotes;
  const query = searchQuery.value.toLowerCase();
  return layersStore.sortedNotes.filter(
    (n) => n.title.toLowerCase().includes(query) || n.content.toLowerCase().includes(query)
  );
});

// Collapse states for each section
const circlesExpanded = ref(true);
const linesExpanded = ref(true);
const pointsExpanded = ref(true);
const polygonsExpanded = ref(true);
const notesExpanded = ref(true);

// Check if all elements of a type are visible
const allCirclesVisible = computed(() => {
  return layersStore.circles.every((c) => c.id && uiStore.isElementVisible('circle', c.id));
});

const allLinesVisible = computed(() => {
  return layersStore.lineSegments.every(
    (l) => l.id && uiStore.isElementVisible('lineSegment', l.id)
  );
});

const allPointsVisible = computed(() => {
  return layersStore.points.every((p) => p.id && uiStore.isElementVisible('point', p.id));
});

const allPolygonsVisible = computed(() => {
  return layersStore.polygons.every((p) => p.id && uiStore.isElementVisible('polygon', p.id));
});

function getLineInfo(line: LineSegmentElement) {
  // Special handling for parallel mode
  if (line.mode === 'parallel') {
    return `parallel • ${line.longitude}°`;
  }

  // Calculate segment length using haversine formula for display
  if (!line.endpoint) {
    return `${line.mode} • (incomplete)`;
  }

  let endpoint = line.endpoint;
  if (line.mode === 'azimuth' && line.distance && line.azimuth !== undefined) {
    endpoint = destinationPoint(line.center.lat, line.center.lon, line.distance, line.azimuth);
  }

  // getDistance returns meters, convert to km
  const segmentLength =
    getDistance([line.center.lon, line.center.lat], [endpoint.lon, endpoint.lat]) / 1000;
  const azimuth = calculateBearing(line.center.lat, line.center.lon, endpoint.lat, endpoint.lon);
  const inverseAzimuth = (azimuth + 180) % 360;
  const modeLabel =
    line.mode === 'coordinate'
      ? 'coordinate'
      : line.mode === 'azimuth'
        ? 'azimuth'
        : 'intersection';

  return `${modeLabel} • ${azimuth.toFixed(2)}° / ${inverseAzimuth.toFixed(2)}° • ${segmentLength.toFixed(2)} km`;
}

function handleEditCircle(circle: CircleElement) {
  if (circle.id) {
    uiStore.startEditing('circle', circle.id);
    uiStore.openModal('circleModal');
  }
}

function handleEditLineSegment(line: LineSegmentElement) {
  if (line.id) {
    uiStore.startEditing('lineSegment', line.id);
    uiStore.openModal('lineSegmentModal');
  }
}

function handleEditPoint(point: PointElement) {
  if (point.id) {
    uiStore.startEditing('point', point.id);
    uiStore.openModal('pointModal');
  }
}

function handleDeleteElement(elementType: string, elementId: string) {
  // Use the drawing composable to delete from both map and store
  drawing.deleteElement(elementType, elementId);
}

function handleGoTo(
  elementType: string,
  element: CircleElement | LineSegmentElement | PointElement | PolygonElement
) {
  let lat: number;
  let lon: number;
  let zoom: number;

  switch (elementType) {
    case 'circle': {
      const circle = element as CircleElement;
      lat = circle.center.lat;
      lon = circle.center.lon;
      // Calculate zoom based on radius: more zoomed in formula
      zoom = Math.max(6, Math.min(18, 15 - Math.log2(circle.radius / 1.5)));

      break;
    }
    case 'lineSegment': {
      const segment = element as LineSegmentElement;
      if (segment.mode === 'parallel') {
        // For parallel, center on the parallel's latitude
        lat = segment.longitude === undefined ? 0 : segment.longitude;
        lon = 0;
        zoom = 3;
      } else if (segment.endpoint) {
        // Center on segment midpoint
        lat = (segment.center.lat + segment.endpoint.lat) / 2;
        lon = (segment.center.lon + segment.endpoint.lon) / 2;

        // Calculate zoom based on line length: more zoomed in formula (getDistance returns meters, convert to km)
        const length =
          getDistance(
            [segment.center.lon, segment.center.lat],
            [segment.endpoint.lon, segment.endpoint.lat]
          ) / 1000;
        zoom = Math.max(6, Math.min(18, 15 - Math.log2(length / 1.5)));
      } else {
        // Fallback to segment start
        lat = segment.center.lat;
        lon = segment.center.lon;
        zoom = 13;
      }

      break;
    }
    case 'polygon': {
      const polygon = element as PolygonElement;
      // Calculate center of polygon
      const sumLat = polygon.points.reduce((sum, p) => sum + p.lat, 0);
      const sumLon = polygon.points.reduce((sum, p) => sum + p.lon, 0);
      lat = sumLat / polygon.points.length;
      lon = sumLon / polygon.points.length;

      // Calculate bounds to determine zoom
      const lats = polygon.points.map((p) => p.lat);
      const lons = polygon.points.map((p) => p.lon);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLon = Math.min(...lons);
      const maxLon = Math.max(...lons);

      // Calculate diagonal distance of bounding box (getDistance returns meters, convert to km)
      const diagonal = getDistance([minLon, minLat], [maxLon, maxLat]) / 1000;
      zoom = Math.max(6, Math.min(18, 15 - Math.log2(diagonal / 1.5)));

      break;
    }
    default: {
      const point = element as PointElement;
      lat = point.coordinates.lat;
      lon = point.coordinates.lon;
      zoom = 16; // Closer zoom for points
    }
  }

  mapContainer.setCenter(lat, lon, zoom);
}

// Drag and drop handlers for creating lines between points
function handleDragStart(event: DragEvent, point: PointElement) {
  isDragging.value = true;
  draggedPoint.value = point;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'link';
  }
}

function handlePointClick(event: MouseEvent, point: PointElement) {
  if (!isDragging.value) {
    handleGoTo('point', point);
  }
}

function handlePolygonClick(event: MouseEvent, polygon: PolygonElement) {
  handleGoTo('polygon', polygon);
}

function handleDragOver(event: DragEvent, point: PointElement) {
  if (dragLeaveTimeout) {
    clearTimeout(dragLeaveTimeout);
    dragLeaveTimeout = null;
  }

  if (draggedPoint.value && draggedPoint.value.id !== point.id) {
    lastDropTarget.value = point;
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'link';
    }
    if (dragOverPointId.value !== point.id) {
      dragOverPointId.value = point.id || null;
    }
  }
}

function handleDragLeave(event: DragEvent, point: PointElement) {
  const currentTarget = event.currentTarget as HTMLElement;
  const relatedTarget = event.relatedTarget as HTMLElement;

  if (!currentTarget.contains(relatedTarget)) {
    dragLeaveTimeout = setTimeout(() => {
      if (dragOverPointId.value === point.id) {
        dragOverPointId.value = null;
      }
    }, 50);
  }
}

function handleDrop(event: DragEvent, targetPoint: PointElement) {
  if (dragLeaveTimeout) {
    clearTimeout(dragLeaveTimeout);
    dragLeaveTimeout = null;
  }

  dragOverPointId.value = null;

  if (!draggedPoint.value || draggedPoint.value.id === targetPoint.id) {
    return;
  }

  const startPoint = draggedPoint.value;
  // getDistance returns meters, convert to km
  const distance =
    getDistance(
      [startPoint.coordinates.lon, startPoint.coordinates.lat],
      [targetPoint.coordinates.lon, targetPoint.coordinates.lat]
    ) / 1000;
  const azimuth = calculateBearing(
    startPoint.coordinates.lat,
    startPoint.coordinates.lon,
    targetPoint.coordinates.lat,
    targetPoint.coordinates.lon
  );
  const inverseAzimuth = (azimuth + 180) % 360;
  const lineName = `${startPoint.name} → ${targetPoint.name}`;

  drawing.drawLineSegment(
    startPoint.coordinates.lat,
    startPoint.coordinates.lon,
    targetPoint.coordinates.lat,
    targetPoint.coordinates.lon,
    lineName,
    'coordinate',
    distance,
    undefined,
    undefined,
    undefined,
    undefined
  );

  uiStore.addToast(
    `Line created: ${lineName} (${distance.toFixed(2)}km • ${azimuth.toFixed(1)}°/${inverseAzimuth.toFixed(1)}°)`,
    'success'
  );
}

function handleDragEnd(event: DragEvent) {
  const dropWasSuccessful = event.dataTransfer?.dropEffect !== 'none';

  // If drop didn't fire but we have a last drop target, create the line anyway
  if (!dropWasSuccessful && lastDropTarget.value && draggedPoint.value) {
    handleDrop(event, lastDropTarget.value);
  }

  setTimeout(() => {
    isDragging.value = false;
    draggedPoint.value = null;
    dragOverPointId.value = null;
    lastDropTarget.value = null;
  }, 50);
}

function handleNoteClick(note: NoteElement) {
  // If note is linked to an element, navigate to it
  if (note.linkedElementType && note.linkedElementId) {
    let element;
    const elementType = note.linkedElementType;

    switch (note.linkedElementType) {
      case 'circle': {
        element = layersStore.circles.find((c) => c.id === note.linkedElementId);
        break;
      }
      case 'lineSegment': {
        element = layersStore.lineSegments.find((l) => l.id === note.linkedElementId);
        break;
      }
      case 'point': {
        element = layersStore.points.find((p) => p.id === note.linkedElementId);
        break;
      }
    }

    if (element) {
      handleGoTo(elementType, element);
    }
  }
}

function handleEditNote(note: NoteElement) {
  if (note.id) {
    uiStore.startEditing('note', note.id);
    uiStore.openModal('noteModal');
  }
}

function handleDeleteNote(note: NoteElement) {
  if (note.id && confirm(`Are you sure you want to delete the note "${note.title}"?`)) {
    layersStore.deleteNote(note.id);
    uiStore.addToast('Note deleted successfully!', 'success');
  }
}

function toggleAllElementsOfType(elementType: 'circle' | 'lineSegment' | 'point' | 'polygon') {
  let elements: any[];
  let typeName: string;
  let allVisible: boolean;

  switch (elementType) {
    case 'circle': {
      elements = layersStore.circles;
      typeName = 'circles';
      allVisible = allCirclesVisible.value;
      break;
    }
    case 'lineSegment': {
      elements = layersStore.lineSegments;
      typeName = 'lines';
      allVisible = allLinesVisible.value;
      break;
    }
    case 'point': {
      elements = layersStore.points;
      typeName = 'points';
      allVisible = allPointsVisible.value;
      break;
    }
    case 'polygon': {
      elements = layersStore.polygons;
      typeName = 'polygons';
      allVisible = allPolygonsVisible.value;
      break;
    }
  }

  // Toggle visibility: if all are visible, hide all; otherwise show all
  const newVisibility = !allVisible;

  for (const element of elements) {
    if (element.id) {
      uiStore.setElementVisibility(elementType, element.id, newVisibility);
      if (drawing) {
        drawing.updateElementVisibility(elementType, element.id, newVisibility);
      }
    }
  }

  const action = newVisibility ? 'shown' : 'hidden';
  uiStore.addToast(`All ${typeName} ${action}`, 'info');
}
</script>

<style scoped>
.layers-panel {
  background: rgb(var(--v-theme-surface-bright));
  border: none;
  border-radius: 4px;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.layers-panel-title {
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin: 0;
  padding: 16px 16px 8px 16px;
  font-weight: 600;
  flex-shrink: 0;
}

.layers-empty {
  padding: 30px 20px;
  text-align: center;
  color: rgba(var(--v-theme-on-surface), 0.6);
  font-size: 14px;
}

.mb-3 {
  padding: 0 16px 8px 16px;
  flex-shrink: 0;
  background: rgb(var(--v-theme-surface-bright));
  z-index: 1;
}

.layers-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 16px 16px 16px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.layers-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 4px 4px 4px;
  user-select: none;
  transition: background 0.2s ease;
  border-radius: 4px;
  margin-bottom: 4px;
}

.layers-section-header:hover {
  background: rgba(var(--v-theme-on-surface), 0.05);
}

.layers-section-title {
  font-size: 13px;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.9);
  margin: 0;
  cursor: pointer;
  flex: 1;
}

.layers-section-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.collapse-icon {
  font-size: 10px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  transition: transform 0.2s ease;
  cursor: pointer;
  padding: 4px;
}

.layer-items {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.layer-item {
  padding: 12px 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s ease;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.layer-item:last-child {
  border-bottom: none;
}

.layer-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.05);
  border-radius: 4px;
  padding-left: 4px;
  padding-right: 4px;
}

.layer-item-info {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.layer-item-name {
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
  word-wrap: break-word;
  overflow-wrap: break-word;
  font-size: 14px;
}

.layer-item-type {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-top: 2px;
}

.layer-item-actions {
  display: flex;
  gap: 6px;
  margin-left: 10px;
}

.layer-action-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  transition: all 0.2s ease;
  white-space: nowrap;
  font-weight: 500;
}

.layer-action-btn:hover {
  background-color: rgba(var(--v-theme-primary), 0.15);
  color: rgb(var(--v-theme-primary));
}

.layer-action-btn.delete:hover {
  background-color: rgba(var(--v-theme-error), 0.15);
  color: rgb(var(--v-theme-error));
}

.layer-action-btn.add:hover {
  background-color: rgba(var(--v-theme-primary), 0.15);
  color: rgb(var(--v-theme-primary));
}

.layer-item-hidden {
  opacity: 0.5;
}

.layer-item-hidden .layer-item-name {
  text-decoration: line-through;
}

/* Drag and drop styles */
.layer-item[draggable='true'] {
  cursor: pointer;
}

.layer-item.drag-over {
  background: rgba(var(--v-theme-primary), 0.15) !important;
  border: 2px solid rgb(var(--v-theme-primary)) !important;
  border-radius: 4px;
  padding-left: 4px;
  padding-right: 4px;
}
</style>
