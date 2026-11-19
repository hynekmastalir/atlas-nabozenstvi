/* Přepínání částí aplikace (osa, mapa, kvíz, porovnání, osobnosti, svátky) a odkazy v adrese (#mapa, #e=ID, #osa&v=…). */
(() => {
  'use strict';
  const TABS = ['osa', 'mapa', 'kviz', 'porovnani', 'osobnosti', 'svatky'];
  const mods = {}, loading = {};
  window.OSA_TABS = {};
  let cur = 'osa';

  const parse = () => {
    const o = {}; const raw = location.hash.replace(/^#/, ''); if (!raw) return o;
    raw.split('&').forEach((p, i) => { const [k, v] = p.split('='); if (v === undefined) { if (i === 0 && TABS.includes(k)) o.tab = k; } else o[k] = decodeURIComponent(v); });
    if (o.e && !o.tab) o.tab = 'osa';
    return o;
  };
  const setHash = h => { try { history.replaceState(null, '', location.pathname + location.search + h); } catch { /* ignoruj */ } };

  function loadScript(tab) {
    if (loading[tab]) return loading[tab];
    return loading[tab] = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = `js/${tab}.js`; s.onload = res; s.onerror = () => rej(new Error('nepodařilo se načíst část ' + tab)); document.head.appendChild(s);
    });
  }
  async function show(tab, { hash = true } = {}) {
    if (!TABS.includes(tab)) tab = 'osa';
    for (const t of TABS) document.querySelector('#pane-' + t).hidden = t !== tab;
    document.querySelectorAll('#nav [data-tab]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
    if (cur !== 'osa' && cur !== tab) window.OSA_TABS[cur]?.hide?.();
    cur = tab;
    if (tab === 'osa') { if (hash) setHash(OSA.selected ? '#e=' + OSA.selected : ''); return; }
    const pane = document.querySelector('#pane-' + tab);
    try {
      await loadScript(tab);
      const m = window.OSA_TABS[tab];
      if (!mods[tab]) { mods[tab] = true; m.init(pane); }
      m.show?.();
    } catch (err) { pane.innerHTML = `<p class="muted">${err.message}. Zkus stránku obnovit.</p>`; }
    if (hash) setHash('#' + tab);
  }
  function applyHash() {
    const h = parse();
    if (h.tab && h.tab !== 'osa') { show(h.tab, { hash: false }); return; }
    show('osa', { hash: false });
    if (h.e || h.v || h.r) {
      const st = { e: h.e, v: h.v ? h.v.split(',').map(Number) : null, r: h.r ? h.r.split('.') : null, c: h.c ? h.c.split('.') : null };
      OSA.applyState(st);
    }
  }

  document.addEventListener('osa-ready', () => {
    Object.assign(OSA, {
      go: show,
      showEvent: id => { show('osa'); OSA.select(id); },
    });
    OSA.onSelect = id => { if (cur === 'osa') setHash(id ? '#e=' + id : ''); };
    applyHash();
    window.addEventListener('hashchange', applyHash);
  });
  document.querySelector('#nav').addEventListener('click', e => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    if (!window.OSA?.ready) return; show(b.dataset.tab);
  });
})();
