from fastapi import APIRouter, UploadFile, File, HTTPException

from ml.pipeline import run_pipeline
from schemas.predict import PredictionResponse

router = APIRouter()

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/jpg", "image/webp"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


@router.post("/predict", response_model=PredictionResponse)
async def predict(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Please upload a JPG, PNG, or WEBP image.")

    image_bytes = await file.read()

    if len(image_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="Image is too large (10 MB max).")

    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        result = run_pipeline(image_bytes)
    except Exception:
        raise HTTPException(status_code=500, detail="Couldn't process this image. Try a different photo.")

    return result