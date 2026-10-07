-- =====================================================================
-- Tres planes: gratis, plata y oro
-- Correr UNA vez en Supabase > SQL Editor > New query > Run
-- (después de los SQL anteriores). Se puede volver a correr sin romper nada.
--
-- gratis -> lo básico del taller
-- plata  -> suma caja, reportes, proveedores y neumáticos
-- oro    -> suma todas las funciones con IA (son las que tienen costo por uso)
--
-- Los talleres que hoy tienen plan "pago" pasan a "oro", porque ya venían
-- usando las funciones con IA.
-- =====================================================================

-- ---------- la columna plan ahora acepta los tres valores ----------
alter table public.talleres drop constraint if exists talleres_plan_check;
update public.talleres set plan = 'oro' where plan = 'pago';
update public.talleres set plan = 'gratis' where plan is null or plan not in ('gratis', 'plata', 'oro');
alter table public.talleres alter column plan set default 'gratis';
alter table public.talleres add constraint talleres_plan_check
  check (plan in ('gratis', 'plata', 'oro'));

-- ---------- cambiar de plan (solo el dueño del taller) ----------
create or replace function public.cambiar_plan(p_taller_id uuid, p_plan text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not es_dueno(p_taller_id) then
    raise exception 'Solo el dueño del taller puede cambiar el plan';
  end if;
  if p_plan not in ('gratis', 'plata', 'oro') then
    raise exception 'Plan inválido: %', p_plan;
  end if;
  update talleres set plan = p_plan where id = p_taller_id;
end $$;
revoke execute on function public.cambiar_plan(uuid, text) from public, anon;
grant execute on function public.cambiar_plan(uuid, text) to authenticated;

-- ---------- las funciones viejas siguen andando ----------
-- (por si quedó alguna pantalla vieja en el celular de alguien)
create or replace function public.activar_plan_pago(p_taller_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin perform cambiar_plan(p_taller_id, 'oro'); end $$;
revoke execute on function public.activar_plan_pago(uuid) from public, anon;
grant execute on function public.activar_plan_pago(uuid) to authenticated;

create or replace function public.desactivar_plan_pago(p_taller_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin perform cambiar_plan(p_taller_id, 'gratis'); end $$;
revoke execute on function public.desactivar_plan_pago(uuid) from public, anon;
grant execute on function public.desactivar_plan_pago(uuid) to authenticated;

-- ---------- control ----------
select plan, count(*) as talleres from public.talleres group by plan order by plan;
