-- ════════════════════════════════════════════════════════════════════════════
--  Tristán Map · esquema de base de datos (Supabase / Postgres)
--
--  Cómo usarlo: Supabase → SQL Editor → New query → pegar todo → Run.
--  Es idempotente: se puede volver a correr sin romper nada.
--
--  Seguridad: RLS activado en todas las tablas. El público solo puede LEER.
--  Las escrituras las hace el servidor de Next.js con la service role key
--  (que nunca llega al navegador).
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Categorías de puntos (íconos) ──────────────────────────────────────────
create table if not exists public.categories (
  id          text primary key,
  name        text not null,
  description text not null default '',
  color       text not null,
  icon        text not null default '',
  sort_order  int  not null default 0,
  visible     boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ─── Leyenda: significado de colores de franjas y zonas ────────────────────
create table if not exists public.legend_items (
  id          text primary key,
  name        text not null,
  description text not null default '',
  kind        text not null check (kind in ('line', 'area')),
  color       text not null,
  width       real not null default 8,
  opacity     real not null default 0.85,
  dash        text not null default 'solid' check (dash in ('solid', 'dashed', 'dotted')),
  sort_order  int  not null default 0,
  visible     boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ─── Elementos del mapa: puntos, franjas, zonas y textos ───────────────────
create table if not exists public.features (
  id          text primary key,
  kind        text not null check (kind in ('point', 'line', 'area', 'label')),
  title       text not null default '',
  description text not null default '',
  photo       jsonb,                 -- { url, thumbUrl, width, height, bytes }
  category_id text references public.categories (id) on delete set null,
  legend_id   text references public.legend_items (id) on delete set null,
  geometry    jsonb not null,        -- GeoJSON (Point | LineString | Polygon)
  style       jsonb not null default '{}'::jsonb,
  published   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists features_category_idx on public.features (category_id);
create index if not exists features_legend_idx   on public.features (legend_id);

-- ─── Ajustes generales (una sola fila) ──────────────────────────────────────
create table if not exists public.settings (
  id         int primary key default 1 check (id = 1),
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- ─── Seguridad (Row Level Security) ─────────────────────────────────────────
alter table public.categories   enable row level security;
alter table public.legend_items enable row level security;
alter table public.features     enable row level security;
alter table public.settings     enable row level security;

drop policy if exists "lectura publica" on public.categories;
create policy "lectura publica" on public.categories   for select using (visible);
drop policy if exists "lectura publica" on public.legend_items;
create policy "lectura publica" on public.legend_items for select using (visible);
drop policy if exists "lectura publica" on public.features;
create policy "lectura publica" on public.features     for select using (published);
drop policy if exists "lectura publica" on public.settings;
create policy "lectura publica" on public.settings     for select using (true);

-- ─── Storage: bucket público para fotos e íconos ───────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 2097152, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- ════════════════════════════════════════════════════════════════════════════
--  FASE 2 (opcional): comentarios con login de Google
--  Se puede correr ya; no afecta nada hasta que se active en la web.
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.comments (
  id            uuid primary key default gen_random_uuid(),
  feature_id    text not null references public.features (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  author_name   text not null default '',
  author_avatar text not null default '',
  body          text not null check (char_length(body) between 1 and 1000),
  status        text not null default 'published' check (status in ('published', 'hidden')),
  created_at    timestamptz not null default now()
);
create index if not exists comments_feature_idx on public.comments (feature_id, created_at desc);

alter table public.comments enable row level security;
drop policy if exists "ver comentarios publicados" on public.comments;
create policy "ver comentarios publicados" on public.comments
  for select using (status = 'published');
drop policy if exists "comentar con sesion" on public.comments;
create policy "comentar con sesion" on public.comments
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "borrar lo propio" on public.comments;
create policy "borrar lo propio" on public.comments
  for delete to authenticated using (auth.uid() = user_id);
