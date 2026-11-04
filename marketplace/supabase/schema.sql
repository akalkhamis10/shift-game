-- مَرسم — production schema for Supabase (Postgres).
-- The demo app runs on localStorage; this file is the target backend.
-- Rule of thumb: clients may READ broadly and WRITE their own rows, but every
-- money movement (escrow, payout, refund, fee) happens ONLY inside the
-- security-definer functions at the bottom, never from the browser.

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------ enums
create type user_role      as enum ('client', 'artist', 'admin');
create type contest_status as enum ('open', 'completed', 'refunded');      -- "judging" is derived: open && now() > deadline
create type entry_status   as enum ('active', 'eliminated', 'withdrawn');
create type hire_status    as enum ('requested', 'active', 'delivered', 'revision', 'approved', 'declined');
create type tx_type        as enum ('escrow', 'release', 'refund', 'payout', 'withdrawal', 'fee');

-- ------------------------------------------------------------------ tables
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        user_role not null default 'client',
  name        text not null check (char_length(name) between 2 and 80),
  company     text,
  bio         text default '',
  country     text default '',
  tools       text[] not null default '{}',
  level       text check (level in ('new', 'mid', 'pro', 'top')),
  balance     numeric(12,2) not null default 0,   -- written only by functions below
  created_at  timestamptz not null default now()
);

create table contests (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references profiles(id),
  title           text not null check (char_length(title) >= 6),
  brand           text,
  category        text not null,
  brief           text not null check (char_length(brief) >= 30),
  audience        text default '',
  styles          text[] not null default '{}',
  colors          text default '',
  usage           text default '',
  avoid           text default '',
  package         text not null check (package in ('bronze', 'silver', 'gold', 'platinum')),
  prize           numeric(12,2) not null,
  price           numeric(12,2) not null,
  guaranteed      boolean not null default false,
  blind           boolean not null default false,
  featured        boolean not null default false,
  status          contest_status not null default 'open',
  deadline        timestamptz not null,
  finalists       uuid[] not null default '{}',
  winner_entry_id uuid,
  payment_ref     text,             -- payment-gateway charge id (Moyasar / Tap / HyperPay)
  created_at      timestamptz not null default now(),
  completed_at    timestamptz
);

create table entries (
  id          uuid primary key default gen_random_uuid(),
  contest_id  uuid not null references contests(id) on delete cascade,
  artist_id   uuid not null references profiles(id),
  number      int not null default 0,  -- assigned by trigger
  image_path  text not null,          -- storage path in bucket "entries"
  title       text default '',
  tool        text not null,          -- mandatory AI-tool disclosure
  prompt      text default '',        -- private: artist + (client once winner)
  note        text default '',
  rating      smallint not null default 0 check (rating between 0 and 5),
  status      entry_status not null default 'active',
  created_at  timestamptz not null default now(),
  unique (contest_id, number)
);
alter table contests add constraint contests_winner_fk foreign key (winner_entry_id) references entries(id);

create table comments (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid references entries(id) on delete cascade,
  hire_id     uuid,
  user_id     uuid not null references profiles(id),
  text        text not null check (char_length(text) between 1 and 1000),
  created_at  timestamptz not null default now(),
  check ((entry_id is null) <> (hire_id is null))
);

create table hires (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references profiles(id),
  artist_id    uuid not null references profiles(id),
  title        text not null,
  brief        text not null,
  budget       numeric(12,2) not null check (budget >= 200),
  days         int not null default 5,
  status       hire_status not null default 'requested',
  delivery     jsonb,                 -- {image_path, note, prompt, tool, at}
  revisions    int not null default 0,
  payment_ref  text,
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  approved_at  timestamptz
);
alter table comments add constraint comments_hire_fk foreign key (hire_id) references hires(id) on delete cascade;

create table reviews (
  id          uuid primary key default gen_random_uuid(),
  artist_id   uuid not null references profiles(id),
  client_id   uuid not null references profiles(id),
  contest_id  uuid references contests(id),
  hire_id     uuid references hires(id),
  stars       smallint not null check (stars between 1 and 5),
  text        text default '',
  created_at  timestamptz not null default now()
);

create table transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id),   -- null = platform
  type        tx_type not null,
  amount      numeric(12,2) not null check (amount >= 0),
  contest_id  uuid references contests(id),
  hire_id     uuid references hires(id),
  note        text default '',
  created_at  timestamptz not null default now()
);

create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  text        text not null,
  link        text default '',
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index on entries (contest_id);
create index on entries (artist_id);
create index on contests (status, deadline);
create index on notifications (user_id, read);
create index on transactions (user_id);

-- ------------------------------------------------------------------ helpers
create or replace function is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- ------------------------------------------------------------------ RLS
alter table profiles      enable row level security;
alter table contests      enable row level security;
alter table entries       enable row level security;
alter table comments      enable row level security;
alter table hires         enable row level security;
alter table reviews       enable row level security;
alter table transactions  enable row level security;
alter table notifications enable row level security;

-- profiles: public read; users edit their own non-financial fields
create policy profiles_read on profiles for select using (true);
create policy profiles_insert on profiles for insert with check (id = auth.uid() and role in ('client', 'artist') and balance = 0 and level is null);
create policy profiles_update on profiles for update using (id = auth.uid()) with check (id = auth.uid());
-- column grants: role / balance / level can never be changed from the browser
revoke update on profiles from anon, authenticated;
grant update (name, company, bio, country, tools) on profiles to authenticated;

-- contests: public read; created via launch_contest() after payment; owner edits brief while open
create policy contests_read on contests for select using (true);
create policy contests_owner_update on contests for update
  using (client_id = auth.uid() and status = 'open' and winner_entry_id is null)
  with check (client_id = auth.uid());
-- owners may edit the brief, the shortlist and the deadline (extend / close early) — never prize, price or status
revoke update on contests from anon, authenticated;
grant update (brief, audience, colors, usage, avoid, finalists, deadline) on contests to authenticated;

-- entries: blind contests hide rivals' work until completion
create policy entries_read on entries for select using (
  status <> 'withdrawn' and (
    artist_id = auth.uid() or is_admin()
    or exists (select 1 from contests c where c.id = contest_id and (c.client_id = auth.uid() or not c.blind or c.status = 'completed'))
  )
);
create policy entries_insert on entries for insert with check (
  artist_id = auth.uid()
  and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'artist')
  and exists (select 1 from contests c where c.id = contest_id and c.status = 'open' and c.deadline > now() and c.client_id <> auth.uid())
);
-- A policy on entries can't query entries (Postgres: infinite recursion), so the per-artist limit and the
-- sequential entry number live in a security-definer trigger instead.
create or replace function entries_before_insert() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform 1 from contests where id = new.contest_id for update;   -- serialize numbering per contest
  if (select count(*) from entries where contest_id = new.contest_id and artist_id = new.artist_id and status = 'active') >= 5 then
    raise exception 'max 5 active entries per artist in a contest';
  end if;
  new.number := coalesce((select max(number) from entries where contest_id = new.contest_id), 0) + 1;
  new.rating := 0;
  new.status := 'active';
  return new;
end $$;
create trigger entries_bi before insert on entries for each row execute function entries_before_insert();
-- artist may withdraw own entry; owner may rate / eliminate (columns enforced in a trigger below)
create policy entries_update on entries for update using (
  artist_id = auth.uid()
  or exists (select 1 from contests c where c.id = contest_id and c.client_id = auth.uid() and c.status = 'open')
);

-- The prompt column is private. Browsers can't select it from the table; they read entries_public,
-- which runs with the owner's rights, so it re-applies the entries_read visibility rule in its WHERE
-- and reveals the prompt only to the artist, an admin, or the client once that entry has won.
revoke select on entries from anon, authenticated;
grant select (id, contest_id, artist_id, number, image_path, title, tool, note, rating, status, created_at) on entries to anon, authenticated;
create or replace view entries_public as
  select e.id, e.contest_id, e.artist_id, e.number, e.image_path, e.title, e.tool, e.note, e.rating, e.status, e.created_at,
         case when e.artist_id = auth.uid() or is_admin() or (c.client_id = auth.uid() and c.winner_entry_id = e.id)
              then e.prompt end as prompt
  from entries e join contests c on c.id = e.contest_id
  where e.status <> 'withdrawn'
    and (e.artist_id = auth.uid() or is_admin() or c.client_id = auth.uid() or not c.blind or c.status = 'completed');
revoke all on entries_public from anon, authenticated;
grant select on entries_public to anon, authenticated;
revoke update on entries from anon, authenticated;
grant update (rating, status) on entries to authenticated;

create or replace function guard_entry_update() returns trigger language plpgsql as $$
begin
  -- column grants already limit browsers to (rating, status); this enforces who may set what
  if is_admin() then return new; end if;
  if auth.uid() = old.artist_id then
    if new.rating <> old.rating or (new.status <> old.status and new.status <> 'withdrawn') then
      raise exception 'artists may only withdraw';
    end if;
    if exists (select 1 from contests c where c.id = old.contest_id and c.winner_entry_id = old.id) then
      raise exception 'cannot withdraw a winning entry';
    end if;
  elsif new.status = 'withdrawn' then
    raise exception 'clients may only rate or eliminate';
  end if;
  return new;
end $$;
create trigger entries_guard before update on entries for each row execute function guard_entry_update();

-- comments: private between the contest owner and the entry's artist (or the two hire parties)
create policy comments_rw on comments for all using (
  is_admin()
  or exists (select 1 from entries e join contests c on c.id = e.contest_id where e.id = entry_id and auth.uid() in (e.artist_id, c.client_id))
  or exists (select 1 from hires h where h.id = hire_id and auth.uid() in (h.client_id, h.artist_id))
) with check (user_id = auth.uid());

create policy hires_read on hires for select using (auth.uid() in (client_id, artist_id) or is_admin());
create policy reviews_read on reviews for select using (true);
create policy tx_read on transactions for select using (user_id = auth.uid() or is_admin());
create policy notif_read on notifications for select using (user_id = auth.uid());
create policy notif_update on notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
-- (no insert/update policies on hires/reviews/transactions: functions only)

-- ------------------------------------------------------------------ money-moving functions
-- launch_contest is called by the payment webhook (service role) after the gateway confirms the charge.
create or replace function launch_contest(p_client uuid, p jsonb, p_payment_ref text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_prize numeric; v_price numeric;
begin
  if auth.role() <> 'service_role' then raise exception 'webhook only'; end if;
  select prize, price into v_prize, v_price from (values
    ('bronze', 900, 1100), ('silver', 1600, 1900), ('gold', 2600, 3000), ('platinum', 5000, 5600)
  ) as t(id, prize, price) where id = p->>'package';
  v_price := v_price + case when (p->>'blind')::boolean then 150 else 0 end + case when (p->>'featured')::boolean then 200 else 0 end;
  insert into contests (client_id, title, brand, category, brief, audience, styles, colors, usage, avoid, package, prize, price,
                        guaranteed, blind, featured, deadline, payment_ref)
  values (p_client, p->>'title', p->>'brand', p->>'category', p->>'brief', coalesce(p->>'audience', ''),
          coalesce(array(select jsonb_array_elements_text(p->'styles')), '{}'), coalesce(p->>'colors', ''), coalesce(p->>'usage', ''),
          coalesce(p->>'avoid', ''), p->>'package', v_prize, v_price, coalesce((p->>'guaranteed')::boolean, false),
          coalesce((p->>'blind')::boolean, false), coalesce((p->>'featured')::boolean, false),
          now() + make_interval(days => least(14, greatest(3, coalesce((p->>'days')::int, 7)))), p_payment_ref)
  returning id into v_id;
  insert into transactions (user_id, type, amount, contest_id, note) values (p_client, 'escrow', v_price, v_id, 'دفع مسابقة — محفوظ في الضمان');
  return v_id;
end $$;

create or replace function pick_winner(p_contest uuid, p_entry uuid, p_stars int default 5, p_text text default '') returns void
language plpgsql security definer set search_path = public as $$
declare c contests; e entries;
begin
  select * into c from contests where id = p_contest for update;
  if c.client_id <> auth.uid() and not is_admin() then raise exception 'not your contest'; end if;
  if c.status <> 'open' or c.winner_entry_id is not null then raise exception 'contest already closed'; end if;
  select * into e from entries where id = p_entry and contest_id = p_contest and status = 'active';
  if not found then raise exception 'entry not eligible'; end if;

  update contests set status = 'completed', winner_entry_id = e.id, completed_at = now(), deadline = least(deadline, now()) where id = c.id;
  update profiles set balance = balance + c.prize where id = e.artist_id;
  insert into transactions (user_id, type, amount, contest_id, note) values
    (e.artist_id, 'payout', c.prize, c.id, 'جائزة مسابقة'),
    (null, 'fee', c.price - c.prize, c.id, 'عمولة مسابقة'),
    (c.client_id, 'release', c.price, c.id, 'تحرير الضمان — نقل الملكية');
  insert into reviews (artist_id, client_id, contest_id, stars, text) values (e.artist_id, c.client_id, c.id, least(5, greatest(1, p_stars)), p_text);
  insert into notifications (user_id, text, link) values (e.artist_id, 'فاز تصميمك في «' || c.title || '»', '#/contests/' || c.id);
end $$;

create or replace function request_refund(p_contest uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c contests;
begin
  select * into c from contests where id = p_contest for update;
  if c.client_id <> auth.uid() then raise exception 'not your contest'; end if;
  if c.guaranteed then raise exception 'guaranteed contests cannot be refunded'; end if;
  if c.status <> 'open' or c.deadline > now() or c.winner_entry_id is not null then raise exception 'refund only during judging'; end if;
  update contests set status = 'refunded' where id = c.id;
  insert into transactions (user_id, type, amount, contest_id, note) values (c.client_id, 'refund', c.price, c.id, 'استرداد مسابقة');
  -- the edge function listening on this insert issues the gateway refund using contests.payment_ref
end $$;

create or replace function approve_hire(p_hire uuid, p_stars int default 5, p_text text default '') returns void
language plpgsql security definer set search_path = public as $$
declare h hires; v_fee numeric;
begin
  select * into h from hires where id = p_hire for update;
  if h.client_id <> auth.uid() then raise exception 'not your project'; end if;
  if h.status <> 'delivered' then raise exception 'nothing to approve'; end if;
  v_fee := round(h.budget * 0.10, 2);
  update hires set status = 'approved', approved_at = now() where id = h.id;
  update profiles set balance = balance + (h.budget - v_fee) where id = h.artist_id;
  insert into transactions (user_id, type, amount, hire_id, note) values
    (h.artist_id, 'payout', h.budget - v_fee, h.id, 'مشروع مباشر'),
    (null, 'fee', v_fee, h.id, 'عمولة مشروع'),
    (h.client_id, 'release', h.budget, h.id, 'تحرير الضمان');
  insert into reviews (artist_id, client_id, hire_id, stars, text) values (h.artist_id, h.client_id, h.id, least(5, greatest(1, p_stars)), p_text);
end $$;

-- ------------------------------------------------------------------ storage
-- Bucket "entries" (private). Read through signed URLs generated by an edge function that
-- re-checks the same blind-contest rule as entries_read; artists upload to entries/<uid>/<file>.
insert into storage.buckets (id, name, public) values ('entries', 'entries', false) on conflict do nothing;
create policy entries_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'entries' and (storage.foldername(name))[1] = auth.uid()::text);
