// When served by the backend (same origin) use relative URLs.
// When opened from Live Server or another port, talk to the backend directly.
const API = ["8000", ""].includes(location.port) && location.protocol !== "file:"
  ? "" : "http://127.0.0.1:8000";
const PREDICT_URL = API + "/api/predict"; // change if your router uses a different path
const FILE_FIELD = "file";                // change if predict.py expects another field name

const $ = id => document.getElementById(id);
let selected = null;

// --- server status -------------------------------------------------------
fetch(API + "/api/health")
  .then(r => r.json())
  .then(() => setStatus("Server online", "ok"))
  .catch(() => setStatus("Server offline", "bad"));
function setStatus(t, c) { const s = $("status"); s.textContent = t; s.className = "pill " + c; }

// --- file selection ------------------------------------------------------
const drop = $("drop"), input = $("file");
input.addEventListener("change", () => pick(input.files[0]));
drop.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
["dragover", "dragenter"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", e => pick(e.dataTransfer.files[0]));

function pick(f) {
  if (!f) return;
  if (!f.type.startsWith("image/")) return showError("Please choose an image file (JPG or PNG).");
  selected = f; showError("");
  $("preview").src = URL.createObjectURL(f);
  $("preview").hidden = false; $("drop-hint").hidden = true;
  $("analyze").disabled = false;
}
function showError(msg) { const e = $("error"); e.textContent = msg; e.hidden = !msg; }

// --- analyze -------------------------------------------------------------
$("analyze").addEventListener("click", async () => {
  if (!selected) return;
  const btn = $("analyze");
  btn.disabled = true; btn.textContent = "Analyzing…"; showError("");
  try {
    const body = new FormData();
    body.append(FILE_FIELD, selected);
    const res = await fetch(PREDICT_URL, { method: "POST", body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail ? JSON.stringify(data.detail) : "Server returned " + res.status);
    render(data);
  } catch (err) {
    showError("Could not analyze the leaf. " + err.message);
  } finally {
    btn.disabled = false; btn.textContent = "Analyze leaf";
  }
});

// --- render (tolerant of different response shapes) ----------------------
const pickKey = (o, keys) => keys.map(k => o[k]).find(v => v !== undefined && v !== null);
const imgSrc = v => !v ? "" : /^(https?:|data:)/.test(v) ? v : v.startsWith("/") ? API + v : "data:image/png;base64," + v;

function render(d) {
  const top = d.prediction && typeof d.prediction === "object" ? d.prediction : d;
  const name = pickKey(top, ["disease", "label", "class", "class_name", "predicted_class", "prediction"]);
  let conf = pickKey(top, ["confidence", "score", "probability"]);
  $("disease").textContent = typeof name === "string" ? name : "See details below";

  if (typeof conf === "number") {
    if (conf <= 1) conf *= 100;
    $("bar").style.width = "0"; requestAnimationFrame(() => $("bar").style.width = conf.toFixed(0) + "%");
    $("conf").textContent = conf.toFixed(1) + "% confidence";
  } else { $("bar").style.width = "0"; $("conf").textContent = ""; }

  // any other plain text fields (severity, advice, treatment...) shown as notes
  const extra = $("extra"); extra.replaceChildren();
  const skip = /image|similar|confidence|score|probab|disease|label|class|prediction|spots|box/i;
  Object.entries(d).forEach(([k, v]) => {
    if (typeof v === "string" && v.length < 400 && !skip.test(k)) {
      const row = document.createElement("div"), b = document.createElement("b");
      b.textContent = k.replace(/_/g, " "); row.append(b, v); extra.append(row);
    }
  });

  const spot = imgSrc(pickKey(d, ["annotated_image", "localization_image", "spots_image", "overlay", "heatmap"]));
  $("spots").src = spot; $("spots-wrap").hidden = !spot;

  const sim = Array.isArray(d.similar_images) ? d.similar_images : [];
  const grid = $("similar"); grid.replaceChildren();
  sim.forEach(s => {
    const fig = document.createElement("figure"), img = document.createElement("img"), cap = document.createElement("figcaption");
    img.src = imgSrc(s.image_url || s.url || s); img.alt = "Similar case"; img.loading = "lazy";
    const label = s.label || s.disease || s.name || "";
    const sc = typeof s.similarity === "number" ? (s.similarity <= 1 ? s.similarity * 100 : s.similarity).toFixed(0) + "% similar" : "";
    cap.textContent = label; if (sc) { const sm = document.createElement("small"); sm.textContent = sc; cap.append(sm); }
    fig.append(img, cap); grid.append(fig);
  });
  $("similar-wrap").hidden = !sim.length;

  $("raw").textContent = JSON.stringify(d, (k, v) => typeof v === "string" && v.length > 200 ? v.slice(0, 60) + "…(truncated)" : v, 2);
  $("results").hidden = false;
  $("results").scrollIntoView({ behavior: "smooth" });
}