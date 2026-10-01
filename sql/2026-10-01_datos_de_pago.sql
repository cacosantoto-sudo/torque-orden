-- =====================================================================
-- Datos de pago del taller (alias, CBU/CVU y titular) para presupuestos.
-- Correr UNA vez en Supabase > SQL Editor > New query > Run.
-- Se puede volver a correr sin romper nada.
-- =====================================================================

alter table public.talleres add column if not exists alias_pago text;
alter table public.talleres add column if not exists cbu_pago text;
alter table public.talleres add column if not exists titular_pago text;

-- Solo el dueño puede cambiar los datos de pago.
create or replace function public.actualizar_pago_taller(p_taller_id uuid, p_alias text, p_cbu text, p_titular text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_cbu text := nullif(regexp_replace(coalesce(p_cbu,''), '[^0-9]', '', 'g'), '');
begin
  if not exists(select 1 from miembros where taller_id = p_taller_id and usuario_id = auth.uid() and rol = 'dueno') then
    raise exception 'Solo el dueño del taller puede cambiar los datos de pago';
  end if;
  if v_cbu is not null and length(v_cbu) <> 22 then
    raise exception 'El CBU/CVU tiene que tener 22 números';
  end if;
  update talleres set
    alias_pago   = nullif(trim(p_alias), ''),
    cbu_pago     = v_cbu,
    titular_pago = nullif(trim(p_titular), '')
  where id = p_taller_id;
end $$;
