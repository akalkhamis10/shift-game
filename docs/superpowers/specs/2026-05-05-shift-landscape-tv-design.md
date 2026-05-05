# SHIFT — Landscape-first redesign for TV mirroring

**Date:** 2026-05-05
**Status:** Approved (sections 1–6)
**Author:** akalkhamis (with Claude)

## Goal

Make SHIFT a perfect fit for a phone held in landscape and mirrored to a TV. Audience watches the TV; the host taps the phone. Add an alternate "Hub → Stage → Question" board flow alongside the current all-in-one board, selectable from setup.

## Non-goals

- Portrait support (deferred — game ignores portrait, host is expected to rotate)
- Functional bug fixes beyond layout (none reported)
- Build pipeline / framework migration (stays vanilla)
- Screen mirroring tooling itself (AirPlay/HDMI is system-handled)

## Constraints

- Vanilla HTML/CSS/JS, no build step (existing repo convention)
- Arabic RTL preserved
- Existing data layer (Supabase + fallback `data.js`) unchanged
- All gameplay screens must fit in `100dvw × 100dvh` with **zero scroll**
- Design baseline: 844 × 390 (iPhone 14 landscape) minimum; scales to 1920 × 1080 (TV)

## Architecture

### Layout system

- Body globals: `overflow: hidden`, `touch-action: manipulation`, `padding: env(safe-area-inset-*)` on a single root viewport container.
- All screens are `<section data-screen>` siblings; only one is visible (`hidden` attribute toggled by `app.js#show()`). This stays.
- Fluid scale on `:root`:
  ```css
  --u: clamp(4px, 0.9vh, 9px);
  --fs-body: clamp(14px, 2.4vh, 22px);
  --fs-h:    clamp(20px, 4.5vh, 48px);
  --fs-mega: clamp(40px, 9vh, 96px);
  ```
  Scaling on `vh` because in landscape the height is the constraining axis.
- `body.no-scroll` extended to all gameplay screens (setup, categories, board, hub, stage, question). Landing and results allow scroll only as a fallback for tiny viewports.

### State additions (`app.js`)

```js
boardMode: "all",        // "all" | "hub"
activeCategoryId: null,  // hub→stage→question selection in mode "hub"
```

`state.board` (flat array of 36 cells) is unchanged. Hub and Stage are pure views over the same data.

### Routing

- Setup screen: 2-radio toggle "نمط اللوح: كل الفئات على لوح واحد | فئة واحدة في كل مرة" sets `boardMode`.
- `go-board` action: routes to `show("board")` if mode "all", `show("hub")` if mode "hub".
- New actions: `pick-category` (hub → stage), `back-hub` (stage → hub). Cell tap on Stage reuses the existing `openQuestion(cellIndex)`.
- After award in Mode B, return to Hub (not Board).

## Per-screen layouts

### Landing
Two-column landscape. Left 55% = logo, title, tagline, primary button, meta strip. Right 45% = decorative gradient/SHIFT mark. Fits at 600 × 340.

### Setup
Three-column landscape:
- Col 1: game-name input, mode toggle, auto-split `<details>`
- Col 2: Team 1 card (name + lifelines)
- Col 3: Team 2 card (name + lifelines)
Primary button "اختر الفئات" pinned bottom.

### Categories
Topbar (back, counter, primary). Body = 6 cols × 2 rows of category cards, each with emoji + name. Tap toggles selection (max 6). Internal scroll on the grid only if categories overflow; page does not scroll.

### Board (Mode A, polished)
- Topbar: ✕  T2name+score  SHIFT  T1score+name  ↶
- Body: 3 cols × 2 rows of category cards. Each card: emoji + name + 6 mini cells (3×2: 200/400/600 ×2). Used cells fade + strike-through but stay visible.
- Footer: T1 lifelines | turn pill | T2 lifelines

### Hub (Mode B, new)
Same chrome as Board. Body = 6 large category cards (3×2). Each card: large emoji, name, 6 progress dots (filled = used). Whole card is the tap target → Stage. Fully-used categories show ✓ and become non-tappable.

### Stage (Mode B, new)
Three-column body mirroring `shift-stage.png`:
- Left col: turn-team's 3 cells stacked (200, 400, 600)
- Center: large category card (emoji + name)
- Right col: opposing team's 3 cells stacked
- Topbar back-arrow returns to Hub. Used cells dimmed.

### Question
Two-column body:
- Left 60%: timer (compact, top of card), question text at `--fs-mega`, media (toggleable if it would overflow), answer slides up below on reveal
- Right 40%: T1 lifelines / T2 lifelines stacked, then 4 control buttons (start timer, reset, pass, reveal)
- Award row: fixed bottom bar, only shown when `answerRevealed === true` (replaces the controls visually so it gets focus on TV)

### Results
Single screen: small SHIFT logo top-center, "انتهت اللعبة" + winner line, side-by-side team scores with center separator, primary "العب مرة أخرى" + ghost "الصفحة الرئيسية".

## File changes

| File | Change |
|---|---|
| `index.html` | Add `<section data-screen="hub">` and `<section data-screen="stage">`; add mode-toggle radio in `setup` |
| `styles.css` | Full landscape-first rewrite (drops portrait cascade) |
| `app.js` | Add `boardMode`, `activeCategoryId`; new render functions `renderHub()`, `renderStage()`; route `pick-category`, `back-hub`; modify `go-board` and award flow |
| `data.js`, `lib/*` | Untouched |

## Risks & mitigations

- **Lifelines bar overflow at 600 px wide** → wrap to 2 rows in tight breakpoints (verify in smoke-test).
- **Question text + media + answer simultaneous overflow** → media is hidden behind a toggle when computed height would exceed viewport.
- **Portrait users** → out of scope per user decision; layout will be ugly in portrait but functional. Optional follow-up: add a rotate hint.

## Testing

Headless browser (Playwright) walkthrough at:
- 844 × 390 (iPhone 14 landscape)
- 932 × 430 (iPhone 14 Pro Max landscape)
- 1280 × 720 (TV scaled)
- 1920 × 1080 (full TV)

Per size: landing → setup (toggle each mode) → categories → board (Mode A) → question → back; setup → categories → hub (Mode B) → stage → question → back-hub → results. Capture screenshots; verify no `scrollbar` appears.

## Out of scope (future)

- Portrait rotation hint
- LocalStorage persistence of `boardMode`
- Per-team lifeline customization in Hub mode
- Score animation polish on award
