"""
"Where's the problem" localization for a diagnosed leaf.

Uses Grad-CAM on the ConvNeXt disease classifier.

How it works:
  1. The exact same transformed tensor used by the classifier is
     passed through the model.
  2. Grad-CAM calculates which spatial regions contributed to the
     predicted disease class.
  3. The heatmap is thresholded to identify high-attention regions.
  4. Contours are extracted from that mask.
  5. Bounding boxes and spot statistics are generated.

This is attention-based localization, NOT object detection.
There is no YOLO or separately trained detection model.

Important:
The visualization image is reconstructed from the exact transformed
tensor given to the model. This keeps Grad-CAM coordinates aligned with
the displayed image even when the transform performs resizing,
center-cropping, normalization, etc.
"""

import base64
import io

import cv2
import numpy as np
import torch
from PIL import Image


class ConvNeXtGradCAM:
    """Grad-CAM implementation for the ConvNeXt classifier."""

    def __init__(self, target_model, target_layer):
        self.model = target_model
        self.target_layer = target_layer

        self.gradients = None
        self.activations = None

        self.hook_f = self.target_layer.register_forward_hook(
            self.save_activation
        )

        self.hook_b = self.target_layer.register_full_backward_hook(
            self.save_gradient
        )

    def save_activation(self, module, input, output):
        self.activations = output.detach()

    def save_gradient(self, module, grad_input, grad_output):
        self.gradients = grad_output[0].detach()

    def __call__(
        self,
        x_tensor,
        target_class,
        out_size=None,
    ):
        self.model.zero_grad()

        output = self.model(x_tensor)

        one_hot = torch.zeros_like(output)
        one_hot[0, target_class] = 1.0

        output.backward(
            gradient=one_hot,
            retain_graph=True,
        )

        gradients = self.gradients.detach().cpu().numpy()[0]
        activations = self.activations.detach().cpu().numpy()[0]

        # Global-average-pool gradients over spatial dimensions.
        weights = np.mean(
            gradients,
            axis=(1, 2),
        )

        # Weighted combination of feature maps.
        cam = np.zeros(
            activations.shape[1:],
            dtype=np.float32,
        )

        for i, weight in enumerate(weights):
            cam += weight * activations[i]

        # Keep only positive influence.
        cam = np.maximum(cam, 0)

        # Normalize to [0, 1].
        if cam.max() > 0:
            cam = cam / cam.max()

        # Resize CAM to the exact visualization image size.
        if out_size is not None:
            if isinstance(out_size, tuple):
                target_width, target_height = out_size
            else:
                target_width = out_size
                target_height = out_size

            cam = cv2.resize(
                cam,
                (target_width, target_height),
                interpolation=cv2.INTER_LINEAR,
            )

        return cam

    def remove_hooks(self):
        self.hook_f.remove()
        self.hook_b.remove()


def _tensor_to_display_image(
    tensor: torch.Tensor,
    mean,
    std,
) -> np.ndarray:
    """
    Converts the exact normalized model input tensor back into
    an RGB uint8 image for visualization.

    Input:
        tensor: [C, H, W]

    Output:
        RGB uint8 NumPy image: [H, W, 3]
    """

    image_tensor = tensor.detach().cpu().clone()

    mean_tensor = torch.tensor(
        mean,
        dtype=image_tensor.dtype,
    ).view(3, 1, 1)

    std_tensor = torch.tensor(
        std,
        dtype=image_tensor.dtype,
    ).view(3, 1, 1)

    # Undo ImageNet normalization.
    image_tensor = (
        image_tensor * std_tensor
    ) + mean_tensor

    # Prevent small floating-point errors from producing
    # values outside the valid image range.
    image_tensor = image_tensor.clamp(0.0, 1.0)

    # CHW -> HWC.
    image_np = image_tensor.permute(
        1,
        2,
        0,
    ).numpy()

    # Float [0, 1] -> uint8 [0, 255].
    image_np = (
        image_np * 255.0
    ).round().astype(np.uint8)

    return image_np


def extract_spots_and_features(
    cam_mask,
    original_np,
):
    """
    Converts the Grad-CAM heatmap into detected high-attention spots.

    The coordinates are calculated directly against original_np,
    which is the exact transformed image shown to the model.

    Returns:
        spot_metrics
        annotated_img
    """

    # Threshold Grad-CAM.
    mask_binary = (
        np.uint8(cam_mask > 0.45) * 255
    )

    # Find connected attention regions.
    contours, _ = cv2.findContours(
        mask_binary,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE,
    )

    annotated_img = original_np.copy()

    spot_metrics = []

    h_img, w_img, _ = original_np.shape
    total_img_area = h_img * w_img

    # Human-readable spot numbering.
    spot_id = 0

    for cnt in contours:

        area = cv2.contourArea(cnt)

        # Ignore tiny attention regions.
        if area < 80:
            continue

        spot_id += 1

        perimeter = cv2.arcLength(
            cnt,
            True,
        )

        p_a_ratio = (
            perimeter / area
            if area > 0
            else 0
        )

        x, y, w, h = cv2.boundingRect(cnt)

        elongation = (
            max(w / h, h / w)
            if min(w, h) > 0
            else 1.0
        )

        # Create a mask for this particular contour.
        mask_cnt = np.zeros(
            (h_img, w_img),
            dtype=np.uint8,
        )

        cv2.drawContours(
            mask_cnt,
            [cnt],
            -1,
            255,
            -1,
        )

        # Calculate mean RGB intensity in the spot.
        mean_val = cv2.mean(
            original_np,
            mask=mask_cnt,
        )[:3]

        # Simple darkness / necrosis proxy.
        necrosis_score = (
            255 - np.mean(mean_val)
        )

        # Draw bounding box.
        cv2.rectangle(
            annotated_img,
            (x, y),
            (x + w, y + h),
            (255, 0, 0),
            2,
        )

        # Draw spot number.
        text_y = max(
            y - 5,
            15,
        )

        cv2.putText(
            annotated_img,
            f"#{spot_id}",
            (x, text_y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (255, 0, 0),
            2,
        )

        spot_metrics.append(
            {
                "spot_id": spot_id,
                "area_ratio_pct": round(
                    (area / total_img_area) * 100,
                    2,
                ),
                "perimeter_to_area": round(
                    p_a_ratio,
                    3,
                ),
                "necrosis_intensity": round(
                    necrosis_score,
                    1,
                ),
                "elongation": round(
                    elongation,
                    2,
                ),
                "box": {
                    "x": int(x),
                    "y": int(y),
                    "w": int(w),
                    "h": int(h),
                },
            }
        )

    return spot_metrics, annotated_img


def _heatmap_overlay(
    cam: np.ndarray,
    original_np: np.ndarray,
) -> np.ndarray:
    """
    Creates a Grad-CAM heatmap overlay using the same image
    coordinate system as the CAM.
    """

    heatmap = cv2.applyColorMap(
        np.uint8(255 * cam),
        cv2.COLORMAP_JET,
    )

    heatmap_rgb = cv2.cvtColor(
        heatmap,
        cv2.COLOR_BGR2RGB,
    )

    return cv2.addWeighted(
        original_np,
        0.6,
        heatmap_rgb,
        0.4,
        0,
    )


def _np_image_to_base64_png(
    image_np: np.ndarray,
) -> str:
    """
    Converts an RGB NumPy image to a base64 PNG string.
    """

    image = Image.fromarray(
        image_np
    )

    buffer = io.BytesIO()

    image.save(
        buffer,
        format="PNG",
    )

    return base64.b64encode(
        buffer.getvalue()
    ).decode("ascii")


def localize_disease(
    disease_model,
    image_pil: Image.Image,
    pred_idx: int,
    transform,
    device,
    mean,
    std,
):
    """
    Runs Grad-CAM + spot extraction for one leaf photo.

    The SAME transformed tensor is used for:

        image -> transform -> model
                           -> Grad-CAM

    and:

        image -> transform -> unnormalize -> visualization

    Therefore the Grad-CAM coordinates and displayed image
    coordinates remain aligned.

    Returns:
        {
            "annotated_image_base64": str,
            "heatmap_overlay_base64": str,
            "spots": [...]
        }
    """

    # ---------------------------------------------------------
    # 1. Apply the EXACT classifier transform.
    # ---------------------------------------------------------
    transformed_tensor = transform(
        image_pil
    )

    # ---------------------------------------------------------
    # 2. Reconstruct the exact model-view image.
    #
    # This replaces the old:
    #
    # image_pil.resize((img_size, img_size))
    #
    # which caused coordinate mismatch when the transform used
    # crop/resize operations.
    # ---------------------------------------------------------
    display_np = _tensor_to_display_image(
        transformed_tensor,
        mean,
        std,
    )

    # ---------------------------------------------------------
    # 3. Prepare model input.
    # ---------------------------------------------------------
    model_tensor = (
        transformed_tensor
        .unsqueeze(0)
        .to(device)
    )

    model_tensor.requires_grad_(True)

    # ---------------------------------------------------------
    # 4. Create Grad-CAM.
    # ---------------------------------------------------------
    gradcam = ConvNeXtGradCAM(
        disease_model,
        disease_model.features[-1],
    )

    try:
        cam = gradcam(
            model_tensor,
            pred_idx,
            out_size=(
                display_np.shape[1],
                display_np.shape[0],
            ),
        )

    finally:
        gradcam.remove_hooks()

    # ---------------------------------------------------------
    # 5. Extract attention spots and draw boxes.
    # ---------------------------------------------------------
    spot_metrics, annotated_np = (
        extract_spots_and_features(
            cam,
            display_np,
        )
    )

    # ---------------------------------------------------------
    # 6. Generate heatmap overlay.
    # ---------------------------------------------------------
    heatmap_np = _heatmap_overlay(
        cam,
        display_np,
    )

    # ---------------------------------------------------------
    # 7. Convert images to base64.
    # ---------------------------------------------------------
    return {
        "annotated_image_base64": (
            _np_image_to_base64_png(
                annotated_np
            )
        ),
        "heatmap_overlay_base64": (
            _np_image_to_base64_png(
                heatmap_np
            )
        ),
        "spots": spot_metrics,
    }