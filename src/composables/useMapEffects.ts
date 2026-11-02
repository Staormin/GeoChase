import type { Coordinate } from 'ol/coordinate';
import type RenderEvent from 'ol/render/Event';
import type { Ref } from 'vue';
import TileLayer from 'ol/layer/Tile';
import { getRenderPixel } from 'ol/render';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useProjectsStore } from '@/stores/projects';
import { useUIStore } from '@/stores/ui';
import { useDrawingContext, useMapContext, useNoteTooltipsContext } from './mapContext';

type Shot = { coordinate: Coordinate; angle: number; distance: number };
type Crater = { coordinate: Coordinate; radius: number };
const SHELL_RANGE = 360;
type Blast = { coordinate: Coordinate; age: number };

export function useMapEffects(canvas: Ref<HTMLCanvasElement | null>) {
  const mapContainer = useMapContext();
  const drawing = useDrawingContext();
  const noteTooltips = useNoteTooltipsContext();
  const ui = useUIStore();
  const projects = useProjectsStore();
  const tankPosition = ref({ x: 0, y: 0, angle: 0 });
  const keys = new Set<string>();
  const shots: Shot[] = [];
  const blasts: Blast[] = [];
  const craters: Crater[] = [];
  const damagedElements: { type: string; id: string }[] = [];
  const maskedLayers: TileLayer[] = [];
  let coordinate: Coordinate = [0, 0];
  let angle = -Math.PI / 2;
  let sequence = '';
  let frame = 0;
  let previousTime = 0;
  let lastShot = 0;
  let pendingFire = false;

  function isEditing(target: EventTarget | null) {
    return (
      target instanceof HTMLElement &&
      !!target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')
    );
  }

  function control(event: KeyboardEvent) {
    const key = event.key.toLowerCase();
    if (event.code === 'Space' || key === ' ') return 'fire';
    if (key === 'arrowup' || key === 'z' || key === 'w' || event.code === 'KeyW') return 'up';
    if (key === 'arrowleft' || key === 'q' || key === 'a' || event.code === 'KeyA') return 'left';
    if (key === 'arrowdown' || key === 's') return 'down';
    if (key === 'arrowright' || key === 'd') return 'right';
  }

  function clearKeys() {
    keys.clear();
    pendingFire = false;
    sequence = '';
  }

  function keydown(event: KeyboardEvent) {
    if (
      isEditing(event.target) ||
      event.isComposing ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      ui.openModals.size > 0 ||
      ui.showTutorial
    ) {
      clearKeys();
      return;
    }
    if (!event.repeat && event.key.length === 1) {
      sequence = (sequence + event.key.toLowerCase()).slice(-5);
      if (sequence === 'billb') {
        sequence = '';
        event.preventDefault();
        event.stopImmediatePropagation();
        if (ui.gameMode) ui.gameMode = false;
        else if (mapContainer.map.value) {
          ui.stopFreeHandDrawing();
          ui.stopNavigating();
          ui.stopTool();
          ui.intersectionLineEdit = null;
          ui.gameMode = true;
        }
        return;
      }
    } else if (!event.repeat) sequence = '';
    if (!ui.gameMode) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      ui.gameMode = false;
      return;
    }
    const action = control(event);
    if (action) {
      event.preventDefault();
      event.stopImmediatePropagation();
      keys.add(event.code || event.key);
      if (action === 'fire' && !event.repeat) pendingFire = true;
    }
  }

  function keyup(event: KeyboardEvent) {
    keys.delete(event.code || event.key);
    if (ui.gameMode && control(event) && !isEditing(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }

  // Track physical keys so releasing one of two equivalent keys does not stop the other.
  const directions = new Map<string, string>();
  function recordKey(event: KeyboardEvent) {
    const action = control(event);
    if (action) directions.set(event.code || event.key, action);
    keydown(event);
  }
  function pressed(action: string) {
    return [...keys].some((key) => directions.get(key) === action);
  }

  function visibleArea() {
    const map = mapContainer.map.value!;
    const rect =
      map.getTargetElement()?.getBoundingClientRect() ??
      new DOMRect(0, 0, ...(map.getSize() ?? [0, 0]));
    const sidebar = document
      .querySelector('[data-testid="layers-sidebar"]')
      ?.getBoundingClientRect();
    const pdf = document
      .querySelector('.v-navigation-drawer--right.v-navigation-drawer--active')
      ?.getBoundingClientRect();
    const bar = document.querySelector('[data-testid="game-controls"]')?.getBoundingClientRect();
    return {
      rect,
      left: ui.sidebarOpen && sidebar ? Math.max(0, sidebar.right - rect.left) : 0,
      right: pdf ? Math.min(rect.width, pdf.left - rect.left) : rect.width,
      top: bar ? Math.max(0, bar.bottom - rect.top) : 64,
      bottom: rect.height,
    };
  }

  function move(position: Coordinate, heading: number, distance: number) {
    const map = mapContainer.map.value!;
    const pixel = map.getPixelFromCoordinate(position);
    return map.getCoordinateFromPixel([
      pixel[0]! + Math.cos(heading) * distance,
      pixel[1]! + Math.sin(heading) * distance,
    ]);
  }

  function followTank() {
    const map = mapContainer.map.value!;
    const area = visibleArea();
    const pixel = map.getPixelFromCoordinate(coordinate);
    const safeX = Math.max(area.left + 45, Math.min(area.right - 45, pixel[0]!));
    const safeY = Math.max(area.top + 45, Math.min(area.bottom - 45, pixel[1]!));
    if (safeX !== pixel[0] || safeY !== pixel[1]) {
      const safeCoordinate = map.getCoordinateFromPixel([safeX, safeY]);
      map
        .getView()
        .adjustCenter([coordinate[0]! - safeCoordinate[0]!, coordinate[1]! - safeCoordinate[1]!]);
    }
  }

  function hit(pixel: number[]) {
    const sources = [
      ['point', mapContainer.pointsSource],
      ['lineSegment', mapContainer.linesSource],
      ['circle', mapContainer.circlesSource],
      ['polygon', mapContainer.polygonsSource],
      ['route', mapContainer.routesSource],
    ] as const;
    return mapContainer.map.value!.forEachFeatureAtPixel(
      pixel,
      (feature) => {
        const id = feature.getId();
        if (typeof id !== 'string') return;
        for (const [type, source] of sources) {
          if (source.value?.getFeatureById(id) === feature && ui.isElementVisible(type, id))
            return { type, id };
        }
      },
      { hitTolerance: 5 }
    );
  }

  function maskCraters(event: RenderEvent) {
    const ctx = event.context;
    const map = mapContainer.map.value;
    if (!(ctx instanceof CanvasRenderingContext2D) || !map) return;
    const resolution = map.getView().getResolution()!;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    for (const crater of craters) {
      const pixel = map.getPixelFromCoordinate(crater.coordinate);
      const center = getRenderPixel(event, pixel);
      const edge = getRenderPixel(event, [pixel[0]! + crater.radius / resolution, pixel[1]!]);
      ctx.beginPath();
      ctx.arc(
        center[0]!,
        center[1]!,
        Math.hypot(edge[0]! - center[0]!, edge[1]! - center[1]!),
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    ctx.restore();
  }

  function impact(position: Coordinate) {
    const map = mapContainer.map.value!;
    blasts.push({ coordinate: [...position], age: 0 });
    craters.push({ coordinate: [...position], radius: 22 * map.getView().getResolution()! });
    if (craters.length > 200) craters.shift();
    for (const layer of maskedLayers) layer.changed();
  }

  function updateShots(dt: number) {
    const map = mapContainer.map.value!;
    for (let index = shots.length - 1; index >= 0; index--) {
      const shot = shots[index]!;
      const distance = Math.min(650 * dt, SHELL_RANGE - shot.distance);
      const steps = Math.max(1, Math.ceil(distance / 4));
      let impacted = false;
      for (let step = 0; step < steps; step++) {
        shot.coordinate = move(shot.coordinate, shot.angle, distance / steps);
        shot.distance += distance / steps;
        const target = hit(map.getPixelFromCoordinate(shot.coordinate));
        if (!target) continue;
        damagedElements.push(target);
        void drawing.updateElementVisibility(target.type, target.id, false);
        noteTooltips.value?.updateNoteTooltips();
        impacted = true;
        break;
      }
      if (impacted || shot.distance >= SHELL_RANGE - 0.001) {
        impact(shot.coordinate);
        shots.splice(index, 1);
      }
    }
    for (let index = blasts.length - 1; index >= 0; index--) {
      blasts[index]!.age += dt;
      if (blasts[index]!.age > 0.4) blasts.splice(index, 1);
    }
  }

  function drawCraters(ctx: CanvasRenderingContext2D) {
    const map = mapContainer.map.value!;
    const resolution = map.getView().getResolution()!;
    for (const crater of craters) {
      const [x, y] = map.getPixelFromCoordinate(crater.coordinate) as [number, number];
      const radius = crater.radius / resolution;
      const rim = ctx.createRadialGradient(x, y, radius * 0.6, x, y, radius * 1.35);
      rim.addColorStop(0, '#111418');
      rim.addColorStop(0.7, '#302923');
      rim.addColorStop(0.85, '#81705a');
      rim.addColorStop(1, 'rgba(71, 54, 36, 0)');
      ctx.fillStyle = rim;
      ctx.beginPath();
      ctx.arc(x, y, radius * 1.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(218, 192, 143, 0.55)';
      ctx.lineWidth = Math.max(1, radius * 0.08);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0.15, 2.6);
      ctx.stroke();
    }
  }

  function render() {
    const surface = canvas.value;
    const map = mapContainer.map.value!;
    if (!surface) return;
    const { rect } = visibleArea();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(rect.width * ratio);
    const height = Math.round(rect.height * ratio);
    if (surface.width !== width || surface.height !== height) {
      surface.width = width;
      surface.height = height;
    }
    Object.assign(surface.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
    const ctx = surface.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    drawCraters(ctx);
    for (const shot of shots) {
      const [x, y] = map.getPixelFromCoordinate(shot.coordinate);
      const height = Math.sin((Math.PI * shot.distance) / SHELL_RANGE) * 55;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      ctx.ellipse(x!, y!, 4, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff2a6';
      ctx.strokeStyle = '#e67e22';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x!, y! - height, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    for (const blast of blasts) {
      const [x, y] = map.getPixelFromCoordinate(blast.coordinate);
      ctx.strokeStyle = `rgba(255, 130, 30, ${1 - blast.age / 0.4})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(x!, y!, 7 + blast.age * 70, 0, Math.PI * 2);
      ctx.stroke();
    }
    const pixel = map.getPixelFromCoordinate(coordinate);
    tankPosition.value = {
      x: rect.left + pixel[0]!,
      y: rect.top + pixel[1]!,
      angle: (angle * 180) / Math.PI + 90,
    };
  }

  function tick(time: number) {
    if (!ui.gameMode || !mapContainer.map.value) return;
    const dt = Math.min((time - previousTime) / 1000, 0.05);
    previousTime = time;
    const dx = Number(pressed('right')) - Number(pressed('left'));
    const dy = Number(pressed('down')) - Number(pressed('up'));
    if (dx || dy) {
      angle = Math.atan2(dy, dx);
      coordinate = move(coordinate, angle, 210 * dt);
      followTank();
    }
    if ((pendingFire || pressed('fire')) && time - lastShot >= 180) {
      shots.push({ coordinate: move(coordinate, angle, 29), angle, distance: 0 });
      lastShot = time;
      pendingFire = false;
    }
    updateShots(dt);
    render();
    frame = requestAnimationFrame(tick);
  }

  function stop() {
    cancelAnimationFrame(frame);
    clearKeys();
    directions.clear();
    shots.length = 0;
    blasts.length = 0;
    craters.length = 0;
    for (const { type, id } of damagedElements) {
      if (ui.isElementVisible(type, id)) void drawing.updateElementVisibility(type, id, true);
    }
    damagedElements.length = 0;
    noteTooltips.value?.updateNoteTooltips();
    for (const layer of maskedLayers) {
      layer.un('postrender', maskCraters);
      layer.changed();
    }
    maskedLayers.length = 0;
  }

  watch(
    () => ui.gameMode,
    (active) => {
      stop();
      const map = mapContainer.map.value;
      if (!active || !map) return;
      map.getView().cancelAnimations();
      for (const layer of map.getAllLayers()) {
        if (layer instanceof TileLayer) {
          layer.on('postrender', maskCraters);
          maskedLayers.push(layer);
        }
      }
      const area = visibleArea();
      coordinate = map.getCoordinateFromPixel([
        (area.left + area.right) / 2,
        (area.top + area.bottom) / 2,
      ]);
      angle = -Math.PI / 2;
      previousTime = performance.now();
      lastShot = 0;
      render();
      frame = requestAnimationFrame(tick);
    },
    { flush: 'post' }
  );
  watch(
    () => [projects.activeProjectId, projects.activeProjection],
    () => {
      ui.gameMode = false;
    }
  );
  watch(
    () => ui.openModals.size,
    (count) => {
      if (count) ui.gameMode = false;
    }
  );

  onMounted(() => {
    document.addEventListener('keydown', recordKey, true);
    document.addEventListener('keyup', keyup, true);
    document.addEventListener('focusin', clearKeys);
    window.addEventListener('blur', clearKeys);
    document.addEventListener('visibilitychange', clearKeys);
  });
  onBeforeUnmount(() => {
    ui.gameMode = false;
    stop();
    document.removeEventListener('keydown', recordKey, true);
    document.removeEventListener('keyup', keyup, true);
    document.removeEventListener('focusin', clearKeys);
    window.removeEventListener('blur', clearKeys);
    document.removeEventListener('visibilitychange', clearKeys);
  });
  return { tankPosition };
}
