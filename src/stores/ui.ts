/**
 * UI store - Manages UI state, modals, and notifications
 */

import { defineStore } from 'pinia';
import { v4 as uuidv4 } from 'uuid';
import { computed, ref } from 'vue';

export interface MapElementRequest {
  elementType: 'route' | 'circle' | 'lineSegment' | 'point' | 'polygon';
  elementId: string;
}

export type DrawingMode = 'circle' | 'line' | 'point' | 'intersection' | 'none';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
}

export interface EditingElement {
  type: 'route' | 'circle' | 'lineSegment' | 'point' | 'note';
  id: string;
}

export interface CreatingElement {
  type: 'route' | 'circle' | 'lineSegment' | 'point';
  prefill?: { lat: number; lon: number; name?: string };
}

export interface NavigatingElement {
  type: 'route' | 'circle' | 'lineSegment';
  id: string;
}

export interface IntersectionLineEdit {
  lineId: string;
  name: string;
  distanceKm: number;
  snappedTo: string | null;
}

export interface SearchAlongPanel {
  isOpen: boolean;
  elementType: 'route' | 'lineSegment' | 'point' | null;
  elementId: string | null;
}

export interface FreeHandDrawing {
  snappedPointName?: string;
  intersectionPointName?: string;
  draggingFromPoint?: boolean;
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
  type: 'route' | 'circle' | 'lineSegment' | 'point' | 'polygon';
  id: string;
}

export type ToolId = 'ruler';

export interface ToolsState {
  isToolbarOpen: boolean;
  activeTool: ToolId | null;
}

export const useUIStore = defineStore('ui', () => {
  // State
  const openModals = ref<Set<string>>(new Set());
  const gameMode = ref(false);
  const mapBackgroundVisible = ref(true);
  const drawingMode = ref<DrawingMode>('none');
  const toasts = ref<Toast[]>([]);
  const isLoading = ref(false);
  const selectedProjectIndex = ref<number | null>(null);
  const topBarOpen = ref(true);
  const quickToolsMenuPosition = ref<{ x: number; y: number } | null>(null);
  const sidebarOpen = ref(true);
  const sidebarElementRequest = ref<MapElementRequest | null>(null);
  const mapElementHighlightRequest = ref<MapElementRequest | null>(null);
  const sidebarHoverRequest = ref<MapElementRequest | null>(null);
  const leftSidebarOpen = ref(false);
  const elementVisibility = ref<Record<string, boolean>>({});
  const editingElement = ref<EditingElement | null>(null);
  const selectedSegmentForPointCreation = ref<string | null>(null);
  const creatingElement = ref<CreatingElement | null>(null);
  const circleCenterPreFill = ref<{ lat: number; lon: number } | null>(null);
  const navigatingElement = ref<NavigatingElement | null>(null);
  const intersectionLineEdit = ref<IntersectionLineEdit | null>(null);
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
  const tools = ref<ToolsState>({
    isToolbarOpen: false,
    activeTool: null,
  });
  const mapProvider = ref<
    'geoportail' | 'osm' | 'google-plan' | 'google-satellite' | 'google-relief' | 'image'
  >('geoportail');
  const pdfPanelOpen = ref(false);
  const pdfPanelWidth = ref(500); // Default width
  const pdfCurrentPage = ref(1); // Current page in PDF viewer
  const pdfZoomLevel = ref(1); // Zoom level in PDF viewer (1 = 100%)
  const pdfScrollPosition = ref<{ x: number; y: number }>({ x: 0, y: 0 }); // Scroll position in PDF viewer

  // Computed
  const isModalOpen = computed(() => (modalId: string) => openModals.value.has(modalId));

  const activeToastCount = computed(() => toasts.value.length);
  const toolInstructionsVisible = computed(
    () => gameMode.value || !!navigatingElement.value || freeHandDrawing.value.isDrawing
  );

  const canInteractWithLines = computed(
    () =>
      !gameMode.value &&
      !freeHandDrawing.value.isDrawing &&
      !tools.value.activeTool &&
      !navigatingElement.value &&
      openModals.value.size === 0 &&
      !bearingsPanel.value.isOpen &&
      !showTutorial.value
  );

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

  function startEditing(
    type: 'route' | 'circle' | 'lineSegment' | 'point' | 'note',
    id: string
  ): void {
    editingElement.value = { type, id };
  }

  function stopEditing(): void {
    editingElement.value = null;
  }

  function isEditing(
    type: 'route' | 'circle' | 'lineSegment' | 'point' | 'note',
    id: string
  ): boolean {
    return editingElement.value?.type === type && editingElement.value?.id === id;
  }

  function setSelectedSegmentForPointCreation(segmentId: string | null): void {
    selectedSegmentForPointCreation.value = segmentId;
  }

  function startCreating(
    type: 'route' | 'circle' | 'lineSegment' | 'point',
    prefill?: CreatingElement['prefill']
  ): void {
    creatingElement.value = { type, prefill };
  }

  function stopCreating(): void {
    creatingElement.value = null;
    circleCenterPreFill.value = null;
  }

  function setCircleCenter(lat: number, lon: number): void {
    circleCenterPreFill.value = { lat, lon };
  }

  function startNavigating(type: 'route' | 'circle' | 'lineSegment', id: string): void {
    navigatingElement.value = { type, id };
    sidebarOpen.value = false;
  }

  function stopNavigating(): void {
    navigatingElement.value = null;
  }

  function isNavigating(type: 'route' | 'circle' | 'lineSegment', id: string): boolean {
    return navigatingElement.value?.type === type && navigatingElement.value?.id === id;
  }

  function setShowTutorial(show: boolean): void {
    showTutorial.value = show;
  }

  function openSearchAlong(
    elementType: 'route' | 'lineSegment' | 'point',
    elementId: string
  ): void {
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
    name: string,
    keepSidebarOpen = false
  ): void {
    freeHandDrawing.value = {
      isDrawing: true,
      startCoord,
      azimuth,
      name,
    };
    if (!keepSidebarOpen) sidebarOpen.value = false;
  }

  function stopFreeHandDrawing(): void {
    freeHandDrawing.value = {
      isDrawing: false,
      startCoord: null,
      azimuth: undefined,
      name: '',
    };
  }

  function toggleToolbar(): void {
    tools.value.isToolbarOpen = !tools.value.isToolbarOpen;
  }

  function startTool(tool: ToolId): void {
    tools.value.activeTool = tool;
    tools.value.isToolbarOpen = false;
  }

  function stopTool(): void {
    tools.value.activeTool = null;
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

  function setNotePreFill(
    type: 'route' | 'circle' | 'lineSegment' | 'point' | 'polygon',
    id: string
  ): void {
    notePreFillElement.value = { type, id };
  }

  function clearNotePreFill(): void {
    notePreFillElement.value = null;
  }

  function setMapProvider(
    provider: 'geoportail' | 'osm' | 'google-plan' | 'google-satellite' | 'google-relief' | 'image'
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
    canInteractWithLines,
    toolInstructionsVisible,
    gameMode,
    mapBackgroundVisible,
    // State
    openModals,
    drawingMode,
    toasts,
    isLoading,
    selectedProjectIndex,
    topBarOpen,
    quickToolsMenuPosition,
    sidebarOpen,
    sidebarElementRequest,
    mapElementHighlightRequest,
    sidebarHoverRequest,
    leftSidebarOpen,
    elementVisibility,
    editingElement,
    selectedSegmentForPointCreation,
    creatingElement,
    circleCenterPreFill,
    navigatingElement,
    intersectionLineEdit,
    showTutorial,
    searchAlongPanel,
    freeHandDrawing,
    searchBarVisible,
    bearingsPanel,
    notePreFillElement,
    tools,
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
    toggleToolbar,
    startTool,
    stopTool,
    toggleSearchBar,
    setSearchBarVisible,
    openBearings,
    closeBearings,
    setNotePreFill,
    clearNotePreFill,
    setMapProvider,
    togglePdfPanel,
    setPdfPanelOpen,
    setPdfPanelWidth,
    setPdfCurrentPage,
    setPdfZoomLevel,
    setPdfScrollPosition,
  };
});
