import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAllProjects,
  createProject,
  deleteProject,
  exportProjectAsJSON,
  getAllProjects,
  getProject,
  importProjectFromJSON,
  type ProjectData,
  type ProjectLayerData,
  saveProject,
  saveProjectsToStorage,
  updateProject,
} from '@/services/storage';

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-123'),
}));

describe('storage service', () => {
  const mockLayerData: ProjectLayerData = {
    circles: [],
    lineSegments: [],
    points: [],
    polygons: [],
    savedCoordinates: [],
    notes: [],
  };

  const mockProject: ProjectData = {
    id: 'project-1',
    name: 'Test Project',
    data: mockLayerData,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  };

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getAllProjects', () => {
    it('should return empty array when no projects exist', () => {
      const projects = getAllProjects();
      expect(projects).toEqual([]);
    });

    it('should return projects from localStorage', () => {
      localStorage.setItem('geochase_projects', JSON.stringify([mockProject]));

      const projects = getAllProjects();

      expect(projects).toHaveLength(1);
      expect(projects[0]).toEqual(mockProject);
    });

    it('should return empty array on JSON parse error', () => {
      localStorage.setItem('geochase_projects', 'invalid json');

      const projects = getAllProjects();

      expect(projects).toEqual([]);
    });
  });

  describe('saveProjectsToStorage', () => {
    it('should save projects to localStorage', () => {
      saveProjectsToStorage([mockProject]);

      const stored = localStorage.getItem('geochase_projects');
      expect(stored).toBe(JSON.stringify([mockProject]));
    });

    it('should handle localStorage errors silently', () => {
      // Mock localStorage.setItem to throw
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      // Should not throw
      expect(() => saveProjectsToStorage([mockProject])).not.toThrow();

      setItemSpy.mockRestore();
    });
  });

  describe('getProject', () => {
    beforeEach(() => {
      localStorage.setItem('geochase_projects', JSON.stringify([mockProject]));
    });

    it('should return project at given index', () => {
      const project = getProject(0);
      expect(project).toEqual(mockProject);
    });

    it('should return null for invalid index', () => {
      const project = getProject(99);
      expect(project).toBeNull();
    });

    it('should return null for negative index', () => {
      const project = getProject(-1);
      expect(project).toBeNull();
    });
  });

  describe('createProject', () => {
    it('should create a new project with uuid and timestamps', () => {
      const project = createProject('New Project', mockLayerData);

      expect(project).toEqual({
        id: 'test-uuid-123',
        name: 'New Project',
        data: mockLayerData,
        createdAt: 1_705_320_000_000,
        updatedAt: 1_705_320_000_000,
      });
    });
  });

  describe('saveProject', () => {
    it('should save a new project and return it', () => {
      const savedProject = saveProject('My Project', mockLayerData);

      expect(savedProject.name).toBe('My Project');
      expect(savedProject.id).toBe('test-uuid-123');

      const projects = getAllProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0]?.name).toBe('My Project');
    });

    it('should append to existing projects', () => {
      localStorage.setItem('geochase_projects', JSON.stringify([mockProject]));

      saveProject('Second Project', mockLayerData);

      const projects = getAllProjects();
      expect(projects).toHaveLength(2);
    });
  });

  describe('updateProject', () => {
    beforeEach(() => {
      const projectWithViewData = {
        ...mockProject,
        viewData: { topPanelOpen: true, sidePanelOpen: false },
      };
      localStorage.setItem('geochase_projects', JSON.stringify([projectWithViewData]));
    });

    it('should update project at given index', () => {
      const newData: ProjectLayerData = {
        ...mockLayerData,
        circles: [
          {
            id: 'circle-1',
            name: 'Test Circle',
            center: { lat: 48.8566, lon: 2.3522 },
            radius: 1000,
          },
        ],
      };

      updateProject(0, 'Updated Name', newData);

      const projects = getAllProjects();
      expect(projects[0]?.name).toBe('Updated Name');
      expect(projects[0]?.data.circles).toHaveLength(1);
      expect(projects[0]?.updatedAt).toBe(1_705_320_000_000);
      // Should preserve viewData and createdAt
      expect(projects[0]?.viewData).toEqual({ topPanelOpen: true, sidePanelOpen: false });
      expect(projects[0]?.createdAt).toBe(mockProject.createdAt);
    });

    it('should not update if index does not exist', () => {
      updateProject(99, 'Updated Name', mockLayerData);

      const projects = getAllProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0]?.name).toBe('Test Project');
    });
  });

  describe('deleteProject', () => {
    it('should delete project at given index', () => {
      const projects = [mockProject, { ...mockProject, id: 'project-2', name: 'Second' }];
      localStorage.setItem('geochase_projects', JSON.stringify(projects));

      deleteProject(0);

      const remaining = getAllProjects();
      expect(remaining).toHaveLength(1);
      expect(remaining[0]?.name).toBe('Second');
    });

    it('should handle deleting from empty array', () => {
      deleteProject(0);

      const projects = getAllProjects();
      expect(projects).toEqual([]);
    });
  });

  describe('clearAllProjects', () => {
    it('should remove all projects', () => {
      localStorage.setItem('geochase_projects', JSON.stringify([mockProject]));

      clearAllProjects();

      const projects = getAllProjects();
      expect(projects).toEqual([]);
    });
  });

  describe('exportProjectAsJSON', () => {
    it('should export project as formatted JSON string', () => {
      const exported = exportProjectAsJSON(mockProject);
      const parsed = JSON.parse(exported);

      expect(parsed.version).toBe('1.0');
      expect(parsed.timestamp).toBeDefined();
      expect(parsed.name).toBe('Test Project');
      expect(parsed.data).toEqual(mockLayerData);
    });

    it('should include ISO timestamp', () => {
      const exported = exportProjectAsJSON(mockProject);
      const parsed = JSON.parse(exported);

      // Check that timestamp is a valid ISO string
      expect(new Date(parsed.timestamp).toISOString()).toBe(parsed.timestamp);
    });
  });

  describe('importProjectFromJSON', () => {
    it('should import valid project JSON', () => {
      const json = JSON.stringify({
        name: 'Imported Project',
        data: mockLayerData,
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
      });

      const imported = importProjectFromJSON(json);

      expect(imported).not.toBeNull();
      expect(imported?.name).toBe('Imported Project');
      expect(imported?.data).toEqual(mockLayerData);
    });

    it('should return null for invalid JSON', () => {
      const imported = importProjectFromJSON('invalid json');
      expect(imported).toBeNull();
    });

    it('should return null for JSON missing name', () => {
      const json = JSON.stringify({ data: mockLayerData });
      const imported = importProjectFromJSON(json);
      expect(imported).toBeNull();
    });

    it('should return null for JSON missing data', () => {
      const json = JSON.stringify({ name: 'Test' });
      const imported = importProjectFromJSON(json);
      expect(imported).toBeNull();
    });
  });
});
