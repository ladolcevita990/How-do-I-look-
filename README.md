# How Do I Look?

A virtual try-on web app. Upload one full-body photo of yourself, paste any product URL from any brand (Santoni, Aurelien, Suitsupply, you name it), and build complete head-to-toe outfits — clothing, shoes and accessories — to see how they look on you before you buy.

- **Full head-to-toe outfits** — upper, lower, dresses, shoes, and accessories (sunglasses, hats, watches, belts, ties, scarves) composed into one image.
- **Any brand** — paste any product page URL and the scraper pulls the image, removes the background, and auto-classifies the category.
- **Saves on return** — a per-device session id in `localStorage` means your photo, closet, and saved outfits are still there the next time you open the app on the same browser. No account, no login.
- **Mobile first** — capture your photo with your phone camera and browse the catalog on the go.
- **$0/month to host** — the whole thing runs on Vercel's hobby tier plus Supabase's free plan.

## Stack

- **Next.js 16** (App Router, React 19, Tailwind 4)
- **Zustand** for client state, **SWR** for optimistic loads
- **Supabase** — Postgres for photos / garments / outfits, Storage for images
- **@imgly/background-removal** — runs in the browser, no server needed
- **HTML Canvas** — outfits are composited client-side from fixed pose anchors

There is no backend. Two Next.js Route Handlers (`/api/scrape` and `/api/scrape/image`) exist solely to dodge browser CORS when fetching product pages and images from arbitrary brand websites.

## Quick start

### 1. Create a Supabase project

1. Sign in at <https://supabase.com> and click **New project**. Pick any region and set a strong database password — you won't need it again.
2. Once the project is up, open **SQL Editor**, click **New query**, paste the contents of [`frontend/supabase-schema.sql`](frontend/supabase-schema.sql), and click **Run**. This creates the `photos`, `garments`, `outfits`, and `outfit_items` tables, enables row-level security with permissive policies, and creates the public `hdil` storage bucket.
3. Open **Settings → API**. Copy the **Project URL** and the **anon public** key.

### 2. Configure the frontend

```bash
cp frontend/.env.example frontend/.env.local
# then edit frontend/.env.local and paste the two Supabase values
```

### 3. Run it

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:3000> and walk through: upload a photo → paste a product URL → drag items into the outfit builder → tap **Try on**.

The first background removal triggers a one-time ~40 MB model download (cached in IndexedDB afterwards).

## Deploying to the internet (Vercel + Supabase)

The app is one Next.js project — deploy it anywhere that runs Next 16. Vercel is the easiest path:

1. Push this repo to GitHub.
2. Sign in at <https://vercel.com> and click **Add New → Project**. Pick this repository.
3. Set **Root Directory** to `frontend`.
4. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL` — from Supabase → Settings → API
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase → Settings → API
5. Click **Deploy**.

That's it. Vercel gives you a URL like `https://how-do-i-look.vercel.app`. Open it on your phone. Cost: **$0/month** forever, as long as you stay inside Vercel's hobby limits and Supabase's free tier (500 MB Postgres + 1 GB storage).

## Architecture

```
 browser                                      Supabase
 ───────                                      ────────
 /upload          ──── uploadPhoto() ─────▶  photos table + hdil/sessions/<id>/photos/
 /catalog         ──── /api/scrape ───────▶  (server fetch to brand page)
                  ──── /api/scrape/image ─▶  (server fetch to brand CDN)
                  ──── background-removal ─── (on-device ONNX model)
                  ──── confirmGarment() ──▶  garments table + hdil/sessions/<id>/garments/
 /tryon           ──── composeOutfit() ────  (HTML canvas, in memory)
                  ──── saveOutfit() ──────▶  outfits / outfit_items tables + hdil/sessions/<id>/outfits/
 /lookbook        ──── getSessionState() ─▶  selects photos / garments / outfits by session_id
 /o/[shareId]     ──── getSharedOutfit() ─▶  selects outfits by share_id
```

Every row is keyed by a `session_id` uuid the browser stores in `localStorage`. There are no accounts. Security comes from the session uuid being unguessable — Supabase RLS allows anonymous reads and writes on all four tables because the app has no server to authorize against.

Clearing the session wipes the rows and the storage objects for that uuid, then generates a new one.

## Development

```bash
cd frontend
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run lint
```

Useful files:

- [`frontend/src/lib/api.ts`](frontend/src/lib/api.ts) — all data access and try-on orchestration
- [`frontend/src/lib/tryon/composite.ts`](frontend/src/lib/tryon/composite.ts) — the canvas compositor
- [`frontend/src/lib/tryon/pose.ts`](frontend/src/lib/tryon/pose.ts) — heuristic pose anchors
- [`frontend/src/lib/tryon/bgremove.ts`](frontend/src/lib/tryon/bgremove.ts) — @imgly/background-removal wrapper
- [`frontend/src/app/api/scrape/route.ts`](frontend/src/app/api/scrape/route.ts) — URL → og:image / JSON-LD scraper
- [`frontend/supabase-schema.sql`](frontend/supabase-schema.sql) — Supabase schema + RLS policies

## Roadmap

- Replace heuristic pose anchors with MediaPipe Web so arbitrary poses work
- Swap the canvas compositor for a photoreal model (IDM-VTON via Replicate) when a user opts in
- WebGPU acceleration for background removal on supported devices
