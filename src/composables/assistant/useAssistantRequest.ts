import type { AssistantPlan, AssistantReference } from '@/services/assistant/plan';
import type { AIAttachment } from '@/services/assistant/providers';
import type { ToolActivity } from '@/services/assistant/tools';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { runAssistant } from '@/services/assistant/agent';
import { changedReferences, needsPreview, visibleChanges } from '@/services/assistant/plan';
import { AIError } from '@/services/assistant/providers';
import { PROJECT_PDF } from '@/services/assistant/tools/overlays';
import { useAssistantStore } from '@/stores/assistant';
import { useHistoryStore } from '@/stores/history';
import { useImageMapStore } from '@/stores/imageMap';
import { useLayersStore } from '@/stores/layers';
import { useProjectsStore } from '@/stores/projects';
import { useUIStore } from '@/stores/ui';
import { useAssistantApply } from './useAssistantApply';
import { useAssistantPreview } from './useAssistantPreview';

type LayerSnapshot = ReturnType<ReturnType<typeof useLayersStore>['exportLayers']>;
interface Pending {
  text: string;
  plan: AssistantPlan;
  snapshot: LayerSnapshot;
  baseline: string;
  projectId: string | null;
  projection: string;
}

const ERROR_KEYS = new Set([
  'auth',
  'quota',
  'model',
  'provider',
  'network',
  'timeout',
  'noModels',
  'response',
  'noSources',
  'limit',
  'changed',
  'storage',
  'capture',
  'attachment',
]);

/** One request at a time: run, preview when needed, apply, and record the answer. */
export function useAssistantRequest() {
  const { t, locale } = useI18n();
  const assistant = useAssistantStore();
  const layers = useLayersStore();
  const projects = useProjectsStore();
  const imageMap = useImageMapStore();
  const ui = useUIStore();
  const history = useHistoryStore();
  const preview = useAssistantPreview();
  const applier = useAssistantApply(preview);

  const busy = ref(false);
  const stopped = ref(false);
  const activity = ref<'thinking' | ToolActivity>('thinking');
  const draft = ref('');
  const errorCode = ref('');
  const pending = ref<Pending>();
  let controller: AbortController | undefined;

  const error = computed(() =>
    errorCode.value
      ? t(`assistant.errors.${ERROR_KEYS.has(errorCode.value) ? errorCode.value : 'response'}`)
      : ''
  );
  function showError(cause: unknown) {
    errorCode.value = cause instanceof AIError ? cause.code : 'response';
  }
  const activityLabel = computed(() =>
    t(
      activity.value === 'thinking'
        ? 'assistant.activityThinking'
        : `assistant.activity${activity.value[0]!.toUpperCase()}${activity.value.slice(1)}`
    )
  );
  /** Why requests are blocked right now, or '' when they are allowed. */
  const unavailable = computed(() =>
    projects.activeProject
      ? imageMap.isImageProject
        ? t('assistant.imageProject')
        : ui.gameMode ||
            ui.tools.activeTool ||
            ui.imageTransformActive ||
            ui.intersectionLineEdit ||
            ui.openModals.size > 0
          ? t('assistant.finishEditing')
          : ''
      : t('assistant.noProject')
  );
  const selected = computed<AssistantReference | undefined>(() => {
    const ref = ui.selectedMapElement;
    if (!ref || !['point', 'lineSegment', 'circle'].includes(ref.elementType)) return;
    const candidate = {
      type: ref.elementType as AssistantReference['type'],
      id: ref.elementId,
      name: '',
    };
    const element = applier.currentElement(candidate);
    return element ? { ...candidate, name: element.name } : undefined;
  });

  /** The project PDF, which the tools can turn into an overlay without sending it to the model. */
  function projectDocuments(): AIAttachment[] {
    const pdf = projects.getPdfData();
    if (!pdf || pdf.password) return [];
    const data = pdf.data.includes(',') ? pdf.data.slice(pdf.data.indexOf(',') + 1) : pdf.data;
    return [{ name: PROJECT_PDF, mimeType: 'application/pdf', data }];
  }
  /** Links for the answer, keeping placements recorded by earlier answers. */
  function answerElements(plan: AssistantPlan): AssistantReference[] {
    return changedReferences(plan).map((ref) => {
      const previous = assistant.messages
        .flatMap((m) => m.elements ?? [])
        .findLast((p) => p.id === ref.id && p.placement);
      return { ...ref, placement: plan.placements[ref.id] ?? previous?.placement };
    });
  }
  function assertUnchanged(data: Pending) {
    if (
      data.projectId !== projects.activeProjectId ||
      data.baseline !== JSON.stringify(layers.exportLayers()) ||
      data.projection !== projects.activeProjection ||
      unavailable.value
    )
      throw new AIError('changed');
  }
  async function apply(data: Pending, confirmed: boolean) {
    assertUnchanged(data);
    await applier.apply(data.plan, data.snapshot);
    assistant.addMessage({
      role: 'assistant',
      text: confirmed ? t('assistant.previewApplied') : data.text,
      sources: data.plan.sources,
      ...visibleChanges(data.plan),
      elements: answerElements(data.plan),
      choice: data.plan.choice,
    });
  }

  /**
   * Returns false when the request failed or stopped, so the caller can restore
   * its input; a request abandoned by a project switch has nothing to restore.
   */
  async function send(request: string, attachments: AIAttachment[]): Promise<boolean> {
    const previous = assistant.messages.slice();
    const projectId = projects.activeProjectId;
    busy.value = true;
    errorCode.value = '';
    stopped.value = false;
    draft.value = '';
    controller = new AbortController();
    const signal = controller.signal;
    assistant.addMessage({
      role: 'user',
      text: request,
      ...(attachments.length > 0 ? { attachments: attachments.map((file) => file.name) } : {}),
    });
    try {
      await history.flush();
      signal.throwIfAborted();
      const baseline = JSON.stringify(layers.exportLayers());
      const projection = projects.activeProjection;
      const snapshot = JSON.parse(baseline) as LayerSnapshot;
      const result = await runAssistant({
        settings: { ...assistant.settings },
        context: {
          name: projects.activeProject!.name,
          projection,
          selection: selected.value ? [selected.value] : [],
          recent: previous
            .flatMap((m) => m.elements ?? [])
            .filter((ref) => !!applier.currentElement(ref))
            .slice(-20),
          points: snapshot.points,
          circles: snapshot.circles,
          lines: snapshot.lineSegments,
          polygons: snapshot.polygons,
          routes: snapshot.routes ?? [],
          notes: snapshot.notes,
          images: snapshot.images ?? [],
        },
        prompt: request,
        attachments,
        earlierAttachments: assistant.rememberedAttachments,
        documents: projectDocuments(),
        conversation: previous,
        locale: locale.value,
        signal,
        onActivity: (value) => {
          if (value === 'thinking') draft.value = '';
          activity.value = value;
        },
        onText: (delta) => {
          draft.value += delta;
        },
      });
      signal.throwIfAborted();
      const data: Pending = { ...result, snapshot, baseline, projectId, projection };
      assertUnchanged(data);
      if (needsPreview(result.plan)) {
        pending.value = data;
        preview.show(result.plan);
      } else await apply(data, false);
      assistant.rememberAttachments(attachments);
      return true;
    } catch (error_) {
      if (projectId !== projects.activeProjectId) return true;
      if (signal.aborted) stopped.value = true;
      else showError(error_);
      // The failed request goes back to the composer; keeping it in the history too
      // would send the same user message twice on the next attempt.
      assistant.messages = previous;
      return false;
    } finally {
      busy.value = false;
      draft.value = '';
      controller = undefined;
    }
  }

  async function confirm() {
    if (!pending.value || busy.value) return;
    busy.value = true;
    try {
      await history.flush();
      await apply(pending.value, true);
    } catch (error_) {
      showError(error_);
    } finally {
      pending.value = undefined;
      preview.clear();
      busy.value = false;
    }
  }
  function cancel() {
    if (pending.value) {
      assistant.addMessage({ role: 'assistant', text: t('assistant.previewCancelled') });
      pending.value = undefined;
    }
    preview.clear();
  }
  function stop() {
    controller?.abort();
  }
  function clear() {
    cancel();
    assistant.clearConversation();
    errorCode.value = '';
    stopped.value = false;
  }
  function focusElement(ref: AssistantReference) {
    const element = applier.currentElement(ref);
    if (!element) return;
    ui.selectedMapElement = { elementType: ref.type, elementId: ref.id };
    ui.mapElementHighlightRequest = { ...ui.selectedMapElement };
    preview.focus(ref, element);
  }

  watch(
    () => projects.activeProjectId,
    () => {
      stop();
      pending.value = undefined;
      preview.clear();
      ui.selectedMapElement = null;
      errorCode.value = '';
      stopped.value = false;
    }
  );
  onBeforeUnmount(stop);

  return {
    busy,
    stopped,
    activityLabel,
    draft,
    error,
    pending,
    unavailable,
    selected,
    currentElement: applier.currentElement,
    showError,
    clearError: () => {
      errorCode.value = '';
    },
    send,
    confirm,
    cancel,
    stop,
    clear,
    focusElement,
  };
}
