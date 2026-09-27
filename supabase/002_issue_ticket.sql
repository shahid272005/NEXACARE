-- P0 kiosk action. Run once in Supabase SQL Editor before testing /kiosk.
-- It safely creates a sequential, department-specific synthetic demo token.

create or replace function public.issue_demo_ticket(
  p_department_id uuid,
  p_patient_label text,
  p_language_code text default 'en'
)
returns public.queue_tickets
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_department public.departments;
  next_sequence integer;
  wait_count integer;
  new_ticket public.queue_tickets;
begin
  select * into selected_department
  from public.departments
  where id = p_department_id and is_open = true;

  if not found then
    raise exception 'This department is not currently available.';
  end if;

  -- Prevent two simultaneous kiosks from issuing the same token number.
  perform pg_advisory_xact_lock(hashtext(selected_department.code));

  select coalesce(max(substring(token_number from '[0-9]+$')::integer), 0) + 1
  into next_sequence
  from public.queue_tickets
  where department_id = selected_department.id;

  select count(*)::integer into wait_count
  from public.queue_tickets
  where department_id = selected_department.id
    and status in ('waiting'::public.ticket_status, 'called'::public.ticket_status);

  insert into public.queue_tickets (
    department_id, token_number, patient_label, language_code, status, estimated_wait_minutes
  ) values (
    selected_department.id,
    selected_department.code || '-' || lpad(next_sequence::text, 3, '0'),
    left(trim(p_patient_label), 40),
    case when p_language_code in ('en', 'hi', 'kn') then p_language_code else 'en' end,
    'waiting'::public.ticket_status,
    wait_count * selected_department.average_consultation_minutes
  ) returning * into new_ticket;

  return new_ticket;
end;
$$;

grant execute on function public.issue_demo_ticket(uuid, text, text) to anon, authenticated;
