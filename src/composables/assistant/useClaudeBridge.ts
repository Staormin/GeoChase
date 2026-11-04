import type { LayerSnapshot } from './useAssistantProject';
import type { BridgeCall, BridgeResult } from '@/services/assistant/bridge';
import type { AssistantPlan, AssistantReference } from '@/services/assistant/plan';
import { onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { createAssistantExecutor } from '@/services/assistant/agent';
import {
  BRIDGE_PROTOCOL,
  BRIDGE_URL,
  bridgeError,
  bridgeResult,
  bridgeTools,
  CAPTURE_MAP,
  isBridgeTool,
  REDO,
  UNDO,
  uniqueReferences,
} from '@/services/assistant/bridge';
import { createToolMemory } from '@/services/assistant/context';
import { changedReferences, planSize } from '@/services/assistant/plan';
import { AIError, withImages } from '@/services/assistant/providers';
import { useAssistantStore } from '@/stores/assistant';
import { useHistoryStore } from '@/stores/history';
import { useLayersStore } from '@/stores/layers';
import { useProjectsStore } from '@/stores/projects';
import { isRecord } from '@/utils/guards';
import { useMapContext } from '../mapContext';
import { useAssistantApply } from './useAssistantApply';
import { useAssistantAttachments } from './useAssistantAttachments';
import { useAssistantPreview } from './useAssistantPreview';
import { useAssistantProject } from './useAssistantProject';

const RETRY_MS = [1000, 2000, 5000, 10_000];
// Claude reads these, so they stay in English whatever the interface language.
const UNAVAILABLE: Record<string, string> = {
  noProject: 'No project is open in GeoChase. Ask the user to open or create one.',
  imageProject: 'The open project is an image map; the tools only work on map projects.',
  finishEditing:
    'The user is in the middle of a drawing tool or dialog in GeoChase. Ask them to finish it, then retry.',
};
const FAILURES: Record<string, string> = {
  capture: 'The map could not be captured. Ask the user to show the GeoChase window and retry.',
  limit: 'This call exceeds a GeoChase limit. Nothing was applied; split it into smaller calls.',
  storage: 'The browser could not save the changes. Nothing was applied.',
};

/**
 * Lets Claude drive this tab through the local MCP server: each tool call runs
 * against the current project and its changes are applied at once, as one undo step.
 */
export function useClaudeBridge() {
  const { t } = useI18n();
  const assistant = useAssistantStore();
  const layers = useLayersStore();
  const projects = useProjectsStore();
  const history = useHistoryStore();
  const preview = useAssistantPreview();
  const applier = useAssistantApply(preview);
  const attachments = useAssistantAttachments();
  const map = useMapContext();
  const { unavailableReason, projectDocuments, projectContext } = useAssistantProject(
    applier.currentElement
  );

  const lastAction = ref('');
  let socket: WebSocket | undefined;
  let retry = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  // Places found by earlier calls stay usable by later ones, whatever the project.
  const memory = createToolMemory(crypto.randomUUID().slice(0, 8));
  // Calls run one at a time, in order, like a single user at the keyboard.
  let queue: Promise<unknown> = Promise.resolve();
  const running = new Map<string, AbortController>();

  function send(message: object) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }
  function hello() {
    send({ type: 'hello', project: projects.activeProject?.name ?? null, tools: bridgeTools() });
  }

  /** Elements Claude placed earlier in this project, for "it" and "the other one". */
  function recent(): AssistantReference[] {
    return uniqueReferences(
      assistant.messages
        .flatMap((m) => m.elements ?? [])
        .filter((ref) => !!applier.currentElement(ref))
    );
  }

  /** A capture right after a change would catch the zoom animation and unloaded tiles. */
  async function mapSettled(signal: AbortSignal): Promise<boolean> {
    const olMap = map.map.value;
    if (!olMap) return false;
    for (let waited = 0; olMap.getView().getAnimating() && waited < 5000; waited += 100)
      await new Promise((resolve) => setTimeout(resolve, 100));
    signal.throwIfAborted();
    // A tab in the background doesn't draw, so this never completes there.
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), 5000);
      olMap.once('rendercomplete', () => {
        clearTimeout(timer);
        resolve(true);
      });
      olMap.render();
    });
  }

  async function historyStep(call: BridgeCall): Promise<BridgeResult> {
    const undo = call.name === UNDO;
    if (!(undo ? history.canUndo : history.canRedo))
      return bridgeError(call.id, `There is nothing to ${call.name}.`);
    if (undo) history.undo();
    else history.redo();
    await history.flush();
    lastAction.value = call.name;
    return bridgeResult(call.id, {
      status: undo ? 'undone' : 'redone',
      undo_steps: history.undoCount,
      redo_steps: history.redoCount,
    });
  }

  async function run(call: BridgeCall, signal: AbortSignal): Promise<BridgeResult> {
    if (!isBridgeTool(call.name)) return bridgeError(call.id, `Unknown tool ${call.name}`);
    const reason = unavailableReason.value;
    if (reason) return bridgeError(call.id, UNAVAILABLE[reason]!);
    if (call.name === CAPTURE_MAP) {
      const settled = await mapSettled(signal);
      const capture = attachments.captureMap('map.jpg');
      const warning = settled
        ? {}
        : {
            warning:
              'The map had not finished drawing, so the basemap may be missing. Ask the user to bring the GeoChase tab to the front.',
          };
      return bridgeResult(call.id, withImages({ map: capture.description, ...warning }, [capture]));
    }
    await history.flush();
    if (call.name === UNDO || call.name === REDO) return historyStep(call);
    // Plain copies: the store's reactive arrays cannot be cloned, and tools must not touch them.
    const baseline = JSON.stringify(layers.exportLayers());
    const snapshot = JSON.parse(baseline) as LayerSnapshot;
    const executor = createAssistantExecutor(
      projectContext(JSON.parse(baseline) as LayerSnapshot, recent()),
      { ...assistant.settings },
      signal,
      projectDocuments(),
      memory
    );
    const output = await executor.execute(call.name, call.input);
    signal.throwIfAborted();
    // The user may have edited the map while a slow lookup ran: never apply on top of it.
    if (JSON.stringify(layers.exportLayers()) !== baseline || unavailableReason.value)
      return bridgeError(
        call.id,
        'The project changed while the tool ran. Nothing was applied; retry.'
      );
    await apply(call.name, executor.plan, snapshot);
    return bridgeResult(call.id, output, executor.plan);
  }

  async function apply(tool: string, plan: AssistantPlan, snapshot: LayerSnapshot) {
    const effects = plan.effects.focus || plan.effects.exportGpx;
    if (planSize(plan) === 0 && !effects) return;
    await applier.apply(plan, snapshot);
    lastAction.value = tool;
    if (planSize(plan) > 0) summarize(tool, plan);
  }

  /** Claude's calls share one message, so a session cannot push the conversation out of history. */
  function summarize(tool: string, plan: AssistantPlan) {
    const last = assistant.messages.at(-1);
    const previous = last?.claude ? last : undefined;
    const count = (previous?.claudeChanges ?? 0) + planSize(plan);
    const message = {
      role: 'assistant' as const,
      claude: true,
      claudeChanges: count,
      text: t('assistant.claude.applied', { tool, count }),
      elements: uniqueReferences([...(previous?.elements ?? []), ...changedReferences(plan)]),
      sources: [...(previous?.sources ?? []), ...plan.sources],
    };
    if (previous) assistant.messages[assistant.messages.length - 1] = message;
    else assistant.addMessage(message);
  }

  function handle(message: unknown) {
    if (!isRecord(message)) return;
    if (message.type === 'cancel') running.get(String(message.id))?.abort();
    if (message.type !== 'call' || typeof message.id !== 'string') return;
    const call = message as unknown as BridgeCall;
    const controller = new AbortController();
    running.set(call.id, controller);
    queue = queue.then(async () => {
      let result: BridgeResult;
      // A cancelled call that never settles must not hold back the ones after it.
      const cancelled = new Promise<never>((_, reject) =>
        controller.signal.addEventListener('abort', () => reject(new Error('Cancelled.')), {
          once: true,
        })
      );
      try {
        result = await Promise.race([run(call, controller.signal), cancelled]);
      } catch (error) {
        result = bridgeError(
          call.id,
          controller.signal.aborted
            ? 'Cancelled.'
            : error instanceof AIError
              ? (FAILURES[error.code] ?? `The tool failed (${error.code}).`)
              : error instanceof Error
                ? error.message
                : 'The tool failed.'
        );
      }
      running.delete(call.id);
      send(result);
    });
  }

  function connect() {
    clearTimeout(retryTimer);
    if (!assistant.bridgeEnabled || socket) return;
    assistant.bridgeState = 'connecting';
    let opened = false;
    try {
      socket = new WebSocket(BRIDGE_URL, BRIDGE_PROTOCOL);
    } catch {
      socket = undefined;
      scheduleRetry();
      return;
    }
    socket.addEventListener('open', () => {
      opened = true;
      retry = 0;
      assistant.bridgeState = 'connected';
      hello();
    });
    socket.addEventListener('message', (event) => {
      try {
        handle(JSON.parse(String(event.data)));
      } catch {
        /* Not a bridge message. */
      }
    });
    socket.addEventListener('close', () => {
      socket = undefined;
      for (const controller of running.values()) controller.abort();
      running.clear();
      if (!opened) retry = Math.min(retry + 1, RETRY_MS.length - 1);
      scheduleRetry();
    });
  }
  /** The server starts with Claude, maybe after this tab: keep trying while enabled. */
  function scheduleRetry() {
    if (!assistant.bridgeEnabled) {
      assistant.bridgeState = 'off';
      return;
    }
    assistant.bridgeState = 'connecting';
    retryTimer = setTimeout(connect, RETRY_MS[retry]);
  }
  function disconnect() {
    clearTimeout(retryTimer);
    socket?.close();
    socket = undefined;
    assistant.bridgeState = 'off';
  }

  watch(
    () => assistant.bridgeEnabled,
    (enabled) => (enabled ? connect() : disconnect()),
    { immediate: true }
  );
  watch(
    () => projects.activeProjectId,
    () => {
      for (const controller of running.values()) controller.abort();
      lastAction.value = '';
      hello();
    }
  );
  onBeforeUnmount(disconnect);

  return { lastAction };
}
