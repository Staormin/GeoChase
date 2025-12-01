import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { useAutoSave } from '@/composables/useAutoSave';
import { useLayersStore } from '@/stores/layers';
import { useProjectsStore } from '@/stores/projects';

describe('useAutoSave', () => {
  let pinia: any;
  let projectsStore: any;
  let layersStore: any;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    projectsStore = useProjectsStore();
    layersStore = useLayersStore();

    // Reset timers
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should not auto-save when there is no active project', async () => {
    const autoSaveSpy = vi.spyOn(projectsStore, 'autoSaveActiveProject');

    // No active project
    projectsStore.activeProjectId = null;

    // Initialize auto-save
    useAutoSave();

    // Add a circle to trigger the watcher
    layersStore.addCircle({
      id: '1',
      name: 'Test Circle',
      centerLat: 0,
      centerLon: 0,
      radius: 1000,
      color: '#ff0000',
      visible: true,
    });

    await nextTick();

    // Fast forward time to trigger debounced save
    vi.advanceTimersByTime(600);

    expect(autoSaveSpy).not.toHaveBeenCalled();
  });

  it('should auto-save when active project exists and layers change', async () => {
    const autoSaveSpy = vi.spyOn(projectsStore, 'autoSaveActiveProject');

    // Set an active project
    projectsStore.activeProjectId = 'project-123';

    // Initialize auto-save
    useAutoSave();

    // Add a circle to trigger the watcher
    layersStore.addCircle({
      id: '1',
      name: 'Test Circle',
      centerLat: 0,
      centerLon: 0,
      radius: 1000,
      color: '#ff0000',
      visible: true,
    });

    await nextTick();

    // Should not save immediately (debounced)
    expect(autoSaveSpy).not.toHaveBeenCalled();

    // Fast forward time to trigger debounced save
    vi.advanceTimersByTime(600);

    expect(autoSaveSpy).toHaveBeenCalledTimes(1);
    expect(autoSaveSpy).toHaveBeenCalledWith({
      circles: layersStore.circles,
      lineSegments: layersStore.lineSegments,
      points: layersStore.points,
      polygons: layersStore.polygons,
      notes: layersStore.notes,
    });
  });

  it('should debounce multiple rapid changes', async () => {
    const autoSaveSpy = vi.spyOn(projectsStore, 'autoSaveActiveProject');

    // Set an active project
    projectsStore.activeProjectId = 'project-123';

    // Initialize auto-save
    useAutoSave();

    // Make multiple rapid changes
    layersStore.addCircle({
      id: '1',
      name: 'Circle 1',
      centerLat: 0,
      centerLon: 0,
      radius: 1000,
      color: '#ff0000',
      visible: true,
    });
    await nextTick();

    vi.advanceTimersByTime(100);

    layersStore.addPoint({
      id: '2',
      name: 'Point 1',
      coordinates: { lat: 1, lon: 1 },
      color: '#00ff00',
    });
    await nextTick();

    vi.advanceTimersByTime(100);

    layersStore.addLineSegment({
      id: '3',
      name: 'Line 1',
      startLat: 0,
      startLon: 0,
      endLat: 1,
      endLon: 1,
      color: '#0000ff',
      mode: 'coordinates',
      visible: true,
    });
    await nextTick();

    // Still shouldn't have saved (debounced)
    expect(autoSaveSpy).not.toHaveBeenCalled();

    // Fast forward to complete the debounce
    vi.advanceTimersByTime(500);

    // Should save only once after debounce
    expect(autoSaveSpy).toHaveBeenCalledTimes(1);
  });

  it('should trigger on point changes', async () => {
    const autoSaveSpy = vi.spyOn(projectsStore, 'autoSaveActiveProject');

    // Set an active project
    projectsStore.activeProjectId = 'project-123';

    // Initialize auto-save
    useAutoSave();

    // Add a point
    layersStore.addPoint({
      id: '1',
      name: 'Test Point',
      coordinates: { lat: 48.8566, lon: 2.3522 },
      color: '#00ff00',
    });

    await nextTick();

    // Fast forward time to trigger debounced save
    vi.advanceTimersByTime(600);

    expect(autoSaveSpy).toHaveBeenCalledTimes(1);
    expect(autoSaveSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        points: expect.arrayContaining([
          expect.objectContaining({
            name: 'Test Point',
            coordinates: { lat: 48.8566, lon: 2.3522 },
          }),
        ]),
      })
    );
  });

  it('should trigger on polygon changes', async () => {
    const autoSaveSpy = vi.spyOn(projectsStore, 'autoSaveActiveProject');

    // Set an active project
    projectsStore.activeProjectId = 'project-123';

    // Initialize auto-save
    useAutoSave();

    // Add a polygon
    layersStore.addPolygon({
      id: '1',
      name: 'Test Polygon',
      points: [
        { lat: 0, lon: 0 },
        { lat: 1, lon: 0 },
        { lat: 1, lon: 1 },
        { lat: 0, lon: 1 },
      ],
      color: '#ff00ff',
      fillColor: '#ff00ff',
      visible: true,
    });

    await nextTick();

    // Fast forward time to trigger debounced save
    vi.advanceTimersByTime(600);

    expect(autoSaveSpy).toHaveBeenCalledTimes(1);
    expect(autoSaveSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        polygons: expect.arrayContaining([
          expect.objectContaining({
            name: 'Test Polygon',
          }),
        ]),
      })
    );
  });

  it('should trigger on notes changes', async () => {
    const autoSaveSpy = vi.spyOn(projectsStore, 'autoSaveActiveProject');

    // Set an active project
    projectsStore.activeProjectId = 'project-123';

    // Initialize auto-save
    useAutoSave();

    // Add a note to a circle
    layersStore.addCircle({
      id: 'circle-1',
      name: 'Test Circle',
      centerLat: 0,
      centerLon: 0,
      radius: 1000,
      color: '#ff0000',
      visible: true,
    });

    layersStore.addNote({
      id: 'note-1',
      content: 'Test note content',
      linkedElementId: 'circle-1',
      linkedElementType: 'circle',
    });

    await nextTick();

    // Fast forward time to trigger debounced save
    vi.advanceTimersByTime(600);

    expect(autoSaveSpy).toHaveBeenCalledTimes(1);
    expect(autoSaveSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: expect.arrayContaining([
          expect.objectContaining({
            content: 'Test note content',
            linkedElementId: 'circle-1',
          }),
        ]),
      })
    );
  });

  it('should handle manual debounced save call', async () => {
    const autoSaveSpy = vi.spyOn(projectsStore, 'autoSaveActiveProject');

    // Set an active project
    projectsStore.activeProjectId = 'project-123';

    // Initialize auto-save
    const { debouncedAutoSave } = useAutoSave();

    // Call debounced save manually
    debouncedAutoSave();

    // Should not save immediately
    expect(autoSaveSpy).not.toHaveBeenCalled();

    // Fast forward time
    vi.advanceTimersByTime(600);

    expect(autoSaveSpy).toHaveBeenCalledTimes(1);
  });

  it('should reset timer on rapid manual calls', async () => {
    const autoSaveSpy = vi.spyOn(projectsStore, 'autoSaveActiveProject');

    // Set an active project
    projectsStore.activeProjectId = 'project-123';

    // Initialize auto-save
    const { debouncedAutoSave } = useAutoSave();

    // Call multiple times rapidly
    debouncedAutoSave();
    vi.advanceTimersByTime(200);

    debouncedAutoSave();
    vi.advanceTimersByTime(200);

    debouncedAutoSave();
    vi.advanceTimersByTime(200);

    // Still shouldn't have saved
    expect(autoSaveSpy).not.toHaveBeenCalled();

    // Complete the last debounce
    vi.advanceTimersByTime(400);

    // Should save only once
    expect(autoSaveSpy).toHaveBeenCalledTimes(1);
  });
});
