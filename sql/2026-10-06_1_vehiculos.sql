-- =====================================================================
-- Bloque 1: ficha completa del vehículo (marca, modelo, color, motor y caja)
-- Correr UNA vez en Supabase > SQL Editor > New query > Run.
-- Se puede volver a correr sin romper nada.
-- =====================================================================

alter table public.equipos
  add column if not exists marca        text,
  add column if not exists modelo       text,
  add column if not exists anio         integer,
  add column if not exists color        text,
  add column if not exists vin          text,   -- número de chasis / VIN
  add column if not exists motor        text,   -- ej.: 1.8 16v
  add column if not exists cilindrada   text,   -- ej.: 1798 cc
  add column if not exists combustible  text,   -- Nafta, Diésel, GNC...
  add column if not exists codigo_motor text,
  add column if not exists caja_tipo    text,   -- manual / automatica
  add column if not exists caja_modelo  text;   -- modelo o código de caja

create index if not exists equipos_cliente_idx on public.equipos (cliente_id);
create index if not exists equipos_taller_idx  on public.equipos (taller_id);
