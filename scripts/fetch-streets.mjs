#!/usr/bin/env node
/**
 * Genera public/data/cuadras.geojson: las calles de la zona de la feria
 * partidas en "cuadras" (tramos entre esquinas), a partir de OpenStreetMap.
 *
 * El panel de administración usa este archivo para:
 *  - pintar una cuadra entera con un clic (herramienta "Cuadra")
 *  - "imantar" (snap) los vértices al dibujar franjas sobre las calles
 *
 * Uso:
 *   npm run streets                      -> descarga de Overpass (con reintentos)
 *   npm run streets -- --input ways.json -> usa una respuesta de Overpass ya guardada
 *
 * Datos © OpenStreetMap contributors (ODbL).
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'public/data/cuadras.geojson');

// Zona de la feria + un margen de contexto (sur, oeste, norte, este)
const BBOX = [-34.9065, -56.1865, -34.8940, -56.1705];
const HIGHWAYS = 'primary|secondary|tertiary|residential|unclassified|living_street|pedestrian';
const QUERY = `[out:json][timeout:90];way["highway"~"^(${HIGHWAYS})$"](${BBOX.join(',')});out geom;`;
const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

async function download() {
  for (let attempt = 1; attempt <= 4; attempt++) {
    for (const url of MIRRORS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'tristanmap/1.0' },
          body: new URLSearchParams({ data: QUERY }),
          signal: AbortSignal.timeout(100_000),
        });
        const text = await res.text();
        if (res.ok && text.trimStart().startsWith('{')) {
          console.log(`✓ Datos descargados de ${url}`);
          return JSON.parse(text);
        }
        console.warn(`✗ ${url} respondió ${res.status} (servidor ocupado)`);
      } catch (err) {
        console.warn(`✗ ${url}: ${err.message}`);
      }
    }
    await new Promise((r) => setTimeout(r, attempt * 5000));
  }
  throw new Error('No se pudo descargar de Overpass. Probá más tarde o usá --input.');
}

const inside = (lat, lon) => lat >= BBOX[0] && lat <= BBOX[2] && lon >= BBOX[1] && lon <= BBOX[3];
const round = (n) => Math.round(n * 1e6) / 1e6;

function toCuadras(osm) {
  const ways = osm.elements.filter((e) => e.type === 'way' && e.geometry?.length >= 2);

  // Un nodo compartido por 2+ vías distintas es una esquina.
  const usage = new Map();
  for (const w of ways) {
    for (const id of new Set(w.nodes)) usage.set(id, (usage.get(id) ?? 0) + 1);
  }
  const isCorner = (id) => (usage.get(id) ?? 0) >= 2;

  const features = [];
  for (const w of ways) {
    let current = [];
    const flush = () => {
      const coords = current.filter((p) => p);
      if (coords.length >= 2 && coords.some(([lon, lat]) => inside(lat, lon))) {
        features.push({
          type: 'Feature',
          id: features.length + 1,
          properties: {
            id: `${w.id}-${features.length}`,
            name: w.tags.name ?? '',
            highway: w.tags.highway,
            osmId: w.id,
          },
          geometry: { type: 'LineString', coordinates: coords },
        });
      }
    };
    w.geometry.forEach((g, i) => {
      current.push([round(g.lon), round(g.lat)]);
      const last = i === w.geometry.length - 1;
      if (!last && i > 0 && isCorner(w.nodes[i])) {
        flush();
        current = [[round(g.lon), round(g.lat)]];
      }
    });
    flush();
  }
  return { type: 'FeatureCollection', bbox: [BBOX[1], BBOX[0], BBOX[3], BBOX[2]], features };
}

const inputIdx = process.argv.indexOf('--input');
const osm = inputIdx > -1 ? JSON.parse(await readFile(process.argv[inputIdx + 1], 'utf8')) : await download();
const geojson = toCuadras(osm);
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(geojson));
console.log(`✓ ${geojson.features.length} cuadras escritas en ${OUT}`);
