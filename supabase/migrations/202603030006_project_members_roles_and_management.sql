alter table if exists public.project_members
  add column if not exists role text not null default 'member';

alter table if exists public.project_members
  drop constraint if exists project_members_role_check;

alter table if exists public.project_members
  add constraint project_members_role_check
  check (role in ('member', 'editor', 'viewer'));

create index if not exists project_members_project_id_idx on public.project_members (project_id);

create or replace function public.is_project_owner(project_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = project_uuid
      and p.owner_id = auth.uid()
  );
$$;

create or replace function public.can_access_project(project_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = project_uuid
      and (
        p.owner_id = auth.uid()
        or exists (
          select 1
          from public.project_members pm
          where pm.project_id = p.id
            and pm.user_id = auth.uid()
        )
      )
  );
$$;

drop policy if exists projects_select_access on public.projects;
create policy projects_select_access
on public.projects
for select
using (public.can_access_project(id));

drop policy if exists project_members_select_access on public.project_members;
create policy project_members_select_access
on public.project_members
for select
using (public.can_access_project(project_id));

drop policy if exists project_members_insert_owner on public.project_members;
create policy project_members_insert_owner
on public.project_members
for insert
with check (public.is_project_owner(project_id));

drop policy if exists project_members_update_owner on public.project_members;
create policy project_members_update_owner
on public.project_members
for update
using (public.is_project_owner(project_id))
with check (public.is_project_owner(project_id));

drop policy if exists project_members_delete_owner on public.project_members;
create policy project_members_delete_owner
on public.project_members
for delete
using (public.is_project_owner(project_id));

drop policy if exists project_stages_select_access on public.project_stages;
create policy project_stages_select_access
on public.project_stages
for select
using (public.can_access_project(project_id));

drop policy if exists tasks_select_access on public.tasks;
create policy tasks_select_access
on public.tasks
for select
using (public.can_access_project(project_id));

create or replace function public.list_project_members(p_project_id uuid)
returns table (
  user_id uuid,
  user_email text,
  role text,
  created_at timestamptz,
  is_owner boolean
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_project_owner(p_project_id) then
    raise exception 'Only project owners can manage members';
  end if;

  return query
  select
    p.owner_id as user_id,
    coalesce(owner_user.email, '') as user_email,
    'owner'::text as role,
    p.created_at,
    true as is_owner
  from public.projects p
  left join auth.users owner_user on owner_user.id = p.owner_id
  where p.id = p_project_id

  union all

  select
    pm.user_id,
    coalesce(member_user.email, '') as user_email,
    pm.role,
    pm.created_at,
    false as is_owner
  from public.project_members pm
  join public.projects p on p.id = pm.project_id
  left join auth.users member_user on member_user.id = pm.user_id
  where pm.project_id = p_project_id
    and pm.user_id <> p.owner_id

  order by is_owner desc, created_at asc;
end;
$$;

create or replace function public.list_assignable_project_users(
  p_project_id uuid,
  p_search text default null
)
returns table (
  user_id uuid,
  user_email text
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  normalized_search text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_project_owner(p_project_id) then
    raise exception 'Only project owners can manage members';
  end if;

  normalized_search := nullif(trim(p_search), '');

  return query
  select
    u.id as user_id,
    coalesce(u.email, '') as user_email
  from auth.users u
  join public.projects p on p.id = p_project_id
  where u.email is not null
    and u.id <> p.owner_id
    and not exists (
      select 1
      from public.project_members pm
      where pm.project_id = p_project_id
        and pm.user_id = u.id
    )
    and (
      normalized_search is null
      or u.email ilike '%' || normalized_search || '%'
    )
  order by u.email asc
  limit 200;
end;
$$;

create or replace function public.add_project_member(
  p_project_id uuid,
  p_user_id uuid,
  p_role text default 'member'
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  owner_user_id uuid;
  normalized_role text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_project_owner(p_project_id) then
    raise exception 'Only project owners can manage members';
  end if;

  normalized_role := lower(trim(coalesce(p_role, 'member')));

  if normalized_role not in ('member', 'editor', 'viewer') then
    raise exception 'Invalid member role';
  end if;

  select p.owner_id into owner_user_id
  from public.projects p
  where p.id = p_project_id;

  if owner_user_id is null then
    raise exception 'Project not found';
  end if;

  if p_user_id = owner_user_id then
    raise exception 'Owner cannot be added as member';
  end if;

  insert into public.project_members (project_id, user_id, role)
  values (p_project_id, p_user_id, normalized_role)
  on conflict (project_id, user_id)
  do update set role = excluded.role;
end;
$$;

create or replace function public.update_project_member_role(
  p_project_id uuid,
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  owner_user_id uuid;
  normalized_role text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_project_owner(p_project_id) then
    raise exception 'Only project owners can manage members';
  end if;

  normalized_role := lower(trim(coalesce(p_role, 'member')));

  if normalized_role not in ('member', 'editor', 'viewer') then
    raise exception 'Invalid member role';
  end if;

  select p.owner_id into owner_user_id
  from public.projects p
  where p.id = p_project_id;

  if owner_user_id is null then
    raise exception 'Project not found';
  end if;

  if p_user_id = owner_user_id then
    raise exception 'Project owner role cannot be changed';
  end if;

  update public.project_members
  set role = normalized_role
  where project_id = p_project_id
    and user_id = p_user_id;

  if not found then
    raise exception 'Project member not found';
  end if;
end;
$$;

create or replace function public.remove_project_member(
  p_project_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  owner_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_project_owner(p_project_id) then
    raise exception 'Only project owners can manage members';
  end if;

  select p.owner_id into owner_user_id
  from public.projects p
  where p.id = p_project_id;

  if owner_user_id is null then
    raise exception 'Project not found';
  end if;

  if p_user_id = owner_user_id then
    raise exception 'Cannot remove project owner';
  end if;

  delete from public.project_members
  where project_id = p_project_id
    and user_id = p_user_id;
end;
$$;

grant execute on function public.list_project_members(uuid) to authenticated;
grant execute on function public.list_assignable_project_users(uuid, text) to authenticated;
grant execute on function public.add_project_member(uuid, uuid, text) to authenticated;
grant execute on function public.update_project_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.remove_project_member(uuid, uuid) to authenticated;
