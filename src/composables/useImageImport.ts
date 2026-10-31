import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { Ref } from 'vue';
import { getPointResolution, toLonLat } from 'ol/proj';
import { computed, nextTick, onScopeDispose, ref, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { inspectImageAsset, writeImageAsset } from '@/services/imageAssets';
import { imageMapExtent } from '@/services/imageMap';
import { useImageMapStore } from '@/stores/imageMap';
import { useLayersStore } from '@/stores/layers';
import { useProjectsStore } from '@/stores/projects';
import { useUIStore } from '@/stores/ui';
import { useMapContext } from './mapContext';

interface ImportContext {
  projectId: string | null;
  name: string;
  resolution: number;
  denominator: number;
  generation: number;
}

export function useImageImport(imageFileInput: Ref<HTMLInputElement | null>) {
  const ui = useUIStore();
  const layers = useLayersStore();
  const projects = useProjectsStore();
  const imageMaps = useImageMapStore();
  const mapContainer = useMapContext();
  const { t } = useI18n();
  const importingImage = ref(false);
  const pendingPdf = shallowRef<{ document: PDFDocumentProxy; context: ImportContext } | null>(
    null
  );
  const pdfPage = ref(1);
  const validPdfPage = computed(
    () =>
      Number.isInteger(pdfPage.value) &&
      pdfPage.value >= 1 &&
      pdfPage.value <= (pendingPdf.value?.document.numPages ?? 0)
  );
  let generation = 0;

  function cancelPdf() {
    generation++;
    const pending = pendingPdf.value;
    pendingPdf.value = null;
    if (pending) void pending.document.loadingTask.destroy();
    importingImage.value = false;
  }
  watch(() => projects.activeProjectId, cancelPdf);
  onScopeDispose(cancelPdf);

  function chooseImage() {
    if (!importingImage.value && !pendingPdf.value) imageFileInput.value?.click();
  }

  function metersPerMapUnit(coordinate: number[]) {
    const image = imageMaps.image;
    if (imageMaps.active && image) {
      // Calibrated images use a flat plane, independent of synthetic latitude.
      const extent = imageMapExtent(image, projects.activeProjection);
      return (image.metersPerPixel * image.width) / (extent[2] - extent[0]);
    }
    return getPointResolution(
      mapContainer.map.value!.getView().getProjection(),
      1,
      coordinate,
      'm'
    );
  }

  async function placeImage(
    blob: Blob,
    dimensions: { width: number; height: number },
    context: ImportContext,
    paper?: { paperWidth: number; paperHeight: number }
  ) {
    const current = () =>
      context.generation === generation && context.projectId === projects.activeProjectId;
    if (!current()) return;
    const map = mapContainer.map.value;
    if (!map) throw new Error('Map unavailable');
    const assetId = crypto.randomUUID();
    await writeImageAsset(assetId, blob);
    if (!current()) return;
    if (window.innerWidth < 960) ui.sidebarOpen = false;
    await nextTick();
    if (!current()) return;
    const mapSize = map.getSize()!;
    const sidebar = document
      .querySelector('[data-testid="layers-sidebar"]')
      ?.getBoundingClientRect();
    const left = ui.sidebarOpen && sidebar ? Math.max(0, sidebar.right) : 0;
    const top = document.querySelector('.workspace-toolbar')?.getBoundingClientRect().bottom ?? 0;
    const coordinate = map.getCoordinateFromPixel([
      left + (mapSize[0]! - left) / 2,
      top + (mapSize[1]! - top) / 2,
    ]);
    const [lon, lat] = toLonLat(coordinate);
    const metersPerUnit = metersPerMapUnit(coordinate);
    const id = crypto.randomUUID();
    layers.addImage({
      id,
      assetId,
      name: context.name,
      rotation: 0,
      opacity: 1,
      keepAspectRatio: true,
      center: { lon: lon!, lat: lat! },
      // Raster imports retain one source pixel per map pixel at import time.
      // PDFs use physical paper metres × map scale, corrected for map projection.
      width: paper
        ? (paper.paperWidth * context.denominator) / metersPerUnit
        : dimensions.width * context.resolution,
      height: paper
        ? (paper.paperHeight * context.denominator) / metersPerUnit
        : dimensions.height * context.resolution,
    });
    ui.selectedImageId = id;
  }

  async function importPdfPage() {
    const pending = pendingPdf.value;
    if (!pending || !validPdfPage.value || importingImage.value) return;
    importingImage.value = true;
    try {
      const { renderPdfImage } = await import('@/services/pdfImage');
      const result = await renderPdfImage(pending.document, pdfPage.value);
      const dimensions = await inspectImageAsset(result.blob);
      const name =
        pending.document.numPages > 1
          ? t('imageElement.pdfPageName', { name: pending.context.name, page: pdfPage.value })
          : pending.context.name;
      await placeImage(result.blob, dimensions, { ...pending.context, name }, result);
    } catch {
      if (pending.context.generation === generation)
        ui.addToast(t('imageElement.pdfError'), 'error');
    } finally {
      if (pendingPdf.value === pending) {
        pendingPdf.value = null;
        importingImage.value = false;
        await pending.document.loadingTask.destroy();
      }
    }
  }

  async function importImage(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || importingImage.value || pendingPdf.value) return;
    const view = mapContainer.map.value?.getView();
    if (!view) return;
    const resolution = view.getResolution()!;
    const scale = (resolution * metersPerMapUnit(view.getCenter()!) * 96) / 0.0254;
    const context: ImportContext = {
      projectId: projects.activeProjectId,
      name: file.name,
      resolution,
      // Match the visible scale on tiled maps; image calibration can legitimately
      // have a denominator below 1 and must retain its physical precision.
      denominator: imageMaps.active ? scale : Math.max(1, Math.round(scale)),
      generation: ++generation,
    };
    ui.selectedImageId = null;
    importingImage.value = true;
    const pdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    let saving = false;
    try {
      if (pdf) {
        const { openPdfImage } = await import('@/services/pdfImage');
        const document = await openPdfImage(file);
        if (context.generation !== generation) {
          await document.loadingTask.destroy();
          return;
        }
        pdfPage.value = 1;
        pendingPdf.value = { document, context };
        importingImage.value = false;
        if (document.numPages === 1) await importPdfPage();
      } else {
        const dimensions = await inspectImageAsset(file);
        saving = true;
        await placeImage(file, dimensions, context);
      }
    } catch {
      if (context.generation === generation)
        ui.addToast(
          t(
            pdf
              ? 'imageElement.pdfError'
              : saving
                ? 'imageElement.saveError'
                : 'imageElement.fileError'
          ),
          'error'
        );
    } finally {
      if (context.generation === generation) importingImage.value = false;
    }
  }
  return {
    chooseImage,
    importImage,
    importingImage,
    pendingPdf,
    pdfPage,
    validPdfPage,
    importPdfPage,
    cancelPdf,
  };
}
