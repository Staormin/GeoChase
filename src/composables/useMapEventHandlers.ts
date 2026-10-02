import type { useMap } from '@/composables/useMap';
import { Feature } from 'ol';
import { asArray } from 'ol/color';
import { LineString, Point, Polygon } from 'ol/geom';
import Interaction from 'ol/interaction/Interaction';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Fill, Icon, Stroke, Style } from 'ol/style';
import { ref, watch } from 'vue';
import { themes } from '@/services/themes';
import { useUIStore } from '@/stores/ui';
import { useMapCursor } from './useMapCursor';

export interface MapElementSelection {
  elementType: 'route' | 'circle' | 'lineSegment' | 'point' | 'polygon';
  elementId: string;
  position: [number, number];
}

function createHoverStyles(color: string) {
  const pin = `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41"><path d="M12.5 0C5.596 0 0 5.596 0 12.5c0 3.53 1.442 6.715 3.77 9.015L12.5 41l8.73-19.485C23.058 19.215 25 15.03 25 12.5 25 5.596 19.404 0 12.5 0zm0 19a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13z" fill="${color}"/></svg>`;
  return {
    point: new Style({
      image: new Icon({
        src: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(pin)}`,
        anchor: [0.5, 1],
      }),
    }),
    line: new Style({ stroke: new Stroke({ color, width: 6 }) }),
    polygon: new Style({
      fill: new Fill({ color: [...asArray(color).slice(0, 3), 0.32] }),
      stroke: new Stroke({ color, width: 5 }),
    }),
  };
}

function createHighlight(feature: Feature, styles: ReturnType<typeof createHoverStyles>) {
  const geometry = feature.getGeometry()?.clone();
  const style =
    geometry instanceof Point
      ? styles.point
      : geometry instanceof Polygon
        ? styles.polygon
        : geometry instanceof LineString
          ? styles.line
          : undefined;
  if (!geometry || !style) return;
  const highlight = new Feature(geometry);
  highlight.setStyle(style);
  return highlight;
}

function highlightColor() {
  return (
    document.documentElement.style.getPropertyValue('--accent').trim() ||
    themes.cartography!.colors.primary!
  );
}

export function useMapEventHandlers(mapContainer: ReturnType<typeof useMap>) {
  const uiStore = useUIStore();
  const contextMenu = ref<MapElementSelection | null>(null);
  const setCursor = useMapCursor(mapContainer, 0);

  const setup = () => {
    const map = mapContainer.map.value;
    if (!map) return () => {};
    const available = () => uiStore.canInteractWithLines && !uiStore.intersectionLineEdit;
    const sources = [
      ['route', mapContainer.routesSource],
      ['circle', mapContainer.circlesSource],
      ['lineSegment', mapContainer.linesSource],
      ['point', mapContainer.pointsSource],
      ['polygon', mapContainer.polygonsSource],
    ] as const;
    const hoverSource = new VectorSource<Feature>();
    const hoverLayer = new VectorLayer({ source: hoverSource, zIndex: 1900 });
    const clickedSource = new VectorSource<Feature>();
    const clickedLayer = new VectorLayer({ source: clickedSource, zIndex: 1901 });
    const sidebarHoverSource = new VectorSource<Feature>();
    const sidebarHoverLayer = new VectorLayer({ source: sidebarHoverSource, zIndex: 1902 });
    let hoverColor = '';
    let hoverStyles: ReturnType<typeof createHoverStyles>;
    const canShowHoverLayer = typeof map!.addLayer === 'function';
    if (canShowHoverLayer) {
      map!.addLayer(hoverLayer);
      map!.addLayer(clickedLayer);
      map!.addLayer(sidebarHoverLayer);
    }
    let hoveredFeatureId: string | number | undefined;
    function elementAt(pixel: number[]) {
      if (!available() || typeof map!.forEachFeatureAtPixel !== 'function') return;
      return map!.forEachFeatureAtPixel(
        pixel,
        (feature) => {
          const id = feature.getId();
          if (typeof id !== 'string') return;
          for (const [elementType, source] of sources) {
            if (
              source.value?.getFeatureById(id) === feature &&
              uiStore.isElementVisible(elementType, id)
            ) {
              return { elementType, elementId: id };
            }
          }
        },
        { hitTolerance: 6 }
      );
    }
    const clearHover = () => {
      setCursor(null);
      hoveredFeatureId = undefined;
      hoverSource.clear();
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (typeof map!.getEventPixel !== 'function') return;
      const element = event.buttons === 0 ? elementAt(map!.getEventPixel(event)) : undefined;
      setCursor(element ? 'pointer' : null);

      const color = highlightColor();
      const source = sources.find(([type]) => type === element?.elementType)?.[1];
      const feature = element ? source?.value?.getFeatureById(element.elementId) : undefined;
      const featureId = element && `${element.elementType}:${element.elementId}`;
      if (!feature || featureId === undefined) {
        hoveredFeatureId = undefined;
        hoverSource.clear();
      } else if (hoveredFeatureId !== featureId || hoverColor !== color) {
        if (hoverColor !== color) {
          hoverColor = color;
          hoverStyles = createHoverStyles(color);
        }
        hoveredFeatureId = featureId;
        hoverSource.clear();
        const highlight = createHighlight(feature, hoverStyles);
        if (highlight) hoverSource.addFeature(highlight);
      }
    };
    const handleAltRightContextMenu = (event: MouseEvent) => {
      if (event.button !== 2 || !event.altKey || !available()) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      uiStore.quickToolsMenuPosition = { x: event.clientX, y: event.clientY };
    };
    const stopSidebarHover = watch(
      [() => uiStore.sidebarHoverRequest, () => uiStore.elementVisibility, available],
      () => {
        sidebarHoverSource.clear();
        const request = uiStore.sidebarHoverRequest;
        if (
          !available() ||
          !request ||
          !uiStore.isElementVisible(request.elementType, request.elementId)
        )
          return;
        const source = sources.find(([type]) => type === request.elementType)?.[1];
        const feature = source?.value?.getFeatureById(request.elementId);
        if (!feature) return;
        const highlight = createHighlight(feature, createHoverStyles(highlightColor()));
        if (highlight) sidebarHoverSource.addFeature(highlight);
      },
      { deep: true }
    );
    const stopClickHighlight = watch(
      () => uiStore.mapElementHighlightRequest,
      (request, _previous, onCleanup) => {
        clickedSource.clear();
        if (!request || !uiStore.isElementVisible(request.elementType, request.elementId)) return;
        const source = sources.find(([type]) => type === request.elementType)?.[1];
        const feature = source?.value?.getFeatureById(request.elementId);
        if (!feature) return;
        const highlight = createHighlight(feature, createHoverStyles(highlightColor()));
        if (!highlight) return;
        clickedSource.addFeature(highlight);
        const timer = setTimeout(() => clickedSource.clear(), 3000);
        onCleanup(() => {
          clearTimeout(timer);
          clickedSource.clear();
        });
      }
    );
    const interaction = new Interaction({
      handleEvent(event) {
        if (
          event.type === 'click' &&
          'button' in event.originalEvent &&
          event.originalEvent.button === 0
        ) {
          const element = elementAt(event.pixel);
          if (element) {
            uiStore.sidebarOpen = true;
            uiStore.sidebarElementRequest = { ...element };
            const rect = map!.getViewport().getBoundingClientRect();
            contextMenu.value = {
              ...element,
              position: [rect.left + event.pixel[0]!, rect.top + event.pixel[1]!],
            };
            clearHover();
            return false;
          }
        }
        return true;
      },
    });
    map.addInteraction(interaction);
    const viewport = map.getViewport();
    viewport.addEventListener('pointermove', handlePointerMove);
    viewport.addEventListener('pointerleave', clearHover);
    viewport.addEventListener('contextmenu', handleAltRightContextMenu, true);
    map.on('movestart', clearHover);
    const stopWatch = watch(
      () => [available(), uiStore.elementVisibility],
      () => {
        clearHover();
        clickedSource.clear();
        if (!available()) contextMenu.value = null;
      },
      {
        deep: true,
      }
    );
    const unsubscribeRightClick = mapContainer.onMapRightClick((lat, lon) => {
      if (uiStore.gameMode || uiStore.freeHandDrawing.isDrawing) return;
      uiStore.startCreating('point', { lat, lon });
      uiStore.openModal('pointModal');
    });
    return () => {
      unsubscribeRightClick();
      stopWatch();
      stopClickHighlight();
      stopSidebarHover();
      sidebarHoverSource.clear();
      clearHover();
      map.removeInteraction(interaction);
      if (canShowHoverLayer && typeof map.removeLayer === 'function') {
        map.removeLayer(hoverLayer);
        map.removeLayer(clickedLayer);
        map.removeLayer(sidebarHoverLayer);
      }
      viewport.removeEventListener('pointermove', handlePointerMove);
      viewport.removeEventListener('pointerleave', clearHover);
      viewport.removeEventListener('contextmenu', handleAltRightContextMenu, true);
      map.un('movestart', clearHover);
    };
  };

  return { setup, contextMenu };
}
