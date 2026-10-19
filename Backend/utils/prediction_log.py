"""Append-only prediction log (JSON Lines) + user feedback (actual disease)."""

import json
import threading
import uuid
from datetime import datetime, timezone

import config
from utils.image_utils import bytes_to_pil_image

LOG_PATH = config.BASE_DIR / "data" / "prediction_log.jsonl"
IMAGE_DIR = config.BASE_DIR / "data" / "logged_images"
_lock = threading.Lock()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _append(record: dict) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _lock, open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def normalize_label(text: str) -> str:
    """'Brown Spot' -> 'brown_spot', 'healthy' -> 'normal'."""
    t = "_".join(text.strip().lower().replace("-", " ").split())
    if t in ("healthy", "normal", "no_disease", "sustho", "thik"):
        return config.HEALTHY_CLASS_KEY
    if t in ("other", "others", "unlisted", "unknown"):
        return "other"
    return t


def log_prediction(image_bytes: bytes, result: dict) -> str:
    """Append one prediction record and return its id."""
    pid = uuid.uuid4().hex[:12]

    image_rel = None
    try:
        IMAGE_DIR.mkdir(parents=True, exist_ok=True)
        path = IMAGE_DIR / f"{pid}.jpg"
        bytes_to_pil_image(image_bytes).save(path, "JPEG", quality=90)
        image_rel = f"data/logged_images/{path.name}"
    except Exception:
        pass  # never let logging break a prediction

    final = result.get("final")
    sub = result.get("sub_class") or {}
    if final:
        pred_key, pred_label, conf = final["key"], final["label"], final["confidence"]
    elif result.get("disease_confidence") is None:
        pred_key, pred_label, conf = "not_paddy", "Not paddy", result.get("paddy_confidence")
    else:
        pred_key, pred_label, conf = (
            config.HEALTHY_CLASS_KEY, "Healthy", result["disease_confidence"]
        )

    _append({
        "type": "prediction",
        "id": pid,
        "time": _now(),
        "image": image_rel,
        "is_paddy": result.get("is_paddy"),
        "paddy_confidence": result.get("paddy_confidence"),
        "predicted_key": pred_key,
        "predicted_label": pred_label,
        "confidence": conf,
        "top3": sub.get("top3"),
        "model_votes": sub.get("model_votes"),
    })
    return pid


def log_feedback(prediction_id: str, actual_text: str) -> dict:
    record = {
        "type": "feedback",
        "id": prediction_id,
        "time": _now(),
        "actual_text": actual_text.strip(),
        "actual_key": normalize_label(actual_text),
    }
    _append(record)
    return record