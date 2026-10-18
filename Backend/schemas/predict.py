"""
Response model for POST /predict.

REPLACES Backend/schemas/predict.py. FastAPI's response_model drops any field
that is not declared here, so the new sub_class / consistency fields must be
listed or they never reach the frontend. Field names for the existing
keys are unchanged.
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
    model_votes: Dict[str, str]   # per-model argmax, e.g. {"resnet50": "tungro", ...}


class FinalResult(BaseModel):
    source: str                   # "both" (agree) | "sub" | "main" (higher confidence wins)
    key: str
    label: str
    group: str
    group_label: str
    confidence: float


class Consistency(BaseModel):
    status: str                   # "match" | "mismatch" | "other"
    winner: str                   # "both" | "sub" | "main"
    main_group: str               # pathogen model (4-class)
    sub_group: str                # sub-class model, mapped to its broad group
    message: str


class PredictionResponse(BaseModel):
    is_paddy: bool
    paddy_confidence: float
    disease: Optional[str] = None
    disease_label: Optional[str] = None
    disease_confidence: Optional[float] = None
    sub_class: Optional[SubClassResult] = None
    consistency: Optional[Consistency] = None
    final: Optional[FinalResult] = None
    similar_images: List[SimilarImage] = []
    # annotated_image_base64, heatmap_overlay_base64, lesion_mask_base64,
    # spots, total_damage_pct, tuned_params
    localization: Optional[Dict[str, Any]] = None