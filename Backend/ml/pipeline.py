"""
Orchestrates the pipeline:
  1. Is this paddy at all?
  2. Healthy or diseased? -> pathogen model (4-class ConvNeXt) decides.
  3. If diseased: 13-class sub-class ensemble names the disease ("normal"
     excluded) and its broad group is cross-checked with the pathogen model:
        match     -> both agree: that is the final result
        mismatch  -> the MORE CONFIDENT model's result is shown, plus a
                     message about the disagreement
     Grad-CAM + lesion localization is drawn for the result that is shown.
  4. Which reference images is it most visually similar to?

Models are loaded once, at import time, and reused across requests.
"""

from pathlib import Path

import config
from ml.paddy_detector import PaddyDetector
from ml.disease_classifier import DiseaseClassifier
from ml.subclass_classifier import SubClassEnsemble
from ml.feature_extractor import SimilarityEngine
from ml.spot_detector import localize_disease
from utils.image_utils import bytes_to_pil_image


_paddy_detector = PaddyDetector()
_disease_classifier = DiseaseClassifier()
_subclass_ensemble = SubClassEnsemble()

# Reuses the already-loaded ConvNeXt weights from the disease classifier.
_similarity_engine = SimilarityEngine(_disease_classifier)


def _to_response_images(matches: list[dict]) -> list[dict]:
    return [
        {
            "image_url": f"{config.REFERENCE_IMAGE_URL_PREFIX}/{Path(m['image_path']).name}",
            "label": m["label"],
            "similarity": m["similarity"],
        }
        for m in matches
    ]


def _pct(x: float) -> int:
    return round(x * 100)


def _cross_check(main_key: str, main_label: str, main_conf: float, sub: dict) -> dict:
    """
    Compare the pathogen model's group with the sub-class model's group.

    Agree     -> status "match",    winner "both"  (final result)
    Disagree  -> the model with the HIGHER confidence wins and its result is
                 shown, together with a message about the disagreement.
                 status "mismatch" (sub-class is a known disease of another
                 group) or "other" (sub-class says unlisted condition).
    """
    sub_group = sub["group"]

    if sub_group == main_key:
        return {
            "status": "match",
            "winner": "both",
            "main_group": main_key,
            "sub_group": sub_group,
            "message": f"Both models agree: {sub['group_label']} - {sub['label']}.",
        }

    winner = "sub" if sub["confidence"] > main_conf else "main"
    status = "other" if sub_group == "other" else "mismatch"
    shown = sub["label"] if winner == "sub" else main_label

    sub_desc = (
        "an unlisted condition" if sub_group == "other"
        else f"{sub['label']} ({sub['group_label']})"
    )
    message = (
        f"Mismatch: the pathogen model predicts {main_label} ({_pct(main_conf)}%), "
        f"the disease model predicts {sub_desc} ({_pct(sub['confidence'])}%). "
        f"Showing the more confident result: {shown}. "
        f"Please confirm with an expert or retake a clear, close-up photo."
    )
    return {
        "status": status,
        "winner": winner,
        "main_group": main_key,
        "sub_group": sub_group,
        "message": message,
    }


def _final_result(main_key, main_label, main_conf, sub, consistency) -> dict:
    """The single result the page should present as the answer."""
    if consistency["winner"] == "main":
        return {
            "source": "main", "key": main_key, "label": main_label,
            "group": main_key, "group_label": main_label, "confidence": main_conf,
        }
    return {  # "both" or "sub"
        "source": consistency["winner"], "key": sub["key"], "label": sub["label"],
        "group": sub["group"], "group_label": sub["group_label"],
        "confidence": sub["confidence"],
    }


def _sub_class_payload(sub: dict) -> dict:
    return {k: sub[k] for k in
            ("key", "label", "confidence", "group", "group_label", "top3", "model_votes")}


def run_pipeline(image_bytes: bytes) -> dict:
    # ---------------------------------------------------------
    # 1. Paddy detection
    # ---------------------------------------------------------
    is_paddy, paddy_confidence = _paddy_detector.predict(image_bytes)

    if not is_paddy:
        return {
            "is_paddy": False,
            "paddy_confidence": paddy_confidence,
            "disease": None,
            "disease_label": None,
            "disease_confidence": None,
            "sub_class": None,
            "consistency": None,
            "final": None,
            "similar_images": [],
            "localization": None,
        }

    # ---------------------------------------------------------
    # 2. Healthy vs diseased: decided by the PATHOGEN model only
    #    (it is the better "normal" classifier).
    # ---------------------------------------------------------
    main_key, main_label, main_confidence = _disease_classifier.predict(image_bytes)

    # ---------------------------------------------------------
    # 3. Similar-image search
    # ---------------------------------------------------------
    similar_images = _to_response_images(_similarity_engine.find_similar(image_bytes))

    if main_key == config.HEALTHY_CLASS_KEY:
        # Healthy: the sub-class ensemble is not run at all (faster, and it
        # cannot override the pathogen model's "normal").
        return {
            "is_paddy": True,
            "paddy_confidence": paddy_confidence,
            "disease": None,
            "disease_label": None,
            "disease_confidence": main_confidence,
            "sub_class": None,
            "consistency": None,
            "final": None,
            "similar_images": similar_images,
            "localization": None,
        }

    # ---------------------------------------------------------
    # 4. Diseased: the sub-class ensemble (better at naming the disease)
    #    picks among the DISEASE classes only ("normal" is excluded), then
    #    its broad group is cross-checked against the pathogen model.
    # ---------------------------------------------------------
    sub = _subclass_ensemble.predict(image_bytes, exclude_normal=True)
    consistency = _cross_check(main_key, main_label, main_confidence, sub)
    final = _final_result(main_key, main_label, main_confidence, sub, consistency)

    # ---------------------------------------------------------
    # 5. Grad-CAM + lesion localization for whichever result is shown:
    #    - sub-class result (agreed or higher confidence) -> ensemble CAM
    #    - pathogen-model result (higher confidence)      -> its own CAM
    #    - "other / unlisted" has no meaningful CAM target -> skipped
    # ---------------------------------------------------------
    localization = None
    image_pil = bytes_to_pil_image(image_bytes)
    if final["source"] == "main":
        localization = localize_disease(
            cam_model=_disease_classifier.model,
            target_layer=_disease_classifier.model.features[-1],
            image_pil=image_pil,
            pred_idx=config.DISEASE_CLASSES.index(main_key),
            transform=_disease_classifier.transform,
            device=config.DEVICE,
            mean=config.IMAGENET_MEAN,
            std=config.IMAGENET_STD,
        )
    elif final["group"] != "other":
        _, cam_model, cam_layer = _subclass_ensemble.get_cam_target()
        localization = localize_disease(
            cam_model=cam_model,
            target_layer=cam_layer,
            image_pil=image_pil,
            pred_idx=sub["index"],
            transform=_subclass_ensemble.transform,
            device=config.DEVICE,
            mean=config.IMAGENET_MEAN,
            std=config.IMAGENET_STD,
        )

    # ---------------------------------------------------------
    # 6. Final response (disease* fields = pathogen model, unchanged keys,
    #    so the existing frontend keeps working)
    # ---------------------------------------------------------
    return {
        "is_paddy": True,
        "paddy_confidence": paddy_confidence,
        "disease": main_key,
        "disease_label": main_label,
        "disease_confidence": main_confidence,
        "sub_class": _sub_class_payload(sub),
        "consistency": consistency,
        "final": final,
        "similar_images": similar_images,
        "localization": localization,
    }