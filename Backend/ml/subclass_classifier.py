"""
Sub-class ensemble (ConvNeXt-Tiny + EfficientNet-B3 + ResNet-50).

* Checkpoints have 13-class heads; at inference the classes not in
  config.SUBCLASS_KEEP_CLASSES are summed into "other".
* Soft voting = mean of the models' softmax probabilities.
* Healthy vs diseased uses config.HEALTHY_THRESHOLD on the averaged
  "normal" probability (not plain argmax).
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
    if key == "other":
        return "Other / unlisted condition"
    if key == config.HEALTHY_CLASS_KEY:
        return "Healthy"
    return key.replace("_", " ").title()


class SubClassEnsemble:
    def __init__(self, model_paths=config.SUBCLASS_MODEL_PATHS):
        self.device = config.DEVICE
        self.classes = list(config.SUBCLASS_CLASSES)              # 13 (checkpoint heads)
        self.final_classes = list(config.SUBCLASS_FINAL_CLASSES)  # kept classes + "other"
        self.normal_idx = self.final_classes.index(config.HEALTHY_CLASS_KEY)
        self.transform = build_transform(
            config.SUBCLASS_IMG_SIZE, config.IMAGENET_MEAN, config.IMAGENET_STD
        )

        # 13 -> final merge matrix: p_final = p13 @ self.merge
        self.merge = np.zeros((len(self.classes), len(self.final_classes)), dtype=np.float32)
        for j, c in enumerate(self.classes):
            tgt = c if c in self.final_classes else "other"
            self.merge[j, self.final_classes.index(tgt)] = 1.0

        self.models: dict[str, nn.Module] = {}
        for arch, path in model_paths.items():
            ckpt = torch.load(path, map_location=self.device)
            state = ckpt["state"] if isinstance(ckpt, dict) and "state" in ckpt else ckpt

            if isinstance(ckpt, dict) and "classes" in ckpt:
                if list(ckpt["classes"]) != self.classes:
                    raise RuntimeError(
                        f"{arch}: class order in checkpoint differs from "
                        f"config.SUBCLASS_CLASSES -> {list(ckpt['classes'])}"
                    )

            model = _build_model(arch, len(self.classes))
            model.load_state_dict(state)
            model.to(self.device).eval()
            self.models[arch] = model

        if not self.models:
            raise RuntimeError("No sub-class models were loaded.")

    # ---------------------------------------------------------
    def get_cam_target(self):
        arch = (
            config.SUBCLASS_CAM_ARCH
            if config.SUBCLASS_CAM_ARCH in self.models
            else next(iter(self.models))
        )
        model = self.models[arch]
        layer = model.layer4[-1] if arch == "resnet50" else model.features[-1]
        return arch, model, layer

    # ---------------------------------------------------------
    def _decide(self, p: np.ndarray) -> int:
        """Index of the final class: healthy if p(normal) >= threshold, else best disease."""
        if p[self.normal_idx] >= config.HEALTHY_THRESHOLD:
            return self.normal_idx
        q = p.copy()
        q[self.normal_idx] = -1.0
        return int(np.argmax(q))

    @torch.no_grad()
    def predict(self, image_bytes: bytes) -> dict:
        image = bytes_to_pil_image(image_bytes)
        x = self.transform(image).unsqueeze(0).to(self.device)
        if config.SUBCLASS_TTA_FLIP:
            x = torch.cat([x, torch.flip(x, dims=[3])], dim=0)

        per_model = {}
        for arch, model in self.models.items():
            p13 = torch.softmax(model(x).float(), dim=1).cpu().numpy().mean(axis=0)
            per_model[arch] = p13 @ self.merge

        probs = np.mean(list(per_model.values()), axis=0)   # soft vote over final classes
        idx = self._decide(probs)
        key = self.final_classes[idx]
        is_healthy = idx == self.normal_idx
        group = config.SUBCLASS_TO_GROUP.get(key, "other")

        disease_idx = [i for i in range(len(self.final_classes)) if i != self.normal_idx]
        disease_idx.sort(key=lambda i: probs[i], reverse=True)
        top3 = [
            {
                "key": self.final_classes[i],
                "label": pretty_label(self.final_classes[i]),
                "confidence": float(probs[i]),
            }
            for i in disease_idx[:3]
        ]

        return {
            "is_healthy": is_healthy,
            "key": key,
            "label": pretty_label(key),
            "confidence": float(probs[idx]),
            "normal_prob": float(probs[self.normal_idx]),
            "group": group,
            "group_label": config.GROUP_LABELS[group],
            "top3": top3,
            "model_votes": {
                arch: self.final_classes[self._decide(p)] for arch, p in per_model.items()
            },
            "probs": {c: float(p) for c, p in zip(self.final_classes, probs)},
        }