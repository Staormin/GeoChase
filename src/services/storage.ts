/**
 * Storage service - localStorage management for projects and coordinates
 */

import { v4 as uuidv4 } from 'uuid';

export interface SavedCoordinate {
  id: string;
  name: string;
  lat: number;
  lon: number;
  timestamp?: number;
}

export interface ViewData {
  topPanelOpen: boolean;
  sidePanelOpen: boolean;
  mapView?: {
    lat: number;
    lon: number;
    zoom: number;
  };
}

export interface ProjectData {
  id?: string;
  name: string;
  data: ProjectLayerData;
  viewData?: ViewData;
  createdAt?: number;
  updatedAt?: number;
}

export interface ProjectLayerData {
  circles: CircleElement[];
  lineSegments: LineSegmentElement[];
  points: PointElement[];
  polygons: PolygonElement[];
  savedCoordinates: SavedCoordinate[];
  notes: NoteElement[];
}

export interface CircleElement {
  id: string;
  name: string;
  center: { lat: number; lon: number };
  radius: number;
  color?: string;
  mapElementId?: string; // OpenLayers feature ID
  noteId?: string; // ID of the linked note (one-to-one)
  createdAt?: number;
}

export interface LineSegmentElement {
  id: string;
  name: string;
  center: { lat: number; lon: number };
  endpoint?: { lat: number; lon: number };
  mode: 'coordinate' | 'azimuth' | 'intersection' | 'parallel';
  distance?: number;
  azimuth?: number;
  intersectionPoint?: { lat: number; lon: number };
  intersectionDistance?: number;
  longitude?: number;
  color?: string;
  mapElementId?: string; // OpenLayers feature ID
  noteId?: string; // ID of the linked note (one-to-one)
  createdAt?: number;
  // Point references: IDs of points that are on this line
  startPointId?: string; // ID of the point at the start position
  endPointId?: string; // ID of the point at the end position
  pointsOnLine?: string[]; // IDs of points that lie on this line (excluding start/end)
}

export interface PointElement {
  id: string;
  name: string;
  coordinates: { lat: number; lon: number };
  elevation?: number;
  color?: string;
  mapElementId?: string; // OpenLayers feature ID
  noteId?: string; // ID of the linked note (one-to-one)
  createdAt?: number;
  // Line reference: ID of the line that contains this point (bidirectional relationship: 1 point => 0 or 1 line)
  lineId?: string; // ID of line where this point appears in pointsOnLine, startPointId, or endPointId
  // Polygon references: IDs of polygons that use this point (bidirectional relationship: 1 point => 0 or many polygons)
  polygonIds?: string[]; // IDs of polygons where this point appears in pointIds array
}

export interface PolygonElement {
  id: string;
  name: string;
  pointIds: string[]; // Array of PointElement IDs (minimum 3) - bidirectional relationship with PointElement.polygonIds
  color?: string;
  mapElementId?: string; // OpenLayers feature ID
  noteId?: string; // ID of the linked note (one-to-one)
  createdAt?: number;
}

export interface NoteElement {
  id: string;
  title: string;
  content: string;
  linkedElementType?: 'circle' | 'lineSegment' | 'point' | 'polygon';
  linkedElementId?: string;
  createdAt?: number;
  updatedAt?: number;
}

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
  try {
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
  } catch {
    // Silently ignore localStorage errors
  }
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
