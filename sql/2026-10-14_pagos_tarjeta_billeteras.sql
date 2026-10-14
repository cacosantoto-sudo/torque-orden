-- =====================================================================
-- Modificaciones del 14/10: pagos a cuenta de presupuestos, cobro con
-- tarjeta con el CUIT del cliente y billeteras virtuales (Mercado Pago).
-- Correr UNA vez en Supabase > SQL Editor > New query > Run
-- (después de los SQL anteriores). Se puede volver a correr sin romper nada.
-- =====================================================================

-- ---------- 1. cajas: además de las 3 cajas, billeteras virtuales ----------
alter table public.cajas
  add column if not exists tipo text not null default 'caja';
alter table public.cajas drop constraint if exists cajas_tipo_check;
alter table public.cajas add constraint cajas_tipo_check check (tipo in ('caja', 'billetera'));

-- Crea las 3 cajas y la billetera de Mercado Pago de un taller si no las tiene
create or replace function public.crear_cajas_taller(p_taller_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not exists (select 1 from cajas where taller_id = p_taller_id and tipo = 'caja') then
    insert into cajas (taller_id, nombre, orden, tipo) values
      (p_taller_id, 'Caja 1', 1, 'caja'), (p_taller_id, 'Caja 2', 2, 'caja'), (p_taller_id, 'Caja 3', 3, 'caja');
  end if;
  if not exists (select 1 from cajas where taller_id = p_taller_id and tipo = 'billetera') then
    insert into cajas (taller_id, nombre, orden, tipo) values (p_taller_id, 'Mercado Pago', 11, 'billetera');
  end if;
end $$;
revoke execute on function public.crear_cajas_taller(uuid) from public, anon, authenticated;

select public.crear_cajas_taller(id) from public.talleres;

-- ---------- 2. movimientos: cliente y CUIT, n° de operación, medio "billetera" ----------
alter table public.movimientos_caja
  add column if not exists orden_id uuid references public.ordenes(id) on delete set null,
  add column if not exists cliente_id uuid references public.clientes(id) on delete set null,
  add column if not exists cliente_cuit text,
  add column if not exists referencia text,
  add column if not exists banco text,
  add column if not exists facturado boolean not null default false;
alter table public.movimientos_caja drop constraint if exists movimientos_caja_medio_check;
alter table public.movimientos_caja add constraint movimientos_caja_medio_check
  check (medio_pago in ('efectivo', 'transferencia', 'cheque', 'tarjeta', 'billetera'));
-- El mismo n° de operación no se carga dos veces en la misma billetera
create unique index if not exists movimientos_caja_referencia_idx on public.movimientos_caja (caja_id, referencia);

-- ---------- 3. pagos a cuenta de presupuestos (entran solos en la Caja 1) ----------
create table if not exists public.pagos_presupuesto (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres(id) on delete cascade,
  presupuesto_id uuid not null references public.presupuestos(id) on delete cascade,
  monto numeric not null check (monto > 0),
  medio_pago text not null default 'efectivo' check (medio_pago in ('efectivo', 'transferencia', 'tarjeta')),
  banco text,
  facturado boolean not null default false,
  fecha timestamptz not null default now(),
  nota text,
  movimiento_id uuid references public.movimientos_caja(id) on delete cascade,
  creado timestamptz not null default now()
);
create index if not exists pagos_presupuesto_presu_idx on public.pagos_presupuesto (presupuesto_id);
alter table public.pagos_presupuesto enable row level security;
drop policy if exists "solo mi taller" on public.pagos_presupuesto;
create policy "solo mi taller" on public.pagos_presupuesto
  for all using (taller_id in (select mis_talleres())) with check (taller_id in (select mis_talleres()));

-- Al registrar un pago a cuenta se crea el ingreso en la Caja 1 (aunque lo cargue un empleado)
create or replace function public.trg_pago_presupuesto_caja()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_caja uuid; v_orden uuid; v_numero bigint; v_cliente uuid; v_nombre text; v_cuit text; v_mov uuid;
begin
  select o.id, o.numero, c.id, c.nombre, c.dni_cuit into v_orden, v_numero, v_cliente, v_nombre, v_cuit
    from presupuestos p join ordenes o on o.id = p.orden_id left join clientes c on c.id = o.cliente_id
   where p.id = new.presupuesto_id and p.taller_id = new.taller_id;
  if v_orden is null then raise exception 'El presupuesto no es de este taller'; end if;
  select id into v_caja from cajas where taller_id = new.taller_id and tipo = 'caja' order by orden limit 1;
  if v_caja is null then raise exception 'El taller no tiene cajas'; end if;
  insert into movimientos_caja (taller_id, tipo, concepto, monto, caja_id, medio_pago, banco, facturado, fecha, orden_id, cliente_id, cliente_cuit)
  values (new.taller_id, 'ingreso',
          'Pago a cuenta presupuesto OT ' || lpad(v_numero::text, 6, '0') || coalesce(' · ' || v_nombre, '') || coalesce(' (' || nullif(new.nota, '') || ')', ''),
          new.monto, v_caja, new.medio_pago, new.banco, new.facturado, new.fecha, v_orden, v_cliente, v_cuit)
  returning id into v_mov;
  new.movimiento_id := v_mov;
  return new;
end $$;
drop trigger if exists pago_presupuesto_caja on public.pagos_presupuesto;
create trigger pago_presupuesto_caja before insert on public.pagos_presupuesto
  for each row execute function public.trg_pago_presupuesto_caja();

-- Si se borra el pago, se borra también el ingreso de la caja
-- (y si el dueño borra el ingreso en la caja, el pago se borra solo)
create or replace function public.trg_pago_presupuesto_borrar()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if old.movimiento_id is not null then delete from movimientos_caja where id = old.movimiento_id; end if;
  return old;
end $$;
drop trigger if exists pago_presupuesto_borrar on public.pagos_presupuesto;
create trigger pago_presupuesto_borrar after delete on public.pagos_presupuesto
  for each row execute function public.trg_pago_presupuesto_borrar();
