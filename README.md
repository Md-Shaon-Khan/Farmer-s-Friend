# Paddy Check — backend

FastAPI service serving the two-stage pipeline: paddy/not-paddy, then
pathogen-type classification. Architecture, image sizes, and class
order are pulled directly from your two training notebooks — nothing
here is guessed.

## Setup

```
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

Copy your model weights in:
- `models/paddy_or_not/best_mobilenet_v3_small.pth`
- `models/disease_classify/best_fresh_balanced_convnext.pth`

Run it:
```
uvicorn main:app --reload
```

- API: http://127.0.0.1:8000/api/predict (POST, multipart field `file`)
- Docs: http://127.0.0.1:8000/docs
- If `../frontend` exists next to this folder, it's served at http://127.0.0.1:8000/

## What each model actually does

**Paddy / not-paddy** — MobileNetV3-Small, 224x224 input, classes
`[not_paddy, paddy]`. Matches `predict_gatekeeper()` from
`paddy-or-not-paddy.ipynb`, including its 0.85 confidence threshold:
if neither class clears 0.85, the image is treated as not paddy.

**Pathogen type** — ConvNeXt-Tiny, 384x384 input, classes
`[Bacterial, Fungal, Viral, Normal]`. This is `best_fresh_balanced_convnext.pth`
from the "FRESH BALANCED FINE-TUNING (CONVNEXT-TINY @ 384x384)" section
of `image-classification-paddy.ipynb`. **Note: it predicts a pathogen
category, not a specific disease name** — it won't say "blast" or
"tungro", only whether the infection looks bacterial, fungal, or viral
(or that the leaf is healthy). The frontend's "What we can spot" chip
list on the home page still shows individual disease names from an
earlier assumption — update that list to Bacterial / Fungal / Viral /
Healthy if you want it to match what this model actually returns.

## If predictions still look wrong

- Confirm the weight files placed in `models/` are actually
  `best_mobilenet_v3_small.pth` and `best_fresh_balanced_convnext.pth`
  — not one of the other checkpoints in your folder (`best_stage2_*`,
  `best_resnet18.pth`, `best_bacterial_boost_*`), which use different
  architectures or resolutions and will fail to load or mispredict.
- `config.py` is the single place all of the above lives — check it
  first before digging into the model code.

# What changed

## 1. Overlap bug (fixed)

`Frontend/css/classify.css` set `display: flex` directly on the
`.result-placeholder` class. When JS set `.hidden = true` on it, that
explicit `display` overrode the browser's default `[hidden] { display:
none }` behavior, so the placeholder never actually went away — the
result card just rendered underneath it, which is exactly the stacked
layout in your screenshot.

Fix: added `[hidden] { display: none !important; }` at the top of
`classify.css`, and moved `.result-placeholder`'s flex layout onto a
`:not([hidden])` selector so the two rules can never fight again.
Drop this file in over your existing one.

## 2. Vectorization + 5 similar images (new)

Your notebook already does this correctly for a single sample image in
`run_clean_balanced_diagnostic`: a `ConvNeXtFeatureExtractor` turns a
leaf photo into a normalized 768-d vector, then `cosine_similarity`
against a `ref_embeddings` gallery returns the top 5 matches. That's
research-notebook code (Kaggle paths, matplotlib plotting, rebuilds
the gallery every run) — not something you can call from a live
FastAPI endpoint as-is, so I re-implemented the same logic as a
reusable backend module:

- **`Backend/ml/feature_extractor.py`** — `ConvNeXtFeatureExtractor`
  (identical to the notebook's) + `SimilarityEngine`, which builds the
  reference gallery's embeddings once and caches them to
  `data/reference_embeddings.npz`, then answers `find_similar(photo)`
  with the top 5 cosine-similarity matches. It reuses your already-
  loaded `DiseaseClassifier` model instead of loading ConvNeXt twice.
- **`Backend/ml/pipeline.py`** — now also calls the similarity engine
  and attaches `similar_images` to the response for any photo
  identified as paddy (healthy or diseased).
- **`Backend/schemas/predict.py`** — added `SimilarImage` and the
  `similar_images: List[SimilarImage]` field.
- **`Backend/config_additions.py`** — new config values to merge into
  your real `config.py` (I don't have that file, so this is a snippet,
  not a full replacement).
- **`Backend/main_static_mount_snippet.py`** — mounts the reference
  images folder so the frontend can actually load the thumbnails.
- **`Backend/data/manifest.example.csv`** — the format
  `SimilarityEngine` expects: `image_path,label` per reference photo.
  Point `SIMILARITY_MANIFEST_PATH` at a real manifest covering however
  many reference images you want searchable (the paddy-disease Kaggle
  set your notebook already uses works well for this).
- **`Frontend/js/classify.js`** / **`Frontend/css/classify.css`** —
  render a 5-thumbnail "Visually similar leaves" strip under the
  result, each with its label and match percentage.

No object detection (YOLO or otherwise) is used — this is purely
whole-image feature-vector comparison, matching what your notebook
already does.

## To wire it up

1. Drop in the updated `Frontend/css/classify.css` and
   `Frontend/js/classify.js`.
2. Copy `Backend/ml/feature_extractor.py` into your `ml/` package and
   replace `Backend/ml/pipeline.py` in place of your current one.
3. Replace `Backend/schemas/predict.py`.
4. Merge `Backend/config_additions.py` into your real `config.py`.
5. Add the snippet in `Backend/main_static_mount_snippet.py` to your
   `main.py`.
6. Build a real `manifest.csv` (see the example) pointing at a folder
   of reference leaf images, matching `SIMILARITY_MANIFEST_PATH`. On
   first request the gallery gets vectorized and cached; after that
   it loads instantly from the `.npz` cache.

# What changed

## 1. Overlap bug (fixed)

`Frontend/css/classify.css` set `display: flex` directly on the
`.result-placeholder` class. When JS set `.hidden = true` on it, that
explicit `display` overrode the browser's default `[hidden] { display:
none }` behavior, so the placeholder never actually went away — the
result card just rendered underneath it, which is exactly the stacked
layout in your screenshot.

Fix: added `[hidden] { display: none !important; }` at the top of
`classify.css`, and moved `.result-placeholder`'s flex layout onto a
`:not([hidden])` selector so the two rules can never fight again.
Drop this file in over your existing one.

## 2. Vectorization + 5 similar images (new)

Your notebook already does this correctly for a single sample image in
`run_clean_balanced_diagnostic`: a `ConvNeXtFeatureExtractor` turns a
leaf photo into a normalized 768-d vector, then `cosine_similarity`
against a `ref_embeddings` gallery returns the top 5 matches. That's
research-notebook code (Kaggle paths, matplotlib plotting, rebuilds
the gallery every run) — not something you can call from a live
FastAPI endpoint as-is, so I re-implemented the same logic as a
reusable backend module:

- **`Backend/ml/feature_extractor.py`** — `ConvNeXtFeatureExtractor`
  (identical to the notebook's) + `SimilarityEngine`, which builds the
  reference gallery's embeddings once and caches them to
  `data/reference_embeddings.npz`, then answers `find_similar(photo)`
  with the top 5 cosine-similarity matches. It reuses your already-
  loaded `DiseaseClassifier` model instead of loading ConvNeXt twice.
- **`Backend/ml/pipeline.py`** — now also calls the similarity engine
  and attaches `similar_images` to the response for any photo
  identified as paddy (healthy or diseased).
- **`Backend/schemas/predict.py`** — added `SimilarImage` and the
  `similar_images: List[SimilarImage]` field.
- **`Backend/config_additions.py`** — new config values to merge into
  your real `config.py` (I don't have that file, so this is a snippet,
  not a full replacement).
- **`Backend/main_static_mount_snippet.py`** — mounts the reference
  images folder so the frontend can actually load the thumbnails.
- **`Backend/data/manifest.example.csv`** — the format
  `SimilarityEngine` expects: `image_path,label` per reference photo.
  Point `SIMILARITY_MANIFEST_PATH` at a real manifest covering however
  many reference images you want searchable (the paddy-disease Kaggle
  set your notebook already uses works well for this).
- **`Frontend/js/classify.js`** / **`Frontend/css/classify.css`** —
  render a 5-thumbnail "Visually similar leaves" strip under the
  result, each with its label and match percentage.

No object detection (YOLO or otherwise) is used — this is purely
whole-image feature-vector comparison, matching what your notebook
already does.

## 3. "Where's the problem?" spot localization (new)

This is the "Detected Spots" panel from your notebook's
`run_clean_balanced_diagnostic` — `ConvNeXtGradCAM` backprops the
predicted class through the ConvNeXt model to get an attention
heatmap, then `extract_spots_and_features` thresholds it into
contours and draws a red box + number around each one. Not YOLO, not
a trained detector — the boxes come from the classifier's own
attention, so they're only produced when a disease is actually
predicted (not for healthy or non-paddy photos).

- **`Backend/ml/spot_detector.py`** — `ConvNeXtGradCAM` +
  `extract_spots_and_features` (ported as-is) plus `localize_disease`,
  which runs both and returns a base64 PNG of the annotated leaf and
  each spot's metrics.
- **`Backend/ml/pipeline.py`** — now calls this whenever `disease_key
  != HEALTHY_CLASS_KEY`, adding a `localization` field to the
  response (`null` for healthy/non-paddy photos).
- **`Backend/schemas/predict.py`** — added `Spot`, `SpotBox`,
  `Localization`, and the `localization: Optional[Localization]`
  field.
- **`Frontend/js/classify.js`** / **`Frontend/css/classify.css`** —
  renders the annotated image straight from the base64 string under
  "Where the problem is (N spots marked)".

You'll need `opencv-python` installed in the backend (`pip install
opencv-python`) if it isn't already — `spot_detector.py` uses `cv2`
for contour detection, same as the notebook.

One caveat worth knowing: Grad-CAM needs a real forward+backward pass
on the shared model (unlike plain inference, which runs under
`torch.no_grad()`). That's fine for a single request at a time; if
you ever run multiple workers or truly concurrent requests against
the same model instance, two Grad-CAM calls at once could interfere
with each other's gradients — worth adding a lock around
`localize_disease` if that becomes a real scenario for you.

## To wire it up

1. Drop in the updated `Frontend/css/classify.css` and
   `Frontend/js/classify.js`.
2. Copy `Backend/ml/feature_extractor.py` into your `ml/` package and
   replace `Backend/ml/pipeline.py` in place of your current one.
3. Replace `Backend/schemas/predict.py`.
4. Merge `Backend/config_additions.py` into your real `config.py`.
5. Add the snippet in `Backend/main_static_mount_snippet.py` to your
   `main.py`.
6. Build a real `manifest.csv` (see the example) pointing at a folder
   of reference leaf images, matching `SIMILARITY_MANIFEST_PATH`. On
   first request the gallery gets vectorized and cached; after that
   it loads instantly from the `.npz` cache.
7. Copy `Backend/ml/spot_detector.py` into your `ml/` folder and make
   sure `opencv-python` is installed.