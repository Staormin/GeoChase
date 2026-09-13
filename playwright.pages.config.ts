import { defineConfig } from '@playwright/test';
import config from './playwright.config';

// Exercise the exact production artifact uploaded to GitHub Pages.
export default defineConfig(config, {
  testMatch: [
    '**/deployment.spec.ts',
    '**/data/project-projection.spec.ts',
    '**/ui/responsive-layout.spec.ts',
    '**/drawing/point-geocoding.spec.ts',
    '**/drawing/intersection-distance.spec.ts',
    '**/drawing/intersection-edit-pages.spec.ts',
    '**/drawing/crossing-point.spec.ts',
  ],
  testIgnore: [],
  workers: 2,
  use: {
    baseURL: 'http://127.0.0.1:4173/GeoChase/',
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/GeoChase/',
    reuseExistingServer: false,
  },
});
