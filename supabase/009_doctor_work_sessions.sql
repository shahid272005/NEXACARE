-- Doctor availability and working-hours audit for the summit MVP.
-- Times are recorded in UTC; display them in the hospital's local time zone in production reports.

create table if not exists public.doctor_work_sessions (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);

create unique index if not exists one_open_shift_per_doctor
  on public.doctor_work_sessions (doctor_id) where ended_at is null;

alter table public.doctor_work_sessions enable row level security;
drop policy if exists "doctor reads own work sessions" on public.doctor_work_sessions;
drop policy if exists "admin reads all work sessions" on public.doctor_work_sessions;
create policy "doctor reads own work sessions" on public.doctor_work_sessions for select to authenticated using (
  exists (select 1 from public.doctor_profiles dp where dp.user_id = auth.uid() and dp.doctor_id = doctor_work_sessions.doctor_id)
);
create policy "admin reads all work sessions" on public.doctor_work_sessions for select to authenticated using (
  exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid())
);

create or replace function public.start_doctor_shift(p_doctor_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_doctor_assignment(p_doctor_id);
  update public.doctors set is_available = true where id = p_doctor_id;
  insert into public.doctor_work_sessions (doctor_id)
  values (p_doctor_id)
  on conflict (doctor_id) where ended_at is null do nothing;
end;
$$;

create or replace function public.end_doctor_shift(p_doctor_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_doctor_assignment(p_doctor_id);
  update public.doctors set is_available = false where id = p_doctor_id;
  update public.doctor_work_sessions set ended_at = now() where doctor_id = p_doctor_id and ended_at is null;
end;
$$;

create or replace function public.set_doctor_availability(p_doctor_id uuid, p_available boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_doctor_assignment(p_doctor_id);
  if p_available then perform public.start_doctor_shift(p_doctor_id); else perform public.end_doctor_shift(p_doctor_id); end if;
end;
$$;

revoke all on function public.start_doctor_shift(uuid) from public;
revoke all on function public.end_doctor_shift(uuid) from public;
revoke all on function public.set_doctor_availability(uuid, boolean) from public;
grant execute on function public.start_doctor_shift(uuid) to authenticated;
grant execute on function public.end_doctor_shift(uuid) to authenticated;
grant execute on function public.set_doctor_availability(uuid, boolean) to authenticated;
