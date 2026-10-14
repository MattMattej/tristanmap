/**
 * Contenido inicial: lo que se carga la primera vez que arranca el proyecto
 * (base vacía). Todo es editable desde el panel; los elementos de ejemplo
 * están marcados como tales para que la diseñadora los reemplace.
 */
import type { BaseTheme, Category, LegendItem, MapData, MapFeature, Settings } from './schemas';

export const THEME_PRESETS: Record<string, { label: string; theme: BaseTheme }> = {
  papel: {
    label: 'Papel',
    theme: {
      background: '#f3eee3',
      park: '#dde7c7',
      water: '#b9d3e4',
      building: '#e7dece',
      buildingOpacity: 0.85,
      roadMajor: '#ffffff',
      roadMinor: '#fffdf8',
      roadPath: '#f7f1e4',
      roadCasing: '#d9cfbc',
      roadWidth: 1,
      streetLabel: '#5b5446',
      streetLabelHalo: '#fffdf8',
      streetLabelSize: 12,
      showStreetNames: true,
      showBuildings: true,
      placeLabel: '#8a8070',
      showPlaceLabels: false,
    },
  },
  claro: {
    label: 'Claro',
    theme: {
      background: '#f6f7f8',
      park: '#e2efe0',
      water: '#cfe3f3',
      building: '#eceef0',
      buildingOpacity: 0.9,
      roadMajor: '#ffffff',
      roadMinor: '#ffffff',
      roadPath: '#f2f3f5',
      roadCasing: '#dadde2',
      roadWidth: 1,
      streetLabel: '#4a5059',
      streetLabelHalo: '#ffffff',
      streetLabelSize: 12,
      showStreetNames: true,
      showBuildings: true,
      placeLabel: '#7c838d',
      showPlaceLabels: false,
    },
  },
  noche: {
    label: 'Noche',
    theme: {
      background: '#1d2126',
      park: '#22302a',
      water: '#16263a',
      building: '#262b31',
      buildingOpacity: 0.9,
      roadMajor: '#3a414a',
      roadMinor: '#323840',
      roadPath: '#2a3037',
      roadCasing: '#15181c',
      roadWidth: 1,
      streetLabel: '#c3c8cf',
      streetLabelHalo: '#1d2126',
      streetLabelSize: 12,
      showStreetNames: true,
      showBuildings: true,
      placeLabel: '#8b929b',
      showPlaceLabels: false,
    },
  },
  tinta: {
    label: 'Tinta',
    theme: {
      background: '#fbfaf7',
      park: '#fbfaf7',
      water: '#e9eef2',
      building: '#fbfaf7',
      buildingOpacity: 0,
      roadMajor: '#ffffff',
      roadMinor: '#ffffff',
      roadPath: '#ffffff',
      roadCasing: '#1f1f1f',
      roadWidth: 1.2,
      streetLabel: '#1f1f1f',
      streetLabelHalo: '#ffffff',
      streetLabelSize: 12,
      showStreetNames: true,
      showBuildings: false,
      placeLabel: '#555555',
      showPlaceLabels: false,
    },
  },
};

export const DEFAULT_SETTINGS: Settings = {
  title: 'Feria de Tristán Narvaja',
  subtitle: 'El mapa de los piques de la feria más famosa de Montevideo',
  schedule: 'Domingos de 9 a 15 h · Barrio Cordón',
  about:
    'La feria de Tristán Narvaja se arma todos los domingos sobre la calle Tristán Narvaja, desde la Av. 18 de Julio hacia La Paz, y se desparrama por las calles que la cruzan.\n\nLibros, antigüedades, discos, plantas, herramientas, frutas, verduras y mil cosas más. Este mapa te ayuda a encontrar cada rincón y a aprender los piques de quienes la recorren desde siempre.',
  accent: '#d9572b',
  view: {
    center: [-56.1788, -34.9001],
    zoom: 16.4,
    bearing: 0,
    minZoom: 14.5,
    maxZoom: 20,
    bounds: [
      [-56.1915, -34.9105],
      [-56.1655, -34.8905],
    ],
  },
  base: THEME_PRESETS.papel.theme,
  focus: {
    enabled: true,
    showOutline: true,
    polygon: [
      [-56.17434, -34.90311],
      [-56.17913, -34.89531],
      [-56.18304, -34.89694],
      [-56.17825, -34.90474],
      [-56.17434, -34.90311],
    ],
    dimColor: '#e9e2d4',
    dimOpacity: 0.55,
    outlineColor: '#d9572b',
  },
  markers: { size: 36, showLabels: false },
};

const now = () => new Date().toISOString();

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'antiguedades', name: 'Antigüedades', description: 'Objetos antiguos, coleccionables y curiosidades.', color: '#8c5a2b', icon: '/icons/antiguedades.svg', sortOrder: 0, visible: true },
  { id: 'libros', name: 'Libros', description: 'Librerías y puestos de libros usados.', color: '#2f6fb2', icon: '/icons/libros.svg', sortOrder: 1, visible: true },
  { id: 'discos', name: 'Discos y música', description: 'Vinilos, casetes, instrumentos.', color: '#7a3fa0', icon: '/icons/discos.svg', sortOrder: 2, visible: true },
  { id: 'plantas', name: 'Plantas y flores', description: 'Plantines, flores y huerta.', color: '#3e8e4e', icon: '/icons/plantas.svg', sortOrder: 3, visible: true },
  { id: 'comida', name: 'Comida', description: 'Para comer algo en el recorrido.', color: '#d9572b', icon: '/icons/comida.svg', sortOrder: 4, visible: true },
  { id: 'piques', name: 'Piques', description: 'Datos útiles y secretos de la feria.', color: '#c98a00', icon: '/icons/pique.svg', sortOrder: 5, visible: true },
];

const DEFAULT_LEGEND: LegendItem[] = [
  { id: 'sector-libros', name: 'Sector libros', description: 'Cuadras donde se concentran los puestos de libros (ejemplo).', kind: 'line', color: '#2f6fb2', width: 9, opacity: 0.8, dash: 'solid', sortOrder: 0, visible: true },
  { id: 'sector-usados', name: 'Usados y antigüedades', description: 'Cachivaches, herramientas y objetos usados (ejemplo).', kind: 'line', color: '#8c5a2b', width: 9, opacity: 0.8, dash: 'solid', sortOrder: 1, visible: true },
  { id: 'sector-frutas', name: 'Frutas y verduras', description: 'Puestos de frutas, verduras y almacén (ejemplo).', kind: 'line', color: '#3e8e4e', width: 9, opacity: 0.8, dash: 'solid', sortOrder: 2, visible: true },
  { id: 'recorrido', name: 'Recorrido sugerido', description: 'Una forma de recorrer la feria sin perderte nada (ejemplo).', kind: 'line', color: '#d9572b', width: 4, opacity: 0.95, dash: 'dashed', sortOrder: 3, visible: true },
  { id: 'zona-concurrida', name: 'Zona más concurrida', description: 'Mucha gente entre las 11 y las 13 h (ejemplo).', kind: 'area', color: '#e3a008', width: 2, opacity: 0.22, dash: 'solid', sortOrder: 4, visible: true },
];

function feature(partial: Omit<MapFeature, 'createdAt' | 'updatedAt' | 'published' | 'style' | 'photo'> & Partial<MapFeature>): MapFeature {
  return { photo: null, style: {}, published: true, createdAt: now(), updatedAt: now(), ...partial };
}

const EXAMPLE = '\n\n(Elemento de ejemplo: editalo o borralo desde el panel.)';

const DEFAULT_FEATURES: MapFeature[] = [
  feature({ id: 'ej-libros', kind: 'point', title: 'Libros usados (ejemplo)', description: `Pilas de libros a precio de feria. Vale la pena revolver: siempre aparece alguna joya.${EXAMPLE}`, categoryId: 'libros', legendId: null, geometry: { type: 'Point', coordinates: [-56.17752, -34.90198] } }),
  feature({ id: 'ej-antiguedades', kind: 'point', title: 'Antigüedades (ejemplo)', description: `Relojes, lámparas, vajilla y objetos de otras épocas.${EXAMPLE}`, categoryId: 'antiguedades', legendId: null, geometry: { type: 'Point', coordinates: [-56.17862, -34.90028] } }),
  feature({ id: 'ej-discos', kind: 'point', title: 'Vinilos (ejemplo)', description: `Rock nacional, tango, candombe y mucho más en vinilo.${EXAMPLE}`, categoryId: 'discos', legendId: null, geometry: { type: 'Point', coordinates: [-56.17935, -34.89897] } }),
  feature({ id: 'ej-plantas', kind: 'point', title: 'Plantines y flores (ejemplo)', description: `Plantas de interior, suculentas y plantines de huerta.${EXAMPLE}`, categoryId: 'plantas', legendId: null, geometry: { type: 'Point', coordinates: [-56.18012, -34.89770] } }),
  feature({ id: 'ej-pique', kind: 'point', title: 'Pique: llegá temprano (ejemplo)', description: `Los mejores hallazgos aparecen antes de las 10. Después de las 13 se consigue mejor precio.${EXAMPLE}`, categoryId: 'piques', legendId: null, geometry: { type: 'Point', coordinates: [-56.17700, -34.90295] } }),
  feature({ id: 'ej-franja-libros', kind: 'line', title: 'Cuadra de libros (ejemplo)', description: `Franja de ejemplo pintada sobre una cuadra.${EXAMPLE}`, categoryId: null, legendId: 'sector-libros', geometry: { type: 'LineString', coordinates: [[-56.177289, -34.902418], [-56.177851, -34.901502]] } }),
  feature({ id: 'ej-franja-usados', kind: 'line', title: 'Cuadra de usados (ejemplo)', description: `Franja de ejemplo pintada sobre una cuadra.${EXAMPLE}`, categoryId: null, legendId: 'sector-usados', geometry: { type: 'LineString', coordinates: [[-56.178297, -34.900752], [-56.178784, -34.899955]] } }),
  feature({ id: 'ej-texto', kind: 'label', title: 'TRISTÁN NARVAJA', description: '', categoryId: null, legendId: null, geometry: { type: 'Point', coordinates: [-56.17905, -34.89955] }, style: { textSize: 15, textColor: '#d9572b', haloColor: '#ffffff', rotation: 60 } }),
];

export function createSeedData(): MapData {
  return {
    settings: structuredClone(DEFAULT_SETTINGS),
    categories: structuredClone(DEFAULT_CATEGORIES),
    legend: structuredClone(DEFAULT_LEGEND),
    features: structuredClone(DEFAULT_FEATURES),
  };
}
