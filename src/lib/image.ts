/**
 * Procesamiento de imágenes en el navegador, antes de subirlas:
 *  - Fotos: se redimensionan y comprimen a WebP (≈ 80–200 KB) + miniatura (≈ 15 KB).
 *  - Íconos: se rasterizan a PNG cuadrado de 128 px (también los SVG,
 *    así nunca servimos SVG subidos por usuarios, que pueden traer scripts).
 */

export interface CompressedImage {
  blob: Blob;
  width: number;
  height: number;
}

const PHOTO_MAX_SIDE = 1600;
const PHOTO_TARGET_BYTES = 220_000;
const THUMB_MAX_SIDE = 480;
const THUMB_TARGET_BYTES = 40_000;
const ICON_SIZE = 128;

async function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // Se revoca después de decodificar: la imagen ya está en memoria.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo procesar la imagen'))), type, quality),
  );
}

function draw(img: HTMLImageElement, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);
  return { canvas, width, height };
}

/** Baja la calidad progresivamente hasta entrar en el peso objetivo. */
async function encode(canvas: HTMLCanvasElement, targetBytes: number) {
  // Safari viejo no codifica WebP: en ese caso caemos a JPEG.
  const probe = await canvasToBlob(canvas, 'image/webp', 0.8);
  const type = probe.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
  let best = type === 'image/webp' ? probe : await canvasToBlob(canvas, type, 0.8);
  for (const q of [0.72, 0.62, 0.52, 0.42]) {
    if (best.size <= targetBytes) break;
    best = await canvasToBlob(canvas, type, q);
  }
  return best;
}

export async function compressPhoto(file: File): Promise<{ full: CompressedImage; thumb: CompressedImage }> {
  if (!file.type.startsWith('image/')) throw new Error('El archivo no es una imagen');
  const img = await loadImage(file);
  const big = draw(img, PHOTO_MAX_SIDE);
  let full = { blob: await encode(big.canvas, PHOTO_TARGET_BYTES), width: big.width, height: big.height };
  // Si aún pesa mucho (fotos con mucho detalle), reducimos el tamaño.
  if (full.blob.size > PHOTO_TARGET_BYTES * 1.6) {
    const smaller = draw(img, 1200);
    full = { blob: await encode(smaller.canvas, PHOTO_TARGET_BYTES), width: smaller.width, height: smaller.height };
  }
  const small = draw(img, THUMB_MAX_SIDE);
  const thumb = { blob: await encode(small.canvas, THUMB_TARGET_BYTES), width: small.width, height: small.height };
  return { full, thumb };
}

export async function rasterizeIcon(file: File): Promise<Blob> {
  const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
  if (!isSvg && !file.type.startsWith('image/')) throw new Error('El archivo no es una imagen');
  const source = isSvg ? new Blob([await file.text()], { type: 'image/svg+xml' }) : file;
  const img = await loadImage(source);
  const w = img.naturalWidth || ICON_SIZE;
  const h = img.naturalHeight || ICON_SIZE;
  const scale = ICON_SIZE / Math.max(w, h);
  const canvas = document.createElement('canvas');
  canvas.width = ICON_SIZE;
  canvas.height = ICON_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  const dw = w * scale;
  const dh = h * scale;
  ctx.drawImage(img, (ICON_SIZE - dw) / 2, (ICON_SIZE - dh) / 2, dw, dh);
  return canvasToBlob(canvas, 'image/png');
}
