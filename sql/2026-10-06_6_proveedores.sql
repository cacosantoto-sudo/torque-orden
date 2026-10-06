-- =====================================================================
-- Bloque 6: proveedores, facturas de compra, repuestos comprados,
--           pagos y cuenta corriente.
-- Correr UNA vez en Supabase > SQL Editor > New query > Run
-- (después de los SQL anteriores). Se puede volver a correr sin romper nada.
-- =====================================================================

-- ---------- proveedores ----------
create table if not exists public.proveedores (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres(id) on delete cascade,
  nombre text not null,            -- nombre o razón social
  cuit text,
  telefono text,
  email text,
  direccion text,
  contacto text,                   -- contacto comercial
  condiciones_pago text,
  observaciones text,
  creado timestamptz not null default now()
);
create index if not exists proveedores_taller_idx on public.proveedores (taller_id);
alter table public.proveedores enable row level security;
drop policy if exists "solo mi taller" on public.proveedores;
create policy "solo mi taller" on public.proveedores
  for all using (taller_id in (select mis_talleres())) with check (taller_id in (select mis_talleres()));

-- ---------- facturas de compra ----------
create table if not exists public.compras (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres(id) on delete cascade,
  proveedor_id uuid not null references public.proveedores(id) on delete restrict,
  numero text,
  fecha date not null default current_date,
  vencimiento date,
  total numeric not null default 0,
  condicion_pago text,
  observaciones text,
  comprobante_ruta text,           -- imagen o PDF original (carpeta "documentos")
  comprobante_nombre text,
  creado timestamptz not null default now()
);
create index if not exists compras_proveedor_idx on public.compras (proveedor_id, fecha);
alter table public.compras enable row level security;
drop policy if exists "solo mi taller" on public.compras;
create policy "solo mi taller" on public.compras
  for all using (taller_id in (select mis_talleres())) with check (taller_id in (select mis_talleres()));

-- ---------- repuestos de cada factura ----------
create table if not exists public.compra_items (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres(id) on delete cascade,
  compra_id uuid not null references public.compras(id) on delete cascade,
  repuesto_id uuid references public.repuestos(id) on delete set null,
  descripcion text not null,
  marca text,
  codigo text,
  cantidad numeric not null default 1,
  costo_unitario numeric not null default 0,
  total numeric not null default 0
);
create index if not exists compra_items_compra_idx on public.compra_items (compra_id);
alter table public.compra_items enable row level security;
drop policy if exists "solo mi taller" on public.compra_items;
create policy "solo mi taller" on public.compra_items
  for all using (taller_id in (select mis_talleres())) with check (taller_id in (select mis_talleres()));

-- ---------- pagos a proveedores ----------
create table if not exists public.pagos_proveedor (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres(id) on delete cascade,
  proveedor_id uuid not null references public.proveedores(id) on delete restrict,
  fecha date not null default current_date,
  importe numeric not null check (importe > 0),
  medio_pago text not null default 'efectivo',
  observaciones text,
  movimiento_id uuid references public.movimientos_caja(id) on delete set null,
  creado timestamptz not null default now()
);
create index if not exists pagos_proveedor_idx on public.pagos_proveedor (proveedor_id, fecha);
alter table public.pagos_proveedor enable row level security;
drop policy if exists "solo mi taller" on public.pagos_proveedor;
create policy "solo mi taller" on public.pagos_proveedor
  for all using (taller_id in (select mis_talleres())) with check (taller_id in (select mis_talleres()));

-- Qué facturas cancela cada pago (y cuánto de cada una)
create table if not exists public.pago_aplicaciones (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres(id) on delete cascade,
  pago_id uuid not null references public.pagos_proveedor(id) on delete cascade,
  compra_id uuid not null references public.compras(id) on delete cascade,
  importe numeric not null check (importe > 0)
);
create index if not exists pago_aplicaciones_compra_idx on public.pago_aplicaciones (compra_id);
alter table public.pago_aplicaciones enable row level security;
drop policy if exists "solo mi taller" on public.pago_aplicaciones;
create policy "solo mi taller" on public.pago_aplicaciones
  for all using (taller_id in (select mis_talleres())) with check (taller_id in (select mis_talleres()));

-- ---------- carpeta privada "documentos" (por si no se corrió el bloque 3) ----------
insert into storage.buckets (id, name, public) values ('documentos', 'documentos', false)
  on conflict (id) do nothing;
drop policy if exists "documentos de mi taller" on storage.objects;
create policy "documentos de mi taller" on storage.objects for all to authenticated
  using (bucket_id = 'documentos' and (storage.foldername(name))[1] in (select x::text from mis_talleres() as x))
  with check (bucket_id = 'documentos' and (storage.foldername(name))[1] in (select x::text from mis_talleres() as x));
