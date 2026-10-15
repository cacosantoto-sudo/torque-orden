-- =====================================================================
-- Seguridad de los datos (15/10)
--  1. Subir de plan (Plata / Oro) lo hace solo el administrador del
--     sistema. Bajar de plan lo sigue pudiendo hacer cada dueño.
--  2. Nadie puede cambiarse el plan ni el rol (dueño/empleado) "por
--     afuera" de la app, aunque sepa programar.
--  3. Cheques e impuestos los ve solo el dueño (como la caja).
--  4. Fotos, firmas y logos: cada taller solo toca su propia carpeta.
--  5. Red de seguridad: toda tabla con taller_id que no tenga
--     protección queda limitada a su taller.
-- Correr UNA vez en Supabase > SQL Editor > New query > Run
-- (después de los SQL anteriores). Se puede volver a correr sin romper nada.
-- Al final muestra un control: copiá ese resultado y pegalo en el chat.
-- =====================================================================

-- ---------- 1. administrador del sistema ----------
create table if not exists public.admins_sistema (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  creado timestamptz not null default now()
);
alter table public.admins_sistema enable row level security;
-- (sin políticas: desde la app no se puede leer ni tocar)

-- La primera vez queda como administrador el usuario más antiguo del sistema
-- (el que creó todo). Si en el control de abajo no aparece TU correo, corré:
--   delete from public.admins_sistema;
--   insert into public.admins_sistema (usuario_id) select id from auth.users where email = 'tu@correo';
insert into public.admins_sistema (usuario_id)
  select id from auth.users
   where not exists (select 1 from public.admins_sistema)
   order by created_at limit 1;

create or replace function public.es_admin_sistema()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists(select 1 from admins_sistema where usuario_id = auth.uid())
$$;
revoke execute on function public.es_admin_sistema() from public, anon;
grant execute on function public.es_admin_sistema() to authenticated;

-- La app pregunta esto para saber si muestra los botones de "Pasar al plan…"
create or replace function public.soy_admin_sistema()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select es_admin_sistema()
$$;
revoke execute on function public.soy_admin_sistema() from public, anon;
grant execute on function public.soy_admin_sistema() to authenticated;

create or replace function public.nivel_plan(p text)
returns integer language sql immutable as $$
  select case p when 'oro' then 2 when 'pago' then 2 when 'plata' then 1 else 0 end
$$;

-- ---------- 2. cambiar de plan ----------
create or replace function public.cambiar_plan(p_taller_id uuid, p_plan text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_actual text;
begin
  if p_plan not in ('gratis', 'plata', 'oro') then
    raise exception 'Plan inválido: %', p_plan;
  end if;
  select plan into v_actual from talleres where id = p_taller_id;
  if not found then raise exception 'No existe ese taller'; end if;
  if not es_admin_sistema() then
    if not es_dueno(p_taller_id) then
      raise exception 'Solo el dueño del taller puede cambiar el plan';
    end if;
    if nivel_plan(p_plan) > nivel_plan(v_actual) then
      raise exception 'Los planes Plata y Oro los activa Torque & Orden';
    end if;
  end if;
  update talleres set plan = p_plan where id = p_taller_id;
end $$;
revoke execute on function public.cambiar_plan(uuid, text) from public, anon;
grant execute on function public.cambiar_plan(uuid, text) to authenticated;

-- ---------- 3. el plan y los roles no se tocan por afuera de la app ----------
-- "authenticated" / "anon" son los pedidos que llegan desde internet.
-- Las funciones de la base (crear_taller, cambiar_plan, invitar...) no pasan
-- por acá porque corren como el dueño de la base.
create or replace function public.trg_talleres_proteger_plan()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.plan := 'gratis';
    elsif new.plan is distinct from old.plan then
      raise exception 'El plan se cambia desde "Mi Plan"';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists talleres_proteger_plan on public.talleres;
create trigger talleres_proteger_plan before insert or update on public.talleres
  for each row execute function public.trg_talleres_proteger_plan();

create or replace function public.taller_sin_miembros(p_taller_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select not exists(select 1 from miembros where taller_id = p_taller_id)
$$;
revoke execute on function public.taller_sin_miembros(uuid) from public, anon;
grant execute on function public.taller_sin_miembros(uuid) to authenticated;

create or replace function public.trg_miembros_proteger()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      -- solo vale anotarse como dueño de un taller recién creado (sin nadie adentro)
      if new.usuario_id = auth.uid() and new.rol = 'dueno' and taller_sin_miembros(new.taller_id) then
        return new;
      end if;
      raise exception 'Para sumar a alguien al taller usá "Invitar empleado"';
    elsif tg_op = 'UPDATE' then
      raise exception 'Los roles del taller no se pueden cambiar así';
    else
      -- un empleado puede salirse; al resto lo saca el dueño desde la app
      if old.usuario_id = auth.uid() and old.rol <> 'dueno' then return old; end if;
      raise exception 'Para sacar a alguien del taller usá "Quitar"';
    end if;
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists miembros_proteger on public.miembros;
create trigger miembros_proteger before insert or update or delete on public.miembros
  for each row execute function public.trg_miembros_proteger();

-- ---------- 4. cheques e impuestos: solo el dueño ----------
drop policy if exists "solo mi taller" on public.cheques;
drop policy if exists "solo el dueño" on public.cheques;
create policy "solo el dueño" on public.cheques
  for all using (es_dueno(taller_id)) with check (es_dueno(taller_id));

drop policy if exists "solo mi taller" on public.impuestos;
drop policy if exists "solo el dueño" on public.impuestos;
create policy "solo el dueño" on public.impuestos
  for all using (es_dueno(taller_id)) with check (es_dueno(taller_id));

-- ---------- 5. carpetas de archivos: fotos (privada) y logos (pública) ----------
-- Se borran las reglas viejas de estas dos carpetas y se dejan unas nuevas:
-- cada taller solo puede subir, ver o borrar lo que está en su propia carpeta.
do $$
declare r record;
begin
  for r in select policyname from pg_policies
            where schemaname = 'storage' and tablename = 'objects'
              and (coalesce(qual, '') ~ '''(fotos|logos)''' or coalesce(with_check, '') ~ '''(fotos|logos)''')
  loop
    execute format('drop policy %I on storage.objects', r.policyname);
  end loop;
end $$;

insert into storage.buckets (id, name, public) values ('fotos', 'fotos', false)
  on conflict (id) do update set public = false;
insert into storage.buckets (id, name, public) values ('logos', 'logos', true)
  on conflict (id) do nothing;

create policy "fotos de mi taller" on storage.objects for all to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] in (select x::text from mis_talleres() as x))
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] in (select x::text from mis_talleres() as x));
create policy "logos de mi taller" on storage.objects for all to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] in (select x::text from mis_talleres() as x))
  with check (bucket_id = 'logos' and (storage.foldername(name))[1] in (select x::text from mis_talleres() as x));

-- ---------- 6. red de seguridad: tablas con taller_id sin protección ----------
do $$
declare r record;
begin
  for r in select c.relname from pg_class c
             join pg_namespace n on n.oid = c.relnamespace
             join information_schema.columns col
               on col.table_schema = 'public' and col.table_name = c.relname and col.column_name = 'taller_id'
            where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  loop
    execute format('alter table public.%I enable row level security', r.relname);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = r.relname) then
      execute format('create policy "solo mi taller" on public.%I for all using (taller_id in (select mis_talleres())) with check (taller_id in (select mis_talleres()))', r.relname);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';

-- ---------- control: copiá este resultado y pegalo en el chat ----------
select 1 as n, 'Administrador del sistema' as control,
       coalesce((select string_agg(u.email, ', ') from public.admins_sistema a join auth.users u on u.id = a.usuario_id), 'NINGUNO') as resultado
union all
select 2, 'Tablas sin protección',
       coalesce((select string_agg(c.relname, ', ' order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
                  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity), 'ninguna')
union all
select 3, 'Reglas abiertas a cualquiera',
       coalesce((select string_agg(tablename || ': ' || policyname || ' (' || cmd || ')', ', ' order by tablename) from pg_policies
                  where schemaname = 'public'
                    and (coalesce(qual, '') in ('true', '(true)') or coalesce(with_check, '') in ('true', '(true)') or 'anon' = any(roles))), 'ninguna')
union all
select 4, 'Reglas de cada tabla',
       (select string_agg(tablename || '[' || policyname || ']', ', ' order by tablename) from pg_policies where schemaname = 'public')
union all
select 5, 'Carpetas de archivos',
       (select string_agg(id || case when public then ' (pública)' else ' (privada)' end, ', ' order by id) from storage.buckets)
union all
select 6, 'Funciones que se pueden usar sin entrar',
       coalesce((select string_agg(p.proname, ', ' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')), 'ninguna')
union all
select 7, 'Correos sin confirmar (si es 0 puede estar apagada la confirmación)',
       (select count(*)::text from auth.users where email_confirmed_at is null)
order by 1;
