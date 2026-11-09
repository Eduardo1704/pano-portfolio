/* Eduardo Pano — portfolio v02. GSAP 3.15 (ScrollTrigger, SplitText, Flip, ScrambleText) + Lenis 1.3. */
(() => {
  const doc = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGsap = !!window.gsap;
  const motion = hasGsap && !reduce;
  if (motion) doc.classList.add('motion');
  if (hasGsap) gsap.registerPlugin(...[window.ScrollTrigger, window.SplitText, window.Flip, window.ScrambleTextPlugin].filter(Boolean));

  const P = window.PHOTOS || [];
  const byId = Object.fromEntries(P.map(p => [p.id, p]));
  const CH = { producto: 'Producto', retrato: 'Retrato', ciudad: 'Ciudad', agua: 'Agua', horizonte: 'Horizonte', mesa: 'Mesa', naturaleza: 'Naturaleza', interiores: 'Interiores' };
  P.forEach(p => { p.top = (p.fav ? 1000 : 0) + p.score; }); // favorites first, then Lightroom's own score
  const METRIC = { top: 'Favoritas', score: 'Selección', light: 'Luz', color: 'Color', depth: 'Profundidad', sym: 'Simetría' };

  // Lightroom's raw aesthetic values use different scales (some negative): show each as a 0–100 rank inside this set.
  const rank = {};
  for (const k of Object.keys(METRIC)) {
    [...P].sort((a, b) => a[k] - b[k]).forEach((p, i) => { (rank[p.id] ||= {})[k] = Math.round(i / Math.max(1, P.length - 1) * 100); });
  }

  /* ---------- smooth scroll + anchors ---------- */
  let lenis = null;
  if (motion && window.Lenis) {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    const el = id === '#top' ? null : document.querySelector(id);
    if (id !== '#top' && !el) return;
    e.preventDefault();
    if (a.dataset.filter) setChapter(a.dataset.filter);
    if (lenis) lenis.scrollTo(el || 0, { duration: 1.5 });
    else el ? el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }) : scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  });

  /* ---------- index: chapter filter + Lightroom sort (the live thing) ---------- */
  const sheet = document.getElementById('sheet');
  sheet.textContent = '';
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cells = P.map(p => {
    const f = document.createElement('figure');
    const r = p.w / p.h;
    f.className = 'cell';
    f.dataset.id = p.id;
    f.dataset.ch = p.ch;
    f.style.setProperty('--r', r.toFixed(3));
    f.innerHTML = `<button type="button" aria-label="Ampliar: ${esc(p.alt)}"><img src="img/${p.id}-s.webp" width="${Math.round(r >= 1 ? 900 : 900 * r)}" height="${Math.round(r >= 1 ? 900 / r : 900)}" alt="${esc(p.alt)}" loading="lazy" data-view="${p.id}"></button><figcaption><span>${CH[p.ch]}</span><b></b></figcaption>`;
    sheet.append(f);
    return f;
  });
  let sortKey = 'top', chapter = 'all', cellIn = [];
  function apply(animate) {
    if (animate && cellIn.length) { // the scroll entrance would fight Flip and strand cells at opacity 0
      cellIn.forEach(s => s.kill()); cellIn = [];
      gsap.killTweensOf(cells); gsap.set(cells, { opacity: 1, y: 0 });
    }
    const state = animate && motion && window.Flip ? Flip.getState(cells) : null;
    [...cells].sort((a, b) => byId[b.dataset.id][sortKey] - byId[a.dataset.id][sortKey]).forEach(c => {
      sheet.append(c);
      c.hidden = !(chapter === 'all' || c.dataset.ch === chapter);
      const label = sortKey !== 'top' ? `${METRIC[sortKey]} ${rank[c.dataset.id][sortKey]}` : byId[c.dataset.id].fav ? 'Favorita' : `Selección ${rank[c.dataset.id].score}`;
      const b = c.querySelector('b');
      if (state && !c.hidden && window.ScrambleTextPlugin) gsap.to(b, { duration: 0.7, scrambleText: { text: label, chars: '0123456789', speed: 0.8 } });
      else b.textContent = label;
    });
    if (state) {
      Flip.from(state, {
        duration: 0.8, ease: 'power3.inOut', stagger: 0.01, absolute: true, scale: true,
        onEnter: els => gsap.fromTo(els, { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 0.5, delay: 0.25 }),
        onLeave: els => gsap.to(els, { opacity: 0, scale: 0.92, duration: 0.35 }),
        onComplete: () => ScrollTrigger.refresh()
      });
    } else if (window.ScrollTrigger) ScrollTrigger.refresh();
  }
  function setChapter(ch) {
    chapter = ch;
    document.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.ch === ch)));
    apply(true);
  }
  document.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => setChapter(b.dataset.ch)));
  document.querySelectorAll('.sort').forEach(b => b.addEventListener('click', () => {
    sortKey = b.dataset.sort;
    document.querySelectorAll('.sort').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    apply(true);
  }));
  apply(false);

  /* ---------- lightbox ---------- */
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lb-img');
  const lbCap = document.getElementById('lb-cap');
  let list = [], idx = 0, lastFocus = null;
  function show() {
    const p = byId[list[idx]];
    lbImg.src = `img/${p.id}.webp`;
    lbImg.alt = p.alt;
    lbImg.width = p.w; lbImg.height = p.h;
    lbCap.textContent = `${p.alt} · ${CH[p.ch]} · ${p.date.slice(0, 4)} · ${idx + 1} de ${list.length}`;
    if (motion) gsap.fromTo(lbImg, { opacity: 0, scale: 0.97 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'power3.out' });
  }
  function open(id, fromIndex) {
    list = fromIndex ? [...sheet.children].filter(c => c.classList.contains('cell') && !c.hidden).map(c => c.dataset.id) : P.map(p => p.id);
    idx = Math.max(0, list.indexOf(id));
    lastFocus = document.activeElement;
    lb.hidden = false;
    lenis?.stop();
    document.body.style.overflow = 'hidden';
    show();
    if (motion) gsap.fromTo(lb, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    lb.querySelector('.lb-close').focus();
  }
  function close() {
    lb.hidden = true;
    lenis?.start();
    document.body.style.overflow = '';
    lastFocus?.focus();
  }
  const step = d => { idx = (idx + d + list.length) % list.length; show(); };
  lb.querySelector('.lb-prev').addEventListener('click', () => step(-1));
  lb.querySelector('.lb-next').addEventListener('click', () => step(1));
  lb.querySelector('.lb-close').addEventListener('click', close);
  lb.addEventListener('click', e => { if (e.target === lb) close(); });
  document.addEventListener('keydown', e => {
    if (lb.hidden) {
      const t = e.target.closest?.('img[data-view]');
      if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(t.dataset.view, false); }
      return;
    }
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'Tab') { // keep focus inside the dialog
      const f = [...lb.querySelectorAll('button')];
      e.preventDefault();
      f[(f.indexOf(document.activeElement) + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  });
  document.addEventListener('click', e => {
    const btn = e.target.closest('.cell button');
    if (btn) return open(btn.querySelector('img').dataset.view, true);
    const img = e.target.closest('img[data-view]');
    if (img) open(img.dataset.view, false);
  });
  document.querySelectorAll('main img[data-view]').forEach(img => {
    if (img.closest('button')) return;
    img.tabIndex = 0;
    img.setAttribute('role', 'button');
    img.setAttribute('aria-label', 'Ampliar: ' + img.alt);
  });

  // reel: muted loops play only while on screen; with reduced motion they wait for the viewer's own play
  document.querySelectorAll('.clip video').forEach(v => {
    if (!motion) { v.controls = true; return; }
    new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); }, { rootMargin: '200px 0px' }).observe(v);
  });

  if (!motion) return;

  /* ---------- cursor: a viewfinder. Corners frame links and buttons, open wide over photos ---------- */
  if (fine) {
    const c = document.querySelector('.cursor');
    const dot = document.querySelector('.cursor-dot');
    const q = (el, prop, d) => gsap.quickTo(el, prop, { duration: d, ease: 'power3' });
    const lab = document.querySelector('.cursor-label'); // outside the blend: lime chip, only over photos
    gsap.set(lab, { xPercent: -50 });
    const dx = q(dot, 'x', 0.1), dy = q(dot, 'y', 0.1), lx = q(lab, 'x', 0.35), ly = q(lab, 'y', 0.35);
    const bx = q(c, 'x', 0.35), by = q(c, 'y', 0.35), bw = q(c, 'width', 0.35), bh = q(c, 'height', 0.35);
    let target = null, size = 26, px = 0, py = 0, shown = false, view = false, tick = 0;
    const place = () => {
      if (target?.isConnected) {
        const r = target.getBoundingClientRect();
        bx(r.left - 6); by(r.top - 6); bw(r.width + 12); bh(r.height + 12);
      } else { bx(px - size / 2); by(py - size / 2); bw(size); bh(size); }
    };
    const aim = el => {
      target = el?.closest('a, button, .chip') || null;
      const v = !target && !!el?.closest('[data-view]');
      size = v ? 76 : 26;
      // 'auto' only replaces the opacity/scale tween; overwrite: true also killed the x/y followers and froze the label
      if (v !== view) { view = v; gsap.to(lab, { opacity: v ? 1 : 0, scale: v ? 1 : 0.6, duration: 0.25, overwrite: 'auto' }); }
      place();
    };
    addEventListener('pointermove', e => {
      px = e.clientX; py = e.clientY; dx(px); dy(py); lx(px); ly(py + 10); aim(e.target);
      if (!shown) { shown = true; doc.classList.add('has-cursor'); gsap.to([c, dot], { opacity: 1, duration: 0.3 }); }
    });
    document.addEventListener('pointerout', e => {
      if (e.relatedTarget) return;
      shown = false; view = false; doc.classList.remove('has-cursor'); gsap.to([c, dot, lab], { opacity: 0, duration: 0.3, overwrite: 'auto' });
    });
    // photos move under a still pointer (rolling strips, scroll, pins): re-check what is under it a few times a second
    gsap.ticker.add(() => { if (shown && ++tick % 6 === 0) aim(document.elementFromPoint(px, py)); });
    document.querySelectorAll('.scr').forEach(a => {
      const text = a.textContent;
      a.addEventListener('pointerenter', () => gsap.to(a, { duration: 0.6, scrambleText: { text, chars: 'upperCase', speed: 0.7 } }));
    });
  }

  /* ---------- nav: hides going down, returns going up; inverts over the light contact field ---------- */
  const nav = document.querySelector('.nav');
  let navHidden = false;
  lenis?.on('scroll', ({ scroll, direction }) => {
    const hide = direction === 1 && scroll > innerHeight * 1.2;
    if (hide !== navHidden) { navHidden = hide; gsap.to(nav, { yPercent: hide ? -100 : 0, duration: 0.45, ease: 'power3.out' }); }
  });
  ScrollTrigger.create({ trigger: '.contact', start: 'top 40px', end: 'bottom 40px', toggleClass: { targets: nav, className: 'on-light' } });

  /* ---------- marquee: speed and direction follow the scroll ---------- */
  document.querySelectorAll('.mq-row').forEach(row => {
    const track = row.querySelector('.mq-track');
    const clone = track.cloneNode(true);
    [...clone.children].forEach(n => { n.setAttribute('aria-hidden', 'true'); track.append(n); }); // two copies in one track
    const dir = Number(row.dataset.dir);
    let x = 0, half = track.scrollWidth / 2;
    addEventListener('resize', () => { half = track.scrollWidth / 2; });
    gsap.ticker.add((t, dt) => {
      const v = lenis ? lenis.velocity : 0;
      const sign = (lenis && lenis.direction === -1) ? -1 : 1;
      x = (((x + dir * sign * (0.06 + Math.min(Math.abs(v), 80) * 0.02) * dt) % half) + half) % half;
      track.style.transform = `translate3d(${-x}px,0,0)`;
    });
  });

  /* ---------- nature: strips roll in opposite directions; scroll speed adds pace and bends them ---------- */
  const natCols = [...document.querySelectorAll('.nat-col')];
  let natLive = false, bend = 0;
  ScrollTrigger.create({
    trigger: '.nature', start: 'top bottom', end: 'bottom top',
    onToggle: st => { natLive = st.isActive; if (natLive) document.querySelectorAll('.nat-track img').forEach(i => { i.loading = 'eager'; }); }
  });
  const strips = natCols.map(col => {
    const track = col.querySelector('.nat-track');
    [...track.children].forEach(n => {
      const c = n.cloneNode(true); // second copy so the loop wraps without a jump; hidden from tab order and screen readers
      c.setAttribute('aria-hidden', 'true'); c.tabIndex = -1; c.removeAttribute('role'); c.removeAttribute('aria-label');
      track.append(c);
    });
    return { col, track, dir: Number(col.dataset.dir), y: 0 };
  });
  gsap.ticker.add((t, dt) => {
    if (!natLive) return;
    const v = lenis ? lenis.velocity : 0;
    bend += (gsap.utils.clamp(-7, 7, v * 0.18) - bend) * 0.08;
    for (const s of strips) {
      const half = s.track.scrollHeight / 2;
      if (!half) continue;
      s.y = (((s.y + s.dir * (0.035 + Math.min(Math.abs(v), 80) * 0.012) * dt) % half) + half) % half;
      s.track.style.transform = `translate3d(0,${-s.y}px,0) skewY(${s.dir * bend}deg) scaleY(${1 + Math.abs(bend) * 0.012})`;
    }
  });

  /* ---------- image trail ---------- */
  if (fine) {
    const sec = document.querySelector('.trail');
    const field = sec.querySelector('.trail-field');
    const srcs = [...P].sort((a, b) => b.top - a.top).map(p => `img/${p.id}-s.webp`);
    let k = 0, last = null;
    sec.addEventListener('pointermove', e => {
      const r = sec.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (last && Math.hypot(x - last.x, y - last.y) < 90) return;
      last = { x, y };
      const im = new Image();
      im.src = srcs[k++ % srcs.length];
      im.alt = '';
      field.append(im);
      gsap.set(im, { x, y, xPercent: -50, yPercent: -50 });
      gsap.timeline({ onComplete: () => im.remove() })
        .fromTo(im, { scale: 0.4, opacity: 0, rotate: gsap.utils.random(-8, 8) }, { scale: 1, opacity: 1, duration: 0.4, ease: 'power3.out' })
        .to(im, { scale: 0.6, opacity: 0, y: '+=40', duration: 0.6, ease: 'power2.in' }, '+=0.35');
    });
  }

  /* ---------- process: photo follows the cursor over the rows ---------- */
  if (fine) {
    const rv = document.querySelector('.reveal-img');
    const ri = rv.querySelector('img');
    gsap.set(rv, { xPercent: 10, yPercent: -50 });
    const xTo = gsap.quickTo(rv, 'x', { duration: 0.55, ease: 'power3' });
    const yTo = gsap.quickTo(rv, 'y', { duration: 0.55, ease: 'power3' });
    document.querySelector('.rows').addEventListener('pointermove', e => { xTo(e.clientX); yTo(e.clientY); });
    document.querySelectorAll('.prow').forEach(r => {
      r.addEventListener('pointerenter', () => { ri.src = r.dataset.img; gsap.to(rv, { opacity: 1, scale: 1, duration: 0.35, overwrite: 'auto' }); });
      r.addEventListener('pointerleave', () => gsap.to(rv, { opacity: 0, scale: 0.9, duration: 0.3, overwrite: 'auto' }));
    });
  }

  function init() {
    /* ---------- hero ---------- */
    const hero = document.querySelector('.hero');
    const counter = hero.querySelector('.o-counter');
    const zoom = hero.querySelector('.zoom');
    const stage = zoom.querySelector('.zoom-stage');
    const rect = () => { // layout offsets, immune to transforms
      let x = 0, y = 0, el = counter;
      while (el && el !== hero) {
        x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent;
        if (el && el !== hero) { x += el.clientLeft; y += el.clientTop; } // offsets start inside the parent's border (the O ring)
      }
      return { top: y, left: x, width: counter.offsetWidth, height: counter.offsetHeight };
    };
    const startScale = () => Math.max(rect().width / hero.clientWidth, rect().height / hero.clientHeight) * 1.6;


    gsap.set([hero.querySelector('.monument'), zoom, hero.querySelector('.hero-top')], { visibility: 'visible' });
    const line = hero.querySelector('.hero-line');
    // played after the intro lands the apple in the O (or right away if the intro can't run)
    const reveal = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } })
      .from('.monument .ch', { yPercent: 110, duration: 1.2, stagger: 0.04 })
      .from(line, { duration: 1.2, scrambleText: { text: '', chars: 'lowerCase', speed: 0.5 } }, 0.15)
      .from('.hero-top .btn, .nav > *', { y: 16, opacity: 0, duration: 0.8, stagger: 0.07 }, 0.3);

    gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: '+=150%', pin: true, scrub: 0.6, invalidateOnRefresh: true } })
      .fromTo(zoom,
        { top: () => rect().top, left: () => rect().left, width: () => rect().width, height: () => rect().height, borderRadius: '50%' },
        { top: 0, left: 0, width: () => hero.clientWidth, height: () => hero.clientHeight, borderRadius: '0%', ease: 'power2.inOut', duration: 1 }, 0)
      .fromTo(stage, { scale: startScale }, { scale: 1, ease: 'power2.inOut', duration: 1 }, 0)
      .to('.monument', { scale: 1.2, opacity: 0, transformOrigin: '80% 80%', ease: 'power1.in', duration: 0.5 }, 0)
      .to('.hero-top', { opacity: 0, y: -24, duration: 0.25 }, 0)
      .to('.zoom-caption', { opacity: 1, duration: 0.15 }, 0.85);

    /* ---------- headings ---------- */
    // titles: on hover the letters roll out the top of their masks and back in from below
    const roll = chars => { if (!chars.some(c => gsap.isTweening(c))) gsap.timeline()
      .to(chars, { yPercent: -110, duration: 0.28, ease: 'power2.in', stagger: 0.018 })
      .set(chars, { yPercent: 110 })
      .to(chars, { yPercent: 0, duration: 0.5, ease: 'expo.out', stagger: 0.018 }); };
    document.querySelectorAll('.split').forEach(h => {
      const s = SplitText.create(h, { type: 'words,chars', mask: 'chars' }) /* words: no mid-word line breaks */;
      gsap.from(s.chars, { yPercent: 110, duration: 1, ease: 'expo.out', stagger: 0.025, scrollTrigger: { trigger: h, start: 'top 88%', once: true } });
      h.addEventListener('pointerenter', () => roll(s.chars));
    });
    gsap.utils.toArray('.h-panel h3, .prow h3').forEach(h => {
      const s = SplitText.create(h, { type: 'words,chars', mask: 'chars' });
      (h.closest('.prow') || h).addEventListener('pointerenter', () => roll(s.chars));
    });

    // the name: letters near the pointer get pressed thin and narrow (Archivo's wdth 62–125 and wght 400–800 axes)
    const fnEl = document.querySelector('.footer-name');
    const fn = SplitText.create(fnEl, { type: 'chars', mask: 'chars' });
    gsap.from(fn.chars, { yPercent: 100, duration: 1.1, ease: 'expo.out', stagger: 0.03, scrollTrigger: { trigger: fnEl, start: 'top 95%', once: true } });
    const foot = document.querySelector('.footer');
    const press = fn.chars.map(() => 0);
    let mx = -1e5, my = -1e5, footLive = false;
    ScrollTrigger.create({ trigger: foot, start: 'top bottom', end: 'bottom top', onToggle: st => { footLive = st.isActive; } });
    const aim = e => { mx = e.clientX; my = e.clientY; };
    foot.addEventListener('pointermove', aim);
    foot.addEventListener('pointerdown', aim); // touch: a tap presses the letters, then they spring back
    foot.addEventListener('pointerleave', () => { mx = my = -1e5; });
    foot.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') mx = my = -1e5; });
    gsap.ticker.add(() => {
      if (!footLive) return;
      const reach = Math.max(160, fnEl.offsetHeight * 1.6);
      fn.chars.forEach((ch, i) => {
        const r = ch.getBoundingClientRect();
        const goal = Math.max(0, 1 - Math.hypot(mx - (r.left + r.width / 2), my - (r.top + r.height / 2)) / reach);
        const p = press[i] += (goal - press[i]) * 0.14;
        ch.style.fontVariationSettings = p < 0.002 ? '' : `'wdth' ${(125 - 63 * p).toFixed(1)}, 'wght' ${Math.round(800 - 400 * p)}`;
      });
    });
    const em = SplitText.create('.email', { type: 'chars' }); // no mask: it would clip the g's descender
    gsap.from(em.chars, { yPercent: 40, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.02, scrollTrigger: { trigger: '.email', start: 'top 90%', once: true } });

    /* ---------- entrances ---------- */
    gsap.from('.mq-row', { xPercent: (i) => (i ? 8 : -8), opacity: 0, duration: 1.2, ease: 'expo.out', stagger: 0.1, scrollTrigger: { trigger: '.marquee', start: 'top 85%', once: true } });
    gsap.from('.statement, .trail-note', { y: 32, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.08, scrollTrigger: { trigger: '.trail', start: 'top 60%', once: true } });
    gsap.from('.index-note, .controls > *', { y: 16, opacity: 0, duration: 0.7, stagger: 0.06, ease: 'power3.out', scrollTrigger: { trigger: '.index', start: 'top 70%', once: true } });
    cellIn = ScrollTrigger.batch('.cell', {
      start: 'top 92%', once: true,
      onEnter: b => gsap.fromTo(b, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out', stagger: 0.04, clearProps: 'transform' })
    });
    gsap.utils.toArray('.prow').forEach(r => gsap.from(r.children, { y: 24, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.08, scrollTrigger: { trigger: r, start: 'top 88%', once: true } }));
    gsap.from('.reel-note, .clip', { y: 40, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08, scrollTrigger: { trigger: '.reel', start: 'top 70%', once: true } });
    gsap.from('.contact-lead, .contact-foot > *', { y: 20, opacity: 0, duration: 0.8, stagger: 0.08, scrollTrigger: { trigger: '.contact', start: 'top 70%', once: true } });

    /* ---------- chapters: pinned horizontal run on wide screens, swipe on phones ---------- */
    gsap.matchMedia().add('(min-width: 761px)', () => {
      const track = document.querySelector('.h-track');
      const dist = () => track.scrollWidth - innerWidth;
      const run = gsap.to(track, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: { trigger: '.chapters', start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 0.8, invalidateOnRefresh: true }
      });
      gsap.utils.toArray('.hp-main img').forEach(img => gsap.fromTo(img, { xPercent: -7, scale: 1.18 }, {
        xPercent: 7, ease: 'none', scrollTrigger: { trigger: img.parentNode, containerAnimation: run, start: 'left right', end: 'right left', scrub: true }
      }));
      gsap.utils.toArray('.hp-text').forEach(t => gsap.from(t.children, {
        x: 60, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08, scrollTrigger: { trigger: t, containerAnimation: run, start: 'left 85%', once: true }
      }));
    });

    ScrollTrigger.sort(); // triggers below the pins were created first: refresh them in page order so they count the pin space
    ScrollTrigger.refresh();
    intro(zoom).then(() => reveal.play());
  }

  /* ---------- intro: archive cylinder → apple flies into the O ---------- */
  const INTRO = ['producto-007', 'interiores-2051', 'ciudad-028', 'retrato-2037', 'agua-128', 'interiores-2006', 'ciudad-2044', 'naturaleza-2021', 'interiores-2052', 'ciudad-2027', 'retrato-2036', 'mesa-2069', 'interiores-2016', 'ciudad-2048', 'horizonte-2064', 'interiores-2030', 'ciudad-092', 'naturaleza-2028', 'producto-825', 'interiores-2015', 'ciudad-2013', 'naturaleza-225', 'ciudad-2046', 'horizonte-013'];
  function intro(zoom) {
    const el = document.querySelector('.intro');
    if (!el) return Promise.resolve();
    let tl = null, over = false;
    const done = () => { if (over) return; over = true; removeEventListener('scroll', bail); el.remove(); gsap.set(zoom, { opacity: 1 }); lenis?.start(); };
    // anyone who scrolls during the intro wants the page: end it at once
    const bail = () => { if (scrollY > 2 && !over) { if (tl) tl.progress(1); done(); } };
    addEventListener('scroll', bail, { passive: true });
    const ring = el.querySelector('.intro-ring'), view = el.querySelector('.intro-view');
    const N = INTRO.length, step = 360 / N;
    const cw = Math.min(380, Math.max(150, innerWidth * 0.22));
    const R = (N * cw * 1.18) / (2 * Math.PI);
    gsap.set(view, { perspective: R * 0.45 }); // wide lens: the wall bends hard at the edges
    const cards = INTRO.map((id, i) => {
      const c = document.createElement('figure');
      c.className = 'intro-card';
      c.innerHTML = `<img src="img/${id}-s.webp" alt="">`;
      Object.assign(c.style, { width: cw + 'px', height: cw * 1.25 + 'px', left: -cw / 2 + 'px', top: -cw * 0.625 + 'px',
        transform: `rotateY(${i * step}deg) translateZ(${-R}px)` }); // rotate first, then push out: GSAP's transform order would do the reverse
      ring.append(c);
      return c;
    });
    history.scrollRestoration = 'manual';
    scrollTo(0, 0); lenis?.scrollTo(0, { immediate: true }); lenis?.stop();
    gsap.set(zoom, { opacity: 0 });

    // camera sits d px behind the cylinder's centre; a card is drawn only while it is in front of the camera
    const cam = { rot: -720, d: R * 0.6 };
    const place = () => {
      gsap.set(ring, { z: R * 0.45 - cam.d, rotationY: cam.rot });
      cards.forEach((c, i) => { const a = (i * step + cam.rot) * Math.PI / 180; c.style.visibility = R * Math.cos(a) + cam.d > 60 ? 'visible' : 'hidden'; });
    };
    place();

    const ready = Promise.race([
      Promise.all(cards.map(c => c.firstChild.decode().catch(() => {}))),
      new Promise(r => setTimeout(r, 2500))
    ]);
    return ready.then(() => new Promise(resolve => {
      if (over) return resolve();
      tl = gsap.timeline({ onComplete: done });
      tl.to(view, { clipPath: 'inset(17% 0% 17% 0%)', duration: 1, ease: 'power4.inOut' }, 0)
        .from('.intro-title > *', { y: 16, opacity: 0, duration: 0.8, stagger: 0.1, ease: 'expo.out' }, 0.3)
        .from('.intro-sub', { duration: 1, scrambleText: { text: '', chars: 'lowerCase', speed: 0.6 } }, 0.4)
        .to(cam, { rot: 0, duration: 2.6, ease: 'expo.inOut', onUpdate: place }, 0)
        .to(cam, { d: -R * 0.5, duration: 1, ease: 'power3.inOut', onUpdate: place }, 2.0)
        .to(view, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'power3.inOut' }, 2.1)
        .add(() => {
          // swap the 3D card for a flat copy and fly it into the O
          const r = cards[0].getBoundingClientRect(), z = zoom.getBoundingClientRect();
          view.style.display = 'none'; // cards carry their own visibility, so hide the whole view
          resolve(); // the name rises while the apple flies
          if (scrollY > 2) { gsap.set(zoom, { opacity: 1 }); return; } // page moved (programmatic scroll): no target to land on, just fade
          const fly = document.createElement('div');
          fly.className = 'intro-fly';
          fly.innerHTML = cards[0].innerHTML;
          document.body.append(fly);
          gsap.set(fly, { left: r.left, top: r.top, width: r.width, height: r.height });
          gsap.timeline({ onComplete: () => fly.remove() })
            .to(fly, { left: z.left, top: z.top, width: z.width, height: z.height, borderRadius: '50%', duration: 1, ease: 'expo.inOut' })
            .set(zoom, { opacity: 1 })
            .to(fly, { opacity: 0, duration: 0.2 });
        }, 3.0)
        .to(el, { backgroundColor: 'rgba(10,10,11,0)', duration: 0.8, ease: 'power2.inOut' }, 3.1)
        .to('.intro-title', { opacity: 0, duration: 0.4 }, 3.0)
        .to({}, { duration: 0.3 }, 3.9);
      const skip = () => { if (tl.progress() < 0.75) tl.progress(0.75); };
      el.addEventListener('click', skip);
      addEventListener('keydown', skip, { once: true });
    }));
  }

  // wait for the display face so the O is measured at its real position
  let started = false;
  const go = () => { if (!started) { started = true; init(); } };
  document.fonts?.ready.then(go);
  setTimeout(go, 1500);
})();
