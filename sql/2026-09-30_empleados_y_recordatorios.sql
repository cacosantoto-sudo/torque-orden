-- =====================================================================
-- Empleados con usuario propio + recordatorios compartidos
-- Correr UNA vez en Supabase > SQL Editor > New query > Run.
-- Se puede volver a correr sin romper nada (usa "if not exists" / "or replace").
-- =====================================================================

-- ---------- ayudante: ¿el usuario actual es dueño de este taller? ----------
create or replace function public.es_dueno(p_taller_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists(select 1 from miembros
                where taller_id = p_taller_id and usuario_id = auth.uid() and rol = 'dueno')
$$;

-- ---------- invitaciones pendientes ----------
create table if not exists public.invitaciones (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres(id) on delete cascade,
  email text not null,
  rol text not null default 'empleado',
  creado timestamptz not null default now(),
  unique (taller_id, email)
);
alter table public.invitaciones enable row level security;
drop policy if exists "ver invitaciones de mi taller" on public.invitaciones;
create policy "ver invitaciones de mi taller" on public.invitaciones
  for select using (taller_id in (select mis_talleres()));
-- (no hay políticas de alta/baja: solo se tocan con las funciones de abajo)

-- El dueño invita a un empleado por su correo.
create or replace function public.invitar_empleado(p_taller_id uuid, p_email text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_email text := lower(trim(p_email));
begin
  if not es_dueno(p_taller_id) then raise exception 'Solo el dueño puede invitar empleados'; end if;
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Correo inválido'; end if;
  if exists(select 1 from miembros mi join auth.users u on u.id = mi.usuario_id
            where mi.taller_id = p_taller_id and lower(u.email) = v_email) then
    raise exception 'Esa persona ya es parte del taller';
  end if;
  insert into invitaciones (taller_id, email) values (p_taller_id, v_email)
  on conflict (taller_id, email) do nothing;
end $$;

-- El dueño cancela una invitación que todavía no se usó.
create or replace function public.cancelar_invitacion(p_taller_id uuid, p_email text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not es_dueno(p_taller_id) then raise exception 'Solo el dueño puede hacer esto'; end if;
  delete from invitaciones where taller_id = p_taller_id and email = lower(trim(p_email));
end $$;

-- Al entrar, el empleado queda sumado a los talleres que lo invitaron.
-- Solo con correo confirmado, para que nadie se registre con un correo ajeno.
create or replace function public.aceptar_invitaciones()
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_email text; v_n integer;
begin
  select lower(email) into v_email from auth.users
   where id = auth.uid() and email_confirmed_at is not null;
  if v_email is null then return 0; end if;
  insert into miembros (taller_id, usuario_id, rol)
    select i.taller_id, auth.uid(), i.rol from invitaciones i
     where i.email = v_email
       and not exists(select 1 from miembros m where m.taller_id = i.taller_id and m.usuario_id = auth.uid());
  get diagnostics v_n = row_count;
  delete from invitaciones where email = v_email;
  return v_n;
end $$;

-- Lista del equipo (miembros + invitaciones pendientes), con correos.
create or replace function public.equipo_del_taller(p_taller_id uuid)
returns table(usuario_id uuid, email text, rol text, pendiente boolean)
language sql stable security definer set search_path to 'public' as $$
  select * from (
  select m.usuario_id, u.email::text as email, m.rol, false as pendiente
    from miembros m join auth.users u on u.id = m.usuario_id
   where m.taller_id = p_taller_id and p_taller_id in (select mis_talleres())
  union all
  select null, i.email, i.rol, true
    from invitaciones i
   where i.taller_id = p_taller_id and p_taller_id in (select mis_talleres())
  ) e order by e.pendiente, (e.rol = 'dueno') desc, e.email
$$;

-- El dueño saca a un empleado (no se puede sacar al dueño).
create or replace function public.quitar_empleado(p_taller_id uuid, p_usuario_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not es_dueno(p_taller_id) then raise exception 'Solo el dueño puede hacer esto'; end if;
  delete from miembros where taller_id = p_taller_id and usuario_id = p_usuario_id and rol <> 'dueno';
end $$;

-- ---------- la Caja la ve solo el dueño ----------
drop policy if exists "solo mi taller" on public.movimientos_caja;
drop policy if exists "solo el dueño" on public.movimientos_caja;
create policy "solo el dueño" on public.movimientos_caja
  for all using (es_dueno(taller_id)) with check (es_dueno(taller_id));

-- ---------- recordatorios de mantenimiento compartidos ----------
alter table public.talleres add column if not exists recordatorio_meses integer;
alter table public.clientes add column if not exists recordatorio_orden_id uuid;

create or replace function public.configurar_recordatorio(p_taller_id uuid, p_meses integer)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not es_dueno(p_taller_id) then raise exception 'Solo el dueño puede cambiar este ajuste'; end if;
  if p_meses is null or p_meses < 1 or p_meses > 36 then raise exception 'Elegí entre 1 y 36 meses'; end if;
  update talleres set recordatorio_meses = p_meses where id = p_taller_id;
end $$;
