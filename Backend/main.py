# Backend/main.py
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

import config
from routers import feedback, predict

BASE_DIR = Path(__file__).resolve().parent
DIST_DIR = BASE_DIR.parent / "Frontend" / "dist"   # npm run build er output

app = FastAPI(title="Paddy Check API")

# ---------- CORS (React dev server: http://localhost:5173) ----------
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- API ----------
@app.get("/api/health")
def health():
    return {"status": "ok"}

# KEEP: tomar router er ager moto include koro.
# Router file er bhitore prefix="/api" thakle ekhane prefix dio na.
# Na thakle prefix="/api" dao. (Frontend /api/predict ar /api/feedback e call kore.)
app.include_router(predict.router, prefix="/api")
app.include_router(feedback.router, prefix="/api")

# KEEP: tomar ager "similar images" serve kora mount thakle ekhane rakho, jemon:
# app.mount("/static", StaticFiles(directory=config.REFERENCE_IMAGES_DIR), name="static")
# Frontend similar leaf image URL ta backend theke nei (image_url), tai eta delete koro na.

# ---------- React site (production build) ----------
# Dev e (npm run dev) eta lagbe na; build korle automatically serve hobe.
if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        # /api/... ar upore register kora route age match hoy, tai ekhane pouchay na
        target = (DIST_DIR / full_path).resolve()
        if target.is_file() and target.is_relative_to(DIST_DIR.resolve()):
            return FileResponse(target)
        return FileResponse(DIST_DIR / "index.html")