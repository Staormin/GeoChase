/**
 * Storage service - localStorage management for projects
 */

import type { ProjectData, ProjectLayerData } from '@/types/project';

import { v4 as uuidv4 } from 'uuid';

const PROJECTS_STORAGE_KEY = 'geochase_projects';

/**
 * Get all projects from localStorage
 */
export function getAllProjects(): ProjectData[] {
  try {
    const projects = localStorage.getItem(PROJECTS_STORAGE_KEY);
    return projects ? JSON.parse(projects) : [];
  } catch {
    return [];
  }
}

/**
 * Save projects to localStorage
 */
export function saveProjectsToStorage(projects: ProjectData[]): void {
  localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
}

/**
 * Get specific project by index
 */
export function getProject(index: number): ProjectData | null {
  const projects = getAllProjects();
  return projects[index] || null;
}

/**
 * Create a new project
 */
export function createProject(name: string, data: ProjectLayerData): ProjectData {
  return {
    id: uuidv4(),
    name,
    data,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Save a new project and return the created project
 */
export function saveProject(projectName: string, data: ProjectLayerData): ProjectData {
  const projects = getAllProjects();
  const newProject = createProject(projectName, data);
  projects.push(newProject);
  saveProjectsToStorage(projects);
  return newProject;
}

/**
 * Update an existing project
 */
export function updateProject(index: number, name: string, data: ProjectLayerData): void {
  const projects = getAllProjects();
  if (projects[index]) {
    projects[index] = {
      id: projects[index].id,
      name,
      data,
      viewData: projects[index].viewData, // Preserve viewData
      createdAt: projects[index].createdAt,
      updatedAt: Date.now(),
    };
    saveProjectsToStorage(projects);
  }
}

/**
 * Delete a project by index
 */
export function deleteProject(index: number): void {
  const projects = getAllProjects();
  projects.splice(index, 1);
  saveProjectsToStorage(projects);
}

/**
 * Clear all projects
 */
export function clearAllProjects(): void {
  saveProjectsToStorage([]);
}

/**
 * Export project data as JSON
 */
export function exportProjectAsJSON(project: ProjectData): string {
  return JSON.stringify(
    {
      version: '1.0',
      timestamp: new Date().toISOString(),
      ...project,
    },
    null,
    2
  );
}

/**
 * Import project data from JSON
 */
export function importProjectFromJSON(jsonString: string): ProjectData | null {
  try {
    const data = JSON.parse(jsonString);
    if (!data.name || !data.data) {
      throw new Error('Invalid project format');
    }
    return {
      name: data.name,
      data: data.data,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  } catch {
    return null;
  }
}
