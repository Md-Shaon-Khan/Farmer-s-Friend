"""
Whole-image vectorization + nearest-neighbor similarity search
(ConvNeXt-Tiny embeddings + cosine similarity). No object detection.
"""

import csv
from pathlib import Path

import numpy as np
import torch
from torch import nn
from PIL import Image

import config
from utils.image_utils import bytes_to_pil_image, build_transform


class ConvNeXtFeatureExtractor(nn.Module):
    def __init__(self, base_model: nn.Module):
        super().__init__()
        self.features = base_model.features
        self.avgpool = nn.AdaptiveAvgPool2d(1)

    def forward(self, x):
        x = self.features(x)
        x = self.avgpool(x)
        return torch.flatten(x, 1)


class SimilarityEngine:
    EMBED_DIM = 768  # ConvNeXt-Tiny pooled feature size

    def __init__(self, convnext_model: nn.Module):
        # convnext_model: the already-loaded ft_convnext_tiny model
        self.device = config.DEVICE
        self.extractor = ConvNeXtFeatureExtractor(convnext_model).to(self.device)
        self.extractor.eval()
        self.transform = build_transform(
            config.SIMILARITY_IMG_SIZE, config.IMAGENET_MEAN, config.IMAGENET_STD
        )

        self.gallery_paths: list[str] = []
        self.gallery_labels: list[str] = []
        self.gallery_embeddings: np.ndarray = np.zeros((0, self.EMBED_DIM), dtype=np.float32)

        self._load_or_build_gallery()

    def _load_or_build_gallery(self):
        cache_path = Path(config.SIMILARITY_CACHE_PATH)
        manifest_path = Path(config.SIMILARITY_MANIFEST_PATH)

        if cache_path.exists():
            data = np.load(cache_path, allow_pickle=True)
            self.gallery_embeddings = data["embeddings"]
            self.gallery_paths = data["paths"].tolist()
            self.gallery_labels = data["labels"].tolist()
            return

        if not manifest_path.exists():
            return

        paths, labels = [], []
        with open(manifest_path, newline="") as f:
            for row in csv.DictReader(f):
                paths.append(row["image_path"])
                labels.append(row["label"])

        embeddings = self._vectorize_paths(paths)

        cache_path.parent.mkdir(parents=True, exist_ok=True)
        np.savez(
            cache_path,
            embeddings=embeddings,
            paths=np.array(paths),
            labels=np.array(labels),
        )

        self.gallery_paths = paths
        self.gallery_labels = labels
        self.gallery_embeddings = embeddings

    @torch.no_grad()
    def _vectorize_paths(self, paths: list[str]) -> np.ndarray:
        vectors = []
        for path in paths:
            try:
                image = Image.open(path).convert("RGB")
                tensor = self.transform(image).unsqueeze(0).to(self.device)
                feat = self.extractor(tensor)
                feat = feat / feat.norm(p=2, dim=1, keepdim=True)
                vectors.append(feat.cpu().numpy()[0])
            except Exception:
                vectors.append(np.zeros(self.EMBED_DIM, dtype=np.float32))
        return np.array(vectors, dtype=np.float32)

    @torch.no_grad()
    def find_similar(self, image_bytes: bytes, top_k: int | None = None) -> list[dict]:
        if len(self.gallery_paths) == 0:
            return []

        top_k = top_k or config.SIMILARITY_TOP_K
        top_k = min(top_k, len(self.gallery_paths))

        image = bytes_to_pil_image(image_bytes)
        tensor = self.transform(image).unsqueeze(0).to(self.device)

        query = self.extractor(tensor)
        query = query / query.norm(p=2, dim=1, keepdim=True)
        query = query.cpu().numpy()

        similarities = (query @ self.gallery_embeddings.T)[0]
        top_indices = np.argsort(similarities)[::-1][:top_k]

        return [
            {
                "image_path": self.gallery_paths[i],
                "label": self.gallery_labels[i],
                "similarity": round(float(similarities[i]), 4),
            }
            for i in top_indices
        ]