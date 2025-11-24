import { config } from '@vue/test-utils';
import { vi } from 'vitest';
import { createI18n } from 'vue-i18n';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import en from '../src/locales/en.json';
import fr from '../src/locales/fr.json';

// Mock visual Viewport for happy-dom
if (globalThis.visualViewport === undefined) {
  Object.defineProperty(globalThis, 'visualViewport', {
    value: {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      width: 1024,
      height: 768,
      offsetLeft: 0,
      offsetTop: 0,
      pageLeft: 0,
      pageTop: 0,
      scale: 1,
      segments: null,
      onresize: null,
      onscroll: null,
      onscrollend: null,
    },
    writable: true,
    configurable: true,
  });
}

// Mock ResizeObserver for Vuetify components
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock IntersectionObserver for Vuetify components
global.IntersectionObserver = class IntersectionObserver {
  root = null;
  rootMargin = '';
  thresholds: number[] = [];

  constructor() {
    this.thresholds = [];
  }

  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((cb) => {
  setTimeout(cb, 0);
  return 0;
});

global.cancelAnimationFrame = vi.fn();

// Create and configure Vuetify for tests
const vuetify = createVuetify({
  components,
  directives,
  ssr: true,
});

// Create and configure Vue I18n for tests
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en,
    fr,
  },
});

config.global.plugins = [vuetify, i18n];

// Mock OpenLayers classes that will be used in composables
vi.mock('ol/Map', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      addLayer: vi.fn(),
      removeLayer: vi.fn(),
      setTarget: vi.fn(),
      getView: vi.fn(() => ({
        getZoom: vi.fn(() => 10),
        getCenter: vi.fn(() => [0, 0]),
        setZoom: vi.fn(),
        setCenter: vi.fn(),
        fit: vi.fn(),
        animate: vi.fn(),
        on: vi.fn(),
        un: vi.fn(),
      })),
      on: vi.fn(),
      un: vi.fn(),
      getEventPixel: vi.fn(),
      getCoordinateFromPixel: vi.fn(),
      addOverlay: vi.fn(),
      removeOverlay: vi.fn(),
      getOverlays: vi.fn(() => ({
        getArray: vi.fn(() => []),
        clear: vi.fn(),
      })),
      getLayers: vi.fn(() => ({
        getArray: vi.fn(() => []),
      })),
      getSize: vi.fn(() => [1024, 768]),
      updateSize: vi.fn(),
      render: vi.fn(),
    })),
  };
});

vi.mock('ol/View', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      getZoom: vi.fn(() => 10),
      getCenter: vi.fn(() => [0, 0]),
      setZoom: vi.fn(),
      setCenter: vi.fn(),
      animate: vi.fn(),
      fit: vi.fn(),
      on: vi.fn(),
      un: vi.fn(),
      constrainResolution: vi.fn((resolution: number) => resolution),
    })),
  };
});

vi.mock('ol/layer/Tile', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      setSource: vi.fn(),
      getSource: vi.fn(),
      setVisible: vi.fn(),
      getVisible: vi.fn(() => true),
    })),
  };
});

vi.mock('ol/layer/Vector', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      setSource: vi.fn(),
      getSource: vi.fn(() => ({
        addFeature: vi.fn(),
        removeFeature: vi.fn(),
        clear: vi.fn(),
        getFeatures: vi.fn(() => []),
        getFeatureById: vi.fn(),
        forEachFeature: vi.fn(),
      })),
      setStyle: vi.fn(),
      setVisible: vi.fn(),
      getVisible: vi.fn(() => true),
    })),
  };
});

vi.mock('ol/source/Vector', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      addFeature: vi.fn(),
      addFeatures: vi.fn(),
      removeFeature: vi.fn(),
      clear: vi.fn(),
      getFeatures: vi.fn(() => []),
      getFeatureById: vi.fn(),
      forEachFeature: vi.fn(),
      on: vi.fn(),
      un: vi.fn(),
    })),
  };
});

vi.mock('ol/source/XYZ', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      setUrl: vi.fn(),
      getUrls: vi.fn(() => []),
    })),
  };
});
