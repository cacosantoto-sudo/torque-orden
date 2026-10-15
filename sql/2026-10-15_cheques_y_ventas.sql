-- =====================================================================
-- Modificaciones del 15/10: división CHEQUES dentro del módulo Cajas
-- (tabla propia, aparte de las 3 cajas) y venta de motos / lanchas:
-- nueva o usada, y tipo de unidad (lancha o motor fuera de borda).
-- Correr UNA vez en Supabase > SQL Editor > New query > Run
-- (después de los SQL anteriores). Se puede volver a correr sin romper nada.
-- =====================================================================

create table if not exists public.cheques (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres(id) on delete cascade,
  tipo text not null default 'comun' check (tipo in ('comun', 'diferido')),
  numero text,
  banco text,
  importe numeric not null default 0,
  titular_nombre text,          -- titular del cheque (quien lo firma)
  titular_cuit text,
  cliente_id uuid references public.clientes(id) on delete set null,  -- cliente que lo entregó
  cliente_nombre text,
  cliente_telefono text,
  fecha_emision date,
  fecha_vencimiento date not null,
  estado text not null default 'cartera' check (estado in ('cartera', 'depositado', 'cobrado', 'endosado', 'rechazado')),
  observaciones text,
  creado timestamptz not null default now()
);
create index if not exists cheques_taller_venc_idx on public.cheques (taller_id, estado, fecha_vencimiento);
alter table public.cheques enable row level security;
drop policy if exists "solo mi taller" on public.cheques;
create policy "solo mi taller" on public.cheques
  for all using (taller_id in (select mis_talleres())) with check (taller_id in (select mis_talleres()));

-- ---------- venta de unidades: nueva/usada y tipo ----------
alter table public.autos_venta
  add column if not exists unidad_estado text not null default 'usado',
  add column if not exists tipo_unidad text;
alter table public.autos_venta drop constraint if exists autos_venta_unidad_estado_check;
alter table public.autos_venta add constraint autos_venta_unidad_estado_check check (unidad_estado in ('nuevo', 'usado'));

notify pgrst, 'reload schema';

-- Control: tiene que mostrar dos filas, "cheques OK" y "ventas OK"
select 'cheques OK' as resultado from information_schema.tables where table_schema = 'public' and table_name = 'cheques'
union all
select 'ventas OK' from information_schema.columns where table_schema = 'public' and table_name = 'autos_venta' and column_name = 'unidad_estado';
