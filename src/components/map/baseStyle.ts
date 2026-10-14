/**
 * Estilo del mapa base ("esqueleto"): calles, manzanas, edificios, agua y
 * nombres de calles, dibujados con nuestros propios colores sobre las
 * teselas vectoriales gratuitas de OpenFreeMap (esquema OpenMapTiles).
 *
 * Cada color sale de un token del tema (Settings.base) y se puede cambiar
 * en vivo desde el panel con applyBaseTheme(), sin recargar el mapa.
 */
import type { Map as MLMap, StyleSpecification } from 'maplibre-gl';
import type { BaseTheme } from '@/lib/schemas';

export const TILES_URL = 'https://tiles.openfreemap.org/planet';
export const GLYPHS_URL = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
export const FONT_REGULAR = ['Noto Sans Regular'];
export const FONT_BOLD = ['Noto Sans Bold'];

/** Capa antes de la cual se insertan franjas y zonas (quedan bajo los nombres de calles). */
export const OVERLAY_ANCHOR = 'street-labels';

const MAJOR = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'];
const MINOR = ['minor', 'service', 'track', 'raceway'];
const PATH = ['path', 'pedestrian', 'footway', 'cycleway'];

type Expr = unknown;
const width = (stops: [number, number][], factor: number, extra = 0): Expr => [
  'interpolate',
  ['exponential', 1.6],
  ['zoom'],
  ...stops.flatMap(([z, w]) => [z, w * factor + extra]),
];
const MAJOR_W: [number, number][] = [[13, 1.5], [15, 5], [17, 14], [19, 40], [21, 120]];
const MINOR_W: [number, number][] = [[13, 0.8], [15, 3], [17, 10], [19, 30], [21, 100]];
const PATH_W: [number, number][] = [[14, 0.6], [17, 3], [20, 10]];

/** Tabla única: qué propiedad de qué capa sale de qué token del tema. */
type Binding = { layer: string; kind: 'paint' | 'layout'; prop: string; value: (t: BaseTheme) => Expr };
const BINDINGS: Binding[] = [
  { layer: 'background', kind: 'paint', prop: 'background-color', value: (t) => t.background },
  { layer: 'park', kind: 'paint', prop: 'fill-color', value: (t) => t.park },
  { layer: 'landcover-green', kind: 'paint', prop: 'fill-color', value: (t) => t.park },
  { layer: 'water', kind: 'paint', prop: 'fill-color', value: (t) => t.water },
  { layer: 'building', kind: 'paint', prop: 'fill-color', value: (t) => t.building },
  { layer: 'building', kind: 'paint', prop: 'fill-opacity', value: (t) => t.buildingOpacity },
  { layer: 'building', kind: 'layout', prop: 'visibility', value: (t) => (t.showBuildings ? 'visible' : 'none') },
  { layer: 'road-casing-minor', kind: 'paint', prop: 'line-color', value: (t) => t.roadCasing },
  { layer: 'road-casing-minor', kind: 'paint', prop: 'line-width', value: (t) => width(MINOR_W, t.roadWidth, 1.5) },
  { layer: 'road-casing-major', kind: 'paint', prop: 'line-color', value: (t) => t.roadCasing },
  { layer: 'road-casing-major', kind: 'paint', prop: 'line-width', value: (t) => width(MAJOR_W, t.roadWidth, 1.5) },
  { layer: 'road-path', kind: 'paint', prop: 'line-color', value: (t) => t.roadPath },
  { layer: 'road-path', kind: 'paint', prop: 'line-width', value: (t) => width(PATH_W, t.roadWidth) },
  { layer: 'road-minor', kind: 'paint', prop: 'line-color', value: (t) => t.roadMinor },
  { layer: 'road-minor', kind: 'paint', prop: 'line-width', value: (t) => width(MINOR_W, t.roadWidth) },
  { layer: 'road-major', kind: 'paint', prop: 'line-color', value: (t) => t.roadMajor },
  { layer: 'road-major', kind: 'paint', prop: 'line-width', value: (t) => width(MAJOR_W, t.roadWidth) },
  { layer: 'street-labels', kind: 'paint', prop: 'text-color', value: (t) => t.streetLabel },
  { layer: 'street-labels', kind: 'paint', prop: 'text-halo-color', value: (t) => t.streetLabelHalo },
  {
    layer: 'street-labels',
    kind: 'layout',
    prop: 'text-size',
    value: (t) => ['interpolate', ['linear'], ['zoom'], 14, t.streetLabelSize * 0.8, 17, t.streetLabelSize, 20, t.streetLabelSize * 1.35],
  },
  { layer: 'street-labels', kind: 'layout', prop: 'visibility', value: (t) => (t.showStreetNames ? 'visible' : 'none') },
  { layer: 'place-labels', kind: 'paint', prop: 'text-color', value: (t) => t.placeLabel },
  { layer: 'place-labels', kind: 'paint', prop: 'text-halo-color', value: (t) => t.streetLabelHalo },
  { layer: 'place-labels', kind: 'layout', prop: 'visibility', value: (t) => (t.showPlaceLabels ? 'visible' : 'none') },
];

const roadFilter = (classes: string[]): Expr => [
  'all',
  ['match', ['get', 'class'], classes, true, false],
  ['!=', ['get', 'brunnel'], 'tunnel'],
];

export function buildBaseStyle(theme: BaseTheme): StyleSpecification {
  const layers: Record<string, unknown>[] = [
    { id: 'background', type: 'background', paint: {} },
    {
      id: 'landcover-green',
      type: 'fill',
      source: 'omt',
      'source-layer': 'landcover',
      filter: ['match', ['get', 'class'], ['grass', 'wood', 'farmland'], true, false],
      paint: { 'fill-opacity': 0.8 },
    },
    { id: 'park', type: 'fill', source: 'omt', 'source-layer': 'park', paint: { 'fill-opacity': 0.9 } },
    { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: {} },
    { id: 'building', type: 'fill', source: 'omt', 'source-layer': 'building', minzoom: 14, paint: {} },
    {
      id: 'road-path',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: ['match', ['get', 'class'], PATH, true, false],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {},
    },
    {
      id: 'road-casing-minor',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: roadFilter(MINOR),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {},
    },
    {
      id: 'road-casing-major',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: roadFilter(MAJOR),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {},
    },
    {
      id: 'road-minor',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: roadFilter(MINOR),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {},
    },
    {
      id: 'road-major',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: roadFilter(MAJOR),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {},
    },
    {
      id: 'street-labels',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'transportation_name',
      minzoom: 14,
      layout: {
        'symbol-placement': 'line',
        'text-field': ['coalesce', ['get', 'name:es'], ['get', 'name']],
        'text-font': FONT_REGULAR,
        'text-letter-spacing': 0.04,
        'text-max-angle': 30,
        'symbol-spacing': 280,
      },
      paint: { 'text-halo-width': 1.6 },
    },
    {
      id: 'place-labels',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      filter: ['match', ['get', 'class'], ['suburb', 'neighbourhood', 'quarter'], true, false],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': FONT_BOLD,
        'text-size': 13,
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.15,
      },
      paint: { 'text-halo-width': 1.5 },
    },
  ];

  // Aplicamos el tema sobre la definición de capas.
  const byId = new Map(layers.map((l) => [l.id as string, l]));
  for (const b of BINDINGS) {
    const layer = byId.get(b.layer)!;
    const group = ((layer[b.kind] as Record<string, unknown>) ??= {});
    group[b.prop] = b.value(theme);
  }

  return {
    version: 8,
    glyphs: GLYPHS_URL,
    sources: {
      omt: {
        type: 'vector',
        url: TILES_URL,
        attribution:
          '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> · Datos © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      },
    },
    layers: layers as StyleSpecification['layers'],
  };
}

/** Cambia los colores del mapa base en vivo (sin recargar estilo). */
export function applyBaseTheme(map: MLMap, theme: BaseTheme) {
  for (const b of BINDINGS) {
    if (!map.getLayer(b.layer)) continue;
    if (b.kind === 'paint') map.setPaintProperty(b.layer, b.prop as never, b.value(theme) as never);
    else map.setLayoutProperty(b.layer, b.prop as never, b.value(theme) as never);
  }
}
