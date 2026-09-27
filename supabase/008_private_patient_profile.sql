-- Private, minimum-necessary demographic information for the authenticated doctor workspace.
-- This data is deliberately excluded from public_queue_calls and public_waiting_queue.
-- For production, populate it only from the approved hospital registration/eHospital flow.

alter table public.queue_tickets
  add column if not exists patient_age_years integer check (patient_age_years between 0 and 130),
  add column if not exists patient_weight_kg numeric(5,2) check (patient_weight_kg > 0 and patient_weight_kg < 500);

-- Existing summit tickets receive fictional demo profiles.
update public.queue_tickets
set patient_label = case token_number
  when 'GM-041' then 'Asha Devi (demo)'
  when 'GM-042' then 'Ravi Kumar (demo)'
  when 'OR-017' then 'Meena Patel (demo)'
  else patient_label
end,
patient_age_years = case token_number
  when 'GM-041' then 42
  when 'GM-042' then 58
  when 'OR-017' then 31
  else patient_age_years
end,
patient_weight_kg = case token_number
  when 'GM-041' then 61.50
  when 'GM-042' then null
  when 'OR-017' then 68.00
  else patient_weight_kg
end;

drop function if exists public.issue_demo_ticket(uuid, text, text);

create function public.issue_demo_ticket(
  p_department_id uuid,
  p_patient_label text,
  p_language_code text default 'en',
  p_patient_age_years integer default null,
  p_patient_weight_kg numeric default null
)
returns public.queue_tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_department public.departments;
  next_sequence integer;
  wait_count integer;
  new_ticket public.queue_tickets;
begin
  select * into selected_department from public.departments
  where id = p_department_id and is_open = true;
  if not found then raise exception 'This department is not currently available.'; end if;
  if p_patient_age_years is not null and (p_patient_age_years < 0 or p_patient_age_years > 130) then raise exception 'Age is outside the permitted range.'; end if;
  if p_patient_weight_kg is not null and (p_patient_weight_kg <= 0 or p_patient_weight_kg >= 500) then raise exception 'Weight is outside the permitted range.'; end if;
  perform pg_advisory_xact_lock(hashtext(selected_department.code));
  select coalesce(max(substring(token_number from '[0-9]+$')::integer), 0) + 1 into next_sequence from public.queue_tickets where department_id = selected_department.id;
  select count(*)::integer into wait_count from public.queue_tickets where department_id = selected_department.id and status in ('waiting'::public.ticket_status, 'called'::public.ticket_status);
  insert into public.queue_tickets (department_id, token_number, patient_label, patient_age_years, patient_weight_kg, language_code, status, estimated_wait_minutes)
  values (selected_department.id, selected_department.code || '-' || lpad(next_sequence::text, 3, '0'), left(trim(p_patient_label), 80), p_patient_age_years, p_patient_weight_kg, case when p_language_code in ('en', 'hi', 'kn') then p_language_code else 'en' end, 'waiting'::public.ticket_status, wait_count * selected_department.average_consultation_minutes)
  returning * into new_ticket;
  return new_ticket;
end;
$$;

grant execute on function public.issue_demo_ticket(uuid, text, text, integer, numeric) to anon, authenticated;
