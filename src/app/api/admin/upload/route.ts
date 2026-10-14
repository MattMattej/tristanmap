import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { handle, HttpError, requireAdmin } from '@/lib/api';
import { getStore } from '@/lib/store';

/**
 * Subida de imágenes. El navegador ya las comprime (WebP) antes de enviarlas;
 * acá validamos tipo real (magic bytes) y tamaño máximo.
 */
const LIMITS = {
  photo: 600_000,
  thumb: 80_000,
  icon: 120_000,
} as const;
type Kind = keyof typeof LIMITS;

function sniff(b: Uint8Array): { ext: string; type: string } | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: 'png', type: 'image/png' };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', type: 'image/jpeg' };
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return { ext: 'webp', type: 'image/webp' };
  return null;
}

export const POST = handle(async (req: Request) => {
  await requireAdmin(req);
  const form = await req.formData().catch(() => {
    throw new HttpError(400, 'Formulario inválido');
  });
  const kind = String(form.get('kind') ?? '') as Kind;
  const file = form.get('file');
  if (!(kind in LIMITS)) throw new HttpError(400, 'Tipo de archivo inválido');
  if (!(file instanceof Blob)) throw new HttpError(400, 'Falta el archivo');
  if (file.size > LIMITS[kind]) throw new HttpError(413, `La imagen pesa demasiado (máx. ${Math.round(LIMITS[kind] / 1000)} KB)`);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = sniff(bytes);
  if (!detected) throw new HttpError(415, 'Formato no soportado (usá PNG, JPG o WebP)');

  const month = new Date().toISOString().slice(0, 7);
  const key = `${kind}s/${month}/${randomUUID()}.${detected.ext}`;
  const url = await getStore().putFile(key, bytes, detected.type);
  return NextResponse.json({ url, bytes: bytes.byteLength });
});
