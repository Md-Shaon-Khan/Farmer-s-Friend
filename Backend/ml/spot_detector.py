"""
"Where's the problem" localization for a diagnosed leaf.

Ported from the notebook cell "Lesion Localization using OpenCV, Grad-CAM,
and Grid-Tuned Extraction" (Fine_Tuning_Paddy_Sub_Class.ipynb):

  1. Grad-CAM on one member of the sub-class ensemble, for the PREDICTED
     sub-class  ->  attention map in [0, 1].
  2. Grid search over (heatmap threshold x minimum contour area) picks the
     best lesion-mask setting for THIS image
        thresh   in {0.35, 0.45, 0.55}
        min_area in {30, 50, 80}
     score = n_lesions / (|total_damage% - 15| + 1), valid only when
     0.5% <= total_damage <= 60%; fallback (0.45, 50).
  3. OpenCV: threshold -> morphological close -> contours -> boxes + per-spot
     metrics (area %, perimeter/area, necrosis intensity, elongation).

Added for field photos: an Excess-Green (ExG = 2G - R - B) plant mask that
removes soil / mud / water from the lesion mask (skipped automatically when
it would remove almost everything).

This is attention-based localization, NOT object detection (no YOLO).

The picture shown to the user is rebuilt from the exact tensor given to the
model, so Grad-CAM coordinates and boxes line up with the displayed image.
"""

import base64
import io
from itertools import product

import cv2
import numpy as np
import torch
from PIL import Image

GRID_THRESHOLDS = (0.35, 0.45, 0.55)
GRID_MIN_AREAS = (30, 50, 80)
FALLBACK_PARAMS = {"thresh": 0.45, "min_area": 50}
TARGET_DAMAGE_PCT = 15.0
VALID_DAMAGE_RANGE = (0.5, 60.0)
EXG_THRESHOLD = 0.04
MIN_PLANT_FRACTION = 0.05


# ---------------------------------------------------------------------
# Grad-CAM (works for ResNet layer4[-1] and ConvNeXt/EfficientNet features[-1])
# ---------------------------------------------------------------------
class GradCAM:
    def __init__(self, model, target_layer):
        self.model = model
        self.activations = None
        self.gradients = None
        self._handle = target_layer.register_forward_hook(self._on_forward)

    def _on_forward(self, module, inputs, output):
        self.activations = output.detach()
        if output.requires_grad:
            output.register_hook(lambda g: setattr(self, "gradients", g.detach()))

    def __call__(self, x_tensor, target_class, out_size):
        self.model.zero_grad()
        with torch.enable_grad():
            output = self.model(x_tensor)
            output[0, target_class].backward()

        if self.gradients is None or self.activations is None:
            return np.zeros((out_size[1], out_size[0]), dtype=np.float32)

        grads = self.gradients.cpu().numpy()[0]
        acts = self.activations.cpu().numpy()[0]
        weights = grads.mean(axis=(1, 2))

        cam = np.maximum((weights[:, None, None] * acts).sum(axis=0), 0).astype(np.float32)
        cam = cv2.resize(cam, out_size, interpolation=cv2.INTER_LINEAR)

        lo, hi = float(cam.min()), float(cam.max())
        if hi > lo:
            cam = (cam - lo) / (hi - lo + 1e-8)
        else:
            cam = np.zeros_like(cam)
        return cam

    def remove_hooks(self):
        self._handle.remove()


# ---------------------------------------------------------------------
# Image helpers
# ---------------------------------------------------------------------
def _tensor_to_display_image(tensor, mean, std) -> np.ndarray:
    t = tensor.detach().cpu().clone()
    t = t * torch.tensor(std, dtype=t.dtype).view(3, 1, 1) + torch.tensor(mean, dtype=t.dtype).view(3, 1, 1)
    t = t.clamp(0.0, 1.0).permute(1, 2, 0).numpy()
    return (t * 255.0).round().astype(np.uint8)


def _heatmap_overlay(cam, original_np):
    heat = cv2.cvtColor(cv2.applyColorMap(np.uint8(255 * cam), cv2.COLORMAP_JET), cv2.COLOR_BGR2RGB)
    return cv2.addWeighted(original_np, 0.6, heat, 0.4, 0)


def _to_base64_png(image_np) -> str:
    buf = io.BytesIO()
    Image.fromarray(image_np).save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _plant_mask(original_np):
    """ExG foliage mask; None if it covers too little to be trusted."""
    f = original_np.astype(np.float32) / 255.0
    exg = 2.0 * f[:, :, 1] - f[:, :, 0] - f[:, :, 2]
    mask = (exg > EXG_THRESHOLD).astype(np.uint8) * 255
    if cv2.countNonZero(mask) < MIN_PLANT_FRACTION * mask.size:
        return None
    return mask


# ---------------------------------------------------------------------
# OpenCV lesion extraction
# ---------------------------------------------------------------------
def extract_leaf_lesions(cam, original_np, thresh=0.45, min_area=40, plant_mask=None, draw=True):
    """Returns (spots, annotated_img, binary_mask, total_damage_pct)."""
    binary = (cam > thresh).astype(np.uint8) * 255
    if plant_mask is not None:
        binary = cv2.bitwise_and(binary, plant_mask)

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    h_img, w_img, _ = original_np.shape
    canvas_area = h_img * w_img
    annotated = original_np.copy() if draw else None
    hsv = cv2.cvtColor(original_np, cv2.COLOR_RGB2HSV)

    spots = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area:
            continue

        perimeter = cv2.arcLength(cnt, True)
        x, y, w, h = cv2.boundingRect(cnt)
        area_pct = area / canvas_area * 100

        spot_mask = np.zeros((h_img, w_img), dtype=np.uint8)
        cv2.drawContours(spot_mask, [cnt], -1, 255, -1)
        necrosis = 255.0 - cv2.mean(hsv[:, :, 2], mask=spot_mask)[0]  # darker = more necrotic
        elongation = max(w / (h + 1e-5), h / (w + 1e-5))

        spot_id = len(spots) + 1
        if draw:
            cv2.rectangle(annotated, (x, y), (x + w, y + h), (255, 30, 30), 2)
            cv2.putText(annotated, f"#{spot_id}", (x, max(15, y - 5)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 2)

        spots.append({
            "spot_id": spot_id,
            "area_ratio_pct": round(area_pct, 2),
            "perimeter_to_area": round(perimeter / (area + 1e-5), 3),
            "necrosis_intensity": round(float(necrosis), 1),
            "elongation": round(float(elongation), 2),
            "box": {"x": int(x), "y": int(y), "w": int(w), "h": int(h)},
        })

    total = sum(s["area_ratio_pct"] for s in spots)
    return spots, annotated, binary, total


def grid_search_segmentation(cam, original_np, plant_mask=None):
    """Pick the (thresh, min_area) pair that gives the most plausible lesion mask."""
    best, best_score = None, -1.0
    for thresh, min_area in product(GRID_THRESHOLDS, GRID_MIN_AREAS):
        spots, _, _, total = extract_leaf_lesions(
            cam, original_np, thresh, min_area, plant_mask, draw=False
        )
        if VALID_DAMAGE_RANGE[0] <= total <= VALID_DAMAGE_RANGE[1] and spots:
            score = len(spots) / (abs(total - TARGET_DAMAGE_PCT) + 1.0)
            if score > best_score:
                best_score, best = score, {"thresh": thresh, "min_area": min_area}
    return best or dict(FALLBACK_PARAMS)


# ---------------------------------------------------------------------
# Public entry point (called by ml/pipeline.py)
# ---------------------------------------------------------------------
def localize_disease(cam_model, target_layer, image_pil, pred_idx, transform, device, mean, std):
    """
    cam_model / target_layer : ensemble member + layer for Grad-CAM
    pred_idx                 : index of the predicted SUB-class

    Returns:
        {
          "annotated_image_base64": boxed lesions,
          "heatmap_overlay_base64": Grad-CAM overlay,
          "lesion_mask_base64":     grid-tuned binary lesion mask,
          "spots": [...],
          "total_damage_pct": float,
          "tuned_params": {"thresh": .., "min_area": ..}
        }
    """
    tensor = transform(image_pil)
    display_np = _tensor_to_display_image(tensor, mean, std)
    model_tensor = tensor.unsqueeze(0).to(device).requires_grad_(True)

    cam_engine = GradCAM(cam_model, target_layer)
    try:
        cam = cam_engine(model_tensor, pred_idx, (display_np.shape[1], display_np.shape[0]))
    finally:
        cam_engine.remove_hooks()

    plant = _plant_mask(display_np)
    params = grid_search_segmentation(cam, display_np, plant)
    spots, annotated, mask, total = extract_leaf_lesions(
        cam, display_np, params["thresh"], params["min_area"], plant
    )

    return {
        "annotated_image_base64": _to_base64_png(annotated),
        "heatmap_overlay_base64": _to_base64_png(_heatmap_overlay(cam, display_np)),
        "lesion_mask_base64": _to_base64_png(mask),
        "spots": spots,
        "total_damage_pct": round(total, 2),
        "tuned_params": params,
    }