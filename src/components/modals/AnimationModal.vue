<template>
  <BaseModal
    :is-open="uiStore.isModalOpen('animationModal')"
    max-width="600"
    :submit-disabled="!canStartAnimation"
    submit-text="Start Animation"
    title="Animation Options"
    @close="closeModal"
    @submit="startAnimation"
  >
    <!-- Animation Type Selection -->
    <v-radio-group v-model="form.type" class="mb-4">
      <template #label>
        <span class="text-subtitle-1 font-weight-medium">Animation Type</span>
      </template>
      <v-radio label="Smooth Zoom Out" value="smoothZoomOut">
        <template #label>
          <div>
            <div class="font-weight-medium">Smooth Zoom Out</div>
            <div class="text-caption text-medium-emphasis">
              Start zoomed in and gradually reveal all elements
            </div>
          </div>
        </template>
      </v-radio>
      <v-radio label="Start to Finish" value="startToFinish">
        <template #label>
          <div>
            <div class="font-weight-medium">Start to Finish</div>
            <div class="text-caption text-medium-emphasis">
              Show elements one by one in creation order
            </div>
          </div>
        </template>
      </v-radio>
    </v-radio-group>

    <!-- Smooth Zoom Out Options -->
    <template v-if="form.type === 'smoothZoomOut'">
      <!-- View Capture Buttons -->
      <div class="mb-4">
        <label class="text-subtitle-2 mb-2 d-block">Animation Views</label>
        <div class="view-capture-controls">
          <v-card class="view-capture-card" variant="outlined">
            <v-card-text class="pa-3">
              <div class="view-label">Start View</div>

              <!-- Image Preview -->
              <div v-if="form.startView?.screenshot" class="view-preview mb-2">
                <img
                  alt="Start view preview"
                  class="preview-image"
                  :src="form.startView.screenshot"
                />
              </div>

              <v-btn block color="primary" size="small" variant="tonal" @click="handleSetStartView">
                <v-icon start>mdi-camera-plus</v-icon>
                {{ form.startView ? 'Update' : 'Set' }} Start
              </v-btn>
              <div v-if="form.startView" class="view-info">
                <v-icon size="x-small">mdi-check-circle</v-icon>
                View captured
              </div>
            </v-card-text>
          </v-card>

          <v-card class="view-capture-card" variant="outlined">
            <v-card-text class="pa-3">
              <div class="view-label">End View</div>

              <!-- Image Preview -->
              <div v-if="form.endView?.screenshot" class="view-preview mb-2">
                <img alt="End view preview" class="preview-image" :src="form.endView.screenshot" />
              </div>

              <v-btn block color="primary" size="small" variant="tonal" @click="handleSetEndView">
                <v-icon start>mdi-camera-plus</v-icon>
                {{ form.endView ? 'Update' : 'Set' }} End
              </v-btn>
              <div v-if="form.endView" class="view-info">
                <v-icon size="x-small">mdi-check-circle</v-icon>
                View captured
              </div>
            </v-card-text>
          </v-card>
        </div>
      </div>

      <div class="mb-4">
        <div class="d-flex align-center justify-space-between mb-2">
          <label class="text-subtitle-2">Zoom Speed</label>
          <span class="text-subtitle-2 font-weight-bold text-primary">
            {{ getSpeedLabel(form.zoomSpeed) }}
          </span>
        </div>
        <v-slider
          v-model="form.zoomSpeed"
          color="primary"
          :max="10"
          :min="1"
          :step="1"
          thumb-size="20"
          track-size="4"
        />
      </div>
    </template>

    <!-- Start to Finish Options -->
    <template v-if="form.type === 'startToFinish'">
      <v-checkbox
        v-model="form.disableZoomOnElement"
        class="mb-4"
        hint="Fit all elements in view and draw them in sequence without zooming to each one"
        label="Disable zoom on element"
        persistent-hint
      />

      <div class="mb-4">
        <div class="d-flex align-center justify-space-between mb-2">
          <label class="text-subtitle-2">Animation Speed</label>
          <span class="text-subtitle-2 font-weight-bold text-primary">
            {{ getSpeedLabel(form.transitionSpeed) }}
          </span>
        </div>
        <v-slider
          v-model="form.transitionSpeed"
          color="primary"
          :max="10"
          :min="1"
          :step="1"
          thumb-size="20"
          track-size="4"
        />
      </div>
    </template>

    <!-- Additional Options -->
    <v-checkbox
      v-model="form.hideLabelsAndNotes"
      class="mb-4"
      hint="Point labels and note tooltips will be hidden for a cleaner view"
      label="Hide labels and notes during animation"
      persistent-hint
    />

    <!-- Preview Info -->
    <v-alert type="info" variant="tonal">
      <template v-if="form.type === 'smoothZoomOut'">
        <template v-if="form.startView && form.endView">
          Animation will smoothly transition from your custom start view to your custom end view,
          revealing all {{ totalElements }} elements.
        </template>
        <template v-else>
          Set custom start and end views to create your animation. Click the map to capture each
          view.
        </template>
      </template>
      <template v-else>
        Animation will show all {{ totalElements }} elements one by one in the order they were
        created.
      </template>
    </v-alert>
  </BaseModal>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import BaseModal from '@/components/shared/BaseModal.vue';
import { useLayersStore } from '@/stores/layers';
import { useUIStore } from '@/stores/ui';

const uiStore = useUIStore();
const layersStore = useLayersStore();

// Use UI store's animation config directly so it updates when views are captured
const form = computed({
  get: () => uiStore.animationConfig,
  set: (value) => {
    uiStore.setAnimationConfig(value);
  },
});

// Get all elements sorted by creation time
const allElements = computed(() => {
  return [
    ...layersStore.circles.map((c) => ({
      ...c,
      type: 'circle' as const,
      displayType: 'Circle',
    })),
    ...layersStore.lineSegments.map((l) => ({
      ...l,
      type: 'lineSegment' as const,
      displayType: 'Line',
    })),
    ...layersStore.points.map((p) => ({ ...p, type: 'point' as const, displayType: 'Point' })),
    ...layersStore.polygons.map((p) => ({
      ...p,
      type: 'polygon' as const,
      displayType: 'Polygon',
    })),
  ].toSorted((a, b) => {
    const timeA = a.createdAt || 0;
    const timeB = b.createdAt || 0;
    if (timeA !== timeB) return timeA - timeB;
    return a.id.localeCompare(b.id);
  });
});

const totalElements = computed(() => allElements.value.length);

const canStartAnimation = computed(() => {
  if (totalElements.value === 0) return false;
  if (
    form.value.type === 'smoothZoomOut' && // For smoothZoomOut, require both start and end views to be set
    (!form.value.startView || !form.value.endView)
  )
    return false;
  return true;
});

function getSpeedLabel(speed: number) {
  if (speed <= 2) return 'Very Slow';
  if (speed <= 4) return 'Slow';
  if (speed <= 6) return 'Medium';
  if (speed <= 8) return 'Fast';
  return 'Very Fast';
}

function handleSetStartView() {
  // Close modal and enter view capture mode
  closeModal();
  uiStore.startViewCapture('start');
}

function handleSetEndView() {
  // Close modal and enter view capture mode
  closeModal();
  uiStore.startViewCapture('end');
}

function closeModal() {
  uiStore.closeModal('animationModal');
}

function startAnimation() {
  if (!canStartAnimation.value) return;

  // Store animation config in UI store for useAnimation to consume
  uiStore.setAnimationConfig(form.value);

  // Close modal and start animation
  closeModal();
  uiStore.startAnimation();
}
</script>

<style scoped>
.view-capture-controls {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.view-capture-card {
  transition: all 0.2s ease;
}

.view-capture-card:hover {
  border-color: rgb(var(--v-theme-primary));
}

.view-label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgb(var(--v-theme-on-surface-variant));
  margin-bottom: 8px;
}

.view-info {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: rgb(var(--v-theme-success));
  margin-top: 8px;
  font-weight: 500;
}

.view-preview {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  overflow: hidden;
  background: rgb(var(--v-theme-surface-variant));
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
</style>
