-- =====================================================================
-- Modificaciones del 8/10: datos completos de clientes, banco/billetera
-- y facturado en la caja, y base de artículos para presupuestos.
-- Correr UNA vez en Supabase > SQL Editor > New query > Run.
-- Se puede volver a correr sin romper nada.
-- =====================================================================

-- ---------- 1. clientes: más datos (se editan sin perder historial ni vehículos) ----------
alter table public.clientes
  add column if not exists email text,
  add column if not exists direccion text,
  add column if not exists localidad text,
  add column if not exists dni_cuit text,
  add column if not exists observaciones text;

-- ---------- 3. caja: de qué banco o billetera viene y si está facturado ----------
alter table public.movimientos_caja
  add column if not exists banco text,
  add column if not exists facturado boolean not null default false;

-- ---------- 4. base de artículos para presupuestos (no toca el stock) ----------
create table if not exists public.articulos (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres(id) on delete cascade,
  codigo text,
  descripcion text not null,
  precio numeric not null default 0,
  creado timestamptz not null default now()
);
create index if not exists articulos_taller_idx on public.articulos (taller_id, descripcion);
alter table public.articulos enable row level security;
drop policy if exists "solo mi taller" on public.articulos;
create policy "solo mi taller" on public.articulos
  for all using (taller_id in (select mis_talleres())) with check (taller_id in (select mis_talleres()));
