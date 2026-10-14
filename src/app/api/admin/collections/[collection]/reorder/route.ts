import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handle, HttpError, readJson, requireAdmin } from '@/lib/api';
import { invalidatePublicSnapshot } from '@/lib/snapshot';
import { getStore } from '@/lib/store';

const body = z.object({ ids: z.array(z.string().min(1).max(64)).max(500) });

export const POST = handle(async (req: Request, ctx: { params: Promise<{ collection: string }> }) => {
  await requireAdmin(req);
  const { collection } = await ctx.params;
  if (collection !== 'categories' && collection !== 'legend') throw new HttpError(404, 'Colección no ordenable');
  const { ids } = body.parse(await readJson(req));
  await getStore().reorder(collection, ids);
  invalidatePublicSnapshot();
  return NextResponse.json({ ok: true });
});
