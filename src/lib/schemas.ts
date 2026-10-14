/**
 * Modelo de datos del mapa. Es la única fuente de verdad: los tipos de
 * TypeScript se derivan de estos esquemas y la API valida todo con ellos.
 */
import { z } from 'zod';

const id = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color inválido (usá #RRGGBB)');
const lng = z.number().min(-180).max(180);
const lat = z.number().min(-90).max(90);
const position = z.tuple([lng, lat]);
/** URL propia (/uploads/..., /icons/...) o https (Storage de Supabase). */
const assetUrl = z
  .string()
  .max(1024)
  .refine((v) => v === '' || v.startsWith('/') || v.startsWith('https://'), 'URL inválida');

// ─── Categorías (íconos de puntos) ──────────────────────────────────────────
export const categorySchema = z.object({
  id,
  name: z.string().trim().min(1).max(60),
  description: z.string().max(400).default(''),
  color: hex,
  icon: assetUrl,
  sortOrder: z.number().int().default(0),
  visible: z.boolean().default(true),
});
export type Category = z.infer<typeof categorySchema>;

// ─── Leyenda (significado de colores de franjas y zonas) ────────────────────
export const DASHES = ['solid', 'dashed', 'dotted'] as const;
export const legendSchema = z.object({
  id,
  name: z.string().trim().min(1).max(60),
  description: z.string().max(400).default(''),
  kind: z.enum(['line', 'area']),
  color: hex,
  /** Ancho de la franja en px a zoom 17 (escala con el zoom). */
  width: z.number().min(1).max(40).default(8),
  opacity: z.number().min(0.05).max(1).default(0.85),
  dash: z.enum(DASHES).default('solid'),
  sortOrder: z.number().int().default(0),
  visible: z.boolean().default(true),
});
export type LegendItem = z.infer<typeof legendSchema>;

// ─── Elementos del mapa ─────────────────────────────────────────────────────
export const FEATURE_KINDS = ['point', 'line', 'area', 'label'] as const;
export type FeatureKind = (typeof FEATURE_KINDS)[number];

export const photoSchema = z.object({
  url: assetUrl,
  thumbUrl: assetUrl,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  bytes: z.number().int().nonnegative(),
});
export type Photo = z.infer<typeof photoSchema>;

const pointGeometry = z.object({ type: z.literal('Point'), coordinates: position });
const lineGeometry = z.object({ type: z.literal('LineString'), coordinates: z.array(position).min(2).max(2000) });
const polygonGeometry = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(position).min(4).max(2000)).min(1).max(20),
});
export const geometrySchema = z.discriminatedUnion('type', [pointGeometry, lineGeometry, polygonGeometry]);
export type FeatureGeometry = z.infer<typeof geometrySchema>;

export const featureStyleSchema = z.object({
  /** Desplazamiento lateral de una franja (px): para pintar una vereda. */
  offset: z.number().min(-40).max(40).optional(),
  /** Textos: tamaño, color, rotación. */
  textSize: z.number().min(8).max(64).optional(),
  textColor: hex.optional(),
  haloColor: hex.optional(),
  rotation: z.number().min(-180).max(180).optional(),
});
export type FeatureStyle = z.infer<typeof featureStyleSchema>;

const GEOMETRY_FOR_KIND: Record<FeatureKind, FeatureGeometry['type']> = {
  point: 'Point',
  label: 'Point',
  line: 'LineString',
  area: 'Polygon',
};

export const featureSchema = z
  .object({
    id,
    kind: z.enum(FEATURE_KINDS),
    title: z.string().max(120).default(''),
    description: z.string().max(4000).default(''),
    photo: photoSchema.nullable().default(null),
    categoryId: id.nullable().default(null),
    legendId: id.nullable().default(null),
    geometry: geometrySchema,
    style: featureStyleSchema.default({}),
    published: z.boolean().default(true),
    createdAt: z.string().default(() => new Date().toISOString()),
    updatedAt: z.string().default(() => new Date().toISOString()),
  })
  .refine((f) => f.geometry.type === GEOMETRY_FOR_KIND[f.kind], {
    message: 'La geometría no coincide con el tipo de elemento',
    path: ['geometry'],
  });
export type MapFeature = z.infer<typeof featureSchema>;

// ─── Ajustes generales y estilo del mapa base ───────────────────────────────
export const baseThemeSchema = z.object({
  background: hex, // manzanas / fondo
  park: hex,
  water: hex,
  building: hex,
  buildingOpacity: z.number().min(0).max(1),
  roadMajor: hex,
  roadMinor: hex,
  roadPath: hex,
  roadCasing: hex,
  roadWidth: z.number().min(0.3).max(3), // multiplicador
  streetLabel: hex,
  streetLabelHalo: hex,
  streetLabelSize: z.number().min(8).max(24),
  showStreetNames: z.boolean(),
  showBuildings: z.boolean(),
  placeLabel: hex,
  showPlaceLabels: z.boolean(),
});
export type BaseTheme = z.infer<typeof baseThemeSchema>;

export const settingsSchema = z.object({
  title: z.string().trim().min(1).max(80),
  subtitle: z.string().max(140),
  schedule: z.string().max(200),
  about: z.string().max(6000),
  accent: hex,
  view: z.object({
    center: position,
    zoom: z.number().min(10).max(21),
    bearing: z.number().min(-180).max(180),
    minZoom: z.number().min(10).max(21),
    maxZoom: z.number().min(10).max(22),
    /** Límites de navegación [[oeste, sur], [este, norte]] o null. */
    bounds: z.tuple([position, position]).nullable(),
  }),
  base: baseThemeSchema,
  /** Zona de la feria: lo de afuera se atenúa para enfocar la atención. */
  focus: z.object({
    /** false: sin límite ni atenuación; la feria queda marcada solo por las calles pintadas. */
    enabled: z.boolean().default(true),
    showOutline: z.boolean().default(true),
    polygon: z.array(position).min(4).max(500).nullable(),
    dimColor: hex,
    dimOpacity: z.number().min(0).max(0.9),
    outlineColor: hex,
  }),
  markers: z.object({
    size: z.number().min(20).max(64),
    showLabels: z.boolean(),
  }),
});
export type Settings = z.infer<typeof settingsSchema>;

// ─── Colecciones editables desde el panel ───────────────────────────────────
export const COLLECTIONS = {
  categories: categorySchema,
  legend: legendSchema,
  features: featureSchema,
} as const;
export type CollectionName = keyof typeof COLLECTIONS;
export type CollectionItem<C extends CollectionName> = z.infer<(typeof COLLECTIONS)[C]>;

export function isCollection(name: string): name is CollectionName {
  return Object.hasOwn(COLLECTIONS, name);
}

/** Todo el contenido del mapa (lo que se publica y lo que edita el panel). */
export interface MapData {
  settings: Settings;
  categories: Category[];
  legend: LegendItem[];
  features: MapFeature[];
}
