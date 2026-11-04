import type { AssistantReference, ProjectContext } from '@/services/assistant/plan';
import type { AIAttachment } from '@/services/assistant/providers';
import type { useLayersStore } from '@/stores/layers';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { PROJECT_PDF } from '@/services/assistant/tools/overlays';
import { useImageMapStore } from '@/stores/imageMap';
import { useProjectsStore } from '@/stores/projects';
import { useUIStore } from '@/stores/ui';

export type LayerSnapshot = ReturnType<ReturnType<typeof useLayersStore>['exportLayers']>;
export type UnavailableReason = '' | 'noProject' | 'imageProject' | 'finishEditing';

/** What the assistant tools see of the open project, shared by chat requests and the Claude bridge. */
export function useAssistantProject(
  currentElement: (ref: Pick<AssistantReference, 'type' | 'id'>) => { name: string } | undefined
) {
  const { t } = useI18n();
  const projects = useProjectsStore();
  const imageMap = useImageMapStore();
  const ui = useUIStore();

  const unavailableReason = computed<UnavailableReason>(() => {
    if (!projects.activeProject) return 'noProject';
    if (imageMap.isImageProject) return 'imageProject';
    return ui.gameMode ||
      ui.tools.activeTool ||
      ui.imageTransformActive ||
      ui.intersectionLineEdit ||
      ui.openModals.size > 0
      ? 'finishEditing'
      : '';
  });
  /** Why requests are blocked right now, or '' when they are allowed. */
  const unavailable = computed(() =>
    unavailableReason.value ? t(`assistant.${unavailableReason.value}`) : ''
  );
  const selected = computed<AssistantReference | undefined>(() => {
    const ref = ui.selectedMapElement;
    if (!ref || !['point', 'lineSegment', 'circle'].includes(ref.elementType)) return;
    const candidate = { type: ref.elementType as AssistantReference['type'], id: ref.elementId };
    const element = currentElement(candidate);
    return element ? { ...candidate, name: element.name } : undefined;
  });

  /** The project PDF, which the tools can turn into an overlay without sending it to the model. */
  function projectDocuments(): AIAttachment[] {
    const pdf = projects.getPdfData();
    if (!pdf || pdf.password) return [];
    const data = pdf.data.includes(',') ? pdf.data.slice(pdf.data.indexOf(',') + 1) : pdf.data;
    return [{ name: PROJECT_PDF, mimeType: 'application/pdf', data }];
  }
  function projectContext(snapshot: LayerSnapshot, recent: AssistantReference[]): ProjectContext {
    return {
      name: projects.activeProject!.name,
      projection: projects.activeProjection,
      selection: selected.value ? [selected.value] : [],
      recent,
      points: snapshot.points,
      circles: snapshot.circles,
      lines: snapshot.lineSegments,
      polygons: snapshot.polygons,
      routes: snapshot.routes ?? [],
      notes: snapshot.notes,
      images: snapshot.images ?? [],
    };
  }

  return { unavailable, unavailableReason, selected, projectDocuments, projectContext };
}
