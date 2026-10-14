import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { safeJoin, UPLOADS_DIR } from '@/lib/store/local';

/** Sirve los archivos subidos en modo local (data/uploads). */
const TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const parts = (await ctx.params).path;
  const type = TYPES[path.extname(parts.at(-1) ?? '').toLowerCase()];
  if (!type) return new Response('No encontrado', { status: 404 });
  try {
    const file = await readFile(safeJoin(UPLOADS_DIR, parts.join('/')));
    return new Response(new Uint8Array(file), {
      headers: {
        'Content-Type': type,
        // Los nombres son únicos (UUID): se pueden cachear para siempre.
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('No encontrado', { status: 404 });
  }
}
