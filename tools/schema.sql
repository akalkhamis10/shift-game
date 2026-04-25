-- shift-game: schema for sections, categories, questions, admins.
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE everywhere.

-- gen_random_uuid() lives in pgcrypto on Postgres < 13; on Supabase it's already available
-- via the "uuid-ossp" or "pgcrypto" extension. Make sure pgcrypto is on:
create extension if not exists pgcrypto;

-- Trigger function to bump updated_at on every UPDATE.
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ============ sections ============
create table if not exists sections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cover_url text,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists sections_updated_at on sections;
create trigger sections_updated_at
  before update on sections
  for each row execute function set_updated_at();

-- ============ categories ============
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references sections(id) on delete cascade,
  name text not null,
  emoji text,
  image_url text,
  cover_url text,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists categories_updated_at on categories;
create trigger categories_updated_at
  before update on categories
  for each row execute function set_updated_at();

create index if not exists categories_section_order
  on categories (section_id, order_index);

-- ============ questions ============
create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  difficulty text not null
    check (difficulty in ('easy','medium','hard')),
  prompt_text text not null,
  prompt_media_type text not null default 'none'
    check (prompt_media_type in ('none','image','video','audio')),
  prompt_media_url text,
  answer_text text not null,
  answer_media_type text not null default 'none'
    check (answer_media_type in ('none','image','video','audio')),
  answer_media_url text,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists questions_updated_at on questions;
create trigger questions_updated_at
  before update on questions
  for each row execute function set_updated_at();

create index if not exists questions_category_diff_order
  on questions (category_id, difficulty, order_index);

-- ============ admins ============
create table if not exists admins (
  email text primary key,
  role text not null default 'editor'
    check (role in ('owner','editor')),
  created_at timestamptz not null default now()
);
