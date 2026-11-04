<template>
  <section :aria-label="t('assistant.mcp.tab')" class="assistant-mcp" data-testid="assistant-mcp">
    <v-switch
      v-model="assistant.bridgeEnabled"
      color="primary"
      data-testid="assistant-mcp-toggle"
      density="compact"
      hide-details
      :label="t('assistant.mcp.enable')"
    />

    <p class="assistant-mcp-status" data-testid="assistant-mcp-status" role="status">
      <v-icon :color="statusColor" icon="mdi-circle" size="10" />
      {{ t(`assistant.mcp.${assistant.bridgeState}`) }}
    </p>

    <header class="assistant-mcp-log-header">
      <h2>{{ t('assistant.mcp.log') }}</h2>

      <v-btn
        v-if="assistant.bridgeLog.length > 0"
        size="x-small"
        variant="text"
        @click="assistant.bridgeLog = []"
        >{{ t('assistant.mcp.logClear') }}</v-btn
      >
    </header>

    <ol
      v-if="assistant.bridgeLog.length > 0"
      class="assistant-mcp-log"
      data-testid="assistant-mcp-log"
    >
      <li v-for="entry in assistant.bridgeLog" :key="entry.id">
        <v-progress-circular v-if="entry.status === 'running'" indeterminate size="14" width="2" />

        <v-icon
          v-else
          :color="entry.status === 'done' ? 'success' : 'error'"
          :icon="entry.status === 'done' ? 'mdi-check' : 'mdi-alert-circle-outline'"
          size="16"
        />

        <div class="mcp-log-body">
          <div class="mcp-log-title">
            <code>{{ entry.tool }}</code>
            <time>{{ timeOf(entry.at) }}</time>
          </div>

          <p v-if="entry.input">{{ entry.input }}</p>
          <p v-if="entry.error" class="mcp-log-error">{{ entry.error }}</p>
          <p v-if="entry.changes" class="mcp-log-changes">{{ changesOf(entry.changes) }}</p>
        </div>
      </li>
    </ol>

    <p v-else class="assistant-mcp-empty">{{ t('assistant.mcp.logEmpty') }}</p>
  </section>
</template>

<script setup lang="ts">
import type { BridgeChanges } from '@/services/assistant/bridge';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAssistantStore } from '@/stores/assistant';

const { t, locale } = useI18n();
const assistant = useAssistantStore();
const statusColor = computed(
  () => ({ off: 'grey', connecting: 'warning', connected: 'success' })[assistant.bridgeState]
);

function timeOf(at: number) {
  return new Date(at).toLocaleTimeString(locale.value);
}
function changesOf(changes: BridgeChanges) {
  return (['created', 'updated', 'deleted'] as const)
    .filter((kind) => changes[kind] > 0)
    .map((kind) => t(`assistant.mcp.${kind}`, { count: changes[kind] }))
    .join(' · ');
}
</script>

<style scoped>
.assistant-mcp {
  display: grid;
  gap: 8px;
  padding: 16px 18px;
}

.assistant-mcp-status {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 13px;
}

.assistant-mcp-log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 28px;
  margin-top: 12px;
}

.assistant-mcp-log-header h2 {
  font-size: 14px;
  font-weight: 600;
}

.assistant-mcp-log {
  display: grid;
  gap: 2px;
  list-style: none;
}

.assistant-mcp-log li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 7px 0;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.mcp-log-body {
  flex: 1;
  min-width: 0;
  font-size: 12px;
}

.mcp-log-title {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.mcp-log-title code {
  overflow-wrap: anywhere;
  font-size: 12px;
  background: none;
}

.mcp-log-title time,
.assistant-mcp-empty,
.mcp-log-body p {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 12px;
}

.mcp-log-body p {
  overflow-wrap: anywhere;
}

.mcp-log-body .mcp-log-error {
  color: rgb(var(--v-theme-error));
}

.mcp-log-body .mcp-log-changes {
  color: rgb(var(--v-theme-on-surface));
}
</style>
