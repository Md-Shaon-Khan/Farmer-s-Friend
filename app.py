import os
import io
import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import keras
import tensorflow as tf
from typing import Dict

os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

# ---------- FastAPI app ----------
app = FastAPI(title="Paddy Disease Detection API", docs_url="/docs")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Labels & Class Info ----------
LABEL_NAMES_EN = ['Bacterial', 'Fungal', 'Normal', 'Others', 'Viral']

CLASS_INFO = {
    'Bacterial': {
        'bn': 'ব্যাকটেরিয়াল রোগ', 'color': '#c0392b', 'emoji': '🦠',
        'severity': 'উচ্চ',
        'description': 'ব্যাকটেরিয়াল ব্লাইট, লিফ স্ট্রিক বা প্যানিকেল ব্লাইট হতে পারে।',
        'treatment': 'কপার জাতীয় ব্যাকটেরিসাইড স্প্রে করুন। আক্রান্ত পাতা তাৎক্ষণিকভাবে সরান।'
    },
    'Fungal': {
        'bn': 'ছত্রাকজনিত রোগ', 'color': '#d35400', 'emoji': '🍄',
        'severity': 'মাঝারি-উচ্চ',
        'description': 'ব্লাস্ট, ব্রাউন স্পট, শীথ ব্লাইট হতে পারে। আর্দ্র আবহাওয়ায় দ্রুত বাড়ে।',
        'treatment': 'ট্রাইসাইক্লাজল বা প্রোপিকোনাজল জাতীয় ছত্রাকনাশক স্প্রে করুন।'
    },
    'Normal': {
        'bn': 'স্বাভাবিক', 'color': '#1e7e34', 'emoji': '✅',
        'severity': 'কোনো রোগ নেই',
        'description': 'আপনার ধানগাছ সম্পূর্ণ সুস্থ।',
        'treatment': 'চিকিৎসার প্রয়োজন নেই। নিয়মিত পরিচর্যা চালিয়ে যান।'
    },
    'Others': {
        'bn': 'অন্যান্য (পোকা)', 'color': '#6c3483', 'emoji': '🐛',
        'severity': 'মাঝারি',
        'description': 'পোকামাকড়ের আক্রমণ: হিসপা, গান্ধী পোকা ইত্যাদি।',
        'treatment': 'ক্লোরপাইরিফস বা কার্বোফুরান জাতীয় কীটনাশক ব্যবহার করুন।'
    },
    'Viral': {
        'bn': 'ভাইরাসজনিত রোগ', 'color': '#922b21', 'emoji': '⚠️',
        'severity': 'অত্যন্ত উচ্চ',
        'description': 'টুংরো ভাইরাস – গ্রিন লিফহপার দ্বারা দ্রুত ছড়ায়।',
        'treatment': 'আক্রান্ত গাছ তুলে পুড়িয়ে ফেলুন। প্রতিরোধী জাতের বীজ রোপণ করুন।'
    }
}

MODEL_WEIGHTS = {"EfficientNetB0": 0.60, "ResNet50": 0.25, "DenseNet121": 0.15}
DEFAULT_SIZE = (224, 224)

# ---------- Gatekeeper Dual Threshold ----------
# Training শেষে gatekeeper_v4_config.json এর values দিয়ে update করো।
# prob >= PADDY_THRESHOLD     → paddy (disease model চালাও)
# prob <= NOT_PADDY_THRESHOLD → not_paddy (reject)
# মাঝখানে                    → uncertain (warning সহ disease model চালাও)
PADDY_THRESHOLD     = 0.55  # V3 threshold analysis থেকে confirmed (macro F1: 0.8210)
NOT_PADDY_THRESHOLD = 0.50  # PADDY_THRESHOLD - 0.15

# ---------- Disease Model loading ----------
_models = {}

def load_models():
    global _models
    if _models:
        return _models
    model_paths = {
        "EfficientNetB0": "final_EfficientNetB0.keras",
        "ResNet50":        "final_ResNet50.keras",
        "DenseNet121":     "final_DenseNet121.keras",
    }
    for name, path in model_paths.items():
        if not os.path.exists(path):
            print(f"Warning: {path} not found")
            continue
        try:
            _models[name] = keras.models.load_model(path, compile=False)
            print(f"✅ {name} loaded")
        except Exception as e:
            print(f"Failed to load {name}: {e}")
    return _models

# ---------- Gatekeeper Model loading ----------
_gatekeeper = None

def load_gatekeeper():
    global _gatekeeper
    if _gatekeeper:
        return _gatekeeper
    path = "gatekeeper_model.h5"
    if not os.path.exists(path):
        print("Warning: gatekeeper_model.h5 not found — gatekeeper skipped")
        return None
    try:
        # V3 standard binary_crossentropy দিয়ে train হয়েছে, compile=False যথেষ্ট
        _gatekeeper = tf.keras.models.load_model(
            path,
            compile=False
        )
        print("✅ Gatekeeper model loaded")
    except Exception as e:
        print(f"Failed to load gatekeeper: {e}")
    return _gatekeeper

# ---------- Startup ----------
@app.on_event("startup")
async def startup():
    load_models()
    load_gatekeeper()

# ---------- Gatekeeper check — Dual Threshold ----------
def check_gatekeeper(pil_image: Image.Image) -> dict:
    """
    Returns:
        status: "paddy" | "not_paddy" | "uncertain"
        confidence: float (0–100)
        warning: str  (uncertain zone এ Bengali warning message)
    """
    gk = load_gatekeeper()
    if gk is None:
        # gatekeeper নেই → সরাসরি disease model এ যাও
        return {"status": "paddy", "confidence": 100.0, "warning": ""}

    img = pil_image.convert("RGB").resize((224, 224), Image.LANCZOS)
    x   = np.expand_dims(np.array(img, dtype=np.float32) / 255.0, axis=0)
    prob = float(gk.predict(x, verbose=0)[0][0])
    # prob: 0.0 = not_paddy, 1.0 = paddy

    conf_pct = round(prob * 100, 1)

    if prob >= PADDY_THRESHOLD:
        return {"status": "paddy", "confidence": conf_pct, "warning": ""}

    elif prob <= NOT_PADDY_THRESHOLD:
        return {
            "status":     "not_paddy",
            "confidence": conf_pct,
            "warning":    "এটি ধান গাছের ছবি নয়। অনুগ্রহ করে ধান গাছের পাতা বা গাছের স্পষ্ট ছবি দিন।"
        }

    else:
        # Uncertain zone — disease model চালাবে কিন্তু user কে সতর্ক করবে
        return {
            "status":     "uncertain",
            "confidence": conf_pct,
            "warning":    f"⚠️ ছবিটি ধান গাছের কিনা নিশ্চিত হওয়া যাচ্ছে না (নিশ্চয়তা: {conf_pct}%)। ফলাফল সঠিক নাও হতে পারে।"
        }

# ---------- Preprocessing ----------
def preprocess(pil_image: Image.Image, model_name: str, size=(224, 224)) -> np.ndarray:
    img = pil_image.convert("RGB").resize(size, Image.LANCZOS)
    x = np.array(img, dtype=np.float32)
    if model_name == "ResNet50":
        x = x[..., ::-1].copy()
        x[..., 0] -= 103.939
        x[..., 1] -= 116.779
        x[..., 2] -= 123.680
    elif model_name == "DenseNet121":
        x /= 255.0
        x[..., 0] = (x[..., 0] - 0.485) / 0.229
        x[..., 1] = (x[..., 1] - 0.456) / 0.224
        x[..., 2] = (x[..., 2] - 0.406) / 0.225
    return np.expand_dims(x, 0)

# ---------- Ensemble prediction ----------
def ensemble_predict(pil_image: Image.Image, models: Dict) -> Dict:
    n_classes = len(LABEL_NAMES_EN)
    weighted_probs = np.zeros(n_classes, dtype=np.float32)
    active_weight  = 0.0
    for name, model in models.items():
        try:
            h, w = model.input_shape[1], model.input_shape[2]
            size = (h, w) if (h and w) else DEFAULT_SIZE
        except Exception:
            size = DEFAULT_SIZE
        tensor = preprocess(pil_image, name, size)
        probs  = model.predict(tensor, verbose=0)[0]
        w      = MODEL_WEIGHTS.get(name, 0.0)
        weighted_probs += w * probs
        active_weight  += w
    if active_weight > 0:
        weighted_probs /= active_weight
    idx        = int(np.argmax(weighted_probs))
    disease_en = LABEL_NAMES_EN[idx]
    confidence = float(weighted_probs[idx]) * 100
    info       = CLASS_INFO[disease_en]
    return {
        "disease_en":    disease_en,
        "disease_bn":    info["bn"],
        "confidence":    confidence,
        "color":         info["color"],
        "emoji":         info["emoji"],
        "severity":      info["severity"],
        "description":   info["description"],
        "treatment":     info["treatment"],
        "probabilities": weighted_probs.tolist(),
        "all_classes":   LABEL_NAMES_EN,
    }

# ---------- Routes ----------
@app.post("/api/predict")
async def predict(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(('png', 'jpg', 'jpeg')):
        raise HTTPException(400, "Only PNG/JPG/JPEG images allowed")
    try:
        contents = await file.read()
        pil_img  = Image.open(io.BytesIO(contents))

        # Step 1: Gatekeeper — dual threshold check
        gate = check_gatekeeper(pil_img)

        if gate["status"] == "not_paddy":
            # Reject — frontend এ "ধান গাছের ছবি দিন" দেখাবে
            return {
                "is_paddy":              False,
                "gatekeeper_confidence": gate["confidence"],
                "message":               gate["warning"],
            }

        # Step 2: Disease prediction (paddy + uncertain দুটোর জন্যই)
        if not _models:
            raise HTTPException(500, "Disease models not loaded")

        result = ensemble_predict(pil_img, _models)
        result["is_paddy"]              = True
        result["gatekeeper_confidence"] = gate["confidence"]
        result["gatekeeper_status"]     = gate["status"]   # "paddy" or "uncertain"

        # uncertain হলে frontend warning দেখাবে
        result["gatekeeper_warning"] = gate["warning"]  # "" if paddy, message if uncertain

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Prediction error: {str(e)}")

@app.get("/api/health")
async def health():
    return {
        "status":             "ok",
        "models_loaded":      len(_models),
        "gatekeeper_loaded":  _gatekeeper is not None,
        "paddy_threshold":    PADDY_THRESHOLD,
        "not_paddy_threshold": NOT_PADDY_THRESHOLD,
    }