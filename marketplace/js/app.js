// Boot, hash router, and event delegation (data-action / data-form / data-change).
import * as S from "./store.js";
import * as V from "./views.js";
import { openModal, closeModal, modalOpen, toast, formData, fileToDataURL, download } from "./ui.js";
import { imgSrc, artSVG } from "./art.js";
import * as M from "./media.js";

const app = document.getElementById("app");

// transient UI state (not persisted)
let modal = null; // { type, id }
let pendingMedia = null; // entry upload: { media, image, src, duration, peaks }
let deliverMedia = null; // direct-hire delivery upload (same shape)
let draft = loadDraft();

function loadDraft() { try { return JSON.parse(sessionStorage.getItem("marsam:draft") || "{}"); } catch { return {}; } }
function saveDraft() { try { sessionStorage.setItem("marsam:draft", JSON.stringify(draft)); } catch {} }

// ---------------------------------------------------------------- routing
function parse() {
  const h = location.hash.slice(1) || "/";
  const [path, query = ""] = h.split("?");
  const q = Object.fromEntries(new URLSearchParams(query));
  const parts = path.split("/").filter(Boolean);
  return { path: "/" + parts.join("/"), parts, q };
}

function view(route, me) {
  const [a, b] = route.parts;
  const q = route.q;
  switch (a) {
    case undefined: return V.home(me);
    case "how": return V.how();
    case "contests": return b ? V.contestPage(b, q, me) : V.contestsPage(q);
    case "artists": return b ? V.artistPage(b, me) : V.artistsPage(q);
    case "launch": {
      if (q.cat && S.CATEGORIES.some((c) => c.id === q.cat) && !q.step) { draft.category = q.cat; saveDraft(); }
      let step = Math.min(4, Math.max(1, Number(q.step) || 1));
      if (step > 1 && !draft.category) step = 1;
      if (step > 2 && !(draft.title && draft.brief)) step = 2;
      if (step > 3 && !draft.package) step = 3;
      return V.launchPage(step, draft, me);
    }
    case "projects": return V.projectPage(b, me, deliverMedia);
    case "dashboard": return V.dashboard(me, q);
    case "notifications": return V.notificationsPage(me);
    case "login": return me && !q.switch ? V.dashboard(me, q) : V.loginPage(q);
    default: return V.notFound();
  }
}

let lastPath = null;
function render() {
  const route = parse();
  const me = S.currentUser();
  const titleFor = { contests: "المسابقات", artists: "الفنانون", launch: "أطلق مسابقة", dashboard: "لوحتي", how: "كيف تعمل", login: "الدخول", notifications: "الإشعارات", projects: "مشروع" };
  document.title = (titleFor[route.parts[0]] ? titleFor[route.parts[0]] + " — " : "") + "مَرسم | سوق فنّ الذكاء الاصطناعي";
  app.innerHTML = `${V.demoBar(me)}${V.header(me, route.path)}<main id="main">${view(route, me)}</main>${V.footer()}`;
  if (route.path !== lastPath) {
    window.scrollTo(0, 0);
    if (route.path.startsWith("/projects")) deliverMedia = null;
    lastPath = route.path;
  }
  syncModal(route, me);
  M.hydrate(document);
}

/** Keep the modal in sync with ?entry= and refresh its content after store changes. */
function syncModal(route, me) {
  if (route.q.entry && (!modal || modal.id !== route.q.entry)) {
    modal = { type: "entry", id: route.q.entry };
    openModal(String(V.entryModal(modal.id, me)), { wide: true });
    return;
  }
  if (modal && modal.type === "entry" && modalOpen()) {
    const body = document.querySelector(".modal-body");
    if (body) { body.innerHTML = String(V.entryModal(modal.id, me)); M.hydrate(body); }
  }
}

function setQuery(key, val) {
  const { path, q } = parse();
  if (val) q[key] = val; else delete q[key];
  history.replaceState(null, "", V.qs("#" + path, q));
}

function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

function showEntry(id) {
  modal = { type: "entry", id };
  setQuery("entry", id);
  const me = S.currentUser();
  M.stopSpeaking();
  if (modalOpen()) document.querySelector(".modal-body").innerHTML = String(V.entryModal(id, me));
  else openModal(String(V.entryModal(id, me)), { wide: true });
  M.hydrate(document);
}

function dismissModal() {
  if (modal?.type === "entry") setQuery("entry", "");
  modal = null;
  pendingMedia = null;
  M.stopSpeaking();
  closeModal();
}

function showModal(type, id, content, opts) {
  modal = { type, id };
  openModal(String(content), opts);
  M.hydrate(document);
}

function refreshSubmitModal() {
  if (modal?.type !== "submit") return;
  const form = document.querySelector('[data-form="submit-entry"]');
  const keep = form ? formData(form) : {};
  document.querySelector(".modal-body").innerHTML = String(V.submitModal(modal.id, pendingMedia));
  const f2 = document.querySelector('[data-form="submit-entry"]');
  for (const el of f2.elements) {
    if (!el.name || el.type === "file" || !(el.name in keep)) continue;
    const v = [].concat(keep[el.name]);
    if (el.type === "checkbox") el.checked = v.includes(el.value);
    else el.value = v[0];
  }
  M.hydrate(f2);
}

function demoMedia(media, contest) {
  const seed = Math.random().toString(36).slice(2, 9);
  if (media === "video") return { media, image: `art:${seed}`, src: `demo-video:${seed}:`, duration: Number(contest?.specs?.duration) || 30 };
  if (media === "audio") {
    const voice = contest && ["voice", "avatar"].includes(contest.category);
    return voice
      ? { media, image: `art:${seed}:waves`, src: `demo-voice:${seed}`, duration: Number(contest.specs?.duration) || 30, script: contest.specs?.script || "", peaks: M.demoPeaks(seed) }
      : { media, image: `art:${seed}:rings`, src: `demo-music:${seed}`, duration: 12, peaks: M.demoPeaks(seed) };
  }
  return { media: "image", image: `art:${seed}` };
}

/** Run a store mutation and surface validation errors as toasts. */
function attempt(fn, okMsg) {
  try {
    const r = fn();
    if (okMsg) toast(okMsg);
    return r ?? true;
  } catch (e) {
    toast(e.message || "حدث خطأ", "err");
    return false;
  }
}

// ---------------------------------------------------------------- click actions
const actions = {
  "close-modal": () => { if (modal?.type === "pick") { const id = modal.id; modal = null; closeModal(); showEntry(id); } else dismissModal(); },
  "modal-backdrop": (el, ev) => { if (ev.target === el) actions["close-modal"](); },
  "toggle-nav": () => document.getElementById("nav")?.classList.toggle("open"),
  "reset-demo": () => { if (confirm("إعادة كل بيانات العرض لحالتها الأصلية؟")) { draft = {}; saveDraft(); M.clearBlobs(); S.resetDemo(); toast("أُعيد ضبط البيانات"); go("#/"); } },
  logout: () => { S.logout(); toast("تم تسجيل الخروج"); go("#/"); },
  "login-as": (el) => { S.login(el.dataset.id); const next = parse().q.next; toast(`أهلًا ${S.currentUser().name}`); go(next && next.startsWith("#/") ? next : "#/dashboard"); },
  "open-entry": (el) => showEntry(el.dataset.id),
  rate: (el) => attempt(() => S.rateEntry(el.dataset.id, Number(el.dataset.value))),
  finalist: (el) => attempt(() => S.toggleFinalist(el.dataset.id)),
  eliminate: (el) => attempt(() => S.toggleEliminate(el.dataset.id)),
  withdraw: (el) => { if (confirm("سحب المشاركة نهائيًا من المسابقة؟")) { if (attempt(() => S.withdrawEntry(el.dataset.id), "تم سحب المشاركة")) dismissModal(); } },
  "admin-remove": (el) => { const r = prompt("سبب الإزالة:", "مخالفة سياسة الأعمال المولّدة"); if (r !== null && attempt(() => S.removeEntryAsAdmin(el.dataset.id, r), "أُزيلت المشاركة")) dismissModal(); },
  "pick-winner": (el) => { const id = el.dataset.id; setQuery("entry", ""); closeModal(); showModal("pick", id, V.pickWinnerModal(id)); },
  "submit-entry": (el) => {
    if (!S.currentUser()) return go("#/login?role=artist");
    pendingMedia = null;
    showModal("submit", el.dataset.id, V.submitModal(el.dataset.id, null), { wide: false });
  },
  "demo-art": () => { const c = S.contest(modal.id); pendingMedia = demoMedia(S.mediaOf(c), c); refreshSubmitModal(); },
  "demo-art-deliver": () => { deliverMedia = demoMedia("image"); render(); },
  speak: (el) => { if (!M.speak(el.dataset.text)) toast("المتصفح لا يدعم القراءة الصوتية", "err"); },
  "edit-brief": (el) => showModal("brief", el.dataset.id, V.editBriefModal(S.contest(el.dataset.id))),
  "close-submissions": (el) => { if (confirm("إغلاق المشاركات الآن والانتقال لمرحلة التحكيم؟")) attempt(() => S.closeSubmissions(el.dataset.id), "أُغلقت المشاركات"); },
  extend: (el) => attempt(() => S.extendDeadline(el.dataset.id, 2), "مُدّدت المسابقة يومين"),
  refund: (el) => { if (confirm("استرداد المبلغ كاملًا وإلغاء المسابقة دون فائز؟")) attempt(() => S.requestRefund(el.dataset.id), "تم الاسترداد — سيصلك المبلغ خلال 3–5 أيام عمل"); },
  handover: (el) => showModal("handover", el.dataset.id, V.handoverModal(S.contest(el.dataset.id)), { wide: true }),
  "download-entry": (el) => downloadMedia(S.entry(el.dataset.id), `marsam-${el.dataset.id}`),
  "download-hire": (el) => downloadMedia(S.hire(el.dataset.id).delivery, `marsam-${el.dataset.id}`),
  "download-license": (el) => download(`license-${el.dataset.id}.txt`, V.licenseText(S.contest(el.dataset.id))),
  hire: (el) => showModal("hire", el.dataset.id, V.hireModal(S.user(el.dataset.id))),
  "hire-accept": (el) => attempt(() => S.respondHire(el.dataset.id, true), "تم قبول المشروع"),
  "hire-decline": (el) => { if (confirm("الاعتذار عن المشروع؟ سيُعاد المبلغ للعميل.")) attempt(() => S.respondHire(el.dataset.id, false), "تم الاعتذار"); },
  "hire-revision": (el) => { const n = prompt("ما التعديل المطلوب؟"); if (n !== null) attempt(() => S.requestRevision(el.dataset.id, n), "أُرسل طلب التعديل"); },
  "mark-read": () => S.markAllRead(),
};

const EXT = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/ogg": "ogg", "audio/webm": "webm" };
async function downloadMedia(x, name) {
  const src = x.src || "";
  try {
    if (src.startsWith("demo-video:")) { const [, seed, kind] = src.split(":"); return download(`${name}-preview.svg`, M.demoVideoSVG(seed, kind), "image/svg+xml"); }
    if (src.startsWith("demo-voice:")) return download(`${name}-script.txt`, x.script || "");
    if (src) {
      const blob = await M.blobFor(src);
      if (!blob) throw new Error("الملف غير متاح في هذا المتصفح");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${name}.${EXT[blob.type] || blob.type.split("/")[1] || "bin"}`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return;
    }
    downloadImage(x.image, name);
  } catch (e) { toast(e.message, "err"); }
}

function downloadImage(ref, name) {
  if (ref.startsWith("art:")) {
    const [, seed, kind] = ref.split(":");
    download(`${name}.svg`, artSVG(seed, kind), "image/svg+xml");
  } else download(`${name}.jpg`, imgSrc(ref));
}

document.addEventListener("click", (ev) => {
  const el = ev.target.closest("[data-action]");
  if (!el) {
    if (ev.target.closest("#nav a")) document.getElementById("nav")?.classList.remove("open");
    return;
  }
  const fn = actions[el.dataset.action];
  if (!fn) return;
  if (el.dataset.action === "modal-backdrop" && ev.target !== el) return;
  ev.preventDefault();
  fn(el, ev);
});

document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && modalOpen()) actions["close-modal"]();
  if (modal?.type === "entry" && modalOpen() && (ev.key === "ArrowLeft" || ev.key === "ArrowRight") && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) {
    // RTL: left arrow = next (visually forward)
    const btn = document.querySelector(ev.key === "ArrowLeft" ? ".nav-arrow.next" : ".nav-arrow.prev");
    btn?.click();
  }
});

// ---------------------------------------------------------------- forms
const forms = {
  "filter-contests": (d) => go(V.qs("#/contests", { q: d.q, st: d.st, sort: d.sort === "new" ? "" : d.sort, cat: d.cat })),
  "filter-artists": (d) => go(V.qs("#/artists", { q: d.q, tool: d.tool, sort: d.sort === "rating" ? "" : d.sort })),
  comment: (d, f) => { if (attempt(() => S.addComment(f.dataset.id, d.text))) { const i = document.querySelector('[data-form="comment"] input'); i?.focus(); } },
  "pick-winner": (d, f) => {
    const e = S.entry(f.dataset.id);
    if (attempt(() => S.pickWinner(e.contestId, e.id, { stars: d.stars, text: d.text }), "🏆 تم اختيار الفائز ونقل الملكية إليك")) {
      modal = null; closeModal();
      showModal("handover", e.contestId, V.handoverModal(S.contest(e.contestId)), { wide: true });
    }
  },
  "submit-entry": (d, f) => {
    const r = attempt(() => S.submitEntry(f.dataset.id, { ...(pendingMedia || {}), title: d.title, tool: d.tool, prompt: d.prompt, note: d.note, agree: d.agree }), "تم إرسال مشاركتك 🎉");
    if (r) { pendingMedia = null; modal = null; closeModal(); go(`#/contests/${f.dataset.id}?tab=entries`); }
  },
  "edit-brief": (d, f) => { if (attempt(() => S.updateBrief(f.dataset.id, { ...d, specs: specsFrom(d) }), "تم تحديث الموجز")) dismissModal(); },
  hire: (d, f) => {
    const h = attempt(() => S.createHire(f.dataset.id, d), "أُرسل الطلب للفنان");
    if (h) { modal = null; closeModal(); go(`#/projects/${h.id}`); }
  },
  deliver: (d, f) => { if (attempt(() => S.deliverHire(f.dataset.id, { ...(deliverMedia || {}), note: d.note, prompt: d.prompt, tool: [].concat(d.tool || []).join(" + ") }), "تم التسليم")) deliverMedia = null; },
  "approve-hire": (d, f) => attempt(() => S.approveHire(f.dataset.id, d), "تم الاعتماد وتحويل المبلغ للفنان"),
  "hire-msg": (d, f) => attempt(() => S.addHireMessage(f.dataset.id, d.text)),
  withdraw: (d) => attempt(() => S.withdraw(d.iban), "تم طلب السحب — يصل خلال 1–2 يوم عمل"),
  profile: (d) => attempt(() => S.updateProfile({ ...d, tools: d.tools || [] }), "تم حفظ الملف"),
  register: (d) => {
    const u = attempt(() => S.register(d));
    if (u) { toast(`مرحبًا ${u.name}! تم إنشاء حسابك`); go(d.next && d.next.startsWith("#/") ? d.next : u.role === "client" ? "#/launch" : "#/contests"); }
  },
  wizard: (d, f) => {
    const step = Number(f.dataset.step);
    if (step === 1) draft.category = d.category;
    if (step === 1 && draft.specCat !== d.category) { draft.specs = {}; draft.specCat = d.category; }
    if (step === 2) Object.assign(draft, { title: d.title, brand: d.brand, brief: d.brief, audience: d.audience, styles: [].concat(d.styles || []), colors: d.colors, usage: d.usage, avoid: d.avoid, specs: specsFrom(d) });
    if (step === 3) Object.assign(draft, { package: d.package, guaranteed: !!d.guaranteed, blind: !!d.blind, featured: !!d.featured, days: Number(d.days) });
    saveDraft();
    go(`#/launch?step=${step + 1}`);
  },
  launch: () => {
    const c = attempt(() => S.createContest(draft));
    if (c) { draft = {}; saveDraft(); toast("🚀 أُطلقت مسابقتك! سيبدأ الفنانون بالمشاركة قريبًا"); go(`#/contests/${c.id}`); }
  },
};

document.addEventListener("submit", (ev) => {
  const f = ev.target.closest("[data-form]");
  if (!f) return;
  ev.preventDefault();
  forms[f.dataset.form]?.(formData(f), f);
});

function specsFrom(d) {
  const out = {};
  for (const [k, v] of Object.entries(d)) if (k.startsWith("spec_")) out[k.slice(5)] = v;
  return out;
}

// ---------------------------------------------------------------- change handlers (selects, files)
const kindOf = (file) => (file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : file.type.startsWith("image/") ? "image" : "");

async function readMedia(file) {
  const kind = kindOf(file);
  if (kind === "image") return { media: "image", image: await fileToDataURL(file) };
  if (!kind) throw new Error("نوع الملف غير مدعوم");
  if (file.size > M.LIMITS[kind]) throw new Error(`الملف أكبر من ${Math.round(M.LIMITS[kind] / 1048576)}MB`);
  toast(kind === "video" ? "جارٍ تجهيز الفيديو…" : "جارٍ تحليل الصوت…");
  if (kind === "video") {
    const info = await M.probeVideo(file);
    const src = await M.putBlob(file);
    return { media: "video", image: info.poster || `art:${src.slice(4)}`, src, duration: info.duration };
  }
  const info = await M.probeAudio(file);
  const src = await M.putBlob(file);
  return { media: "audio", image: `art:${src.slice(4)}:waves`, src, duration: info.duration, peaks: info.peaks };
}

async function handleFile(file, which) {
  try {
    if (which === "entry") {
      const want = S.mediaOf(S.contest(modal.id));
      if (kindOf(file) !== want) throw new Error(`هذه المسابقة تستقبل ${S.MEDIA[want].noun} فقط`);
    }
    const m = await readMedia(file);
    if (which === "entry") { if (modal?.type !== "submit") return; pendingMedia = m; refreshSubmitModal(); }
    else { deliverMedia = m; render(); }
  } catch (e) { toast(e.message, "err"); }
}

document.addEventListener("change", (ev) => {
  const el = ev.target.closest("[data-change]");
  if (el) {
    const k = el.dataset.change;
    if (k === "switch-user") {
      if (el.value) { S.login(el.value); toast(`تتصفّح الآن كـ ${S.currentUser().name}`); }
      else S.logout();
      return;
    }
    if (k === "entry-file" && el.files[0]) return handleFile(el.files[0], "entry");
    if (k === "deliver-file" && el.files[0]) return handleFile(el.files[0], "deliver");
  }
  // live highlight for radio "cards"
  if (ev.target.matches('.pkgs input[type=radio], .cats.pick input[type=radio]')) {
    const box = ev.target.closest(".pkgs, .cats");
    box.querySelectorAll(".selected").forEach((x) => x.classList.remove("selected"));
    ev.target.closest("label").classList.add("selected");
  }
});

// drag & drop onto upload zones
document.addEventListener("dragover", (ev) => { const z = ev.target.closest("[data-drop]"); if (z) { ev.preventDefault(); z.classList.add("over"); } });
document.addEventListener("dragleave", (ev) => ev.target.closest?.("[data-drop]")?.classList.remove("over"));
document.addEventListener("drop", (ev) => {
  const z = ev.target.closest("[data-drop]");
  if (!z) return;
  ev.preventDefault();
  z.classList.remove("over");
  const file = ev.dataTransfer.files[0];
  if (file) handleFile(file, z.closest('[data-form="deliver"]') ? "deliver" : "entry");
});

// ---------------------------------------------------------------- boot
S.init();
S.subscribe(render);
window.addEventListener("hashchange", () => {
  if (modalOpen() && !parse().q.entry) { modal = null; pendingMedia = null; closeModal(); }
  render();
});
render();
