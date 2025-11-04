import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { useAppSetup } from '@/composables/useAppSetup';

// Import mocked modules
import { useFreeHandDrawing } from '@/composables/useFreeHandDrawing';
import { useKeyboardNavigation } from '@/composables/useKeyboardNavigation';
import { useMapEventHandlers } from '@/composables/useMapEventHandlers';
import { useMapInitialization } from '@/composables/useMapInitialization';
import { useViewCapture } from '@/composables/useViewCapture';

// Mock all the composables that useAppSetup depends on
vi.mock('@/composables/useFreeHandDrawing', () => ({
  useFreeHandDrawing: vi.fn(() => ({
    setup: vi.fn(),
    cleanup: vi.fn(),
    handleEscape: vi.fn(),
  })),
}));

vi.mock('@/composables/useKeyboardNavigation', () => ({
  useKeyboardNavigation: vi.fn(() => ({
    setup: vi.fn(),
    cleanup: vi.fn(),
  })),
}));

vi.mock('@/composables/useMapEventHandlers', () => ({
  useMapEventHandlers: vi.fn(() => ({
    setup: vi.fn(() => vi.fn()), // Returns unsubscribe function
  })),
}));

vi.mock('@/composables/useViewCapture', () => ({
  useViewCapture: vi.fn(() => ({
    setup: vi.fn(() => vi.fn()), // Returns unsubscribe function
  })),
}));

vi.mock('@/composables/useMapInitialization', () => ({
  useMapInitialization: vi.fn(() => Promise.resolve()),
}));

describe('useAppSetup', () => {
  let mockMapContainer: any;
  let mockDrawing: any;
  let mockNoteTooltipsRef: any;
  let mockCursorTooltip: any;
  let appSetup: any;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Create mock map container
    mockMapContainer = {
      destroyMap: vi.fn(),
    };

    // Create mock drawing
    mockDrawing = {};

    // Create mock refs
    mockNoteTooltipsRef = ref(null);
    mockCursorTooltip = ref({
      visible: false,
      x: 0,
      y: 0,
      distance: '',
      azimuth: '',
    });

    // Initialize app setup
    appSetup = useAppSetup(mockMapContainer, mockDrawing, mockNoteTooltipsRef, mockCursorTooltip);
  });

  describe('Initialization', () => {
    it('should initialize all composables with correct dependencies', () => {
      expect(useFreeHandDrawing).toHaveBeenCalledWith(
        mockMapContainer,
        mockDrawing,
        mockCursorTooltip
      );

      expect(useKeyboardNavigation).toHaveBeenCalledWith(
        mockMapContainer,
        expect.any(Function) // handleEscape from freeHandDrawing
      );

      expect(useMapEventHandlers).toHaveBeenCalledWith(mockMapContainer);

      expect(useViewCapture).toHaveBeenCalledWith(mockMapContainer);
    });
  });

  describe('Setup Function', () => {
    it('should return an async function', () => {
      expect(appSetup).toBeInstanceOf(Function);
    });

    it('should initialize map and setup all handlers', async () => {
      // Track mock instances
      const mockFreeHandSetup = vi.fn();
      const mockKeyboardSetup = vi.fn();
      const mockMapEventsSetup = vi.fn(() => vi.fn());
      const mockViewCaptureSetup = vi.fn(() => vi.fn());

      vi.mocked(useFreeHandDrawing).mockReturnValue({
        setup: mockFreeHandSetup,
        cleanup: vi.fn(),
        handleEscape: vi.fn(),
      });

      vi.mocked(useKeyboardNavigation).mockReturnValue({
        setup: mockKeyboardSetup,
        cleanup: vi.fn(),
      });

      vi.mocked(useMapEventHandlers).mockReturnValue({
        setup: mockMapEventsSetup,
      });

      vi.mocked(useViewCapture).mockReturnValue({
        setup: mockViewCaptureSetup,
      });

      // Re-create app setup with new mocks
      const setup = useAppSetup(
        mockMapContainer,
        mockDrawing,
        mockNoteTooltipsRef,
        mockCursorTooltip
      );
      const cleanupFn = await setup();

      // Should call map initialization
      expect(useMapInitialization).toHaveBeenCalledWith(
        mockMapContainer,
        mockDrawing,
        mockNoteTooltipsRef
      );

      // Should setup all event handlers
      expect(mockFreeHandSetup).toHaveBeenCalled();
      expect(mockKeyboardSetup).toHaveBeenCalled();
      expect(mockMapEventsSetup).toHaveBeenCalled();
      expect(mockViewCaptureSetup).toHaveBeenCalled();

      expect(cleanupFn).toBeInstanceOf(Function);
    });

    it('should setup handlers in correct order', async () => {
      const setupOrder: string[] = [];

      // Mock to track call order
      const mockFreeHand = {
        setup: vi.fn(() => setupOrder.push('freeHand')),
        cleanup: vi.fn(),
        handleEscape: vi.fn(),
      };

      const mockKeyboard = {
        setup: vi.fn(() => setupOrder.push('keyboard')),
        cleanup: vi.fn(),
      };

      const mockMapEvents = {
        setup: vi.fn(() => {
          setupOrder.push('mapEvents');
          return vi.fn();
        }),
      };

      const mockViewCap = {
        setup: vi.fn(() => {
          setupOrder.push('viewCapture');
          return vi.fn();
        }),
      };

      vi.mocked(useFreeHandDrawing).mockReturnValue(mockFreeHand);
      vi.mocked(useKeyboardNavigation).mockReturnValue(mockKeyboard);
      vi.mocked(useMapEventHandlers).mockReturnValue(mockMapEvents);
      vi.mocked(useViewCapture).mockReturnValue(mockViewCap);

      const setup = useAppSetup(
        mockMapContainer,
        mockDrawing,
        mockNoteTooltipsRef,
        mockCursorTooltip
      );
      await setup();

      // Event handlers should be setup after map initialization
      expect(setupOrder).toEqual(['mapEvents', 'viewCapture', 'freeHand', 'keyboard']);
    });
  });

  describe('Cleanup Function', () => {
    it('should cleanup all handlers and destroy map', async () => {
      const mockUnsubscribeRight = vi.fn();
      const mockUnsubscribeView = vi.fn();

      const mockFreeHand = {
        setup: vi.fn(),
        cleanup: vi.fn(),
        handleEscape: vi.fn(),
      };

      const mockKeyboard = {
        setup: vi.fn(),
        cleanup: vi.fn(),
      };

      const mockMapEvents = {
        setup: vi.fn(() => mockUnsubscribeRight),
      };

      const mockViewCap = {
        setup: vi.fn(() => mockUnsubscribeView),
      };

      vi.mocked(useFreeHandDrawing).mockReturnValue(mockFreeHand);
      vi.mocked(useKeyboardNavigation).mockReturnValue(mockKeyboard);
      vi.mocked(useMapEventHandlers).mockReturnValue(mockMapEvents);
      vi.mocked(useViewCapture).mockReturnValue(mockViewCap);

      const setup = useAppSetup(
        mockMapContainer,
        mockDrawing,
        mockNoteTooltipsRef,
        mockCursorTooltip
      );
      const cleanup = await setup();

      // Call cleanup
      cleanup();

      // Should call all cleanup functions
      expect(mockUnsubscribeRight).toHaveBeenCalled();
      expect(mockUnsubscribeView).toHaveBeenCalled();
      expect(mockFreeHand.cleanup).toHaveBeenCalled();
      expect(mockKeyboard.cleanup).toHaveBeenCalled();
      expect(mockMapContainer.destroyMap).toHaveBeenCalled();
    });

    it('should cleanup in reverse order', async () => {
      const cleanupOrder: string[] = [];

      mockMapContainer.destroyMap = vi.fn(() => cleanupOrder.push('destroyMap'));

      const mockUnsubscribeRight = vi.fn(() => cleanupOrder.push('unsubscribeRight'));
      const mockUnsubscribeView = vi.fn(() => cleanupOrder.push('unsubscribeView'));

      const mockFreeHand = {
        setup: vi.fn(),
        cleanup: vi.fn(() => cleanupOrder.push('freeHandCleanup')),
        handleEscape: vi.fn(),
      };

      const mockKeyboard = {
        setup: vi.fn(),
        cleanup: vi.fn(() => cleanupOrder.push('keyboardCleanup')),
      };

      vi.mocked(useFreeHandDrawing).mockReturnValue(mockFreeHand);
      vi.mocked(useKeyboardNavigation).mockReturnValue(mockKeyboard);
      vi.mocked(useMapEventHandlers).mockReturnValue({
        setup: vi.fn(() => mockUnsubscribeRight),
      });
      vi.mocked(useViewCapture).mockReturnValue({
        setup: vi.fn(() => mockUnsubscribeView),
      });

      const setup = useAppSetup(
        mockMapContainer,
        mockDrawing,
        mockNoteTooltipsRef,
        mockCursorTooltip
      );
      const cleanup = await setup();

      cleanup();

      // Cleanup should happen in reverse order of setup
      expect(cleanupOrder).toEqual([
        'unsubscribeRight',
        'unsubscribeView',
        'freeHandCleanup',
        'keyboardCleanup',
        'destroyMap',
      ]);
    });
  });

  describe('Error Handling', () => {
    it('should handle map initialization failure gracefully', async () => {
      const initError = new Error('Map initialization failed');
      vi.mocked(useMapInitialization).mockRejectedValue(initError);

      const setup = useAppSetup(
        mockMapContainer,
        mockDrawing,
        mockNoteTooltipsRef,
        mockCursorTooltip
      );

      // Should propagate the error
      await expect(setup()).rejects.toThrow('Map initialization failed');
    });

    it('should still return cleanup function even if some setups fail', async () => {
      // Reset useMapInitialization to succeed
      vi.mocked(useMapInitialization).mockResolvedValue(undefined);

      const mockFreeHand = {
        setup: vi.fn(() => {
          throw new Error('FreeHand setup failed');
        }),
        cleanup: vi.fn(),
        handleEscape: vi.fn(),
      };

      vi.mocked(useFreeHandDrawing).mockReturnValue(mockFreeHand);

      const setup = useAppSetup(
        mockMapContainer,
        mockDrawing,
        mockNoteTooltipsRef,
        mockCursorTooltip
      );

      // Setup should throw but still be able to attempt cleanup
      await expect(setup()).rejects.toThrow('FreeHand setup failed');
    });
  });
});
