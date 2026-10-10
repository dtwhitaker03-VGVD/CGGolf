# CGGolf

A mobile-first golf tracking app for friends, built from the CGDisc disc golf app.
Log rounds, keep a handicap index, and compare scores gross, net, or Stableford.

Pre-loaded courses (hole-by-hole pars, hole handicaps, tee yardages, rating/slope):

- **Bent Creek Golf Course** — Jackson, MO (par 72; Black/Blue/White/Green/Red tees)
- **Cape Jaycee Municipal Golf Course** — Cape Girardeau, MO (par 70; White/Gold/Red tees)
- **Cape Girardeau Country Club** — Cape Girardeau, MO (par 70; Blue/White/Gold/Red/Pink tees)
- **Kimberland Country Club** — Jackson, MO (par 72; Black/Blue/B-W Combo/White/W-R Combo/Red tees)

Cape Jaycee's ratings match its printed scorecard (White 67.6/118). Bent Creek's come from GolfPass —
check them against the paper scorecard and fix anything off in the app (Courses → course → Edit).

## Features

- Accounts shared across phones via Supabase, plus guest players added by name.
- **Courses** — scorecard per tee; add/edit courses, tees, rating/slope, hole handicaps.
- **New round** — course, 18 / front 9 / back 9, players, each player's tee and handicap index, then a
  round type like CGDisc: **Straight up**, **Handicapped** (strokes by hole handicap) or **Team**
  (Scramble, Best ball, Team total — best ball/team total can use handicap strokes), scored **by strokes**,
  **by holes** (match play), or Stableford (handicapped). Hole-by-hole scoring with a live leaderboard,
  **honors** (lowest score on the last hole goes first; net in handicapped rounds), and "Left early".
  An in-progress round survives a refresh.
- **Handicaps** — strokes allocated by hole handicap rank; a World Handicap System-style index
  (differentials, net-double-bogey cap, best-of-20) from complete 18-hole rounds on rated tees.
  Enter a *starting index* per friend until they have 3 rounds.
- Per-player and per-course stats; installable as a PWA.

See the in-app "How handicaps work" page for the formulas and how this differs from an official GHIN index.

## Setup

1. Use a Supabase project — it can be the same one CGDisc uses (all tables are prefixed `golf_` and nothing existing is touched; accounts are shared between the apps).
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor (safe to re-run; seeds both courses).
3. `.env` already points at the shared project; for a different one, copy `.env.example`.
4. Optionally turn off "Confirm email" in Supabase Auth for a friends-only setup.

```bash
npm install
npm run dev
npm run build
```

`.github/workflows/deploy.yml` deploys to GitHub Pages on push to `main`. The committed `.env`
holds only the public Supabase URL and publishable key.
