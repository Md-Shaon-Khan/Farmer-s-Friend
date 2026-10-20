"""
Sub-class ensemble (ConvNeXt-Tiny + EfficientNet-B3 + ResNet-50).
Strict 9-class prediction: Winner is strictly chosen from the 9 supported classes.
"""

import numpy as np
import torch
from torch import nn
from torchvision import models

import config
from utils.image_utils import bytes_to_pil_image, build_transform


def _build_model(arch: str, num_classes: int, drop: float = 0.3) -> nn.Module:
    if arch == "convnext_tiny":
        m = models.convnext_tiny(weights=None)
        m.classifier[2] = nn.Sequential(
            nn.Dropout(drop), nn.Linear(m.classifier[2].in_features, num_classes)
        )
    elif arch == "efficientnet_b3":
        m = models.efficientnet_b3(weights=None)
        m.classifier[0].p = drop
        m.classifier[1] = nn.Linear(m.classifier[1].in_features, num_classes)
    elif arch == "resnet50":
        m = models.resnet50(weights=None)
        m.fc = nn.Sequential(nn.Dropout(drop), nn.Linear(m.fc.in_features, num_classes))
    else:
        raise ValueError(f"Unsupported architecture: {arch}")
    return m


def pretty_label(key: str) -> str:
    if key == config.HEALTHY_CLASS_KEY:
        return "Healthy Leaf"
    if key == "false_smut":
        return "False Smut"
    return key.replace("_", " ").title()


class SubClassEnsemble:
    def __init__(self, model_paths=config.SUBCLASS_MODEL_PATHS):
        self.device = config.DEVICE
        self.classes = list(config.SUBCLASS_CLASSES)              # 13 checkpoint heads
        self.final_classes = list(config.SUBCLASS_FINAL_CLASSES)  # strictly 9 classes
        
        self.normal_13_idx = self.classes.index(config.HEALTHY_CLASS_KEY)
        # 9-ti supported class-er index 13-head theke ber kora
        self.supported_indices = [self.classes.index(c) for c in self.final_classes]

        self.transform = build_transform(
            config.SUBCLASS_IMG_SIZE, config.IMAGENET_MEAN, config.IMAGENET_STD
        )

        self.models: dict[str, nn.Module] = {}
        for arch, path in model_paths.items():
            ckpt = torch.load(path, map_location=self.device)
            state = ckpt["state"] if isinstance(ckpt, dict) and "state" in ckpt else ckpt

            model = _build_model(arch, len(self.classes))
            model.load_state_dict(state)
            model.to(self.device).eval()
            self.models[arch] = model

        if not self.models:
            raise RuntimeError("No sub-class models were loaded.")

    def get_cam_target(self):
        arch = (
            config.SUBCLASS_CAM_ARCH
            if config.SUBCLASS_CAM_ARCH in self.models
            else next(iter(self.models))
        )
        model = self.models[arch]
        layer = model.layer4[-1] if arch == "resnet50" else model.features[-1]
        return arch, model, layer

    def _decide9(self, p13: np.ndarray) -> int:
        """
        Decision strictly among the 9 supported classes:
        1. If normal probability >= HEALTHY_THRESHOLD -> normal
        2. Else -> argmax among the remaining 8 supported diseases
        """
        if p13[self.normal_13_idx] >= config.HEALTHY_THRESHOLD:
            return self.normal_13_idx

        # Suppress everything except the 8 supported diseases
        q = np.full_like(p13, -1.0)
        for idx in self.supported_indices:
            if idx != self.normal_13_idx:
                q[idx] = p13[idx]

        return int(np.argmax(q))

    @torch.no_grad()
    def predict(self, image_bytes: bytes) -> dict:
        image = bytes_to_pil_image(image_bytes)
        x = self.transform(image).unsqueeze(0).to(self.device)
        if config.SUBCLASS_TTA_FLIP:
            x = torch.cat([x, torch.flip(x, dims=[3])], dim=0)

        # 1. 13-class softmax probabilities
        per_model_p13 = {}
        for arch, model in self.models.items():
            p = torch.softmax(model(x).float(), dim=1).cpu().numpy().mean(axis=0)
            per_model_p13[arch] = p

        # 2. Ensemble soft voting over 13 heads
        probs_13 = np.mean(list(per_model_p13.values()), axis=0)

        # 3. Decide winner strictly among the 9 supported classes
        winning_13_idx = self._decide9(probs_13)
        final_key = self.classes[winning_13_idx]
        winning_confidence = float(probs_13[winning_13_idx])

        # Raw 13-class overall max (to detect if model was actually leaning toward an unlisted class)
        raw_top_idx = int(np.argmax(probs_13))
        is_actually_unlisted = raw_top_idx not in self.supported_indices

        is_healthy = final_key == config.HEALTHY_CLASS_KEY
        group = config.SUBCLASS_TO_GROUP.get(final_key, "fungal")

        # 4. Top-3 supported disease possibilities
        supported_disease_indices = [
            i for i in self.supported_indices if i != self.normal_13_idx
        ]
        supported_disease_indices.sort(key=lambda i: probs_13[i], reverse=True)
        top3 = [
            {
                "key": self.classes[i],
                "label": pretty_label(self.classes[i]),
                "confidence": float(probs_13[i]),
            }
            for i in supported_disease_indices[:3]
        ]

        # 5. Model individual votes strictly among 9 classes
        model_votes = {
            arch: self.classes[self._decide9(p)] for arch, p in per_model_p13.items()
        }

        # 6. Probs for final 9 classes
        final_probs = {c: float(probs_13[self.classes.index(c)]) for c in self.final_classes}

        return {
            "is_healthy": is_healthy,
            "key": final_key,
            "label": pretty_label(final_key),
            "confidence": winning_confidence,
            "normal_prob": float(probs_13[self.normal_13_idx]),
            "group": group,
            "group_label": config.GROUP_LABELS[group],
            "top3": top3,
            "model_votes": model_votes,
            "probs": final_probs,
            "is_out_of_scope": is_actually_unlisted,
        }