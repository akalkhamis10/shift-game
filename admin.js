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

  // Serialize evaluations: the INITIAL_SESSION onAuthStateChange event and our
  // boot call would otherwise both call getSession() at the same time and race
  // for Supabase's auth-token Web Lock — one would steal the lock from the
  // other and the awaiting promise rejects, leaving the page stuck on
  // "pending". Chaining ensures only one evaluation runs at a time.
  let evalChain = Promise.resolve();
  function evaluate() {
    evalChain = evalChain.then(doEvaluate).catch((err) => {
      console.error("[admin] state evaluation failed:", err);
      setStatus("تعذّر التحقق من الجلسة. حاول التحديث.", "is-bad");
      setState("signed-out");
    });
    return evalChain;
  }
  async function doEvaluate() {
    const email = await auth.currentEmail();
    if (!email) { setState("signed-out"); return; }

    // We have a session. Show the topbar email immediately.
    $("admEmail").textContent = email;

    const ok = await auth.isAdmin();
    setState(ok ? "authorized" : "not-authorized");
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

  // Listen to all auth state changes. Supabase fires an "INITIAL_SESSION"
  // event once it has restored the session from storage on init, so we don't
  // need a separate boot call — that would race the SDK's own lock and stick
  // the page on "pending". As a safety net, fall back to a manual evaluate()
  // if INITIAL_SESSION hasn't fired in 1.5s (e.g. very old SDK builds).
  let initialSessionSeen = false;
  client.auth.onAuthStateChange((event) => {
    if (event === "INITIAL_SESSION") initialSessionSeen = true;
    evaluate();
  });
  setTimeout(() => { if (!initialSessionSeen) evaluate(); }, 1500);

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
    // Clear/set the `hidden` attribute on each panel so the
    // `.adm-panel[hidden] { display: none !important }` rule doesn't trap an
    // inactive-at-load panel hidden after a tab switch.
    for (const p of document.querySelectorAll(".adm-panel")){
      p.hidden = p.dataset.tabPanel !== name;
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

})();
