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
using (
  user_id = auth.uid()
  or public.is_project_owner(project_id)
);

drop policy if exists project_members_insert_owner on public.project_members;
create policy project_members_insert_owner
on public.project_members
for insert
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

drop policy if exists project_stages_insert_owner on public.project_stages;
create policy project_stages_insert_owner
on public.project_stages
for insert
with check (public.is_project_owner(project_id));

drop policy if exists project_stages_update_owner on public.project_stages;
create policy project_stages_update_owner
on public.project_stages
for update
using (public.is_project_owner(project_id))
with check (public.is_project_owner(project_id));

drop policy if exists project_stages_delete_owner on public.project_stages;
create policy project_stages_delete_owner
on public.project_stages
for delete
using (public.is_project_owner(project_id));

drop policy if exists tasks_select_access on public.tasks;
create policy tasks_select_access
on public.tasks
for select
using (public.can_access_project(project_id));

drop policy if exists tasks_insert_owner on public.tasks;
create policy tasks_insert_owner
on public.tasks
for insert
with check (public.is_project_owner(project_id));

drop policy if exists tasks_update_owner on public.tasks;
create policy tasks_update_owner
on public.tasks
for update
using (public.is_project_owner(project_id))
with check (public.is_project_owner(project_id));

drop policy if exists tasks_delete_owner on public.tasks;
create policy tasks_delete_owner
on public.tasks
for delete
using (public.is_project_owner(project_id));