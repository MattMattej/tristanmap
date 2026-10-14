/**
 * Driver local: todo en data/db.json y los archivos en data/uploads/.
 * Pensado para desarrollo o para un servidor propio con disco persistente.
 */
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createSeedData } from '../defaults';
import type { CollectionItem, CollectionName, MapData, Settings } from '../schemas';
import { StoreError, type MapStore } from './types';

export const DATA_DIR = path.resolve(process.cwd(), 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOADS_PREFIX = '/uploads/';

export class LocalStore implements MapStore {
  readonly driver = 'local' as const;

  /**
   * En hostings sin disco persistente (Vercel) se usa en memoria:
   * sirve para mostrar el sitio, pero los cambios se pierden al reiniciar.
   */
  constructor(readonly ephemeral = false) {}

  private cache: MapData | null = null;
  /** Cola de escrituras: serializa los cambios para no pisar el archivo. */
  private queue: Promise<unknown> = Promise.resolve();

  private async load(): Promise<MapData> {
    if (this.cache) return this.cache;
    try {
      this.cache = JSON.parse(await readFile(DB_FILE, 'utf8')) as MapData;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      this.cache = createSeedData();
      await this.persist(this.cache);
    }
    return this.cache;
  }

  private async persist(data: MapData) {
    if (this.ephemeral) return;
    await mkdir(DATA_DIR, { recursive: true });
    const tmp = `${DB_FILE}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(data, null, 2));
    try {
      await rename(tmp, DB_FILE);
    } catch {
      // En Windows/OneDrive el rename puede fallar si el archivo está tomado.
      await writeFile(DB_FILE, JSON.stringify(data, null, 2));
      await unlink(tmp).catch(() => {});
    }
  }

  private mutate<T>(fn: (data: MapData) => T): Promise<T> {
    const run = this.queue.then(async () => {
      const data = structuredClone(await this.load());
      const result = fn(data);
      await this.persist(data);
      this.cache = data;
      return result;
    });
    this.queue = run.catch(() => {});
    return run;
  }

  async readAll() {
    await this.queue;
    return structuredClone(await this.load());
  }

  upsert<C extends CollectionName>(collection: C, item: CollectionItem<C>) {
    return this.mutate((data) => {
      const list = data[collection] as CollectionItem<C>[];
      const i = list.findIndex((x) => x.id === item.id);
      if (i === -1) list.push(item);
      else list[i] = item;
      return item;
    });
  }

  remove(collection: CollectionName, id: string) {
    return this.mutate((data) => {
      if (collection === 'features') {
        data.features = data.features.filter((f) => f.id !== id);
      } else if (collection === 'categories') {
        data.categories = data.categories.filter((c) => c.id !== id);
        for (const f of data.features) if (f.categoryId === id) f.categoryId = null;
      } else {
        data.legend = data.legend.filter((l) => l.id !== id);
        for (const f of data.features) if (f.legendId === id) f.legendId = null;
      }
    });
  }

  reorder(collection: 'categories' | 'legend', ids: string[]) {
    return this.mutate((data) => {
      for (const item of data[collection]) {
        const i = ids.indexOf(item.id);
        if (i !== -1) item.sortOrder = i;
      }
    });
  }

  saveSettings(settings: Settings) {
    return this.mutate((data) => {
      data.settings = settings;
      return settings;
    });
  }

  async putFile(key: string, bytes: Uint8Array) {
    if (this.ephemeral) throw new StoreError('Modo demostración: para subir fotos e íconos hay que conectar Supabase');
    const file = safeJoin(UPLOADS_DIR, key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
    return UPLOADS_PREFIX + key;
  }

  async deleteFile(url: string) {
    if (!url.startsWith(UPLOADS_PREFIX)) return;
    await unlink(safeJoin(UPLOADS_DIR, url.slice(UPLOADS_PREFIX.length))).catch(() => {});
  }

  async ping() {
    await this.load();
  }
}

/** Une rutas impidiendo escapar del directorio base (path traversal). */
export function safeJoin(base: string, key: string) {
  const full = path.resolve(base, key);
  if (!full.startsWith(base + path.sep)) throw new Error('Ruta inválida');
  return full;
}
