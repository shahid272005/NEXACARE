-- Summit-demo reset only. This deletes and recreates SYNTHETIC queue tickets.
-- Do not use this function with real hospital data.

create or replace function public.reset_synthetic_demo_queue()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.queue_tickets;

  insert into public.queue_tickets (department_id, token_number, patient_label, language_code, status, estimated_wait_minutes, checked_in_at)
  select id, 'GM-041', 'Demo patient A', 'en', 'waiting'::public.ticket_status, 8, now() - interval '12 minutes'
  from public.departments where code = 'GM';

  insert into public.queue_tickets (department_id, token_number, patient_label, language_code, status, estimated_wait_minutes, checked_in_at)
  select id, 'GM-042', 'Demo patient B', 'hi', 'waiting'::public.ticket_status, 16, now() - interval '4 minutes'
  from public.departments where code = 'GM';

  insert into public.queue_tickets (department_id, token_number, patient_label, language_code, status, estimated_wait_minutes, checked_in_at)
  select id, 'OR-017', 'Demo patient C', 'en', 'waiting'::public.ticket_status, 10, now() - interval '7 minutes'
  from public.departments where code = 'OR';
end;
$$;

grant execute on function public.reset_synthetic_demo_queue() to anon, authenticated;
