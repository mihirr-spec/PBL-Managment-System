# PBL Management Platform

A university platform for managing the complete Project-Based Learning lifecycle
for students, faculty coordinators and PBL supervisors.

**This repository currently contains Version 1 - the Student Portal.**

---

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

**Demo account**

| Field | Value |
| --- | --- |
| Email | `mihir.2427010544@muj.manipal.edu` |
| Password | `pbl@2026` |

New accounts sign up at `/signup` with a university email (students `@muj.manipal.edu`,
teachers `@jaipur.manipal.edu`) and verify it from the emailed link. See `docs/PORTAL-GUIDE.md`.

---

## What V1 ships

| Route | Page |
| --- | --- |
| `/` | Landing page |
| `/login` | Authentication |
| `/student/dashboard` | Identity, project summary, deadlines, pending submissions, announcements, quick actions |
| `/student/profile` | Personal (editable), academic (read-only), mentor details, photo upload, password |
| `/student/project` | Project record, team, progress, faculty |
| `/student/deadlines` | All submissions with status filters and countdowns |
| `/student/announcements` | Notices with priority filters and attachments |
| `/student/notifications` | Notification feed with read state |
| `/student/settings` | Password change, account details, sign out |

---

## Architecture

```
src/
  app/
    page.tsx                  Landing page
    login/                    Authentication
    student/                  Student route group (V1)
      layout.tsx              → <PortalShell role="student">
      dashboard/ profile/ project/ deadlines/
      announcements/ notifications/ settings/
    faculty/                  V2    - add layout.tsx with role="faculty"
    supervisor/               V2.5  - add layout.tsx with role="supervisor"

  components/
    layout/                   Shell, sidebar, topbar, nav config, brand
    ui/                       Card, Badge, Button, Progress, Avatar, Field, Skeleton
    auth/ dashboard/ profile/ project/ deadlines/ notifications/

  lib/
    types.ts                  Domain model
    auth/session.tsx          Session context + role → home-route map
    data/
      seed.ts                 In-memory records (the only place data lives)
      repository.ts           Async data-access boundary
      portal-store.tsx        Loads the student's data, exposes mutations
    utils.ts                  Dates, countdowns, formatting
```

### Three seams that keep the roadmap cheap

**1. Role-based routing.** `PortalShell` takes a `role`, guards the route and
renders the chrome. Adding the Faculty portal is a new `src/app/faculty/layout.tsx`
containing `<PortalShell role="faculty">`, plus its entry in `NAV_BY_ROLE`.

**2. A single data boundary.** No component imports `seed.ts`. Everything goes
through `repository.ts`, whose functions are already async. Swapping to Prisma,
Supabase or a REST API means rewriting those function bodies and nothing else.

**3. A forward-looking schema.** `types.ts` defines the entities V1 needs
(`users`, `students`, `faculty`, `projects`, `teams`, `deadlines`,
`announcements`, `notifications`) with the foreign keys that
`weekly_progress`, `certificates`, `marks` and `evaluations` will hang off.

---

## Design

The palette is sampled from `public/coverpage.webp` - ivory and warm sand
surfaces, muted gold from the dome as the accent, soft stone for text. Status
colours (clay, sage, sky, plum) are kept muted so they read as information
rather than decoration. Type is Inter for the interface and Fraunces for
display headings.

All tokens live in the `@theme` block at the top of `src/app/globals.css`.

---

## Known limits of V1

- Data is in memory. Profile edits and submissions persist for the session;
  a reload restores the seed. Only the signed-in user survives (localStorage).
- File uploads are not implemented. "Mark as submitted" records the
  declaration; attachments arrive with weekly progress reporting in V1.1.
- Faculty and Supervisor sign-in is refused with an explanatory message.

---

## Roadmap

| Release | Scope |
| --- | --- |
| **V1** | Student portal - auth, dashboard, profile, project, deadlines, announcements, notifications |
| **V1.1** | Coordinator selection, team management, weekly progress submission, evidence uploads, faculty feedback |
| **V2** | Faculty portal - student management, progress review, certificate verification, evaluation, marks |
| **V2.5** | Supervisor - student allocation, faculty management, project monitoring, reports |
| **V3** | Project health score, at-risk detection, progress prediction, analytics |
