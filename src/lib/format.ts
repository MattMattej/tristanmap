import type { Category, LegendItem, MapFeature } from './schemas';

/** Normaliza para buscar sin importar tildes ni mayúsculas. */
export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** Punto representativo de un elemento (para centrar o "cómo llegar"). */
export function featureCenter(f: MapFeature): [number, number] {
  const g = f.geometry;
  if (g.type === 'Point') return g.coordinates;
  if (g.type === 'LineString') {
    // Punto medio a lo largo de la línea.
    const c = g.coordinates;
    const seg = c.slice(1).map((p, i) => Math.hypot(p[0] - c[i][0], p[1] - c[i][1]));
    let rest = seg.reduce((a, b) => a + b, 0) / 2;
    for (let i = 0; i < seg.length; i++) {
      if (rest <= seg[i] && seg[i] > 0) {
        const t = rest / seg[i];
        return [c[i][0] + (c[i + 1][0] - c[i][0]) * t, c[i][1] + (c[i + 1][1] - c[i][1]) * t];
      }
      rest -= seg[i];
    }
    return c[0];
  }
  const ring = g.coordinates[0].slice(0, -1);
  const [x, y] = ring.reduce(([ax, ay], [bx, by]) => [ax + bx, ay + by], [0, 0]);
  return [x / ring.length, y / ring.length];
}

export function featureBounds(f: MapFeature): [[number, number], [number, number]] {
  const g = f.geometry;
  const coords = g.type === 'Point' ? [g.coordinates] : g.type === 'LineString' ? g.coordinates : g.coordinates[0];
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of coords) {
    w = Math.min(w, x);
    s = Math.min(s, y);
    e = Math.max(e, x);
    n = Math.max(n, y);
  }
  return [
    [w, s],
    [e, n],
  ];
}

export function directionsUrl([lng, lat]: [number, number]) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
}

export function kindLabel(kind: MapFeature['kind']) {
  return { point: 'Punto', line: 'Franja', area: 'Zona', label: 'Texto' }[kind];
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function swatchClass(item: Pick<LegendItem, 'kind' | 'dash'>) {
  if (item.kind === 'area') return 'swatch swatch--area';
  return `swatch swatch--line${item.dash !== 'solid' ? ` swatch--${item.dash}` : ''}`;
}

export function byOrder<T extends Pick<Category, 'sortOrder' | 'name'>>(a: T, b: T) {
  return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es');
}

export function newId(prefix = '') {
  const raw = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}${Math.random()}`;
  return prefix + raw.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
}

export function slugify(s: string) {
  return normalize(s)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}
