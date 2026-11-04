import type { BridgeChanges } from '@/services/assistant/bridge';
import type { AssistantChoice, AssistantReference } from '@/services/assistant/plan';
import type {
  AIAttachment,
  AIProvider,
  AISettings,
  AISource,
} from '@/services/assistant/providers';
import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { LIMITS } from '@/services/assistant/limits';
import { listModels } from '@/services/assistant/providers';
import { isRecord } from '@/utils/guards';
import { useProjectsStore } from './projects';

export interface AssistantMessage {
  role: 'user' | 'assistant';
  text: string;
  sources?: AISource[];
  count?: number;
  changed?: boolean;
  elements?: AssistantReference[];
  choice?: AssistantChoice;
  attachments?: string[];
}
/** One tool call received through the MCP bridge, for the log shown in the panel. */
export interface BridgeLogEntry {
  id: string;
  tool: string;
  /** What the call was about, in a few readable words. */
  input: string;
  at: number;
  status: 'running' | 'done' | 'error';
  error?: string;
  changes?: BridgeChanges;
}
export type BridgeState = 'off' | 'connecting' | 'connected';

const SETTINGS_KEY = 'geochase_assistant_settings';
const SECRET_KEY = 'geochase_assistant_key';
// One conversation per project, kept apart from project data, exports and history.
const CHAT_KEY = 'geochase_assistant_chat_';
const BRIDGE_KEY = 'geochase_claude_bridge';

export const useAssistantStore = defineStore('assistant', () => {
  const projects = useProjectsStore();
  const open = ref(false);
  const settings = ref<AISettings>({ provider: 'openai', apiKey: '', model: '', effort: 'auto' });
  const remember = ref(false);
  const connected = ref(false);
  const models = ref<string[]>([]);
  const messages = ref<AssistantMessage[]>([]);
  // Latest attachments, re-sent with later requests. Kept in memory only: too large to save.
  const rememberedAttachments = ref<AIAttachment[]>([]);
  // Claude bridge: whether this browser accepts commands from the local MCP server.
  const bridgeEnabled = ref(false);
  const bridgeState = ref<BridgeState>('off');
  // Newest first, for this session only.
  const bridgeLog = ref<BridgeLogEntry[]>([]);
  try {
    bridgeEnabled.value = localStorage.getItem(BRIDGE_KEY) === '1';
  } catch {
    /* Storage unavailable: the bridge stays off until enabled for this session. */
  }
  watch(bridgeEnabled, (enabled) => {
    try {
      if (enabled) localStorage.setItem(BRIDGE_KEY, '1');
      else localStorage.removeItem(BRIDGE_KEY);
    } catch {
      /* Session-only setting. */
    }
  });
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    if (isRecord(saved) && ['openai', 'anthropic', 'gemini'].includes(String(saved.provider))) {
      settings.value.provider = saved.provider as AIProvider;
      settings.value.model = typeof saved.model === 'string' ? saved.model : '';
      settings.value.effort = typeof saved.effort === 'string' ? saved.effort : 'auto';
      settings.value.apiKey = localStorage.getItem(SECRET_KEY) || '';
      remember.value = !!settings.value.apiKey;
    }
  } catch {
    /* Storage may be unavailable; session-only usage still works. */
  }

  function save() {
    const { provider, model, effort } = settings.value;
    if (!remember.value) localStorage.removeItem(SECRET_KEY);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ provider, model, effort }));
    if (remember.value) localStorage.setItem(SECRET_KEY, settings.value.apiKey);
  }
  function forget() {
    settings.value.apiKey = '';
    settings.value.model = '';
    remember.value = false;
    connected.value = false;
    models.value = [];
    localStorage.removeItem(SECRET_KEY);
    localStorage.removeItem(SETTINGS_KEY);
  }
  /** Loads the live model catalogue; throws an AIError the caller displays. */
  async function connect(signal: AbortSignal) {
    settings.value.apiKey = settings.value.apiKey.trim();
    connected.value = false;
    const available = await listModels({ ...settings.value }, signal);
    if (signal.aborted) return;
    models.value = available;
    if (!available.includes(settings.value.model)) {
      // Prefer a lightweight model from the live catalogue, never a fixed version.
      settings.value.model =
        available.find((model) => /mini|flash|haiku/.test(model)) || available[0]!;
    }
    connected.value = true;
    save();
  }
  function disconnect() {
    connected.value = false;
    models.value = [];
  }

  function loadConversation(projectId: string | null) {
    messages.value = [];
    rememberedAttachments.value = [];
    if (!projectId) return;
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(CHAT_KEY + projectId) || '[]');
      if (Array.isArray(saved))
        messages.value = saved.filter(
          (m): m is AssistantMessage =>
            isRecord(m) &&
            (m.role === 'user' || m.role === 'assistant') &&
            typeof m.text === 'string'
        );
    } catch {
      /* A corrupt or unavailable history starts a new conversation. */
    }
  }
  function addMessage(message: AssistantMessage) {
    messages.value.push(message);
    if (messages.value.length > LIMITS.savedMessages)
      messages.value.splice(0, messages.value.length - LIMITS.savedMessages);
  }
  function persistConversation() {
    const projectId = projects.activeProjectId;
    if (!projectId) return;
    try {
      if (messages.value.length === 0) localStorage.removeItem(CHAT_KEY + projectId);
      else localStorage.setItem(CHAT_KEY + projectId, JSON.stringify(messages.value));
    } catch {
      /* Storage full: the conversation stays available for this session. */
    }
  }

  loadConversation(projects.activeProjectId);
  watch(() => projects.activeProjectId, loadConversation);
  watch(messages, persistConversation, { deep: true });
  // Only projects that disappear lose their conversation, never those not loaded yet.
  watch(
    () => projects.projects.map((project) => project.id),
    (ids, previous) => {
      for (const id of previous ?? [])
        if (id && !ids.includes(id)) localStorage.removeItem(CHAT_KEY + id);
    }
  );

  function rememberAttachments(files: AIAttachment[]) {
    rememberedAttachments.value = [...rememberedAttachments.value, ...files].slice(
      -LIMITS.rememberedAttachments
    );
  }
  function clearConversation() {
    messages.value = [];
    rememberedAttachments.value = [];
  }

  return {
    open,
    settings,
    remember,
    connected,
    models,
    messages,
    save,
    forget,
    connect,
    disconnect,
    addMessage,
    rememberedAttachments,
    rememberAttachments,
    clearConversation,
    bridgeEnabled,
    bridgeState,
    bridgeLog,
  };
});
