# SHIFT Landscape TV-Mirroring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make SHIFT a perfect fit for a phone held in landscape and mirrored to a TV, plus add an alternate Hub→Stage→Question board flow selectable from setup.

**Architecture:** Single-file vanilla static site (HTML + CSS + JS). Landscape-first CSS rewrite using `dvh`/`clamp()` and Grid. New screens (`hub`, `stage`) added to `index.html` as sibling `<section data-screen>` elements. State extends with `boardMode` and `activeCategoryId`. Verification through Playwright MCP at four landscape viewports.

**Tech Stack:** HTML5, CSS3 (Grid + custom-properties + `clamp()` + `dvh/dvw`), vanilla JS (IIFE controller), Playwright MCP for visual verification.

---

## Repo facts

- Working dir: `/Users/akalkhamis/Movies/game test shaleh2/shift-game/`
- Files in scope: `index.html`, `styles.css`, `app.js`
- Files untouched: `data.js`, `lib/content.js`, `lib/supabase.js`, `tools/*`, `assets/*`
- Spec: `docs/superpowers/specs/2026-05-05-shift-landscape-tv-design.md`
- Local server for testing: `python3 -m http.server 8765` from inside `shift-game/`
- Playwright MCP tools available: `mcp__plugin_playwright_playwright__browser_navigate`, `_resize`, `_snapshot`, `_take_screenshot`, `_evaluate`, `_click`

## File responsibility map

| File | Responsibility | Status |
|---|---|---|
| `index.html` | Screen DOM scaffold | Modify (add hub + stage sections, mode toggle) |
| `styles.css` | All visual rules | Replace entirely |
| `app.js` | Controller, state, render functions | Modify (add hub/stage flow + mode toggle) |
| `styles.css.bak`, `index.html.bak`, `app.js.bak` | Rollback safety | Create at task 1, delete at task 8 |

---

### Task 1: Backup + start dev server

**Files:**
- Create: `styles.css.bak`, `index.html.bak`, `app.js.bak`

- [ ] **Step 1: Create backups**

```bash
cd "/Users/akalkhamis/Movies/game test shaleh2/shift-game"
cp styles.css styles.css.bak
cp index.html index.html.bak
cp app.js app.js.bak
```

- [ ] **Step 2: Start a static server (background)**

```bash
cd "/Users/akalkhamis/Movies/game test shaleh2/shift-game"
python3 -m http.server 8765
```

Run with `run_in_background: true`. Note the bash id; you'll use `http://localhost:8765/` for verification throughout.

- [ ] **Step 3: Verify the app loads (Playwright MCP)**

```
mcp__plugin_playwright_playwright__browser_navigate(url: "http://localhost:8765/")
mcp__plugin_playwright_playwright__browser_resize(width: 932, height: 430)
mcp__plugin_playwright_playwright__browser_snapshot()
```

Expected: landing screen renders (logo + title + button visible). Note this baseline screenshot.

- [ ] **Step 4: Commit baseline + spec**

```bash
cd "/Users/akalkhamis/Movies/game test shaleh2/shift-game"
git add docs/superpowers/specs/2026-05-05-shift-landscape-tv-design.md docs/superpowers/plans/2026-05-05-shift-landscape-tv.md styles.css.bak index.html.bak app.js.bak
git commit -m "chore: spec, plan, and baseline backups for landscape redesign"
```

---

### Task 2: Rewrite `styles.css` (landscape-first foundation + all screens)

**Files:**
- Replace: `styles.css`

- [ ] **Step 1: Replace `styles.css` with the file content below**

Use the Write tool with the full content (target ~700 lines):

```css
/* ==================================================================
   SHIFT — landscape-first stylesheet for phone-on-TV mirroring
   Baseline: 844 × 390 (iPhone 14 landscape). Scales to 1920 × 1080.
   RTL preserved; no portrait-specific layout (out of scope).
   ================================================================== */

:root {
  /* Brand */
  --c-bg:        #FBF6EE;       /* warm cream */
  --c-bg-2:      #F4ECE0;
  --c-ink:       #1B1B1B;
  --c-ink-2:     #4A4A4A;
  --c-mute:      #8A8A8A;
  --c-line:      #E7DECF;
  --c-card:      #FFFFFF;
  --c-coral:     #E6644A;
  --c-coral-2:   #F4A48F;
  --c-amber:     #D4A23A;
  --c-green:     #2E8B57;
  --c-red:       #C24B4B;
  --c-shadow:    0 6px 22px rgba(28,18,10,.08), 0 2px 6px rgba(28,18,10,.06);
  --c-shadow-lg: 0 14px 38px rgba(28,18,10,.12), 0 4px 10px rgba(28,18,10,.08);

  /* Fluid scale — vh because landscape height is the constraining axis */
  --u:        clamp(4px, 0.9vh, 9px);
  --gap:      calc(var(--u) * 2);
  --gap-lg:   calc(var(--u) * 3);
  --rad:      clamp(10px, 1.6vh, 18px);
  --rad-lg:   clamp(14px, 2.4vh, 26px);

  --fs-xs:    clamp(10px, 1.6vh, 14px);
  --fs-sm:    clamp(12px, 2.0vh, 17px);
  --fs-body:  clamp(14px, 2.4vh, 22px);
  --fs-h:     clamp(20px, 4.5vh, 48px);
  --fs-xh:    clamp(28px, 6.5vh, 72px);
  --fs-mega:  clamp(32px, 8vh, 96px);

  --topbar-h: clamp(44px, 9vh, 84px);
  --foot-h:   clamp(56px, 12vh, 120px);

  --tap:      clamp(40px, 7vh, 56px);
}

* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body { height: 100%; margin: 0; padding: 0; }

body {
  font-family: "Tajawal", "Cairo", "SF Arabic", system-ui, -apple-system, sans-serif;
  font-size: var(--fs-body);
  color: var(--c-ink);
  background: var(--c-bg);
  overflow: hidden;
  touch-action: manipulation;
  -webkit-font-smoothing: antialiased;
}

#app {
  position: fixed; inset: 0;
  padding:
    env(safe-area-inset-top, 0)
    env(safe-area-inset-right, 0)
    env(safe-area-inset-bottom, 0)
    env(safe-area-inset-left, 0);
  display: block;
}

button { font: inherit; color: inherit; }
input, textarea { font: inherit; color: inherit; }

/* ====================== Screens (single-visible) ====================== */
.screen[hidden] { display: none !important; }
.screen {
  position: absolute; inset: 0;
  display: grid;
  grid-template-rows: var(--topbar-h) 1fr var(--foot-h);
  overflow: hidden;
}
.screen--no-foot { grid-template-rows: var(--topbar-h) 1fr; }
.screen--full    { grid-template-rows: 1fr; }
.screen--landing { grid-template-rows: 1fr; }

/* ====================== Topbar ====================== */
.topbar {
  display: grid;
  grid-template-columns: var(--tap) 1fr var(--tap);
  align-items: center;
  gap: var(--gap);
  padding: 0 var(--gap-lg);
  border-bottom: 1px solid var(--c-line);
  background: var(--c-bg);
}
.topbar__logo { height: calc(var(--topbar-h) * 0.55); object-fit: contain; }
.topbar__spacer { width: var(--tap); }

.topbar--board {
  grid-template-columns: var(--tap) 1fr var(--tap);
}

.iconbtn {
  width: var(--tap); height: var(--tap);
  border-radius: 999px;
  border: 1px solid var(--c-line);
  background: var(--c-card);
  display: grid; place-items: center;
  font-size: calc(var(--fs-h) * 0.6);
  cursor: pointer;
  box-shadow: var(--c-shadow);
}
.iconbtn:hover { background: #fff; }
.iconbtn:active { transform: translateY(1px); }

/* ====================== Buttons ====================== */
.btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: var(--gap);
  height: var(--tap);
  padding: 0 calc(var(--gap-lg) * 1.2);
  border: 1px solid var(--c-line);
  background: var(--c-card);
  border-radius: 999px;
  font-size: var(--fs-sm);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: var(--c-shadow);
  transition: transform .08s ease, box-shadow .12s ease, background .12s ease;
}
.btn:hover { background: #fff; }
.btn:active { transform: translateY(1px); }
.btn:disabled { opacity: .45; cursor: not-allowed; }

.btn--primary {
  border: none; color: #fff;
  background: linear-gradient(180deg, var(--c-coral), #d8543b);
  box-shadow: 0 8px 22px rgba(216,84,59,.35);
}
.btn--primary:hover { background: linear-gradient(180deg, #ef6c52, #cc4d36); }

.btn--dark {
  background: #1f1f1f; color: #fff; border-color: #1f1f1f;
}
.btn--dark:hover { background: #2c2c2c; }

.btn--ghost {
  background: transparent; box-shadow: none;
}

.btn--xl { height: calc(var(--tap) * 1.2); font-size: var(--fs-body); padding: 0 calc(var(--gap-lg) * 1.6); }

.btn--t1 { background: linear-gradient(180deg, #4a90e2, #3a7ac9); color: #fff; border: none; }
.btn--t2 { background: linear-gradient(180deg, #e2884a, #c97539); color: #fff; border: none; }

/* ====================== Pills ====================== */
.pill {
  display: inline-flex; align-items: center; justify-content: center;
  height: calc(var(--tap) * 0.7);
  padding: 0 var(--gap-lg);
  background: var(--c-card);
  border: 1px solid var(--c-line);
  border-radius: 999px;
  font-size: var(--fs-sm);
  font-weight: 600;
}
.pill--cat  { background: var(--c-coral); color: #fff; border: none; }
.pill--diff { background: var(--c-bg-2); }
.pill--pts  { background: #1f1f1f; color: #fff; border: none; }

/* ====================== Modal ====================== */
.modal[hidden] { display: none; }
.modal {
  position: fixed; inset: 0;
  background: rgba(28,18,10,.45);
  display: grid; place-items: center;
  z-index: 50;
  padding: var(--gap-lg);
}
.modal__card {
  background: var(--c-card);
  border-radius: var(--rad-lg);
  padding: var(--gap-lg);
  width: min(92vw, 560px);
  box-shadow: var(--c-shadow-lg);
  display: flex; flex-direction: column; gap: var(--gap);
  max-height: 86dvh; overflow: auto;
}
.modal__title { font-size: var(--fs-h); font-weight: 800; }
.modal__body { font-size: var(--fs-body); color: var(--c-ink-2); }
.modal__actions { display: flex; gap: var(--gap); justify-content: flex-end; flex-wrap: wrap; }

/* ====================== Boot overlay ====================== */
.boot-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: var(--c-bg);
  display: grid; place-items: center; gap: var(--gap-lg);
  transition: opacity .25s ease;
}
.boot-overlay[aria-hidden="true"] { opacity: 0; pointer-events: none; }
.boot-overlay__logo { width: clamp(80px, 18vh, 160px); }
.boot-overlay__msg  { font-size: var(--fs-body); color: var(--c-ink-2); }

/* ====================== Landing ====================== */
.screen--landing { background: var(--c-bg); position: relative; overflow: hidden; }
.landing__bg {
  position: absolute; inset: 0;
  background:
    radial-gradient(60% 80% at 80% 50%, rgba(230,100,74,.18), transparent 60%),
    radial-gradient(50% 70% at 15% 20%, rgba(244,164,143,.20), transparent 70%);
  pointer-events: none;
}
.landing__inner {
  position: relative; z-index: 1;
  height: 100%;
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  align-items: center;
  padding: var(--gap-lg) calc(var(--gap-lg) * 2);
  gap: var(--gap-lg);
}
.landing__logo  { width: clamp(80px, 18vh, 180px); grid-column: 1; justify-self: start; }
.landing__title { grid-column: 1; font-size: var(--fs-xh); margin: var(--gap) 0; line-height: 1.05; font-weight: 900; }
.landing__tagline { grid-column: 1; font-size: var(--fs-body); color: var(--c-ink-2); margin: 0 0 var(--gap-lg); }
.landing .btn--primary { grid-column: 1; justify-self: start; }
.landing__meta { grid-column: 1; display: flex; gap: var(--gap); align-items: center; margin-top: var(--gap-lg); color: var(--c-mute); font-size: var(--fs-sm); }
.landing__meta i { width: 4px; height: 4px; background: var(--c-mute); border-radius: 50%; }

/* ====================== Setup ====================== */
.setup {
  display: grid;
  grid-template-columns: 1fr 1.1fr 1.1fr;
  grid-template-rows: 1fr auto;
  gap: var(--gap-lg);
  padding: var(--gap-lg);
  overflow: hidden;
}
.setup__h { grid-column: 1 / -1; margin: 0; font-size: var(--fs-h); display: none; }
.setup__col { display: flex; flex-direction: column; gap: var(--gap); min-width: 0; }

.field { display: flex; flex-direction: column; gap: calc(var(--u) * 1); }
.field__label { font-size: var(--fs-xs); color: var(--c-ink-2); font-weight: 700; }
.field input, .field textarea {
  width: 100%;
  padding: 0 var(--gap-lg);
  height: var(--tap);
  border-radius: 999px;
  border: 1px solid var(--c-line);
  background: var(--c-card);
  font-size: var(--fs-sm);
  outline: none;
}
.field textarea {
  height: auto; min-height: calc(var(--tap) * 2);
  border-radius: var(--rad);
  padding: var(--gap);
  resize: vertical;
}
.field input:focus, .field textarea:focus { border-color: var(--c-coral); box-shadow: 0 0 0 3px rgba(230,100,74,.18); }

.mode-toggle {
  display: flex; flex-direction: column; gap: calc(var(--u) * 1);
}
.mode-toggle__h { font-size: var(--fs-xs); font-weight: 700; color: var(--c-ink-2); }
.mode-toggle__opts { display: flex; gap: var(--gap); flex-wrap: wrap; }
.mode-toggle label {
  flex: 1 1 auto;
  display: flex; align-items: center; gap: var(--gap);
  padding: calc(var(--u)*1.2) var(--gap-lg);
  background: var(--c-card);
  border: 1px solid var(--c-line);
  border-radius: 999px;
  cursor: pointer;
  font-size: var(--fs-sm);
}
.mode-toggle input { accent-color: var(--c-coral); }
.mode-toggle label:has(input:checked) {
  border-color: var(--c-coral); background: rgba(230,100,74,.08);
  font-weight: 700;
}

.teams { display: contents; }
.team-card {
  display: flex; flex-direction: column; gap: var(--gap);
  background: var(--c-card);
  border: 1px solid var(--c-line);
  border-radius: var(--rad-lg);
  padding: var(--gap-lg);
  min-width: 0;
}
.team-card h3 { margin: 0; font-size: var(--fs-body); font-weight: 800; }
.team-card__hint { font-size: var(--fs-xs); color: var(--c-ink-2); }

.lifelines {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--gap);
  min-width: 0;
}
.lifeline-chip {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  background: var(--c-bg-2);
  border: 1px solid var(--c-line);
  border-radius: var(--rad);
  padding: calc(var(--u)*1.2) calc(var(--u)*0.5);
  font-size: var(--fs-xs);
  cursor: pointer;
  text-align: center;
  min-width: 0;
}
.lifeline-chip__icon { font-size: calc(var(--fs-body) * 1.1); line-height: 1; }
.lifeline-chip__name { font-size: var(--fs-xs); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.lifeline-chip.is-selected {
  background: rgba(230,100,74,.10);
  border-color: var(--c-coral);
  color: var(--c-coral);
  font-weight: 700;
}

.acc {
  grid-column: 1 / -1;
  background: var(--c-bg-2);
  border: 1px solid var(--c-line);
  border-radius: var(--rad);
  padding: calc(var(--u)*1.4) var(--gap-lg);
}
.acc summary { cursor: pointer; font-weight: 700; list-style: none; }
.acc summary::-webkit-details-marker { display: none; }
.acc__body { padding-top: var(--gap); display: flex; flex-direction: column; gap: var(--gap); }
.split-result { font-size: var(--fs-sm); color: var(--c-ink-2); }

.setup__cta { grid-column: 1 / -1; display: flex; justify-content: center; }

/* ====================== Categories ====================== */
.cats {
  display: grid;
  grid-template-rows: auto 1fr auto;
  padding: var(--gap-lg);
  gap: var(--gap);
  overflow: hidden;
}
.cats__h { margin: 0; font-size: var(--fs-h); text-align: center; }
.cats__groups {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: var(--gap);
  align-content: start;
  overflow-y: auto;
  padding: 2px;
}
.cats__footer { display: flex; justify-content: center; }
.catgroup__title { display: none; }
.catcard {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: calc(var(--u)*0.8);
  background: var(--c-card);
  border: 1px solid var(--c-line);
  border-radius: var(--rad);
  padding: var(--gap);
  cursor: pointer;
  text-align: center;
  min-height: clamp(80px, 14vh, 160px);
  transition: border-color .12s ease, transform .08s ease;
}
.catcard:hover { transform: translateY(-1px); }
.catcard__emoji { font-size: clamp(28px, 5.5vh, 56px); line-height: 1; }
.catcard__name  { font-size: var(--fs-sm); font-weight: 700; }
.catcard.is-selected {
  border-color: var(--c-coral);
  box-shadow: inset 0 0 0 2px var(--c-coral);
  background: rgba(230,100,74,.06);
}
.catcard.is-disabled { opacity: .35; pointer-events: none; }

@media (max-height: 380px) {
  .cats__groups { grid-template-columns: repeat(8, 1fr); }
  .catcard { min-height: clamp(64px, 18vh, 110px); }
}

/* ====================== Board topbar (scores) ====================== */
.score-pair {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--gap-lg);
  justify-items: center;
}
.score {
  display: grid;
  grid-template-columns: auto auto;
  align-items: center;
  gap: var(--gap);
  position: relative;
}
.score__name { font-size: var(--fs-sm); color: var(--c-ink-2); font-weight: 700; }
.score__btn {
  background: transparent; border: none; cursor: pointer;
  font-size: var(--fs-xh); font-weight: 900; line-height: 1;
}
.score--t1 .score__btn { color: #4a90e2; }
.score--t2 .score__btn { color: #e2884a; }
.score__turn {
  position: absolute; inset: auto auto -1.4em 50%;
  transform: translateX(50%);
  font-size: var(--fs-xs); font-weight: 700;
  background: var(--c-coral); color: #fff;
  padding: 2px 10px; border-radius: 999px;
  opacity: 0; transition: opacity .15s ease;
}
.score.is-turn .score__turn { opacity: 1; }

/* ====================== Board (Mode A) ====================== */
.hub {
  padding: var(--gap-lg);
  overflow: hidden;
}
.hub__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: var(--gap);
  height: 100%;
}
.hub-tile {
  background: var(--c-card);
  border: 1px solid var(--c-line);
  border-radius: var(--rad-lg);
  padding: var(--gap);
  display: grid;
  grid-template-rows: auto auto 1fr;
  gap: calc(var(--u)*0.8);
  min-height: 0;
  text-align: center;
}
.hub-tile__head {
  display: grid; grid-template-columns: auto 1fr; align-items: center;
  gap: var(--gap); justify-content: start;
}
.hub-tile__emoji {
  font-size: clamp(20px, 4.5vh, 40px); line-height: 1;
  background: rgba(230,100,74,.10);
  width: calc(var(--tap) * 0.95); height: calc(var(--tap) * 0.95);
  display: grid; place-items: center;
  border-radius: var(--rad);
}
.hub-tile__name { font-size: var(--fs-sm); font-weight: 800; text-align: start; }

.hub-tile__cells {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: calc(var(--u)*0.8);
  min-height: 0;
}
.cell {
  display: grid; place-items: center;
  border-radius: var(--rad);
  border: 1px solid var(--c-line);
  background: var(--c-card);
  font-size: var(--fs-body); font-weight: 900;
  cursor: pointer;
  transition: transform .08s ease, background .12s ease;
}
.cell:hover { background: #fffaf3; }
.cell:active { transform: translateY(1px); }
.cell[data-diff="easy"]   { color: var(--c-green); }
.cell[data-diff="medium"] { color: var(--c-amber); }
.cell[data-diff="hard"]   { color: var(--c-red); }
.cell.is-used {
  opacity: .35; pointer-events: none;
  text-decoration: line-through;
  background: var(--c-bg-2);
}

/* ====================== Hub (Mode B) ====================== */
.hub--mode-b .hub-tile {
  display: grid;
  grid-template-rows: 1fr auto auto;
  place-items: center;
  cursor: pointer;
  text-align: center;
  padding: var(--gap-lg);
}
.hub--mode-b .hub-tile.is-done { opacity: .45; pointer-events: none; }
.hub--mode-b .hub-tile__emoji {
  width: clamp(56px, 12vh, 100px); height: clamp(56px, 12vh, 100px);
  font-size: clamp(34px, 7vh, 60px);
}
.hub--mode-b .hub-tile__name { text-align: center; font-size: var(--fs-body); }
.hub-tile__dots { display: flex; gap: 6px; justify-content: center; }
.hub-tile__dots i {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--c-line);
}
.hub-tile__dots i.is-used { background: var(--c-coral); }

/* ====================== Stage ====================== */
.stage {
  display: grid;
  grid-template-columns: 1fr 1.4fr 1fr;
  gap: var(--gap-lg);
  padding: var(--gap-lg);
  overflow: hidden;
}
.stage__col { display: grid; grid-template-rows: repeat(3, 1fr); gap: var(--gap); }
.stage__card {
  background: rgba(230,100,74,.10);
  border: 1px solid rgba(230,100,74,.25);
  border-radius: var(--rad-lg);
  display: grid; place-items: center;
  text-align: center;
  padding: var(--gap-lg);
  gap: var(--gap);
}
.stage__card__emoji { font-size: clamp(48px, 12vh, 120px); line-height: 1; }
.stage__card__name  { font-size: var(--fs-h); font-weight: 800; color: var(--c-coral); }
.stage .cell {
  background: var(--c-card);
  font-size: var(--fs-xh);
  border-radius: var(--rad-lg);
}

/* ====================== Board footer ====================== */
.board__foot {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--gap-lg);
  padding: 0 var(--gap-lg);
  border-top: 1px solid var(--c-line);
  background: var(--c-bg);
}
.lifelines-bar {
  display: flex; gap: var(--gap); justify-content: flex-start; flex-wrap: wrap;
}
.lifelines-bar[data-team="2"] { justify-content: flex-end; }
.lifelines-bar .lifeline-chip {
  flex-direction: row;
  padding: calc(var(--u)*0.8) var(--gap);
  background: var(--c-card);
  font-size: var(--fs-xs);
  height: calc(var(--tap) * 0.85);
}
.lifelines-bar .lifeline-chip.is-used { opacity: .35; text-decoration: line-through; pointer-events: none; }
.board__turn {
  display: grid; place-items: center;
  background: var(--c-card);
  border: 1px solid var(--c-line);
  border-radius: 999px;
  padding: 0 var(--gap-lg);
  height: calc(var(--tap) * 0.8);
  font-size: var(--fs-sm); font-weight: 700;
}
.board__turn b { color: var(--c-coral); margin-right: 4px; }

/* ====================== Question ====================== */
.q-meta { display: flex; gap: var(--gap); justify-content: center; align-items: center; flex-wrap: wrap; }

.qwrap {
  display: grid;
  grid-template-columns: 1.6fr 1fr;
  grid-template-rows: 1fr auto;
  gap: var(--gap-lg);
  padding: var(--gap-lg);
  overflow: hidden;
  position: relative;
}
.q-card {
  grid-column: 1; grid-row: 1;
  background: var(--c-card);
  border: 1px solid var(--c-line);
  border-radius: var(--rad-lg);
  padding: var(--gap-lg);
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: var(--gap);
  overflow: hidden;
  position: relative;
}
.q-text  { font-size: var(--fs-mega); font-weight: 800; line-height: 1.1; align-self: center; text-align: center; overflow: auto; }
.q-media { display: grid; place-items: center; max-height: 22vh; }
.q-media img, .q-media video { max-width: 100%; max-height: 22vh; object-fit: contain; border-radius: var(--rad); }
.q-media[hidden] { display: none; }

.q-answer { display: flex; flex-direction: column; gap: var(--gap); align-items: center; padding-top: var(--gap); border-top: 1px dashed var(--c-line); }
.q-answer[hidden] { display: none; }
.q-answer__label { font-size: var(--fs-sm); color: var(--c-ink-2); font-weight: 700; }
.q-answer__value { font-size: var(--fs-h); font-weight: 800; color: var(--c-coral); text-align: center; }

.timer {
  position: absolute; top: var(--gap); inset-inline-end: var(--gap);
  width: clamp(56px, 12vh, 110px); height: clamp(56px, 12vh, 110px);
  display: grid; place-items: center;
}
.timer__svg { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); }
.timer__track, .timer__ring { fill: none; stroke-width: 8; }
.timer__track { stroke: var(--c-line); }
.timer__ring  { stroke: var(--c-green); stroke-linecap: round; stroke-dasharray: 339.292; stroke-dashoffset: 0; transition: stroke-dashoffset 1s linear, stroke .2s ease; }
.timer.is-warn   .timer__ring { stroke: var(--c-amber); }
.timer.is-danger .timer__ring { stroke: var(--c-red); }
.timer__text { font-size: var(--fs-sm); font-weight: 800; z-index: 1; }

.q-lifelines {
  grid-column: 2; grid-row: 1;
  display: grid; grid-template-rows: 1fr 1fr; gap: var(--gap);
  overflow: hidden;
}
.q-lifelines__side {
  background: var(--c-card);
  border: 1px solid var(--c-line);
  border-radius: var(--rad-lg);
  padding: var(--gap);
  display: grid; grid-template-rows: auto 1fr; gap: calc(var(--u)*0.8);
  min-height: 0;
}
.q-lifelines__name { font-size: var(--fs-xs); font-weight: 800; color: var(--c-ink-2); }
.q-lifelines__list { display: flex; gap: calc(var(--u)*0.6); flex-wrap: wrap; align-content: start; min-height: 0; overflow: auto; }
.q-lifelines__list .lifeline-chip { flex-direction: row; padding: calc(var(--u)*0.6) var(--gap); height: auto; }

.q-controls {
  grid-column: 2; grid-row: 2;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--gap);
}
.q-controls .btn { width: 100%; }

.q-award {
  grid-column: 1 / -1; grid-row: 2;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: var(--gap);
  background: var(--c-bg-2);
  border-top: 1px solid var(--c-line);
  border-radius: var(--rad-lg);
  padding: var(--gap);
}
.q-award[hidden] { display: none; }
.q-award__label { display: none; }
.q-award__btns { display: contents; }
.q-award .btn { width: 100%; height: var(--tap); }

/* When award shown, hide controls (they overlap the same row) */
.q-award:not([hidden]) ~ .q-controls,
.qwrap:has(.q-award:not([hidden])) .q-controls { display: none; }

/* ====================== Results ====================== */
.results {
  height: 100%;
  display: grid; grid-template-rows: auto auto auto 1fr auto;
  align-items: center; justify-items: center;
  gap: var(--gap-lg);
  padding: var(--gap-lg);
}
.results__logo  { width: clamp(60px, 10vh, 110px); }
.results__h     { margin: 0; font-size: var(--fs-h); }
.results__winner{ font-size: var(--fs-xh); font-weight: 900; color: var(--c-coral); text-align: center; }
.results__scores{
  display: grid; grid-template-columns: 1fr auto 1fr; gap: var(--gap-lg); align-items: center;
}
.results__team  { background: var(--c-card); border: 1px solid var(--c-line); border-radius: var(--rad-lg); padding: var(--gap-lg); min-width: clamp(140px, 24vw, 260px); text-align: center; }
.results__name  { font-size: var(--fs-sm); color: var(--c-ink-2); font-weight: 700; }
.results__score { font-size: var(--fs-mega); font-weight: 900; color: var(--c-ink); }
.results__vs    { font-size: var(--fs-h); color: var(--c-mute); }
.results__actions { display: flex; gap: var(--gap); flex-wrap: wrap; justify-content: center; }

/* ====================== Utility ====================== */
.is-hidden { display: none !important; }
```

- [ ] **Step 2: Verify the page still renders without console errors**

```
mcp__plugin_playwright_playwright__browser_navigate(url: "http://localhost:8765/")
mcp__plugin_playwright_playwright__browser_resize(width: 932, height: 430)
mcp__plugin_playwright_playwright__browser_console_messages()
```

Expected: no `Uncaught` errors. Visual: landing screen has the new layout (left-anchored title + right gradient).

- [ ] **Step 3: Commit**

```bash
cd "/Users/akalkhamis/Movies/game test shaleh2/shift-game"
git add styles.css
git commit -m "style(shift): landscape-first stylesheet rewrite"
```

---

### Task 3: Add Hub + Stage sections + mode toggle to `index.html`

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add the mode-toggle inside the setup screen**

In `index.html`, find this block:

```html
      <label class="field">
        <span class="field__label">اسم اللعبة</span>
        <input id="gameName" type="text" placeholder="مثال: ليلة الثلاثاء" maxlength="40" />
      </label>

      <div class="teams">
```

Replace with:

```html
      <div class="setup__col">
        <label class="field">
          <span class="field__label">اسم اللعبة</span>
          <input id="gameName" type="text" placeholder="مثال: ليلة الثلاثاء" maxlength="40" />
        </label>

        <div class="mode-toggle">
          <span class="mode-toggle__h">نمط اللوح</span>
          <div class="mode-toggle__opts">
            <label><input type="radio" name="boardMode" value="all" checked /> كل الفئات على لوح واحد</label>
            <label><input type="radio" name="boardMode" value="hub" /> فئة واحدة في كل مرة</label>
          </div>
        </div>

        <details class="acc">
          <summary>قسّملي الفرق تلقائياً</summary>
          <div class="acc__body">
            <label class="field">
              <span class="field__label">أسماء اللاعبين (اسم لكل سطر)</span>
              <textarea id="playersPool" rows="4" placeholder="أحمد&#10;سارة&#10;فيصل&#10;..."></textarea>
            </label>
            <button class="btn" data-action="split-teams">اقسم الفرق</button>
            <div id="splitResult" class="split-result"></div>
          </div>
        </details>
      </div>

      <div class="teams">
```

- [ ] **Step 2: Move the existing `<details class="acc">` block into the col above**

Delete the standalone `<details class="acc"> ... </details>` that previously sat between `.teams` and the primary button (it's now inside `.setup__col`).

- [ ] **Step 3: Wrap the primary button**

Find:
```html
      <button class="btn btn--primary btn--xl" data-action="go-categories">اختر الفئات</button>
    </div>
  </section>
```

Replace with:
```html
      <div class="setup__cta">
        <button class="btn btn--primary btn--xl" data-action="go-categories">اختر الفئات</button>
      </div>
    </div>
  </section>
```

- [ ] **Step 4: Insert Hub and Stage sections AFTER the existing board section**

Find the closing `</section>` of the `data-screen="board"` element (it ends with `</footer>` then `</section>`). Immediately AFTER it, insert:

```html
  <!-- ========== HUB (Mode B) ========== -->
  <section class="screen screen--board" data-screen="hub" hidden>
    <header class="topbar topbar--board">
      <button class="iconbtn" data-action="home-confirm" title="إنهاء">✕</button>
      <div class="score-pair">
        <div class="score score--t1">
          <span class="score__name" id="hT1Name">الفريق الأول</span>
          <button class="score__btn" data-action="edit-score" data-team="1">
            <span id="hT1Score">0</span>
          </button>
          <span class="score__turn">الدور</span>
        </div>
        <img class="topbar__logo" src="assets/logo/shift-coral.png" alt="SHIFT" />
        <div class="score score--t2">
          <span class="score__name" id="hT2Name">الفريق الثاني</span>
          <button class="score__btn" data-action="edit-score" data-team="2">
            <span id="hT2Score">0</span>
          </button>
          <span class="score__turn">الدور</span>
        </div>
      </div>
      <button class="iconbtn" data-action="undo" title="تراجع">↶</button>
    </header>

    <div class="hub hub--mode-b" id="hubBView">
      <div class="hub__grid" id="hubBGrid"></div>
    </div>

    <footer class="board__foot">
      <div class="lifelines-bar" data-team="1" id="hLl1"></div>
      <div class="board__turn">
        <span>دور <b id="hubTurnTeamName">الفريق الأول</b></span>
      </div>
      <div class="lifelines-bar" data-team="2" id="hLl2"></div>
    </footer>
  </section>

  <!-- ========== STAGE (Mode B) ========== -->
  <section class="screen screen--board" data-screen="stage" hidden>
    <header class="topbar topbar--board">
      <button class="iconbtn" data-action="back-hub" title="رجوع">‹</button>
      <div class="score-pair">
        <div class="score score--t1">
          <span class="score__name" id="sT1Name">الفريق الأول</span>
          <button class="score__btn" data-action="edit-score" data-team="1">
            <span id="sT1Score">0</span>
          </button>
          <span class="score__turn">الدور</span>
        </div>
        <img class="topbar__logo" src="assets/logo/shift-coral.png" alt="SHIFT" />
        <div class="score score--t2">
          <span class="score__name" id="sT2Name">الفريق الثاني</span>
          <button class="score__btn" data-action="edit-score" data-team="2">
            <span id="sT2Score">0</span>
          </button>
          <span class="score__turn">الدور</span>
        </div>
      </div>
      <button class="iconbtn" data-action="undo" title="تراجع">↶</button>
    </header>

    <div class="stage" id="stageView">
      <div class="stage__col" id="stageColLeft"></div>
      <div class="stage__card" id="stageCenter">
        <div class="stage__card__emoji" id="stageEmoji">—</div>
        <div class="stage__card__name"  id="stageName">—</div>
      </div>
      <div class="stage__col" id="stageColRight"></div>
    </div>

    <footer class="board__foot">
      <div class="lifelines-bar" data-team="1" id="sLl1"></div>
      <div class="board__turn">
        <span>دور <b id="stageTurnTeamName">الفريق الأول</b></span>
      </div>
      <div class="lifelines-bar" data-team="2" id="sLl2"></div>
    </footer>
  </section>
```

- [ ] **Step 5: Verify HTML structure**

```
mcp__plugin_playwright_playwright__browser_navigate(url: "http://localhost:8765/")
mcp__plugin_playwright_playwright__browser_evaluate(function: "() => ({
  screens: [...document.querySelectorAll('[data-screen]')].map(s => s.dataset.screen),
  modeRadios: document.querySelectorAll('input[name=boardMode]').length,
  stageColExists: !!document.querySelector('#stageColLeft')
})")
```

Expected: `screens` includes `["landing","setup","categories","board","hub","stage","question","results"]`, `modeRadios === 2`, `stageColExists === true`.

- [ ] **Step 6: Commit**

```bash
cd "/Users/akalkhamis/Movies/game test shaleh2/shift-game"
git add index.html
git commit -m "feat(shift): add hub + stage screens and mode toggle in setup"
```

---

### Task 4: Wire Hub/Stage flow into `app.js`

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Extend `state` and helpers**

In the `state` literal (after `history: []`), add:
```js
    boardMode: "all",
    activeCategoryId: null,
```

Inside the `SCREENS` array near `show()`, change to:
```js
const SCREENS = ["landing","setup","categories","board","hub","stage","question","results"];
```

Add `screen === "board" || screen === "hub" || screen === "stage" || screen === "question" || screen === "categories" || screen === "setup"` to the `no-scroll` toggle. Replace this line:
```js
document.body.classList.toggle("no-scroll", screen === "board");
```
with:
```js
const NO_SCROLL = new Set(["board","hub","stage","question","categories","setup"]);
document.body.classList.toggle("no-scroll", NO_SCROLL.has(screen));
```

- [ ] **Step 2: Read mode toggle in `go-categories` action**

Find the `case "go-categories":` block. Right before `show("categories")`, add:
```js
        const modeRadio = document.querySelector('input[name="boardMode"]:checked');
        state.boardMode = modeRadio ? modeRadio.value : "all";
```

- [ ] **Step 3: Route `go-board` based on mode**

Replace the existing `case "go-board":` body with:

```js
      case "go-board":
        if (state.selectedCats.length !== 6){ flash("اختر ٦ فئات."); return; }
        buildBoard(); state.turn = 0; state.history = [];
        if (state.boardMode === "hub") {
          show("hub"); renderHub();
        } else {
          show("board"); renderBoard();
        }
        break;
```

- [ ] **Step 4: Add `pick-category` and `back-hub` actions**

Inside the `switch (action)` block in `onClick`, add (right before `case "back-board":`):

```js
      case "pick-category":
        state.activeCategoryId = t.dataset.cat;
        show("stage"); renderStage(); break;
      case "back-hub":
        state.activeCategoryId = null;
        show("hub"); renderHub(); break;
```

- [ ] **Step 5: Add `renderHub()` and `renderStage()` functions**

Add immediately after `renderBoard()` definition:

```js
  function renderHub(){
    renderBoardChromeFor("hub");
    const grid = document.getElementById("hubBGrid");
    if (!grid) return;
    grid.innerHTML = "";
    state.selectedCats.forEach(catId => {
      const cat = CATEGORIES.find(c => c.id === catId);
      const cellsForCat = state.board
        .map((c,i) => ({...c, idx:i}))
        .filter(c => c.catId === catId);
      const usedCount = cellsForCat.filter(c => c.used).length;
      const totalCount = cellsForCat.length;
      const tile = document.createElement("button");
      tile.className = "hub-tile" + (usedCount === totalCount ? " is-done" : "");
      tile.dataset.action = "pick-category";
      tile.dataset.cat = catId;
      tile.innerHTML = `
        <div class="hub-tile__emoji">${cat?.emoji || "❓"}</div>
        <div class="hub-tile__name">${cat?.name  || catId}</div>
        <div class="hub-tile__dots">${cellsForCat.map(c => `<i class="${c.used ? "is-used" : ""}"></i>`).join("")}</div>
      `;
      grid.appendChild(tile);
    });
    renderBoardLifelinesFor("hub");
  }

  function renderStage(){
    renderBoardChromeFor("stage");
    const cat = CATEGORIES.find(c => c.id === state.activeCategoryId);
    document.getElementById("stageEmoji").textContent = cat?.emoji || "❓";
    document.getElementById("stageName").textContent  = cat?.name  || state.activeCategoryId || "";

    const cellsForCat = state.board
      .map((c,i) => ({...c, idx:i}))
      .filter(c => c.catId === state.activeCategoryId);

    // Order: easy(200), medium(400), hard(600). Two cells per difficulty.
    const turnTeam = state.turn; // 0 or 1
    const ORDER = ["easy","medium","hard"];
    const POINTS = { easy: 200, medium: 400, hard: 600 };

    const renderCol = (containerId, side) => {
      const col = document.getElementById(containerId);
      col.innerHTML = "";
      ORDER.forEach(diff => {
        // pick the cell for this team's side: side 0 → first occurrence, side 1 → second
        const matches = cellsForCat.filter(c => c.difficulty === diff);
        const cell = matches[side];
        if (!cell) return;
        const btn = document.createElement("button");
        btn.className = "cell" + (cell.used ? " is-used" : "");
        btn.dataset.diff = diff;
        btn.textContent = POINTS[diff];
        btn.addEventListener("click", () => {
          if (cell.used) return;
          openQuestion(cell.idx);
        });
        col.appendChild(btn);
      });
    };
    renderCol("stageColLeft",  turnTeam);          // left = current turn team
    renderCol("stageColRight", turnTeam === 0 ? 1 : 0);

    renderBoardLifelinesFor("stage");
  }

  function renderBoardChromeFor(scope){
    // scope: "hub" | "stage"
    const prefix = scope === "hub" ? "h" : "s";
    document.getElementById(prefix + "T1Name").textContent  = state.teams[0].name;
    document.getElementById(prefix + "T2Name").textContent  = state.teams[1].name;
    document.getElementById(prefix + "T1Score").textContent = state.teams[0].score;
    document.getElementById(prefix + "T2Score").textContent = state.teams[1].score;
    const root = document.querySelector(`[data-screen="${scope}"]`);
    root.querySelector(".score--t1").classList.toggle("is-turn", state.turn === 0);
    root.querySelector(".score--t2").classList.toggle("is-turn", state.turn === 1);
    const turnNameEl = document.getElementById(scope + "TurnTeamName");
    if (turnNameEl) turnNameEl.textContent = state.teams[state.turn].name;
  }

  function renderBoardLifelinesFor(scope){
    const prefix = scope === "hub" ? "hLl" : "sLl";
    [1,2].forEach(team => {
      const bar = document.getElementById(prefix + team);
      if (!bar) return;
      bar.innerHTML = "";
      const t = state.teams[team-1];
      t.lifelines.forEach(llId => {
        const ll = LIFELINES.find(l => l.id === llId);
        const used = t.usedLifelines.has(llId);
        const chip = document.createElement("button");
        chip.className = "lifeline-chip" + (used ? " is-used" : "");
        chip.innerHTML = `<span class="lifeline-chip__icon">${ll?.icon||"•"}</span><span class="lifeline-chip__name">${ll?.name||llId}</span>`;
        bar.appendChild(chip);
      });
    });
  }
```

- [ ] **Step 6: Update post-award flow to return to hub in Mode B**

Find the `award()` function (search for `function award(`). Locate the place where it transitions back to the board after a tick (the line `show("board"); renderBoard();` or similar). Replace with:

```js
      if (state.boardMode === "hub") {
        // If all 6 cells of active category are used, return to hub; otherwise stay on stage
        const cat = state.activeCategoryId;
        const remaining = state.board.filter(c => c.catId === cat && !c.used).length;
        if (remaining === 0) { state.activeCategoryId = null; show("hub"); renderHub(); }
        else { show("stage"); renderStage(); }
      } else {
        show("board"); renderBoard();
      }
```

(If `award()` does not currently navigate, locate the `revealAnswer` → `renderQAward` chain and add the navigation in the award handler. The exact post-award nav lives where existing code does `show("board")` after award.)

- [ ] **Step 7: Verify both flows**

Mode A click-through:
```
mcp__plugin_playwright_playwright__browser_navigate(url: "http://localhost:8765/")
mcp__plugin_playwright_playwright__browser_resize(width: 932, height: 430)
mcp__plugin_playwright_playwright__browser_evaluate(function: "() => document.querySelector('[data-action=go-setup]').click()")
mcp__plugin_playwright_playwright__browser_evaluate(function: "() => { document.querySelectorAll('[data-team] .lifeline-chip').forEach((c,i) => { if (i<3 || (i>=5&&i<8)) c.click(); }); document.querySelector('[data-action=go-categories]').click(); }")
mcp__plugin_playwright_playwright__browser_evaluate(function: "() => { const cards=[...document.querySelectorAll('.catcard')].slice(0,6); cards.forEach(c=>c.click()); document.querySelector('[data-action=go-board]').click(); }")
mcp__plugin_playwright_playwright__browser_snapshot()
```

Expected: ends on `data-screen="board"` with 6 category cards visible.

Mode B click-through (re-run same setup, but tick the second mode radio):
```
mcp__plugin_playwright_playwright__browser_navigate(url: "http://localhost:8765/")
mcp__plugin_playwright_playwright__browser_resize(width: 932, height: 430)
mcp__plugin_playwright_playwright__browser_evaluate(function: "() => document.querySelector('[data-action=go-setup]').click()")
mcp__plugin_playwright_playwright__browser_evaluate(function: "() => { document.querySelector('input[name=boardMode][value=hub]').click(); document.querySelectorAll('[data-team] .lifeline-chip').forEach((c,i) => { if (i<3 || (i>=5&&i<8)) c.click(); }); document.querySelector('[data-action=go-categories]').click(); }")
mcp__plugin_playwright_playwright__browser_evaluate(function: "() => { const cards=[...document.querySelectorAll('.catcard')].slice(0,6); cards.forEach(c=>c.click()); document.querySelector('[data-action=go-board]').click(); }")
mcp__plugin_playwright_playwright__browser_evaluate(function: "() => document.querySelector('[data-screen=hub]:not([hidden])')?.dataset.screen")
mcp__plugin_playwright_playwright__browser_evaluate(function: "() => document.querySelector('.hub-tile').click()")
mcp__plugin_playwright_playwright__browser_evaluate(function: "() => document.querySelector('[data-screen=stage]:not([hidden])')?.dataset.screen")
mcp__plugin_playwright_playwright__browser_snapshot()
```

Expected: hub then stage screens both reachable; final snapshot shows the stage's 3-column layout.

- [ ] **Step 8: Commit**

```bash
cd "/Users/akalkhamis/Movies/game test shaleh2/shift-game"
git add app.js
git commit -m "feat(shift): hub/stage flow with mode toggle (boardMode + activeCategoryId)"
```

---

### Task 5: Smoke-test all viewports + capture screenshots

**Files:**
- Create: `docs/screenshots/landscape-tv/{size}-{screen}.png`

- [ ] **Step 1: For each viewport size, walk through both modes and capture**

Sizes: `844×390`, `932×430`, `1280×720`, `1920×1080`.
Screens to capture per size: landing, setup, categories, board (Mode A), hub (Mode B), stage (Mode B), question, results.

Use this sequence per size (substitute `<W>` and `<H>`):

```
mcp__plugin_playwright_playwright__browser_resize(width: <W>, height: <H>)
mcp__plugin_playwright_playwright__browser_navigate(url: "http://localhost:8765/")
mcp__plugin_playwright_playwright__browser_take_screenshot(filename: "docs/screenshots/landscape-tv/<W>x<H>-landing.png", fullPage: false)
```

Then click through and screenshot each subsequent screen via `browser_evaluate(...)` clicks.

- [ ] **Step 2: Per size, verify zero-scroll on every gameplay screen**

```
mcp__plugin_playwright_playwright__browser_evaluate(function: "() => ({
  scrollX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  scrollY: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  bodyOverflow: getComputedStyle(document.body).overflow
})")
```

Expected: on board, hub, stage, categories, setup, question — `scrollY <= 0` AND `bodyOverflow === "hidden"`. If any size shows scroll, note the screen + size and either tighten its CSS (smaller `--gap-lg`, `--fs-h`) or reflow.

- [ ] **Step 3: Visual diff against reference PNGs (eyeball)**

Compare:
- `docs/screenshots/landscape-tv/1280x720-board.png` vs `shift-board-final.png`
- `docs/screenshots/landscape-tv/1280x720-hub.png`   vs `shift-hub.png`
- `docs/screenshots/landscape-tv/1280x720-stage.png` vs `shift-stage.png`
- `docs/screenshots/landscape-tv/1280x720-question.png` vs `shift-question.png`

Report any structural mismatches; iterate CSS once if needed.

- [ ] **Step 4: Commit screenshots and any tweaks**

```bash
cd "/Users/akalkhamis/Movies/game test shaleh2/shift-game"
git add docs/screenshots/landscape-tv styles.css
git commit -m "test(shift): smoke-test screenshots for landscape sizes 844→1920"
```

---

### Task 6: Cleanup

**Files:**
- Delete: `styles.css.bak`, `index.html.bak`, `app.js.bak`

- [ ] **Step 1: Remove backups**

```bash
cd "/Users/akalkhamis/Movies/game test shaleh2/shift-game"
rm styles.css.bak index.html.bak app.js.bak
```

- [ ] **Step 2: Stop the dev server**

KillShell on the python http.server bash id from Task 1.

- [ ] **Step 3: Final commit**

```bash
cd "/Users/akalkhamis/Movies/game test shaleh2/shift-game"
git add -A
git commit -m "chore: remove redesign backups; landscape rework complete"
```

---

## Self-review

- **Spec coverage:** Layout system → Task 2. Setup mode toggle → Task 3 step 1, Task 4 step 2. Hub flow → Task 3 step 4 + Task 4 step 5. Stage flow → Task 3 step 4 + Task 4 step 5. Routing → Task 4 step 3. Post-award → Task 4 step 6. Verification → Task 5.
- **Placeholders:** None ("TBD"/"TODO" not present; every step has concrete code or commands).
- **Type consistency:** `boardMode`, `activeCategoryId`, `renderHub`, `renderStage`, `renderBoardChromeFor`, `renderBoardLifelinesFor`, `pick-category`, `back-hub` — names used identically across tasks.
- **Risk:** the `award()` patch in Task 4 step 6 references logic the writer hasn't seen verbatim. Implementer must locate the post-award nav site by searching `app.js` for `show("board")` calls inside award/reveal handlers. Acceptable — it's a localized search.
