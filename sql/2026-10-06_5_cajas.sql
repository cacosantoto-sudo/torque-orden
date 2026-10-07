-- =====================================================================
-- Bloque 5: tres cajas con ingresos, egresos y medio de pago
-- Correr UNA vez en Supabase > SQL Editor > New query > Run
-- (después de los SQL anteriores). Se puede volver a correr sin romper nada.
-- =====================================================================

-- ---------- cajas (3 por taller, se les puede cambiar el nombre) ----------
create table if not exists public.cajas (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres(id) on delete cascade,
  nombre text not null,
  orden smallint not null default 1,
  creado timestamptz not null default now()
);
create index if not exists cajas_taller_idx on public.cajas (taller_id, orden);
alter table public.cajas enable row level security;
drop policy if exists "solo el dueño" on public.cajas;
create policy "solo el dueño" on public.cajas
  for all using (es_dueno(taller_id)) with check (es_dueno(taller_id));

-- Crea las 3 cajas de un taller si todavía no las tiene
create or replace function public.crear_cajas_taller(p_taller_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not exists (select 1 from cajas where taller_id = p_taller_id) then
    insert into cajas (taller_id, nombre, orden) values
      (p_taller_id, 'Caja 1', 1), (p_taller_id, 'Caja 2', 2), (p_taller_id, 'Caja 3', 3);
  end if;
end $$;
revoke execute on function public.crear_cajas_taller(uuid) from public, anon, authenticated;

create or replace function public.trg_cajas_taller_nuevo()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin perform crear_cajas_taller(new.id); return new; end $$;
drop trigger if exists cajas_taller_nuevo on public.talleres;
create trigger cajas_taller_nuevo after insert on public.talleres
  for each row execute function public.trg_cajas_taller_nuevo();

select public.crear_cajas_taller(id) from public.talleres;

-- ---------- movimientos: caja, medio de pago y fecha/hora ----------
alter table public.movimientos_caja
  add column if not exists caja_id uuid references public.cajas(id) on delete restrict,
  add column if not exists medio_pago text not null default 'efectivo',
  add column if not exists fecha timestamptz;
update public.movimientos_caja set fecha = creado where fecha is null;
alter table public.movimientos_caja alter column fecha set default now();
alter table public.movimientos_caja alter column fecha set not null;
alter table public.movimientos_caja drop constraint if exists movimientos_caja_medio_check;
alter table public.movimientos_caja add constraint movimientos_caja_medio_check
  check (medio_pago in ('efectivo', 'transferencia', 'cheque', 'tarjeta'));
-- Los movimientos que ya existían quedan en la Caja 1
update public.movimientos_caja mc set caja_id = c.id
  from public.cajas c where mc.caja_id is null and c.taller_id = mc.taller_id and c.orden = 1;
create index if not exists movimientos_caja_caja_idx on public.movimientos_caja (caja_id, fecha desc);
