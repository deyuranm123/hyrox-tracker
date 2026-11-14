# RŌXCOACH — Plan 1 Code Architecture Specification

> **Document Type:** Codebase & Software Architecture Review  
> **Target Audience:** Senior Full-Stack Engineers & Technical Review Agents (ChatGPT / Claude)  
> **Application:** RŌXCOACH (The HYROX Coaching Operating System)  
> **Repository:** `deyuranm123/hyrox-tracker` | **Branch:** `main`  
> **Production Deployment:** [https://hyrox-tracker-peach.vercel.app](https://hyrox-tracker-peach.vercel.app)  
> **Physical Storage:** `/Volumes/HIKSEMI/Antigravity Projects/hyrox-tracker`

---

## 1. System Overview & Technology Stack

```
┌────────────────────────────────────────────────────────┐
│                   NEXT.JS 14 APP ROUTER                │
│  (React 18, Pure CSS Design System, Client Components) │
└───────────────────────────┬────────────────────────────┘
                            │
               Supabase JS Client / Auth
                            │
┌───────────────────────────▼────────────────────────────┐
│              SUPABASE (POSTGRESQL 15 + RLS)            │
│  Profiles, Coach-Athlete Links, Sessions, Splits, RPCs │
└────────────────────────────────────────────────────────┘
```

* **Frontend Framework:** Next.js 14.2.24 (App Router)
* **Runtime:** Node.js v24.12 / React 18.3.1
* **Database & Auth:** Supabase (PostgreSQL 15 + Row-Level Security)
* **Styling Paradigm:** Zero-runtime pure CSS design system (`app/globals.css`), eliminating Tailwind build overhead and keeping initial bundle size $<88\text{ KB}$.
* **Data Fetching Pattern:** Reactive client hooks (`useProfile`) with direct Supabase session synchronization.

---

## 2. Complete File-by-File Code Architecture

### 2.1 File Manifest
```
hyrox-tracker/
├── app/
│   ├── globals.css           # Design tokens, layouts, KPI & scorecard styles
│   ├── layout.js             # Root HTML layout & RŌXCOACH SEO metadata
│   ├── page.js               # Auth landing & role-based redirection router
│   ├── athlete/
│   │   ├── page.js           # Athlete mobile dashboard & incoming coach alerts
│   │   └── log/page.js       # 16-leg split logger with live calculation & RPE
│   └── coach/
│       ├── page.js           # 5-Question Coach Command Centre & Roster Deltas
│       └── [id]/page.js      # 8-Station Scorecard, Running Analytics & Trends
├── components/
│   └── Header.js             # Brand navigation bar with role badge & sign-out
├── lib/
│   ├── format.js             # 16-leg definitions, time parsing & formatting
│   ├── performance.js        # Scorecard deltas, compromise pace, weakness engine
│   ├── supabase.js           # Build-safe Supabase JS client initialization
│   └── useProfile.js         # Client auth state & role gatekeeper hook
├── supabase/
│   └── schema.sql            # Full PostgreSQL DDL, triggers, and RLS policies
├── package.json              # Lightweight dependency declaration
└── next.config.js            # Next.js compiler configuration
```

---

### 2.2 Deep Dive: Core Library Modules (`lib/`)

#### 1. `lib/supabase.js` — Build-Safe Client Initialization
Prevents Next.js SSG/prerender build failures when environment variables are injected at deployment runtime:
```javascript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseKey);
```

#### 2. `lib/useProfile.js` — Role-Enforcing Auth Hook
Enforces strict client-side role isolation and prevents unauthenticated access:
```javascript
export function useProfile(requiredRole) {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) {
        router.replace('/');
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, full_name, email')
        .eq('id', user.id)
        .single();

      if (cancelled) return;
      if (error || !data) {
        setLoading(false);
        return;
      }
      // If user visits the wrong portal (e.g. coach on athlete page), redirect instantly
      if (requiredRole && data.role !== requiredRole) {
        router.replace(data.role === 'coach' ? '/coach' : '/athlete');
        return;
      }
      setProfile(data);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [router, requiredRole]);

  return { profile, loading };
}
```

#### 3. `lib/format.js` — HYROX 16-Leg Structure & Parsing
Defines the official race order (odd legs = 1km runs; even legs = stations):
* **`LEGS` array:** Generates 16 objects `{ leg: 1..16, isRun: boolean, label: string }`.
* **`formatSeconds(sec)`:** Converts integer seconds into `m:ss` or `h:mm:ss`.
* **`parseTime(input)`:** Robust parser supporting `m:ss`, `mm:ss`, `h:mm:ss`, and raw seconds; returns `null` for empty and `NaN` for invalid input.

#### 4. `lib/performance.js` — The Algorithmic Analytics Engine
Transforms raw database rows into high-value coaching intelligence:
* **`computeStationScorecard(currentSession, previousSession)`:**
  Extracts the 8 workout stations (SkiErg, Sled Push, Sled Pull, Burpee Broad Jump, Rowing, Farmers Carry, Sandbag Lunges, Wall Balls), compares times against previous session, and returns signed deltas (e.g. `−0:13 faster`).
* **`computeRunSplits(session)`:**
  Isolates the 8 running legs ($1, 3, 5, 7, 9, 11, 13, 15$), sums total 8km running duration, and calculates the compromised running pace (`formatSeconds(total / 8) + '/km'`).
* **`identifyStationWeakness(scorecard)`:**
  Detects which workout station caused the greatest time drain under race fatigue.

---

### 2.3 Deep Dive: Application Components & Routes (`app/`)

#### 1. Global Navigation (`components/Header.js`)
* Renders the brand logo: `<span className="brand-badge">RŌX</span><span>COACH</span>`.
* Displays the current role badge (`COACH` in Teal or `ATHLETE` in Gold).
* Clean sign-out handler calling `supabase.auth.signOut()`.

#### 2. Authentication Router (`app/page.js`)
* Checks active session on mount and performs zero-delay redirect to `/coach` or `/athlete`.
* Tabbed toggle between **Sign In** and **Create Account**.
* Account creation passes `full_name`, `name`, and `role` in `options.data` to satisfy the Supabase trigger.

#### 3. Coach Command Centre (`app/coach/page.js`)
* **5-Question KPI Ribbon:**
  - *Active Athletes* (count of accepted links)
  - *Attention Signals* (count of triggered alerts)
  - *Weekly Training Pace* (athletes with logged sessions this week)
  - *Race Readiness* status
* **Attention Required Engine:** Automatically iterates through the roster and flags:
  - Inactive athletes: `Date.now() - session_date >= 7 days`
  - Pending invitations awaiting athlete confirmation
  - Positive pace breakthroughs ($\Delta < 0$)
* **Roster Table with Deltas:** Calculates performance change between the athlete's most recent two simulations.
* **Add Athlete by Email:** Invokes security-definer RPC `request_athlete` with instant status feedback.

#### 4. Coach Athlete Detail View (`app/coach/[id]/page.js`)
* **Header KPI Cards:** Displays the athlete's all-time Personal Best and Total Simulations Count.
* **8-Station Scorecard Grid:** 8 visual cards displaying current time and comparison delta.
* **Running Engine Analytics Card:** Displays average run pace across all 8 laps.
* **Primary Focus Callout:** Flags the primary station bottleneck.
* **Progression Trend Table:** Chronological record of the last 5 simulations with per-session deltas.
* **Full 16-Leg Accordion:** Inspects every individual split time.

#### 5. Athlete Mobile Companion (`app/athlete/page.js`)
* **Incoming Coach Request Banner:** High-visibility notification allowing athletes to approve or decline coach access in one tap.
* **Performance Ribbon:** Personal Best and Simulation Count.
* **Quick Log CTA:** Prominent `+ Log New Workout` button.
* **Session History:** Accordion list showing running pace and split breakdown for every session.

#### 6. Mobile 16-Leg Workout Logger (`app/athlete/log/page.js`)
* **Session Configuration:** Date, simulation type (Training vs. Benchmark), and RPE scale (6 to 10).
* **Live Calculation Banner:** Recalculates Total Time, 8km Run Time, and Station Time on every keystroke without lag.
* **Validation & Storage:** Validates all 16 inputs before performing a sequential insert into `sessions` followed by `station_results`.

---

## 3. Database & Security Architecture (`supabase/schema.sql`)

### 3.1 PostgreSQL DDL Summary

```sql
-- Profiles table (extends auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  role text not null check (role in ('athlete', 'coach')),
  created_at timestamptz default now()
);

-- Coach-Athlete Relationships
create table public.coach_athletes (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz default now(),
  unique (coach_id, athlete_id)
);

-- Workout Sessions
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  session_date date not null default current_date,
  type text default 'training',
  total_time_sec integer not null,
  created_at timestamptz default now()
);

-- 16 Leg Splits per Session
create table public.station_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  leg integer not null check (leg between 1 and 16),
  time_sec integer not null,
  created_at timestamptz default now()
);
```

### 3.2 Row-Level Security (RLS) Implementation
1. **`profiles`:**
   - Users can read/update their own profile.
   - Users can view profiles of linked athletes/coaches in `coach_athletes` (enabling mutual visibility for pending requests).
2. **`coach_athletes`:**
   - Both parties can view existing links where `coach_id = auth.uid() OR athlete_id = auth.uid()`.
   - Only coaches can insert (`coach_id = auth.uid()`).
   - Only athletes can update status to accept/decline (`athlete_id = auth.uid()`).
3. **`sessions`:**
   - Athletes have full CRUD over their own sessions.
   - **Coaches have read access ONLY if link status is `accepted`**:
     ```sql
     create policy "Coaches see accepted athlete sessions"
       on public.sessions for select
       using (
         exists (
           select 1 from public.coach_athletes ca
           where ca.coach_id = auth.uid()
             and ca.athlete_id = sessions.athlete_id
             and ca.status = 'accepted'
         )
       );
     ```
4. **`station_results`:**
   - Accessible if the user owns the session OR if the user is an accepted coach of the session owner.

### 3.3 Stored Procedures & Triggers
* **`handle_new_user()` Trigger:** Fires `after insert on auth.users`. Correctly parses `full_name` (with fallback to `name`) and email, preventing column-not-found registration errors.
* **`request_athlete(p_email)` RPC:** Executes as `security definer`. Verifies caller is a coach, finds athlete by email, and inserts a pending request without leaking the user directory.

---

## 4. Key Architectural Patterns & Decisions

1. **Lightweight Pure CSS vs. Heavy Frameworks:**
   Built with native CSS variables in `app/globals.css`. Fast compile times, zero CSS-in-JS runtime overhead, and optimal mobile rendering on low-power devices.
2. **Asymmetric UX Design:**
   Desktop-focused command center for coaches ($1040\text{px}$ container, high-density data tables) vs. thumb-friendly mobile layout for athletes ($760\text{px}$ container, large touch targets).
3. **Zero-Lag Calculation:**
   Input parsing is decoupled from database storage. Split summation executes synchronously in React state as digits are typed.
4. **Build-Safe Prerendering:**
   Next.js 14 requires static route generation. The Supabase client includes dummy fallback keys to allow `next build` to generate static pages without requiring live database credentials during compilation.

---

## 5. Review Guidelines for ChatGPT & Claude

When reviewing this architecture, focus on:
1. **Frontend Scalability:** Is the client-side state model in `app/coach/[id]/page.js` sufficient as athlete session history grows, or should pagination/server components be introduced?
2. **Input Ergonomics:** Evaluate the upcoming auto-colon formatting (`430` $\rightarrow$ `4:30`) for the 16-leg split logger.
3. **Database Normalization:** Assess whether `type text` in `sessions` should be broken out into explicit `rpe` (integer) and `category` (enum) columns in Stage 2.
4. **Stage 2 Readiness:** Review schema extension paths for the Weekly Training Programme Builder (prescribed vs. completed sessions).
