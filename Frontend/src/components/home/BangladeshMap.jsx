// Frontend/src/components/home/BangladeshMap.jsx
// Bangladesh drawn with paddy grains + plants. One division at a time lights up.
// Reads map data from Frontend/public/map-source.html (no node script needed).
import { useEffect, useRef, useState } from 'react';

const SOURCE = '/map-source.html';
const CW = 1000;
const CH = 1356;
const FADE = 800;
const CENTER = [(47.8 / 100) * CW, (47.6 / 100) * CH];
const GRAIN_COLORS = ['#2f9e6b', '#3fb27c', '#5cc392', '#8fd8b4', '#27885c', '#4fba85', '#b4e6cb', '#35a771'];
const GREEN_COLORS = ['#0b5d3f', '#116b49', '#1a7a55', '#0e5a46', '#15664a'];

// one colour + one pattern per division (same order as the chips)
const THEMES = [
  { bg: '#0f7a55', fg: 'rgba(255,255,255,.35)', p: 'dots' },
  { bg: '#0b5c73', fg: 'rgba(255,255,255,.35)', p: 'waves' },
  { bg: '#d6364d', fg: 'rgba(255,255,255,.38)', p: 'diamond' },
  { bg: '#1a9c7a', fg: 'rgba(255,255,255,.38)', p: 'stripes' },
  { bg: '#2d6a4f', fg: 'rgba(255,255,255,.30)', p: 'grid' },
  { bg: '#52b788', fg: 'rgba(255,255,255,.55)', p: 'cross' },
  { bg: '#3a7d6c', fg: 'rgba(255,255,255,.35)', p: 'rings' },
  { bg: '#06402f', fg: 'rgba(255,255,255,.28)', p: 'scales' },
];

/* ---------- helpers ---------- */
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];
const mk = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
const load = (src) =>
  new Promise((res) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = src;
  });
const ease = (t) => t * t * (3 - 2 * t);

function patternTile(th) {
  const s = 32;
  const c = mk(s, s);
  const x = c.getContext('2d');
  x.strokeStyle = x.fillStyle = th.fg;
  x.lineWidth = 2.2;
  x.lineCap = 'round';
  x.beginPath();
  switch (th.p) {
    case 'dots': x.arc(8, 8, 3, 0, 7); x.fill(); x.beginPath(); x.arc(24, 24, 3, 0, 7); x.fill(); break;
    case 'stripes': x.moveTo(0, 16); x.lineTo(16, 0); x.moveTo(0, 32); x.lineTo(32, 0); x.moveTo(16, 32); x.lineTo(32, 16); x.stroke(); break;
    case 'waves': x.moveTo(0, 16); x.quadraticCurveTo(8, 6, 16, 16); x.quadraticCurveTo(24, 26, 32, 16); x.stroke(); break;
    case 'grid': x.moveTo(0, 0); x.lineTo(s, 0); x.moveTo(0, 0); x.lineTo(0, s); x.stroke(); break;
    case 'cross': x.moveTo(16, 10); x.lineTo(16, 22); x.moveTo(10, 16); x.lineTo(22, 16); x.stroke(); break;
    case 'rings': x.arc(16, 16, 8, 0, 7); x.stroke(); break;
    case 'diamond': x.moveTo(16, 4); x.lineTo(28, 16); x.lineTo(16, 28); x.lineTo(4, 16); x.closePath(); x.stroke(); break;
    default: x.arc(16, 20, 12, Math.PI, 0); x.stroke();
  }
  return c;
}

async function getData() {
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`${SOURCE} not found (HTTP ${res.status})`);
  const html = await res.text();

  const grab = (n) => {
    const m = html.match(new RegExp(`const\\s+${n}\\s*=\\s*"(data:[^"]+)"`));
    if (!m) throw new Error(`${n} not found in ${SOURCE}`);
    return m[1];
  };

  const s = html.indexOf('const DIVS');
  const e = html.indexOf('}];', s);
  if (s < 0 || e < 0) throw new Error(`DIVS not found in ${SOURCE}`);
  const arr = html.slice(s, e + 2).replace(/^const\s+DIVS\s*=\s*/, '');

  return { mask: grab('MASK_SRC'), shade: grab('SHADE_SRC'), divs: JSON.parse(arr) };
}

/* ---------- the canvas engine ---------- */
function runMap({ canvas, divs, maskImg, shadeImg, divImgs, chips, reduce }) {
  if (!maskImg || !shadeImg) throw new Error('Map images could not be decoded');

  const PERIOD = reduce ? 4500 : 3800;
  canvas.width = CW;
  canvas.height = CH;
  const ctx = canvas.getContext('2d');

  let stopped = false;
  let raf = 0;
  let seqReady = false;
  let seqStart = 0;

  /* map silhouette: luminance -> alpha */
  const mc = mk(CW, CH);
  const mx = mc.getContext('2d');
  mx.drawImage(maskImg, 0, 0, CW, CH);
  const md = mx.getImageData(0, 0, CW, CH);
  const m = new Uint8Array(CW * CH);
  let area = 0;
  for (let i = 0; i < CW * CH; i++) {
    const v = md.data[i * 4];
    m[i] = v;
    if (v > 128) area++;
    md.data[i * 4 + 3] = v;
    md.data[i * 4] = md.data[i * 4 + 1] = md.data[i * 4 + 2] = 0;
  }
  mx.putImageData(md, 0, 0);

  /* shade map: lighter areas get more green plants */
  const sw = shadeImg.width;
  const sh = shadeImg.height;
  const sc = mk(sw, sh);
  const sx = sc.getContext('2d');
  sx.drawImage(shadeImg, 0, 0);
  const sd = sx.getImageData(0, 0, sw, sh).data;
  const shadeAt = (x, y) =>
    sd[(Math.min(sh - 1, ((y / CH) * sh) | 0) * sw + Math.min(sw - 1, ((x / CW) * sw) | 0)) * 4] / 255;

  const tint = (color) => {
    const c = mk(CW, CH);
    const g = c.getContext('2d');
    g.drawImage(mc, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, CW, CH);
    return c;
  };
  const baseC = tint('#1f7a55');
  const edgeC = tint('#043d2a');
  const outline = mk(CW, CH);
  const og = outline.getContext('2d');
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2;
    og.drawImage(edgeC, Math.cos(a) * 3.4, Math.sin(a) * 3.4);
  }

  /* division layers (built lazily, cached) */
  const layers = [];
  function layerFor(i) {
    if (layers[i]) return layers[i];
    if (!divImgs[i]) {
      layers[i] = mk(CW, CH);
      return layers[i];
    }
    const rc = mk(CW, CH);
    const rx = rc.getContext('2d');
    rx.drawImage(divImgs[i], 0, 0, CW, CH);
    const rd = rx.getImageData(0, 0, CW, CH);
    for (let j = 0; j < CW * CH; j++) {
      rd.data[j * 4 + 3] = rd.data[j * 4];
      rd.data[j * 4] = rd.data[j * 4 + 1] = rd.data[j * 4 + 2] = 0;
    }
    rx.putImageData(rd, 0, 0);

    const L = mk(CW, CH);
    const g = L.getContext('2d');
    const th = THEMES[i % THEMES.length];
    g.fillStyle = th.bg;
    g.fillRect(0, 0, CW, CH);
    g.fillStyle = g.createPattern(patternTile(th), 'repeat');
    g.fillRect(0, 0, CW, CH);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(rc, 0, 0);
    layers[i] = L;
    return L;
  }

  /* grain / plant items */
  const items = [];
  const TARGET = Math.round(area / 27);
  let guard = 0;
  while (items.length < TARGET && guard++ < TARGET * 12) {
    const x = (Math.random() * CW) | 0;
    const y = (Math.random() * CH) | 0;
    if (m[y * CW + x] < 128) continue;
    const s = shadeAt(x, y);
    const isPlant = Math.random() < 0.08 + 0.4 * s;
    items.push({
      x, y, plant: isPlant,
      a: rnd(0, Math.PI),
      len: rnd(15, 21),
      wid: rnd(5.6, 7.6),
      col: isPlant ? pick(GREEN_COLORS) : pick(GRAIN_COLORS),
      h: rnd(30, 46),
      lean: rnd(-8, 8),
      key: Math.hypot(x - CENTER[0], y - CENTER[1]) + Math.random() * 140,
    });
  }
  items.sort((a, b) => a.key - b.key);

  const ic = mk(CW, CH);
  const ig = ic.getContext('2d');
  const cc = mk(CW, CH);
  const cg = cc.getContext('2d');

  function drawGrain(it) {
    ig.save();
    ig.translate(it.x, it.y);
    ig.rotate(it.a);
    ig.beginPath();
    ig.ellipse(0, 0, it.len / 2, it.wid / 2, 0, 0, Math.PI * 2);
    ig.fillStyle = it.col;
    ig.fill();
    ig.lineWidth = 1.4;
    ig.strokeStyle = 'rgba(4,61,42,.35)';
    ig.stroke();
    ig.beginPath();
    ig.moveTo(-it.len * 0.28, -it.wid * 0.12);
    ig.lineTo(it.len * 0.2, -it.wid * 0.12);
    ig.strokeStyle = 'rgba(255,255,255,.55)';
    ig.lineWidth = 1.2;
    ig.stroke();
    ig.beginPath();
    ig.moveTo(it.len / 2, 0);
    ig.lineTo(it.len / 2 + 4.4, -1.2);
    ig.strokeStyle = 'rgba(4,61,42,.5)';
    ig.lineWidth = 1;
    ig.stroke();
    ig.restore();
  }

  function drawPlant(it) {
    const { x, y, h, lean, col } = it;
    ig.lineCap = 'round';
    ig.strokeStyle = col;
    ig.lineWidth = 3;
    [-1, 1].forEach((d) => {
      ig.beginPath();
      ig.moveTo(x, y - h * 0.15);
      ig.quadraticCurveTo(x + d * 10, y - h * 0.5, x + d * (16 + Math.abs(lean) * 0.3), y - h * 0.52);
      ig.stroke();
    });
    ig.lineWidth = 3.2;
    ig.beginPath();
    ig.moveTo(x, y);
    ig.quadraticCurveTo(x + lean * 0.2, y - h * 0.6, x + lean, y - h);
    ig.stroke();
    const tx = x + lean;
    const ty = y - h;
    ig.strokeStyle = '#e8566a';
    ig.lineWidth = 2.2;
    ig.beginPath();
    ig.moveTo(tx, ty);
    ig.quadraticCurveTo(tx + 8, ty - 4, tx + 12, ty + 10);
    ig.stroke();
    ig.fillStyle = '#f7828f';
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      ig.beginPath();
      ig.ellipse(tx + 12 * t + (i % 2 ? 1.6 : -1.6), ty + (-4 * (1 - t) + 10 * t) + 2.4 * t, 2.4, 4.2, 0.4, 0, Math.PI * 2);
      ig.fill();
    }
  }

  function render() {
    cg.globalCompositeOperation = 'source-over';
    cg.clearRect(0, 0, CW, CH);
    cg.drawImage(ic, 0, 0);
    cg.globalCompositeOperation = 'destination-in';
    cg.drawImage(mc, 0, 0);
    cg.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, CW, CH);
    ctx.drawImage(outline, 0, 0);
    ctx.drawImage(baseC, 0, 0);
    ctx.drawImage(cc, 0, 0);
  }

  /* one division after another, forever */
  let finalC = null;
  let shown = -1;
  function tick(now) {
    if (stopped) return;
    ctx.clearRect(0, 0, CW, CH);
    ctx.drawImage(finalC, 0, 0);

    const el = Math.max(0, now - seqStart);
    const i = Math.floor(el / PERIOD) % divs.length;
    const t = el % PERIOD;
    let a = 1;
    if (!reduce) {
      if (t < FADE) a = ease(t / FADE);
      else if (t > PERIOD - FADE) a = ease((PERIOD - t) / FADE);
    }
    ctx.globalAlpha = a * 0.92;
    ctx.drawImage(layerFor(i), 0, 0);
    ctx.globalAlpha = 1;

    if (i !== shown) {
      if (shown >= 0 && chips[shown]) {
        chips[shown].classList.remove('on');
        chips[shown].style.setProperty('--p', 0);
      }
      if (chips[i]) chips[i].classList.add('on');
      shown = i;
    }
    if (chips[i]) chips[i].style.setProperty('--p', (t / PERIOD).toFixed(3));
    raf = requestAnimationFrame(tick);
  }

  function startSequence() {
    finalC = mk(CW, CH);
    finalC.getContext('2d').drawImage(canvas, 0, 0);
    seqReady = true;
    seqStart = performance.now();
    raf = requestAnimationFrame(tick);
  }

  /* grains fill the map first */
  let idx = 0;
  const BATCH = reduce ? items.length : 650;
  function frame() {
    if (stopped) return;
    const end = Math.min(idx + BATCH, items.length);
    for (; idx < end; idx++) {
      const it = items[idx];
      if (it.plant) drawPlant(it);
      else drawGrain(it);
    }
    render();
    if (idx < items.length) raf = requestAnimationFrame(frame);
    else startSequence();
  }
  render();
  raf = requestAnimationFrame(frame);

  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
    },
    jump(i) {
      if (seqReady) seqStart = performance.now() - i * PERIOD;
    },
  };
}

/* ---------- React component ---------- */
export default function BangladeshMap() {
  const canvasRef = useRef(null);
  const chipRefs = useRef([]);
  const jumpRef = useRef(() => {});
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  // 1) load map data + images
  useEffect(() => {
    let alive = true;
    getData()
      .then(async (d) => {
        const [maskImg, shadeImg, divImgs] = await Promise.all([
          load(d.mask),
          load(d.shade),
          Promise.all(d.divs.map((x) => load(`data:image/png;base64,${x.mask}`))),
        ]);
        if (alive) setData({ divs: d.divs, maskImg, shadeImg, divImgs });
      })
      .catch((err) => {
        console.error('BangladeshMap:', err);
        if (alive) setError(err.message);
      });
    return () => {
      alive = false;
    };
  }, []);

  // 2) when chips are rendered, start the drawing
  useEffect(() => {
    if (!data) return undefined;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let engine;
    try {
      engine = runMap({ ...data, canvas: canvasRef.current, chips: chipRefs.current, reduce });
      jumpRef.current = engine.jump;
    } catch (err) {
      console.error('BangladeshMap:', err);
      setError(err.message);
    }
    return () => engine?.stop();
  }, [data]);

  return (
    <div className="maphero">
      <div className={`map-stage ${data ? 'ready' : ''}`}>
        <canvas
          ref={canvasRef}
          id="map"
          aria-label="Map of Bangladesh drawn with paddy grains and plants, showing each division one after another"
        />
        {!data && !error && <div className="map-loading">Drawing the map…</div>}
      </div>

      {error && <p className="map-error">The map could not load: {error}</p>}

      <nav className="chips" aria-label="Divisions">
        {data?.divs.map((d, i) => (
          <button
            key={d.name}
            type="button"
            className="chip"
            style={{ '--c': THEMES[i % THEMES.length].bg }}
            ref={(el) => {
              chipRefs.current[i] = el;
            }}
            onClick={() => jumpRef.current(i)}
          >
            <b>{d.name}</b>
            <small>{d.bn}</small>
          </button>
        ))}
      </nav>
    </div>
  );
}