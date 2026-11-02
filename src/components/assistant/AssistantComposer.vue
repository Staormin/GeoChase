<template>
  <div v-if="selected" class="assistant-selection" data-testid="assistant-selection">
    <span>{{ t('assistant.selection') }}</span>
    <button type="button" @click="emit('focus', selected)">{{ selected.name }}</button>

    <v-btn
      :aria-label="t('assistant.clearSelection')"
      icon="mdi-close"
      size="x-small"
      variant="text"
      @click="ui.selectedMapElement = null"
    />
  </div>

  <form @submit.prevent="submit()">
    <textarea
      ref="input"
      v-model="prompt"
      :aria-label="t('assistant.prompt')"
      data-testid="assistant-prompt"
      :disabled="busy"
      maxlength="4000"
      :placeholder="t('assistant.placeholder')"
      rows="3"
      @keydown.enter.exact.prevent="!$event.isComposing && submit()"
      @paste="pasteFiles"
    />

    <div v-if="attachments.length > 0" class="assistant-attachments">
      <span v-for="(file, index) in attachments" :key="file.name + index"
        ><v-icon icon="mdi-paperclip" size="14" />
        {{ file.name }}
        <button
          :aria-label="t('assistant.removeAttachment', { name: file.name })"
          :disabled="busy"
          type="button"
          @click="attachments.splice(index, 1)"
        >
          <v-icon icon="mdi-close" size="14" /></button
      ></span>
    </div>

    <div
      v-if="assistant.rememberedAttachments.length > 0"
      class="assistant-remembered"
      data-testid="assistant-remembered"
    >
      <v-icon icon="mdi-history" size="14" />

      <span>{{
        t('assistant.rememberedAttachments', { count: assistant.rememberedAttachments.length })
      }}</span>

      <button :disabled="busy" type="button" @click="assistant.rememberedAttachments = []">
        {{ t('assistant.forgetAttachments') }}
      </button>
    </div>

    <div class="assistant-send-row">
      <div class="assistant-attach-actions">
        <v-btn
          :aria-label="t('assistant.attachMap')"
          data-testid="assistant-attach-map"
          :disabled="!canAttach"
          icon="mdi-map-search-outline"
          size="small"
          :title="t('assistant.attachMap')"
          variant="text"
          @click="attach(() => files.captureMap(mapCaptureName()))"
        />

        <v-btn
          v-if="projects.hasPdf()"
          :aria-label="t('assistant.attachPdf')"
          data-testid="assistant-attach-pdf"
          :disabled="!canAttach"
          icon="mdi-file-pdf-box"
          size="small"
          :title="t('assistant.attachPdf')"
          variant="text"
          @click="attach(files.projectPdf)"
        />

        <v-btn
          :aria-label="t('assistant.attachFile')"
          data-testid="assistant-attach-file"
          :disabled="!canAttach"
          icon="mdi-paperclip"
          size="small"
          :title="t('assistant.attachFile')"
          variant="text"
          @click="fileInput?.click()"
        />

        <input
          ref="fileInput"
          :accept="ATTACHMENT_ACCEPT"
          data-testid="assistant-file-input"
          hidden
          type="file"
          @change="attachFile"
        />
      </div>

      <small>{{ t('assistant.sendHint') }}</small>

      <v-btn
        v-if="busy"
        color="primary"
        data-testid="assistant-stop"
        prepend-icon="mdi-stop"
        variant="tonal"
        @click="emit('stop')"
        >{{ t('assistant.stop') }}</v-btn
      >

      <v-btn
        v-else
        color="primary"
        data-testid="assistant-send"
        :disabled="!ready || !prompt.trim()"
        prepend-icon="mdi-arrow-up"
        type="submit"
        >{{ t('assistant.send') }}</v-btn
      >
    </div>
  </form>
</template>

<script setup lang="ts">
import type { AssistantReference } from '@/services/assistant/plan';
import type { AIAttachment } from '@/services/assistant/providers';
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENTS,
  useAssistantAttachments,
} from '@/composables/assistant/useAssistantAttachments';
import { useAssistantStore } from '@/stores/assistant';
import { useProjectsStore } from '@/stores/projects';
import { useUIStore } from '@/stores/ui';

const props = defineProps<{
  busy: boolean;
  /** Connected, with a model, and nothing blocking a request. */
  ready: boolean;
  selected?: AssistantReference;
  /** Resolves false when the request failed, to give the input back. */
  send: (request: string, attachments: AIAttachment[]) => Promise<boolean>;
}>();
const emit = defineEmits<{
  focus: [element: AssistantReference];
  stop: [];
  error: [cause: unknown];
}>();
const { t } = useI18n();
const assistant = useAssistantStore();
const projects = useProjectsStore();
const ui = useUIStore();
const files = useAssistantAttachments();
const prompt = ref('');
const attachments = ref<AIAttachment[]>([]);
const input = ref<HTMLTextAreaElement>();
const fileInput = ref<HTMLInputElement>();
const canAttach = computed(() => !props.busy && attachments.value.length < MAX_ATTACHMENTS);

function mapCaptureName() {
  const count = attachments.value.filter((file) => file.mimeType === 'image/jpeg').length;
  const name = t('assistant.mapCapture');
  return count ? `${name} ${count + 1}` : name;
}
function add(file: AIAttachment) {
  if (attachments.value.length >= MAX_ATTACHMENTS) return;
  attachments.value.push(file);
  void nextTick(() => input.value?.focus());
}
function attach(create: () => AIAttachment) {
  try {
    add(create());
  } catch (error) {
    emit('error', error);
  }
}
async function attachFiles(list: File[]) {
  for (const file of list) {
    try {
      add(await files.readFile(file));
    } catch (error) {
      emit('error', error);
    }
  }
}
async function attachFile(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = '';
  if (file) await attachFiles([file]);
}
/** Pasted files become attachments; pasted text still goes into the field. */
async function pasteFiles(event: ClipboardEvent) {
  const pasted = [...(event.clipboardData?.files ?? [])];
  if (pasted.length === 0 || !canAttach.value) return;
  if (!event.clipboardData?.getData('text/plain')) event.preventDefault();
  // Screenshots arrive as a generic "image.png": give them a recognisable name.
  const name = t('assistant.pastedImage');
  await attachFiles(
    pasted.map((file, index) =>
      file.type.startsWith('image/') && /^image\.\w+$/.test(file.name)
        ? new File(
            [file],
            `${name}${pasted.length > 1 ? ` ${index + 1}` : ''}.${file.name.split('.').pop()}`,
            {
              type: file.type,
            }
          )
        : file
    )
  );
}

async function submit(text = prompt.value) {
  const request = text.trim();
  if (!props.ready || !request || props.busy) return;
  const sent = attachments.value;
  prompt.value = '';
  attachments.value = [];
  if (!(await props.send(request, sent))) {
    prompt.value = request;
    attachments.value = sent;
  }
}

watch(
  () => projects.activeProjectId,
  () => {
    prompt.value = '';
    attachments.value = [];
  }
);

defineExpose({
  focus: () => input.value?.focus(),
  /** Sends a request built by the panel, e.g. a choice from a clarifying question. */
  submit,
});
</script>

<style scoped>
.assistant-selection {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding-bottom: 8px;
}
.assistant-selection > button {
  color: rgb(var(--v-theme-primary));
  text-decoration: underline;
  text-underline-offset: 3px;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
form {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.25);
  border-radius: 12px;
  overflow: hidden;
}
form:focus-within {
  border-color: rgb(var(--v-theme-primary));
}
textarea {
  display: block;
  width: 100%;
  resize: vertical;
  min-height: 72px;
  max-height: 180px;
  padding: 12px;
  outline: none;
  font: inherit;
  font-size: 14px;
  color: rgb(var(--v-theme-on-surface));
}
.assistant-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 12px 0;
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
.assistant-remembered {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px 0;
  font-size: 11px;
  opacity: 0.75;
}
.assistant-remembered button {
  color: rgb(var(--v-theme-primary));
  text-decoration: underline;
}
.assistant-send-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px;
}
.assistant-send-row small {
  font-size: 10px;
  opacity: 0.65;
}
.assistant-attach-actions {
  display: flex;
  gap: 2px;
}
</style>
