create or replace function public.set_project_owner_from_auth()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required to create projects';
  end if;

  new.owner_id = auth.uid();
  return new;
end;
$$;

drop trigger if exists projects_set_owner_id on public.projects;
create trigger projects_set_owner_id
before insert on public.projects
for each row
execute function public.set_project_owner_from_auth();

drop policy if exists projects_insert_owner on public.projects;
create policy projects_insert_owner
on public.projects
for insert
with check (auth.uid() is not null);
