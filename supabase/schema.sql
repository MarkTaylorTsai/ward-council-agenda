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

