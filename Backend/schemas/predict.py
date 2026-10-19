"""
Response model for POST /api/predict.

FastAPI's response_model drops any field that is not declared here, so
every field the frontend needs must be listed.
"""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class SimilarImage(BaseModel):
    image_url: str
    label: str
    similarity: float


class SubClassCandidate(BaseModel):
    key: str
    label: str
    confidence: float


class SubClassResult(BaseModel):
    key: str                      # e.g. "tungro"
    label: str                    # e.g. "Tungro"
    confidence: float
    group: str                    # bacterial | fungal | viral | normal | other
    group_label: str
    top3: List[SubClassCandidate]
    model_votes: Dict[str, str]   # per-model decision, e.g. {"resnet50": "tungro", ...}


class FinalResult(BaseModel):
    source: str                   # always "sub" now
    key: str
    label: str
    group: str
    group_label: str
    confidence: float


class Consistency(BaseModel):
    status: str
    winner: str
    main_group: str
    sub_group: str
    message: str


class PredictionResponse(BaseModel):
    prediction_id: Optional[str] = None   # id used to attach feedback
    is_paddy: bool
    paddy_confidence: float
    disease: Optional[str] = None
    disease_label: Optional[str] = None
    disease_confidence: Optional[float] = None
    sub_class: Optional[SubClassResult] = None
    consistency: Optional[Consistency] = None   # unused now, kept for compatibility
    final: Optional[FinalResult] = None
    similar_images: List[SimilarImage] = []
    # annotated_image_base64, heatmap_overlay_base64, lesion_mask_base64,
    # spots, total_damage_pct, tuned_params
    localization: Optional[Dict[str, Any]] = None