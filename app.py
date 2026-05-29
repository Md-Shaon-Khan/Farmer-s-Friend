# import os
# import sys
# import keras
# os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
# os.environ["TF_CPP_MIN_LOG_LEVEL"]  = "3"

# import warnings
# warnings.filterwarnings("ignore")

# import streamlit as st
# import numpy as np
# from PIL import Image

# # ──────────────────────────────────────────────────────────────────────────────
# # Labels & Class Info
# # ──────────────────────────────────────────────────────────────────────────────
# LABEL_NAMES_EN = ['Bacterial', 'Fungal', 'Normal', 'Others', 'Viral']
# LABEL_NAMES_BN = ['ব্যাকটেরিয়াল রোগ', 'ছত্রাকজনিত রোগ', 'স্বাভাবিক', 'অন্যান্য', 'ভাইরাসজনিত রোগ']

# CLASS_INFO = {
#     'Bacterial': {
#         'bn'         : 'ব্যাকটেরিয়াল রোগ',
#         'color'      : '#c0392b',
#         'glow'       : 'rgba(192,57,43,0.18)',
#         'badge_bg'   : '#fdf2f0',
#         'emoji'      : '🦠',
#         'icon'       : '🔴',
#         'severity'   : 'উচ্চ',
#         'sev_color'  : '#c0392b',
#         'sev_bg'     : '#fdf2f0',
#         'description': 'ব্যাকটেরিয়াল ব্লাইট, লিফ স্ট্রিক বা প্যানিকেল ব্লাইট হতে পারে। ধানের জন্য অত্যন্ত মারাত্মক।',
#         'treatment'  : 'কপার জাতীয় ব্যাকটেরিসাইড স্প্রে করুন। আক্রান্ত পাতা তাৎক্ষণিকভাবে সরান। জমিতে সঠিক পানি নিষ্কাশন নিশ্চিত করুন।'
#     },
#     'Fungal': {
#         'bn'         : 'ছত্রাকজনিত রোগ',
#         'color'      : '#d35400',
#         'glow'       : 'rgba(211,84,0,0.18)',
#         'badge_bg'   : '#fef5ec',
#         'emoji'      : '🍄',
#         'icon'       : '🟠',
#         'severity'   : 'মাঝারি-উচ্চ',
#         'sev_color'  : '#d35400',
#         'sev_bg'     : '#fef5ec',
#         'description': 'ব্লাস্ট, ব্রাউন স্পট, শীথ ব্লাইট বা লিফ স্মাট হতে পারে। আর্দ্র ও উষ্ণ আবহাওয়ায় দ্রুত বাড়ে।',
#         'treatment'  : 'ট্রাইসাইক্লাজল বা প্রোপিকোনাজল জাতীয় ছত্রাকনাশক স্প্রে করুন। পরবর্তী মৌসুমে বীজ শোধন নিশ্চিত করুন।'
#     },
#     'Normal': {
#         'bn'         : 'স্বাভাবিক',
#         'color'      : '#1e7e34',
#         'glow'       : 'rgba(30,126,52,0.18)',
#         'badge_bg'   : '#eaf5ee',
#         'emoji'      : '✅',
#         'icon'       : '🟢',
#         'severity'   : 'কোনো রোগ নেই',
#         'sev_color'  : '#1e7e34',
#         'sev_bg'     : '#eaf5ee',
#         'description': 'আপনার ধানগাছ সম্পূর্ণ সুস্থ ও স্বাভাবিক। কোনো রোগের লক্ষণ শনাক্ত হয়নি।',
#         'treatment'  : 'চিকিৎসার প্রয়োজন নেই। নিয়মিত পরিচর্যা, সার ব্যবস্থাপনা ও সেচ চালিয়ে যান।'
#     },
#     'Others': {
#         'bn'         : 'অন্যান্য',
#         'color'      : '#6c3483',
#         'glow'       : 'rgba(108,52,131,0.18)',
#         'badge_bg'   : '#f5eef8',
#         'emoji'      : '🐛',
#         'icon'       : '🟣',
#         'severity'   : 'মাঝারি',
#         'sev_color'  : '#6c3483',
#         'sev_bg'     : '#f5eef8',
#         'description': 'পোকামাকড়ের আক্রমণ: ধানের পাতা মোড়ানো পোকা, হিসপা, গান্ধী পোকা ইত্যাদি।',
#         'treatment'  : 'ক্লোরপাইরিফস বা কার্বোফুরান জাতীয় কীটনাশক ব্যবহার করুন। আক্রান্ত অংশ কেটে পুড়িয়ে ফেলুন।'
#     },
#     'Viral': {
#         'bn'         : 'ভাইরাসজনিত রোগ',
#         'color'      : '#922b21',
#         'glow'       : 'rgba(146,43,33,0.22)',
#         'badge_bg'   : '#fce8e6',
#         'emoji'      : '⚠️',
#         'icon'       : '🔴',
#         'severity'   : 'অত্যন্ত উচ্চ',
#         'sev_color'  : '#922b21',
#         'sev_bg'     : '#fce8e6',
#         'description': 'টুংরো ভাইরাস – ধানের সবচেয়ে ভয়াবহ ভাইরাস রোগ। গ্রিন লিফহপার দ্বারা দ্রুত ছড়ায়।',
#         'treatment'  : 'আক্রান্ত গাছ তুলে পুড়িয়ে ফেলুন। গ্রিন লিফহপার দমনে কীটনাশক ব্যবহার করুন। প্রতিরোধী জাতের বীজ রোপণ করুন।'
#     }
# }

# MODEL_WEIGHTS  = {"EfficientNetB0": 0.60, "ResNet50": 0.25, "DenseNet121": 0.15}
# DEFAULT_SIZE   = (224, 224)

# # ──────────────────────────────────────────────────────────────────────────────
# # Model Loading
# # ──────────────────────────────────────────────────────────────────────────────
# _MODELS_CACHE = {}

# def load_models():
#     if _MODELS_CACHE:
#         return _MODELS_CACHE['models'], _MODELS_CACHE['failed']
    
#     import keras

#     model_paths = {
#         "EfficientNetB0": "final_EfficientNetB0.keras",
#         "ResNet50"       : "final_ResNet50.keras",
#         "DenseNet121"    : "final_DenseNet121.keras",
#     }

#     models, failed = {}, []

#     for name, path in model_paths.items():
#         if not os.path.exists(path):
#             failed.append(name)
#             continue
#         try:
#             model = keras.models.load_model(path, compile=False)
#             models[name] = model
#         except Exception as exc:
#             st.warning(f"⚠️ **{name}** লোড ব্যর্থ: `{str(exc)[:120]}`")
#             failed.append(name)

#     if not models:
#         st.error("❌ কোনো মডেলই লোড হয়নি।")
#         st.stop()

#     _MODELS_CACHE['models'] = models
#     _MODELS_CACHE['failed'] = failed
    
#     return models, failed


# # ──────────────────────────────────────────────────────────────────────────────
# # Preprocessing
# # ──────────────────────────────────────────────────────────────────────────────
# def preprocess(pil_image: Image.Image, model_name: str, size=(224, 224)) -> np.ndarray:
#     img = pil_image.convert("RGB").resize(size, Image.LANCZOS)
#     x   = np.array(img, dtype=np.float32)

#     if model_name == "EfficientNetB0":
#         pass
#     elif model_name == "ResNet50":
#         x = x[..., ::-1].copy()
#         x[..., 0] -= 103.939
#         x[..., 1] -= 116.779
#         x[..., 2] -= 123.680
#     elif model_name == "DenseNet121":
#         x /= 255.0
#         x[..., 0] = (x[..., 0] - 0.485) / 0.229
#         x[..., 1] = (x[..., 1] - 0.456) / 0.224
#         x[..., 2] = (x[..., 2] - 0.406) / 0.225

#     return np.expand_dims(x, 0)


# # ──────────────────────────────────────────────────────────────────────────────
# # Ensemble Prediction
# # ──────────────────────────────────────────────────────────────────────────────
# def ensemble_predict(pil_image: Image.Image, models: dict):
#     n_classes       = len(LABEL_NAMES_EN)
#     weighted_probs  = np.zeros(n_classes, dtype=np.float32)
#     individual      = {}
#     active_weight   = 0.0

#     for name, model in models.items():
#         try:
#             ishape = model.input_shape
#             if isinstance(ishape, list):
#                 ishape = ishape[0]
#             h, w = ishape[1], ishape[2]
#             size = (h, w) if (h and w) else DEFAULT_SIZE
#         except Exception:
#             size = DEFAULT_SIZE

#         tensor = preprocess(pil_image, name, size)
#         probs  = model.predict(tensor, verbose=0)[0]

#         w = MODEL_WEIGHTS.get(name, 0.0)
#         weighted_probs += w * probs
#         active_weight  += w

#         pred_en = LABEL_NAMES_EN[int(np.argmax(probs))]
#         individual[name] = {
#             "class_en"  : pred_en,
#             "class_bn"  : CLASS_INFO[pred_en]["bn"],
#             "color"     : CLASS_INFO[pred_en]["color"],
#             "confidence": float(np.max(probs)) * 100,
#             "probs"     : probs,
#         }

#     if active_weight > 0:
#         weighted_probs /= active_weight

#     idx = int(np.argmax(weighted_probs))
#     return LABEL_NAMES_EN[idx], float(weighted_probs[idx]) * 100, weighted_probs, individual


# # ══════════════════════════════════════════════════════════════════════════════
# #  STREAMLIT UI
# # ══════════════════════════════════════════════════════════════════════════════
# st.set_page_config(
#     page_title="ধান রোগ শনাক্তকরণ",
#     page_icon="🌾",
#     layout="wide",
#     initial_sidebar_state="collapsed",
# )

# # ─────────────────────────────────────────────────────────────────────────────
# # GLOBAL CSS — Cinematic Bangladeshi Paddy Field Aesthetic
# # ─────────────────────────────────────────────────────────────────────────────
# st.markdown("""
# <style>
# @import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@300;400;500;600;700&family=Noto+Sans+Bengali:wght@300;400;500;600;700&family=Lora:ital,wght@0,400;0,500;0,700;1,400&display=swap');

# /* ── Reset & Root ─────────────────────────────────────────────────────── */
# :root {
#   --field-dark:    #0d1f0e;
#   --field-deep:    #142615;
#   --field-mid:     #1e4020;
#   --leaf-bright:   #2d6a2f;
#   --leaf-light:    #4a8c3f;
#   --sprout:        #6db560;
#   --paddy-gold:    #c8973a;
#   --paddy-light:   #e8c46a;
#   --straw:         #f0d98a;
#   --cream:         #fdfaf3;
#   --earth:         #3d2b1a;
#   --earth-light:   #6b4c2a;
#   --sky-dawn:      #b8d4b0;
#   --mist:          rgba(253,250,243,0.92);
#   --card-bg:       rgba(253,250,243,0.94);
#   --card-border:   rgba(200,151,58,0.22);
#   --shadow-soft:   0 4px 32px rgba(13,31,14,0.14);
#   --shadow-card:   0 2px 24px rgba(13,31,14,0.10);
#   --font-bangla:   'Hind Siliguri', 'Noto Sans Bengali', sans-serif;
#   --font-serif:    'Lora', Georgia, serif;
# }

# /* ── Base ──────────────────────────────────────────────────────────────── */
# html, body,
# [data-testid="stAppViewContainer"],
# [data-testid="stMain"] {
#   font-family: var(--font-bangla) !important;
#   color: var(--field-dark) !important;
# }

# /* ── Cinematic background with layered natural gradients ─────────────── */
# [data-testid="stAppViewContainer"] {
#   background:
#     radial-gradient(ellipse 200% 80% at 50% -10%, rgba(45,106,47,0.18) 0%, transparent 55%),
#     radial-gradient(ellipse 100% 60% at 90% 110%, rgba(200,151,58,0.12) 0%, transparent 50%),
#     radial-gradient(ellipse 80%  50% at 5%  90%,  rgba(30,64,32,0.10)  0%, transparent 45%),
#     linear-gradient(160deg, #f7f4e8 0%, #eef5e8 30%, #f5f2e0 60%, #ede8d0 100%) !important;
#   min-height: 100vh;
# }

# /* Animated subtle grain texture overlay */
# [data-testid="stAppViewContainer"]::before {
#   content: '';
#   position: fixed;
#   inset: 0;
#   z-index: 0;
#   background-image:
#     url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='400' height='400' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
#   background-repeat: repeat;
#   pointer-events: none;
#   opacity: 0.5;
# }

# /* ── Hide Streamlit chrome ──────────────────────────────────────────── */
# #MainMenu, header, footer,
# [data-testid="stToolbar"],
# [data-testid="stDecoration"],
# [data-testid="stStatusWidget"] { visibility: hidden !important; display: none !important; }

# .block-container {
#   padding: 0 2rem 5rem !important;
#   max-width: 1300px !important;
#   position: relative;
#   z-index: 1;
# }

# /* ── Animated paddy hero strip ────────────────────────────────────── */
# .paddy-hero-wrap {
#   position: relative;
#   text-align: center;
#   padding: 3.5rem 1rem 2.5rem;
#   overflow: hidden;
# }

# /* Decorative horizontal rule with paddy silhouettes */
# .paddy-rule {
#   display: flex;
#   align-items: center;
#   justify-content: center;
#   gap: 0.5rem;
#   margin-bottom: 1.2rem;
#   opacity: 0.55;
# }
# .paddy-rule-line {
#   flex: 1;
#   max-width: 120px;
#   height: 1px;
#   background: linear-gradient(90deg, transparent, var(--paddy-gold), transparent);
# }
# .paddy-rule-icon {
#   font-size: 1.1rem;
#   animation: sway 3s ease-in-out infinite;
# }
# .paddy-rule-icon:nth-child(2) { animation-delay: 0.3s; }
# .paddy-rule-icon:nth-child(3) { animation-delay: 0.6s; }
# .paddy-rule-icon:nth-child(4) { animation-delay: 0.9s; }
# .paddy-rule-icon:nth-child(5) { animation-delay: 1.2s; }

# @keyframes sway {
#   0%, 100% { transform: rotate(-4deg) translateY(0); }
#   50%       { transform: rotate(4deg) translateY(-3px); }
# }

# .hero-eyebrow {
#   font-family: var(--font-bangla);
#   font-size: 0.72rem;
#   font-weight: 500;
#   letter-spacing: 0.22rem;
#   text-transform: uppercase;
#   color: var(--leaf-bright);
#   opacity: 0.75;
#   margin-bottom: 0.7rem;
# }

# .hero-title {
#   font-family: var(--font-serif);
#   font-size: clamp(2.6rem, 5.5vw, 4.4rem);
#   font-weight: 700;
#   line-height: 1.12;
#   color: var(--field-dark);
#   margin: 0 0 0.5rem;
#   letter-spacing: -0.02em;
# }
# .hero-title .accent { color: var(--leaf-bright); }
# .hero-title .gold   { color: var(--paddy-gold); }

# .hero-sub {
#   font-family: var(--font-bangla);
#   font-size: 1.05rem;
#   font-weight: 300;
#   color: var(--earth-light);
#   opacity: 0.85;
#   margin: 0 auto 0.4rem;
#   max-width: 580px;
#   line-height: 1.65;
# }

# .hero-meta {
#   font-family: var(--font-bangla);
#   font-size: 0.72rem;
#   letter-spacing: 0.10rem;
#   color: var(--earth-light);
#   opacity: 0.5;
#   margin-top: 1rem;
# }

# .hero-divider {
#   width: 60px;
#   height: 2px;
#   background: linear-gradient(90deg, var(--paddy-gold), var(--sprout));
#   border-radius: 99px;
#   margin: 1.2rem auto 0;
# }

# /* ── Status banner ────────────────────────────────────────────────── */
# .status-banner {
#   display: flex;
#   align-items: center;
#   gap: 12px;
#   background: rgba(234, 247, 238, 0.80);
#   border: 1px solid rgba(30, 126, 52, 0.25);
#   border-left: 4px solid #1e7e34;
#   border-radius: 12px;
#   padding: 12px 18px;
#   margin: 0.5rem 0 1.5rem;
#   font-family: var(--font-bangla);
#   font-size: 0.92rem;
#   color: #144d22;
#   backdrop-filter: blur(6px);
# }
# .status-banner.warn {
#   background: rgba(255, 248, 235, 0.85);
#   border-color: rgba(211, 84, 0, 0.25);
#   border-left-color: #d35400;
#   color: #7d3800;
# }

# /* ── Upload zone ──────────────────────────────────────────────────── */
# [data-testid="stFileUploader"] {
#   background: var(--card-bg) !important;
#   border: 2px dashed rgba(109, 181, 96, 0.50) !important;
#   border-radius: 20px !important;
#   padding: 2rem !important;
#   transition: all 0.3s ease !important;
#   backdrop-filter: blur(8px) !important;
#   box-shadow: var(--shadow-card) !important;
# }
# [data-testid="stFileUploader"]:hover {
#   border-color: var(--leaf-bright) !important;
#   box-shadow: 0 0 0 6px rgba(45,106,47,0.07), var(--shadow-card) !important;
#   transform: translateY(-1px);
# }
# [data-testid="stFileUploader"] section {
#   border: none !important;
#   background: transparent !important;
# }
# [data-testid="stFileUploader"] label,
# [data-testid="stFileUploader"] p,
# [data-testid="stFileUploader"] span {
#   font-family: var(--font-bangla) !important;
#   color: var(--earth) !important;
#   font-size: 0.98rem !important;
# }
# [data-testid="stFileUploaderDropzoneInstructions"] p {
#   font-size: 1.05rem !important;
#   font-weight: 500 !important;
#   color: var(--field-mid) !important;
# }

# /* ── Image display ────────────────────────────────────────────────── */
# [data-testid="stImage"] img {
#   border-radius: 20px !important;
#   box-shadow: 0 6px 40px rgba(13,31,14,0.18) !important;
#   border: 3px solid rgba(200,151,58,0.20) !important;
#   width: 100% !important;
#   object-fit: cover !important;
# }

# /* ── Generic card base ────────────────────────────────────────────── */
# .vcard {
#   background: var(--card-bg);
#   border: 1px solid var(--card-border);
#   border-radius: 20px;
#   padding: 22px 26px;
#   box-shadow: var(--shadow-card);
#   backdrop-filter: blur(8px);
#   margin-bottom: 1rem;
#   animation: fadeUp 0.4s ease both;
# }

# @keyframes fadeUp {
#   from { opacity: 0; transform: translateY(12px); }
#   to   { opacity: 1; transform: translateY(0); }
# }

# /* ── Label ────────────────────────────────────────────────────────── */
# .vlabel {
#   font-family: var(--font-bangla);
#   font-size: 0.68rem;
#   font-weight: 600;
#   letter-spacing: 0.18rem;
#   text-transform: uppercase;
#   color: var(--earth-light);
#   opacity: 0.65;
#   margin-bottom: 0.6rem;
# }

# /* ── Image card ───────────────────────────────────────────────────── */
# .img-wrap {
#   border-radius: 20px;
#   overflow: hidden;
#   border: 2px solid rgba(200,151,58,0.18);
#   box-shadow: var(--shadow-soft);
# }

# /* ── RESULT HERO ─────────────────────────────────────────────────── */
# .result-card {
#   position: relative;
#   text-align: center;
#   padding: 2.4rem 2rem 2rem;
#   border-radius: 24px;
#   background: var(--card-bg);
#   box-shadow: var(--shadow-soft);
#   border: 1px solid var(--card-border);
#   backdrop-filter: blur(10px);
#   overflow: hidden;
#   animation: fadeUp 0.5s ease both;
# }

# /* Top color stripe */
# .result-card::before {
#   content: '';
#   position: absolute;
#   top: 0; left: 0; right: 0;
#   height: 5px;
#   background: var(--result-color, var(--leaf-bright));
#   border-radius: 24px 24px 0 0;
# }

# /* Soft radial glow in result card background */
# .result-card::after {
#   content: '';
#   position: absolute;
#   top: -40px; left: 50%;
#   transform: translateX(-50%);
#   width: 300px;
#   height: 200px;
#   background: radial-gradient(ellipse, var(--result-glow, rgba(45,106,47,0.12)) 0%, transparent 70%);
#   pointer-events: none;
# }

# .result-emoji {
#   font-size: 4rem;
#   line-height: 1;
#   margin-bottom: 0.5rem;
#   animation: popIn 0.5s cubic-bezier(.34,1.56,.64,1) both;
# }
# @keyframes popIn {
#   from { transform: scale(0.5); opacity: 0; }
#   to   { transform: scale(1);   opacity: 1; }
# }

# .result-name {
#   font-family: var(--font-bangla);
#   font-size: 1.9rem;
#   font-weight: 700;
#   line-height: 1.2;
#   margin: 0.2rem 0 0.8rem;
# }

# .pill-row {
#   display: flex;
#   align-items: center;
#   justify-content: center;
#   gap: 10px;
#   flex-wrap: wrap;
# }

# .pill {
#   display: inline-flex;
#   align-items: center;
#   gap: 5px;
#   padding: 5px 16px;
#   border-radius: 99px;
#   font-family: var(--font-bangla);
#   font-size: 0.80rem;
#   font-weight: 600;
#   letter-spacing: 0.03rem;
# }

# .pill-dark {
#   background: var(--field-dark);
#   color: var(--straw);
# }

# .pill-sev {
#   border: 1.5px solid currentColor;
#   background: transparent;
# }

# /* ── PROBABILITY BARS ─────────────────────────────────────────────── */
# .prob-outer { margin: 7px 0; }
# .prob-head {
#   display: flex;
#   justify-content: space-between;
#   align-items: center;
#   margin-bottom: 4px;
#   font-family: var(--font-bangla);
#   font-size: 0.88rem;
#   color: var(--field-dark);
# }
# .prob-pct {
#   font-size: 0.78rem;
#   font-weight: 600;
#   opacity: 0.75;
#   letter-spacing: 0.04rem;
# }
# .prob-track {
#   background: rgba(13,31,14,0.07);
#   border-radius: 99px;
#   height: 8px;
#   overflow: hidden;
# }
# .prob-fill {
#   height: 100%;
#   border-radius: 99px;
#   transition: width 0.9s cubic-bezier(.4,0,.2,1);
# }
# .prob-active .prob-head { font-weight: 700; }
# .prob-active .prob-pct  { opacity: 1; }

# /* ── INFO & TREATMENT PANELS ──────────────────────────────────────── */
# .info-panel, .treat-panel {
#   border-radius: 0 16px 16px 0;
#   padding: 18px 22px;
#   font-family: var(--font-bangla);
#   font-size: 0.95rem;
#   line-height: 1.80;
#   color: var(--field-dark);
#   margin-bottom: 0;
#   height: 100%;
#   box-sizing: border-box;
# }
# .info-panel {
#   background: linear-gradient(135deg, rgba(253,250,230,0.95), rgba(255,248,215,0.90));
#   border-left: 5px solid var(--paddy-gold);
# }
# .treat-panel {
#   background: linear-gradient(135deg, rgba(234,247,238,0.95), rgba(218,242,224,0.90));
#   border-left: 5px solid var(--sprout);
# }
# .panel-hd {
#   font-size: 0.68rem;
#   font-weight: 700;
#   letter-spacing: 0.16rem;
#   text-transform: uppercase;
#   margin-bottom: 10px;
#   opacity: 0.55;
# }
# .info-panel .panel-hd { color: var(--earth); }
# .treat-panel .panel-hd { color: var(--field-mid); }

# /* ── MODEL BADGES ─────────────────────────────────────────────────── */
# .model-grid {
#   display: grid;
#   grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
#   gap: 14px;
# }
# .model-badge {
#   background: var(--field-dark);
#   color: var(--straw);
#   border-radius: 18px;
#   padding: 18px 16px 16px;
#   text-align: center;
#   position: relative;
#   overflow: hidden;
#   box-shadow: 0 4px 20px rgba(13,31,14,0.20);
#   transition: transform 0.2s ease;
# }
# .model-badge:hover { transform: translateY(-3px); }
# .model-badge::before {
#   content: '';
#   position: absolute;
#   top: 0; left: 0; right: 0;
#   height: 3px;
#   background: var(--badge-accent, var(--sprout));
#   border-radius: 18px 18px 0 0;
# }
# .model-badge::after {
#   content: '';
#   position: absolute;
#   bottom: -20px; right: -20px;
#   width: 80px; height: 80px;
#   background: rgba(255,255,255,0.03);
#   border-radius: 50%;
# }
# .badge-name {
#   font-size: 0.65rem;
#   letter-spacing: 0.12rem;
#   text-transform: uppercase;
#   opacity: 0.50;
#   margin-bottom: 6px;
#   font-weight: 500;
# }
# .badge-result {
#   font-family: var(--font-bangla);
#   font-size: 0.95rem;
#   font-weight: 700;
#   line-height: 1.25;
#   margin: 4px 0;
# }
# .badge-conf {
#   font-size: 0.78rem;
#   opacity: 0.65;
#   font-weight: 400;
#   letter-spacing: 0.04rem;
# }

# /* ── EMPTY STATE ──────────────────────────────────────────────────── */
# .empty-state {
#   text-align: center;
#   padding: 5rem 2rem 6rem;
#   animation: fadeUp 0.6s ease both;
# }
# .empty-icon {
#   font-size: 5rem;
#   line-height: 1;
#   margin-bottom: 1.5rem;
#   animation: sway 4s ease-in-out infinite;
#   display: block;
# }
# .empty-text {
#   font-family: var(--font-bangla);
#   font-size: 1.15rem;
#   font-weight: 500;
#   color: var(--earth-light);
#   line-height: 1.85;
#   max-width: 420px;
#   margin: 0 auto;
#   opacity: 0.80;
# }
# .empty-hint {
#   font-size: 0.78rem;
#   opacity: 0.50;
#   margin-top: 0.6rem;
#   letter-spacing: 0.08rem;
#   display: block;
# }

# /* Tips row */
# .tips-row {
#   display: flex;
#   gap: 12px;
#   flex-wrap: wrap;
#   margin: 1.8rem 0 0.5rem;
#   justify-content: center;
# }
# .tip-chip {
#   background: rgba(45,106,47,0.08);
#   border: 1px solid rgba(45,106,47,0.18);
#   border-radius: 99px;
#   padding: 6px 16px;
#   font-family: var(--font-bangla);
#   font-size: 0.80rem;
#   color: var(--leaf-bright);
#   font-weight: 500;
# }

# /* ── Feature chips above upload ───────────────────────────────────── */
# .feature-strip {
#   display: flex;
#   gap: 10px;
#   flex-wrap: wrap;
#   margin-bottom: 1.5rem;
# }
# .feat-chip {
#   display: flex;
#   align-items: center;
#   gap: 6px;
#   background: rgba(253,250,243,0.85);
#   border: 1px solid rgba(200,151,58,0.20);
#   border-radius: 99px;
#   padding: 6px 14px;
#   font-family: var(--font-bangla);
#   font-size: 0.80rem;
#   color: var(--earth);
#   font-weight: 500;
#   backdrop-filter: blur(6px);
# }
# .feat-dot {
#   width: 6px; height: 6px;
#   border-radius: 50%;
#   background: var(--sprout);
#   flex-shrink: 0;
# }

# /* ── Footer ───────────────────────────────────────────────────────── */
# .paddy-footer {
#   text-align: center;
#   font-family: var(--font-bangla);
#   font-size: 0.72rem;
#   letter-spacing: 0.07rem;
#   color: var(--earth-light);
#   opacity: 0.45;
#   padding: 2.5rem 0 1rem;
#   border-top: 1px solid rgba(61,43,26,0.10);
#   margin-top: 3rem;
#   line-height: 1.8;
# }

# /* ── Streamlit widget overrides ───────────────────────────────────── */
# [data-testid="stAlert"] {
#   border-radius: 14px !important;
#   font-family: var(--font-bangla) !important;
#   font-size: 0.90rem !important;
# }
# [data-testid="stSpinner"] p {
#   font-family: var(--font-bangla) !important;
#   font-size: 0.92rem !important;
#   color: var(--field-mid) !important;
# }

# /* Section dividers */
# .section-gap { margin: 1.6rem 0 0.8rem; }

# /* Responsive tweaks */
# @media (max-width: 768px) {
#   .block-container { padding: 0 1rem 4rem !important; }
#   .hero-title { font-size: 2.2rem; }
#   .result-name { font-size: 1.5rem; }
#   .model-grid { grid-template-columns: 1fr 1fr; }
# }
# </style>
# """, unsafe_allow_html=True)


# # ─────────────────────────────────────────────────────────────────────────────
# # HERO
# # ─────────────────────────────────────────────────────────────────────────────
# st.markdown("""
# <div class="paddy-hero-wrap">
#   <div class="paddy-rule">
#     <div class="paddy-rule-line"></div>
#     <span class="paddy-rule-icon">🌾</span>
#     <span class="paddy-rule-icon">🌿</span>
#     <span class="paddy-rule-icon">🌾</span>
#     <span class="paddy-rule-icon">🌿</span>
#     <span class="paddy-rule-icon">🌾</span>
#     <div class="paddy-rule-line"></div>
#   </div>
#   <div class="hero-eyebrow">কৃত্রিম বুদ্ধিমত্তা · Ensemble AI · বাংলাদেশ</div>
#   <h1 class="hero-title">ধান রোগ <span class="accent">শনাক্তকরণ</span></h1>
#   <p class="hero-sub">
#     আপনার ধানক্ষেতের পাতার ছবি তুলে আপলোড করুন—<br>
#     AI এক মুহূর্তেই রোগ চিহ্নিত করে সঠিক পরামর্শ দেবে।
#   </p>
#   <div class="hero-divider"></div>
#   <div class="hero-meta">EfficientNetB0 · ResNet50 · DenseNet121 &nbsp;|&nbsp; শাওন খান, IIT, JU</div>
# </div>
# """, unsafe_allow_html=True)


# # ─────────────────────────────────────────────────────────────────────────────
# # Load models
# # ─────────────────────────────────────────────────────────────────────────────
# with st.spinner("🌾 AI মডেল প্রস্তুত হচ্ছে…"):
#     models_dict, failed_models = load_models()

# if failed_models:
#     missing = ", ".join(failed_models)
#     st.markdown(f"""
#     <div class="status-banner warn">
#       ⚠️ &nbsp;মিসিং মডেল: <strong>{missing}</strong> — বাকি মডেল দিয়ে কাজ চলছে।
#     </div>
#     """, unsafe_allow_html=True)
# else:
#     st.markdown("""
#     <div class="status-banner">
#       ✅ &nbsp;সব মডেল সফলভাবে লোড হয়েছে — সিস্টেম প্রস্তুত।
#     </div>
#     """, unsafe_allow_html=True)


# # ─────────────────────────────────────────────────────────────────────────────
# # Feature chips
# # ─────────────────────────────────────────────────────────────────────────────
# st.markdown("""
# <div class="feature-strip">
#   <div class="feat-chip"><span class="feat-dot"></span> ৫ ধরনের রোগ শনাক্ত</div>
#   <div class="feat-chip"><span class="feat-dot"></span> ৩টি AI মডেলের সম্মিলন</div>
#   <div class="feat-chip"><span class="feat-dot"></span> ৪৯,৩৬৮ ছবিতে প্রশিক্ষিত</div>
#   <div class="feat-chip"><span class="feat-dot"></span> তাৎক্ষণিক ফলাফল</div>
# </div>
# """, unsafe_allow_html=True)


# # ─────────────────────────────────────────────────────────────────────────────
# # Upload
# # ─────────────────────────────────────────────────────────────────────────────
# uploaded_file = st.file_uploader(
#     "📸 ধানের পাতার পরিষ্কার ছবি আপলোড করুন (JPG / PNG)",
#     type=["jpg", "jpeg", "png"],
# )


# # ─────────────────────────────────────────────────────────────────────────────
# # RESULTS
# # ─────────────────────────────────────────────────────────────────────────────
# if uploaded_file is not None:
#     pil_img = Image.open(uploaded_file)

#     st.markdown("<div style='margin-top:1.8rem;'></div>", unsafe_allow_html=True)

#     col_img, col_res = st.columns([1, 1.7], gap="large")

#     # ── Left: uploaded image ─────────────────────────────────────────────
#     with col_img:
#         st.markdown('<div class="vlabel">আপলোড করা ছবি</div>', unsafe_allow_html=True)
#         st.image(pil_img, use_container_width=True)

#     # ── Right: result ────────────────────────────────────────────────────
#     with col_res:
#         with st.spinner("🔬 AI বিশ্লেষণ চলছে…"):
#             final_en, conf, w_probs, ind_results = ensemble_predict(pil_img, models_dict)

#         info = CLASS_INFO[final_en]

#         # Result hero card
#         st.markdown(f"""
#         <div class="result-card"
#              style="--result-color:{info['color']}; --result-glow:{info['glow']};">
#           <div class="result-emoji">{info['emoji']}</div>
#           <div class="result-name" style="color:{info['color']};">{info['bn']}</div>
#           <div class="pill-row">
#             <span class="pill pill-dark">নির্ভুলতা: {conf:.1f}%</span>
#             <span class="pill pill-sev"
#                   style="color:{info['sev_color']}; background:{info['sev_bg']};">
#               তীব্রতা: {info['severity']}
#             </span>
#           </div>
#         </div>
#         """, unsafe_allow_html=True)

#         st.markdown("<div style='margin-top:1rem;'></div>", unsafe_allow_html=True)

#         # Probability bars
#         st.markdown('<div class="vlabel">সম্ভাব্যতা বিশ্লেষণ</div>', unsafe_allow_html=True)

#         bars_html = ""
#         sorted_pairs = sorted(
#             zip(LABEL_NAMES_EN, w_probs), key=lambda x: x[1], reverse=True
#         )
#         for en_lbl, prob in sorted_pairs:
#             p    = float(prob) * 100
#             c    = CLASS_INFO[en_lbl]["color"]
#             bn   = CLASS_INFO[en_lbl]["bn"]
#             is_top = "prob-active" if en_lbl == final_en else ""
#             bars_html += f"""
#             <div class="prob-outer {is_top}">
#               <div class="prob-head">
#                 <span>{bn}</span>
#                 <span class="prob-pct">{p:.1f}%</span>
#               </div>
#               <div class="prob-track">
#                 <div class="prob-fill" style="width:{p:.1f}%; background:{c};"></div>
#               </div>
#             </div>"""

#         st.markdown(f'<div class="vcard" style="padding:18px 22px;">{bars_html}</div>',
#                     unsafe_allow_html=True)

#     # ── Description & Treatment ──────────────────────────────────────────
#     st.markdown("<div class='section-gap'></div>", unsafe_allow_html=True)

#     c1, c2 = st.columns(2, gap="medium")
#     with c1:
#         st.markdown(f"""
#         <div class="info-panel">
#           <div class="panel-hd">📖 রোগের বিবরণ</div>
#           {info['description']}
#         </div>""", unsafe_allow_html=True)
#     with c2:
#         st.markdown(f"""
#         <div class="treat-panel">
#           <div class="panel-hd">🌿 করণীয় ও চিকিৎসা</div>
#           {info['treatment']}
#         </div>""", unsafe_allow_html=True)

#     # ── Individual model opinions ────────────────────────────────────────
#     st.markdown("<div class='section-gap'></div>", unsafe_allow_html=True)
#     st.markdown('<div class="vlabel">প্রতিটি মডেলের মতামত</div>', unsafe_allow_html=True)

#     weights_display = {"EfficientNetB0": "৬০%", "ResNet50": "২৫%", "DenseNet121": "১৫%"}

#     badges_html = '<div class="model-grid">'
#     for mname, res in ind_results.items():
#         wt = weights_display.get(mname, "")
#         badges_html += f"""
#         <div class="model-badge" style="--badge-accent:{res['color']};">
#           <div class="badge-name">{mname} · {wt}</div>
#           <div class="badge-result" style="color:{res['color']};">{res['class_bn']}</div>
#           <div class="badge-conf">{res['confidence']:.1f}%</div>
#         </div>"""
#     badges_html += "</div>"

#     st.markdown(f'<div class="vcard">{badges_html}</div>', unsafe_allow_html=True)

# else:
#     # ── Empty state ──────────────────────────────────────────────────────
#     st.markdown("""
#     <div class="empty-state">
#       <span class="empty-icon">🌾</span>
#       <p class="empty-text">
#         ধানের পাতার একটি পরিষ্কার ছবি আপলোড করুন।<br>
#         AI কয়েক সেকেন্ডেই রোগ শনাক্ত করে পরামর্শ দেবে।
#       </p>
#       <span class="empty-hint">সমর্থিত ফরম্যাট: JPG · JPEG · PNG</span>
#       <div class="tips-row">
#         <span class="tip-chip">পাতা পরিষ্কার পরিবেশে তুলুন</span>
#         <span class="tip-chip">ভালো আলোয় ছবি নিন</span>
#         <span class="tip-chip">পাতা ফোকাসে রাখুন</span>
#       </div>
#     </div>
#     """, unsafe_allow_html=True)


# # ─────────────────────────────────────────────────────────────────────────────
# # Footer
# # ─────────────────────────────────────────────────────────────────────────────
# st.markdown("""
# <div class="paddy-footer">
#   Ensemble AI · EfficientNetB0 (৬০%) + ResNet50 (২৫%) + DenseNet121 (১৫%) · ৪৯,৩৬৮ ছবিতে প্রশিক্ষিত<br>
#   শাওন খান · Institute of Information Technology · Jahangirnagar University
# </div>
# """, unsafe_allow_html=True)

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