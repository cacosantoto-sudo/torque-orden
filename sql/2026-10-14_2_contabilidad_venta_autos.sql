-- =====================================================================
-- Modificaciones del 14/10 (segunda tanda): categorías en la caja,
-- módulo Contabilidad (compras, ventas, posición de IVA, planilla de
-- impuestos) y módulo Venta de autos.
-- Correr UNA vez en Supabase > SQL Editor > New query > Run
-- (después de los SQL anteriores). Se puede volver a correr sin romper nada.
-- =====================================================================

-- ---------- 1. caja: categoría, tipo de factura e IVA de cada movimiento ----------
alter table public.movimientos_caja
  add column if not exists categoria text,
  add column if not exists tipo_factura text,
  add column if not exists iva numeric not null default 0;
alter table public.movimientos_caja drop constraint if exists movimientos_caja_categoria_check;
alter table public.movimientos_caja add constraint movimientos_caja_categoria_check
  check (categoria is null or categoria in ('repuestos', 'insumos', 'servicios', 'servicios_terceros', 'sueldos', 'herramientas', 'otros'));
alter table public.movimientos_caja drop constraint if exists movimientos_caja_tipo_factura_check;
alter table public.movimientos_caja add constraint movimientos_caja_tipo_factura_check
  check (tipo_factura is null or tipo_factura in ('A', 'B', 'C'));

-- Los pagos a proveedores que ya están en la caja quedan como "Repuestos"
update public.movimientos_caja set categoria = 'repuestos'
 where categoria is null and id in (select movimiento_id from public.pagos_proveedor where movimiento_id is not null);

-- ---------- 2. facturas de compra: tipo de factura, IVA y categoría ----------
alter table public.compras
  add column if not exists tipo_factura text,
  add column if not exists iva numeric not null default 0,
  add column if not exists categoria text not null default 'repuestos';
alter table public.compras drop constraint if exists compras_tipo_factura_check;
alter table public.compras add constraint compras_tipo_factura_check
  check (tipo_factura is null or tipo_factura in ('A', 'B', 'C'));
alter table public.compras drop constraint if exists compras_categoria_check;
alter table public.compras add constraint compras_categoria_check
  check (categoria in ('repuestos', 'insumos', 'servicios', 'servicios_terceros', 'sueldos', 'herramientas', 'otros'));
-- Las facturas ya cargadas con número "A ..." quedan como factura A
update public.compras set tipo_factura = 'A' where tipo_factura is null and numero ~* '^\s*a[\s-]';

-- ---------- 3. planilla de impuestos ----------
create table if not exists public.impuestos (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres(id) on delete cascade,
  descripcion text not null default '',
  vencimiento date,
  importe numeric,
  observaciones text,
  creado timestamptz not null default now()
);
create index if not exists impuestos_taller_idx on public.impuestos (taller_id, vencimiento);
alter table public.impuestos enable row level security;
drop policy if exists "solo mi taller" on public.impuestos;
create policy "solo mi taller" on public.impuestos
  for all using (taller_id in (select mis_talleres())) with check (taller_id in (select mis_talleres()));

-- ---------- 4. venta de autos ----------
create table if not exists public.autos_venta (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete set null,
  condicion text not null default 'propio' check (condicion in ('propio', 'consignacion')),
  precio_cliente numeric,          -- lo que se le paga / le queda al cliente
  precio_publicacion numeric,      -- precio de venta publicado
  marca text,
  modelo text,
  anio integer,
  color text,
  patente text,
  kilometros numeric,
  estado text not null default 'disponible' check (estado in ('disponible', 'reservado', 'vendido')),
  observaciones text,
  documentos jsonb not null default '[]'::jsonb,   -- [{ruta, nombre}] PDFs en la carpeta "documentos"
  fotos jsonb not null default '[]'::jsonb,        -- [{ruta}] fotos en la carpeta "documentos"
  creado timestamptz not null default now()
);
create index if not exists autos_venta_taller_idx on public.autos_venta (taller_id, creado);
alter table public.autos_venta enable row level security;
drop policy if exists "solo mi taller" on public.autos_venta;
create policy "solo mi taller" on public.autos_venta
  for all using (taller_id in (select mis_talleres())) with check (taller_id in (select mis_talleres()));
