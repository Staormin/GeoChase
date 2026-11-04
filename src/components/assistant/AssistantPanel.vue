<template>
  <v-navigation-drawer
    v-model="assistant.open"
    class="assistant-panel"
    data-testid="assistant-panel"
    location="right"
    :scrim="false"
    temporary
    :width="panelWidth"
  >
    <!-- Closed drawers stay mounted in the DOM: render the content only when open. -->
    <div v-if="assistant.open" class="assistant-shell">
      <header class="assistant-header">
        <span class="assistant-emblem"><v-icon icon="mdi-auto-fix" size="23" /></span>

        <div class="assistant-heading">
          <strong>{{ t('assistant.title') }}</strong>
        </div>

        <v-btn
          v-if="tab === 'assistant'"
          :aria-label="t('assistant.settings')"
          :disabled="request.busy.value"
          icon="mdi-tune-variant"
          size="small"
          variant="text"
          @click="configOpen = !configOpen"
        />

        <v-btn
          :aria-label="t('common.close')"
          icon="mdi-close"
          size="small"
          variant="text"
          @click="assistant.open = false"
        />
      </header>

      <v-tabs v-model="tab" class="assistant-tabs" color="primary" density="compact" grow>
        <v-tab data-testid="assistant-tab-chat" value="assistant">{{ t('assistant.title') }}</v-tab>
        <v-tab data-testid="assistant-tab-mcp" value="mcp">{{ t('assistant.mcp.tab') }}</v-tab>
      </v-tabs>

      <div ref="scrollArea" class="assistant-scroll">
        <AssistantMcp v-if="tab === 'mcp'" />

        <AssistantSettings
          v-else-if="configOpen || !assistant.connected"
          :busy="request.busy.value"
          :connecting="connecting"
          @connect="connect"
          @done="finishSettings"
          @error="request.showError"
          @forget="forget"
        />

        <template v-else>
          <v-alert
            v-if="request.unavailable.value"
            class="ma-4"
            density="compact"
            type="info"
            variant="tonal"
            >{{ request.unavailable.value }}</v-alert
          >

          <AssistantMessages
            :activity-label="request.activityLabel.value"
            :busy="request.busy.value"
            :current-element="request.currentElement"
            :draft="request.draft.value"
            :locked="request.busy.value || !!request.pending.value"
            @choose="choose"
            @focus="request.focusElement"
          />
        </template>

        <v-alert
          v-if="tab === 'assistant' && request.error.value"
          class="ma-4"
          data-testid="assistant-error"
          density="compact"
          type="error"
          variant="tonal"
          >{{ request.error.value }}</v-alert
        >

        <p
          v-if="tab === 'assistant' && request.stopped.value && !configOpen"
          class="assistant-stopped"
          role="status"
        >
          {{ t('assistant.stopped') }}
        </p>
      </div>

      <footer
        v-if="tab === 'assistant' && assistant.connected && !configOpen"
        class="assistant-footer"
      >
        <div v-if="assistant.messages.length > 0" class="assistant-conversation-actions">
          <v-btn
            :disabled="request.busy.value || !history.canUndo"
            prepend-icon="mdi-undo"
            size="small"
            variant="text"
            @click="history.undo()"
            >{{ t('history.undo') }}</v-btn
          >

          <v-btn
            :disabled="request.busy.value"
            size="small"
            variant="text"
            @click="request.clear"
            >{{ t('assistant.clear') }}</v-btn
          >
        </div>

        <AssistantPreview
          v-if="request.pending.value"
          :busy="request.busy.value"
          :edits="request.pending.value.plan.edits"
          :image-edits="request.pending.value.plan.imageEdits"
          :text="request.pending.value.text"
          :unavailable="!!request.unavailable.value"
          @cancel="request.cancel"
          @confirm="request.confirm"
        />

        <AssistantComposer
          v-else
          ref="composer"
          :busy="request.busy.value"
          :ready="ready"
          :selected="request.selected.value"
          :send="request.send"
          @error="request.showError"
          @focus="request.focusElement"
          @stop="request.stop"
        />
      </footer>
    </div>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import type { AssistantReference } from '@/services/assistant/plan';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDisplay } from 'vuetify';
import AssistantComposer from '@/components/assistant/AssistantComposer.vue';
import { useAssistantRequest } from '@/composables/assistant/useAssistantRequest';
import { useClaudeBridge } from '@/composables/assistant/useClaudeBridge';
import { AIError } from '@/services/assistant/providers';
import { useAssistantStore } from '@/stores/assistant';
import { useHistoryStore } from '@/stores/history';

const { t } = useI18n();
const { width } = useDisplay();
const panelWidth = computed(() => Math.min(440, width.value));
const assistant = useAssistantStore();
const history = useHistoryStore();
const request = useAssistantRequest();
// Lives with the panel, which stays mounted while closed, so Claude can work with it hidden.
useClaudeBridge();
const tab = ref<'assistant' | 'mcp'>('assistant');
const configOpen = ref(!assistant.settings.apiKey);
const connecting = ref(false);
const scrollArea = ref<HTMLElement>();
const composer = ref<InstanceType<typeof AssistantComposer>>();
let connection: AbortController | undefined;

const ready = computed(
  () =>
    assistant.connected &&
    assistant.models.includes(assistant.settings.model) &&
    !request.pending.value &&
    !connecting.value &&
    !request.unavailable.value
);

async function connect() {
  if (connecting.value || request.busy.value || !assistant.settings.apiKey.trim()) return;
  request.clearError();
  connecting.value = true;
  connection = new AbortController();
  try {
    await assistant.connect(connection.signal);
  } catch (error) {
    if (!connection.signal.aborted) request.showError(error);
  } finally {
    connecting.value = false;
  }
}
function forget() {
  try {
    assistant.forget();
  } catch {
    request.showError(new AIError('storage'));
  }
  configOpen.value = true;
}
async function finishSettings() {
  if (connecting.value || !assistant.models.includes(assistant.settings.model)) return;
  configOpen.value = false;
  await nextTick();
  composer.value?.focus();
}
function choose(element: AssistantReference, question: string) {
  request.focusElement(element);
  void composer.value?.submit(`${question} ${element.name}`);
}

watch(
  () => assistant.open,
  async (open) => {
    if (open) {
      if (assistant.settings.apiKey && !assistant.connected) await connect();
      await nextTick();
      composer.value?.focus();
    } else {
      request.stop();
      request.cancel();
      connection?.abort();
    }
  }
);
watch(
  [() => assistant.messages, request.busy, request.error, request.activityLabel, request.draft],
  async () => {
    await nextTick();
    scrollArea.value?.scrollTo({ top: scrollArea.value.scrollHeight });
  },
  { deep: true }
);
onBeforeUnmount(() => connection?.abort());
</script>

<style scoped>
.assistant-panel {
  z-index: 1100 !important;
  border-left: 1px solid rgba(var(--v-theme-on-surface), 0.14);
  box-shadow: -8px 0 32px #00000012;
}
.assistant-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgb(var(--v-theme-surface));
}
.assistant-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 14px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.1);
}
.assistant-emblem {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.12);
}
.assistant-heading {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}
.assistant-heading strong {
  font-size: 17px;
}
.assistant-tabs {
  flex: none;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.1);
}
.assistant-scroll {
  flex: 1;
  overflow: auto;
  min-height: 0;
  overscroll-behavior: contain;
}
.assistant-stopped {
  padding: 16px 24px;
  font-size: 13px;
}
.assistant-footer {
  padding: 12px 18px 16px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}
.assistant-conversation-actions {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}
@media (max-width: 480px) {
  .assistant-header {
    padding: 12px;
  }
  .assistant-footer {
    padding: 10px 12px;
  }
}
</style>
