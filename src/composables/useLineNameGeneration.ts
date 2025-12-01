import { getReverseGeocodeAddress } from '@/services/address';
import { useLayersStore } from '@/stores/layers';

/**
 * Composable for generating automatic line segment names based on mode and coordinates
 */
export function useLineNameGeneration() {
  const layersStore = useLayersStore();

  /**
   * Find a point by lat/lon with tolerance
   */
  function findPointAtLocation(lat: number, lon: number) {
    return layersStore.sortedPoints.find(
      (p) =>
        Math.abs(p.coordinates.lat - lat) < 0.0001 && Math.abs(p.coordinates.lon - lon) < 0.0001
    );
  }

  /**
   * Get a location name from points or reverse geocoding
   */
  async function getLocationName(lat: number, lon: number): Promise<string> {
    const point = findPointAtLocation(lat, lon);
    if (point) {
      return point.name;
    }

    const { address } = await getReverseGeocodeAddress(lat, lon);
    return address || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  }

  /**
   * Generate name for two-points (coordinate) mode line
   */
  async function generateTwoPointsName(
    startLat: number,
    startLon: number,
    endLat: number,
    endLon: number
  ): Promise<string> {
    const startPoint = findPointAtLocation(startLat, startLon);
    const endPoint = findPointAtLocation(endLat, endLon);

    if (startPoint && endPoint) {
      return `${startPoint.name} => ${endPoint.name}`;
    } else if (startPoint || endPoint) {
      // One point exists, try reverse geocoding for the other
      const startName = startPoint?.name;
      const endName = endPoint?.name;

      if (startName) {
        const { address } = await getReverseGeocodeAddress(endLat, endLon);
        const generatedEndName = address || `${endLat.toFixed(4)}, ${endLon.toFixed(4)}`;
        return `${startName} => ${generatedEndName}`;
      } else {
        const { address } = await getReverseGeocodeAddress(startLat, startLon);
        const generatedStartName = address || `${startLat.toFixed(4)}, ${startLon.toFixed(4)}`;
        return `${generatedStartName} => ${endName}`;
      }
    } else {
      // Neither point exists, try reverse geocoding for both
      const [startResult, endResult] = await Promise.all([
        getReverseGeocodeAddress(startLat, startLon),
        getReverseGeocodeAddress(endLat, endLon),
      ]);

      const startName = startResult.address || `${startLat.toFixed(4)}, ${startLon.toFixed(4)}`;
      const endName = endResult.address || `${endLat.toFixed(4)}, ${endLon.toFixed(4)}`;
      return `${startName} => ${endName}`;
    }
  }

  /**
   * Generate name for azimuth mode line
   */
  async function generateAzimuthName(
    startLat: number,
    startLon: number,
    azimuth: number
  ): Promise<string> {
    const startPoint = findPointAtLocation(startLat, startLon);

    if (startPoint) {
      return `From ${startPoint.name} at ${azimuth}°`;
    } else {
      const { address } = await getReverseGeocodeAddress(startLat, startLon);
      const startName = address || `${startLat.toFixed(4)}, ${startLon.toFixed(4)}`;
      return `From ${startName} at ${azimuth}°`;
    }
  }

  /**
   * Generate name for intersection mode line
   */
  async function generateIntersectionName(
    startLat: number,
    startLon: number,
    intersectLat: number,
    intersectLon: number
  ): Promise<string> {
    const startPoint = findPointAtLocation(startLat, startLon);
    const intersectPoint = findPointAtLocation(intersectLat, intersectLon);

    const startName =
      startPoint?.name ||
      (await getReverseGeocodeAddress(startLat, startLon)).address ||
      `${startLat.toFixed(4)}, ${startLon.toFixed(4)}`;
    const intersectName =
      intersectPoint?.name ||
      (await getReverseGeocodeAddress(intersectLat, intersectLon)).address ||
      `${intersectLat.toFixed(4)}, ${intersectLon.toFixed(4)}`;

    return `From ${startName} via ${intersectName}`;
  }

  /**
   * Generate name for parallel mode line
   */
  function generateParallelName(latitude: number): string {
    const point = layersStore.sortedPoints.find(
      (p) => Math.abs(p.coordinates.lat - latitude) < 0.0001
    );

    if (point) {
      return `Parallel to ${point.name}`;
    }

    return `Parallel at ${latitude.toFixed(6)}°`;
  }

  /**
   * Generate fallback name
   */
  function generateFallbackName(): string {
    return `Line ${layersStore.lineSegmentCount + 1}`;
  }

  return {
    getLocationName,
    generateTwoPointsName,
    generateAzimuthName,
    generateIntersectionName,
    generateParallelName,
    generateFallbackName,
  };
}
