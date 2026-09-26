"""
Loads the ConvNeXt-Tiny pathogen-type model (best_fresh_balanced_convnext.pth).

Architecture, resolution, and class order mirror the "FRESH BALANCED
FINE-TUNING (CONVNEXT-TINY @ 384x384)" cell in image-classification-paddy.ipynb
exactly:
  model = models.convnext_tiny(weights='DEFAULT')
  model.classifier[2] = nn.Linear(num_ftrs, 4)
Note this model predicts a PATHOGEN TYPE (Bacterial / Fungal / Viral /
Normal), not a specific named disease like "blast" or "tungro".
"""

import torch
from torch import nn
from torchvision import models

import config
from utils.image_utils import bytes_to_pil_image, build_transform


class DiseaseClassifier:
    def __init__(self, weights_path=config.DISEASE_MODEL_PATH):
        self.device = config.DEVICE
        self.classes = config.DISEASE_CLASSES  # ["bacterial", "fungal", "viral", "normal"]
        self.labels = config.DISEASE_LABELS
        self.transform = build_transform(
            config.DISEASE_IMG_SIZE, config.IMAGENET_MEAN, config.IMAGENET_STD
        )

        self.model = models.convnext_tiny(weights=None)
        in_features = self.model.classifier[2].in_features
        self.model.classifier[2] = nn.Linear(in_features, len(self.classes))

        state_dict = torch.load(weights_path, map_location=self.device)
        self.model.load_state_dict(state_dict)
        self.model.to(self.device)
        self.model.eval()

    @torch.no_grad()
    def predict(self, image_bytes: bytes):
        """Returns (pathogen_key: str, pathogen_label: str, confidence: float)."""
        image = bytes_to_pil_image(image_bytes)
        tensor = self.transform(image).unsqueeze(0).to(self.device)

        logits = self.model(tensor)
        probs = torch.softmax(logits, dim=1)[0]
        pred_idx = int(torch.argmax(probs).item())
        confidence = float(probs[pred_idx].item())

        pathogen_key = self.classes[pred_idx]
        pathogen_label = self.labels.get(pathogen_key, pathogen_key)
        return pathogen_key, pathogen_label, confidence