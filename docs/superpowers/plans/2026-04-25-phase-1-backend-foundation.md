# Phase 1 — Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Supabase backend (schema, RLS, storage) and import the existing `data.js` content into it, so subsequent phases have a working data layer to read/write.

**Architecture:** Manual SQL pastes into the Supabase SQL editor for the schema, RLS, and storage policies (one-time ops); a small `lib/supabase.js` for the client SDK; a temporary `tools/migrate.html` + `tools/migrate.js` to sign in via magic link and copy `window.SHIFT_DATA.CATEGORIES` into the new tables. After this phase ships, the database is populated with the same content the game has today, and the game still uses `data.js` (no behavior change).

**Tech Stack:** Supabase (Postgres + Auth + Storage), `@supabase/supabase-js@2` from JSDelivr CDN, vanilla JS, no build step.

**Spec:** [docs/superpowers/specs/2026-04-25-admin-dashboard-design.md](../specs/2026-04-25-admin-dashboard-design.md)

---

## File Structure

Files this plan creates or modifies:

| Path | Responsibility |
|------|---------------|
| `.git/` | New git repo so we can commit work and later deploy via GitHub Pages |
| `tools/schema.sql` | Idempotent SQL: tables + indexes + `updated_at` trigger |
| `tools/rls-policies.sql` | Idempotent SQL: enable RLS + define policies on all four tables |
| `tools/storage-policies.sql` | Idempotent SQL: storage policies on `media` bucket |
| `tools/seed-admin.sql` | One-line SQL the owner runs to add themselves to `admins` |
| `lib/supabase.js` | Shared Supabase client + a small `auth` and `db` helper API |
| `tools/migrate.html` | Tiny page for one-off migration: sign in + click "Migrate" |
| `tools/migrate.js` | Reads legacy `data.js`, inserts sections/categories/questions |
| `.gitignore` | Standard ignores |

No existing files are modified in this phase.

---

## Pre-flight: Information you need before starting

Before Task 1, gather:

1. **Supabase project URL:** `https://vpemuntrgfqettjbqkbn.supabase.co` (already in spec).
2. **Supabase anon key:** open https://supabase.com/dashboard → your project → **Settings → API** → copy the value labelled **`anon` `public`** (NOT `service_role`). It looks like `eyJhbGc...` and is safe to put in client code.
3. **Owner email:** the email address you'll sign in with as the first admin (any email Supabase Auth can email — Gmail / iCloud / etc.).

Hold these — Tasks 8 and 9 use them.

---

## Task 1: Initialize git repo

**Files:**
- Create: `.gitignore`

- [ ] **Step 1: Verify we're not already in a git repo**

Run from the project root (`/Users/akalkhamis/Movies/game test shaleh2/shift-game`):

```bash
git rev-parse --is-inside-work-tree 2>/dev/null || echo "not a repo (good)"
```

Expected: `not a repo (good)`. If it prints `true`, skip Steps 2-3.

- [ ] **Step 2: Initialize repo**

```bash
git init -b main
```

Expected: `Initialized empty Git repository in .../shift-game/.git/`.

- [ ] **Step 3: Write `.gitignore`**

Create `.gitignore` at the project root with this content:

```gitignore
.DS_Store
.vscode/
.idea/
node_modules/
*.log
.env
.env.local
```

- [ ] **Step 4: First commit (existing files)**

```bash
git add -A
git commit -m "chore: initialize repo with existing game files"
```

Expected: a commit summary listing `index.html`, `app.js`, `data.js`, `styles.css`, `assets/`, etc.

---

## Task 2: Write the SQL schema

**Files:**
- Create: `tools/schema.sql`

- [ ] **Step 1: Create `tools/schema.sql`**

```sql
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
```

- [ ] **Step 2: Run the SQL in Supabase**

1. Open https://supabase.com/dashboard → your project → **SQL Editor → New query**.
2. Paste the entire contents of `tools/schema.sql`.
3. Click **Run** (or ⌘+Enter).

Expected: `Success. No rows returned.` and no errors. If you see "permission denied for schema public", try again — that's a transient Supabase rate-limit thing.

- [ ] **Step 3: Verify the four tables exist**

In the same SQL editor, paste and run:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('sections','categories','questions','admins')
order by table_name;
```

Expected output (4 rows):
```
admins
categories
questions
sections
```

- [ ] **Step 4: Commit**

```bash
git add tools/schema.sql
git commit -m "feat(db): schema for sections, categories, questions, admins"
```

---

## Task 3: Write & apply Row Level Security policies

**Files:**
- Create: `tools/rls-policies.sql`

- [ ] **Step 1: Create `tools/rls-policies.sql`**

```sql
-- Enable RLS on all four tables.
alter table sections   enable row level security;
alter table categories enable row level security;
alter table questions  enable row level security;
alter table admins     enable row level security;

-- Drop any existing policies (so this file is re-runnable).
drop policy if exists read_all       on sections;
drop policy if exists read_all       on categories;
drop policy if exists read_all       on questions;
drop policy if exists mutate_admins  on sections;
drop policy if exists mutate_admins  on categories;
drop policy if exists mutate_admins  on questions;
drop policy if exists read_self      on admins;

-- Public read on content tables.
create policy read_all on sections   for select using (true);
create policy read_all on categories for select using (true);
create policy read_all on questions  for select using (true);

-- Admin-only mutations on content tables.
create policy mutate_admins on sections
  for all
  using      ((auth.jwt() ->> 'email') in (select email from admins))
  with check ((auth.jwt() ->> 'email') in (select email from admins));

create policy mutate_admins on categories
  for all
  using      ((auth.jwt() ->> 'email') in (select email from admins))
  with check ((auth.jwt() ->> 'email') in (select email from admins));

create policy mutate_admins on questions
  for all
  using      ((auth.jwt() ->> 'email') in (select email from admins))
  with check ((auth.jwt() ->> 'email') in (select email from admins));

-- Admins can read their own row only (so the client can check "am I an admin?").
-- Insert/update/delete on admins: NO POLICY → blocked for everyone via the API.
-- The owner manages the allowlist using the SQL editor (service_role context).
create policy read_self on admins
  for select
  using ((auth.jwt() ->> 'email') = email);
```

> **Why `auth.jwt() ->> 'email'` instead of `auth.email()`:** Supabase's `auth.email()` helper isn't always present depending on project age/version. Reading the JWT claim works on every Supabase project. Functionally identical.

- [ ] **Step 2: Run the SQL in Supabase**

Open SQL Editor → New query → paste contents of `tools/rls-policies.sql` → Run.

Expected: `Success. No rows returned.`

- [ ] **Step 3: Verify policies are in place**

```sql
select schemaname, tablename, policyname
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

Expected (7 rows):
```
public | admins     | read_self
public | categories | mutate_admins
public | categories | read_all
public | questions  | mutate_admins
public | questions  | read_all
public | sections   | mutate_admins
public | sections   | read_all
```

- [ ] **Step 4: Verify anon read works (no session required)**

In SQL Editor (still service_role) this won't reproduce the anon experience. Instead, use the REST endpoint directly. From your terminal:

```bash
curl -s "https://vpemuntrgfqettjbqkbn.supabase.co/rest/v1/sections?select=id" \
  -H "apikey: <PASTE_ANON_KEY>" \
  -H "Authorization: Bearer <PASTE_ANON_KEY>"
```

Expected: `[]` (empty array — table is empty but readable). If you get `{"code":"42501","message":"permission denied for table sections"}` something is wrong with RLS.

- [ ] **Step 5: Verify anon write fails**

```bash
curl -s -X POST "https://vpemuntrgfqettjbqkbn.supabase.co/rest/v1/sections" \
  -H "apikey: <PASTE_ANON_KEY>" \
  -H "Authorization: Bearer <PASTE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"name":"hack","order_index":0}'
```

Expected: `{"code":"42501","message":"new row violates row-level security policy for table \"sections\""}` or similar denial. **If this returns a row, RLS is misconfigured — STOP and re-check Step 2.**

- [ ] **Step 6: Commit**

```bash
git add tools/rls-policies.sql
git commit -m "feat(db): RLS policies — public read, admin-only writes"
```

---

## Task 4: Create the storage bucket

**Files:** none (manual dashboard step + SQL)

- [ ] **Step 1: Create the bucket in the Supabase dashboard**

1. Open dashboard → **Storage → New bucket**.
2. Name: `media`
3. **Public bucket: ON** (toggle the switch).
4. File size limit: leave default for now (we enforce per-type in policies).
5. Allowed MIME types: leave blank (we whitelist via policies).
6. Click **Create bucket**.

Expected: a new entry `media` appears in the Storage list, marked "Public".

- [ ] **Step 2: Create `tools/storage-policies.sql`**

```sql
-- Storage policies for the `media` bucket.
-- The objects table lives in the `storage` schema.

drop policy if exists media_read_all      on storage.objects;
drop policy if exists media_admin_insert  on storage.objects;
drop policy if exists media_admin_update  on storage.objects;
drop policy if exists media_admin_delete  on storage.objects;

-- Everyone can SELECT objects in the media bucket (game needs media URLs to
-- be fetchable without auth).
create policy media_read_all on storage.objects
  for select
  using (bucket_id = 'media');

-- Only admins can write/replace/delete objects in the media bucket.
create policy media_admin_insert on storage.objects
  for insert
  with check (
    bucket_id = 'media'
    and (auth.jwt() ->> 'email') in (select email from public.admins)
  );

create policy media_admin_update on storage.objects
  for update
  using (
    bucket_id = 'media'
    and (auth.jwt() ->> 'email') in (select email from public.admins)
  )
  with check (
    bucket_id = 'media'
    and (auth.jwt() ->> 'email') in (select email from public.admins)
  );

create policy media_admin_delete on storage.objects
  for delete
  using (
    bucket_id = 'media'
    and (auth.jwt() ->> 'email') in (select email from public.admins)
  );
```

- [ ] **Step 3: Run `tools/storage-policies.sql` in Supabase**

SQL Editor → New query → paste → Run.

Expected: `Success. No rows returned.`

- [ ] **Step 4: Verify the four storage policies exist**

```sql
select policyname
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname like 'media_%'
order by policyname;
```

Expected (4 rows):
```
media_admin_delete
media_admin_insert
media_admin_update
media_read_all
```

- [ ] **Step 5: Commit**

```bash
git add tools/storage-policies.sql
git commit -m "feat(storage): public-read, admin-write policies on media bucket"
```

---

## Task 5: Add yourself to the admin allowlist

**Files:**
- Create: `tools/seed-admin.sql`

- [ ] **Step 1: Create `tools/seed-admin.sql`**

This file is a template — replace the email with yours before running. It is committed for documentation, not for execution.

```sql
-- Add the owner. Replace the email with the address you'll sign in with.
insert into admins (email, role)
values ('REPLACE_ME@example.com', 'owner')
on conflict (email) do update set role = excluded.role;
```

- [ ] **Step 2: Run the SQL with your real email**

In Supabase SQL Editor:

```sql
insert into admins (email, role)
values ('your-actual-email@gmail.com', 'owner')
on conflict (email) do update set role = excluded.role;
```

Expected: `Success. 1 row affected.`

- [ ] **Step 3: Verify the row exists**

```sql
select email, role from admins;
```

Expected: one row with your email and role `owner`.

- [ ] **Step 4: Commit (template only — your real email stays in Supabase)**

```bash
git add tools/seed-admin.sql
git commit -m "docs(db): template SQL for seeding the admin allowlist"
```

---

## Task 6: Write `lib/supabase.js`

**Files:**
- Create: `lib/supabase.js`

- [ ] **Step 1: Create `lib/supabase.js`**

```js
// Shared Supabase client + small helper API used by both the game and the admin.
// Loaded as a classic <script> (we expose `window.SHIFT_SB`).

(() => {
  "use strict";

  // Project credentials. The anon key is safe to ship in client code; RLS
  // protects the database. NEVER put the service_role key here.
  const SUPABASE_URL  = "https://vpemuntrgfqettjbqkbn.supabase.co";
  const SUPABASE_ANON_KEY = "REPLACE_WITH_ANON_KEY";

  if (!window.supabase || !window.supabase.createClient){
    throw new Error("supabase-js not loaded. Add the CDN <script> before lib/supabase.js.");
  }

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true }
  });

  // ---- auth helpers ----
  async function signInWithEmail(email){
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href }
    });
    if (error) throw error;
  }
  async function signOut(){
    const { error } = await client.auth.signOut();
    if (error) throw error;
  }
  async function currentEmail(){
    const { data } = await client.auth.getSession();
    return data?.session?.user?.email ?? null;
  }
  async function isAdmin(){
    const email = await currentEmail();
    if (!email) return false;
    const { data, error } = await client
      .from("admins")
      .select("email")
      .eq("email", email)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  }

  // ---- content read ----
  async function fetchContentTree(){
    const { data, error } = await client
      .from("sections")
      .select(`
        id, name, cover_url, order_index,
        categories (
          id, section_id, name, emoji, image_url, cover_url, order_index,
          questions (
            id, category_id, difficulty, order_index,
            prompt_text, prompt_media_type, prompt_media_url,
            answer_text, answer_media_type, answer_media_url
          )
        )
      `)
      .order("order_index", { ascending: true });
    if (error) throw error;
    return data;
  }

  // ---- content write (used by migrate.js + future admin) ----
  async function insertSection(row){
    const { data, error } = await client.from("sections").insert(row).select().single();
    if (error) throw error;
    return data;
  }
  async function insertCategory(row){
    const { data, error } = await client.from("categories").insert(row).select().single();
    if (error) throw error;
    return data;
  }
  async function insertQuestion(row){
    const { data, error } = await client.from("questions").insert(row).select().single();
    if (error) throw error;
    return data;
  }

  window.SHIFT_SB = {
    client,
    auth: { signInWithEmail, signOut, currentEmail, isAdmin },
    db: { fetchContentTree, insertSection, insertCategory, insertQuestion }
  };
})();
```

- [ ] **Step 2: Replace `REPLACE_WITH_ANON_KEY` with your actual anon key**

Open `lib/supabase.js` and change the `SUPABASE_ANON_KEY` line. The value comes from Supabase dashboard → Settings → API → "anon / public" key. It looks like `eyJhbGc...`.

> ⚠️ **DO NOT** paste the service_role key here. The anon key is the public one.

- [ ] **Step 3: Smoke-test it loads in a browser**

Quickest test — create a temporary `tools/smoke.html`:

```html
<!doctype html>
<html><head><meta charset="utf-8"><title>smoke</title></head>
<body>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="../lib/supabase.js"></script>
<script>
  (async () => {
    console.log("client:", !!window.SHIFT_SB?.client);
    console.log("currentEmail:", await SHIFT_SB.auth.currentEmail());
    const tree = await SHIFT_SB.db.fetchContentTree();
    console.log("sections:", tree.length, tree);
  })();
</script>
</body></html>
```

Serve and open:

```bash
python3 -m http.server 8765
# then open http://127.0.0.1:8765/tools/smoke.html and check the JS console
```

Expected console output:
```
client: true
currentEmail: null
sections: 0 []
```

If `client: false` or you see auth errors, the URL or anon key is wrong.

- [ ] **Step 4: Delete the smoke file**

```bash
rm tools/smoke.html
```

- [ ] **Step 5: Commit**

```bash
git add lib/supabase.js
git commit -m "feat(lib): supabase client + auth/db helpers"
```

---

## Task 7: Write the migration page (`tools/migrate.html`)

**Files:**
- Create: `tools/migrate.html`

- [ ] **Step 1: Create `tools/migrate.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Migrate data.js → Supabase</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 640px; margin: 40px auto; padding: 0 16px; }
    button { font: inherit; padding: 10px 16px; border-radius: 8px; border: 1px solid #ccc; background: #fff; cursor: pointer; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    #log { background: #111; color: #0f0; padding: 12px; border-radius: 8px; height: 280px; overflow: auto; font-family: ui-monospace, monospace; font-size: 13px; white-space: pre-wrap; }
    .row { margin: 12px 0; display: flex; gap: 8px; align-items: center; }
    input[type=email] { flex: 1; padding: 10px 12px; border: 1px solid #ccc; border-radius: 8px; font: inherit; }
    .ok { color: #0a7; } .bad { color: #c33; }
  </style>
</head>
<body>
<h1>Migrate <code>data.js</code> → Supabase</h1>
<p>Run this once after the schema is set up and you're added to <code>admins</code>.</p>

<div class="row" id="signinRow">
  <input id="email" type="email" placeholder="your-email@example.com" />
  <button id="signin">Send magic link</button>
</div>

<div id="status" class="row"></div>

<div class="row">
  <button id="migrate" disabled>Run migration</button>
  <button id="signout" disabled>Sign out</button>
</div>

<pre id="log"></pre>

<!-- Load the legacy data so window.SHIFT_DATA is available. -->
<script src="../data.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="../lib/supabase.js"></script>
<script src="./migrate.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add tools/migrate.html
git commit -m "feat(tools): migrate.html shell for one-off data import"
```

---

## Task 8: Write the migration script (`tools/migrate.js`)

**Files:**
- Create: `tools/migrate.js`

- [ ] **Step 1: Create `tools/migrate.js`**

```js
// One-off migration: copies window.SHIFT_DATA.CATEGORIES into Supabase.
// Idempotent: re-running skips rows that already exist (matched by name).

(() => {
  "use strict";
  const { auth, db, client } = window.SHIFT_SB;
  const log = (msg, cls="") => {
    const el = document.getElementById("log");
    el.innerHTML += `<span class="${cls}">${msg}</span>\n`;
    el.scrollTop = el.scrollHeight;
  };
  const setStatus = (msg, cls="") => {
    document.getElementById("status").innerHTML = `<span class="${cls}">${msg}</span>`;
  };

  const $ = (id) => document.getElementById(id);

  async function refreshAuthUI(){
    const email = await auth.currentEmail();
    if (!email){
      setStatus("Not signed in.");
      $("migrate").disabled = true;
      $("signout").disabled = true;
      return;
    }
    const isAdm = await auth.isAdmin();
    if (isAdm){
      setStatus(`Signed in as ${email} ✓ admin`, "ok");
      $("migrate").disabled = false;
    } else {
      setStatus(`Signed in as ${email} — NOT in admins table`, "bad");
      $("migrate").disabled = true;
    }
    $("signout").disabled = false;
  }

  $("signin").addEventListener("click", async () => {
    const email = $("email").value.trim();
    if (!email){ setStatus("Enter an email first", "bad"); return; }
    try{
      await auth.signInWithEmail(email);
      setStatus(`Magic link sent to ${email} — check your inbox, then come back to this page.`, "ok");
    } catch (e){
      setStatus(`Sign-in error: ${e.message}`, "bad");
    }
  });

  $("signout").addEventListener("click", async () => {
    await auth.signOut();
    refreshAuthUI();
  });

  client.auth.onAuthStateChange(() => refreshAuthUI());
  refreshAuthUI();

  // ---- migration logic ----
  $("migrate").addEventListener("click", async () => {
    $("migrate").disabled = true;
    try{
      const cats = window.SHIFT_DATA?.CATEGORIES;
      if (!Array.isArray(cats)) throw new Error("window.SHIFT_DATA.CATEGORIES not found");

      // Group categories by their `group` field → distinct sections.
      const groupNames = [...new Set(cats.map(c => c.group))];
      log(`found ${groupNames.length} sections, ${cats.length} categories`);

      // 1) Sections
      const { data: existingSections } = await client.from("sections").select("id,name");
      const sectionByName = new Map(existingSections.map(s => [s.name, s]));
      for (let i = 0; i < groupNames.length; i++){
        const name = groupNames[i];
        if (sectionByName.has(name)){
          log(`  · section "${name}" already exists — skipping`);
          continue;
        }
        const row = await db.insertSection({ name, order_index: i });
        sectionByName.set(name, row);
        log(`  + section "${name}" created`, "ok");
      }

      // 2) Categories
      const { data: existingCats } = await client.from("categories").select("id,name,section_id");
      const catKey = (sectionId, name) => `${sectionId}|${name}`;
      const catByKey = new Map(existingCats.map(c => [catKey(c.section_id, c.name), c]));
      for (let i = 0; i < cats.length; i++){
        const c = cats[i];
        const section = sectionByName.get(c.group);
        if (!section) throw new Error(`no section for group ${c.group}`);
        const key = catKey(section.id, c.name);
        if (catByKey.has(key)){
          log(`  · category "${c.name}" already exists — skipping`);
          continue;
        }
        const row = await db.insertCategory({
          section_id: section.id,
          name: c.name,
          emoji: c.emoji,
          order_index: i
        });
        catByKey.set(key, row);
        log(`  + category "${c.name}" created`, "ok");
      }

      // 3) Questions
      // For idempotency, match questions by (category_id, prompt_text).
      let qInserted = 0, qSkipped = 0;
      for (const c of cats){
        const section = sectionByName.get(c.group);
        const cat = catByKey.get(catKey(section.id, c.name));
        const { data: existingQs } = await client
          .from("questions")
          .select("id,prompt_text")
          .eq("category_id", cat.id);
        const promptSet = new Set(existingQs.map(q => q.prompt_text));
        let order = 0;
        for (const q of c.questions){
          if (promptSet.has(q.q)){ qSkipped++; order++; continue; }
          await db.insertQuestion({
            category_id: cat.id,
            difficulty: q.d,
            prompt_text: q.q,
            answer_text: q.a,
            order_index: order
          });
          qInserted++; order++;
        }
      }
      log(`questions: +${qInserted} inserted, ${qSkipped} skipped`, "ok");
      log("DONE.", "ok");
    } catch (e){
      log(`ERROR: ${e.message}`, "bad");
      console.error(e);
    } finally {
      $("migrate").disabled = false;
    }
  });
})();
```

- [ ] **Step 2: Commit**

```bash
git add tools/migrate.js
git commit -m "feat(tools): migration script — data.js into sections/categories/questions"
```

---

## Task 9: Run the migration end-to-end

**Files:** none

- [ ] **Step 1: Serve the project locally**

```bash
python3 -m http.server 8765
```

Leave this running. Open http://127.0.0.1:8765/tools/migrate.html in your browser.

- [ ] **Step 2: Sign in**

Type your owner email (the one you added in Task 5 Step 2), click **Send magic link**, check your inbox, click the link in the email. The link opens `migrate.html` again, now signed in. The status row should read:

```
Signed in as your-email@gmail.com ✓ admin
```

If it reads "NOT in admins table", you signed in with a different email than you seeded — re-do Task 5 with the correct one.

- [ ] **Step 3: Run migration**

Click **Run migration**.

Expected log output (counts come from `data.js`, currently 7 sections / 18 categories / 108 questions; values may shift if `data.js` was edited):

```
found 7 sections, 18 categories
  + section "عام" created
  + section "الكويت" created
  + section "رياضة" created
  ...
  + category "معلومات عامة" created
  ...
questions: +108 inserted, 0 skipped
DONE.
```

If you see RLS / 401 errors, the signed-in email is not in `admins` — fix Task 5 and try again.

- [ ] **Step 4: Verify in Supabase**

In SQL Editor:

```sql
select
  (select count(*) from sections)   as sections,
  (select count(*) from categories) as categories,
  (select count(*) from questions)  as questions;
```

Expected (counts will match what's in `data.js`):
```
sections: 7
categories: 18
questions: 108
```

- [ ] **Step 5: Verify the join read works (anonymous)**

Stop the dev server (Ctrl+C), reopen `http://127.0.0.1:8765/tools/migrate.html` in a **private / incognito window** (so there's no session). Open the JS console and run:

```js
const tree = await SHIFT_SB.db.fetchContentTree();
console.log(tree.length, tree[0]?.categories?.length, tree[0]?.categories?.[0]?.questions?.length);
```

Expected: `8 (number) (number)` — you can fetch the whole tree without being signed in.

- [ ] **Step 6: Verify migration is idempotent**

Sign in again, click **Run migration** a second time.

Expected log:
```
found 7 sections, 18 categories
  · section "عام" already exists — skipping
  ...
questions: +0 inserted, 108 skipped
DONE.
```

No new rows inserted, no errors.

---

## Task 10: Final cleanup & commit

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Confirm `lib/supabase.js` is committed with the real anon key**

```bash
git log --all -- lib/supabase.js
grep -c "REPLACE_WITH_ANON_KEY" lib/supabase.js
```

Expected: at least one commit listed; grep returns `0` (placeholder gone). If grep returns `1`, you forgot Task 6 Step 2 — fix and commit.

- [ ] **Step 2: Verify no service_role key was accidentally committed**

```bash
git log -p | grep -i "service_role" | head
git log -p | grep -E "eyJ[A-Za-z0-9_-]+\." | head
```

The first command should be empty. The second should only show your **anon** key (which is fine to commit). If you see two distinct JWTs anywhere, one of them is the service_role — `git rm` and recommit immediately, then **rotate the service_role key** in Supabase (Settings → API → Reset service_role key).

- [ ] **Step 3: Tag the phase**

```bash
git tag -a v0.1-phase1 -m "Phase 1: backend foundation — schema, RLS, storage, migration done"
```

- [ ] **Step 4: Phase 1 complete — verify success criteria**

✓ Schema exists in Supabase (Task 2 Step 3)
✓ RLS allows anon read but blocks anon writes (Task 3 Steps 4–5)
✓ Storage bucket exists with correct policies (Task 4 Steps 1–4)
✓ Owner is in `admins` (Task 5 Step 3)
✓ `lib/supabase.js` works end-to-end (Task 6 Step 3, Task 9 Step 5)
✓ All `data.js` content is in Supabase (Task 9 Step 4)
✓ Migration is idempotent (Task 9 Step 6)
✓ Game still uses `data.js` and works exactly as before (no changes to `index.html` / `app.js`)

---

## What's NOT in this phase

By design, the following are deferred to later phases:

- **Game reading from Supabase** → Phase 2.
- **`admin.html`, magic-link sign-in UX, allowlist gate** → Phase 3.
- **CRUD UI for sections/categories/questions** → Phase 4.
- **Media uploads** → Phase 5.
- **Confirmation modals, search, drag-to-reorder** → Phase 6.

After Task 10 ships, ask Claude to write Phase 2's plan.
