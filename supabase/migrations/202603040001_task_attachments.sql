create table if not exists public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  uploaded_by uuid not null default auth.uid() references auth.users (id) on delete restrict,
  file_name text not null,
  mime_type text,
  file_size bigint not null check (file_size >= 0),
  bucket_path text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists task_attachments_project_id_idx on public.task_attachments (project_id);
create index if not exists task_attachments_task_id_idx on public.task_attachments (task_id);

alter table public.task_attachments enable row level security;

drop policy if exists task_attachments_select_access on public.task_attachments;
create policy task_attachments_select_access
on public.task_attachments
for select
using (public.can_access_project(project_id));

drop policy if exists task_attachments_insert_owner on public.task_attachments;
create policy task_attachments_insert_owner
on public.task_attachments
for insert
with check (public.is_project_owner(project_id));

drop policy if exists task_attachments_delete_owner on public.task_attachments;
create policy task_attachments_delete_owner
on public.task_attachments
for delete
using (public.is_project_owner(project_id));

create or replace function public.storage_project_id_from_path(object_name text)
returns uuid
language plpgsql
stable
as $$
declare
  project_text text;
begin
  project_text := split_part(coalesce(object_name, ''), '/', 1);

  if project_text = '' then
    return null;
  end if;

  return project_text::uuid;
exception
  when others then
    return null;
end;
$$;

insert into storage.buckets (id, name, public)
values ('task-attachments', 'task-attachments', false)
on conflict (id) do nothing;

drop policy if exists task_attachments_storage_select on storage.objects;
create policy task_attachments_storage_select
on storage.objects
for select
using (
  bucket_id = 'task-attachments'
  and public.can_access_project(public.storage_project_id_from_path(name))
);

drop policy if exists task_attachments_storage_insert on storage.objects;
create policy task_attachments_storage_insert
on storage.objects
for insert
with check (
  bucket_id = 'task-attachments'
  and public.is_project_owner(public.storage_project_id_from_path(name))
);

drop policy if exists task_attachments_storage_delete on storage.objects;
create policy task_attachments_storage_delete
on storage.objects
for delete
using (
  bucket_id = 'task-attachments'
  and public.is_project_owner(public.storage_project_id_from_path(name))
);