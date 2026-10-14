// Copia el web worker de MapLibre a public/vendor para servirlo desde una URL
// estable (MapLibre 6 lo busca relativo a su propio módulo, y el bundler lo mueve).
import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve('maplibre-gl/package.json'));
await mkdir(resolve(root, 'public/vendor'), { recursive: true });
await copyFile(resolve(pkgDir, 'dist/maplibre-gl-worker.mjs'), resolve(root, 'public/vendor/maplibre-gl-worker.mjs'));
console.log('✓ worker de MapLibre copiado a public/vendor');
