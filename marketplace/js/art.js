// Deterministic procedural artwork, used for demo entries, contest covers and
// avatars. Everything is generated as inline SVG so the demo ships with zero
// third-party images (and zero copyright questions).

export function rng(seed) {
  let h = 2166136261 >>> 0;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTES = [
  ["#0f172a", "#7c3aed", "#ec4899", "#f59e0b", "#fde68a"],
  ["#052e2b", "#0d9488", "#5eead4", "#fef3c7", "#f97316"],
  ["#1e1b4b", "#4338ca", "#22d3ee", "#a5f3fc", "#f472b6"],
  ["#3b0764", "#c026d3", "#fb7185", "#fdba74", "#fef9c3"],
  ["#111827", "#ef4444", "#f97316", "#facc15", "#fefce8"],
  ["#0c4a6e", "#0284c7", "#7dd3fc", "#fef08a", "#fb923c"],
  ["#1c1917", "#a16207", "#eab308", "#fef3c7", "#14b8a6"],
  ["#14532d", "#16a34a", "#bef264", "#fef9c3", "#f472b6"],
  ["#450a0a", "#b91c1c", "#f87171", "#fecaca", "#fde047"],
  ["#172554", "#1d4ed8", "#60a5fa", "#e0f2fe", "#f43f5e"],
];

export const ART_KINDS = ["orbs", "waves", "dunes", "sunset", "rings", "mosaic", "bloom"];

const W = 800;
const H = 600;

function grain(id) {
  return `<filter id="g${id}"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .55 0"/></filter>`;
}

function kindOrbs(r, p, id) {
  let defs = `<filter id="b${id}"><feGaussianBlur stdDeviation="${40 + r() * 30}"/></filter>`;
  let body = `<rect width="${W}" height="${H}" fill="${p[0]}"/><g filter="url(#b${id})">`;
  const n = 6 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    body += `<circle cx="${r() * W}" cy="${r() * H}" r="${80 + r() * 200}" fill="${p[1 + Math.floor(r() * 4)]}" opacity="${0.55 + r() * 0.45}"/>`;
  }
  body += `</g>`;
  // crisp foreground orb
  const cx = W * (0.3 + r() * 0.4), cy = H * (0.3 + r() * 0.4), rr = 70 + r() * 90;
  defs += `<radialGradient id="o${id}" cx="35%" cy="30%"><stop offset="0" stop-color="${p[4]}"/><stop offset=".6" stop-color="${p[2]}"/><stop offset="1" stop-color="${p[1]}"/></radialGradient>`;
  body += `<circle cx="${cx}" cy="${cy}" r="${rr}" fill="url(#o${id})"/>`;
  return { defs, body };
}

function kindWaves(r, p, id) {
  const defs = `<linearGradient id="s${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p[4]}"/><stop offset="1" stop-color="${p[3]}"/></linearGradient>`;
  let body = `<rect width="${W}" height="${H}" fill="url(#s${id})"/>`;
  const layers = 5;
  for (let l = 0; l < layers; l++) {
    const base = H * (0.35 + l * 0.13);
    const amp = 20 + r() * 40;
    const freq = 1 + r() * 2.5;
    const ph = r() * Math.PI * 2;
    let d = `M0 ${H} L0 ${base}`;
    for (let x = 0; x <= W; x += 20) {
      d += ` L${x} ${(base + Math.sin((x / W) * Math.PI * 2 * freq + ph) * amp).toFixed(1)}`;
    }
    d += ` L${W} ${H} Z`;
    body += `<path d="${d}" fill="${p[(l % 4)]}" opacity="${0.75 + l * 0.05}"/>`;
  }
  return { defs, body };
}

function kindDunes(r, p, id) {
  const defs = `<linearGradient id="s${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p[1]}"/><stop offset="1" stop-color="${p[3]}"/></linearGradient>`;
  let body = `<rect width="${W}" height="${H}" fill="url(#s${id})"/>`;
  body += `<circle cx="${W * (0.2 + r() * 0.6)}" cy="${H * (0.22 + r() * 0.15)}" r="${50 + r() * 40}" fill="${p[4]}"/>`;
  for (let l = 0; l < 4; l++) {
    const base = H * (0.45 + l * 0.14);
    let d = `M0 ${H} L0 ${base}`;
    let x = 0;
    while (x < W) {
      const nx = x + 120 + r() * 220;
      const peak = base - (30 + r() * 90);
      d += ` Q${(x + nx) / 2} ${peak} ${Math.min(nx, W)} ${base + (r() - 0.5) * 30}`;
      x = nx;
    }
    d += ` L${W} ${H} Z`;
    const shade = [p[2], p[1], p[0], p[0]][l];
    body += `<path d="${d}" fill="${shade}" opacity="${0.6 + l * 0.13}"/>`;
  }
  return { defs, body };
}

function kindSunset(r, p, id) {
  const defs = `<linearGradient id="s${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p[0]}"/><stop offset=".55" stop-color="${p[1]}"/><stop offset="1" stop-color="${p[2]}"/></linearGradient>
  <linearGradient id="u${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p[4]}"/><stop offset="1" stop-color="${p[3]}"/></linearGradient>
  <clipPath id="c${id}"><circle cx="${W / 2}" cy="${H * 0.52}" r="${150 + r() * 40}"/></clipPath>`;
  let body = `<rect width="${W}" height="${H}" fill="url(#s${id})"/>`;
  body += `<g clip-path="url(#c${id})"><rect width="${W}" height="${H}" fill="url(#u${id})"/>`;
  for (let i = 0; i < 7; i++) {
    const y = H * 0.52 + i * 18;
    body += `<rect x="0" y="${y}" width="${W}" height="${4 + i * 1.6}" fill="${p[1]}"/>`;
  }
  body += `</g>`;
  // grid floor
  body += `<rect y="${H * 0.72}" width="${W}" height="${H * 0.28}" fill="${p[0]}"/>`;
  for (let i = -10; i <= 10; i++) {
    body += `<line x1="${W / 2 + i * 30}" y1="${H * 0.72}" x2="${W / 2 + i * 120}" y2="${H}" stroke="${p[2]}" stroke-width="1.5" opacity=".7"/>`;
  }
  for (let i = 0; i < 6; i++) {
    const y = H * 0.72 + Math.pow(i / 6, 1.8) * H * 0.28;
    body += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${p[2]}" stroke-width="1.5" opacity=".7"/>`;
  }
  return { defs, body };
}

function kindRings(r, p, id) {
  let body = `<rect width="${W}" height="${H}" fill="${p[0]}"/>`;
  const cx = W * (0.35 + r() * 0.3), cy = H * (0.35 + r() * 0.3);
  for (let i = 18; i > 0; i--) {
    const off = (r() - 0.5) * 16;
    body += `<circle cx="${cx + off}" cy="${cy + off}" r="${i * 26}" fill="none" stroke="${p[1 + (i % 4)]}" stroke-width="${6 + r() * 10}" opacity="${0.35 + r() * 0.6}"/>`;
  }
  return { defs: "", body };
}

function kindMosaic(r, p, id) {
  let body = `<rect width="${W}" height="${H}" fill="${p[4]}"/>`;
  const s = 100;
  for (let y = 0; y < H; y += s) {
    for (let x = 0; x < W; x += s) {
      const c1 = p[Math.floor(r() * 4)];
      const c2 = p[Math.floor(r() * 5)];
      body += `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${c1}"/>`;
      const t = Math.floor(r() * 4);
      if (t === 0) body += `<circle cx="${x + s / 2}" cy="${y + s / 2}" r="${s * 0.38}" fill="${c2}"/>`;
      else if (t === 1) body += `<path d="M${x} ${y} L${x + s} ${y} A${s} ${s} 0 0 1 ${x} ${y + s} Z" fill="${c2}"/>`;
      else if (t === 2) body += `<path d="M${x} ${y + s} L${x + s / 2} ${y} L${x + s} ${y + s} Z" fill="${c2}"/>`;
      else body += `<rect x="${x + s * 0.25}" y="${y + s * 0.25}" width="${s / 2}" height="${s / 2}" fill="${c2}" transform="rotate(45 ${x + s / 2} ${y + s / 2})"/>`;
    }
  }
  return { defs: "", body };
}

function kindBloom(r, p, id) {
  const defs = `<radialGradient id="bg${id}"><stop offset="0" stop-color="${p[1]}"/><stop offset="1" stop-color="${p[0]}"/></radialGradient>`;
  let body = `<rect width="${W}" height="${H}" fill="url(#bg${id})"/>`;
  const cx = W / 2, cy = H / 2;
  const petals = 8 + Math.floor(r() * 10);
  for (let ring = 3; ring >= 1; ring--) {
    const len = ring * 75 + r() * 30;
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * 360 + ring * 11;
      body += `<ellipse cx="${cx}" cy="${cy - len / 2}" rx="${len * 0.22}" ry="${len / 2}" fill="${p[1 + ring]}" opacity=".78" transform="rotate(${a} ${cx} ${cy})"/>`;
    }
  }
  body += `<circle cx="${cx}" cy="${cy}" r="${26 + r() * 20}" fill="${p[4]}"/>`;
  return { defs, body };
}

const KINDS = { orbs: kindOrbs, waves: kindWaves, dunes: kindDunes, sunset: kindSunset, rings: kindRings, mosaic: kindMosaic, bloom: kindBloom };

export function artSVG(seed, kindHint) {
  const r = rng(seed);
  const p = PALETTES[Math.floor(r() * PALETTES.length)];
  const kind = KINDS[kindHint] ? kindHint : ART_KINDS[Math.floor(r() * ART_KINDS.length)];
  const id = Math.floor(r() * 1e6).toString(36);
  const { defs, body } = KINDS[kind](r, p, id);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><defs>${defs}${grain(id)}</defs>${body}<rect width="${W}" height="${H}" filter="url(#g${id})" opacity=".35"/></svg>`;
}

const cache = new Map();
export function artURI(seed, kind) {
  const k = seed + "|" + (kind || "");
  if (!cache.has(k)) cache.set(k, "data:image/svg+xml;charset=utf-8," + encodeURIComponent(artSVG(seed, kind)));
  return cache.get(k);
}

/** Resolve an image reference: "art:<seed>[:<kind>]" or a data/http URL. */
export function imgSrc(ref) {
  if (!ref) return artURI("empty");
  if (ref.startsWith("art:")) {
    const [, seed, kind] = ref.split(":");
    return artURI(seed, kind);
  }
  return ref;
}

export function avatarURI(name, seed) {
  const r = rng(seed || name);
  const p = PALETTES[Math.floor(r() * PALETTES.length)];
  const letter = (name || "?").trim().charAt(0);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p[1]}"/><stop offset="1" stop-color="${p[2]}"/></linearGradient></defs><rect width="100" height="100" fill="url(#a)"/><text x="50" y="50" dy=".35em" text-anchor="middle" font-family="IBM Plex Sans Arabic, sans-serif" font-size="46" font-weight="700" fill="#fff">${letter.replace(/[<>&"]/g, "")}</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
