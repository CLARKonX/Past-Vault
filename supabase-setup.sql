-- Run this once after creating the four PastVault tables and enabling RLS.
-- It stores the Auth email on each profile and creates student profiles
-- atomically when Supabase Auth creates a user.

alter table public.profiles
  add column if not exists email text;

alter table public.resources
  add column if not exists content_type text;

create unique index if not exists profiles_email_unique
  on public.profiles (lower(email))
  where email is not null;

update public.profiles p
set email = lower(u.email)
from auth.users u
where u.id = p.id
  and p.email is null;

create or replace function public.create_pastvault_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    matric_number,
    department_id,
    role
  )
  values (
    new.id,
    lower(new.email),
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'matric_number',
    (new.raw_user_meta_data ->> 'department_id')::uuid,
    'student'
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_pastvault on auth.users;

create trigger on_auth_user_created_pastvault
  after insert on auth.users
  for each row execute function public.create_pastvault_profile();
