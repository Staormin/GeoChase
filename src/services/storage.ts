/**
 * Storage service - localStorage management for projects
 */

import type { ProjectData, ProjectLayerData, ProjectProjection } from '@/types/project';

import { v4 as uuidv4 } from 'uuid';
import { parseProjectJSON } from '@/domain/layers';

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
export function createProject(
  name: string,
  data: ProjectLayerData,
  projection: ProjectProjection = 'mercator'
): ProjectData {
  return {
    id: uuidv4(),
    name,
    data,
    projection,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Save a new project and return the created project
 */
export function saveProject(
  projectName: string,
  data: ProjectLayerData,
  projection: ProjectProjection = 'mercator'
): ProjectData {
  const projects = getAllProjects();
  const newProject = createProject(projectName, data, projection);
  projects.push(newProject);
  saveProjectsToStorage(projects);
  return newProject;
}

/**
 * Update an existing project
 */
export function updateProject(
  index: number,
  name: string,
  data: ProjectLayerData,
  projection?: ProjectProjection
): void {
  const projects = getAllProjects();
  if (projects[index]) {
    projects[index] = {
      ...projects[index],
      name,
      data,
      projection: projection ?? projects[index].projection ?? 'mercator',
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
      projection: project.projection ?? 'mercator',
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
      ...parseProjectJSON(jsonString),
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  } catch {
    return null;
  }
}
