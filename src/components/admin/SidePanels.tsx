'use client';

import { useMemo, useState } from 'react';
import { Icon } from '@/components/Icon';
import { THEME_PRESETS } from '@/lib/defaults';
import { byOrder, kindLabel, newId, normalize, slugify, swatchClass } from '@/lib/format';
import { rasterizeIcon } from '@/lib/image';
import type { BaseTheme, Category, FeatureKind, LegendItem, Settings } from '@/lib/schemas';
import { api } from './api';
import { ColorInput, Field, Section, Segmented, Slider, TextArea, TextInput, Toggle } from './controls';
import { ImageDrop } from './ImageDrop';
import type { EditorData } from './useEditorData';

type Toast = (msg: string, kind?: 'ok' | 'error') => void;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// ─── Elementos ───────────────────────────────────────────────────────────────
export function ElementsPanel({ ed, selectedId, onSelect }: { ed: EditorData; selectedId: string | null; onSelect: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<'all' | FeatureKind>('all');
  const { features, categories, legend } = ed.data;
  const cats = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const legs = useMemo(() => new Map(legend.map((l) => [l.id, l])), [legend]);

  const list = useMemo(() => {
    const query = normalize(q);
    return features
      .filter((f) => kind === 'all' || f.kind === kind)
      .filter((f) => !query || normalize(`${f.title} ${f.description}`).includes(query))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [features, q, kind]);

  const count = (k: FeatureKind) => features.filter((f) => f.kind === k).length;

  return (
    <div className="side-panel">
      <label className="side-search">
        <Icon name="search" size={16} />
        <input type="search" placeholder="Buscar elementos…" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <Segmented
        value={kind}
        onChange={setKind}
        options={[
          { value: 'all', label: `Todo ${features.length}` },
          { value: 'point', label: `Puntos ${count('point')}` },
          { value: 'line', label: `Franjas ${count('line')}` },
          { value: 'area', label: `Zonas ${count('area')}` },
          { value: 'label', label: `Textos ${count('label')}` },
        ]}
      />
      {list.length === 0 ? (
        <p className="side-empty">
          {features.length === 0 ? 'Todavía no hay elementos. Elegí una herramienta arriba y hacé clic en el mapa.' : 'Nada coincide con la búsqueda.'}
        </p>
      ) : (
        <ul className="el-list">
          {list.map((f) => {
            const cat = f.categoryId ? cats.get(f.categoryId) : undefined;
            const leg = f.legendId ? legs.get(f.legendId) : undefined;
            return (
              <li key={f.id}>
                <button className={`el-item${selectedId === f.id ? ' is-active' : ''}`} onClick={() => onSelect(f.id)}>
                  {f.kind === 'point' ? (
                    <span className="chip-icon" style={{ ['--chip-color' as string]: cat?.color ?? '#1f2a2e' }}>
                      <img src={cat?.icon || '/icons/punto.svg'} alt="" />
                    </span>
                  ) : f.kind === 'label' ? (
                    <span className="el-item__glyph">
                      <Icon name="text" size={14} />
                    </span>
                  ) : (
                    <span className={leg ? swatchClass(leg) : 'swatch'} style={{ ['--swatch' as string]: leg?.color ?? '#bbbbbb' }} />
                  )}
                  <span className="el-item__text">
                    <strong>{f.title || (leg?.name ?? kindLabel(f.kind))}</strong>
                    <small>
                      {kindLabel(f.kind)}
                      {cat ? ` · ${cat.name}` : leg && f.title ? ` · ${leg.name}` : ''}
                    </small>
                  </span>
                  {!f.published && <span className="badge">Borrador</span>}
                  {f.photo && <Icon name="image" size={14} className="el-item__meta" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Íconos (categorías de puntos) ───────────────────────────────────────────
const PALETTE = ['#d9572b', '#2f6fb2', '#3e8e4e', '#7a3fa0', '#c98a00', '#8c5a2b', '#c2185b', '#00838f', '#5d4037', '#455a64'];

export function CategoriesPanel({ ed, onToast }: { ed: EditorData; onToast: Toast }) {
  const cats = [...ed.data.categories].sort(byOrder);
  const [uploading, setUploading] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const usage = (id: string) => ed.data.features.filter((f) => f.categoryId === id).length;

  const add = () => {
    const name = 'Nuevo ícono';
    const cat: Category = {
      id: `${slugify(name)}-${newId().slice(0, 5)}`,
      name,
      description: '',
      color: PALETTE[cats.length % PALETTE.length],
      icon: '/icons/punto.svg',
      sortOrder: cats.length,
      visible: true,
    };
    ed.upsertCategory(cat, 0);
    setOpenId(cat.id);
  };

  async function uploadIcon(cat: Category, file: File) {
    setUploading(cat.id);
    try {
      const png = await rasterizeIcon(file);
      const { url } = await api.upload(png, 'icon');
      ed.upsertCategory({ ...cat, icon: url }, 0);
      onToast('Ícono actualizado');
    } catch (err) {
      onToast((err as Error).message, 'error');
    } finally {
      setUploading(null);
    }
  }

  const move = (i: number, dir: -1 | 1) => {
    const ids = cats.map((c) => c.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    ed.reorder('categories', ids);
  };

  return (
    <div className="side-panel">
      <p className="side-intro">Cada ícono representa un tipo de puesto o lugar. Subí tus propios diseños (SVG, PNG o JPG): se optimizan solos.</p>
      <ul className="card-list">
        {cats.map((c, i) => {
          const open = openId === c.id;
          return (
            <li key={c.id} className={`card${open ? ' is-open' : ''}${c.visible ? '' : ' is-muted'}`}>
              <div className="card__row">
                <ImageDrop onFile={(file) => uploadIcon(c, file)} busy={uploading === c.id} accept="image/svg+xml,image/png,image/jpeg,image/webp" className="drop--icon">
                  <span className="cat-icon" style={{ ['--chip-color' as string]: c.color }} title="Cambiar ícono (clic o soltar archivo)">
                    {uploading === c.id ? <span className="spinner" /> : <img src={c.icon || '/icons/punto.svg'} alt="" />}
                  </span>
                </ImageDrop>
                <button className="card__title" onClick={() => setOpenId(open ? null : c.id)} aria-expanded={open}>
                  <strong>{c.name}</strong>
                  <small>{plural(usage(c.id), 'punto', 'puntos')}</small>
                </button>
                <div className="card__tools">
                  <button className="btn btn--ghost btn--sm btn--icon" onClick={() => move(i, -1)} disabled={i === 0} title="Subir">
                    <Icon name="arrowUp" size={14} />
                  </button>
                  <button className="btn btn--ghost btn--sm btn--icon" onClick={() => move(i, 1)} disabled={i === cats.length - 1} title="Bajar">
                    <Icon name="arrowDown" size={14} />
                  </button>
                </div>
              </div>
              {open && (
                <div className="card__body">
                  <Field label="Nombre">
                    <TextInput value={c.name} onChange={(name) => ed.upsertCategory({ ...c, name })} maxLength={60} autoFocus />
                  </Field>
                  <Field label="Color del marcador">
                    <ColorInput value={c.color} onChange={(color) => ed.upsertCategory({ ...c, color })} />
                  </Field>
                  <Field label="Qué representa">
                    <TextArea value={c.description} onChange={(description) => ed.upsertCategory({ ...c, description })} maxLength={400} rows={2} placeholder="Ej.: floristerías y viveros" />
                  </Field>
                  <Toggle checked={c.visible} onChange={(visible) => ed.upsertCategory({ ...c, visible }, 0)} label="Visible en el mapa público" />
                  <div className="card__danger">
                    <button
                      className="btn btn--sm btn--danger"
                      onClick={() => {
                        const n = usage(c.id);
                        if (confirm(n ? `"${c.name}" se usa en ${n} puntos. Esos puntos quedarán sin ícono. ¿Eliminar?` : `¿Eliminar "${c.name}"?`)) ed.deleteCategory(c.id);
                      }}
                    >
                      <Icon name="trash" size={14} /> Eliminar ícono
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <button className="btn add-btn" onClick={add}>
        <Icon name="plus" size={16} /> Nuevo ícono
      </button>
    </div>
  );
}

// ─── Leyenda (colores con significado) ──────────────────────────────────────
export function LegendPanel({ ed }: { ed: EditorData }) {
  const items = [...ed.data.legend].sort(byOrder);
  const [openId, setOpenId] = useState<string | null>(null);
  const usage = (id: string) => ed.data.features.filter((f) => f.legendId === id).length;

  const add = (kind: LegendItem['kind']) => {
    const item: LegendItem = {
      id: `ley-${newId().slice(0, 8)}`,
      name: kind === 'line' ? 'Nueva franja' : 'Nueva zona',
      description: '',
      kind,
      color: PALETTE[items.length % PALETTE.length],
      width: kind === 'line' ? 9 : 2,
      opacity: kind === 'line' ? 0.85 : 0.25,
      dash: 'solid',
      sortOrder: items.length,
      visible: true,
    };
    ed.upsertLegend(item, 0);
    setOpenId(item.id);
  };

  const move = (i: number, dir: -1 | 1) => {
    const ids = items.map((c) => c.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    ed.reorder('legend', ids);
  };

  return (
    <div className="side-panel">
      <p className="side-intro">Definí qué significa cada color. Después, pintá cuadras o dibujá zonas con ese significado: el público lo ve en “Referencias”.</p>
      <ul className="card-list">
        {items.map((l, i) => {
          const open = openId === l.id;
          return (
            <li key={l.id} className={`card${open ? ' is-open' : ''}${l.visible ? '' : ' is-muted'}`}>
              <div className="card__row">
                <span className="legend-swatch-big">
                  <span className={swatchClass(l)} style={{ ['--swatch' as string]: l.color, opacity: l.kind === 'line' ? l.opacity : 1 }} />
                </span>
                <button className="card__title" onClick={() => setOpenId(open ? null : l.id)} aria-expanded={open}>
                  <strong>{l.name}</strong>
                  <small>
                    {l.kind === 'line' ? 'Franja' : 'Zona'} · {plural(usage(l.id), 'uso', 'usos')} en el mapa
                  </small>
                </button>
                <div className="card__tools">
                  <button className="btn btn--ghost btn--sm btn--icon" onClick={() => move(i, -1)} disabled={i === 0} title="Subir">
                    <Icon name="arrowUp" size={14} />
                  </button>
                  <button className="btn btn--ghost btn--sm btn--icon" onClick={() => move(i, 1)} disabled={i === items.length - 1} title="Bajar">
                    <Icon name="arrowDown" size={14} />
                  </button>
                </div>
              </div>
              {open && (
                <div className="card__body">
                  <Field label="Significado">
                    <TextInput value={l.name} onChange={(name) => ed.upsertLegend({ ...l, name })} maxLength={60} autoFocus />
                  </Field>
                  <Field label="Descripción (se ve en Referencias)">
                    <TextArea value={l.description} onChange={(description) => ed.upsertLegend({ ...l, description })} maxLength={400} rows={2} />
                  </Field>
                  <Field label="Tipo">
                    <Segmented
                      value={l.kind}
                      onChange={(kind) => ed.upsertLegend({ ...l, kind }, 0)}
                      options={[
                        { value: 'line', label: 'Franja (calle)' },
                        { value: 'area', label: 'Zona (área)' },
                      ]}
                    />
                  </Field>
                  <Field label="Color">
                    <ColorInput value={l.color} onChange={(color) => ed.upsertLegend({ ...l, color }, 300)} />
                  </Field>
                  <Field label="Opacidad">
                    <Slider value={l.opacity} min={0.05} max={1} step={0.05} onChange={(opacity) => ed.upsertLegend({ ...l, opacity }, 300)} format={(v) => `${Math.round(v * 100)}%`} />
                  </Field>
                  <Field label={l.kind === 'line' ? 'Grosor' : 'Grosor del borde'}>
                    <Slider value={l.width} min={1} max={l.kind === 'line' ? 30 : 8} onChange={(width) => ed.upsertLegend({ ...l, width }, 300)} format={(v) => `${v} px`} />
                  </Field>
                  {l.kind === 'line' && (
                    <Field label="Trazo">
                      <Segmented
                        value={l.dash}
                        onChange={(dash) => ed.upsertLegend({ ...l, dash }, 0)}
                        options={[
                          { value: 'solid', label: 'Continuo' },
                          { value: 'dashed', label: 'Guiones' },
                          { value: 'dotted', label: 'Puntos' },
                        ]}
                      />
                    </Field>
                  )}
                  <Toggle checked={l.visible} onChange={(visible) => ed.upsertLegend({ ...l, visible }, 0)} label="Visible en el mapa público" />
                  <div className="card__danger">
                    <button
                      className="btn btn--sm btn--danger"
                      onClick={() => {
                        const n = usage(l.id);
                        if (confirm(n ? `"${l.name}" se usa en ${n} elementos, que dejarán de verse en el mapa público. ¿Eliminar?` : `¿Eliminar "${l.name}"?`)) ed.deleteLegend(l.id);
                      }}
                    >
                      <Icon name="trash" size={14} /> Eliminar
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="add-row">
        <button className="btn add-btn" onClick={() => add('line')}>
          <Icon name="plus" size={16} /> Franja
        </button>
        <button className="btn add-btn" onClick={() => add('area')}>
          <Icon name="plus" size={16} /> Zona
        </button>
      </div>
    </div>
  );
}

// ─── Mapa base ──────────────────────────────────────────────────────────────
const COLOR_TOKENS: { group: string; items: [keyof BaseTheme, string][] }[] = [
  { group: 'Fondo', items: [['background', 'Manzanas'], ['building', 'Edificios'], ['park', 'Plazas y verde'], ['water', 'Agua']] },
  { group: 'Calles', items: [['roadMajor', 'Avenidas'], ['roadMinor', 'Calles'], ['roadPath', 'Peatonales'], ['roadCasing', 'Borde de calles']] },
  { group: 'Textos', items: [['streetLabel', 'Nombres de calles'], ['streetLabelHalo', 'Contorno de textos'], ['placeLabel', 'Barrios']] },
];

interface BaseProps {
  ed: EditorData;
  onUseCurrentView: () => void;
  onSetBoundsToView: () => void;
  onDrawFocus: () => void;
  onEditFocus: () => void;
  onFitFocus: () => void;
}

export function BasePanel({ ed, onUseCurrentView, onSetBoundsToView, onDrawFocus, onEditFocus, onFitFocus }: BaseProps) {
  const { settings } = ed.data;
  const theme = settings.base;
  const setTheme = (patch: Partial<BaseTheme>, delay = 400) => ed.updateSettings((s) => ({ ...s, base: { ...s.base, ...patch } }), delay);
  const setFocus = (patch: Partial<Settings['focus']>, delay = 400) => ed.updateSettings((s) => ({ ...s, focus: { ...s.focus, ...patch } }), delay);
  const setMarkers = (patch: Partial<Settings['markers']>) => ed.updateSettings((s) => ({ ...s, markers: { ...s.markers, ...patch } }), 400);
  const setView = (patch: Partial<Settings['view']>) => ed.updateSettings((s) => ({ ...s, view: { ...s.view, ...patch } }), 400);

  return (
    <div className="side-panel">
      <Section title="Estilos rápidos">
        <div className="presets">
          {Object.entries(THEME_PRESETS).map(([key, p]) => (
            <button key={key} className="preset" onClick={() => setTheme(p.theme, 0)} title={`Aplicar estilo ${p.label}`}>
              <span className="preset__sample" style={{ background: p.theme.background }}>
                <span style={{ background: p.theme.roadMinor, boxShadow: `0 0 0 1.5px ${p.theme.roadCasing}` }} />
                <span style={{ background: p.theme.building }} />
              </span>
              {p.label}
            </button>
          ))}
        </div>
      </Section>

      {COLOR_TOKENS.map((g) => (
        <Section key={g.group} title={g.group}>
          {g.items.map(([key, label]) => (
            <Field key={key} label={label} inline>
              <ColorInput value={theme[key] as string} onChange={(v) => setTheme({ [key]: v } as Partial<BaseTheme>)} label={label} />
            </Field>
          ))}
          {g.group === 'Fondo' && (
            <>
              <Field label="Opacidad de edificios">
                <Slider value={theme.buildingOpacity} min={0} max={1} step={0.05} onChange={(buildingOpacity) => setTheme({ buildingOpacity })} format={(v) => `${Math.round(v * 100)}%`} />
              </Field>
              <Toggle checked={theme.showBuildings} onChange={(showBuildings) => setTheme({ showBuildings }, 0)} label="Mostrar edificios" />
            </>
          )}
          {g.group === 'Calles' && (
            <Field label="Ancho de calles">
              <Slider value={theme.roadWidth} min={0.3} max={3} step={0.1} onChange={(roadWidth) => setTheme({ roadWidth })} format={(v) => `${v.toFixed(1)}×`} />
            </Field>
          )}
          {g.group === 'Textos' && (
            <>
              <Field label="Tamaño de nombres de calles">
                <Slider value={theme.streetLabelSize} min={8} max={24} onChange={(streetLabelSize) => setTheme({ streetLabelSize })} format={(v) => `${v} px`} />
              </Field>
              <Toggle checked={theme.showStreetNames} onChange={(showStreetNames) => setTheme({ showStreetNames }, 0)} label="Mostrar nombres de calles" />
              <Toggle checked={theme.showPlaceLabels} onChange={(showPlaceLabels) => setTheme({ showPlaceLabels }, 0)} label="Mostrar nombres de barrios" />
            </>
          )}
        </Section>
      ))}

      <Section title="Límite de la feria">
        <Segmented
          value={settings.focus.enabled === false ? 'off' : 'on'}
          onChange={(v) => setFocus({ enabled: v === 'on' }, 0)}
          options={[
            { value: 'on', label: 'Zona delimitada' },
            { value: 'off', label: 'Sin límite' },
          ]}
        />
        {settings.focus.enabled === false ? (
          <p className="side-intro side-intro--top">
            Sin borde ni atenuación: la feria queda marcada solo por las <strong>calles pintadas</strong> (pestaña Leyenda + herramienta Pintar cuadra).
          </p>
        ) : (
          <>
            <p className="side-intro side-intro--top">Lo que queda fuera de la zona se atenúa para que la mirada vaya a la feria.</p>
            <div className="btn-row">
              {settings.focus.polygon && (
                <button className="btn btn--sm btn--primary" onClick={onEditFocus}>
                  <Icon name="pointer" size={15} /> Editar bordes
                </button>
              )}
              <button className="btn btn--sm" onClick={onDrawFocus}>
                <Icon name="area" size={15} /> {settings.focus.polygon ? 'Redibujar' : 'Dibujar zona'}
              </button>
              {settings.focus.polygon && (
                <button className="btn btn--sm btn--icon" onClick={onFitFocus} title="Ver zona completa">
                  <Icon name="frame" size={15} />
                </button>
              )}
            </div>
            <Toggle checked={settings.focus.showOutline !== false} onChange={(showOutline) => setFocus({ showOutline }, 0)} label="Mostrar línea de borde" />
            {settings.focus.showOutline !== false && (
              <Field label="Color del borde" inline>
                <ColorInput value={settings.focus.outlineColor} onChange={(outlineColor) => setFocus({ outlineColor })} />
              </Field>
            )}
            <Field label="Color de atenuación" inline>
              <ColorInput value={settings.focus.dimColor} onChange={(dimColor) => setFocus({ dimColor })} />
            </Field>
            <Field label="Intensidad de atenuación">
              <Slider value={settings.focus.dimOpacity} min={0} max={0.9} step={0.05} onChange={(dimOpacity) => setFocus({ dimOpacity })} format={(v) => `${Math.round(v * 100)}%`} />
            </Field>
          </>
        )}
      </Section>

      <Section title="Marcadores">
        <Field label="Tamaño">
          <Slider value={settings.markers.size} min={20} max={64} onChange={(size) => setMarkers({ size })} format={(v) => `${v} px`} />
        </Field>
        <Toggle checked={settings.markers.showLabels} onChange={(showLabels) => setMarkers({ showLabels })} label="Mostrar nombre bajo cada punto" />
        <Field label="Color de acento (botones)" inline>
          <ColorInput value={settings.accent} onChange={(accent) => ed.updateSettings((s) => ({ ...s, accent }), 400)} />
        </Field>
      </Section>

      <Section title="Vista inicial y límites">
        <p className="side-intro">
          Centro {settings.view.center[1].toFixed(4)}, {settings.view.center[0].toFixed(4)} · zoom {settings.view.zoom.toFixed(1)}
        </p>
        <div className="btn-row">
          <button className="btn btn--sm" onClick={onUseCurrentView}>
            <Icon name="target" size={15} /> Usar la vista actual
          </button>
          <button className="btn btn--sm" onClick={onSetBoundsToView}>
            <Icon name="frame" size={15} /> Limitar a la vista
          </button>
          {settings.view.bounds && (
            <button className="btn btn--sm btn--ghost" onClick={() => setView({ bounds: null })}>
              Todo Montevideo
            </button>
          )}
        </div>
        <Field label="Zoom mínimo (alejarse)">
          <Slider value={settings.view.minZoom} min={10} max={18} step={0.5} onChange={(minZoom) => setView({ minZoom })} />
        </Field>
        <Field label="Zoom máximo (acercarse)">
          <Slider value={settings.view.maxZoom} min={16} max={22} step={0.5} onChange={(maxZoom) => setView({ maxZoom })} />
        </Field>
      </Section>
    </div>
  );
}

// ─── Información de la feria ─────────────────────────────────────────────────
export function InfoPanel({ ed }: { ed: EditorData }) {
  const s = ed.data.settings;
  const set = (patch: Partial<Settings>) => ed.updateSettings((x) => ({ ...x, ...patch }));
  return (
    <div className="side-panel">
      <p className="side-intro">Textos que ve el público en la cabecera y en “La feria”.</p>
      <Field label="Título">
        <TextInput value={s.title} onChange={(title) => set({ title })} maxLength={80} />
      </Field>
      <Field label="Bajada">
        <TextInput value={s.subtitle} onChange={(subtitle) => set({ subtitle })} maxLength={140} />
      </Field>
      <Field label="Días y horarios">
        <TextInput value={s.schedule} onChange={(schedule) => set({ schedule })} maxLength={200} placeholder="Domingos de 9 a 15 h" />
      </Field>
      <Field label="Sobre la feria">
        <TextArea value={s.about} onChange={(about) => set({ about })} maxLength={6000} rows={12} />
      </Field>
    </div>
  );
}
