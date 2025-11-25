import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import { useNoteTooltips } from '@/composables/useNoteTooltips';
import { useLayersStore } from '@/stores/layers';
import { useUIStore } from '@/stores/ui';

// Mock ol/extent
vi.mock('ol/extent', () => ({
  getCenter: vi.fn(() => [2.3522, 48.8566]),
}));

// Use vi.hoisted for the Overlay mock
const { MockOverlay, mockOverlayInstances } = vi.hoisted(() => {
  const instances: any[] = [];
  class MockOverlay {
    element: HTMLElement | null = null;
    constructor(options: any) {
      this.element = options?.element || null;
      // Simulate OpenLayers adding the element to DOM
      if (this.element) {
        document.body.append(this.element);
      }
      instances.push(this);
    }

    getElement() {
      return this.element;
    }

    setPosition() {}
  }
  return { MockOverlay, mockOverlayInstances: instances };
});

vi.mock('ol/Overlay', () => ({
  default: MockOverlay,
}));

describe('useNoteTooltips', () => {
  let pinia: any;
  let layersStore: any;
  let uiStore: any;
  let mockMapRef: any;
  let mockView: any;
  let mockFeature: any;
  let mockGeometry: any;
  let viewChangeHandler: (() => void) | null = null;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    layersStore = useLayersStore();
    uiStore = useUIStore();

    vi.useFakeTimers();

    // Reset view change handler
    viewChangeHandler = null;

    // Create mock geometry
    mockGeometry = {
      getExtent: vi.fn(() => [0, 0, 1, 1]),
    };

    // Create mock feature
    mockFeature = {
      getGeometry: vi.fn(() => mockGeometry),
    };

    // Create mock view that captures the resolution change handler
    mockView = {
      getZoom: vi.fn(() => 15), // Above MIN_ZOOM_FOR_NOTES (12)
      on: vi.fn((event: string, handler: () => void) => {
        if (event === 'change:resolution') {
          viewChangeHandler = handler;
        }
      }),
    };

    // Create mock sources
    const createMockSource = () => ({
      getFeatureById: vi.fn(() => mockFeature),
    });

    // Create mock map
    mockMapRef = {
      map: ref({
        getView: vi.fn(() => mockView),
        addOverlay: vi.fn(),
        removeOverlay: vi.fn(),
      }),
      circlesSource: ref(createMockSource()),
      linesSource: ref(createMockSource()),
      pointsSource: ref(createMockSource()),
      polygonsSource: ref(createMockSource()),
    };
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
    // Clean up any created elements
    for (const el of document.querySelectorAll('.note-tooltip')) el.remove();
    // Clear overlay instances
    mockOverlayInstances.length = 0;
  });

  describe('Initialization', () => {
    it('should return tooltip management functions', () => {
      const tooltips = useNoteTooltips(mockMapRef);

      expect(tooltips.updateNoteTooltips).toBeInstanceOf(Function);
      expect(tooltips.refreshNoteTooltip).toBeInstanceOf(Function);
      expect(tooltips.clearAllTooltips).toBeInstanceOf(Function);
      expect(tooltips.bindNoteTooltip).toBeInstanceOf(Function);
      expect(tooltips.unbindNoteTooltip).toBeInstanceOf(Function);
    });

    it('should register resolution change listener', () => {
      useNoteTooltips(mockMapRef);

      expect(mockView.on).toHaveBeenCalledWith('change:resolution', expect.any(Function));
    });

    it('should call updateNoteTooltips on initialization', () => {
      // Add a linked note
      layersStore.addNote({
        id: 'note-1',
        title: 'Test Note',
        content: 'Content',
        linkedElementType: 'circle',
        linkedElementId: 'circle-1',
      });

      useNoteTooltips(mockMapRef);

      // Initial update should have been called
      expect(mockMapRef.map.value.addOverlay).toHaveBeenCalled();
    });

    it('should handle missing map gracefully', () => {
      mockMapRef.map.value = null;

      expect(() => useNoteTooltips(mockMapRef)).not.toThrow();
    });
  });

  describe('bindNoteTooltip', () => {
    it('should create overlay for linked note', () => {
      const tooltips = useNoteTooltips(mockMapRef);

      const note = {
        id: 'note-1',
        title: 'Test Note',
        content: 'Test content',
        linkedElementType: 'circle' as const,
        linkedElementId: 'circle-1',
      };

      tooltips.bindNoteTooltip(note);

      expect(mockMapRef.map.value.addOverlay).toHaveBeenCalled();
    });

    it('should not create duplicate overlay for same note', () => {
      const tooltips = useNoteTooltips(mockMapRef);

      const note = {
        id: 'note-1',
        title: 'Test Note',
        linkedElementType: 'circle' as const,
        linkedElementId: 'circle-1',
      };

      tooltips.bindNoteTooltip(note);
      tooltips.bindNoteTooltip(note);

      // Should only be called once (plus initial update)
      const addOverlayCalls = mockMapRef.map.value.addOverlay.mock.calls.length;
      expect(addOverlayCalls).toBe(1);
    });

    it('should not create overlay if map is not available', () => {
      const tooltips = useNoteTooltips(mockMapRef);
      mockMapRef.map.value = null;

      const note = {
        id: 'note-1',
        title: 'Test Note',
        linkedElementType: 'circle' as const,
        linkedElementId: 'circle-1',
      };

      tooltips.bindNoteTooltip(note);

      // No additional overlays should be added after map becomes null
    });

    it('should not create overlay if note has no id', () => {
      const tooltips = useNoteTooltips(mockMapRef);

      const note = {
        title: 'Test Note',
        linkedElementType: 'circle' as const,
        linkedElementId: 'circle-1',
      };

      tooltips.bindNoteTooltip(note as any);
    });

    it('should not create overlay if feature is not found', () => {
      mockMapRef.circlesSource.value.getFeatureById = vi.fn(() => null);
      const tooltips = useNoteTooltips(mockMapRef);

      const note = {
        id: 'note-1',
        title: 'Test Note',
        linkedElementType: 'circle' as const,
        linkedElementId: 'non-existent',
      };

      tooltips.bindNoteTooltip(note);
    });

    it('should not create overlay if geometry is missing', () => {
      mockFeature.getGeometry = vi.fn(() => null);
      const tooltips = useNoteTooltips(mockMapRef);

      const note = {
        id: 'note-1',
        title: 'Test Note',
        linkedElementType: 'circle' as const,
        linkedElementId: 'circle-1',
      };

      tooltips.bindNoteTooltip(note);
    });

    it('should escape HTML in note title and content', () => {
      const tooltips = useNoteTooltips(mockMapRef);

      const note = {
        id: 'note-1',
        title: '<script>alert("xss")</script>',
        content: '<img onerror="alert(1)">',
        linkedElementType: 'circle' as const,
        linkedElementId: 'circle-1',
      };

      tooltips.bindNoteTooltip(note);

      // The overlay should be created with escaped HTML
      expect(mockMapRef.map.value.addOverlay).toHaveBeenCalled();
    });

    it('should handle note without content', () => {
      const tooltips = useNoteTooltips(mockMapRef);

      const note = {
        id: 'note-1',
        title: 'Title Only',
        linkedElementType: 'circle' as const,
        linkedElementId: 'circle-1',
      };

      tooltips.bindNoteTooltip(note);

      expect(mockMapRef.map.value.addOverlay).toHaveBeenCalled();
    });
  });

  describe('unbindNoteTooltip', () => {
    it('should remove overlay for note', () => {
      const tooltips = useNoteTooltips(mockMapRef);

      const note = {
        id: 'note-1',
        title: 'Test Note',
        linkedElementType: 'circle' as const,
        linkedElementId: 'circle-1',
      };

      tooltips.bindNoteTooltip(note);
      tooltips.unbindNoteTooltip('note-1');

      expect(mockMapRef.map.value.removeOverlay).toHaveBeenCalled();
    });

    it('should handle unbinding non-existent note', () => {
      const tooltips = useNoteTooltips(mockMapRef);

      expect(() => tooltips.unbindNoteTooltip('non-existent')).not.toThrow();
    });

    it('should handle unbinding when map is unavailable', () => {
      const tooltips = useNoteTooltips(mockMapRef);

      const note = {
        id: 'note-1',
        title: 'Test Note',
        linkedElementType: 'circle' as const,
        linkedElementId: 'circle-1',
      };

      tooltips.bindNoteTooltip(note);
      mockMapRef.map.value = null;

      expect(() => tooltips.unbindNoteTooltip('note-1')).not.toThrow();
    });

    it('should handle overlay with null element', () => {
      const tooltips = useNoteTooltips(mockMapRef);

      const note = {
        id: 'note-1',
        title: 'Test Note',
        linkedElementType: 'circle' as const,
        linkedElementId: 'circle-1',
      };

      tooltips.bindNoteTooltip(note);

      // Get the overlay and set its element to null
      const overlay = mockOverlayInstances.at(-1);
      overlay.element = null;

      expect(() => tooltips.unbindNoteTooltip('note-1')).not.toThrow();
    });
  });

  describe('updateNoteTooltips', () => {
    it('should show tooltips when zoom >= 12', () => {
      mockView.getZoom = vi.fn(() => 15);

      layersStore.addNote({
        id: 'note-1',
        title: 'Test Note',
        linkedElementType: 'circle',
        linkedElementId: 'circle-1',
      });

      const tooltips = useNoteTooltips(mockMapRef);
      tooltips.updateNoteTooltips();

      expect(mockMapRef.map.value.addOverlay).toHaveBeenCalled();
    });

    it('should hide tooltips when zoom < 12', () => {
      mockView.getZoom = vi.fn(() => 10);

      layersStore.addNote({
        id: 'note-1',
        title: 'Test Note',
        linkedElementType: 'circle',
        linkedElementId: 'circle-1',
      });

      const _tooltips = useNoteTooltips(mockMapRef);

      // Initially at zoom 10, no overlays should be added
      expect(mockMapRef.map.value.addOverlay).not.toHaveBeenCalled();
    });

    it('should remove tooltips when zooming out', () => {
      // Start at high zoom
      mockView.getZoom = vi.fn(() => 15);

      layersStore.addNote({
        id: 'note-1',
        title: 'Test Note',
        linkedElementType: 'circle',
        linkedElementId: 'circle-1',
      });

      const tooltips = useNoteTooltips(mockMapRef);
      tooltips.updateNoteTooltips();

      // Zoom out
      mockView.getZoom = vi.fn(() => 10);
      tooltips.updateNoteTooltips();

      expect(mockMapRef.map.value.removeOverlay).toHaveBeenCalled();
    });

    it('should handle undefined zoom', () => {
      mockView.getZoom = vi.fn(() => undefined);

      const tooltips = useNoteTooltips(mockMapRef);

      expect(() => tooltips.updateNoteTooltips()).not.toThrow();
    });

    it('should handle missing map', () => {
      const tooltips = useNoteTooltips(mockMapRef);
      mockMapRef.map.value = null;

      expect(() => tooltips.updateNoteTooltips()).not.toThrow();
    });

    it('should remove tooltips for deleted notes', () => {
      mockView.getZoom = vi.fn(() => 15);

      layersStore.addNote({
        id: 'note-1',
        title: 'Test Note',
        linkedElementType: 'circle',
        linkedElementId: 'circle-1',
      });

      const tooltips = useNoteTooltips(mockMapRef);
      tooltips.updateNoteTooltips();

      // Remove the note
      layersStore.deleteNote('note-1');
      tooltips.updateNoteTooltips();

      expect(mockMapRef.map.value.removeOverlay).toHaveBeenCalled();
    });

    it('should only process linked notes', () => {
      mockView.getZoom = vi.fn(() => 15);

      // Add unlinked note
      layersStore.addNote({
        id: 'note-1',
        title: 'Unlinked Note',
      });

      const tooltips = useNoteTooltips(mockMapRef);
      tooltips.updateNoteTooltips();

      // No overlays should be added for unlinked notes
      expect(mockMapRef.map.value.addOverlay).not.toHaveBeenCalled();
    });
  });

  describe('refreshNoteTooltip', () => {
    it('should refresh existing note tooltip', () => {
      mockView.getZoom = vi.fn(() => 15);

      layersStore.addNote({
        id: 'note-1',
        title: 'Original Title',
        linkedElementType: 'circle',
        linkedElementId: 'circle-1',
      });

      const tooltips = useNoteTooltips(mockMapRef);

      // Update note title
      const note = layersStore.notes.find((n: any) => n.id === 'note-1');
      note.title = 'Updated Title';

      tooltips.refreshNoteTooltip('note-1');

      // Should have removed and re-added overlay
      expect(mockMapRef.map.value.removeOverlay).toHaveBeenCalled();
      expect(mockMapRef.map.value.addOverlay).toHaveBeenCalled();
    });

    it('should remove tooltip for deleted note', () => {
      mockView.getZoom = vi.fn(() => 15);

      layersStore.addNote({
        id: 'note-1',
        title: 'Test Note',
        linkedElementType: 'circle',
        linkedElementId: 'circle-1',
      });

      const tooltips = useNoteTooltips(mockMapRef);
      tooltips.updateNoteTooltips();

      // Remove note from store
      layersStore.deleteNote('note-1');

      tooltips.refreshNoteTooltip('note-1');

      expect(mockMapRef.map.value.removeOverlay).toHaveBeenCalled();
    });

    it('should not rebind tooltip when zoom < 12', () => {
      mockView.getZoom = vi.fn(() => 15);

      layersStore.addNote({
        id: 'note-1',
        title: 'Test Note',
        linkedElementType: 'circle',
        linkedElementId: 'circle-1',
      });

      const tooltips = useNoteTooltips(mockMapRef);
      tooltips.updateNoteTooltips();

      // Zoom out
      mockView.getZoom = vi.fn(() => 10);

      // Clear mock counts
      mockMapRef.map.value.addOverlay.mockClear();

      tooltips.refreshNoteTooltip('note-1');

      // Should not add new overlay when zoomed out
      expect(mockMapRef.map.value.addOverlay).not.toHaveBeenCalled();
    });

    it('should handle refresh when map unavailable', () => {
      mockView.getZoom = vi.fn(() => 15);

      layersStore.addNote({
        id: 'note-1',
        title: 'Test Note',
        linkedElementType: 'circle',
        linkedElementId: 'circle-1',
      });

      const tooltips = useNoteTooltips(mockMapRef);
      mockMapRef.map.value = null;

      expect(() => tooltips.refreshNoteTooltip('note-1')).not.toThrow();
    });

    it('should handle refresh when zoom is undefined', () => {
      layersStore.addNote({
        id: 'note-1',
        title: 'Test Note',
        linkedElementType: 'circle',
        linkedElementId: 'circle-1',
      });

      const tooltips = useNoteTooltips(mockMapRef);
      mockView.getZoom = vi.fn(() => undefined);

      expect(() => tooltips.refreshNoteTooltip('note-1')).not.toThrow();
    });
  });

  describe('clearAllTooltips', () => {
    it('should remove all tooltips', () => {
      mockView.getZoom = vi.fn(() => 15);

      layersStore.addNote({
        id: 'note-1',
        title: 'Note 1',
        linkedElementType: 'circle',
        linkedElementId: 'circle-1',
      });
      layersStore.addNote({
        id: 'note-2',
        title: 'Note 2',
        linkedElementType: 'point',
        linkedElementId: 'point-1',
      });

      const tooltips = useNoteTooltips(mockMapRef);
      tooltips.updateNoteTooltips();

      tooltips.clearAllTooltips();

      expect(mockMapRef.map.value.removeOverlay).toHaveBeenCalledTimes(2);
    });

    it('should handle clearing when no tooltips exist', () => {
      const tooltips = useNoteTooltips(mockMapRef);

      expect(() => tooltips.clearAllTooltips()).not.toThrow();
    });
  });

  describe('getElementFeature', () => {
    it('should get feature from circlesSource', () => {
      const tooltips = useNoteTooltips(mockMapRef);

      const note = {
        id: 'note-1',
        title: 'Test',
        linkedElementType: 'circle' as const,
        linkedElementId: 'circle-1',
      };

      tooltips.bindNoteTooltip(note);

      expect(mockMapRef.circlesSource.value.getFeatureById).toHaveBeenCalledWith('circle-1');
    });

    it('should get feature from linesSource', () => {
      const tooltips = useNoteTooltips(mockMapRef);

      const note = {
        id: 'note-1',
        title: 'Test',
        linkedElementType: 'lineSegment' as const,
        linkedElementId: 'line-1',
      };

      tooltips.bindNoteTooltip(note);

      expect(mockMapRef.linesSource.value.getFeatureById).toHaveBeenCalledWith('line-1');
    });

    it('should get feature from pointsSource', () => {
      const tooltips = useNoteTooltips(mockMapRef);

      const note = {
        id: 'note-1',
        title: 'Test',
        linkedElementType: 'point' as const,
        linkedElementId: 'point-1',
      };

      tooltips.bindNoteTooltip(note);

      expect(mockMapRef.pointsSource.value.getFeatureById).toHaveBeenCalledWith('point-1');
    });

    it('should get feature from polygonsSource', () => {
      const tooltips = useNoteTooltips(mockMapRef);

      const note = {
        id: 'note-1',
        title: 'Test',
        linkedElementType: 'polygon' as const,
        linkedElementId: 'polygon-1',
      };

      tooltips.bindNoteTooltip(note);

      expect(mockMapRef.polygonsSource.value.getFeatureById).toHaveBeenCalledWith('polygon-1');
    });

    it('should return null for unknown element type', () => {
      const tooltips = useNoteTooltips(mockMapRef);

      const note = {
        id: 'note-1',
        title: 'Test',
        linkedElementType: 'unknown' as any,
        linkedElementId: 'unknown-1',
      };

      tooltips.bindNoteTooltip(note);

      // Should not throw, just not create overlay
    });

    it('should return null for note without linked element', () => {
      const tooltips = useNoteTooltips(mockMapRef);

      const note = {
        id: 'note-1',
        title: 'Test',
      };

      tooltips.bindNoteTooltip(note as any);

      // Should not create overlay for unlinked note
    });

    it('should handle missing source', () => {
      mockMapRef.circlesSource.value = null;
      const tooltips = useNoteTooltips(mockMapRef);

      const note = {
        id: 'note-1',
        title: 'Test',
        linkedElementType: 'circle' as const,
        linkedElementId: 'circle-1',
      };

      tooltips.bindNoteTooltip(note);

      // Should not throw
    });
  });

  describe('handleNoteClick', () => {
    it('should open modal when note tooltip is clicked', () => {
      const startEditingSpy = vi.spyOn(uiStore, 'startEditing');
      const openModalSpy = vi.spyOn(uiStore, 'openModal');

      const tooltips = useNoteTooltips(mockMapRef);

      const note = {
        id: 'note-1',
        title: 'Clickable Note',
        linkedElementType: 'circle' as const,
        linkedElementId: 'circle-1',
      };

      tooltips.bindNoteTooltip(note);

      // Find the created tooltip card and click it
      const card = document.querySelector('.note-tooltip-card');
      expect(card).not.toBeNull();

      card?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(startEditingSpy).toHaveBeenCalledWith('note', 'note-1');
      expect(openModalSpy).toHaveBeenCalledWith('noteModal');
    });
  });

  describe('Debounce behavior', () => {
    it('should debounce resolution change updates', () => {
      layersStore.addNote({
        id: 'note-1',
        title: 'Test Note',
        linkedElementType: 'circle',
        linkedElementId: 'circle-1',
      });

      useNoteTooltips(mockMapRef);

      // Trigger multiple resolution changes
      viewChangeHandler?.();
      viewChangeHandler?.();
      viewChangeHandler?.();

      // Before debounce timeout
      expect(mockMapRef.map.value.addOverlay.mock.calls.length).toBe(1); // Only initial

      // After debounce timeout (150ms)
      vi.advanceTimersByTime(150);

      // Debounced update should have been called
    });
  });

  describe('Watch notes', () => {
    it('should update tooltips when notes change', async () => {
      mockView.getZoom = vi.fn(() => 15);

      useNoteTooltips(mockMapRef);

      // Clear any initial calls
      mockMapRef.map.value.addOverlay.mockClear();

      // Add a note after initialization
      layersStore.addNote({
        id: 'note-new',
        title: 'New Note',
        linkedElementType: 'circle',
        linkedElementId: 'circle-1',
      });

      // Wait for Vue reactivity to process
      await nextTick();

      // Advance timers for debounce
      vi.advanceTimersByTime(150);

      // Tooltip should be created for new note
      expect(mockMapRef.map.value.addOverlay).toHaveBeenCalled();
    });
  });
});
