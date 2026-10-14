import { AttributionControl, Map as MLMap, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import { MONTEVIDEO_BOUNDS } from '@/lib/defaults';
import type { Settings } from '@/lib/schemas';
import { buildBaseStyle } from './baseStyle';
import { addOverlayLayers } from './overlays';

let workerConfigured = false;

export interface CreateMapOptions {
  container: HTMLElement;
  settings: Settings;
  /** En el editor se puede recorrer todo Montevideo aunque el público tenga límites más chicos. */
  restrictBounds?: boolean;
  onLoad?: (map: MLMap) => void;
}

export function createMap({ container, settings, restrictBounds = true, onLoad }: CreateMapOptions) {
  if (!workerConfigured) {
    setWorkerUrl('/vendor/maplibre-gl-worker.mjs');
    workerConfigured = true;
  }
  const { view } = settings;
  const map = new MLMap({
    container,
    style: buildBaseStyle(settings.base),
    center: view.center,
    zoom: view.zoom,
    bearing: view.bearing,
    minZoom: view.minZoom,
    maxZoom: view.maxZoom,
    // Nunca se sale de Montevideo; el público puede tener un límite más chico.
    maxBounds: restrictBounds && view.bounds ? view.bounds : MONTEVIDEO_BOUNDS,
    attributionControl: false,
    dragRotate: false,
    pitchWithRotate: false,
    // Rotar con dos dedos confunde más de lo que ayuda en un mapa de feria.
    touchPitch: false,
    fadeDuration: 150,
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new AttributionControl({ compact: true }), 'bottom-right');
  map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');
  map.on('load', () => {
    // Facilita depurar desde la consola del navegador en desarrollo.
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __tmMap: MLMap }).__tmMap = map;
    addOverlayLayers(map);
    onLoad?.(map);
  });
  return map;
}
