-- SmartCare Queue MVP: synthetic, non-clinical summit-demo data only.
-- Run once in Supabase Dashboard → SQL Editor → New query.

create extension if not exists pgcrypto;

create type public.ticket_status as enum (
  'waiting', 'called', 'in_consultation', 'completed', 'skipped'
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text not null unique,
  location text not null,
  average_consultation_minutes integer not null default 8 check (average_consultation_minutes between 1 and 60),
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  display_name text not null,
  room_label text not null,
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.queue_tickets (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id),
  doctor_id uuid references public.doctors(id),
  token_number text not null unique,
  -- This label is synthetic for the MVP. It must not be exposed on the public display.
  patient_label text not null,
  language_code text not null default 'en' check (language_code in ('en', 'hi', 'kn')),
  status public.ticket_status not null default 'waiting',
  estimated_wait_minutes integer not null default 0 check (estimated_wait_minutes >= 0),
  checked_in_at timestamptz not null default now(),
  called_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  language_code text not null default 'en' check (language_code in ('en', 'hi', 'kn')),
  priority integer not null default 0 check (priority between 0 and 3),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index queue_tickets_department_status_checkin_idx
  on public.queue_tickets (department_id, status, checked_in_at);
create index doctors_department_available_idx
  on public.doctors (department_id, is_available);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger queue_tickets_set_updated_at
before update on public.queue_tickets
for each row execute procedure public.set_updated_at();

-- Demo-only permissions: suitable only for synthetic data used in this MVP.
alter table public.departments enable row level security;
alter table public.doctors enable row level security;
alter table public.queue_tickets enable row level security;
alter table public.announcements enable row level security;

create policy "demo reads departments" on public.departments for select using (true);
create policy "demo reads doctors" on public.doctors for select using (true);
create policy "demo reads tickets" on public.queue_tickets for select using (true);
create policy "demo creates tickets" on public.queue_tickets for insert with check (true);
create policy "demo updates tickets" on public.queue_tickets for update using (true) with check (true);
create policy "demo reads announcements" on public.announcements for select using (true);

alter publication supabase_realtime add table public.queue_tickets;

-- Seed data: fictional departments, staff and patients; no diagnoses or contact details.
insert into public.departments (name, code, location, average_consultation_minutes) values
  ('General Medicine', 'GM', 'Ground Floor · Room 12', 8),
  ('Orthopaedics', 'OR', 'First Floor · Room 21', 10),
  ('Paediatrics', 'PD', 'Ground Floor · Room 8', 9);

insert into public.doctors (department_id, display_name, room_label, is_available)
select id, 'Dr. Meera Rao', 'Room 12', true from public.departments where code = 'GM'
union all
select id, 'Dr. Arjun Shah', 'Room 21', true from public.departments where code = 'OR'
union all
select id, 'Dr. Kavya Nair', 'Room 8', true from public.departments where code = 'PD';

insert into public.queue_tickets (department_id, token_number, patient_label, language_code, status, estimated_wait_minutes, checked_in_at)
select id, 'GM-041', 'Demo patient A', 'en', 'waiting'::public.ticket_status, 8, now() - interval '12 minutes' from public.departments where code = 'GM'
union all
select id, 'GM-042', 'Demo patient B', 'hi', 'waiting'::public.ticket_status, 16, now() - interval '4 minutes' from public.departments where code = 'GM'
union all
select id, 'OR-017', 'Demo patient C', 'en', 'waiting'::public.ticket_status, 10, now() - interval '7 minutes' from public.departments where code = 'OR';

insert into public.announcements (title, body, language_code, priority) values
  ('Ayushman Bharat help desk', 'Ask the help desk about eligibility and enrolment support.', 'en', 1),
  ('Visitor guidance', 'Please keep the waiting area clear and follow staff directions.', 'en', 0),
  ('सहायता डेस्क', 'योजना संबंधी सहायता के लिए सहायता डेस्क पर जाएँ।', 'hi', 1);
