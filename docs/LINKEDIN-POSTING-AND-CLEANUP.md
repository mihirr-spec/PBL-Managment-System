# LinkedIn posting and demo-data cleanup

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

### Now

1. A supervisor approves an achievement at `/faculty/achievements`.
2. A **preview pops up inside the teacher portal**, drawn the way LinkedIn shows a
   post in the feed: the poster's name and photo, the text with "…more",
   blue hashtags, an optional proof image and the Like / Comment / Repost / Send bar.
3. Beside the preview the supervisor can edit the text (up to 3,000 characters)
   and pick a proof image (JPG, PNG or GIF) or none.
4. **Post to LinkedIn** publishes it straight to the supervisor's LinkedIn feed.
5. The achievement then shows **On LinkedIn · View post**, its trail logs
   "posted it on LinkedIn", and the student gets a notification.

The PBL office can preview and post any approved achievement the same way
from **Excellence & LinkedIn** (`/admin/achievements`). Students still get the
copy-or-open draft to share it themselves.

### Whose account posts

Each poster uses **their own** LinkedIn account. They click **Connect LinkedIn**
once and sign in on LinkedIn's own page (OAuth). The portal never sees a LinkedIn
password. A connection lasts about 60 days, after which the preview asks
them to connect again. They can disconnect at any time from the preview.

Posts go out from personal profiles. Posting as the university's LinkedIn Page
needs LinkedIn's Community Management API, which LinkedIn must approve separately.

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

Until the keys are set, **Connect LinkedIn** shows a message saying LinkedIn
posting is not set up yet.

### How it is built

| Part | File |
| --- | --- |
| Preview pop-up (feed-style post, editor, connect / post) | `src/components/achievements/linkedin-preview.tsx` |
| Where LinkedIn returns after sign-in | `src/app/linkedin/callback/page.tsx`, `src/components/achievements/linkedin-callback.tsx` |
| Start sign-in (returns LinkedIn's sign-in URL with a signed `state`) | `src/app/api/linkedin/connect/route.ts` |
| Finish sign-in (code → access token, saved for the user) | `src/app/api/linkedin/callback/route.ts` |
| Publish the post (optional image upload, then the post) | `src/app/api/linkedin/post/route.ts` |
| LinkedIn OAuth and API calls, post-text escaping | `src/lib/linkedin/server.ts` |
| Browser helpers | `src/lib/data/repository.ts` (LinkedIn section) |
| Database | `supabase/migrations/20261026000002_linkedin_posting.sql` |

Database changes (already applied):

- `public.linkedin_accounts`: one row per connected user (member id, name,
  photo, access token, expiry). Row-level security lets only the owner read or change it.
- `public.achievements` gains `linkedin_post_urn`, `linkedin_posted_at` and `linkedin_posted_by`.
- `public.record_linkedin_post(achievement, urn)`: only the reviewing supervisor
  or the PBL office, only for approved achievements. Logs the event and notifies the student.

Security notes:

- The client secret stays in the server route handlers.
- The route handlers act as the signed-in user, using their Supabase token, so row-level
  security still applies. No service-role key is needed.
- The OAuth `state` is HMAC-signed, tied to the user who started it, and expires after 10 minutes.
- An achievement can be posted only once. The image must be one of its own proof documents.

---

## 2. Removing demo accounts and test data

### Done in the code

- The "Try a demo" buttons are gone from the sign-in page.
- README and `docs/PORTAL-GUIDE.md` no longer list demo logins.

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

To run it, paste the file into the Supabase SQL editor, or apply it as a migration.

**After it runs there are no logins at all.** The PBL office signs up as
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

## 4. Still to do

- [ ] Run the demo-data cleanup migration (section 2).
- [ ] Create the LinkedIn app and add its keys locally and on Vercel (section 1).
- [ ] Do a first real post to confirm the whole flow.
- [ ] Teachers sign up. None of the 821 faculty has a login yet.
- [ ] University single sign-on and "Forgot password" (both still show a *later release* message).
- [ ] Posting as the university LinkedIn Page (needs Community Management API approval).
- [ ] Analytics: project health score, at-risk detection, progress prediction.
- [ ] GitHub reports the repository moved to `git@github.com:mihirr-spec/PBL-Managment-System.git`;
      update the remote with `git remote set-url origin <new address>`.
