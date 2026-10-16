-- =====================================================================
-- Verificación pre compra (solo talleres de autos)
-- Correr UNA vez en Supabase > SQL Editor > New query > Run.
-- Se puede volver a correr sin romper nada.
--
-- Qué crea:
--  1. precompra_config: ajustes de cada taller (prefijo del número de
--     informe, rangos de calificación, mecánico responsable y su firma).
--  2. precompras: cada informe, con número automático por taller y el
--     historial por patente (dominio) y por VIN.
--  3. carpeta "precompra" para las fotos del informe (se ven desde el QR).
--  4. precompra_publica(): lo que ve quien escanea el QR del informe
--     (sin DNI, teléfono ni correo del cliente).
-- =====================================================================

-- ---------- 1. ajustes por taller ----------
create table if not exists public.precompra_config (
  taller_id uuid primary key references public.talleres(id) on delete cascade,
  prefijo text,                    -- ej.: NRT  ->  NRT-2610001
  rangos jsonb,                    -- [{min:90, txt:'Excelente'}, ...]
  responsable text,                -- mecánico responsable por defecto
  matricula text,                  -- matrícula profesional
  firma_ruta text,                 -- firma del responsable (carpeta "precompra")
  lugar text,                      -- lugar de inspección por defecto
  actualizado timestamptz not null default now()
);
alter table public.precompra_config enable row level security;
drop policy if exists "solo mi taller" on public.precompra_config;
create policy "solo mi taller" on public.precompra_config
  for all using (taller_id in (select mis_talleres())) with check (taller_id in (select mis_talleres()));

-- ---------- 2. informes ----------
create table if not exists public.precompras (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres(id) on delete cascade,
  numero integer,                  -- correlativo del taller (lo pone la base)
  codigo text,                     -- número de informe a la vista: NRT-2610001
  fecha date not null default current_date,
  lugar text,
  cliente_id uuid references public.clientes(id) on delete set null,
  equipo_id uuid references public.equipos(id) on delete set null,  -- si el auto ya está cargado en el taller
  cliente jsonb not null default '{}'::jsonb,   -- copia: nombre, dni, telefono, email
  marca text,
  modelo text,
  anio integer,
  patente text,                    -- dominio, guardado sin espacios ni guiones
  vin text,
  km numeric,
  motor text,
  combustible text,
  transmision text,
  color text,
  puntaje integer,
  estado text not null default 'borrador' check (estado in ('borrador', 'finalizado')),
  datos jsonb not null default '{}'::jsonb,     -- puntajes, carrocería, neumáticos, alertas, gastos...
  fotos jsonb not null default '{}'::jsonb,     -- rutas de las fotos (carpeta "precompra")
  qr_token text not null default replace(gen_random_uuid()::text, '-', ''),
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create unique index if not exists precompras_numero_idx on public.precompras (taller_id, numero);
create unique index if not exists precompras_qr_idx on public.precompras (qr_token);
create index if not exists precompras_patente_idx on public.precompras (taller_id, patente);
create index if not exists precompras_vin_idx on public.precompras (taller_id, vin);
create index if not exists precompras_creado_idx on public.precompras (taller_id, creado desc);
alter table public.precompras enable row level security;
drop policy if exists "solo mi taller" on public.precompras;
create policy "solo mi taller" on public.precompras
  for all using (taller_id in (select mis_talleres())) with check (taller_id in (select mis_talleres()));

-- número de informe automático: PREFIJO-AAMM + correlativo de 3 cifras
create or replace function public.precompra_numerar()
returns trigger language plpgsql as $$
declare v_pref text;
begin
  if tg_op = 'INSERT' then
    select coalesce(max(numero), 0) + 1 into new.numero from precompras where taller_id = new.taller_id;
    select nullif(trim(c.prefijo), '') into v_pref from precompra_config c where c.taller_id = new.taller_id;
    if v_pref is null then
      select upper(left(regexp_replace(split_part(trim(t.nombre), ' ', 1), '[^A-Za-z0-9]', '', 'g'), 4))
        into v_pref from talleres t where t.id = new.taller_id;
    end if;
    new.codigo := coalesce(nullif(v_pref, ''), 'INF') || '-' || to_char(coalesce(new.fecha, current_date), 'YYMM')
                  || lpad(new.numero::text, 3, '0');
  else
    new.numero := old.numero;      -- el número no se cambia
    new.codigo := old.codigo;
    new.qr_token := old.qr_token;
    new.actualizado := now();
  end if;
  new.patente := nullif(upper(regexp_replace(coalesce(new.patente, ''), '[^A-Za-z0-9]', '', 'g')), '');
  new.vin := nullif(upper(regexp_replace(coalesce(new.vin, ''), '[^A-Za-z0-9]', '', 'g')), '');
  return new;
end $$;
drop trigger if exists precompra_numerar on public.precompras;
create trigger precompra_numerar before insert or update on public.precompras
  for each row execute function public.precompra_numerar();

-- ---------- 3. fotos del informe ----------
-- Carpeta pública (para que el cliente vea las fotos desde el QR). Cada
-- archivo lleva el código del taller y del informe en el nombre, que no se
-- puede adivinar. Solo el taller puede subir o borrar en su carpeta.
insert into storage.buckets (id, name, public) values ('precompra', 'precompra', true)
  on conflict (id) do update set public = true;
drop policy if exists "precompra de mi taller" on storage.objects;
create policy "precompra de mi taller" on storage.objects for all to authenticated
  using (bucket_id = 'precompra' and (storage.foldername(name))[1] in (select x::text from mis_talleres() as x))
  with check (bucket_id = 'precompra' and (storage.foldername(name))[1] in (select x::text from mis_talleres() as x));

-- ---------- 4. informe público (QR) ----------
create or replace function public.precompra_publica(p_token text)
returns json language sql stable security definer set search_path to 'public' as $$
  select json_build_object(
    'taller', json_build_object('nombre', t.nombre, 'logo', t.logo_url, 'telefono', t.telefono,
              'direccion', t.direccion, 'instagram', t.instagram, 'maps_url', t.maps_url),
    'config', json_build_object('rangos', c.rangos, 'firma_ruta', c.firma_ruta),
    'informe', json_build_object('codigo', p.codigo, 'fecha', p.fecha, 'lugar', p.lugar,
              'cliente', json_build_object('nombre', p.cliente->>'nombre'),
              'marca', p.marca, 'modelo', p.modelo, 'anio', p.anio, 'patente', p.patente, 'vin', p.vin,
              'km', p.km, 'motor', p.motor, 'combustible', p.combustible, 'transmision', p.transmision,
              'color', p.color, 'puntaje', p.puntaje, 'estado', p.estado, 'datos', p.datos - 'contrato',
              'fotos', p.fotos, 'qr_token', p.qr_token)
  )
  from precompras p
  join talleres t on t.id = p.taller_id
  left join precompra_config c on c.taller_id = p.taller_id
  where p.qr_token = p_token and length(p_token) >= 16
$$;
grant execute on function public.precompra_publica(text) to anon, authenticated;

-- ---------- control ----------
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('precompras', 'precompra_config')) as tablas_ok_deben_ser_2,
  (select public from storage.buckets where id = 'precompra') as carpeta_fotos_publica;
