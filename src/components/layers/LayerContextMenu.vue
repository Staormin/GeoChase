<template>
  <v-menu v-model="isOpen" :close-on-content-click="false" location="bottom">
    <template #activator="{ props: activatorProps }">
      <v-btn
        v-bind="activatorProps"
        class="ml-2"
        icon="mdi-dots-vertical"
        size="small"
        variant="text"
      />
    </template>

    <v-list density="compact">
      <!-- Visibility toggle -->
      <v-list-item @click="handleToggleVisibility">
        <template #prepend>
          <v-icon :icon="isVisible ? 'mdi-eye' : 'mdi-eye-off'" size="small" />
        </template>
        <v-list-item-title>{{
          isVisible ? $t('contextMenu.hide') : $t('contextMenu.show')
        }}</v-list-item-title>
      </v-list-item>

      <!-- Navigate (only for circles and line segments) -->
      <v-list-item v-if="['circle', 'lineSegment'].includes(elementType)" @click="handleNavigate">
        <template #prepend>
          <v-icon icon="mdi-navigation" size="small" />
        </template>
        <v-list-item-title>{{ $t('contextMenu.navigate') }}</v-list-item-title>
      </v-list-item>

      <!-- Add point on segment (only for line segments) -->
      <v-list-item v-if="elementType === 'lineSegment'" @click="handleAddPointOnSegment">
        <template #prepend>
          <v-icon icon="mdi-plus" size="small" />
        </template>
        <v-list-item-title>{{ $t('contextMenu.addPointOn') }}</v-list-item-title>
      </v-list-item>

      <!-- Location near (only for line segments and points) -->
      <v-list-item
        v-if="['lineSegment', 'point'].includes(elementType)"
        @click="handleLocationNear"
      >
        <template #prepend>
          <v-icon icon="mdi-magnify" size="small" />
        </template>
        <v-list-item-title>{{ $t('contextMenu.locationNear') }}</v-list-item-title>
      </v-list-item>

      <!-- Bearings (only for points) -->
      <v-list-item v-if="elementType === 'point'" @click="handleBearings">
        <template #prepend>
          <v-icon icon="mdi-compass" size="small" />
        </template>
        <v-list-item-title>{{ $t('contextMenu.bearings') }}</v-list-item-title>
      </v-list-item>

      <!-- Add center as point (only for polygons) -->
      <v-list-item v-if="elementType === 'polygon'" @click="handleAddCenterAsPoint">
        <template #prepend>
          <v-icon icon="mdi-image-filter-center-focus" size="small" />
        </template>
        <v-list-item-title>{{ $t('contextMenu.addCenterAsPoint') }}</v-list-item-title>
      </v-list-item>

      <!-- Add/Edit note -->
      <v-list-item @click="handleAddNote">
        <template #prepend>
          <v-icon :icon="hasNote ? 'mdi-note-edit' : 'mdi-note-plus'" size="small" />
        </template>
        <v-list-item-title>{{
          hasNote ? $t('contextMenu.editNote') : $t('contextMenu.addNote')
        }}</v-list-item-title>
      </v-list-item>

      <!-- Edit (not available for polygons) -->
      <v-list-item v-if="elementType !== 'polygon'" @click="handleEdit">
        <template #prepend>
          <v-icon icon="mdi-pencil" size="small" />
        </template>
        <v-list-item-title>{{ $t('contextMenu.edit') }}</v-list-item-title>
      </v-list-item>

      <!-- Delete -->
      <v-list-item class="text-error" @click="handleDelete">
        <template #prepend>
          <v-icon color="error" icon="mdi-delete" size="small" />
        </template>
        <v-list-item-title>{{ $t('contextMenu.delete') }}</v-list-item-title>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script lang="ts" setup>
import type {
  CircleElement,
  LineSegmentElement,
  PointElement,
  PolygonElement,
} from '@/services/storage';
import { computed, inject, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useLayersStore } from '@/stores/layers';
import { useUIStore } from '@/stores/ui';

interface Props {
  elementType: 'circle' | 'lineSegment' | 'point' | 'polygon';
  elementId: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  edit: [element: CircleElement | LineSegmentElement | PointElement | PolygonElement];
  delete: [elementType: string, elementId: string];
}>();

const isOpen = ref(false);
const uiStore = useUIStore();
const layersStore = useLayersStore();
const drawing = inject('drawing') as any;
const { t } = useI18n();

const isVisible = computed(() => uiStore.isElementVisible(props.elementType, props.elementId));

const hasNote = computed(() => {
  const element = getElement();
  return element?.noteId !== undefined;
});

function getElement() {
  switch (props.elementType) {
    case 'circle': {
      return layersStore.circles.find((c) => c.id === props.elementId);
    }
    case 'lineSegment': {
      return layersStore.lineSegments.find((s) => s.id === props.elementId);
    }
    case 'point': {
      return layersStore.points.find((p) => p.id === props.elementId);
    }
    case 'polygon': {
      return layersStore.polygons.find((p) => p.id === props.elementId);
    }
  }
}

function handleToggleVisibility() {
  uiStore.toggleElementVisibility(props.elementType, props.elementId);
  const element = getElement();
  if (element) {
    const isNowVisible = uiStore.isElementVisible(props.elementType, props.elementId);
    // Update the map visibility through the drawing composable
    drawing.updateElementVisibility(props.elementType, props.elementId, isNowVisible);
    uiStore.addToast(
      t(isNowVisible ? 'toasts.elementVisible' : 'toasts.elementHidden', { name: element.name }),
      'success'
    );
  }
  isOpen.value = false;
}

function handleNavigate() {
  const element = getElement();
  if (!element) {
    return;
  }

  const elementType = props.elementType as 'circle' | 'lineSegment' | 'point';
  if (elementType === 'circle' || elementType === 'lineSegment') {
    uiStore.startNavigating(elementType, props.elementId);
  }
  isOpen.value = false;
}

function handleAddPointOnSegment() {
  if (props.elementType !== 'lineSegment') {
    return;
  }

  // Get reference to the AddPointOnSegmentModal and call its openModal function
  // We need to emit an event or use a different approach since we can't directly reference the modal
  // The best approach is to use UIStore to track which segment to open the modal for
  uiStore.openModal('addPointOnSegmentModal');
  uiStore.setSelectedSegmentForPointCreation(props.elementId);
  isOpen.value = false;
}

function handleEdit() {
  const element = getElement();
  if (!element) {
    return;
  }

  emit('edit', element);
  isOpen.value = false;
}

function handleAddCenterAsPoint() {
  if (props.elementType !== 'polygon') {
    return;
  }

  const polygon = layersStore.polygons.find((p) => p.id === props.elementId);
  if (!polygon) {
    uiStore.addToast(t('errors.polygonNotFound'), 'error');
    return;
  }

  // Calculate polygon center by resolving point IDs to coordinates
  const points = polygon.pointIds
    .map((pointId) => layersStore.points.find((p) => p.id === pointId)?.coordinates)
    .filter((p): p is { lat: number; lon: number } => p !== undefined);

  if (points.length === 0) {
    uiStore.addToast(t('errors.noValidPointsForPolygon'), 'error');
    return;
  }

  const sumLat = points.reduce((sum, p) => sum + p.lat, 0);
  const sumLon = points.reduce((sum, p) => sum + p.lon, 0);
  const centerLat = sumLat / points.length;
  const centerLon = sumLon / points.length;

  // Create point at center
  if (drawing) {
    const pointName = t('polygon.centerPointName', { name: polygon.name });
    drawing.drawPoint(centerLat, centerLon, pointName);
    uiStore.addToast(t('toasts.centerAddedAsPoint'), 'success');
  }

  isOpen.value = false;
}

function handleDelete() {
  const element = getElement();
  if (!element) {
    uiStore.addToast(t('errors.elementNotFound'), 'error');
    return;
  }

  if (confirm(t('confirm.delete', { name: element.name }))) {
    emit('delete', props.elementType, props.elementId);
    uiStore.addToast(t('toasts.elementDeleted', { name: element.name }), 'success');
    isOpen.value = false;
  }
}

function handleLocationNear() {
  const elementType = props.elementType as 'lineSegment' | 'point';
  if (!['lineSegment', 'point'].includes(elementType)) {
    return;
  }

  const element = getElement();
  if (!element) {
    uiStore.addToast(t('errors.elementNotFound'), 'error');
    return;
  }

  uiStore.openSearchAlong(elementType, props.elementId);
  isOpen.value = false;
}

function handleBearings() {
  if (props.elementType !== 'point') {
    return;
  }

  const element = getElement();
  if (!element) {
    uiStore.addToast(t('errors.pointNotFound'), 'error');
    return;
  }

  uiStore.openBearings(props.elementId);
  isOpen.value = false;
}

function handleAddNote() {
  const element = getElement();

  if (element?.noteId) {
    // Element already has a note - edit it
    const note = layersStore.notes.find((n) => n.id === element.noteId);
    if (note) {
      uiStore.startEditing('note', note.id);
      uiStore.openModal('noteModal');
    } else {
      // Note ID exists but note not found - create new one
      uiStore.setNotePreFill(props.elementType, props.elementId);
      uiStore.openModal('noteModal');
    }
  } else {
    // No note exists - create new one
    uiStore.setNotePreFill(props.elementType, props.elementId);
    uiStore.openModal('noteModal');
  }

  isOpen.value = false;
}
</script>
