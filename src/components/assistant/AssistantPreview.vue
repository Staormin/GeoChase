<template>
  <section aria-live="polite" class="assistant-preview" data-testid="assistant-preview">
    <strong>{{ t('assistant.previewTitle') }}</strong>
    <p>{{ text }}</p>

    <ul>
      <li v-for="image in imageEdits" :key="image.id">
        {{ t('assistant.previewPlaceImage', { name: image.name }) }}
      </li>

      <li v-for="edit in edits" :key="edit.id">
        {{
          t(edit.after ? 'assistant.previewEdit' : 'assistant.previewDelete', { name: edit.name })
        }}
      </li>
    </ul>

    <small>{{ t('assistant.previewLegend') }}</small>

    <div class="assistant-preview-actions">
      <v-btn
        color="primary"
        data-testid="assistant-apply"
        :disabled="busy || unavailable"
        @click="emit('confirm')"
        >{{ t('assistant.apply') }}</v-btn
      >

      <v-btn :disabled="busy" variant="text" @click="emit('cancel')">{{
        t('common.cancel')
      }}</v-btn>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { AssistantEdit, AssistantImageEdit } from '@/services/assistant/plan';
import { useI18n } from 'vue-i18n';

defineProps<{
  text: string;
  edits: AssistantEdit[];
  imageEdits: AssistantImageEdit[];
  busy: boolean;
  unavailable: boolean;
}>();
const emit = defineEmits<{ confirm: []; cancel: [] }>();
const { t } = useI18n();
</script>

<style scoped>
.assistant-preview {
  border-left: 3px solid #7c3aed;
  padding: 12px;
  margin-bottom: 12px;
  max-height: 42vh;
  overflow-y: auto;
}
.assistant-preview p,
.assistant-preview ul {
  font-size: 13px;
  margin: 8px 0;
}
.assistant-preview ul {
  padding-left: 18px;
}
.assistant-preview small {
  display: block;
  margin-bottom: 12px;
}
.assistant-preview-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
