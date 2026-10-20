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
    "convnext_tiny": SUBCLASS_DIR / "ConvNeXt-Tiny_adapted.pth",
    "efficientnet_b3": SUBCLASS_DIR / "EfficientNet-B3_adapted.pth",
    "resnet50": SUBCLASS_DIR / "ResNet-50_adapted.pth",
}

# The 13 heads inside the checkpoints. Order MUST match the checkpoints.
SUBCLASS_CLASSES = [
    "bacterial_leaf_blight", "bacterial_leaf_streak", "bacterial_panicle_blight",
    "blast", "brown_spot", "downy_mildew", "false_smut", "leaf_scald",
    "narrow_brown_spot", "normal", "sheath_blight", "tungro", "other",
]
SUBCLASS_IMG_SIZE = 384

# Classes to KEEP and SHOW to the user (8 targeted classes, panicle blight excluded)
SUBCLASS_KEEP_CLASSES = [
    "bacterial_leaf_blight",
    "bacterial_leaf_streak",
    "blast",
    "brown_spot",
    "sheath_blight",
    "tungro",
    "false_smut",
    "normal",
]
SUBCLASS_FINAL_CLASSES = list(SUBCLASS_KEEP_CLASSES)
SUBCLASS_MERGE_INTO_OTHER = []

SUBCLASS_TO_GROUP = {
    "bacterial_leaf_blight": "bacterial",
    "bacterial_leaf_streak": "bacterial",
    "blast": "fungal",
    "brown_spot": "fungal",
    "sheath_blight": "fungal",
    "tungro": "viral",
    "false_smut": "fungal",
    "normal": "normal",
}
GROUP_LABELS = {
    "bacterial": "Bacterial infection",
    "fungal": "Fungal infection",
    "viral": "Viral infection",
    "normal": "Healthy",
}

# Grad-CAM source model
SUBCLASS_CAM_ARCH = "resnet50"

# ---------- Thresholds & Messages ----------
HEALTHY_THRESHOLD = 0.28
DISEASE_MIN_CONFIDENCE = 0.50

OUT_OF_SCOPE_MESSAGE = (
    "This disease is not in our model's supported list. "
    "Please provide a clearer, closer image of the affected leaf area for a more accurate diagnosis."
)

# Average predictions of the image and its horizontal flip (more stable).
SUBCLASS_TTA_FLIP = True

# ---------- not paddy ----------
PREDICT_EVEN_IF_NOT_PADDY = True