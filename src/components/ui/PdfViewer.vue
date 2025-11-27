<template>
  <div class="pdf-viewer d-flex flex-column h-100">
    <!-- Toolbar -->
    <div class="d-flex align-center justify-space-between px-3 py-2 bg-surface-light">
      <!-- Page navigation -->
      <div class="d-flex align-center ga-2">
        <v-btn
          density="compact"
          :disabled="currentPage <= 1"
          icon="mdi-chevron-left"
          size="small"
          variant="text"
          @click="prevPage"
        />
        <span class="text-body-2"> {{ currentPage }} / {{ totalPages }} </span>
        <v-btn
          density="compact"
          :disabled="currentPage >= totalPages"
          icon="mdi-chevron-right"
          size="small"
          variant="text"
          @click="nextPage"
        />
      </div>

      <!-- Zoom controls -->
      <div class="d-flex align-center ga-2">
        <v-btn density="compact" icon="mdi-minus" size="small" variant="text" @click="zoomOut" />
        <span class="text-body-2" style="min-width: 50px; text-align: center">
          {{ Math.round(scale * 100) }}%
        </span>
        <v-btn density="compact" icon="mdi-plus" size="small" variant="text" @click="zoomIn" />
        <v-btn
          density="compact"
          icon="mdi-fit-to-page"
          size="small"
          variant="text"
          @click="fitToWidth"
        >
          <v-icon>mdi-fit-to-page</v-icon>
          <v-tooltip activator="parent" location="bottom">{{ $t('pdf.fitToWidth') }}</v-tooltip>
        </v-btn>
      </div>
    </div>

    <v-divider />

    <!-- Password dialog -->
    <v-dialog v-model="showPasswordDialog" max-width="400" persistent>
      <v-card>
        <v-card-title>{{ $t('pdf.passwordRequired') }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="password"
            autofocus
            :error-messages="passwordError"
            :label="$t('pdf.enterPassword')"
            type="password"
            variant="outlined"
            @keyup.enter="submitPassword"
          />
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer />
          <v-btn variant="text" @click="cancelPassword">{{ $t('common.cancel') }}</v-btn>
          <v-btn color="primary" variant="flat" @click="submitPassword">{{
            $t('common.ok')
          }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Loading state -->
    <div v-if="loading" class="flex-grow-1 d-flex align-center justify-center">
      <v-progress-circular indeterminate size="48" />
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="flex-grow-1 d-flex flex-column align-center justify-center pa-4">
      <v-icon class="mb-2" color="error" size="48">mdi-alert-circle</v-icon>
      <p class="text-body-1 text-error text-center">{{ error }}</p>
    </div>

    <!-- PDF canvas container -->
    <div
      v-else
      ref="canvasContainer"
      class="flex-grow-1 overflow-auto d-flex justify-center"
      style="background: #525659"
    >
      <canvas ref="pdfCanvas" class="my-4" style="box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3)" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import * as pdfjsLib from 'pdfjs-dist';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useUIStore } from '@/stores/ui';

// Set up the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const props = defineProps<{
  pdfData: string;
  pdfPassword?: string;
}>();

const emit = defineEmits<{
  error: [message: string];
  'password-entered': [password: string];
  loaded: [];
}>();

const { t } = useI18n();
const uiStore = useUIStore();

const pdfCanvas = ref<HTMLCanvasElement | null>(null);
const canvasContainer = ref<HTMLElement | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const currentPage = computed({
  get: () => uiStore.pdfCurrentPage,
  set: (value: number) => uiStore.setPdfCurrentPage(value),
});
const totalPages = ref(0);
const scale = computed({
  get: () => uiStore.pdfZoomLevel,
  set: (value: number) => uiStore.setPdfZoomLevel(value),
});

const showPasswordDialog = ref(false);
const password = ref('');
const passwordError = ref('');
let pendingPasswordResolve: ((value: string) => void) | null = null;
let pendingPasswordReject: (() => void) | null = null;

let pdfDoc: PDFDocumentProxy | null = null;
let currentPageObj: PDFPageProxy | null = null;

async function loadPdf() {
  loading.value = true;
  error.value = null;

  try {
    // Extract base64 data from data URL
    const base64Data = props.pdfData.split(',')[1] ?? props.pdfData;
    const loadingTask = pdfjsLib.getDocument({
      data: atob(base64Data),
      password: props.pdfPassword, // Use saved password from props
    });

    loadingTask.onPassword = (updateCallback: (password: string) => void, reason: number) => {
      // reason: 1 = need password, 2 = incorrect password
      showPasswordDialog.value = true;
      passwordError.value = reason === 2 ? t('pdf.incorrectPassword') : '';

      pendingPasswordResolve = (pwd: string) => {
        showPasswordDialog.value = false;
        passwordError.value = '';
        password.value = '';
        updateCallback(pwd);
      };

      pendingPasswordReject = () => {
        showPasswordDialog.value = false;
        passwordError.value = '';
        password.value = '';
        loadingTask.destroy();
        error.value = t('pdf.passwordCancelled');
        loading.value = false;
      };
    };

    pdfDoc = await loadingTask.promise;
    totalPages.value = pdfDoc.numPages;

    // Use stored page if valid, otherwise reset to 1
    const storedPage = uiStore.pdfCurrentPage;
    const validPage = storedPage >= 1 && storedPage <= pdfDoc.numPages ? storedPage : 1;
    currentPage.value = validPage;

    // Set loading to false first so the canvas is rendered in the DOM
    loading.value = false;
    // Wait for Vue to update the DOM before rendering
    await nextTick();
    await renderPage(validPage);

    emit('loaded');
  } catch (error_) {
    const errorMessage = error_ instanceof Error ? error_.message : 'Unknown error';
    error.value = errorMessage.includes('password')
      ? t('pdf.passwordRequired')
      : t('pdf.loadError') + ': ' + errorMessage;
    emit('error', error.value);
    loading.value = false;
  }
}

function submitPassword() {
  if (pendingPasswordResolve && password.value) {
    const enteredPwd = password.value;
    pendingPasswordResolve(enteredPwd);
    pendingPasswordResolve = null;
    pendingPasswordReject = null;
    // Emit immediately so the password gets saved
    emit('password-entered', enteredPwd);
  }
}

function cancelPassword() {
  if (pendingPasswordReject) {
    pendingPasswordReject();
    pendingPasswordResolve = null;
    pendingPasswordReject = null;
  }
}

async function renderPage(pageNum: number) {
  if (!pdfDoc || !pdfCanvas.value) {
    return;
  }

  try {
    currentPageObj = await pdfDoc.getPage(pageNum);
    const viewport = currentPageObj.getViewport({ scale: scale.value });

    const canvas = pdfCanvas.value;
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    // Handle high-DPI displays
    const outputScale = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = Math.floor(viewport.width) + 'px';
    canvas.style.height = Math.floor(viewport.height) + 'px';

    context.scale(outputScale, outputScale);

    // Use type assertion for pdfjs-dist render parameters
    await currentPageObj.render({
      canvasContext: context,
      viewport,
      canvas,
    } as Parameters<typeof currentPageObj.render>[0]).promise;
  } catch (error_) {
    console.error('Error rendering page:', error_);
  }
}

async function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--;
    await renderPage(currentPage.value);
  }
}

async function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
    await renderPage(currentPage.value);
  }
}

async function zoomIn() {
  scale.value = Math.min(scale.value + 0.25, 3);
  await renderPage(currentPage.value);
}

async function zoomOut() {
  scale.value = Math.max(scale.value - 0.25, 0.5);
  await renderPage(currentPage.value);
}

async function fitToWidth() {
  if (!currentPageObj || !canvasContainer.value) {
    return;
  }

  const containerWidth = canvasContainer.value.clientWidth - 32; // Account for padding
  const viewport = currentPageObj.getViewport({ scale: 1 });
  scale.value = containerWidth / viewport.width;
  await renderPage(currentPage.value);
}

// Watch for PDF data changes
watch(
  () => props.pdfData,
  () => {
    loadPdf();
  }
);

// Watch for external page changes (e.g., from viewData restore when switching projects)
watch(
  () => uiStore.pdfCurrentPage,
  async (newPage) => {
    if (pdfDoc && newPage >= 1 && newPage <= totalPages.value) {
      await renderPage(newPage);
    }
  }
);

// Watch for external zoom level changes (e.g., from viewData restore when switching projects)
watch(
  () => uiStore.pdfZoomLevel,
  async () => {
    if (pdfDoc && currentPage.value >= 1 && currentPage.value <= totalPages.value) {
      await renderPage(currentPage.value);
    }
  }
);

// Handle window resize
let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
function handleResize() {
  if (resizeTimeout) {
    clearTimeout(resizeTimeout);
  }
  resizeTimeout = setTimeout(() => {
    if (currentPageObj) {
      renderPage(currentPage.value);
    }
  }, 200);
}

onMounted(async () => {
  window.addEventListener('resize', handleResize);
  await nextTick();
  loadPdf();
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  if (pdfDoc) {
    pdfDoc.destroy();
  }
});
</script>
