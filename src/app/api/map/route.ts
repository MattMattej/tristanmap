import { NextResponse } from 'next/server';
import { handle } from '@/lib/api';
import { getPublicSnapshot } from '@/lib/snapshot';

/** Snapshot público en JSON (para integraciones o apps futuras). */
export const GET = handle(async () => {
  const data = await getPublicSnapshot();
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=86400' },
  });
});
