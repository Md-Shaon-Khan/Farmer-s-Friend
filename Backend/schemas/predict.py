from typing import List, Optional
from pydantic import BaseModel


class SimilarImage(BaseModel):
    image_url: str
    label: str
    similarity: float


class SpotBox(BaseModel):
    x: int
    y: int
    w: int
    h: int


class Spot(BaseModel):
    spot_id: int
    area_ratio_pct: float
    perimeter_to_area: float
    necrosis_intensity: float
    elongation: float
    box: SpotBox


class Localization(BaseModel):
    annotated_image_base64: str  # boxed spots, PNG (no data: URI prefix)
    heatmap_overlay_base64: str  # continuous attention heatmap, PNG (no data: URI prefix)
    spots: List[Spot]


class PredictionResponse(BaseModel):
    is_paddy: bool
    paddy_confidence: float
    disease: Optional[str] = None
    disease_label: Optional[str] = None
    disease_confidence: Optional[float] = None
    similar_images: List[SimilarImage] = []
    localization: Optional[Localization] = None

    class Config:
        json_schema_extra = {
            "example": {
                "is_paddy": True,
                "paddy_confidence": 0.97,
                "disease": "viral",
                "disease_label": "Viral infection",
                "disease_confidence": 0.596,
                "similar_images": [
                    {
                        "image_url": "/static/reference/viral_014.jpg",
                        "label": "viral",
                        "similarity": 0.93,
                    }
                ],
                "localization": {
                    "annotated_image_base64": "iVBORw0KGgoAAAANSUhEUgAA...",
                    "heatmap_overlay_base64": "iVBORw0KGgoAAAANSUhEUgAA...",
                    "spots": [
                        {
                            "spot_id": 1,
                            "area_ratio_pct": 4.2,
                            "perimeter_to_area": 0.11,
                            "necrosis_intensity": 132.5,
                            "elongation": 3.1,
                            "box": {"x": 40, "y": 90, "w": 60, "h": 20},
                        }
                    ],
                },
            }
        }