import { useI18n } from 'vue-i18n';
import { parseProjectJSON } from '@/domain/layers';
import { downloadGPX, generateCompleteGPX, getTimestamp } from '@/services/gpx';
import { exportProjectAsJSON } from '@/services/storage';
import { useLayersStore } from '@/stores/layers';
import { useProjectsStore } from '@/stores/projects';
import { useUIStore } from '@/stores/ui';
import { downloadFile } from '@/utils/download';
import { useDrawingContext, useNoteTooltipsContext } from './mapContext';

export function useProjectFiles() {
  const { t } = useI18n();
  const layers = useLayersStore();
  const projects = useProjectsStore();
  const ui = useUIStore();
  const drawing = useDrawingContext();
  const noteTooltips = useNoteTooltipsContext();

  function filename(extension: string) {
    const name = (projects.activeProject?.name || 'project')
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase();
    return `${name}_${getTimestamp()}.${extension}`;
  }

  function exportGPX() {
    const circles = layers.circles.map((circle) => ({
      ...circle.center,
      radius: circle.radius,
      name: circle.name,
    }));
    const radii = [...new Set(circles.map((circle) => circle.radius))];
    downloadGPX(
      generateCompleteGPX(
        circles,
        radii,
        360,
        layers.lineSegments,
        layers.points,
        projects.activeProjection,
        layers.routes
      ),
      filename('gpx')
    );
    ui.addToast(t('messages.gpxExported'), 'success');
  }

  function exportJSON() {
    const json = exportProjectAsJSON({
      ...projects.activeProject,
      name: projects.activeProject?.name || 'project',
      data: layers.exportLayers(),
      projection: projects.activeProjection,
    });
    downloadFile(json, filename('json'), 'application/json');
    ui.addToast(t('messages.jsonExported'), 'success');
  }

  function importJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.addEventListener(
      'change',
      async () => {
        const file = input.files?.[0];
        if (!file) return;
        const projectId = projects.activeProjectId;
        try {
          const { data, projection } = parseProjectJSON(await file.text());
          if (projectId !== projects.activeProjectId)
            throw new Error('The active project changed during import');
          noteTooltips.value?.clearAllTooltips();
          projects.autoSaveActiveProject(data, projection);
          layers.loadLayers(data);
          drawing.redrawAllElements();
          noteTooltips.value?.updateNoteTooltips();
          ui.addToast(t('messages.jsonImported'), 'success');
        } catch {
          ui.addToast(t('messages.importError'), 'error');
        }
      },
      { once: true }
    );
    input.click();
  }

  return { exportGPX, exportJSON, importJSON };
}
