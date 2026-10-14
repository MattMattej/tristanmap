/**
 * Capas propias del proyecto sobre el mapa base: zona de la feria,
 * zonas (áreas), franjas (líneas), textos y puntos. Compartidas por el mapa
 * público y el editor, para que lo que ve la diseñadora sea idéntico
 * a lo que ve el público.
 */
import type { GeoJSONSource, Map as MLMap } from 'maplibre-gl';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { LegendItem, MapData, MapFeature, Settings } from '@/lib/schemas';
import { FONT_BOLD, FONT_REGULAR, OVERLAY_ANCHOR } from './baseStyle';
import { ensurePinImages, PIN_W, pinImageId } from './pins';

export const SRC = {
  focus: 'tm-focus',
  areas: 'tm-areas',
  lines: 'tm-lines',
  labels: 'tm-labels',
  points: 'tm-points',
} as const;

export const LAYER = {
  focusDim: 'tm-focus-dim',
  focusLine: 'tm-focus-line',
  areaFill: 'tm-area-fill',
  areaLine: 'tm-area-line',
  areaSelected: 'tm-area-selected',
  lineSelected: 'tm-line-selected',
  lineSolid: 'tm-line-solid',
  lineDashed: 'tm-line-dashed',
  lineDotted: 'tm-line-dotted',
  lineHit: 'tm-line-hit',
  label: 'tm-label',
  points: 'tm-points',
  pointSelected: 'tm-point-selected',
} as const;

/** Capas que responden a clics (para detalle o selección). */
export const CLICKABLE_LAYERS = [LAYER.pointSelected, LAYER.points, LAYER.label, LAYER.lineHit, LAYER.areaFill];

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

/**
 * Ancho que escala con el zoom igual que las calles: `px` a zoom 17.
 * (MapLibre exige que la interpolación por zoom sea la expresión externa,
 * por eso el "extra" y el mínimo se aplican dentro de cada parada.)
 */
const zoomScaled = (prop: string, extra = 0, min = -Infinity) => {
  const stops: [number, number][] = [[13, 0.1], [15, 0.33], [17, 1], [19, 3], [21, 9]];
  const at = (k: number) => {
    const v = ['+', ['*', ['get', prop], k], extra];
    return Number.isFinite(min) ? ['max', min, v] : v;
  };
  return ['interpolate', ['exponential', 1.6], ['zoom'], ...stops.flatMap(([z, k]) => [z, at(k)])];
};

export function addOverlayLayers(map: MLMap) {
  for (const id of Object.values(SRC)) {
    if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: EMPTY, promoteId: 'id' });
  }
  const before = map.getLayer(OVERLAY_ANCHOR) ? OVERLAY_ANCHOR : undefined;
  const add = (layer: Parameters<MLMap['addLayer']>[0], beforeId = before) => {
    if (!map.getLayer(layer.id)) map.addLayer(layer, beforeId);
  };

  add({ id: LAYER.focusDim, type: 'fill', source: SRC.focus, filter: ['==', ['get', 'role'], 'mask'], paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['get', 'opacity'] } });
  add({
    id: LAYER.focusLine,
    type: 'line',
    source: SRC.focus,
    filter: ['==', ['get', 'role'], 'outline'],
    layout: { 'line-join': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': 2, 'line-dasharray': [2, 2], 'line-opacity': 0.7 },
  });

  add({ id: LAYER.areaFill, type: 'fill', source: SRC.areas, paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['get', 'opacity'] } });
  add({
    id: LAYER.areaLine,
    type: 'line',
    source: SRC.areas,
    layout: { 'line-join': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'width'], 'line-opacity': ['min', 1, ['+', ['get', 'opacity'], 0.5]] },
  });
  add({
    id: LAYER.areaSelected,
    type: 'line',
    source: SRC.areas,
    filter: ['==', ['get', 'id'], ''],
    paint: { 'line-color': '#111111', 'line-width': 2, 'line-dasharray': [3, 2] },
  });

  add({
    id: LAYER.lineSelected,
    type: 'line',
    source: SRC.lines,
    filter: ['==', ['get', 'id'], ''],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#111111',
      'line-opacity': 0.35,
      'line-offset': zoomScaled('offset') as never,
      'line-width': zoomScaled('width', 8) as never,
      'line-blur': 2,
    },
  });
  const dashes: [string, 'solid' | 'dashed' | 'dotted', number[] | null][] = [
    [LAYER.lineSolid, 'solid', null],
    [LAYER.lineDashed, 'dashed', [2, 1.5]],
    [LAYER.lineDotted, 'dotted', [0, 2]],
  ];
  for (const [id, dash, array] of dashes) {
    add({
      id,
      type: 'line',
      source: SRC.lines,
      filter: ['==', ['get', 'dash'], dash],
      layout: { 'line-cap': dash === 'dotted' ? 'round' : 'butt', 'line-join': 'round' },
      paint: {
        'line-color': ['get', 'color'],
        'line-opacity': ['get', 'opacity'],
        'line-width': zoomScaled('width') as never,
        'line-offset': zoomScaled('offset') as never,
        ...(array ? { 'line-dasharray': array } : {}),
      },
    });
  }
  // Capa invisible y ancha para que sea fácil tocar una franja con el dedo.
  add({
    id: LAYER.lineHit,
    type: 'line',
    source: SRC.lines,
    paint: { 'line-color': '#000', 'line-opacity': 0, 'line-width': zoomScaled('width', 0, 18) as never, 'line-offset': zoomScaled('offset') as never },
  });

  add(
    {
      id: LAYER.label,
      type: 'symbol',
      source: SRC.labels,
      layout: {
        'text-field': ['get', 'text'],
        'text-font': FONT_BOLD,
        'text-size': ['interpolate', ['exponential', 1.5], ['zoom'], 15, ['*', ['get', 'size'], 0.6], 17, ['get', 'size'], 20, ['*', ['get', 'size'], 2.2]],
        'text-rotate': ['get', 'rotation'],
        'text-rotation-alignment': 'map',
        'text-letter-spacing': 0.08,
        'text-allow-overlap': true,
        'text-ignore-placement': true,
        'text-max-width': 14,
      },
      paint: { 'text-color': ['get', 'color'], 'text-halo-color': ['get', 'halo'], 'text-halo-width': 2 },
    },
    undefined,
  );

  // Puntos: símbolos WebGL que escalan con el zoom (el tamaño se fija en setPointSize)
  const pointLayout = {
    'icon-anchor': 'bottom',
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
    'symbol-z-order': 'viewport-y',
    'text-field': ['get', 'label'],
    'text-font': FONT_REGULAR,
    'text-size': 11.5,
    'text-anchor': 'top',
    'text-offset': [0, 0.25],
    'text-optional': true,
    'text-max-width': 9,
  } as const;
  add(
    {
      id: LAYER.points,
      type: 'symbol',
      source: SRC.points,
      filter: ['!=', ['get', 'id'], ''],
      layout: { ...pointLayout, 'icon-image': ['get', 'img'] },
      paint: { 'icon-opacity': ['get', 'opacity'], 'text-color': '#1f2a2e', 'text-halo-color': '#fffdf8', 'text-halo-width': 1.6 },
    } as never,
    undefined,
  );
  add(
    {
      id: LAYER.pointSelected,
      type: 'symbol',
      source: SRC.points,
      filter: ['==', ['get', 'id'], ''],
      layout: { ...pointLayout, 'icon-image': ['get', 'imgSel'], 'text-field': ['get', 'title'], 'text-font': FONT_BOLD },
      paint: { 'text-color': '#1f2a2e', 'text-halo-color': '#fffdf8', 'text-halo-width': 1.8 },
    } as never,
    undefined,
  );
  setPointSize(map, 36);
}

/** Tamaño de los puntos: `size` px a zoom 17.5; más chicos al alejarse y más grandes al acercarse. */
export function setPointSize(map: MLMap, size: number) {
  const k = size / PIN_W;
  const scale = (f: number) => ['interpolate', ['linear'], ['zoom'], 13, k * 0.4 * f, 15, k * 0.62 * f, 17.5, k * f, 20, k * 1.3 * f];
  if (map.getLayer(LAYER.points)) map.setLayoutProperty(LAYER.points, 'icon-size', scale(1) as never);
  if (map.getLayer(LAYER.pointSelected)) map.setLayoutProperty(LAYER.pointSelected, 'icon-size', scale(1.25) as never);
}

function legendProps(legend: LegendItem | undefined) {
  return {
    color: legend?.color ?? '#888888',
    width: legend?.width ?? 6,
    opacity: legend?.opacity ?? 0.8,
    dash: legend?.dash ?? 'solid',
    legendName: legend?.name ?? 'Sin leyenda',
  };
}

const geo = (f: MapFeature, properties: Record<string, unknown>): Feature<Geometry> => ({
  type: 'Feature',
  id: f.id,
  properties: { id: f.id, kind: f.kind, title: f.title, ...properties },
  geometry: f.geometry as Geometry,
});

export interface OverlayOptions {
  /** Ítems de leyenda ocultos por el filtro del usuario. */
  hiddenLegend?: Set<string>;
  /** Categorías de puntos ocultas por el filtro del usuario. */
  hiddenCategories?: Set<string>;
  /** En el editor se muestran también borradores (con menor opacidad). */
  includeDrafts?: boolean;
}

export function buildOverlayData(data: Pick<MapData, 'features' | 'legend' | 'categories' | 'settings'>, opts: OverlayOptions = {}) {
  const legendById = new Map(data.legend.map((l) => [l.id, l]));
  const catById = new Map(data.categories.map((c) => [c.id, c]));
  const showLabels = data.settings.markers.showLabels;
  const points: Feature[] = [];
  const lines: Feature[] = [];
  const areas: Feature[] = [];
  const labels: Feature[] = [];
  for (const f of data.features) {
    if (!f.published && !opts.includeDrafts) continue;
    const draftFactor = f.published ? 1 : 0.5;
    if (f.kind === 'point') {
      if (f.categoryId && opts.hiddenCategories?.has(f.categoryId)) continue;
      const cat = f.categoryId ? catById.get(f.categoryId) : undefined;
      points.push(
        geo(f, {
          img: pinImageId(cat),
          imgSel: pinImageId(cat, true),
          opacity: draftFactor,
          label: showLabels ? f.title : '',
        }),
      );
    } else if (f.kind === 'line' || f.kind === 'area') {
      if (f.legendId && opts.hiddenLegend?.has(f.legendId)) continue;
      const p = legendProps(f.legendId ? legendById.get(f.legendId) : undefined);
      const props = { ...p, opacity: p.opacity * draftFactor, offset: f.style.offset ?? 0, legendId: f.legendId };
      if (f.kind === 'line') lines.push(geo(f, props));
      else areas.push(geo(f, { ...props, width: Math.min(p.width, 4) }));
    } else if (f.kind === 'label' && f.title.trim()) {
      labels.push(
        geo(f, {
          text: f.title,
          size: f.style.textSize ?? 14,
          color: f.style.textColor ?? '#1f2a2e',
          halo: f.style.haloColor ?? '#ffffff',
          rotation: f.style.rotation ?? 0,
        }),
      );
    }
  }
  const fc = (features: Feature[]): FeatureCollection => ({ type: 'FeatureCollection', features });
  return { points: fc(points), lines: fc(lines), areas: fc(areas), labels: fc(labels) };
}

const WORLD = [
  [-180, -85],
  [180, -85],
  [180, 85],
  [-180, 85],
  [-180, -85],
];

export function buildFocusData(focus: Settings['focus']): FeatureCollection {
  if (!focus.polygon || focus.enabled === false) return EMPTY;
  const showOutline = focus.showOutline !== false;
  return {
    type: 'FeatureCollection',
    features: ([
      {
        type: 'Feature',
        properties: { id: 'mask', role: 'mask', color: focus.dimColor, opacity: focus.dimOpacity },
        geometry: { type: 'Polygon', coordinates: [WORLD, focus.polygon] },
      },
      {
        type: 'Feature',
        properties: { id: 'outline', role: 'outline', color: focus.outlineColor },
        geometry: { type: 'LineString', coordinates: focus.polygon },
      },
    ] as Feature[]).filter((f) => showOutline || f.properties?.role !== 'outline'),
  };
}

export function setSourceData(map: MLMap, source: string, data: FeatureCollection) {
  (map.getSource(source) as GeoJSONSource | undefined)?.setData(data);
}

export async function renderOverlays(map: MLMap, data: Pick<MapData, 'features' | 'legend' | 'settings' | 'categories'>, opts: OverlayOptions = {}) {
  const built = buildOverlayData(data, opts);
  setSourceData(map, SRC.lines, built.lines);
  setSourceData(map, SRC.areas, built.areas);
  setSourceData(map, SRC.labels, built.labels);
  setSourceData(map, SRC.focus, buildFocusData(data.settings.focus));
  setPointSize(map, data.settings.markers.size);
  // Las imágenes de los pines se generan antes de mostrar los puntos.
  await ensurePinImages(map, data.categories);
  setSourceData(map, SRC.points, built.points);
}

export function highlightSelection(map: MLMap, id: string | null) {
  const filter = ['==', ['get', 'id'], id ?? ''] as never;
  if (map.getLayer(LAYER.lineSelected)) map.setFilter(LAYER.lineSelected, filter);
  if (map.getLayer(LAYER.areaSelected)) map.setFilter(LAYER.areaSelected, filter);
  if (map.getLayer(LAYER.pointSelected)) map.setFilter(LAYER.pointSelected, filter);
  if (map.getLayer(LAYER.points)) map.setFilter(LAYER.points, ['!=', ['get', 'id'], id ?? ''] as never);
}
