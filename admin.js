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

})();
