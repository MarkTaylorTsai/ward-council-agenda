-- Branch meetings table and updated_at trigger

create table if not exists public.branch_meetings (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  time time not null,
  location text not null,
  host text not null,
  recorder text not null,
  purpose text not null,
  opening_prayer text not null,
  closing_prayer text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.trigger_set_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at on public.branch_meetings;
create trigger set_updated_at
before update on public.branch_meetings
for each row execute procedure public.trigger_set_timestamp();

-- Track LINE bot contacts (groups and users)
create table if not exists public.line_contacts (
  id uuid primary key default gen_random_uuid(),
  contact_id text not null unique, -- groupId or userId
  contact_type text not null check (contact_type in ('group', 'user')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- Update last_seen_at on conflict
create or replace function public.upsert_line_contact()
returns trigger as $$
begin
  insert into public.line_contacts (contact_id, contact_type, last_seen_at)
  values (NEW.contact_id, NEW.contact_type, now())
  on conflict (contact_id)
  do update set last_seen_at = now();
  return NEW;
end;
$$ language plpgsql;

