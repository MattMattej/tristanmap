'use client';

import { LngLatBounds, type Map as MLMap, type MapMouseEvent } from 'maplibre-gl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { createMap } from '@/components/map/createMap';
import { CLICKABLE_LAYERS, highlightSelection, renderOverlays } from '@/components/map/overlays';
import { addUserLocationLayers, distanceMeters, formatDistance, insideBounds, setUserLocation } from '@/components/map/userLocation';
import { directionsUrl, featureBounds, featureCenter } from '@/lib/format';
import type { MapData } from '@/lib/schemas';
import { AboutPanel, DetailPanel, ExplorePanel, Sheet } from './Panels';
import { LegendCard } from './LegendCard';
import './public.css';

type PanelName = 'explore' | 'about' | null;
type Locate = { state: 'off' } | { state: 'searching' } | { state: 'on'; pos: [number, number]; far: boolean };

const isMobile = () => window.matchMedia('(max-width: 899px)').matches;

export default function PublicApp({ data, initialSelectedId }: { data: MapData; initialSelectedId: string | null }) {
  const { settings, categories, legend, features } = data;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId && features.some((f) => f.id === initialSelectedId) ? initialSelectedId : null,
  );
  const [panel, setPanel] = useState<PanelName>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [hiddenCats, setHiddenCats] = useState<Set<string>>(new Set());
  const [hiddenLegend, setHiddenLegend] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [locate, setLocate] = useState<Locate>({ state: 'off' });
  const watchId = useRef<number | null>(null);

  const selected = useMemo(() => features.find((f) => f.id === selectedId) ?? null, [features, selectedId]);

  const showToast = useCallback((msg: string, ms = 2600) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), ms);
  }, []);

  // ─── Inicialización del mapa ────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const map = createMap({
      container: containerRef.current,
      settings,
      onLoad: (m) => {
        addUserLocationLayers(m);
        setReady(true);
      },
    });
    // Un poco de tolerancia al tocar con el dedo
    const hitTest = (p: MapMouseEvent['point'], pad: number) =>
      map.queryRenderedFeatures(
        [
          [p.x - pad, p.y - pad],
          [p.x + pad, p.y + pad],
        ],
        { layers: CLICKABLE_LAYERS.filter((l) => map.getLayer(l)) },
      )[0];
    map.on('click', (e) => {
      const id = hitTest(e.point, isMobile() ? 8 : 3)?.properties?.id as string | undefined;
      setSelectedId(id ?? null);
      if (id) setPanel(null);
    });
    map.on('mousemove', (e) => {
      map.getCanvas().style.cursor = hitTest(e.point, 2) ? 'pointer' : '';
    });
    mapRef.current = map;
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      map.remove();
      mapRef.current = null;
    };
    // El mapa se crea una sola vez; los datos se sincronizan en otros efectos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Puntos, franjas, zonas y textos
  useEffect(() => {
    if (ready && mapRef.current) void renderOverlays(mapRef.current, data, { hiddenLegend, hiddenCategories: hiddenCats });
  }, [ready, data, hiddenLegend, hiddenCats]);

  // Selección: resaltado + URL compartible
  useEffect(() => {
    if (ready && mapRef.current) highlightSelection(mapRef.current, selectedId);
    const url = new URL(window.location.href);
    if (selectedId) url.searchParams.set('p', selectedId);
    else url.searchParams.delete('p');
    window.history.replaceState(null, '', url);
  }, [ready, selectedId]);

  /** Centra el mapa en un elemento dejando lugar para el panel. */
  const focusFeature = useCallback(
    (id: string) => {
      const map = mapRef.current;
      const f = features.find((x) => x.id === id);
      if (!map || !f) return;
      const padding = isMobile()
        ? { top: 150, bottom: Math.round(window.innerHeight * 0.5), left: 40, right: 40 }
        : { top: 80, bottom: 80, left: 80, right: 460 };
      if (f.kind === 'point' || f.kind === 'label') {
        map.easeTo({ center: featureCenter(f), zoom: Math.max(map.getZoom(), 17.5), padding, duration: 700 });
      } else {
        map.fitBounds(featureBounds(f), { padding, maxZoom: 18.5, duration: 700 });
      }
    },
    [features],
  );

  // Link compartido (?p=...): centrar al cargar
  useEffect(() => {
    if (ready && initialSelectedId && selectedId === initialSelectedId) focusFeature(initialSelectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // ─── Mi ubicación ───────────────────────────────────────────────────────
  // El punto azul sigue al estado (así funciona aunque se toque antes de que cargue el mapa).
  useEffect(() => {
    if (ready && mapRef.current) setUserLocation(mapRef.current, locate.state === 'on' ? locate.pos : null);
  }, [ready, locate]);

  const restoreFeriaView = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setMinZoom(settings.view.minZoom);
    if (settings.view.bounds) map.setMaxBounds(settings.view.bounds);
    map.flyTo({ center: settings.view.center, zoom: settings.view.zoom, padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 900 });
  }, [settings.view]);

  const stopLocate = () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    if (locate.state === 'on' && locate.far) restoreFeriaView();
    setLocate({ state: 'off' });
  };

  const startLocate = () => {
    if (!('geolocation' in navigator)) {
      showToast('Tu navegador no permite ubicarte');
      return;
    }
    setLocate({ state: 'searching' });
    let first = true;
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        const map = mapRef.current;
        if (!map) return;
        const pos: [number, number] = [p.coords.longitude, p.coords.latitude];
        const far = !insideBounds(pos, settings.view.bounds);
        setLocate({ state: 'on', pos, far });
        if (!first) return;
        first = false;
        if (far) {
          // Estás fuera de la feria: abrimos el mapa para mostrarte a vos y a la feria.
          map.setMaxBounds(null);
          map.setMinZoom(3);
          const b = new LngLatBounds(pos, pos).extend(settings.view.center);
          map.fitBounds(b, { padding: isMobile() ? { top: 190, bottom: 260, left: 50, right: 50 } : 140, maxZoom: 16, duration: 1200 });
        } else {
          map.easeTo({ center: pos, zoom: Math.max(map.getZoom(), 17.5), duration: 900 });
          showToast('Estás en la zona de la feria');
        }
      },
      (err) => {
        setLocate({ state: 'off' });
        showToast(err.code === err.PERMISSION_DENIED ? 'Permiso de ubicación denegado' : 'No pudimos encontrar tu ubicación', 3200);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    );
  };

  const selectFromList = (id: string) => {
    setSelectedId(id);
    setPanel(null);
    focusFeature(id);
  };

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  const sheetOpen = !!selected || !!panel;
  const distance = locate.state === 'on' ? distanceMeters(locate.pos, settings.view.center) : 0;

  return (
    <div className={`pub${sheetOpen ? ' has-sheet' : ''}${locate.state === 'on' && locate.far ? ' has-locate-card' : ''}`} style={{ ['--accent' as string]: settings.accent }}>
      <div ref={containerRef} className="pub__map" aria-label={`Mapa: ${settings.title}`} role="region" />

      <div className="pub__ui-top">
        <header className="pub__top">
          <div className="pub__brand">
            <h1 className="pub__title">{settings.title}</h1>
            {settings.schedule && (
              <p className="pub__schedule">
                <Icon name="clock" size={14} /> {settings.schedule}
              </p>
            )}
          </div>
          <div className="pub__actions">
            <button className="btn btn--sm" onClick={() => setPanel(panel === 'explore' ? null : 'explore')} aria-pressed={panel === 'explore'}>
              <Icon name="search" size={16} /> Explorar
            </button>
            <button className="btn btn--sm" onClick={() => setPanel(panel === 'about' ? null : 'about')} aria-pressed={panel === 'about'}>
              <Icon name="info" size={16} /> La feria
            </button>
          </div>
        </header>

        {categories.length > 0 && (
          <nav className="pub__chips" aria-label="Filtrar por categoría">
            {categories.map((c) => {
              const off = hiddenCats.has(c.id);
              return (
                <button
                  key={c.id}
                  className={`chip${off ? ' is-off' : ''}`}
                  style={{ ['--chip-color' as string]: c.color }}
                  aria-pressed={!off}
                  onClick={() => setHiddenCats(toggle(hiddenCats, c.id))}
                >
                  <span className="chip-icon">
                    <img src={c.icon || '/icons/punto.svg'} alt="" />
                  </span>
                  {c.name}
                </button>
              );
            })}
          </nav>
        )}
      </div>

      {/* Mi ubicación */}
      <div className="locate">
        {locate.state === 'on' && locate.far && (
          <div className="locate__card">
            <span>
              Estás a <strong>{formatDistance(distance)}</strong> de la feria
            </span>
            <div className="locate__actions">
              <a className="btn btn--primary btn--sm" href={directionsUrl(settings.view.center)} target="_blank" rel="noopener noreferrer">
                <Icon name="directions" size={15} /> Cómo llegar
              </a>
              <button className="btn btn--sm" onClick={stopLocate}>
                Ver la feria
              </button>
            </div>
          </div>
        )}
        <button
          className={`locate__btn is-${locate.state}`}
          onClick={() => (locate.state === 'off' ? startLocate() : stopLocate())}
          aria-pressed={locate.state !== 'off'}
          aria-label={locate.state === 'off' ? 'Mostrar mi ubicación' : 'Dejar de mostrar mi ubicación'}
          title="Mi ubicación"
        >
          {locate.state === 'searching' ? <span className="spinner" /> : <Icon name="target" size={20} />}
        </button>
      </div>

      <LegendCard
        open={legendOpen}
        onToggle={() => setLegendOpen(!legendOpen)}
        legend={legend}
        categories={categories}
        hiddenLegend={hiddenLegend}
        hiddenCats={hiddenCats}
        onToggleLegend={(id) => setHiddenLegend(toggle(hiddenLegend, id))}
        onToggleCat={(id) => setHiddenCats(toggle(hiddenCats, id))}
      />

      <Sheet open={sheetOpen} onClose={() => (panel ? setPanel(null) : setSelectedId(null))} wide={panel === 'about'}>
        {panel === 'explore' ? (
          <ExplorePanel data={data} onSelect={selectFromList} onClose={() => setPanel(null)} />
        ) : panel === 'about' ? (
          <AboutPanel settings={settings} onClose={() => setPanel(null)} />
        ) : selected ? (
          <DetailPanel
            feature={selected}
            category={categories.find((c) => c.id === selected.categoryId)}
            legendItem={legend.find((l) => l.id === selected.legendId)}
            onClose={() => setSelectedId(null)}
            onToast={showToast}
          />
        ) : null}
      </Sheet>

      <div className="pub__toast" role="status" aria-live="polite" data-show={!!toast}>
        {toast}
      </div>
    </div>
  );
}
