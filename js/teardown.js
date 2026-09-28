/* =========================================================
   Click Celulares — desmontagem do iPhone (peças)
   ---------------------------------------------------------
   Dois tipos de peça, todas posicionadas nas coordenadas da foto
   assets/iphone.png (2048 x 1376):

   1. Peças RECORTADAS DA FOTO (canvas): vidro traseiro, placa das
      câmeras, 3 lentes, 3 botões e 2 parafusos da porta. O que sobra
      da foto vira o corpo do aparelho (laterais de metal reais).

   2. Peças INTERNAS desenhadas em SVG num plano de 300 x 624
      (largura x comprimento, visto por trás, câmeras no topo) e
      projetadas na perspectiva da foto por uma homografia (matrix3d).

   Cada peça tem um movimento: dx/dy (px da foto), rotação r,
   início s e duração d no progresso da rolagem (0 a 1).
   ========================================================= */
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const PW = 300, PL = 624;                                   // plano interno

  /* ---------- Homografia: plano 300x624 -> foto ---------- */
  // Cantos do vidro traseiro na foto (cantos virtuais, antes do arredondamento)
  const QUAD = [[1490, 222], [1965, 410], [512, 1146], [95, 885]];

  function solve(A, B) {
    const n = B.length;
    for (let i = 0; i < n; i++) {
      let m = i;
      for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[m][i])) m = r;
      [A[i], A[m]] = [A[m], A[i]];
      [B[i], B[m]] = [B[m], B[i]];
      for (let r = i + 1; r < n; r++) {
        const f = A[r][i] / A[i][i];
        for (let c = i; c < n; c++) A[r][c] -= f * A[i][c];
        B[r] -= f * B[i];
      }
    }
    const x = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let s = B[i];
      for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c];
      x[i] = s / A[i][i];
    }
    return x;
  }
  function homography(src, dst) {
    const A = [], B = [];
    src.forEach(([x, y], i) => {
      const [X, Y] = dst[i];
      A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]); B.push(X);
      A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]); B.push(Y);
    });
    return [...solve(A, B), 1];
  }
  const H = homography([[0, 0], [PW, 0], [PW, PL], [0, PL]], QUAD);
  const toImg = (x, y) => {
    const w = H[6] * x + H[7] * y + 1;
    return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
  };
  const MATRIX3D = `matrix3d(${H[0]},${H[3]},0,${H[6]},${H[1]},${H[4]},0,${H[7]},0,0,1,0,${H[2]},${H[5]},0,1)`;

  /* ---------- Geometria ---------- */
  const roundRectPts = (x, y, w, h, r, n = 10) => {
    const pts = [];
    const corner = (cx, cy, a0) => {
      for (let i = 0; i <= n; i++) {
        const a = a0 + (i / n) * (Math.PI / 2);
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
    };
    corner(x + w - r, y + r, -Math.PI / 2);
    corner(x + w - r, y + h - r, 0);
    corner(x + r, y + h - r, Math.PI / 2);
    corner(x + r, y + r, Math.PI);
    return pts;
  };
  const roundPoly = (poly, r, n = 8) => {
    const out = [];
    poly.forEach((P, i) => {
      const A = poly[(i - 1 + poly.length) % poly.length];
      const B = poly[(i + 1) % poly.length];
      const u = norm([A[0] - P[0], A[1] - P[1]]);
      const v = norm([B[0] - P[0], B[1] - P[1]]);
      const p0 = [P[0] + u[0] * r, P[1] + u[1] * r];
      const p2 = [P[0] + v[0] * r, P[1] + v[1] * r];
      for (let k = 0; k <= n; k++) {                          // curva quadrática no canto
        const t = k / n;
        out.push([
          (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * P[0] + t * t * p2[0],
          (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * P[1] + t * t * p2[1],
        ]);
      }
    });
    return out;
  };
  const ellipsePts = (cx, cy, rx, ry, rotDeg, n = 60) => {
    const a = (rotDeg * Math.PI) / 180, pts = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const x = rx * Math.cos(t), y = ry * Math.sin(t);
      pts.push([cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)]);
    }
    return pts;
  };
  const capsulePts = ([x1, y1], [x2, y2], w, n = 12) => {
    const d = norm([x2 - x1, y2 - y1]), nx = -d[1], ny = d[0], r = w / 2, pts = [];
    const ang = Math.atan2(ny, nx);
    for (let i = 0; i <= n; i++) { const a = ang + (i / n) * Math.PI; pts.push([x2 + r * Math.cos(a), y2 + r * Math.sin(a)]); }
    for (let i = 0; i <= n; i++) { const a = ang + Math.PI + (i / n) * Math.PI; pts.push([x1 + r * Math.cos(a), y1 + r * Math.sin(a)]); }
    return pts;
  };
  function norm(v) { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; }
  const bboxOf = (pts, pad = 6) => {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x = Math.floor(Math.min(...xs) - pad), y = Math.floor(Math.min(...ys) - pad);
    return { x, y, w: Math.ceil(Math.max(...xs) + pad) - x, h: Math.ceil(Math.max(...ys) + pad) - y };
  };
  const centerOf = (b) => [b.x + b.w / 2, b.y + b.h / 2];
  const trace = (ctx, pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };

  // Recortes da foto (medidos na imagem)
  const GLASS = roundRectPts(0, 0, PW, PL, 40, 12).map(([x, y]) => toImg(x, y));
  // Placa das câmeras: cada lado é afastado para fora (px) para levar junto a borda
  // e a sombra que ela projeta no vidro (maior no lado virado para a porta)
  const PLATEAU = (() => {
    const C = [[1170, 408], [1452, 222], [1912, 400], [1650, 578]];
    const OUT = [12, 6, 12, 46];                               // lados: esq, topo, dir, baixo
    const lines = C.map((P, i) => {
      const Q = C[(i + 1) % 4];
      const d = norm([Q[0] - P[0], Q[1] - P[1]]);
      const n = [d[1], -d[0]];
      return { p: [P[0] + n[0] * OUT[i], P[1] + n[1] * OUT[i]], d };
    });
    const corners = C.map((_, i) => {
      const L1 = lines[(i + 3) % 4], L2 = lines[i];
      const den = L1.d[0] * L2.d[1] - L1.d[1] * L2.d[0];
      const k = ((L2.p[0] - L1.p[0]) * L2.d[1] - (L2.p[1] - L1.p[1]) * L2.d[0]) / den;
      return [L1.p[0] + L1.d[0] * k, L1.p[1] + L1.d[1] * k];
    });
    return roundPoly(corners, 60);
  })();
  const LENS_CUTS = [
    { id: 'lens-l', pts: ellipsePts(1312, 362, 112, 64, -14) },
    { id: 'lens-t', pts: ellipsePts(1486, 278, 110, 60, -14) },
    { id: 'lens-r', pts: ellipsePts(1553, 383, 112, 64, -14) },
  ];
  const BUTTONS = [
    { id: 'btn-1', pts: capsulePts([1385, 782], [1485, 728], 38) },
    { id: 'btn-2', pts: capsulePts([1530, 705], [1630, 655], 38) },
    { id: 'btn-3', pts: capsulePts([1690, 625], [1755, 592], 36) },
  ];
  const PORT_SCREWS = [
    { id: 'pscrew-1', pts: ellipsePts(235, 1028, 10, 9, 0, 24) },
    { id: 'pscrew-2', pts: ellipsePts(330, 1078, 10, 9, 0, 24) },
  ];
  const PHONE_BOX = { x: 100, y: 215, w: 1882, h: 995 };

  /* ---------- Aleatório com semente ---------- */
  let seed = 20260928;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

  /* ---------- Materiais SVG compartilhados ---------- */
  const DEFS = `
  <svg class="td-defs" width="0" height="0" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="tdTitanium" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f1f3f6"/><stop offset=".28" stop-color="#b9bfc7"/>
        <stop offset=".55" stop-color="#e6e9ed"/><stop offset=".8" stop-color="#9ea5ae"/><stop offset="1" stop-color="#d5dae0"/>
      </linearGradient>
      <linearGradient id="tdSteel" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f5f7f9"/><stop offset=".45" stop-color="#c2c8cf"/>
        <stop offset=".7" stop-color="#eceff2"/><stop offset="1" stop-color="#a7aeb7"/>
      </linearGradient>
      <linearGradient id="tdAlu" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#c9cfd6"/><stop offset=".5" stop-color="#a9b0b9"/><stop offset="1" stop-color="#bfc5cd"/>
      </linearGradient>
      <linearGradient id="tdPcb" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#172740"/><stop offset="1" stop-color="#0a1322"/>
      </linearGradient>
      <linearGradient id="tdGold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fde6a6"/><stop offset=".5" stop-color="#d6a84c"/><stop offset="1" stop-color="#b48630"/>
      </linearGradient>
      <linearGradient id="tdCopper" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f4b986"/><stop offset=".5" stop-color="#c46d35"/><stop offset="1" stop-color="#e59c60"/>
      </linearGradient>
      <linearGradient id="tdKapton" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#d4912f"/><stop offset=".5" stop-color="#b9781f"/><stop offset="1" stop-color="#d99c43"/>
      </linearGradient>
      <linearGradient id="tdBattery" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#3a3f47"/><stop offset=".55" stop-color="#1c1f24"/><stop offset="1" stop-color="#272a30"/>
      </linearGradient>
      <linearGradient id="tdBlack" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#2e3238"/><stop offset="1" stop-color="#0d0e11"/>
      </linearGradient>
      <linearGradient id="tdScreen" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#6fb8ff"/><stop offset=".4" stop-color="#1f63d6"/><stop offset=".75" stop-color="#004AAD"/><stop offset="1" stop-color="#1b1466"/>
      </linearGradient>
      <linearGradient id="tdSheen" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/>
        <stop offset=".7" stop-color="#fff" stop-opacity=".07"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
      <radialGradient id="tdLens" cx=".4" cy=".36" r=".7">
        <stop offset="0" stop-color="#4a3c93"/><stop offset=".3" stop-color="#1d1742"/>
        <stop offset=".7" stop-color="#07080d"/><stop offset="1" stop-color="#000"/>
      </radialGradient>
      <linearGradient id="tdScrewShank" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#5d646d"/><stop offset=".35" stop-color="#e8ebee"/>
        <stop offset=".6" stop-color="#a9b0b8"/><stop offset="1" stop-color="#4c535b"/>
      </linearGradient>
      <linearGradient id="tdScrewShankDark" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#15171a"/><stop offset=".35" stop-color="#6b7179"/>
        <stop offset=".6" stop-color="#34383e"/><stop offset="1" stop-color="#101214"/>
      </linearGradient>
      <pattern id="tdBrush" patternUnits="userSpaceOnUse" width="300" height="17">
        <path d="M0 .5H300" stroke="#fff" stroke-opacity=".16" stroke-width=".6"/>
        <path d="M0 2.3H300" stroke="#000" stroke-opacity=".08" stroke-width=".5"/>
        <path d="M0 4H300" stroke="#fff" stroke-opacity=".08" stroke-width=".4"/>
        <path d="M0 6.6H300" stroke="#000" stroke-opacity=".06" stroke-width=".6"/>
        <path d="M0 8.1H300" stroke="#fff" stroke-opacity=".12" stroke-width=".5"/>
        <path d="M0 10.9H300" stroke="#000" stroke-opacity=".07" stroke-width=".4"/>
        <path d="M0 12.4H300" stroke="#fff" stroke-opacity=".09" stroke-width=".5"/>
        <path d="M0 14.8H300" stroke="#000" stroke-opacity=".08" stroke-width=".5"/>
        <path d="M0 16.2H300" stroke="#fff" stroke-opacity=".06" stroke-width=".4"/>
      </pattern>
      <pattern id="tdVents" patternUnits="userSpaceOnUse" width="6" height="6">
        <circle cx="3" cy="3" r=".9" fill="#6f7780" fill-opacity=".55"/>
      </pattern>
      <filter id="tdNoise" x="0" y="0" width="1" height="1">
        <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/>
        <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .1 0"/>
        <feComposite in2="SourceGraphic" operator="in"/>
      </filter>
    </defs>
  </svg>`;

  /* ---------- Ajudantes de desenho SVG ---------- */
  const circlePath = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
  const rrPath = (x, y, w, h, r) =>
    `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;

  const metal = (d, fill = 'url(#tdSteel)', stroke = '#88909a') =>
    `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width=".8" fill-rule="evenodd"/>
     <path d="${d}" fill="url(#tdBrush)" fill-rule="evenodd"/>
     <path d="${d}" fill="url(#tdSheen)" fill-rule="evenodd"/>`;

  const hole = (x, y) =>
    `<circle cx="${x}" cy="${y}" r="6.2" fill="#8d959f"/><circle cx="${x}" cy="${y}" r="5" fill="url(#tdSteel)"/><circle cx="${x}" cy="${y}" r="3.1" fill="#131518"/>`;

  const boss = (x, y) =>
    `<circle cx="${x}" cy="${y}" r="5.5" fill="#9ca4ae" stroke="#7c848e" stroke-width=".6"/><circle cx="${x}" cy="${y}" r="2.4" fill="#2a2d31"/>`;

  const connector = (x, y, w, h) => {
    let pins = '';
    for (let px = x + 3; px < x + w - 2; px += 2.4) pins += `M${px.toFixed(1)} ${y + 2.5}V${y + h - 2.5}`;
    return `<rect x="${x - 1.5}" y="${y - 1.5}" width="${w + 3}" height="${h + 3}" rx="1.5" fill="#0a0b0d"/>
            <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1" fill="#1d1f24"/>
            <path d="${pins}" stroke="url(#tdGold)" stroke-width="1"/>`;
  };

  const flex = (d, w = 12) =>
    `<path d="${d}" fill="none" stroke="#8a5a17" stroke-width="${w + 1.6}" stroke-linejoin="round" stroke-linecap="round"/>
     <path d="${d}" fill="none" stroke="url(#tdKapton)" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>
     <path d="${d}" fill="none" stroke="#f3c77e" stroke-opacity=".45" stroke-width=".6" stroke-dasharray="1 2.2"/>`;

  const lensSvg = (cx, cy, r) =>
    `<rect x="${cx - r - 4}" y="${cy - r - 4}" width="${2 * r + 8}" height="${2 * r + 8}" rx="10" fill="#1f2227" stroke="#3b4048" stroke-width="1"/>
     <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#tdTitanium)"/>
     <circle cx="${cx}" cy="${cy}" r="${r - 1.2}" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width=".8"/>
     <circle cx="${cx}" cy="${cy}" r="${r - 5}" fill="#08090b"/>
     <circle cx="${cx}" cy="${cy}" r="${r - 10}" fill="url(#tdLens)"/>
     <circle cx="${cx}" cy="${cy}" r="${r - 15}" fill="none" stroke="#5fae7a" stroke-opacity=".35" stroke-width="1.2" stroke-dasharray="7 5"/>
     <circle cx="${cx}" cy="${cy}" r="${r - 20}" fill="none" stroke="#9a7bff" stroke-opacity=".35" stroke-width="1"/>
     <ellipse cx="${cx - 7}" cy="${cy - 8}" rx="7" ry="4" fill="#fff" fill-opacity=".55" transform="rotate(-35 ${cx - 7} ${cy - 8})"/>
     <circle cx="${cx + 8}" cy="${cy + 7}" r="1.8" fill="#fff" fill-opacity=".4"/>`;

  /* ---------- Layout interno (plano 300 x 624, visto por trás) ---------- */
  const LENSES = [[46, 40], [46, 122], [146, 80]];            // alinhadas com as lentes da foto
  const MAG = [158, 339];                                      // bobina centrada no logo

  const HOLES = [
    [14, 168], [186, 10], [186, 168],                          // suporte das câmeras
    [154, 194], [282, 194], [282, 238], [154, 244],            // suporte da placa
    [214, 269], [246, 269],                                    // conector da bateria
    [38, 557], [74, 557],                                      // Taptic Engine
    [226, 559],                                                // alto-falante
  ];

  function smdScatter() {
    const onBoard = (x, y) => (x > 202 && x < 288 && y > 12 && y < 256) || (x > 14 && x < 288 && y > 186 && y < 256);
    const reserved = [
      [212, 20, 72, 72], [212, 98, 72, 46], [216, 150, 36, 30], [16, 186, 128, 66],
      [146, 186, 146, 74],
    ];
    const free = (x, y) => !reserved.some(([rx, ry, rw, rh]) => x > rx - 3 && x < rx + rw + 3 && y > ry - 3 && y < ry + rh + 3);
    let out = '';
    for (let i = 0; i < 520; i++) {
      const x = 14 + rnd() * 274;
      const y = 12 + rnd() * 244;
      if (!onBoard(x, y) || !free(x, y)) continue;
      const kind = rnd();
      const rot = rnd() > 0.5 ? 90 : 0;
      const f = (v) => v.toFixed(1);
      if (kind < 0.45) {
        const w = 3 + rnd() * 2.5, h = w * 0.55;
        out += `<g transform="rotate(${rot} ${f(x)} ${f(y)})"><rect x="${f(x - w / 2)}" y="${f(y - h / 2)}" width="${f(w)}" height="${f(h)}" fill="${pick(['#b89c6e', '#a88d62', '#c9ad7f', '#8f7a5a'])}"/><rect x="${f(x - w / 2)}" y="${f(y - h / 2)}" width=".9" height="${f(h)}" fill="#d9dde2"/><rect x="${f(x + w / 2 - 0.9)}" y="${f(y - h / 2)}" width=".9" height="${f(h)}" fill="#d9dde2"/></g>`;
      } else if (kind < 0.75) {
        const w = 2.4 + rnd() * 1.6, h = w * 0.5;
        out += `<g transform="rotate(${rot} ${f(x)} ${f(y)})"><rect x="${f(x - w / 2)}" y="${f(y - h / 2)}" width="${f(w)}" height="${f(h)}" fill="#141518"/><rect x="${f(x - w / 2)}" y="${f(y - h / 2)}" width=".7" height="${f(h)}" fill="#cfd4da"/><rect x="${f(x + w / 2 - 0.7)}" y="${f(y - h / 2)}" width=".7" height="${f(h)}" fill="#cfd4da"/></g>`;
      } else if (kind < 0.88) {
        out += `<circle cx="${f(x)}" cy="${f(y)}" r="${(1.2 + rnd()).toFixed(1)}" fill="url(#tdGold)"/>`;
      } else {
        const s = 5 + rnd() * 5;
        out += `<rect x="${f(x - s / 2)}" y="${f(y - s / 2)}" width="${f(s)}" height="${f(s)}" rx=".6" fill="#1a1c20" stroke="#2c3037" stroke-width=".4"/>`;
      }
    }
    return out;
  }

  const barcode = (x, y, w, h) => {
    let out = '', px = x;
    while (px < x + w) {
      const bw = 0.5 + rnd() * 1.8;
      if (rnd() > 0.35) out += `<rect x="${px.toFixed(1)}" y="${y}" width="${bw.toFixed(1)}" height="${h}" fill="#e3e6ea"/>`;
      px += bw + 0.4 + rnd() * 0.8;
    }
    return out;
  };

  /* ---------- Peças internas (SVG no plano) ----------
     rect = área ocupada no plano (para enquadramento e centro de rotação) */
  const INTERIOR = [
    {
      id: 'display', rect: [0, 0, 300, 624], z: 0, edge: '#0b0c0e', depth: 10,
      svg: () => `
        <rect width="300" height="624" rx="42" fill="#050607"/>
        <rect x="1.5" y="1.5" width="297" height="621" rx="40.5" fill="none" stroke="#565c64" stroke-width="2"/>
        <rect x="9" y="9" width="282" height="606" rx="34" fill="url(#tdScreen)"/>
        <clipPath id="tdScreenClip"><rect x="9" y="9" width="282" height="606" rx="34"/></clipPath>
        <g clip-path="url(#tdScreenClip)">
          <circle cx="70" cy="470" r="160" fill="#7cc2ff" fill-opacity=".18"/>
          <circle cx="250" cy="150" r="120" fill="#8b5cff" fill-opacity=".18"/>
        </g>
        <rect x="112" y="20" width="76" height="22" rx="11" fill="#050607"/>
        <text x="150" y="128" text-anchor="middle" font-family="Montserrat, Arial, sans-serif" font-weight="700" font-size="58" fill="#fff">14:35</text>
        <text x="150" y="152" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="12" fill="#fff" fill-opacity=".8">segunda-feira, 28 de setembro</text>
        <circle cx="150" cy="520" r="30" fill="#fff" fill-opacity=".14"/>
        <text x="150" y="530" text-anchor="middle" font-family="Montserrat, Arial" font-weight="900" font-size="28" fill="#fff">C</text>
        <rect x="9" y="9" width="282" height="606" rx="34" fill="url(#tdSheen)"/>`,
    },
    {
      id: 'tray', rect: [0, 0, 300, 624], z: 1, still: true,
      svg: () => {
        const plate = rrPath(0, 0, 300, 624, 40) + LENSES.map(([x, y]) => circlePath(x, y, 30)).join('');
        const bosses = [[20, 22], [280, 22], [20, 602], [280, 602], [16, 262], [284, 262], [16, 530], [284, 530], [196, 16], [150, 610], [196, 178]];
        return `
          <path d="${rrPath(0, 0, 300, 624, 40)}" fill="#0d0f12"/>
          ${metal(plate, 'url(#tdAlu)', '#7d858f')}
          <rect x="24" y="268" width="252" height="262" rx="12" fill="#98a0aa" stroke="#7f8791" stroke-width="1.5"/>
          <rect x="26" y="270" width="248" height="258" rx="11" fill="url(#tdBrush)"/>
          <path d="M28 272H272" stroke="#fff" stroke-opacity=".35"/>
          <rect x="26" y="540" width="130" height="64" rx="10" fill="#959da7" stroke="#7f8791"/>
          <rect x="160" y="540" width="120" height="68" rx="12" fill="#1a1c20"/>
          ${flex('M10 200V520', 7)}
          ${flex('M290 330V470', 7)}
          ${bosses.map(([x, y]) => boss(x, y)).join('')}
          ${LENSES.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="30" fill="#050607"/>`).join('')}`;
      },
    },
    {
      id: 'flexport', rect: [50, 596, 200, 28], z: 1, edge: '#6b4412', depth: 3,
      svg: () => `${flex('M60 612H240', 9)}<rect x="126" y="600" width="48" height="18" rx="4" fill="url(#tdSteel)" stroke="#7d858f"/><rect x="136" y="605" width="28" height="8" rx="4" fill="#15171a"/>`,
    },
    {
      id: 'taptic', rect: [28, 552, 128, 52], z: 1, edge: '#7c848e', depth: 14,
      svg: () => `${metal(rrPath(28, 552, 116, 52, 10))}
        <rect x="40" y="566" width="92" height="24" rx="4" fill="none" stroke="#7d858f" stroke-width=".8"/>
        <text x="86" y="582" text-anchor="middle" font-family="Inter, Arial" font-size="7" fill="#5d646d">TAPTIC ENGINE</text>
        <rect x="140" y="566" width="14" height="10" rx="2" fill="url(#tdGold)"/>`,
    },
    {
      id: 'speaker', rect: [164, 548, 112, 60], z: 1, edge: '#0c0d10', depth: 16,
      svg: () => `
        <rect x="164" y="548" width="112" height="60" rx="12" fill="url(#tdBlack)" stroke="#3a3e45"/>
        <g fill="#050608">${[0, 1, 2, 3, 4, 5, 6].map((i) => `<rect x="${176 + i * 13}" y="598" width="8" height="5" rx="2"/>`).join('')}</g>
        <rect x="176" y="560" width="20" height="8" rx="2" fill="url(#tdGold)"/><rect x="202" y="560" width="20" height="8" rx="2" fill="url(#tdGold)"/>
        <rect x="164" y="548" width="112" height="60" rx="12" fill="url(#tdSheen)"/>`,
    },
    {
      id: 'battery', rect: [24, 232, 252, 318], z: 1, edge: '#0c0e11', depth: 22,
      svg: () => `
        <rect x="24" y="270" width="252" height="258" rx="12" fill="url(#tdBattery)"/>
        <rect x="24" y="270" width="252" height="258" rx="12" fill="#000" filter="url(#tdNoise)"/>
        <rect x="24" y="270" width="252" height="258" rx="12" fill="url(#tdSheen)"/>
        <rect x="25" y="271" width="250" height="256" rx="11" fill="none" stroke="#4a4f57" stroke-width="1"/>
        <g fill="#d7dbe0" font-family="Inter, Arial, sans-serif">
          <text x="44" y="318" font-size="13" font-weight="600">Li-ion Polymer Battery</text>
          <text x="44" y="338" font-size="9.5" fill-opacity=".8">3.87V ⎓ 4832mAh  18.7Wh</text>
          <text x="44" y="354" font-size="8" fill-opacity=".65">Rated capacity 4676mAh</text>
          <text x="44" y="368" font-size="8" fill-opacity=".65">Do not puncture, crush or heat.</text>
        </g>
        <g fill="none" stroke="#d7dbe0" stroke-opacity=".7" stroke-width="1.2">
          <rect x="44" y="388" width="18" height="22" rx="2"/><path d="M47 392l12 14M59 392l-12 14"/>
          <circle cx="80" cy="399" r="10"/><path d="M76 399h8M80 395v8"/>
          <path d="M100 409l9-18 9 18z"/>
        </g>
        <g>${barcode(150, 440, 100, 24)}</g>
        <text x="150" y="480" font-family="Inter, Arial" font-size="7" fill="#d7dbe0" fill-opacity=".6">A3218 · 616-00918</text>
        <rect x="212" y="244" width="38" height="34" rx="4" fill="url(#tdSteel)"/>
        <rect x="212" y="244" width="38" height="34" rx="4" fill="url(#tdBrush)"/>
        ${connector(217, 236, 28, 10)}
        <rect x="42" y="522" width="26" height="28" rx="2" fill="#0b0b0d"/><rect x="138" y="522" width="26" height="28" rx="2" fill="#0b0b0d"/><rect x="234" y="522" width="26" height="28" rx="2" fill="#0b0b0d"/>
        <path d="M50 538l5 6 5-6M146 538l5 6 5-6M242 538l5 6 5-6" stroke="#fff" stroke-opacity=".6" fill="none"/>`,
    },
    {
      id: 'board', rect: [10, 8, 282, 252], z: 1, edge: '#081120', depth: 8,
      svg: () => {
        const pcb = 'M214 8H274A18 18 0 0 1 292 26V244A16 16 0 0 1 276 260H26A16 16 0 0 1 10 244V198A16 16 0 0 1 26 182H198V24A16 16 0 0 1 214 8Z';
        return `
          <path d="${pcb}" fill="url(#tdPcb)" stroke="#2c3e5c" stroke-width="1.2"/>
          <path d="M206 40V170M288 40V180M30 190H140M150 184H284" stroke="#23406b" stroke-width=".8" fill="none"/>
          <g opacity=".92">${smdScatter()}</g>
          <rect x="214" y="22" width="68" height="68" rx="5" fill="#101114" stroke="#2c3037"/>
          <rect x="220" y="28" width="56" height="56" rx="3" fill="#15171b"/>
          <rect x="220" y="28" width="56" height="56" rx="3" fill="url(#tdSheen)"/>
          <text x="248" y="55" text-anchor="middle" font-family="Inter, Arial" font-weight="600" font-size="8.5" fill="#8a9099">A19 PRO</text>
          <text x="248" y="66" text-anchor="middle" font-family="Inter, Arial" font-size="5" fill="#6c727b">TMKH46 2538</text>
          <rect x="214" y="100" width="68" height="42" rx="3" fill="#121317" stroke="#2c3037"/>
          <text x="248" y="124" text-anchor="middle" font-family="Inter, Arial" font-size="6.5" fill="#7c828b">NAND 256G</text>
          <rect x="218" y="152" width="32" height="26" rx="3" fill="#15171b" stroke="#2c3037"/>
          ${metal(rrPath(18, 188, 124, 62, 5))}
          <rect x="24" y="194" width="112" height="50" rx="3" fill="url(#tdVents)"/>
          ${connector(152, 198, 44, 14)}
          ${connector(204, 198, 50, 14)}
          ${connector(152, 222, 40, 14)}
          ${connector(204, 224, 30, 12)}
          <g fill="url(#tdGold)"><circle cx="206" cy="16" r="4"/><circle cx="284" cy="16" r="4"/><circle cx="18" cy="252" r="4"/><circle cx="284" cy="252" r="4"/></g>
          <text x="24" y="180" font-family="Inter, Arial" font-size="5" fill="#dfe6f0" fill-opacity=".6">820-03284-A</text>`;
      },
    },
    {
      id: 'camera', rect: [4, 2, 196, 176], z: 1, edge: '#16181c', depth: 26,
      svg: () => `
        ${metal(rrPath(6, 2, 188, 172, 22), 'url(#tdBlack)', '#3a3e45')}
        ${flex('M96 40H170Q190 40 190 60V78', 11)}
        ${flex('M96 122H170Q190 122 190 102V92', 11)}
        ${connector(184, 76, 14, 22)}
        ${LENSES.map(([x, y], i) => lensSvg(x, y, i === 2 ? 38 : 37)).join('')}`,
    },
    {
      id: 'bracket-cam', rect: [2, 0, 196, 180], z: 1, edge: '#7c848e', depth: 5,
      svg: () => `${metal(rrPath(2, 0, 194, 178, 22) + LENSES.map(([x, y]) => circlePath(x, y, 40)).join(''))}
        ${[0, 1, 2].map((i) => hole(...HOLES[i])).join('')}`,
    },
    {
      id: 'bracket-board', rect: [144, 184, 148, 70], z: 1, edge: '#7c848e', depth: 5,
      svg: () => `${metal('M146 186H290V244H250V252H146Z')}
        <path d="M156 194H280V236" fill="none" stroke="#fff" stroke-opacity=".35"/>
        ${[3, 4, 5, 6].map((i) => hole(...HOLES[i])).join('')}`,
    },
    {
      id: 'bracket-batt', rect: [204, 254, 52, 30], z: 1, edge: '#7c848e', depth: 5,
      svg: () => `${metal(rrPath(206, 256, 48, 26, 3))}${[7, 8].map((i) => hole(...HOLES[i])).join('')}`,
    },
    {
      id: 'bracket-taptic', rect: [26, 544, 60, 26], z: 1, edge: '#7c848e', depth: 5,
      svg: () => `${metal(rrPath(28, 546, 56, 22, 3))}${[9, 10].map((i) => hole(...HOLES[i])).join('')}`,
    },
    {
      id: 'bracket-speaker', rect: [202, 546, 48, 26], z: 1, edge: '#7c848e', depth: 5,
      svg: () => `${metal(rrPath(204, 548, 44, 22, 3))}${hole(...HOLES[11])}`,
    },
    {
      id: 'magsafe', rect: [MAG[0] - 122, 176, 244, 286], z: 1, edge: '#2a1b10', depth: 5,
      svg: () => {
        const [cx, cy] = MAG;
        let coil = '';
        for (let r = 32; r <= 92; r += 2.5) coil += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="url(#tdCopper)" stroke-width="1.9" stroke-opacity="${(0.75 + ((r * 7) % 3) * 0.08).toFixed(2)}"/>`;
        let magnets = '';
        const n = 18;
        for (let i = 0; i < n; i++) {
          const a0 = (i / n) * Math.PI * 2 + 0.03, a1 = ((i + 1) / n) * Math.PI * 2 - 0.03;
          const p = (r, a) => `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
          magnets += `<path d="M${p(100, a0)}A100 100 0 0 1 ${p(100, a1)}L${p(116, a1)}A116 116 0 0 0 ${p(116, a0)}Z" fill="${i % 2 ? '#7a818a' : '#8e959e'}"/>`;
        }
        return `
          ${flex(`M${cx} ${cy - 118}V${cy - 150}`, 18)}
          ${connector(cx - 10, cy - 160, 20, 12)}
          <circle cx="${cx}" cy="${cy}" r="120" fill="#0f1114"/>
          <circle cx="${cx}" cy="${cy}" r="120" fill="url(#tdSheen)"/>
          ${magnets}
          <circle cx="${cx}" cy="${cy}" r="96" fill="#14161a"/>
          ${coil}
          <circle cx="${cx}" cy="${cy}" r="29" fill="#0c0d10"/>
          <circle cx="${cx}" cy="${cy}" r="96" fill="url(#tdSheen)"/>
          <rect x="${cx - 14}" y="${cy + 124}" width="28" height="18" rx="3" fill="#8e959e" stroke="#6b727b"/>`;
      },
    },
  ];

  /* ---------- Roteiro da desmontagem ----------
     dx/dy em px da foto, r em graus, s/d no progresso (0 a 1), lift = arco para cima */
  const MOTION = {
    // 01 · Abertura
    'pscrew-1':        { dx: -170, dy: 190,  r: 90,  s: 0.07, d: 0.08, lift: 60 },
    'pscrew-2':        { dx: -80,  dy: 250,  r: -70, s: 0.08, d: 0.08, lift: 60 },
    'btn-1':           { dx: 170,  dy: 190,  r: 24,  s: 0.09, d: 0.10 },
    'btn-2':           { dx: 230,  dy: 170,  r: 16,  s: 0.10, d: 0.10 },
    'btn-3':           { dx: 280,  dy: 130,  r: 30,  s: 0.11, d: 0.10 },
    'lens-l':          { dx: -40,  dy: -520, r: -8,  s: 0.13, d: 0.11, lift: 60 },
    'lens-t':          { dx: 120,   dy: -610, r: 6,   s: 0.14, d: 0.11, lift: 60 },
    'lens-r':          { dx: 300,  dy: -520, r: 10,  s: 0.15, d: 0.11, lift: 60 },
    'plateau':         { dx: 160,  dy: -330, r: 2,   s: 0.17, d: 0.12, lift: 40 },
    'glass':           { dx: -470, dy: -390, r: -3,  s: 0.20, d: 0.12, lift: 40 },
    // 02 · Parafusos e suportes (parafusos: direção sorteada em build)
    'bracket-cam':     { dx: 430,  dy: -150, r: 6,   s: 0.38, d: 0.10 },
    'bracket-board':   { dx: 700,  dy: 190, r: 12,  s: 0.39, d: 0.10 },
    'bracket-batt':    { dx: 560,  dy: 300,   r: -18, s: 0.40, d: 0.10 },
    'bracket-taptic':  { dx: -130, dy: 430,  r: -20, s: 0.41, d: 0.10 },
    'bracket-speaker': { dx: 120, dy: 540,  r: 16,  s: 0.42, d: 0.10 },
    // 03 · Diagnóstico peça por peça
    'magsafe':         { dx: -740, dy: 110,   r: -6,  s: 0.47, d: 0.10 },
    'camera':          { dx: 570,  dy: -340, r: 5,   s: 0.50, d: 0.10 },
    'board':           { dx: 720,  dy: -40, r: 6,   s: 0.53, d: 0.10 },
    'battery':         { dx: -580, dy: 480,  r: -4,  s: 0.55, d: 0.10 },
    'taptic':          { dx: -280, dy: 660,  r: -10, s: 0.57, d: 0.10 },
    'speaker':         { dx: -10, dy: 720,  r: 8,   s: 0.58, d: 0.10 },
    'flexport':        { dx: -540, dy: 780,  r: -6,  s: 0.59, d: 0.10 },
    // 04 · Tela
    'display':         { dx: 540,  dy: 480,  r: 0,   s: 0.68, d: 0.12, lift: 0 },
  };
  const SCREW_TIMING = { s: 0.30, d: 0.12, stagger: 0.006 };

  /* ---------- Parafuso: cabeça Phillips vista de cima ---------- */
  const SCREW_SIZE = 28;
  function screwCanvas(dark) {
    const s = SCREW_SIZE, r = s / 2;
    const cv = document.createElement('canvas');
    cv.width = cv.height = s * 2;                            // 2x para ficar nítido ao aproximar
    const ctx = cv.getContext('2d');
    ctx.scale(2, 2);
    const g = ctx.createRadialGradient(s * 0.38, s * 0.34, 1, r, r, r);
    if (dark) { g.addColorStop(0, '#8d939b'); g.addColorStop(0.55, '#3b3f45'); g.addColorStop(1, '#16181b'); }
    else { g.addColorStop(0, '#f6f7f9'); g.addColorStop(0.6, '#a1a7af'); g.addColorStop(1, '#5b6068'); }
    ctx.beginPath(); ctx.arc(r, r, r - 1, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = dark ? '#0b0c0e' : '#4a4f56'; ctx.stroke();
    ctx.beginPath(); ctx.arc(r, r, r - 4, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.stroke();
    ctx.lineCap = 'round'; ctx.lineWidth = 2.6; ctx.strokeStyle = dark ? '#050506' : '#363a40';
    ctx.beginPath(); ctx.moveTo(r - 6.5, r); ctx.lineTo(r + 6.5, r); ctx.moveTo(r, r - 6.5); ctx.lineTo(r, r + 6.5); ctx.stroke();
    return cv;
  }

  /* ---------- Recorte das peças da foto (canvas) ---------- */
  function cutPiece(img, pts, holes = [], patch = null) {
    const b = bboxOf(pts);
    const cv = document.createElement('canvas');
    cv.width = b.w; cv.height = b.h;
    const ctx = cv.getContext('2d');
    ctx.translate(-b.x, -b.y);
    trace(ctx, pts); ctx.clip();
    ctx.drawImage(img, 0, 0);
    ctx.globalCompositeOperation = 'destination-out';
    holes.forEach((h) => { trace(ctx, h); ctx.fill(); });
    if (patch) {                                           // preenche o buraco com o vidro fosco
      ctx.globalCompositeOperation = 'destination-over';
      trace(ctx, pts);
      const g = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
      patch.forEach(([o, c]) => g.addColorStop(o, c));
      ctx.fillStyle = g; ctx.fill();
    }
    cv.style.left = `${b.x}px`;
    cv.style.top = `${b.y}px`;
    return { canvas: cv, box: b };
  }

  function cutBody(img) {
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0);
    ctx.globalCompositeOperation = 'destination-out';
    [GLASS, PLATEAU, ...LENS_CUTS.map((l) => l.pts), ...BUTTONS.map((b) => b.pts), ...PORT_SCREWS.map((s) => s.pts)]
      .forEach((pts) => { trace(ctx, pts); ctx.fill(); });
    // Rebaixos no lugar dos botões e furos dos parafusos
    ctx.globalCompositeOperation = 'source-over';
    BUTTONS.forEach((b) => {
      const c = b.pts;
      trace(ctx, c);
      const g = ctx.createLinearGradient(c[0][0], c[0][1] - 20, c[0][0], c[0][1] + 20);
      g.addColorStop(0, '#2c3036'); g.addColorStop(1, '#6d747d');
      ctx.fillStyle = g; ctx.fill();
    });
    PORT_SCREWS.forEach((s) => { trace(ctx, s.pts); ctx.fillStyle = '#16181b'; ctx.fill(); });
    cv.style.left = '0px';
    cv.style.top = '0px';
    return cv;
  }

  /* ---------- Montagem ---------- */
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  async function build(stage, photoSrc) {
    document.body.insertAdjacentHTML('afterbegin', DEFS);
    const img = await loadImage(photoSrc);
    const pieces = [];

    const wrap = (id, cls, z) => {
      const w = document.createElement('div');
      w.className = `piece piece--${cls}`;
      w.dataset.id = id;
      w.style.zIndex = z;
      return w;
    };

    const shadow = document.createElement('div');
    shadow.className = 'xray__shadow';
    stage.appendChild(shadow);

    // Peças internas (SVG projetado)
    INTERIOR.forEach((cfg) => {
      const w = wrap(cfg.id, 'inner', cfg.z);
      const filter = cfg.depth ? `drop-shadow(0 ${cfg.depth}px 0 ${cfg.edge}) drop-shadow(0 22px 18px rgba(0,0,0,.4))` : '';
      const plane = document.createElement('div');
      plane.className = 'piece__plane';
      plane.style.transform = MATRIX3D;
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', `0 0 ${PW} ${PL}`);
      svg.innerHTML = cfg.svg();
      plane.appendChild(svg);
      w.appendChild(plane);
      const [x, y, rw, rh] = cfg.rect;
      const box = bboxOf([[x, y], [x + rw, y], [x + rw, y + rh], [x, y + rh]].map(([px, py]) => toImg(px, py)), 0);
      const c = centerOf(box);
      w.style.transformOrigin = `${c[0]}px ${c[1]}px`;
      stage.appendChild(w);
      pieces.push({ id: cfg.id, el: w, box, baseZ: cfg.z, filter, m: MOTION[cfg.id] });

      // O corpo (foto sem o vidro) entra logo depois da bandeja interna
      if (cfg.id === 'tray') {
        const body = wrap('body', 'body', 2);
        body.appendChild(cutBody(img));
        stage.appendChild(body);
      }
    });

    // Parafusos dos suportes: saem girando e voam em direções diferentes
    const screwsLayer = document.createElement('div');
    screwsLayer.className = 'screws';
    stage.appendChild(screwsLayer);
    const screws = HOLES.map(([x, y], i) => {
      const [hx, hy] = toImg(x, y);
      const el = screwCanvas(i % 3 === 1);
      el.className = 'screw';
      el.style.left = `${hx - SCREW_SIZE / 2}px`;
      el.style.top = `${hy - SCREW_SIZE / 2}px`;
      screwsLayer.appendChild(el);
      const ang = rnd() * Math.PI * 2, dist = 380 + rnd() * 320;
      return {
        el, hx, hy,
        dx: Math.cos(ang) * dist, dy: Math.sin(ang) * dist * 0.75,
        spin: (rnd() - 0.5) * 1400,
        s: SCREW_TIMING.s + i * SCREW_TIMING.stagger,
      };
    });

    // Peças recortadas da foto (por cima de tudo)
    const photoPieces = [
      { id: 'glass', pts: GLASS, holes: [PLATEAU], edge: '#aab1b9', depth: 6 },
      { id: 'plateau', pts: PLATEAU, holes: LENS_CUTS.map((l) => l.pts), edge: '#99a0a8', depth: 8 },
      ...LENS_CUTS.map((l) => ({ id: l.id, pts: l.pts, edge: '#6d737b', depth: 12 })),
      ...BUTTONS.map((b) => ({ id: b.id, pts: b.pts, edge: '#8b929a', depth: 6 })),
      ...PORT_SCREWS.map((s) => ({ id: s.id, pts: s.pts, edge: '#6d737b', depth: 4 })),
    ];
    photoPieces.forEach((cfg) => {
      const w = wrap(cfg.id, 'photo', 4);
      const { canvas, box } = cutPiece(img, cfg.pts, cfg.holes, cfg.patch);
      const filter = `drop-shadow(0 ${cfg.depth}px 0 ${cfg.edge}) drop-shadow(0 26px 22px rgba(0,0,0,.35))`;
      w.appendChild(canvas);
      const c = centerOf(box);
      w.style.transformOrigin = `${c[0]}px ${c[1]}px`;
      stage.appendChild(w);
      pieces.push({ id: cfg.id, el: w, box, baseZ: 4, filter, m: MOTION[cfg.id] });
    });

    return { pieces, screws, shadow, PHONE_BOX, SCREW_TIMING, SCREW_SIZE };
  }

  window.ClickTeardown = { build };
})();
