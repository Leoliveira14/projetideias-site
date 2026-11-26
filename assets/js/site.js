/* =========================================================
   Projetideias · Interações e movimento
   - Sem dependências. Um único loop requestAnimationFrame
     que só trabalha quando há scroll ou animação a decorrer.
   - IntersectionObserver para entradas, contadores e menu ativo.
   - Respeita prefers-reduced-motion e dispositivos de toque.
   ========================================================= */
(() => {
  'use strict';

  const doc = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const desktop = matchMedia('(min-width: 1024px)');
  const WA = 'https://wa.me/351921208884';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  /* ---------- Analytics (mesmos eventos do site original) ---------- */
  const track = (event, data = {}) => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, ...data });
  };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-track]');
    if (a) track(a.dataset.track, { location: a.dataset.loc || '' });
    const nav = e.target.closest('.nav-links a, .menu nav a');
    if (nav) track('nav_click', { link: nav.getAttribute('href'), location: 'header' });
  });

  /* ---------- Divisão de títulos em palavras (para o reveal) ---------- */
  const splitWords = (el) => {
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.nodeValue.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const w = document.createElement('span');
            w.className = 'word';
            const inner = document.createElement('span');
            inner.style.setProperty('--i', i++);
            inner.textContent = part;
            w.appendChild(inner);
            frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
  };
  if (!reduce) $$('[data-split]').forEach(splitWords);

  /* ---------- Entradas com IntersectionObserver ---------- */
  $$('[data-stagger]').forEach((g) => {
    [...g.children].forEach((c, i) => { if (!c.style.getPropertyValue('--d')) c.style.setProperty('--d', `${i * 0.07}s`); });
  });
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      revealIO.unobserve(e.target);
    });
  }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });

  const hero = $('#inicio');
  const startReveals = () => {
    $$('[data-reveal], [data-split]').forEach((el) => {
      if (hero.contains(el)) el.classList.add('is-in');
      else revealIO.observe(el);
    });
  };

  /* ---------- Entrada da página (só 1x por sessão) ---------- */
  const intro = $('.intro');
  let seen = false;
  try { seen = sessionStorage.getItem('pi-intro') === '1'; } catch (e) {}
  if (intro && !reduce && !seen) {
    intro.classList.add('is-on');
    const leave = () => {
      intro.classList.add('is-out');
      setTimeout(startReveals, 250);
      setTimeout(() => intro.remove(), 1000);
      try { sessionStorage.setItem('pi-intro', '1'); } catch (e) {}
    };
    const minTime = new Promise((r) => setTimeout(r, 1100));
    const loaded = new Promise((r) => (document.readyState === 'complete' ? r() : addEventListener('load', r, { once: true })));
    Promise.race([Promise.all([minTime, loaded]), new Promise((r) => setTimeout(r, 2400))]).then(leave);
  } else {
    intro && intro.remove();
    startReveals();
  }

  /* ---------- Navegação ---------- */
  const nav = $('[data-nav]');
  const burger = $('.nav-burger');
  const menu = $('#menu');
  const setMenu = (open) => {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    document.body.classList.toggle('menu-open', open);
    if (open) { menu.hidden = false; requestAnimationFrame(() => menu.classList.add('is-open')); }
    else { menu.classList.remove('is-open'); setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, 700); }
  };
  burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('menu-open')) { setMenu(false); burger.focus(); } });

  // Link ativo conforme a secção visível
  const links = $$('.nav-links a');
  const activeIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((l) => l.classList.toggle('is-active', l.getAttribute('href') === `#${e.target.id}`));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  links.forEach((l) => { const s = $(l.getAttribute('href')); if (s) activeIO.observe(s); });

  /* ---------- Galeria do processo: scroll horizontal fixo (desktop) ---------- */
  const gal = $('[data-gallery]');
  const galTrack = gal && $('[data-gallery-track]', gal);
  const galBar = gal && $('[data-gallery-bar]', gal);
  const galLabels = gal ? $$('[data-gallery-labels] li', gal) : [];
  let gDist = 0;
  const setupG = () => {
    if (!gal) return;
    const on = desktop.matches && !reduce;
    gal.classList.toggle('is-h', on);
    if (!on) { galTrack.style.transform = ''; gal.style.removeProperty('--h-scroll'); return; }
    gDist = Math.max(0, galTrack.scrollWidth - innerWidth);
    gal.style.setProperty('--h-scroll', `${gDist + innerHeight}px`);
  };

  /* ---------- Túnel do hero ---------- */
  const tunnel = $('[data-tunnel]');
  const mobile = matchMedia('(max-width: 719px)');
  const tiles = tunnel ? $$('.tile', tunnel).map((el) => {
    const [mx_, my_] = (el.dataset.m || '').split(',').map(parseFloat);
    return { el, dx: parseFloat(el.style.getPropertyValue('--x')), dy: parseFloat(el.style.getPropertyValue('--y')), mx: mx_, my: my_, z: parseFloat(el.style.getPropertyValue('--z')) };
  }) : [];
  const tCopy = $('[data-tunnel-copy]');
  const tWord = $('[data-tunnel-word]');
  const tCue = $('.tunnel-cue');
  let mx = 0, my = 0, tmx = 0, tmy = 0, mouseRaf = 0;
  if (tunnel && fine && !reduce) {
    tunnel.addEventListener('pointermove', (e) => {
      tmx = (e.clientX / innerWidth - 0.5) * 2;
      tmy = (e.clientY / innerHeight - 0.5) * 2;
      if (!mouseRaf) {
        const ease = () => {
          mx += (tmx - mx) * 0.08; my += (tmy - my) * 0.08;
          request();
          mouseRaf = Math.abs(tmx - mx) + Math.abs(tmy - my) > 0.002 ? requestAnimationFrame(ease) : 0;
        };
        mouseRaf = requestAnimationFrame(ease);
      }
    });
  }
  const drawTunnel = (vh) => {
    if (!tunnel || reduce) return;
    const r = tunnel.getBoundingClientRect();
    if (r.bottom < 0) return;
    const p = clamp(-r.top / (tunnel.offsetHeight - vh));
    const m = mobile.matches;
    for (const t of tiles) {
      t.x = m && !isNaN(t.mx) ? t.mx : t.dx;
      t.y = m && !isNaN(t.my) ? t.my : t.dy;
      const spread = 1 + p * 1.8 * t.z;
      const s = t.z * (1 + p * p * 5 * t.z);
      const x = t.x * spread - mx * 2.2 * t.z;
      const y = t.y * spread - my * 2.2 * t.z;
      t.el.style.transform = `translate(-50%,-50%) translate3d(${x.toFixed(2)}vw,${y.toFixed(2)}vh,0) scale(${s.toFixed(3)})`;
      t.el.style.opacity = clamp(1.4 - p * 1.3 * (0.4 + t.z)).toFixed(3);
    }
    if (tCopy) { tCopy.style.opacity = clamp(1 - p * 1.9).toFixed(3); tCopy.style.transform = `translateY(${(-p * 90).toFixed(1)}px) scale(${(1 - p * 0.06).toFixed(4)})`; }
    if (tWord) { const q = clamp((p - 0.25) / 0.6); tWord.style.transform = `translateX(-50%) translateY(${(-q * 0.55 * vh).toFixed(1)}px) scale(${(1 + q * 0.04).toFixed(4)})`; tWord.style.color = `rgb(244 239 230 / ${(0.07 + q * 0.88).toFixed(3)})`; }
    if (tCue) tCue.style.opacity = clamp(1 - p * 5).toFixed(3);
  };

  /* ---------- Projetos: filtros e linhas expansíveis ---------- */
  const works = $$('.work');
  works.forEach((w) => {
    const btn = $('.work-row', w);
    btn.addEventListener('click', () => {
      const open = !w.classList.contains('is-open');
      works.forEach((o) => { o.classList.remove('is-open'); $('.work-row', o).setAttribute('aria-expanded', 'false'); });
      w.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
  });
  $$('[data-filter]').forEach((f) => f.addEventListener('click', () => {
    const cat = f.dataset.filter;
    $$('[data-filter]').forEach((b) => b.classList.toggle('is-on', b === f));
    works.forEach((w) => w.classList.toggle('is-hidden', cat !== 'all' && !w.dataset.cat.split(' ').includes(cat)));
  }));

  /* ---------- Rodapé: nome monumental a subir ---------- */
  const fWord = $('[data-footer-word]');

  /* ---------- Loop de scroll (progresso, nav, parallax, projetos, pilha) ---------- */
  const bar = $('.progress i');
  const parallax = reduce ? [] : $$('[data-speed]');
  let lastY = scrollY, ticking = false;

  const onFrame = () => {
    ticking = false;
    const y = scrollY, vh = innerHeight;
    const max = doc.scrollHeight - vh;
    bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;

    // Navegação: sólida depois do topo; esconde ao descer, volta ao subir
    nav.classList.toggle('is-solid', y > 40);
    if (!document.body.classList.contains('menu-open')) {
      if (y > lastY + 6 && y > 500) nav.classList.add('is-hidden');
      else if (y < lastY - 6 || y < 500) nav.classList.remove('is-hidden');
    }
    lastY = y;

    // Parallax subtil (propriedade translate, não interfere com outras transformações)
    for (const el of parallax) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) continue;
      const mid = (r.top + r.height / 2 - vh / 2) / vh;
      el.style.translate = `0 ${(mid * parseFloat(el.dataset.speed) * vh).toFixed(1)}px`;
    }

    drawTunnel(vh);

    // Galeria do processo na horizontal
    if (gal && gal.classList.contains('is-h')) {
      const r = gal.getBoundingClientRect();
      const p = clamp(-r.top / (gal.offsetHeight - vh));
      galTrack.style.transform = `translate3d(${(-p * gDist).toFixed(1)}px,0,0)`;
      galBar.style.transform = `scaleX(${p.toFixed(4)})`;
      const idx = Math.min(galLabels.length - 1, Math.floor(p * galLabels.length * 0.999));
      galLabels.forEach((l, i) => l.classList.toggle('is-active', i <= idx));
    }

    // Nome do rodapé
    if (fWord && !reduce) {
      const r = fWord.getBoundingClientRect();
      const p = clamp((vh - r.top) / (r.height + vh * 0.35));
      fWord.style.transform = `translateY(${((1 - p) * 35).toFixed(2)}%)`;
    }
  };
  const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(onFrame); } };
  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', () => { setupG(); request(); }, { passive: true });
  desktop.addEventListener('change', () => { setupG(); request(); });
  addEventListener('load', () => { setupG(); request(); });
  setupG();
  request();

  /* ---------- Holofote e botões magnéticos ---------- */
  if (fine && !reduce) {
    $$('[data-spot]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - r.left}px`);
        el.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    });
    $$('[data-magnetic]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - r.left - r.width / 2) * 0.22, dy = (e.clientY - r.top - r.height / 2) * 0.3;
        el.style.translate = `${clamp(dx, -8, 8).toFixed(1)}px ${clamp(dy, -6, 6).toFixed(1)}px`;
      });
      el.addEventListener('pointerleave', () => { el.style.translate = '0 0'; });
    });
  }

  /* ---------- FAQ ---------- */
  $$('[data-acc] .acc-item').forEach((item) => {
    const btn = $('button', item);
    const panel = $('.acc-panel', item);
    const id = `acc-${Math.random().toString(36).slice(2, 8)}`;
    panel.id = id;
    btn.setAttribute('aria-controls', id);
    btn.addEventListener('click', () => {
      const open = !item.classList.contains('is-open');
      item.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
  });

  /* ---------- Formulário: valida e abre o WhatsApp com a mensagem ---------- */
  const form = $('[data-form]');
  if (form) {
    const err = $('[data-form-error]', form);
    const required = ['nome', 'negocio', 'interesse'];
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let first = null;
      required.forEach((n) => {
        const f = form.elements[n];
        const bad = !f.value.trim();
        f.setAttribute('aria-invalid', String(bad));
        if (bad && !first) first = f;
      });
      err.hidden = !first;
      if (first) { first.focus(); return; }
      const v = (n) => form.elements[n].value.trim();
      let msg = `Olá! Vi o site da Projetideias e gostava de uma proposta.\n\nNome: ${v('nome')}\nNegócio: ${v('negocio')}\nProcuro: ${v('interesse')}`;
      if (v('mensagem')) msg += `\n\n${v('mensagem')}`;
      track('whatsapp_click', { location: 'form' });
      window.open(`${WA}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
    });
    form.addEventListener('input', (e) => { if (e.target.value && e.target.value.trim()) e.target.setAttribute('aria-invalid', 'false'); });
    // Botões que pré-selecionam o interesse (ex.: "Quero um agente")
    $$('[data-preset]').forEach((a) => a.addEventListener('click', () => {
      const sel = form.elements.interesse;
      const opt = [...sel.options].find((o) => o.text.startsWith(a.dataset.preset));
      if (opt) sel.value = opt.value || opt.text;
    }));
  }

  /* ---------- Ano no rodapé ---------- */
  const year = $('[data-year]');
  if (year) year.textContent = new Date().getFullYear();
})();
