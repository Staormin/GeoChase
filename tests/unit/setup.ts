import { config } from '@vue/test-utils';
import { vi } from 'vitest';
import { createI18n } from 'vue-i18n';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import en from '../../src/locales/en.json';
import fr from '../../src/locales/fr.json';
import 'fake-indexeddb/auto';

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
    default: vi.fn(function () {
      return {
        addLayer: vi.fn(),
        removeLayer: vi.fn(),
        setTarget: vi.fn(),
        getView: vi.fn(function () {
          return {
            getZoom: vi.fn(function () {
              return 10;
            }),
            getCenter: vi.fn(function () {
              return [200_000, 6_000_000];
            }),
            setZoom: vi.fn(),
            setCenter: vi.fn(),
            fit: vi.fn(),
            animate: vi.fn(),
            on: vi.fn(),
            un: vi.fn(),
            getResolution: vi.fn(function () {
              return 100;
            }),
          };
        }),
        on: vi.fn(),
        un: vi.fn(),
        once: vi.fn(),
        getEventPixel: vi.fn(function () {
          return [500, 400];
        }),
        getCoordinateFromPixel: vi.fn(function () {
          return [200_000, 6_000_000];
        }),
        getPixelFromCoordinate: vi.fn(function () {
          return [500, 400];
        }),
        addOverlay: vi.fn(),
        removeOverlay: vi.fn(),
        getOverlays: vi.fn(function () {
          return {
            getArray: vi.fn(function () {
              return [];
            }),
            clear: vi.fn(),
          };
        }),
        getLayers: vi.fn(function () {
          return {
            getArray: vi.fn(function () {
              return [];
            }),
          };
        }),
        getSize: vi.fn(function () {
          return [1024, 768];
        }),
        updateSize: vi.fn(),
        render: vi.fn(),
      };
    }),
  };
});

vi.mock('ol/View', () => {
  return {
    default: vi.fn(function () {
      return {
        getZoom: vi.fn(function () {
          return 10;
        }),
        getCenter: vi.fn(function () {
          return [0, 0];
        }),
        setZoom: vi.fn(),
        setCenter: vi.fn(),
        animate: vi.fn(),
        fit: vi.fn(),
        on: vi.fn(),
        un: vi.fn(),
        constrainResolution: vi.fn(function (resolution: number) {
          return resolution;
        }),
      };
    }),
  };
});

vi.mock('ol/layer/Tile', () => {
  return {
    default: vi.fn(function () {
      return {
        setSource: vi.fn(),
        getSource: vi.fn(),
        setVisible: vi.fn(),
        getVisible: vi.fn(function () {
          return true;
        }),
      };
    }),
  };
});

vi.mock('ol/layer/Vector', () => {
  return {
    default: vi.fn(function () {
      return {
        setSource: vi.fn(),
        getSource: vi.fn(function () {
          return {
            addFeature: vi.fn(),
            removeFeature: vi.fn(),
            clear: vi.fn(),
            getFeatures: vi.fn(function () {
              return [];
            }),
            getFeatureById: vi.fn(),
            forEachFeature: vi.fn(),
          };
        }),
        setStyle: vi.fn(),
        setVisible: vi.fn(),
        getVisible: vi.fn(function () {
          return true;
        }),
      };
    }),
  };
});

vi.mock('ol/source/Vector', () => {
  return {
    default: vi.fn(function () {
      return {
        addFeature: vi.fn(),
        addFeatures: vi.fn(),
        removeFeature: vi.fn(),
        clear: vi.fn(),
        getFeatures: vi.fn(function () {
          return [];
        }),
        getFeatureById: vi.fn(),
        forEachFeature: vi.fn(),
        on: vi.fn(),
        un: vi.fn(),
      };
    }),
  };
});

vi.mock('ol/source/XYZ', () => {
  return {
    default: vi.fn(function () {
      return {
        setUrl: vi.fn(),
        clear: vi.fn(),
        getUrls: vi.fn(function () {
          return [];
        }),
      };
    }),
  };
});

// Mutable config for ol/proj mock - tests can modify these to control return values
export const olProjMockConfig = {
  toLonLatReturnValue: undefined as any,
  fromLonLatReturnValue: undefined as any,
};

vi.mock('ol/proj', () => {
  // Simple Web Mercator projection approximation
  const EARTH_RADIUS = 6_378_137;
  const DEG_TO_RAD = Math.PI / 180;

  return {
    toLonLat: vi.fn(function (coord: any) {
      if (olProjMockConfig.toLonLatReturnValue !== undefined) {
        const val = olProjMockConfig.toLonLatReturnValue;
        olProjMockConfig.toLonLatReturnValue = undefined; // Reset after use
        return val;
      }
      // Convert from Web Mercator to lon/lat
      if (Array.isArray(coord) && coord.length >= 2) {
        const [x, y] = coord;
        const lon = (x / EARTH_RADIUS) * (180 / Math.PI);
        const lat = (Math.atan(Math.exp(y / EARTH_RADIUS)) * 2 - Math.PI / 2) * (180 / Math.PI);
        return [lon, lat];
      }
      return [2.3522, 48.8566];
    }),
    fromLonLat: vi.fn(function (coord: any) {
      if (olProjMockConfig.fromLonLatReturnValue !== undefined) {
        const val = olProjMockConfig.fromLonLatReturnValue;
        olProjMockConfig.fromLonLatReturnValue = undefined;
        return val;
      }
      // Convert from lon/lat to Web Mercator
      if (Array.isArray(coord) && coord.length >= 2) {
        const [lon, lat] = coord;
        const x = lon * DEG_TO_RAD * EARTH_RADIUS;
        const y = Math.log(Math.tan(Math.PI / 4 + (lat * DEG_TO_RAD) / 2)) * EARTH_RADIUS;
        return [x, y];
      }
      return [200_000, 6_000_000];
    }),
    transform: vi.fn(function (coord: any, fromProj: string, toProj: string) {
      // Handle transform between projections
      if (Array.isArray(coord) && coord.length >= 2) {
        if (fromProj === 'EPSG:3857' && toProj === 'EPSG:4326') {
          // Web Mercator to lon/lat
          const [x, y] = coord;
          const lon = (x / EARTH_RADIUS) * (180 / Math.PI);
          const lat = (Math.atan(Math.exp(y / EARTH_RADIUS)) * 2 - Math.PI / 2) * (180 / Math.PI);
          return [lon, lat];
        } else if (fromProj === 'EPSG:4326' && toProj === 'EPSG:3857') {
          // lon/lat to Web Mercator
          const [lon, lat] = coord;
          const x = lon * DEG_TO_RAD * EARTH_RADIUS;
          const y = Math.log(Math.tan(Math.PI / 4 + (lat * DEG_TO_RAD) / 2)) * EARTH_RADIUS;
          return [x, y];
        }
      }
      return coord;
    }),
  };
});
