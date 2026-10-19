"""
Central configuration for the paddy classifier backend.
Disease prediction now uses ONLY the 3-model sub-class ensemble
(ConvNeXt-Tiny + EfficientNet-B3 + ResNet-50).
"""

from pathlib import Path
import torch

BASE_DIR = Path(__file__).resolve().parent

# ---------- paddy / not-paddy (MobileNetV3-Small) ----------
PADDY_MODEL_PATH = BASE_DIR / "models" / "paddy_or_not" / "best_mobilenet_v3_small.pth"
PADDY_CLASSES = ["not_paddy", "paddy"]
PADDY_IMG_SIZE = 224
PADDY_CONFIDENCE_THRESHOLD = 0.85

HEALTHY_CLASS_KEY = "normal"

# ---------- shared preprocessing ----------
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

# ---------- runtime ----------
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

ALLOWED_ORIGINS = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "null",  # file:// origin
]

# ---------- reference-image similarity ----------
SIMILARITY_IMG_SIZE = 384
SIMILARITY_TOP_K = 5
REFERENCE_GALLERY_DIR = BASE_DIR / "data" / "reference_images"
SIMILARITY_MANIFEST_PATH = REFERENCE_GALLERY_DIR / "manifest.csv"
SIMILARITY_CACHE_PATH = BASE_DIR / "data" / "reference_embeddings.npz"
REFERENCE_IMAGE_URL_PREFIX = "/static/reference"

# =====================================================================
# Sub-class ensemble
# =====================================================================
SUBCLASS_DIR = BASE_DIR / "models" / "disease_classify"
SUBCLASS_MODEL_PATHS = {
    "convnext_tiny": SUBCLASS_DIR / "ft_convnext_tiny.pt",
    "efficientnet_b3": SUBCLASS_DIR / "ft_efficientnet_b3.pt",
    "resnet50": SUBCLASS_DIR / "ft_resnet50.pt",
}

# The 13 heads inside the checkpoints. Order MUST match the checkpoints.
SUBCLASS_CLASSES = [
    "bacterial_leaf_blight", "bacterial_leaf_streak", "bacterial_panicle_blight",
    "blast", "brown_spot", "downy_mildew", "false_smut", "leaf_scald",
    "narrow_brown_spot", "normal", "sheath_blight", "tungro", "other",
]
SUBCLASS_IMG_SIZE = 384

# Classes we KEEP as separate outputs ("normal" = healthy). Everything else
# in the checkpoint is summed into "other" at inference (no retraining).
# NOTE: "leaf_smut" is not a head in the current checkpoints, so it is
# skipped automatically (see SUBCLASS_FINAL_CLASSES below).
SUBCLASS_KEEP_CLASSES = [
    "bacterial_leaf_blight", "brown_spot", "narrow_brown_spot", "blast",
    "tungro", "sheath_blight", "leaf_smut", "normal",
]
SUBCLASS_FINAL_CLASSES = (
    [c for c in SUBCLASS_KEEP_CLASSES if c in SUBCLASS_CLASSES] + ["other"]
)
SUBCLASS_MERGE_INTO_OTHER = [
    c for c in SUBCLASS_CLASSES if c not in SUBCLASS_FINAL_CLASSES
]

SUBCLASS_TO_GROUP = {
    "bacterial_leaf_blight": "bacterial",
    "blast": "fungal",
    "brown_spot": "fungal",
    "narrow_brown_spot": "fungal",
    "sheath_blight": "fungal",
    "leaf_smut": "fungal",
    "tungro": "viral",
    "normal": "normal",
    "other": "other",
}
GROUP_LABELS = {
    "bacterial": "Bacterial infection",
    "fungal": "Fungal infection",
    "viral": "Viral infection",
    "normal": "Healthy",
    "other": "Other / unlisted condition",
}

# Grad-CAM source model (ResNet-50 layer4[-1]).
SUBCLASS_CAM_ARCH = "resnet50"

# ---------- healthy vs diseased decision ----------
# The leaf is called HEALTHY when the ensemble's averaged "normal" probability
# is >= this value (instead of plain argmax, which over-called disease).
# Raise it if healthy leaves are still called diseased; lower it if real
# diseases are being called healthy. Tune on your validation set.
HEALTHY_THRESHOLD = 0.30

# Average predictions of the image and its horizontal flip (more stable).
SUBCLASS_TTA_FLIP = True

# ---------- not paddy ----------
PREDICT_EVEN_IF_NOT_PADDY = True