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
        <!-- Clickable page number / Go to page input -->
        <div v-if="showPageInput" class="d-flex align-center ga-1">
          <input
            ref="pageInputRef"
            v-model="pageInputValue"
            class="text-body-2 text-center bg-surface rounded border"
            :max="totalPages"
            min="1"
            style="width: 40px; outline: none"
            type="number"
            @blur="submitPageInput"
            @keyup.enter="submitPageInput"
            @keyup.escape="cancelPageInput"
          />
          <!-- eslint-disable-next-line @intlify/vue-i18n/no-raw-text -->
          <span class="text-body-2">/ {{ totalPages }}</span>
        </div>
        <!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
        <span
          v-else
          class="text-body-2 px-2 py-1 rounded cursor-pointer hover:bg-surface-variant"
          role="button"
          tabindex="0"
          :title="$t('pdf.goToPage')"
          @click="startPageInput"
          @keyup.enter="startPageInput"
        >
          {{ currentPage }} / {{ totalPages }}
        </span>
        <!-- eslint-enable @intlify/vue-i18n/no-raw-text -->
        <v-btn
          density="compact"
          :disabled="currentPage >= totalPages"
          icon="mdi-chevron-right"
          size="small"
          variant="text"
          @click="nextPage"
        />
      </div>

      <!-- Zoom and action controls -->
      <div class="d-flex align-center ga-1">
        <v-btn density="compact" icon="mdi-minus" size="small" variant="text" @click="zoomOut" />
        <!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
        <span class="text-body-2" style="min-width: 50px; text-align: center">
          {{ Math.round(scale * 100) }}%
        </span>
        <!-- eslint-enable @intlify/vue-i18n/no-raw-text -->
        <v-btn density="compact" icon="mdi-plus" size="small" variant="text" @click="zoomIn" />
        <v-btn
          density="compact"
          icon="mdi-fit-to-page-outline"
          size="small"
          variant="text"
          @click="fitToWidth"
        >
          <v-icon>mdi-fit-to-page-outline</v-icon>
          <v-tooltip activator="parent" location="bottom">{{ $t('pdf.fitToWidth') }}</v-tooltip>
        </v-btn>
        <v-btn
          density="compact"
          icon="mdi-fit-to-screen-outline"
          size="small"
          variant="text"
          @click="fitToPage"
        >
          <v-icon>mdi-fit-to-screen-outline</v-icon>
          <v-tooltip activator="parent" location="bottom">{{ $t('pdf.fitToPage') }}</v-tooltip>
        </v-btn>
        <v-divider class="mx-1" vertical />
        <v-btn
          density="compact"
          icon="mdi-rotate-right"
          size="small"
          variant="text"
          @click="rotateClockwise"
        >
          <v-icon>mdi-rotate-right</v-icon>
          <v-tooltip activator="parent" location="bottom">{{
            $t('pdf.rotateClockwise')
          }}</v-tooltip>
        </v-btn>
        <v-btn
          density="compact"
          icon="mdi-download"
          size="small"
          variant="text"
          @click="downloadPdf"
        >
          <v-icon>mdi-download</v-icon>
          <v-tooltip activator="parent" location="bottom">{{ $t('pdf.download') }}</v-tooltip>
        </v-btn>
        <v-divider class="mx-1" vertical />
        <v-btn
          density="compact"
          :icon="showThumbnails ? 'mdi-view-grid' : 'mdi-view-grid-outline'"
          size="small"
          variant="text"
          @click="showThumbnails = !showThumbnails"
        >
          <v-icon>{{ showThumbnails ? 'mdi-view-grid' : 'mdi-view-grid-outline' }}</v-icon>
          <v-tooltip activator="parent" location="bottom">{{ $t('pdf.thumbnails') }}</v-tooltip>
        </v-btn>
        <v-divider class="mx-1" vertical />
        <v-btn
          color="error"
          density="compact"
          icon="mdi-delete"
          size="small"
          variant="text"
          @click="emit('delete')"
        >
          <v-icon>mdi-delete</v-icon>
          <v-tooltip activator="parent" location="bottom">{{ $t('pdf.delete') }}</v-tooltip>
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

    <!-- PDF content area with optional thumbnails -->
    <div v-else class="flex-grow-1 d-flex overflow-hidden">
      <!-- Thumbnails sidebar (collapsible) -->
      <div
        v-if="showThumbnails"
        ref="thumbnailsContainer"
        class="flex-shrink-0 overflow-y-auto bg-surface-light pa-2"
        style="width: 120px; border-right: 1px solid rgba(0, 0, 0, 0.12)"
      >
        <div
          v-for="pageNum in totalPages"
          :key="pageNum"
          class="mb-2 cursor-pointer rounded overflow-hidden"
          :class="{ 'ring-2 ring-primary': pageNum === currentPage }"
          :title="`${$t('pdf.page')} ${pageNum}`"
          @click="goToPage(pageNum)"
        >
          <canvas
            :ref="(el) => setThumbnailRef(el as HTMLCanvasElement | null, pageNum)"
            class="block w-full"
            style="box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2)"
          />
          <div class="text-center text-caption py-1 bg-surface">{{ pageNum }}</div>
        </div>
      </div>

      <!-- PDF canvas container -->
      <div
        ref="canvasContainer"
        class="flex-grow-1 overflow-auto d-flex justify-center"
        style="background: #525659"
        @scroll="handleScroll"
      >
        <div
          ref="pageContainer"
          class="relative my-4"
          style="box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3)"
          @wheel="handleWheel"
        >
          <canvas ref="pdfCanvas" class="block" />
        </div>
      </div>
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
  pdfName?: string;
}>();

const emit = defineEmits<{
  error: [message: string];
  'password-entered': [password: string];
  loaded: [];
  delete: [];
}>();

const { t } = useI18n();
const uiStore = useUIStore();

const pdfCanvas = ref<HTMLCanvasElement | null>(null);
const canvasContainer = ref<HTMLElement | null>(null);
const pageContainer = ref<HTMLElement | null>(null);
const pageInputRef = ref<HTMLInputElement | null>(null);
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

// Go to page input state
const showPageInput = ref(false);
const pageInputValue = ref('1');

// Rotation state (0, 90, 180, 270 degrees)
const rotation = ref(0);

// Thumbnails state
const showThumbnails = ref(false);
const thumbnailsContainer = ref<HTMLElement | null>(null);
const thumbnailRefs = ref<Map<number, HTMLCanvasElement>>(new Map());
const thumbnailsRendered = ref(false);

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

    // Restore scroll position after PDF is rendered
    await nextTick();
    restoreScrollPosition();

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
    const viewport = currentPageObj.getViewport({ scale: scale.value, rotation: rotation.value });

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

    // Update page container size
    if (pageContainer.value) {
      pageContainer.value.style.width = Math.floor(viewport.width) + 'px';
      pageContainer.value.style.height = Math.floor(viewport.height) + 'px';
    }

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
  const viewport = currentPageObj.getViewport({ scale: 1, rotation: rotation.value });
  // For rotated views, use the appropriate dimension
  const effectiveWidth = rotation.value % 180 === 0 ? viewport.width : viewport.height;
  scale.value = containerWidth / effectiveWidth;
  await renderPage(currentPage.value);
}

async function fitToPage() {
  if (!currentPageObj || !canvasContainer.value) {
    return;
  }

  const containerWidth = canvasContainer.value.clientWidth - 32; // Account for padding
  const containerHeight = canvasContainer.value.clientHeight - 32;
  const viewport = currentPageObj.getViewport({ scale: 1, rotation: rotation.value });

  // Calculate scale to fit both dimensions
  const scaleX = containerWidth / viewport.width;
  const scaleY = containerHeight / viewport.height;
  scale.value = Math.min(scaleX, scaleY);
  await renderPage(currentPage.value);
}

async function rotateClockwise() {
  rotation.value = (rotation.value + 90) % 360;
  await renderPage(currentPage.value);
}

function downloadPdf() {
  try {
    // Create a blob from the base64 data
    const base64Data = props.pdfData.split(',')[1] ?? props.pdfData;
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.codePointAt(i) ?? 0;
    }
    const blob = new Blob([bytes], { type: 'application/pdf' });

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = props.pdfName || 'document.pdf';
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error_) {
    console.error('Error downloading PDF:', error_);
  }
}

// Go to page input functions
function startPageInput() {
  pageInputValue.value = String(currentPage.value);
  showPageInput.value = true;
  nextTick(() => {
    pageInputRef.value?.focus();
    pageInputRef.value?.select();
  });
}

async function submitPageInput() {
  const page = Number.parseInt(pageInputValue.value, 10);
  if (!Number.isNaN(page) && page >= 1 && page <= totalPages.value) {
    currentPage.value = page;
    await renderPage(page);
  }
  showPageInput.value = false;
}

function cancelPageInput() {
  showPageInput.value = false;
}

// Thumbnail functions
function setThumbnailRef(el: HTMLCanvasElement | null, pageNum: number) {
  if (el) {
    thumbnailRefs.value.set(pageNum, el);
    // Render thumbnail if not yet rendered
    if (!thumbnailsRendered.value && pdfDoc) {
      renderThumbnail(pageNum, el);
    }
  } else {
    thumbnailRefs.value.delete(pageNum);
  }
}

async function renderThumbnail(pageNum: number, canvas: HTMLCanvasElement) {
  if (!pdfDoc) {
    return;
  }

  try {
    const page = await pdfDoc.getPage(pageNum);
    const thumbnailScale = 0.2; // Small scale for thumbnails
    const viewport = page.getViewport({ scale: thumbnailScale });

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: context,
      viewport,
      canvas,
    } as Parameters<typeof page.render>[0]).promise;
  } catch (error_) {
    console.error('Error rendering thumbnail:', error_);
  }
}

async function renderAllThumbnails() {
  if (!pdfDoc || thumbnailsRendered.value) {
    return;
  }

  for (const [pageNum, canvas] of thumbnailRefs.value.entries()) {
    await renderThumbnail(pageNum, canvas);
  }
  thumbnailsRendered.value = true;
}

async function goToPage(pageNum: number) {
  if (pageNum >= 1 && pageNum <= totalPages.value) {
    currentPage.value = pageNum;
    await renderPage(pageNum);
  }
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

// Watch for thumbnail panel visibility to render thumbnails
watch(showThumbnails, async (visible) => {
  if (visible && pdfDoc && !thumbnailsRendered.value) {
    // Wait for DOM to update before rendering
    await nextTick();
    await renderAllThumbnails();
  }
});

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

// Handle scroll position persistence
let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
let isRestoringScroll = false; // Flag to prevent infinite loop between scroll handler and watcher
function handleScroll() {
  // Skip saving if we're currently restoring scroll position (prevents infinite loop)
  if (isRestoringScroll) {
    return;
  }
  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
  }
  scrollTimeout = setTimeout(() => {
    if (canvasContainer.value) {
      uiStore.setPdfScrollPosition({
        x: canvasContainer.value.scrollLeft,
        y: canvasContainer.value.scrollTop,
      });
    }
  }, 200);
}

// Handle mouse wheel on page to change pages
let wheelTimeout: ReturnType<typeof setTimeout> | null = null;
let isWheelNavigating = false;
function handleWheel(event: WheelEvent) {
  event.preventDefault();

  // Debounce to prevent too rapid page changes
  if (isWheelNavigating) {
    return;
  }

  if (event.deltaY > 0 && currentPage.value < totalPages.value) {
    // Scroll down - next page
    isWheelNavigating = true;
    nextPage();
  } else if (event.deltaY < 0 && currentPage.value > 1) {
    // Scroll up - previous page
    isWheelNavigating = true;
    prevPage();
  }

  // Reset debounce after a short delay
  if (wheelTimeout) {
    clearTimeout(wheelTimeout);
  }
  wheelTimeout = setTimeout(() => {
    isWheelNavigating = false;
  }, 300);
}

function restoreScrollPosition() {
  if (canvasContainer.value && uiStore.pdfScrollPosition) {
    isRestoringScroll = true;
    canvasContainer.value.scrollLeft = uiStore.pdfScrollPosition.x;
    canvasContainer.value.scrollTop = uiStore.pdfScrollPosition.y;
    // Reset flag after scroll events have been processed
    nextTick(() => {
      isRestoringScroll = false;
    });
  }
}

// Watch for external scroll position changes (e.g., from viewData restore when switching projects)
watch(
  () => uiStore.pdfScrollPosition,
  () => {
    if (pdfDoc && canvasContainer.value) {
      restoreScrollPosition();
    }
  }
);

onMounted(async () => {
  window.addEventListener('resize', handleResize);
  await nextTick();
  loadPdf();
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  // Clear all pending timeouts to prevent memory leaks and errors after unmount
  if (resizeTimeout) {
    clearTimeout(resizeTimeout);
  }
  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
  }
  if (wheelTimeout) {
    clearTimeout(wheelTimeout);
  }
  if (pdfDoc) {
    pdfDoc.destroy();
  }
});
</script>
