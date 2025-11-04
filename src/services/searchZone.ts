/**
 * Search Zone Visualization
 * Creates and displays a buffer zone around a path on the map
 */

import type { Feature } from 'ol';
import type { Geometry } from 'ol/geom';
import * as turf from '@turf/turf';
import GeoJSON from 'ol/format/GeoJSON';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style';

/**
 * Create a search zone layer that displays a buffered area around a path
 * @param mapContainer Map container with OpenLayers map instance
 * @param pathPoints Array of lat/lon points defining the path
 * @param bufferDistanceKm Buffer distance in kilometers
 * @returns OpenLayers VectorLayer containing the search zone visualization
 */
export function createSearchZoneLayer(
  mapContainer: any,
  pathPoints: Array<{ lat: number; lon: number }>,
  bufferDistanceKm: number
): VectorLayer<VectorSource> {
  // Get the actual map instance (handle both ref and direct access)
  const mapInstance = mapContainer.map?.value || mapContainer.map;

  // Create a VectorSource to hold all search zone elements
  const searchZoneSource = new VectorSource();
  const searchZoneLayer = new VectorLayer({
    source: searchZoneSource,
    style: undefined, // Will be set per-feature
  });

  try {
    if (!mapInstance) {
      return searchZoneLayer;
    }

    // Validate we have at least one point
    if (!pathPoints || pathPoints.length === 0) {
      return searchZoneLayer;
    }

    // Convert path points to GeoJSON geometry
    // Points are already properly interpolated by the composable/component
    const coordinates = pathPoints.map((p) => [p.lon, p.lat]);

    let geometry;
    let pathGeometry;

    if (pathPoints.length === 1) {
      // For single point, use Point geometry
      geometry = turf.point(coordinates[0]!);
      pathGeometry = turf.point(coordinates[0]!);
    } else {
      // For multiple points, use LineString geometry
      geometry = turf.lineString(coordinates);
      pathGeometry = turf.lineString(coordinates);
    }

    // Create a buffer polygon around the geometry
    const bufferedPolygon = turf.buffer(geometry, bufferDistanceKm, {
      units: 'kilometers',
    });

    // Convert buffered polygon to OpenLayers features
    if (bufferedPolygon) {
      const geoJsonFormat = new GeoJSON();
      const bufferFeatures = geoJsonFormat.readFeatures(bufferedPolygon, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857',
      }) as Feature<Geometry>[];

      // Style the buffer polygon
      for (const feature of bufferFeatures) {
        feature.setStyle(
          new Style({
            fill: new Fill({
              color: 'rgba(255, 0, 0, 0.15)',
            }),
            stroke: new Stroke({
              color: 'rgba(255, 0, 0, 0.6)',
              width: 2,
              lineDash: [5, 5],
            }),
          })
        );
      }

      searchZoneSource.addFeatures(bufferFeatures);
    }

    // Visualize the original path
    const pathFeatures = new GeoJSON().readFeatures(pathGeometry, {
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:3857',
    }) as Feature<Geometry>[];

    for (const feature of pathFeatures) {
      const geometryType = feature.getGeometry()?.getType();

      if (geometryType === 'Point') {
        // For point features, create a circular marker
        feature.setStyle(
          new Style({
            image: new CircleStyle({
              radius: 5,
              fill: new Fill({
                color: 'rgba(255, 0, 0, 0.8)',
              }),
              stroke: new Stroke({
                color: '#ff0000',
                width: 3,
              }),
            }),
          })
        );
      } else {
        // For line features, use a solid stroke
        feature.setStyle(
          new Style({
            stroke: new Stroke({
              color: 'rgba(255, 0, 0, 0.8)',
              width: 3,
            }),
          })
        );
      }
    }

    searchZoneSource.addFeatures(pathFeatures);

    // Add the layer to the map
    mapInstance.addLayer(searchZoneLayer);

    return searchZoneLayer;
  } catch {
    return searchZoneLayer;
  }
}

/**
 * Remove the search zone layer from the map
 * @param mapContainer Map container with OpenLayers map instance
 * @param searchZoneLayer The VectorLayer to remove
 */
export function removeSearchZoneLayer(
  mapContainer: any,
  searchZoneLayer: VectorLayer<VectorSource>
): void {
  // Get the actual map instance (handle both ref and direct access)
  const mapInstance = mapContainer.map?.value || mapContainer.map;

  try {
    if (!mapInstance) {
      return;
    }

    mapInstance.removeLayer(searchZoneLayer);
  } catch {
    // Silently ignore layer removal errors
  }
}
