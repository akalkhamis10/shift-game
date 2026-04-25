# Deploying SHIFT Game

**Production**

- Game: https://akalkhamis10.github.io/shift-game/
- Admin: https://akalkhamis10.github.io/shift-game/admin.html
- Repo: https://github.com/akalkhamis10/shift-game
- Backend: Supabase project `vpemuntrgfqettjbqkbn`

---

## To push code changes

```bash
git push origin main
```

GitHub Pages rebuilds and redeploys in 1–2 minutes. No build step — the repo IS the deploy. Your changes are live as soon as the Pages action finishes (visible in the repo's "Actions" tab).

If your push prompts for credentials and you don't have any cached, see "Reauthorizing the push" below.

## To push a tagged release

```bash
git tag -a v1.x -m "what changed"
git push origin --tags
```

Tags appear in the GitHub repo's "Releases" sidebar.

## To edit content (questions, categories, sections, media)

You don't push code — go to the live admin:

https://akalkhamis10.github.io/shift-game/admin.html

Sign in with `director83ak@gmail.com`, click the magic link emailed to you, and use the three tabs (Sections / Categories / Questions). Edits hit Supabase directly and are visible in the deployed game on next page load. No redeploy required.

## To add an admin

In the Supabase SQL editor (https://supabase.com/dashboard/project/vpemuntrgfqettjbqkbn/sql/new):

```sql
insert into admins (email, role) values ('teammate@example.com', 'editor');
```

They then sign in with their email at the admin URL above. They'll get a magic link in their inbox.

## To remove an admin

```sql
delete from admins where email = 'ex-teammate@example.com';
```

Their existing session keeps working until they sign out or the JWT expires (default ~1 hour). They lose dashboard access on next sign-in attempt.

## Reauthorizing the push

If `git push` complains about authentication:

1. Generate a Personal Access Token at https://github.com/settings/tokens
   - "Generate new token (classic)"
   - Scope: `repo`
   - Expiration: as long as you want
2. When `git push` prompts for username, type `akalkhamis10`. For password, paste the token.
3. macOS Keychain saves it automatically; subsequent pushes won't prompt.

## When magic-link emails stop working

Supabase's free tier allows ~3-4 magic-link emails per hour. If you hit the limit:

- Wait an hour for the rate limit to reset, OR
- Connect a real email provider in Supabase: Authentication → Emails → SMTP Settings.
  Resend's free tier handles thousands per month and takes ~5 minutes to set up.

## Adding a custom domain

1. In repo Settings → Pages → Custom domain, enter your domain.
2. At your domain registrar, add a CNAME record from your subdomain (e.g. `play`) to `akalkhamis10.github.io.` (with the trailing dot).
3. Wait up to 24 hours for DNS to propagate, then check "Enforce HTTPS".
4. Add the new URL(s) to Supabase Auth → URL Configuration → Redirect URLs and update the Site URL.

---

## What's where

| Concern | Lives in |
|---|---|
| Game UI | `index.html`, `app.js`, `styles.css` |
| Admin UI | `admin.html`, `admin.js`, `admin.css` |
| Shared Supabase client + helpers | `lib/supabase.js` |
| Game's content loader (Supabase → legacy shape) | `lib/content.js` |
| Static fallback questions (used if Supabase unreachable) | `data.js` |
| Database schema, RLS, storage policies | `tools/*.sql` |
| One-off migration script (already run) | `tools/migrate.html` + `tools/migrate.js` |
| Phase plans | `docs/superpowers/plans/` |
| Verification screenshots | `docs/screenshots/` |
