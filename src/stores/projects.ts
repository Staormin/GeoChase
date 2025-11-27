/**
 * Projects store - Manages project save/load operations
 */

import type { ProjectData, ProjectLayerData, ViewData } from '@/services/storage';
import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import * as pdfStorage from '@/services/pdfStorage';
import * as storage from '@/services/storage';

export const useProjectsStore = defineStore('projects', () => {
  // State
  const projects = ref<ProjectData[]>([]);
  const activeProjectId = ref<string | null>(null);

  // PDF state (stored in IndexedDB, loaded into memory for current project)
  const currentPdf = ref<{ data: string; name: string; password?: string } | null>(null);
  const pdfLoading = ref(false);

  /**
   * Load PDF from IndexedDB for the current project
   */
  async function loadCurrentPdf(): Promise<void> {
    if (!activeProjectId.value) {
      currentPdf.value = null;
      return;
    }

    pdfLoading.value = true;
    try {
      const pdf = await pdfStorage.getPdf(activeProjectId.value);
      currentPdf.value = pdf;
    } catch (error) {
      console.error('Failed to load PDF from IndexedDB:', error);
      currentPdf.value = null;
    } finally {
      pdfLoading.value = false;
    }
  }

  // Watch for project changes and load PDF
  watch(activeProjectId, () => {
    loadCurrentPdf();
  });

  // Debounce timer for view data saving
  let viewDataSaveTimer: ReturnType<typeof setTimeout> | null = null;
  const VIEW_DATA_SAVE_DELAY = 250; // 250ms delay (1/4 second)

  // Computed
  const projectCount = computed(() => projects.value.length);

  const sortedProjects = computed(() => {
    return [...projects.value].toSorted(
      (a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0)
    );
  });

  const activeProject = computed(() => {
    if (!activeProjectId.value) {
      return null;
    }
    return projects.value.find((p) => p.id === activeProjectId.value) || null;
  });

  // Actions
  function loadProjects(): void {
    projects.value = storage.getAllProjects();
  }

  function setActiveProject(projectId: string | null): void {
    activeProjectId.value = projectId;
    localStorage.setItem('geochase_activeProjectId', projectId || '');
  }

  function createAndSwitchProject(name: string, _data: ProjectLayerData): void {
    // Create new project with empty state and get the returned project
    const newProject = storage.saveProject(name, {
      circles: [],
      lineSegments: [],
      points: [],
      polygons: [],
      savedCoordinates: [],
      notes: [],
    });

    // Add to local projects array
    projects.value.push(newProject);

    // Set as active using the returned ID
    if (newProject.id) {
      setActiveProject(newProject.id);
    }
  }

  function saveProject(name: string, data: ProjectLayerData): void {
    storage.saveProject(name, data);
    loadProjects();
  }

  function autoSaveActiveProject(data: ProjectLayerData): void {
    if (!activeProjectId.value) {
      return;
    }
    const currentProject = activeProject.value;
    if (currentProject) {
      const index = projects.value.indexOf(currentProject);
      if (index !== -1) {
        // Update project in-place without full reload
        projects.value[index] = {
          ...currentProject,
          data,
          updatedAt: Date.now(),
        };

        // Save to storage
        storage.updateProject(index, currentProject.name, data);
      }
    }
  }

  function loadActiveProject(): void {
    const savedProjectId = localStorage.getItem('geochase_activeProjectId');
    if (savedProjectId) {
      activeProjectId.value = savedProjectId;
    }
  }

  function updateProject(index: number, name: string, data: ProjectLayerData): void {
    storage.updateProject(index, name, data);
    loadProjects();
  }

  function deleteProject(index: number): void {
    storage.deleteProject(index);
    loadProjects();
  }

  function getProject(index: number): ProjectData | null {
    return storage.getProject(index);
  }

  function clearAllProjects(): void {
    storage.clearAllProjects();
    projects.value = [];
  }

  function exportProjectAsJSON(index: number): string | null {
    const project = getProject(index);
    if (!project) {
      return null;
    }
    return storage.exportProjectAsJSON(project);
  }

  function importProject(jsonString: string): boolean {
    const project = storage.importProjectFromJSON(jsonString);
    if (!project) {
      return false;
    }
    storage.saveProject(project.name, project.data);
    loadProjects();
    return true;
  }

  function renameProject(index: number, newName: string): void {
    const project = getProject(index);
    if (project) {
      updateProject(index, newName, project.data);
    }
  }

  /**
   * Update view data for the active project with debouncing
   * This prevents excessive writes to localStorage
   */
  function updateViewData(viewData: ViewData): void {
    // Capture the current active project ID to avoid race conditions
    const projectIdAtCallTime = activeProjectId.value;
    if (!projectIdAtCallTime) {
      return;
    }

    const currentProject = activeProject.value;
    if (!currentProject) {
      return;
    }

    // Update the in-memory project immediately
    const index = projects.value.indexOf(currentProject);
    if (index !== -1) {
      projects.value[index] = {
        ...currentProject,
        viewData,
        updatedAt: Date.now(),
      };
    }

    // Debounce the localStorage write
    if (viewDataSaveTimer) {
      clearTimeout(viewDataSaveTimer);
    }

    viewDataSaveTimer = setTimeout(() => {
      // Verify the project ID hasn't changed during the debounce period
      if (activeProjectId.value !== projectIdAtCallTime) {
        viewDataSaveTimer = null;
        return;
      }

      if (index !== -1 && currentProject) {
        // Save to localStorage
        const allProjects = storage.getAllProjects();
        const storageIndex = allProjects.findIndex((p) => p.id === projectIdAtCallTime);
        if (storageIndex !== -1 && allProjects[storageIndex]) {
          const project = allProjects[storageIndex];
          allProjects[storageIndex] = {
            id: project.id,
            name: project.name,
            data: project.data,
            viewData,
            createdAt: project.createdAt,
            updatedAt: Date.now(),
          };
          storage.saveProjectsToStorage(allProjects);
        }
      }
      viewDataSaveTimer = null;
    }, VIEW_DATA_SAVE_DELAY);
  }

  /**
   * Get view data for the active project
   */
  function getViewData(): ViewData | null {
    return activeProject.value?.viewData || null;
  }

  /**
   * Update PDF for the active project (saves to IndexedDB)
   */
  async function updatePdf(
    pdfData: string | null,
    pdfName: string | null,
    pdfPassword: string | null = null
  ): Promise<void> {
    const projectIdAtCallTime = activeProjectId.value;
    if (!projectIdAtCallTime) {
      return;
    }

    if (pdfData && pdfName) {
      // Save to IndexedDB
      await pdfStorage.savePdf(projectIdAtCallTime, pdfData, pdfName, pdfPassword ?? undefined);
      // Update in-memory state
      currentPdf.value = { data: pdfData, name: pdfName, password: pdfPassword ?? undefined };
    } else {
      // Delete from IndexedDB
      await pdfStorage.deletePdf(projectIdAtCallTime);
      currentPdf.value = null;
    }
  }

  /**
   * Update just the PDF password for the active project (saves to IndexedDB)
   */
  async function updatePdfPassword(pdfPassword: string | null): Promise<void> {
    const projectIdAtCallTime = activeProjectId.value;
    if (!projectIdAtCallTime || !currentPdf.value) {
      return;
    }

    // Update in IndexedDB
    await pdfStorage.updatePdfPassword(projectIdAtCallTime, pdfPassword);

    // Update in-memory state
    currentPdf.value = {
      ...currentPdf.value,
      password: pdfPassword ?? undefined,
    };
  }

  /**
   * Get PDF data for the active project (from in-memory state)
   */
  function getPdfData(): { data: string; name: string; password?: string } | null {
    return currentPdf.value;
  }

  /**
   * Check if active project has a PDF (from in-memory state)
   */
  function hasPdf(): boolean {
    return currentPdf.value !== null;
  }

  // Initialize on store creation
  loadProjects();
  loadActiveProject();
  // Load PDF for active project (async, will update currentPdf when done)
  loadCurrentPdf();

  return {
    // State
    projects,
    activeProjectId,
    pdfLoading,

    // Computed
    projectCount,
    sortedProjects,
    activeProject,

    // Actions
    loadProjects,
    setActiveProject,
    createAndSwitchProject,
    saveProject,
    autoSaveActiveProject,
    loadActiveProject,
    updateProject,
    deleteProject,
    getProject,
    clearAllProjects,
    exportProjectAsJSON,
    importProject,
    renameProject,
    updateViewData,
    getViewData,
    updatePdf,
    updatePdfPassword,
    getPdfData,
    hasPdf,
    loadCurrentPdf,
  };
});
