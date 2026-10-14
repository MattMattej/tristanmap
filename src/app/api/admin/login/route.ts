import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handle, HttpError, readJson } from '@/lib/api';
import {
  checkCredentials,
  clearRateLimit,
  createSessionToken,
  loginRateLimit,
  SESSION_COOKIE,
  sessionCookieOptions,
} from '@/lib/auth';

const body = z.object({ username: z.string().max(100), password: z.string().max(200) });

export const POST = handle(async (req: Request) => {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (!loginRateLimit(ip)) throw new HttpError(429, 'Demasiados intentos. Esperá unos minutos.');

  const { username, password } = body.parse(await readJson(req));
  if (!checkCredentials(username, password)) {
    await new Promise((r) => setTimeout(r, 400)); // frena la fuerza bruta
    throw new HttpError(401, 'Usuario o contraseña incorrectos');
  }
  clearRateLimit(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(username), sessionCookieOptions);
  return res;
});
