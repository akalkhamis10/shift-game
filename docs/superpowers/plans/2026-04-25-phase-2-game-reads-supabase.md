# Phase 2 — Game Reads from Supabase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing game (`index.html` + `app.js`) load its question bank from Supabase instead of the hand-edited `data.js` file. After this phase ships, edits made directly in the database appear in the game on next page load.

**Architecture:** Keep `data.js` as a thin **fallback** (lifelines, difficulties, and a built-in question bank for offline/degraded mode). Add a small loader (`lib/content.js`) that fetches the content tree from Supabase, reshapes it into the existing `window.SHIFT_DATA.CATEGORIES` format, and only then boots the game. `app.js` stays unchanged — it just runs slightly later, after the data is ready.

**Why this shape and not "rewrite app.js to be async"?** The current app.js is ~22 KB of working logic. Rewriting it to handle async data is a much bigger blast radius. Inverting the dependency — boot the data, *then* load app.js — gets us the same result with one new file and three lines changed in `index.html`.

**Tech Stack:** Same as Phase 1 — vanilla JS, no build step, `@supabase/supabase-js@2` from JSDelivr, `lib/supabase.js` already wired up.

**Spec:** [docs/superpowers/specs/2026-04-25-admin-dashboard-design.md](../specs/2026-04-25-admin-dashboard-design.md)

**Depends on:** Phase 1 must be tagged `v0.1-phase1` and migration verified (sections=7, categories=18, questions=108).

---

## File Structure

Files this plan creates or modifies:

| Path | Responsibility |
|------|---------------|
| `lib/content.js` | New. Fetch+reshape Supabase tree → legacy `CATEGORIES` shape; boot loader. |
| `index.html` | Modify. Add supabase-js + lib/supabase.js + lib/content.js; defer app.js until content is ready; add a tiny loading screen. |
| `styles.css` | Modify. Add a 12-line `.boot-overlay` style for the loader. |
| `data.js` | Modify (small). Wrap the inline `window.SHIFT_DATA = …` assignment so it only runs as a fallback when Supabase boot fails. |
| `app.js` | **No changes.** It still reads `window.SHIFT_DATA.CATEGORIES` at startup. |

No backend changes in this phase — Phase 1 already shipped the database.

---

## Pre-flight: Information you need before starting

Before Task 1, confirm:

1. The game runs locally today (`http://127.0.0.1:5500/index.html` plays end to end).
2. `git tag` lists `v0.1-phase1`.
3. `lib/supabase.js` already contains the real anon key (Phase 1 Task 6).
4. The migration is in place — quick sanity check in the Supabase SQL editor:
   ```sql
   select (select count(*) from sections) s, (select count(*) from categories) c, (select count(*) from questions) q;
   ```
   Expected: `7 | 18 | 108`.

---

## Task 1: Decide the shape contract

**Files:** none (documentation step in PR description)

The legacy shape `app.js` consumes is:

```js
window.SHIFT_DATA = {
  LIFELINES,        // static, stays in data.js
  DIFFICULTIES,     // static, stays in data.js
  CATEGORIES: [
    { id, group, name, emoji, questions: [{d, q, a}, ...] },
    ...
  ]
};
```

The Supabase tree (`SHIFT_SB.db.fetchContentTree()`) returns:

```js
[
  { id, name /* section */, order_index, categories: [
    { id, name, emoji, image_url, cover_url, order_index, questions: [
      { id, difficulty, prompt_text, answer_text, order_index, prompt_media_*, answer_media_* },
      ...
    ]},
    ...
  ]},
  ...
]
```

**Mapping rules** (these are the contract for Task 2):

| Legacy field | Source |
|---|---|
| `category.id`    | `categories.id` (UUID — `app.js` only uses it to match selections, no need for slugs) |
| `category.group` | the parent `sections.name` |
| `category.name`  | `categories.name` |
| `category.emoji` | `categories.emoji` (may be `null` — show empty) |
| `q.d`            | `questions.difficulty` |
| `q.q`            | `questions.prompt_text` |
| `q.a`            | `questions.answer_text` |

Sort order: respect `sections.order_index`, then `categories.order_index`, then `questions.order_index`.

- [ ] **Step 1: Sanity check** — open the JS console on `http://127.0.0.1:5500/index.html` and confirm the legacy shape:
  ```js
  Object.keys(window.SHIFT_DATA);                 // → ["LIFELINES","DIFFICULTIES","CATEGORIES"]
  window.SHIFT_DATA.CATEGORIES[0];                // confirm fields above
  window.SHIFT_DATA.CATEGORIES[0].questions[0];   // confirm {d,q,a}
  ```

No commit for this task — it just locks the contract in your head before you write the loader.

---

## Task 2: Write `lib/content.js` (the loader + reshaper)

**Files:**
- Create: `lib/content.js`

- [ ] **Step 1: Create `lib/content.js`**

```js
// Boot-time content loader. Reshapes Supabase tree → legacy CATEGORIES shape
// and exposes a single promise: `window.SHIFT_CONTENT_READY`.

(() => {
  "use strict";

  // Re-export the Phase-1 fallback shape (LIFELINES + DIFFICULTIES) which lives
  // in data.js. data.js sets window.__SHIFT_FALLBACK = { LIFELINES, DIFFICULTIES, CATEGORIES }
  // (see Task 4 — we wrap the existing assignment).
  function fallback() {
    return window.__SHIFT_FALLBACK || null;
  }

  function reshape(tree) {
    const cats = [];
    for (const section of tree) {
      for (const c of section.categories || []) {
        cats.push({
          id: c.id,
          group: section.name,
          name: c.name,
          emoji: c.emoji || "",
          questions: (c.questions || [])
            .slice()
            .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
            .map(q => ({
              d: q.difficulty,
              q: q.prompt_text,
              a: q.answer_text
            }))
        });
      }
    }
    return cats;
  }

  async function boot() {
    const fb = fallback();
    if (!fb) {
      throw new Error("data.js fallback not loaded — load data.js before lib/content.js");
    }

    try {
      const tree = await window.SHIFT_SB.db.fetchContentTree();
      const cats = reshape(tree);
      if (!cats.length) throw new Error("Supabase returned 0 categories");

      window.SHIFT_DATA = {
        LIFELINES:    fb.LIFELINES,
        DIFFICULTIES: fb.DIFFICULTIES,
        CATEGORIES:   cats
      };
      console.info("[shift] loaded", cats.length, "categories from Supabase");
      return { source: "supabase", count: cats.length };

    } catch (err) {
      console.warn("[shift] Supabase content load failed — falling back to data.js bundle:", err);
      window.SHIFT_DATA = {
        LIFELINES:    fb.LIFELINES,
        DIFFICULTIES: fb.DIFFICULTIES,
        CATEGORIES:   fb.CATEGORIES
      };
      return { source: "fallback", error: err.message, count: fb.CATEGORIES.length };
    }
  }

  // Expose a single promise the bootstrap script awaits.
  window.SHIFT_CONTENT_READY = boot();
})();
```

- [ ] **Step 2: Static smoke-test** — read the file back and confirm there are no syntax errors:
  ```bash
  node --check lib/content.js
  ```
  Expected: silent (no output, exit 0).

- [ ] **Step 3: Commit**
  ```bash
  git add lib/content.js
  git commit -m "feat(content): supabase loader + legacy-shape adapter"
  ```

---

## Task 3: Wrap `data.js` so it becomes a *fallback*, not the live source

**Files:**
- Modify: `data.js`

The current last line is:
```js
window.SHIFT_DATA = { LIFELINES, DIFFICULTIES, CATEGORIES };
```

Change it to expose the same payload under a different name, so `lib/content.js` can use it as a fallback without overwriting the Supabase-loaded one.

- [ ] **Step 1: Edit `data.js` last line**

Replace:
```js
window.SHIFT_DATA = { LIFELINES, DIFFICULTIES, CATEGORIES };
```

with:
```js
// Phase 2: data.js is now a *fallback*. lib/content.js is the live loader.
// We expose the payload under __SHIFT_FALLBACK so lib/content.js can read it,
// and *also* keep the legacy global so opening the file directly still works.
window.__SHIFT_FALLBACK = { LIFELINES, DIFFICULTIES, CATEGORIES };
if (!window.SHIFT_DATA) window.SHIFT_DATA = window.__SHIFT_FALLBACK;
```

The `if (!window.SHIFT_DATA)` guard means: if the page is opened *without* the new bootstrap (e.g., someone loads index.html with file:// and Supabase is unreachable), the legacy global still gets set and the game still plays.

- [ ] **Step 2: Commit**
  ```bash
  git add data.js
  git commit -m "refactor(data): expose payload as __SHIFT_FALLBACK; legacy global is now conditional"
  ```

---

## Task 4: Wire up the new boot order in `index.html`

**Files:**
- Modify: `index.html`

The current bottom of `index.html`:
```html
<script src="data.js"></script>
<script src="app.js"></script>
```

Replace with this load order:
1. `data.js` — defines fallback (synchronous).
2. `@supabase/supabase-js` — CDN.
3. `lib/supabase.js` — defines `window.SHIFT_SB` and the client.
4. `lib/content.js` — kicks off the boot promise and assigns final `window.SHIFT_DATA`.
5. A tiny inline bootstrap script that awaits `window.SHIFT_CONTENT_READY`, hides the boot overlay, then injects `app.js`.

- [ ] **Step 1: Edit `index.html`**

Replace the two existing `<script>` tags at the bottom of the file with:

```html
<!-- Boot overlay (hidden once content is ready) -->
<div id="boot" class="boot-overlay" aria-hidden="false">
  <img src="assets/logo/shift-coral.png" alt="" class="boot-overlay__logo" />
  <p class="boot-overlay__msg">جاري تحميل الأسئلة…</p>
</div>

<!-- 1) Fallback bundle (synchronous) -->
<script src="data.js"></script>

<!-- 2) Supabase SDK -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<!-- 3) Project Supabase client -->
<script src="lib/supabase.js"></script>

<!-- 4) Loader — reshapes Supabase tree into window.SHIFT_DATA -->
<script src="lib/content.js"></script>

<!-- 5) Bootstrap: wait for content, then inject app.js -->
<script>
  (async () => {
    try { await window.SHIFT_CONTENT_READY; }
    catch (e) { console.error("[shift] boot failed", e); }
    document.getElementById("boot")?.setAttribute("aria-hidden", "true");
    const s = document.createElement("script");
    s.src = "app.js";
    document.body.appendChild(s);
  })();
</script>
```

- [ ] **Step 2: Commit**
  ```bash
  git add index.html
  git commit -m "feat(boot): load content from Supabase before booting app.js; keep data.js as fallback"
  ```

---

## Task 5: Add the loader overlay styles

**Files:**
- Modify: `styles.css`

- [ ] **Step 1: Append to `styles.css`**

```css
/* ===== boot overlay (Phase 2) ===== */
.boot-overlay{
  position:fixed; inset:0; z-index:9999;
  background:#0c0c0c;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:18px;
  transition:opacity .25s ease, visibility .25s ease;
}
.boot-overlay[aria-hidden="true"]{ opacity:0; visibility:hidden; pointer-events:none; }
.boot-overlay__logo{ width:120px; height:auto; opacity:.92; }
.boot-overlay__msg{
  font-family:"FjallaOne", system-ui, sans-serif;
  color:#f1f1f1; font-size:18px; letter-spacing:.5px; margin:0;
}
```

- [ ] **Step 2: Commit**
  ```bash
  git add styles.css
  git commit -m "feat(ui): boot-overlay style for content load"
  ```

---

## Task 6: Smoke-test in the browser (live load)

**Files:** none

- [ ] **Step 1: Hard-refresh the game**

In the browser open `http://127.0.0.1:5500/index.html` and hit ⌘⇧R. You should briefly see the boot overlay ("جاري تحميل الأسئلة…") then the landing page.

- [ ] **Step 2: Confirm the data came from Supabase**

In the JS console:
```js
window.SHIFT_DATA.CATEGORIES.length;                 // 18
window.SHIFT_DATA.CATEGORIES[0];                     // has id (UUID), group, name, emoji, questions
window.SHIFT_DATA.CATEGORIES[0].questions[0];        // {d, q, a}
```

You should *also* see in the console:
```
[shift] loaded 18 categories from Supabase
```

If you see `falling back to data.js bundle` instead, Supabase wasn't reachable — fix it before continuing (re-check the anon key, check Supabase dashboard status).

- [ ] **Step 3: Play one full round**

Click "ابدأ لعبة جديدة" → set up two teams → pick 6 categories → answer one easy question per team → confirm scores update and the board renders correctly.

If anything is off (missing emoji, wrong order, broken question text), the reshape mapping in `lib/content.js` Step 1 is wrong — fix and re-test.

- [ ] **Step 4: Verify fallback**

Temporarily break the network: open DevTools → Network → set throttling to **"Offline"** → hard-refresh.

Expected: console shows `falling back to data.js bundle`, and the game still loads with the static questions from `data.js`. Restore Network and re-test.

If fallback doesn't kick in, `lib/content.js` Step 1 is silently failing — check the `try/catch` flow.

---

## Task 7: Make the change live in a quick A/B difference test (optional but recommended)

**Files:** none

This is a one-time confidence check that the game behaves identically on Supabase content vs. the bundled fallback.

- [ ] **Step 1: Capture a baseline**

In a fresh incognito window, hard-refresh `index.html`, set up the same two team names ("A" / "B"), pick the **first 6 categories in the same order**, and screenshot the category-grid. Save as `docs/superpowers/screenshots/2026-04-25-supabase-grid.png` (or anywhere).

- [ ] **Step 2: Force fallback and compare**

Open DevTools → Network → "Offline" → hard-refresh and repeat the same setup. Screenshot the same grid. They should be **visually identical** (same category names, same emojis, same Arabic order).

If they differ:
- Different category order → check the `order_index` values in Supabase (`select id, name, order_index from categories order by section_id, order_index;`). Re-run the migration if needed (idempotent).
- Different emojis or names → some category was edited in one place and not the other. Treat the database as source of truth and re-import.

- [ ] **Step 3: No commit** — this is a verification step, not a code step.

---

## Task 8: Final cleanup & tag

**Files:** none

- [ ] **Step 1: Confirm tree is clean**

```bash
git status              # clean
git log --oneline | head -8
```

You should see, top-to-bottom:
```
… feat(ui): boot-overlay style for content load
… feat(boot): load content from Supabase before booting app.js; keep data.js as fallback
… refactor(data): expose payload as __SHIFT_FALLBACK; legacy global is now conditional
… feat(content): supabase loader + legacy-shape adapter
… (Phase 1 commits)
```

- [ ] **Step 2: Tag**

```bash
git tag -a v0.2-phase2 -m "Phase 2: game reads questions from Supabase, falls back to data.js"
```

- [ ] **Step 3: Phase 2 success criteria**

✓ Hard-refresh shows the boot overlay briefly, then the landing.
✓ Console logs `[shift] loaded 18 categories from Supabase`.
✓ All 18 categories appear in the grid with correct names and emojis.
✓ A full round plays without errors.
✓ With Network=Offline, console logs `falling back to data.js bundle` and the game still works.
✓ `app.js` was not modified (`git log -- app.js` still ends at the Phase 1 commit).

---

## What's NOT in this phase

- **`admin.html`, magic-link sign-in UX, allowlist gate** → Phase 3.
- **CRUD UI for sections/categories/questions** → Phase 4.
- **Media uploads (images/video on prompts and answers)** → Phase 5.
- **Confirmation modals, search, drag-to-reorder** → Phase 6.
- **Caching the Supabase response in localStorage for instant boot** → deferred. Add only if real users complain about the boot delay.

After Task 8 ships, ask Claude to write Phase 3's plan.
