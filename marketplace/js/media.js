// Media layer for video / audio entries.
// - Uploaded files live in IndexedDB (localStorage is far too small for video);
//   records only keep a reference "idb:<id>".
// - Demo references are synthesized locally so the prototype ships no media files:
//     demo-video:<seed>[:<kind>]  -> animated SVG "preview"
//     demo-music:<seed>           -> real WAV generated from the seed
//     demo-voice:<seed>           -> read aloud by the browser's speech engine (script text)
import { rng, artSVG } from "./art.js";

export const LIMITS = { video: 80 * 1024 * 1024, audio: 25 * 1024 * 1024 };

// ---------------------------------------------------------------- IndexedDB
const DB_NAME = "marsam-media";
let dbp = null;
function db() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore("blobs");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}
function idb(mode, fn) {
  return db().then((d) => new Promise((resolve, reject) => {
    const tx = d.transaction("blobs", mode);
    const r = fn(tx.objectStore("blobs"));
    tx.oncomplete = () => resolve(r && "result" in r ? r.result : undefined);
    tx.onerror = () => reject(tx.error || new Error("IndexedDB error"));
    tx.onabort = () => reject(tx.error || new Error("مساحة التخزين في المتصفح لا تكفي لهذا الملف"));
  }));
}

export async function putBlob(blob) {
  const key = "idb:" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  await idb("readwrite", (s) => s.put(blob, key));
  return key;
}
export const getBlob = (key) => idb("readonly", (s) => s.get(key));
export const clearBlobs = () => idb("readwrite", (s) => s.clear()).catch(() => {});

// ---------------------------------------------------------------- resolving refs to playable URLs
const urls = new Map();
export async function urlFor(ref) {
  if (!ref) return "";
  if (urls.has(ref)) return urls.get(ref);
  let url = "";
  if (ref.startsWith("idb:")) {
    const blob = await getBlob(ref);
    if (!blob) throw new Error("الملف غير موجود في هذا المتصفح");
    url = URL.createObjectURL(blob);
  } else if (ref.startsWith("demo-music:")) {
    url = URL.createObjectURL(musicWav(ref.split(":")[1]));
  } else {
    url = ref;
  }
  urls.set(ref, url);
  return url;
}

/** Fill in src for every <video>/<audio> rendered with data-media-src. */
export function hydrate(root = document) {
  root.querySelectorAll("[data-media-src]:not([data-hydrated])").forEach((el) => {
    el.setAttribute("data-hydrated", "1");
    urlFor(el.dataset.mediaSrc)
      .then((u) => { el.src = u; })
      .catch((e) => {
        const p = document.createElement("p");
        p.className = "media-missing";
        p.textContent = e.message;
        el.replaceWith(p);
      });
  });
}

export async function blobFor(ref) {
  if (ref.startsWith("idb:")) return getBlob(ref);
  if (ref.startsWith("demo-music:")) return musicWav(ref.split(":")[1]);
  return null;
}

// ---------------------------------------------------------------- probing uploads
export function probeVideo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    let done = false;
    const finish = (poster) => {
      if (done) return;
      done = true;
      const duration = Number.isFinite(v.duration) ? Math.round(v.duration) : 0;
      URL.revokeObjectURL(url);
      resolve({ duration, poster, width: v.videoWidth, height: v.videoHeight });
    };
    v.onloadedmetadata = () => {
      const t = Number.isFinite(v.duration) ? Math.min(1, v.duration / 3) : 0;
      try { v.currentTime = t; } catch { finish(null); }
    };
    v.onseeked = () => {
      try {
        const max = 900, s = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight, 1));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(v.videoWidth * s));
        c.height = Math.max(1, Math.round(v.videoHeight * s));
        c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
        finish(c.toDataURL("image/jpeg", 0.8));
      } catch { finish(null); }
    };
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error("تعذّرت قراءة الفيديو — جرّب MP4 (H.264) أو WebM")); };
    setTimeout(() => finish(null), 8000);
    v.src = url;
  });
}

export async function probeAudio(file) {
  const buf = await file.arrayBuffer();
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const audio = await ctx.decodeAudioData(buf);
    ctx.close?.();
    return { duration: Math.round(audio.duration), peaks: peaksOf(audio.getChannelData(0)) };
  } catch {
    // undecodable here (e.g. codec) — still accept, fall back to metadata only
    const url = URL.createObjectURL(file);
    const a = new Audio();
    const duration = await new Promise((r) => { a.onloadedmetadata = () => r(a.duration); a.onerror = () => r(0); a.src = url; });
    URL.revokeObjectURL(url);
    if (!duration) throw new Error("تعذّرت قراءة الملف الصوتي — جرّب MP3 أو WAV أو M4A");
    return { duration: Math.round(duration), peaks: demoPeaks(file.name) };
  }
}

function peaksOf(data, n = 56) {
  const step = Math.floor(data.length / n) || 1;
  const out = [];
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (let j = i * step; j < (i + 1) * step && j < data.length; j += 16) m = Math.max(m, Math.abs(data[j]));
    out.push(m);
  }
  const top = Math.max(...out, 0.01);
  return out.map((v) => Math.round((v / top) * 100) / 100);
}

export function demoPeaks(seed, n = 56) {
  const r = rng("peaks" + seed);
  let v = 0.5;
  return Array.from({ length: n }, (_, i) => {
    v = Math.min(1, Math.max(0.12, v + (r() - 0.5) * 0.5));
    return Math.round((v * (0.75 + 0.25 * Math.sin(i / 4))) * 100) / 100;
  });
}

// ---------------------------------------------------------------- demo synthesis
/** Animated SVG (Ken-Burns + drifting light) used as a stand-in "video" for demo entries. */
export function demoVideoSVG(seed, kind) {
  const svg = artSVG(seed, kind);
  const inner = svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  const [defs, ...rest] = inner.split("</defs>");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice"><style>
@keyframes kb{0%{transform:scale(1) translate(0,0)}100%{transform:scale(1.22) translate(-40px,-24px)}}
@keyframes sweep{0%{transform:translateX(-900px)}100%{transform:translateX(900px)}}
.kb{transform-origin:400px 300px;animation:kb 7s ease-in-out infinite alternate}
.sw{animation:sweep 5s linear infinite}
</style>${defs}<linearGradient id="lt"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><g class="kb">${rest.join("</defs>")}</g><rect class="sw" x="0" y="0" width="320" height="600" fill="url(#lt)" transform="skewX(-18)"/></svg>`;
}
export const demoVideoURI = (seed, kind) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(demoVideoSVG(seed, kind));

/** Seeded procedural jingle → 16-bit mono WAV blob. */
export function musicWav(seed, secs = 12) {
  const r = rng("music" + seed);
  const sr = 22050, n = sr * secs;
  const out = new Float32Array(n);
  const bpm = 92 + Math.floor(r() * 36);
  const beat = (60 / bpm) * sr;
  const root = 196 * Math.pow(2, Math.floor(r() * 7) / 12);
  const minor = r() < 0.5;
  const scale = minor ? [0, 3, 5, 7, 10, 12, 15] : [0, 2, 4, 7, 9, 12, 14];
  const prog = [[0, 4, 7], [5, 9, 12], [7, 11, 14], [3, 7, 10]].map((ch) => ch.map((x) => (minor && x % 12 === 4 ? x - 1 : x)));
  const melody = Array.from({ length: Math.ceil(n / (beat / 2)) }, () => (r() < 0.18 ? null : scale[Math.floor(r() * scale.length)]));
  const hz = (semi) => root * Math.pow(2, semi / 12);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const bar = Math.floor(i / (beat * 4)) % prog.length;
    const inBeat = (i % beat) / beat;
    let s = 0;
    for (const semi of prog[bar]) s += 0.05 * Math.sin(2 * Math.PI * hz(semi - 12) * t);       // pad
    s += 0.12 * Math.sin(2 * Math.PI * hz(prog[bar][0] - 24) * t) * (1 - inBeat * 0.6);        // bass
    const step = Math.floor(i / (beat / 2));
    const note = melody[step];
    if (note != null) {
      const ph = (i % (beat / 2)) / (beat / 2);
      const env = Math.min(1, ph * 30) * Math.exp(-ph * 3);
      const f = hz(note + 12);
      s += 0.16 * env * (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t));
    }
    if (Math.floor(i / beat) % 2 === 0) s += 0.35 * Math.sin(2 * Math.PI * (55 + 90 * Math.exp(-inBeat * 30)) * t) * Math.exp(-inBeat * 9); // kick
    s += (Math.random() * 2 - 1) * 0.03 * Math.exp(-((i % (beat / 2)) / (beat / 2)) * 25);            // hat
    const fade = Math.min(1, t / 0.3, (secs - t) / 1.2);
    out[i] = Math.max(-1, Math.min(1, s * fade));
  }
  const bytes = new DataView(new ArrayBuffer(44 + n * 2));
  const w = (o, str) => [...str].forEach((c, k) => bytes.setUint8(o + k, c.charCodeAt(0)));
  w(0, "RIFF"); bytes.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt ");
  bytes.setUint32(16, 16, true); bytes.setUint16(20, 1, true); bytes.setUint16(22, 1, true);
  bytes.setUint32(24, sr, true); bytes.setUint32(28, sr * 2, true); bytes.setUint16(32, 2, true); bytes.setUint16(34, 16, true);
  w(36, "data"); bytes.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) bytes.setInt16(44 + i * 2, out[i] * 0x7fff, true);
  return new Blob([bytes], { type: "audio/wav" });
}

/** Read a demo voice-over script aloud (Arabic voice if the device has one). */
export function speak(text) {
  if (!("speechSynthesis" in window)) return false;
  const synth = window.speechSynthesis;
  if (synth.speaking) { synth.cancel(); return true; }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ar-SA";
  const v = synth.getVoices().find((x) => x.lang?.toLowerCase().startsWith("ar"));
  if (v) u.voice = v;
  u.rate = 0.95;
  synth.speak(u);
  return true;
}
export const stopSpeaking = () => window.speechSynthesis?.cancel();

export const fmtDur = (sec) => {
  sec = Math.max(0, Math.round(sec || 0));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
};
