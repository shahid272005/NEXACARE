-- Secure access baseline for the synthetic summit MVP.
-- Run after 005_doctor_auth.sql. Before using with real data, obtain a formal security review.

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_profiles enable row level security;
drop policy if exists "admin reads own profile" on public.admin_profiles;
create policy "admin reads own profile" on public.admin_profiles
  for select to authenticated using (user_id = auth.uid());

-- A public, token-only projection for TV/ward displays. It never exposes patient labels.
create or replace view public.public_queue_calls
with (security_barrier = true, security_invoker = false) as
select
  t.id,
  t.token_number,
  t.called_at,
  d.name as department_name,
  d.location,
  dr.room_label
from public.queue_tickets t
join public.departments d on d.id = t.department_id
left join public.doctors dr on dr.id = t.doctor_id
where t.status = 'called'::public.ticket_status;

grant select on public.public_queue_calls to anon, authenticated;

-- Public kiosk/display data: departments, announcements and the safe view only.
drop policy if exists "demo reads departments" on public.departments;
create policy "public reads departments" on public.departments for select using (true);
drop policy if exists "demo reads announcements" on public.announcements;
create policy "public reads announcements" on public.announcements for select using (true);

-- Doctors can read/update only their own roster record. Admins can read all operational staff records.
drop policy if exists "demo reads doctors" on public.doctors;
drop policy if exists "doctor reads own roster" on public.doctors;
drop policy if exists "doctor updates own roster" on public.doctors;
create policy "doctor reads own roster" on public.doctors for select to authenticated using (
  exists (select 1 from public.doctor_profiles dp where dp.user_id = auth.uid() and dp.doctor_id = doctors.id)
  or exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid())
);
create policy "doctor updates own roster" on public.doctors for update to authenticated using (
  exists (select 1 from public.doctor_profiles dp where dp.user_id = auth.uid() and dp.doctor_id = doctors.id)
  or exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid())
) with check (
  exists (select 1 from public.doctor_profiles dp where dp.user_id = auth.uid() and dp.doctor_id = doctors.id)
  or exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid())
);

-- Full tickets are private: the assigned doctor sees their department; admins see all.
drop policy if exists "demo reads tickets" on public.queue_tickets;
drop policy if exists "demo creates tickets" on public.queue_tickets;
drop policy if exists "demo updates tickets" on public.queue_tickets;
drop policy if exists "staff reads permitted queue" on public.queue_tickets;
create policy "staff reads permitted queue" on public.queue_tickets for select to authenticated using (
  exists (
    select 1 from public.doctor_profiles dp
    join public.doctors dr on dr.id = dp.doctor_id
    where dp.user_id = auth.uid() and dr.department_id = queue_tickets.department_id
  ) or exists (select 1 from public.admin_profiles ap where ap.user_id = auth.uid())
);

revoke all on public.queue_tickets from anon, authenticated;
grant select on public.queue_tickets to authenticated;
revoke all on public.doctors from anon;
grant select, update on public.doctors to authenticated;

-- Kiosk creation is allowed only through this server-owned function, not direct table writes.
alter function public.issue_demo_ticket(uuid, text, text) security definer;
alter function public.issue_demo_ticket(uuid, text, text) set search_path = '';
grant execute on function public.issue_demo_ticket(uuid, text, text) to anon, authenticated;

create or replace function public.assert_doctor_assignment(p_doctor_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.doctor_profiles
    where user_id = auth.uid() and doctor_id = p_doctor_id
  ) then
    raise exception 'This account is not assigned to the requested doctor workspace.';
  end if;
end;
$$;

create or replace function public.assert_admin_assignment()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.admin_profiles where user_id = auth.uid()) then
    raise exception 'This account is not assigned to the administrator workspace.';
  end if;
end;
$$;

create or replace function public.call_next_demo_ticket(p_doctor_id uuid)
returns public.queue_tickets language plpgsql security definer set search_path = '' as $$
declare selected_doctor public.doctors; next_ticket public.queue_tickets;
begin
  perform public.assert_doctor_assignment(p_doctor_id);
  select * into selected_doctor from public.doctors where id = p_doctor_id and is_available = true;
  if not found then raise exception 'This doctor is not currently available.'; end if;
  perform pg_advisory_xact_lock(hashtext(selected_doctor.department_id::text));
  if exists (select 1 from public.queue_tickets where doctor_id = selected_doctor.id and status in ('called'::public.ticket_status, 'in_consultation'::public.ticket_status)) then raise exception 'Complete the current consultation before calling another patient.'; end if;
  select * into next_ticket from public.queue_tickets where department_id = selected_doctor.department_id and status = 'waiting'::public.ticket_status order by checked_in_at limit 1 for update skip locked;
  if not found then raise exception 'There are no patients waiting in this department.'; end if;
  update public.queue_tickets set doctor_id = selected_doctor.id, status = 'called'::public.ticket_status, called_at = now() where id = next_ticket.id returning * into next_ticket;
  return next_ticket;
end;
$$;

create or replace function public.complete_demo_ticket(p_doctor_id uuid)
returns public.queue_tickets language plpgsql security definer set search_path = '' as $$
declare completed_ticket public.queue_tickets;
begin
  perform public.assert_doctor_assignment(p_doctor_id);
  update public.queue_tickets set status = 'completed'::public.ticket_status, completed_at = now()
  where id = (select id from public.queue_tickets where doctor_id = p_doctor_id and status in ('called'::public.ticket_status, 'in_consultation'::public.ticket_status) order by called_at desc limit 1)
  returning * into completed_ticket;
  if not found then raise exception 'There is no active consultation to complete.'; end if;
  return completed_ticket;
end;
$$;

revoke all on function public.call_next_demo_ticket(uuid) from public;
revoke all on function public.complete_demo_ticket(uuid) from public;
grant execute on function public.call_next_demo_ticket(uuid) to authenticated;
grant execute on function public.complete_demo_ticket(uuid) to authenticated;

create or replace function public.reset_synthetic_demo_queue()
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_admin_assignment();
  delete from public.queue_tickets;
  insert into public.queue_tickets (department_id, token_number, patient_label, language_code, status, estimated_wait_minutes, checked_in_at)
  select id, 'GM-041', 'Demo patient A', 'en', 'waiting'::public.ticket_status, 8, now() - interval '12 minutes' from public.departments where code = 'GM';
  insert into public.queue_tickets (department_id, token_number, patient_label, language_code, status, estimated_wait_minutes, checked_in_at)
  select id, 'GM-042', 'Demo patient B', 'hi', 'waiting'::public.ticket_status, 16, now() - interval '4 minutes' from public.departments where code = 'GM';
  insert into public.queue_tickets (department_id, token_number, patient_label, language_code, status, estimated_wait_minutes, checked_in_at)
  select id, 'OR-017', 'Demo patient C', 'en', 'waiting'::public.ticket_status, 10, now() - interval '7 minutes' from public.departments where code = 'OR';
end;
$$;
revoke all on function public.reset_synthetic_demo_queue() from public;
grant execute on function public.reset_synthetic_demo_queue() to authenticated;

-- After creating an administrator in Authentication → Users, run once with that email:
-- insert into public.admin_profiles (user_id)
-- select id from auth.users where email = 'YOUR_ADMIN_EMAIL'
-- on conflict (user_id) do nothing;
