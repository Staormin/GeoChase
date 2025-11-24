<template>
  <!-- Navigation Mode -->
  <div v-if="uiStore.navigatingElement" class="navigation-bar">
    <div class="navigation-bar-content">
      <div class="navigation-instructions">
        <span class="navigation-icon">🧭</span>
        <span class="navigation-text">
          {{ $t('navigation.useArrowKeys') }} <strong>← →</strong>
          {{ $t('navigation.arrowKeysToNavigate') }} • {{ $t('navigation.pressEsc') }}
          <strong>ESC</strong> {{ $t('navigation.toExit') }}
        </span>
      </div>
      <button class="navigation-exit-btn" type="button" @click="handleExitNavigation">
        {{ $t('navigation.exitNavigation') }}
      </button>
    </div>
  </div>

  <!-- Free Hand Drawing Mode -->
  <div v-else-if="uiStore.freeHandDrawing.isDrawing" class="navigation-bar">
    <div class="navigation-bar-content">
      <div class="navigation-instructions">
        <span class="navigation-icon">✏️</span>
        <span class="navigation-text">
          <template v-if="!uiStore.freeHandDrawing.startCoord">
            {{ $t('freehand.clickToSetStart') }}
          </template>
          <template v-else>
            {{ $t('freehand.moveToSetEndpoint') }} • {{ $t('freehand.clickToConfirm') }}
          </template>
          <template v-if="uiStore.freeHandDrawing.azimuth === undefined">
            • {{ $t('freehand.holdAlt') }} <strong>ALT</strong> {{ $t('freehand.toLockAzimuth') }} •
            {{ $t('freehand.holdCtrl') }} <strong>CTRL</strong> {{ $t('freehand.toLockDistance') }}
          </template>
          • {{ $t('freehand.pressEsc') }} <strong>ESC</strong> {{ $t('freehand.toCancel') }}
        </span>
      </div>
      <button class="navigation-exit-btn" type="button" @click="handleExitFreeHand">
        {{ $t('freehand.cancelDrawing') }}
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useUIStore } from '@/stores/ui';

const uiStore = useUIStore();

function handleExitNavigation(): void {
  uiStore.stopNavigating();
}

function handleExitFreeHand(): void {
  uiStore.stopFreeHandDrawing();
}
</script>

<style scoped>
.navigation-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: rgb(var(--v-theme-primary));
  border-bottom: none;
  padding: 12px 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.navigation-bar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  max-width: 1200px;
  width: 100%;
}

.navigation-instructions {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #ffffff;
  font-size: 14px;
  font-weight: 500;
}

.navigation-icon {
  font-size: 18px;
  display: flex;
  align-items: center;
}

.navigation-text {
  display: flex;
  align-items: center;
  gap: 4px;
}

.navigation-text strong {
  font-weight: 600;
  background: rgba(255, 255, 255, 0.2);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}

.navigation-exit-btn {
  background: rgba(255, 255, 255, 0.15);
  border: none;
  color: #ffffff;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  font-size: 13px;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.navigation-exit-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

.navigation-exit-btn:active {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(0.98);
}

@media (max-width: 768px) {
  .navigation-bar-content {
    gap: 16px;
  }

  .navigation-instructions {
    flex-direction: column;
    gap: 8px;
    text-align: center;
  }

  .navigation-text {
    flex-wrap: wrap;
    justify-content: center;
  }
}
</style>
