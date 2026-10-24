// Frontend/src/lib/api.js
import { API_BASE_URL } from '../config.js';

export async function checkHealth() {
  const res = await fetch(`${API_BASE_URL}/api/health`);
  if (!res.ok) throw new Error(`Health check failed (${res.status})`);
  return res.json();
}

export async function predictLeaf(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE_URL}/api/predict`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error(`Server responded with ${res.status}`);
  return res.json();
}

export async function sendFeedback(predictionId, actualText) {
  const res = await fetch(`${API_BASE_URL}/api/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prediction_id: predictionId, actual_text: actualText }),
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json().catch(() => ({}));
}

export const resolveImageUrl = (url) =>
  url.startsWith('http') ? url : `${API_BASE_URL}${url}`;