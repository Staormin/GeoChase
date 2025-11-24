<template>
  <v-dialog
    v-model="isOpen"
    max-width="600px"
    @click:outside="closeModal"
    @keydown.esc="closeModal"
  >
    <v-card>
      <v-card-title>{{ isEditing ? $t('note.editTitle') : $t('note.title') }}</v-card-title>
      <v-card-text>
        <v-form @submit.prevent="submitForm">
          <v-text-field
            v-model="form.title"
            class="mb-4"
            data-testid="note-title-input"
            density="compact"
            :label="$t('common.name')"
            variant="outlined"
          />

          <v-textarea
            v-model="form.content"
            class="mb-4"
            data-testid="note-content-input"
            density="compact"
            :label="$t('note.content')"
            rows="8"
            variant="outlined"
          />

          <v-select
            v-model="form.linkedElementType"
            class="mb-4"
            clearable
            data-testid="note-link-type-select"
            density="compact"
            item-title="label"
            item-value="value"
            :items="linkOptions"
            :label="$t('note.linkedTo')"
            variant="outlined"
            @update:model-value="handleLinkTypeChange"
          />

          <v-autocomplete
            v-if="form.linkedElementType"
            v-model="form.linkedElementId"
            class="mb-4"
            clearable
            data-testid="note-link-element-select"
            density="compact"
            item-title="name"
            item-value="id"
            :items="availableElements"
            :label="$t('drawing.point')"
            variant="outlined"
          />
        </v-form>
      </v-card-text>

      <v-card-actions>
        <v-btn v-if="isEditing" color="error" data-testid="delete-note-btn" @click="handleDelete">
          {{ $t('common.delete') }}
        </v-btn>
        <v-spacer />
        <v-btn data-testid="cancel-note-btn" @click="closeModal">{{ $t('common.cancel') }}</v-btn>
        <v-btn color="primary" data-testid="submit-note-btn" @click="submitForm">
          {{ isEditing ? $t('common.save') : $t('common.add') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import type { Ref } from 'vue';
import type { NoteElement } from '@/services/storage';
import { v4 as uuidv4 } from 'uuid';
import { computed, inject, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useLayersStore } from '@/stores/layers';
import { useUIStore } from '@/stores/ui';

const uiStore = useUIStore();
const layersStore = useLayersStore();
const { t } = useI18n();

// Inject note tooltips composable (provided as a ref)
const noteTooltipsRef = inject<
  Ref<{
    refreshNoteTooltip: (noteId: string) => void;
    updateNoteTooltips: () => void;
  } | null>
>('noteTooltips');

const form = ref({
  title: '',
  content: '',
  linkedElementType: undefined as 'circle' | 'lineSegment' | 'point' | 'polygon' | undefined,
  linkedElementId: undefined as string | undefined,
});

const isOpen = computed({
  get: () => uiStore.isModalOpen('noteModal'),
  set: (value) => {
    if (!value) {
      closeModal();
    }
  },
});

const isEditing = computed(() => {
  return uiStore.editingElement?.type === 'note';
});

const linkOptions = computed(() => [
  { label: t('common.circle'), value: 'circle' },
  { label: t('common.line'), value: 'lineSegment' },
  { label: t('common.point'), value: 'point' },
]);

const availableElements = computed(() => {
  if (!form.value.linkedElementType) {
    return [];
  }

  switch (form.value.linkedElementType) {
    case 'circle': {
      return layersStore.circles.map((c) => ({ id: c.id, name: c.name }));
    }
    case 'lineSegment': {
      return layersStore.lineSegments.map((l) => ({ id: l.id, name: l.name }));
    }
    case 'point': {
      return layersStore.points.map((p) => ({ id: p.id, name: p.name }));
    }
    default: {
      return [];
    }
  }
});

// Watch for modal opening - pre-fill form with current note data
watch(
  () => isOpen.value,
  (newValue) => {
    if (newValue && uiStore.editingElement?.type === 'note') {
      const note = layersStore.notes.find((n) => n.id === uiStore.editingElement?.id);
      if (note) {
        form.value = {
          title: note.title,
          content: note.content,
          linkedElementType: note.linkedElementType,
          linkedElementId: note.linkedElementId,
        };
      }
    } else if (newValue) {
      // Check if we're creating a note from a context menu with pre-filled element
      const preFillElement = uiStore.notePreFillElement;
      if (preFillElement) {
        form.value.linkedElementType = preFillElement.type;
        form.value.linkedElementId = preFillElement.id;
      }
    }
  },
  { immediate: true }
);

function handleLinkTypeChange() {
  // Clear selected element when type changes
  form.value.linkedElementId = undefined;
}

function submitForm() {
  if (!form.value.title.trim()) {
    uiStore.addToast(t('validation.required'), 'error');
    return;
  }

  const noteData: NoteElement = {
    id: isEditing.value && uiStore.editingElement?.id ? uiStore.editingElement.id : uuidv4(),
    title: form.value.title.trim(),
    content: form.value.content.trim(),
    linkedElementType: form.value.linkedElementType,
    linkedElementId: form.value.linkedElementId,
  };

  if (isEditing.value) {
    layersStore.updateNote(noteData.id, noteData);
    uiStore.addToast(t('note.updated'), 'success');
    uiStore.stopEditing();

    // Refresh the tooltip on the map after Vue updates
    const noteTooltips = noteTooltipsRef?.value;
    if (noteTooltips && noteData.id) {
      nextTick(() => {
        noteTooltips.refreshNoteTooltip(noteData.id);
      });
    }
  } else {
    layersStore.addNote(noteData);
    uiStore.addToast(t('note.created'), 'success');

    // Update tooltips to show the new note after Vue updates
    const noteTooltips = noteTooltipsRef?.value;
    if (noteTooltips) {
      nextTick(() => {
        noteTooltips.updateNoteTooltips();
      });
    }
  }

  closeModal();
  resetForm();
}

function handleDelete() {
  if (!uiStore.editingElement?.id) {
    return;
  }

  if (confirm(t('note.deleted'))) {
    const noteId = uiStore.editingElement.id;
    layersStore.deleteNote(noteId);
    uiStore.addToast(t('note.deleted'), 'success');
    uiStore.stopEditing();

    // Update tooltips to remove the deleted note
    const noteTooltips = noteTooltipsRef?.value;
    if (noteTooltips) {
      noteTooltips.updateNoteTooltips();
    }

    closeModal();
    resetForm();
  }
}

function closeModal() {
  uiStore.closeModal('noteModal');
  uiStore.stopEditing();
  uiStore.clearNotePreFill();
}

function resetForm() {
  form.value = {
    title: '',
    content: '',
    linkedElementType: undefined,
    linkedElementId: undefined,
  };
}
</script>
