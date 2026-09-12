import { fixupPluginRules } from '@eslint/compat';
import vueI18n from '@intlify/eslint-plugin-vue-i18n';
import prettier from 'eslint-config-prettier';
import vuetify from 'eslint-config-vuetify';
import i18nJson from 'eslint-plugin-i18n-json';
import jsonPlugin from 'eslint-plugin-json';
import * as jsoncParser from 'jsonc-eslint-parser';

export default vuetify(
  prettier,
  // Ignore configuration
  {
    ignores: ['.github/**', '*.yml', '*.yaml'],
  },
  // JSON translation file validation
  {
    files: ['src/locales/*.json'],
    languageOptions: {
      parser: jsoncParser,
    },
    plugins: {
      json: jsonPlugin,
      'i18n-json': fixupPluginRules(i18nJson),
    },
    rules: {
      // Ensure all translation keys exist in all locale files
      'i18n-json/identical-keys': [
        'error',
        {
          filePath: {
            'src/locales/en.json': 'src/locales/fr.json',
          },
        },
      ],
      // Ensure translation values are not empty
      'i18n-json/valid-message-syntax': [
        'error',
        {
          syntax: 'non-empty-string',
        },
      ],
      // Ensure keys are sorted alphabetically (helps with merge conflicts)
      'i18n-json/sorted-keys': [
        'warn',
        {
          order: 'asc',
          indentSpaces: 2,
        },
      ],
    },
  },
  // Vue I18n validation for components - override settings and rules
  {
    files: ['src/**/*.vue', 'src/**/*.ts'],
    plugins: {
      '@intlify/vue-i18n': vueI18n,
    },
    settings: {
      'vue-i18n': {
        localeDir: './src/locales/*.json',
        messageSyntaxVersion: '^9.0.0',
      },
    },
    rules: {
      // Check that translation keys used in code exist in translation files
      '@intlify/vue-i18n/no-missing-keys': 'error',
      // Warn about unused translation keys
      '@intlify/vue-i18n/no-unused-keys': [
        'warn',
        {
          extensions: ['.vue', '.ts'],
        },
      ],
      // Configure no-raw-text to ignore icons, emojis, and common symbols
      '@intlify/vue-i18n/no-raw-text': [
        'warn',
        {
          ignoreNodes: ['v-icon', 'svg', 'path', 'circle'],
          ignorePattern: String.raw`^(mdi-[a-z-]+|[▼▶🧭✏️🎯🇬🇧🇫🇷🗂️💾✨📥📄📋←→•():|, \-]+|ESC|ALT|CTRL|GPX| GPX| km| m| m - |km radius|English|Français|)$`,
          ignoreText: [' (GPX)'],
        },
      ],
    },
  },
  {
    files: ['src/**/*.vue'],
    rules: {
      // Vue model update events retain their public model prop names.
      'vue/custom-event-name-casing': ['error', 'kebab-case', { ignores: ['/^update:/u'] }],
    },
  },
  {
    files: ['src/**/*.ts', 'src/**/*.vue'],
    ignores: ['src/**/*.d.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'error' },
  },
  // E2E test files - allow unused fixture parameters
  {
    files: ['tests/e2e/**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^(cleanState|blankProject)$',
        },
      ],
    },
  }
);
