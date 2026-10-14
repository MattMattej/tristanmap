'use client';

/**
 * Estado del editor con guardado automático.
 *
 * Cada cambio se aplica al instante en pantalla (optimista) y se guarda en
 * segundo plano con un pequeño retardo, agrupando ráfagas (p. ej. mientras
 * se escribe). Los cambios sobre elementos del mapa se pueden deshacer.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Category, LegendItem, MapData, MapFeature, Settings } from '@/lib/schemas';
import { api } from './api';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UndoEntry {
  id: string;
  before: MapFeature | null;
  after: MapFeature | null;
  at: number;
}

const TYPING_DELAY = 700;
const UNDO_LIMIT = 100;
const UNDO_MERGE_MS = 1500;

export function useEditorData(initial: MapData) {
  const [data, setDataState] = useState(initial);
  const dataRef = useRef(initial);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const timers = useRef(new Map<string, number>());
  const tasks = useRef(new Map<string, () => Promise<unknown>>());
  const inflight = useRef(0);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const undoStack = useRef<UndoEntry[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  const setData = useCallback((fn: (d: MapData) => MapData) => {
    dataRef.current = fn(dataRef.current);
    setDataState(dataRef.current);
  }, []);

  const refreshStatus = useCallback(() => {
    if (timers.current.size || inflight.current) setStatus('saving');
    else setStatus((s) => (s === 'error' ? s : 'saved'));
  }, []);

  const run = useCallback(
    async (key: string) => {
      const task = tasks.current.get(key);
      tasks.current.delete(key);
      timers.current.delete(key);
      if (!task) return;
      inflight.current++;
      refreshStatus();
      try {
        // Cola única: los guardados llegan al servidor en el mismo orden en que se hicieron.
        const next = chain.current.then(task);
        chain.current = next.catch(() => {});
        await next;
        setError(null);
        setStatus('saved');
      } catch (err) {
        setError((err as Error).message);
        setStatus('error');
      } finally {
        inflight.current--;
        refreshStatus();
      }
    },
    [refreshStatus],
  );

  /** Programa un guardado; si llega otro con la misma clave, reemplaza al anterior. */
  const schedule = useCallback(
    (key: string, task: () => Promise<unknown>, delay = TYPING_DELAY) => {
      window.clearTimeout(timers.current.get(key));
      tasks.current.set(key, task);
      if (delay <= 0) {
        timers.current.delete(key);
        void run(key);
        return;
      }
      timers.current.set(key, window.setTimeout(() => void run(key), delay));
      setStatus('saving');
    },
    [run],
  );

  // Aviso si se intenta cerrar con cambios sin guardar.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (timers.current.size || inflight.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // ─── Elementos del mapa ────────────────────────────────────────────────────
  const pushUndo = (id: string, before: MapFeature | null, after: MapFeature | null, merge: boolean) => {
    const stack = undoStack.current;
    const last = stack.at(-1);
    if (merge && last && last.id === id && Date.now() - last.at < UNDO_MERGE_MS && last.after && after) {
      last.after = after;
      last.at = Date.now();
    } else {
      stack.push({ id, before, after, at: Date.now() });
      if (stack.length > UNDO_LIMIT) stack.shift();
    }
    setCanUndo(stack.length > 0);
  };

  const saveFeature = useCallback(
    (id: string, delay: number) =>
      schedule(
        `features:${id}`,
        async () => {
          const f = dataRef.current.features.find((x) => x.id === id);
          if (f) await api.put('features', f);
        },
        delay,
      ),
    [schedule],
  );

  const createFeature = useCallback(
    (feature: MapFeature) => {
      setData((d) => ({ ...d, features: [...d.features, feature] }));
      pushUndo(feature.id, null, feature, false);
      saveFeature(feature.id, 0);
    },
    [setData, saveFeature],
  );

  const updateFeature = useCallback(
    (id: string, patch: Partial<MapFeature> | ((f: MapFeature) => MapFeature), opts: { delay?: number; undo?: boolean } = {}) => {
      const before = dataRef.current.features.find((f) => f.id === id);
      if (!before) return;
      const after = typeof patch === 'function' ? patch(before) : { ...before, ...patch };
      setData((d) => ({ ...d, features: d.features.map((f) => (f.id === id ? after : f)) }));
      if (opts.undo !== false) pushUndo(id, before, after, true);
      saveFeature(id, opts.delay ?? TYPING_DELAY);
    },
    [setData, saveFeature],
  );

  /** Cambio de geometría en vivo (arrastrando): solo pantalla, sin guardar. */
  const previewGeometry = useCallback(
    (id: string, geometry: MapFeature['geometry']) => {
      setData((d) => ({ ...d, features: d.features.map((f) => (f.id === id ? { ...f, geometry } : f)) }));
    },
    [setData],
  );

  const geometryBefore = useRef(new Map<string, MapFeature>());
  const beginGeometryEdit = useCallback((id: string) => {
    if (geometryBefore.current.has(id)) return;
    const f = dataRef.current.features.find((x) => x.id === id);
    if (f) geometryBefore.current.set(id, f);
  }, []);

  const commitGeometry = useCallback(
    (id: string) => {
      const after = dataRef.current.features.find((f) => f.id === id);
      const before = geometryBefore.current.get(id) ?? null;
      geometryBefore.current.delete(id);
      if (!after) return;
      pushUndo(id, before, after, false);
      saveFeature(id, 0);
    },
    [saveFeature],
  );

  const deleteFeature = useCallback(
    (id: string) => {
      const before = dataRef.current.features.find((f) => f.id === id);
      if (!before) return;
      setData((d) => ({ ...d, features: d.features.filter((f) => f.id !== id) }));
      // La foto se borra del servidor: al deshacer, el elemento vuelve sin ella.
      pushUndo(id, before.photo ? { ...before, photo: null } : before, null, false);
      window.clearTimeout(timers.current.get(`features:${id}`));
      timers.current.delete(`features:${id}`);
      tasks.current.delete(`features:${id}`);
      schedule(`features:${id}:delete`, () => api.remove('features', id), 0);
    },
    [setData, schedule],
  );

  const undo = useCallback(() => {
    const entry = undoStack.current.pop();
    setCanUndo(undoStack.current.length > 0);
    if (!entry) return null;
    const { id, before } = entry;
    if (before) {
      setData((d) => {
        const exists = d.features.some((f) => f.id === id);
        return { ...d, features: exists ? d.features.map((f) => (f.id === id ? before : f)) : [...d.features, before] };
      });
      saveFeature(id, 0);
    } else {
      setData((d) => ({ ...d, features: d.features.filter((f) => f.id !== id) }));
      schedule(`features:${id}:delete`, () => api.remove('features', id), 0);
    }
    return entry;
  }, [setData, saveFeature, schedule]);

  // ─── Categorías e ítems de leyenda ────────────────────────────────────────
  const upsertCategory = useCallback(
    (cat: Category, delay = TYPING_DELAY) => {
      setData((d) => {
        const exists = d.categories.some((c) => c.id === cat.id);
        return { ...d, categories: exists ? d.categories.map((c) => (c.id === cat.id ? cat : c)) : [...d.categories, cat] };
      });
      schedule(`categories:${cat.id}`, async () => {
        const c = dataRef.current.categories.find((x) => x.id === cat.id);
        if (c) await api.put('categories', c);
      }, delay);
    },
    [setData, schedule],
  );

  const deleteCategory = useCallback(
    (id: string) => {
      setData((d) => ({
        ...d,
        categories: d.categories.filter((c) => c.id !== id),
        features: d.features.map((f) => (f.categoryId === id ? { ...f, categoryId: null } : f)),
      }));
      schedule(`categories:${id}`, () => api.remove('categories', id), 0);
    },
    [setData, schedule],
  );

  const upsertLegend = useCallback(
    (item: LegendItem, delay = TYPING_DELAY) => {
      setData((d) => {
        const exists = d.legend.some((l) => l.id === item.id);
        return { ...d, legend: exists ? d.legend.map((l) => (l.id === item.id ? item : l)) : [...d.legend, item] };
      });
      schedule(`legend:${item.id}`, async () => {
        const l = dataRef.current.legend.find((x) => x.id === item.id);
        if (l) await api.put('legend', l);
      }, delay);
    },
    [setData, schedule],
  );

  const deleteLegend = useCallback(
    (id: string) => {
      setData((d) => ({
        ...d,
        legend: d.legend.filter((l) => l.id !== id),
        features: d.features.map((f) => (f.legendId === id ? { ...f, legendId: null } : f)),
      }));
      schedule(`legend:${id}`, () => api.remove('legend', id), 0);
    },
    [setData, schedule],
  );

  const reorder = useCallback(
    (collection: 'categories' | 'legend', ids: string[]) => {
      setData((d) => ({
        ...d,
        [collection]: (d[collection] as (Category | LegendItem)[]).map((x) => ({ ...x, sortOrder: Math.max(0, ids.indexOf(x.id)) })),
      }));
      schedule(`${collection}:order`, () => api.reorder(collection, ids), 0);
    },
    [setData, schedule],
  );

  // ─── Ajustes ──────────────────────────────────────────────────────────────
  const updateSettings = useCallback(
    (fn: (s: Settings) => Settings, delay = TYPING_DELAY) => {
      setData((d) => ({ ...d, settings: fn(d.settings) }));
      schedule('settings', () => api.settings(dataRef.current.settings), delay);
    },
    [setData, schedule],
  );

  return {
    data,
    dataRef,
    status,
    error,
    canUndo,
    createFeature,
    updateFeature,
    previewGeometry,
    beginGeometryEdit,
    commitGeometry,
    deleteFeature,
    undo,
    upsertCategory,
    deleteCategory,
    upsertLegend,
    deleteLegend,
    reorder,
    updateSettings,
  };
}

export type EditorData = ReturnType<typeof useEditorData>;
