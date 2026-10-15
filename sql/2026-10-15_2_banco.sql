-- =====================================================================
-- Modificaciones del 15/10 (segunda tanda): división BANCO en Cajas.
-- Las cuentas de banco son cajas de tipo 'banco', aparte de las 3 cajas.
-- Cada taller arranca con una cuenta llamada "Banco" (se le puede cambiar
-- el nombre y agregar más). Los cheques quedan como sub división de Banco.
-- Correr UNA vez en Supabase > SQL Editor > New query > Run
-- (después de los SQL anteriores). Se puede volver a correr sin romper nada.
-- =====================================================================

alter table public.cajas drop constraint if exists cajas_tipo_check;
alter table public.cajas add constraint cajas_tipo_check check (tipo in ('caja', 'billetera', 'banco'));

-- Crea las 3 cajas, la billetera de Mercado Pago y la cuenta de banco de un taller si no las tiene
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
  if not exists (select 1 from cajas where taller_id = p_taller_id and tipo = 'banco') then
    insert into cajas (taller_id, nombre, orden, tipo) values (p_taller_id, 'Banco', 21, 'banco');
  end if;
end $$;
revoke execute on function public.crear_cajas_taller(uuid) from public, anon, authenticated;

select public.crear_cajas_taller(id) from public.talleres;

notify pgrst, 'reload schema';

-- Control: tiene que mostrar "banco OK" y la cantidad de talleres con cuenta de banco
select 'banco OK' as resultado, count(distinct taller_id) as talleres_con_banco from public.cajas where tipo = 'banco';
