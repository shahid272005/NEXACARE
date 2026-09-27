-- Run this after the enum error in the first schema execution.
-- It safely finishes only the rows that were not inserted.

insert into public.queue_tickets (department_id, token_number, patient_label, language_code, status, estimated_wait_minutes, checked_in_at)
select id, 'GM-041', 'Demo patient A', 'en', 'waiting'::public.ticket_status, 8, now() - interval '12 minutes'
from public.departments where code = 'GM'
on conflict (token_number) do nothing;

insert into public.queue_tickets (department_id, token_number, patient_label, language_code, status, estimated_wait_minutes, checked_in_at)
select id, 'GM-042', 'Demo patient B', 'hi', 'waiting'::public.ticket_status, 16, now() - interval '4 minutes'
from public.departments where code = 'GM'
on conflict (token_number) do nothing;

insert into public.queue_tickets (department_id, token_number, patient_label, language_code, status, estimated_wait_minutes, checked_in_at)
select id, 'OR-017', 'Demo patient C', 'en', 'waiting'::public.ticket_status, 10, now() - interval '7 minutes'
from public.departments where code = 'OR'
on conflict (token_number) do nothing;

insert into public.announcements (title, body, language_code, priority)
select 'Ayushman Bharat help desk', 'Ask the help desk about eligibility and enrolment support.', 'en', 1
where not exists (select 1 from public.announcements where title = 'Ayushman Bharat help desk' and language_code = 'en');

insert into public.announcements (title, body, language_code, priority)
select 'Visitor guidance', 'Please keep the waiting area clear and follow staff directions.', 'en', 0
where not exists (select 1 from public.announcements where title = 'Visitor guidance' and language_code = 'en');

insert into public.announcements (title, body, language_code, priority)
select 'सहायता डेस्क', 'योजना संबंधी सहायता के लिए सहायता डेस्क पर जाएँ।', 'hi', 1
where not exists (select 1 from public.announcements where title = 'सहायता डेस्क' and language_code = 'hi');
