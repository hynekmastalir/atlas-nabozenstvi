/* Mapa šíření náboženství: posuvníkem měníš dobu a vidíš, v kterých zemích se které náboženství vyskytovalo. */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let pane, world, data, era = 7, on = new Set(), timer = 0, vb = { x: 0, y: 0, w: 1000, h: 500 }, paths = new Map(), pinsG, patDefs, seaRect, svg;
  const proj = (lon, lat) => [(lon + 180) / 360 * 1000, (90 - lat) / 180 * 500];

  // zóny: když pro danou éru chybí záznam, platí poslední dřívější; prázdné pole zónu ukončí
  const zonesAt = (r, e) => { for (let i = e; i >= 0; i--) if (r.zones[i] !== undefined) return r.zones[i]; return []; };

  window.OSA_TABS.mapa = {
    async init(p) {
      pane = p; p.innerHTML = '<p class="muted">Načítám mapu…</p>';
      const [w, d] = await Promise.all([fetch('data/svet.json').then(r => r.json()), fetch('data/sireni.json').then(r => r.json())]);
      world = w; data = d; on = new Set(d.religions.map(r => r.id));
      build(); draw(); window.addEventListener('resize', () => { if (!pane.hidden) draw(); });
    },
    show() { draw(); },
    hide() { stop(); },
  };

  const rel = id => OSA.relById[id] || { name: id, color: '#666' };
  function build() {
    pane.innerHTML = `<div class="map-bar">
        <button id="m-play" class="btn small" type="button" aria-label="Přehrát" title="Přehrát vývoj">▶</button>
        <input id="m-era" type="range" min="0" max="${data.eras.length - 1}" step="1" value="${era}" aria-label="Doba">
      </div>
      <div class="map-era"><b id="m-label"></b><span id="m-title"></span></div>
      <div id="m-chips" class="chips map-chips"></div>
      <div class="map-wrap"><svg id="m-svg" viewBox="0 0 1000 500" role="img" aria-label="Mapa světa s rozšířením náboženství"></svg>
        <div class="map-zoom"><button type="button" data-z="1.5" aria-label="Přiblížit">+</button><button type="button" data-z="0.67" aria-label="Oddálit">−</button><button type="button" data-z="0" aria-label="Celý svět">⟲</button></div></div>
      <div id="m-info" class="map-info" aria-live="polite">Klepni na zemi nebo na značku svatého místa.</div>
      <div id="m-share" class="map-share"></div>
      <p class="muted small">Zóny jsou zjednodušené: země je vybarvená, pokud se tam dané náboženství v té době významně vyskytovalo, ne jen jako menšina. Údaje o podílu na světové populaci jsou odhady.</p>`;
    svg = pane.querySelector('#m-svg');
    svg.innerHTML = '<defs id="m-defs"></defs><rect id="m-sea" x="-500" y="-250" width="2000" height="1000"/><g id="m-land"></g><g id="m-pins"></g>';
    patDefs = svg.querySelector('#m-defs'); seaRect = svg.querySelector('#m-sea'); pinsG = svg.querySelector('#m-pins');
    const land = svg.querySelector('#m-land');
    for (const [code, c] of Object.entries(world.countries)) {
      const p = document.createElementNS(NS, 'path'); p.setAttribute('d', c.d); p.setAttribute('class', 'land'); p.dataset.code = code;
      land.appendChild(p); paths.set(code, { p, name: c.n });
    }
    pane.querySelector('#m-chips').innerHTML = data.religions.map(r => { const x = rel(r.id); return `<button type="button" class="chip rel" data-mr="${r.id}" style="--c:${x.color}" aria-pressed="true"><span>${esc(x.name)}</span></button>`; }).join('');
    pane.querySelector('#m-era').addEventListener('input', e => { era = +e.target.value; stop(); draw(); });
    pane.querySelector('#m-play').addEventListener('click', () => (timer ? stop() : play()));
    pane.querySelector('#m-chips').addEventListener('click', e => { const b = e.target.closest('[data-mr]'); if (!b) return; const id = b.dataset.mr; on.has(id) ? on.delete(id) : on.add(id); b.setAttribute('aria-pressed', String(on.has(id))); draw(); });
    pane.querySelector('.map-zoom').addEventListener('click', e => { const b = e.target.closest('[data-z]'); if (!b) return; const f = +b.dataset.z; if (!f) vb = { x: 0, y: 0, w: 1000, h: 500 }; else zoomBy(f, vb.x + vb.w / 2, vb.y + vb.h / 2); applyVb(); });
    // tažení a kolečko
    let drag = null;
    svg.addEventListener('pointerdown', e => { svg.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, vx: vb.x, vy: vb.y, moved: false }; });
    svg.addEventListener('pointermove', e => {
      if (!drag) return; const r = svg.getBoundingClientRect(), k = vb.w / r.width;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      if (drag.moved) { vb.x = drag.vx - dx * k; vb.y = drag.vy - dy * k; applyVb(); }
    });
    svg.addEventListener('pointerup', e => { const d = drag; drag = null; if (d && !d.moved) tap(e); });
    svg.addEventListener('wheel', e => { e.preventDefault(); const r = svg.getBoundingClientRect(); zoomBy(e.deltaY < 0 ? 1.25 : 0.8, vb.x + (e.clientX - r.left) / r.width * vb.w, vb.y + (e.clientY - r.top) / r.height * vb.h); applyVb(); }, { passive: false });
  }
  function zoomBy(f, cx, cy) {
    const w = Math.min(1000, Math.max(120, vb.w / f)), h = w / 2;
    vb = { x: cx - (cx - vb.x) * (w / vb.w), y: cy - (cy - vb.y) * (h / vb.h), w, h };
  }
  function applyVb() {
    vb.x = Math.min(1000 - vb.w, Math.max(0, vb.x)); vb.y = Math.min(500 - vb.h, Math.max(0, vb.y));
    svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    const k = vb.w / 1000; pinsG.querySelectorAll('.pin').forEach(g => { g.querySelector('circle').setAttribute('r', 5 * k + 0.5); g.querySelector('text').setAttribute('font-size', 11 * k + 2); });
  }
  function play() {
    if (era >= data.eras.length - 1) era = 0;
    pane.querySelector('#m-play').textContent = '⏸'; draw();
    timer = setInterval(() => { if (era >= data.eras.length - 1) { stop(); return; } era++; pane.querySelector('#m-era').value = era; draw(); }, 1700);
  }
  function stop() { if (timer) { clearInterval(timer); timer = 0; } const b = pane?.querySelector('#m-play'); if (b) b.textContent = '▶'; }

  function pattern(colors) {
    const id = 'pt-' + colors.map(c => c.slice(1)).join('-');
    if (!patDefs.querySelector('#' + id)) {
      const n = colors.length, s = 7 * n, p = document.createElementNS(NS, 'pattern');
      p.setAttribute('id', id); p.setAttribute('width', s); p.setAttribute('height', s); p.setAttribute('patternUnits', 'userSpaceOnUse'); p.setAttribute('patternTransform', 'rotate(45)');
      colors.forEach((c, i) => { const r = document.createElementNS(NS, 'rect'); r.setAttribute('x', i * 7); r.setAttribute('y', 0); r.setAttribute('width', 7); r.setAttribute('height', s); r.setAttribute('fill', c); p.appendChild(r); });
      patDefs.appendChild(p);
    }
    return id;
  }
  const byCountry = new Map();
  function draw() {
    if (!data) return;
    const e = data.eras[era];
    pane.querySelector('#m-label').textContent = e.label; pane.querySelector('#m-title').textContent = e.title;
    pane.querySelector('#m-era').value = era;
    byCountry.clear();
    for (const r of data.religions) {
      if (!on.has(r.id)) continue;
      for (const code of zonesAt(r, era)) { if (!byCountry.has(code)) byCountry.set(code, []); byCountry.get(code).push(r.id); }
    }
    for (const [code, o] of paths) {
      const list = byCountry.get(code);
      if (!list) { o.p.removeAttribute('style'); o.p.classList.remove('hot'); continue; }
      const cols = list.map(id => rel(id).color);
      o.p.style.fill = cols.length === 1 ? cols[0] : `url(#${pattern(cols)})`; o.p.classList.add('hot');
    }
    // značky svatých míst
    pinsG.innerHTML = '';
    for (const r of data.religions) {
      if (!on.has(r.id)) continue;
      for (const pl of r.places) {
        if (pl.era > era) continue;
        const [x, y] = proj(pl.lon, pl.lat), g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'pin'); g.dataset.pl = pl.id + '|' + r.id;
        g.innerHTML = `<circle cx="${x}" cy="${y}" r="5" fill="${rel(r.id).color}" stroke="#fff" stroke-width="1.5"/><text x="${x + 7}" y="${y + 3}" font-size="11" class="pin-t">${esc(pl.name)}</text>`;
        pinsG.appendChild(g);
      }
    }
    applyVb();
    const sh = data.religions.filter(r => on.has(r.id)).map(r => ({ r, v: r.share[era] })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
    pane.querySelector('#m-share').innerHTML = sh.length ? '<b>Odhad podílu na světové populaci:</b> ' + sh.map(x => `<span class="sh" style="--c:${rel(x.r.id).color}">${esc(rel(x.r.id).name)} ${x.v < 1 ? '<1' : Math.round(x.v)} %</span>`).join('') : '';
  }
  function tap(e) {
    // po setPointerCapture je e.target samotné SVG, proto se prvek pod prstem zjišťuje podle souřadnic
    const hit = document.elementFromPoint(e.clientX, e.clientY) || e.target, info = pane.querySelector('#m-info'), pin = hit.closest?.('.pin');
    if (pin) {
      const [pid, rid] = pin.dataset.pl.split('|'), r = data.religions.find(x => x.id === rid), pl = r.places.find(x => x.id === pid);
      info.innerHTML = `<b>${esc(pl.name)}</b> <span class="muted">(${esc(rel(rid).name)})</span><br>${esc(pl.text)}`; return;
    }
    const pth = hit.closest?.('.land'); if (!pth) { info.textContent = 'Klepni na zemi nebo na značku svatého místa.'; return; }
    const code = pth.dataset.code, list = byCountry.get(code) || [], name = paths.get(code).name;
    info.innerHTML = `<b>${esc(name)}</b>: ${list.length ? list.map(id => `<span class="sh" style="--c:${rel(id).color}">${esc(rel(id).name)}</span>`).join(' ') : '<span class="muted">v této době tu mapa žádné z vybraných náboženství nevyznačuje</span>'}`;
  }
})();
