# Hyrox Tracker (MVP)

Athletes log their Hyrox sessions. Coaches see the sessions of athletes who accept them.

## What it does
- Athletes: sign up, log a session (8 stations + 8 runs, timed), see past sessions, accept or decline coach requests.
- Coaches: sign up, request an athlete by email, see the roster and each athlete's totals and trend.
- Security: row-level security in Postgres. A coach sees an athlete's sessions only after the athlete accepts.

## One-time setup (no installs needed)

1. **Supabase**
   - Create a free project at supabase.com.
   - Open SQL Editor, paste the whole of `supabase/schema.sql`, and run it.
   - Go to Project Settings > API and copy the Project URL and the `anon` public key.
2. **Vercel**
   - Push this folder to a GitHub repo.
   - In Vercel, click Add New > Project, pick the repo, and add two environment variables:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Click Deploy. You get a link like `hyrox-tracker.vercel.app`.
3. **Supabase auth settings:** under Authentication > URL Configuration, set the Site URL to your Vercel link. Otherwise email confirmation links point to localhost.

Never put the `service_role` key in this app.

## Run locally (optional, for developers)
```
cp .env.example .env.local   # then fill in the two values
npm install
npm run dev                  # open http://localhost:3000
```

## Not in the MVP (on purpose)
Wearables, training plans, payments, AI, mobile app, weight and reps entry, and charts beyond a simple totals table.
