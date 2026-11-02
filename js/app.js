/* Atlas náboženství – čistý JavaScript bez knihoven a bez build kroku.
   Data se načítají z data/index.json a data/religions/*.json. */
(() => {
'use strict';

/* ---------- pomocné funkce ---------- */
const NS = 'http://www.w3.org/2000/svg';
const $ = (sel, root = document) => root.querySelector(sel);

function fill(node, attrs, kids) {
  for (const k in attrs || {}) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') node.setAttribute('class', v);
    else if (k === 'style') node.style.cssText = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}
const h = (tag, attrs, ...kids) => fill(document.createElement(tag), attrs, kids);
const s = (tag, attrs, ...kids) => fill(document.createElementNS(NS, tag), attrs, kids);

/* Povolí jen http(s) odkazy a relativní cesty. Cokoli jiného (např. javascript:) se zahodí. */
function safeUrl(u) {
  if (typeof u !== 'string' || !u.trim()) return null;
  try {
    const x = new URL(u, location.href);
    return /^https?:$/.test(x.protocol) ? x.href : null;
  } catch { return null; }
}
const fmt = v => String(Math.round(v * 10) / 10).replace('.', ',');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

async function getJson(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(url + ': HTTP ' + r.status);
  try { return await r.json(); }
  catch (e) { throw new Error(url + ': neplatný JSON (' + e.message + ')'); }
}

/* ---------- ikony ---------- */
const ICONS = {
  cross: '<path d="M10 2h4v7h7v4h-7v9h-4v-9H3V9h7z"/>',
  crescent: '<path d="M15 3a9 9 0 1 0 6 15 7 7 0 0 1-6-15z"/>',
  star: '<path d="M12 3l8.7 15H3.3zM12 21L3.3 6h17.4z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>',
  wheel: '<g fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 4v16M4 12h16M6.3 6.3l11.4 11.4M17.7 6.3L6.3 17.7"/></g>',
  lotus: '<path d="M12 3c2.5 3 2.5 8 0 12-2.5-4-2.5-9 0-12zM4 8c4 0 7 3 8 7-4 0-7-3-8-7zM20 8c-4 0-7 3-8 7 4 0 7-3 8-7zM3 16c3 0 6 1 9 5-4 0-7-1-9-5zM21 16c-3 0-6 1-9 5 4 0 7-1 9-5z"/>',
  dot: '<circle cx="12" cy="12" r="5"/>'
};
function iconNode(name) {
  const url = typeof name === 'string' && /[./]/.test(name) ? safeUrl(name) : null;
  if (url) return h('img', { src: url, alt: '', width: 14, height: 14 });
  const svg = s('svg', { viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': 'true' });
  svg.innerHTML = ICONS[name] || ICONS.dot;
  return svg;
}
const UI = {
  play: '<path d="M7 4l13 8-13 8z"/>',
  pause: '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5" />',
  pin: '<path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  close: '<path d="M5 5l14 14M19 5L5 19"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
};
function ui(name, extra = {}) {
  const svg = s('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', ...extra });
  svg.innerHTML = UI[name];
  return svg;
}

/* ---------- stav ---------- */
const state = { era: 2, view: 'zones', active: new Set(), playing: false };
let DATA = null;          // { base, world, rels, places }
const refs = {};          // odkazy na prvky UI
let timer = null;
const PLAY_MS = 2500;

/* ---------- načtení a normalizace dat ---------- */
function normalizeReligion(raw, nEras, file) {
  if (!raw || typeof raw !== 'object') throw new Error(file + ': soubor není objekt');
  const id = String(raw.id || file.replace(/\.json$/, ''));
  const share = Array.from({ length: nEras }, (_, i) => Number(raw.share && raw.share[i]) || 0);
  const zones = {};
  for (const k in raw.zones || {}) zones[Number(k)] = Array.isArray(raw.zones[k]) ? raw.zones[k] : [];
  return {
    id, name: String(raw.name || id), color: /^#[0-9a-f]{3,8}$/i.test(raw.color) ? raw.color : '#ff5fa8',
    icon: raw.icon || 'dot', share, zones,
    places: Array.isArray(raw.places) ? raw.places : [],
    events: Array.isArray(raw.events) ? raw.events : []
  };
}

function mergePlaces(rels) {
  const map = new Map();
  for (const r of rels) {
    for (const p of r.places) {
      if (p.id == null || typeof p.lat !== 'number' || typeof p.lon !== 'number') continue;
      const cur = map.get(p.id);
      if (!cur) {
        map.set(p.id, { ...p, era: Number(p.era) || 0, rels: [r.id] });
      } else {
        if (!cur.rels.includes(r.id)) cur.rels.push(r.id);
        cur.era = Math.min(cur.era, Number(p.era) || 0);
        for (const f of ['text', 'fact', 'source', 'image']) if (!cur[f] && p[f]) cur[f] = p[f];
      }
    }
  }
  return [...map.values()];
}

async function loadAll() {
  const base = await getJson('data/index.json');
  const nEras = base.eras.length;
  const [world, results] = await Promise.all([
    getJson('data/world.json'),
    Promise.allSettled(base.religions.map(f => getJson('data/religions/' + f).then(r => normalizeReligion(r, nEras, f))))
  ]);
  const problems = [];
  const rels = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') rels.push(r.value);
    else problems.push(base.religions[i] + ': ' + r.reason.message);
  });
  const seen = new Set();
  for (const r of rels) { if (seen.has(r.id)) problems.push('Duplicitní id náboženství: ' + r.id); seen.add(r.id); }
  return { base, world, rels, places: mergePlaces(rels), problems };
}

/* ---------- pomocné výpočty ---------- */
const relById = id => DATA.rels.find(r => r.id === id);
function zoneFor(rel, era) {
  for (let i = era; i >= 0; i--) if (rel.zones[i]) return rel.zones[i];
  return [];
}
const proj = (lon, lat) => [(lon + 180) * 1000 / 360, (90 - lat) * 500 / 180];

/* ---------- sestavení UI ---------- */
function build() {
  const { base, rels } = DATA;
  const app = $('#app');
  app.replaceChildren();
  app.removeAttribute('aria-busy');
  if (DATA.problems.length) {
    app.append(h('div', { class: 'card pad error', role: 'alert' },
      h('strong', {}, 'Některé soubory se nepodařilo načíst:'),
      h('ul', {}, DATA.problems.map(p => h('li', {}, p)))));
  }
  refs.timeline = buildTimeline();
  refs.mapCard = buildMap();
  refs.filters = buildFilters();
  refs.event = h('section', { class: 'card pad event g-event', 'aria-live': 'polite', 'aria-label': 'Událost éry' });
  refs.chart = buildChart();
  app.append(
    refs.timeline,
    h('div', { class: 'grid' }, refs.mapCard, refs.filters, refs.event, refs.chart));
}

function buildTimeline() {
  const eras = DATA.base.eras, n = eras.length;
  refs.playBtn = h('button', { class: 'play', id: 'play-btn', type: 'button', onclick: togglePlay });
  refs.eraLabel = h('strong', { 'aria-live': 'polite' });
  refs.slider = h('input', {
    type: 'range', id: 'era-slider', min: 0, max: n - 1, step: 1, value: state.era,
    'aria-label': 'Zvolená éra', oninput: e => setEra(+e.target.value)
  });
  refs.ticks = eras.map((e, i) => h('button', {
    class: 'tick', type: 'button', onclick: () => setEra(i),
    style: `left:calc(${i / (n - 1) * 100}% + ${(0.5 - i / (n - 1)) * 22}px)`
  }, h('b', {}, e.a), h('span', {}, e.b)));
  return h('section', { class: 'card timeline', 'aria-label': 'Časová osa' },
    h('div', { class: 'tl-top' }, refs.playBtn,
      h('div', { class: 'era-now' }, h('span', { class: 'eyebrow' }, 'Zvolená éra'), refs.eraLabel)),
    h('div', { class: 'slider-wrap' }, refs.slider, h('div', { class: 'ticks' }, refs.ticks)));
}

function buildMap() {
  const { world, places } = DATA;
  const svg = s('svg', { class: 'map', viewBox: '0 20 1000 390', role: 'img', 'aria-label': 'Mapa světa' });
  const defs = s('defs');
  const grat = s('g', { class: 'graticule' });
  for (let lon = -150; lon <= 180; lon += 30) { const x = proj(lon, 0)[0]; grat.append(s('line', { x1: x, y1: 20, x2: x, y2: 410 })); }
  for (let lat = -60; lat <= 60; lat += 30) { const y = proj(0, lat)[1]; grat.append(s('line', { x1: 0, y1: y, x2: 1000, y2: y })); }
  const land = s('g');
  refs.paths = new Map();
  for (const code in world.countries) {
    const c = world.countries[code];
    const title = s('title');
    const p = s('path', { class: 'land', d: c.d, 'data-code': code }, title);
    refs.paths.set(code, { p, title, name: c.n });
    land.append(p);
  }
  refs.defs = defs; refs.patterns = new Map();
  const pins = s('g');
  refs.pins = places.map(pl => {
    const [x, y] = proj(pl.lon, pl.lat);
    const inner = s('g', { class: 'pin', tabindex: 0, role: 'button', 'aria-label': pl.name,
      onclick: () => openPlace(pl),
      onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPlace(pl); } } });
    const ring = s('circle', { class: 'ring', r: 9 });
    const dot = s('circle', { class: 'dotc', r: 9 });
    const core = s('circle', { r: 3, fill: '#1d1b38' });
    const hit = s('circle', { r: 18, fill: 'transparent' });
    const label = s('text', { x: 14, y: 4 }, pl.name);
    inner.append(ring, dot, core, hit, label);
    const wrap = s('g', { class: 'pin-wrap', transform: `translate(${x},${y})` }, inner);
    pins.append(wrap);
    return { pl, wrap, inner, ring, dot, label };
  });
  svg.append(defs, s('rect', { x: 0, y: 20, width: 1000, height: 390, fill: 'var(--sea)' }), grat, land, pins);
  refs.svg = svg;

  refs.btnZones = h('button', { type: 'button', id: 'view-zones', 'aria-pressed': 'true', onclick: () => setView('zones') }, ui('layers'), 'Zóny vlivu');
  refs.btnPlaces = h('button', { type: 'button', id: 'view-places', 'aria-pressed': 'false', onclick: () => setView('places') }, ui('pin'), 'Posvátná místa');
  refs.badge = h('div', { class: 'map-badge' });
  refs.mapNote = h('p', { class: 'map-note' });
  const bar = h('div', { class: 'map-bar' },
    h('div', { class: 'view-toggle', role: 'group', 'aria-label': 'Režim pohledu' }, refs.btnZones, refs.btnPlaces), refs.badge);
  const box = h('div', { class: 'map-box map-scroll' }, svg);
  if ('ResizeObserver' in window) new ResizeObserver(scalePins).observe(svg); else addEventListener('resize', scalePins);
  refs.box = box;
  return h('section', { class: 'card map-card g-map', 'aria-label': 'Mapa světa' }, bar, box, refs.mapNote);
}

function scalePins() {
  const w = refs.svg.getBoundingClientRect().width || 700, k = 1000 / w;
  for (const o of refs.pins) {
    o.inner.style.transform = `scale(${k})`;
    o.label.style.display = w >= 640 ? '' : 'none';
  }
}

function buildFilters() {
  refs.chips = DATA.rels.map(r => {
    const pct = h('span', { class: 'pct tabnum' });
    const b = h('button', { class: 'chip', type: 'button', 'data-id': r.id, style: `--c:${r.color}`,
      onclick: () => toggleRel(r.id) },
      h('span', { class: 'ico' }, iconNode(r.icon)), r.name, pct);
    return { r, b, pct };
  });
  refs.allBtn = h('button', { class: 'link-btn', type: 'button', onclick: toggleAll });
  return h('section', { class: 'card pad g-filters', 'aria-label': 'Filtr náboženství' },
    h('div', { class: 'filters-head' }, h('h2', { class: 'eyebrow' }, 'Filtr náboženství'), refs.allBtn),
    h('div', { class: 'chips' }, refs.chips.map(c => c.b)));
}

function buildChart() {
  const R = 56, C = 2 * Math.PI * R;
  refs.C = C;
  const g = s('g', { transform: 'rotate(-90 80 80)' },
    s('circle', { cx: 80, cy: 80, r: R, fill: 'none', stroke: 'rgba(255,255,255,.1)', 'stroke-width': 22 }));
  refs.segs = [...DATA.rels, { id: '_other', color: '#7d779f' }].map(r => {
    const c = s('circle', { class: 'seg', cx: 80, cy: 80, r: R, fill: 'none', stroke: r.color, 'stroke-width': 22, 'stroke-dasharray': `0 ${C}` });
    g.append(c); return c;
  });
  refs.donutVal = s('text', { x: 80, y: 82, 'text-anchor': 'middle', fill: '#fff', 'font-size': 20, 'font-weight': 800, class: 'tabnum' });
  const sub = s('text', { x: 80, y: 98, 'text-anchor': 'middle', fill: '#b5afd6', 'font-size': 9, 'font-weight': 600 }, 'vybraná vyznání');
  const donut = s('svg', { class: 'donut', viewBox: '0 0 160 160', role: 'img', 'aria-label': 'Koláčový graf zastoupení náboženství' }, g, refs.donutVal, sub);
  refs.bars = [...DATA.rels, { id: '_other', name: 'Ostatní a bez vyznání', color: '#7d779f' }].map(r => {
    const v = h('span', { class: 'v tabnum' });
    const f = h('div', { class: 'fillbar', style: `background:${r.color}` });
    const row = h('li', { class: 'bar' },
      h('div', { class: 'bar-top' }, h('span', { class: 'name' }, h('i', { class: 'dot', style: `background:${r.color}` }), r.name), v),
      h('div', { class: 'track' }, f));
    return { r, v, f, row };
  });
  refs.chartEra = h('p', { class: 'muted', style: 'font-size:12px;margin-top:4px' });
  return h('section', { class: 'card pad g-chart', 'aria-label': 'Zastoupení náboženství' },
    h('h2', { class: 'eyebrow' }, 'Podíl na světové populaci'), refs.chartEra,
    h('div', { class: 'chart-row' }, donut, h('ul', { class: 'bars' }, refs.bars.map(b => b.row))),
    h('p', { class: 'chart-note' }, 'Šířka sloupců se řídí největším podílem (nejméně 40 %). Hodnoty před 20. stoletím jsou hrubé odhady.'));
}

/* ---------- aktualizace ---------- */
function updateAll() {
  const { base, rels } = DATA, era = base.eras[state.era], n = base.eras.length;
  // časová osa
  refs.slider.value = state.era;
  refs.slider.style.setProperty('--p', state.era / (n - 1) * 100 + '%');
  refs.slider.setAttribute('aria-valuetext', era.label);
  refs.eraLabel.textContent = era.label;
  refs.ticks.forEach((t, i) => t.setAttribute('aria-current', i === state.era));
  refs.playBtn.replaceChildren(ui('', {}), state.playing ? 'Pozastavit' : 'Přehrát');
  refs.playBtn.firstChild.innerHTML = state.playing ? UI.pause : UI.play;
  refs.playBtn.setAttribute('aria-pressed', state.playing);
  // přepínač režimu
  const zones = state.view === 'zones';
  refs.btnZones.setAttribute('aria-pressed', zones);
  refs.btnPlaces.setAttribute('aria-pressed', !zones);
  updateMap(zones);
  // filtr
  refs.chips.forEach(({ r, b, pct }) => {
    b.setAttribute('aria-pressed', state.active.has(r.id));
    const v = r.share[state.era];
    pct.textContent = v > 0 ? fmt(v) + ' %' : '–';
  });
  refs.allBtn.textContent = state.active.size === rels.length ? 'Vypnout vše' : 'Zapnout vše';
  updateEvent();
  updateChart();
}

function patternFor(list) {
  const key = list.map(r => r.id).sort().join('|');
  if (refs.patterns.has(key)) return refs.patterns.get(key);
  const id = 'pat' + refs.patterns.size, w = 10, sw = w / list.length;
  const pat = s('pattern', { id, width: w, height: w, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
    list.map((r, i) => s('rect', { x: i * sw, y: 0, width: sw + .2, height: w, fill: r.color })));
  refs.defs.append(pat);
  refs.patterns.set(key, id);
  return id;
}

const warned = new Set();
function updateMap(zones) {
  const byC = new Map();
  for (const r of DATA.rels) {
    if (!state.active.has(r.id)) continue;
    for (const c of zoneFor(r, state.era)) {
      if (!refs.paths.has(c)) { if (!warned.has(c)) { warned.add(c); console.warn('Neznámý kód země v zónách:', c, '(' + r.id + ')'); } continue; }
      if (!byC.has(c)) byC.set(c, []);
      byC.get(c).push(r);
    }
  }
  for (const [code, o] of refs.paths) {
    const list = byC.get(code);
    if (!list) {
      o.p.style.fill = ''; o.p.style.fillOpacity = ''; o.p.classList.remove('on');
      o.title.textContent = o.name;
    } else {
      o.p.style.fill = list.length === 1 ? list[0].color : `url(#${patternFor(list)})`;
      o.p.style.fillOpacity = zones ? .92 : .28;
      o.p.classList.toggle('on', zones);
      o.title.textContent = o.name + ': ' + list.map(r => r.name).join(', ');
    }
  }
  let shown = 0;
  for (const o of refs.pins) {
    const act = o.pl.rels.map(relById).filter(r => r && state.active.has(r.id));
    const vis = !zones && o.pl.era <= state.era && act.length > 0;
    if (vis) shown++;
    const col = (act[0] || relById(o.pl.rels[0]) || { color: '#ff5fa8' }).color;
    o.ring.setAttribute('fill', col); o.dot.setAttribute('fill', col);
    o.wrap.style.opacity = vis ? 1 : 0;
    o.wrap.style.pointerEvents = vis ? 'auto' : 'none';
    o.inner.setAttribute('tabindex', vis ? 0 : -1);
    o.inner.setAttribute('aria-hidden', !vis);
  }
  refs.badge.replaceChildren(h('span', { class: 'muted' }, 'Stav v době: '), h('strong', {}, DATA.base.eras[state.era].label),
    zones ? '' : h('span', { class: 'muted' }, ` · míst: ${shown}/${refs.pins.length}`));
  refs.mapNote.textContent = zones
    ? 'Barevné plochy ukazují státy, kde dané náboženství v éře převládalo nebo mělo významnou obec. Pruhované plochy značí více náboženství.'
    : shown > 0 ? 'Klepněte na pin a zobrazí se historie místa.'
    : 'V této éře ještě nejsou doložena žádná z vybraných posvátných míst. Posuňte časovou osu dál.';
}

function updateEvent() {
  const ev = DATA.base.eras[state.era];
  const extra = [];
  for (const r of DATA.rels) {
    if (!state.active.has(r.id)) continue;
    for (const e of r.events) if (Number(e.era) === state.era) extra.push({ r, e });
  }
  const card = h('div', { class: 'fade' },
    h('span', { class: 'tag' }, ui('clock', { width: 13, height: 13, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }), ev.tag),
    h('h2', {}, ev.title),
    h('p', { class: 'date tabnum' }, ev.date),
    h('p', { class: 'body' }, ev.text),
    ev.more && ev.more.length ? h('ul', { class: 'more' }, ev.more.map(m => h('li', {}, m))) : null,
    h('div', { class: 'rel-events' },
      h('h3', { class: 'eyebrow' }, 'Z vybraných náboženství'),
      extra.length ? extra.map(({ r, e }) => {
        const src = safeUrl(e.source), img = safeUrl(e.image);
        return h('div', { class: 'rel-ev' },
          h('span', { class: 'dot', style: `background:${r.color}` }),
          h('div', {}, h('h3', {}, e.title), h('div', { class: 'd tabnum' }, r.name + (e.date ? ' · ' + e.date : ''))),
          e.text ? h('p', {}, e.text) : null,
          img ? h('img', { src: img, alt: '', loading: 'lazy', onerror: ev => ev.target.remove() }) : null,
          src ? h('p', {}, h('a', { href: src, target: '_blank', rel: 'noopener noreferrer' }, 'Zdroj ↗')) : null);
      }) : h('p', { class: 'muted', style: 'font-size:13px' }, 'Pro tuto éru zatím nejsou u vybraných náboženství žádné události.')));
  refs.event.replaceChildren(card);
}

function updateChart() {
  const era = state.era, rels = DATA.rels;
  const totalAll = rels.reduce((a, r) => a + r.share[era], 0);
  const other = Math.max(0, 100 - totalAll);
  const vals = [...rels.map(r => state.active.has(r.id) ? r.share[era] : 0), other];
  const total = vals.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  vals.forEach((v, i) => {
    const len = v / total * refs.C;
    refs.segs[i].setAttribute('stroke-dasharray', `${Math.max(len - (v > 0 ? 1.5 : 0), 0)} ${refs.C}`);
    refs.segs[i].setAttribute('stroke-dashoffset', -acc);
    acc += len;
  });
  const sel = rels.reduce((a, r) => a + (state.active.has(r.id) ? r.share[era] : 0), 0);
  refs.donutVal.textContent = fmt(sel) + ' %';
  const scale = Math.max(40, ...rels.map(r => r.share[era]));
  refs.bars.forEach(({ r, v, f, row }, i) => {
    const on = r.id === '_other' ? true : state.active.has(r.id);
    const val = i < rels.length ? r.share[era] : other;
    row.classList.toggle('off', !on);
    v.textContent = !on ? 'skryto' : val > 0 ? fmt(val) + ' %' : '–';
    f.style.width = (on ? clamp(val / scale * 100, 0, 100) : 0) + '%';
  });
  refs.chartEra.textContent = DATA.base.eras[era].label;
}

/* ---------- akce ---------- */
function setEra(i) { state.era = clamp(i, 0, DATA.base.eras.length - 1); updateAll(); schedule(); }
function setView(v) { state.view = v; updateAll(); }
function toggleRel(id) { state.active.has(id) ? state.active.delete(id) : state.active.add(id); updateAll(); }
function toggleAll() {
  if (state.active.size === DATA.rels.length) state.active.clear();
  else DATA.rels.forEach(r => state.active.add(r.id));
  updateAll();
}
function togglePlay() { state.playing = !state.playing; updateAll(); schedule(); }
function schedule() {
  clearTimeout(timer);
  if (!state.playing || $('#modal').open) return;
  timer = setTimeout(() => setEra((state.era + 1) % DATA.base.eras.length), PLAY_MS);
}

/* ---------- modal ---------- */
function openPlace(pl) {
  const dlg = $('#modal');
  const rels = pl.rels.map(relById).filter(Boolean);
  const img = safeUrl(pl.image), src = safeUrl(pl.source);
  const close = () => dlg.close();
  const closeBtn = h('button', { class: 'm-close', type: 'button', 'aria-label': 'Zavřít', onclick: close }, ui('close'));
  dlg.replaceChildren(h('div', { class: 'm-body' },
    h('div', { class: 'm-head' },
      h('div', {},
        h('div', { class: 'm-tags' }, rels.map(r => h('span', {}, h('i', { style: `background:${r.color}` }), r.name))),
        h('h3', { id: 'modal-title' }, pl.name),
        h('p', { class: 'm-coord tabnum' }, `${Math.abs(pl.lat).toFixed(2)}° ${pl.lat >= 0 ? 's.' : 'j.'} š., ${Math.abs(pl.lon).toFixed(2)}° ${pl.lon >= 0 ? 'v.' : 'z.'} d.`)),
      closeBtn),
    img ? h('img', { class: 'm-img', src: img, alt: pl.name, onerror: e => e.target.remove() }) : null,
    h('p', { class: 'm-text' }, pl.text || 'Popis tohoto místa zatím chybí.'),
    pl.fact ? h('p', { class: 'm-fact' }, h('span', { class: 'eyebrow', style: 'display:block;margin-bottom:4px' }, 'Zajímavost'), pl.fact) : null,
    src ? h('a', { class: 'm-src', href: src, target: '_blank', rel: 'noopener noreferrer' }, 'Zdroj ↗') : null));
  clearTimeout(timer);
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  closeBtn.focus();
}

/* ---------- start ---------- */
async function init() {
  const dlg = $('#modal');
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', schedule);
  try {
    DATA = await loadAll();
  } catch (err) {
    $('#app').removeAttribute('aria-busy');
    $('#app').replaceChildren(h('div', { class: 'card error' },
      h('p', {}, 'Data se nepodařilo načíst.'),
      h('p', { class: 'muted' }, String(err.message)),
      h('p', { class: 'muted' }, location.protocol === 'file:'
        ? 'Stránka otevřená přímo ze souboru nemůže načítat JSON. Spusť ji přes GitHub Pages nebo lokální server (např. "python3 -m http.server").'
        : 'Zkontroluj, že soubory v adresáři data existují a obsahují platný JSON.')));
    return;
  }
  $('#title').textContent = DATA.base.title || 'Atlas náboženství';
  $('#subtitle').textContent = DATA.base.subtitle || '';
  document.title = DATA.base.title || document.title;
  DATA.rels.forEach(r => state.active.add(r.id));
  state.era = clamp(state.era, 0, DATA.base.eras.length - 1);
  build();
  scalePins();
  refs.box.scrollLeft = (refs.box.scrollWidth - refs.box.clientWidth) * 0.62;
  updateAll();
}
init();
})();
