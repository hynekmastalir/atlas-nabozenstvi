/* Sdílení a export: odkaz na událost nebo pohled, uložení osy jako obrázek, tisk do PDF. */
(() => {
  'use strict';
  const base = () => location.origin + location.pathname + location.search;
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* záložní způsob */ }
    const t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { /* nelze */ } t.remove(); return ok;
  }
  function viewLink() {
    const s = OSA.getState(), p = ['osa', 'v=' + s.v.join(','), 'r=' + s.r.join('.')];
    if (s.c.length) p.push('c=' + s.c.join('.'));
    if (s.e) p.push('e=' + s.e);
    return base() + '#' + p.join('&');
  }
  async function shareUrl(url, title, text) {
    if (navigator.share) { try { await navigator.share({ title, text, url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    OSA.toast((await copy(url)) ? 'Odkaz je zkopírovaný.' : 'Odkaz se nepodařilo zkopírovat: ' + url);
  }
  // uložení zobrazeného úseku osy jako PNG: styly textu se vloží přímo do SVG, protože SVG jako obrázek nezná styly stránky
  async function png() {
    const src = OSA.svg, W = OSA.W, H = OSA.H, pad = 46;
    const clone = src.cloneNode(true);
    const a = src.querySelectorAll('*'), b = clone.querySelectorAll('*');
    const props = ['fill', 'stroke', 'stroke-width', 'opacity', 'font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing', 'text-anchor'];
    a.forEach((el, i) => { const cs = getComputedStyle(el), o = b[i]; props.forEach(p => { const v = cs.getPropertyValue(p); if (v) o.style.setProperty(p, v); }); });
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); clone.setAttribute('width', W); clone.setAttribute('height', H + pad);
    clone.setAttribute('viewBox', `0 ${-pad} ${W} ${H + pad}`);
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); bg.setAttribute('x', 0); bg.setAttribute('y', -pad); bg.setAttribute('width', W); bg.setAttribute('height', H + pad); bg.setAttribute('fill', '#ecdcb0');
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'text'); title.setAttribute('x', 12); title.setAttribute('y', -16); title.setAttribute('font-size', 20); title.setAttribute('fill', '#2a1a08'); title.setAttribute('font-family', 'Georgia, serif');
    title.textContent = 'Časová osa náboženství'; 
    clone.insertBefore(title, clone.firstChild); clone.insertBefore(bg, clone.firstChild);
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
    const img = new Image(); img.decoding = 'async';
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('obrázek se nepodařilo vykreslit')); img.src = url; });
    const k = Math.min(2, 4096 / Math.max(W, H + pad)), c = document.createElement('canvas'); c.width = Math.round(W * k); c.height = Math.round((H + pad) * k);
    const g = c.getContext('2d'); g.scale(k, k); g.drawImage(img, 0, 0, W, H + pad);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    if (!blob) throw new Error('export se nezdařil');
    const file = new File([blob], 'casova-osa-nabozenstvi.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Časová osa náboženství' }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    const u = URL.createObjectURL(blob), l = document.createElement('a'); l.href = u; l.download = file.name; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 3000);
    OSA.toast('Obrázek je uložený (stažené soubory).');
  }

  document.addEventListener('osa-ready', () => {
    Object.assign(OSA, { copyText: copy, shareEvent: id => { const e = OSA.events.find(x => x.id === id); shareUrl(base() + '#e=' + id, e ? e.t : 'Časová osa náboženství', e ? `${OSA.span(e)}: ${e.t}` : ''); } });
    const btn = document.querySelector('#share-btn'), menu = document.querySelector('#share-menu');
    const close = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('click', e => { e.stopPropagation(); menu.hidden = !menu.hidden; btn.setAttribute('aria-expanded', String(!menu.hidden)); });
    document.addEventListener('click', e => { if (!menu.hidden && !menu.contains(e.target)) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    menu.addEventListener('click', async e => {
      const b = e.target.closest('[data-share]'); if (!b) return; close();
      if (b.dataset.share === 'link') shareUrl(viewLink(), 'Časová osa náboženství', 'Odkaz na tento pohled na časovou osu');
      else if (b.dataset.share === 'png') { try { await png(); } catch (err) { OSA.toast('Obrázek se nepodařilo vytvořit: ' + err.message); } }
      else if (b.dataset.share === 'print') window.print();
    });
    window.addEventListener('beforeprint', () => { document.querySelectorAll('details.list').forEach(d => { d.dataset.was = d.open; d.open = true; }); });
    window.addEventListener('afterprint', () => { document.querySelectorAll('details.list').forEach(d => { d.open = d.dataset.was === 'true'; }); });
  });
})();
