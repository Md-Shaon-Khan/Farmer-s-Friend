"""
Pipeline:
  1. Is this paddy? (MobileNetV3-Small)
  2. 3-model ensemble decides healthy vs which disease (9 classes).
  3. Checks out-of-scope / low-confidence disease and sets appropriate user alert.
  4. Grad-CAM + lesion localization for valid supported diseases.
  5. Most visually similar reference images.
  6. Every prediction is appended to data/prediction_log.jsonl.
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
            "message": "The uploaded image does not appear to be a paddy plant. Please upload a clear photo of a rice leaf."
        }

    similar_images = _to_response_images(_similarity_engine.find_similar(image_bytes))
    sub = _subclass_ensemble.predict(image_bytes)

    # ---- healthy ----
    if sub["is_healthy"]:
        return {
            "is_paddy": is_paddy, "paddy_confidence": paddy_confidence,
            "disease": None, "disease_label": "Healthy Leaf",
            "disease_confidence": sub["normal_prob"],
            "sub_class": None, "consistency": None, "final": None,
            "similar_images": similar_images, "localization": None,
            "message": "Leaf appears healthy."
        }

    # ---- diseased ----
    final = {
        "source": "sub", "key": sub["key"], "label": sub["label"],
        "group": sub["group"], "group_label": sub["group_label"],
        "confidence": sub["confidence"],
    }

    # Check if image leaned toward unsupported heads (e.g. hispa, downy mildew) or has low confidence
    is_out_of_scope = sub.get("is_out_of_scope", False)
    is_low_confidence = sub["confidence"] < config.DISEASE_MIN_CONFIDENCE

    user_message = "Disease diagnosed successfully."
    if is_out_of_scope or is_low_confidence:
        user_message = config.OUT_OF_SCOPE_MESSAGE

    localization = None
    try:
        _, cam_model, cam_layer = _subclass_ensemble.get_cam_target()
        pred_idx = _subclass_ensemble.classes.index(sub["key"])
        localization = localize_disease(
            cam_model=cam_model,
            target_layer=cam_layer,
            image_pil=bytes_to_pil_image(image_bytes),
            pred_idx=pred_idx,
            transform=_subclass_ensemble.transform,
            device=config.DEVICE,
            mean=config.IMAGENET_MEAN,
            std=config.IMAGENET_STD,
        )
    except Exception as e:
        print(f"[Grad-CAM] failed: {e}")

    return {
        "is_paddy": is_paddy, "paddy_confidence": paddy_confidence,
        "disease": sub["key"], "disease_label": sub["label"],
        "disease_confidence": sub["confidence"],
        "sub_class": _sub_class_payload(sub),
        "consistency": None,
        "final": final,
        "similar_images": similar_images,
        "localization": localization,
        "message": user_message
    }


def run_pipeline(image_bytes: bytes) -> dict:
    result = _run_pipeline_core(image_bytes)
    try:
        result["prediction_id"] = log_prediction(image_bytes, result)
    except Exception as e:
        print(f"[prediction_log] failed: {e}")
        result["prediction_id"] = None
    return result