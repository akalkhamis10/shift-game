# SHIFT Quiz — Admin Dashboard & Backend Design

**Date:** 2026-04-25
**Status:** Approved by user, ready for implementation planning

---

## 1. Context

The SHIFT quiz game is a static HTML/JS app today (`index.html`, `app.js`,
`data.js`, `styles.css`). Question content is hard-coded in `data.js` — to add
or change a question, someone has to edit the file. We want a hosted admin
dashboard where a small team (the owner + a few editors) can manage all content
(sections, categories, questions, plus media: images, video, audio) without
touching code.

## 2. Goals

- CRUD on sections, categories, and questions through a UI.
- Attach images, video, and audio to sections, categories, and questions
  (both prompt and answer).
- Restrict edits to specific approved people; the owner controls the allowlist.
- Players still get zero-friction access — no login.
- Keep the existing zero-build, plain-HTML/JS/CSS stack.

## 3. Non-goals (v1)

- Player accounts or score persistence across sessions.
- A UI for managing the admin allowlist (handled in Supabase SQL editor).
- Soft-deletes, versioning, or change history.
- Multi-tenancy (separate "game packs" per admin).
- Real-time concurrent editing of the same row.

## 4. Stack & hosting

- **Frontend:** vanilla HTML/JS/CSS, RTL, no build step.
- **Backend:** Supabase project at
  `https://vpemuntrgfqettjbqkbn.supabase.co` — Postgres + Auth + Storage.
- **Client SDK:** `@supabase/supabase-js` loaded from a CDN (no npm).
- **Hosting:** GitHub Pages (or any static host). Project is currently not a
  git repository — `git init` + GitHub remote is part of Phase 1.

## 5. File layout

```
shift-game/
├── index.html           # game (existing — modified to fetch from Supabase)
├── app.js               # game logic (existing — content source swapped)
├── data.js              # legacy static data (kept for migration source / fallback)
├── styles.css           # shared styles (existing)
├── admin.html           # NEW — admin dashboard shell
├── admin.js             # NEW — admin logic (CRUD, uploads, modals)
├── admin.css            # NEW — admin-only styles
├── lib/
│   └── supabase.js      # NEW — shared Supabase client + helpers
└── tools/
    └── migrate.js       # NEW — one-off browser-console import from data.js
```

## 6. Data model

All tables include `created_at timestamptz default now()` and
`updated_at timestamptz default now()` (with a trigger that bumps `updated_at`
on UPDATE). All `id` columns default to `gen_random_uuid()`.

### 6.1 sections

| column      | type | notes                       |
|-------------|------|-----------------------------|
| id          | uuid | primary key                 |
| name        | text | not null                    |
| cover_url   | text | nullable; storage public URL|
| order_index | int  | not null default 0          |

### 6.2 categories

| column      | type | notes                                            |
|-------------|------|--------------------------------------------------|
| id          | uuid | primary key                                      |
| section_id  | uuid | references sections(id) on delete cascade        |
| name        | text | not null                                         |
| emoji       | text | nullable                                         |
| image_url   | text | nullable; small icon-style upload                |
| cover_url   | text | nullable; large illustration (Seen Jeem-style)   |
| order_index | int  | not null default 0                               |

### 6.3 questions

| column              | type | notes                                                                |
|---------------------|------|----------------------------------------------------------------------|
| id                  | uuid | primary key                                                          |
| category_id         | uuid | references categories(id) on delete cascade                          |
| difficulty          | text | not null; check in ('easy','medium','hard')                          |
| prompt_text         | text | not null                                                             |
| prompt_media_type   | text | not null default 'none'; check in ('none','image','video','audio')   |
| prompt_media_url    | text | nullable                                                             |
| answer_text         | text | not null                                                             |
| answer_media_type   | text | not null default 'none'; same check as above                         |
| answer_media_url    | text | nullable                                                             |
| order_index         | int  | not null default 0                                                   |

### 6.4 admins

| column     | type | notes                                          |
|------------|------|------------------------------------------------|
| email      | text | primary key                                    |
| role       | text | not null default 'editor'; check in ('owner','editor') |
| created_at | timestamptz | default now()                           |

### 6.5 Indexes

```sql
create index categories_section_order on categories(section_id, order_index);
create index questions_category_diff_order
  on questions(category_id, difficulty, order_index);
```

### 6.6 Row Level Security

Enable RLS on all four tables.

**sections / categories / questions:**

```sql
create policy read_all on <table>
  for select using (true);

create policy mutate_admins on <table>
  for all
  using      (auth.email() in (select email from admins))
  with check (auth.email() in (select email from admins));
```

**admins:**

```sql
create policy read_self on admins
  for select using (email = auth.email());

-- No INSERT/UPDATE/DELETE policy → only the service_role (SQL editor) can
-- modify the allowlist.
```

## 7. Storage

One bucket: `media`, **public**.

Path layout (`{ext}` is the file extension — `jpg`, `png`, `mp4`, `mp3`, …):

```
sections/{section_id}/cover.{ext}
categories/{category_id}/image.{ext}
categories/{category_id}/cover.{ext}
questions/{question_id}/prompt.{ext}
questions/{question_id}/answer.{ext}
```

Storage policies:

- `SELECT` on `media`: public.
- `INSERT` / `UPDATE` / `DELETE` on `media`: only when
  `auth.email() in (select email from admins)`.

Size limits, enforced both client-side (with a clear error toast) and via the
storage policy:

- image ≤ 5 MB
- audio ≤ 10 MB
- video ≤ 50 MB

Replacing media: the admin client deletes the old object before uploading the
new one (so we don't accumulate orphans).

## 8. Auth flow

1. Admin opens `admin.html`.
2. If no Supabase session → "Sign in" form with email magic link.
3. Supabase emails a one-time link; clicking it returns to `admin.html` with a
   session.
4. The app queries `admins` for the signed-in email; if no row →
   "Your account isn't authorized — contact the owner." and a sign-out button.
5. If row exists → load the dashboard.

The admin allowlist is managed via SQL in the Supabase editor:

```sql
-- add an editor
insert into admins (email, role) values ('teammate@gmail.com', 'editor');

-- remove someone
delete from admins where email = 'ex-teammate@gmail.com';
```

## 9. Admin UI (`admin.html`)

Single page. Top bar: app logo, signed-in email, sign-out button. Below: three
tabs.

### 9.1 Sections tab

Table columns: name, cover preview, # categories, edit, delete.

Edit modal:
- name input
- cover upload (image only)

### 9.2 Categories tab

Top filter: section `<select>` (or "all").

Table columns: section badge, name, emoji + image preview, # questions, edit,
delete.

Edit modal:
- section `<select>`
- name input
- emoji input
- image upload (icon)
- cover upload (large illustration)
- `order_index` number input

### 9.3 Questions tab

Top filter: section `<select>` cascading to category `<select>`.

Table columns: difficulty badge (easy = green, medium = orange, hard = coral),
prompt-text snippet (first ~80 chars), "has media" indicator, edit, delete.

Edit modal:
- category picker (cascades from section picker)
- difficulty radios (easy / medium / hard)
- prompt text textarea
- prompt media: type radio (none/image/video/audio) + file input,
  live preview (`<img>` / `<video>` / `<audio>`)
- answer text textarea
- answer media: same UI as prompt

### 9.4 Shared UI

- Toasts for success / error (top-right).
- Confirm-modal before destructive actions, e.g.
  *"Delete category 'تاريخ'? This also deletes its 6 questions."*
- Saving state on the modal save button (disabled + spinner while uploading).
- File-size guards before upload starts (clear error if too big).

## 10. Game integration

`index.html` currently loads `data.js` synchronously. After Phase 2 it will:

1. On boot, call

   ```js
   supabase
     .from('sections')
     .select('*, categories(*, questions(*))')
     .order('order_index')
     .order('order_index', { foreignTable: 'categories' })
     .order('order_index', { foreignTable: 'categories.questions' });
   ```

2. Cache the response in `localStorage` under
   `shift_content_v1` with a timestamp.
3. On subsequent loads, render from cache immediately, then revalidate in the
   background and re-render if changed.
4. If fetch fails and no cache exists → error screen with retry.

The rest of `app.js` (state shape, board rendering, question rendering) is
unchanged: we just swap the source of `CATEGORIES`.

## 11. Migration

`tools/migrate.js` is a script run once from the browser console while signed
in as an admin. It:

1. Walks the legacy `window.SHIFT_DATA.CATEGORIES` array.
2. Groups by `c.group` → upserts into `sections`.
3. Inserts each category, mapping `c.group` → `section_id`.
4. Inserts each question, mapping `q.d` → `difficulty`,
   `q.q` → `prompt_text`, `q.a` → `answer_text`. No media.
5. Idempotent: checks for an existing row by name before inserting; logs
   "skipped existing" / "inserted N rows".

## 12. Phasing

Each phase is independently shippable; the game keeps working at every stage.

| Phase | Deliverable                                                              | User-visible result                                  |
|-------|--------------------------------------------------------------------------|------------------------------------------------------|
| 1     | Supabase schema + RLS + storage. `lib/supabase.js`. Migration script.    | Backend ready, data imported. Game still uses data.js. |
| 2     | Game reads from Supabase with localStorage cache.                        | Game looks identical, content now DB-backed.         |
| 3     | `admin.html` shell + magic-link auth + allowlist gate.                   | Admin can sign in; sees "no UI yet" placeholder.     |
| 4     | CRUD for sections / categories / questions, **text only**.               | Text-only admin works end-to-end.                    |
| 5     | Media uploads — image first, then video, then audio.                     | Admin can attach media; game displays it.            |
| 6     | Polish: confirm modals, toasts, search, drag-to-reorder.                 | Production-ready UX.                                 |

## 13. Risks & open issues

- **Supabase anon key is committed to client code.** That's expected (anon key
  is designed to be public; RLS protects writes). The owner must never commit
  the service_role key.
- **CORS:** Supabase allows any origin by default; no extra config needed for
  GitHub Pages.
- **No git repo yet.** Phase 1 includes `git init` + creating a GitHub remote.
- **Magic-link UX on shared computers:** sometimes the link doesn't return to
  the same browser. If users complain, add email + password as a secondary
  option (Supabase supports both natively).
- **Phase 5 media-replacement orphans:** if the delete-then-upload sequence is
  interrupted, we may have orphan storage objects. Acceptable for v1; a later
  sweep job can clean them up.

## 14. Success criteria

- A teammate (in `admins`) can add a question with an image from their
  browser, and it appears in the next game session played by anyone.
- A signed-in user *not* in `admins` cannot insert / update / delete anything
  (verified by RLS + storage policy).
- The game continues to work if Supabase is unreachable, as long as a cache
  exists in `localStorage`.
