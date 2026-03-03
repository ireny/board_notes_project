alter table public.projects alter column owner_id set default auth.uid();
