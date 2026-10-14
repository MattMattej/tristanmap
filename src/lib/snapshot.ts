import 'server-only';
import { revalidateTag, unstable_cache } from 'next/cache';
import type { MapData } from './schemas';
import { getStore } from './store';

export const MAP_TAG = 'map-data';

/** Lo que ve el público: solo lo publicado y visible, sin borradores. */
export function toPublic(data: MapData): MapData {
  const categories = data.categories.filter((c) => c.visible).sort((a, b) => a.sortOrder - b.sortOrder);
  const legend = data.legend.filter((l) => l.visible).sort((a, b) => a.sortOrder - b.sortOrder);
  const catIds = new Set(categories.map((c) => c.id));
  const legIds = new Set(legend.map((l) => l.id));
  const features = data.features.filter((f) => {
    if (!f.published) return false;
    if (f.kind === 'point') return f.categoryId === null || catIds.has(f.categoryId);
    if (f.kind === 'line' || f.kind === 'area') return f.legendId !== null && legIds.has(f.legendId);
    return f.title.trim() !== '';
  });
  return { settings: data.settings, categories, legend, features };
}

/**
 * Snapshot público cacheado. La base de datos solo se consulta cuando la
 * diseñadora guarda un cambio (invalidamos el tag) o, como máximo, una vez
 * por hora: miles de visitas no generan miles de consultas.
 */
export const getPublicSnapshot = unstable_cache(async () => toPublic(await getStore().readAll()), ['public-snapshot-v2'], {
  tags: [MAP_TAG],
  revalidate: 3600,
});

export function invalidatePublicSnapshot() {
  revalidateTag(MAP_TAG, { expire: 0 });
}
