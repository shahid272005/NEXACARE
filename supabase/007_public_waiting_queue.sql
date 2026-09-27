-- Safe, token-only waiting list for the ward display.
-- No patient names, identity data, or clinical information is exposed.

create or replace view public.public_waiting_queue
with (security_barrier = true, security_invoker = false) as
select
  t.id,
  t.token_number,
  t.estimated_wait_minutes,
  t.checked_in_at,
  d.name as department_name,
  d.code as department_code
from public.queue_tickets t
join public.departments d on d.id = t.department_id
where t.status = 'waiting'::public.ticket_status;

grant select on public.public_waiting_queue to anon, authenticated;
