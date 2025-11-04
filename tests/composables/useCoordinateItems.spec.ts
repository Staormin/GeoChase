import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { useCoordinateItems } from '@/composables/useCoordinateItems';
import { useCoordinatesStore } from '@/stores/coordinates';

describe('useCoordinateItems', () => {
  let pinia: any;
  let coordinatesStore: any;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    coordinatesStore = useCoordinatesStore();
  });

  it('should return empty array when no coordinates', () => {
    const { coordinateItems } = useCoordinateItems();
    expect(coordinateItems.value).toEqual([]);
  });

  it('should format single coordinate correctly', () => {
    const { coordinateItems } = useCoordinateItems();

    // Add a coordinate
    coordinatesStore.addCoordinate('Eiffel Tower', 48.858_844, 2.294_351, '1');

    expect(coordinateItems.value).toEqual([
      {
        label: 'Eiffel Tower (48.858844, 2.294351)',
        value: '48.858844,2.294351',
      },
    ]);
  });

  it('should format multiple coordinates correctly', () => {
    const { coordinateItems } = useCoordinateItems();

    // Add multiple coordinates
    coordinatesStore.addCoordinate('Paris', 48.8566, 2.3522, '1');
    coordinatesStore.addCoordinate('London', 51.5074, -0.1278, '2');
    coordinatesStore.addCoordinate('New York', 40.7128, -74.006, '3');

    expect(coordinateItems.value).toEqual([
      {
        label: 'Paris (48.856600, 2.352200)',
        value: '48.8566,2.3522',
      },
      {
        label: 'London (51.507400, -0.127800)',
        value: '51.5074,-0.1278',
      },
      {
        label: 'New York (40.712800, -74.006000)',
        value: '40.7128,-74.006',
      },
    ]);
  });

  it('should handle coordinates with long decimal places', () => {
    const { coordinateItems } = useCoordinateItems();

    // Add coordinate with many decimal places
    coordinatesStore.addCoordinate('Precise Location', 48.123_456_789, -122.987_654_321, '1');

    expect(coordinateItems.value).toEqual([
      {
        label: 'Precise Location (48.123457, -122.987654)',
        value: '48.123456789,-122.987654321',
      },
    ]);
  });

  it('should be reactive to coordinate changes', () => {
    const { coordinateItems } = useCoordinateItems();

    // Initially empty
    expect(coordinateItems.value).toEqual([]);

    // Add a coordinate
    coordinatesStore.addCoordinate('Point A', 10, 20, '1');
    expect(coordinateItems.value).toHaveLength(1);
    expect(coordinateItems.value[0].label).toBe('Point A (10.000000, 20.000000)');

    // Add another coordinate
    coordinatesStore.addCoordinate('Point B', 30, 40, '2');
    expect(coordinateItems.value).toHaveLength(2);

    // Delete a coordinate
    coordinatesStore.deleteCoordinate('1');
    expect(coordinateItems.value).toHaveLength(1);
    expect(coordinateItems.value[0].label).toBe('Point B (30.000000, 40.000000)');

    // Update a coordinate
    coordinatesStore.updateCoordinate('2', 'Updated Point', 35, 45);
    expect(coordinateItems.value[0].label).toBe('Updated Point (35.000000, 45.000000)');
    expect(coordinateItems.value[0].value).toBe('35,45');
  });

  it('should handle negative coordinates correctly', () => {
    const { coordinateItems } = useCoordinateItems();

    coordinatesStore.addCoordinate('South America', -15.7942, -47.8825, '1');
    coordinatesStore.addCoordinate('Australia', -33.8688, 151.2093, '2');

    expect(coordinateItems.value).toEqual([
      {
        label: 'South America (-15.794200, -47.882500)',
        value: '-15.7942,-47.8825',
      },
      {
        label: 'Australia (-33.868800, 151.209300)',
        value: '-33.8688,151.2093',
      },
    ]);
  });

  it('should handle coordinates at zero', () => {
    const { coordinateItems } = useCoordinateItems();

    coordinatesStore.addCoordinate('Null Island', 0, 0, '1');

    expect(coordinateItems.value).toEqual([
      {
        label: 'Null Island (0.000000, 0.000000)',
        value: '0,0',
      },
    ]);
  });

  it('should clear all items when coordinates are cleared', () => {
    const { coordinateItems } = useCoordinateItems();

    // Add some coordinates
    coordinatesStore.addCoordinate('Point 1', 1, 1, '1');
    coordinatesStore.addCoordinate('Point 2', 2, 2, '2');
    expect(coordinateItems.value).toHaveLength(2);

    // Clear all coordinates
    coordinatesStore.clearCoordinates();
    expect(coordinateItems.value).toEqual([]);
  });
});
