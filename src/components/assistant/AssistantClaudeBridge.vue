<template>
  <section
    :aria-label="t('assistant.claude.title')"
    class="assistant-claude"
    data-testid="assistant-claude"
  >
    <h2>{{ t('assistant.claude.title') }}</h2>

    <v-switch
      v-model="assistant.bridgeEnabled"
      color="primary"
      data-testid="assistant-claude-toggle"
      density="compact"
      hide-details
      :label="t('assistant.claude.enable')"
    />

    <p class="assistant-claude-status" data-testid="assistant-claude-status" role="status">
      <v-icon :color="statusColor" icon="mdi-circle" size="10" />
      {{ t(`assistant.claude.${assistant.bridgeState}`) }}
    </p>

    <small v-if="lastAction && assistant.bridgeState === 'connected'">{{
      t('assistant.claude.lastAction', { tool: lastAction })
    }}</small>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAssistantStore } from '@/stores/assistant';

defineProps<{ lastAction: string }>();

const { t } = useI18n();
const assistant = useAssistantStore();
const statusColor = computed(
  () => ({ off: 'grey', connecting: 'warning', connected: 'success' })[assistant.bridgeState]
);
</script>

<style scoped>
.assistant-claude {
  display: grid;
  gap: 10px;
  padding: 22px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.1);
}

.assistant-claude h2 {
  font-size: 17px;
  font-weight: 600;
}

.assistant-claude p,
.assistant-claude small {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.82rem;
}

.assistant-claude-status {
  display: flex;
  align-items: center;
  gap: 6px;
}

@media (max-width: 600px) {
  .assistant-claude {
    padding: 16px;
  }
}
</style>
