// Talks to the FastAPI backend's /api/predict and /api/feedback endpoints.

const API_BASE_URL = 'http://127.0.0.1:8000';
const PREDICT_ENDPOINT = `${API_BASE_URL}/api/predict`;
const FEEDBACK_ENDPOINT = `${API_BASE_URL}/api/feedback`;

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

function renderResult(data) {
  renderResultInner(data);
  if (data.prediction_id) attachFeedbackBox(data.prediction_id);
}

function renderResultInner(data) {
  resultPlaceholder.hidden = true;
  resultCard.hidden = false;

  // Not paddy badge & notice
  const notPaddy = !data.is_paddy;
  const paddyBadge = notPaddy
    ? '<span class="result-status is-not-paddy">Not paddy</span>'
    : '<span class="result-status is-paddy">Paddy confirmed</span>';
  const notPaddyNote = notPaddy
    ? `<p class="result-note">This doesn't look like a paddy leaf (paddy confidence ${Math.round((data.paddy_confidence || 0) * 100)}%). The prediction below is shown for testing only and may be unreliable.</p>`
    : '';

  // Backend skipped prediction for non-paddy
  if (notPaddy && !data.final && data.disease_confidence == null) {
    resultCard.innerHTML = `
      ${paddyBadge}
      <h3>This doesn't look like a paddy leaf</h3>
      <p class="result-note">Try a closer photo of a single leaf, filling most of the frame.</p>
      ${confidenceRow('Confidence', data.paddy_confidence)}
    `;
    return;
  }

  const sub = data.sub_class || null;
  const final = data.final || null;

  // Healthy Leaf
  if (!final) {
    resultCard.innerHTML = `
      ${paddyBadge}
      <span class="result-status is-healthy">Looks healthy</span>
      <h3>No disease detected</h3>
      ${notPaddyNote}
      <p class="result-note">The leaf looks healthy based on this photo.</p>
      ${confidenceRow('Paddy', data.paddy_confidence)}
      ${confidenceRow('Healthy', data.disease_confidence)}
      ${similarSection(data.similar_images)}
    `;
    return;
  }

  // Diseased or Unlisted
  const isUnlisted = final.group === 'other' || data.disease === 'unsupported_condition';
  const showGroupLine = !isUnlisted && final.group_label !== final.label;
  const groupLine = showGroupLine
    ? `<p class="result-group">${escapeHtml(final.group_label)}</p>` : '';

  const badges = [
    paddyBadge,
    isUnlisted
      ? '<span class="result-status is-mismatch">Unlisted condition</span>'
      : '<span class="result-status is-diseased">Disease found</span>',
  ].join('');

  // Show user guidance message from backend if present
  const userAlertBox = (isUnlisted && data.message)
    ? `<div class="result-alert-box">${escapeHtml(data.message)}</div>`
    : '';

  const diseaseRowLabel = isUnlisted
    ? 'Condition: Unlisted'
    : `Disease: ${escapeHtml(final.label)}`;

  resultCard.innerHTML = `
    ${badges}
    <h3>${escapeHtml(final.label)}</h3>
    ${groupLine}
    ${notPaddyNote}
    ${userAlertBox}
    <p class="result-note">This is a model estimate — confirm with an expert before treating your crop.</p>
    ${confidenceRow('Paddy', data.paddy_confidence)}
    ${confidenceRow(diseaseRowLabel, final.confidence)}
    ${topCandidates(sub)}
    ${localizationSection(data.localization)}
    ${similarSection(data.similar_images)}
  `;
}

// ---------- feedback box ----------

function attachFeedbackBox(predictionId) {
  resultCard.insertAdjacentHTML('beforeend', `
    <div class="feedback-box">
      <h4>What disease is it really?</h4>
      <div class="feedback-row">
        <input type="text" id="actualInput" placeholder="e.g. blast, brown spot, healthy" autocomplete="off">
        <button type="button" class="btn out sm" id="saveFeedbackBtn">Save</button>
      </div>
      <p class="feedback-status" id="feedbackStatus"></p>
    </div>
  `);

  const input = document.getElementById('actualInput');
  const btn = document.getElementById('saveFeedbackBtn');
  const status = document.getElementById('feedbackStatus');

  async function save() {
    const text = input.value.trim();
    if (!text) {
      status.textContent = 'Please type the actual disease first.';
      return;
    }
    btn.disabled = true;
    try {
      const res = await fetch(FEEDBACK_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prediction_id: predictionId, actual_text: text }),
      });
      if (!res.ok) throw new Error(res.status);
      status.textContent = 'Saved ✓';
    } catch (err) {
      console.error(err);
      status.textContent = "Couldn't save. Is the backend running?";
    }
    btn.disabled = false;
  }

  btn.addEventListener('click', save);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
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

// ---------- paste image (Ctrl+V / Cmd+V) ----------

const AUTO_ANALYZE_ON_PASTE = false;

async function imageFileFromClipboard(clipboardData) {
  for (const item of clipboardData.items || []) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }

  const html = clipboardData.getData('text/html');
  let url = '';
  if (html) {
    const img = new DOMParser().parseFromString(html, 'text/html').querySelector('img');
    if (img) url = img.getAttribute('src') || '';
  }
  if (!url) url = (clipboardData.getData('text/plain') || '').trim();

  if (/^(data:image\/|https?:\/\/)/i.test(url)) {
    const res = await fetch(url);
    const blob = await res.blob();
    if (blob.type.startsWith('image/')) {
      const ext = blob.type.split('/')[1].split('+')[0] || 'png';
      return new File([blob], `pasted-image.${ext}`, { type: blob.type });
    }
  }
  return null;
}

document.addEventListener('paste', async (e) => {
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  if (!e.clipboardData) return;

  try {
    const file = await imageFileFromClipboard(e.clipboardData);
    if (!file) {
      showError('No image found in the clipboard. Copy an image first, then press Ctrl+V.');
      return;
    }
    e.preventDefault();
    resetForm();
    handleFileSelected(file);
    if (AUTO_ANALYZE_ON_PASTE) analyzeBtn.click();
  } catch (err) {
    console.error(err);
    showError("Couldn't read that image from the clipboard. Right-click it and choose 'Copy image', or save it and upload.");
  }
});