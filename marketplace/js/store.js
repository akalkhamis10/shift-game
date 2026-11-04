// Data layer for the marketplace. In demo mode everything lives in
// localStorage; every mutation goes through a function here so the same API
// can later be backed by Supabase (see supabase/schema.sql).

const KEY = "marsam:db:v1";
const SESSION_KEY = "marsam:session:v1";
const DAY = 86400000;

export const CATEGORIES = [
  { id: "logo", name: "شعار وهوية بصرية", icon: "◆", desc: "شعارات، أنظمة ألوان، هويات كاملة" },
  { id: "illustration", name: "رسم توضيحي", icon: "✎", desc: "رسوم للمواقع والكتب والحملات" },
  { id: "product", name: "تصوير منتجات", icon: "◎", desc: "صور منتجات وإعلانات بالذكاء الاصطناعي" },
  { id: "character", name: "شخصيات وماسكوت", icon: "☺", desc: "شخصيات العلامة والتعابير والأوضاع" },
  { id: "poster", name: "بوسترات وأغلفة", icon: "▣", desc: "ملصقات فعاليات، أغلفة كتب وألبومات" },
  { id: "social", name: "محتوى سوشال", icon: "#", desc: "منشورات وقوالب وحملات رقمية" },
  { id: "concept", name: "فن مفاهيمي وألعاب", icon: "✦", desc: "بيئات، أسلحة، عناصر ألعاب" },
  { id: "motion", name: "فيديو وموشن", icon: "▶", desc: "مقاطع قصيرة وموشن بالذكاء الاصطناعي" },
];

export const PACKAGES = [
  { id: "bronze", name: "برونزي", price: 1100, prize: 900, expected: "≈ 30 تصميمًا", perks: ["مسابقة مفتوحة لكل الفنانين", "ملكية كاملة للتصميم الفائز", "ضمان استرداد المبلغ"] },
  { id: "silver", name: "فضي", price: 1900, prize: 1600, expected: "≈ 60 تصميمًا", perks: ["كل مزايا البرونزي", "ظهور مميّز في قائمة المسابقات", "دعوة فنانين مختارين"], popular: true },
  { id: "gold", name: "ذهبي", price: 3000, prize: 2600, expected: "≈ 90 تصميمًا", perks: ["كل مزايا الفضي", "فنانون من المستوى المتقدّم فقط", "مدير حساب مخصّص"] },
  { id: "platinum", name: "بلاتيني", price: 5600, prize: 5000, expected: "≈ 120 تصميمًا", perks: ["كل مزايا الذهبي", "نخبة الفنانين فقط", "مسابقة سرية (NDA)"] },
];

export const AI_TOOLS = ["Midjourney", "DALL·E", "Stable Diffusion", "Flux", "Adobe Firefly", "Ideogram", "Leonardo", "Runway", "Sora", "أخرى"];
export const STYLES = ["بسيط Minimal", "فاخر", "مرح وملوّن", "واقعي", "ثلاثي الأبعاد 3D", "مسطّح Flat", "عتيق Retro", "مستقبلي", "خط عربي", "ألوان مائية"];

export const MAX_ENTRIES_PER_ARTIST = 5;
export const HIRE_FEE = 0.1; // platform fee on direct projects

// ---------------------------------------------------------------- persistence
let db = null;
const listeners = new Set();

function load() {
  try {
    const s = localStorage.getItem(KEY);
    if (s) return JSON.parse(s);
  } catch { /* storage blocked or corrupted -> reseed */ }
  return null;
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch (e) {
    throw new Error("مساحة التخزين في المتصفح ممتلئة — احذف بعض الصور أو أعد ضبط بيانات العرض.");
  }
}

function commit() {
  persist();
  listeners.forEach((fn) => fn());
}

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function init() {
  db = load() || seed();
  if (!load()) { try { persist(); } catch { /* in-memory only */ } }
}

export function resetDemo() {
  db = seed();
  try { localStorage.removeItem(SESSION_KEY); } catch {}
  commit();
}

const uid = (p) => p + "_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);

function fail(msg) { throw new Error(msg); }

// ---------------------------------------------------------------- session
export function currentUser() {
  let id = null;
  try { id = localStorage.getItem(SESSION_KEY); } catch {}
  return id ? db.users.find((u) => u.id === id) || null : null;
}
export function login(userId) {
  if (!db.users.some((u) => u.id === userId)) fail("الحساب غير موجود");
  try { localStorage.setItem(SESSION_KEY, userId); } catch {}
  listeners.forEach((fn) => fn());
}
export function logout() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
  listeners.forEach((fn) => fn());
}

export function register({ name, email, role, bio = "", tools = [], country = "", company = "" }) {
  if (!name || name.length < 2) fail("اكتب اسمًا صحيحًا");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "")) fail("البريد الإلكتروني غير صحيح");
  if (!["client", "artist"].includes(role)) fail("اختر نوع الحساب");
  if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) fail("هذا البريد مسجّل مسبقًا — ادخل من الحسابات الموجودة");
  const u = {
    id: uid("u"), role, name, email, bio, country, company,
    tools: Array.isArray(tools) ? tools : tools ? [tools] : [],
    level: role === "artist" ? "new" : undefined,
    balance: 0, joinedAt: Date.now(),
  };
  db.users.push(u);
  commit();
  login(u.id);
  return u;
}

export function updateProfile(patch) {
  const me = currentUser() || fail("سجّل الدخول أولًا");
  const allowed = ["name", "bio", "country", "company", "tools"];
  for (const k of allowed) if (k in patch) me[k] = k === "tools" ? [].concat(patch[k] || []) : patch[k];
  commit();
}

// ---------------------------------------------------------------- queries
export const users = () => db.users;
export const user = (id) => db.users.find((u) => u.id === id) || null;
export const artists = () => db.users.filter((u) => u.role === "artist");
export const contest = (id) => db.contests.find((c) => c.id === id) || null;
export const entry = (id) => db.entries.find((e) => e.id === id) || null;
export const hire = (id) => db.hires.find((h) => h.id === id) || null;
export const pkg = (id) => PACKAGES.find((p) => p.id === id) || PACKAGES[0];
export const category = (id) => CATEGORIES.find((c) => c.id === id) || { id, name: id, icon: "•" };

/** open | judging | completed | refunded  (open flips to judging once the deadline passes) */
export function status(c) {
  if (c.status === "open" && Date.now() > c.deadline) return "judging";
  return c.status;
}

export function contests({ q = "", cat = "", st = "", sort = "new", clientId = "" } = {}) {
  let list = db.contests.slice();
  if (clientId) list = list.filter((c) => c.clientId === clientId);
  if (cat) list = list.filter((c) => c.category === cat);
  if (st) list = list.filter((c) => status(c) === st);
  if (q) {
    const s = q.toLowerCase();
    list = list.filter((c) => (c.title + " " + c.brand + " " + c.brief).toLowerCase().includes(s));
  }
  const by = {
    new: (a, b) => b.createdAt - a.createdAt,
    prize: (a, b) => b.prize - a.prize,
    ending: (a, b) => (status(a) === "open" ? a.deadline : Infinity) - (status(b) === "open" ? b.deadline : Infinity),
    entries: (a, b) => entriesOf(b.id).length - entriesOf(a.id).length,
  };
  return list.sort(by[sort] || by.new);
}

/** All non-withdrawn entries of a contest (no visibility filtering). */
export const entriesOf = (contestId) => db.entries.filter((e) => e.contestId === contestId && e.status !== "withdrawn");

/** Entries a given viewer is allowed to see (blind contests hide rivals' work). */
export function visibleEntries(c, viewer) {
  const all = entriesOf(c.id);
  if (!c.blind || status(c) === "completed") return all;
  if (viewer && (viewer.id === c.clientId || viewer.role === "admin")) return all;
  if (viewer) return all.filter((e) => e.artistId === viewer.id);
  return [];
}

export function canSeeEntry(e, viewer) {
  const c = contest(e.contestId);
  return !!c && visibleEntries(c, viewer).some((x) => x.id === e.id);
}

export const commentsOf = (entryId) => db.comments.filter((m) => m.entryId === entryId).sort((a, b) => a.createdAt - b.createdAt);
export const hireMessages = (hireId) => db.comments.filter((m) => m.hireId === hireId).sort((a, b) => a.createdAt - b.createdAt);
export const reviewsOf = (artistId) => db.reviews.filter((r) => r.artistId === artistId).sort((a, b) => b.createdAt - a.createdAt);
export const transactionsOf = (userId) => db.transactions.filter((t) => t.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
export const hiresOf = (userId) => db.hires.filter((h) => h.clientId === userId || h.artistId === userId).sort((a, b) => b.createdAt - a.createdAt);
export const notificationsOf = (userId) => db.notifications.filter((n) => n.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
export const unreadCount = (userId) => db.notifications.filter((n) => n.userId === userId && !n.read).length;

export function artistStats(id) {
  const mine = db.entries.filter((e) => e.artistId === id && e.status !== "withdrawn");
  const wins = db.contests.filter((c) => c.winnerEntryId && entry(c.winnerEntryId)?.artistId === id);
  const revs = reviewsOf(id);
  const rating = revs.length ? revs.reduce((s, r) => s + r.stars, 0) / revs.length : 0;
  const earned = db.transactions.filter((t) => t.userId === id && t.type === "payout").reduce((s, t) => s + t.amount, 0);
  const hiresDone = db.hires.filter((h) => h.artistId === id && h.status === "approved").length;
  return { entries: mine.length, contests: new Set(mine.map((e) => e.contestId)).size, wins: wins.length, rating, reviews: revs.length, earned, hiresDone };
}

/** Artist portfolio = their work that is publicly visible (never leaks blind, still-running contests). */
export function portfolioOf(id) {
  return db.entries
    .filter((e) => e.artistId === id && e.status !== "withdrawn")
    .filter((e) => { const c = contest(e.contestId); return c && (!c.blind || status(c) === "completed"); })
    .sort((a, b) => (isWinner(b) - isWinner(a)) || b.createdAt - a.createdAt);
}

export const isWinner = (e) => !!e && contest(e.contestId)?.winnerEntryId === e.id;

export function platformStats() {
  const gmv = db.transactions.filter((t) => t.type === "escrow").reduce((s, t) => s + t.amount, 0);
  const refunds = db.transactions.filter((t) => t.type === "refund").reduce((s, t) => s + t.amount, 0);
  const revenue = db.transactions.filter((t) => t.type === "fee").reduce((s, t) => s + t.amount, 0);
  const paidOut = db.transactions.filter((t) => t.type === "payout").reduce((s, t) => s + t.amount, 0);
  return {
    gmv, refunds, revenue, paidOut,
    users: db.users.length, artists: artists().length, clients: db.users.filter((u) => u.role === "client").length,
    contests: db.contests.length, open: db.contests.filter((c) => status(c) === "open").length,
    entries: db.entries.filter((e) => e.status !== "withdrawn").length,
    hires: db.hires.length,
  };
}

// ---------------------------------------------------------------- internal helpers
function notify(userId, text, link = "") {
  db.notifications.push({ id: uid("n"), userId, text, link, read: false, createdAt: Date.now() });
}
function tx(userId, type, amount, ref = {}, note = "") {
  db.transactions.push({ id: uid("t"), userId, type, amount, note, ...ref, createdAt: Date.now() });
}
function requireUser(role) {
  const me = currentUser() || fail("سجّل الدخول أولًا");
  if (role && me.role !== role && me.role !== "admin") fail(role === "client" ? "هذا الإجراء متاح لحسابات الشركات فقط" : "هذا الإجراء متاح لحسابات الفنانين فقط");
  return me;
}
function requireOwner(c) {
  const me = requireUser();
  if (c.clientId !== me.id && me.role !== "admin") fail("هذه المسابقة ليست لك");
  return me;
}

// ---------------------------------------------------------------- contests
export function createContest(d) {
  const me = requireUser("client");
  if (!CATEGORIES.some((c) => c.id === d.category)) fail("اختر تصنيف المسابقة");
  if (!d.title || d.title.length < 6) fail("عنوان المسابقة قصير جدًا");
  if (!d.brief || d.brief.length < 30) fail("اكتب موجزًا أوضح (30 حرفًا على الأقل) — الموجز الجيد يجلب تصاميم أفضل");
  const p = pkg(d.package);
  const days = Math.min(14, Math.max(3, Number(d.days) || 7));
  const extras = (d.blind ? 150 : 0) + (d.featured ? 200 : 0);
  const total = p.price + extras;
  const c = {
    id: uid("c"), clientId: me.id, title: d.title, brand: d.brand || me.company || me.name,
    category: d.category, brief: d.brief, audience: d.audience || "", styles: [].concat(d.styles || []),
    colors: d.colors || "", usage: d.usage || "", avoid: d.avoid || "",
    package: p.id, prize: p.prize, price: total, guaranteed: !!d.guaranteed, blind: !!d.blind, featured: !!d.featured,
    status: "open", createdAt: Date.now(), deadline: Date.now() + days * DAY,
    finalists: [], winnerEntryId: null, cover: `art:${uid("cv")}`,
  };
  db.contests.push(c);
  tx(me.id, "escrow", total, { contestId: c.id }, `دفع مسابقة «${c.title}» — محفوظ في الضمان`);
  artists().forEach((a) => notify(a.id, `مسابقة جديدة في ${category(c.category).name}: «${c.title}» — جائزة ${c.prize} ر.س`, `#/contests/${c.id}`));
  commit();
  return c;
}

export function updateBrief(contestId, patch) {
  const c = contest(contestId) || fail("المسابقة غير موجودة");
  requireOwner(c);
  if (status(c) !== "open") fail("لا يمكن تعديل الموجز بعد إغلاق المشاركات");
  for (const k of ["brief", "audience", "colors", "usage", "avoid"]) if (k in patch) c[k] = patch[k];
  const ids = new Set(entriesOf(c.id).map((e) => e.artistId));
  ids.forEach((a) => notify(a, `تم تحديث موجز مسابقة «${c.title}»`, `#/contests/${c.id}`));
  commit();
}

export function extendDeadline(contestId, days = 2) {
  const c = contest(contestId) || fail("المسابقة غير موجودة");
  requireOwner(c);
  if (!["open", "judging"].includes(status(c)) || c.winnerEntryId) fail("لا يمكن التمديد");
  c.deadline = Math.max(c.deadline, Date.now()) + days * DAY;
  c.status = "open";
  commit();
}

export function closeSubmissions(contestId) {
  const c = contest(contestId) || fail("المسابقة غير موجودة");
  requireOwner(c);
  if (status(c) !== "open") fail("المشاركات مغلقة أصلًا");
  c.deadline = Date.now() - 1000;
  commit();
}

export function pickWinner(contestId, entryId, review = {}) {
  const c = contest(contestId) || fail("المسابقة غير موجودة");
  requireOwner(c);
  const st = status(c);
  if (!["open", "judging"].includes(st)) fail("تم اختيار الفائز مسبقًا");
  const e = entry(entryId);
  if (!e || e.contestId !== c.id || e.status !== "active") fail("هذا التصميم غير متاح للفوز");
  c.winnerEntryId = e.id;
  c.status = "completed";
  c.completedAt = Date.now();
  if (c.deadline > Date.now()) c.deadline = Date.now();
  const artist = user(e.artistId);
  artist.balance = (artist.balance || 0) + c.prize;
  tx(artist.id, "payout", c.prize, { contestId: c.id }, `جائزة مسابقة «${c.title}»`);
  tx("platform", "fee", c.price - c.prize, { contestId: c.id }, `عمولة مسابقة «${c.title}»`);
  tx(c.clientId, "release", c.price, { contestId: c.id }, `تحرير الضمان — نقل الملكية للفائز`);
  const stars = Math.min(5, Math.max(1, Number(review.stars) || 5));
  db.reviews.push({ id: uid("r"), artistId: artist.id, clientId: c.clientId, contestId: c.id, stars, text: review.text || "", createdAt: Date.now() });
  notify(artist.id, `🏆 مبروك! فاز تصميمك في «${c.title}» وأُضيفت ${c.prize} ر.س إلى رصيدك`, `#/contests/${c.id}`);
  new Set(entriesOf(c.id).map((x) => x.artistId)).forEach((a) => {
    if (a !== artist.id) notify(a, `انتهت مسابقة «${c.title}» — شكرًا لمشاركتك`, `#/contests/${c.id}`);
  });
  commit();
}

export function requestRefund(contestId) {
  const c = contest(contestId) || fail("المسابقة غير موجودة");
  requireOwner(c);
  if (c.guaranteed) fail("الجائزة مضمونة — لا يمكن الاسترداد، يجب اختيار فائز");
  if (status(c) !== "judging") fail("الاسترداد متاح بعد انتهاء فترة المشاركات وقبل اختيار الفائز");
  c.status = "refunded";
  tx(c.clientId, "refund", c.price, { contestId: c.id }, `استرداد مسابقة «${c.title}»`);
  new Set(entriesOf(c.id).map((x) => x.artistId)).forEach((a) => notify(a, `أُلغيت مسابقة «${c.title}» دون فائز`, `#/contests/${c.id}`));
  commit();
}

// ---------------------------------------------------------------- entries
export function submitEntry(contestId, { image, title = "", tool, prompt = "", note = "", agree }) {
  const me = requireUser("artist");
  const c = contest(contestId) || fail("المسابقة غير موجودة");
  if (status(c) !== "open") fail("المشاركات مغلقة في هذه المسابقة");
  if (c.clientId === me.id) fail("لا يمكنك المشاركة في مسابقتك");
  if (!image) fail("ارفع صورة التصميم");
  if (!tool) fail("حدّد أداة الذكاء الاصطناعي المستخدمة — الإفصاح إلزامي");
  if (!agree) fail("يجب الإقرار بأصالة العمل وحقوق النقل");
  const mine = entriesOf(c.id).filter((e) => e.artistId === me.id && e.status === "active");
  if (mine.length >= MAX_ENTRIES_PER_ARTIST) fail(`الحد الأقصى ${MAX_ENTRIES_PER_ARTIST} مشاركات نشطة لكل فنان في المسابقة`);
  const number = db.entries.filter((e) => e.contestId === c.id).length + 1;
  const e = { id: uid("e"), contestId: c.id, artistId: me.id, number, image, title, tool, prompt, note, rating: 0, status: "active", createdAt: Date.now() };
  db.entries.push(e);
  notify(c.clientId, `تصميم جديد #${number} من ${me.name} في «${c.title}»`, `#/contests/${c.id}?entry=${e.id}`);
  commit();
  return e;
}

export function withdrawEntry(entryId) {
  const me = requireUser();
  const e = entry(entryId) || fail("التصميم غير موجود");
  if (e.artistId !== me.id) fail("ليس تصميمك");
  if (isWinner(e)) fail("لا يمكن سحب تصميم فائز");
  e.status = "withdrawn";
  const c = contest(e.contestId);
  c.finalists = c.finalists.filter((x) => x !== e.id);
  commit();
}

export function rateEntry(entryId, value) {
  const e = entry(entryId) || fail("التصميم غير موجود");
  const c = contest(e.contestId);
  requireOwner(c);
  if (status(c) === "completed" || status(c) === "refunded") fail("المسابقة منتهية");
  e.rating = e.rating === value ? 0 : value;
  if (e.rating) notify(e.artistId, `قيّم العميل تصميمك #${e.number} في «${c.title}» بـ ${e.rating}/5`, `#/contests/${c.id}?entry=${e.id}`);
  commit();
}

export function toggleFinalist(entryId) {
  const e = entry(entryId) || fail("التصميم غير موجود");
  const c = contest(e.contestId);
  requireOwner(c);
  if (!["open", "judging"].includes(status(c))) fail("المسابقة منتهية");
  if (e.status !== "active") fail("التصميم مستبعد");
  if (c.finalists.includes(e.id)) c.finalists = c.finalists.filter((x) => x !== e.id);
  else {
    if (c.finalists.length >= 6) fail("الحد الأقصى 6 تصاميم في القائمة النهائية");
    c.finalists.push(e.id);
    notify(e.artistId, `✨ تصميمك #${e.number} دخل القائمة النهائية في «${c.title}»`, `#/contests/${c.id}?entry=${e.id}`);
  }
  commit();
}

export function toggleEliminate(entryId) {
  const e = entry(entryId) || fail("التصميم غير موجود");
  const c = contest(e.contestId);
  requireOwner(c);
  if (!["open", "judging"].includes(status(c))) fail("المسابقة منتهية");
  if (e.status === "active") {
    e.status = "eliminated";
    c.finalists = c.finalists.filter((x) => x !== e.id);
    notify(e.artistId, `استُبعد تصميمك #${e.number} من «${c.title}»`, `#/contests/${c.id}`);
  } else if (e.status === "eliminated") e.status = "active";
  commit();
}

export function removeEntryAsAdmin(entryId, reason = "مخالفة شروط المنصة") {
  const me = requireUser();
  if (me.role !== "admin") fail("للمشرفين فقط");
  const e = entry(entryId) || fail("التصميم غير موجود");
  e.status = "withdrawn";
  notify(e.artistId, `أزالت الإدارة تصميمك #${e.number}: ${reason}`, `#/contests/${e.contestId}`);
  commit();
}

export function addComment(entryId, text) {
  const me = requireUser();
  const e = entry(entryId) || fail("التصميم غير موجود");
  const c = contest(e.contestId);
  if (me.id !== c.clientId && me.id !== e.artistId && me.role !== "admin") fail("التعليقات خاصة بين العميل والفنان");
  if (!text || !text.trim()) fail("اكتب تعليقًا");
  db.comments.push({ id: uid("m"), entryId, userId: me.id, text: text.trim().slice(0, 1000), createdAt: Date.now() });
  const to = me.id === c.clientId ? e.artistId : c.clientId;
  notify(to, `${me.name} علّق على التصميم #${e.number} في «${c.title}»`, `#/contests/${c.id}?entry=${e.id}`);
  commit();
}

// ---------------------------------------------------------------- direct hires (1-to-1 projects)
export function createHire(artistId, { title, brief, budget, days }) {
  const me = requireUser("client");
  const a = user(artistId);
  if (!a || a.role !== "artist") fail("الفنان غير موجود");
  if (!title || title.length < 4) fail("اكتب عنوانًا للمشروع");
  if (!brief || brief.length < 20) fail("اشرح المطلوب بتفصيل أكثر");
  const b = Number(budget);
  if (!(b >= 200)) fail("أقل ميزانية للمشروع 200 ر.س");
  const h = { id: uid("h"), clientId: me.id, artistId, title, brief, budget: b, days: Math.max(1, Number(days) || 5), status: "requested", createdAt: Date.now(), delivery: null };
  db.hires.push(h);
  tx(me.id, "escrow", b, { hireId: h.id }, `مشروع مباشر «${title}» — محفوظ في الضمان`);
  notify(artistId, `طلب مشروع مباشر جديد من ${me.name}: «${title}» بميزانية ${b} ر.س`, `#/projects/${h.id}`);
  commit();
  return h;
}

function hireParty(h) {
  const me = requireUser();
  if (![h.clientId, h.artistId].includes(me.id) && me.role !== "admin") fail("ليس مشروعك");
  return me;
}

export function respondHire(hireId, accept) {
  const h = hire(hireId) || fail("المشروع غير موجود");
  const me = hireParty(h);
  if (me.id !== h.artistId) fail("الفنان فقط يقبل أو يرفض");
  if (h.status !== "requested") fail("تم الرد مسبقًا");
  h.status = accept ? "active" : "declined";
  h.acceptedAt = Date.now();
  if (!accept) tx(h.clientId, "refund", h.budget, { hireId: h.id }, `استرداد مشروع «${h.title}» (رفضه الفنان)`);
  notify(h.clientId, accept ? `قبل ${me.name} مشروع «${h.title}» وبدأ العمل` : `اعتذر ${me.name} عن مشروع «${h.title}» — أُعيد المبلغ`, `#/projects/${h.id}`);
  commit();
}

export function deliverHire(hireId, { image, note = "", prompt = "", tool = "" }) {
  const h = hire(hireId) || fail("المشروع غير موجود");
  const me = hireParty(h);
  if (me.id !== h.artistId) fail("الفنان فقط يسلّم");
  if (!["active", "revision"].includes(h.status)) fail("لا يمكن التسليم الآن");
  if (!image) fail("ارفع ملف التسليم");
  h.delivery = { image, note, prompt, tool, at: Date.now() };
  h.status = "delivered";
  notify(h.clientId, `سلّم ${me.name} مشروع «${h.title}» — راجعه واعتمده`, `#/projects/${h.id}`);
  commit();
}

export function requestRevision(hireId, note) {
  const h = hire(hireId) || fail("المشروع غير موجود");
  const me = hireParty(h);
  if (me.id !== h.clientId) fail("العميل فقط يطلب التعديل");
  if (h.status !== "delivered") fail("لا يوجد تسليم لمراجعته");
  h.status = "revision";
  h.revisions = (h.revisions || 0) + 1;
  if (note) db.comments.push({ id: uid("m"), hireId: h.id, userId: me.id, text: "طلب تعديل: " + note, createdAt: Date.now() });
  notify(h.artistId, `طلب ${me.name} تعديلًا على «${h.title}»`, `#/projects/${h.id}`);
  commit();
}

export function approveHire(hireId, review = {}) {
  const h = hire(hireId) || fail("المشروع غير موجود");
  const me = hireParty(h);
  if (me.id !== h.clientId && me.role !== "admin") fail("العميل فقط يعتمد");
  if (h.status !== "delivered") fail("لا يوجد تسليم لاعتماده");
  h.status = "approved";
  h.approvedAt = Date.now();
  const fee = Math.round(h.budget * HIRE_FEE);
  const a = user(h.artistId);
  a.balance = (a.balance || 0) + (h.budget - fee);
  tx(a.id, "payout", h.budget - fee, { hireId: h.id }, `مشروع «${h.title}» (بعد عمولة ${HIRE_FEE * 100}%)`);
  tx("platform", "fee", fee, { hireId: h.id }, `عمولة مشروع «${h.title}»`);
  tx(h.clientId, "release", h.budget, { hireId: h.id }, `تحرير الضمان — مشروع «${h.title}»`);
  db.reviews.push({ id: uid("r"), artistId: a.id, clientId: h.clientId, hireId: h.id, stars: Math.min(5, Math.max(1, Number(review.stars) || 5)), text: review.text || "", createdAt: Date.now() });
  notify(a.id, `اعتمد العميل «${h.title}» وأُضيفت ${h.budget - fee} ر.س إلى رصيدك`, `#/projects/${h.id}`);
  commit();
}

export function addHireMessage(hireId, text) {
  const h = hire(hireId) || fail("المشروع غير موجود");
  const me = hireParty(h);
  if (!text || !text.trim()) fail("اكتب رسالة");
  db.comments.push({ id: uid("m"), hireId, userId: me.id, text: text.trim().slice(0, 1000), createdAt: Date.now() });
  notify(me.id === h.clientId ? h.artistId : h.clientId, `رسالة جديدة من ${me.name} في «${h.title}»`, `#/projects/${h.id}`);
  commit();
}

// ---------------------------------------------------------------- wallet & notifications
export function withdraw(iban) {
  const me = requireUser("artist");
  if (!(me.balance > 0)) fail("لا يوجد رصيد للسحب");
  if (!/^SA\d{22}$/.test((iban || "").replace(/\s+/g, "").toUpperCase())) fail("رقم الآيبان السعودي يبدأ بـ SA ويتكوّن من 24 خانة");
  tx(me.id, "withdrawal", me.balance, {}, `سحب إلى ${iban.replace(/\s+/g, "").slice(0, 6)}••••`);
  me.balance = 0;
  commit();
}

export function markAllRead() {
  const me = currentUser();
  if (!me) return;
  db.notifications.forEach((n) => { if (n.userId === me.id) n.read = true; });
  commit();
}

// ---------------------------------------------------------------- seed
function seed() {
  const now = Date.now();
  const d = { users: [], contests: [], entries: [], comments: [], reviews: [], transactions: [], hires: [], notifications: [] };

  const U = (id, role, name, email, extra = {}) => d.users.push({ id, role, name, email, bio: "", tools: [], country: "السعودية", balance: 0, joinedAt: now - 200 * DAY, ...extra });
  U("admin", "admin", "إدارة مَرسم", "admin@marsam.demo");
  U("c_nakhla", "client", "ريما السبيعي", "rima@nakhla.demo", { company: "قهوة نخلة", bio: "سلسلة مقاهٍ مختصة في الرياض." });
  U("c_masar", "client", "خالد المطيري", "khalid@masar.demo", { company: "تطبيق مسار", bio: "تطبيق تنقّل ذكي للمدن السعودية." });
  U("c_rimal", "client", "دانة الزهراني", "dana@rimal.demo", { company: "استوديو رمال للألعاب", bio: "استوديو ألعاب مستقل من جدة." });
  U("a_noura", "artist", "نورة الحربي", "noura@art.demo", { level: "pro", tools: ["Midjourney", "Adobe Firefly"], bio: "مصمّمة هويات بصرية، أمزج الخط العربي بأدوات التوليد. أكثر من 8 سنوات في التصميم." });
  U("a_fahad", "artist", "فهد العتيبي", "fahad@art.demo", { level: "top", tools: ["Stable Diffusion", "Flux"], bio: "فنان مفاهيمي للألعاب. أدرّب نماذج LoRA خاصة لأسلوب كل عميل." });
  U("a_lina", "artist", "لينا حدّاد", "lina@art.demo", { country: "الأردن", level: "pro", tools: ["Midjourney", "Ideogram"], bio: "رسّامة توضيحية وشخصيات. أسلوبي مرح وملوّن." });
  U("a_sara", "artist", "سارة القحطاني", "sara@art.demo", { level: "mid", tools: ["DALL·E", "Adobe Firefly"], bio: "تصوير منتجات ومحتوى إعلاني بالذكاء الاصطناعي." });
  U("a_omar", "artist", "عمر بنعلي", "omar@art.demo", { country: "المغرب", level: "top", tools: ["Runway", "Sora", "Midjourney"], bio: "مخرج موشن وفيديو بالذكاء الاصطناعي. أعمال لعلامات في الخليج وشمال إفريقيا." });
  U("a_reem", "artist", "ريم الشمري", "reem@art.demo", { level: "new", tools: ["Leonardo", "Flux"], bio: "بوسترات وأغلفة بأسلوب ريترو ومستقبلي." });

  const kindsFor = { logo: "mosaic", illustration: "bloom", product: "orbs", character: "bloom", poster: "sunset", social: "waves", concept: "dunes", motion: "rings" };

  const C = (o) => {
    const p = PACKAGES.find((x) => x.id === o.package);
    const c = { styles: [], colors: "", usage: "", avoid: "", audience: "", guaranteed: false, blind: false, featured: false, finalists: [], winnerEntryId: null, status: "open", ...o, prize: p.prize, price: p.price + (o.blind ? 150 : 0) + (o.featured ? 200 : 0), cover: `art:${o.id}:${kindsFor[o.category]}` };
    d.contests.push(c);
    d.transactions.push({ id: "t_" + c.id, userId: c.clientId, type: "escrow", amount: c.price, contestId: c.id, note: `دفع مسابقة «${c.title}» — محفوظ في الضمان`, createdAt: c.createdAt });
    return c;
  };
  let n = 0;
  const E = (c, artistId, extra = {}) => {
    const number = d.entries.filter((e) => e.contestId === c.id).length + 1;
    const e = { id: `e_${c.id}_${number}`, contestId: c.id, artistId, number, image: `art:${c.id}-${number}:${extra.kind || (number % 3 === 1 ? kindsFor[c.category] : "")}`, title: "", tool: user0(artistId).tools[0], prompt: "", note: "", rating: 0, status: "active", createdAt: c.createdAt + (++n % 9 + 1) * 3600000 * 5, ...extra };
    delete e.kind;
    d.entries.push(e);
    return e;
  };
  const user0 = (id) => d.users.find((u) => u.id === id);

  // 1) open, many entries — logo
  const c1 = C({ id: "c_logo", clientId: "c_nakhla", brand: "قهوة نخلة", title: "شعار جديد لسلسلة مقاهٍ مختصة في الرياض", category: "logo", package: "silver", guaranteed: true, featured: true,
    brief: "نبحث عن شعار يجمع بين النخلة وحبّة القهوة بأسلوب عصري بسيط. الشعار سيُستخدم على الأكواب والأكياس واللوحات الخارجية، ويجب أن يعمل بلون واحد. نريد إحساسًا دافئًا ومحليًا دون أن يكون تقليديًا.",
    audience: "شباب 20–35 في المدن السعودية، محبو القهوة المختصة", styles: ["بسيط Minimal", "خط عربي"], colors: "بني محمّص، أخضر زيتوني، كريمي", usage: "أكواب، أكياس، لوحات، تطبيق", avoid: "لا نريد فناجين تقليدية أو دلّة",
    createdAt: now - 3 * DAY, deadline: now + 4 * DAY });
  const e11 = E(c1, "a_noura", { title: "نخلة من حبّة بن", note: "النخلة تتشكّل من شقّ حبة القهوة. نسخة بلون واحد مرفقة.", rating: 5, prompt: "minimal logo, palm tree formed from a coffee bean split line, flat vector, warm brown --style raw" });
  E(c1, "a_lina", { title: "ختم دائري", rating: 3 });
  const e13 = E(c1, "a_reem", { title: "حروف متشابكة", rating: 4 });
  E(c1, "a_sara");
  E(c1, "a_noura", { title: "نسخة ثانية — خط ديواني", rating: 4 });
  E(c1, "a_fahad", { status: "eliminated", rating: 1 });
  E(c1, "a_lina", { title: "أيقونة تطبيق" });
  c1.finalists = [e11.id, e13.id];
  d.comments.push({ id: "m1", entryId: e11.id, userId: "c_nakhla", text: "جميل جدًا! هل يمكن تجربة لون أخضر زيتوني للنخلة؟", createdAt: now - DAY });
  d.comments.push({ id: "m2", entryId: e11.id, userId: "a_noura", text: "أكيد، سأرفع نسخة معدّلة اليوم.", createdAt: now - DAY + 3600000 });

  // 2) open, blind — character
  const c2 = C({ id: "c_mascot", clientId: "c_masar", brand: "تطبيق مسار", title: "شخصية ماسكوت ودودة لتطبيق تنقّل", category: "character", package: "gold", blind: true,
    brief: "نريد شخصية (ماسكوت) لتطبيق مسار: مرشد صغير ودود يساعد المستخدم في الوصول لوجهته. نحتاج الشخصية بثلاث وضعيات: ترحيب، تفكير، احتفال. يجب أن تناسب الأطفال والكبار.",
    audience: "جميع الأعمار", styles: ["ثلاثي الأبعاد 3D", "مرح وملوّن"], colors: "أزرق مسار #1D4ED8 مع لمسات برتقالية", usage: "داخل التطبيق، إعلانات، ملصقات",
    createdAt: now - 2 * DAY, deadline: now + 5 * DAY });
  E(c2, "a_lina", { title: "مُرشد الجمل الصغير" });
  E(c2, "a_fahad");
  E(c2, "a_noura");

  // 3) judging (deadline passed) — product
  const c3 = C({ id: "c_product", clientId: "c_nakhla", brand: "قهوة نخلة", title: "صور إعلانية لعبوة القهوة الجديدة", category: "product", package: "bronze",
    brief: "صور إعلانية لكيس قهوة نخلة الجديد (300 جم) في أجواء صحراوية عند الغروب. نحتاج 3 مقاسات: مربع، عمودي للستوري، وأفقي للبانر.",
    styles: ["واقعي", "فاخر"], colors: "ذهبي، رملي", usage: "إنستغرام، سناب، الموقع", createdAt: now - 9 * DAY, deadline: now - DAY });
  E(c3, "a_sara", { title: "غروب الكثبان", rating: 5 });
  E(c3, "a_reem", { title: "ضوء ذهبي", rating: 3 });
  E(c3, "a_omar", { title: "لقطة سينمائية", rating: 4 });

  // 4) completed — poster
  const c4 = C({ id: "c_poster", clientId: "c_rimal", brand: "استوديو رمال", title: "بوستر إطلاق لعبة «رحّالة»", category: "poster", package: "gold", guaranteed: true,
    brief: "بوستر رسمي لإطلاق لعبتنا «رحّالة» — مغامرة في صحراء مستقبلية. نريد إحساسًا ملحميًا بأسلوب سينثويف/ريترو مع شمس ضخمة في الأفق.",
    styles: ["مستقبلي", "عتيق Retro"], usage: "متاجر الألعاب، معارض، سوشال", createdAt: now - 20 * DAY, deadline: now - 12 * DAY });
  E(c4, "a_fahad", { title: "أفق رحّالة", rating: 4 });
  const e42 = E(c4, "a_reem", { title: "شمس النيون", rating: 5, prompt: "synthwave desert, giant striped sun on horizon, neon grid floor, epic game poster, 80s retro futurism" });
  E(c4, "a_omar", { title: "عاصفة رملية", rating: 3 });
  c4.status = "completed"; c4.winnerEntryId = e42.id; c4.completedAt = now - 11 * DAY; c4.finalists = [e42.id];

  // 5) completed — concept
  const c5 = C({ id: "c_concept", clientId: "c_rimal", brand: "استوديو رمال", title: "فن مفاهيمي لبيئة «وادي الرياح»", category: "concept", package: "platinum",
    brief: "لوحة مفاهيمية لبيئة المرحلة الثالثة: وادٍ صحراوي تتخلّله أعمدة صخرية منحوتة بالرياح وآثار حضارة قديمة. نحتاج إضاءة ساعة الغروب وعمقًا جويًا واضحًا.",
    styles: ["واقعي"], createdAt: now - 40 * DAY, deadline: now - 30 * DAY, guaranteed: true });
  const e51 = E(c5, "a_fahad", { title: "وادي الرياح — لقطة واسعة", rating: 5 });
  E(c5, "a_noura", { title: "ممر الأعمدة", rating: 4 });
  c5.status = "completed"; c5.winnerEntryId = e51.id; c5.completedAt = now - 29 * DAY;

  // 6) open — social
  C({ id: "c_social", clientId: "c_masar", brand: "تطبيق مسار", title: "قوالب سوشال لحملة اليوم الوطني", category: "social", package: "bronze",
    brief: "6 قوالب منشورات لإنستغرام بمناسبة اليوم الوطني، بهوية مسار وبأسلوب احتفالي حديث. نحتاج مساحة واضحة للنص العربي.",
    styles: ["مسطّح Flat", "مرح وملوّن"], colors: "أخضر، أبيض، أزرق مسار", createdAt: now - 10 * 3600000, deadline: now + 6 * DAY });

  // 7) open — motion
  const c7 = C({ id: "c_motion", clientId: "c_nakhla", brand: "قهوة نخلة", title: "مقطع موشن 10 ثوانٍ لافتتاح فرع جديد", category: "motion", package: "silver",
    brief: "مقطع قصير (10 ثوانٍ) عمودي يعلن افتتاح فرعنا في جدة: حبّة قهوة تتحوّل إلى نخلة ثم يظهر الشعار. نسلّمكم الشعار بصيغة SVG.",
    styles: ["بسيط Minimal", "فاخر"], createdAt: now - DAY, deadline: now + 2 * DAY + 5 * 3600000 });
  E(c7, "a_omar", { title: "تحوّل الحبّة", rating: 4, tool: "Runway" });

  // payouts + reviews for completed contests
  for (const [c, e] of [[c4, e42], [c5, e51]]) {
    const a = user0(e.artistId);
    a.balance += c.prize;
    d.transactions.push({ id: "tp_" + c.id, userId: a.id, type: "payout", amount: c.prize, contestId: c.id, note: `جائزة مسابقة «${c.title}»`, createdAt: c.completedAt });
    d.transactions.push({ id: "tf_" + c.id, userId: "platform", type: "fee", amount: c.price - c.prize, contestId: c.id, note: `عمولة مسابقة «${c.title}»`, createdAt: c.completedAt });
    d.transactions.push({ id: "tr_" + c.id, userId: c.clientId, type: "release", amount: c.price, contestId: c.id, note: "تحرير الضمان — نقل الملكية للفائز", createdAt: c.completedAt });
  }
  d.reviews.push({ id: "r1", artistId: "a_reem", clientId: "c_rimal", contestId: c4.id, stars: 5, text: "ريم فهمت روح اللعبة من أول تصميم، وتجاوبت مع كل ملاحظاتنا بسرعة.", createdAt: c4.completedAt });
  d.reviews.push({ id: "r2", artistId: "a_fahad", clientId: "c_rimal", contestId: c5.id, stars: 5, text: "عمق جوي وإضاءة مذهلة. سنتعامل معه مجددًا بالتأكيد.", createdAt: c5.completedAt });
  d.reviews.push({ id: "r3", artistId: "a_noura", clientId: "c_masar", stars: 4, text: "هوية رائعة، احتجنا جولة تعديل إضافية فقط.", createdAt: now - 60 * DAY });
  d.reviews.push({ id: "r4", artistId: "a_lina", clientId: "c_nakhla", stars: 5, text: "رسومات مبهجة ودقيقة في المواعيد.", createdAt: now - 45 * DAY });
  d.reviews.push({ id: "r5", artistId: "a_omar", clientId: "c_masar", stars: 5, text: "موشن احترافي جدًا.", createdAt: now - 50 * DAY });
  d.reviews.push({ id: "r6", artistId: "a_sara", clientId: "c_nakhla", stars: 4, text: "صور منتجات نظيفة وواقعية.", createdAt: now - 25 * DAY });

  // a direct hire in progress
  d.hires.push({ id: "h_menu", clientId: "c_nakhla", artistId: "a_lina", title: "رسومات قائمة المشروبات الموسمية", brief: "8 رسومات صغيرة لمشروبات الشتاء بأسلوب مرح متناسق مع هويتنا، بخلفية شفافة.", budget: 1200, days: 6, status: "active", createdAt: now - 2 * DAY, acceptedAt: now - 2 * DAY + 7200000, delivery: null });
  d.transactions.push({ id: "t_h_menu", userId: "c_nakhla", type: "escrow", amount: 1200, hireId: "h_menu", note: "مشروع مباشر «رسومات قائمة المشروبات الموسمية» — محفوظ في الضمان", createdAt: now - 2 * DAY });
  d.comments.push({ id: "m3", hireId: "h_menu", userId: "c_nakhla", text: "مرفق ملف الهوية. نفضّل الخطوط الدائرية الناعمة.", createdAt: now - 2 * DAY + 9000000 });

  d.notifications.push({ id: "n1", userId: "c_nakhla", text: "تصميم جديد #7 من لينا حدّاد في «شعار جديد لسلسلة مقاهٍ مختصة في الرياض»", link: "#/contests/c_logo", read: false, createdAt: now - 5 * 3600000 });
  d.notifications.push({ id: "n2", userId: "a_noura", text: "قيّم العميل تصميمك #1 في «شعار جديد لسلسلة مقاهٍ مختصة في الرياض» بـ 5/5", link: "#/contests/c_logo?entry=e_c_logo_1", read: false, createdAt: now - DAY });
  return d;
}
