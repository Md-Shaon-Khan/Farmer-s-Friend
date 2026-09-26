"""
Loads the MobileNetV3-Small paddy/not-paddy model.

Architecture and inference logic mirror paddy-or-not-paddy.ipynb exactly:
  mobilenet.classifier[3] = nn.Linear(mobilenet.classifier[3].in_features, 2)
and the notebook's own predict_gatekeeper() threshold behavior (0.85).
"""

import torch
from torch import nn
from torchvision import models

import config
from utils.image_utils import bytes_to_pil_image, build_transform


class PaddyDetector:
    def __init__(self, weights_path=config.PADDY_MODEL_PATH):
        self.device = config.DEVICE
        self.classes = config.PADDY_CLASSES  # ["not_paddy", "paddy"]
        self.threshold = config.PADDY_CONFIDENCE_THRESHOLD
        self.transform = build_transform(
            config.PADDY_IMG_SIZE, config.IMAGENET_MEAN, config.IMAGENET_STD
        )

        self.model = models.mobilenet_v3_small(weights=None)
        self.model.classifier[3] = nn.Linear(self.model.classifier[3].in_features, 2)

        state_dict = torch.load(weights_path, map_location=self.device)
        self.model.load_state_dict(state_dict)
        self.model.to(self.device)
        self.model.eval()

    @torch.no_grad()
    def predict(self, image_bytes: bytes):
        """Returns (is_paddy: bool, confidence: float).

        Same three-way logic as the notebook's predict_gatekeeper():
        - prob_paddy >= threshold      -> paddy
        - prob_not_paddy >= threshold  -> not paddy
        - neither clears the bar       -> uncertain, treated as not paddy
        """
        image = bytes_to_pil_image(image_bytes)
        tensor = self.transform(image).unsqueeze(0).to(self.device)

        logits = self.model(tensor)
        probs = torch.softmax(logits, dim=1)[0]
        prob_not_paddy = float(probs[0].item())
        prob_paddy = float(probs[1].item())

        if prob_paddy >= self.threshold:
            return True, prob_paddy
        elif prob_not_paddy >= self.threshold:
            return False, prob_not_paddy
        else:
            # Uncertain — the notebook defaults this case to "Not Paddy".
            return False, max(prob_paddy, prob_not_paddy)