/**
 * Driver Supabase: Postgres (tablas en supabase/schema.sql) + Storage.
 * Usa la service role key, por eso solo corre en el servidor.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createSeedData } from '../defaults';
import type { Category, CollectionItem, CollectionName, LegendItem, MapData, MapFeature, Settings } from '../schemas';
import type { MapStore } from './types';

const TABLES: Record<CollectionName, string> = {
  categories: 'categories',
  legend: 'legend_items',
  features: 'features',
};

type Row = Record<string, unknown>;

// ─── Conversión fila <-> objeto ─────────────────────────────────────────────
const toRow: { [C in CollectionName]: (item: CollectionItem<C>) => Row } = {
  categories: (c: Category) => ({
    id: c.id, name: c.name, description: c.description, color: c.color, icon: c.icon,
    sort_order: c.sortOrder, visible: c.visible,
  }),
  legend: (l: LegendItem) => ({
    id: l.id, name: l.name, description: l.description, kind: l.kind, color: l.color, width: l.width,
    opacity: l.opacity, dash: l.dash, sort_order: l.sortOrder, visible: l.visible,
  }),
  features: (f: MapFeature) => ({
    id: f.id, kind: f.kind, title: f.title, description: f.description, photo: f.photo,
    category_id: f.categoryId, legend_id: f.legendId, geometry: f.geometry, style: f.style,
    published: f.published, created_at: f.createdAt, updated_at: f.updatedAt,
  }),
};

const fromRow = {
  categories: (r: Row): Category => ({
    id: r.id as string, name: r.name as string, description: (r.description as string) ?? '',
    color: r.color as string, icon: (r.icon as string) ?? '', sortOrder: (r.sort_order as number) ?? 0,
    visible: r.visible as boolean,
  }),
  legend: (r: Row): LegendItem => ({
    id: r.id as string, name: r.name as string, description: (r.description as string) ?? '',
    kind: r.kind as LegendItem['kind'], color: r.color as string, width: Number(r.width),
    opacity: Number(r.opacity), dash: r.dash as LegendItem['dash'], sortOrder: (r.sort_order as number) ?? 0,
    visible: r.visible as boolean,
  }),
  features: (r: Row): MapFeature => ({
    id: r.id as string, kind: r.kind as MapFeature['kind'], title: (r.title as string) ?? '',
    description: (r.description as string) ?? '', photo: (r.photo as MapFeature['photo']) ?? null,
    categoryId: (r.category_id as string) ?? null, legendId: (r.legend_id as string) ?? null,
    geometry: r.geometry as MapFeature['geometry'], style: (r.style as MapFeature['style']) ?? {},
    published: r.published as boolean, createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  }),
};

function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`Supabase (${what}): ${res.error.message}`);
  return res.data;
}

export class SupabaseStore implements MapStore {
  readonly driver = 'supabase' as const;
  readonly ephemeral = false;
  private db: SupabaseClient;
  private bucket: string;
  private publicPrefix: string;
  private seeding: Promise<void> | null = null;

  constructor(url: string, serviceKey: string, bucket: string) {
    this.db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    this.bucket = bucket;
    this.publicPrefix = `${url.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/`;
  }

  /** Primera ejecución: carga el contenido inicial si la base está vacía. */
  private async ensureSeeded() {
    this.seeding ??= (async () => {
      const res = await this.db.from('settings').select('id').eq('id', 1).maybeSingle();
      if (check(res, 'settings')) return;
      const seed = createSeedData();
      check(await this.db.from('categories').upsert(seed.categories.map(toRow.categories)), 'seed categories');
      check(await this.db.from('legend_items').upsert(seed.legend.map(toRow.legend)), 'seed legend');
      check(await this.db.from('features').upsert(seed.features.map(toRow.features)), 'seed features');
      check(await this.db.from('settings').upsert({ id: 1, data: seed.settings }), 'seed settings');
    })().catch((err) => {
      this.seeding = null;
      throw err;
    });
    return this.seeding;
  }

  async readAll(): Promise<MapData> {
    await this.ensureSeeded();
    const [settings, categories, legend, features] = await Promise.all([
      this.db.from('settings').select('data').eq('id', 1).single(),
      this.db.from('categories').select('*').order('sort_order'),
      this.db.from('legend_items').select('*').order('sort_order'),
      this.db.from('features').select('*').order('created_at'),
    ]);
    return {
      settings: check(settings, 'settings')!.data as Settings,
      categories: (check(categories, 'categories') ?? []).map(fromRow.categories),
      legend: (check(legend, 'legend') ?? []).map(fromRow.legend),
      features: (check(features, 'features') ?? []).map(fromRow.features),
    };
  }

  async upsert<C extends CollectionName>(collection: C, item: CollectionItem<C>) {
    const row = (toRow[collection] as (i: CollectionItem<C>) => Row)(item);
    check(await this.db.from(TABLES[collection]).upsert(row), `upsert ${collection}`);
    return item;
  }

  async remove(collection: CollectionName, id: string) {
    // Las FK con "on delete set null" desvinculan los elementos asociados.
    check(await this.db.from(TABLES[collection]).delete().eq('id', id), `delete ${collection}`);
  }

  async reorder(collection: 'categories' | 'legend', ids: string[]) {
    await Promise.all(
      ids.map(async (id, i) =>
        check(await this.db.from(TABLES[collection]).update({ sort_order: i }).eq('id', id), 'reorder'),
      ),
    );
  }

  async saveSettings(settings: Settings) {
    check(await this.db.from('settings').upsert({ id: 1, data: settings, updated_at: new Date().toISOString() }), 'settings');
    return settings;
  }

  async putFile(key: string, bytes: Uint8Array, contentType: string) {
    const res = await this.db.storage.from(this.bucket).upload(key, bytes, {
      contentType,
      cacheControl: '31536000',
      upsert: false,
    });
    if (res.error) throw new Error(`Supabase Storage: ${res.error.message}`);
    return this.publicPrefix + key;
  }

  async deleteFile(url: string) {
    if (!url.startsWith(this.publicPrefix)) return;
    await this.db.storage.from(this.bucket).remove([url.slice(this.publicPrefix.length)]);
  }

  async ping() {
    check(await this.db.from('settings').select('id').limit(1), 'ping');
  }
}
