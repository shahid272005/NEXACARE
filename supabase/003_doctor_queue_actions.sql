-- P0 doctor controls. Run once in Supabase SQL Editor before testing /doctor.
-- These are operational queue actions only; they do not record clinical information.

create or replace function public.call_next_demo_ticket(p_doctor_id uuid)
returns public.queue_tickets
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_doctor public.doctors;
  next_ticket public.queue_tickets;
begin
  select * into selected_doctor
  from public.doctors
  where id = p_doctor_id and is_available = true;

  if not found then
    raise exception 'This doctor is not currently available.';
  end if;

  perform pg_advisory_xact_lock(hashtext(selected_doctor.department_id::text));

  if exists (
    select 1 from public.queue_tickets
    where doctor_id = selected_doctor.id
      and status in ('called'::public.ticket_status, 'in_consultation'::public.ticket_status)
  ) then
    raise exception 'Complete the current consultation before calling another patient.';
  end if;

  select * into next_ticket
  from public.queue_tickets
  where department_id = selected_doctor.department_id and status = 'waiting'::public.ticket_status
  order by checked_in_at asc
  limit 1
  for update skip locked;

  if not found then
    raise exception 'There are no patients waiting in this department.';
  end if;

  update public.queue_tickets
  set doctor_id = selected_doctor.id, status = 'called'::public.ticket_status, called_at = now()
  where id = next_ticket.id
  returning * into next_ticket;

  return next_ticket;
end;
$$;

create or replace function public.complete_demo_ticket(p_doctor_id uuid)
returns public.queue_tickets
language plpgsql
security invoker
set search_path = ''
as $$
declare
  completed_ticket public.queue_tickets;
begin
  update public.queue_tickets
  set status = 'completed'::public.ticket_status, completed_at = now()
  where id = (
    select id from public.queue_tickets
    where doctor_id = p_doctor_id
      and status in ('called'::public.ticket_status, 'in_consultation'::public.ticket_status)
    order by called_at desc
    limit 1
  )
  returning * into completed_ticket;

  if not found then
    raise exception 'There is no active consultation to complete.';
  end if;

  return completed_ticket;
end;
$$;

grant execute on function public.call_next_demo_ticket(uuid) to anon, authenticated;
grant execute on function public.complete_demo_ticket(uuid) to anon, authenticated;
