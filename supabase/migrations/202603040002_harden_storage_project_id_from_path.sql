create or replace function public.storage_project_id_from_path(object_name text)
returns uuid
language plpgsql
stable
set search_path = public, pg_temp
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