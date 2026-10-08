-- =====================================================================
-- Modificaciones del 8/10 (segunda tanda): familias de artículos,
-- listas de precio por proveedor y turnos.
-- Correr UNA vez en Supabase > SQL Editor > New query > Run
-- (después de sql/2026-10-08_modificaciones.sql).
-- Se puede volver a correr sin romper nada.
-- =====================================================================

-- ---------- 1. familias de artículos (6 de entrada, se pueden agregar más) ----------
create table if not exists public.familias (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres(id) on delete cascade,
  nombre text not null,
  orden smallint not null default 99,
  creado timestamptz not null default now(),
  unique (taller_id, nombre)
);
alter table public.familias enable row level security;
drop policy if exists "solo mi taller" on public.familias;
create policy "solo mi taller" on public.familias
  for all using (taller_id in (select mis_talleres())) with check (taller_id in (select mis_talleres()));

-- Crea las familias de entrada de un taller (no duplica las que ya tiene)
create or replace function public.crear_familias_taller(p_taller_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  insert into familias (taller_id, nombre, orden) values
    (p_taller_id, 'LUBRICANTES', 1), (p_taller_id, 'NEUMÁTICOS', 2), (p_taller_id, 'BATERÍAS', 3),
    (p_taller_id, 'REPUESTOS DE MOTOR', 4), (p_taller_id, 'HERRAMIENTAS', 5), (p_taller_id, 'INSUMOS DE TALLER', 6)
  on conflict (taller_id, nombre) do nothing;
end $$;
revoke execute on function public.crear_familias_taller(uuid) from public, anon, authenticated;

create or replace function public.trg_familias_taller_nuevo()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin perform crear_familias_taller(new.id); return new; end $$;
drop trigger if exists familias_taller_nuevo on public.talleres;
create trigger familias_taller_nuevo after insert on public.talleres
  for each row execute function public.trg_familias_taller_nuevo();

select public.crear_familias_taller(id) from public.talleres;

-- ---------- 2. artículos: familia ----------
alter table public.articulos
  add column if not exists familia_id uuid references public.familias(id) on delete set null;
create index if not exists articulos_familia_idx on public.articulos (familia_id);

-- ---------- 3. listas de precio: precio de cada artículo en cada proveedor ----------
-- El precio puede quedar vacío: el artículo figura en la lista igual.
create table if not exists public.precios_proveedor (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres(id) on delete cascade,
  articulo_id uuid not null references public.articulos(id) on delete cascade,
  proveedor_id uuid not null references public.proveedores(id) on delete cascade,
  codigo_proveedor text,
  precio numeric,
  actualizado timestamptz not null default now(),
  unique (articulo_id, proveedor_id)
);
create index if not exists precios_proveedor_taller_idx on public.precios_proveedor (taller_id);
alter table public.precios_proveedor enable row level security;
drop policy if exists "solo mi taller" on public.precios_proveedor;
create policy "solo mi taller" on public.precios_proveedor
  for all using (taller_id in (select mis_talleres())) with check (taller_id in (select mis_talleres()));

-- ---------- 4. turnos ----------
create table if not exists public.turnos (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres(id) on delete cascade,
  fecha date not null,
  hora time not null,
  cliente_nombre text not null,
  cliente_id uuid references public.clientes(id) on delete set null,
  telefono text,
  vehiculo text,
  nota text,
  creado timestamptz not null default now()
);
create index if not exists turnos_taller_fecha_idx on public.turnos (taller_id, fecha, hora);
alter table public.turnos enable row level security;
drop policy if exists "solo mi taller" on public.turnos;
create policy "solo mi taller" on public.turnos
  for all using (taller_id in (select mis_talleres())) with check (taller_id in (select mis_talleres()));
