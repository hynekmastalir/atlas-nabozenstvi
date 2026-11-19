/* Porovnání dvou náboženství vedle sebe. */
(() => {
  'use strict';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let pane, data, a = 'krestanstvi', b = 'islam';
  const $ = s => pane.querySelector(s);
  window.OSA_TABS.porovnani = {
    async init(p) { pane = p; pane.innerHTML = '<p class="muted">Načítám…</p>'; data = await fetch('data/porovnani.json').then(r => r.json()); draw(); },
    show() {}, hide() {},
  };
  const rel = id => OSA.relById[id] || { name: id, color: '#666' };
  function draw() {
    const opts = sel => data.religions.map(id => `<option value="${id}" ${id === sel ? 'selected' : ''}>${esc(rel(id).name)}</option>`).join('');
    pane.innerHTML = `<div class="cmp-pick">
        <label class="f"><span>První</span><select id="c-a">${opts(a)}</select></label>
        <button id="c-swap" class="btn small" type="button" aria-label="Prohodit" title="Prohodit">⇄</button>
        <label class="f"><span>Druhé</span><select id="c-b">${opts(b)}</select></label></div>
      <div class="cmp">
        <div class="cmp-head"><span></span><b style="--c:${rel(a).color}">${esc(rel(a).name)}</b><b style="--c:${rel(b).color}">${esc(rel(b).name)}</b></div>
        ${data.rows.map(r => `<div class="cmp-row"><div class="cmp-k">${esc(r.k)}</div><div class="cmp-v" style="--c:${rel(a).color}"><i>${esc(rel(a).name)}</i>${esc(r.v[a])}</div><div class="cmp-v" style="--c:${rel(b).color}"><i>${esc(rel(b).name)}</i>${esc(r.v[b])}</div></div>`).join('')}
      </div>
      <p class="muted small">Stručné shrnutí. U směrů a čísel jde o zaokrouhlené odhady. Porovnat lze jen náboženství se základními údaji (pět hlavních).</p>`;
    $('#c-a').onchange = e => { a = e.target.value; draw(); };
    $('#c-b').onchange = e => { b = e.target.value; draw(); };
    $('#c-swap').onclick = () => { [a, b] = [b, a]; draw(); };
  }
})();
