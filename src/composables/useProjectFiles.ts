import { useI18n } from 'vue-i18n';
import { parseProjectJSON } from '@/domain/layers';
import { downloadGPX, generateCompleteGPX, getTimestamp } from '@/services/gpx';
import { imageAssetDataURL, importImageAsset } from '@/services/imageAssets';
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

  async function exportJSON() {
    // Snapshot metadata before reading bytes, so a concurrent project switch cannot mix exports.
    const project = JSON.parse(
      exportProjectAsJSON({
        ...projects.activeProject,
        name: projects.activeProject?.name || 'project',
        data: layers.exportLayers(),
        projection: projects.activeProjection,
      })
    );
    const exportFilename = filename('json');
    try {
      const ids = [...new Set(layers.images.map((image) => image.assetId))];
      if (ids.length > 0)
        project.imageAssets = Object.fromEntries(
          await Promise.all(ids.map(async (id) => [id, await imageAssetDataURL(id)]))
        );
      downloadFile(JSON.stringify(project, null, 2), exportFilename, 'application/json');
      ui.addToast(t('messages.jsonExported'), 'success');
    } catch {
      ui.addToast(t('imageElement.exportError'), 'error');
    }
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
          const json = await file.text();
          const { data, projection } = parseProjectJSON(json);
          const imported = JSON.parse(json);
          const assetIds = new Map<string, string>();
          for (const image of data.images ?? []) {
            let id = assetIds.get(image.assetId);
            if (!id) {
              id = await importImageAsset(imported.imageAssets?.[image.assetId]);
              assetIds.set(image.assetId, id);
            }
            image.assetId = id;
          }
          const name =
            typeof imported.name === 'string' && imported.name.trim()
              ? imported.name.trim()
              : file.name.replace(/\.json$/i, '');
          if (projectId !== projects.activeProjectId)
            throw new Error('The active project changed during import');
          projects.autoSaveActiveProject(layers.exportLayers());
          projects.createAndSwitchProject(name, projection, data);
          noteTooltips.value?.clearAllTooltips();
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
