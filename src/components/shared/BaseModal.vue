<template>
  <FloatingDialog
    :max-width="maxWidth"
    :model-value="isOpen"
    @keydown.enter="handleEnter"
    @keydown.esc="$emit('close')"
    @update:model-value="!$event && $emit('close')"
  >
    <v-card>
      <v-card-title>{{ title }}</v-card-title>

      <v-card-text>
        <slot />
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn @click="$emit('close')">{{ cancelText }}</v-btn>

        <v-btn color="primary" :disabled="submitDisabled" @click="$emit('submit')">{{
          submitText
        }}</v-btn>
      </v-card-actions>
    </v-card>
  </FloatingDialog>
</template>

<script lang="ts" setup>
import FloatingDialog from '@/components/shared/FloatingDialog.vue';
const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    title: string;
    maxWidth?: string;
    cancelText?: string;
    submitText?: string;
    submitOnEnter?: boolean;
    submitDisabled?: boolean;
  }>(),
  {
    maxWidth: '600px',
    cancelText: 'Cancel',
    submitText: 'Submit',
    submitOnEnter: false,
    submitDisabled: false,
  }
);

const emit = defineEmits<{
  close: [];
  submit: [];
}>();

function handleEnter() {
  if (props.submitOnEnter) {
    emit('submit');
  }
}
</script>
