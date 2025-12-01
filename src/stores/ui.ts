/**
 * UI store - Manages UI state, modals, and notifications
 */

import { defineStore } from 'pinia';
import { v4 as uuidv4 } from 'uuid';
import { computed, ref } from 'vue';

export type DrawingMode = 'circle' | 'line' | 'point' | 'intersection' | 'none';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
}

export interface EditingElement {
  type: 'circle' | 'lineSegment' | 'point' | 'note';
  id: string;
}

export interface CreatingElement {
  type: 'circle' | 'lineSegment' | 'point';
}

export interface NavigatingElement {
  type: 'circle' | 'lineSegment';
  id: string;
}

export interface SearchAlongPanel {
  isOpen: boolean;
  elementType: 'lineSegment' | 'point' | null;
  elementId: string | null;
}

export interface FreeHandDrawing {
  isDrawing: boolean;
  startCoord: string | null;
  azimuth: number | undefined;
  name: string;
}

export interface BearingsPanel {
  isOpen: boolean;
  sourcePointId: string | null;
}

export interface NotePreFillElement {
  type: 'circle' | 'lineSegment' | 'point' | 'polygon';
  id: string;
}

export interface AnimationState {
  isPlaying: boolean;
  currentElementIndex: number;
  countdown: number;
}

export interface ViewCapture {
  lat: number;
  lon: number;
  zoom: number;
  screenshot?: string; // Base64 encoded image data URL
}

export interface AnimationConfig {
  type: 'smoothZoomOut' | 'startToFinish';
  startingPoint: string; // element ID
  zoomSpeed: number; // 1-10
  transitionSpeed: number; // 1-10
  hideLabelsAndNotes: boolean;
  disableZoomOnElement: boolean; // For startToFinish: show all elements in view without zooming to each
  startView?: ViewCapture; // Custom start view
  endView?: ViewCapture; // Custom end view
}

export interface ViewCaptureState {
  isCapturing: boolean;
  captureType: 'start' | 'end' | null;
}

export const useUIStore = defineStore('ui', () => {
  // State
  const openModals = ref<Set<string>>(new Set());
  const drawingMode = ref<DrawingMode>('none');
  const toasts = ref<Toast[]>([]);
  const isLoading = ref(false);
  const selectedProjectIndex = ref<number | null>(null);
  const topBarOpen = ref(true);
  const sidebarOpen = ref(true);
  const leftSidebarOpen = ref(false);
  const coordinatesFormData = ref<{ name: string; coordinates: string } | null>(null);
  const elementVisibility = ref<Record<string, boolean>>({});
  const editingElement = ref<EditingElement | null>(null);
  const selectedSegmentForPointCreation = ref<string | null>(null);
  const creatingElement = ref<CreatingElement | null>(null);
  const circleCenterPreFill = ref<{ lat: number; lon: number } | null>(null);
  const navigatingElement = ref<NavigatingElement | null>(null);
  const showTutorial = ref(false);
  const searchAlongPanel = ref<SearchAlongPanel>({
    isOpen: false,
    elementType: null,
    elementId: null,
  });
  const freeHandDrawing = ref<FreeHandDrawing>({
    isDrawing: false,
    startCoord: null,
    azimuth: undefined,
    name: '',
  });
  const searchBarVisible = ref(false);
  const bearingsPanel = ref<BearingsPanel>({
    isOpen: false,
    sourcePointId: null,
  });
  const notePreFillElement = ref<NotePreFillElement | null>(null);
  const animationState = ref<AnimationState>({
    isPlaying: false,
    currentElementIndex: -1,
    countdown: 0,
  });
  const animationConfig = ref<AnimationConfig>({
    type: 'smoothZoomOut',
    startingPoint: '',
    zoomSpeed: 5,
    transitionSpeed: 5,
    hideLabelsAndNotes: false,
    disableZoomOnElement: false,
  });
  const viewCaptureState = ref<ViewCaptureState>({
    isCapturing: false,
    captureType: null,
  });
  const mapProvider = ref<
    'geoportail' | 'osm' | 'google-plan' | 'google-satellite' | 'google-relief'
  >('geoportail');
  const pdfPanelOpen = ref(false);
  const pdfPanelWidth = ref(500); // Default width
  const pdfCurrentPage = ref(1); // Current page in PDF viewer
  const pdfZoomLevel = ref(1); // Zoom level in PDF viewer (1 = 100%)
  const pdfScrollPosition = ref<{ x: number; y: number }>({ x: 0, y: 0 }); // Scroll position in PDF viewer

  // Computed
  const isModalOpen = computed(() => (modalId: string) => openModals.value.has(modalId));

  const activeToastCount = computed(() => toasts.value.length);

  // Actions
  function openModal(modalId: string): void {
    openModals.value.add(modalId);
  }

  function closeModal(modalId: string): void {
    openModals.value.delete(modalId);
  }

  function closeAllModals(): void {
    openModals.value.clear();
  }

  function toggleModal(modalId: string): void {
    if (openModals.value.has(modalId)) {
      closeModal(modalId);
    } else {
      openModal(modalId);
    }
  }

  function setDrawingMode(mode: DrawingMode): void {
    drawingMode.value = mode;
  }

  function resetDrawingMode(): void {
    drawingMode.value = 'none';
  }

  function addToast(
    message: string,
    type: 'success' | 'error' | 'info' = 'success',
    duration = 3000
  ): void {
    const id = uuidv4();
    const toast: Toast = { id, message, type, duration };
    toasts.value.push(toast);

    if (duration) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }

  function removeToast(toastId: string): void {
    toasts.value = toasts.value.filter((t) => t.id !== toastId);
  }

  function clearAllToasts(): void {
    toasts.value = [];
  }

  function setLoading(loading: boolean): void {
    isLoading.value = loading;
  }

  function setSelectedProjectIndex(index: number | null): void {
    selectedProjectIndex.value = index;
  }

  function toggleTopBar(): void {
    topBarOpen.value = !topBarOpen.value;
  }

  function setTopBarOpen(open: boolean): void {
    topBarOpen.value = open;
  }

  function toggleSidebar(): void {
    sidebarOpen.value = !sidebarOpen.value;
  }

  function setSidebarOpen(open: boolean): void {
    sidebarOpen.value = open;
  }

  function toggleLeftSidebar(): void {
    leftSidebarOpen.value = !leftSidebarOpen.value;
  }

  function setLeftSidebarOpen(open: boolean): void {
    leftSidebarOpen.value = open;
  }

  function setCoordinatesFormData(data: { name: string; coordinates: string } | null): void {
    coordinatesFormData.value = data;
  }

  function toggleElementVisibility(elementType: string, elementId: string): void {
    const key = `${elementType}_${elementId}`;
    elementVisibility.value[key] = !isElementVisible(elementType, elementId);
  }

  function isElementVisible(elementType: string, elementId: string): boolean {
    const key = `${elementType}_${elementId}`;
    // Default to visible if not explicitly set to false
    return elementVisibility.value[key] !== false;
  }

  function setElementVisibility(elementType: string, elementId: string, visible: boolean): void {
    const key = `${elementType}_${elementId}`;
    elementVisibility.value[key] = visible;
  }

  function startEditing(type: 'circle' | 'lineSegment' | 'point' | 'note', id: string): void {
    editingElement.value = { type, id };
  }

  function stopEditing(): void {
    editingElement.value = null;
  }

  function isEditing(type: 'circle' | 'lineSegment' | 'point' | 'note', id: string): boolean {
    return editingElement.value?.type === type && editingElement.value?.id === id;
  }

  function setSelectedSegmentForPointCreation(segmentId: string | null): void {
    selectedSegmentForPointCreation.value = segmentId;
  }

  function startCreating(type: 'circle' | 'lineSegment' | 'point'): void {
    creatingElement.value = { type };
  }

  function stopCreating(): void {
    creatingElement.value = null;
    circleCenterPreFill.value = null;
  }

  function setCircleCenter(lat: number, lon: number): void {
    circleCenterPreFill.value = { lat, lon };
  }

  function startNavigating(type: 'circle' | 'lineSegment', id: string): void {
    navigatingElement.value = { type, id };
    sidebarOpen.value = false;
  }

  function stopNavigating(): void {
    navigatingElement.value = null;
  }

  function isNavigating(type: 'circle' | 'lineSegment', id: string): boolean {
    return navigatingElement.value?.type === type && navigatingElement.value?.id === id;
  }

  function setShowTutorial(show: boolean): void {
    showTutorial.value = show;
  }

  function openSearchAlong(elementType: 'lineSegment' | 'point', elementId: string): void {
    searchAlongPanel.value = {
      isOpen: true,
      elementType,
      elementId,
    };
  }

  function closeSearchAlong(): void {
    searchAlongPanel.value = {
      isOpen: false,
      elementType: null,
      elementId: null,
    };
  }

  function startFreeHandDrawing(
    startCoord: string | null,
    azimuth: number | undefined,
    name: string
  ): void {
    freeHandDrawing.value = {
      isDrawing: true,
      startCoord,
      azimuth,
      name,
    };
    sidebarOpen.value = false;
  }

  function stopFreeHandDrawing(): void {
    freeHandDrawing.value = {
      isDrawing: false,
      startCoord: null,
      azimuth: undefined,
      name: '',
    };
  }

  function toggleSearchBar(): void {
    searchBarVisible.value = !searchBarVisible.value;
  }

  function setSearchBarVisible(visible: boolean): void {
    searchBarVisible.value = visible;
  }

  function openBearings(sourcePointId: string): void {
    bearingsPanel.value = {
      isOpen: true,
      sourcePointId,
    };
  }

  function closeBearings(): void {
    bearingsPanel.value = {
      isOpen: false,
      sourcePointId: null,
    };
  }

  function setNotePreFill(type: 'circle' | 'lineSegment' | 'point' | 'polygon', id: string): void {
    notePreFillElement.value = { type, id };
  }

  function clearNotePreFill(): void {
    notePreFillElement.value = null;
  }

  function startAnimation(): void {
    animationState.value = {
      isPlaying: true,
      currentElementIndex: -1,
      countdown: 3,
    };
  }

  function stopAnimation(): void {
    animationState.value = {
      isPlaying: false,
      currentElementIndex: -1,
      countdown: 0,
    };
  }

  function setAnimationCountdown(countdown: number): void {
    animationState.value.countdown = countdown;
  }

  function setAnimationIndex(index: number): void {
    animationState.value.currentElementIndex = index;
  }

  function setAnimationConfig(config: AnimationConfig): void {
    animationConfig.value = config;
  }

  function startViewCapture(captureType: 'start' | 'end'): void {
    viewCaptureState.value = {
      isCapturing: true,
      captureType,
    };
  }

  function stopViewCapture(): void {
    viewCaptureState.value = {
      isCapturing: false,
      captureType: null,
    };
  }

  function captureView(view: ViewCapture): void {
    if (!viewCaptureState.value.isCapturing || !viewCaptureState.value.captureType) {
      return;
    }

    if (viewCaptureState.value.captureType === 'start') {
      animationConfig.value.startView = view;
    } else {
      animationConfig.value.endView = view;
    }

    stopViewCapture();
  }

  function setMapProvider(
    provider: 'geoportail' | 'osm' | 'google-plan' | 'google-satellite' | 'google-relief'
  ): void {
    mapProvider.value = provider;
  }

  function togglePdfPanel(): void {
    pdfPanelOpen.value = !pdfPanelOpen.value;
  }

  function setPdfPanelOpen(open: boolean): void {
    pdfPanelOpen.value = open;
  }

  function setPdfPanelWidth(width: number): void {
    // Clamp width between 300 and 900
    pdfPanelWidth.value = Math.max(300, Math.min(900, width));
  }

  function setPdfCurrentPage(page: number): void {
    pdfCurrentPage.value = Math.max(1, page);
  }

  function setPdfZoomLevel(zoom: number): void {
    // Clamp zoom between 0.5 (50%) and 3 (300%)
    pdfZoomLevel.value = Math.max(0.5, Math.min(3, zoom));
  }

  function setPdfScrollPosition(position: { x: number; y: number }): void {
    pdfScrollPosition.value = position;
  }

  return {
    // State
    openModals,
    drawingMode,
    toasts,
    isLoading,
    selectedProjectIndex,
    topBarOpen,
    sidebarOpen,
    leftSidebarOpen,
    coordinatesFormData,
    elementVisibility,
    editingElement,
    selectedSegmentForPointCreation,
    creatingElement,
    circleCenterPreFill,
    navigatingElement,
    showTutorial,
    searchAlongPanel,
    freeHandDrawing,
    searchBarVisible,
    bearingsPanel,
    notePreFillElement,
    animationState,
    animationConfig,
    viewCaptureState,
    mapProvider,
    pdfPanelOpen,
    pdfPanelWidth,
    pdfCurrentPage,
    pdfZoomLevel,
    pdfScrollPosition,

    // Computed
    isModalOpen,
    activeToastCount,

    // Actions
    openModal,
    closeModal,
    closeAllModals,
    toggleModal,
    setDrawingMode,
    resetDrawingMode,
    addToast,
    removeToast,
    clearAllToasts,
    setLoading,
    setSelectedProjectIndex,
    toggleTopBar,
    setTopBarOpen,
    toggleSidebar,
    setSidebarOpen,
    toggleLeftSidebar,
    setLeftSidebarOpen,
    setCoordinatesFormData,
    toggleElementVisibility,
    isElementVisible,
    setElementVisibility,
    startEditing,
    stopEditing,
    isEditing,
    setSelectedSegmentForPointCreation,
    startCreating,
    stopCreating,
    setCircleCenter,
    startNavigating,
    stopNavigating,
    isNavigating,
    setShowTutorial,
    openSearchAlong,
    closeSearchAlong,
    startFreeHandDrawing,
    stopFreeHandDrawing,
    toggleSearchBar,
    setSearchBarVisible,
    openBearings,
    closeBearings,
    setNotePreFill,
    clearNotePreFill,
    startAnimation,
    stopAnimation,
    setAnimationCountdown,
    setAnimationIndex,
    setAnimationConfig,
    startViewCapture,
    stopViewCapture,
    captureView,
    setMapProvider,
    togglePdfPanel,
    setPdfPanelOpen,
    setPdfPanelWidth,
    setPdfCurrentPage,
    setPdfZoomLevel,
    setPdfScrollPosition,
  };
});
