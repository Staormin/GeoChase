import { createProjectGeometry } from '@/services/projectGeometry';
import { useProjectsStore } from '@/stores/projects';

export function useProjectGeometry() {
  const projects = useProjectsStore();
  return createProjectGeometry(() => projects.activeProjection);
}
