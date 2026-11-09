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

  const DMIN = -2800, DMAX = 2040, MAXPPY = 60;
  const ICONS = {
    cross: '<path d="M-2.2,-9 h4.4 v5.2 h5.2 v4.4 h-5.2 v9.8 h-4.4 v-9.8 h-5.2 v-4.4 h5.2 z" fill="currentColor"/>',
    crescent: '<path d="M4,-8 A8.5,8.5 0 1 0 4,8 A9,9 0 0 1 4,-8 Z" fill="currentColor"/><path d="M3.5,-2.8 L4.2,-0.9 L6.2,-0.9 L4.6,0.3 L5.2,2.3 L3.5,1.1 L1.8,2.3 L2.4,0.3 L0.8,-0.9 L2.8,-0.9Z" fill="currentColor"/>',
    wheel: '<circle r="7.6" fill="none" stroke="currentColor" stroke-width="1.8"/><circle r="2.2" fill="currentColor"/><path d="M0,-7.6V7.6M-7.6,0H7.6M-5.4,-5.4L5.4,5.4M5.4,-5.4L-5.4,5.4" stroke="currentColor" stroke-width="1.4"/>',
    star: '<path d="M0,-9 L8,5 L-8,5Z M0,9 L8,-5 L-8,-5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    lotus: '<g fill="currentColor"><path d="M0,8 C-6,4 -6,-4 0,-9 C6,-4 6,4 0,8Z"/><path d="M-1,8 C-9,6 -11,-1 -8,-5 C-4,-3 -2,2 -1,8Z" opacity=".85"/><path d="M1,8 C9,6 11,-1 8,-5 C4,-3 2,2 1,8Z" opacity=".85"/></g>',
  };
  const SHIELD = 'M0,-10 L8,-7 L8,2 C8,8 3,11 0,13 C-3,11 -8,8 -8,2 L-8,-7 Z';
  const MINOR = { 5: 1, 10: 1, 20: 5, 25: 5, 50: 10, 100: 10, 200: 50, 250: 50, 500: 100, 1000: 100 };
  const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];

  let D, rels = [], relById = {}, catById = {}, events = [];
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
    D = d; rels = d.religions; events = d.events;
    rels.forEach(r => relById[r.id] = r); d.categories.forEach(c => catById[c.id] = c);
    const saved = store.get('filters', null);
    st.rel = new Set(saved?.rel?.filter(id => relById[id]) ?? rels.map(r => r.id));
    st.cat = new Set(saved?.cat?.filter(id => catById[id]) ?? []);
    buildChips(); buildPresets();
    measure(); fit(false);
    bind(); refresh();
    new ResizeObserver(() => { const old = W; measure(); if (old) { clampView(); } refresh(); }).observe(tl);
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
  const textMatch = e => !st.q || norm(`${e.t} ${e.x} ${span(e)} ${catById[e.c].name} ${relById[e.r].name}`).includes(norm(st.q));
  const matching = rid => events.filter(e => e.r === rid && (!st.cat.size || st.cat.has(e.c)) && textMatch(e));
  const visibleEvents = () => events.filter(e => st.rel.has(e.r) && (!st.cat.size || st.cat.has(e.c)) && textMatch(e));
  const saveFilters = () => store.set('filters', { rel: [...st.rel], cat: [...st.cat] });

  /* ---------- období (předvolby zoomu) ---------- */
  const PRESETS = [['Celá osa', DMIN, DMAX], ['Starověk', -1000, 500], ['Středověk', 450, 1520], ['Novověk', 1480, 1930], ['Dnešek', 1880, 2030]];
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
    syncChips(); renderDetail(); renderList(); draw();
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
      `<circle cx="0" cy="-1.5" r="2" fill="#f7ecce"/></g>`;
  }

  /* ---------- minimapa ---------- */
  function drawMini(vis) {
    const h = 56, w = pw(); mini.setAttribute('width', W); mini.setAttribute('height', h); mini.setAttribute('viewBox', `0 0 ${W} ${h}`);
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
  function renderDetail() {
    const box = $('#detail');
    const e = st.sel && events.find(x => x.id === st.sel);
    if (!e) { box.innerHTML = '<p class="detail-empty">Klepni na štít na ose. Tady se objeví podrobnosti události.</p>'; return; }
    const r = relById[e.r], list = visibleEvents().filter(x => x.r === e.r).sort((a, b) => a.y - b.y || (a.e ?? a.y) - (b.e ?? b.y));
    const i = list.findIndex(x => x.id === e.id);
    // co se dělo ve stejné době u ostatních náboženství
    const near = visibleEvents().filter(x => x.r !== e.r && Math.abs(x.y - e.y) <= Math.max(25, 0.04 * Math.abs(e.y))).sort((a, b) => Math.abs(a.y - e.y) - Math.abs(b.y - e.y)).slice(0, 4);
    box.innerHTML = `<div class="scroll" style="--c:${r.color}">
      <div class="meta"><span class="tag rel">${esc(r.name)}</span><span class="tag">${esc(catById[e.c].name)}</span></div>
      <div class="date">${esc(span(e))}</div>
      <h2>${esc(e.t)}</h2><p>${esc(e.x)}</p>
      <div class="acts">
        <button class="btn small" type="button" data-nav="-1" ${i <= 0 ? 'disabled' : ''}>◀ Předchozí</button>
        <button class="btn small" type="button" data-zoom="1">Přiblížit</button>
        <button class="btn small" type="button" data-nav="1" ${i >= list.length - 1 ? 'disabled' : ''}>Další ▶</button>
        <button class="btn small" type="button" data-close="1">Zavřít</button>
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
    $('#presets').addEventListener('click', ev => { const b = ev.target.closest('[data-p]'); if (!b) return; const p = PRESETS[+b.dataset.p]; fit(true, p[1], p[2]); });
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
})();
