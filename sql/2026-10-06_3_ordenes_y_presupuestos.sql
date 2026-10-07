-- =====================================================================
-- Bloque 3: presupuestos con estados, sector del taller, facturado
--           y PDF de la factura electrónica en cada orden.
-- Correr UNA vez en Supabase > SQL Editor > New query > Run
-- (después de los SQL de los bloques 1 y 2). Se puede volver a correr.
-- =====================================================================

-- ---------- estado del presupuesto ----------
alter table public.presupuestos add column if not exists estado text not null default 'Pendiente';
update public.presupuestos set estado = 'Aprobado' where aprobado and estado = 'Pendiente';
alter table public.presupuestos drop constraint if exists presupuestos_estado_check;
alter table public.presupuestos add constraint presupuestos_estado_check
  check (estado in ('Pendiente', 'Aprobado', 'Rechazado', 'Parcialmente aprobado', 'Realizado'));

-- ---------- sector, facturación y factura de la orden ----------
alter table public.ordenes
  add column if not exists sector text,
  add column if not exists facturado boolean not null default false,
  add column if not exists factura_numero text,
  add column if not exists factura_ruta text,     -- dónde quedó guardado el PDF
  add column if not exists factura_nombre text,
  add column if not exists factura_fecha timestamptz;

-- ---------- carpeta privada "documentos" (facturas y comprobantes) ----------
-- Cada taller solo ve los archivos que empiezan con su propio id.
insert into storage.buckets (id, name, public) values ('documentos', 'documentos', false)
  on conflict (id) do nothing;
drop policy if exists "documentos de mi taller" on storage.objects;
create policy "documentos de mi taller" on storage.objects for all to authenticated
  using (bucket_id = 'documentos' and (storage.foldername(name))[1] in (select x::text from mis_talleres() as x))
  with check (bucket_id = 'documentos' and (storage.foldername(name))[1] in (select x::text from mis_talleres() as x));

-- ---------- la ficha pública suma los presupuestos ----------
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
    'presupuestos', coalesce((select json_agg(json_build_object('numero', o.numero, 'fecha', p.creado, 'estado', p.estado,
              'total', p.total, 'items', (select coalesce(json_agg(i->>'descripcion'), '[]'::json) from jsonb_array_elements(p.items::jsonb) i
                                          where coalesce(i->>'tipo', '') <> 'meta' and coalesce(i->>'descripcion', '') <> ''))
              order by p.creado desc) from presupuestos p join ordenes o on o.id = p.orden_id where o.equipo_id = e.id), '[]'::json),
    'km_actual', greatest(
              (select max(o.medidor) from ordenes o where o.equipo_id = e.id),
              (select max(x.km) from mantenimientos x where x.equipo_id = e.id),
              (select max(mo.medidor) from motores mo where mo.equipo_id = e.id))
  )
  from equipos e join talleres t on t.id = e.taller_id
  where e.qr_token = p_token and length(p_token) >= 16
$$;
grant execute on function public.ficha_publica(text) to anon, authenticated;
