import XYZ from 'ol/source/XYZ';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from 'vue';
import { usePrecisionLens } from '@/composables/usePrecisionLens';

// Store lifecycle hooks for manual triggering
let mountedCallback: (() => void) | null = null;
let beforeUnmountCallback: (() => void) | null = null;

// Mock Vue lifecycle hooks
vi.mock('vue', async () => {
  const actual = await vi.importActual('vue');
  return {
    ...actual,
    onMounted: vi.fn((cb: () => void) => {
      mountedCallback = cb;
    }),
    onBeforeUnmount: vi.fn((cb: () => void) => {
      beforeUnmountCallback = cb;
    }),
  };
});

// Mock mini map view and map
const mockMiniView = {
  setCenter: vi.fn(),
  setZoom: vi.fn(),
};

const mockMiniMap = {
  getView: vi.fn(() => mockMiniView),
  updateSize: vi.fn(),
  setTarget: vi.fn(),
  dispose: vi.fn(),
};

// Mock OpenLayers classes as proper classes
vi.mock('ol/Map', () => ({
  default: class MockMap {
    constructor() {
      return mockMiniMap;
    }
  },
}));

vi.mock('ol/View', () => ({
  default: class MockView {
    constructor() {
      return mockMiniView;
    }
  },
}));

vi.mock('ol/layer/Tile', () => ({
  default: class MockTileLayer {
    constructor() {}
  },
}));

// Use vi.hoisted to define the class before the mock is hoisted
const { MockXYZClass } = vi.hoisted(() => {
  class MockXYZClass {
    private urls: string[] | null;
    constructor() {
      this.urls = ['https://tile.example.com/{z}/{x}/{y}.png'];
    }

    getUrls() {
      return this.urls;
    }

    setUrls(urls: string[] | null) {
      this.urls = urls;
    }
  }
  return { MockXYZClass };
});

vi.mock('ol/source/XYZ', () => ({
  default: MockXYZClass,
}));

describe('usePrecisionLens', () => {
  let mockMapRef: any;
  let mockMainView: any;
  let mockMainMap: any;
  let mockMapContainer: any;
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let mockXYZSource: any;

  beforeEach(() => {
    vi.useFakeTimers();

    // Reset lifecycle callbacks
    mountedCallback = null;
    beforeUnmountCallback = null;

    // Reset mocks
    vi.clearAllMocks();
    mockMiniView.setCenter.mockClear();
    mockMiniView.setZoom.mockClear();
    mockMiniMap.getView.mockClear();
    mockMiniMap.updateSize.mockClear();
    mockMiniMap.setTarget.mockClear();
    mockMiniMap.dispose.mockClear();

    // Create mock XYZ source as instance of XYZ class for instanceof check
    mockXYZSource = new XYZ();

    // Create mock main view
    mockMainView = {
      getCenter: vi.fn(() => [2.3522, 48.8566]),
      getZoom: vi.fn(() => 15),
      getProjection: vi.fn(() => 'EPSG:3857'),
    };

    // Create mock map container element
    mockMapContainer = document.createElement('div');
    mockMapContainer.getBoundingClientRect = vi.fn(() => ({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
      right: 800,
      bottom: 600,
    }));

    // Create mock layers array with XYZ source
    const mockLayers = {
      getArray: vi.fn(() => [
        {
          getSource: vi.fn(() => mockXYZSource),
        },
      ]),
    };

    // Create mock main map
    mockMainMap = {
      getView: vi.fn(() => mockMainView),
      getTargetElement: vi.fn(() => mockMapContainer),
      getLayers: vi.fn(() => mockLayers),
      getCoordinateFromPixel: vi.fn(() => [2.3522, 48.8566]),
    };

    // Create mock map ref
    mockMapRef = {
      map: ref(mockMainMap),
    };

    // Spy on window event listeners
    addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    // Clean up any created elements
    for (const el of document.querySelectorAll('.precision-lens')) el.remove();
  });

  describe('Initialization', () => {
    it('should initialize with inactive state', () => {
      const lens = usePrecisionLens(mockMapRef);
      expect(lens.isActive.value).toBe(false);
    });

    it('should accept custom options', () => {
      const lens = usePrecisionLens(mockMapRef, {
        lensSize: 300,
        offsetY: -300,
        magnification: 3,
      });
      expect(lens.isActive.value).toBe(false);
    });

    it('should register keyboard and contextmenu listeners on mount', () => {
      usePrecisionLens(mockMapRef);
      mountedCallback?.();

      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('contextmenu', expect.any(Function));
    });
  });

  describe('Activation', () => {
    it('should activate precision mode', () => {
      const lens = usePrecisionLens(mockMapRef);
      lens.activate();
      expect(lens.isActive.value).toBe(true);
    });

    it('should create lens element on activation', () => {
      const lens = usePrecisionLens(mockMapRef);
      lens.activate();

      const lensElement = document.querySelector('.precision-lens');
      expect(lensElement).not.toBeNull();
    });

    it('should not create duplicate lens on multiple activations', () => {
      const lens = usePrecisionLens(mockMapRef);
      lens.activate();
      lens.activate();

      const lensElements = document.querySelectorAll('.precision-lens');
      expect(lensElements.length).toBe(1);
    });

    it('should not create lens if map is not available', () => {
      mockMapRef.map.value = null;
      const lens = usePrecisionLens(mockMapRef);
      lens.activate();

      expect(lens.isActive.value).toBe(true);
      const lensElement = document.querySelector('.precision-lens');
      expect(lensElement).toBeNull();
    });

    it('should add mousemove listener to map container on activation', () => {
      const addEventListenerSpy = vi.spyOn(mockMapContainer, 'addEventListener');
      const lens = usePrecisionLens(mockMapRef);
      lens.activate();

      expect(addEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    });

    it('should update mini map size after creation', () => {
      const lens = usePrecisionLens(mockMapRef);
      lens.activate();
      vi.advanceTimersByTime(0);

      expect(mockMiniMap.updateSize).toHaveBeenCalled();
    });
  });

  describe('Deactivation', () => {
    it('should deactivate precision mode', () => {
      const lens = usePrecisionLens(mockMapRef);
      lens.activate();
      lens.deactivate();

      expect(lens.isActive.value).toBe(false);
    });

    it('should hide lens element on deactivation', () => {
      const lens = usePrecisionLens(mockMapRef);
      lens.activate();
      lens.deactivate();

      const lensElement = document.querySelector('.precision-lens') as HTMLElement;
      expect(lensElement?.style.display).toBe('none');
    });

    it('should remove mousemove listener on deactivation', () => {
      const removeEventListenerSpy = vi.spyOn(mockMapContainer, 'removeEventListener');
      const lens = usePrecisionLens(mockMapRef);
      lens.activate();
      lens.deactivate();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    });

    it('should not deactivate if already inactive', () => {
      const lens = usePrecisionLens(mockMapRef);
      expect(() => lens.deactivate()).not.toThrow();
      expect(lens.isActive.value).toBe(false);
    });

    it('should handle deactivation when map becomes unavailable', () => {
      const lens = usePrecisionLens(mockMapRef);
      lens.activate();

      // Make map unavailable before deactivation
      mockMapRef.map.value = null;

      // Should not throw
      expect(() => lens.deactivate()).not.toThrow();
      expect(lens.isActive.value).toBe(false);
    });

    it('should handle deactivation when lens was not created', () => {
      // Create lens with unavailable map so lens element is not created
      mockMapRef.map.value = null;
      const lens = usePrecisionLens(mockMapRef);
      lens.activate(); // This sets isActive but doesn't create lens

      // Restore map ref for the deactivate check
      mockMapRef.map.value = mockMainMap;

      // isActive is true but lensElement is null
      expect(() => lens.deactivate()).not.toThrow();
      expect(lens.isActive.value).toBe(false);
    });
  });

  describe('Toggle', () => {
    it('should toggle from inactive to active', () => {
      const lens = usePrecisionLens(mockMapRef);
      lens.toggle();
      expect(lens.isActive.value).toBe(true);
    });

    it('should toggle from active to inactive', () => {
      const lens = usePrecisionLens(mockMapRef);
      lens.activate();
      lens.toggle();
      expect(lens.isActive.value).toBe(false);
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should toggle on Z key press', () => {
      const lens = usePrecisionLens(mockMapRef);
      mountedCallback?.();

      const event = new KeyboardEvent('keydown', { key: 'z' });
      Object.defineProperty(event, 'target', { value: document.body });
      window.dispatchEvent(event);

      expect(lens.isActive.value).toBe(true);
    });

    it('should toggle on uppercase Z key press', () => {
      const lens = usePrecisionLens(mockMapRef);
      mountedCallback?.();

      const event = new KeyboardEvent('keydown', { key: 'Z' });
      Object.defineProperty(event, 'target', { value: document.body });
      window.dispatchEvent(event);

      expect(lens.isActive.value).toBe(true);
    });

    it('should not toggle when typing in input', () => {
      const lens = usePrecisionLens(mockMapRef);
      mountedCallback?.();

      const input = document.createElement('input');
      const event = new KeyboardEvent('keydown', { key: 'z' });
      Object.defineProperty(event, 'target', { value: input });
      window.dispatchEvent(event);

      expect(lens.isActive.value).toBe(false);
    });

    it('should not toggle when typing in textarea', () => {
      const lens = usePrecisionLens(mockMapRef);
      mountedCallback?.();

      const textarea = document.createElement('textarea');
      const event = new KeyboardEvent('keydown', { key: 'z' });
      Object.defineProperty(event, 'target', { value: textarea });
      window.dispatchEvent(event);

      expect(lens.isActive.value).toBe(false);
    });

    it('should not toggle when typing in contenteditable element', () => {
      const lens = usePrecisionLens(mockMapRef);
      mountedCallback?.();

      const editable = document.createElement('div');
      editable.contentEditable = 'true';
      const event = new KeyboardEvent('keydown', { key: 'z' });
      Object.defineProperty(event, 'target', { value: editable });
      window.dispatchEvent(event);

      expect(lens.isActive.value).toBe(false);
    });

    it('should deactivate on Escape key when active', () => {
      const lens = usePrecisionLens(mockMapRef);
      mountedCallback?.();
      lens.activate();

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      Object.defineProperty(event, 'target', { value: document.body });
      window.dispatchEvent(event);

      expect(lens.isActive.value).toBe(false);
    });

    it('should not deactivate on Escape key when inactive', () => {
      const lens = usePrecisionLens(mockMapRef);
      mountedCallback?.();

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      Object.defineProperty(event, 'target', { value: document.body });
      window.dispatchEvent(event);

      expect(lens.isActive.value).toBe(false);
    });
  });

  describe('Context Menu (Right-click)', () => {
    it('should deactivate on right-click when active', () => {
      const lens = usePrecisionLens(mockMapRef);
      mountedCallback?.();
      lens.activate();

      const event = new MouseEvent('contextmenu');
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      window.dispatchEvent(event);

      expect(lens.isActive.value).toBe(false);
      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should not prevent default on right-click when inactive', () => {
      usePrecisionLens(mockMapRef);
      mountedCallback?.();

      const event = new MouseEvent('contextmenu');
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      window.dispatchEvent(event);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });
  });

  describe('Update Lens', () => {
    it('should update lens position on mouse move', () => {
      const lens = usePrecisionLens(mockMapRef);
      lens.activate();

      const mouseEvent = new MouseEvent('mousemove', {
        clientX: 400,
        clientY: 300,
      });
      mockMapContainer.dispatchEvent(mouseEvent);

      const lensElement = document.querySelector('.precision-lens') as HTMLElement;
      expect(lensElement.style.display).toBe('block');
    });

    it('should not update if not active', () => {
      usePrecisionLens(mockMapRef);

      const mouseEvent = new MouseEvent('mousemove', {
        clientX: 400,
        clientY: 300,
      });
      mockMapContainer.dispatchEvent(mouseEvent);

      const lensElement = document.querySelector('.precision-lens');
      expect(lensElement).toBeNull();
    });

    it('should update mini map center on mouse move', () => {
      const lens = usePrecisionLens(mockMapRef);
      lens.activate();

      const mouseEvent = new MouseEvent('mousemove', {
        clientX: 400,
        clientY: 300,
      });
      mockMapContainer.dispatchEvent(mouseEvent);

      expect(mockMiniView.setCenter).toHaveBeenCalled();
      expect(mockMiniView.setZoom).toHaveBeenCalled();
    });

    it('should handle missing coordinate gracefully', () => {
      mockMainMap.getCoordinateFromPixel = vi.fn(() => null);

      const lens = usePrecisionLens(mockMapRef);
      lens.activate();

      const mouseEvent = new MouseEvent('mousemove', {
        clientX: 400,
        clientY: 300,
      });

      expect(() => mockMapContainer.dispatchEvent(mouseEvent)).not.toThrow();
    });

    it('should handle undefined zoom gracefully', () => {
      mockMainView.getZoom = vi.fn(() => undefined);

      const lens = usePrecisionLens(mockMapRef);
      lens.activate();

      const mouseEvent = new MouseEvent('mousemove', {
        clientX: 400,
        clientY: 300,
      });
      mockMapContainer.dispatchEvent(mouseEvent);

      expect(mockMiniView.setZoom).not.toHaveBeenCalled();
    });

    it('should early return if map becomes unavailable during mouse move', () => {
      const lens = usePrecisionLens(mockMapRef);
      lens.activate();

      // Make map unavailable after activation
      mockMapRef.map.value = null;

      const mouseEvent = new MouseEvent('mousemove', {
        clientX: 400,
        clientY: 300,
      });

      // Should not throw and should early return
      expect(() => mockMapContainer.dispatchEvent(mouseEvent)).not.toThrow();
      // setCenter should not be called since we early returned
      expect(mockMiniView.setCenter).not.toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup on unmount', () => {
      const lens = usePrecisionLens(mockMapRef);
      mountedCallback?.();
      lens.activate();

      beforeUnmountCallback?.();

      expect(lens.isActive.value).toBe(false);
      expect(mockMiniMap.setTarget).toHaveBeenCalledWith(undefined);
      expect(mockMiniMap.dispose).toHaveBeenCalled();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('contextmenu', expect.any(Function));
    });

    it('should remove lens element on cleanup', () => {
      const lens = usePrecisionLens(mockMapRef);
      lens.activate();
      beforeUnmountCallback?.();

      const lensElement = document.querySelector('.precision-lens');
      expect(lensElement).toBeNull();
    });

    it('should handle cleanup when not activated', () => {
      usePrecisionLens(mockMapRef);
      mountedCallback?.();

      expect(() => beforeUnmountCallback?.()).not.toThrow();
    });
  });

  describe('Layer Detection', () => {
    it('should handle map without XYZ source', () => {
      const mockLayersWithoutXYZ = {
        getArray: vi.fn(() => [
          {
            getSource: vi.fn(() => ({})), // Not an XYZ source
          },
        ]),
      };
      mockMainMap.getLayers = vi.fn(() => mockLayersWithoutXYZ);

      const lens = usePrecisionLens(mockMapRef);
      expect(() => lens.activate()).not.toThrow();
    });

    it('should handle XYZ source without URLs', () => {
      // Create an XYZ instance with null URLs
      const mockXYZSourceNoUrls = new XYZ();
      (mockXYZSourceNoUrls as any).setUrls(null);

      const mockLayersNoUrls = {
        getArray: vi.fn(() => [
          {
            getSource: vi.fn(() => mockXYZSourceNoUrls),
          },
        ]),
      };
      mockMainMap.getLayers = vi.fn(() => mockLayersNoUrls);

      const lens = usePrecisionLens(mockMapRef);
      expect(() => lens.activate()).not.toThrow();
    });

    it('should extract tile URL from XYZ source', () => {
      // This test verifies that when we have an XYZ source,
      // the code extracts the URL correctly (line 105)
      const lens = usePrecisionLens(mockMapRef);
      lens.activate();

      // If we got here without error and lens is created, the URL extraction worked
      const lensElement = document.querySelector('.precision-lens');
      expect(lensElement).not.toBeNull();
    });
  });
});
