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
    p.owner_id::uuid as user_id,
    coalesce(owner_user.email, '')::text as user_email,
    'owner'::text as role,
    p.created_at::timestamptz as created_at,
    true::boolean as is_owner
  from public.projects p
  left join auth.users owner_user on owner_user.id = p.owner_id
  where p.id = p_project_id

  union all

  select
    pm.user_id::uuid as user_id,
    coalesce(member_user.email, '')::text as user_email,
    pm.role::text as role,
    pm.created_at::timestamptz as created_at,
    false::boolean as is_owner
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
    u.id::uuid as user_id,
    coalesce(u.email, '')::text as user_email
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
