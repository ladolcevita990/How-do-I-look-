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
