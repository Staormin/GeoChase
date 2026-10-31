import type { HistorySnapshot, HistoryStep, ProjectHistory } from '@/services/historyDelta';
import type { HistoryStorage } from '@/services/historyStorage';
import { defineStore } from 'pinia';
import { computed, nextTick, ref, toRaw, watch } from 'vue';
import { i18n } from '@/plugins/i18n';
import {
  applyHistoryStep,
  captureHistorySnapshot,
  createHistoryStep,
  historyCollections,
  historyLayers,
  trimHistory,
} from '@/services/historyDelta';
import { openHistoryStorage, projectHistoryHash } from '@/services/historyStorage';
import { getAllProjects } from '@/services/storage';
import { useLayersStore } from './layers';
import { useProjectsStore } from './projects';
import { useUIStore } from './ui';

export { HISTORY_LIMIT } from '@/services/historyStorage';

export const useHistoryStore = defineStore('history', () => {
  const layers = useLayersStore();
  const projects = useProjectsStore();
  const ui = useUIStore();
  let steps: HistoryStep[] = [];
  let present: HistorySnapshot | null = null;
  let writeVersion = 0;
  const position = ref(0);
  const length = ref(0);
  const ready = ref(false);
  const revision = ref(0);
  const projectId = ref<string | null>(null);
  let running = false;
  let generation = 0;
  let storage: HistoryStorage | null = null;
  let pendingWrite: Promise<void> = Promise.resolve();
  let loading: Promise<void> = Promise.resolve();
  let warned = false;

  const blocked = computed(
    () =>
      !ready.value ||
      !projects.activeProject ||
      projects.activeProjectId !== projectId.value ||
      ui.gameMode ||
      ui.openModals.size > 0 ||
      ui.showTutorial ||
      ui.freeHandDrawing.isDrawing ||
      !!ui.intersectionLineEdit ||
      ui.imageTransformActive ||
      !!ui.tools.activeTool
  );
  const undoCount = computed(() => position.value);
  const redoCount = computed(() => Math.max(0, length.value - position.value));
  const canUndo = computed(() => !blocked.value && undoCount.value > 0);
  const canRedo = computed(() => !blocked.value && redoCount.value > 0);

  function capture(): HistorySnapshot {
    // The watcher already tracks nested edits. Encoding a detached snapshot does
    // not need thousands of reactive proxy accesses for unchanged drawings.
    const data = Object.fromEntries(
      historyCollections.map((collection) => [collection, toRaw(layers[collection])])
    ) as Parameters<typeof captureHistorySnapshot>[0];
    return captureHistorySnapshot(data, projects.activeProjection, toRaw(ui.elementVisibility));
  }

  function setHistory(history: ProjectHistory) {
    steps = history.steps;
    position.value = history.position;
    length.value = steps.length;
  }

  function warnStorage() {
    if (!warned) ui.addToast(i18n.global.t('history.storageError'), 'error', 8000);
    warned = true;
  }

  function persist() {
    const id = projectId.value;
    if (!id || !projects.activeProject || id !== projects.activeProjectId) return;
    // Save the project first, then bind history to that exact persisted content.
    // A failed/interrupted history write can then be detected after reload.
    try {
      projects.autoSaveActiveProject(layers.exportLayers());
      if (storage) {
        // Persist new steps only; cursor movements do not rewrite previous changes.
        const version = ++writeVersion;
        const token = generation;
        const history = {
          steps: steps.slice(),
          position: position.value,
          visibility: { ...ui.elementVisibility },
        };
        // Digests may complete out of order. Preserve the order of project saves.
        pendingWrite = Promise.all([pendingWrite, projectHistoryHash(projects.activeProject)])
          .then(([, stateHash]) => {
            // Deleting a project while hashing must not recreate its history.
            const saved = { ...history, stateHash };
            return projects.projects.some((project) => project.id === id)
              ? storage!.write(id, saved)
              : saved;
          })
          .then((retained) => {
            if (token === generation && version === writeVersion && running) setHistory(retained);
          })
          .catch(warnStorage);
      }
    } catch {
      warnStorage();
    }
  }

  async function activate() {
    const token = ++generation;
    ready.value = false;
    // Visibility belongs to a project; imports can reuse the previous project's IDs.
    // Saved visibility is restored below when that project already has a history.
    if (projectId.value !== projects.activeProjectId) ui.elementVisibility = {};
    projectId.value = projects.activeProjectId;
    const id = projectId.value;
    // Image-project creation resumes its caller after setting the active ID;
    // let it clear/load the layers before establishing the new baseline.
    await nextTick();
    if (token !== generation || !running) return;
    const baseline = capture();
    present = baseline;
    setHistory({ steps: [], position: 0, visibility: baseline.visibility });
    try {
      // loadLayers recalculates references on objects shared with activeProject.
      // Read a detached copy of the actual saved state before any async work.
      const persisted = id ? getAllProjects().find((project) => project.id === id) : undefined;
      const [opened, stateHash] = await Promise.all([
        storage ?? openHistoryStorage(),
        persisted ? projectHistoryHash(persisted) : null,
        pendingWrite,
      ]);
      storage = opened;
      const saved = id ? await storage.read(id) : null;
      if (token !== generation || !running) return;
      // localStorage and IndexedDB cannot commit atomically. Discard stale deltas.
      if (saved && persisted && saved.stateHash === stateHash) {
        setHistory(saved);
        const restored = captureHistorySnapshot(
          {
            ...persisted.data,
            images: persisted.data.images ?? [],
            routes: persisted.data.routes ?? [],
            elementGroups: persisted.data.elementGroups ?? [],
          },
          persisted.projection ?? 'mercator',
          saved.visibility
        );
        // Deltas refer to the exact saved references, not import normalization.
        // Keep user edits made while reading history; record() captures them below.
        if (!createHistoryStep(baseline, capture())) {
          layers.$patch(historyLayers(restored));
          projects.activeProject!.projection = restored.projection;
        }
        if (JSON.stringify(ui.elementVisibility) === JSON.stringify(baseline.visibility))
          ui.elementVisibility = { ...saved.visibility };
        projects.activeProject!.data = layers.exportLayers();
        present = restored;
      }
    } catch {
      if (token === generation && running) warnStorage();
    }
    if (token !== generation || !running) return;
    ready.value = true;
    // Any edit made while storage was opening is captured instead of being lost.
    record();
    revision.value++;
  }

  function start() {
    running = true;
    loading = activate();
    return loading;
  }

  function stop() {
    record();
    running = false;
    generation++;
    ready.value = false;
  }

  function record() {
    if (!running) return;
    if (projectId.value !== projects.activeProjectId) {
      loading = activate();
      return;
    }
    if (!ready.value || !projects.activeProject) return;
    const snapshot = capture();
    const step = present ? createHistoryStep(present, snapshot) : null;
    present = snapshot;
    if (!step) return;
    steps.splice(position.value, steps.length, step);
    setHistory(trimHistory({ steps, position: steps.length, visibility: snapshot.visibility }));
    persist();
  }

  function restore(forward: boolean) {
    const step = steps[forward ? position.value : position.value - 1];
    const project = projects.activeProject;
    if (!step || !project || !present) return;
    const snapshot = applyHistoryStep(present, step, forward);
    ui.stopNavigating();
    ui.closeSearchAlong();
    ui.closeBearings();
    ui.stopEditing();
    ui.stopCreating();
    ui.mapElementHighlightRequest = null;
    ui.sidebarHoverRequest = null;
    project.projection = snapshot.projection;
    // Restore exact references; import normalization would recompute them.
    layers.$patch(historyLayers(snapshot));
    ui.elementVisibility = { ...snapshot.visibility };
    present = snapshot;
    position.value += forward ? 1 : -1;
    persist();
    revision.value++;
  }

  function undo() {
    record();
    if (canUndo.value) restore(false);
  }

  function redo() {
    record();
    if (canRedo.value) restore(true);
  }

  async function flush() {
    // Let the post-flush watcher record once and select the latest project load.
    await nextTick();
    await loading;
    await nextTick();
    await pendingWrite;
  }

  // A user's synchronous cascading mutations form one complete history step.
  watch(
    () => [
      layers.exportLayers(),
      projects.activeProjectId,
      projects.activeProjection,
      ui.elementVisibility,
    ],
    record,
    { deep: true, flush: 'post' }
  );

  return { canUndo, canRedo, undoCount, redoCount, revision, start, stop, flush, undo, redo };
});
