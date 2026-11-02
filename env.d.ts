/// <reference types="vite/client" />
/// <reference types="vite-plugin-vue-layouts-next/client" />

interface ImportMetaEnv {
  /** Overpass API endpoint; defaults to the public overpass-api.de instance. */
  readonly VITE_OVERPASS_URL?: string;
}
