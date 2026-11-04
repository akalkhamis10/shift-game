// Small UI toolkit: auto-escaping html`` templates, formatting, toasts, modal.

export class Safe {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}
export const raw = (s) => new Safe(String(s));

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

function fmt(v) {
  if (v == null || v === false || v === true) return "";
  if (v instanceof Safe) return v.s;
  if (Array.isArray(v)) return v.map(fmt).join("");
  return esc(v);
}

/** Tagged template: every interpolation is HTML-escaped unless wrapped in raw()/html``. */
export function html(strings, ...vals) {
  let out = strings[0];
  for (let i = 0; i < vals.length; i++) out += fmt(vals[i]) + strings[i + 1];
  return new Safe(out);
}

// ---------- formatting ----------
const nf = new Intl.NumberFormat("ar-SA-u-nu-latn");
export const num = (n) => nf.format(Math.round(n || 0));
export const money = (n) => `${num(n)} ر.س`;

const DAY = 86400000, HOUR = 3600000, MIN = 60000;

export function timeLeft(ts) {
  const d = ts - Date.now();
  if (d <= 0) return "انتهى";
  if (d >= DAY) { const n = Math.floor(d / DAY); return `متبقٍ ${n} ${n === 1 ? "يوم" : n === 2 ? "يومان" : n <= 10 ? "أيام" : "يومًا"}`; }
  if (d >= HOUR) return `متبقٍ ${Math.floor(d / HOUR)} ساعة`;
  return `متبقٍ ${Math.max(1, Math.floor(d / MIN))} دقيقة`;
}

export function timeAgo(ts) {
  const d = Date.now() - ts;
  if (d < MIN) return "الآن";
  if (d < HOUR) return `قبل ${Math.floor(d / MIN)} دقيقة`;
  if (d < DAY) return `قبل ${Math.floor(d / HOUR)} ساعة`;
  const n = Math.floor(d / DAY);
  if (n < 30) return `قبل ${n} ${n === 1 ? "يوم" : n <= 10 ? "أيام" : "يومًا"}`;
  return new Date(ts).toLocaleDateString("ar-SA-u-nu-latn-ca-gregory", { day: "numeric", month: "long", year: "numeric" });
}

export const dateStr = (ts) =>
  new Date(ts).toLocaleDateString("ar-SA-u-nu-latn-ca-gregory", { day: "numeric", month: "long", year: "numeric" });

// ---------- stars ----------
export function stars(value, opts = {}) {
  const { interactive = false, entryId = "", size = "" } = opts;
  const v = Math.round(value || 0);
  let s = "";
  for (let i = 1; i <= 5; i++) {
    const on = i <= v ? "on" : "";
    s += interactive
      ? `<button type="button" class="star ${on}" data-action="rate" data-id="${esc(entryId)}" data-value="${i}" aria-label="${i} من 5">★</button>`
      : `<span class="star ${on}">★</span>`;
  }
  return raw(`<span class="stars ${size}" ${interactive ? 'role="group" aria-label="التقييم"' : `aria-label="${v} من 5"`}>${s}</span>`);
}

// ---------- toast ----------
export function toast(msg, type = "ok") {
  let host = document.getElementById("toasts");
  if (!host) {
    host = document.createElement("div");
    host.id = "toasts";
    host.setAttribute("aria-live", "polite");
    document.body.appendChild(host);
  }
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => el.classList.add("out"), 3200);
  setTimeout(() => el.remove(), 3700);
}

// ---------- modal ----------
let lastFocus = null;
export function openModal(content, { wide = false } = {}) {
  closeModal();
  lastFocus = document.activeElement;
  const wrap = document.createElement("div");
  wrap.className = "modal-backdrop";
  wrap.dataset.action = "modal-backdrop";
  wrap.innerHTML = `<div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true"><button class="modal-x" data-action="close-modal" aria-label="إغلاق">✕</button><div class="modal-body">${content}</div></div>`;
  document.body.appendChild(wrap);
  document.body.classList.add("no-scroll");
  const f = wrap.querySelector("input, textarea, select, button:not(.modal-x)");
  (f || wrap.querySelector(".modal-x")).focus({ preventScroll: true });
  return wrap;
}
export function closeModal() {
  document.querySelectorAll(".modal-backdrop").forEach((m) => m.remove());
  document.body.classList.remove("no-scroll");
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  lastFocus = null;
}
export const modalOpen = () => !!document.querySelector(".modal-backdrop");

// ---------- files ----------
/** Read an image file, downscale it and return a JPEG data URL (keeps localStorage small). */
export function fileToDataURL(file, max = 1100, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) return reject(new Error("الملف يجب أن يكون صورة"));
    if (file.size > 15 * 1024 * 1024) return reject(new Error("حجم الصورة أكبر من 15MB"));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("تعذّرت قراءة الصورة")); };
    img.src = url;
  });
}

export function download(filename, content, type = "text/plain;charset=utf-8") {
  const a = document.createElement("a");
  a.href = content.startsWith("data:") ? content : URL.createObjectURL(new Blob([content], { type }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function formData(form) {
  const fd = new FormData(form);
  const out = {};
  for (const [k, v] of fd.entries()) {
    if (k in out) out[k] = [].concat(out[k], v);
    else out[k] = typeof v === "string" ? v.trim() : v;
  }
  return out;
}
