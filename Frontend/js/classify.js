// Talks to the FastAPI backend's /api/predict endpoint.
//
// Expected JSON response shape (matches the updated schemas/predict.py):
// {
//   "is_paddy": true,
//   "paddy_confidence": 0.97,
//   "disease": "leaf_blast",        // machine key, or null/"normal" when healthy
//   "disease_label": "Leaf blast",  // human-readable label, or null when healthy/not paddy
//   "disease_confidence": 0.89,     // 0-1, or null when healthy/not paddy
//   "sub_class": { "key": "tungro", "label": "Tungro", "confidence": 0.91, "group": "viral",
//                  "group_label": "Viral infection", "top3": [...], "model_votes": {...} },
//   "final": { "source": "both" | "sub" | "main", "label": "Tungro", "group": "viral", ... },
//   "consistency": { "status": "match" | "mismatch" | "other", "winner": "both"|"sub"|"main", "main_group": "viral",
//                    "sub_group": "viral", "message": "..." },
//   "localization": { "heatmap_overlay_base64", "lesion_mask_base64", "annotated_image_base64",
//                     "spots": [...], "total_damage_pct": 12.3, "tuned_params": {...} },
//   "similar_images": [             // top-5 nearest images by feature-vector similarity
//     { "image_url": "/static/reference/blast_014.jpg", "label": "blast", "similarity": 0.93 },
//     ...
//   ]
// }

const API_BASE_URL = 'http://127.0.0.1:8000';
const PREDICT_ENDPOINT = `${API_BASE_URL}/api/predict`;

const dropzone = document.getElementById('dropzone');
const dropzoneContent = document.getElementById('dropzoneContent');
const fileInput = document.getElementById('fileInput');
const browseBtn = document.getElementById('browseBtn');
const previewImg = document.getElementById('previewImg');
const analyzeBtn = document.getElementById('analyzeBtn');
const resetBtn = document.getElementById('resetBtn');
const errorMessage = document.getElementById('errorMessage');
const resultPlaceholder = document.getElementById('resultPlaceholder');
const resultCard = document.getElementById('resultCard');

let selectedFile = null;

// ---------- server status ----------
const statusPill = document.getElementById('status');
fetch(`${API_BASE_URL}/api/health`)
  .then((r) => r.json())
  .then(() => { statusPill.textContent = 'Server online'; statusPill.className = 'pill ok'; })
  .catch(() => { statusPill.textContent = 'Server offline'; statusPill.className = 'pill bad'; });

// ---------- file selection ----------

function handleFileSelected(file) {
  if (!file || !file.type.startsWith('image/')) {
    showError('Please choose an image file (JPG or PNG).');
    return;
  }
  selectedFile = file;
  hideError();

  const reader = new FileReader();
  reader.onload = (e) => {
    previewImg.src = e.target.result;
    previewImg.hidden = false;
    dropzoneContent.hidden = true;
  };
  reader.readAsDataURL(file);

  analyzeBtn.disabled = false;
  hideResult();
}

browseBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) {
    handleFileSelected(e.target.files[0]);
  }
});

// drag and drop
['dragenter', 'dragover'].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add('is-dragover');
  });
});
['dragleave', 'drop'].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove('is-dragover');
  });
});
dropzone.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (file) handleFileSelected(file);
});

// ---------- reset ----------

resetBtn.addEventListener('click', resetForm);

function resetForm() {
  selectedFile = null;
  fileInput.value = '';
  previewImg.hidden = true;
  previewImg.src = '';
  dropzoneContent.hidden = false;
  analyzeBtn.disabled = true;
  analyzeBtn.hidden = false;
  analyzeBtn.textContent = 'Analyze photo';
  resetBtn.hidden = true;
  hideError();
  hideResult();
}

// ---------- analyze ----------

analyzeBtn.addEventListener('click', async () => {
  if (!selectedFile) return;

  hideError();
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = 'Analyzing…';

  const formData = new FormData();
  formData.append('file', selectedFile);

  try {
    const response = await fetch(PREDICT_ENDPOINT, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }

    const data = await response.json();
    renderResult(data);
    analyzeBtn.hidden = true;
    resetBtn.hidden = false;
  } catch (err) {
    console.error(err);
    showError(err.message.startsWith('Server responded')
      ? `The classifier returned an error (${err.message}). Check the uvicorn terminal for details.`
      : "Couldn't reach the classifier. Check that the backend is running and that your page address is in ALLOWED_ORIGINS in config.py.");
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = 'Analyze photo';
  }
});

// ---------- result rendering ----------

const GROUP_LABELS = {
  bacterial: 'Bacterial infection',
  fungal: 'Fungal infection',
  viral: 'Viral infection',
  normal: 'Healthy',
  other: 'Other / unlisted condition',
};

function renderResult(data) {
  resultPlaceholder.hidden = true;
  resultCard.hidden = false;

  if (!data.is_paddy) {
    resultCard.innerHTML = `
      <span class="result-status is-not-paddy">Not paddy</span>
      <h3>This doesn't look like a paddy leaf</h3>
      <p class="result-note">Try a closer photo of a single leaf, filling most of the frame.</p>
      ${confidenceRow('Confidence', data.paddy_confidence)}
    `;
    // No disease gallery to compare against for non-paddy photos.
    return;
  }

  const sub = data.sub_class || null;
  const check = data.consistency || null;
  const final = data.final || null;
  const mainGroup = check ? check.main_group : data.disease;
  const mainLabel = data.disease_label || GROUP_LABELS[mainGroup] || 'Unknown';

  const isHealthy = !data.disease || data.disease === 'normal' || data.disease === 'healthy';

  if (isHealthy) {
    resultCard.innerHTML = `
      <span class="result-status is-paddy">Paddy confirmed</span>
      <span class="result-status is-healthy">Looks healthy</span>
      <h3>No disease detected</h3>
      <p class="result-note">The leaf looks healthy based on this photo.</p>
      ${confidenceRow('Paddy', data.paddy_confidence)}
      ${confidenceRow('Healthy', data.disease_confidence)}
      ${similarSection(data.similar_images)}
    `;
    return;
  }

  // ---- Diseased. If the two models disagree, the more confident one is shown
  //      (data.final) together with the mismatch message. ----
  const disagree = !!(check && check.status !== 'match');
  const headline = final ? final.label : (sub ? sub.label : mainLabel);
  const showGroupLine = final && final.source !== 'main' && final.group_label !== final.label
    && final.group !== 'other';
  const groupLine = showGroupLine
    ? `<p class="result-group">${escapeHtml(final.group_label)}</p>` : '';
  const isUnlisted = !!(final && final.group === 'other');

  const badges = [
    '<span class="result-status is-paddy">Paddy confirmed</span>',
    isUnlisted
      ? '<span class="result-status is-mismatch">Unlisted condition</span>'
      : '<span class="result-status is-diseased">Disease found</span>',
    disagree ? '<span class="result-status is-mismatch">Models disagree</span>' : '',
  ].join('');

  const note = disagree
    ? escapeHtml(check.message)
    : 'This is a model estimate — confirm with an expert before treating your crop.';

  const subRowLabel = sub
    ? (sub.group === 'other' ? 'Disease: unlisted condition' : `Disease: ${escapeHtml(sub.label)}`)
    : '';

  resultCard.innerHTML = `
    ${badges}
    <h3>${escapeHtml(headline)}</h3>
    ${groupLine}
    <p class="result-note">${note}</p>
    ${confidenceRow('Paddy', data.paddy_confidence)}
    ${confidenceRow(`Pathogen type: ${escapeHtml(mainLabel)}`, data.disease_confidence)}
    ${sub ? confidenceRow(subRowLabel, sub.confidence) : ''}
    ${final && final.source !== 'main' ? topCandidates(sub) : ''}
    ${localizationSection(data.localization)}
    ${similarSection(data.similar_images)}
  `;
}

function topCandidates(sub) {
  if (!sub || !sub.top3 || sub.top3.length < 2) return '';
  const items = sub.top3
    .map((c) => `<li>${escapeHtml(c.label)} <span>${Math.round(c.confidence * 100)}%</span></li>`)
    .join('');
  return `
    <div class="top-candidates">
      <h4>Other possibilities</h4>
      <ul>${items}</ul>
    </div>
  `;
}

function localizationSection(localization) {
  if (!localization || !localization.heatmap_overlay_base64) return '';

  const spots = localization.spots || [];
  const spotCount = spots.length;
  const countText = spotCount === 1 ? '1 spot detected' : `${spotCount} spots detected`;
  const damage = typeof localization.total_damage_pct === 'number'
    ? ` · about ${localization.total_damage_pct.toFixed(1)}% of the photo affected` : '';

  const fig = (b64, alt, caption) => b64
    ? `<figure><img src="data:image/png;base64,${b64}" alt="${alt}"><figcaption>${caption}</figcaption></figure>`
    : '';

  // Grad-CAM heatmap -> grid-tuned lesion mask -> OpenCV boxes, side by side.
  const spotRows = spots.slice(0, 6).map((s) => `
    <tr>
      <td>#${s.spot_id}</td>
      <td>${s.area_ratio_pct}%</td>
      <td>${s.necrosis_intensity}</td>
      <td>${s.elongation}</td>
    </tr>`).join('');

  return `
    <div class="localization-section">
      <h4>Where the problem is (${countText}${damage})</h4>
      <div class="localization-pair three">
        ${fig(localization.heatmap_overlay_base64, 'Heatmap of the affected area', 'Heatmap')}
        ${fig(localization.lesion_mask_base64, 'Lesion mask', 'Lesion mask')}
        ${fig(localization.annotated_image_base64, 'Affected spots marked with boxes', 'Boxes')}
      </div>
      ${spotRows ? `
      <table class="spot-table">
        <thead><tr><th>Spot</th><th>Area</th><th>Darkness</th><th>Elongation</th></tr></thead>
        <tbody>${spotRows}</tbody>
      </table>` : ''}
    </div>
  `;
}

function confidenceRow(label, value) {
  if (value === undefined || value === null) return '';
  const pct = Math.round(value * 100);
  return `
    <div class="confidence-row">
      <span class="confidence-label">${label}</span>
      <span class="confidence-track"><span class="confidence-fill" style="width:${pct}%"></span></span>
      <span class="confidence-value">${pct}%</span>
    </div>
  `;
}

function similarSection(images) {
  if (!images || images.length === 0) return '';

  const items = images
    .map((img) => {
      const pct = Math.round((img.similarity || 0) * 100);
      const src = img.image_url.startsWith('http') ? img.image_url : `${API_BASE_URL}${img.image_url}`;
      return `
        <div class="similar-item">
          <img src="${src}" alt="${escapeHtml(img.label)} reference leaf" loading="lazy">
          <div class="similar-caption">
            <strong>${escapeHtml(img.label)}</strong>
            ${pct}% match
          </div>
        </div>
      `;
    })
    .join('');

  return `
    <div class="similar-section">
      <h4>Visually similar leaves (by feature vector)</h4>
      <div class="similar-grid">${items}</div>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- helpers ----------

function showError(msg) {
  errorMessage.textContent = msg;
  errorMessage.hidden = false;
}
function hideError() {
  errorMessage.hidden = true;
}
function hideResult() {
  resultCard.hidden = true;
  resultPlaceholder.hidden = false;
}