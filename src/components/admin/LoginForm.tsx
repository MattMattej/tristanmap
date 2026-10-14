'use client';

import { useState } from 'react';
import './admin.css';

export default function LoginForm({ expired }: { expired: boolean }) {
  const [error, setError] = useState<string | null>(expired ? 'Tu sesión venció. Volvé a ingresar.' : null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: form.get('username'), password: form.get('password') }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'No se pudo ingresar');
      }
      window.location.href = '/admin';
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <main className="login">
      <form className="login__card" onSubmit={onSubmit}>
        <div className="login__mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="40" height="40">
            <path d="M16 2C10.2 2 5.5 6.6 5.5 12.4 5.5 20.2 16 30 16 30s10.5-9.8 10.5-17.6C26.5 6.6 21.8 2 16 2Z" fill="#d9572b" />
            <circle cx="16" cy="12.5" r="4.5" fill="#f3eee3" />
          </svg>
        </div>
        <h1 className="login__title">Estudio del mapa</h1>
        <p className="login__sub">Feria de Tristán Narvaja</p>
        <label className="field">
          <span className="field__label">Usuario</span>
          <input className="input" name="username" autoComplete="username" required autoFocus />
        </label>
        <label className="field">
          <span className="field__label">Contraseña</span>
          <input className="input" name="password" type="password" autoComplete="current-password" required />
        </label>
        {error && (
          <p className="login__error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn--primary login__submit" disabled={loading}>
          {loading ? <span className="spinner" /> : 'Ingresar'}
        </button>
        <a className="login__back" href="/">
          ← Volver al mapa
        </a>
      </form>
    </main>
  );
}
