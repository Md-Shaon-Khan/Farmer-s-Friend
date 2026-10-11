/* ============================================================
   Bangladesh map = paddy grains + paddy plants (real map silhouette).
   One division at a time the farmer photo appears inside its shape.

   NO node script / map-data.js needed. The map data (silhouette,
   shade map, division masks) is read straight from your old
   standalone page, saved as:   js/map-source.html
   (open the site with Live Server / backend, not file://)
   ============================================================ */
(function () {
  const canvas = document.getElementById('map');
  const chipBox = document.getElementById('chips');
  if (!canvas) return;

  const SOURCE = 'js/map-source.html';
  const PHOTO_PATHS = ['assets/images/slide1.jpg', 'assets/images/slide2.jpg', 'assets/images/slide3.jpg'];

  const CW = 1000, CH = 1356;
  const PH = { cx: 510, cy: 350, w: 900, h: 800 };
  const GRAIN_COLORS = ['#2f9e6b', '#3fb27c', '#5cc392', '#8fd8b4', '#27885c', '#4fba85', '#b4e6cb', '#35a771'];
  const GREEN_COLORS = ['#0b5d3f', '#116b49', '#1a7a55', '#0e5a46', '#15664a'];
  const CENTER = [47.8 / 100 * CW, 47.6 / 100 * CH];

  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PERIOD = reduce ? 4500 : 3800;
  const FADE = 800;

  canvas.width = CW; canvas.height = CH;
  const ctx = canvas.getContext('2d');

  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[(Math.random() * a.length) | 0];
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  // resolves null (not hangs) if an image is missing
  const load = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  const ease = t => t * t * (3 - 2 * t);
  // one colour + one pattern per division (same order as the chips)
  const THEMES = [
    { bg: '#0f7a55', fg: 'rgba(255,255,255,.35)', p: 'dots' },
    { bg: '#0b5c73', fg: 'rgba(255,255,255,.35)', p: 'waves' },
    { bg: '#d6364d', fg: 'rgba(255,255,255,.38)', p: 'diamond' },
    { bg: '#1a9c7a', fg: 'rgba(255,255,255,.38)', p: 'stripes' },
    { bg: '#2d6a4f', fg: 'rgba(255,255,255,.30)', p: 'grid' },
    { bg: '#52b788', fg: 'rgba(255,255,255,.55)', p: 'cross' },
    { bg: '#3a7d6c', fg: 'rgba(255,255,255,.35)', p: 'rings' },
    { bg: '#06402f', fg: 'rgba(255,255,255,.28)', p: 'scales' }
  ];
  function patternTile(th) {
    const s = 32, c = mk(s, s), x = c.getContext('2d');
    x.strokeStyle = x.fillStyle = th.fg; x.lineWidth = 2.2; x.lineCap = 'round';
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

  let DIVS = [], PHOTOS = null, chips = [], seqReady = false, seqStart = 0;

  async function getData() {
    const res = await fetch(SOURCE);
    if (!res.ok) throw new Error(SOURCE + ' paoa jay nai (HTTP ' + res.status + ')');
    const html = await res.text();
    const grab = n => {
      const m = html.match(new RegExp('const\\s+' + n + '\\s*=\\s*"(data:[^"]+)"'));
      if (!m) throw new Error(n + ' ' + SOURCE + ' e nai');
      return m[1];
    };
    const s = html.indexOf('const DIVS');
    const e = html.indexOf('}];', s);
    if (s < 0 || e < 0) throw new Error('DIVS ' + SOURCE + ' e nai');
    const arr = html.slice(s, e + 2).replace(/^const\s+DIVS\s*=\s*/, '');
    return { mask: grab('MASK_SRC'), shade: grab('SHADE_SRC'), divs: JSON.parse(arr) };
  }

  function buildChips() {
    chipBox.innerHTML = '';
    chips = DIVS.map((d, i) => {
      const b = document.createElement('button');
      b.className = 'chip'; b.type = 'button'; b.style.setProperty('--c', THEMES[i % THEMES.length].bg);
      b.innerHTML = '<b>' + d.name + '</b><small>' + d.bn + '</small>';
      b.addEventListener('click', () => { if (seqReady) seqStart = performance.now() - i * PERIOD; });
      chipBox.appendChild(b);
      return b;
    });
  }

  getData().then(async d => {
    DIVS = d.divs;
    buildChips();
    const [maskImg, shadeImg, divImgs] = await Promise.all([
      load(d.mask), load(d.shade),
      Promise.all(DIVS.map(x => load('data:image/png;base64,' + x.mask)))
    ]);
    run(maskImg, shadeImg, null, divImgs);
  }).catch(err => {
    console.error('map.js:', err);
    chipBox.innerHTML = '<p style="color:#8f2429;font-size:.85rem;text-align:center">Map load hoy nai: ' + err.message + '</p>';
  });

  function run(maskImg, shadeImg, farmerImg, divImgs) {
    /* ---- map silhouette: luminance -> alpha ---- */
    const mc = mk(CW, CH), mx = mc.getContext('2d');
    mx.drawImage(maskImg, 0, 0, CW, CH);
    const md = mx.getImageData(0, 0, CW, CH);
    const m = new Uint8Array(CW * CH);
    let area = 0;
    for (let i = 0; i < CW * CH; i++) {
      const v = md.data[i * 4];
      m[i] = v; if (v > 128) area++;
      md.data[i * 4 + 3] = v; md.data[i * 4] = md.data[i * 4 + 1] = md.data[i * 4 + 2] = 0;
    }
    mx.putImageData(md, 0, 0);

    /* ---- shade map: lighter areas get more green plants ---- */
    const sw = shadeImg.width, sh = shadeImg.height;
    const sc = mk(sw, sh), sx = sc.getContext('2d');
    sx.drawImage(shadeImg, 0, 0);
    const sd = sx.getImageData(0, 0, sw, sh).data;
    const shadeAt = (x, y) => sd[((Math.min(sh - 1, (y / CH * sh) | 0)) * sw + Math.min(sw - 1, (x / CW * sw) | 0)) * 4] / 255;

    const tint = color => {
      const c = mk(CW, CH), g = c.getContext('2d');
      g.drawImage(mc, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = color; g.fillRect(0, 0, CW, CH);
      return c;
    };
    const baseC = tint('#1f7a55');
    const edgeC = tint('#043d2a');
    const outline = mk(CW, CH), og = outline.getContext('2d');
    for (let k = 0; k < 18; k++) {
      const a = k / 18 * Math.PI * 2;
      og.drawImage(edgeC, Math.cos(a) * 3.4, Math.sin(a) * 3.4);
    }

    /* ---- division photo layers (built lazily, cached) ---- */
    const layers = [];
    function layerFor(i) {
      if (layers[i]) return layers[i];
      const d = DIVS[i];
      const rc = mk(CW, CH), rx = rc.getContext('2d');
      rx.drawImage(divImgs[i], 0, 0, CW, CH);
      const rd = rx.getImageData(0, 0, CW, CH);
      for (let j = 0; j < CW * CH; j++) { rd.data[j * 4 + 3] = rd.data[j * 4]; rd.data[j * 4] = rd.data[j * 4 + 1] = rd.data[j * 4 + 2] = 0; }
      rx.putImageData(rd, 0, 0);

      const L = mk(CW, CH), g = L.getContext('2d');
      const th = THEMES[i % THEMES.length];
      g.fillStyle = th.bg; g.fillRect(0, 0, CW, CH);
      g.fillStyle = g.createPattern(patternTile(th), 'repeat'); g.fillRect(0, 0, CW, CH);
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(rc, 0, 0);
      layers[i] = L;
      return L;
    }

    /* ---- grain / plant items ---- */
    const items = [];
    const TARGET = Math.round(area / 27);
    let guard = 0;
    while (items.length < TARGET && guard++ < TARGET * 12) {
      const x = (Math.random() * CW) | 0, y = (Math.random() * CH) | 0;
      if (m[y * CW + x] < 128) continue;
      const s = shadeAt(x, y);
      const plant = Math.random() < (0.08 + 0.40 * s);
      items.push({
        x, y, plant,
        a: rnd(0, Math.PI),
        len: rnd(15, 21), wid: rnd(5.6, 7.6),
        col: plant ? pick(GREEN_COLORS) : pick(GRAIN_COLORS),
        h: rnd(30, 46), lean: rnd(-8, 8),
        key: Math.hypot(x - CENTER[0], y - CENTER[1]) + Math.random() * 140
      });
    }
    items.sort((a, b) => a.key - b.key);

    const ic = mk(CW, CH), ig = ic.getContext('2d');
    const cc = mk(CW, CH), cg = cc.getContext('2d');

    function grain(it) {
      ig.save(); ig.translate(it.x, it.y); ig.rotate(it.a);
      ig.beginPath(); ig.ellipse(0, 0, it.len / 2, it.wid / 2, 0, 0, Math.PI * 2);
      ig.fillStyle = it.col; ig.fill();
      ig.lineWidth = 1.4; ig.strokeStyle = 'rgba(4,61,42,.35)'; ig.stroke();
      ig.beginPath(); ig.moveTo(-it.len * .28, -it.wid * .12); ig.lineTo(it.len * .2, -it.wid * .12);
      ig.strokeStyle = 'rgba(255,255,255,.55)'; ig.lineWidth = 1.2; ig.stroke();
      ig.beginPath(); ig.moveTo(it.len / 2, 0); ig.lineTo(it.len / 2 + 4.4, -1.2);
      ig.strokeStyle = 'rgba(4,61,42,.5)'; ig.lineWidth = 1; ig.stroke();
      ig.restore();
    }
    function plant(it) {
      const { x, y, h, lean, col } = it;
      ig.lineCap = 'round';
      ig.strokeStyle = col; ig.lineWidth = 3;
      [-1, 1].forEach(d => {
        ig.beginPath(); ig.moveTo(x, y - h * .15);
        ig.quadraticCurveTo(x + d * 10, y - h * .5, x + d * (16 + Math.abs(lean) * .3), y - h * .52); ig.stroke();
      });
      ig.lineWidth = 3.2;
      ig.beginPath(); ig.moveTo(x, y);
      ig.quadraticCurveTo(x + lean * .2, y - h * .6, x + lean, y - h); ig.stroke();
      const tx = x + lean, ty = y - h;
      ig.strokeStyle = '#e8566a'; ig.lineWidth = 2.2;
      ig.beginPath(); ig.moveTo(tx, ty); ig.quadraticCurveTo(tx + 8, ty - 4, tx + 12, ty + 10); ig.stroke();
      ig.fillStyle = '#f7828f';
      for (let i = 0; i < 4; i++) {
        const t = i / 3;
        ig.beginPath();
        ig.ellipse(tx + 12 * t + (i % 2 ? 1.6 : -1.6), ty + (-4 * (1 - t) + 10 * t) + 2.4 * t, 2.4, 4.2, .4, 0, Math.PI * 2);
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

    /* ---- one division after another, forever ---- */
    let finalC = null, shown = -1;
    function tick(now) {
      ctx.clearRect(0, 0, CW, CH);
      ctx.drawImage(finalC, 0, 0);
      const el = Math.max(0, now - seqStart);
      const i = Math.floor(el / PERIOD) % DIVS.length;
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
        if (shown >= 0) { chips[shown].classList.remove('on'); chips[shown].style.setProperty('--p', 0); }
        chips[i].classList.add('on'); shown = i;

      }
      chips[i].style.setProperty('--p', (t / PERIOD).toFixed(3));
      requestAnimationFrame(tick);
    }
    function startSequence() {
      finalC = mk(CW, CH);
      finalC.getContext('2d').drawImage(canvas, 0, 0);
      seqReady = true;
      seqStart = performance.now();
      requestAnimationFrame(tick);
    }

    /* ---- grains fill the map first ---- */
    let idx = 0;
    const BATCH = reduce ? items.length : 650;
    function frame() {
      const end = Math.min(idx + BATCH, items.length);
      for (; idx < end; idx++) { const it = items[idx]; it.plant ? plant(it) : grain(it); }
      render();
      if (idx < items.length) requestAnimationFrame(frame);
      else startSequence();
    }
    render();
    requestAnimationFrame(frame);
  }
})();