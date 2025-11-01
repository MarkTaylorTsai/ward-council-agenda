-- Branch meetings table and updated_at trigger

create table if not exists public.branch_meetings (
  id serial primary key,
  date date not null,
  time time not null,
  location text not null,
  host text not null,
  recorder text not null,
  purpose text not null,
  opening_prayer text not null,
  closing_prayer text not null,
  follow_up_items text, -- 上次會議事項追蹤
  discussion_topics text, -- 討論主題
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

-- Track conversation state for follow-up questions
create table if not exists public.conversation_states (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  meeting_id integer references public.branch_meetings(id) on delete cascade,
  waiting_for text not null check (waiting_for in ('follow_up_items', 'discussion_topics')),
  created_at timestamptz not null default now()
);

-- Clean up old conversation states (older than 1 hour)
create or replace function public.cleanup_old_states()
returns void as $$
begin
  delete from public.conversation_states
  where created_at < now() - interval '1 hour';
end;
$$ language plpgsql;

-- Create index on user_id for faster lookups
create index if not exists idx_conversation_states_user_id on public.conversation_states(user_id);
create index if not exists idx_conversation_states_created_at on public.conversation_states(created_at);

