from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import config
from routers import predict

app = FastAPI(title="Paddy Check API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predict.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}


# Serves each file in REFERENCE_GALLERY_DIR at
# /static/reference/<filename> — this is what similar_images'
# image_url values point to. Must be mounted BEFORE the catch-all
# frontend mount below, or that mount would shadow it.
config.REFERENCE_GALLERY_DIR.mkdir(parents=True, exist_ok=True)
app.mount(
    "/static/reference",
    StaticFiles(directory=config.REFERENCE_GALLERY_DIR),
    name="reference-images",
)

# Optionally serve the frontend/ folder directly from this same server,
# so you can just run `uvicorn main:app` and open http://127.0.0.1:8000/.
# Expects frontend/ to sit next to backend/ (as in the project structure).
frontend_dir = Path(__file__).resolve().parent.parent / "frontend"
if frontend_dir.exists():
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")