import { NextResponse } from 'next/server';
import { handle, HttpError, readJson, requireAdmin } from '@/lib/api';
import { COLLECTIONS, isCollection, type MapFeature } from '@/lib/schemas';
import { invalidatePublicSnapshot } from '@/lib/snapshot';
import { getStore } from '@/lib/store';

/** Crea o actualiza un elemento (categoría, ítem de leyenda o elemento del mapa). */
export const PUT = handle(async (req: Request, ctx: { params: Promise<{ collection: string }> }) => {
  await requireAdmin(req);
  const { collection } = await ctx.params;
  if (!isCollection(collection)) throw new HttpError(404, 'Colección inexistente');

  const item = COLLECTIONS[collection].parse(await readJson(req));
  const store = getStore();
  const before = await store.readAll();

  if (collection === 'features') {
    const feature = item as MapFeature;
    feature.updatedAt = new Date().toISOString();
    const prev = before.features.find((f) => f.id === feature.id);
    if (prev) feature.createdAt = prev.createdAt;
    // Si se reemplazó o quitó la foto, borramos los archivos viejos.
    if (prev?.photo && prev.photo.url !== feature.photo?.url) {
      await Promise.all([store.deleteFile(prev.photo.url), store.deleteFile(prev.photo.thumbUrl)]);
    }
  } else if (collection === 'categories') {
    const prev = before.categories.find((c) => c.id === item.id);
    const icon = (item as { icon: string }).icon;
    if (prev && prev.icon !== icon) await store.deleteFile(prev.icon);
  }

  const saved = await store.upsert(collection, item);
  invalidatePublicSnapshot();
  return NextResponse.json(saved);
});
