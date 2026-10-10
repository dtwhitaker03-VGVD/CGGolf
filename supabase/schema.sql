-- CGGolf shared/multiplayer schema.
--
-- Run this once in your Supabase project's SQL Editor (Database > SQL Editor > New query).
-- Safe to re-run: every statement is guarded with "if not exists" / "or replace" / drop-then-create.
--
-- Safe to run in the SAME Supabase project as CGDisc: every table, function, trigger and
-- policy here is prefixed golf_ / on_auth_user_created_golf, and nothing existing is
-- modified. Signed-up accounts are shared between the two apps; each app keeps its own
-- players, so a friend who signs in to both gets a player row in each.
--
-- Trust model: this app is meant for a small group of friends who all trust each other,
-- not a public multi-tenant app. Any signed-in user can read and write all shared data
-- (courses, players, rounds, scores) -- there's no per-user data isolation beyond requiring
-- login. That's what makes "add a friend, track everyone's rounds together" work without
-- a lot of sharing/invite machinery.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One row per person who can appear in a round: either a real signed-in account
-- (user_id set, auto-created on signup, see trigger below) or a "guest" player
-- added by name only (user_id null) for a friend who doesn't want to make an account.
create table if not exists public.golf_players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null unique,
  name text not null,
  color text not null default '#15803d',
  -- Handicap index to use until the app can calculate one from logged rounds
  -- (needs 3+ complete, rated 18-hole rounds). E.g. the number on a GHIN card.
  starting_index numeric,
  created_at timestamptz not null default now()
);

alter table public.golf_players
  add column if not exists starting_index numeric;

create table if not exists public.golf_courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  -- [{ "number": 1, "par": 4, "strokeIndex": 7, "strokeIndexW": 9 }, ...]
  -- strokeIndex = the scorecard's "Handicap" row: 1 = hardest hole .. 18 = easiest.
  holes jsonb not null,
  -- [{ "name": "White", "color": "#e5e7eb", "rating": 68.7, "slope": 127,
  --    "useWomenIndex": false, "yards": [338, 488, ...] }, ...]
  -- rating/slope are optional: a tee without them is "unrated" and rounds
  -- played from it don't count toward a handicap index.
  tees jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.golf_rounds (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.golf_courses (id) on delete cascade,
  -- Null for rounds imported from a paper scorecard that had no date written on it.
  date date,
  -- Which holes were played: the full 18, or just one nine.
  holes_played text not null default 'all' check (holes_played in ('all', 'front', 'back')),
  -- LEGACY: superseded by mode + scoring below (kept so older databases don't need a destructive migration).
  format text not null default 'gross' check (format in ('gross', 'net', 'stableford')),
  notes text,
  created_by uuid references public.golf_players (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.golf_rounds alter column date drop not null;

-- Round type and scoring. Added after the first release, so these are alter statements
-- (safe to re-run) rather than part of the create table above.
--   mode:     'straight' (everyone scratch), 'handicap' (strokes by hole), 'team'
--   scoring:  'strokes', 'holes' (match play: most holes won), 'stableford' (handicap rounds)
--   team_*:   team rounds -- playerId -> team index, scramble / bestBall / teamTotal, and whether
--             handicap strokes apply to best ball / team total
--   dropped_players: playerId -> holes played before leaving early
alter table public.golf_rounds
  add column if not exists mode text not null default 'straight' check (mode in ('straight', 'handicap', 'team')),
  add column if not exists scoring text not null default 'strokes' check (scoring in ('strokes', 'holes', 'stableford')),
  add column if not exists team_assignments jsonb,
  add column if not exists team_game_type text check (team_game_type in ('scramble', 'bestBall', 'teamTotal')),
  add column if not exists team_handicap boolean not null default false,
  add column if not exists dropped_players jsonb;

update public.golf_rounds set mode = 'handicap' where format in ('net', 'stableford') and mode = 'straight';
update public.golf_rounds set scoring = 'stableford' where format = 'stableford' and scoring = 'strokes';

-- One row per player per round. strokes = gross score per hole played, in hole
-- order. setup = that player's tee/rating/slope/playing handicap, locked in at
-- round start so later edits to a course or index never rewrite old rounds:
--   { "tee": "White", "rating": 68.7, "slope": 127, "useWomenIndex": false,
--     "playingHandicap": 12 }   (playingHandicap null = no index yet, plays scratch)
create table if not exists public.golf_round_scores (
  round_id uuid not null references public.golf_rounds (id) on delete cascade,
  player_id uuid not null references public.golf_players (id) on delete cascade,
  strokes jsonb not null,
  setup jsonb not null,
  primary key (round_id, player_id)
);

-- ---------------------------------------------------------------------------
-- OPTIONAL: auto-create (or claim) a player row whenever someone signs up.
-- The app also does this itself on first sign-in (ensureSelfPlayer), so if creating
-- a trigger on auth.users is blocked or hangs in your project, skip this block.
-- ---------------------------------------------------------------------------

-- If a guest player (added by name only, before they had an account) already
-- exists with this exact name, claim that row instead of creating a
-- duplicate -- this is how "add a friend by name" reconciles with them
-- later signing up for their own account, preserving their round history.
create or replace function public.golf_handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_name text := coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1));
  existing_guest_id uuid;
begin
  select id into existing_guest_id
  from public.golf_players
  where user_id is null
    and lower(trim(name)) = lower(trim(new_name))
  order by created_at
  limit 1;

  if existing_guest_id is not null then
    update public.golf_players set user_id = new.id where id = existing_guest_id;
  else
    insert into public.golf_players (user_id, name) values (new.id, new_name);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_golf on auth.users;
create trigger on_auth_user_created_golf
  after insert on auth.users
  for each row execute procedure public.golf_handle_new_user();

-- Existing accounts (e.g. CGDisc users who signed up before this schema was
-- installed) get a golf player row too. Safe to re-run.
insert into public.golf_players (user_id, name)
select u.id, coalesce(u.raw_user_meta_data ->> 'display_name', split_part(u.email, '@', 1))
from auth.users u
where not exists (select 1 from public.golf_players p where p.user_id = u.id);

-- ---------------------------------------------------------------------------
-- Row Level Security: any signed-in user can read/write all shared data
-- ---------------------------------------------------------------------------

alter table public.golf_players enable row level security;
alter table public.golf_courses enable row level security;
alter table public.golf_rounds enable row level security;
alter table public.golf_round_scores enable row level security;

-- Note: this app does not use Supabase anonymous sign-ins, so `to authenticated`
-- alone (no per-row ownership check) is sufficient to mean "any real signed-in
-- user of this app" -- matching the shared-trust model described above.

drop policy if exists "golf read players" on public.golf_players;
create policy "golf read players" on public.golf_players for select
  to authenticated using (true);

drop policy if exists "golf write players" on public.golf_players;
create policy "golf write players" on public.golf_players for all
  to authenticated using (true) with check (true);

drop policy if exists "golf read courses" on public.golf_courses;
create policy "golf read courses" on public.golf_courses for select
  to authenticated using (true);

drop policy if exists "golf write courses" on public.golf_courses;
create policy "golf write courses" on public.golf_courses for all
  to authenticated using (true) with check (true);

drop policy if exists "golf read rounds" on public.golf_rounds;
create policy "golf read rounds" on public.golf_rounds for select
  to authenticated using (true);

drop policy if exists "golf write rounds" on public.golf_rounds;
create policy "golf write rounds" on public.golf_rounds for all
  to authenticated using (true) with check (true);

drop policy if exists "golf read round_scores" on public.golf_round_scores;
create policy "golf read round_scores" on public.golf_round_scores for select
  to authenticated using (true);

drop policy if exists "golf write round_scores" on public.golf_round_scores;
create policy "golf write round_scores" on public.golf_round_scores for all
  to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Realtime: push live changes to every connected device
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['golf_players', 'golf_courses', 'golf_rounds', 'golf_round_scores'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Seed the two local courses (safe to re-run; skips a course whose name
-- already exists, so edits you make in the app are never overwritten)
-- ---------------------------------------------------------------------------

-- Cape Girardeau Country Club -- from its printed scorecard (men's par 70; ladies' par
-- differs on a few holes, which the app doesn't model, so Red/Pink use the men's par).
-- Sources: Bent Creek -- GolfPass scorecard (tee ratings/slopes, hole
-- yardages, men's and women's stroke indexes). Cape Jaycee -- City of Cape
-- Girardeau scorecard PDF for yardages, stroke indexes and tee ratings (these
-- match the printed paper scorecard: White 67.6/118, Gold 63.2/103, Red
-- 65.7/107; the city's web page lists older numbers). Fix anything that
-- differs in the app (Courses > course > Edit).
insert into public.golf_courses (name, location, holes, tees)
select * from (values
  (
    'Bent Creek Golf Course',
    'Jackson, MO',
    '[{"number":1,"par":4,"strokeIndex":1,"strokeIndexW":1},{"number":2,"par":5,"strokeIndex":9,"strokeIndexW":5},{"number":3,"par":4,"strokeIndex":15,"strokeIndexW":13},{"number":4,"par":3,"strokeIndex":7,"strokeIndexW":9},{"number":5,"par":4,"strokeIndex":3,"strokeIndexW":3},{"number":6,"par":3,"strokeIndex":13,"strokeIndexW":17},{"number":7,"par":4,"strokeIndex":11,"strokeIndexW":7},{"number":8,"par":5,"strokeIndex":5,"strokeIndexW":11},{"number":9,"par":4,"strokeIndex":17,"strokeIndexW":15},{"number":10,"par":4,"strokeIndex":16,"strokeIndexW":16},{"number":11,"par":4,"strokeIndex":6,"strokeIndexW":6},{"number":12,"par":5,"strokeIndex":4,"strokeIndexW":2},{"number":13,"par":4,"strokeIndex":10,"strokeIndexW":12},{"number":14,"par":5,"strokeIndex":2,"strokeIndexW":4},{"number":15,"par":3,"strokeIndex":14,"strokeIndexW":14},{"number":16,"par":4,"strokeIndex":12,"strokeIndexW":10},{"number":17,"par":3,"strokeIndex":18,"strokeIndexW":18},{"number":18,"par":4,"strokeIndex":8,"strokeIndexW":8}]'::jsonb,
    '[{"name":"Black","color":"#111827","rating":73.2,"slope":132,"yards":[416,520,320,215,363,196,349,537,315,361,428,582,450,496,192,396,187,362]},{"name":"Blue","color":"#2563eb","rating":71.5,"slope":129,"yards":[396,502,306,194,347,190,332,488,307,341,351,560,362,467,171,369,183,349]},{"name":"White","color":"#e5e7eb","rating":68.7,"slope":127,"yards":[338,488,285,187,336,172,326,475,299,321,337,549,350,423,161,347,163,311]},{"name":"Green","color":"#16a34a","rating":65.5,"slope":115,"yards":[318,428,244,164,294,152,284,377,240,306,270,463,314,413,142,290,123,292]},{"name":"Red","color":"#dc2626","rating":66.8,"slope":116,"useWomenIndex":true,"yards":[260,419,238,160,228,121,215,368,235,257,267,399,253,377,126,255,119,216]}]'::jsonb
  ),
  (
    'Cape Jaycee Municipal Golf Course',
    'Cape Girardeau, MO',
    '[{"number":1,"par":4,"strokeIndex":5,"strokeIndexW":3},{"number":2,"par":5,"strokeIndex":7,"strokeIndexW":7},{"number":3,"par":3,"strokeIndex":15,"strokeIndexW":13},{"number":4,"par":4,"strokeIndex":17,"strokeIndexW":9},{"number":5,"par":4,"strokeIndex":1,"strokeIndexW":1},{"number":6,"par":3,"strokeIndex":11,"strokeIndexW":15},{"number":7,"par":4,"strokeIndex":9,"strokeIndexW":5},{"number":8,"par":3,"strokeIndex":13,"strokeIndexW":17},{"number":9,"par":4,"strokeIndex":3,"strokeIndexW":11},{"number":10,"par":4,"strokeIndex":10,"strokeIndexW":12},{"number":11,"par":5,"strokeIndex":8,"strokeIndexW":10},{"number":12,"par":3,"strokeIndex":12,"strokeIndexW":14},{"number":13,"par":4,"strokeIndex":18,"strokeIndexW":16},{"number":14,"par":4,"strokeIndex":16,"strokeIndexW":8},{"number":15,"par":5,"strokeIndex":4,"strokeIndexW":2},{"number":16,"par":4,"strokeIndex":6,"strokeIndexW":6},{"number":17,"par":4,"strokeIndex":2,"strokeIndexW":4},{"number":18,"par":3,"strokeIndex":14,"strokeIndexW":18}]'::jsonb,
    '[{"name":"White","color":"#e5e7eb","rating":67.6,"slope":118,"yards":[339,552,147,321,334,211,282,185,388,301,425,169,298,288,558,392,396,183]},{"name":"Gold","color":"#eab308","rating":63.2,"slope":103,"yards":[322,405,137,290,328,175,271,158,300,207,350,125,283,120,472,318,375,123]},{"name":"Red","color":"#dc2626","rating":65.7,"slope":107,"useWomenIndex":true,"yards":[306,381,132,255,312,167,261,134,296,207,345,120,197,218,405,260,334,118]}]'::jsonb
  ),
  (
    'Cape Girardeau Country Club',
    'Cape Girardeau, MO',
    '[{"number":1,"par":4,"strokeIndex":7,"strokeIndexW":5},{"number":2,"par":3,"strokeIndex":13,"strokeIndexW":15},{"number":3,"par":4,"strokeIndex":5,"strokeIndexW":9},{"number":4,"par":5,"strokeIndex":9,"strokeIndexW":7},{"number":5,"par":4,"strokeIndex":11,"strokeIndexW":11},{"number":6,"par":3,"strokeIndex":15,"strokeIndexW":13},{"number":7,"par":4,"strokeIndex":3,"strokeIndexW":3},{"number":8,"par":3,"strokeIndex":17,"strokeIndexW":17},{"number":9,"par":5,"strokeIndex":1,"strokeIndexW":1},{"number":10,"par":4,"strokeIndex":12,"strokeIndexW":10},{"number":11,"par":3,"strokeIndex":16,"strokeIndexW":18},{"number":12,"par":4,"strokeIndex":2,"strokeIndexW":4},{"number":13,"par":3,"strokeIndex":18,"strokeIndexW":16},{"number":14,"par":4,"strokeIndex":8,"strokeIndexW":8},{"number":15,"par":5,"strokeIndex":10,"strokeIndexW":12},{"number":16,"par":3,"strokeIndex":14,"strokeIndexW":14},{"number":17,"par":4,"strokeIndex":4,"strokeIndexW":6},{"number":18,"par":5,"strokeIndex":6,"strokeIndexW":2}]'::jsonb,
    '[{"name":"Blue","color":"#2563eb","rating":70.6,"slope":126,"yards":[395,185,410,490,385,155,415,145,570,390,155,440,145,440,500,208,465,560]},{"name":"White","color":"#e5e7eb","rating":68.1,"slope":123,"yards":[370,160,365,475,360,135,395,130,535,375,135,430,140,385,485,180,370,490]},{"name":"Gold","color":"#eab308","rating":65.6,"slope":110,"yards":[310,150,330,420,325,125,340,120,450,310,105,378,135,375,385,165,315,470]},{"name":"Red","color":"#dc2626","rating":69.1,"slope":120,"useWomenIndex":true,"yards":[315,130,320,405,315,115,335,95,445,300,100,420,130,425,260,160,310,440]},{"name":"Pink","color":"#ec4899","rating":67.3,"slope":115,"useWomenIndex":true,"yards":[315,130,320,405,315,115,256,95,400,229,100,370,130,385,260,160,310,395]}]'::jsonb
  )
) as seed(name, location, holes, tees)
where not exists (
  select 1 from public.golf_courses c where c.name = seed.name
);
