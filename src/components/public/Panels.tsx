'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { byOrder, directionsUrl, featureCenter, normalize, swatchClass } from '@/lib/format';
import type { Category, LegendItem, MapData, MapFeature, Settings } from '@/lib/schemas';

/** Panel lateral (escritorio) / hoja inferior (celular). */
export function Sheet({ open, onClose, wide, children }: { open: boolean; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  useEffect(() => {
    if (open) ref.current?.scrollTo({ top: 0 });
  }, [open, children]);
  // Celular: deslizar hacia abajo para cerrar (cuando el contenido está arriba de todo)
  const drag = useRef<{ y: number; dy: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    if ((ref.current?.scrollTop ?? 0) <= 0) drag.current = { y: e.touches[0].clientY, dy: 0 };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!drag.current || !ref.current) return;
    drag.current.dy = Math.max(0, e.touches[0].clientY - drag.current.y);
    ref.current.style.transform = drag.current.dy ? `translateY(${drag.current.dy}px)` : '';
    ref.current.style.transition = 'none';
  };
  const onTouchEnd = () => {
    if (!drag.current || !ref.current) return;
    const { dy } = drag.current;
    drag.current = null;
    ref.current.style.transition = '';
    ref.current.style.transform = '';
    if (dy > 80) onClose();
  };

  return (
    <aside
      ref={ref}
      className={`sheet${open ? ' is-open' : ''}${wide ? ' sheet--wide' : ''}`}
      aria-hidden={!open}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="sheet__handle" aria-hidden="true" />
      {children}
    </aside>
  );
}

function PanelHeader({ title, onClose, eyebrow }: { title: string; onClose: () => void; eyebrow?: React.ReactNode }) {
  return (
    <div className="panel__head">
      <div>
        {eyebrow}
        <h2 className="panel__title">{title}</h2>
      </div>
      <button className="btn btn--ghost btn--icon" onClick={onClose} aria-label="Cerrar">
        <Icon name="close" />
      </button>
    </div>
  );
}

// ─── Detalle de un punto, franja, zona o texto ──────────────────────────────
export function DetailPanel({
  feature,
  category,
  legendItem,
  onClose,
  onToast,
}: {
  feature: MapFeature;
  category?: Category;
  legendItem?: LegendItem;
  onClose: () => void;
  onToast: (msg: string) => void;
}) {
  const [imgLoaded, setImgLoaded] = useState(false);
  useEffect(() => setImgLoaded(false), [feature.id]);

  const title = feature.title || legendItem?.name || category?.name || 'Sin título';
  const eyebrow = category ? (
    <span className="pill" style={{ ['--chip-color' as string]: category.color }}>
      <span className="chip-icon">
        <img src={category.icon || '/icons/punto.svg'} alt="" />
      </span>
      {category.name}
    </span>
  ) : legendItem ? (
    <span className="pill">
      <span className={swatchClass(legendItem)} style={{ ['--swatch' as string]: legendItem.color }} />
      {legendItem.name}
    </span>
  ) : null;

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        onToast('Link copiado');
      }
    } catch {
      /* el usuario canceló */
    }
  };

  const description = feature.description || (legendItem && legendItem.name !== title ? legendItem.description : '') || category?.description || '';

  return (
    <article className="panel">
      <PanelHeader title={title} onClose={onClose} eyebrow={eyebrow} />
      {feature.photo && (
        <figure className="detail__photo" style={{ aspectRatio: `${feature.photo.width} / ${feature.photo.height}`, backgroundImage: `url(${feature.photo.thumbUrl})` }}>
          <img
            src={feature.photo.url}
            alt={title}
            width={feature.photo.width}
            height={feature.photo.height}
            decoding="async"
            onLoad={() => setImgLoaded(true)}
            data-loaded={imgLoaded}
          />
        </figure>
      )}
      {description && <p className="detail__text">{description}</p>}
      <div className="detail__actions">
        <a className="btn btn--primary btn--sm" href={directionsUrl(featureCenter(feature))} target="_blank" rel="noopener noreferrer">
          <Icon name="directions" size={16} /> Cómo llegar
        </a>
        <button className="btn btn--sm" onClick={share}>
          <Icon name="share" size={16} /> Compartir
        </button>
      </div>
    </article>
  );
}

// ─── Explorar / buscar ──────────────────────────────────────────────────────
export function ExplorePanel({ data, onSelect, onClose }: { data: MapData; onSelect: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (window.matchMedia('(min-width: 900px)').matches) inputRef.current?.focus();
  }, []);

  const groups = useMemo(() => {
    const query = normalize(q);
    const cats = new Map(data.categories.map((c) => [c.id, c]));
    const legend = new Map(data.legend.map((l) => [l.id, l]));
    const match = (f: MapFeature) => {
      if (!query) return true;
      const extra = f.categoryId ? cats.get(f.categoryId)?.name : f.legendId ? legend.get(f.legendId)?.name : '';
      return normalize(`${f.title} ${f.description} ${extra ?? ''}`).includes(query);
    };
    const listable = data.features.filter((f) => f.kind !== 'label' && match(f));
    const out: { key: string; name: string; color: string; icon?: string; legend?: LegendItem; items: MapFeature[] }[] = [];
    for (const c of [...data.categories].sort(byOrder)) {
      const items = listable.filter((f) => f.kind === 'point' && f.categoryId === c.id);
      if (items.length) out.push({ key: c.id, name: c.name, color: c.color, icon: c.icon, items });
    }
    const loose = listable.filter((f) => f.kind === 'point' && (!f.categoryId || !cats.has(f.categoryId)));
    if (loose.length) out.push({ key: '_points', name: 'Otros puntos', color: '#1f2a2e', items: loose });
    for (const l of [...data.legend].sort(byOrder)) {
      const items = listable.filter((f) => f.kind !== 'point' && f.legendId === l.id);
      if (items.length) out.push({ key: l.id, name: l.name, color: l.color, legend: l, items });
    }
    return out;
  }, [data, q]);

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <section className="panel">
      <PanelHeader title="Explorar la feria" onClose={onClose} />
      <label className="search">
        <Icon name="search" size={18} />
        <span className="sr-only">Buscar</span>
        <input ref={inputRef} type="search" placeholder="Buscar libros, discos, plantas…" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      {total === 0 ? (
        <p className="empty">No encontramos nada con “{q}”.</p>
      ) : (
        groups.map((g) => (
          <div key={g.key} className="group">
            <h3 className="group__title">
              {g.legend ? (
                <span className={swatchClass(g.legend)} style={{ ['--swatch' as string]: g.color }} />
              ) : (
                <span className="chip-icon" style={{ ['--chip-color' as string]: g.color }}>
                  <img src={g.icon || '/icons/punto.svg'} alt="" />
                </span>
              )}
              {g.name} <span className="group__count">{g.items.length}</span>
            </h3>
            <ul className="list">
              {g.items.map((f) => (
                <li key={f.id}>
                  <button className="list__item" onClick={() => onSelect(f.id)}>
                    {f.photo ? (
                      <img className="list__thumb" src={f.photo.thumbUrl} alt="" loading="lazy" />
                    ) : (
                      <span className="list__thumb list__thumb--empty" style={{ ['--chip-color' as string]: g.color }}>
                        {g.icon && <img src={g.icon} alt="" />}
                      </span>
                    )}
                    <span className="list__text">
                      <strong>{f.title || g.name}</strong>
                      {f.description && <span>{f.description.split('\n')[0]}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}

// ─── Sobre la feria ─────────────────────────────────────────────────────────
export function AboutPanel({ settings, onClose }: { settings: Settings; onClose: () => void }) {
  return (
    <section className="panel">
      <PanelHeader title={settings.title} onClose={onClose} />
      {settings.subtitle && <p className="about__lead">{settings.subtitle}</p>}
      {settings.schedule && (
        <p className="about__schedule">
          <Icon name="clock" size={18} /> {settings.schedule}
        </p>
      )}
      {settings.about && <p className="detail__text">{settings.about}</p>}
      <div className="detail__actions">
        <a className="btn btn--primary btn--sm" href={directionsUrl(settings.view.center)} target="_blank" rel="noopener noreferrer">
          <Icon name="directions" size={16} /> Cómo llegar a la feria
        </a>
      </div>
      <p className="about__credits">
        Mapa base: © colaboradores de OpenStreetMap, OpenMapTiles y OpenFreeMap.
      </p>
    </section>
  );
}
