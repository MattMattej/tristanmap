/**
 * Motor de dibujo del editor (sin dependencias externas).
 *
 * Herramientas:
 *  - select : seleccionar elementos y editar vértices arrastrando
 *  - point  : agregar un punto (puesto, pique...)
 *  - label  : agregar un texto sobre el mapa
 *  - line   : dibujar una franja (clic por vértice, doble clic / Enter termina)
 *  - area   : dibujar una zona (clic en el primer vértice o Enter cierra)
 *  - cuadra : pintar una cuadra entera con un clic
 *  - focus  : dibujar la "zona de la feria"
 *
 * El imán (snap) pega los vértices a las calles reales (cuadras de OSM).
 */
import type { GeoJSONSource, Map as MLMap, MapLayerMouseEvent, MapMouseEvent, PointLike } from 'maplibre-gl';
import type { Feature, FeatureCollection, LineString } from 'geojson';
import { CLICKABLE_LAYERS, LAYER } from '@/components/map/overlays';

export type Tool = 'select' | 'point' | 'label' | 'line' | 'area' | 'cuadra' | 'focus';
export type Pos = [number, number];

export interface Editable {
  id: string;
  kind: 'line' | 'area' | 'label';
  /** Vértices (en zonas, sin repetir el primero al final). */
  coords: Pos[];
}

export interface DrawCallbacks {
  onPoint(pos: Pos): void;
  onLabel(pos: Pos): void;
  onLine(coords: Pos[], source: 'draw' | 'cuadra'): void;
  onArea(ring: Pos[]): void;
  onFocus(ring: Pos[]): void;
  onSelect(id: string | null): void;
  onGeometryPreview(id: string, coords: Pos[]): void;
  onGeometryCommit(id: string): void;
  onDrawingChange(vertices: number): void;
}

const S = {
  cuadras: 'ed-cuadras',
  draw: 'ed-draw',
  handles: 'ed-handles',
  snap: 'ed-snap',
} as const;

const L = {
  cuadras: 'ed-cuadras-line',
  cuadrasHover: 'ed-cuadras-hover',
  drawFill: 'ed-draw-fill',
  drawLine: 'ed-draw-line',
  drawVertex: 'ed-draw-vertex',
  handleMid: 'ed-handle-mid',
  handleVertex: 'ed-handle-vertex',
  snap: 'ed-snap',
} as const;

const ACCENT = '#d9572b';
const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };
const DRAWING_TOOLS: Tool[] = ['line', 'area', 'focus'];
const SNAP_PX = 12;
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
const toPos = (l: { lng: number; lat: number }): Pos => [round6(l.lng), round6(l.lat)];

interface Cuadra {
  coords: Pos[];
  bbox: [number, number, number, number];
}

export class DrawController {
  private tool: Tool = 'select';
  private snapEnabled = true;
  private vertices: Pos[] = [];
  private cursor: Pos | null = null;
  private editable: Editable | null = null;
  private drag: { index: number } | null = null;
  private pointDrag: { id: string; x: number; y: number; moved: boolean } | null = null;
  private suppressClick = false;
  private cuadras: Cuadra[] = [];
  private cuadraById = new Map<string, Pos[]>();
  private hoverCuadra: string | null = null;

  constructor(
    private map: MLMap,
    private cb: DrawCallbacks,
  ) {
    this.addLayers();
    map.on('click', this.onClick);
    map.on('dblclick', this.onDblClick);
    map.on('mousemove', this.onMove);
    map.on('mousedown', L.handleVertex, this.onHandleDown);
    map.on('mousedown', L.handleMid, this.onMidDown);
    map.on('mousedown', this.onPointDown);
    map.on('contextmenu', L.handleVertex, this.onHandleDelete);
  }

  destroy() {
    this.map.off('click', this.onClick);
    this.map.off('dblclick', this.onDblClick);
    this.map.off('mousemove', this.onMove);
    this.map.off('mousedown', L.handleVertex, this.onHandleDown);
    this.map.off('mousedown', L.handleMid, this.onMidDown);
    this.map.off('mousedown', this.onPointDown);
    this.map.off('contextmenu', L.handleVertex, this.onHandleDelete);
  }

  // ─── API pública ──────────────────────────────────────────────────────────
  setTool(tool: Tool) {
    this.tool = tool;
    this.cancel();
    const showCuadras = tool === 'cuadra' || (this.snapEnabled && DRAWING_TOOLS.includes(tool));
    this.map.setLayoutProperty(L.cuadras, 'visibility', showCuadras ? 'visible' : 'none');
    this.map.setPaintProperty(L.cuadras, 'line-opacity', tool === 'cuadra' ? 0.35 : 0.14);
    this.map.setLayoutProperty(L.cuadrasHover, 'visibility', tool === 'cuadra' ? 'visible' : 'none');
    if (tool === 'select') this.map.doubleClickZoom.enable();
    else this.map.doubleClickZoom.disable();
    this.map.getCanvas().style.cursor = tool === 'select' ? '' : 'crosshair';
    this.renderHandles();
  }

  setSnap(enabled: boolean) {
    this.snapEnabled = enabled;
    this.setTool(this.tool);
  }

  setCuadras(fc: FeatureCollection<LineString>) {
    this.cuadraById.clear();
    this.cuadras = fc.features.map((f) => {
      const coords = f.geometry.coordinates as Pos[];
      this.cuadraById.set(f.properties?.id as string, coords);
      const xs = coords.map((c) => c[0]);
      const ys = coords.map((c) => c[1]);
      return { coords, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
    });
    this.source(S.cuadras)?.setData(fc);
  }

  setEditable(editable: Editable | null) {
    if (this.drag) return; // durante el arrastre manda el controlador
    this.editable = editable ? { ...editable, coords: editable.coords.map((c) => [...c] as Pos) } : null;
    this.renderHandles();
  }

  get isDrawing() {
    return this.vertices.length > 0;
  }

  /** Termina el dibujo en curso (Enter o doble clic). */
  finish() {
    const pts = dedupe(this.vertices);
    const tool = this.tool;
    if (tool === 'line' && pts.length >= 2) this.cb.onLine(pts, 'draw');
    else if ((tool === 'area' || tool === 'focus') && pts.length >= 3) {
      const ring = [...pts, pts[0]];
      if (tool === 'area') this.cb.onArea(ring);
      else this.cb.onFocus(ring);
    } else if (pts.length > 0) return; // faltan vértices: seguimos dibujando
    this.cancel();
  }

  cancel() {
    this.vertices = [];
    this.cursor = null;
    this.renderDraft();
    this.source(S.snap)?.setData(EMPTY);
    this.cb.onDrawingChange(0);
  }

  /** Borra el último vértice (Backspace). */
  undoVertex() {
    this.vertices.pop();
    this.renderDraft();
    this.cb.onDrawingChange(this.vertices.length);
  }

  // ─── Capas auxiliares ─────────────────────────────────────────────────────
  private source(id: string) {
    return this.map.getSource(id) as GeoJSONSource | undefined;
  }

  private addLayers() {
    const m = this.map;
    m.addSource(S.cuadras, { type: 'geojson', data: EMPTY });
    m.addSource(S.draw, { type: 'geojson', data: EMPTY });
    m.addSource(S.handles, { type: 'geojson', data: EMPTY });
    m.addSource(S.snap, { type: 'geojson', data: EMPTY });
    m.addLayer({
      id: L.cuadras,
      type: 'line',
      source: S.cuadras,
      layout: { visibility: 'none', 'line-cap': 'round' },
      paint: { 'line-color': '#2f6fb2', 'line-opacity': 0.14, 'line-width': ['interpolate', ['linear'], ['zoom'], 15, 4, 18, 14] },
    });
    m.addLayer({
      id: L.cuadrasHover,
      type: 'line',
      source: S.cuadras,
      filter: ['==', ['get', 'id'], ''],
      layout: { visibility: 'none', 'line-cap': 'round' },
      paint: { 'line-color': ACCENT, 'line-opacity': 0.85, 'line-width': ['interpolate', ['linear'], ['zoom'], 15, 5, 18, 16] },
    });
    m.addLayer({ id: L.drawFill, type: 'fill', source: S.draw, filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': ACCENT, 'fill-opacity': 0.15 } });
    m.addLayer({
      id: L.drawLine,
      type: 'line',
      source: S.draw,
      filter: ['==', ['geometry-type'], 'LineString'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ACCENT, 'line-width': 3, 'line-dasharray': [2, 1.5] },
    });
    m.addLayer({
      id: L.drawVertex,
      type: 'circle',
      source: S.draw,
      filter: ['==', ['geometry-type'], 'Point'],
      paint: { 'circle-radius': 5, 'circle-color': '#ffffff', 'circle-stroke-color': ACCENT, 'circle-stroke-width': 2.5 },
    });
    m.addLayer({
      id: L.handleMid,
      type: 'circle',
      source: S.handles,
      filter: ['==', ['get', 'role'], 'mid'],
      paint: { 'circle-radius': 4.5, 'circle-color': ACCENT, 'circle-opacity': 0.55, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5 },
    });
    m.addLayer({
      id: L.handleVertex,
      type: 'circle',
      source: S.handles,
      filter: ['==', ['get', 'role'], 'vertex'],
      paint: { 'circle-radius': 6.5, 'circle-color': '#ffffff', 'circle-stroke-color': ACCENT, 'circle-stroke-width': 2.5 },
    });
    m.addLayer({
      id: L.snap,
      type: 'circle',
      source: S.snap,
      paint: { 'circle-radius': 9, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#2f6fb2', 'circle-stroke-width': 2.5 },
    });
  }

  private renderDraft() {
    const pts = this.cursor ? [...this.vertices, this.cursor] : this.vertices;
    const features: Feature[] = this.vertices.map((c) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: c } }));
    if (pts.length >= 2) {
      const closed = this.tool !== 'line' && pts.length >= 3;
      features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: closed ? [...pts, pts[0]] : pts } });
      if (closed) features.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...pts, pts[0]]] } });
    }
    this.source(S.draw)?.setData({ type: 'FeatureCollection', features });
  }

  private renderHandles() {
    const e = this.editable;
    if (!e || this.tool !== 'select') {
      this.source(S.handles)?.setData(EMPTY);
      return;
    }
    const features: Feature[] = e.coords.map((c, index) => ({
      type: 'Feature',
      properties: { role: 'vertex', index },
      geometry: { type: 'Point', coordinates: c },
    }));
    if (e.kind !== 'label') {
      const n = e.coords.length;
      const segments = e.kind === 'area' ? n : n - 1;
      for (let i = 0; i < segments; i++) {
        const a = e.coords[i];
        const b = e.coords[(i + 1) % n];
        features.push({
          type: 'Feature',
          properties: { role: 'mid', index: i },
          geometry: { type: 'Point', coordinates: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] },
        });
      }
    }
    this.source(S.handles)?.setData({ type: 'FeatureCollection', features });
  }

  // ─── Imán a las calles ────────────────────────────────────────────────────
  private snap(e: MapMouseEvent): { pos: Pos; snapped: boolean } {
    const raw = toPos(e.lngLat);
    if (!this.snapEnabled || !this.cuadras.length || e.originalEvent.altKey) return { pos: raw, snapped: false };
    const p = e.point;
    const a = this.map.unproject([p.x - SNAP_PX * 1.5, p.y - SNAP_PX * 1.5]);
    const b = this.map.unproject([p.x + SNAP_PX * 1.5, p.y + SNAP_PX * 1.5]);
    const [w, east] = [Math.min(a.lng, b.lng), Math.max(a.lng, b.lng)];
    const [s, n] = [Math.min(a.lat, b.lat), Math.max(a.lat, b.lat)];

    let bestVertex: { d: number; pos: Pos } | null = null;
    let bestEdge: { d: number; x: number; y: number } | null = null;
    for (const c of this.cuadras) {
      if (c.bbox[0] > east || c.bbox[2] < w || c.bbox[1] > n || c.bbox[3] < s) continue;
      const pts = c.coords.map((co) => this.map.project(co));
      pts.forEach((q, i) => {
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d <= SNAP_PX * 1.3 && (!bestVertex || d < bestVertex.d)) bestVertex = { d, pos: c.coords[i] };
      });
      for (let i = 0; i < pts.length - 1; i++) {
        const [q1, q2] = [pts[i], pts[i + 1]];
        const dx = q2.x - q1.x;
        const dy = q2.y - q1.y;
        const len2 = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((p.x - q1.x) * dx + (p.y - q1.y) * dy) / len2));
        const x = q1.x + t * dx;
        const y = q1.y + t * dy;
        const d = Math.hypot(x - p.x, y - p.y);
        if (d <= SNAP_PX && (!bestEdge || d < bestEdge.d)) bestEdge = { d, x, y };
      }
    }
    // Las esquinas tienen prioridad sobre los bordes.
    const v = bestVertex as { d: number; pos: Pos } | null;
    if (v) return { pos: v.pos, snapped: true };
    const ed = bestEdge as { d: number; x: number; y: number } | null;
    if (ed) return { pos: toPos(this.map.unproject([ed.x, ed.y])), snapped: true };
    return { pos: raw, snapped: false };
  }

  private showSnap(pos: Pos | null) {
    this.source(S.snap)?.setData(
      pos ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: pos } }] } : EMPTY,
    );
  }

  private queryBox(p: { x: number; y: number }, pad = 6): [PointLike, PointLike] {
    return [
      [p.x - pad, p.y - pad],
      [p.x + pad, p.y + pad],
    ];
  }

  private cuadraAt(e: MapMouseEvent) {
    return this.map.queryRenderedFeatures(this.queryBox(e.point, 10), { layers: [L.cuadras] })[0];
  }

  private overlayAt(e: MapMouseEvent) {
    const layers = CLICKABLE_LAYERS.filter((l) => this.map.getLayer(l));
    return this.map.queryRenderedFeatures(this.queryBox(e.point, 3), { layers })[0];
  }

  private handleAt(e: MapMouseEvent) {
    return this.map.queryRenderedFeatures(this.queryBox(e.point, 4), { layers: [L.handleVertex, L.handleMid] })[0];
  }

  // ─── Eventos ──────────────────────────────────────────────────────────────
  private onClick = (e: MapMouseEvent) => {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    switch (this.tool) {
      case 'select': {
        if (this.handleAt(e)) return;
        const hit = this.overlayAt(e);
        this.cb.onSelect((hit?.properties?.id as string) ?? null);
        return;
      }
      case 'point':
        this.cb.onPoint(toPos(e.lngLat));
        return;
      case 'label':
        this.cb.onLabel(toPos(e.lngLat));
        return;
      case 'cuadra': {
        const hit = this.cuadraAt(e);
        if (hit?.geometry.type === 'LineString') {
          // queryRenderedFeatures devuelve geometría recortada por tesela:
          // usamos la original guardada para la cuadra.
          const id = hit.properties?.id as string;
          const original = this.cuadraById.get(id);
          this.cb.onLine(original ?? (hit.geometry.coordinates as Pos[]), 'cuadra');
        }
        return;
      }
      default: {
        // line / area / focus
        const { pos } = this.snap(e);
        if (this.tool !== 'line' && this.vertices.length >= 3) {
          const first = this.map.project(this.vertices[0]);
          if (Math.hypot(first.x - e.point.x, first.y - e.point.y) < 10) {
            this.finish();
            return;
          }
        }
        this.vertices.push(pos);
        this.renderDraft();
        this.cb.onDrawingChange(this.vertices.length);
      }
    }
  };

  private onDblClick = (e: MapMouseEvent) => {
    if (DRAWING_TOOLS.includes(this.tool)) {
      e.preventDefault();
      this.finish();
    }
  };

  private onMove = (e: MapMouseEvent) => {
    const canvas = this.map.getCanvas();
    if (this.pointDrag) {
      const d = this.pointDrag;
      if (!d.moved && Math.hypot(e.point.x - d.x, e.point.y - d.y) < 4) return;
      d.moved = true;
      canvas.style.cursor = 'grabbing';
      this.cb.onGeometryPreview(d.id, [toPos(e.lngLat)]);
      return;
    }
    if (this.drag && this.editable) {
      const { pos, snapped } = this.editable.kind === 'label' ? { pos: toPos(e.lngLat), snapped: false } : this.snap(e);
      this.editable.coords[this.drag.index] = pos;
      this.showSnap(snapped ? pos : null);
      this.renderHandles();
      this.cb.onGeometryPreview(this.editable.id, this.editable.coords);
      return;
    }
    if (DRAWING_TOOLS.includes(this.tool)) {
      const { pos, snapped } = this.snap(e);
      this.cursor = pos;
      this.showSnap(snapped ? pos : null);
      if (this.vertices.length) this.renderDraft();
      return;
    }
    if (this.tool === 'cuadra') {
      const id = (this.cuadraAt(e)?.properties?.id as string) ?? null;
      if (id !== this.hoverCuadra) {
        this.hoverCuadra = id;
        this.map.setFilter(L.cuadrasHover, ['==', ['get', 'id'], id ?? '']);
      }
      canvas.style.cursor = id ? 'pointer' : 'crosshair';
      return;
    }
    if (this.tool === 'select') {
      canvas.style.cursor = this.handleAt(e) ? 'move' : this.overlayAt(e) ? 'pointer' : '';
    }
  };

  private startDrag(index: number) {
    this.drag = { index };
    this.map.dragPan.disable();
    const end = () => {
      this.map.dragPan.enable();
      this.showSnap(null);
      const id = this.editable?.id;
      this.drag = null;
      this.suppressClick = true;
      setTimeout(() => (this.suppressClick = false), 50);
      if (id) this.cb.onGeometryCommit(id);
    };
    // Escuchamos en la ventana: el evento del mapa no siempre llega al soltar tras arrastrar.
    window.addEventListener('mouseup', end, { once: true });
  }

  /** Puntos: clic los selecciona; arrastrar los mueve. */
  private onPointDown = (e: MapMouseEvent) => {
    if (this.tool !== 'select' || e.originalEvent.button !== 0 || this.handleAt(e)) return;
    const layers = [LAYER.pointSelected, LAYER.points].filter((l) => this.map.getLayer(l));
    const hit = this.map.queryRenderedFeatures(this.queryBox(e.point, 4), { layers })[0];
    const id = hit?.properties?.id as string | undefined;
    if (!id) return;
    e.preventDefault();
    this.cb.onSelect(id);
    this.pointDrag = { id, x: e.point.x, y: e.point.y, moved: false };
    this.map.dragPan.disable();
    window.addEventListener('mouseup', () => {
      const d = this.pointDrag;
      this.pointDrag = null;
      this.map.dragPan.enable();
      if (d?.moved) {
        this.suppressClick = true;
        setTimeout(() => (this.suppressClick = false), 50);
        this.cb.onGeometryCommit(d.id);
      }
    }, { once: true });
  };

  private onHandleDown = (e: MapLayerMouseEvent) => {
    if (this.tool !== 'select' || !this.editable || e.originalEvent.button !== 0) return;
    e.preventDefault();
    this.startDrag(e.features?.[0]?.properties?.index as number);
  };

  private onMidDown = (e: MapLayerMouseEvent) => {
    if (this.tool !== 'select' || !this.editable || e.originalEvent.button !== 0) return;
    e.preventDefault();
    const i = (e.features?.[0]?.properties?.index as number) + 1;
    this.editable.coords.splice(i, 0, toPos(e.lngLat));
    this.startDrag(i);
  };

  /** Clic derecho sobre un vértice: lo elimina. */
  private onHandleDelete = (e: MapLayerMouseEvent) => {
    const ed = this.editable;
    if (this.tool !== 'select' || !ed || ed.kind === 'label') return;
    e.preventDefault();
    const min = ed.kind === 'area' ? 3 : 2;
    if (ed.coords.length <= min) return;
    ed.coords.splice(e.features?.[0]?.properties?.index as number, 1);
    this.renderHandles();
    this.cb.onGeometryPreview(ed.id, ed.coords);
    this.cb.onGeometryCommit(ed.id);
  };
}

function dedupe(pts: Pos[]) {
  return pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
}
