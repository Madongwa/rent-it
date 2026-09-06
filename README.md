# Rent It

A peer-to-peer equipment rental marketplace — rent out or borrow farming
tools, construction equipment, and household/DIY tools.

- **Home page** — pick a category: Farming, Construction, or Household & DIY
- **Marketplace** — browse, search and filter listings
- **Listing detail** — view an item and request to rent it for a date range
- **List an Item** — post your own equipment for rent (requires login)
- **Dashboard** — manage your listings, your rental requests, and incoming
  requests on your items (approve/reject)

## Stack

- **Frontend:** React + Vite + Tailwind CSS + React Router
- **Backend:** Node.js + Express
- **Database / Auth:** [Supabase](https://supabase.com) (Postgres + Auth)

The backend talks to Supabase with the **service role key** and enforces all
authorization itself (ownership checks on listings/rentals). The frontend
talks to Supabase directly only for **auth** (sign up / log in) using the
public **anon key**, then calls the backend API for everything else.

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** in your project and run the contents of
   [`backend/schema.sql`](backend/schema.sql). This creates the `profiles`,
   `categories`, `listings`, and `rentals` tables, seeds the 3 categories,
   and sets up Row Level Security policies.
3. Go to **Project Settings → API** and copy:
   - Project URL
   - `anon` `public` key
   - `service_role` `secret` key (keep this one private)

## 2. Configure environment variables

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Fill in `backend/.env`:

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Fill in `frontend/.env`:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 3. Install and run

In two terminals:

```bash
# Terminal 1 - backend (http://localhost:4000)
cd backend
npm install
npm run dev

# Terminal 2 - frontend (http://localhost:5173)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — pick a category, browse the marketplace, sign
up, and list an item.

## Deploying (Vercel)

Both halves of the app deploy to Vercel, as two separate projects pointed at
this same GitHub repo:

1. **Backend** — new Vercel project, Root Directory = `backend`. It deploys
   as a serverless function (`backend/api/index.js` wraps the same Express
   app used locally; `backend/vercel.json` routes all paths to it). Add the
   same env vars as `backend/.env` (`SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, and `CLIENT_ORIGIN` set to your frontend's
   Vercel URL).
2. **Frontend** — new Vercel project, Root Directory = `frontend`. Framework
   preset "Vite". Add the same env vars as `frontend/.env`
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_API_URL` set to
   your backend project's Vercel URL + `/api`).

Every `git push` to `main` auto-redeploys both.

## Project structure

```
backend/
  server.js              Local dev entry point (imports src/app.js, calls listen())
  vercel.json             Routes all paths to the serverless function below
  api/index.js            Vercel serverless entry point (same Express app, no listen())
  schema.sql             Run this in Supabase's SQL editor
  src/
    app.js                  The Express app itself (routes, middleware, cors)
    lib/supabaseClient.js  Server-side Supabase client (service role key)
    middleware/auth.js     Verifies Supabase JWT from the frontend
    routes/                categories, listings, rentals, profiles

frontend/
  src/
    lib/supabaseClient.js  Browser Supabase client (anon key) — used for auth
    lib/api.js              Fetch wrapper that calls the backend, attaching
                             the user's Supabase access token
    context/AuthContext.jsx React context exposing user/session + auth actions
    pages/                  Home, Marketplace, ListingDetail, ListItem,
                             Dashboard, Login, Signup
    components/             Navbar, CategoryCard, ListingCard, ProtectedRoute
```

## Possible next steps

- Image uploads via Supabase Storage instead of pasting an image URL
- In-app messaging between renter and owner
- Payments (e.g. Stripe Connect) for the rental transaction itself
- Reviews/ratings after a completed rental
