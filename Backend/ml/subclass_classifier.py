"""
13-class sub-class ensemble (ConvNeXt-Tiny + EfficientNet-B3 + ResNet-50).

Mirrors Fine_Tuning_Paddy_Sub_Class.ipynb:
  * same architectures / classifier heads (so the checkpoints load),
  * 384x384 resize + ImageNet normalisation,
  * soft voting = mean of each model's softmax probabilities.

Each of the 13 sub-classes is mapped to a broad group
(bacterial / fungal / viral / normal / other) via config.SUBCLASS_TO_GROUP,
so it can be compared with the 4-class pathogen model.
"""

import numpy as np
import torch
from torch import nn
from torchvision import models

import config
from utils.image_utils import bytes_to_pil_image, build_transform


def _build_model(arch: str, num_classes: int, drop: float = 0.3) -> nn.Module:
    """Same heads as the notebook's build_eval_model (state-dict keys must match)."""
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
    return key.replace("_", " ").title()


class SubClassEnsemble:
    def __init__(self, model_paths=config.SUBCLASS_MODEL_PATHS):
        self.device = config.DEVICE
        self.classes = list(config.SUBCLASS_CLASSES)
        self.transform = build_transform(
            config.SUBCLASS_IMG_SIZE, config.IMAGENET_MEAN, config.IMAGENET_STD
        )

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
    # Grad-CAM target (model + layer) used by ml/spot_detector.py
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

    @torch.no_grad()
    def predict(self, image_bytes: bytes, exclude_normal: bool = False) -> dict:
        """
        exclude_normal=True: ignore the "normal" class and renormalise, i.e.
        "which DISEASE is it?". Used when the pathogen model has already
        decided the leaf is diseased (it is the better healthy/diseased judge).
        """
        image = bytes_to_pil_image(image_bytes)
        x = self.transform(image).unsqueeze(0).to(self.device)
        normal_idx = self.classes.index("normal")

        def _disease_only(p):
            if not exclude_normal:
                return p
            p = p.copy()
            p[normal_idx] = 0.0
            return p / p.sum()

        per_model = {}
        for arch, model in self.models.items():
            p = torch.softmax(model(x).float(), dim=1)[0].cpu().numpy()
            per_model[arch] = _disease_only(p)

        probs = np.mean(list(per_model.values()), axis=0)  # soft voting
        idx = int(np.argmax(probs))
        key = self.classes[idx]
        group = config.SUBCLASS_TO_GROUP[key]

        top3 = [
            {
                "key": self.classes[i],
                "label": pretty_label(self.classes[i]),
                "confidence": float(probs[i]),
            }
            for i in np.argsort(probs)[::-1][:3]
        ]

        return {
            "index": idx,
            "key": key,
            "label": pretty_label(key),
            "confidence": float(probs[idx]),
            "group": group,
            "group_label": config.GROUP_LABELS[group],
            "top3": top3,
            "model_votes": {
                arch: self.classes[int(np.argmax(p))] for arch, p in per_model.items()
            },
        }