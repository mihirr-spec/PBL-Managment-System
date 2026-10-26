# PACE: LinkedIn posting, demo-data cleanup and the new logo

Update of 26 October 2026. It covers direct LinkedIn posting of approved
achievements, the removal of all demo accounts and test data, and what is
still left to do.

---

## 1. Posting approved achievements to LinkedIn

### Before

Approved achievements had a LinkedIn *draft*: text written from the
achievement's template, with **Copy text** and **Open in LinkedIn**. That
button opened LinkedIn's share box in whatever account was signed in on that
browser. The portal used no LinkedIn account of its own and stored no
LinkedIn login.

### Now: one central LinkedIn account

Every approved achievement is posted from **one central LinkedIn account** for
the whole portal (for example, a dedicated "MUJ PBL" profile). Teachers never
see its ID or password.

**Supervisor** (`/faculty/achievements`):

1. Opens an achievement, picks **Approve** and optional bonus marks, then clicks
   **Preview LinkedIn post and approve**.
2. A **preview pops up inside the teacher portal**, drawn the way LinkedIn shows
   a post in the feed: the central account's name and photo, the text with "…more",
   blue hashtags, an optional proof image and the Like / Comment / Repost / Send bar.
3. Beside it they can adjust the text (up to 3,000 characters) and pick a proof
   image (JPG, PNG or GIF) or none.
4. **Approve and post to LinkedIn** approves the achievement and publishes the
   post in one click. **Approve without posting** only approves.
5. The achievement shows **On LinkedIn · View post**, its trail logs "posted it
   on LinkedIn", and the student gets a notification.

If the central account is not connected yet (or its connection has expired),
the supervisor can still approve, and the post can go out later.

**PBL office** (`/admin/achievements`, Excellence & LinkedIn):

- The **Portal LinkedIn account** card connects the central account. They click
  **Connect LinkedIn** and sign in **on LinkedIn's own page** with the central
  account's ID and password, so the password never passes through the portal.
- A LinkedIn connection lasts about 60 days. The card shows the days left
  (highlighted in the last week), with **Reconnect** and **Disconnect**.
- Any approved achievement that is not yet posted can be previewed and posted from here.

Students still get the copy-or-open draft to share their achievement themselves.

### One-time setup (needed before posting works)

1. Create an app at https://www.linkedin.com/developers/apps (it must be linked to a LinkedIn Page).
2. Under **Products**, add **Sign In with LinkedIn using OpenID Connect** and **Share on LinkedIn**.
3. Under **Auth → Authorized redirect URLs**, add:
   - `http://localhost:3000/linkedin/callback`
   - `https://<your-vercel-domain>/linkedin/callback`
4. Add the keys to `.env.local` and to the Vercel project's environment variables:

| Variable | Value |
| --- | --- |
| `LINKEDIN_CLIENT_ID` | the app's Client ID |
| `LINKEDIN_CLIENT_SECRET` | the app's Client Secret (server only, never sent to the browser) |
| `LINKEDIN_REDIRECT_URI` | optional, defaults to `<site>/linkedin/callback` |
| `LINKEDIN_API_VERSION` | optional `YYYYMM`, defaults to two months back |
| `LINKEDIN_TOKEN_KEY` | optional key that encrypts the stored token, defaults to one derived from the client secret |

5. The PBL office signs in to the portal, opens Excellence & LinkedIn, clicks
   **Connect LinkedIn** and signs in with the central account.

The central account is a LinkedIn *member* profile. Posting as an official
LinkedIn *Page* needs LinkedIn's Community Management API, which LinkedIn must
approve separately.

### How it is built

| Part | File |
| --- | --- |
| Preview pop-up (feed-style post, editor, approve and post) and the PBL office's account card | `src/components/achievements/linkedin-preview.tsx` |
| Where LinkedIn returns after sign-in | `src/app/linkedin/callback/page.tsx`, `src/components/achievements/linkedin-callback.tsx` |
| Start sign-in (PBL office only; returns LinkedIn's sign-in URL with a signed `state`) | `src/app/api/linkedin/connect/route.ts` |
| Finish sign-in (code → access token, encrypted and saved as the central account) | `src/app/api/linkedin/callback/route.ts` |
| Publish the post (optional image upload, then the post) | `src/app/api/linkedin/post/route.ts` |
| LinkedIn OAuth and API calls, token encryption, post-text escaping | `src/lib/linkedin/server.ts` |
| Browser helpers | `src/lib/data/repository.ts` (LinkedIn section) |
| Database | `supabase/migrations/20261026000002_linkedin_posting.sql`, `20261026000003_central_linkedin_account.sql` |

Database (already applied):

- `app_private.linkedin_account`: a single row for the central account (member id, name, photo,
  **encrypted** access token, expiry, who connected it and when). It cannot be read directly from
  the browser.
- `save_linkedin_account` and `disconnect_linkedin_account`: PBL office only.
- `linkedin_account()`: staff see the name, photo and expiry, never the token.
- `linkedin_credentials()`: used by the post route. It returns only the encrypted token, which is
  useless without the server's key.
- `public.achievements` gains `linkedin_post_urn`, `linkedin_posted_at` and `linkedin_posted_by`.
- `record_linkedin_post(achievement, urn)`: only the reviewing supervisor or the PBL office, only for
  approved achievements. Logs the event and notifies the student.

Security notes:

- No one in the portal ever types or sees the central account's password; sign-in happens on LinkedIn's site.
- The access token is encrypted with AES-256-GCM. The key exists only on the server.
- The client secret stays in the server route handlers.
- The route handlers act as the signed-in user, using their Supabase token, so row-level
  security still applies. No service-role key is needed.
- The OAuth `state` is HMAC-signed, tied to the PBL office user who started it, and expires after 10 minutes.
- An achievement can be posted only once. The image must be one of its own proof documents.

---

## 2. Removing old test data, with three fresh demo logins

### Done in the code

- Each sign-in tab has one demo button, for the three new demo logins below.
- README and `docs/PORTAL-GUIDE.md` list only these three.

### Database: waiting to be run

`supabase/migrations/20261026000001_remove_demo_data.sql` is written but **not yet
applied**. It removes:

- all 13 logins (students, teachers, PBL office test accounts) and their profiles
- all 21 students, 8 groups and their members, invitations and mentor requests
- weekly reports, queries, grades, notifications, announcements, achievements
- the 6 demo faculty rows
- the 8 uploaded files (submissions, announcements, achievements, avatars)
- the test-login shortcuts in the sign-up trigger (`app_private.test_accounts`)

It keeps the 821 MUJ faculty from the directory (their logins are cleared) and
the PBL office address in `app_private.admin_emails`.

Then it creates **three demo logins**, one per portal, set up by the normal sign-up rules:

| Portal | Email | Password |
| --- | --- | --- |
| Student | `demo.2400000001@muj.manipal.edu` | `pace@2026` |
| Teacher | `demo.teacher@jaipur.manipal.edu` | `pace@2026` |
| PBL office | `demo.admin@jaipur.manipal.edu` | `pace@2026` |

The demo student starts without a group, so the student dashboard shows the start-of-semester view.

To run it, paste the file into the Supabase SQL editor, or apply it as a migration.

**After it runs, only the three demo logins exist.** The real PBL office signs up as
`babita.kinha@jaipur.manipal.edu`. Teachers sign up with their own
`@jaipur.manipal.edu` address and students with `name.regno@muj.manipal.edu`.
Testing the LinkedIn flow end to end needs at least one real student and one real teacher account.

---

## 3. Documentation

- `README.md` has been rewritten for the portal as it stands: all three portals,
  environment variables, accounts, LinkedIn setup, architecture and what is still to do.
  It had still described the early student-only version.
- `docs/PORTAL-GUIDE.md`: section 9a describes LinkedIn posting, and the known gaps are updated.

---

## 4. New name and logo

The portal is now **PACE (Project Allocation, Coordination & Evaluation)**.

- The watercolour logo (dome and ribbon with the PACE lettering) replaces the old "PB" badge and "PBL"
  wordmark in the sidebar, the sign-in and sign-up screens and the landing page header.
- The logo was trimmed and given a transparent background, so it sits cleanly on the frosted sidebar:
  `public/brand/pace-logo.webp` / `.png`.
- A square emblem (dome and ribbon, without lettering) is `public/brand/pace-emblem.webp` / `.png`.
  It is also the browser-tab icon (`src/app/icon.png`).
- Page titles read "… · PACE", and page eyebrows read "PACE · …".
- "PBL office" and "PBL form" keep their names: they are the university's office and form.

---

## 5. Still to do

- [ ] Run the demo-data cleanup migration (section 2).
- [ ] Create the central LinkedIn profile and the LinkedIn app; add the app's keys locally and on Vercel (section 1).
- [ ] PBL office connects the central account from Excellence & LinkedIn.
- [ ] Do a first real approve-and-post to confirm the whole flow.
- [ ] Teachers sign up. None of the 821 faculty has a login yet.
- [ ] University single sign-on and "Forgot password" (both still show a *later release* message).
- [ ] Posting as an official LinkedIn Page instead of a member profile (needs Community Management API approval).
- [ ] Analytics: project health score, at-risk detection, progress prediction.
- [ ] GitHub reports the repository moved to `git@github.com:mihirr-spec/PBL-Managment-System.git`;
      update the remote with `git remote set-url origin <new address>`.
