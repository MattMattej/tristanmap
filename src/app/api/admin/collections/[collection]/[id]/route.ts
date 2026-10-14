import { NextResponse } from 'next/server';
import { handle, HttpError, requireAdmin } from '@/lib/api';
import { isCollection } from '@/lib/schemas';
import { invalidatePublicSnapshot } from '@/lib/snapshot';
import { getStore } from '@/lib/store';

export const DELETE = handle(async (req: Request, ctx: { params: Promise<{ collection: string; id: string }> }) => {
  await requireAdmin(req);
  const { collection, id } = await ctx.params;
  if (!isCollection(collection)) throw new HttpError(404, 'Colección inexistente');

  const store = getStore();
  const data = await store.readAll();
  if (collection === 'features') {
    const photo = data.features.find((f) => f.id === id)?.photo;
    if (photo) await Promise.all([store.deleteFile(photo.url), store.deleteFile(photo.thumbUrl)]);
  } else if (collection === 'categories') {
    const icon = data.categories.find((c) => c.id === id)?.icon;
    if (icon) await store.deleteFile(icon);
  }
  await store.remove(collection, id);
  invalidatePublicSnapshot();
  return NextResponse.json({ ok: true });
});
