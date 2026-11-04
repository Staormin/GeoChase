<template>
  <div
    :aria-label="t('assistant.conversation')"
    aria-live="polite"
    class="assistant-messages"
    role="log"
  >
    <article
      v-for="(message, index) in assistant.messages"
      :key="index"
      class="assistant-message"
      :class="message.role"
    >
      <strong>{{
        t(
          message.role === 'user'
            ? 'assistant.you'
            : message.claude
              ? 'assistant.claude.author'
              : 'assistant.title'
        )
      }}</strong>

      <p>{{ message.text }}</p>

      <div v-if="message.attachments?.length" class="assistant-attachments">
        <span v-for="name in message.attachments" :key="name"
          ><v-icon icon="mdi-paperclip" size="14" />{{ name }}</span
        >
      </div>

      <span v-if="message.count" class="assistant-result"
        ><v-icon icon="mdi-check-circle-outline" size="16" />{{
          t(message.changed ? 'assistant.changed' : 'assistant.created', { count: message.count })
        }}</span
      >

      <div v-if="message.elements?.length" class="assistant-element-links">
        <button
          v-for="element in message.elements"
          :key="element.id"
          :disabled="!currentElement(element)"
          type="button"
          @blur="hover()"
          @click="emit('focus', element)"
          @focus="hover(element)"
          @mouseenter="hover(element)"
          @mouseleave="hover()"
        >
          {{ currentElement(element)?.name ?? element.name }}
        </button>
      </div>

      <div v-if="message.choice" class="assistant-element-links" data-testid="assistant-choices">
        <button
          v-for="element in message.choice.elements"
          :key="element.id"
          :disabled="locked || !currentElement(element)"
          type="button"
          @blur="hover()"
          @click="emit('choose', element, message.choice!.question)"
          @focus="hover(element)"
          @mouseenter="hover(element)"
          @mouseleave="hover()"
        >
          {{ element.name }}
        </button>
      </div>

      <ul v-if="message.sources?.length" class="assistant-sources">
        <li v-for="source in message.sources" :key="source.url">
          <a :href="source.url" rel="noopener noreferrer" target="_blank">{{ source.title }}</a>
        </li>
      </ul>
    </article>

    <article
      v-if="busy && draft"
      class="assistant-message assistant draft"
      data-testid="assistant-draft"
    >
      <strong>{{ t('assistant.title') }}</strong>
      <p>{{ draft }}</p>
    </article>
  </div>

  <div v-if="busy" class="assistant-activity" role="status">
    <v-progress-circular color="primary" indeterminate size="17" width="2" />{{ activityLabel }}
  </div>
</template>

<script setup lang="ts">
import type { AssistantReference } from '@/services/assistant/plan';
import { useI18n } from 'vue-i18n';
import { useAssistantStore } from '@/stores/assistant';
import { useUIStore } from '@/stores/ui';

defineProps<{
  busy: boolean;
  /** Choices are disabled while a request or a preview is in progress. */
  locked: boolean;
  draft: string;
  activityLabel: string;
  currentElement: (ref: AssistantReference) => { name: string } | undefined;
}>();
const emit = defineEmits<{
  focus: [element: AssistantReference];
  choose: [element: AssistantReference, question: string];
}>();
const { t } = useI18n();
const assistant = useAssistantStore();
const ui = useUIStore();

function hover(ref?: AssistantReference) {
  ui.sidebarHoverRequest = ref ? { elementType: ref.type, elementId: ref.id } : null;
}
</script>

<style scoped>
.assistant-messages {
  padding: 0 20px;
}
.assistant-message {
  margin: 20px 0;
  font-size: 14px;
  line-height: 1.65;
  overflow-wrap: anywhere;
}
.assistant-message strong {
  font-size: 12px;
  opacity: 0.65;
}
.assistant-message p {
  white-space: pre-wrap;
  margin-top: 5px;
}
.assistant-message.user {
  padding: 12px 15px;
  border-radius: 12px 12px 3px 12px;
  background: rgba(var(--v-theme-primary), 0.08);
}
.assistant-message.draft p {
  opacity: 0.8;
}
.assistant-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
  font-size: 12px;
}
.assistant-attachments > span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 5px;
  background: rgba(var(--v-theme-on-surface), 0.07);
}
.assistant-result {
  display: flex;
  gap: 6px;
  align-items: center;
  color: rgb(var(--v-theme-primary));
  margin-top: 12px;
  font-size: 12px;
}
.assistant-element-links {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}
.assistant-element-links button {
  color: rgb(var(--v-theme-primary));
  text-decoration: underline;
  text-underline-offset: 3px;
  text-align: left;
  border: 1px solid rgba(var(--v-theme-primary), 0.25);
  border-radius: 5px;
  padding: 4px 8px;
}
.assistant-element-links button:disabled {
  opacity: 0.45;
  cursor: default;
}
.assistant-sources {
  padding-left: 18px;
  margin-top: 12px;
  font-size: 12px;
}
.assistant-sources a {
  color: rgb(var(--v-theme-primary));
}
.assistant-activity {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 16px 24px;
  font-size: 13px;
}
</style>
