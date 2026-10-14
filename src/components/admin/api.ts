/** Cliente HTTP del panel. Todas las rutas exigen sesión de administrador. */
import type { CollectionItem, CollectionName, MapData, Settings } from '@/lib/schemas';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, credentials: 'same-origin' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) {
      window.location.href = '/admin/login?expired=1';
    }
    throw new ApiError(res.status, body.error ?? `Error ${res.status}`);
  }
  return body as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export const api = {
  data: () => request<MapData>('/api/admin/data', { method: 'GET' }),
  put: <C extends CollectionName>(collection: C, item: CollectionItem<C>) =>
    request<CollectionItem<C>>(`/api/admin/collections/${collection}`, json('PUT', item)),
  remove: (collection: CollectionName, id: string) =>
    request<{ ok: true }>(`/api/admin/collections/${collection}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  reorder: (collection: 'categories' | 'legend', ids: string[]) =>
    request<{ ok: true }>(`/api/admin/collections/${collection}/reorder`, json('POST', { ids })),
  settings: (settings: Settings) => request<Settings>('/api/admin/settings', json('PUT', settings)),
  upload: (blob: Blob, kind: 'photo' | 'thumb' | 'icon') => {
    const form = new FormData();
    form.append('kind', kind);
    form.append('file', blob, `${kind}`);
    return request<{ url: string; bytes: number }>('/api/admin/upload', { method: 'POST', body: form });
  },
  logout: () => request<{ ok: true }>('/api/admin/logout', { method: 'POST' }),
};
