/**
 * Composable for displaying note tooltips on the map
 * Uses OpenLayers Overlay API to attach permanent tooltips to existing features
 */

import type { Feature } from 'ol';
import type { Geometry } from 'ol/geom';
import type { NoteElement } from '@/services/storage';
import { getCenter } from 'ol/extent';
import Overlay from 'ol/Overlay';
import { watch } from 'vue';
import { useLayersStore } from '@/stores/layers';
import { useUIStore } from '@/stores/ui';

const MIN_ZOOM_FOR_NOTES = 12; // Show notes only at zoom level 12 or higher

export function useNoteTooltips(mapRef: any) {
  const layersStore = useLayersStore();
  const uiStore = useUIStore();

  // Track which notes have overlays created: Map<noteId, Overlay>
  const noteOverlays = new Map<string, Overlay>();

  function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function handleNoteClick(noteId: string) {
    uiStore.startEditing('note', noteId);
    uiStore.openModal('noteModal');
  }

  /**
   * Get the OpenLayers feature for a given element
   */
  function getElementFeature(note: NoteElement): Feature<Geometry> | null {
    if (!note.linkedElementType || !note.linkedElementId) {
      return null;
    }

    // Get the appropriate vector source based on element type
    let source;
    switch (note.linkedElementType) {
      case 'circle': {
        source = mapRef.circlesSource?.value;
        break;
      }
      case 'lineSegment': {
        source = mapRef.linesSource?.value;
        break;
      }
      case 'point': {
        source = mapRef.pointsSource?.value;
        break;
      }
      case 'polygon': {
        source = mapRef.polygonsSource?.value;
        break;
      }
      default: {
        return null;
      }
    }

    if (!source) return null;

    // Use OpenLayers native getFeatureById() - features are created with setId(elementId)
    return source.getFeatureById(note.linkedElementId) || null;
  }

  /**
   * Create and attach an overlay tooltip for the given note
   */
  function bindNoteTooltip(note: NoteElement) {
    if (!mapRef.map?.value || !note.id) return;

    const feature = getElementFeature(note);
    if (!feature) return;

    // Don't bind if already bound
    if (noteOverlays.has(note.id)) return;

    // Escape text (no truncation for full display)
    const safeTitle = escapeHtml(note.title);
    const safeContent = note.content ? escapeHtml(note.content) : '';

    // Create overlay container element
    const overlayElement = document.createElement('div');
    overlayElement.className = 'note-tooltip';
    overlayElement.innerHTML = `
      <div class="note-tooltip-card" data-note-id="${note.id}">
        <div class="note-tooltip-icon">📝</div>
        <div class="note-tooltip-content">
          <div class="note-tooltip-title">${safeTitle}</div>
          ${safeContent ? `<div class="note-tooltip-text">${safeContent}</div>` : ''}
        </div>
      </div>
    `;

    // Add click handler
    const cardElement = overlayElement.querySelector('.note-tooltip-card');
    if (cardElement) {
      cardElement.addEventListener('click', () => {
        handleNoteClick(note.id!);
      });
    }

    // Calculate position from feature geometry
    const geometry = feature.getGeometry();
    if (!geometry) return;

    const extent = geometry.getExtent();
    const center = getCenter(extent);

    // Create OpenLayers Overlay
    const overlay = new Overlay({
      element: overlayElement,
      position: center,
      positioning: 'center-left',
      offset: [15, 0],
      stopEvent: false,
    });

    // Add overlay to map
    mapRef.map.value.addOverlay(overlay);
    noteOverlays.set(note.id, overlay);
  }

  /**
   * Remove overlay tooltip for the given note
   */
  function unbindNoteTooltip(noteId: string) {
    const overlay = noteOverlays.get(noteId);
    if (!overlay) return;

    // Remove overlay from map
    if (mapRef.map?.value) {
      mapRef.map.value.removeOverlay(overlay);
    }

    // Dispose of overlay element
    const element = overlay.getElement();
    if (element) {
      element.remove();
    }

    noteOverlays.delete(noteId);
  }

  /**
   * Update all note tooltips based on current zoom level
   */
  function updateNoteTooltips() {
    if (!mapRef.map?.value) return;

    const view = mapRef.map.value.getView();
    const currentZoom = view.getZoom();
    if (currentZoom === undefined) return;

    const linkedNotes = layersStore.notes.filter(
      (note) => note.linkedElementType && note.linkedElementId
    );

    if (currentZoom >= MIN_ZOOM_FOR_NOTES) {
      // Show tooltips for notes at this zoom level
      for (const note of linkedNotes) {
        if (note.id && !noteOverlays.has(note.id)) {
          bindNoteTooltip(note);
        }
      }

      // Remove tooltips for notes that no longer exist
      for (const noteId of noteOverlays.keys()) {
        if (!linkedNotes.some((n) => n.id === noteId)) {
          unbindNoteTooltip(noteId);
        }
      }
    } else {
      // Hide all tooltips when zoomed out
      for (const noteId of Array.from(noteOverlays.keys())) {
        unbindNoteTooltip(noteId);
      }
    }
  }

  /**
   * Refresh a specific note tooltip (e.g., after editing)
   */
  function refreshNoteTooltip(noteId: string) {
    const note = layersStore.notes.find((n) => n.id === noteId);

    if (!note) {
      unbindNoteTooltip(noteId);
      return;
    }

    // Unbind and rebind to update content
    unbindNoteTooltip(noteId);

    if (mapRef.map?.value) {
      const view = mapRef.map.value.getView();
      const currentZoom = view.getZoom();

      if (currentZoom !== undefined && currentZoom >= MIN_ZOOM_FOR_NOTES) {
        bindNoteTooltip(note);
      }
    }
  }

  /**
   * Clear all tooltips
   */
  function clearAllTooltips() {
    for (const noteId of Array.from(noteOverlays.keys())) {
      unbindNoteTooltip(noteId);
    }
    noteOverlays.clear();
  }

  // Watch for zoom changes to show/hide tooltips based on zoom level
  if (mapRef.map?.value) {
    const view = mapRef.map.value.getView();
    view.on('change:resolution', () => {
      updateNoteTooltips();
    });
  }

  // Watch for changes in notes (add/edit/delete)
  watch(
    () => layersStore.notes,
    () => {
      updateNoteTooltips();
    },
    { deep: true }
  );

  // Initial update
  if (mapRef.map?.value) {
    updateNoteTooltips();
  }

  return {
    updateNoteTooltips,
    refreshNoteTooltip,
    clearAllTooltips,
    bindNoteTooltip,
    unbindNoteTooltip,
  };
}
