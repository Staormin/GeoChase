<template>
  <div v-if="uiStore.viewCaptureState.isCapturing" class="view-capture-helper">
    <div class="helper-content">
      <v-icon size="24">mdi-camera</v-icon>
      <div class="helper-text">
        <div class="helper-title">
          {{
            uiStore.viewCaptureState.captureType === 'start'
              ? $t('animation.setStartView')
              : $t('animation.setEndView')
          }}
        </div>
        <div class="helper-instructions">
          {{ $t('animation.panAndZoomInstruction') }}
        </div>
        <div class="helper-cancel">{{ $t('animation.pressEscToCancel') }}</div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useUIStore } from '@/stores/ui';

const uiStore = useUIStore();
</script>

<style scoped>
.view-capture-helper {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 2000;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(10px);
  padding: 24px 32px;
  border-radius: 16px;
  border: 2px solid rgba(59, 130, 246, 0.5);
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.1);
  animation: slide-in 0.3s ease-out;
  pointer-events: none;
}

.helper-content {
  display: flex;
  align-items: center;
  gap: 20px;
}

.helper-content > .v-icon {
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
  padding: 12px;
  border-radius: 12px;
}

.helper-text {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.helper-title {
  font-size: 18px;
  font-weight: 700;
  color: #f1f5f9;
  letter-spacing: -0.02em;
}

.helper-instructions {
  font-size: 14px;
  color: #94a3b8;
  line-height: 1.5;
}

.helper-cancel {
  font-size: 13px;
  color: #94a3b8;
  margin-top: 4px;
}

kbd {
  display: inline-block;
  padding: 2px 8px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  font-family: ui-monospace, monospace;
  font-size: 12px;
  font-weight: 600;
  color: #f1f5f9;
}

@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
