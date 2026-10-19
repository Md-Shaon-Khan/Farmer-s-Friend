"""
Pipeline:
  1. Is this paddy? (not-paddy still predicts while config.PREDICT_EVEN_IF_NOT_PADDY)
  2. The 3-model ensemble decides healthy vs which disease
     (healthy if p(normal) >= config.HEALTHY_THRESHOLD).
  3. Grad-CAM + lesion localization for diseased results.
  4. Most visually similar reference images.
  5. Every prediction is appended to data/prediction_log.jsonl.
"""

from pathlib import Path

import config
from ml.paddy_detector import PaddyDetector
from ml.subclass_classifier import SubClassEnsemble
from ml.feature_extractor import SimilarityEngine
from ml.spot_detector import localize_disease
from utils.image_utils import bytes_to_pil_image
from utils.prediction_log import log_prediction


_paddy_detector = PaddyDetector()
_subclass_ensemble = SubClassEnsemble()
_similarity_engine = SimilarityEngine(_subclass_ensemble.models["convnext_tiny"])


def _to_response_images(matches: list[dict]) -> list[dict]:
    return [
        {
            "image_url": f"{config.REFERENCE_IMAGE_URL_PREFIX}/{Path(m['image_path']).name}",
            "label": m["label"],
            "similarity": m["similarity"],
        }
        for m in matches
    ]


def _sub_class_payload(sub: dict) -> dict:
    return {k: sub[k] for k in
            ("key", "label", "confidence", "group", "group_label", "top3", "model_votes")}


def _run_pipeline_core(image_bytes: bytes) -> dict:
    is_paddy, paddy_confidence = _paddy_detector.predict(image_bytes)

    if not is_paddy and not config.PREDICT_EVEN_IF_NOT_PADDY:
        return {
            "is_paddy": False, "paddy_confidence": paddy_confidence,
            "disease": None, "disease_label": None, "disease_confidence": None,
            "sub_class": None, "consistency": None, "final": None,
            "similar_images": [], "localization": None,
        }

    similar_images = _to_response_images(_similarity_engine.find_similar(image_bytes))
    sub = _subclass_ensemble.predict(image_bytes)

    # ---- healthy ----
    if sub["is_healthy"]:
        return {
            "is_paddy": is_paddy, "paddy_confidence": paddy_confidence,
            "disease": None, "disease_label": None,
            "disease_confidence": sub["normal_prob"],   # shown as "Healthy" %
            "sub_class": None, "consistency": None, "final": None,
            "similar_images": similar_images, "localization": None,
        }

    # ---- diseased ----
    final = {
        "source": "sub", "key": sub["key"], "label": sub["label"],
        "group": sub["group"], "group_label": sub["group_label"],
        "confidence": sub["confidence"],
    }

    localization = None
    if sub["group"] != "other":
        _, cam_model, cam_layer = _subclass_ensemble.get_cam_target()
        localization = localize_disease(
            cam_model=cam_model,
            target_layer=cam_layer,
            image_pil=bytes_to_pil_image(image_bytes),
            pred_idx=_subclass_ensemble.classes.index(sub["key"]),
            transform=_subclass_ensemble.transform,
            device=config.DEVICE,
            mean=config.IMAGENET_MEAN,
            std=config.IMAGENET_STD,
        )

    return {
        "is_paddy": is_paddy, "paddy_confidence": paddy_confidence,
        "disease": sub["key"], "disease_label": sub["label"],
        "disease_confidence": sub["confidence"],
        "sub_class": _sub_class_payload(sub),
        "consistency": None,
        "final": final,
        "similar_images": similar_images,
        "localization": localization,
    }


def run_pipeline(image_bytes: bytes) -> dict:
    result = _run_pipeline_core(image_bytes)
    try:
        result["prediction_id"] = log_prediction(image_bytes, result)
    except Exception as e:           # logging must never break prediction
        print(f"[prediction_log] failed: {e}")
        result["prediction_id"] = None
    return result