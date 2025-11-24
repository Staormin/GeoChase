<template>
  <v-dialog
    v-model="isOpen"
    max-width="500px"
    :persistent="!isLanguageSet"
    @click:outside="isLanguageSet ? closeModal() : undefined"
    @keydown.esc="isLanguageSet ? closeModal() : undefined"
  >
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between">
        <span>{{ $t('language.languageSettings') }}</span>
        <v-btn
          v-if="isLanguageSet"
          icon="mdi-close"
          size="small"
          variant="text"
          @click="closeModal"
        />
      </v-card-title>

      <v-card-text>
        <p class="text-body-2 mb-4">{{ $t('language.selectYourLanguage') }}</p>

        <div class="d-flex flex-column gap-3">
          <v-card
            class="language-card"
            :class="{ selected: selectedLanguage === 'en' }"
            hover
            variant="outlined"
            @click="selectLanguage('en')"
          >
            <v-card-text class="d-flex align-center justify-space-between">
              <div class="d-flex align-center gap-3">
                <div class="text-h4">🇬🇧</div>
                <div>
                  <div class="font-weight-medium">{{ $t('language.english') }}</div>
                  <div class="text-caption text-medium-emphasis">English</div>
                </div>
              </div>
              <v-icon v-if="selectedLanguage === 'en'" color="primary" icon="mdi-check-circle" />
            </v-card-text>
          </v-card>

          <v-card
            class="language-card"
            :class="{ selected: selectedLanguage === 'fr' }"
            hover
            variant="outlined"
            @click="selectLanguage('fr')"
          >
            <v-card-text class="d-flex align-center justify-space-between">
              <div class="d-flex align-center gap-3">
                <div class="text-h4">🇫🇷</div>
                <div>
                  <div class="font-weight-medium">{{ $t('language.french') }}</div>
                  <div class="text-caption text-medium-emphasis">Français</div>
                </div>
              </div>
              <v-icon v-if="selectedLanguage === 'fr'" color="primary" icon="mdi-check-circle" />
            </v-card-text>
          </v-card>
        </div>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn
          color="primary"
          :disabled="!selectedLanguage"
          variant="elevated"
          @click="saveLanguage"
        >
          {{ $t('common.confirm') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { isLanguageSet as checkLanguageSet, setLanguage } from '@/plugins/i18n';
import { useUIStore } from '@/stores/ui';

const uiStore = useUIStore();
const { locale, t } = useI18n();

const isOpen = computed({
  get: () => uiStore.isModalOpen('languageModal'),
  set: (value) => {
    if (value) {
      uiStore.openModal('languageModal');
    } else {
      uiStore.closeModal('languageModal');
    }
  },
});

const selectedLanguage = ref<string>(locale.value);
const isLanguageSet = ref<boolean>(checkLanguageSet());

// Update selectedLanguage when locale changes
watch(locale, (newLocale) => {
  selectedLanguage.value = newLocale;
});

function selectLanguage(lang: string) {
  selectedLanguage.value = lang;
}

function saveLanguage() {
  if (selectedLanguage.value) {
    setLanguage(selectedLanguage.value);
    isLanguageSet.value = true;
    uiStore.addToast(t('language.languageChanged'), 'success', 3000);
    closeModal();
  }
}

function closeModal() {
  if (isLanguageSet.value) {
    uiStore.closeModal('languageModal');
  }
}
</script>

<style scoped>
.language-card {
  cursor: pointer;
  transition: all 0.2s ease;
}

.language-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.language-card.selected {
  border-color: rgb(var(--v-theme-primary));
  background-color: rgba(var(--v-theme-primary), 0.08);
}
</style>
