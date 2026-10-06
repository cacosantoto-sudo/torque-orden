-- =====================================================================
-- Bloque 4: neumáticos (estado, vida útil, cambios) y alineaciones
-- Correr UNA vez en Supabase > SQL Editor > New query > Run
-- (después de los SQL de los bloques 1, 2 y 3). Se puede volver a correr.
-- =====================================================================

-- ---------- neumáticos ----------
-- evento: 'colocacion' (cubierta nueva puesta) o 'control' (revisión del estado).
-- El estado actual de cada posición es su último registro.
create table if not exists public.neumaticos (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres(id) on delete cascade,
  equipo_id uuid not null references public.equipos(id) on delete cascade,
  orden_id uuid references public.ordenes(id) on delete set null,
  fecha date not null default current_date,
  km numeric,
  evento text not null default 'control' check (evento in ('control', 'colocacion')),
  posicion text not null,
  marca text,
  medida text,
  modelo text,
  vida_pct integer check (vida_pct between 0 and 100),
  desgaste_mm numeric,          -- profundidad de dibujo en mm
  observaciones text,
  creado timestamptz not null default now()
);
create index if not exists neumaticos_equipo_idx on public.neumaticos (equipo_id, fecha desc);
alter table public.neumaticos enable row level security;
drop policy if exists "solo mi taller" on public.neumaticos;
create policy "solo mi taller" on public.neumaticos
  for all using (taller_id in (select mis_talleres())) with check (taller_id in (select mis_talleres()));

-- ---------- alineaciones ----------
create table if not exists public.alineaciones (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres(id) on delete cascade,
  equipo_id uuid not null references public.equipos(id) on delete cascade,
  orden_id uuid references public.ordenes(id) on delete set null,
  fecha date not null default current_date,
  km numeric,
  valores jsonb not null default '{}'::jsonb,   -- caída, convergencia y avance
  observaciones text,
  creado timestamptz not null default now()
);
create index if not exists alineaciones_equipo_idx on public.alineaciones (equipo_id, fecha desc);
alter table public.alineaciones enable row level security;
drop policy if exists "solo mi taller" on public.alineaciones;
create policy "solo mi taller" on public.alineaciones
  for all using (taller_id in (select mis_talleres())) with check (taller_id in (select mis_talleres()));

-- ---------- la ficha pública suma neumáticos y alineaciones ----------
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
    'neumaticos', coalesce((select json_agg(json_build_object('fecha', n.fecha, 'km', n.km, 'evento', n.evento, 'posicion', n.posicion,
              'marca', n.marca, 'medida', n.medida, 'modelo', n.modelo, 'vida_pct', n.vida_pct, 'desgaste_mm', n.desgaste_mm,
              'observaciones', n.observaciones) order by n.fecha desc, n.creado desc) from neumaticos n where n.equipo_id = e.id), '[]'::json),
    'alineaciones', coalesce((select json_agg(json_build_object('fecha', a.fecha, 'km', a.km, 'valores', a.valores,
              'observaciones', a.observaciones) order by a.fecha desc, a.creado desc) from alineaciones a where a.equipo_id = e.id), '[]'::json),
    'km_actual', greatest(
              (select max(o.medidor) from ordenes o where o.equipo_id = e.id),
              (select max(x.km) from mantenimientos x where x.equipo_id = e.id),
              (select max(mo.medidor) from motores mo where mo.equipo_id = e.id))
  )
  from equipos e join talleres t on t.id = e.taller_id
  where e.qr_token = p_token and length(p_token) >= 16
$$;
grant execute on function public.ficha_publica(text) to anon, authenticated;
