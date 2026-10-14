/**
 * Marcadores de puntos dibujados por el motor del mapa (WebGL), no como HTML:
 * se mueven pegados al mapa al hacer zoom o arrastrar, y escalan con el zoom.
 *
 * Por cada categoría se genera una imagen de "pin" (gota con aro del color
 * de la categoría y el ícono adentro) y su variante seleccionada (rellena).
 */
import type { Map as MLMap } from 'maplibre-gl';
import type { Category } from '@/lib/schemas';

export const FALLBACK_ICON = '/icons/punto.svg';
const FALLBACK_COLOR = '#1f2a2e';
/** Resolución de las imágenes (2× para pantallas retina). */
const PR = 2;
/** Tamaño lógico del pin a icon-size 1. */
export const PIN_W = 44;
const PIN_H = 54;

const imageCache = new Map<string, Promise<HTMLImageElement | null>>();

function loadIcon(url: string) {
  let p = imageCache.get(url);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
    imageCache.set(url, p);
  }
  return p;
}

function drawPin(icon: HTMLImageElement | null, color: string, selected: boolean) {
  const w = PIN_W * PR;
  const h = PIN_H * PR;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const cx = w / 2;
  const r = w / 2 - 4 * PR;
  const cy = r + 3 * PR;

  // Gota: círculo + punta hacia abajo
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI * 0.78, Math.PI * 2.22);
  ctx.lineTo(cx, h - 2 * PR);
  ctx.closePath();
  ctx.shadowColor = 'rgba(0,0,0,0.28)';
  ctx.shadowBlur = 3 * PR;
  ctx.shadowOffsetY = 1.5 * PR;
  ctx.fillStyle = selected ? color : '#fffdf8';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 3 * PR;
  ctx.strokeStyle = color;
  ctx.stroke();

  if (icon) {
    const s = r * 1.15;
    if (selected) {
      // Ícono en blanco sobre el relleno de color
      const tmp = document.createElement('canvas');
      tmp.width = tmp.height = Math.ceil(s);
      const t = tmp.getContext('2d')!;
      t.drawImage(icon, 0, 0, s, s);
      t.globalCompositeOperation = 'source-in';
      t.fillStyle = '#ffffff';
      t.fillRect(0, 0, s, s);
      ctx.drawImage(tmp, cx - s / 2, cy - s / 2);
    } else {
      ctx.drawImage(icon, cx - s / 2, cy - s / 2, s, s);
    }
  }
  return ctx.getImageData(0, 0, w, h);
}

/** Id de imagen: cambia si cambia el color o el ícono (así nunca queda vieja). */
export const pinImageId = (c: Category | undefined, selected = false) =>
  `pin:${selected ? 'sel:' : ''}${c ? `${c.id}:${c.color}:${c.icon}` : 'none'}`;

/** Registra en el mapa las imágenes de pin de todas las categorías. */
export async function ensurePinImages(map: MLMap, categories: Category[]) {
  const jobs: Promise<void>[] = [];
  for (const c of [undefined, ...categories]) {
    for (const selected of [false, true]) {
      const id = pinImageId(c, selected);
      if (map.hasImage(id)) continue;
      jobs.push(
        loadIcon(c?.icon || FALLBACK_ICON).then((icon) => {
          if (map.hasImage(id)) return;
          try {
            map.addImage(id, drawPin(icon, c?.color ?? FALLBACK_COLOR, selected), { pixelRatio: PR });
          } catch {
            // Ícono de otro dominio sin CORS: pin sin ícono
            map.addImage(id, drawPin(null, c?.color ?? FALLBACK_COLOR, selected), { pixelRatio: PR });
          }
        }),
      );
    }
  }
  await Promise.all(jobs);
}
