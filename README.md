# GeoChase

A web-based mapping application for solving geoportail treasure hunts through geographic analysis and location search.

## Features

### Drawing Tools

- **Circles**: Define search areas with center coordinates and radius (km)
- **Line Segments**: Create paths using multiple modes:
  - Two points: Connect saved coordinates
  - Azimuth: Specify bearing angle and distance
  - Intersection: Line through a point, extended by the entered distance in km beyond it (0 ends at the point)
  - Parallel: Latitude lines across the map
  - Free hand: Interactive drawing with optional azimuth/distance locking
- **Points**: Mark locations on the map
- **Polygons**: Create areas from multiple points (minimum 3)
  - Select points from existing markers
  - Visual representation in light green
  - Extract center point via context menu
- **Drag & Drop**: Create lines by dragging between points in the layers panel

### Location Search

- **Address Search**: Find locations by address, city, or landmark using Geoportail and Nominatim APIs
- **Search Along Path**: Discover locations near drawn lines and points
  - Distance filter: 0.5 - 25 km radius
  - Altitude filter: Filter by elevation range
  - Name filter: Search by location name
- **Elevation Data**: Automatic altitude lookup via IGN Géoplateforme, with Open-Meteo / Copernicus worldwide fallback

### Analysis Tools

- **Bearings**: Calculate distances, azimuths, and inverse azimuths between points
  - Sortable table by name, distance, azimuth, or inverse azimuth
  - Click rows to navigate to points
- **Navigation Mode**: Move along circles and lines using arrow keys
- **Precision Mode**: Magnified lens view (2.5x) for accurate positioning
  - Press 'Z' to toggle precision mode
  - Crosshair overlay for pinpoint accuracy
  - Right-click or ESC to exit
- **Notes**: Add notes to circles, lines, points, and polygons
  - Document clues, observations, and calculations
  - Notes appear as tooltips on map hover
  - One note per element, saved with projects
- **Layer Management**: Show/hide, edit, delete shapes via context menu
  - Polygon-specific: Extract center point as coordinate

### Data Management

- **Projects**: Organize drawings into named projects with auto-save to localStorage
- **Point names**: Right-click the map and leave the name blank to use the nearest city when saving
- **Export**: Projects as JSON, drawings as GPX files
- **Import**: Load JSON projects or GPX files

## Installation

Use Node **26.8.2** (pinned in `.tool-versions`) and npm **12.0.2**. CI, the Pages
workflow, and Docker use these same versions. Select the project Node version with
your version manager before installing dependencies (`mise install` or `asdf install`).

```bash
npm install --global npm@12.0.2
npm ci
npm run dev    # Development server at http://localhost:3000
npm run build  # Production build
```

## Usage

1. Right-click map to save coordinates
2. Use drawing tools to create circles, lines, points, and polygons
3. Search for locations by address or along paths
4. Analyze bearings between points
5. Navigate shapes using arrow keys
6. Export work as GPX for external apps

See in-app tutorial (help icon) for detailed instructions.

## Technology Stack

- **Frontend**: Vue 3, Vuetify 4, TypeScript
- **Mapping**: OpenLayers 10, Geoportail tiles
- **APIs**: Geoportail, Overpass API, Open-Elevation, Nominatim
- **State**: Pinia 4, localStorage
- **Build**: Vite 8, ESLint 10, Prettier

## Project Structure

```
src/
├── components/     # Vue components
├── composables/    # Reusable logic (useMap, useDrawing)
├── pages/         # Main application view
├── domain/        # Layer validation and legacy-data migration
├── services/      # Geometry, storage, and external APIs
├── stores/        # Pinia state management
├── types/         # Shared project and UI contracts
├── utils/         # Debouncing, downloads, and input guards
└── plugins/       # Vuetify, auto-imports
```

## Development checks

```bash
npm run type-check       # Strict application types and unused-code checks
npm run lint             # Read-only lint check; explicit any is disallowed in app code
npm run lint:fix          # Apply available lint fixes
npm run format:check
npm run test:unit:run
npm run test:e2e          # Requires Playwright browsers
npm run build
npm run test:pages        # Tests the built site under /GeoChase/
```

Map objects use shallow Vue refs to preserve OpenLayers class instances. Components receive
map and drawing services through the typed keys in `src/composables/mapContext.ts`.
Project import/export runs through `useProjectFiles`; `domain/layers.ts` validates incoming
files before state changes and migrates older layer formats. Exported JSON includes project
metadata and a format version; older layer-only exports remain importable.

## TypeScript compatibility

TypeScript 7 checks the Node/build configuration. Vue's current `vue-tsc` and ESLint
still need the JavaScript compiler API, so the `typescript` dependency uses the official
`@typescript/typescript6` compatibility package. `npm run type-check` runs both checks;
application type checking remains strict.

## GitHub Pages deployment

The Pages workflow builds on pushes to `main` and can also be started manually. It
uses `npm ci` and uploads only `dist/`. Vite's `/GeoChase/` base and hash routing keep
assets and page reloads working at <https://staormin.github.io/GeoChase/>.

Before uploading, the workflow serves that production build and tests JavaScript,
CSS, fonts, drawing controls, responsive layouts, and the bundled PDF worker with
Chromium. The CI build job runs the same check. To reproduce it locally:

```bash
npm ci
npm run build
npx playwright install chromium
npm run test:pages
```

## Key Keyboard Shortcuts

- **Z**: Toggle precision mode (magnified lens view)
- **Arrow keys**: Navigate along shapes
- **ESC**: Exit navigation/drawing/precision mode
- **Right-click**: Save coordinates, close precision mode
- **ALT** (free hand): Lock azimuth
- **CTRL** (free hand): Lock distance

## License

[MIT](http://opensource.org/licenses/MIT)
