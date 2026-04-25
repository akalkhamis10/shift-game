# Phase 4 — Admin CRUD (text-only)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Phase 4 placeholder" inside `admin.html`'s authorized state with a working CRUD dashboard for **sections**, **categories**, and **questions** — all text fields only. After this phase ships, the owner can add/edit/delete content from the browser without touching SQL or code, and edits show up in the game on next refresh.

**Architecture:** Three tabs inside the existing `data-state="authorized"` card. Each tab renders a table from a Supabase query and uses a single shared `<dialog>` element for create/edit modals plus a single shared confirm dialog for destructive actions. A small toast system reports success/error. We add generic CRUD helpers to `lib/supabase.js` so each tab is mostly markup + form-binding.

**What's deliberately not here:** media uploads (image/video/audio for sections/categories/questions/answers — that's Phase 5), drag-to-reorder, search/filter, batch ops (Phase 6).

**Tech Stack:** Same as before — vanilla JS, no build step, `@supabase/supabase-js@2`, `lib/supabase.js`. Native `<dialog>`. No new dependencies.

**Spec:** [docs/superpowers/specs/2026-04-25-admin-dashboard-design.md](../specs/2026-04-25-admin-dashboard-design.md) §9 (Admin UI).

**Depends on:** `v0.3-phase3` tag is in place; signing in to `admin.html` lands on the authorized card.

---

## File Structure

| Path | Responsibility |
|------|----------------|
| `lib/supabase.js` | **Modify.** Add generic CRUD helpers: `listAll(table, opts)`, `update(table, id, patch)`, `remove(table, id)`, plus `categoryQuestionCounts()` for the categories table view. |
| `admin.html` | **Modify.** Replace the authorized-state placeholder card with a tab bar + three table panels + one shared edit `<dialog>` + one shared confirm `<dialog>` + a toast container. |
| `admin.css` | **Modify.** Add ~150 lines: tabs, tables, dialog/modal, form fields, toasts. |
| `admin.js` | **Modify.** Add tab routing, table rendering, modal binding, CRUD calls, toast helper. |
| `index.html`, `app.js`, `data.js`, `lib/content.js`, `styles.css`, `tools/*` | **No changes.** Game stays untouched. |

`admin.js` will grow from ~80 → ~500 lines. That's still inside what one focused IIFE can hold; we split the file in Phase 6 if it keeps growing.

---

## Pre-flight

Before Task 1, confirm:

1. `git tag` lists `v0.3-phase3`.
2. Sign-in still works: open `http://127.0.0.1:8765/admin.html`, sign in with `director83ak@gmail.com`, page lands on the **authorized** card with the placeholder copy.
3. Supabase content tree is intact:
   ```sql
   select (select count(*) from sections) s,
          (select count(*) from categories) c,
          (select count(*) from questions) q;
   ```
   Expected: `7 | 18 | 108`.

---

## Task 1: Lock down the UX contract

**Files:** none (mental model)

The authorized view, top to bottom:

```
┌─────────────────────────────────────────────────────────────┐
│ adm-top: logo | "لوحة الإدارة" | email | [sign out]         │
├─────────────────────────────────────────────────────────────┤
│ Tab bar: [الأقسام] [الفئات] [الأسئلة]                        │
├─────────────────────────────────────────────────────────────┤
│ Toolbar: [+ إضافة]   (and, on Questions tab, two filters)   │
├─────────────────────────────────────────────────────────────┤
│ Table: striped rows, columns vary per tab.                  │
│                                                             │
│   row [  data...  ]   [ تعديل ] [ حذف ]                     │
│   row [  data...  ]   [ تعديل ] [ حذف ]                     │
│   ...                                                       │
└─────────────────────────────────────────────────────────────┘
                                                              [toast region, fixed top-end]
```

Tabs are switched by setting `data-tab="…"` on the dashboard root. CSS hides everything except the matching tab. Active tab's button gets `[aria-selected="true"]`.

**Modal contract.** One `<dialog id="admModal">` is reused for all three "create / edit" forms. JS:

- Builds the form fields appropriate to the entity (sections / categories / questions).
- Pre-fills if editing.
- On submit: calls Supabase, refreshes the active tab, closes the dialog, fires a toast.
- On error: the dialog stays open, the error message renders as a status row inside the modal.

**Confirm contract.** One `<dialog id="admConfirm">` for destructive actions. JS sets the title (e.g., "حذف الفئة "تاريخ"؟"), body ("سيُحذف 6 أسئلة معها."), and binds the Confirm button to a callback.

**Toast contract.** A `toast(msg, kind?)` helper appends a `<div class="adm-toast">` to a fixed container, auto-removes it after 3000ms. `kind` ∈ `'ok'|'bad'`.

No commit for this task.

---

## Task 2: Add generic CRUD helpers to `lib/supabase.js`

**Files:**
- Modify: `lib/supabase.js`

The current `lib/supabase.js` has `db.fetchContentTree`, `db.insertSection`, `db.insertCategory`, `db.insertQuestion`. We add update / delete + a few list helpers, exposed on the same `db` object.

- [ ] **Step 1: Patch `lib/supabase.js`**

Find this block at the bottom (around the existing `db` definition):

```js
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
```

Replace it with:

```js
  // ---- content write (used by migrate.js + admin) ----
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

  // ---- generic CRUD (Phase 4) ----
  // Allowed tables — defensive enum so a typo can never reach the server.
  const TABLES = new Set(["sections", "categories", "questions"]);
  function assertTable(t){
    if (!TABLES.has(t)) throw new Error(`unknown table: ${t}`);
  }

  // listAll(table, { eq, order, select })
  // - eq:    { col: value } filters
  // - order: array of { col, ascending? } applied in order
  // - select: comma-separated columns or relation, default "*"
  async function listAll(table, opts = {}){
    assertTable(table);
    let q = client.from(table).select(opts.select || "*");
    if (opts.eq) for (const [col, val] of Object.entries(opts.eq)) q = q.eq(col, val);
    for (const o of (opts.order || [{ col: "order_index" }])){
      q = q.order(o.col, { ascending: o.ascending !== false });
    }
    const { data, error } = await q;
    if (error) throw error;
    return data;
  }

  async function update(table, id, patch){
    assertTable(table);
    const { data, error } = await client.from(table).update(patch).eq("id", id).select().single();
    if (error) throw error;
    return data;
  }

  async function remove(table, id){
    assertTable(table);
    const { error } = await client.from(table).delete().eq("id", id);
    if (error) throw error;
    return { id };
  }

  // For the Categories tab — a quick map { category_id: question_count } so the
  // table can show "6 سؤال" without a per-row query.
  async function categoryQuestionCounts(){
    const { data, error } = await client.from("questions").select("category_id");
    if (error) throw error;
    const counts = new Map();
    for (const r of data) counts.set(r.category_id, (counts.get(r.category_id) || 0) + 1);
    return counts;
  }

  window.SHIFT_SB = {
    client,
    auth: { signInWithEmail, signOut, currentEmail, isAdmin },
    db:   {
      fetchContentTree,
      insertSection, insertCategory, insertQuestion,
      listAll, update, remove,
      categoryQuestionCounts
    }
  };
```

- [ ] **Step 2: Static smoke-test**

```bash
node --check lib/supabase.js
```

Expected: silent (exit 0).

- [ ] **Step 3: Commit**

```bash
git add lib/supabase.js
git commit -m "feat(lib): generic listAll/update/remove + category question counts"
```

---

## Task 3: Replace the authorized placeholder in `admin.html`

**Files:**
- Modify: `admin.html`

Find this block:

```html
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
```

- [ ] **Step 1: Replace the entire `<section data-show="authorized">` block above with:**

```html
    <!-- authorized — Phase 4 dashboard -->
    <section class="adm-dash" data-show="authorized" data-tab="sections">

      <!-- Tab bar -->
      <nav class="adm-tabs" role="tablist" aria-label="أقسام لوحة الإدارة">
        <button class="adm-tab" data-tab-target="sections"   role="tab" aria-selected="true">الأقسام</button>
        <button class="adm-tab" data-tab-target="categories" role="tab" aria-selected="false">الفئات</button>
        <button class="adm-tab" data-tab-target="questions"  role="tab" aria-selected="false">الأسئلة</button>
      </nav>

      <!-- Sections panel -->
      <div class="adm-panel" data-tab-panel="sections" role="tabpanel">
        <div class="adm-toolbar">
          <button class="btn btn--primary" id="admAddSection">+ إضافة قسم</button>
        </div>
        <table class="adm-table">
          <thead><tr><th>الاسم</th><th>عدد الفئات</th><th></th></tr></thead>
          <tbody id="admSectionsBody"><tr class="adm-empty"><td colspan="3">جاري التحميل…</td></tr></tbody>
        </table>
      </div>

      <!-- Categories panel -->
      <div class="adm-panel" data-tab-panel="categories" role="tabpanel" hidden>
        <div class="adm-toolbar">
          <label class="adm-filter">
            <span>القسم:</span>
            <select id="admCatFilterSection"><option value="">الكل</option></select>
          </label>
          <button class="btn btn--primary" id="admAddCategory">+ إضافة فئة</button>
        </div>
        <table class="adm-table">
          <thead><tr><th>القسم</th><th>الفئة</th><th>الأيقونة</th><th>عدد الأسئلة</th><th></th></tr></thead>
          <tbody id="admCategoriesBody"><tr class="adm-empty"><td colspan="5">جاري التحميل…</td></tr></tbody>
        </table>
      </div>

      <!-- Questions panel -->
      <div class="adm-panel" data-tab-panel="questions" role="tabpanel" hidden>
        <div class="adm-toolbar">
          <label class="adm-filter">
            <span>القسم:</span>
            <select id="admQFilterSection"><option value="">الكل</option></select>
          </label>
          <label class="adm-filter">
            <span>الفئة:</span>
            <select id="admQFilterCategory"><option value="">الكل</option></select>
          </label>
          <button class="btn btn--primary" id="admAddQuestion">+ إضافة سؤال</button>
        </div>
        <table class="adm-table">
          <thead><tr><th>الفئة</th><th>المستوى</th><th>السؤال</th><th></th></tr></thead>
          <tbody id="admQuestionsBody"><tr class="adm-empty"><td colspan="4">جاري التحميل…</td></tr></tbody>
        </table>
      </div>

    </section>
```

- [ ] **Step 2: At the very bottom of the body, just before the `<script>` tags, add the shared dialogs and toast container:**

Find the `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>` line. **Immediately above it**, insert:

```html
    <!-- Shared edit dialog (sections / categories / questions) -->
    <dialog class="adm-modal" id="admModal" aria-labelledby="admModalTitle">
      <form method="dialog" id="admModalForm">
        <header class="adm-modal__head">
          <h2 class="adm-modal__title" id="admModalTitle">—</h2>
          <button type="button" class="adm-modal__close" id="admModalClose" aria-label="إغلاق">×</button>
        </header>
        <div class="adm-modal__body" id="admModalBody"><!-- form fields injected by admin.js --></div>
        <p class="adm-modal__status" id="admModalStatus" role="status" aria-live="polite"></p>
        <footer class="adm-modal__foot">
          <button type="button" class="btn" id="admModalCancel">إلغاء</button>
          <button type="submit" class="btn btn--primary" id="admModalSave">حفظ</button>
        </footer>
      </form>
    </dialog>

    <!-- Shared confirm dialog -->
    <dialog class="adm-modal adm-modal--confirm" id="admConfirm" aria-labelledby="admConfirmTitle">
      <form method="dialog">
        <header class="adm-modal__head">
          <h2 class="adm-modal__title" id="admConfirmTitle">—</h2>
        </header>
        <div class="adm-modal__body" id="admConfirmBody">—</div>
        <footer class="adm-modal__foot">
          <button type="button" class="btn" id="admConfirmCancel">إلغاء</button>
          <button type="submit" class="btn adm-danger" id="admConfirmOk">حذف</button>
        </footer>
      </form>
    </dialog>

    <!-- Toasts -->
    <div class="adm-toasts" id="admToasts" aria-live="polite" aria-atomic="false"></div>

```

- [ ] **Step 3: Commit**

```bash
git add admin.html
git commit -m "feat(admin): replace placeholder with dashboard shell — tabs, tables, dialogs, toasts"
```

---

## Task 4: Add CSS for tabs, tables, modals, toasts

**Files:**
- Modify: `admin.css`

- [ ] **Step 1: Append to `admin.css`**

```css
/* ===== Phase 4 dashboard ===== */

/* Adjust the authorized card to be a wide dashboard instead of a centered card. */
.adm-dash {
  width: min(1200px, 96vw);
  margin: 24px auto;
  background: var(--adm-card);
  border: 1px solid var(--adm-border);
  border-radius: 16px;
  box-shadow: var(--adm-shadow);
  padding: 0;
  display: flex;
  flex-direction: column;
}

/* Tab bar */
.adm-tabs {
  display: flex; gap: 0;
  border-bottom: 1px solid var(--adm-border);
  padding: 0 12px;
}
.adm-tab {
  appearance: none; background: transparent; border: 0;
  padding: 14px 18px;
  font: inherit; font-weight: 700;
  color: var(--adm-muted);
  cursor: pointer;
  border-bottom: 3px solid transparent;
  margin-bottom: -1px;
}
.adm-tab[aria-selected="true"] {
  color: var(--adm-fg);
  border-bottom-color: var(--adm-coral);
}
.adm-tab:hover { color: var(--adm-fg); }

/* Panel — only the matching one is visible */
.adm-panel { padding: 18px 22px; }
.adm-dash[data-tab="sections"]    .adm-panel[data-tab-panel="sections"]    { display: block; }
.adm-dash[data-tab="categories"]  .adm-panel[data-tab-panel="categories"]  { display: block; }
.adm-dash[data-tab="questions"]   .adm-panel[data-tab-panel="questions"]   { display: block; }
.adm-panel[hidden] { display: none !important; }
.adm-dash[data-tab="sections"]    .adm-panel:not([data-tab-panel="sections"])   { display: none; }
.adm-dash[data-tab="categories"]  .adm-panel:not([data-tab-panel="categories"]) { display: none; }
.adm-dash[data-tab="questions"]   .adm-panel:not([data-tab-panel="questions"])  { display: none; }

/* Toolbar */
.adm-toolbar {
  display: flex; align-items: center; gap: 12px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.adm-toolbar > .btn { margin-inline-start: auto; }
.adm-filter {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 14px; color: var(--adm-muted);
}
.adm-filter select {
  font: inherit;
  padding: 7px 10px;
  border: 1px solid var(--adm-border);
  border-radius: 8px;
  background: #fff;
  min-width: 140px;
}

/* Table */
.adm-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.adm-table thead th {
  text-align: start;
  padding: 10px 12px;
  border-bottom: 1px solid var(--adm-border);
  color: var(--adm-muted);
  font-weight: 700;
}
.adm-table tbody td {
  padding: 12px;
  border-bottom: 1px solid var(--adm-border);
  vertical-align: middle;
}
.adm-table tbody tr:hover { background: rgba(0,0,0,.02); }
.adm-empty td {
  text-align: center;
  color: var(--adm-muted);
  padding: 28px 12px;
}
.adm-row-actions {
  display: inline-flex; gap: 8px;
}
.adm-row-actions .btn { padding: 6px 10px; font-size: 13px; }
.adm-pill {
  display: inline-block;
  font-size: 12px;
  padding: 3px 9px;
  border-radius: 999px;
  background: rgba(0,0,0,.05);
  color: var(--adm-muted);
}
.adm-pill--easy   { background: #e2f4ec; color: #2a8e60; }
.adm-pill--medium { background: #fef3d6; color: #b07b00; }
.adm-pill--hard   { background: #fbe1e0; color: var(--adm-coral-d); }

/* Buttons used in tables */
.adm-danger {
  background: var(--adm-coral); color: #fff;
}
.adm-danger:hover { background: var(--adm-coral-d); }

/* Modal */
.adm-modal {
  border: 0;
  border-radius: 16px;
  padding: 0;
  width: min(560px, 92vw);
  max-height: 88vh;
  box-shadow: 0 24px 80px rgba(0,0,0,.18);
}
.adm-modal::backdrop { background: rgba(0,0,0,.45); }
.adm-modal form { display: flex; flex-direction: column; max-height: 88vh; }
.adm-modal__head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid var(--adm-border);
}
.adm-modal__title { margin: 0; font-size: 18px; }
.adm-modal__close {
  appearance: none; background: transparent; border: 0;
  font-size: 24px; line-height: 1;
  width: 32px; height: 32px; border-radius: 8px;
  cursor: pointer; color: var(--adm-muted);
}
.adm-modal__close:hover { background: rgba(0,0,0,.05); color: var(--adm-fg); }
.adm-modal__body {
  padding: 18px 22px;
  overflow: auto;
  display: flex; flex-direction: column; gap: 14px;
}
.adm-modal__status { padding: 0 22px; min-height: 22px; margin: 0; font-size: 14px; }
.adm-modal__status.is-bad { color: var(--adm-coral-d); }
.adm-modal__status.is-ok  { color: #2a8e60; }
.adm-modal__foot {
  display: flex; gap: 10px; justify-content: flex-end;
  padding: 14px 22px;
  border-top: 1px solid var(--adm-border);
  background: rgba(0,0,0,.02);
}
.adm-modal--confirm .adm-modal__body { color: var(--adm-fg); }

/* Modal form fields */
.adm-field { display: flex; flex-direction: column; gap: 6px; }
.adm-field label { font-size: 13px; color: var(--adm-muted); }
.adm-field input,
.adm-field select,
.adm-field textarea {
  font: inherit;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--adm-border);
  background: #fff;
  width: 100%;
  box-sizing: border-box;
}
.adm-field textarea { min-height: 90px; resize: vertical; }
.adm-field input:focus,
.adm-field select:focus,
.adm-field textarea:focus {
  outline: 2px solid var(--adm-coral);
  outline-offset: 1px;
}

/* Toasts */
.adm-toasts {
  position: fixed;
  top: 18px; inset-inline-end: 18px;
  display: flex; flex-direction: column; gap: 8px;
  z-index: 1000;
  pointer-events: none;
}
.adm-toast {
  background: #1a1a1a;
  color: #fff;
  border-radius: 10px;
  padding: 12px 16px;
  min-width: 220px;
  box-shadow: 0 12px 30px rgba(0,0,0,.18);
  font-size: 14px;
  animation: adm-toast-in .18s ease;
}
.adm-toast--ok  { background: #1f7a5a; }
.adm-toast--bad { background: var(--adm-coral-d); }
@keyframes adm-toast-in {
  from { transform: translateY(-6px); opacity: 0; }
  to   { transform: none;             opacity: 1; }
}
```

- [ ] **Step 2: Commit**

```bash
git add admin.css
git commit -m "feat(admin): styles for tabs, tables, modals, toasts"
```

---

## Task 5: Wire tabs, toasts, modal helpers in `admin.js`

**Files:**
- Modify: `admin.js`

This task adds the dashboard infrastructure inside the existing IIFE — anything that's not entity-specific. The next three tasks each add one entity's logic.

- [ ] **Step 1: Open `admin.js` and find the line:**

```js
  // Initial check
  evaluate();
})();
```

**Insert** the following block **immediately above** that line (so it's still inside the IIFE):

```js
  /* ============================================================
   * Phase 4 — dashboard (tabs / table / modal / toast helpers)
   * ============================================================ */

  const dash = document.querySelector(".adm-dash");

  // ---- toasts ----
  function toast(msg, kind /* 'ok' | 'bad' | undefined */){
    const wrap = $("admToasts");
    if (!wrap) return;
    const el = document.createElement("div");
    el.className = "adm-toast" + (kind ? ` adm-toast--${kind}` : "");
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  // ---- modal ----
  // openEditModal({ title, fields, initial, onSave })
  //   fields: array of { name, label, type ('text'|'textarea'|'select'|'number'), required?, options? }
  //   initial: { name: value }
  //   onSave: async (values) => void  — throw to keep open + render error
  function openEditModal({ title, fields, initial = {}, onSave }){
    const dlg = $("admModal");
    const body = $("admModalBody");
    const status = $("admModalStatus");
    const form = $("admModalForm");

    $("admModalTitle").textContent = title;
    status.textContent = ""; status.classList.remove("is-bad","is-ok");
    body.innerHTML = "";

    for (const f of fields){
      const wrap = document.createElement("div");
      wrap.className = "adm-field";
      const id = `admField_${f.name}`;
      let control;
      if (f.type === "textarea"){
        control = document.createElement("textarea");
      } else if (f.type === "select"){
        control = document.createElement("select");
        for (const opt of (f.options || [])){
          const o = document.createElement("option");
          o.value = opt.value;
          o.textContent = opt.label;
          control.appendChild(o);
        }
      } else {
        control = document.createElement("input");
        control.type = (f.type === "number") ? "number" : "text";
      }
      control.id = id;
      control.name = f.name;
      if (f.required) control.required = true;
      const v = initial[f.name];
      if (v !== undefined && v !== null) control.value = v;

      const label = document.createElement("label");
      label.htmlFor = id;
      label.textContent = f.label;

      wrap.appendChild(label);
      wrap.appendChild(control);
      body.appendChild(wrap);
    }

    // Submit handler — fresh per opening so closures over `onSave` are correct.
    function onSubmit(e){
      e.preventDefault();
      const values = {};
      for (const f of fields){
        const el = document.getElementById(`admField_${f.name}`);
        let val = el.value;
        if (f.type === "number") val = (val === "") ? null : Number(val);
        if (val === "" && !f.required) val = null;
        values[f.name] = val;
      }
      const saveBtn = $("admModalSave");
      saveBtn.disabled = true;
      status.textContent = "جاري الحفظ…";
      status.classList.remove("is-bad","is-ok");
      onSave(values)
        .then(() => { dlg.close(); toast("تم الحفظ", "ok"); })
        .catch(err => {
          status.textContent = `خطأ: ${err.message || err}`;
          status.classList.add("is-bad");
        })
        .finally(() => { saveBtn.disabled = false; });
    }
    form.onsubmit = onSubmit;
    $("admModalCancel").onclick = () => dlg.close();
    $("admModalClose").onclick  = () => dlg.close();

    dlg.showModal();
  }

  // openConfirm({ title, body, danger?, onConfirm })
  function openConfirm({ title, body, danger = true, onConfirm }){
    const dlg = $("admConfirm");
    $("admConfirmTitle").textContent = title;
    $("admConfirmBody").textContent = body;
    const ok = $("admConfirmOk");
    ok.classList.toggle("adm-danger", !!danger);
    ok.textContent = danger ? "حذف" : "تأكيد";
    const cancel = $("admConfirmCancel");

    function cleanup(){
      ok.onclick = null;
      cancel.onclick = null;
    }
    ok.onclick = (e) => {
      e.preventDefault();
      ok.disabled = true;
      Promise.resolve()
        .then(() => onConfirm())
        .then(() => { dlg.close(); toast("تم الحذف", "ok"); })
        .catch(err => { toast(`خطأ: ${err.message || err}`, "bad"); dlg.close(); })
        .finally(() => { ok.disabled = false; cleanup(); });
    };
    cancel.onclick = (e) => { e.preventDefault(); dlg.close(); cleanup(); };
    dlg.showModal();
  }

  // ---- tabs ----
  function setActiveTab(name){
    if (!dash) return;
    dash.setAttribute("data-tab", name);
    for (const btn of document.querySelectorAll(".adm-tab")){
      btn.setAttribute("aria-selected", btn.dataset.tabTarget === name ? "true" : "false");
    }
    if (name === "sections")    renderSectionsTab();
    if (name === "categories")  renderCategoriesTab();
    if (name === "questions")   renderQuestionsTab();
  }

  document.querySelectorAll(".adm-tab").forEach(btn => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tabTarget));
  });

  // Re-render the dashboard whenever the user lands on the authorized state.
  // We hook this on top of the existing evaluate() flow by observing data-state.
  const stateObserver = new MutationObserver(() => {
    if (document.body.getAttribute("data-state") === "authorized"){
      setActiveTab(dash?.getAttribute("data-tab") || "sections");
    }
  });
  stateObserver.observe(document.body, { attributes: true, attributeFilter: ["data-state"] });

  // ---- entity caches (kept in module scope so cross-tab pickers don't refetch) ----
  const cache = { sections: null, categories: null, questions: null };
  async function refreshSections(){ cache.sections = await window.SHIFT_SB.db.listAll("sections", { order: [{ col: "order_index" }, { col: "name" }] }); return cache.sections; }
  async function refreshCategories(){ cache.categories = await window.SHIFT_SB.db.listAll("categories", { order: [{ col: "order_index" }, { col: "name" }] }); return cache.categories; }
  async function refreshQuestions(opts){ cache.questions = await window.SHIFT_SB.db.listAll("questions", opts); return cache.questions; }

  // Stubs filled by Tasks 6/7/8 — defined now so setActiveTab() can call them safely.
  async function renderSectionsTab(){}
  async function renderCategoriesTab(){}
  async function renderQuestionsTab(){}
  // Replaced below by the real implementations (later patches assign to these names via
  // re-declaration at the bottom of the IIFE).

```

- [ ] **Step 2: Static smoke-test**

```bash
node --check admin.js
```

Expected: silent (exit 0). If you see "duplicate declaration" or "unexpected token", you pasted into the wrong place — back out and try again.

- [ ] **Step 3: Commit**

```bash
git add admin.js
git commit -m "feat(admin): tabs, toast, edit modal, confirm modal helpers"
```

---

## Task 6: Sections tab — list / create / edit / delete

**Files:**
- Modify: `admin.js`

- [ ] **Step 1: Open `admin.js` and find the stub block from Task 5:**

```js
  // Stubs filled by Tasks 6/7/8 — defined now so setActiveTab() can call them safely.
  async function renderSectionsTab(){}
  async function renderCategoriesTab(){}
  async function renderQuestionsTab(){}
  // Replaced below by the real implementations (later patches assign to these names via
  // re-declaration at the bottom of the IIFE).
```

Replace **the entire 6-line block above** with the new block below (which keeps the two remaining stubs intact and adds the real `renderSectionsTab` plus its event handlers). This way each phase task replaces all stubs in one edit and the file never has duplicate declarations.

```js
  // Stubs filled by Tasks 7/8 — defined now so setActiveTab() can call them safely.
  async function renderCategoriesTab(){}
  async function renderQuestionsTab(){}

  /* ============================================================
   * Sections tab
   * ============================================================ */

  async function renderSectionsTab(){
    const tbody = $("admSectionsBody");
    tbody.innerHTML = `<tr class="adm-empty"><td colspan="3">جاري التحميل…</td></tr>`;
    try {
      const [sections, categories] = await Promise.all([refreshSections(), refreshCategories()]);
      const countBySection = new Map();
      for (const c of categories){
        countBySection.set(c.section_id, (countBySection.get(c.section_id) || 0) + 1);
      }
      if (!sections.length){
        tbody.innerHTML = `<tr class="adm-empty"><td colspan="3">لا توجد أقسام بعد. اضغط "+ إضافة قسم".</td></tr>`;
        return;
      }
      tbody.innerHTML = "";
      for (const s of sections){
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${escapeHTML(s.name)}</td>
          <td>${countBySection.get(s.id) || 0}</td>
          <td class="adm-row-actions">
            <button class="btn" data-action="edit-section"   data-id="${s.id}">تعديل</button>
            <button class="btn adm-danger" data-action="delete-section" data-id="${s.id}">حذف</button>
          </td>`;
        tbody.appendChild(tr);
      }
    } catch (err){
      tbody.innerHTML = `<tr class="adm-empty"><td colspan="3">خطأ: ${escapeHTML(err.message || err)}</td></tr>`;
    }
  }

  function escapeHTML(s){
    return String(s ?? "").replace(/[&<>"']/g, c => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
    }[c]));
  }

  // Add section
  $("admAddSection").addEventListener("click", () => {
    openEditModal({
      title: "إضافة قسم جديد",
      fields: [
        { name: "name", label: "اسم القسم", type: "text", required: true },
        { name: "order_index", label: "ترتيب العرض", type: "number" }
      ],
      initial: { order_index: (cache.sections?.length ?? 0) },
      onSave: async (values) => {
        await window.SHIFT_SB.db.insertSection({
          name: values.name,
          order_index: values.order_index ?? 0
        });
        await renderSectionsTab();
      }
    });
  });

  // Edit / delete (event-delegated)
  $("admSectionsBody").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = btn.dataset.id;
    const row = (cache.sections || []).find(s => s.id === id);
    if (!row) return;

    if (btn.dataset.action === "edit-section"){
      openEditModal({
        title: `تعديل قسم: ${row.name}`,
        fields: [
          { name: "name", label: "اسم القسم", type: "text", required: true },
          { name: "order_index", label: "ترتيب العرض", type: "number" }
        ],
        initial: { name: row.name, order_index: row.order_index },
        onSave: async (values) => {
          await window.SHIFT_SB.db.update("sections", id, {
            name: values.name,
            order_index: values.order_index ?? 0
          });
          await renderSectionsTab();
        }
      });
    } else if (btn.dataset.action === "delete-section"){
      const cats = (cache.categories || []).filter(c => c.section_id === id);
      const body = cats.length
        ? `سيُحذف ${cats.length} فئة و كل أسئلتها مع هذا القسم. لا يمكن التراجع.`
        : "سيُحذف هذا القسم نهائياً. لا يمكن التراجع.";
      openConfirm({
        title: `حذف القسم "${row.name}"؟`,
        body,
        danger: true,
        onConfirm: async () => {
          await window.SHIFT_SB.db.remove("sections", id);
          await renderSectionsTab();
        }
      });
    }
  });
```

- [ ] **Step 2: Smoke-test syntax**

```bash
node --check admin.js
```

Expected: silent.

- [ ] **Step 3: Commit**

```bash
git add admin.js
git commit -m "feat(admin): sections CRUD — list, add, edit, delete with confirm"
```

---

## Task 7: Categories tab — list / create / edit / delete

**Files:**
- Modify: `admin.js`

- [ ] **Step 1: Find the 3-line stub block from Task 6:**

```js
  // Stubs filled by Tasks 7/8 — defined now so setActiveTab() can call them safely.
  async function renderCategoriesTab(){}
  async function renderQuestionsTab(){}
```

Replace **the entire 3-line block above** with the new block below (which keeps the `renderQuestionsTab` stub for Task 8 and adds the real `renderCategoriesTab` plus its handlers).

```js
  // Stub filled by Task 8 — defined now so setActiveTab() can call it safely.
  async function renderQuestionsTab(){}

  /* ============================================================
   * Categories tab
   * ============================================================ */

  function refreshCatFilterDropdown(){
    const sel = $("admCatFilterSection");
    const current = sel.value;
    sel.innerHTML = `<option value="">الكل</option>`;
    for (const s of (cache.sections || [])){
      const o = document.createElement("option");
      o.value = s.id; o.textContent = s.name;
      sel.appendChild(o);
    }
    sel.value = current || "";
  }

  async function renderCategoriesTab(){
    const tbody = $("admCategoriesBody");
    tbody.innerHTML = `<tr class="adm-empty"><td colspan="5">جاري التحميل…</td></tr>`;
    try {
      const [sections, categories, qcounts] = await Promise.all([
        refreshSections(),
        refreshCategories(),
        window.SHIFT_SB.db.categoryQuestionCounts()
      ]);
      refreshCatFilterDropdown();

      const sectionFilter = $("admCatFilterSection").value;
      const sectionsById = new Map(sections.map(s => [s.id, s]));
      const list = sectionFilter
        ? categories.filter(c => c.section_id === sectionFilter)
        : categories;

      if (!list.length){
        tbody.innerHTML = `<tr class="adm-empty"><td colspan="5">لا توجد فئات. اضغط "+ إضافة فئة".</td></tr>`;
        return;
      }
      tbody.innerHTML = "";
      for (const c of list){
        const tr = document.createElement("tr");
        const sectionName = sectionsById.get(c.section_id)?.name ?? "—";
        tr.innerHTML = `
          <td><span class="adm-pill">${escapeHTML(sectionName)}</span></td>
          <td>${escapeHTML(c.name)}</td>
          <td>${c.emoji ? escapeHTML(c.emoji) : "—"}</td>
          <td>${qcounts.get(c.id) || 0}</td>
          <td class="adm-row-actions">
            <button class="btn" data-action="edit-category"   data-id="${c.id}">تعديل</button>
            <button class="btn adm-danger" data-action="delete-category" data-id="${c.id}">حذف</button>
          </td>`;
        tbody.appendChild(tr);
      }
    } catch (err){
      tbody.innerHTML = `<tr class="adm-empty"><td colspan="5">خطأ: ${escapeHTML(err.message || err)}</td></tr>`;
    }
  }

  $("admCatFilterSection").addEventListener("change", () => renderCategoriesTab());

  function categoryFields(){
    return [
      { name: "section_id", label: "القسم", type: "select", required: true,
        options: (cache.sections || []).map(s => ({ value: s.id, label: s.name })) },
      { name: "name",        label: "اسم الفئة",   type: "text",   required: true },
      { name: "emoji",       label: "أيقونة (إيموجي)", type: "text" },
      { name: "order_index", label: "ترتيب العرض", type: "number" }
    ];
  }

  $("admAddCategory").addEventListener("click", () => {
    if (!cache.sections?.length){
      toast("أضف قسماً واحداً على الأقل أولاً.", "bad");
      return;
    }
    openEditModal({
      title: "إضافة فئة جديدة",
      fields: categoryFields(),
      initial: {
        section_id: cache.sections[0].id,
        order_index: cache.categories?.length ?? 0
      },
      onSave: async (values) => {
        await window.SHIFT_SB.db.insertCategory({
          section_id:  values.section_id,
          name:        values.name,
          emoji:       values.emoji,
          order_index: values.order_index ?? 0
        });
        await renderCategoriesTab();
      }
    });
  });

  $("admCategoriesBody").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = btn.dataset.id;
    const row = (cache.categories || []).find(c => c.id === id);
    if (!row) return;

    if (btn.dataset.action === "edit-category"){
      openEditModal({
        title: `تعديل فئة: ${row.name}`,
        fields: categoryFields(),
        initial: {
          section_id: row.section_id,
          name: row.name,
          emoji: row.emoji ?? "",
          order_index: row.order_index
        },
        onSave: async (values) => {
          await window.SHIFT_SB.db.update("categories", id, {
            section_id:  values.section_id,
            name:        values.name,
            emoji:       values.emoji,
            order_index: values.order_index ?? 0
          });
          await renderCategoriesTab();
        }
      });
    } else if (btn.dataset.action === "delete-category"){
      // We need question count for this category; fetch on-demand.
      window.SHIFT_SB.db.categoryQuestionCounts().then(counts => {
        const n = counts.get(id) || 0;
        const body = n
          ? `سيُحذف ${n} سؤال مع هذه الفئة. لا يمكن التراجع.`
          : "سيُحذف هذه الفئة نهائياً. لا يمكن التراجع.";
        openConfirm({
          title: `حذف الفئة "${row.name}"؟`,
          body,
          danger: true,
          onConfirm: async () => {
            await window.SHIFT_SB.db.remove("categories", id);
            await renderCategoriesTab();
          }
        });
      });
    }
  });
```

- [ ] **Step 2: Smoke-test syntax**

```bash
node --check admin.js
```

Expected: silent.

- [ ] **Step 3: Commit**

```bash
git add admin.js
git commit -m "feat(admin): categories CRUD — list with section filter, add, edit, delete"
```

---

## Task 8: Questions tab — list / create / edit / delete

**Files:**
- Modify: `admin.js`

- [ ] **Step 1: Find the 2-line stub block from Task 7:**

```js
  // Stub filled by Task 8 — defined now so setActiveTab() can call it safely.
  async function renderQuestionsTab(){}
```

Replace **the entire 2-line block above** with the new block below.

```js
  /* ============================================================
   * Questions tab
   * ============================================================ */

  function refreshQFilterDropdowns(){
    const sectionSel = $("admQFilterSection");
    const catSel     = $("admQFilterCategory");
    const curSection = sectionSel.value;
    const curCat     = catSel.value;

    sectionSel.innerHTML = `<option value="">الكل</option>`;
    for (const s of (cache.sections || [])){
      const o = document.createElement("option");
      o.value = s.id; o.textContent = s.name;
      sectionSel.appendChild(o);
    }
    sectionSel.value = curSection || "";

    catSel.innerHTML = `<option value="">الكل</option>`;
    const filteredCats = curSection
      ? (cache.categories || []).filter(c => c.section_id === curSection)
      : (cache.categories || []);
    for (const c of filteredCats){
      const o = document.createElement("option");
      o.value = c.id; o.textContent = c.name;
      catSel.appendChild(o);
    }
    catSel.value = curCat && filteredCats.some(c => c.id === curCat) ? curCat : "";
  }

  const DIFF_LABEL = { easy: "سهل", medium: "متوسط", hard: "صعب" };

  async function renderQuestionsTab(){
    const tbody = $("admQuestionsBody");
    tbody.innerHTML = `<tr class="adm-empty"><td colspan="4">جاري التحميل…</td></tr>`;
    try {
      const [sections, categories] = await Promise.all([refreshSections(), refreshCategories()]);
      refreshQFilterDropdowns();

      const sectionFilter = $("admQFilterSection").value;
      const catFilter     = $("admQFilterCategory").value;

      const eq = {};
      if (catFilter) eq.category_id = catFilter;

      // If only a section is picked (no category), filter client-side via the cached category list.
      const allowedCatIds = sectionFilter
        ? new Set((categories || []).filter(c => c.section_id === sectionFilter).map(c => c.id))
        : null;

      const questions = await window.SHIFT_SB.db.listAll("questions", {
        eq,
        order: [{ col: "category_id" }, { col: "difficulty" }, { col: "order_index" }]
      });
      cache.questions = questions;

      const list = allowedCatIds
        ? questions.filter(q => allowedCatIds.has(q.category_id))
        : questions;

      const catsById = new Map(categories.map(c => [c.id, c]));

      if (!list.length){
        tbody.innerHTML = `<tr class="adm-empty"><td colspan="4">لا توجد أسئلة بهذه الشروط.</td></tr>`;
        return;
      }
      tbody.innerHTML = "";
      for (const q of list){
        const cat = catsById.get(q.category_id);
        const catLabel = cat ? cat.name : "—";
        const diffPill = `<span class="adm-pill adm-pill--${q.difficulty}">${DIFF_LABEL[q.difficulty] || q.difficulty}</span>`;
        const snippet = (q.prompt_text || "").slice(0, 80) + ((q.prompt_text || "").length > 80 ? "…" : "");
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${escapeHTML(catLabel)}</td>
          <td>${diffPill}</td>
          <td>${escapeHTML(snippet)}</td>
          <td class="adm-row-actions">
            <button class="btn" data-action="edit-question"   data-id="${q.id}">تعديل</button>
            <button class="btn adm-danger" data-action="delete-question" data-id="${q.id}">حذف</button>
          </td>`;
        tbody.appendChild(tr);
      }
    } catch (err){
      tbody.innerHTML = `<tr class="adm-empty"><td colspan="4">خطأ: ${escapeHTML(err.message || err)}</td></tr>`;
    }
  }

  $("admQFilterSection").addEventListener("change", () => {
    // Reset category filter when section changes; the dropdown rebuild below handles it.
    $("admQFilterCategory").value = "";
    renderQuestionsTab();
  });
  $("admQFilterCategory").addEventListener("change", () => renderQuestionsTab());

  function questionFields(){
    return [
      { name: "category_id", label: "الفئة", type: "select", required: true,
        options: (cache.categories || []).map(c => ({ value: c.id, label: c.name })) },
      { name: "difficulty", label: "المستوى", type: "select", required: true,
        options: [
          { value: "easy",   label: "سهل" },
          { value: "medium", label: "متوسط" },
          { value: "hard",   label: "صعب" }
        ] },
      { name: "prompt_text", label: "نص السؤال",  type: "textarea", required: true },
      { name: "answer_text", label: "نص الإجابة", type: "textarea", required: true },
      { name: "order_index", label: "ترتيب العرض", type: "number" }
    ];
  }

  $("admAddQuestion").addEventListener("click", () => {
    if (!cache.categories?.length){
      toast("أضف فئة واحدة على الأقل أولاً.", "bad");
      return;
    }
    openEditModal({
      title: "إضافة سؤال جديد",
      fields: questionFields(),
      initial: {
        category_id: cache.categories[0].id,
        difficulty:  "easy",
        order_index: 0
      },
      onSave: async (values) => {
        await window.SHIFT_SB.db.insertQuestion({
          category_id:  values.category_id,
          difficulty:   values.difficulty,
          prompt_text:  values.prompt_text,
          answer_text:  values.answer_text,
          order_index:  values.order_index ?? 0
        });
        await renderQuestionsTab();
      }
    });
  });

  $("admQuestionsBody").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = btn.dataset.id;
    const row = (cache.questions || []).find(q => q.id === id);
    if (!row) return;

    if (btn.dataset.action === "edit-question"){
      const snippet = (row.prompt_text || "").slice(0, 30) + ((row.prompt_text || "").length > 30 ? "…" : "");
      openEditModal({
        title: `تعديل سؤال: ${snippet || "—"}`,
        fields: questionFields(),
        initial: {
          category_id: row.category_id,
          difficulty:  row.difficulty,
          prompt_text: row.prompt_text,
          answer_text: row.answer_text,
          order_index: row.order_index
        },
        onSave: async (values) => {
          await window.SHIFT_SB.db.update("questions", id, {
            category_id:  values.category_id,
            difficulty:   values.difficulty,
            prompt_text:  values.prompt_text,
            answer_text:  values.answer_text,
            order_index:  values.order_index ?? 0
          });
          await renderQuestionsTab();
        }
      });
    } else if (btn.dataset.action === "delete-question"){
      const snippet = (row.prompt_text || "").slice(0, 60);
      openConfirm({
        title: "حذف السؤال؟",
        body: `سيُحذف السؤال "${snippet}…" نهائياً. لا يمكن التراجع.`,
        danger: true,
        onConfirm: async () => {
          await window.SHIFT_SB.db.remove("questions", id);
          await renderQuestionsTab();
        }
      });
    }
  });
```

- [ ] **Step 2: Smoke-test syntax**

```bash
node --check admin.js
```

Expected: silent.

- [ ] **Step 3: Commit**

```bash
git add admin.js
git commit -m "feat(admin): questions CRUD — list with section+category filters, add, edit, delete"
```

---

## Task 9: End-to-end smoke test

**Files:** none (manual verification)

This is where we exercise the full surface. Do every step. If anything looks off, the bug is local to that test — fix it before moving on.

Start the dev server:
```bash
cd "/Users/akalkhamis/Movies/game test shaleh2/shift-game" && python3 -m http.server 8765
```

Open `http://127.0.0.1:8765/admin.html` (sign in if needed).

- [ ] **Step 1: Sections tab smoke**

  - The Sections table loads with the existing 7 sections, each showing its category count.
  - Click `+ إضافة قسم` → modal opens with Name + Order fields → enter `اختبار v0.4` and order `99` → Save. Toast appears, modal closes, new row at the bottom.
  - Click Edit on `اختبار v0.4` → modal pre-filled → change name to `اختبار v0.4-rev` → Save. Toast, row updates.
  - Click Delete → confirm modal says "سيُحذف هذا القسم نهائياً" → confirm. Row disappears, toast appears.
  - Verify count went back to 7.

- [ ] **Step 2: Categories tab smoke**

  - Switch to Categories tab. Table loads with 18 rows, each showing section badge, name, emoji, question count.
  - Top filter `القسم` → choose any section → table filters in place. Choose "الكل" again.
  - Click `+ إضافة فئة` → modal with Section dropdown / Name / Emoji / Order → pick `عام`, name `اختبار-فئة`, emoji `🧪`, order `99` → Save. New row appears.
  - Edit the new row → change emoji to `🚀` → Save. Emoji column updates.
  - Delete → confirm says "سيُحذف هذه الفئة نهائياً" (no questions yet) → confirm. Row disappears.
  - Add it again, then add a question (Step 3) inside it, then delete it → confirm body should now read "سيُحذف 1 سؤال مع هذه الفئة".

- [ ] **Step 3: Questions tab smoke**

  - Switch to Questions tab. Table loads.
  - Filters: Section → `عام` → category list narrows to that section's categories. Pick `معلومات عامة` → table shows its 6 questions.
  - Click `+ إضافة سؤال` → modal with Category / Difficulty / Question / Answer / Order → fill in something obvious (`s/test/test/`), pick `easy`, save.
  - Edit the new question → change the answer text → Save. Snippet updates if you changed `prompt_text`; otherwise difficulty pill / row stays the same.
  - Delete the new question → confirm modal shows the snippet → confirm. Row disappears.

- [ ] **Step 4: Game still works**

  Open `http://127.0.0.1:8765/index.html` in a fresh tab. Hard-refresh.

  - Boot overlay → landing.
  - Console logs `[shift] loaded 18 categories from Supabase` (count includes any new categories you added; restore baseline before tagging).
  - Pick 6 categories → board renders → click any cell → question opens with the timer counting down. The new edited content is visible.

- [ ] **Step 5: RLS still gates writes**

  Open the admin tab in a private window without signing in (so no session). Open the JS console and try to mutate:
  ```js
  await SHIFT_SB.client.from("sections").insert({ name: "hack", order_index: 0 });
  ```
  Expected: returns `{ data: null, error: { code: '42501' /* row-level security */ } }`. If it succeeds, **stop and re-check** Phase 1 Task 3.

If anything in this task fails, fix it before Task 10.

---

## Task 10: Final cleanup, commit, and tag

**Files:** none

- [ ] **Step 1: Working tree clean**

```bash
git status
git log --oneline -12
```

You should see, top-to-bottom:
```
… feat(admin): questions CRUD …
… feat(admin): categories CRUD …
… feat(admin): sections CRUD …
… feat(admin): tabs, toast, edit modal, confirm modal helpers
… feat(admin): styles for tabs, tables, modals, toasts
… feat(admin): replace placeholder with dashboard shell …
… feat(lib): generic listAll/update/remove …
… (Phase 3 commits) …
```

- [ ] **Step 2: Confirm `app.js` still untouched and no service_role leaked**

```bash
git log --oneline -- app.js
git log -p --since="1 day ago" -- admin.js admin.html admin.css lib/supabase.js | grep -i service_role
```

- `git log -- app.js` should still end at the original Phase 1 init commit.
- The `grep service_role` should return empty.

- [ ] **Step 3: Tag**

```bash
git tag -a v0.4-phase4 -m "Phase 4: text-only CRUD for sections, categories, questions"
```

- [ ] **Step 4: Phase 4 success criteria**

✓ Authorized state shows three tabs (sections, categories, questions).
✓ Each tab loads its data and renders a table.
✓ "+ Add" button opens an edit modal that creates a new row.
✓ Edit button on each row pre-fills the modal and saves changes.
✓ Delete button shows a confirm modal naming the dependent rows that will cascade-delete, then deletes on confirm.
✓ Toasts appear for each success/error.
✓ Filters (section in Categories tab, section + cascading category in Questions tab) narrow the table in place.
✓ Game (`index.html`) still loads from Supabase and reflects edits made via the admin.
✓ A signed-out user cannot mutate any table (RLS still enforces).
✓ `app.js` was never modified.

---

## What's NOT in this phase

- **Media uploads** (image/video/audio for sections/categories/questions/answers) → Phase 5.
- **Drag-to-reorder, search, batch ops** → Phase 6.
- **Admin allowlist UI** → still SQL-only, by design.
- **Pagination** → not needed at current scale (18 categories, 108 questions); revisit when content grows.

After Task 10 ships, ask Claude to write Phase 5's plan (media uploads + previews + replace-on-upload cleanup).
