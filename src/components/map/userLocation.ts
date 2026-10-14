/**
 * "Mi ubicación": punto azul con halo, dibujado en el mapa (WebGL).
 * Funciona estés o no en la feria: si estás lejos, el mapa se abre para
 * mostrar dónde estás vos y dónde está la feria.
 */
import type { GeoJSONSource, Map as MLMap } from 'maplibre-gl';

const SRC = 'tm-me';

export function addUserLocationLayers(map: MLMap) {
  if (map.getSource(SRC)) return;
  map.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({
    id: 'tm-me-halo',
    type: 'circle',
    source: SRC,
    paint: { 'circle-radius': 18, 'circle-color': '#2f6fb2', 'circle-opacity': 0.18, 'circle-pitch-alignment': 'map' },
  });
  map.addLayer({
    id: 'tm-me-dot',
    type: 'circle',
    source: SRC,
    paint: { 'circle-radius': 7, 'circle-color': '#2f6fb2', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 },
  });
}

export function setUserLocation(map: MLMap, pos: [number, number] | null) {
  (map.getSource(SRC) as GeoJSONSource | undefined)?.setData({
    type: 'FeatureCollection',
    features: pos ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: pos } }] : [],
  });
}

/** Distancia en metros entre dos [lng, lat]. */
export function distanceMeters(a: [number, number], b: [number, number]) {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(m: number) {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

export function insideBounds(pos: [number, number], b: [[number, number], [number, number]] | null) {
  if (!b) return true;
  return pos[0] >= b[0][0] && pos[0] <= b[1][0] && pos[1] >= b[0][1] && pos[1] <= b[1][1];
}
