import 'server-only';
import { LocalStore } from './local';
import { SupabaseStore } from './supabase';
import type { MapStore } from './types';

export type { MapStore } from './types';

const globalForStore = globalThis as unknown as { __tristanStore?: MapStore };

/** Devuelve el store configurado (singleton por proceso). */
export function getStore(): MapStore {
  if (globalForStore.__tristanStore) return globalForStore.__tristanStore;

  const driver = (process.env.DATA_DRIVER ?? 'local').toLowerCase();
  let store: MapStore;
  if (driver === 'supabase') {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('DATA_DRIVER=supabase requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
    store = new SupabaseStore(url, key, process.env.SUPABASE_BUCKET || 'media');
  } else if (driver === 'local') {
    // Vercel no tiene disco persistente: sin Supabase, funcionamos en memoria.
    store = new LocalStore(!!process.env.VERCEL);
  } else {
    throw new Error(`DATA_DRIVER desconocido: "${driver}" (usá local o supabase)`);
  }
  globalForStore.__tristanStore = store;
  return store;
}
