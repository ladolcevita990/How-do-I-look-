# How Do I Look?

A virtual try-on web app. Upload a full-body photo of yourself, paste any product URL from any brand (Santoni, Aurelien, Suitsupply, you name it), and build complete head-to-toe outfits — clothing, shoes and accessories — to see how they look on you before you buy.

- **Realistic clothing try-on** — IDM-VTON (Replicate) or a free local PIL compositor for development.
- **Full outfits** — upper, lower, dresses, shoes, and accessories (sunglasses, hats, watches, belts) all in one composed image.
- **Any brand** — paste any product page URL and the scraper pulls the image, removes the background, and auto-classifies the category.
- **Saves on return** — a long-lived signed session cookie means your photo, saved garments, and outfits are still there the next time you open the app on the same browser. No login required.
- **Mobile first** — capture your photo with your phone camera and browse the catalog on the go.

## Stack

- **Backend:** FastAPI, SQLAlchemy (SQLite by default), MediaPipe, Pillow, rembg, Replicate client.
- **Frontend:** Next.js 16 (App Router), React 19, Tailwind 4, Zustand, react-webcam, react-dropzone, react-compare-slider.
- **Storage:** S3-compatible (MinIO in dev).

## Getting started

### Prerequisites

- Docker & Docker Compose
- (optional) Node 20+ and Python 3.11+ if you want to run services outside Docker.

### 1. Configure environment

```bash
cp .env.example .env
```

The defaults work out of the box with `TRYON_BACKEND=stub` — no paid API keys required. When you're ready for photoreal try-on, set `TRYON_BACKEND=replicate` and paste a token from https://replicate.com/account/api-tokens.

### 2. Start everything

```bash
docker compose up --build
```

This starts:
- `frontend` on http://localhost:3000
- `backend` on http://localhost:8000 (Swagger UI at `/docs`)
- `minio` on http://localhost:9000 (console on http://localhost:9001, `minioadmin` / `minioadmin`)

The backend auto-creates its SQLite DB under `./data/` and auto-creates the MinIO bucket on startup.

### 3. Smoke test

```bash
curl http://localhost:8000/api/health
# => {"status":"ok","version":"0.1.0"}
```

Then open http://localhost:3000 and walk through: upload a photo → paste a product URL → drag items into the outfit builder → tap **Try on**.

## Try-on backends

| `TRYON_BACKEND` | What it does                                                         | Cost       |
|-----------------|----------------------------------------------------------------------|------------|
| `stub`          | Local PIL compositor. Pose-anchored regions. Rough but instant.      | Free       |
| `replicate`     | IDM-VTON via Replicate. Photoreal results for clothing.              | ~$0.03/run |

Accessories (sunglasses, hats, watches, belts) and shoes always use a local MediaPipe-anchored overlay, independent of the backend setting.

## Architecture

```
frontend (Next.js)           backend (FastAPI)              storage
──────────────────           ──────────────────              ───────
/upload  ────────▶  POST /api/upload  ───▶ preprocessing ──▶ MinIO
/catalog ────────▶  POST /api/garments/preview
                    POST /api/garments/confirm ─▶ scraper ─▶ MinIO
/tryon   ────────▶  POST /api/outfit  ──▶ compositing   ──▶ MinIO
                                           └▶ tryon_engine (stub|replicate)
                                           └▶ accessory_overlay (MediaPipe)
/lookbook ───────▶  GET  /api/session/state
```

All user data is scoped by a signed HttpOnly `hdil_session` cookie (1 year lifetime). Deleting the cookie or clicking **Clear session** on `/lookbook` starts fresh.

## Development

Run services individually:

```bash
# backend
cd backend
pip install -e '.[dev]'
uvicorn app.main:app --reload

# frontend
cd frontend
npm install
npm run dev
```

Run tests:

```bash
cd backend && pytest
cd frontend && npm run build
```

## Deploying to the internet (Render + Vercel)

The app splits cleanly across two hosts:

- **Frontend** on Vercel — free, auto-deploys on every push.
- **Backend** on Render — runs the Docker image from `backend/Dockerfile`.

### 1. Push the repo to GitHub

The `main` branch (or whichever branch you want to deploy) needs to live on GitHub. Both Render and Vercel pick up from there.

### 2. Deploy the backend on Render

1. Sign in at <https://render.com> with GitHub.
2. Click **New +** → **Blueprint** and pick this repository. Render reads `render.yaml` and provisions a **Starter** web service with a 1 GB persistent disk mounted at `/app/data`.
3. After the first build, open the service → **Environment** and fill in:
   - `SESSION_COOKIE_SECRET` — any random 32+ character string (generate one with `openssl rand -hex 32`).
   - `FRONTEND_URL` — leave blank for now; you'll set it once Vercel gives you a URL.
   - `CORS_EXTRA_ORIGINS` — same as `FRONTEND_URL`.
4. Click **Manual Deploy** → **Clear build cache & deploy**. Wait for the service to go green.
5. Copy the backend URL Render assigns, e.g. `https://how-do-i-look-api.onrender.com`.

### 3. Deploy the frontend on Vercel

1. Sign in at <https://vercel.com> with GitHub.
2. Click **Add New** → **Project** and pick this repository.
3. Set **Root Directory** to `frontend`.
4. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_API_URL` = the Render URL from step 2.5 (e.g. `https://how-do-i-look-api.onrender.com`).
5. Click **Deploy**. Vercel will give you a URL like `https://how-do-i-look.vercel.app`.

### 4. Wire them together

Go back to Render → **Environment** and set both `FRONTEND_URL` and `CORS_EXTRA_ORIGINS` to your Vercel URL. Click **Save Changes** — Render redeploys automatically.

That's it. Open the Vercel URL on your phone and you should see the home page.

### Free-forever variant (optional)

If you want $0/month instead of ~$7/month, switch the Render plan to `free` (edit `render.yaml`) and use external free services for storage and database:

- **Cloudflare R2** for files — 10 GB free, S3-compatible. Set `STORAGE_BACKEND=s3` and point `S3_ENDPOINT_URL`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET_NAME` at R2.
- **Supabase Postgres** for the database — 500 MB free. Set `DATABASE_URL=postgresql://...` from your Supabase project.
- Delete the `disk:` block from `render.yaml`.

Trade-off: the free Render instance sleeps after 15 minutes of inactivity and takes ~30 seconds to wake up on the next request.
