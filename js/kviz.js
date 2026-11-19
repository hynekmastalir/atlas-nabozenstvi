/* Kvíz z událostí na ose: kdy se to stalo, které náboženství a co se stalo. */
(() => {
  'use strict';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = (a, n) => shuffle(a).slice(0, n);
  const store = {
    get(k, d) { try { const v = localStorage.getItem('osa:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('osa:' + k, JSON.stringify(v)); } catch { /* ignoruj */ } },
  };
  let pane, cfg = Object.assign({ type: 'mix', rel: 'all', count: 10 }, store.get('kvizCfg', {})), run = null;
  const $ = s => pane.querySelector(s);

  window.OSA_TABS.kviz = { init(p) { pane = p; setup(); }, show() { if (!run) setup(); }, hide() {} };

  const evs = () => OSA.events.filter(e => cfg.rel === 'all' || e.r === cfg.rel);

  // ---------- generování otázek ----------
  function yearOptions(e) {
    const base = e.y, len = e.e != null ? e.e - e.y : null, scale = Math.max(8, Math.abs(base) * 0.12), set = new Set([base]);
    let guard = 0;
    while (set.size < 4 && guard++ < 60) {
      let d = Math.round((Math.random() * 2 - 1) * scale * 2.2); if (Math.abs(d) < Math.max(3, scale * 0.25)) continue;
      const step = Math.abs(base) > 300 ? 5 : 1; d = Math.round(d / step) * step; let y = base + d; if (y === 0 || y > 2100) continue;
      if (e.y < 0 && y > 0 && Math.abs(y) < 40) continue;
      set.add(y);
    }
    return shuffle([...set]).map(y => ({ label: OSA.span({ y, e: len != null ? y + len : null, ap: e.ap }), ok: y === base }));
  }
  function make(kind, pool) {
    const e = pool[Math.floor(Math.random() * pool.length)];
    const r = OSA.relById[e.r], cat = OSA.catById[e.c];
    if (kind === 'year') return { kind, e, q: `Kdy se stalo: „${e.t}“?`, sub: r.name, opts: yearOptions(e) };
    if (kind === 'rel') {
      const rels = OSA.rels.filter(x => OSA.events.some(v => v.r === x.id)).slice(0, 8);
      return { kind, e, q: `Ke kterému náboženství patří: „${e.t}“ (${OSA.span(e)})?`, sub: cat.name, opts: rels.map(x => ({ label: x.name, ok: x.id === e.r, color: x.color })) };
    }
    if (kind === 'event') {
      const same = OSA.events.filter(v => v.r === e.r && v.id !== e.id && Math.abs(v.y - e.y) > 10);
      if (same.length < 3) return make('year', pool);
      return { kind, e, q: `Co se stalo u náboženství ${r.name} v letech ${OSA.span(e)}?`, sub: cat.name, opts: shuffle([{ label: e.t, ok: true }, ...pick(same, 3).map(v => ({ label: v.t, ok: false }))]) };
    }
    // order
    const same = OSA.events.filter(v => v.r === e.r && Math.abs(v.y - e.y) > 15);
    if (!same.length) return make('year', pool);
    const o = same[Math.floor(Math.random() * same.length)], first = e.y < o.y ? e : o;
    return { kind, e, q: 'Co se stalo dříve?', sub: r.name, opts: shuffle([e, o]).map(v => ({ label: v.t, ok: v.id === first.id })) };
  }
  function build() {
    const pool = evs(); if (pool.length < 5) return null;
    const kinds = cfg.type === 'mix' ? ['year', 'rel', 'event', 'order'] : [cfg.type];
    const qs = [], seen = new Set();
    let guard = 0;
    while (qs.length < cfg.count && guard++ < cfg.count * 8) {
      const q = make(kinds[qs.length % kinds.length], pool); if (seen.has(q.e.id + q.kind)) continue; seen.add(q.e.id + q.kind); qs.push(q);
    }
    return qs;
  }

  // ---------- obrazovky ----------
  function setup() {
    run = null;
    const best = store.get('kvizBest', 0), relOpts = OSA.rels.map(r => `<option value="${r.id}" ${cfg.rel === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('');
    pane.innerHTML = `<div class="kz-card"><h2>Kvíz z časové osy</h2>
      <p class="muted">Otázky se berou z událostí na ose (včetně těch, které jsi přidal sám). Za správnou odpověď jsou body, za sérii správných odpovědí bonus.</p>
      <label class="f"><span>Typ otázek</span><select id="kz-type">${[['mix', 'Mix všeho'], ['year', 'Kdy se to stalo'], ['rel', 'Které náboženství'], ['event', 'Co se stalo'], ['order', 'Co bylo dříve']].map(([v, n]) => `<option value="${v}" ${cfg.type === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="f"><span>Náboženství</span><select id="kz-rel"><option value="all">Všechna</option>${relOpts}</select></label>
      <label class="f"><span>Počet otázek</span><select id="kz-n">${[5, 10, 20].map(n => `<option ${cfg.count === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <div class="acts"><button id="kz-go" class="btn primary" type="button">Začít kvíz</button></div>
      <p class="muted small">${best ? `Tvůj nejlepší výsledek: ${best} bodů.` : 'Zatím žádný výsledek.'}</p></div>`;
    $('#kz-go').onclick = () => {
      cfg = { type: $('#kz-type').value, rel: $('#kz-rel').value, count: +$('#kz-n').value }; store.set('kvizCfg', cfg);
      const qs = build(); if (!qs) { alert('Pro tohle nastavení je na ose málo událostí.'); return; }
      run = { qs, i: 0, score: 0, streak: 0, right: 0, wrong: [] }; ask();
    };
  }
  function ask() {
    const q = run.qs[run.i];
    pane.innerHTML = `<div class="kz-card"><div class="kz-top"><span>Otázka ${run.i + 1} / ${run.qs.length}</span><span>Body: <b>${run.score}</b>${run.streak >= 3 ? ` · série ${run.streak}×` : ''}</span></div>
      <div class="bar"><i style="width:${Math.round(100 * run.i / run.qs.length)}%"></i></div>
      <h2 class="kz-q">${esc(q.q)}</h2><p class="muted small">${esc(q.sub)}</p>
      <div class="kz-opts">${q.opts.map((o, k) => `<button type="button" class="kz-opt" data-k="${k}" ${o.color ? `style="--c:${o.color}"` : ''}>${esc(o.label)}</button>`).join('')}</div>
      <div id="kz-fb" class="kz-fb" hidden></div></div>`;
    pane.querySelectorAll('.kz-opt').forEach(b => b.addEventListener('click', () => answer(q, +b.dataset.k), { once: true }));
  }
  function answer(q, k) {
    const ok = q.opts[k].ok;
    pane.querySelectorAll('.kz-opt').forEach((b, i) => { b.disabled = true; b.classList.add(q.opts[i].ok ? 'good' : (i === k ? 'bad' : 'dim')); });
    if (ok) { run.streak++; run.right++; run.score += 10 + (run.streak >= 3 ? 5 : 0); } else { run.streak = 0; run.wrong.push(q); }
    const e = q.e, last = run.i >= run.qs.length - 1;
    const fb = pane.querySelector('#kz-fb'); fb.hidden = false; fb.className = 'kz-fb ' + (ok ? 'good' : 'bad');
    fb.innerHTML = `<b>${ok ? 'Správně!' : 'Špatně.'}</b> ${esc(OSA.span(e))}: ${esc(e.t)}<br><span class="muted">${esc(e.x || '')}</span>
      <div class="acts"><button class="btn primary small" type="button" id="kz-next">${last ? 'Výsledek' : 'Další otázka'}</button><button class="btn small" type="button" id="kz-axis">Ukázat na ose</button></div>`;
    pane.querySelector('#kz-next').onclick = () => { run.i++; last ? done() : ask(); };
    pane.querySelector('#kz-axis').onclick = () => OSA.showEvent(e.id);
    pane.querySelector('#kz-next').focus({ preventScroll: true });
  }
  function done() {
    const best = store.get('kvizBest', 0), newBest = run.score > best; if (newBest) store.set('kvizBest', run.score);
    const pct = Math.round(100 * run.right / run.qs.length);
    pane.innerHTML = `<div class="kz-card"><h2>Hotovo</h2><div class="kz-score">${run.score}<small> bodů</small></div>
      <p>Správně ${run.right} z ${run.qs.length} (${pct} %).${newBest ? ' <b>Nový rekord!</b>' : ` Rekord je ${best} bodů.`}</p>
      ${run.wrong.length ? `<h3>Tohle ti nešlo</h3><ul class="kz-wrong">${run.wrong.map(q => `<li><button type="button" class="lnk" data-id="${q.e.id}"><time>${esc(OSA.span(q.e))}</time> ${esc(q.e.t)}</button></li>`).join('')}</ul>` : '<p>Bez chyby, výborně.</p>'}
      <div class="acts"><button id="kz-again" class="btn primary" type="button">Hrát znovu</button><button id="kz-set" class="btn" type="button">Změnit nastavení</button></div></div>`;
    $('#kz-again').onclick = () => { const qs = build(); run = { qs, i: 0, score: 0, streak: 0, right: 0, wrong: [] }; ask(); };
    $('#kz-set').onclick = setup;
    pane.querySelector('.kz-wrong')?.addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) OSA.showEvent(b.dataset.id); });
  }
})();
