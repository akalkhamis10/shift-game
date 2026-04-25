# Phase 3 — Admin Shell + Magic-Link Auth + Allowlist Gate

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up an `admin.html` page that any admin can sign in to via magic link. The page checks the `admins` allowlist after sign-in and renders one of three clearly-distinguished states. No CRUD yet — that's Phase 4. The deliverable is the **gate**, not the dashboard behind it.

**Architecture:** A second top-level HTML page (`admin.html`) reusing `lib/supabase.js` from Phase 1. State is driven entirely by Supabase Auth + a single allowlist check. Three view states, switched via `data-state` on the `<body>`:

1. `state-pending` — checking session (very brief).
2. `state-signed-out` — sign-in form (email + magic-link button).
3. `state-not-authorized` — signed in but not in `admins` allowlist; sign-out button + helpful copy.
4. `state-authorized` — signed in **and** in allowlist; placeholder pane that says "CRUD coming in Phase 4" + sign-out + signed-in-as banner.

Player-facing `index.html` is **not modified** in this phase. Game keeps reading content via Phase 2's flow.

**Tech Stack:** Same as before — vanilla JS, no build step, `@supabase/supabase-js@2` via CDN, `lib/supabase.js`.

**Spec:** [docs/superpowers/specs/2026-04-25-admin-dashboard-design.md](../specs/2026-04-25-admin-dashboard-design.md) §8 (Auth flow) and §9 (Admin UI shell).

**Depends on:** `v0.2-phase2` tag must be in place.

---

## File Structure

| Path | Responsibility |
|------|---------------|
| `admin.html` | New. Three-state shell — signed-out form, locked-out screen, authorized placeholder. |
| `admin.css` | New. Admin-only styles. Reuse colors/font from `styles.css` where possible. |
| `admin.js` | New. Auth flow: send magic link, handle redirect, allowlist check, state machine. |

No backend changes (Phase 1 already shipped `admins` table, `read_self` RLS policy, and the owner row).

---

## Pre-flight: Information you need before starting

Before Task 1, confirm:

1. `git tag` lists `v0.2-phase2`.
2. The owner row exists:
   ```sql
   select email, role from admins;
   ```
   Expected: `director83ak@gmail.com | owner`.
3. `tools/migrate.html` still works (sanity check — the same auth flow we'll reuse). Open it, send a magic link, click it, confirm "✓ admin" status appears.

---

## Task 1: Lock down the state machine

**Files:** none (mental model + visual sketch)

The auth flow has exactly four observable states. The whole admin shell switches on a single attribute: `<body data-state="...">`.

| `data-state`         | Trigger                                                 | What's visible                              |
|----------------------|---------------------------------------------------------|---------------------------------------------|
| `pending`            | Default while we call `auth.getSession()` + `isAdmin()` | Spinner + "جاري التحقق…"                    |
| `signed-out`         | No session                                              | Email input + "أرسل رابط الدخول" button     |
| `not-authorized`     | Session, but `admins` row missing                       | Lock icon + signed-in email + "تسجيل خروج"  |
| `authorized`         | Session **and** `admins` row present                    | "Phase 4 CRUD coming soon" + topbar + sign-out |

CSS uses sibling-selectors based on `data-state`: each state's `<section>` is hidden by default and only the matching one is shown. This keeps `admin.js` tiny — it just sets one attribute.

- [ ] **Step 1:** Sanity-think: does any UI element appear in *more* than one state? Yes — the topbar (logo + signed-in email + sign-out button) appears in both `not-authorized` and `authorized`. Hide it in `pending` and `signed-out` via CSS, share the markup.

No commit for this task.

---

## Task 2: Create `admin.html`

**Files:**
- Create: `admin.html`

- [ ] **Step 1: Create `admin.html`**

```html
<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<title>SHIFT — لوحة الإدارة</title>
<link rel="stylesheet" href="styles.css" />
<link rel="stylesheet" href="admin.css" />
<link rel="icon" href="assets/logo/shift-coral.png" />
</head>
<body data-state="pending">

  <!-- Top bar (only visible in not-authorized + authorized states) -->
  <header class="adm-top">
    <img class="adm-top__logo" src="assets/logo/shift-coral.png" alt="SHIFT" />
    <span class="adm-top__title">لوحة الإدارة</span>
    <span class="adm-top__email" id="admEmail" aria-live="polite"></span>
    <button class="btn btn--ghost" id="admSignOut">تسجيل خروج</button>
  </header>

  <main class="adm-main">

    <!-- pending -->
    <section class="adm-card adm-card--pending" data-show="pending">
      <div class="adm-spinner" aria-hidden="true"></div>
      <p class="adm-msg">جاري التحقق من الجلسة…</p>
    </section>

    <!-- signed-out -->
    <section class="adm-card adm-card--signin" data-show="signed-out">
      <h1 class="adm-h">تسجيل دخول الإدارة</h1>
      <p class="adm-sub">سنرسل رابط دخول إلى بريدك الإلكتروني.</p>
      <form id="admSigninForm" class="adm-form" novalidate>
        <label class="adm-label" for="admEmailInput">البريد الإلكتروني</label>
        <input class="adm-input" id="admEmailInput" type="email" inputmode="email"
               autocomplete="email" placeholder="you@example.com" required />
        <button class="btn btn--primary btn--xl" type="submit" id="admSendLink">
          أرسل رابط الدخول
        </button>
      </form>
      <p class="adm-status" id="admSigninStatus" role="status" aria-live="polite"></p>
    </section>

    <!-- not-authorized -->
    <section class="adm-card adm-card--locked" data-show="not-authorized">
      <div class="adm-lock" aria-hidden="true">🔒</div>
      <h1 class="adm-h">حسابك غير مُصرَّح له</h1>
      <p class="adm-sub">
        تم تسجيل دخولك، لكن هذا البريد ليس على قائمة المسؤولين.
        <br />
        تواصل مع المالك لإضافتك، ثم أعد تسجيل الدخول.
      </p>
    </section>

    <!-- authorized (Phase 3 placeholder; Phase 4 fills this in) -->
    <section class="adm-card adm-card--ok" data-show="authorized">
      <h1 class="adm-h">أهلاً بك 👋</h1>
      <p class="adm-sub">سيتم تفعيل تحرير الفئات والأسئلة في المرحلة القادمة.</p>
      <div class="adm-stub">
        <strong>قادم في المرحلة 4:</strong>
        <ul>
          <li>إدارة الأقسام والفئات</li>
          <li>تحرير الأسئلة والإجابات</li>
          <li>رفع صور وفيديو وصوت</li>
        </ul>
      </div>
    </section>

  </main>

  <!-- Supabase SDK + project client (same as game) -->
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="lib/supabase.js"></script>
  <script src="admin.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add admin.html
git commit -m "feat(admin): admin.html shell with four auth-state sections"
```

---

## Task 3: Create `admin.css`

**Files:**
- Create: `admin.css`

The visual goal: feels related to the game (coral accent, FjallaOne font for headers if loaded), but distinct enough that the admin can never be confused with the player UI.

- [ ] **Step 1: Create `admin.css`**

```css
/* ===== Phase 3 admin shell ===== */
:root {
  --adm-bg:      #faf6f3;
  --adm-fg:      #1a1a1a;
  --adm-muted:   #6b6b6b;
  --adm-card:    #ffffff;
  --adm-border:  rgba(0,0,0,.08);
  --adm-coral:   #e76f6b;
  --adm-coral-d: #c95652;
  --adm-warn:    #f1c40f;
  --adm-shadow:  0 12px 40px rgba(0,0,0,.08);
}

html, body { margin: 0; padding: 0; }
body {
  font-family: system-ui, -apple-system, "Segoe UI", Tahoma, Arial, sans-serif;
  background: var(--adm-bg);
  color: var(--adm-fg);
  min-height: 100vh;
}

/* state visibility — one section visible at a time */
[data-show] { display: none; }
body[data-state="pending"]        [data-show="pending"]        { display: flex; }
body[data-state="signed-out"]     [data-show="signed-out"]     { display: flex; }
body[data-state="not-authorized"] [data-show="not-authorized"] { display: flex; }
body[data-state="authorized"]     [data-show="authorized"]     { display: flex; }

/* topbar visible only after a session exists (not + authorized states) */
.adm-top { display: none; }
body[data-state="not-authorized"] .adm-top,
body[data-state="authorized"]     .adm-top { display: flex; }

.adm-top {
  align-items: center; gap: 12px;
  padding: 14px 22px;
  background: var(--adm-card);
  border-bottom: 1px solid var(--adm-border);
  position: sticky; top: 0; z-index: 10;
}
.adm-top__logo  { height: 28px; width: auto; }
.adm-top__title { font-weight: 700; letter-spacing: .3px; }
.adm-top__email { color: var(--adm-muted); font-size: 14px; margin-inline-start: auto; }

/* main + cards */
.adm-main {
  display: flex; align-items: center; justify-content: center;
  padding: 48px 16px;
  min-height: calc(100vh - 60px);
}
.adm-card {
  background: var(--adm-card);
  border: 1px solid var(--adm-border);
  border-radius: 16px;
  box-shadow: var(--adm-shadow);
  padding: 40px;
  width: min(560px, 92vw);
  flex-direction: column;
  gap: 14px;
  text-align: center;
}
.adm-h   { margin: 0; font-size: 26px; }
.adm-sub { margin: 0; color: var(--adm-muted); line-height: 1.6; }

/* signin form */
.adm-form  { display: flex; flex-direction: column; gap: 12px; margin-top: 14px; text-align: start; }
.adm-label { font-size: 13px; color: var(--adm-muted); }
.adm-input {
  font: inherit;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid var(--adm-border);
  background: #fff;
}
.adm-input:focus {
  outline: 2px solid var(--adm-coral);
  outline-offset: 1px;
}
.adm-status { min-height: 22px; margin: 6px 0 0; font-size: 14px; }
.adm-status.is-ok  { color: #2a8e60; }
.adm-status.is-bad { color: var(--adm-coral-d); }

/* spinner */
.adm-spinner {
  width: 36px; height: 36px;
  border: 3px solid rgba(0,0,0,.1);
  border-top-color: var(--adm-coral);
  border-radius: 50%;
  animation: adm-spin .9s linear infinite;
  margin: 0 auto;
}
@keyframes adm-spin { to { transform: rotate(360deg); } }

/* lock screen */
.adm-lock { font-size: 56px; line-height: 1; }

/* authorized stub */
.adm-stub {
  margin-top: 14px;
  padding: 16px 18px;
  background: rgba(231, 111, 107, 0.08);
  border: 1px dashed var(--adm-coral);
  border-radius: 12px;
  text-align: start;
}
.adm-stub ul { margin: 8px 0 0; padding-inline-start: 20px; }
.adm-stub li { margin: 4px 0; }
```

- [ ] **Step 2: Commit**

```bash
git add admin.css
git commit -m "feat(admin): admin shell styles with four state-driven cards"
```

---

## Task 4: Create `admin.js`

**Files:**
- Create: `admin.js`

This file is the entire auth state machine. It does three things:

1. On load, set `data-state="pending"`, then call `auth.getSession()` + `isAdmin()` and set the right state.
2. On `auth.onAuthStateChange`, re-evaluate.
3. Wire the sign-in form and sign-out button.

- [ ] **Step 1: Create `admin.js`**

```js
// Phase 3: admin shell auth state machine.
// Reads window.SHIFT_SB (defined by lib/supabase.js).

(() => {
  "use strict";
  if (!window.SHIFT_SB) {
    document.body.setAttribute("data-state", "signed-out");
    document.getElementById("admSigninStatus").textContent =
      "خطأ: لم يتم تحميل عميل قاعدة البيانات.";
    return;
  }

  const { auth, client } = window.SHIFT_SB;
  const $ = (id) => document.getElementById(id);

  function setState(state) {
    document.body.setAttribute("data-state", state);
  }
  function setStatus(msg, kind = "") {
    const el = $("admSigninStatus");
    el.textContent = msg || "";
    el.classList.remove("is-ok", "is-bad");
    if (kind) el.classList.add(kind);
  }

  async function evaluate() {
    try {
      const email = await auth.currentEmail();
      if (!email) { setState("signed-out"); return; }

      // We have a session. Show the topbar email immediately.
      $("admEmail").textContent = email;

      const ok = await auth.isAdmin();
      setState(ok ? "authorized" : "not-authorized");
    } catch (err) {
      console.error("[admin] state evaluation failed:", err);
      setStatus("تعذّر التحقق من الجلسة. حاول التحديث.", "is-bad");
      setState("signed-out");
    }
  }

  // Sign-in form
  $("admSigninForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("admEmailInput").value.trim();
    if (!email) { setStatus("أدخل بريدك الإلكتروني.", "is-bad"); return; }

    const btn = $("admSendLink");
    btn.disabled = true;
    setStatus("جاري الإرسال…");
    try {
      await auth.signInWithEmail(email);
      setStatus(`تم إرسال الرابط إلى ${email} — تحقق من بريدك ثم اضغط على الرابط.`, "is-ok");
    } catch (err) {
      setStatus(`خطأ: ${err.message || err}`, "is-bad");
    } finally {
      btn.disabled = false;
    }
  });

  // Sign-out button (visible only in non-pending+non-signed-out states)
  $("admSignOut").addEventListener("click", async () => {
    try {
      await auth.signOut();
      setStatus("");
      setState("signed-out");
    } catch (err) {
      console.error("[admin] sign-out failed:", err);
    }
  });

  // Listen to all auth state changes (including the magic-link redirect).
  client.auth.onAuthStateChange(() => evaluate());

  // Initial check
  evaluate();
})();
```

- [ ] **Step 2: Static smoke-test**

```bash
node --check admin.js
```

Expected: silent (no output, exit 0).

- [ ] **Step 3: Commit**

```bash
git add admin.js
git commit -m "feat(admin): magic-link auth flow with allowlist gate"
```

---

## Task 5: Manual smoke-test — `signed-out` and sign-in flow

**Files:** none

- [ ] **Step 1: Open the page (signed out)**

If you're still signed in from earlier testing, sign out first:
- Open `http://127.0.0.1:5500/tools/migrate.html` and click **Sign out**, OR
- Open the browser dev console on `http://127.0.0.1:5500/admin.html` and run `await SHIFT_SB.auth.signOut()`, then refresh.

Now open `http://127.0.0.1:5500/admin.html`. The card should briefly show "جاري التحقق…" then settle on the **sign-in** card.

If it lands on **authorized** instead, you still have a session — sign out and refresh.

- [ ] **Step 2: Send a magic link**

Type `director83ak@gmail.com` into the input and click "أرسل رابط الدخول".

Expected: status text turns green: "تم إرسال الرابط إلى director83ak@gmail.com — تحقق من بريدك ثم اضغط على الرابط."

If you see "For security purposes, you can only request this after N seconds." — Supabase's per-email rate limit. Wait the indicated time and try again.

- [ ] **Step 3: Click the magic link in your email**

The link opens `admin.html` again, this time with a session. The page should briefly show "جاري التحقق…" then settle on the **authorized** card. Topbar should show your email.

- [ ] **Step 4: Sign out**

Click "تسجيل خروج". Card flips back to **sign-in**. Topbar disappears.

If any of the above doesn't behave, it's almost always either:
- `lib/supabase.js` URL/anon key is wrong → re-check Phase 1 Task 6.
- `admins` table empty for that email → re-run the seed SQL from Phase 1 Task 5.

---

## Task 6: Manual smoke-test — `not-authorized` flow

**Files:** none

To exercise the locked-out state without creating a second Google account, we'll temporarily remove the owner row, refresh `admin.html`, confirm the locked screen, then put the row back.

- [ ] **Step 1: Confirm you're signed in as `director83ak@gmail.com`**

Refresh `admin.html`. Should land on **authorized**.

- [ ] **Step 2: Temporarily remove yourself from `admins`**

In the Supabase SQL editor:

```sql
delete from admins where email = 'director83ak@gmail.com';
select count(*) from admins;
```

Expected: `0`.

- [ ] **Step 3: Refresh `admin.html`**

You're still signed in (the session persists), but the allowlist check now fails.

Expected:
- Card flips to **not-authorized**.
- Lock icon visible.
- Copy: "حسابك غير مُصرَّح له".
- Topbar still shows your email + sign-out button.

If you see **authorized** instead, `admin.js` Step 1's `isAdmin()` is buggy or the RLS policy isn't blocking — check `lib/supabase.js`'s `isAdmin` function and the `read_self` RLS policy.

- [ ] **Step 4: Restore yourself**

```sql
insert into admins (email, role)
values ('director83ak@gmail.com', 'owner')
on conflict (email) do update set role = excluded.role;
```

Then refresh `admin.html` — should be back to **authorized**.

If the page is still showing "not-authorized" after refreshing, there might be a stale `auth` cache. A hard refresh (⌘⇧R) usually fixes it; if not, sign out and back in.

---

## Task 7: Manual smoke-test — game still works

**Files:** none

Quick sanity check that we didn't accidentally break the player flow.

- [ ] **Step 1: Hard-refresh `http://127.0.0.1:5500/index.html`**

Game should boot exactly as in Phase 2: brief boot overlay → landing → category grid renders 18 categories from Supabase.

In the console: `[shift] loaded 18 categories from Supabase`.

- [ ] **Step 2: Confirm `app.js` still untouched**

```bash
git log --oneline -- app.js
```

Expected: only the original Phase 1 init commit. No Phase 3 commit modifies `app.js`.

---

## Task 8: Final cleanup & tag

**Files:** none

- [ ] **Step 1: Confirm tree is clean**

```bash
git status                       # clean
git log --oneline | head -8
```

Top-to-bottom of `git log --oneline` should now show:
```
… feat(admin): magic-link auth flow with allowlist gate
… feat(admin): admin shell styles with four state-driven cards
… feat(admin): admin.html shell with four auth-state sections
… (Phase 2 commits)
… (Phase 1 commits)
```

- [ ] **Step 2: Confirm no service_role leaked**

```bash
git log -p -- admin.js admin.html admin.css | grep -i service_role
```

Expected: empty output.

- [ ] **Step 3: Tag**

```bash
git tag -a v0.3-phase3 -m "Phase 3: admin shell + magic-link auth + allowlist gate"
git tag
```

- [ ] **Step 4: Phase 3 success criteria**

✓ `admin.html` loads and lands on signed-in state if session exists, sign-in form otherwise.
✓ Magic-link request shows the "sent" status.
✓ Clicking magic link flips to **authorized** if email is in `admins`.
✓ Removing the row from `admins` flips a refreshed page to **not-authorized**.
✓ Sign-out flips back to **signed-out** card.
✓ Game (`index.html`) still works unchanged.
✓ `app.js` was not modified.

---

## What's NOT in this phase

- Any actual editing UI (sections / categories / questions tables, modals) → Phase 4.
- Media uploads → Phase 5.
- Confirm-modals, search, drag-to-reorder → Phase 6.
- A "remember-me on this device" toggle (already implicitly on — we use `persistSession: true`).
- Changing the magic link redirect to a separate "callback" page (we redirect back to `admin.html` itself; simpler, fewer files).
- Suspicious-login alerts, audit log, IP allowlist (out of v1 scope per spec §3).

After Task 8 ships, ask Claude to write Phase 4's plan. Phase 4 is the big one: actual CRUD UI for sections, categories, and questions.
