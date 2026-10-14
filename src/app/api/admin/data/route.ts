import { NextResponse } from 'next/server';
import { handle, requireAdmin } from '@/lib/api';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

/** Todo el contenido, incluidos borradores. */
export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const data = await getStore().readAll();
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
});
