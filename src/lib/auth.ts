import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'tm_session';
const SESSION_DAYS = 7;
const DEV_SECRET = 'solo-para-desarrollo-no-usar-en-produccion-tristanmap';

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Falta SESSION_SECRET (mínimo 32 caracteres) en producción');
    }
    return new TextEncoder().encode(DEV_SECRET);
  }
  return new TextEncoder().encode(secret);
}

const digest = (s: string) => createHash('sha256').update(s).digest();
/** Comparación en tiempo constante (evita ataques de timing). */
const safeEqual = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));

export function checkCredentials(username: string, password: string) {
  const u = process.env.ADMIN_USERNAME;
  const p = process.env.ADMIN_PASSWORD;
  if (!u || !p) throw new Error('Configurá ADMIN_USERNAME y ADMIN_PASSWORD');
  // Evaluamos ambas siempre para no filtrar cuál falló.
  const okUser = safeEqual(username, u);
  const okPass = safeEqual(password, p);
  return okUser && okPass;
}

export async function createSessionToken(username: string) {
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(username)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_DAYS * 24 * 3600,
};

export async function verifySessionToken(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    return payload.role === 'admin' ? { username: payload.sub ?? 'admin' } : null;
  } catch {
    return null;
  }
}

/** Sesión actual (Server Components / Route Handlers). */
export async function getSession() {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}

// ─── Límite de intentos de login (en memoria, por IP) ───────────────────────
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;

export function loginRateLimit(ip: string) {
  const now = Date.now();
  if (attempts.size > 5000) {
    for (const [key, value] of attempts) if (value.until < now) attempts.delete(key);
  }
  const entry = attempts.get(ip);
  if (!entry || entry.until < now) {
    attempts.set(ip, { count: 1, until: now + WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= MAX_ATTEMPTS;
}

export function clearRateLimit(ip: string) {
  attempts.delete(ip);
}
