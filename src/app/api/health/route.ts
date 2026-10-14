import { NextResponse } from 'next/server';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

/**
 * Chequeo de salud. Un cron semanal a esta URL evita que Supabase
 * pause el proyecto gratuito por inactividad (ver vercel.json).
 */
export async function GET() {
  const store = getStore();
  try {
    await store.ping();
    return NextResponse.json({ ok: true, driver: store.driver, at: new Date().toISOString() });
  } catch (err) {
    console.error('[health]', err);
    return NextResponse.json({ ok: false, driver: store.driver }, { status: 503 });
  }
}
