'use client';

import { LngLatBounds, type Map as MLMap } from 'maplibre-gl';
import type { FeatureCollection, LineString } from 'geojson';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon, type IconName } from '@/components/Icon';
import { applyBaseTheme } from '@/components/map/baseStyle';
import { createMap } from '@/components/map/createMap';
import { highlightSelection, renderOverlays } from '@/components/map/overlays';
import { byOrder, featureBounds, featureCenter, formatBytes, newId, swatchClass } from '@/lib/format';
import type { MapData, MapFeature } from '@/lib/schemas';
import { api } from './api';
import { DrawController, type Editable, type Pos, type Tool } from './drawing';
import { Inspector } from './Inspector';
import { BasePanel, CategoriesPanel, ElementsPanel, InfoPanel, LegendPanel } from './SidePanels';
import { useEditorData } from './useEditorData';
import './admin.css';

type Tab = 'elements' | 'categories' | 'legend' | 'base' | 'info';

const TOOLS: { id: Tool; label: string; key: string; icon: IconName; help: string }[] = [
  { id: 'select', label: 'Seleccionar', key: 'V', icon: 'pointer', help: 'Clic para seleccionar · arrastrá los puntos naranjas para editar la forma' },
  { id: 'point', label: 'Punto', key: 'P', icon: 'pin', help: 'Clic en el mapa para agregar un punto (Shift: seguir agregando)' },
  { id: 'cuadra', label: 'Pintar cuadra', key: 'C', icon: 'street', help: 'Clic sobre una cuadra para pintarla entera con el color elegido' },
  { id: 'line', label: 'Franja', key: 'L', icon: 'line', help: 'Clic para cada vértice · doble clic o Enter para terminar · Retroceso borra el último' },
  { id: 'area', label: 'Zona', key: 'A', icon: 'area', help: 'Clic para cada vértice · clic en el primero o Enter para cerrar' },
  { id: 'label', label: 'Texto', key: 'T', icon: 'text', help: 'Clic en el mapa para ubicar un texto' },
];

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'elements', label: 'Elementos', icon: 'list' },
  { id: 'categories', label: 'Íconos', icon: 'tag' },
  { id: 'legend', label: 'Leyenda', icon: 'layers' },
  { id: 'base', label: 'Estilo', icon: 'palette' },
  { id: 'info', label: 'Feria', icon: 'info' },
];

const now = () => new Date().toISOString();
const FOCUS_ID = '__focus__';

function toEditable(f: MapFeature | undefined): Editable | null {
  if (!f) return null;
  if (f.kind === 'line' && f.geometry.type === 'LineString') return { id: f.id, kind: 'line', coords: f.geometry.coordinates };
  if (f.kind === 'area' && f.geometry.type === 'Polygon') return { id: f.id, kind: 'area', coords: f.geometry.coordinates[0].slice(0, -1) };
  if (f.kind === 'label' && f.geometry.type === 'Point') return { id: f.id, kind: 'label', coords: [f.geometry.coordinates] };
  return null;
}

function geometryFromEditable(kind: Editable['kind'], coords: Pos[]): MapFeature['geometry'] {
  if (kind === 'label') return { type: 'Point', coordinates: coords[0] };
  if (kind === 'line') return { type: 'LineString', coordinates: coords };
  return { type: 'Polygon', coordinates: [[...coords, coords[0]]] };
}

export default function Editor({ initialData, driver, ephemeral, username }: { initialData: MapData; driver: string; ephemeral: boolean; username: string }) {
  const ed = useEditorData(initialData);
  const { data } = ed;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const drawRef = useRef<DrawController | null>(null);
  const [ready, setReady] = useState(false);
  const [tool, setTool] = useState<Tool>('select');
  const [snap, setSnap] = useState(true);
  const [tab, setTab] = useState<Tab>('elements');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  /** Editando los bordes de la zona de la feria (arrastrando vértices). */
  const [focusEdit, setFocusEdit] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'error'; action?: { label: string; run: () => void } } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const sortedCats = useMemo(() => [...data.categories].sort(byOrder), [data.categories]);
  const lineLegend = useMemo(() => data.legend.filter((l) => l.kind === 'line').sort(byOrder), [data.legend]);
  const areaLegend = useMemo(() => data.legend.filter((l) => l.kind === 'area').sort(byOrder), [data.legend]);
  const [brushCategory, setBrushCategory] = useState<string | null>(sortedCats[0]?.id ?? null);
  const [brushLine, setBrushLine] = useState<string | null>(lineLegend[0]?.id ?? null);
  const [brushArea, setBrushArea] = useState<string | null>(areaLegend[0]?.id ?? null);

  const selected = useMemo(() => data.features.find((f) => f.id === selectedId), [data.features, selectedId]);
  /** Espacio que ocupan las fotos (la miniatura suma ≈ 15% más). */
  const photoUsage = useMemo(() => {
    const photos = data.features.filter((f) => f.photo);
    return { count: photos.length, bytes: Math.round(photos.reduce((n, f) => n + (f.photo?.bytes ?? 0), 0) * 1.15) };
  }, [data.features]);

  const showToast = useCallback((msg: string, kind: 'ok' | 'error' = 'ok', action?: { label: string; run: () => void }) => {
    window.clearTimeout(toastTimer.current);
    setToast({ msg, kind, action });
    toastTimer.current = window.setTimeout(() => setToast(null), action ? 6000 : 3200);
  }, []);

  // Errores de guardado → aviso visible
  useEffect(() => {
    if (ed.error) showToast(`No se pudo guardar: ${ed.error}`, 'error');
  }, [ed.error, showToast]);

  // ─── Acciones de creación (llamadas desde el motor de dibujo) ─────────────
  const base = (kind: MapFeature['kind'], geometry: MapFeature['geometry']): MapFeature => ({
    id: newId(kind[0]),
    kind,
    title: '',
    description: '',
    photo: null,
    categoryId: null,
    legendId: null,
    geometry,
    style: {},
    published: true,
    createdAt: now(),
    updatedAt: now(),
  });

  const shiftHeld = useRef(false);
  const callbacks = {
    onPoint: (pos: Pos) => {
      const f = { ...base('point', { type: 'Point', coordinates: pos }), categoryId: brushCategory };
      ed.createFeature(f);
      setSelectedId(f.id);
      if (!shiftHeld.current) setTool('select');
    },
    onLabel: (pos: Pos) => {
      const f = { ...base('label', { type: 'Point', coordinates: pos }), title: 'TEXTO', style: { textSize: 16, textColor: '#1f2a2e', haloColor: '#ffffff', rotation: 0 } };
      ed.createFeature(f);
      setSelectedId(f.id);
      setTool('select');
    },
    onLine: (coords: Pos[], source: 'draw' | 'cuadra') => {
      const f = { ...base('line', { type: 'LineString', coordinates: coords }), legendId: brushLine };
      ed.createFeature(f);
      setSelectedId(f.id);
      if (source === 'draw') setTool('select');
    },
    onArea: (ring: Pos[]) => {
      const f = { ...base('area', { type: 'Polygon', coordinates: [ring] }), legendId: brushArea };
      ed.createFeature(f);
      setSelectedId(f.id);
      setTool('select');
    },
    onFocus: (ring: Pos[]) => {
      ed.updateSettings((s) => ({ ...s, focus: { ...s.focus, polygon: ring } }), 0);
      setFocusMode(false);
      setTool('select');
      showToast('Zona de la feria actualizada');
    },
    onSelect: (id: string | null) => {
      if (focusEdit) {
        if (!id) return; // clic en el vacío: seguimos editando los bordes
        setFocusEdit(false);
      }
      setSelectedId(id);
    },
    onGeometryPreview: (id: string, coords: Pos[]) => {
      if (id === FOCUS_ID) {
        // Se guarda al soltar (ver onGeometryCommit)
        ed.updateSettings((s) => ({ ...s, focus: { ...s.focus, polygon: [...coords, coords[0]] } }), 60_000);
        return;
      }
      const f = ed.dataRef.current.features.find((x) => x.id === id);
      if (f?.kind === 'point') {
        ed.beginGeometryEdit(id);
        ed.previewGeometry(id, { type: 'Point', coordinates: coords[0] });
        return;
      }
      const editable = toEditable(f);
      if (!editable) return;
      ed.beginGeometryEdit(id);
      ed.previewGeometry(id, geometryFromEditable(editable.kind, coords));
    },
    onGeometryCommit: (id: string) => (id === FOCUS_ID ? ed.updateSettings((s) => s, 0) : ed.commitGeometry(id)),
    onDrawingChange: (n: number) => setDrawing(n),
  };
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  // ─── Mapa ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const map = createMap({
      container: containerRef.current,
      settings: initialData.settings,
      restrictBounds: false,
      onLoad: (m) => {
        const proxy = new Proxy({} as typeof callbacks, { get: (_, key) => (cbRef.current as Record<string | symbol, unknown>)[key] });
        drawRef.current = new DrawController(m, proxy);
        fetch('/data/cuadras.geojson')
          .then((r) => r.json())
          .then((fc: FeatureCollection<LineString>) => drawRef.current?.setCuadras(fc))
          .catch(() => showToast('No se pudieron cargar las cuadras (imán desactivado)', 'error'));
        setReady(true);
      },
    });
    map.setMinZoom(10.5);
    map.setMaxZoom(21);
    mapRef.current = map;
    return () => {
      drawRef.current?.destroy();
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const view = focusEdit ? { ...data, settings: { ...data.settings, focus: { ...data.settings.focus, showOutline: true } } } : data;
    void renderOverlays(mapRef.current, view, { includeDrafts: true });
  }, [ready, data.features, data.legend, data.categories, data.settings.focus, data.settings.markers, focusEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (ready && mapRef.current) applyBaseTheme(mapRef.current, data.settings.base);
  }, [ready, data.settings.base]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    highlightSelection(mapRef.current, selectedId);
    const polygon = data.settings.focus.polygon;
    drawRef.current?.setEditable(
      focusEdit && polygon ? { id: FOCUS_ID, kind: 'area', coords: polygon.slice(0, -1) } : toEditable(selected),
    );
  }, [ready, selectedId, selected, focusEdit, data.settings.focus.polygon]);

  useEffect(() => {
    drawRef.current?.setTool(focusMode ? 'focus' : tool);
  }, [tool, focusMode, ready]);

  useEffect(() => {
    drawRef.current?.setSnap(snap);
  }, [snap, ready]);

  // ─── Navegación ───────────────────────────────────────────────────────────
  const flyTo = useCallback((f: MapFeature | undefined) => {
    const map = mapRef.current;
    if (!map || !f) return;
    const padding = { top: 90, bottom: 60, left: 60, right: 60 };
    if (f.kind === 'point' || f.kind === 'label') map.easeTo({ center: featureCenter(f), zoom: Math.max(map.getZoom(), 17.5), duration: 600 });
    else map.fitBounds(featureBounds(f), { padding, maxZoom: 18.5, duration: 600 });
  }, []);

  const selectFromList = (id: string) => {
    setSelectedId(id);
    setTool('select');
    flyTo(data.features.find((f) => f.id === id));
  };

  const deleteSelected = useCallback(() => {
    const f = ed.dataRef.current.features.find((x) => x.id === selectedId);
    if (!f) return;
    ed.deleteFeature(f.id);
    setSelectedId(null);
    showToast(`${f.title || 'Elemento'} eliminado`, 'ok', {
      label: 'Deshacer',
      run: () => {
        ed.undo();
        setToast(null);
      },
    });
  }, [ed, selectedId, showToast]);

  /** Botón "Bordes de la feria": edita el contorno (o lo dibuja si no existe). */
  const startFeriaBorders = () => {
    const focus = ed.dataRef.current.settings.focus;
    setSelectedId(null);
    setTool('select');
    if (focus.enabled === false) ed.updateSettings((s) => ({ ...s, focus: { ...s.focus, enabled: true } }), 0);
    if (focus.polygon) {
      setFocusMode(false);
      setFocusEdit(true);
      fitFocus();
    } else {
      setFocusEdit(false);
      setFocusMode(true);
    }
  };
  const bordersActive = focusEdit || focusMode;

  const changeTool = (t: Tool) => {
    setFocusMode(false);
    setFocusEdit(false);
    setTool(t);
    if (t !== 'select') setSelectedId(null);
  };

  // ─── Atajos de teclado ──────────────────────────────────────────────────────
  useEffect(() => {
    const isTyping = (el: EventTarget | null) =>
      el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
    const onDown = (e: KeyboardEvent) => {
      shiftHeld.current = e.shiftKey;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !isTyping(e.target)) {
        e.preventDefault();
        const entry = ed.undo();
        if (entry) showToast('Deshecho');
        return;
      }
      if (e.key === 'Escape' && isTyping(e.target)) {
        (e.target as HTMLElement).blur();
        return;
      }
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const draw = drawRef.current;
      if (e.key === 'Escape') {
        if (draw?.isDrawing) draw.cancel();
        else if (focusEdit) setFocusEdit(false);
        else if (focusMode || tool !== 'select') changeTool('select');
        else setSelectedId(null);
        return;
      }
      if (e.key === 'Enter' && draw?.isDrawing) {
        draw.finish();
        return;
      }
      if (e.key === 'Backspace' && draw?.isDrawing) {
        e.preventDefault();
        draw.undoVertex();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        deleteSelected();
        return;
      }
      const t = TOOLS.find((x) => x.key.toLowerCase() === e.key.toLowerCase());
      if (t) changeTool(t.id);
      else if (e.key.toLowerCase() === 'm') setSnap((s) => !s);
      else if (e.key.toLowerCase() === 'b') (bordersActive ? changeTool('select') : startFeriaBorders());
    };
    const onUp = (e: KeyboardEvent) => (shiftHeld.current = e.shiftKey);
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  });

  // ─── Vista inicial / límites / zona ─────────────────────────────────────────
  const useCurrentView = () => {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    ed.updateSettings(
      (s) => ({ ...s, view: { ...s.view, center: [+c.lng.toFixed(6), +c.lat.toFixed(6)], zoom: +map.getZoom().toFixed(2), bearing: +map.getBearing().toFixed(1) } }),
      0,
    );
    showToast('Vista inicial guardada');
  };
  const setBoundsToView = () => {
    const b = mapRef.current?.getBounds();
    if (!b) return;
    const r = (n: number) => +n.toFixed(5);
    ed.updateSettings((s) => ({ ...s, view: { ...s.view, bounds: [[r(b.getWest()), r(b.getSouth())], [r(b.getEast()), r(b.getNorth())]] } }), 0);
    showToast('El público no podrá salir de esta zona');
  };
  const fitFocus = () => {
    const poly = data.settings.focus.polygon;
    if (!poly || !mapRef.current) return;
    const b = poly.reduce((acc, p) => acc.extend(p), new LngLatBounds(poly[0], poly[0]));
    mapRef.current.fitBounds(b, { padding: 60, duration: 600 });
  };

  const logout = async () => {
    await api.logout().catch(() => {});
    window.location.href = '/admin/login';
  };

  const activeTool = focusMode ? null : TOOLS.find((t) => t.id === tool);
  const statusText = { idle: 'Todo guardado', saving: 'Guardando…', saved: 'Guardado', error: 'Error al guardar' }[ed.status];

  return (
    <div className={`ed${selected ? ' has-inspector' : ''}`}>
      <header className="ed__top">
        <a className="ed__brand" href="/" target="_blank" rel="noopener" title="Ver el mapa público">
          <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
            <path d="M16 2C10.2 2 5.5 6.6 5.5 12.4 5.5 20.2 16 30 16 30s10.5-9.8 10.5-17.6C26.5 6.6 21.8 2 16 2Z" fill="#d9572b" />
            <circle cx="16" cy="12.5" r="4.5" fill="#f3eee3" />
          </svg>
          <span>
            <strong>Estudio</strong>
            <small>Tristán Narvaja</small>
          </span>
        </a>

        <nav className="toolbar" aria-label="Herramientas">
          {TOOLS.map((t) => (
            <button key={t.id} className={`tool${tool === t.id && !focusMode ? ' is-active' : ''}`} onClick={() => changeTool(t.id)} title={`${t.label} (${t.key})`} aria-pressed={tool === t.id && !focusMode}>
              <Icon name={t.icon} size={18} />
              <span className="tool__label">{t.label}</span>
              <kbd>{t.key}</kbd>
            </button>
          ))}
          <span className="toolbar__sep" />
          <button
            className={`tool tool--borders${bordersActive ? ' is-active' : ''}`}
            onClick={() => (bordersActive ? changeTool('select') : startFeriaBorders())}
            title="Bordes de la feria: mover el contorno que delimita la feria (B)"
            aria-pressed={bordersActive}
          >
            <Icon name="frame" size={18} />
            <span className="tool__label tool__label--always">Bordes de la feria</span>
            <kbd>B</kbd>
          </button>
          <span className="toolbar__sep" />
          <button className={`tool${snap ? ' is-active is-soft' : ''}`} onClick={() => setSnap(!snap)} title="Imán: pegar a las calles (M) · mantené Alt para desactivarlo momentáneamente" aria-pressed={snap}>
            <Icon name="magnet" size={18} />
            <span className="tool__label">Imán</span>
            <kbd>M</kbd>
          </button>
          <button className="tool" onClick={() => ed.undo() && showToast('Deshecho')} disabled={!ed.canUndo} title="Deshacer (Ctrl+Z)">
            <Icon name="undo" size={18} />
            <span className="tool__label">Deshacer</span>
          </button>
        </nav>

        <div className="ed__top-right">
          <span className={`save-status is-${ed.status}`} role="status" aria-live="polite">
            {ed.status === 'saving' ? <span className="spinner" /> : <Icon name={ed.status === 'error' ? 'info' : 'check'} size={14} />}
            {statusText}
          </span>
          <a className="btn btn--sm" href="/" target="_blank" rel="noopener">
            <Icon name="external" size={15} /> Ver sitio
          </a>
          <button className="btn btn--sm btn--ghost btn--icon" onClick={logout} title={`Salir (${username})`}>
            <Icon name="logout" size={16} />
          </button>
        </div>
      </header>

      <aside className="ed__side">
        <nav className="tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab${tab === t.id ? ' is-active' : ''}`} onClick={() => setTab(t.id)}>
              <Icon name={t.icon} size={17} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
        <div className="ed__side-body">
          {tab === 'elements' && <ElementsPanel ed={ed} selectedId={selectedId} onSelect={selectFromList} />}
          {tab === 'categories' && <CategoriesPanel ed={ed} onToast={showToast} />}
          {tab === 'legend' && <LegendPanel ed={ed} />}
          {tab === 'base' && (
            <BasePanel
              ed={ed}
              onUseCurrentView={useCurrentView}
              onSetBoundsToView={setBoundsToView}
              onEditFocus={() => {
                setSelectedId(null);
                setFocusMode(false);
                setTool('select');
                setFocusEdit(true);
                fitFocus();
              }}
              onDrawFocus={() => {
                setFocusEdit(false);
                setSelectedId(null);
                setTool('select');
                setFocusMode(true);
              }}
              onFitFocus={fitFocus}
            />
          )}
          {tab === 'info' && <InfoPanel ed={ed} />}
        </div>
        {ephemeral && (
          <div className="demo-banner" role="note">
            <strong>Modo demostración.</strong> Los cambios se ven pero se pierden al reiniciar el servidor. Conectá Supabase para guardarlos (ver docs/GUIA.md, sección 6).
          </div>
        )}
        <footer className="ed__side-foot">
          Datos: <strong>{driver === 'supabase' ? 'Supabase' : ephemeral ? 'en memoria (demostración)' : 'local (data/db.json)'}</strong>
          <br />
          Fotos: {photoUsage.count} · {formatBytes(photoUsage.bytes)} de 1 GB gratis
        </footer>
      </aside>

      <main className="ed__stage">
        <div ref={containerRef} className="ed__map" />

        {/* Pincel: con qué se crea lo próximo */}
        {(tool === 'point' || tool === 'line' || tool === 'cuadra' || tool === 'area') && !focusMode && (
          <div className="brush" role="toolbar" aria-label="Pincel">
            <span className="brush__label">{tool === 'point' ? 'Ícono' : 'Color'}</span>
            {tool === 'point'
              ? sortedCats.map((c) => (
                  <button key={c.id} className={`brush__item${brushCategory === c.id ? ' is-active' : ''}`} onClick={() => setBrushCategory(c.id)} title={c.name}>
                    <span className="chip-icon" style={{ ['--chip-color' as string]: c.color }}>
                      <img src={c.icon || '/icons/punto.svg'} alt="" />
                    </span>
                    {c.name}
                  </button>
                ))
              : (tool === 'area' ? areaLegend : lineLegend).map((l) => {
                  const active = (tool === 'area' ? brushArea : brushLine) === l.id;
                  return (
                    <button key={l.id} className={`brush__item${active ? ' is-active' : ''}`} onClick={() => (tool === 'area' ? setBrushArea(l.id) : setBrushLine(l.id))}>
                      <span className={swatchClass(l)} style={{ ['--swatch' as string]: l.color }} />
                      {l.name}
                    </button>
                  );
                })}
            {tool !== 'point' && (tool === 'area' ? areaLegend : lineLegend).length === 0 && (
              <button className="brush__item" onClick={() => setTab('legend')}>
                <Icon name="plus" size={14} /> Crear un color en Leyenda
              </button>
            )}
          </div>
        )}

        {bordersActive && (
          <div className="borders-bar" role="toolbar" aria-label="Bordes de la feria">
            <span className="brush__label">Bordes de la feria</span>
            {focusEdit && (
              <button
                className="brush__item"
                onClick={() => {
                  setFocusEdit(false);
                  setFocusMode(true);
                }}
              >
                <Icon name="area" size={15} /> Redibujar de cero
              </button>
            )}
            {focusEdit && (
              <button className="brush__item" onClick={fitFocus}>
                <Icon name="frame" size={15} /> Ver toda la zona
              </button>
            )}
            <button
              className="brush__item"
              onClick={() => {
                ed.updateSettings((s) => ({ ...s, focus: { ...s.focus, enabled: false } }), 0);
                changeTool('select');
                showToast('Sin límite: la feria queda marcada solo por las calles pintadas');
              }}
            >
              Sin límite
            </button>
            <button className="brush__item is-active" onClick={() => changeTool('select')}>
              <Icon name="check" size={15} /> Listo
            </button>
          </div>
        )}

        <div className="hint" data-show={tool !== 'select' || focusMode || focusEdit}>
          {focusEdit
            ? 'Arrastrá los puntos naranjas para mover los bordes de la feria · los puntitos del medio agregan vértices · clic derecho borra uno · Esc termina'
            : focusMode
              ? 'Dibujá el contorno de la zona de la feria · clic en el primer punto o Enter para cerrar · Esc cancela'
              : activeTool?.help}
          {drawing > 0 && <strong> · {drawing} vértices</strong>}
        </div>

        {toast && (
          <div className={`ed-toast is-${toast.kind}`} role="status">
            {toast.msg}
            {toast.action && (
              <button className="ed-toast__action" onClick={toast.action.run}>
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </main>

      {selected && (
        <aside className="ed__inspector">
          <Inspector
            key={selected.id}
            feature={selected}
            ed={ed}
            onClose={() => setSelectedId(null)}
            onFocus={() => flyTo(selected)}
            onDelete={deleteSelected}
            onToast={showToast}
            onGoTo={(t) => setTab(t)}
          />
        </aside>
      )}
    </div>
  );
}
