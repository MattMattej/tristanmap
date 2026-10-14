import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getSession } from './auth';
import { StoreError } from './store/types';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Exige sesión de administrador y que la petición venga del mismo origen
 * (defensa CSRF adicional a la cookie SameSite=Lax).
 */
export async function requireAdmin(req: Request) {
  const method = req.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    const origin = req.headers.get('origin');
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
    if (origin && host && new URL(origin).host !== host) throw new HttpError(403, 'Origen no permitido');
  }
  const session = await getSession();
  if (!session) throw new HttpError(401, 'Sesión vencida: volvé a ingresar');
  return session;
}

/** Envuelve un handler con manejo de errores uniforme ({ error } + status). */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
      if (err instanceof StoreError) return NextResponse.json({ error: err.message }, { status: 503 });
      if (err instanceof ZodError) {
        const issue = err.issues[0];
        const where = issue?.path.join('.') || 'datos';
        return NextResponse.json({ error: `${where}: ${issue?.message ?? 'inválido'}`, issues: err.issues }, { status: 400 });
      }
      console.error('[api]', err);
      return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
  };
}

export async function readJson(req: Request, maxBytes = 2_000_000): Promise<unknown> {
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, 'Contenido demasiado grande');
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'JSON inválido');
  }
}
