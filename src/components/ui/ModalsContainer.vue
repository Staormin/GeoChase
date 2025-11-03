<template>
  <!-- Modals -->
  <CircleModal v-if="uiStore.isModalOpen('circleModal')" />
  <TwoPointsLineModal v-if="uiStore.isModalOpen('twoPointsLineModal')" />
  <AzimuthLineModal v-if="uiStore.isModalOpen('azimuthLineModal')" />
  <IntersectionLineModal v-if="uiStore.isModalOpen('intersectionLineModal')" />
  <ParallelLineModal v-if="uiStore.isModalOpen('parallelLineModal')" />
  <FreeHandLineModal v-if="uiStore.isModalOpen('freeHandLineModal')" />
  <LineSegmentModal v-if="uiStore.isModalOpen('lineSegmentModal')" />
  <PointModal v-if="uiStore.isModalOpen('pointModal')" />
  <PolygonModal v-if="uiStore.isModalOpen('polygonModal')" />
  <AddPointOnSegmentModal v-if="uiStore.isModalOpen('addPointOnSegmentModal')" />
  <CoordinatesModal v-if="uiStore.isModalOpen('coordinatesModal')" />
  <NewProjectModal v-if="uiStore.isModalOpen('newProjectModal')" />
  <LoadProjectModal v-if="uiStore.isModalOpen('loadProjectModal')" />
  <BearingsModal v-if="uiStore.bearingsPanel.isOpen" />
  <NoteModal v-if="uiStore.isModalOpen('noteModal')" />
  <AnimationModal v-if="uiStore.isModalOpen('animationModal')" />
  <TutorialModal />
</template>

<script lang="ts" setup>
import AddPointOnSegmentModal from '@/components/modals/AddPointOnSegmentModal.vue';
import AnimationModal from '@/components/modals/AnimationModal.vue';
import AzimuthLineModal from '@/components/modals/AzimuthLineModal.vue';
import BearingsModal from '@/components/modals/BearingsModal.vue';
import CircleModal from '@/components/modals/CircleModal.vue';
import CoordinatesModal from '@/components/modals/CoordinatesModal.vue';
import FreeHandLineModal from '@/components/modals/FreeHandLineModal.vue';
import IntersectionLineModal from '@/components/modals/IntersectionLineModal.vue';
import LineSegmentModal from '@/components/modals/LineSegmentModal.vue';
import LoadProjectModal from '@/components/modals/LoadProjectModal.vue';
import NewProjectModal from '@/components/modals/NewProjectModal.vue';
import NoteModal from '@/components/modals/NoteModal.vue';
import ParallelLineModal from '@/components/modals/ParallelLineModal.vue';
import PointModal from '@/components/modals/PointModal.vue';
import PolygonModal from '@/components/modals/PolygonModal.vue';
import TutorialModal from '@/components/modals/TutorialModal.vue';
import TwoPointsLineModal from '@/components/modals/TwoPointsLineModal.vue';
import { useUIStore } from '@/stores/ui';

const uiStore = useUIStore();
</script>
