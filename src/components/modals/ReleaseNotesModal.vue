<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import rawReleaseNotesEn from '@/data/releaseNotes.en.json';
import rawReleaseNotesFr from '@/data/releaseNotes.fr.json';
import { useUIStore } from '@/stores/ui';

interface Section {
  category: string;
  items: string[];
}

interface ReleaseNote {
  version: string;
  date: string;
  title: string;
  sections: Section[];
}

const { t, locale } = useI18n();
const uiStore = useUIStore();

// Sélection dynamique du fichier JSON selon la langue active ('fr' ou 'en')
const releaseNotesData = computed<ReleaseNote[]>(() => {
  const raw = locale.value === 'en' ? rawReleaseNotesEn : rawReleaseNotesFr;
  return Array.isArray(raw)
    ? (raw as ReleaseNote[])
    : (raw as { default: ReleaseNote[] })?.default || [];
});

const isOpen = computed({
  get: () => uiStore.isModalOpen('releaseNotesModal'),
  set: (val: boolean) => {
    if (!val) closeModal();
  },
});

const autoDisplayEnabled = ref(true);
const isAutoOpened = ref(false);
const displayedNotes = ref<ReleaseNote[]>([]);

function compareVersions(v1: string, v2: string) {
  if (!v1 || !v2) return 0;
  const parts1 = String(v1).split('.').map(Number);
  const parts2 = String(v2).split('.').map(Number);
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

onMounted(() => {
  const savedVersion = localStorage.getItem('lastSeenReleaseNoteVersion');
  const savedAutoDisplay = localStorage.getItem('releaseNotesAutoDisplayEnabled');

  if (savedAutoDisplay !== null) {
    autoDisplayEnabled.value = savedAutoDisplay === 'true';
  }

  const notes = releaseNotesData.value;
  const newestVersion = notes[0]?.version;
  if (!newestVersion) return;

  if (!savedVersion) {
    localStorage.setItem('lastSeenReleaseNoteVersion', newestVersion);
    return;
  }

  if (autoDisplayEnabled.value && compareVersions(newestVersion, savedVersion) > 0) {
    displayedNotes.value = notes.filter(
      (note: ReleaseNote) => compareVersions(note.version, savedVersion) > 0
    );

    if (displayedNotes.value.length > 0) {
      isAutoOpened.value = true;
      uiStore.openModal('releaseNotesModal');
    }
  }
});

watch(isOpen, (newVal) => {
  if (!newVal) {
    isAutoOpened.value = false;
    displayedNotes.value = [];
  }
});

const currentNotesList = computed(() => {
  if (isAutoOpened.value && displayedNotes.value.length > 0) {
    return displayedNotes.value;
  }
  return releaseNotesData.value;
});

function handleToggleAutoDisplay(val: boolean | null) {
  autoDisplayEnabled.value = !val;
  localStorage.setItem('releaseNotesAutoDisplayEnabled', String(autoDisplayEnabled.value));
}

function closeModal() {
  uiStore.closeModal('releaseNotesModal');

  const notes = releaseNotesData.value;
  if (notes.length > 0) {
    const newestVersion = notes[0].version;
    const savedVersion = localStorage.getItem('lastSeenReleaseNoteVersion');

    if (!savedVersion || compareVersions(newestVersion, savedVersion) > 0) {
      localStorage.setItem('lastSeenReleaseNoteVersion', newestVersion);
    }
  }

  isAutoOpened.value = false;
  displayedNotes.value = [];
}
</script>

<template>
  <v-dialog v-model="isOpen" max-width="700px" scrollable>
    <v-card class="rounded-lg" color="surface">
      <!-- En-tête -->
      <v-card-title class="d-flex align-center justify-space-between pa-4 border-b">
        <div class="text-h6 font-weight-bold d-flex align-center gap-2">
          {{ t('releaseNotes.title') }}
        </div>

        <v-btn density="comfortable" icon="mdi-close" variant="text" @click="closeModal"></v-btn>
      </v-card-title>

      <!-- Contenu des nouveautés -->
      <v-card-text class="pa-6" style="max-height: 70vh">
        <template v-if="currentNotesList && currentNotesList.length > 0">
          <div
            v-for="release in currentNotesList"
            :key="release.version"
            class="mb-6 pb-6 border-b last:border-0"
          >
            <div class="d-flex align-baseline justify-space-between mb-1">
              <span class="text-h6 font-weight-bold text-primary">
                {{ t('releaseNotes.version', { version: release.version }) }}
              </span>

              <span class="text-caption text-medium-emphasis">{{ release.date }}</span>
            </div>

            <div class="text-subtitle-1 font-weight-medium mb-4">
              {{ release.title }}
            </div>

            <div v-for="section in release.sections" :key="section.category" class="mb-4">
              <div class="text-overline font-weight-bold text-medium-emphasis mb-1">
                {{ section.category }}
              </div>

              <ul class="pl-4">
                <li v-for="(item, idx) in section.items" :key="idx" class="text-body-2 mb-1">
                  {{ item }}
                </li>
              </ul>
            </div>
          </div>
        </template>

        <div v-else class="text-center py-8 text-medium-emphasis">
          {{ t('releaseNotes.empty') }}
        </div>
      </v-card-text>

      <!-- Pied de modale -->
      <v-divider></v-divider>

      <v-card-actions class="pa-4 d-flex flex-wrap align-center justify-space-between gap-2">
        <v-checkbox
          color="primary"
          density="compact"
          hide-details
          :label="t('releaseNotes.autoDisplay')"
          :model-value="!autoDisplayEnabled"
          @update:model-value="handleToggleAutoDisplay"
        ></v-checkbox>

        <v-btn color="primary" variant="flat" @click="closeModal">
          {{ t('releaseNotes.close') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
