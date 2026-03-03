create or replace function public.create_project(project_title text, project_description text default null)
returns public.projects
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  created_project public.projects;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.projects (title, description, owner_id)
  values (project_title, project_description, auth.uid())
  returning * into created_project;

  return created_project;
end;
$$;

grant execute on function public.create_project(text, text) to authenticated;
