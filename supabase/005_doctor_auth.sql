-- Doctor sign-in mapping for the summit MVP.
-- First create each doctor account in Supabase Dashboard → Authentication → Users.
-- Then run the final INSERT below once per doctor, replacing the email address.

create table if not exists public.doctor_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  doctor_id uuid not null unique references public.doctors(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.doctor_profiles enable row level security;

drop policy if exists "doctor reads own profile" on public.doctor_profiles;

create policy "doctor reads own profile"
on public.doctor_profiles for select
to authenticated
using (user_id = auth.uid());

-- Example: assign a Supabase Auth user to a seeded doctor.
-- Change doctor.meera@smartcare.demo to the email you created, then run this query.
-- insert into public.doctor_profiles (user_id, doctor_id)
-- select u.id, d.id
-- from auth.users u
-- cross join public.doctors d
-- where u.email = 'doctor.meera@smartcare.demo'
--   and d.display_name = 'Dr. Meera Rao';

-- The current summit database intentionally contains synthetic data and open demo policies.
-- Before processing real patient data, replace those policies with role-specific RLS,
-- server-side actions, audit logs, and a formal hospital security review.
