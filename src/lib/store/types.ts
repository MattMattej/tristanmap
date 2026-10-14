import type { CollectionItem, CollectionName, MapData, Settings } from '../schemas';

/** Error de uso que se muestra tal cual en el panel (no es un fallo del servidor). */
export class StoreError extends Error {}

/**
 * Contrato de persistencia. Hay dos implementaciones intercambiables
 * (DATA_DRIVER=local | supabase); el resto de la app no sabe cuál se usa.
 */
export interface MapStore {
  readonly driver: 'local' | 'supabase';
  /** true: los cambios viven en memoria y se pierden al reiniciar (modo demostración). */
  readonly ephemeral: boolean;
  /** Todo el contenido, incluidos borradores (uso interno / panel). */
  readAll(): Promise<MapData>;
  upsert<C extends CollectionName>(collection: C, item: CollectionItem<C>): Promise<CollectionItem<C>>;
  remove(collection: CollectionName, id: string): Promise<void>;
  /** Reordena una colección: los ids en el orden deseado. */
  reorder(collection: 'categories' | 'legend', ids: string[]): Promise<void>;
  saveSettings(settings: Settings): Promise<Settings>;
  /** Guarda un archivo y devuelve su URL pública. */
  putFile(key: string, bytes: Uint8Array, contentType: string): Promise<string>;
  /** Borra un archivo gestionado por el store (ignora URLs ajenas). */
  deleteFile(url: string): Promise<void>;
  /** Chequeo de salud (también mantiene "despierto" el proyecto de Supabase). */
  ping(): Promise<void>;
}
