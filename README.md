# CGGolf

A mobile-first golf tracking app for friends, built from the CGDisc disc golf app.
Log rounds, keep a handicap index, and compare scores gross, net, or Stableford.

Pre-loaded courses (hole-by-hole pars, hole handicaps, tee yardages, rating/slope):

- **Bent Creek Golf Course** — Jackson, MO (par 72; Black/Blue/White/Green/Red tees)
- **Cape Jaycee Municipal Golf Course** — Cape Girardeau, MO (par 70; White/Gold/Red tees)

Course ratings are published inconsistently across sites. Check them against the paper
scorecard and fix anything off in the app (Courses → course → Edit).

## Features

- Accounts shared across phones via Supabase, plus guest players added by name.
- **Courses** — scorecard per tee; add/edit courses, tees, rating/slope, hole handicaps.
- **New round** — course, 18 / front 9 / back 9, scoring format (gross, net, Stableford),
  players, each player's tee and handicap index. Hole-by-hole scoring with live standings;
  an in-progress round survives a refresh.
- **Handicaps** — strokes allocated by hole handicap rank; a World Handicap System-style index
  (differentials, net-double-bogey cap, best-of-20) from complete 18-hole rounds on rated tees.
  Enter a *starting index* per friend until they have 3 rounds.
- Per-player and per-course stats; installable as a PWA.

See the in-app "How handicaps work" page for the formulas and how this differs from an official GHIN index.

## Setup

1. Create a **new** Supabase project (don't reuse the CGDisc one).
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor (safe to re-run; seeds both courses).
3. Copy `.env.example` to `.env` and fill in the project URL and anon key.
4. Optionally turn off "Confirm email" in Supabase Auth for a friends-only setup.

```bash
npm install
npm run dev
npm run build
```

`.github/workflows/deploy.yml` deploys to GitHub Pages on push to `main`; it reads
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` available at build time.
