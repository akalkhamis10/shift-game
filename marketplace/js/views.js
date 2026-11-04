// Page + modal renderers. Pure functions of (store state, route) -> html``.
import * as S from "./store.js";
import { html, raw, money, num, timeLeft, timeAgo, dateStr, stars } from "./ui.js";
import { imgSrc, avatarURI } from "./art.js";
import { demoVideoURI, demoPeaks, fmtDur } from "./media.js";

// ---------------------------------------------------------------- icons
const P = {
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  sparkle: '<path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/><path d="M19 3v4M17 5h4"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  wallet: '<rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20M16 15h2"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/>',
  flag: '<path d="M4 22V4s1-1 4-1 5 2 8 2 4-1 4-1v12s-1 1-4 1-5-2-8-2-4 1-4 1"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  arrow: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  play: '<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor" stroke="none"/>',
  video: '<rect x="2" y="5" width="15" height="14" rx="2"/><path d="M17 10l5-3v10l-5-3"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>',
};
export const icon = (n) => raw(`<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ""}</svg>`);

const avatar = (u, size = "") => html`<img class="avatar ${size}" src="${avatarURI(u?.name || "?", u?.id)}" alt="">`;

const STATUS = {
  open: { t: "مفتوحة", c: "green" },
  judging: { t: "قيد التحكيم", c: "amber" },
  completed: { t: "مكتملة", c: "violet" },
  refunded: { t: "ملغاة ومستردّة", c: "gray" },
};
const statusBadge = (c) => { const s = STATUS[S.status(c)]; return html`<span class="badge ${s.c}">${s.t}</span>`; };

const LEVEL = { new: "فنان جديد", mid: "متوسط", pro: "محترف", top: "نخبة" };
const HIRE_STATUS = {
  requested: { t: "بانتظار رد الفنان", c: "amber" },
  active: { t: "قيد التنفيذ", c: "blue" },
  delivered: { t: "تم التسليم — بانتظار الاعتماد", c: "violet" },
  revision: { t: "تعديل مطلوب", c: "amber" },
  approved: { t: "مكتمل", c: "green" },
  declined: { t: "مرفوض", c: "gray" },
};
const TX = { escrow: "دفع (ضمان)", release: "تحرير ضمان", refund: "استرداد", payout: "أرباح", withdrawal: "سحب", fee: "عمولة" };

const empty = (title, sub = "", cta = "") => html`<div class="empty"><div class="empty-art"></div><h3>${title}</h3>${sub ? html`<p>${sub}</p>` : ""}${cta}</div>`;

// ---------------------------------------------------------------- media
export const mediaIcon = (m) => ({ video: "video", audio: "music" })[m] || "image";
const isVoice = (x) => !!(x.script || x.src?.startsWith("demo-voice:"));

export function waveSVG(peaks, cls = "") {
  const w = 4, gap = 2, n = peaks.length;
  const bars = peaks.map((p, i) => { const h = Math.max(6, p * 100); return `<rect x="${i * (w + gap)}" y="${((100 - h) / 2).toFixed(1)}" width="${w}" height="${h.toFixed(1)}" rx="2"/>`; }).join("");
  return raw(`<svg class="wave ${cls}" viewBox="0 0 ${n * (w + gap)} 100" preserveAspectRatio="none" aria-hidden="true">${bars}</svg>`);
}

/** Card thumbnail for any media (entry, delivery, or a contest cover). */
function mediaThumb(x) {
  const m = x.media || "image";
  const dur = x.duration ? html`<span class="dur">${fmtDur(x.duration)}</span>` : "";
  if (m === "video") return html`<img src="${imgSrc(x.image)}" alt="" loading="lazy"><span class="play-badge">${icon("play")}</span>${dur}`;
  if (m === "audio") return html`<img class="audio-bg" src="${imgSrc(x.image)}" alt="" loading="lazy"><span class="audio-thumb">${icon(isVoice(x) ? "mic" : "music")}${waveSVG(x.peaks || demoPeaks(x.id || x.image, 36))}</span>${dur}`;
  return html`<img src="${imgSrc(x.image)}" alt="" loading="lazy">`;
}

/** Full player for an entry / delivery. Video & audio sources are filled in by media.hydrate(). */
export function mediaView(x, alt = "") {
  const m = x.media || "image";
  if (m === "video") {
    if (x.src?.startsWith("demo-video:")) {
      const [, seed, kind] = x.src.split(":");
      return html`<div class="player"><img src="${demoVideoURI(seed, kind)}" alt="${alt}"><span class="demo-flag">${icon("play")} معاينة متحركة تجريبية · ${fmtDur(x.duration)}</span></div>`;
    }
    const poster = x.image && !x.image.startsWith("art:") ? x.image : "";
    return html`<video class="player-video" controls playsinline preload="metadata" ${poster ? raw(`poster="${poster}"`) : ""} data-media-src="${x.src}" aria-label="${alt}"></video>`;
  }
  if (m === "audio") {
    return html`<div class="player audio-player"><img class="audio-bg" src="${imgSrc(x.image)}" alt="">
      <div class="audio-fg">${icon(isVoice(x) ? "mic" : "music")}${waveSVG(x.peaks || demoPeaks(x.id || x.image), "big")}
        ${x.src?.startsWith("demo-voice:")
          ? html`<button type="button" class="btn light" data-action="speak" data-text="${x.script || "عيّنة صوتية تجريبية"}">${icon("play")} استمع (قراءة آلية تجريبية)</button>`
          : html`<audio controls preload="metadata" data-media-src="${x.src}" aria-label="${alt}"></audio>`}
        ${x.duration ? html`<span class="dur-light">${fmtDur(x.duration)}</span>` : ""}
      </div></div>`;
  }
  return html`<img src="${imgSrc(x.image)}" alt="${alt}">`;
}

const toolChips = (tool) => String(tool || "").split(" + ").filter(Boolean).map((t) => html`<span class="chip">${icon("sparkle")} ${t}</span>`);

/** Tool checkboxes grouped by media (multi-select disclosure). */
function toolPicker(name, list, selected = [], first = "") {
  const sel = new Set([].concat(selected));
  const groups = Object.entries(S.TOOLS).map(([m, ts]) => [m, ts.filter((t) => list.includes(t))]).filter(([, ts]) => ts.length)
    .sort(([a], [b]) => (b === first) - (a === first));
  return html`${groups.map(([m, ts]) => html`<div class="tool-group"><span class="muted tiny">${icon(mediaIcon(m))} ${S.MEDIA[m].name}</span>
    <div class="chips pickable">${ts.map((t) => html`<label class="chip"><input type="checkbox" name="${name}" value="${t}" ${sel.has(t) ? raw("checked") : ""}> ${t}</label>`)}</div></div>`)}
    ${list.includes("أخرى") ? html`<div class="chips pickable"><label class="chip"><input type="checkbox" name="${name}" value="أخرى" ${sel.has("أخرى") ? raw("checked") : ""}> أخرى</label></div>` : ""}`;
}

/** Category-specific brief inputs (duration, aspect, dialect, script…). */
function specInputs(catId, values = {}) {
  const fields = S.specFields(catId);
  if (!fields.length) return "";
  const input = (f) => {
    const id = "sp_" + f.k, v = values[f.k] ?? f.def ?? "";
    if (f.type === "select") return html`<select id="${id}" name="spec_${f.k}">${f.options.map(([val, lab]) => html`<option value="${val}" ${String(v) === val ? raw("selected") : ""}>${lab}</option>`)}</select>`;
    if (f.type === "textarea") return html`<textarea id="${id}" name="spec_${f.k}" rows="3" placeholder="${f.placeholder || ""}" ${f.required ? raw("required") : ""}>${v}</textarea>`;
    return html`<input id="${id}" name="spec_${f.k}" value="${v}" placeholder="${f.placeholder || ""}">`;
  };
  const short = fields.filter((f) => f.type === "select" || f.type === "text");
  const long = fields.filter((f) => f.type === "textarea");
  return html`<fieldset class="specs"><legend>${icon(mediaIcon(S.category(catId).media))} تفاصيل ${S.MEDIA[S.category(catId).media].noun}</legend>
    <div class="spec-grid">${short.map((f) => html`<div><label for="sp_${f.k}">${f.label}</label>${input(f)}</div>`)}</div>
    ${long.map((f) => html`<label for="sp_${f.k}">${f.label}${f.required ? " *" : ""}</label>${input(f)}`)}
  </fieldset>`;
}

function categoryGroups(render) {
  return html`${Object.values(S.MEDIA).map((m) => html`<div class="cat-group"><h3>${icon(mediaIcon(m.id))} ${m.name}</h3>
    <div class="cats">${S.CATEGORIES.filter((c) => c.media === m.id).map(render)}</div></div>`)}`;
}

// ---------------------------------------------------------------- chrome
export function demoBar(me) {
  const opts = S.users().map((u) => html`<option value="${u.id}" ${me?.id === u.id ? raw("selected") : ""}>${u.name} — ${u.role === "client" ? "شركة" : u.role === "artist" ? "فنان" : "إدارة"}</option>`);
  return html`<div class="demobar"><div class="wrap demobar-in">
    <span><b>وضع العرض التجريبي</b> · البيانات محفوظة في متصفحك فقط، والدفع وهمي</span>
    <label class="demobar-switch">جرّب كـ
      <select data-change="switch-user" aria-label="تبديل الحساب"><option value="">زائر</option>${opts}</select>
    </label>
    <button class="linkbtn" data-action="reset-demo">إعادة ضبط البيانات</button>
  </div></div>`;
}

export function header(me, path) {
  const a = (href, label) => html`<a href="${href}" class="${path.startsWith(href.slice(1)) ? "active" : ""}">${label}</a>`;
  const unread = me ? S.unreadCount(me.id) : 0;
  return html`<header class="top"><div class="wrap top-in">
    <a class="logo" href="#/" aria-label="مَرسم — الرئيسية"><span class="logo-mark"></span><span class="logo-word">مَرسم</span></a>
    <nav class="nav" id="nav" aria-label="القائمة الرئيسية">
      ${a("#/contests", "المسابقات")}${a("#/artists", "الفنانون")}${a("#/how", "كيف تعمل")}
      ${me ? a("#/dashboard", "لوحتي") : ""}
    </nav>
    <div class="top-actions">
      ${me
        ? html`<a href="#/notifications" class="iconbtn" aria-label="الإشعارات">${icon("bell")}${unread ? html`<span class="dot">${unread > 9 ? "9+" : unread}</span>` : ""}</a>
               <a class="me" href="#/dashboard">${avatar(me, "sm")}<span class="me-name">${me.name.split(" ")[0]}</span></a>
               <button class="iconbtn" data-action="logout" aria-label="تسجيل الخروج" title="خروج">${icon("logout")}</button>`
        : html`<a href="#/login" class="btn ghost sm">دخول</a>`}
      ${!me || me.role === "client" ? html`<a href="#/launch" class="btn primary sm hide-xs">أطلق مسابقة</a>` : ""}
      <button class="iconbtn show-sm" data-action="toggle-nav" aria-label="القائمة">${icon("menu")}</button>
    </div>
  </div></header>`;
}

export function footer() {
  return html`<footer class="foot"><div class="wrap foot-in">
    <div><a class="logo" href="#/"><span class="logo-mark"></span><span class="logo-word">مَرسم</span></a>
      <p class="muted">سوق إبداعي يربط الشركات بفناني الذكاء الاصطناعي عبر المسابقات والمشاريع المباشرة.</p></div>
    <div><h4>للشركات</h4><a href="#/launch">أطلق مسابقة</a><a href="#/artists">وظّف فنانًا</a><a href="#/how">الباقات والأسعار</a></div>
    <div><h4>للفنانين</h4><a href="#/contests">تصفّح المسابقات</a><a href="#/login">انضم كفنان</a><a href="#/how#rules">سياسة الأعمال المولّدة</a></div>
    <div><h4>الثقة</h4><span>ضمان استرداد المبلغ</span><span>نقل ملكية موثّق</span><span>إفصاح إلزامي عن الأداة</span></div>
  </div><div class="wrap foot-bottom muted">© ${new Date().getFullYear()} مَرسم — نموذج أولي</div></footer>`;
}

// ---------------------------------------------------------------- cards
export function contestCard(c) {
  const st = S.status(c);
  const es = S.entriesOf(c.id);
  const m = S.mediaOf(c);
  const winner = c.winnerEntryId ? S.entry(c.winnerEntryId) : null;
  const thumb = winner || { media: m, image: c.cover, id: c.id, duration: Number(c.specs?.duration) || 0, script: c.category === "voice" ? "1" : "" };
  return html`<a class="card ccard" href="#/contests/${c.id}">
    <div class="ccard-img">${mediaThumb(thumb)}
      <div class="ccard-tags">${statusBadge(c)}${c.guaranteed ? html`<span class="badge dark">${icon("shield")} مضمونة</span>` : ""}${c.blind ? html`<span class="badge dark">${icon("lock")} سرية</span>` : ""}</div>
    </div>
    <div class="ccard-body">
      <div class="muted small">${S.category(c.category).icon} ${S.category(c.category).name} · ${c.brand}</div>
      <h3>${c.title}</h3>
      <div class="ccard-meta">
        <span class="prize">${money(c.prize)}</span>
        <span class="muted small" title="عدد المشاركات">${icon(mediaIcon(m))} ${num(es.length)}</span>
        <span class="muted small">${icon("clock")} ${st === "open" ? timeLeft(c.deadline) : STATUS[st].t}</span>
      </div>
    </div>
  </a>`;
}

const specialties = (a) => Object.keys(S.MEDIA).filter((m) => a.tools.some((t) => S.TOOLS[m].includes(t)));

function artistCard(a) {
  const st = S.artistStats(a.id);
  const pf = S.portfolioOf(a.id).slice(0, 3);
  return html`<a class="card acard" href="#/artists/${a.id}">
    <div class="acard-strip">${pf.length ? pf.map((e) => html`<img src="${imgSrc(e.image)}" alt="" loading="lazy">`) : html`<img src="${imgSrc("art:" + a.id)}" alt="">`}</div>
    <div class="acard-body">
      ${avatar(a, "md")}
      <div><h3>${a.name}</h3><div class="muted small">${a.country} · ${LEVEL[a.level] || ""}</div></div>
    </div>
    <div class="acard-stats">
      <span>${stars(st.rating)} <b>${st.rating ? st.rating.toFixed(1) : "—"}</b></span>
      <span>${icon("trophy")} ${num(st.wins)} فوز</span>
    </div>
    <div class="chips">${specialties(a).map((m) => html`<span class="chip spec">${icon(mediaIcon(m))} ${S.MEDIA[m].noun}</span>`)}${a.tools.slice(0, 2).map((t) => html`<span class="chip">${t}</span>`)}</div>
  </a>`;
}

function entryCard(e, c, me) {
  const a = S.user(e.artistId);
  const win = c.winnerEntryId === e.id;
  const fin = c.finalists.includes(e.id);
  const mine = me && me.id === e.artistId;
  return html`<button class="ecard ${e.status === "eliminated" ? "out" : ""} ${win ? "win" : ""}" data-action="open-entry" data-id="${e.id}">
    <div class="ecard-img">${mediaThumb(e)}
      <div class="ecard-tags">
        ${win ? html`<span class="badge gold">${icon("trophy")} الفائز</span>` : ""}
        ${fin && !win ? html`<span class="badge violet">قائمة نهائية</span>` : ""}
        ${e.status === "eliminated" ? html`<span class="badge gray">مستبعد</span>` : ""}
        ${mine ? html`<span class="badge blue">مشاركتك</span>` : ""}
      </div>
    </div>
    <div class="ecard-foot">
      <span class="ecard-artist">${avatar(a, "xs")} ${a?.name}</span>
      <span class="muted small">#${e.number}</span>
    </div>
    ${e.rating ? html`<div class="ecard-rating">${stars(e.rating, { size: "xs" })}</div>` : ""}
  </button>`;
}

// ---------------------------------------------------------------- home
export function home(me) {
  const open = S.contests({ st: "open", sort: "prize" }).slice(0, 3);
  const top = S.artists().map((a) => ({ a, s: S.artistStats(a.id) })).sort((x, y) => y.s.wins - x.s.wins || y.s.rating - x.s.rating).slice(0, 4);
  const ps = S.platformStats();
  const collage = ["art:hero1:orbs", "art:hero2:sunset", "art:hero3:bloom", "art:hero4:mosaic", "art:hero5:dunes", "art:hero6:rings"];
  return html`
  <section class="hero"><div class="wrap hero-in">
    <div class="hero-copy">
      <span class="eyebrow">${icon("sparkle")} سوق فنّ الذكاء الاصطناعي</span>
      <h1>اطلب الفكرة، واستقبل عشرات الأعمال، <em>وادفع للأفضل فقط.</em></h1>
      <p class="lead">أطلق مسابقة يتنافس فيها صنّاع المحتوى بالذكاء الاصطناعي على تحقيق رؤيتك — تصاميم وصور، أفلام قصيرة وإعلانات فيديو، قصص متحركة وفيديو تعليمي، تعليق صوتي وموسيقى. أو وظّف مبدعًا مباشرةً لمشروعك.</p>
      <div class="media-pills">${Object.values(S.MEDIA).map((m) => html`<a class="chip" href="#/contests?m=${m.id}">${icon(mediaIcon(m.id))} ${m.name}</a>`)}</div>
      <div class="hero-cta">
        <a class="btn primary lg" href="#/launch">أطلق مسابقة الآن</a>
        <a class="btn ghost lg" href="${me?.role === "artist" ? "#/contests" : "#/login?role=artist"}">${me?.role === "artist" ? "تصفّح المسابقات" : "انضم كفنان"}</a>
      </div>
      <ul class="hero-trust">
        <li>${icon("shield")} ضمان استرداد كامل</li><li>${icon("doc")} نقل ملكية موثّق</li><li>${icon("check")} إفصاح إلزامي عن الأداة</li>
      </ul>
    </div>
    <div class="hero-art" aria-hidden="true">${collage.map((s, i) => html`<img class="h${i}" src="${imgSrc(s)}" alt="">`)}</div>
  </div></section>

  <section class="statsbar"><div class="wrap statsbar-in">
    <div><b>${num(ps.artists)}</b><span>فنان معتمد</span></div>
    <div><b>${num(ps.contests)}</b><span>مسابقة</span></div>
    <div><b>${num(ps.entries)}</b><span>عمل مُقدَّم</span></div>
    <div><b>${money(ps.paidOut)}</b><span>دُفعت للفنانين</span></div>
  </div></section>

  <section class="sec"><div class="wrap">
    <div class="sec-head"><h2>كيف تعمل المسابقة؟</h2><a href="#/how" class="linkbtn">التفاصيل والأسعار ←</a></div>
    ${steps()}
  </div></section>

  <section class="sec alt"><div class="wrap">
    <div class="sec-head"><h2>ماذا تحتاج اليوم؟</h2></div>
    ${categoryGroups((c) => html`<a class="cat" href="#/launch?cat=${c.id}"><span class="cat-ic">${c.icon}</span><b>${c.name}</b><span class="muted small">${c.desc}</span></a>`)}
  </div></section>

  <section class="sec"><div class="wrap">
    <div class="sec-head"><h2>مسابقات مفتوحة الآن</h2><a href="#/contests" class="linkbtn">كل المسابقات ←</a></div>
    <div class="grid3">${open.map(contestCard)}</div>
  </div></section>

  <section class="sec alt"><div class="wrap">
    <div class="sec-head"><h2>فنانون في الصدارة</h2><a href="#/artists" class="linkbtn">كل الفنانين ←</a></div>
    <div class="grid4">${top.map((x) => artistCard(x.a))}</div>
  </div></section>

  <section class="sec"><div class="wrap">
    <div class="sec-head"><h2>باقات المسابقات</h2></div>
    ${packages()}
  </div></section>

  <section class="sec"><div class="wrap"><div class="cta-band">
    <div><h2>أنت صانع محتوى بالذكاء الاصطناعي؟</h2><p>مصمّم، صانع أفلام، معلّق صوتي أو مؤلف موسيقى — شارك في مسابقات بجوائز مضمونة، ابنِ ملفّك، واستقبل مشاريع مباشرة من الشركات.</p></div>
    <a class="btn light lg" href="${me ? "#/contests" : "#/login?role=artist"}">ابدأ المشاركة</a>
  </div></div></section>`;
}

function steps() {
  const st = [
    ["١", "اكتب الموجز", "صف فكرتك، جمهورك، والأسلوب الذي تحبه. اختر الباقة وادفع — المبلغ محفوظ في الضمان."],
    ["٢", "استقبل الأعمال", "صور أو فيديو أو صوت — يقدّم المبدعون أعمالهم خلال أيام، مع الإفصاح عن كل أداة ذكاء اصطناعي استُخدمت."],
    ["٣", "قيّم ووجّه", "شاهد واستمع، قيّم بالنجوم، علّق على كل مشاركة، واختر قائمتك النهائية."],
    ["٤", "اختر الفائز", "تستلم الملف الأصلي والبرومبت وشهادة نقل الملكية، ويُحوَّل مبلغ الجائزة للفنان."],
  ];
  return html`<ol class="steps">${st.map(([n, t, d]) => html`<li><span class="step-n">${n}</span><h3>${t}</h3><p>${d}</p></li>`)}</ol>`;
}

function packages(selectable = false, selected = "", catId = "") {
  const m = catId ? S.category(catId).media : "image";
  const per = m === "video" ? 4 : m === "audio" ? 1.5 : 1;
  return html`<div class="pkgs">${S.PACKAGES.map((p) => { const pp = catId ? S.pkgPrice(p.id, catId) : p; return html`
    <${raw(selectable ? "label" : "div")} class="pkg ${p.popular ? "popular" : ""} ${selected === p.id ? "selected" : ""}">
      ${selectable ? html`<input type="radio" name="package" value="${p.id}" ${selected === p.id ? raw("checked") : ""} required>` : ""}
      ${p.popular ? html`<span class="pkg-flag">الأكثر طلبًا</span>` : ""}
      <h3>${p.name}</h3>
      <div class="pkg-price">${catId ? "" : html`<span class="muted small">من </span>`}${money(pp.price)}</div>
      <div class="muted small">جائزة الفائز: <b>${money(pp.prize)}</b> · ≈ ${num(Math.round(p.expected / per))} مشاركة</div>
      <ul>${p.perks.map((x) => html`<li>${icon("check")} ${x}</li>`)}</ul>
    </${raw(selectable ? "label" : "div")}>`; })}</div>`;
}

// ---------------------------------------------------------------- how
export function how() {
  const faq = [
    ["من يملك حقوق العمل الفائز؟", "عند اختيار الفائز تنتقل الملكية الكاملة وحقوق الاستخدام التجاري للعميل، ويحصل على شهادة نقل ملكية موقّعة إلكترونيًا مع الملفات والبرومبت المستخدم."],
    ["هل يجب الإفصاح عن أداة الذكاء الاصطناعي؟", "نعم. كل مشاركة تُرفق بكل الأدوات المستخدمة — مثل Midjourney للصور، وVeo أو Runway للفيديو، وElevenLabs للصوت، وSuno للموسيقى — ويُسلَّم البرومبت للعميل مع العمل الفائز. الفنان مسؤول عن امتلاك اشتراك يسمح بالاستخدام التجاري."],
    ["هل يمكن طلب فيديو أو صوت؟", "نعم: أفلام قصيرة، إعلانات فيديو، قصص متحركة، فيديو تعليمي، ريلز، موشن جرافيك، متحدث افتراضي، تعليق صوتي، موسيقى وجنغل، وبودكاست. تحدّد في الموجز المدة والمقاس واللهجة والنص، والسعر يتناسب مع حجم العمل."],
    ["هل يُسمح باستنساخ الأصوات؟", "فقط صوت الفنان نفسه، أو صوت شخص لديه موافقة مكتوبة منه تُرفق عند التسليم. يُمنع تمامًا تقليد أصوات المشاهير والشخصيات العامة."],
    ["ماذا لو لم يعجبني أي عمل؟", "إذا لم تكن الجائزة «مضمونة» يمكنك طلب استرداد كامل المبلغ بعد انتهاء فترة المشاركات وقبل اختيار الفائز."],
    ["ما هي المسابقة المضمونة؟", "تتعهد فيها باختيار فائز. تجذب عادةً ضعف عدد الفنانين لأن جهدهم مضمون المقابل."],
    ["ما هي المسابقة السرية؟", "يرى كل فنان مشاركاته فقط ولا يرى أعمال المنافسين حتى نهاية المسابقة — مناسبة للأفكار الحساسة وتقلّل التقليد."],
    ["كم عمولة المنصة؟", "في المسابقات: الفرق بين سعر الباقة والجائزة. في المشاريع المباشرة: 10% من ميزانية المشروع تُخصم من الفنان."],
  ];
  return html`<section class="page-head"><div class="wrap"><h1>كيف تعمل مَرسم</h1><p class="lead">طريقتان للحصول على صور أو فيديو أو صوت بالذكاء الاصطناعي: <b>مسابقة</b> يتنافس فيها الفنانون، أو <b>مشروع مباشر</b> مع فنان تختاره.</p></div></section>
  <section class="sec"><div class="wrap">${steps()}</div></section>
  <section class="sec alt"><div class="wrap"><div class="sec-head"><h2>الباقات</h2></div>${packages()}
    <p class="muted small center">الأسعار أعلاه للتصاميم الثابتة. الفيديو: من ×1 (ريلز) إلى ×2 (أفلام قصيرة) · الصوت: ×0.8 إلى ×1.<br>إضافات اختيارية: مسابقة سرية +150 ر.س · ظهور مميّز +200 ر.س · الجائزة المضمونة مجانية.</p></div></section>
  <section class="sec"><div class="wrap two-col">
    <div><h2>أسئلة شائعة</h2>${faq.map(([q, a]) => html`<details class="faq"><summary>${q}</summary><p>${a}</p></details>`)}</div>
    <div id="rules" class="card pad rules"><h2>${icon("flag")} سياسة الأعمال المولّدة</h2><ul>
      <li>يُمنع ذكر أسماء فنانين أحياء في البرومبت أو تقليد أسلوبهم المميّز عمدًا.</li>
      <li>يُمنع استخدام شعارات أو علامات تجارية أو شخصيات محمية لغير العميل.</li>
      <li>يُمنع توليد صور أو فيديو لأشخاص حقيقيين دون موافقتهم المكتوبة.</li>
      <li>يُمنع استنساخ صوت أي شخص دون موافقته المكتوبة، ويُمنع تقليد أصوات المشاهير.</li>
      <li>يُمنع تقليد ألحان أو أغانٍ محمية، ويجب أن تمنح أداة الموسيقى حقوق الاستخدام التجاري.</li>
      <li>الفيديو الفائز يُسلَّم بأعلى دقة متاحة، مع مسارات الصوت والموسيقى منفصلة عند الطلب.</li>
      <li>يجب أن تسمح رخصة الأداة بالاستخدام التجاري ونقل الحقوق.</li>
      <li>المشاركات المنسوخة أو المعدّلة من أعمال الآخرين تُزال ويُوقف الحساب.</li>
      <li>يحق للعميل طلب ملف المصدر والبرومبت والبذرة (seed) للعمل الفائز.</li>
    </ul></div>
  </div></section>`;
}

// ---------------------------------------------------------------- contests browse
export function contestsPage(q) {
  const list = S.contests({ q: q.q || "", cat: q.cat || "", st: q.st || "", sort: q.sort || "new", media: q.m || "" });
  const cats = S.CATEGORIES.filter((c) => !q.m || c.media === q.m);
  return html`<section class="page-head"><div class="wrap"><h1>المسابقات</h1><p class="lead">اختر مسابقة، اقرأ الموجز، وقدّم أفضل ما لديك.</p></div></section>
  <section class="sec tight"><div class="wrap">
    <form class="filters" data-form="filter-contests">
      <input type="search" name="q" value="${q.q || ""}" placeholder="ابحث بالعنوان أو العلامة…" aria-label="بحث">
      <select name="st" aria-label="الحالة"><option value="">كل الحالات</option>${Object.entries(STATUS).map(([k, v]) => html`<option value="${k}" ${q.st === k ? raw("selected") : ""}>${v.t}</option>`)}</select>
      <select name="sort" aria-label="الترتيب">${[["new", "الأحدث"], ["prize", "الجائزة الأعلى"], ["ending", "تنتهي قريبًا"], ["entries", "الأكثر مشاركة"]].map(([k, v]) => html`<option value="${k}" ${(q.sort || "new") === k ? raw("selected") : ""}>${v}</option>`)}</select>
      <input type="hidden" name="cat" value="${q.cat || ""}"><input type="hidden" name="m" value="${q.m || ""}">
      <button class="btn primary sm">تطبيق</button>
    </form>
    <div class="mtabs" role="tablist">
      <a role="tab" class="${!q.m ? "on" : ""}" href="${qs("#/contests", { ...q, m: "", cat: "" })}">الكل</a>
      ${Object.values(S.MEDIA).map((m) => html`<a role="tab" class="${q.m === m.id ? "on" : ""}" href="${qs("#/contests", { ...q, m: m.id, cat: "" })}">${icon(mediaIcon(m.id))} ${m.name}</a>`)}
    </div>
    <div class="chips scroll">
      <a class="chip ${!q.cat ? "on" : ""}" href="${qs("#/contests", { ...q, cat: "" })}">كل التصنيفات</a>
      ${cats.map((c) => html`<a class="chip ${q.cat === c.id ? "on" : ""}" href="${qs("#/contests", { ...q, cat: c.id })}">${c.icon} ${c.name}</a>`)}
    </div>
    ${list.length ? html`<div class="grid3">${list.map(contestCard)}</div>` : empty("لا توجد مسابقات مطابقة", "جرّب تصنيفًا أو حالة مختلفة.")}
  </div></section>`;
}

export function qs(base, obj) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}

// ---------------------------------------------------------------- contest detail
export function contestPage(id, q, me) {
  const c = S.contest(id);
  if (!c) return notFound("المسابقة غير موجودة");
  const st = S.status(c);
  const owner = me && (me.id === c.clientId || me.role === "admin");
  const all = S.entriesOf(c.id);
  let entries = S.visibleEntries(c, me);
  const artistsCount = new Set(all.map((e) => e.artistId)).size;
  const tab = q.tab || (all.length ? "entries" : "brief");
  const filter = q.f || "all";
  if (owner) {
    if (filter === "finalists") entries = entries.filter((e) => c.finalists.includes(e.id));
    else if (filter === "rated") entries = entries.filter((e) => e.rating > 0).sort((a, b) => b.rating - a.rating);
    else if (filter === "eliminated") entries = entries.filter((e) => e.status === "eliminated");
    else entries = entries.filter((e) => e.status !== "eliminated");
  }
  entries = entries.slice().sort((a, b) => (b.id === c.winnerEntryId) - (a.id === c.winnerEntryId) || (q.f === "rated" ? 0 : b.number - a.number));
  const client = S.user(c.clientId);
  const winner = c.winnerEntryId ? S.entry(c.winnerEntryId) : null;
  const base = `#/contests/${c.id}`;

  return html`<section class="chead"><div class="wrap">
    <a class="crumb" href="#/contests">${icon("arrow")} كل المسابقات</a>
    <div class="chead-in">
      <div class="chead-img">${mediaThumb(winner || { media: S.mediaOf(c), image: c.cover, id: c.id, script: c.category === "voice" ? "1" : "" })}</div>
      <div class="chead-main">
        <div class="chead-tags">${statusBadge(c)}<span class="badge">${S.category(c.category).icon} ${S.category(c.category).name}</span>
          ${c.guaranteed ? html`<span class="badge green">${icon("shield")} جائزة مضمونة</span>` : ""}
          ${c.blind ? html`<span class="badge dark">${icon("lock")} سرية</span>` : ""}
          ${c.featured ? html`<span class="badge amber">${icon("sparkle")} مميّزة</span>` : ""}
        </div>
        <h1>${c.title}</h1>
        <div class="muted">${avatar(client, "xs")} ${c.brand} · نُشرت ${timeAgo(c.createdAt)}</div>
        <div class="chead-stats">
          <div><b class="prize">${money(c.prize)}</b><span>الجائزة</span></div>
          <div><b>${num(all.length)}</b><span>مشاركة</span></div>
          <div><b>${num(artistsCount)}</b><span>فنان</span></div>
          <div><b>${st === "open" ? timeLeft(c.deadline).replace("متبقٍ ", "") : "—"}</b><span>${st === "open" ? "متبقٍ" : STATUS[st].t}</span></div>
        </div>
      </div>
    </div>
  </div></section>

  <section class="sec tight"><div class="wrap cbody">
    <div class="cmain">
      <div class="tabs" role="tablist">
        <a role="tab" class="${tab === "entries" ? "on" : ""}" href="${qs(base, { tab: "entries" })}">المشاركات <span class="count">${num(all.length)}</span></a>
        <a role="tab" class="${tab === "brief" ? "on" : ""}" href="${qs(base, { tab: "brief" })}">الموجز</a>
      </div>
      ${tab === "brief" ? brief(c, owner && st === "open") : html`
        ${owner ? html`<div class="chips">${[["all", "الكل"], ["finalists", `القائمة النهائية (${c.finalists.length})`], ["rated", "المقيّمة"], ["eliminated", "المستبعدة"]].map(([k, v]) => html`<a class="chip ${filter === k ? "on" : ""}" href="${qs(base, { tab: "entries", f: k === "all" ? "" : k })}">${v}</a>`)}</div>` : ""}
        ${c.blind && st !== "completed" && !owner ? html`<div class="note">${icon("lock")} مسابقة سرية: أعمال الفنانين الآخرين مخفية حتى نهاية المسابقة.${me?.role === "artist" ? " تظهر لك مشاركاتك فقط." : ""}</div>` : ""}
        ${entries.length ? html`<div class="egrid">${entries.map((e) => entryCard(e, c, me))}</div>`
          : empty(all.length ? "لا توجد مشاركات في هذا العرض" : "لا توجد مشاركات بعد", st === "open" ? "كن أول من يشارك في هذه المسابقة!" : "")}
      `}
    </div>
    <aside class="cside">${sidebar(c, me, owner, st)}</aside>
  </div></section>`;
}

function specRows(c) {
  const fields = S.specFields(c.category).filter((f) => c.specs?.[f.k]);
  if (!fields.length) return "";
  const short = fields.filter((f) => f.k !== "script");
  const script = fields.find((f) => f.k === "script");
  return html`${short.length ? html`<div class="brief-row"><h4>${icon(mediaIcon(S.mediaOf(c)))} المواصفات</h4><div class="spec-tags">${short.map((f) => html`<span><small>${f.label}</small><b>${S.specValueLabel(f, c.specs[f.k])}</b></span>`)}</div></div>` : ""}
    ${script ? html`<div class="brief-row"><h4>${icon("doc")} ${script.label}</h4><blockquote class="script">${c.specs.script}</blockquote></div>` : ""}`;
}

function brief(c, editable) {
  const row = (label, v) => (v ? html`<div class="brief-row"><h4>${label}</h4><p>${v}</p></div>` : "");
  return html`<div class="card pad brief">
    ${editable ? html`<div class="brief-edit"><button class="btn ghost sm" data-action="edit-brief" data-id="${c.id}">تعديل الموجز</button></div>` : ""}
    ${row("عن المشروع", c.brief)}
    ${specRows(c)}
    ${row("الجمهور المستهدف", c.audience)}
    ${c.styles?.length ? html`<div class="brief-row"><h4>الأسلوب المفضّل</h4><div class="chips">${c.styles.map((s) => html`<span class="chip">${s}</span>`)}</div></div>` : ""}
    ${row("الألوان", c.colors)}
    ${row("أماكن الاستخدام", c.usage)}
    ${row("تجنّبوا", c.avoid)}
    <div class="brief-row"><h4>شروط المشاركة</h4><ul class="ticks">
      <li>${icon("check")} نوع المشاركة: <b>${S.MEDIA[S.mediaOf(c)].noun}</b> — والإفصاح عن كل أدوات الذكاء الاصطناعي المستخدمة إلزامي.</li>
      <li>${icon("check")} حد أقصى ${S.MAX_ENTRIES_PER_ARTIST} مشاركات نشطة لكل فنان.</li>
      <li>${icon("check")} الفائز يسلّم الملف بأعلى جودة والبرومبت ويوقّع نقل الملكية.</li>
      ${S.mediaOf(c) === "audio" || S.mediaOf(c) === "video" ? html`<li>${icon("check")} أي صوت بشري مستنسخ يجب أن يكون بموافقة مكتوبة من صاحبه.</li>` : ""}
    </ul></div>
  </div>`;
}

function sidebar(c, me, owner, st) {
  const p = S.pkg(c.package);
  const winner = c.winnerEntryId ? S.entry(c.winnerEntryId) : null;
  const mineActive = me ? S.entriesOf(c.id).filter((e) => e.artistId === me.id && e.status === "active").length : 0;
  let actions = "";

  if (st === "completed" && winner) {
    const wa = S.user(winner.artistId);
    actions = html`<div class="winner-box"><span class="wb-thumb">${mediaThumb(winner)}</span>
      <div><span class="badge gold">${icon("trophy")} الفائز</span><h4>${wa.name}</h4><a class="small" href="#/artists/${wa.id}">عرض الملف ←</a></div></div>
      ${me && (owner || me.id === winner.artistId) ? html`<button class="btn primary block" data-action="handover" data-id="${c.id}">${icon("download")} ملف التسليم ونقل الملكية</button>` : ""}`;
  } else if (st === "refunded") {
    actions = html`<p class="muted">أُلغيت المسابقة وأُعيد المبلغ للعميل.</p>`;
  } else if (owner) {
    actions = html`
      ${st === "judging" ? html`<div class="note amber">${icon("clock")} انتهت فترة المشاركات — اختر الفائز من الأعمال المقدّمة.</div>` : ""}
      <p class="small muted">لاختيار الفائز افتح أي مشاركة واضغط «اختيار كفائز».</p>
      ${st === "open" ? html`<button class="btn ghost block" data-action="close-submissions" data-id="${c.id}">إغلاق المشاركات الآن</button>` : ""}
      <button class="btn ghost block" data-action="extend" data-id="${c.id}">تمديد يومين</button>
      ${st === "judging" && !c.guaranteed ? html`<button class="btn danger-ghost block" data-action="refund" data-id="${c.id}">طلب استرداد المبلغ</button>` : ""}`;
  } else if (st === "open") {
    if (!me) actions = html`<a class="btn primary block" href="#/login?role=artist&next=${encodeURIComponent("#/contests/" + c.id)}">سجّل كفنان للمشاركة</a>`;
    else if (me.role === "artist") actions = html`<button class="btn primary block" data-action="submit-entry" data-id="${c.id}" ${mineActive >= S.MAX_ENTRIES_PER_ARTIST ? raw("disabled") : ""}>${icon("upload")} شارك بـ${S.MEDIA[S.mediaOf(c)].noun}</button>
      <p class="small muted center">مشاركاتك النشطة: ${mineActive}/${S.MAX_ENTRIES_PER_ARTIST}</p>`;
    else actions = html`<p class="small muted">المشاركة متاحة لحسابات الفنانين.</p>`;
  } else {
    actions = html`<p class="muted">المشاركات مغلقة — العميل يختار الفائز الآن.</p>`;
  }

  return html`<div class="card pad side-card">
    <div class="side-prize"><span class="muted small">الجائزة</span><b>${money(c.prize)}</b><span class="badge">${p.name}</span></div>
    <ul class="side-list">
      <li>${icon("clock")} <span>${st === "open" ? "تنتهي المشاركات" : "انتهت المشاركات"}</span><b>${dateStr(c.deadline)}</b></li>
      <li>${icon("shield")} <span>الضمان</span><b>${c.guaranteed ? "جائزة مضمونة" : "قابلة للاسترداد"}</b></li>
      <li>${icon(mediaIcon(S.mediaOf(c)))} <span>نوع العمل</span><b>${S.MEDIA[S.mediaOf(c)].noun}</b></li>
      <li>${icon(c.blind ? "lock" : "users")} <span>الرؤية</span><b>${c.blind ? "سرية" : "عامة"}</b></li>
    </ul>
    ${actions}
  </div>`;
}

// ---------------------------------------------------------------- entry modal
export function entryModal(entryId, me) {
  const e = S.entry(entryId);
  if (!e || !S.canSeeEntry(e, me)) return html`<h2>المشاركة غير متاحة</h2><p class="muted">ربما سُحب أو أنّ المسابقة سرية.</p>`;
  const c = S.contest(e.contestId);
  const st = S.status(c);
  const a = S.user(e.artistId);
  const owner = me && (me.id === c.clientId || me.role === "admin");
  const isArtist = me && me.id === e.artistId;
  const live = ["open", "judging"].includes(st);
  const win = c.winnerEntryId === e.id;
  const fin = c.finalists.includes(e.id);
  const list = S.visibleEntries(c, me).sort((x, y) => y.number - x.number);
  const i = list.findIndex((x) => x.id === e.id);
  const prev = list[i - 1], next = list[i + 1];
  const canChat = me && (owner || isArtist);
  const comments = canChat ? S.commentsOf(e.id) : [];

  return html`<div class="emodal">
    <div class="emodal-img media-${e.media || "image"}">
      ${mediaView(e, `مشاركة رقم ${e.number}`)}
      ${prev ? html`<button class="nav-arrow next" data-action="open-entry" data-id="${prev.id}" aria-label="المشاركة التالية">‹</button>` : ""}
      ${next ? html`<button class="nav-arrow prev" data-action="open-entry" data-id="${next.id}" aria-label="المشاركة السابقة">›</button>` : ""}
    </div>
    <div class="emodal-side">
      <div class="emodal-head">
        <span class="muted small">#${e.number} · ${timeAgo(e.createdAt)}</span>
        <h2>${e.title || "بدون عنوان"}</h2>
        <a class="artist-line" href="#/artists/${a.id}">${avatar(a, "sm")} <span>${a.name}</span></a>
        <div class="chips">
          <span class="chip">${icon(mediaIcon(e.media))} ${S.MEDIA[e.media || "image"].noun}${e.duration ? ` · ${fmtDur(e.duration)}` : ""}</span>
          ${toolChips(e.tool)}
          ${win ? html`<span class="badge gold">${icon("trophy")} الفائز</span>` : ""}
          ${fin && !win ? html`<span class="badge violet">قائمة نهائية</span>` : ""}
          ${e.status === "eliminated" ? html`<span class="badge gray">مستبعد</span>` : ""}
        </div>
      </div>
      ${e.note ? html`<p class="emodal-note">${e.note}</p>` : ""}
      ${e.script ? html`<details class="prompt"><summary>${icon("doc")} النص المقروء</summary><p class="script-text">${e.script}</p></details>` : ""}
      ${e.prompt && (isArtist || (owner && win)) ? html`<details class="prompt" ${owner && win ? raw("open") : ""}><summary>${icon("doc")} البرومبت ${isArtist && !win ? "(يظهر للعميل عند الفوز فقط)" : ""}</summary><code>${e.prompt}</code></details>` : ""}

      ${owner && live ? html`<div class="owner-tools">
        <div class="ot-row"><span>تقييمك:</span>${stars(e.rating, { interactive: true, entryId: e.id })}</div>
        <div class="ot-btns">
          <button class="btn ${fin ? "violet" : "ghost"} sm" data-action="finalist" data-id="${e.id}" ${e.status !== "active" ? raw("disabled") : ""}>${fin ? "✓ في القائمة النهائية" : "+ القائمة النهائية"}</button>
          <button class="btn ghost sm" data-action="eliminate" data-id="${e.id}">${e.status === "eliminated" ? "إعادة المشاركة" : "استبعاد"}</button>
        </div>
        ${e.status === "active" ? html`<button class="btn gold block" data-action="pick-winner" data-id="${e.id}">${icon("trophy")} اختيار كفائز — ${money(c.prize)}</button>` : ""}
      </div>` : !owner && e.rating ? html`<div class="ot-row">تقييم العميل: ${stars(e.rating)}</div>` : ""}

      ${isArtist && live && !win ? html`<button class="linkbtn danger" data-action="withdraw" data-id="${e.id}">سحب هذه المشاركة</button>` : ""}
      ${me?.role === "admin" && e.status !== "withdrawn" ? html`<button class="linkbtn danger" data-action="admin-remove" data-id="${e.id}">${icon("flag")} إزالة (مخالفة)</button>` : ""}

      ${canChat ? html`<div class="thread">
        <h4>${icon("chat")} الملاحظات <span class="muted small">(خاصة بين العميل والفنان)</span></h4>
        <div class="msgs">${comments.length ? comments.map((m) => msg(m, me)) : html`<p class="muted small">لا توجد ملاحظات بعد.</p>`}</div>
        <form class="msg-form" data-form="comment" data-id="${e.id}">
          <input name="text" placeholder="${owner ? "اكتب ملاحظة للفنان…" : "رد على العميل…"}" maxlength="1000" required aria-label="ملاحظة">
          <button class="btn primary sm">إرسال</button>
        </form>
      </div>` : ""}
    </div>
  </div>`;
}

function msg(m, me) {
  const u = S.user(m.userId);
  return html`<div class="msg ${me?.id === m.userId ? "mine" : ""}">${avatar(u, "xs")}<div><div class="msg-meta"><b>${u?.name}</b> <span class="muted">${timeAgo(m.createdAt)}</span></div><p>${m.text}</p></div></div>`;
}

export function pickWinnerModal(entryId) {
  const e = S.entry(entryId);
  const c = S.contest(e.contestId);
  const a = S.user(e.artistId);
  return html`<h2>${icon("trophy")} تأكيد اختيار الفائز</h2>
  <div class="confirm-win"><img src="${imgSrc(e.image)}" alt=""><div>
    <p>المشاركة <b>#${e.number}</b> (${S.MEDIA[e.media || "image"].noun}) للفنان <b>${a.name}</b></p>
    <p class="muted small">سيُحرَّر مبلغ الضمان ويُحوَّل <b>${money(c.prize)}</b> للفنان، وتنتقل إليك ملكية العمل كاملة. لا يمكن التراجع.</p>
  </div></div>
  <form data-form="pick-winner" data-id="${e.id}" class="form">
    <label>قيّم تجربتك مع الفنان</label>
    <div class="star-input">${[5, 4, 3, 2, 1].map((n) => html`<input type="radio" id="ws${n}" name="stars" value="${n}" ${n === 5 ? raw("checked") : ""}><label for="ws${n}" title="${n}">★</label>`)}</div>
    <label for="wtext">رأيك (يظهر في ملف الفنان)</label>
    <textarea id="wtext" name="text" rows="3" placeholder="ما الذي أعجبك في التعامل؟"></textarea>
    <div class="form-actions"><button class="btn gold">تأكيد ودفع الجائزة</button><button type="button" class="btn ghost" data-action="close-modal">إلغاء</button></div>
  </form>`;
}

export function submitModal(contestId, pending) {
  const c = S.contest(contestId);
  const m = S.mediaOf(c);
  const M = S.MEDIA[m];
  return html`<h2>شارك في «${c.title}»</h2>
  <p class="muted small">${icon(mediaIcon(m))} هذه المسابقة تستقبل <b>${M.noun}</b>${c.specs?.duration ? html` · المدة المطلوبة ${S.specValueLabel(S.specFields(c.category)[0], c.specs.duration)}` : ""}${c.specs?.aspect ? ` · ${c.specs.aspect}` : ""}</p>
  <form class="form" data-form="submit-entry" data-id="${c.id}">
    ${dropZone("entry-file", M, pending)}
    <button type="button" class="linkbtn" data-action="demo-art">${icon("sparkle")} لا تملك ملفًا الآن؟ ولّد عيّنة تجريبية</button>
    <label for="et">عنوان المشاركة</label><input id="et" name="title" maxlength="80" placeholder="${m === "video" ? "مثال: صباح الرياض" : m === "audio" ? "مثال: نبرة دافئة" : "مثال: نخلة من حبّة بن"}">
    <label>الأدوات المستخدمة * <span class="muted small">— اختر كل ما استخدمته</span></label>
    ${toolPicker("tool", S.toolsFor(m), [], m)}
    <label for="enote">شرح الفكرة للعميل</label>
    <textarea id="enote" name="note" rows="2" maxlength="500" placeholder="ما الفكرة؟ ${m === "video" ? "ما القصة والمشاهد؟" : m === "audio" ? "ما الإحساس والإلقاء؟" : ""}"></textarea>
    <label for="eprompt">البرومبت <span class="muted small">— خاص، يُسلَّم للعميل فقط إن فزت</span></label>
    <textarea id="eprompt" name="prompt" rows="2" maxlength="2000" dir="ltr" placeholder="${m === "audio" ? "warm saudi male voice, friendly…" : m === "video" ? "cinematic shot of …" : "minimal logo, …"}"></textarea>
    <label class="check"><input type="checkbox" name="agree" value="1" required> <span>أُقرّ بأن العمل من إنتاجي، ولا ينتهك حقوق أحد${m !== "image" ? "، وأن أي صوت أو وجه بشري فيه بموافقة مكتوبة من صاحبه" : ""}، وأن رخص الأدوات تسمح بالاستخدام التجاري ونقل الملكية للعميل.</span></label>
    <div class="form-actions"><button class="btn primary">إرسال المشاركة</button><button type="button" class="btn ghost" data-action="close-modal">إلغاء</button></div>
  </form>`;
}

/** Upload zone with preview; the file input covers the zone only while it's empty. */
function dropZone(change, M, pending) {
  return html`<div class="drop ${pending ? "has" : ""}" data-drop>
    ${pending ? html`<div class="drop-preview">${mediaView(pending, "معاينة")}</div>
      <label class="btn ghost sm drop-change">${icon("upload")} تغيير الملف<input type="file" accept="${M.accept}" data-change="${change}" hidden></label>`
      : html`<div class="drop-empty">${icon("upload")}<b>اسحب الملف هنا أو اضغط للاختيار</b><span class="muted small">${M.hint}</span></div>
      <input type="file" accept="${M.accept}" data-change="${change}" aria-label="اختيار ملف">`}
  </div>`;
}

export function editBriefModal(c) {
  return html`<h2>تعديل الموجز</h2><form class="form" data-form="edit-brief" data-id="${c.id}">
    <label for="bb">عن المشروع</label><textarea id="bb" name="brief" rows="5" required minlength="30">${c.brief}</textarea>
    <label for="ba">الجمهور المستهدف</label><input id="ba" name="audience" value="${c.audience}">
    <label for="bc">الألوان</label><input id="bc" name="colors" value="${c.colors}">
    <label for="bu">أماكن الاستخدام</label><input id="bu" name="usage" value="${c.usage}">
    <label for="bv">تجنّبوا</label><input id="bv" name="avoid" value="${c.avoid}">
    ${specInputs(c.category, c.specs || {})}
    <p class="muted small">سيُبلَّغ كل الفنانين المشاركين بالتحديث.</p>
    <div class="form-actions"><button class="btn primary">حفظ</button><button type="button" class="btn ghost" data-action="close-modal">إلغاء</button></div>
  </form>`;
}

export function handoverModal(c) {
  const e = S.entry(c.winnerEntryId);
  const a = S.user(e.artistId);
  const client = S.user(c.clientId);
  return html`<h2>${icon("doc")} ملف التسليم</h2>
  <div class="handover">
    <div class="handover-media media-${e.media || "image"}">${mediaView(e, "العمل الفائز")}</div>
    <div>
      <ul class="side-list">
        <li><span>المسابقة</span><b>${c.title}</b></li>
        <li><span>النوع</span><b>${S.MEDIA[e.media || "image"].noun}${e.duration ? ` · ${fmtDur(e.duration)}` : ""}</b></li>
        <li><span>الفنان</span><b>${a.name}</b></li>
        <li><span>العميل</span><b>${c.brand} (${client.name})</b></li>
        <li><span>الأداة</span><b>${e.tool}</b></li>
        <li><span>تاريخ النقل</span><b>${dateStr(c.completedAt || Date.now())}</b></li>
      </ul>
      ${e.prompt ? html`<details class="prompt" open><summary>البرومبت</summary><code>${e.prompt}</code></details>` : html`<p class="muted small">لم يُرفق برومبت.</p>`}
      <div class="form-actions">
        <button class="btn primary" data-action="download-entry" data-id="${e.id}">${icon("download")} تنزيل ${S.MEDIA[e.media || "image"].noun}</button>
        <button class="btn ghost" data-action="download-license" data-id="${c.id}">${icon("doc")} شهادة نقل الملكية</button>
      </div>
    </div>
  </div>`;
}

export function licenseText(c) {
  const e = S.entry(c.winnerEntryId);
  const a = S.user(e.artistId);
  const client = S.user(c.clientId);
  return `شهادة نقل ملكية فكرية — مَرسم
==================================
رقم المرجع: ${c.id}/${e.id}
التاريخ: ${dateStr(c.completedAt || Date.now())}

المُتنازِل (الفنان): ${a.name} <${a.email}>
المُتنازَل له (العميل): ${c.brand} — ممثَّلًا بـ ${client.name} <${client.email}>

العمل: ${S.MEDIA[e.media || "image"].noun} — المشاركة رقم #${e.number}${e.title ? ` «${e.title}»` : ""}${e.duration ? ` (المدة ${fmtDur(e.duration)})` : ""} المقدَّمة في مسابقة «${c.title}».
أدوات الإنتاج المُفصَح عنها: ${e.tool}

بموجب هذه الشهادة ومقابل مبلغ ${c.prize} ر.س المدفوع عبر منصة مَرسم، ينقل الفنان إلى العميل
جميع حقوق الملكية الفكرية والاستخدام التجاري الحصرية للعمل المذكور، في جميع الوسائط وبلا قيد زمني أو جغرافي،
ويقرّ الفنان بأن العمل أصلي، وأن رخص الأدوات المستخدمة تسمح بالاستخدام التجاري ونقل الحقوق،
وأن أي صوت أو صورة لشخص حقيقي في العمل مستخدمة بموافقته المكتوبة،
وأنه لن يعيد بيع العمل أو استخدامه إلا في ملف أعماله الشخصي ما لم تكن المسابقة سرية.

* وثيقة مولَّدة من النموذج التجريبي — ليست مستشارًا قانونيًا. راجع محاميًا قبل الاعتماد عليها.
`;
}

// ---------------------------------------------------------------- launch wizard
export function launchPage(step, draft, me) {
  if (!me) {
    return html`<section class="page-head"><div class="wrap narrow center"><h1>أطلق مسابقة</h1><p class="lead">سجّل الدخول بحساب شركة لإطلاق مسابقتك.</p>
      <a class="btn primary lg" href="#/login?role=client&next=${encodeURIComponent("#/launch")}">دخول / تسجيل شركة</a></div></section>`;
  }
  if (me.role === "artist") {
    return html`<section class="page-head"><div class="wrap narrow center"><h1>أطلق مسابقة</h1><p class="lead">أنت مسجّل كفنان. لإطلاق مسابقة استخدم حساب شركة (يمكنك التبديل من شريط العرض أعلى الصفحة).</p></div></section>`;
  }
  const labels = ["التصنيف", "الموجز", "الباقة", "المراجعة والدفع"];
  const bar = html`<ol class="wizard-bar">${labels.map((l, i) => html`<li class="${i + 1 === step ? "on" : i + 1 < step ? "done" : ""}"><span>${i + 1}</span>${l}</li>`)}</ol>`;
  let body;
  if (step === 1) {
    body = html`<form data-form="wizard" data-step="1"><h2>ماذا تريد أن يصنع المبدعون؟</h2>
      <div class="pick">${categoryGroups((c) => html`<label class="cat ${draft.category === c.id ? "selected" : ""}"><input type="radio" name="category" value="${c.id}" ${draft.category === c.id ? raw("checked") : ""} required><span class="cat-ic">${c.icon}</span><b>${c.name}</b><span class="muted small">${c.desc}</span></label>`)}</div>
      <div class="form-actions end"><button class="btn primary">التالي ←</button></div></form>`;
  } else if (step === 2) {
    body = html`<form class="form" data-form="wizard" data-step="2"><h2>اكتب الموجز <span class="badge">${S.category(draft.category).icon} ${S.category(draft.category).name}</span></h2>
      <p class="muted">كلما كان الموجز أوضح، كانت الأعمال أقرب لما تريد.</p>
      <div class="row2">
        <div><label for="wt">عنوان المسابقة *</label><input id="wt" name="title" required minlength="6" maxlength="90" value="${draft.title || ""}" placeholder="مثال: شعار لمقهى مختص في الرياض"></div>
        <div><label for="wbr">اسم العلامة</label><input id="wbr" name="brand" maxlength="60" value="${draft.brand || me.company || ""}"></div>
      </div>
      <label for="wb">صف المشروع *</label>
      <textarea id="wb" name="brief" rows="5" required minlength="30" placeholder="ما الذي تقدّمه؟ ما الإحساس المطلوب؟ ما المخرجات بالتحديد؟">${draft.brief || ""}</textarea>
      <label for="wa">الجمهور المستهدف</label><input id="wa" name="audience" value="${draft.audience || ""}">
      <label>الأسلوب المفضّل</label>
      <div class="chips pickable">${S.STYLES.map((s) => html`<label class="chip"><input type="checkbox" name="styles" value="${s}" ${(draft.styles || []).includes(s) ? raw("checked") : ""}> ${s}</label>`)}</div>
      <div class="row2">
        <div><label for="wc">الألوان</label><input id="wc" name="colors" value="${draft.colors || ""}" placeholder="مثال: أخضر زيتوني، كريمي"></div>
        <div><label for="wu">أماكن الاستخدام</label><input id="wu" name="usage" value="${draft.usage || ""}" placeholder="مثال: أكواب، تطبيق، لوحات"></div>
      </div>
      <label for="wv">ما الذي يجب تجنّبه؟</label><input id="wv" name="avoid" value="${draft.avoid || ""}">
      ${specInputs(draft.category, draft.specs || {})}
      <div class="form-actions spread"><a class="btn ghost" href="#/launch?step=1">→ رجوع</a><button class="btn primary">التالي ←</button></div></form>`;
  } else if (step === 3) {
    body = html`<form class="form" data-form="wizard" data-step="3"><h2>اختر الباقة</h2>
      ${packages(true, draft.package || "silver", draft.category)}
      <p class="muted small">${icon(mediaIcon(S.category(draft.category).media))} الأسعار محسوبة لتصنيف «${S.category(draft.category).name}».</p>
      <h3>خيارات المسابقة</h3>
      <div class="opts">
        <label class="opt"><input type="checkbox" name="guaranteed" value="1" ${draft.guaranteed ? raw("checked") : ""}><div><b>${icon("shield")} جائزة مضمونة <span class="muted small">مجانًا</span></b><span class="muted small">تتعهد باختيار فائز — تجذب ضعف الفنانين تقريبًا، لكن تتنازل عن حق الاسترداد.</span></div></label>
        <label class="opt"><input type="checkbox" name="blind" value="1" ${draft.blind ? raw("checked") : ""}><div><b>${icon("lock")} مسابقة سرية <span class="muted small">+150 ر.س</span></b><span class="muted small">لا يرى الفنانون أعمال بعضهم.</span></div></label>
        <label class="opt"><input type="checkbox" name="featured" value="1" ${draft.featured ? raw("checked") : ""}><div><b>${icon("sparkle")} ظهور مميّز <span class="muted small">+200 ر.س</span></b><span class="muted small">في أعلى القوائم ورسائل الفنانين.</span></div></label>
      </div>
      <label for="wd">مدة المشاركات</label>
      <select id="wd" name="days">${[3, 5, 7, 10, 14].map((d) => html`<option value="${d}" ${Number(draft.days || 7) === d ? raw("selected") : ""}>${d} أيام</option>`)}</select>
      <div class="form-actions spread"><a class="btn ghost" href="#/launch?step=2">→ رجوع</a><button class="btn primary">التالي ←</button></div></form>`;
  } else {
    const p = S.pkg(draft.package);
    const pp = S.pkgPrice(p.id, draft.category);
    const extras = (draft.blind ? 150 : 0) + (draft.featured ? 200 : 0);
    const total = pp.price + extras;
    const specsShown = S.specFields(draft.category).filter((f) => draft.specs?.[f.k] && f.k !== "script");
    body = html`<div class="review"><h2>راجع وادفع</h2>
      <div class="two-col">
        <div class="card pad">
          <div class="muted small">${S.category(draft.category).name}</div>
          <h3>${draft.title}</h3>
          <p>${draft.brief}</p>
          ${draft.styles?.length ? html`<div class="chips">${[].concat(draft.styles).map((s) => html`<span class="chip">${s}</span>`)}</div>` : ""}
          ${specsShown.length ? html`<div class="spec-tags">${specsShown.map((f) => html`<span><small>${f.label}</small><b>${S.specValueLabel(f, draft.specs[f.k])}</b></span>`)}</div>` : ""}
          ${draft.specs?.script ? html`<blockquote class="script">${draft.specs.script}</blockquote>` : ""}
          <a class="linkbtn" href="#/launch?step=2">تعديل الموجز</a>
        </div>
        <div class="card pad">
          <ul class="side-list">
            <li><span>باقة ${p.name} — ${S.category(draft.category).name}</span><b>${money(pp.price)}</b></li>
            <li><span>جائزة الفائز</span><b>${money(pp.prize)}</b></li>
            ${draft.blind ? html`<li><span>مسابقة سرية</span><b>${money(150)}</b></li>` : ""}
            ${draft.featured ? html`<li><span>ظهور مميّز</span><b>${money(200)}</b></li>` : ""}
            <li class="total"><span>الإجمالي</span><b>${money(total)}</b></li>
          </ul>
          <p class="small muted">${icon("shield")} المبلغ يبقى في حساب الضمان ولا يُحوَّل للفنان إلا عند اختيارك الفائز.${draft.guaranteed ? "" : " وإن لم يعجبك أي عمل تسترده كاملًا."}</p>
          <form data-form="launch"><button class="btn primary block lg">ادفع وأطلق المسابقة</button></form>
          <p class="tiny muted center">الدفع وهمي في النسخة التجريبية — في الإنتاج: مدى، Apple Pay، فيزا عبر بوابة دفع محلية، مع فاتورة ضريبية إلكترونية.</p>
        </div>
      </div>
      <div class="form-actions"><a class="btn ghost" href="#/launch?step=3">→ رجوع</a></div></div>`;
  }
  return html`<section class="sec"><div class="wrap narrow">${bar}<div class="card pad wizard">${body}</div></div></section>`;
}

// ---------------------------------------------------------------- artists
export function artistsPage(q) {
  let list = S.artists();
  if (q.m) list = list.filter((a) => a.tools.some((t) => S.TOOLS[q.m]?.includes(t)) || S.portfolioOf(a.id).some((e) => (e.media || "image") === q.m));
  if (q.tool) list = list.filter((a) => a.tools.includes(q.tool));
  if (q.q) list = list.filter((a) => (a.name + a.bio).includes(q.q));
  const withStats = list.map((a) => ({ a, s: S.artistStats(a.id) }));
  const sort = q.sort || "rating";
  withStats.sort((x, y) => (sort === "wins" ? y.s.wins - x.s.wins : sort === "new" ? y.a.joinedAt - x.a.joinedAt : y.s.rating - x.s.rating));
  return html`<section class="page-head"><div class="wrap"><h1>مبدعو الذكاء الاصطناعي</h1><p class="lead">مصمّمون، صنّاع أفلام، معلّقون صوتيون ومؤلفو موسيقى — تصفّح الأعمال ووظّف مباشرةً.</p></div></section>
  <section class="sec tight"><div class="wrap">
    <form class="filters" data-form="filter-artists">
      <input type="search" name="q" value="${q.q || ""}" placeholder="ابحث بالاسم أو التخصص…" aria-label="بحث">
      <select name="m" aria-label="التخصص"><option value="">كل التخصصات</option>${Object.values(S.MEDIA).map((m) => html`<option value="${m.id}" ${q.m === m.id ? raw("selected") : ""}>${m.name}</option>`)}</select>
      <select name="tool" aria-label="الأداة"><option value="">كل الأدوات</option>${Object.entries(S.TOOLS).map(([m, ts]) => html`<optgroup label="${S.MEDIA[m].name}">${ts.map((t) => html`<option ${q.tool === t ? raw("selected") : ""}>${t}</option>`)}</optgroup>`)}</select>
      <select name="sort" aria-label="الترتيب">${[["rating", "الأعلى تقييمًا"], ["wins", "الأكثر فوزًا"], ["new", "الأحدث"]].map(([k, v]) => html`<option value="${k}" ${sort === k ? raw("selected") : ""}>${v}</option>`)}</select>
      <button class="btn primary sm">تطبيق</button>
    </form>
    ${withStats.length ? html`<div class="grid4">${withStats.map((x) => artistCard(x.a))}</div>` : empty("لا يوجد فنانون مطابقون")}
  </div></section>`;
}

export function artistPage(id, me) {
  const a = S.user(id);
  if (!a || a.role !== "artist") return notFound("الفنان غير موجود");
  const st = S.artistStats(a.id);
  const pf = S.portfolioOf(a.id);
  const revs = S.reviewsOf(a.id);
  return html`<section class="profile-head"><div class="wrap profile-in">
    ${avatar(a, "xl")}
    <div class="profile-main">
      <h1>${a.name} ${a.level ? html`<span class="badge violet">${LEVEL[a.level]}</span>` : ""}</h1>
      <div class="muted">${a.country} · عضو منذ ${dateStr(a.joinedAt)}</div>
      <p>${a.bio}</p>
      <div class="chips">${a.tools.map((t) => html`<span class="chip">${icon("sparkle")} ${t}</span>`)}</div>
    </div>
    <div class="profile-cta">
      ${me?.role === "client" ? html`<button class="btn primary lg" data-action="hire" data-id="${a.id}">${icon("briefcase")} اطلب مشروعًا مباشرًا</button>`
        : !me ? html`<a class="btn primary lg" href="#/login?role=client&next=${encodeURIComponent("#/artists/" + a.id)}">وظّف ${a.name.split(" ")[0]}</a>` : ""}
    </div>
  </div>
  <div class="wrap kpis">
    <div><b>${st.rating ? st.rating.toFixed(1) : "—"}</b><span>${stars(st.rating)} (${st.reviews})</span></div>
    <div><b>${num(st.wins)}</b><span>مرات الفوز</span></div>
    <div><b>${num(st.contests)}</b><span>مسابقة شارك فيها</span></div>
    <div><b>${num(st.hiresDone)}</b><span>مشروع مباشر</span></div>
  </div></section>
  <section class="sec"><div class="wrap">
    <h2>معرض الأعمال</h2>
    ${pf.length ? html`<div class="egrid">${pf.map((e) => { const c = S.contest(e.contestId); return entryCard(e, c, me); })}</div>` : empty("لا توجد أعمال عامة بعد")}
  </div></section>
  <section class="sec alt"><div class="wrap narrow">
    <h2>آراء العملاء</h2>
    ${revs.length ? revs.map((r) => { const cl = S.user(r.clientId); return html`<div class="review-item card pad">${avatar(cl, "sm")}<div><div><b>${cl?.company || cl?.name}</b> ${stars(r.stars, { size: "xs" })} <span class="muted small">${timeAgo(r.createdAt)}</span></div>${r.text ? html`<p>${r.text}</p>` : ""}</div></div>`; }) : empty("لا توجد مراجعات بعد")}
  </div></section>`;
}

export function hireModal(a) {
  return html`<h2>مشروع مباشر مع ${a.name}</h2>
  <p class="muted small">تُحفظ الميزانية في الضمان وتُحوَّل للفنان بعد اعتمادك التسليم. عمولة المنصة ${S.HIRE_FEE * 100}% تُخصم من الفنان.</p>
  <form class="form" data-form="hire" data-id="${a.id}">
    <label for="ht">عنوان المشروع *</label><input id="ht" name="title" required minlength="4" maxlength="80">
    <label for="hb">التفاصيل *</label><textarea id="hb" name="brief" rows="4" required minlength="20" placeholder="المطلوب، عدد المخرجات، المقاسات، الأسلوب…"></textarea>
    <div class="row2">
      <div><label for="hm">الميزانية (ر.س) *</label><input id="hm" name="budget" type="number" min="200" step="50" value="800" required></div>
      <div><label for="hd">مدة التسليم (أيام)</label><input id="hd" name="days" type="number" min="1" max="60" value="5"></div>
    </div>
    <div class="form-actions"><button class="btn primary">ادفع في الضمان وأرسل الطلب</button><button type="button" class="btn ghost" data-action="close-modal">إلغاء</button></div>
  </form>`;
}

// ---------------------------------------------------------------- project (direct hire)
export function projectPage(id, me, deliverPreview) {
  const h = S.hire(id);
  if (!h) return notFound("المشروع غير موجود");
  if (!me || (![h.clientId, h.artistId].includes(me.id) && me.role !== "admin")) return notFound("هذا المشروع خاص بأطرافه");
  const client = S.user(h.clientId), a = S.user(h.artistId);
  const isClient = me.id === h.clientId, isArtist = me.id === h.artistId;
  const s = HIRE_STATUS[h.status];
  const flow = ["requested", "active", "delivered", "approved"];
  const idx = flow.indexOf(h.status === "revision" ? "active" : h.status);
  const due = (h.acceptedAt || h.createdAt) + h.days * 86400000;

  let actions = "";
  if (isArtist && h.status === "requested") actions = html`<div class="form-actions"><button class="btn primary" data-action="hire-accept" data-id="${h.id}">قبول المشروع</button><button class="btn ghost" data-action="hire-decline" data-id="${h.id}">اعتذار</button></div>`;
  else if (isArtist && ["active", "revision"].includes(h.status)) actions = html`<form class="form card pad" data-form="deliver" data-id="${h.id}"><h3>${icon("upload")} تسليم العمل</h3>
      ${dropZone("deliver-file", { accept: "image/*,video/*,audio/*", hint: "صورة أو فيديو أو ملف صوتي" }, deliverPreview)}
      <button type="button" class="linkbtn" data-action="demo-art-deliver">${icon("sparkle")} عيّنة تجريبية</button>
      <label>الأدوات المستخدمة</label>${toolPicker("tool", S.AI_TOOLS, a.tools.slice(0, 1))}
      <label for="dp">البرومبت</label><input id="dp" name="prompt" dir="ltr">
      <label for="dn">ملاحظة التسليم</label><textarea id="dn" name="note" rows="2"></textarea>
      <button class="btn primary">تسليم</button></form>`;
  else if (isClient && h.status === "delivered") actions = html`<div class="card pad"><h3>راجع التسليم</h3>
      <form class="form" data-form="approve-hire" data-id="${h.id}">
        <label>تقييم الفنان</label>
        <div class="star-input">${[5, 4, 3, 2, 1].map((n) => html`<input type="radio" id="hs${n}" name="stars" value="${n}" ${n === 5 ? raw("checked") : ""}><label for="hs${n}">★</label>`)}</div>
        <textarea name="text" rows="2" placeholder="رأيك (اختياري)" aria-label="رأيك"></textarea>
        <div class="form-actions"><button class="btn primary">اعتماد وتحرير ${money(h.budget)}</button><button type="button" class="btn ghost" data-action="hire-revision" data-id="${h.id}">طلب تعديل</button></div>
      </form></div>`;

  return html`<section class="sec"><div class="wrap narrow">
    <a class="crumb" href="#/dashboard">${icon("arrow")} لوحتي</a>
    <div class="card pad">
      <div class="proj-head"><div><span class="badge ${s.c}">${s.t}</span><h1>${h.title}</h1>
        <div class="muted">${client.company || client.name} ← ${a.name} · ${money(h.budget)} · التسليم خلال ${h.days} أيام${["active", "revision"].includes(h.status) ? ` (${timeLeft(due)})` : ""}</div></div></div>
      <ol class="timeline">${["الطلب", "التنفيذ", "التسليم", "الاعتماد"].map((l, i) => html`<li class="${i <= idx && h.status !== "declined" ? "done" : ""}">${l}</li>`)}</ol>
      <h4>التفاصيل</h4><p>${h.brief}</p>
      ${h.delivery ? html`<h4>التسليم ${h.revisions ? html`<span class="muted small">(بعد ${h.revisions} تعديل)</span>` : ""}</h4>
        <div class="handover"><div class="handover-media media-${h.delivery.media || "image"}">${mediaView(h.delivery, "التسليم")}</div><div>
          ${h.delivery.note ? html`<p>${h.delivery.note}</p>` : ""}
          <ul class="side-list"><li><span>النوع</span><b>${S.MEDIA[h.delivery.media || "image"].noun}${h.delivery.duration ? ` · ${fmtDur(h.delivery.duration)}` : ""}</b></li><li><span>الأدوات</span><b>${h.delivery.tool || "—"}</b></li><li><span>تاريخ التسليم</span><b>${dateStr(h.delivery.at)}</b></li></ul>
          ${h.delivery.prompt && (isArtist || h.status === "approved") ? html`<details class="prompt"><summary>البرومبت</summary><code>${h.delivery.prompt}</code></details>` : ""}
          ${h.status === "approved" && (isClient || me.role === "admin") ? html`<button class="btn ghost sm" data-action="download-hire" data-id="${h.id}">${icon("download")} تنزيل</button>` : ""}
        </div></div>` : ""}
      ${actions}
    </div>
    <div class="card pad thread">
      <h4>${icon("chat")} المحادثة</h4>
      <div class="msgs">${S.hireMessages(h.id).map((m) => msg(m, me))}</div>
      ${!["approved", "declined"].includes(h.status) ? html`<form class="msg-form" data-form="hire-msg" data-id="${h.id}"><input name="text" placeholder="اكتب رسالة…" required aria-label="رسالة"><button class="btn primary sm">إرسال</button></form>` : ""}
    </div>
  </div></section>`;
}

// ---------------------------------------------------------------- dashboard
export function dashboard(me, q) {
  if (!me) return loginPage(q);
  if (me.role === "admin") return adminDash();
  if (me.role === "artist") return artistDash(me);
  return clientDash(me);
}

function txTable(list) {
  if (!list.length) return html`<p class="muted small">لا توجد معاملات.</p>`;
  return html`<div class="table-wrap"><table class="table"><thead><tr><th>التاريخ</th><th>النوع</th><th>الوصف</th><th>المبلغ</th></tr></thead><tbody>
    ${list.map((t) => html`<tr><td>${dateStr(t.createdAt)}</td><td><span class="badge ${t.type === "payout" ? "green" : t.type === "refund" ? "amber" : ""}">${TX[t.type]}</span></td><td>${t.note}</td><td class="num">${["escrow", "withdrawal"].includes(t.type) ? "−" : "+"}${money(t.amount)}</td></tr>`)}
  </tbody></table></div>`;
}

function hireList(me) {
  const hs = S.hiresOf(me.id);
  if (!hs.length) return html`<p class="muted small">${me.role === "client" ? "لم تطلب مشاريع مباشرة بعد — تصفّح الفنانين واطلب مشروعًا." : "لا توجد طلبات مشاريع بعد."}</p>`;
  return html`<div class="rows">${hs.map((h) => { const other = S.user(me.id === h.clientId ? h.artistId : h.clientId); const s = HIRE_STATUS[h.status]; return html`<a class="row" href="#/projects/${h.id}">${avatar(other, "sm")}<div class="row-main"><b>${h.title}</b><span class="muted small">${other.company || other.name} · ${money(h.budget)}</span></div><span class="badge ${s.c}">${s.t}</span></a>`; })}</div>`;
}

function clientDash(me) {
  const mine = S.contests({ clientId: me.id });
  const txs = S.transactionsOf(me.id);
  const spent = txs.filter((t) => t.type === "escrow").reduce((s, t) => s + t.amount, 0) - txs.filter((t) => t.type === "refund").reduce((s, t) => s + t.amount, 0);
  const received = mine.reduce((s, c) => s + S.entriesOf(c.id).length, 0);
  const needs = mine.filter((c) => S.status(c) === "judging");
  return html`<section class="page-head"><div class="wrap"><h1>أهلًا ${me.name.split(" ")[0]} 👋</h1><p class="lead">${me.company || ""}</p></div></section>
  <section class="sec tight"><div class="wrap">
    <div class="kpis cards">
      <div class="card"><b>${num(mine.filter((c) => S.status(c) === "open").length)}</b><span>مسابقة نشطة</span></div>
      <div class="card"><b>${num(received)}</b><span>مشاركة مستلمة</span></div>
      <div class="card"><b>${money(spent)}</b><span>إجمالي الإنفاق</span></div>
      <div class="card"><b>${num(S.hiresOf(me.id).length)}</b><span>مشروع مباشر</span></div>
    </div>
    ${needs.length ? html`<div class="note amber">${icon("clock")} ${needs.length === 1 ? "مسابقة بانتظار" : `${needs.length} مسابقات بانتظار`} اختيار الفائز: ${needs.map((c, i) => html`${i ? "، " : ""}<a href="#/contests/${c.id}">${c.title}</a>`)}</div>` : ""}
    <div class="sec-head"><h2>مسابقاتي</h2><a class="btn primary sm" href="#/launch">+ مسابقة جديدة</a></div>
    ${mine.length ? html`<div class="rows">${mine.map((c) => { const es = S.entriesOf(c.id); return html`<a class="row" href="#/contests/${c.id}"><img class="row-thumb" src="${imgSrc(c.winnerEntryId ? S.entry(c.winnerEntryId).image : c.cover)}" alt=""><div class="row-main"><b>${c.title}</b><span class="muted small">${S.category(c.category).icon} ${money(c.prize)} · ${num(es.length)} مشاركة · ${S.status(c) === "open" ? timeLeft(c.deadline) : dateStr(c.deadline)}</span></div>${statusBadge(c)}</a>`; })}</div>`
      : empty("لم تطلق أي مسابقة بعد", "ابدأ بأول مسابقة واستقبل الأعمال خلال أيام.", html`<a class="btn primary" href="#/launch">أطلق مسابقة</a>`)}
    <div class="two-col">
      <div><h2>المشاريع المباشرة</h2>${hireList(me)}</div>
      <div><h2>المعاملات</h2>${txTable(txs.slice(0, 8))}</div>
    </div>
  </div></section>`;
}

function artistDash(me) {
  const st = S.artistStats(me.id);
  const mine = S.contests().map((c) => ({ c, es: S.entriesOf(c.id).filter((e) => e.artistId === me.id) })).filter((x) => x.es.length);
  const txs = S.transactionsOf(me.id);
  const openForMe = S.contests({ st: "open" }).filter((c) => !mine.some((x) => x.c.id === c.id)).slice(0, 3);
  return html`<section class="page-head"><div class="wrap"><h1>أهلًا ${me.name.split(" ")[0]} 🎨</h1><p class="lead"><a href="#/artists/${me.id}">عرض ملفك العام ←</a></p></div></section>
  <section class="sec tight"><div class="wrap">
    <div class="kpis cards">
      <div class="card accent"><b>${money(me.balance)}</b><span>الرصيد المتاح</span></div>
      <div class="card"><b>${money(st.earned)}</b><span>إجمالي الأرباح</span></div>
      <div class="card"><b>${num(st.wins)}</b><span>مرات الفوز</span></div>
      <div class="card"><b>${st.rating ? st.rating.toFixed(1) : "—"}</b><span>التقييم (${st.reviews})</span></div>
    </div>
    <h2>مشاركاتي</h2>
    ${mine.length ? html`<div class="rows">${mine.map(({ c, es }) => { const won = es.some((e) => e.id === c.winnerEntryId); const fin = es.filter((e) => c.finalists.includes(e.id)).length; return html`<a class="row" href="#/contests/${c.id}"><img class="row-thumb" src="${imgSrc(es[es.length - 1].image)}" alt=""><div class="row-main"><b>${c.title}</b><span class="muted small">${num(es.length)} مشاركة${fin ? ` · ${fin} في القائمة النهائية` : ""} · أعلى تقييم ${Math.max(...es.map((e) => e.rating)) || "—"}</span></div>${won ? html`<span class="badge gold">${icon("trophy")} فزت</span>` : statusBadge(c)}</a>`; })}</div>`
      : empty("لم تشارك في أي مسابقة بعد", "", html`<a class="btn primary" href="#/contests">تصفّح المسابقات</a>`)}
    ${openForMe.length ? html`<div class="sec-head"><h2>مسابقات قد تناسبك</h2><a class="linkbtn" href="#/contests?st=open">الكل ←</a></div><div class="grid3">${openForMe.map(contestCard)}</div>` : ""}
    <div class="two-col">
      <div><h2>طلبات المشاريع المباشرة</h2>${hireList(me)}</div>
      <div><h2>${icon("wallet")} المحفظة</h2>
        <div class="card pad">
          <div class="side-prize"><span class="muted small">قابل للسحب</span><b>${money(me.balance)}</b></div>
          <form class="form" data-form="withdraw"><label for="iban">الآيبان (IBAN)</label><input id="iban" name="iban" dir="ltr" placeholder="SA00 0000 0000 0000 0000 0000" required><button class="btn primary block" ${me.balance > 0 ? "" : raw("disabled")}>سحب الرصيد</button></form>
        </div>
        ${txTable(txs.slice(0, 6))}
      </div>
    </div>
    <h2>ملفي</h2>
    <form class="form card pad" data-form="profile">
      <div class="row2"><div><label for="pn">الاسم</label><input id="pn" name="name" value="${me.name}" required></div><div><label for="pc">الدولة</label><input id="pc" name="country" value="${me.country}"></div></div>
      <label for="pb">نبذة</label><textarea id="pb" name="bio" rows="3">${me.bio}</textarea>
      <label>الأدوات التي تتقنها</label>
      ${toolPicker("tools", S.AI_TOOLS, me.tools)}
      <div class="form-actions"><button class="btn primary">حفظ الملف</button></div>
    </form>
  </div></section>`;
}

function adminDash() {
  const ps = S.platformStats();
  const all = S.contests();
  return html`<section class="page-head"><div class="wrap"><h1>لوحة الإدارة</h1><p class="lead">نظرة شاملة على المنصة.</p></div></section>
  <section class="sec tight"><div class="wrap">
    <div class="kpis cards">
      <div class="card"><b>${money(ps.gmv)}</b><span>إجمالي المدفوعات (GMV)</span></div>
      <div class="card accent"><b>${money(ps.revenue)}</b><span>إيراد المنصة</span></div>
      <div class="card"><b>${money(ps.paidOut)}</b><span>مدفوع للفنانين</span></div>
      <div class="card"><b>${money(ps.refunds)}</b><span>مستردّات</span></div>
      <div class="card"><b>${num(ps.artists)} / ${num(ps.clients)}</b><span>فنانون / شركات</span></div>
      <div class="card"><b>${num(ps.open)} / ${num(ps.contests)}</b><span>مسابقات مفتوحة / الكل</span></div>
      <div class="card"><b>${num(ps.entries)}</b><span>مشاركات</span></div>
      <div class="card"><b>${num(ps.hires)}</b><span>مشاريع مباشرة</span></div>
    </div>
    <h2>المسابقات</h2>
    <div class="table-wrap"><table class="table"><thead><tr><th>المسابقة</th><th>النوع</th><th>العميل</th><th>الحالة</th><th>المشاركات</th><th>المبلغ</th><th>العمولة</th></tr></thead><tbody>
      ${all.map((c) => html`<tr><td><a href="#/contests/${c.id}">${c.title}</a></td><td>${S.category(c.category).icon} ${S.MEDIA[S.mediaOf(c)].noun}</td><td>${c.brand}</td><td>${statusBadge(c)}</td><td class="num">${num(S.entriesOf(c.id).length)}</td><td class="num">${money(c.price)}</td><td class="num">${money(c.price - c.prize)}</td></tr>`)}
    </tbody></table></div>
    <h2>المستخدمون</h2>
    <div class="table-wrap"><table class="table"><thead><tr><th>الاسم</th><th>النوع</th><th>البريد</th><th>الرصيد</th><th>انضم</th></tr></thead><tbody>
      ${S.users().map((u) => html`<tr><td>${avatar(u, "xs")} ${u.role === "artist" ? html`<a href="#/artists/${u.id}">${u.name}</a>` : u.name}</td><td>${u.role === "client" ? "شركة" : u.role === "artist" ? "فنان" : "إدارة"}</td><td dir="ltr">${u.email}</td><td class="num">${money(u.balance)}</td><td>${dateStr(u.joinedAt)}</td></tr>`)}
    </tbody></table></div>
  </div></section>`;
}

// ---------------------------------------------------------------- notifications
export function notificationsPage(me) {
  if (!me) return loginPage({});
  const list = S.notificationsOf(me.id);
  return html`<section class="sec"><div class="wrap narrow">
    <div class="sec-head"><h1>الإشعارات</h1>${list.some((n) => !n.read) ? html`<button class="btn ghost sm" data-action="mark-read">تعليم الكل كمقروء</button>` : ""}</div>
    ${list.length ? html`<div class="rows">${list.map((n) => html`<a class="row ${n.read ? "" : "unread"}" href="${n.link || "#/dashboard"}">${icon("bell")}<div class="row-main"><span>${n.text}</span><span class="muted small">${timeAgo(n.createdAt)}</span></div></a>`)}</div>` : empty("لا توجد إشعارات")}
  </div></section>`;
}

// ---------------------------------------------------------------- auth
export function loginPage(q) {
  const role = q.role === "artist" ? "artist" : q.role === "client" ? "client" : "";
  const group = (r, title) => html`<div class="acct-group"><h4>${title}</h4>${S.users().filter((u) => u.role === r).map((u) => html`<button class="acct" data-action="login-as" data-id="${u.id}">${avatar(u, "sm")}<span><b>${u.name}</b><span class="muted small">${u.company || (u.role === "artist" ? specialties(u).map((m) => S.MEDIA[m].noun).join(" · ") + " — " + (u.tools || []).slice(0, 2).join("، ") : "إدارة المنصة")}</span></span></button>`)}</div>`;
  return html`<section class="sec"><div class="wrap two-col login">
    <div class="card pad">
      <h1>ادخل بحساب تجريبي</h1>
      <p class="muted">بضغطة واحدة — جرّب المنصة من منظور الشركة أو الفنان أو الإدارة.</p>
      ${role !== "artist" ? group("client", "شركات") : ""}
      ${role !== "client" ? group("artist", "فنانون") : ""}
      ${!role ? group("admin", "إدارة") : ""}
    </div>
    <div class="card pad">
      <h1>أنشئ حسابًا جديدًا</h1>
      <form class="form" data-form="register">
        <div class="seg">
          <label><input type="radio" name="role" value="client" ${role !== "artist" ? raw("checked") : ""}> <span>${icon("briefcase")} أنا شركة / عميل</span></label>
          <label><input type="radio" name="role" value="artist" ${role === "artist" ? raw("checked") : ""}> <span>${icon("sparkle")} أنا مبدع / فنان</span></label>
        </div>
        <label for="rn">الاسم *</label><input id="rn" name="name" required minlength="2">
        <label for="re">البريد الإلكتروني *</label><input id="re" name="email" type="email" required dir="ltr">
        <div class="only-client"><label for="rc">اسم الشركة</label><input id="rc" name="company"></div>
        <div class="only-artist">
          <label for="rb">نبذة قصيرة</label><textarea id="rb" name="bio" rows="2"></textarea>
          <label>أدواتك</label>
          ${toolPicker("tools", S.AI_TOOLS.filter((t) => t !== "أخرى"))}
        </div>
        <input type="hidden" name="next" value="${q.next || ""}">
        <div class="form-actions"><button class="btn primary block">إنشاء الحساب</button></div>
        <p class="tiny muted">في الإنتاج: تسجيل دخول برابط سحري عبر البريد (Supabase Auth) وتحقق هوية للفنانين قبل السحب.</p>
      </form>
    </div>
  </div></section>`;
}

export function notFound(msg = "الصفحة غير موجودة") {
  return html`<section class="sec"><div class="wrap narrow center">${empty(msg, "", html`<a class="btn primary" href="#/">العودة للرئيسية</a>`)}</div></section>`;
}
