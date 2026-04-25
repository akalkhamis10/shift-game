# Phase 5 — Media uploads (image / video / audio)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins upload images, video, and audio for sections (cover), categories (icon + cover), and questions (prompt + answer). The game displays the media when rendering the relevant screen. After this phase ships, a question with an attached image shows the image alongside the prompt; revealing the answer shows the answer's media.

**Architecture:** Phase 1 already created the storage bucket (`media`, public read, admin write) and the schema columns (`*_media_url`, `*_media_type`). Phase 5 just wires the existing slots up to a UI:

- Add three small storage helpers to `lib/supabase.js` — `uploadMedia(path, file, { progress })`, `deleteMedia(path)`, `publicUrlFor(path)`.
- Add a new `"media"` field-type to `admin.js`'s `openEditModal`. It renders a type radio (none / image / video / audio), a file input, and a live preview of either the existing object or the just-picked file.
- Plug that field into the existing Sections, Categories, and Questions modals.
- Update `lib/content.js` so the legacy `CATEGORIES` shape that the game consumes carries the media fields through.
- Touch `app.js` for the first time since Phase 1: when rendering a question, render `prompt_media_*` above the prompt text; when revealing the answer, render `answer_media_*` next to the answer text.

**Image first, then video, then audio.** Same code paths — only the file-size limit and the `<img>` / `<video>` / `<audio>` element differ. We test image end-to-end and confirm video + audio with the same admin modal in Task 11.

**Tech Stack:** Same. Vanilla JS, no build step, Supabase JS client, native `<dialog>`. No new dependencies.

**Spec:** [docs/superpowers/specs/2026-04-25-admin-dashboard-design.md](../specs/2026-04-25-admin-dashboard-design.md) §7 (Storage) and §9 (Admin UI media uploads).

**Depends on:** `v0.4-phase4` tag in place.

---

## File Structure

| Path | Responsibility |
|------|----------------|
| `lib/supabase.js` | **Modify.** Add `storage` namespace: `uploadMedia(path, file, opts)`, `deleteMedia(path)`, `publicUrlFor(path)`, plus a small `entityMediaPath(kind, id, slot, ext)` helper. |
| `lib/content.js` | **Modify (small).** Carry `*_media_type` and `*_media_url` through the reshape so the game gets them. |
| `admin.js` | **Modify.** Add `"media"` field type to `openEditModal`. Update Sections / Categories / Questions modal definitions to include their media slots. Handle two-phase save (insert/update row → upload media → update row again with the URL). |
| `admin.css` | **Modify.** Append ~80 lines for the media-field UI (type radio, file picker, preview, progress). |
| `app.js` | **Modify (first touch since init).** Render `prompt_media_*` in the question screen; render `answer_media_*` when the answer is revealed. |
| `styles.css` | **Modify.** Add ~30 lines for in-game media display. |
| `index.html` | **Modify (small).** Add `<div id="qPromptMedia">` and `<div id="qAnswerMedia">` slots in the question screen so `app.js` has stable hooks. |

`tools/*` stays untouched. Backend (Supabase tables, RLS, storage policies) needs no changes — the columns already exist.

---

## Pre-flight

Before Task 1, confirm:

1. `git tag` lists `v0.4-phase4`.
2. The Phase 4 admin still works: open `http://127.0.0.1:8765/admin.html`, sign in, the three tabs render and `+ Add` modals work for all entities.
3. Storage bucket exists and is public — visit Supabase dashboard → Storage → `media`. Should be marked Public.
4. Storage policies still in place:
   ```sql
   select policyname from pg_policies
   where schemaname='storage' and tablename='objects' and policyname like 'media_%';
   ```
   Expected 4 rows: `media_admin_delete / media_admin_insert / media_admin_update / media_read_all`.

If anything's off, fix it before proceeding — Phase 5 is purely client-side; the backend has to be ready.

---

## Task 1: Lock down the UX contract

**Files:** none.

The media-field UI inside an edit modal looks like this (one block per media slot):

```
┌────────────────────────────────────────────────────────────┐
│ صورة السؤال                                                 │
│ ◯ بدون   ◉ صورة   ◯ فيديو   ◯ صوت                            │
│ [ اختر ملف ]  prompt-image.png  (412 KB)                    │
│ ┌──────────────────────────────────────┐                    │
│ │  <preview area: img/video/audio>     │                    │
│ └──────────────────────────────────────┘                    │
└────────────────────────────────────────────────────────────┘
```

Behaviour rules:
1. When the row already has media, the preview area shows the **existing** object on open. The file input is empty.
2. When the user picks a file, the preview switches to the newly-picked file (data URL for images, blob URL for video/audio).
3. When the user changes the type radio:
   - **none** → preview area clears, the existing URL is marked for deletion on save.
   - other → file input becomes required if no existing URL.
4. On save:
   - If the user picked no new file and didn't change the type, no upload happens.
   - If the type changed to `none`, the existing storage object (if any) is **deleted** and the row is patched with `*_media_type = 'none'`, `*_media_url = null`.
   - If a new file was picked, the file is uploaded **after** the row exists (we need the row's `id` to build the storage path), then the row is patched with the new type + URL. If there was an existing URL at a different path, that object is deleted first.
5. Size limits enforced client-side, with clear error toast: image ≤ 5 MB, audio ≤ 10 MB, video ≤ 50 MB.
6. Storage path layout (per Phase 1 spec §7) — the file extension preserves the original (`.png` / `.jpg` / `.mp4` / `.mp3` …) so we don't re-encode anything:
   ```
   sections/{section_id}/cover.{ext}
   categories/{category_id}/image.{ext}
   categories/{category_id}/cover.{ext}
   questions/{question_id}/prompt.{ext}
   questions/{question_id}/answer.{ext}
   ```
7. Two-phase save for **new** rows:
   1. Insert row with media fields nulled.
   2. Upload media using the new `id`.
   3. Update row with the URL.
   The user sees a single "تم الحفظ" toast at the end. If step 2 or 3 fails, the row exists with no media (acceptable — they can retry by editing).

No commit for this task.

---

## Task 2: Storage helpers in `lib/supabase.js`

**Files:**
- Modify: `lib/supabase.js`

- [ ] **Step 1: Find the bottom of the existing IIFE** — the line that reads:

```js
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

**Immediately above** that block, insert:

```js
  // ---- storage (Phase 5) ----
  const MEDIA_BUCKET = "media";

  // Per-type size limits in bytes (client-side; storage policy enforces server-side).
  const MEDIA_LIMITS = {
    image:  5  * 1024 * 1024,
    audio:  10 * 1024 * 1024,
    video:  50 * 1024 * 1024
  };

  function fileExtension(file){
    // file.name like "Family Photo.JPG" → "jpg"
    const dot = file.name.lastIndexOf(".");
    return dot < 0 ? "bin" : file.name.slice(dot + 1).toLowerCase();
  }

  // Build a storage path from (entity, id, slot, ext).
  // entity ∈ "sections" | "categories" | "questions"
  // slot   ∈ "cover" | "image" | "prompt" | "answer"
  function entityMediaPath(entity, id, slot, ext){
    if (!id || !slot || !ext) throw new Error("entityMediaPath needs entity/id/slot/ext");
    return `${entity}/${id}/${slot}.${ext}`;
  }

  // Upload a file to storage. Returns { path, publicUrl }.
  async function uploadMedia(path, file){
    const { error: upErr } = await client.storage
      .from(MEDIA_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type || undefined });
    if (upErr) throw upErr;
    const { data } = client.storage.from(MEDIA_BUCKET).getPublicUrl(path);
    return { path, publicUrl: data.publicUrl };
  }

  // Delete a single object (no-op if it doesn't exist).
  async function deleteMedia(path){
    const { error } = await client.storage.from(MEDIA_BUCKET).remove([path]);
    // "Object not found" is fine — treat as a no-op.
    if (error && !/not found/i.test(error.message)) throw error;
    return { path };
  }

  function publicUrlFor(path){
    return client.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  // Helper: extract the storage path from a public URL (so deleteMedia can be
  // called with whatever URL is currently saved on a row).
  function pathFromUrl(url){
    if (!url) return null;
    const m = String(url).match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);
    return m ? m[1] : null;
  }

```

- [ ] **Step 2: Update the `window.SHIFT_SB` export** to include the new `storage` namespace. Replace:

```js
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

with:

```js
  window.SHIFT_SB = {
    client,
    auth: { signInWithEmail, signOut, currentEmail, isAdmin },
    db:   {
      fetchContentTree,
      insertSection, insertCategory, insertQuestion,
      listAll, update, remove,
      categoryQuestionCounts
    },
    storage: {
      LIMITS: MEDIA_LIMITS,
      uploadMedia, deleteMedia, publicUrlFor,
      entityMediaPath, fileExtension, pathFromUrl
    }
  };
```

- [ ] **Step 3: Static smoke-test**

```bash
node --check lib/supabase.js
```

Expected: silent.

- [ ] **Step 4: Commit**

```bash
git add lib/supabase.js
git commit -m "feat(lib): storage helpers — uploadMedia / deleteMedia / publicUrlFor"
```

---

## Task 3: Carry media fields through the game's content loader

**Files:**
- Modify: `lib/content.js`

The Phase 2 `reshape()` in `lib/content.js` strips media. We carry them through now so `app.js` can render them.

- [ ] **Step 1: Find the `reshape()` function:**

```js
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
```

Replace it with:

```js
  function reshape(tree) {
    const cats = [];
    for (const section of tree) {
      for (const c of section.categories || []) {
        cats.push({
          id: c.id,
          group: section.name,
          name: c.name,
          emoji: c.emoji || "",
          // Phase 5: carry through illustration so game can show it later if it wants.
          imageUrl: c.image_url || null,
          coverUrl: c.cover_url || null,
          questions: (c.questions || [])
            .slice()
            .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
            .map(q => ({
              d: q.difficulty,
              q: q.prompt_text,
              a: q.answer_text,
              // Phase 5: prompt + answer media. `type` ∈ none|image|video|audio.
              promptMediaType: q.prompt_media_type || "none",
              promptMediaUrl:  q.prompt_media_url  || null,
              answerMediaType: q.answer_media_type || "none",
              answerMediaUrl:  q.answer_media_url  || null
            }))
        });
      }
    }
    return cats;
  }
```

- [ ] **Step 2: Static smoke-test**

```bash
node --check lib/content.js
```

Expected: silent.

- [ ] **Step 3: Commit**

```bash
git add lib/content.js
git commit -m "feat(content): carry media fields through legacy CATEGORIES shape"
```

---

## Task 4: Add a `"media"` field type to `admin.js`'s `openEditModal`

**Files:**
- Modify: `admin.js`

This is the centerpiece. We extend `openEditModal` to recognise a new field type whose value is a small object describing what to do on save.

- [ ] **Step 1: Find the field-rendering loop in `openEditModal`** (the `for (const f of fields){…}` block that creates inputs/textareas/selects). Locate the current `else { control = document.createElement("input"); … }` else branch — the catch-all for `text` / `number`.

**Immediately above** that catch-all `else`, insert a new branch that renders a media composite:

```js
      } else if (f.type === "media"){
        // Composite control: type radio + file input + preview.
        // We attach the resulting state to a hidden <input data-media> so the
        // submit handler can read it like any other field.
        const composite = document.createElement("div");
        composite.className = "adm-media";
        const id = `admField_${f.name}`;
        composite.id = id;

        // Hidden state — read by onSubmit.
        const stateInput = document.createElement("input");
        stateInput.type = "hidden";
        stateInput.dataset.media = "1";
        stateInput.name = f.name;
        composite.appendChild(stateInput);

        // Type radio.
        const typeBar = document.createElement("div");
        typeBar.className = "adm-media__types";
        for (const opt of [
          { value: "none",  label: "بدون" },
          { value: "image", label: "صورة" },
          { value: "video", label: "فيديو" },
          { value: "audio", label: "صوت" }
        ]){
          const lbl = document.createElement("label");
          lbl.className = "adm-media__type";
          const r = document.createElement("input");
          r.type = "radio";
          r.name = `admMediaType_${f.name}`;
          r.value = opt.value;
          if ((initial[f.name]?.type || "none") === opt.value) r.checked = true;
          lbl.append(r, document.createTextNode(" " + opt.label));
          typeBar.appendChild(lbl);
        }
        composite.appendChild(typeBar);

        // File input.
        const fileRow = document.createElement("div");
        fileRow.className = "adm-media__file";
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.dataset.role = "file";
        fileRow.appendChild(fileInput);
        const fileMeta = document.createElement("span");
        fileMeta.className = "adm-media__meta";
        fileRow.appendChild(fileMeta);
        composite.appendChild(fileRow);

        // Preview.
        const preview = document.createElement("div");
        preview.className = "adm-media__preview";
        composite.appendChild(preview);

        // ---- per-control state + helpers ----
        const state = {
          existingUrl: initial[f.name]?.url || null,
          existingPath: initial[f.name]?.path || null,
          newFile: null,
          // The "current" type — kept in sync with the radio.
          type: initial[f.name]?.type || "none"
        };
        function syncStateInput(){
          stateInput.value = JSON.stringify({
            type: state.type,
            existingUrl: state.existingUrl,
            existingPath: state.existingPath,
            // Files don't serialise to JSON; we look up the live File via dataset on submit.
            hasNewFile: !!state.newFile
          });
        }
        function renderPreview(){
          preview.innerHTML = "";
          if (state.type === "none"){ return; }
          let url = null;
          if (state.newFile) url = URL.createObjectURL(state.newFile);
          else if (state.existingUrl) url = state.existingUrl;
          if (!url) return;
          if (state.type === "image"){
            const img = document.createElement("img");
            img.src = url; img.alt = "";
            preview.appendChild(img);
          } else if (state.type === "video"){
            const v = document.createElement("video");
            v.src = url; v.controls = true;
            preview.appendChild(v);
          } else if (state.type === "audio"){
            const a = document.createElement("audio");
            a.src = url; a.controls = true;
            preview.appendChild(a);
          }
        }
        function setFileMeta(){
          if (state.newFile){
            const kb = (state.newFile.size / 1024);
            const sz = kb >= 1024 ? `${(kb/1024).toFixed(1)} MB` : `${Math.round(kb)} KB`;
            fileMeta.textContent = `${state.newFile.name} (${sz})`;
          } else {
            fileMeta.textContent = "";
          }
        }

        // ---- wire interactions ----
        composite.querySelectorAll(`input[name="admMediaType_${f.name}"]`).forEach(r => {
          r.addEventListener("change", () => {
            state.type = r.value;
            // Switching away from a type clears the picked file (the file may not match).
            if (state.type === "none"){
              state.newFile = null; fileInput.value = ""; setFileMeta();
            }
            renderPreview();
            syncStateInput();
          });
        });
        fileInput.addEventListener("change", () => {
          const file = fileInput.files?.[0] || null;
          if (!file){ state.newFile = null; setFileMeta(); renderPreview(); syncStateInput(); return; }
          // Validate size against current type.
          const limit = window.SHIFT_SB.storage.LIMITS[state.type];
          if (limit && file.size > limit){
            const human = `${Math.round(limit / 1024 / 1024)}MB`;
            toast(`الملف أكبر من الحد المسموح (${human}).`, "bad");
            fileInput.value = ""; state.newFile = null; setFileMeta(); renderPreview(); syncStateInput();
            return;
          }
          state.newFile = file;
          setFileMeta();
          renderPreview();
          syncStateInput();
        });

        // Initial render.
        syncStateInput();
        setFileMeta();
        renderPreview();
        // Stash the live File reference on the composite element itself so onSubmit
        // can pull it out (we can't put a File into a hidden input value).
        composite._getFile = () => state.newFile;
        composite._getState = () => ({ ...state });

        const label = document.createElement("label");
        label.htmlFor = id;
        label.textContent = f.label;

        wrap.appendChild(label);
        wrap.appendChild(composite);
        body.appendChild(wrap);
        continue; // skip the generic input-creation path below
      } else {
```

> **Important:** the `else if (f.type === "media")` branch ends with `continue;` so the rest of the generic `for` body (which would otherwise try to set `control.id = id`) is skipped.

- [ ] **Step 2: Update the `onSubmit` handler** to read media composites differently. Find the handler:

```js
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
      …
    }
```

Replace the `for (const f of fields){…}` loop with:

```js
      for (const f of fields){
        const el = document.getElementById(`admField_${f.name}`);
        if (f.type === "media"){
          const stateInput = el.querySelector('input[data-media]');
          const parsed = JSON.parse(stateInput.value);
          values[f.name] = {
            type: parsed.type,
            existingUrl: parsed.existingUrl,
            existingPath: parsed.existingPath,
            file: el._getFile?.() || null
          };
          continue;
        }
        let val = el.value;
        if (f.type === "number") val = (val === "") ? null : Number(val);
        if (val === "" && !f.required) val = null;
        values[f.name] = val;
      }
```

The `onSave(values)` call further down is unchanged. Each entity's `onSave` will read `values[someMediaFieldName]` as `{ type, existingUrl, existingPath, file }` and act accordingly.

- [ ] **Step 3: Static smoke-test**

```bash
node --check admin.js
```

Expected: silent.

- [ ] **Step 4: Commit**

```bash
git add admin.js
git commit -m "feat(admin): media field-type for openEditModal — type radio + upload + preview"
```

---

## Task 5: Use the media field on Sections (cover_url)

**Files:**
- Modify: `admin.js`

- [ ] **Step 1: Find the Add-Section handler:**

```js
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
```

Replace it with:

```js
  $("admAddSection").addEventListener("click", () => {
    openEditModal({
      title: "إضافة قسم جديد",
      fields: [
        { name: "name", label: "اسم القسم", type: "text", required: true },
        { name: "order_index", label: "ترتيب العرض", type: "number" },
        { name: "cover", label: "صورة الغلاف", type: "media" }
      ],
      initial: { order_index: (cache.sections?.length ?? 0) },
      onSave: async (values) => {
        const row = await window.SHIFT_SB.db.insertSection({
          name: values.name,
          order_index: values.order_index ?? 0
        });
        await applyMedia({
          entity: "sections",
          id: row.id,
          slot: "cover",
          column: "cover_url",
          field: values.cover
        });
        await renderSectionsTab();
      }
    });
  });
```

- [ ] **Step 2: Find the edit-section branch in the body click handler:**

```js
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
```

Replace just the `if (btn.dataset.action === "edit-section"){ … }` block with:

```js
    if (btn.dataset.action === "edit-section"){
      openEditModal({
        title: `تعديل قسم: ${row.name}`,
        fields: [
          { name: "name", label: "اسم القسم", type: "text", required: true },
          { name: "order_index", label: "ترتيب العرض", type: "number" },
          { name: "cover", label: "صورة الغلاف", type: "media" }
        ],
        initial: {
          name: row.name,
          order_index: row.order_index,
          cover: mediaInitial(row.cover_url, /* type stored on the row */ row.cover_url ? "image" : "none")
        },
        onSave: async (values) => {
          await window.SHIFT_SB.db.update("sections", id, {
            name: values.name,
            order_index: values.order_index ?? 0
          });
          await applyMedia({
            entity: "sections",
            id,
            slot: "cover",
            column: "cover_url",
            field: values.cover
          });
          await renderSectionsTab();
        }
      });
    } else if (btn.dataset.action === "delete-section"){
```

- [ ] **Step 3: Add the shared media-apply helpers above the Sections section.** Find the line `/* ============================================================\n   * Sections tab\n   * ============================================================ */`. **Immediately above** that comment, insert:

```js
  /* ============================================================
   * Media helpers (Phase 5)
   * ============================================================ */

  // Build the `initial` object for a media field, given a row's stored URL.
  // We don't store `*_media_type` on sections/categories (they only have one
  // media kind: image). For questions, pass the type explicitly.
  function mediaInitial(url, type = "none"){
    if (!url) return { type: "none", url: null, path: null };
    return {
      type,
      url,
      path: window.SHIFT_SB.storage.pathFromUrl(url)
    };
  }

  // Apply a media field after a row is saved. Handles upload, replace, and clear.
  // - entity: "sections" | "categories" | "questions"
  // - id:     row id
  // - slot:   "cover" | "image" | "prompt" | "answer"
  // - column: column on the row to set, e.g. "cover_url" / "prompt_media_url"
  // - typeColumn (optional): column for the type, e.g. "prompt_media_type"
  //                         (sections/categories don't have one)
  // - field:  the value coming out of openEditModal — { type, existingUrl, existingPath, file }
  async function applyMedia({ entity, id, slot, column, typeColumn, field }){
    if (!field) return;
    const { storage, db } = window.SHIFT_SB;
    const newType = field.type;
    const file = field.file;

    // Case A: type=none → delete existing object + null the columns.
    if (newType === "none"){
      const path = field.existingPath;
      if (path){ await storage.deleteMedia(path); }
      const patch = { [column]: null };
      if (typeColumn) patch[typeColumn] = "none";
      if (column !== null) await db.update(entity, id, patch);
      return;
    }

    // Case B: a new file was picked → upload, then patch the row.
    if (file){
      const ext = storage.fileExtension(file);
      const path = storage.entityMediaPath(entity, id, slot, ext);
      // If there was an existing object at a *different* path, delete it.
      if (field.existingPath && field.existingPath !== path){
        await storage.deleteMedia(field.existingPath);
      }
      const { publicUrl } = await storage.uploadMedia(path, file);
      const patch = { [column]: publicUrl };
      if (typeColumn) patch[typeColumn] = newType;
      await db.update(entity, id, patch);
      return;
    }

    // Case C: same type, no new file. If the type column needs setting (e.g.,
    // questions store an explicit type), make sure it's saved; otherwise no-op.
    if (typeColumn && newType !== "none"){
      await db.update(entity, id, { [typeColumn]: newType });
    }
  }

```

- [ ] **Step 4: Static smoke-test**

```bash
node --check admin.js
```

Expected: silent.

- [ ] **Step 5: Commit**

```bash
git add admin.js
git commit -m "feat(admin): sections — upload / replace / clear cover image"
```

---

## Task 6: Use the media field on Categories (image_url + cover_url)

**Files:**
- Modify: `admin.js`

Categories have **two** media slots (`image_url` for the small icon, `cover_url` for the large illustration).

- [ ] **Step 1: Find the `categoryFields()` helper** and replace it with:

```js
  function categoryFields(){
    return [
      { name: "section_id", label: "القسم", type: "select", required: true,
        options: (cache.sections || []).map(s => ({ value: s.id, label: s.name })) },
      { name: "name",        label: "اسم الفئة",   type: "text",   required: true },
      { name: "emoji",       label: "أيقونة (إيموجي)", type: "text" },
      { name: "image",       label: "أيقونة الصورة (اختياري)", type: "media" },
      { name: "cover",       label: "صورة الغلاف الكبيرة (اختياري)", type: "media" },
      { name: "order_index", label: "ترتيب العرض", type: "number" }
    ];
  }
```

- [ ] **Step 2: Find the Add-Category handler** and replace it with:

```js
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
        const row = await window.SHIFT_SB.db.insertCategory({
          section_id:  values.section_id,
          name:        values.name,
          emoji:       values.emoji,
          order_index: values.order_index ?? 0
        });
        await applyMedia({ entity: "categories", id: row.id, slot: "image", column: "image_url", field: values.image });
        await applyMedia({ entity: "categories", id: row.id, slot: "cover", column: "cover_url", field: values.cover });
        await renderCategoriesTab();
      }
    });
  });
```

- [ ] **Step 3: Find the edit-category branch** and replace it with:

```js
    if (btn.dataset.action === "edit-category"){
      openEditModal({
        title: `تعديل فئة: ${row.name}`,
        fields: categoryFields(),
        initial: {
          section_id: row.section_id,
          name: row.name,
          emoji: row.emoji ?? "",
          image: mediaInitial(row.image_url, row.image_url ? "image" : "none"),
          cover: mediaInitial(row.cover_url, row.cover_url ? "image" : "none"),
          order_index: row.order_index
        },
        onSave: async (values) => {
          await window.SHIFT_SB.db.update("categories", id, {
            section_id:  values.section_id,
            name:        values.name,
            emoji:       values.emoji,
            order_index: values.order_index ?? 0
          });
          await applyMedia({ entity: "categories", id, slot: "image", column: "image_url", field: values.image });
          await applyMedia({ entity: "categories", id, slot: "cover", column: "cover_url", field: values.cover });
          await renderCategoriesTab();
        }
      });
    } else if (btn.dataset.action === "delete-category"){
```

- [ ] **Step 4: Static smoke-test**

```bash
node --check admin.js
```

Expected: silent.

- [ ] **Step 5: Commit**

```bash
git add admin.js
git commit -m "feat(admin): categories — upload / replace / clear icon and cover"
```

---

## Task 7: Use the media field on Questions (prompt + answer)

**Files:**
- Modify: `admin.js`

Questions have a **type** column for each media slot (`prompt_media_type`, `answer_media_type`), so we pass `typeColumn` to `applyMedia`.

- [ ] **Step 1: Find `questionFields()`** and replace it with:

```js
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
      { name: "prompt_text",  label: "نص السؤال",         type: "textarea", required: true },
      { name: "prompt_media", label: "وسائط مع السؤال (اختياري)", type: "media" },
      { name: "answer_text",  label: "نص الإجابة",         type: "textarea", required: true },
      { name: "answer_media", label: "وسائط مع الإجابة (اختياري)", type: "media" },
      { name: "order_index",  label: "ترتيب العرض", type: "number" }
    ];
  }
```

- [ ] **Step 2: Find the Add-Question handler** and replace it with:

```js
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
        const row = await window.SHIFT_SB.db.insertQuestion({
          category_id:  values.category_id,
          difficulty:   values.difficulty,
          prompt_text:  values.prompt_text,
          answer_text:  values.answer_text,
          order_index:  values.order_index ?? 0
        });
        await applyMedia({
          entity: "questions", id: row.id, slot: "prompt",
          column: "prompt_media_url", typeColumn: "prompt_media_type",
          field: values.prompt_media
        });
        await applyMedia({
          entity: "questions", id: row.id, slot: "answer",
          column: "answer_media_url", typeColumn: "answer_media_type",
          field: values.answer_media
        });
        await renderQuestionsTab();
      }
    });
  });
```

- [ ] **Step 3: Find the edit-question branch** and replace it with:

```js
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
          order_index: row.order_index,
          prompt_media: mediaInitial(row.prompt_media_url, row.prompt_media_type || "none"),
          answer_media: mediaInitial(row.answer_media_url, row.answer_media_type || "none")
        },
        onSave: async (values) => {
          await window.SHIFT_SB.db.update("questions", id, {
            category_id:  values.category_id,
            difficulty:   values.difficulty,
            prompt_text:  values.prompt_text,
            answer_text:  values.answer_text,
            order_index:  values.order_index ?? 0
          });
          await applyMedia({
            entity: "questions", id, slot: "prompt",
            column: "prompt_media_url", typeColumn: "prompt_media_type",
            field: values.prompt_media
          });
          await applyMedia({
            entity: "questions", id, slot: "answer",
            column: "answer_media_url", typeColumn: "answer_media_type",
            field: values.answer_media
          });
          await renderQuestionsTab();
        }
      });
    } else if (btn.dataset.action === "delete-question"){
```

- [ ] **Step 4: Static smoke-test**

```bash
node --check admin.js
```

Expected: silent.

- [ ] **Step 5: Commit**

```bash
git add admin.js
git commit -m "feat(admin): questions — upload / replace / clear prompt and answer media"
```

---

## Task 8: Style the media field

**Files:**
- Modify: `admin.css`

- [ ] **Step 1: Append to `admin.css`**

```css
/* ===== Phase 5 media field ===== */

.adm-media {
  display: flex; flex-direction: column; gap: 10px;
  border: 1px solid var(--adm-border);
  border-radius: 10px;
  padding: 12px;
  background: rgba(0,0,0,.015);
}
.adm-media__types {
  display: flex; flex-wrap: wrap; gap: 14px;
  font-size: 14px;
}
.adm-media__type { display: inline-flex; align-items: center; gap: 4px; cursor: pointer; }
.adm-media__type input { margin: 0; }

.adm-media__file {
  display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
  font-size: 13px;
}
.adm-media__file input[type="file"] {
  font: inherit;
  padding: 6px;
  border: 1px solid var(--adm-border);
  border-radius: 8px;
  background: #fff;
  max-width: 260px;
}
.adm-media__meta { color: var(--adm-muted); }

.adm-media__preview:empty { display: none; }
.adm-media__preview {
  background: #fff;
  border: 1px dashed var(--adm-border);
  border-radius: 8px;
  padding: 8px;
  display: flex; align-items: center; justify-content: center;
  min-height: 60px;
  max-height: 220px;
  overflow: hidden;
}
.adm-media__preview img,
.adm-media__preview video {
  max-width: 100%;
  max-height: 200px;
  display: block;
  border-radius: 6px;
}
.adm-media__preview audio {
  width: 100%;
  max-width: 360px;
}
```

- [ ] **Step 2: Commit**

```bash
git add admin.css
git commit -m "feat(admin): styles for media field — type radio, file picker, preview"
```

---

## Task 9: Render media in the game

**Files:**
- Modify: `index.html`, `app.js`, `styles.css`

This is the first time we touch `app.js` since the original Phase 1 init commit. Player-facing rendering belongs there.

- [ ] **Step 1: Add media slots in `index.html`**

Find this block in the question-screen markup:

```html
        <div class="q-text" id="qText">—</div>

        <div class="q-answer" id="qAnswer" hidden>
          <div class="q-answer__label">الإجابة</div>
          <div class="q-answer__value" id="qAnswerText">—</div>
        </div>
```

Replace with:

```html
        <div class="q-text" id="qText">—</div>
        <div class="q-media" id="qPromptMedia" hidden></div>

        <div class="q-answer" id="qAnswer" hidden>
          <div class="q-answer__label">الإجابة</div>
          <div class="q-answer__value" id="qAnswerText">—</div>
          <div class="q-media q-media--answer" id="qAnswerMedia" hidden></div>
        </div>
```

- [ ] **Step 2: Append CSS to `styles.css`**

```css
/* ===== Phase 5 in-game media ===== */

.q-media {
  width: 100%;
  display: flex; align-items: center; justify-content: center;
  margin: 10px 0 0;
}
.q-media[hidden] { display: none; }
.q-media img,
.q-media video {
  max-width: min(720px, 100%);
  max-height: 360px;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,.10);
  display: block;
}
.q-media audio {
  width: min(420px, 100%);
}
.q-media--answer { margin-top: 8px; }
```

- [ ] **Step 3: Render media in `app.js`**

Find the `renderQuestion()` function. The current body sets `#qText` / `#qAnswerText` and shows/hides `#qAnswer`. We add two helper-driven blocks.

Just **above** `renderQuestion()`, insert:

```js
  function renderQMedia(target, type, url){
    const el = document.getElementById(target);
    if (!el) return;
    el.innerHTML = "";
    if (!type || type === "none" || !url){
      el.hidden = true;
      return;
    }
    el.hidden = false;
    if (type === "image"){
      const img = document.createElement("img");
      img.src = url; img.alt = "";
      el.appendChild(img);
    } else if (type === "video"){
      const v = document.createElement("video");
      v.src = url; v.controls = true; v.preload = "metadata";
      el.appendChild(v);
    } else if (type === "audio"){
      const a = document.createElement("audio");
      a.src = url; a.controls = true; a.preload = "metadata";
      el.appendChild(a);
    }
  }
```

Then **inside** `renderQuestion()`, after the existing `$("#qText").textContent = ...` (or whichever line sets the prompt text), add:

```js
    renderQMedia("qPromptMedia", q.promptMediaType, q.promptMediaUrl);
```

And after the existing line that sets `$("#qAnswerText").textContent = ...`, add:

```js
    renderQMedia("qAnswerMedia", q.answerMediaType, q.answerMediaUrl);
```

> **Note for the implementer:** the legacy variable holding the question is whatever the existing `renderQuestion()` already uses (commonly `q` or `current`). Use the same name; don't introduce a new one.

- [ ] **Step 4: Static smoke-test**

```bash
node --check app.js
```

Expected: silent.

- [ ] **Step 5: Commit**

```bash
git add index.html app.js styles.css
git commit -m "feat(game): render prompt + answer media in question screen"
```

---

## Task 10: End-to-end smoke test

**Files:** none (manual, with one user-driven step).

- [ ] **Step 1: Sanity — text-only flow still works**

Start `python3 -m http.server 8765`. Open `admin.html` (sign in if needed). On the Questions tab, edit any existing question, change *only* the answer text by one character, save. Toast appears. Open `index.html`, find that question, confirm the new text shows.

If anything's wrong, the media-field changes broke the no-media path — fix before proceeding.

- [ ] **Step 2: Image upload — happy path**

Have a small image file ready (≤ 5 MB, PNG or JPG). Pick a Question with no media currently.

1. Edit it.
2. In the modal's "وسائط مع السؤال" block: click **صورة**, click **Choose file**, pick the image.
3. The preview area should show the image immediately (object URL).
4. Click حفظ. Toast: "تم الحفظ".
5. Open `index.html` in another tab. Pick that category, click that question's cell.
6. The question screen should show the image above (or below — depending on layout) the prompt text.

If the image doesn't appear in the game, check the JS console of `index.html` for the question's `promptMediaType` / `promptMediaUrl` values; if they're `"none"` / `null`, Task 3's reshape didn't carry the fields — re-check.

- [ ] **Step 3: Image replace**

Edit the same question, pick a different image, save. Game should show the new image; the old object should be gone from Storage. (Sanity check: in Supabase dashboard → Storage → `media/questions/{question_id}/`, only the new object should be there.)

- [ ] **Step 4: Image clear**

Edit the same question, switch the type radio to **بدون**, save. The preview clears. In the game, the question shows no image. In Supabase Storage, the question's directory is empty.

- [ ] **Step 5: Size limit**

Try uploading an image larger than 5 MB. The toast should reject it before any upload happens, and the file input should reset.

- [ ] **Step 6: Video and audio (smoke only)**

The exact same UI works for video (≤ 50 MB) and audio (≤ 10 MB). Pick one of each, attach to a fresh question (or the same one in turn), confirm:
- Modal preview plays in-place.
- Game shows a `<video controls>` / `<audio controls>` element.
- Replacing and clearing both work.

- [ ] **Step 7: RLS still gates writes**

In a private window without a session, in the JS console:
```js
await SHIFT_SB.client.storage.from("media").upload("questions/x/test.png", new Blob(["x"]));
```
Expected: an error from storage policy (status 401 / 403). If it succeeds, **stop and re-check** Phase 1 storage policies.

If anything fails, fix it — don't tag a half-working phase.

---

## Task 11: Final cleanup & tag

**Files:** none.

- [ ] **Step 1: Working tree clean**

```bash
git status
git log --oneline | head -10
```

Top of log should be (in order, newest first):
```
… feat(game): render prompt + answer media …
… feat(admin): styles for media field …
… feat(admin): questions — upload / replace / clear prompt and answer media
… feat(admin): categories — upload / replace / clear icon and cover
… feat(admin): sections — upload / replace / clear cover image
… feat(admin): media field-type for openEditModal …
… feat(content): carry media fields through legacy CATEGORIES shape
… feat(lib): storage helpers — uploadMedia / deleteMedia / publicUrlFor
… (Phase 4 commits) …
```

- [ ] **Step 2: Confirm `app.js` change is contained**

```bash
git diff v0.4-phase4 -- app.js | head -40
```

You should see the new `renderQMedia` helper and the two call sites inside `renderQuestion`. Nothing else.

- [ ] **Step 3: Confirm no service_role leak**

```bash
git log -p -- lib/supabase.js admin.js admin.css index.html app.js styles.css lib/content.js | grep -i service_role
```

Expected: empty.

- [ ] **Step 4: Tag**

```bash
git tag -a v0.5-phase5 -m "Phase 5: media uploads (image / video / audio) for sections, categories, questions"
```

- [ ] **Step 5: Phase 5 success criteria**

✓ Admin can attach an image to a question; it shows in the game.
✓ Admin can replace it; old object is gone, new one shows.
✓ Admin can clear it; game shows no media for that question.
✓ Same for video and audio (size limits respected).
✓ Same machinery works for Sections cover and Categories icon/cover (these don't render in the game yet, but the rows in Supabase carry the URL — Phase 6 / future polish can render them).
✓ Text-only edits still work — adding/editing/deleting a question without touching media behaves exactly as in Phase 4.
✓ RLS still blocks anonymous writes to `media` bucket.

---

## What's NOT in this phase

- **Drag-to-reorder, search, batch ops** → Phase 6.
- **Pagination** → not needed yet.
- **Cropping / image processing** → out of scope; whatever the user uploads is what's stored.
- **CDN / image transforms** → Supabase Storage's image transformations (`?width=400`) are available but optional; we use the raw public URL.
- **Sections cover / Categories cover rendering in the game** → the URLs are stored, but the game UI doesn't show them yet. We can add those in a follow-up if you want category illustrations on the board.
