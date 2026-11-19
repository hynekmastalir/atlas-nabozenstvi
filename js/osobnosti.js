/* Osobnosti: karty zakladatelů, proroků a reformátorů s odkazy na události na ose. */
(() => {
  'use strict';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  let pane, list, relF = 'all', q = '';
  const $ = s => pane.querySelector(s);
  window.OSA_TABS.osobnosti = {
    async init(p) { pane = p; pane.innerHTML = '<p class="muted">Načítám…</p>'; list = await fetch('data/osobnosti.json').then(r => r.json()); build(); draw(); },
    show() {}, hide() {},
  };
  const rel = id => OSA.relById[id] || { name: id, color: '#666' };
  function build() {
    const ids = [...new Set(list.map(p => p.r))];
    pane.innerHTML = `<div class="tools"><div class="tool-row scrollrow"><div id="p-chips" class="chips"><button type="button" class="chip" data-r="all" aria-pressed="true">Všechna (${list.length})</button>${ids.map(id => `<button type="button" class="chip rel" data-r="${id}" style="--c:${rel(id).color}" aria-pressed="false">${esc(rel(id).name)}</button>`).join('')}</div></div>
      <div class="tool-row find"><input id="p-q" type="search" placeholder="Hledat osobnost…" aria-label="Hledat osobnost" autocomplete="off"></div></div>
      <div id="p-list" class="p-list"></div>`;
    $('#p-chips').addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (!b) return; relF = b.dataset.r; $('#p-chips').querySelectorAll('[data-r]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); draw(); });
    $('#p-q').addEventListener('input', e => { q = norm(e.target.value.trim()); draw(); });
    $('#p-list').addEventListener('click', e => { const b = e.target.closest('[data-ev]'); if (b) OSA.showEvent(b.dataset.ev); });
  }
  function draw() {
    const items = list.filter(p => (relF === 'all' || p.r === relF) && (!q || norm(`${p.n} ${p.role} ${p.t}`).includes(q)));
    $('#p-list').innerHTML = items.length ? items.map(p => {
      const r = rel(p.r), evs = p.ev.map(id => OSA.events.find(e => e.id === id)).filter(Boolean);
      return `<article class="p-card" style="--c:${r.color}"><header><h3>${esc(p.n)}</h3><span class="tag rel">${esc(r.name)}</span></header>
        <p class="p-d">${esc(p.d)} · ${esc(p.role)}</p><p>${esc(p.t)}</p>
        ${evs.length ? `<div class="p-ev"><b>Na ose:</b> ${evs.map(e => `<button type="button" class="lnk" data-ev="${e.id}">${esc(OSA.span(e))}: ${esc(e.t)}</button>`).join('')}</div>` : ''}</article>`;
    }).join('') : '<p class="muted">Nikdo takový tu není.</p>';
  }
})();
