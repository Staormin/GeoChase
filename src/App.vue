<template>
  <v-app>
    <router-view />
  </v-app>
</template>

<script lang="ts" setup>
import { onMounted, watch } from 'vue';
import { isLanguageSet } from '@/plugins/i18n';
import { useProjectsStore } from '@/stores/projects';
import { useUIStore } from '@/stores/ui';

const uiStore = useUIStore();
const projectsStore = useProjectsStore();

let languageModalWasOpen = false;

// Check if language is set on app mount
onMounted(() => {
  if (!isLanguageSet()) {
    // Open language modal if no language is set
    languageModalWasOpen = true;
    uiStore.openModal('languageModal');
  }
});

// Watch for language modal to close, then check if we need to show new project modal
watch(
  () => uiStore.isModalOpen('languageModal'),
  (isOpen, wasOpen) => {
    // If language modal just closed and there are no projects, open new project modal
    if (wasOpen && !isOpen && languageModalWasOpen && projectsStore.projectCount === 0) {
      languageModalWasOpen = false;
      // Small delay to ensure language modal is fully closed
      setTimeout(() => {
        uiStore.openModal('newProjectModal');
      }, 100);
    }
  }
);
</script>
