/* =========================================================
   Click Celulares — interações e animações
   ========================================================= */
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, min = 0, max = 1) => Math.min(Math.max(v, min), max);
  const easeInOut = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /* ---------- Chegada das letras ----------
     Quebra cada título [data-letters] em palavras e letras,
     preservando elementos internos (ex.: <span class="hl">). */
  function splitLetters(el) {
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    let index = 0;

    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              frag.appendChild(document.createTextNode(' '));
              return;
            }
            const word = document.createElement('span');
            word.className = 'word';
            word.setAttribute('aria-hidden', 'true');
            [...part].forEach((letter) => {
              const char = document.createElement('span');
              char.className = 'char';
              char.textContent = letter;
              char.style.setProperty('--i', index++);
              word.appendChild(char);
            });
            frag.appendChild(word);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          walk(child);
        }
      });
    };

    walk(el);
  }

  document.querySelectorAll('[data-letters]').forEach(splitLetters);

  /* ---------- Disparo das animações ao entrar na tela ----------
     [data-manual] fica de fora: é controlado pela rolagem do topo. */
  const animated = document.querySelectorAll('[data-letters]:not([data-manual]), [data-reveal]');

  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });
    animated.forEach((el) => io.observe(el));
  } else {
    animated.forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- Desmontagem do iPhone (topo) ----------
     A rolagem dentro da seção .xray vira um progresso de 0 a 1.
     O roteiro de cada peça (direção, rotação e tempo) fica em js/teardown.js.
       0.00–0.06  iPhone inteiro + título
       0.06–0.30  01 Abertura (parafusos da porta, botões, lentes, tampa)
       0.30–0.46  02 Parafusos e suportes
       0.46–0.66  03 Diagnóstico (MagSafe, câmeras, placa, bateria...)
       0.66–0.84  04 Tela
       0.84–1.00  visão geral + chamada final */
  const xray = document.querySelector('.xray');
  const stage = document.getElementById('xrayStage');
  const header = document.getElementById('siteHeader');
  let td = null;

  const intro = xray && xray.querySelector('.xray__intro');
  const steps = xray ? [...xray.querySelectorAll('.xray__step')] : [];
  const finalBox = document.getElementById('xrayFinal');
  const progressBar = document.getElementById('xrayProgress');
  const scrollHint = xray && xray.querySelector('.scroll-hint');

  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  function setOn(el, on) {
    if (!el || el.classList.contains('is-on') === on) return;
    el.classList.toggle('is-on', on);
    el.querySelectorAll('[data-letters]').forEach((t) => t.classList.toggle('is-in', on));
  }

  function layoutXray() { /* o enquadramento é recalculado a cada quadro em renderXray */ }

  function renderXray() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const mobile = vw < 700;
    const rect = xray.getBoundingClientRect();
    const p = clamp(-rect.top / (xray.offsetHeight - vh));

    // Enquadramento: soma das áreas ocupadas pelo aparelho e pelas peças na posição atual
    const box = { x0: td.PHONE_BOX.x, y0: td.PHONE_BOX.y, x1: td.PHONE_BOX.x + td.PHONE_BOX.w, y1: td.PHONE_BOX.y + td.PHONE_BOX.h };
    const grow = (x0, y0, x1, y1) => {
      box.x0 = Math.min(box.x0, x0); box.y0 = Math.min(box.y0, y0);
      box.x1 = Math.max(box.x1, x1); box.y1 = Math.max(box.y1, y1);
    };

    // Peças
    td.pieces.forEach((piece) => {
      const m = piece.m;
      if (!m) return;
      const u = easeInOut(clamp((p - m.s) / m.d));
      const lift = (m.lift ?? 90) * Math.sin(Math.PI * u);
      const dx = m.dx * u;
      const dy = m.dy * u - lift;
      piece.el.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) rotate(${(m.r * u).toFixed(2)}deg)`;
      if (piece.baseZ === 1) piece.el.style.zIndex = u > 0.02 ? 3 : 1;   // ao sair, passa por cima do corpo
      const filter = u > 0.001 ? piece.filter : '';                      // espessura só com a peça em movimento
      if (piece.filter && piece.el.style.filter !== filter) piece.el.style.filter = filter;
      if (u > 0) grow(piece.box.x + dx, piece.box.y + dy, piece.box.x + piece.box.w + dx, piece.box.y + piece.box.h + dy);
    });

    // Parafusos: giram no lugar (desparafusando) e depois voam girando
    const T = td.SCREW_TIMING;
    const half = td.SCREW_SIZE / 2;
    td.screws.forEach((screw) => {
      const k = clamp((p - screw.s) / T.d);
      const unscrew = easeOut(clamp(k / 0.3));
      const fly = easeInOut(clamp((k - 0.3) / 0.7));
      const x = screw.dx * fly;
      const y = screw.dy * fly - 40 * unscrew;
      const rot = 540 * unscrew + screw.spin * fly;
      const sc = 1 + 0.25 * unscrew + 0.3 * fly;
      screw.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${rot.toFixed(1)}deg) scale(${sc.toFixed(3)})`;
      if (k > 0) grow(screw.hx - half + x, screw.hy - half + y, screw.hx + half + x, screw.hy + half + y);
    });

    // Câmera: no início o aparelho fica centralizado embaixo do título;
    // durante os passos vai para a direita; no final, centralizado acima do texto
    const AREAS = mobile
      ? { intro: [0.06, 0.94, 0.4, 0.8], steps: [0.04, 0.96, 0.1, 0.7], final: [0.04, 0.96, 0.08, 0.62] }
      : { intro: [0.27, 0.73, 0.5, 0.97], steps: [0.38, 0.9, 0.18, 0.98], final: [0.14, 0.86, 0.08, 0.68] };
    // No final, as peças ocupam só o espaço acima do texto de encerramento
    AREAS.final[3] = Math.max(0.3, (finalBox.offsetTop - 16) / vh);
    const go = easeInOut(clamp((p - 0.02) / 0.08));
    const fin = easeInOut(clamp((p - 0.82) / 0.08));
    const mix = (i) => lerp(lerp(AREAS.intro[i], AREAS.steps[i], go), AREAS.final[i], fin);
    const area = { x0: mix(0), x1: mix(1), y0: mix(2), y1: mix(3) };
    const aw = (area.x1 - area.x0) * vw, ah = (area.y1 - area.y0) * vh;
    const bw = box.x1 - box.x0, bh = box.y1 - box.y0;
    const s = Math.min(aw / bw, ah / bh);
    const cx = (area.x0 * vw + area.x1 * vw) / 2, cy = (area.y0 * vh + area.y1 * vh) / 2;
    stage.style.transform = `translate(${(cx - ((box.x0 + box.x1) / 2) * s).toFixed(1)}px, ${(cy - ((box.y0 + box.y1) / 2) * s).toFixed(1)}px) scale(${s.toFixed(4)})`;

    // Textos
    setOn(intro, p < 0.05);
    steps.forEach((step) => setOn(step, p >= Number(step.dataset.from) && p < Number(step.dataset.to)));
    setOn(finalBox, p >= 0.86);
    if (progressBar) progressBar.style.transform = `scaleY(${p.toFixed(3)})`;
    if (scrollHint) scrollHint.classList.toggle('is-hidden', p > 0.03);
  }

  if (xray && stage && window.ClickTeardown) {
    window.ClickTeardown.build(stage, stage.dataset.photo)
      .then((built) => { td = built; onScroll(); })
      .catch((err) => console.error('Falha ao montar a desmontagem do iPhone:', err));
  }

  /* ---------- Rolagem: topo animado + header ---------- */
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      if (td) renderXray();
      const passed = xray
        ? xray.getBoundingClientRect().bottom <= window.innerHeight * 0.35
        : window.scrollY > 40;
      header.classList.toggle('is-visible', passed);
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => {
    if (td) layoutXray();
    onScroll();
  });
  window.addEventListener('load', onScroll);
  onScroll();

  /* ---------- Menu mobile ---------- */
  const nav = document.getElementById('nav');
  const toggle = document.getElementById('navToggle');

  const setMenu = (open) => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  };
  toggle.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));

  /* ---------- Ano no rodapé ---------- */
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
