/* Časová osa náboženství: zoomovací osa se všemi náboženstvími, filtry a popisem událostí.
   Bez knihoven, kreslí se do SVG. Roky před naším letopočtem jsou záporné čísla. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const clampN = (v, a, b) => Math.min(b, Math.max(a, v));
  const store = {
    get(k, d) { try { const v = localStorage.getItem('osa:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('osa:' + k, JSON.stringify(v)); } catch { /* ignoruj */ } },
  };

  let DMIN = -2800, DMAX = 2040;
  const MAXPPY = 60;
  const ICONS = {
    cross: '<path d="M-2.2,-9 h4.4 v5.2 h5.2 v4.4 h-5.2 v9.8 h-4.4 v-9.8 h-5.2 v-4.4 h5.2 z" fill="currentColor"/>',
    crescent: '<path d="M4,-8 A8.5,8.5 0 1 0 4,8 A9,9 0 0 1 4,-8 Z" fill="currentColor"/><path d="M3.5,-2.8 L4.2,-0.9 L6.2,-0.9 L4.6,0.3 L5.2,2.3 L3.5,1.1 L1.8,2.3 L2.4,0.3 L0.8,-0.9 L2.8,-0.9Z" fill="currentColor"/>',
    wheel: '<circle r="7.6" fill="none" stroke="currentColor" stroke-width="1.8"/><circle r="2.2" fill="currentColor"/><path d="M0,-7.6V7.6M-7.6,0H7.6M-5.4,-5.4L5.4,5.4M5.4,-5.4L-5.4,5.4" stroke="currentColor" stroke-width="1.4"/>',
    star: '<path d="M0,-9 L8,5 L-8,5Z M0,9 L8,-5 L-8,-5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    sun: '<circle r="4.6" fill="currentColor"/><path d="M0,-9V-6.5M0,9V6.5M-9,0H-6.5M9,0H6.5M-6.4,-6.4L-4.6,-4.6M6.4,6.4L4.6,4.6M-6.4,6.4L-4.6,4.6M6.4,-6.4L4.6,-4.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    flame: '<path d="M0,-10 C3,-5 7,-2 6,3 C5.5,7 2.5,9 0,9 C-3,9 -6,6.5 -5.5,2.5 C-5,-1 -1.5,-3 0,-10Z" fill="currentColor"/>',
    dot: '<circle r="6.5" fill="currentColor"/>',
    lotus: '<g fill="currentColor"><path d="M0,8 C-6,4 -6,-4 0,-9 C6,-4 6,4 0,8Z"/><path d="M-1,8 C-9,6 -11,-1 -8,-5 C-4,-3 -2,2 -1,8Z" opacity=".85"/><path d="M1,8 C9,6 11,-1 8,-5 C4,-3 2,2 1,8Z" opacity=".85"/></g>',
  };
  const SHIELD = 'M0,-10 L8,-7 L8,2 C8,8 3,11 0,13 C-3,11 -8,8 -8,2 L-8,-7 Z';
  const MINOR = { 5: 1, 10: 1, 20: 5, 25: 5, 50: 10, 100: 10, 200: 50, 250: 50, 500: 100, 1000: 100 };
  const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];

  let D, rels = [], relById = {}, catById = {}, events = [];
  let custom = { religions: [], events: [] };   // vlastní materiály z localStorage
  const st = { rel: new Set(), cat: new Set(), q: '', sel: null };
  const view = { t0: -500, ppy: 0.3 };
  let W = 0, H = 0, gutter = 128, laneH = 150, compact = false, rowsY = [], rulerH = 78, clusters = [], anim = null, raf = 0;
  const svg = $('#svg'), tl = $('#tl'), mini = $('#mini');

  /* ---------- formátování roků ---------- */
  const fy = y => (y < 0 ? `${-y} př. n. l.` : y < 1000 ? `${y} n. l.` : `${y}`);
  function span(e) {
    const a = e.y, b = e.e; let s;
    if (b == null) s = fy(a);
    else if (a < 0 && b < 0) s = `${-a}–${-b} př. n. l.`;
    else if (a >= 0 && b >= 0) s = b < 1000 ? `${a}–${b} n. l.` : a < 1000 ? `${a} n. l. – ${b}` : `${a}–${b}`;
    else s = `${fy(a)} – ${fy(b)}`;
    return (e.ap ? 'kolem ' : '') + s;
  }
  function shortYear(e) {
    const a = e.y, b = e.e; const p = e.ap ? '~' : '';
    if (b == null) return p + (a < 0 ? `${-a} př. n. l.` : a);
    if (a < 0 && b < 0) return `${p}${-a}–${-b} př. n. l.`;
    return `${p}${a < 0 ? -a + ' př. n. l.' : a}–${b}`;
  }
  const tickLabel = (t, step) => (t === 0 ? '' : t < 0 ? `${-t} př. n. l.` : step >= 100 || t >= 1000 ? `${t}` : `${t}`);

  /* ---------- načtení ---------- */
  fetch('data/udalosti.json').then(r => r.json()).then(init).catch(err => {
    $('#detail').innerHTML = `<p class="detail-empty">Data se nepodařilo načíst (${esc(err.message)}). Otevři stránku přes web server.</p>`;
  });

  function init(d) {
    D = d; loadCustom(); rebuild();
    const saved = store.get('filters', null);
    st.rel = new Set(saved?.rel?.filter(id => relById[id]) ?? rels.map(r => r.id));
    rels.forEach(r => { if (r.u && !saved?.rel?.length) st.rel.add(r.id); });
    st.cat = new Set(saved?.cat?.filter(id => catById[id]) ?? []);
    buildChips(); buildPresets(); buildForm();
    measure(); fit(false);
    bind(); bindForm(); refresh();
    new ResizeObserver(() => { const old = W; measure(); if (old) { clampView(); } refresh(); }).observe(tl);
  }

  /* ---------- vlastní materiály (ukládají se jen v prohlížeči) ---------- */
  function loadCustom() {
    const c = store.get('custom', null);
    custom = { religions: Array.isArray(c?.religions) ? c.religions.filter(validRel) : [], events: Array.isArray(c?.events) ? c.events.filter(validEv) : [] };
  }
  function saveCustom() {
    try { localStorage.setItem('osa:custom', JSON.stringify(custom)); return true; }
    catch { alert('Vlastní materiály se nepodařilo uložit (prohlížeč blokuje úložiště nebo je plné). Exportuj je do souboru.'); return false; }
  }
  const HEX = /^#[0-9a-f]{6}$/i;
  const validRel = r => r && typeof r.id === 'string' && typeof r.name === 'string' && HEX.test(r.color) && ICONS[r.icon];
  const validUrl = u => { try { const x = new URL(u); return x.protocol === 'https:' || x.protocol === 'http:'; } catch { return false; } };
  const validEv = e => e && typeof e.id === 'string' && typeof e.r === 'string' && Number.isInteger(e.y) && e.y !== 0 && typeof e.t === 'string' && e.t.trim()
    && (e.e == null || (Number.isInteger(e.e) && e.e !== 0 && e.e >= e.y));
  // spojí základní a vlastní data a přepočítá rozsah osy
  function rebuild() {
    catById = {}; D.categories.forEach(c => catById[c.id] = c);
    rels = [...D.religions, ...custom.religions.map(r => ({ ...r, u: 1 }))];
    relById = {}; rels.forEach(r => relById[r.id] = r);
    events = [...D.events, ...custom.events.map(e => ({ ...e, c: catById[e.c] ? e.c : 'zaklad', x: e.x || '', u: 1 }))]
      .filter(e => relById[e.r]);
    const ys = events.flatMap(e => [e.y, e.e ?? e.y]);
    DMIN = Math.min(-2800, Math.floor((Math.min(...ys) - 60) / 100) * 100);
    DMAX = Math.max(2040, Math.ceil((Math.max(...ys) + 20) / 10) * 10);
  }

  /* ---------- filtry ---------- */
  const iconSvg = id => `<svg viewBox="-11 -11 22 22" aria-hidden="true" style="color:currentColor">${ICONS[id]}</svg>`;
  function buildChips() {
    $('#rel-chips').innerHTML = rels.map(r => `<button class="chip rel" type="button" data-rel="${r.id}" style="--c:${r.color}" aria-pressed="${st.rel.has(r.id)}">${iconSvg(r.icon)}<span>${esc(r.name)}</span><span class="n"></span></button>`).join('');
    $('#cat-chips').innerHTML = D.categories.map(c => `<button class="chip cat" type="button" data-cat="${c.id}" aria-pressed="${st.cat.has(c.id)}">${esc(c.name)}</button>`).join('');
  }
  function syncChips() {
    document.querySelectorAll('[data-rel]').forEach(b => {
      b.setAttribute('aria-pressed', st.rel.has(b.dataset.rel));
      b.querySelector('.n').textContent = `(${matching(b.dataset.rel).length})`;
    });
    document.querySelectorAll('[data-cat]').forEach(b => b.setAttribute('aria-pressed', st.cat.has(b.dataset.cat)));
  }
  const textMatch = e => !st.q || norm(`${e.t} ${e.x} ${e.d || ''} ${span(e)} ${catById[e.c].name} ${relById[e.r].name}`).includes(norm(st.q));
  const matching = rid => events.filter(e => e.r === rid && (!st.cat.size || st.cat.has(e.c)) && textMatch(e));
  const visibleEvents = () => events.filter(e => st.rel.has(e.r) && (!st.cat.size || st.cat.has(e.c)) && textMatch(e));
  const saveFilters = () => store.set('filters', { rel: [...st.rel], cat: [...st.cat] });

  /* ---------- období (předvolby zoomu) ---------- */
  const PRESETS = [['Celá osa', null, null], ['Starověk', -1000, 500], ['Středověk', 450, 1520], ['Novověk', 1480, 1930], ['Dnešek', 1880, 2030]];
  function buildPresets() {
    $('#presets').innerHTML = PRESETS.map((p, i) => `<button type="button" data-p="${i}">${p[0]}</button>`).join('');
  }

  /* ---------- rozměry a pohled ---------- */
  function measure() {
    W = Math.max(300, Math.floor(tl.clientWidth));
    compact = W < 640;
    gutter = compact ? 46 : 128;
    laneH = compact ? 128 : 150;
    rowsY = compact ? [-18, 34, -34, 50] : [-20, 38, -38, 56, -56, 72];
  }
  const pw = () => W - gutter;
  function clampView() {
    const w = pw(); const minPpy = w / (DMAX - DMIN + 80);
    view.ppy = clampN(view.ppy, minPpy, MAXPPY);
    const sp = w / view.ppy, lo = DMIN - 40, hi = DMAX + 40;
    view.t0 = sp >= hi - lo ? lo - (sp - (hi - lo)) / 2 : clampN(view.t0, lo, hi - sp);
  }
  function fit(animate = true, a = DMIN, b = DMAX) {
    const w = pw(); const ppy = w / (b - a);
    go(a, ppy, animate);
  }
  function go(t0, ppy, animate = true) {
    const minPpy = pw() / (DMAX - DMIN + 80);
    ppy = clampN(ppy, minPpy, MAXPPY);
    if (!animate) { view.t0 = t0; view.ppy = ppy; clampView(); req(); return; }
    const f0 = view.t0, p0 = view.ppy;
    anim = { t: performance.now(), d: 520, step(e) { view.ppy = Math.exp(Math.log(p0) + (Math.log(ppy) - Math.log(p0)) * e); view.t0 = f0 + (t0 - f0) * e; clampView(); } };
    req();
  }
  function zoomAt(factor, ax = pw() / 2) {
    const yr = view.t0 + ax / view.ppy;
    view.ppy = clampN(view.ppy * factor, pw() / (DMAX - DMIN + 80), MAXPPY);
    view.t0 = yr - ax / view.ppy; clampView(); req();
  }
  function centerOn(year, animate = true) { go(year - pw() / 2 / view.ppy, view.ppy, animate); }

  /* ---------- vykreslování ---------- */
  function req() { if (!raf) raf = requestAnimationFrame(frame); }
  function frame(now) {
    raf = 0;
    if (anim) {
      const t = Math.min(1, (now - anim.t) / anim.d); const e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      anim.step(e); if (t >= 1) anim = null; else req();
    }
    draw();
  }
  function refresh() {
    if (st.sel && !visibleEvents().some(e => e.id === st.sel)) st.sel = null;
    syncChips(); renderDetail(); renderList(); renderMine(); draw();
  }

  function draw() {
    if (!D) return;
    const lanes = rels.filter(r => st.rel.has(r.id));
    const vis = visibleEvents();
    const ppy = view.ppy, t0 = view.t0, w = pw();
    const X = y => gutter + (y - t0) * ppy;
    H = rulerH + Math.max(1, lanes.length) * laneH + 6;
    svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    $('#empty').hidden = vis.length > 0 && lanes.length > 0;
    let o = `<defs><clipPath id="clip"><rect x="${gutter}" y="0" width="${w}" height="${H}"/></clipPath></defs>`;
    clusters = [];

    // --- období a mřížka (ořezané na plochu osy) ---
    o += '<g clip-path="url(#clip)">';
    const pcol = ['#d9bf86', '#e6c76a', '#d7b98f', '#cfb69a'];
    D.periods.forEach((p, i) => {
      const x1 = X(p.from), x2 = X(p.to);
      if (x2 < gutter || x1 > W) return;
      o += `<rect x="${x1}" y="2" width="${Math.max(0, x2 - x1)}" height="22" fill="${pcol[i]}" stroke="#6b4a1e" stroke-width="1.2"/>`;
      if (i === 1) o += `<rect x="${x1}" y="${rulerH}" width="${Math.max(0, x2 - x1)}" height="${H - rulerH}" fill="rgba(184,134,11,.10)"/>`;
      const a = Math.max(x1, gutter), b = Math.min(x2, W);
      if (b - a > 46) o += `<text class="per" x="${(a + b) / 2}" y="18" text-anchor="middle">${esc(p.name)}</text>`;
    });
    // ticks
    const step = STEPS.find(s => s * ppy >= (compact ? 70 : 96)) || 1000;
    const ms = MINOR[step];
    o += `<line x1="${gutter}" x2="${W}" y1="${rulerH - 8}" y2="${rulerH - 8}" stroke="#6b4a1e" stroke-width="2"/>`;
    if (ms && ms * ppy >= 7) for (let t = Math.ceil(t0 / ms) * ms; X(t) < W + 10; t += ms) o += `<line x1="${X(t)}" x2="${X(t)}" y1="${rulerH - 14}" y2="${rulerH - 8}" stroke="#6b4a1e" stroke-width="1"/>`;
    for (let t = Math.ceil(t0 / step) * step; X(t) < W + 60; t += step) {
      const x = X(t);
      o += `<line x1="${x}" x2="${x}" y1="${rulerH - 22}" y2="${rulerH - 8}" stroke="#6b4a1e" stroke-width="2"/>`;
      o += `<line x1="${x}" x2="${x}" y1="${rulerH - 6}" y2="${H}" stroke="rgba(107,74,30,.28)" stroke-dasharray="3 5"/>`;
      o += `<text class="tick" x="${x}" y="${rulerH - 28}" text-anchor="middle">${t === 0 ? 'přelom letopočtu' : tickLabel(t, step)}</text>`;
    }

    // --- dráhy ---
    const selEv = st.sel && events.find(e => e.id === st.sel);
    lanes.forEach((r, li) => {
      const top = rulerH + li * laneH, cy = top + laneH / 2;
      o += `<rect x="${gutter}" y="${top}" width="${w}" height="${laneH}" fill="${li % 2 ? 'rgba(255,248,220,.30)' : 'rgba(150,100,40,.10)'}"/>`;
      o += `<line x1="${gutter}" x2="${W}" y1="${top}" y2="${top}" stroke="#6b4a1e" stroke-width="1.2"/>`;
      o += `<line x1="${gutter}" x2="${W}" y1="${cy}" y2="${cy}" stroke="${r.color}" stroke-width="3" stroke-opacity=".38" stroke-dasharray="1 7" stroke-linecap="round"/>`;
      const items = vis.filter(e => e.r === r.id).map(e => ({ e, x: X(e.y), x2: e.e != null ? X(e.e) : X(e.y) }))
        .filter(m => m.x2 > gutter - 30 && m.x < W + 30).sort((a, b) => a.x - b.x);
      // shluky bodů, které by se překrývaly
      const groups = []; let cur = null;
      for (const m of items) {
        if (cur && m.x - cur.last <= 13) { cur.items.push(m); cur.last = m.x; } else { cur = { items: [m], last: m.x }; groups.push(cur); }
      }
      const rowEnd = rowsY.map(() => -1e9);
      const trackEnd = [-1e9, -1e9, -1e9];
      // doba trvání: pruh pod osou, překrývající se období jsou ve vlastních stopách
      const bar = (m, op) => {
        let k = trackEnd.findIndex(v => v + 3 <= m.x); if (k < 0) k = 2;
        trackEnd[k] = Math.max(trackEnd[k], m.x2);
        return `<rect x="${m.x}" y="${cy + 11 + k * 6}" width="${Math.max(3, m.x2 - m.x)}" height="4" rx="2" fill="${r.color}" fill-opacity="${op}"/>`;
      };
      let bars = '', marks = '', labels = '';
      for (const g of groups) {
        if (g.items.length === 1) {
          const m = g.items[0], e = m.e, sel = e.id === st.sel;
          if (e.e != null && m.x2 - m.x > 6) bars += bar(m, .75);
          marks += shield(e, m.x, cy, r, sel);
          const txt = `${shortYear(e)} ${e.t}`; const trunc = txt.length > 34 ? txt.slice(0, 33) + '…' : txt;
          const lw = trunc.length * 6.1 + 10; const xs = m.x - 5;
          for (let k = 0; m.x >= gutter + 2 && k < rowsY.length; k++) {
            if (rowEnd[k] + 6 <= xs) {
              rowEnd[k] = xs + lw; const ly = cy + rowsY[k];
              labels += `<line x1="${m.x}" x2="${m.x}" y1="${cy + (rowsY[k] < 0 ? -9 : 11)}" y2="${ly + (rowsY[k] < 0 ? 3 : -11)}" stroke="${r.color}" stroke-opacity=".55"/>`;
              labels += `<text class="lbl" x="${xs}" y="${ly}"${sel ? ' font-weight="700"' : ''}><tspan font-weight="700" fill="${r.color}">${esc(shortYear(e))}</tspan> ${esc(e.t.length + shortYear(e).length > 33 ? e.t.slice(0, 33 - shortYear(e).length) + '…' : e.t)}</text>`;
              break;
            }
          }
        } else {
          const xs = g.items.map(m => m.x), cx = (Math.min(...xs) + Math.max(...xs)) / 2;
          const ys = g.items.flatMap(m => [m.e.y, m.e.e ?? m.e.y]);
          clusters.push({ a: Math.min(...ys), b: Math.max(...ys) });
          const sel = g.items.some(m => m.e.id === st.sel);
          g.items.forEach(m => { if (m.e.e != null && m.x2 - m.x > 6) bars += bar(m, .5); });
          marks += `<g class="cl" data-cl="${clusters.length - 1}" transform="translate(${cx} ${cy})"><title>${g.items.length} událostí, ${esc(span(g.items[0].e))}${g.items.length > 1 ? ' a další' : ''}. Klepnutím přiblížíš.</title><circle r="16" fill="transparent"/><circle r="11.5" fill="${r.color}" stroke="${sel ? '#a3281a' : '#e8c767'}" stroke-width="${sel ? 3 : 2}"/><text x="0" y="4.6" text-anchor="middle" font-size="13" font-weight="700" fill="#f7ecce" style="pointer-events:none">${g.items.length}</text></g>`;
        }
      }
      o += bars + labels + marks;
    });
    // svislice vybrané události přes všechny dráhy
    if (selEv) {
      const x = X(selEv.y);
      if (x > gutter && x < W) {
        o += `<line x1="${x}" x2="${x}" y1="${rulerH - 8}" y2="${H}" stroke="#a3281a" stroke-width="1.5" stroke-dasharray="6 4" style="pointer-events:none"/>`;
        o += `<g transform="translate(${x} ${rulerH - 8})" style="pointer-events:none"><rect x="-30" y="-2" width="60" height="18" rx="3" fill="#a3281a"/><text y="11" text-anchor="middle" font-size="12.5" font-weight="700" fill="#f7ecce">${esc(selEv.y < 0 ? -selEv.y + ' př.' : selEv.y)}</text></g>`;
      }
    }
    o += '</g>';

    // --- levý sloupec s názvy náboženství (nad obsahem) ---
    o += `<rect x="0" y="0" width="${gutter}" height="${H}" fill="#e3cf9b"/><line x1="${gutter - 1}" x2="${gutter - 1}" y1="0" y2="${H}" stroke="#6b4a1e" stroke-width="2"/><line x1="${gutter - 5}" x2="${gutter - 5}" y1="0" y2="${H}" stroke="#6b4a1e" stroke-width=".8"/>`;
    o += `<text class="per" x="${gutter / 2}" y="18" text-anchor="middle">${compact ? '' : 'Rok'}</text>`;
    lanes.forEach((r, li) => {
      const top = rulerH + li * laneH, cy = top + laneH / 2;
      o += `<line x1="0" x2="${gutter}" y1="${top}" y2="${top}" stroke="#6b4a1e" stroke-width="1.2"/>`;
      if (compact) {
        o += `<g><rect x="5" y="${cy - 52}" width="34" height="104" rx="5" fill="${r.color}" stroke="#e8c767" stroke-width="1.5"/><g transform="translate(22 ${cy - 36})" color="#f7ecce">${ICONS[r.icon]}</g><text class="lane-name" transform="translate(27 ${cy + 14}) rotate(-90)" text-anchor="middle" style="font-size:13px">${esc(r.short)}</text></g>`;
      } else {
        o += `<g><rect x="8" y="${cy - 36}" width="${gutter - 18}" height="72" rx="6" fill="${r.color}" stroke="#e8c767" stroke-width="2"/><rect x="12" y="${cy - 32}" width="${gutter - 26}" height="64" rx="4" fill="none" stroke="rgba(247,236,206,.55)"/><g transform="translate(${gutter / 2 - 4} ${cy - 15})" color="#f7ecce">${ICONS[r.icon]}</g><text class="lane-name" x="${gutter / 2 - 4}" y="${cy + 20}" text-anchor="middle">${esc(r.short)}</text></g>`;
      }
    });
    svg.innerHTML = o;
    $('#range').textContent = `Pohled: ${fy(Math.round(view.t0))} až ${fy(Math.round(view.t0 + w / ppy))} · zobrazeno ${vis.length} z ${events.length} událostí`;
    drawMini(vis);
  }

  function shield(e, x, cy, r, sel) {
    const dash = e.ap ? ' stroke-dasharray="2.5 2"' : '';
    return `<g class="ev" data-id="${e.id}" transform="translate(${x} ${cy})"><title>${esc(span(e))}: ${esc(e.t)}</title>` +
      `<circle r="16" fill="transparent"/>` +
      (sel ? `<circle r="17" fill="none" stroke="#a3281a" stroke-width="2.5"/>` : '') +
      `<path class="shield" d="${SHIELD}" fill="${r.color}" stroke="${sel ? '#a3281a' : '#f0d27a'}" stroke-width="${sel ? 2.2 : 1.6}"${dash}/>` +
      `<circle cx="0" cy="-1.5" r="2" fill="#f7ecce"/>` + (e.u ? `<text x="5" y="-8" font-size="11" fill="#b8860b" stroke="#fff6d8" stroke-width=".6" style="pointer-events:none">✦</text>` : '') + `</g>`;
  }

  /* ---------- minimapa ---------- */
  function drawMini(vis) {
    const h = Math.max(56, 26 + rels.length * 8), w = pw(); mini.setAttribute('width', W); mini.setAttribute('height', h); mini.setAttribute('viewBox', `0 0 ${W} ${h}`);
    const mx = y => gutter + (y - DMIN) / (DMAX - DMIN) * w;
    let o = `<rect width="${W}" height="${h}" fill="#e3cf9b"/>`;
    D.periods.forEach((p, i) => { o += `<rect x="${mx(p.from)}" y="0" width="${mx(p.to) - mx(p.from)}" height="12" fill="${['#d9bf86', '#e6c76a', '#d7b98f', '#cfb69a'][i]}" stroke="#6b4a1e" stroke-width=".6"/>`; });
    rels.forEach((r, i) => {
      const y = 18 + i * 7.5;
      o += `<line x1="${gutter}" x2="${W}" y1="${y + 2}" y2="${y + 2}" stroke="${r.color}" stroke-opacity=".18"/>`;
      if (st.rel.has(r.id)) vis.filter(e => e.r === r.id).forEach(e => { o += `<rect x="${mx(e.y) - 1}" y="${y - 1}" width="2.2" height="6" fill="${r.color}"/>`; });
    });
    const a = mx(view.t0), b = mx(view.t0 + w / view.ppy);
    o += `<rect x="${Math.max(gutter, a)}" y="1" width="${Math.max(6, Math.min(W, b) - Math.max(gutter, a))}" height="${h - 2}" fill="rgba(163,40,26,.14)" stroke="#a3281a" stroke-width="2" rx="3"/>`;
    o += `<text class="per" x="${gutter / 2}" y="34" text-anchor="middle">${compact ? '' : 'Přehled'}</text>`;
    mini.innerHTML = o;
  }

  /* ---------- popis události ---------- */
  // dlouhý text rozdělí na odstavce po dvou větách (dělí jen před velkým písmenem, aby se nerozdělilo „př. n. l.“)
  function paragraphs(text) {
    if (!text) return '';
    const sent = String(text).replace(/([.!?])\s+(?=[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ„])/g, '$1\u0001').split('\u0001');
    const out = [];
    for (let i = 0; i < sent.length; i += 2) out.push(sent.slice(i, i + 2).join(' '));
    return out.map(p => `<p>${esc(p)}</p>`).join('');
  }
  function renderDetail() {
    const box = $('#detail');
    const e = st.sel && events.find(x => x.id === st.sel);
    if (!e) { box.innerHTML = '<p class="detail-empty">Klepni na štít na ose. Tady se objeví podrobnosti události.</p>'; return; }
    const r = relById[e.r], list = visibleEvents().filter(x => x.r === e.r).sort((a, b) => a.y - b.y || (a.e ?? a.y) - (b.e ?? b.y));
    const i = list.findIndex(x => x.id === e.id);
    // co se dělo ve stejné době u ostatních náboženství
    const near = visibleEvents().filter(x => x.r !== e.r && Math.abs(x.y - e.y) <= Math.max(25, 0.04 * Math.abs(e.y))).sort((a, b) => Math.abs(a.y - e.y) - Math.abs(b.y - e.y)).slice(0, 4);
    box.innerHTML = `<div class="scroll" style="--c:${r.color}">
      <div class="meta"><span class="tag rel">${esc(r.name)}</span><span class="tag">${esc(catById[e.c].name)}</span>${e.u ? '<span class="tag own">✦ vlastní</span>' : ''}</div>
      <div class="date">${esc(span(e))}</div>
      <h2>${esc(e.t)}</h2>${paragraphs(e.d || e.x)}
      ${e.i && validUrl(e.i) ? `<img class="ev-img" src="${esc(e.i)}" alt="${esc(e.t)}" loading="lazy" referrerpolicy="no-referrer">` : ''}
      ${e.s && validUrl(e.s) ? `<p class="src"><a href="${esc(e.s)}" target="_blank" rel="noopener noreferrer">Zdroj: ${esc(new URL(e.s).hostname)} ↗</a></p>` : ''}
      <div class="acts">
        <button class="btn small" type="button" data-nav="-1" ${i <= 0 ? 'disabled' : ''}>◀ Předchozí</button>
        <button class="btn small" type="button" data-zoom="1">Přiblížit</button>
        <button class="btn small" type="button" data-nav="1" ${i >= list.length - 1 ? 'disabled' : ''}>Další ▶</button>
        <button class="btn small" type="button" data-close="1">Zavřít</button>
        ${e.u ? '<button class="btn small" type="button" data-edit="1">Upravit</button><button class="btn small danger" type="button" data-del="1">Smazat</button>' : ''}
      </div>
      ${near.length ? `<div class="compare"><b>Ve stejné době jinde:</b><ul>${near.map(x => `<li><button type="button" data-id="${x.id}">${esc(span(x))}: ${esc(x.t)} <i>(${esc(relById[x.r].name)})</i></button></li>`).join('')}</ul></div>` : ''}
    </div>`;
  }
  function select(id, { center = true } = {}) {
    st.sel = id; renderDetail(); draw();
    const e = events.find(x => x.id === id); if (!e) return;
    const x = gutter + (e.y - view.t0) * view.ppy;
    if (center && (x < gutter + 40 || x > W - 40)) centerOn(e.y);
    if (!center) return;
    const d = $('#detail'); const rc = d.getBoundingClientRect();
    if (rc.top > innerHeight - 80) d.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function renderList() {
    $('#list').innerHTML = visibleEvents().sort((a, b) => a.y - b.y).map(e => `<li><button type="button" data-id="${e.id}"><time>${esc(span(e))}</time><span><i class="sw" style="background:${relById[e.r].color}"></i><b>${esc(e.t)}</b> <span style="opacity:.75">${esc(relById[e.r].name)}</span></span></button></li>`).join('');
  }

  /* ---------- ovládání ---------- */
  function bind() {
    // filtry
    $('#rel-chips').addEventListener('click', ev => {
      const b = ev.target.closest('[data-rel]'); if (!b) return;
      const id = b.dataset.rel; st.rel.has(id) ? st.rel.delete(id) : st.rel.add(id);
      saveFilters(); refresh();
    });
    $('#cat-chips').addEventListener('click', ev => {
      const b = ev.target.closest('[data-cat]'); if (!b) return;
      const id = b.dataset.cat; st.cat.has(id) ? st.cat.delete(id) : st.cat.add(id);
      saveFilters(); refresh();
    });
    $('#q').addEventListener('input', ev => { st.q = ev.target.value.trim(); refresh(); });
    $('#reset-filters').onclick = () => { st.rel = new Set(rels.map(r => r.id)); st.cat.clear(); st.q = ''; $('#q').value = ''; saveFilters(); refresh(); };
    $('#presets').addEventListener('click', ev => { const b = ev.target.closest('[data-p]'); if (!b) return; const p = PRESETS[+b.dataset.p]; fit(true, p[1] ?? DMIN, p[2] ?? DMAX); });
    $('#zoom-in').onclick = () => zoomAnimated(2); $('#zoom-out').onclick = () => zoomAnimated(0.5);
    function zoomAnimated(f) {
      const c = view.t0 + pw() / 2 / view.ppy; const ppy = clampN(view.ppy * f, pw() / (DMAX - DMIN + 80), MAXPPY);
      go(c - pw() / 2 / ppy, ppy);
    }
    // popis, seznam
    const onDetail = ev => {
      const t = ev.target.closest('button'); if (!t) return;
      if (t.dataset.id) { select(t.dataset.id); return; }
      const e = events.find(x => x.id === st.sel); if (!e) return;
      if (t.dataset.close) { st.sel = null; renderDetail(); draw(); }
      else if (t.dataset.edit) openForm({ edit: e.id });
      else if (t.dataset.del) deleteEvent(e.id);
      else if (t.dataset.zoom) { const sp = Math.max(8, ((e.e ?? e.y) - e.y) * 1.4); const ppy = clampN(pw() * 0.35 / sp, view.ppy, 40); go((e.e != null ? (e.y + e.e) / 2 : e.y) - pw() / 2 / ppy, ppy); }
      else if (t.dataset.nav) {
        const list = visibleEvents().filter(x => x.r === e.r).sort((a, b) => a.y - b.y || (a.e ?? a.y) - (b.e ?? b.y));
        const n = list[list.findIndex(x => x.id === e.id) + +t.dataset.nav]; if (n) select(n.id);
      }
    };
    $('#detail').addEventListener('click', onDetail);
    $('#list').addEventListener('click', ev => { const b = ev.target.closest('[data-id]'); if (b) { select(b.dataset.id); $('#tl').scrollIntoView({ behavior: 'smooth', block: 'center' }); } });

    // tažení a štípnutí na ose (rozlišení klepnutí a tažení)
    const ptrs = new Map(); let down = null, pinch = null;
    svg.addEventListener('pointerdown', e => {
      svg.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      anim = null;
      if (ptrs.size === 1) down = { x: e.clientX, y: e.clientY, t0: view.t0, moved: false, target: e.target, touch: e.pointerType === 'touch' };
      else if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()]; down = null;
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, ppy: view.ppy, yr: view.t0 + ((a.x + b.x) / 2 - svg.getBoundingClientRect().left - gutter) / view.ppy };
      }
    });
    svg.addEventListener('pointermove', e => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && ptrs.size >= 2) {
        const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const ax = (a.x + b.x) / 2 - svg.getBoundingClientRect().left - gutter;
        view.ppy = clampN(pinch.ppy * d / pinch.d, pw() / (DMAX - DMIN + 80), MAXPPY);
        view.t0 = pinch.yr - ax / view.ppy; clampView(); req();
      } else if (down) {
        const dx = e.clientX - down.x, dy = e.clientY - down.y;
        if (!down.moved && Math.hypot(dx, dy) > (down.touch ? 10 : 5)) down.moved = true;
        if (down.moved) { view.t0 = down.t0 - dx / view.ppy; clampView(); req(); }
      }
    });
    const end = e => {
      const wasTap = down && !down.moved && ptrs.size === 1 && e.type === 'pointerup';
      const target = down?.target;
      ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null;
      if (ptrs.size === 0) down = null;
      if (wasTap && target) {
        const ev = target.closest?.('[data-id]'), cl = target.closest?.('[data-cl]');
        if (ev) select(ev.dataset.id);
        else if (cl) { const c = clusters[+cl.dataset.cl]; const sp = Math.max(c.b - c.a, 1); const ppy = clampN(Math.max(view.ppy * 2.4, pw() * 0.5 / sp), view.ppy, MAXPPY); go((c.a + c.b) / 2 - pw() / 2 / ppy, ppy); }
      }
    };
    svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
    tl.addEventListener('wheel', e => {
      e.preventDefault(); anim = null;
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) { view.t0 += (e.deltaX || e.deltaY) / view.ppy; clampView(); req(); return; }
      const ax = e.clientX - svg.getBoundingClientRect().left - gutter;
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), clampN(ax, 0, pw()));
    }, { passive: false });
    tl.addEventListener('keydown', e => {
      const sp = pw() / view.ppy;
      if (e.key === 'ArrowLeft') { view.t0 -= sp * 0.15; clampView(); req(); }
      else if (e.key === 'ArrowRight') { view.t0 += sp * 0.15; clampView(); req(); }
      else if (e.key === '+' || e.key === '=') zoomAt(1.4);
      else if (e.key === '-') zoomAt(1 / 1.4);
      else if (e.key === '0' || e.key === 'Home') fit(true);
      else return;
      e.preventDefault();
    });

    // minimapa: klepnutí nebo tažení přesune okno
    let md = false;
    const miniMove = e => {
      const r = mini.getBoundingClientRect(); const x = clampN(e.clientX - r.left - gutter, 0, pw());
      const yr = DMIN + x / pw() * (DMAX - DMIN); anim = null;
      view.t0 = yr - pw() / 2 / view.ppy; clampView(); req();
    };
    mini.addEventListener('pointerdown', e => { md = true; mini.setPointerCapture(e.pointerId); miniMove(e); });
    mini.addEventListener('pointermove', e => { if (md) miniMove(e); });
    mini.addEventListener('pointerup', () => { md = false; }); mini.addEventListener('pointercancel', () => { md = false; });
  }
  /* ---------- formulář pro vlastní události ---------- */
  const PALETTE = ['#2b4c8f', '#2e7d5b', '#b9801a', '#703a82', '#b4452b', '#1f6f78', '#8a5a2b', '#a3281a', '#4b5563', '#c2410c'];
  const ICON_NAMES = ['cross', 'crescent', 'wheel', 'star', 'lotus', 'sun', 'flame', 'dot'];
  const dlg = $('#dlg');
  let editId = null, pickedIcon = 'dot', pickedColor = PALETTE[6];
  const clean = (v, n) => String(v ?? '').trim().slice(0, n);
  const rid = () => Math.random().toString(36).slice(2, 7);

  function buildForm() {
    $('#f-cat').innerHTML = D.categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    $('#f-swatches').innerHTML = PALETTE.map(c => `<button type="button" class="swb" data-color="${c}" style="background:${c}" aria-label="Barva ${c}"></button>`).join('');
    $('#f-icons').innerHTML = ICON_NAMES.map(n => `<button type="button" class="ic" data-icon="${n}" aria-pressed="false" aria-label="Ikona ${n}"><svg viewBox="-11 -11 22 22" aria-hidden="true">${ICONS[n]}</svg></button>`).join('');
  }
  function fillRelSelect(sel) {
    const el = $('#f-rel');
    el.innerHTML = rels.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('') + '<option value="__new__">➕ Nové náboženství…</option>';
    el.value = sel && (sel === '__new__' || relById[sel]) ? sel : rels[0].id;
    $('#new-rel').hidden = el.value !== '__new__';
  }
  function setPicked(color, icon) {
    pickedColor = color; pickedIcon = icon;
    $('#f-color').value = color;
    document.querySelectorAll('#f-icons .ic').forEach(b => b.setAttribute('aria-pressed', b.dataset.icon === icon));
    document.querySelectorAll('#f-swatches .swb').forEach(b => b.setAttribute('aria-pressed', b.dataset.color === color));
  }
  const showErr = (msg, field) => { const el = $('#f-err'); el.textContent = msg; el.hidden = !msg; if (field && $(field)) $(field).focus(); };

  function openForm({ edit = null, rel = null, year = null } = {}) {
    editId = edit;
    const e = edit && events.find(x => x.id === edit);
    $('#ev-form').reset(); showErr('');
    $('#dlg-title').textContent = e ? 'Upravit událost' : 'Přidat vlastní událost';
    $('#f-save').textContent = e ? 'Uložit změny' : 'Uložit na osu';
    fillRelSelect(e ? e.r : rel);
    setPicked(PALETTE[custom.religions.length % PALETTE.length], 'dot');
    if (e) {
      $('#f-y').value = Math.abs(e.y); $('#f-era').value = e.y < 0 ? 'bce' : 'ce';
      if (e.e != null) { $('#f-range').checked = true; $('#f-e').value = Math.abs(e.e); $('#f-era2').value = e.e < 0 ? 'bce' : 'ce'; }
      $('#f-ap').checked = !!e.ap; $('#f-cat').value = e.c; $('#f-t').value = e.t; $('#f-x').value = e.x || ''; $('#f-s').value = e.s || ''; $('#f-i').value = e.i || '';
    } else if (year != null) {
      const y = year === 0 ? 1 : year; $('#f-y').value = Math.abs(y); $('#f-era').value = y < 0 ? 'bce' : 'ce';
    }
    $('#end-row').hidden = !$('#f-range').checked;
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    $('#f-t').focus();
  }
  const closeForm = () => { if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open'); };

  function signedYear(valId, eraId, label) {
    const raw = $(valId).value.trim();
    if (!/^\d{1,4}$/.test(raw) || +raw < 1) return { err: `${label}: zadej celé kladné číslo (rok 0 neexistuje).`, field: valId };
    const n = +raw, bce = $(eraId).value === 'bce';
    if (!bce && n > 2100) return { err: `${label}: rok n. l. může být nejvýše 2100.`, field: valId };
    return { y: bce ? -n : n };
  }

  function onSubmit(ev) {
    ev.preventDefault();
    let relId = $('#f-rel').value; let newRel = null;
    if (relId === '__new__') {
      const name = clean($('#f-rname').value, 30);
      if (!name) return showErr('Vyplň název nového náboženství.', '#f-rname');
      if (rels.some(r => norm(r.name) === norm(name))) return showErr('Náboženství s tímto názvem už existuje, vyber ho v seznamu.', '#f-rname');
      if (!HEX.test(pickedColor) || !ICONS[pickedIcon]) return showErr('Vyber barvu a ikonu.');
      newRel = { id: 'u-' + rid(), name, short: name.length > 12 ? name.slice(0, 11) + '…' : name, color: pickedColor.toLowerCase(), icon: pickedIcon };
      relId = newRel.id;
    }
    const a = signedYear('#f-y', '#f-era', 'Rok'); if (a.err) return showErr(a.err, a.field);
    let end = null;
    if ($('#f-range').checked) {
      const b = signedYear('#f-e', '#f-era2', 'Konec'); if (b.err) return showErr(b.err, b.field);
      if (b.y < a.y) return showErr('Konec nesmí být před začátkem.', '#f-e');
      if (b.y !== a.y) end = b.y;
    }
    const t = clean($('#f-t').value, 80); if (!t) return showErr('Vyplň název události.', '#f-t');
    const src = $('#f-s').value.trim(), img = $('#f-i').value.trim();
    if (src && !validUrl(src)) return showErr('Odkaz na zdroj musí začínat https:// nebo http://.', '#f-s');
    if (img && !validUrl(img)) return showErr('Odkaz na obrázek musí začínat https:// nebo http://.', '#f-i');
    if (!editId && custom.events.length >= 500) return showErr('Je dosaženo limitu 500 vlastních událostí. Některé smaž nebo exportuj.');
    const rec = { id: editId || 'u' + Date.now().toString(36) + rid(), r: relId, y: a.y, c: $('#f-cat').value, t, x: clean($('#f-x').value, 800) };
    if (end != null) rec.e = end;
    if ($('#f-ap').checked) rec.ap = 1;
    if (src) rec.s = src;
    if (img) rec.i = img;
    if (newRel) custom.religions.push(newRel);
    const i = custom.events.findIndex(x => x.id === rec.id);
    if (i >= 0) custom.events[i] = rec; else custom.events.push(rec);
    if (!saveCustom()) return;
    afterChange(rec.id, relId);
    closeForm();
  }
  // po změně dat: přepočítat, zapnout dráhu, zrušit filtry, které by novou událost skryly
  function afterChange(selectId, relId) {
    rebuild(); clampView();
    if (relId) st.rel.add(relId);
    st.q = ''; $('#q').value = ''; st.cat.clear(); saveFilters();
    buildChips(); refresh();
    if (selectId) select(selectId);
  }
  function deleteEvent(id) {
    const e = events.find(x => x.id === id); if (!e || !confirm(`Smazat vlastní událost „${e.t}“?`)) return;
    custom.events = custom.events.filter(x => x.id !== id); saveCustom();
    if (st.sel === id) st.sel = null; rebuild(); clampView(); buildChips(); refresh();
  }
  function deleteReligion(id) {
    const r = relById[id]; if (!r || !r.u) return;
    const n = custom.events.filter(e => e.r === id).length;
    if (!confirm(`Smazat vlastní náboženství „${r.name}“ i s jeho událostmi (${n})?`)) return;
    custom.religions = custom.religions.filter(x => x.id !== id); custom.events = custom.events.filter(e => e.r !== id);
    st.rel.delete(id); saveCustom(); saveFilters(); st.sel = null; rebuild(); clampView(); buildChips(); refresh();
  }

  /* ---------- panel „Moje materiály“: seznam, export, import ---------- */
  const mineMsg = (t, bad) => { const el = $('#mine-msg'); el.textContent = t; el.className = bad ? 'bad' : 'ok'; };
  function renderMine() {
    const ce = events.filter(e => e.u);
    $('#mine-n').textContent = `(${ce.length})`;
    $('#mine-rels').innerHTML = custom.religions.length ? custom.religions.map(r => `<li><span class="sw" style="background:${esc(r.color)}"></span><b>${esc(r.name)}</b> <button type="button" class="lnk" data-act="del-rel" data-id="${esc(r.id)}">smazat</button></li>`).join('') : '<li class="none">Žádné vlastní náboženství.</li>';
    $('#mine-evs').innerHTML = ce.length ? ce.sort((a, b) => a.y - b.y).map(e => `<li><button type="button" class="lnk" data-act="show" data-id="${e.id}"><time>${esc(span(e))}</time> ${esc(e.t)}</button> <i class="muted">${esc(relById[e.r].name)}</i> <button type="button" class="lnk" data-act="edit" data-id="${e.id}">upravit</button> <button type="button" class="lnk" data-act="del" data-id="${e.id}">smazat</button></li>`).join('') : '<li class="none">Zatím nic. Klikni na „Přidat událost“.</li>';
  }
  function exportJson() {
    const out = { verze: 1, poznamka: 'Vlastní materiály z Časové osy náboženství. Lze importovat zpět, nebo zkopírovat do osa/data/udalosti.json.', religions: custom.religions, events: custom.events };
    const url = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'vlastni-udalosti-osa.json'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    mineMsg(`Exportováno: ${custom.events.length} událostí, ${custom.religions.length} náboženství.`);
  }
  async function importFile(file) {
    let j; try { j = JSON.parse(await file.text()); } catch { return mineMsg('Soubor není platný JSON.', true); }
    const rs = Array.isArray(j?.religions) ? j.religions : [], es = Array.isArray(j?.events) ? j.events : [];
    let nr = 0, ne = 0, skipped = 0; const map = {};
    for (const r of rs) {
      if (!validRel(r)) { skipped++; continue; }
      if (relById[r.id]) { map[r.id] = r.id; continue; }
      const id = 'u-' + clean(r.id, 40).replace(/[^\w-]/g, '').replace(/^u-/, '');
      const name = clean(r.name, 30);
      custom.religions.push({ id, name, short: name.length > 12 ? name.slice(0, 11) + '…' : name, color: r.color.toLowerCase(), icon: r.icon });
      map[r.id] = id; rebuild(); nr++;
    }
    for (const e of es) {
      const target = map[e.r] || (relById[e.r] ? e.r : null);
      if (!target || !validEv({ ...e, id: 'x', r: target }) || custom.events.length >= 500) { skipped++; continue; }
      const rec = { id: 'u' + Date.now().toString(36) + rid(), r: target, y: e.y, c: catById[e.c] ? e.c : 'zaklad', t: clean(e.t, 80), x: clean(e.x, 800) };
      if (e.e != null && e.e !== e.y) rec.e = e.e;
      if (e.ap) rec.ap = 1;
      if (validUrl(e.s)) rec.s = e.s;
      if (validUrl(e.i)) rec.i = e.i;
      custom.events.push(rec); ne++;
    }
    if (!saveCustom()) return;
    rebuild(); clampView(); rels.forEach(r => { if (r.u) st.rel.add(r.id); }); saveFilters(); buildChips(); refresh();
    mineMsg(`Importováno: ${ne} událostí, ${nr} náboženství.` + (skipped ? ` Přeskočeno ${skipped} neplatných záznamů.` : ''), skipped > 0 && ne === 0);
  }

  function bindForm() {
    $('#add-ev').onclick = () => openForm({ rel: [...st.rel][0] });
    $('#mine-add').onclick = () => openForm({ rel: [...st.rel][0] });
    $('#ev-form').addEventListener('submit', onSubmit);
    $('#f-cancel').onclick = closeForm;
    dlg.addEventListener('click', e => { if (e.target === dlg) closeForm(); });   // klepnutí na pozadí zavře
    $('#f-rel').onchange = () => { $('#new-rel').hidden = $('#f-rel').value !== '__new__'; };
    $('#f-range').onchange = () => { $('#end-row').hidden = !$('#f-range').checked; };
    $('#f-swatches').addEventListener('click', e => { const b = e.target.closest('[data-color]'); if (b) setPicked(b.dataset.color, pickedIcon); });
    $('#f-icons').addEventListener('click', e => { const b = e.target.closest('[data-icon]'); if (b) setPicked(pickedColor, b.dataset.icon); });
    $('#f-color').addEventListener('input', e => setPicked(e.target.value, pickedIcon));
    $('#mine').addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b) return; const id = b.dataset.id;
      if (b.dataset.act === 'show') { select(id); $('#tl').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      else if (b.dataset.act === 'edit') openForm({ edit: id });
      else if (b.dataset.act === 'del') deleteEvent(id);
      else if (b.dataset.act === 'del-rel') deleteReligion(id);
    });
    $('#mine-export').onclick = exportJson;
    $('#mine-import').onchange = async e => { const f = e.target.files[0]; if (f) await importFile(f); e.target.value = ''; };
    $('#mine-clear').onclick = () => {
      if (!custom.events.length && !custom.religions.length) return mineMsg('Není co mazat.');
      if (!confirm('Opravdu smazat všechny vlastní události a náboženství z tohoto prohlížeče? Nejdřív je případně exportuj.')) return;
      custom = { religions: [], events: [] }; saveCustom(); st.rel = new Set([...st.rel].filter(id => relById[id] && !relById[id].u)); st.sel = null;
      rebuild(); clampView(); buildChips(); refresh(); mineMsg('Vlastní materiály smazány.');
    };
    // dvojklik do dráhy = nová událost v tom roce a náboženství
    svg.addEventListener('dblclick', e => {
      if (e.target.closest('.ev, .cl')) return;
      const r = svg.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      if (x < gutter || y < rulerH) return;
      const lane = rels.filter(q => st.rel.has(q.id))[Math.floor((y - rulerH) / laneH)];
      openForm({ rel: lane?.id, year: Math.round(view.t0 + (x - gutter) / view.ppy) });
    });
  }
})();
