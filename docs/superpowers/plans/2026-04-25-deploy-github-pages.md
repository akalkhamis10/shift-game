# Deploy SHIFT Game to GitHub Pages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the working SHIFT game (currently only reachable on `127.0.0.1:5500` from the developer's laptop) and put it on a public URL so friends, family, and admins-from-other-devices can use it. After this deploys, both the game and the admin dashboard live at `https://<your-github-username>.github.io/<repo-name>/`.

**Why GitHub Pages:** zero cost, zero servers, zero build pipeline. The repo is already a static HTML/JS/CSS site — it's exactly what Pages was designed for. Vercel/Netlify also work; pick one.

**Architecture (after deploy):**

```
GitHub repo (origin)
   └─ pushes from this laptop
       │
       ▼
GitHub Pages (CDN, HTTPS)  ←  served at https://akalkhamis10.github.io/<repo>/
       │
   game ─┬─ index.html  ──┐
         └─ admin.html  ──┤
                          ▼
              Supabase (database, auth, storage)  — already live
```

Nothing else changes. The Supabase project, the data, the admins table — all of that stays exactly as it is. The only Supabase-side change is adding the new public URL to the Auth "Redirect URLs" allowlist, otherwise magic links would be rejected after deploy.

**Tech Stack:** Same vanilla HTML/JS/CSS. No build step. Same Supabase project (`vpemuntrgfqettjbqkbn`).

**Spec reference:** [docs/superpowers/specs/2026-04-25-admin-dashboard-design.md](../specs/2026-04-25-admin-dashboard-design.md) §4 — "Hosting: GitHub Pages (or any static host)".

**Depends on:** `v0.5-phase5` tag must be in place. Working tree must be clean.

---

## Pre-flight: things you need before starting

1. **A GitHub account.** If you don't have one, create one at https://github.com/signup. Free tier is fine.
2. **A decision on repo name.** Suggest `shift-game`. Keep it lowercase, hyphenated.
3. **A decision on visibility.** Public repos get free GitHub Pages forever. Private repos also get free Pages on personal accounts now, but expose less code to the internet. Public is simpler — and safe in our case because the anon key is meant to be in client code (RLS protects writes). You can flip from public to private later without losing the URL.

---

## Task 1: Tidy the working tree before publishing

**Files:** untracked screenshots in the repo root.

The repo currently has a few PNG screenshots from testing (e.g. `phase4-categories-tab.png`) that aren't tracked. Decide whether to delete them or commit them under `docs/`. Don't ship a public repo with random untracked files.

- [ ] **Step 1: List untracked files**

```bash
cd /Users/akalkhamis/Movies/game\ test\ shaleh2/shift-game
git status -s
```

Expected: a list of `?? phase*-...png` and `?? phase3-signed-out.png` files.

- [ ] **Step 2: Move them under `docs/screenshots/` (or delete)**

Recommended — keep them as documentation:

```bash
mkdir -p docs/screenshots
git mv-style 2>/dev/null || true   # noop helper
mv phase*.png docs/screenshots/ 2>/dev/null
git add docs/screenshots/
git commit -m "docs: archive Phase 3-5 verification screenshots"
```

If you'd rather just delete them:

```bash
rm phase*.png
```

(Nothing is committed yet, so `rm` is enough — no `git rm` needed.)

- [ ] **Step 3: Confirm clean tree**

```bash
git status
```

Expected: `nothing to commit, working tree clean`.

---

## Task 2: Create the GitHub repository

**Files:** none (browser steps).

- [ ] **Step 1: Create an empty repo on GitHub**

Open https://github.com/new and fill:

- **Repository name:** `shift-game`
- **Description:** `Arabic team-based trivia game with Supabase backend`
- **Visibility:** Public (recommended — see Pre-flight #3) or Private.
- **Do NOT** check "Add a README", "Add .gitignore", or "Add license" — we already have a tracked codebase, and pre-creating those files makes the first push need a `git pull --rebase`.
- Click **Create repository**.

GitHub now shows a "quick setup" page with a URL like `https://github.com/akalkhamis10/shift-game.git`. Copy it.

- [ ] **Step 2: Confirm the URL**

It will be one of:

- HTTPS form: `https://github.com/akalkhamis10/shift-game.git`
- SSH form: `git@github.com:akalkhamis10/shift-game.git`

Use HTTPS unless you've already set up SSH keys for GitHub on this machine. HTTPS will prompt for credentials on first push (use a Personal Access Token instead of password — GitHub's web UI walks you through generating one if you don't have one yet).

---

## Task 3: Wire the local repo to the GitHub remote and push

**Files:** none (git operations).

- [ ] **Step 1: Check there isn't already a remote**

```bash
cd /Users/akalkhamis/Movies/game\ test\ shaleh2/shift-game
git remote -v
```

Expected: empty output. If there's already a remote called `origin`, skip Step 2 and use `git remote set-url origin <new-url>` instead.

- [ ] **Step 2: Add the remote**

Replace `akalkhamis10` with your actual GitHub username:

```bash
git remote add origin https://github.com/akalkhamis10/shift-game.git
git remote -v
```

Expected: two lines (fetch + push) pointing at your repo.

- [ ] **Step 3: Push everything — main branch and tags**

```bash
git push -u origin main
git push origin --tags
```

The first command may prompt for username + password. For password, paste a Personal Access Token (not your GitHub password — those don't work for git operations anymore).

If you've never made a Personal Access Token: https://github.com/settings/tokens → "Generate new token (classic)" → scope `repo` → copy the token. Save it in your password manager; you'll need it again.

Expected: both commands succeed and you see all five tags (`v0.1-phase1` through `v0.5-phase5`) listed.

- [ ] **Step 4: Verify on GitHub**

Refresh the GitHub repo page. You should see all the project files, the README-less root, and a "Releases" section in the right sidebar showing your tags.

---

## Task 4: Enable GitHub Pages

**Files:** none (GitHub web UI).

- [ ] **Step 1: Open repository settings**

On the repo page, click **Settings** (top tab) → in the left sidebar, click **Pages**.

- [ ] **Step 2: Configure source**

Under "Build and deployment":

- **Source:** "Deploy from a branch"
- **Branch:** `main` / `(root)`
- Click **Save**.

GitHub now starts a Pages build. The status shows "Your site is live at `https://akalkhamis10.github.io/shift-game/`" usually within 1–2 minutes (sometimes longer on first publish).

- [ ] **Step 3: Wait for the build to finish, then visit the URL**

Open `https://akalkhamis10.github.io/shift-game/` in a fresh tab.

Expected: the SHIFT landing page renders (logo, "ابدأ لعبة جديدة" button, etc.).

- If you see a 404 — Pages is still building. Wait 60 seconds and refresh.
- If you see a blank page or a Jekyll error — most likely a `_config.yml` from some template you didn't create. Add an empty `.nojekyll` file to the repo root:
  ```bash
  touch .nojekyll
  git add .nojekyll
  git commit -m "chore: disable Jekyll on GitHub Pages"
  git push
  ```

- [ ] **Step 4: Sanity — game loads from Pages**

In the deployed game's JS console:

```js
window.SHIFT_DATA?.CATEGORIES?.length
```

Expected: `18`. And the console should show `[shift] loaded 18 categories from Supabase`. If you see "falling back to data.js bundle", Supabase isn't reachable from the new origin — most likely a CORS/Auth issue. Continue to Task 5; that fixes it.

---

## Task 5: Add the Pages URL to Supabase's Auth allowlist

**Why this matters:** When an admin requests a magic link, Supabase sends an email containing a redirect URL. Supabase only redirects to URLs on its **Redirect URLs** allowlist. By default it only includes `http://localhost:3000` (and similar). The Pages URL needs to be added or admin sign-in will fail with `invalid redirect URL` after the redirect.

**Files:** none (Supabase dashboard).

- [ ] **Step 1: Open Auth URL configuration**

Go to https://supabase.com/dashboard/project/vpemuntrgfqettjbqkbn/auth/url-configuration

- [ ] **Step 2: Update Site URL**

Set **Site URL** to your Pages URL (no trailing slash):

```
https://akalkhamis10.github.io/shift-game
```

This is the default destination for any auth redirect that doesn't specify one explicitly.

- [ ] **Step 3: Add the deployed admin URL to Redirect URLs**

In the **Redirect URLs** section, add (one per line):

```
https://akalkhamis10.github.io/shift-game/admin.html
https://akalkhamis10.github.io/shift-game/index.html
http://127.0.0.1:5500/admin.html
http://127.0.0.1:5500/index.html
```

The last two keep your local-development sign-in working. Don't remove them — you'll still want to test things on `127.0.0.1` before pushing.

Click **Save**.

- [ ] **Step 4: Sanity — local admin still works**

Open `http://127.0.0.1:5500/admin.html`. You should still be signed in (existing session). If you're signed out, send yourself a magic link, click it — should land back on local admin authorized.

If your session was cleared, that's a side-effect of changing the Site URL — not a problem. Just sign in again.

---

## Task 6: Test the deployed admin end-to-end

**Files:** none.

- [ ] **Step 1: Open the deployed admin in an incognito window**

```
https://akalkhamis10.github.io/shift-game/admin.html
```

(Incognito so we're guaranteed not to inherit any old session.)

Expected: the sign-in card.

- [ ] **Step 2: Sign in**

Type `director83ak@gmail.com`, click "أرسل رابط الدخول". Wait for the email. Click the magic link.

The link should redirect to `https://akalkhamis10.github.io/shift-game/admin.html#access_token=…`. The page should briefly show "جاري التحقق..." then settle on the **authorized** dashboard with your email in the topbar.

If you get a Supabase error page saying "Invalid redirect URL" — Task 5 wasn't applied. Re-check the allowlist exactly.

If sign-in succeeds but the page lands on **not-authorized** — your email isn't in `admins`. That's a different bug; double-check `select * from admins;` in the SQL editor.

- [ ] **Step 3: Smoke-test all three tabs**

Click through Sections / Categories / Questions. Tables should populate (7 / 18 / 108 rows). No console errors. Don't need to do CRUD again — that was verified in Phase 4 already; we just need the tabs to render and read data.

- [ ] **Step 4: Sign out and confirm**

Click "تسجيل خروج". Card flips to sign-in. Now you can go back to the regular browser window.

---

## Task 7: Test the deployed game end-to-end

**Files:** none.

- [ ] **Step 1: Open the deployed game**

```
https://akalkhamis10.github.io/shift-game/index.html
```

(Or just the bare `https://akalkhamis10.github.io/shift-game/` — Pages serves `index.html` by default.)

Expected: brief boot overlay, then the landing page. Console: `[shift] loaded 18 categories from Supabase`.

- [ ] **Step 2: Play one round on a phone or another device**

Open the URL on your phone (over LTE/cellular, not WiFi — that proves it's actually public). Pick categories, play through one question. The point of this is to confirm friends and family will also see exactly what you see.

- [ ] **Step 3: Test the live-edit promise**

On your laptop, in the deployed admin, edit one question's answer text — append " ✓" or similar. Save.

On your phone, refresh the deployed game, navigate to that question, reveal the answer. The new text should be there.

This proves the property we discussed: edits are live, no redeploy needed.

---

## Task 8: Optional — set up a custom domain

**Files:** `CNAME` (only if doing this).

If you own a domain like `shiftgame.com` you can serve the game from it instead of `akalkhamis10.github.io/shift-game/`.

- [ ] **Step 1: Add the domain in GitHub Pages settings**

Settings → Pages → Custom domain → enter your domain → Save. GitHub creates a `CNAME` file in the repo automatically.

- [ ] **Step 2: Configure DNS at your domain registrar**

Add a `CNAME` record for the subdomain (e.g. `play`) pointing to `akalkhamis10.github.io.` (with the trailing dot if your registrar allows it).

For an apex domain (`shiftgame.com` not `play.shiftgame.com`), follow GitHub's docs — you need 4 `A` records to GitHub's IPs. https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site

- [ ] **Step 3: Wait for DNS to propagate (up to 24h)**

Then re-do Task 5 — add `https://your-domain.com/admin.html` and `https://your-domain.com/index.html` to the Supabase Redirect URLs allowlist, and update the Site URL.

- [ ] **Step 4: Enable HTTPS**

Settings → Pages → check "Enforce HTTPS" once available (GitHub auto-provisions a Let's Encrypt cert in 5–30 min).

If you skip this task entirely, the `akalkhamis10.github.io` URL keeps working forever — custom domains are pure polish.

---

## Task 9: Document the deploy workflow for future updates

**Files:** `docs/DEPLOY.md`.

So future-you (and any contributor) doesn't have to re-figure out how to push changes to production.

- [ ] **Step 1: Create `docs/DEPLOY.md`**

```markdown
# Deploying SHIFT Game

Production: https://akalkhamis10.github.io/shift-game/

## To push code changes

```bash
git push origin main
```

GitHub Pages rebuilds and redeploys in 1–2 minutes. No build step needed —
the repo IS the deploy.

## To push a tagged release

```bash
git tag -a v0.6 -m "what changed"
git push origin --tags
```

Tags are visible in the GitHub repo's "Releases" section.

## To edit content (questions, categories, sections, media)

You don't push code — go to the live admin:

https://akalkhamis10.github.io/shift-game/admin.html

Edits hit Supabase directly and are visible in the game on next load.
No redeploy needed.

## To add an admin

In the Supabase SQL editor:

```sql
insert into admins (email, role) values ('teammate@example.com', 'editor');
```

They then sign in with their email at the admin URL above.

## To remove an admin

```sql
delete from admins where email = 'ex-teammate@example.com';
```

Their existing session still works until they sign out or the JWT expires
(default ~1 hour). They lose all dashboard access on next sign-in attempt.
```

- [ ] **Step 2: Commit**

```bash
git add docs/DEPLOY.md
git commit -m "docs: add DEPLOY.md for future deploys"
git push
```

---

## Task 10: Final tag

**Files:** none.

- [ ] **Step 1: Tag the deployed release**

```bash
git tag -a v1.0-deployed -m "v1.0: deployed to GitHub Pages"
git push origin --tags
```

- [ ] **Step 2: Success criteria**

✓ Public URL works for both `index.html` and `admin.html`.
✓ Magic-link sign-in flows on the deployed admin.
✓ Game loads questions from Supabase (console logs the success).
✓ Editing a question in the deployed admin shows up in the deployed game on refresh.
✓ Game playable on a phone over cellular.
✓ Local development on `127.0.0.1:5500` still works for both pages.
✓ `docs/DEPLOY.md` exists and is committed.

---

## What's NOT in this plan

- **Custom email provider for magic links** (Resend / SendGrid / etc.). Supabase's default is rate-limited; once real admins are signing in often enough to hit it, swap in a real provider in `Auth → Emails → SMTP Settings`. Untouched here because most teams won't need it.
- **Phase 6 polish** (search, drag-to-reorder, friendlier confirm modals, suppress-button-after-send). The current admin is fully functional without these.
- **Multi-environment setup** (staging vs. production). The whole project is one Supabase project, one GitHub repo. If you ever need a staging copy, fork the Supabase project and have a `staging` branch + matching GH Pages site — but that's a different conversation.
- **Analytics, error reporting, uptime monitoring.** Static sites on GitHub Pages have ~99.9% uptime out of the box; for personal use this is fine. Plug in Plausible / Umami / GA only if you want to know how often the game is played.
