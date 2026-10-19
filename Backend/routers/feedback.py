from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from utils.prediction_log import log_feedback

router = APIRouter()


class FeedbackIn(BaseModel):
    prediction_id: str
    actual_text: str


@router.post("/feedback")
def save_feedback(body: FeedbackIn):
    if not body.actual_text.strip():
        raise HTTPException(status_code=400, detail="actual_text is empty")
    rec = log_feedback(body.prediction_id, body.actual_text)
    return {"saved": True, "actual_key": rec["actual_key"]}