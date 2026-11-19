/* Kalendář svátků: pohyblivé svátky se počítají (Velikonoce, židovský a islámský kalendář), ostatní jsou pevné nebo přibližné. */
(() => {
  'use strict';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let pane, items, year = new Date().getFullYear(), on = new Set();
  const $ = s => pane.querySelector(s);
  window.OSA_TABS.svatky = {
    async init(p) { pane = p; pane.innerHTML = '<p class="muted">Načítám…</p>'; items = (await fetch('data/svatky.json').then(r => r.json())).items; on = new Set(items.map(i => i.r)); build(); draw(); },
    show() {}, hide() {},
  };
  const rel = id => OSA.relById[id] || { name: id, color: '#666' };
  const D = (y, m, d) => new Date(y, m - 1, d, 12);
  const addDays = (dt, n) => { const x = new Date(dt); x.setDate(x.getDate() + n); return x; };

  function easter(y) {                                   // západní Velikonoce (Meeus, Jones, Butcher)
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1; return D(y, mo, da);
  }
  function orthoEaster(y) {                              // pravoslavné Velikonoce: juliánský výpočet + 13 dní (platí pro roky 1900 až 2099)
    const a = y % 4, b = y % 7, c = y % 19, d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7, mo = Math.floor((d + e + 114) / 31), da = ((d + e + 114) % 31) + 1;
    return addDays(D(y, mo, da), 13);
  }
  function advent(y) { let d = D(y, 12, 24); while (d.getDay() !== 0) d = addDays(d, -1); return addDays(d, -21); }
  const calCache = {};
  function scan(cal, y) {                                // projde dny roku a zapíše, kdy nastává daný den kalendáře
    const key = cal + y; if (calCache[key]) return calCache[key];
    const opt = cal === 'hebrew' ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'numeric' };
    const f = new Intl.DateTimeFormat('en-u-ca-' + cal, opt), map = new Map();
    for (let d = D(y, 1, 1); d.getFullYear() === y; d = addDays(d, 1)) {
      const p = f.formatToParts(d), m = p.find(x => x.type === 'month').value, dd = p.find(x => x.type === 'day').value, k = m + '/' + dd;
      if (!map.has(k)) map.set(k, []); map.get(k).push(new Date(d));
    }
    return calCache[key] = map;
  }
  function datesOf(it, y) {
    const r = it.rule;
    switch (r.type) {
      case 'fixed': return [D(y, r.m, r.d)];
      case 'easter': return [addDays(easter(y), r.off)];
      case 'orthoeaster': return [addDays(orthoEaster(y), r.off)];
      case 'advent': return [advent(y)];
      case 'table': return r.t[y] ? [D(y, +r.t[y].slice(0, 2), +r.t[y].slice(3))] : [];
      case 'islamic': try { return scan('islamic-umalqura', y).get(r.m + '/' + r.d) || []; } catch { return []; }
      case 'hebrew': {
        try { const m = scan('hebrew', y); if (r.m === 'Adar') return [...(m.get('Adar II/' + r.d) || []), ...(m.get('Adar/' + r.d) || [])]; return m.get(r.m + '/' + r.d) || []; } catch { return []; }
      }
      default: return [];
    }
  }
  const fmt = (d, o = { day: 'numeric', month: 'long' }) => d.toLocaleDateString('cs-CZ', o);

  function build() {
    const ids = [...new Set(items.map(i => i.r))];
    pane.innerHTML = `<div class="sv-year"><button id="s-prev" class="btn small" type="button" aria-label="Předchozí rok">◀</button><b id="s-y"></b><button id="s-next" class="btn small" type="button" aria-label="Další rok">▶</button><button id="s-now" class="btn small" type="button">Letos</button></div>
      <div class="tools"><div class="tool-row scrollrow"><div id="s-chips" class="chips">${ids.map(id => `<button type="button" class="chip rel" data-r="${id}" style="--c:${rel(id).color}" aria-pressed="true">${esc(rel(id).name)}</button>`).join('')}</div></div></div>
      <div id="s-next-card"></div><div id="s-list"></div>
      <p class="muted small">Židovské a islámské svátky se počítají z jejich kalendářů, islámské se mohou lišit o den podle pozorování měsíce. Židovské svátky začínají večer předchozího dne. U buddhistických a hinduistických svátků řízených lunárním kalendářem je uveden jen přibližný měsíc, případně datum podle kalendáře (Dívalí, Holi).</p>`;
    $('#s-prev').onclick = () => { year--; draw(); }; $('#s-next').onclick = () => { year++; draw(); }; $('#s-now').onclick = () => { year = new Date().getFullYear(); draw(); };
    $('#s-chips').addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (!b) return; const id = b.dataset.r; on.has(id) ? on.delete(id) : on.add(id); b.setAttribute('aria-pressed', String(on.has(id))); draw(); });
    $('#s-list').addEventListener('click', e => { const b = e.target.closest('[data-more]'); if (b) { const t = b.nextElementSibling; t.hidden = !t.hidden; b.setAttribute('aria-expanded', String(!t.hidden)); } });
  }
  function draw() {
    $('#s-y').textContent = year;
    const rows = [];
    for (const it of items) {
      if (!on.has(it.r)) continue;
      if (it.rule.type === 'approx') { rows.push({ it, month: it.rule.month - 1, approx: true, sort: it.rule.month * 40 }); continue; }
      const ds = datesOf(it, year);
      if (!ds.length) { rows.push({ it, month: -1, none: true, sort: 9999 }); continue; }
      for (const d of ds) rows.push({ it, d, month: d.getMonth(), sort: d.getMonth() * 40 + d.getDate() });
    }
    rows.sort((a, b) => a.sort - b.sort);
    // nejbližší svátek
    const today = new Date(), todayIso = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
    const nxt = year === today.getFullYear() ? rows.find(r => r.d && addDays(r.d, r.it.dur - 1) >= todayIso) : null;
    $('#s-next-card').innerHTML = nxt ? `<div class="sv-next" style="--c:${rel(nxt.it.r).color}"><span>Nejbližší svátek</span><b>${esc(nxt.it.n)}</b> · ${esc(fmt(nxt.d, { weekday: 'long', day: 'numeric', month: 'long' }))} <small>(${esc(rel(nxt.it.r).name)})</small></div>` : '';
    let month = -2, html = '';
    for (const r of rows) {
      const m = r.month;
      if (m !== month) { month = m; html += `<h3 class="sv-month">${m >= 0 ? esc(new Date(year, m, 1).toLocaleDateString('cs-CZ', { month: 'long' })) : 'Bez data v tomto roce'}</h3>`; }
      const when = r.approx ? `přibližně: ${esc(r.it.rule.note)}` : r.none ? 'tento rok mimo kalendář' : (r.it.dur > 1 ? `${esc(fmt(r.d))} až ${esc(fmt(addDays(r.d, r.it.dur - 1)))}` : esc(fmt(r.d, { weekday: 'short', day: 'numeric', month: 'long' })));
      const jewish = r.it.rule.type === 'hebrew' ? '<span class="sv-note">začíná večer před</span>' : '';
      html += `<div class="sv-item" style="--c:${rel(r.it.r).color}"><button type="button" class="sv-head" data-more="1" aria-expanded="false"><span class="sv-dot"></span><span class="sv-n"><b>${esc(r.it.n)}</b><small>${esc(rel(r.it.r).name)}</small></span><span class="sv-d">${when}${jewish}</span></button><div class="sv-t" hidden>${esc(r.it.t)}</div></div>`;
    }
    $('#s-list').innerHTML = html || '<p class="muted">Žádné svátky podle filtru.</p>';
  }
})();
