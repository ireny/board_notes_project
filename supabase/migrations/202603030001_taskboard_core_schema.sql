create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  owner_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table if not exists public.project_stages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  position integer not null,
  created_at timestamptz not null default now(),
  unique (project_id, position),
  unique (project_id, id)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  stage_id uuid not null,
  title text not null,
  description_html text,
  order_position integer not null,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stage_id, order_position),
  constraint tasks_stage_fk
    foreign key (project_id, stage_id)
    references public.project_stages (project_id, id)
    on delete cascade
);

create index if not exists projects_owner_id_idx on public.projects (owner_id);
create index if not exists project_members_user_id_idx on public.project_members (user_id);
create index if not exists project_stages_project_id_idx on public.project_stages (project_id);
create index if not exists tasks_project_id_idx on public.tasks (project_id);
create index if not exists tasks_stage_id_idx on public.tasks (stage_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
before update on public.projects
for each row
execute function public.set_updated_at();

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();

alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_stages enable row level security;
alter table public.tasks enable row level security;

drop policy if exists projects_select_access on public.projects;
create policy projects_select_access
on public.projects
for select
using (
  owner_id = auth.uid()
  or exists (
    select 1
    from public.project_members pm
    where pm.project_id = projects.id
      and pm.user_id = auth.uid()
  )
);

drop policy if exists projects_insert_owner on public.projects;
create policy projects_insert_owner
on public.projects
for insert
with check (owner_id = auth.uid());

drop policy if exists projects_update_owner on public.projects;
create policy projects_update_owner
on public.projects
for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists projects_delete_owner on public.projects;
create policy projects_delete_owner
on public.projects
for delete
using (owner_id = auth.uid());

drop policy if exists project_members_select_access on public.project_members;
create policy project_members_select_access
on public.project_members
for select
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.projects p
    where p.id = project_members.project_id
      and p.owner_id = auth.uid()
  )
);

drop policy if exists project_members_insert_owner on public.project_members;
create policy project_members_insert_owner
on public.project_members
for insert
with check (
  exists (
    select 1
    from public.projects p
    where p.id = project_members.project_id
      and p.owner_id = auth.uid()
  )
);

drop policy if exists project_members_delete_owner on public.project_members;
create policy project_members_delete_owner
on public.project_members
for delete
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_members.project_id
      and p.owner_id = auth.uid()
  )
);

drop policy if exists project_stages_select_access on public.project_stages;
create policy project_stages_select_access
on public.project_stages
for select
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_stages.project_id
      and (
        p.owner_id = auth.uid()
        or exists (
          select 1
          from public.project_members pm
          where pm.project_id = p.id
            and pm.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists project_stages_insert_owner on public.project_stages;
create policy project_stages_insert_owner
on public.project_stages
for insert
with check (
  exists (
    select 1
    from public.projects p
    where p.id = project_stages.project_id
      and p.owner_id = auth.uid()
  )
);

drop policy if exists project_stages_update_owner on public.project_stages;
create policy project_stages_update_owner
on public.project_stages
for update
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_stages.project_id
      and p.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.projects p
    where p.id = project_stages.project_id
      and p.owner_id = auth.uid()
  )
);

drop policy if exists project_stages_delete_owner on public.project_stages;
create policy project_stages_delete_owner
on public.project_stages
for delete
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_stages.project_id
      and p.owner_id = auth.uid()
  )
);

drop policy if exists tasks_select_access on public.tasks;
create policy tasks_select_access
on public.tasks
for select
using (
  exists (
    select 1
    from public.projects p
    where p.id = tasks.project_id
      and (
        p.owner_id = auth.uid()
        or exists (
          select 1
          from public.project_members pm
          where pm.project_id = p.id
            and pm.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists tasks_insert_owner on public.tasks;
create policy tasks_insert_owner
on public.tasks
for insert
with check (
  exists (
    select 1
    from public.projects p
    where p.id = tasks.project_id
      and p.owner_id = auth.uid()
  )
);

drop policy if exists tasks_update_owner on public.tasks;
create policy tasks_update_owner
on public.tasks
for update
using (
  exists (
    select 1
    from public.projects p
    where p.id = tasks.project_id
      and p.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.projects p
    where p.id = tasks.project_id
      and p.owner_id = auth.uid()
  )
);

drop policy if exists tasks_delete_owner on public.tasks;
create policy tasks_delete_owner
on public.tasks
for delete
using (
  exists (
    select 1
    from public.projects p
    where p.id = tasks.project_id
      and p.owner_id = auth.uid()
  )
);