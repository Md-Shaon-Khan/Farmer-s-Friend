import os
import io
import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import keras
from typing import Dict, List

os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

# ---------- Labels & Class Info (same as original) ----------
LABEL_NAMES_EN = ['Bacterial', 'Fungal', 'Normal', 'Others', 'Viral']

CLASS_INFO = {
    'Bacterial': {
        'bn': 'ব্যাকটেরিয়াল রোগ',
        'color': '#c0392b',
        'glow': 'rgba(192,57,43,0.18)',
        'emoji': '🦠',
        'severity': 'উচ্চ',
        'description': 'ব্যাকটেরিয়াল ব্লাইট, লিফ স্ট্রিক বা প্যানিকেল ব্লাইট হতে পারে। ধানের জন্য অত্যন্ত মারাত্মক।',
        'treatment': 'কপার জাতীয় ব্যাকটেরিসাইড স্প্রে করুন। আক্রান্ত পাতা তাৎক্ষণিকভাবে সরান। জমিতে সঠিক পানি নিষ্কাশন নিশ্চিত করুন।'
    },
    'Fungal': {
        'bn': 'ছত্রাকজনিত রোগ',
        'color': '#d35400',
        'severity': 'মাঝারি-উচ্চ',
        'emoji': '🍄',
        'description': 'ব্লাস্ট, ব্রাউন স্পট, শীথ ব্লাইট বা লিফ স্মাট হতে পারে। আর্দ্র ও উষ্ণ আবহাওয়ায় দ্রুত বাড়ে।',
        'treatment': 'ট্রাইসাইক্লাজল বা প্রোপিকোনাজল জাতীয় ছত্রাকনাশক স্প্রে করুন। পরবর্তী মৌসুমে বীজ শোধন নিশ্চিত করুন।'
    },
    'Normal': {
        'bn': 'স্বাভাবিক',
        'color': '#1e7e34',
        'severity': 'কোনো রোগ নেই',
        'emoji': '✅',
        'description': 'আপনার ধানগাছ সম্পূর্ণ সুস্থ ও স্বাভাবিক। কোনো রোগের লক্ষণ শনাক্ত হয়নি।',
        'treatment': 'চিকিৎসার প্রয়োজন নেই। নিয়মিত পরিচর্যা, সার ব্যবস্থাপনা ও সেচ চালিয়ে যান।'
    },
    'Others': {
        'bn': 'অন্যান্য (পোকা)',
        'color': '#6c3483',
        'severity': 'মাঝারি',
        'emoji': '🐛',
        'description': 'পোকামাকড়ের আক্রমণ: ধানের পাতা মোড়ানো পোকা, হিসপা, গান্ধী পোকা ইত্যাদি।',
        'treatment': 'ক্লোরপাইরিফস বা কার্বোফুরান জাতীয় কীটনাশক ব্যবহার করুন। আক্রান্ত অংশ কেটে পুড়িয়ে ফেলুন।'
    },
    'Viral': {
        'bn': 'ভাইরাসজনিত রোগ',
        'color': '#922b21',
        'severity': 'অত্যন্ত উচ্চ',
        'emoji': '⚠️',
        'description': 'টুংরো ভাইরাস – ধানের সবচেয়ে ভয়াবহ ভাইরাস রোগ। গ্রিন লিফহপার দ্বারা দ্রুত ছড়ায়।',
        'treatment': 'আক্রান্ত গাছ তুলে পুড়িয়ে ফেলুন। গ্রিন লিফহপার দমনে কীটনাশক ব্যবহার করুন। প্রতিরোধী জাতের বীজ রোপণ করুন।'
    }
}

MODEL_WEIGHTS = {"EfficientNetB0": 0.60, "ResNet50": 0.25, "DenseNet121": 0.15}
DEFAULT_SIZE = (224, 224)

# ---------- Model loading ----------
_models = {}

def load_models():
    global _models
    if _models:
        return _models
    model_paths = {
        "EfficientNetB0": "final_EfficientNetB0.keras",
        "ResNet50": "final_ResNet50.keras",
        "DenseNet121": "final_DenseNet121.keras",
    }
    for name, path in model_paths.items():
        if not os.path.exists(path):
            print(f"Warning: {path} not found")
            continue
        try:
            _models[name] = keras.models.load_model(path, compile=False)
        except Exception as e:
            print(f"Failed to load {name}: {e}")
    return _models

# ---------- Preprocessing (exactly as original) ----------
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
    active_weight = 0.0
    for name, model in models.items():
        try:
            h, w = model.input_shape[1], model.input_shape[2]
            size = (h, w) if (h and w) else DEFAULT_SIZE
        except:
            size = DEFAULT_SIZE
        tensor = preprocess(pil_image, name, size)
        probs = model.predict(tensor, verbose=0)[0]
        w = MODEL_WEIGHTS.get(name, 0.0)
        weighted_probs += w * probs
        active_weight += w
    if active_weight > 0:
        weighted_probs /= active_weight
    idx = int(np.argmax(weighted_probs))
    disease_en = LABEL_NAMES_EN[idx]
    confidence = float(weighted_probs[idx]) * 100
    info = CLASS_INFO[disease_en]
    return {
        "disease_en": disease_en,
        "disease_bn": info["bn"],
        "confidence": confidence,
        "color": info["color"],
        "emoji": info["emoji"],
        "severity": info["severity"],
        "description": info["description"],
        "treatment": info["treatment"],
        "probabilities": weighted_probs.tolist(),
        "all_classes": LABEL_NAMES_EN
    }

# ---------- FastAPI app ----------
app = FastAPI(title="Paddy Disease Detection API", docs_url="/docs")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    load_models()

@app.post("/api/predict")
async def predict(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(('png', 'jpg', 'jpeg')):
        raise HTTPException(400, "Only PNG/JPG/JPEG images allowed")
    try:
        contents = await file.read()
        pil_img = Image.open(io.BytesIO(contents))
        if not _models:
            raise HTTPException(500, "Models not loaded")
        result = ensemble_predict(pil_img, _models)
        return result
    except Exception as e:
        raise HTTPException(500, f"Prediction error: {str(e)}")

@app.get("/api/health")
async def health():
    return {"status": "ok", "models_loaded": len(_models)}