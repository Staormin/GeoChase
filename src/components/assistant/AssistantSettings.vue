<template>
  <section :aria-label="t('assistant.settings')" class="assistant-config">
    <h2>{{ t('assistant.connectTitle') }}</h2>
    <p>{{ t('assistant.connectHint') }}</p>

    <v-text-field
      v-model="assistant.settings.apiKey"
      autocomplete="off"
      data-testid="assistant-key"
      density="compact"
      :disabled="locked"
      hide-details
      :label="t('assistant.apiKey')"
      :spellcheck="false"
      type="password"
      variant="outlined"
    />

    <v-select
      v-model="assistant.settings.provider"
      data-testid="assistant-provider"
      density="compact"
      :disabled="locked"
      hide-details
      :items="providers"
      :label="t('assistant.provider')"
      variant="outlined"
    />

    <small>{{ t(detected ? 'assistant.detected' : 'assistant.chooseProvider') }}</small>

    <v-checkbox
      v-model="assistant.remember"
      density="compact"
      :disabled="locked"
      hide-details
      :label="t('assistant.remember')"
    />

    <p class="assistant-privacy">{{ t('assistant.keyPrivacy') }}</p>

    <div class="assistant-config-actions">
      <v-btn
        color="primary"
        data-testid="assistant-connect"
        :disabled="!assistant.settings.apiKey.trim() || busy"
        :loading="connecting"
        @click="emit('connect')"
        >{{ t('assistant.connect') }}</v-btn
      >

      <v-btn :disabled="locked" variant="text" @click="emit('forget')">{{
        t('assistant.forget')
      }}</v-btn>
    </div>

    <div class="assistant-models">
      <v-autocomplete
        v-model="assistant.settings.model"
        data-testid="assistant-model"
        density="compact"
        :disabled="!assistant.connected || locked"
        hide-details
        :items="assistant.models"
        :label="t('assistant.model')"
        variant="outlined"
      />

      <v-select
        v-model="assistant.settings.effort"
        data-testid="assistant-effort"
        density="compact"
        :disabled="!assistant.connected || locked || efforts.length === 1"
        hide-details
        :items="efforts"
        :label="t('assistant.effort')"
        variant="outlined"
      />
    </div>

    <v-btn
      v-if="assistant.connected"
      color="primary"
      data-testid="assistant-settings-done"
      :disabled="connecting || !assistant.models.includes(assistant.settings.model)"
      @click="emit('done')"
      >{{ t('assistant.done') }}</v-btn
    >
  </section>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { AIError, detectProvider, effortOptions } from '@/services/assistant/providers';
import { useAssistantStore } from '@/stores/assistant';

const props = defineProps<{ busy: boolean; connecting: boolean }>();
const emit = defineEmits<{ connect: []; forget: []; done: []; error: [cause: unknown] }>();
const { t } = useI18n();
const assistant = useAssistantStore();
const locked = computed(() => props.busy || props.connecting);
const providers = [
  { title: 'OpenAI', value: 'openai' },
  { title: 'Anthropic', value: 'anthropic' },
  { title: 'Google Gemini', value: 'gemini' },
];
const detected = computed(() => detectProvider(assistant.settings.apiKey));
const efforts = computed(() =>
  effortOptions(assistant.settings.provider, assistant.settings.model).map((value) => ({
    value,
    title: t(`assistant.efforts.${value}`),
  }))
);

function saveSettings() {
  try {
    assistant.save();
  } catch {
    emit('error', new AIError('storage'));
  }
}
watch(
  () => assistant.settings.apiKey,
  (key) => {
    assistant.connected = false;
    const provider = detectProvider(key);
    if (provider) assistant.settings.provider = provider;
  }
);
watch(
  () => assistant.settings.provider,
  () => {
    assistant.disconnect();
    assistant.settings.model = '';
    assistant.settings.effort = 'auto';
  }
);
watch(
  () => assistant.settings.model,
  () => {
    if (
      !effortOptions(assistant.settings.provider, assistant.settings.model).includes(
        assistant.settings.effort
      )
    )
      assistant.settings.effort = 'auto';
    if (assistant.connected) saveSettings();
  }
);
watch(
  () => assistant.settings.effort,
  () => {
    if (assistant.connected) saveSettings();
  }
);
watch(
  () => assistant.remember,
  (value) => {
    if (!value || assistant.connected) saveSettings();
  }
);
</script>

<style scoped>
.assistant-config {
  display: grid;
  gap: 14px;
  padding: 22px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.1);
}
.assistant-config h2 {
  font-size: 19px;
  font-weight: 600;
}
.assistant-config p {
  font-size: 13px;
  line-height: 1.6;
  opacity: 0.75;
}
.assistant-config small,
.assistant-privacy {
  font-size: 12px !important;
}
.assistant-config-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.assistant-models {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 115px;
  gap: 8px;
}
@media (max-width: 480px) {
  .assistant-config {
    padding: 16px;
    gap: 12px;
  }
}
</style>
