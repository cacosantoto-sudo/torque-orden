-- =====================================================================
-- Bloque 2: historial de mantenimiento, próximos services y QR por vehículo
-- Correr UNA vez en Supabase > SQL Editor > New query > Run
-- (después del SQL del bloque 1). Se puede volver a correr sin romper nada.
-- =====================================================================

-- ---------- QR propio de cada vehículo ----------
alter table public.equipos add column if not exists qr_token text;
update public.equipos set qr_token = replace(gen_random_uuid()::text, '-', '') where qr_token is null;
alter table public.equipos alter column qr_token set default replace(gen_random_uuid()::text, '-', '');
create unique index if not exists equipos_qr_token_idx on public.equipos (qr_token);

-- ---------- historial de mantenimiento ----------
-- tipo: aceite (service de aceite y filtros), caja (caja automática),
--       distribucion, otro.  "datos" guarda el detalle de cada tipo
--       (aceite, viscosidad, litros, filtros, ATF, componentes...).
create table if not exists public.mantenimientos (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres(id) on delete cascade,
  equipo_id uuid not null references public.equipos(id) on delete cascade,
  orden_id uuid references public.ordenes(id) on delete set null,
  tipo text not null default 'aceite' check (tipo in ('aceite', 'caja', 'distribucion', 'otro')),
  fecha date not null default current_date,
  km numeric,
  datos jsonb not null default '{}'::jsonb,
  proximo_km numeric,
  proximo_fecha date,
  observaciones text,
  creado timestamptz not null default now()
);
create index if not exists mantenimientos_equipo_idx on public.mantenimientos (equipo_id, fecha desc);
create index if not exists mantenimientos_taller_idx on public.mantenimientos (taller_id);
alter table public.mantenimientos enable row level security;
drop policy if exists "solo mi taller" on public.mantenimientos;
create policy "solo mi taller" on public.mantenimientos
  for all using (taller_id in (select mis_talleres())) with check (taller_id in (select mis_talleres()));

-- ---------- ficha pública (lo que ve el cliente al escanear el QR) ----------
-- No devuelve datos personales del cliente (ni nombre ni teléfono).
create or replace function public.ficha_publica(p_token text)
returns json language sql stable security definer set search_path to 'public' as $$
  select json_build_object(
    'taller', json_build_object('nombre', t.nombre, 'logo', t.logo_url, 'telefono', t.telefono,
              'direccion', t.direccion, 'instagram', t.instagram, 'maps_url', t.maps_url, 'rubro', t.rubro),
    'vehiculo', json_build_object('nombre', e.nombre, 'marca', e.marca, 'modelo', e.modelo, 'anio', e.anio,
              'color', e.color, 'patente', e.matricula_patente, 'motor', e.motor, 'cilindrada', e.cilindrada,
              'combustible', e.combustible, 'codigo_motor', e.codigo_motor, 'caja_tipo', e.caja_tipo,
              'caja_modelo', e.caja_modelo),
    'motores', coalesce((select json_agg(json_build_object('marca', mo.marca, 'modelo', mo.modelo, 'medidor', mo.medidor))
              from motores mo where mo.equipo_id = e.id), '[]'::json),
    'mantenimientos', coalesce((select json_agg(json_build_object('tipo', x.tipo, 'fecha', x.fecha, 'km', x.km, 'datos', x.datos,
              'proximo_km', x.proximo_km, 'proximo_fecha', x.proximo_fecha, 'observaciones', x.observaciones)
              order by x.fecha desc, x.creado desc) from mantenimientos x where x.equipo_id = e.id), '[]'::json),
    'visitas', coalesce((select json_agg(json_build_object('numero', o.numero, 'fecha', o.creado, 'estado', o.estado,
              'km', o.medidor, 'motivo', o.motivo, 'trabajos', o.trabajos) order by o.creado desc)
              from ordenes o where o.equipo_id = e.id), '[]'::json),
    'km_actual', greatest(
              (select max(o.medidor) from ordenes o where o.equipo_id = e.id),
              (select max(x.km) from mantenimientos x where x.equipo_id = e.id),
              (select max(mo.medidor) from motores mo where mo.equipo_id = e.id))
  )
  from equipos e join talleres t on t.id = e.taller_id
  where e.qr_token = p_token and length(p_token) >= 16
$$;
grant execute on function public.ficha_publica(text) to anon, authenticated;
