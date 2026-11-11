/* Registrace service workeru a tlačítko pro instalaci aplikace do telefonu. */
(() => {
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  const btn = document.getElementById('install'); if (!btn) return;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  let evt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); evt = e; if (!standalone) btn.hidden = false; });
  window.addEventListener('appinstalled', () => { btn.hidden = true; evt = null; });
  if (!standalone && /iphone|ipad|ipod/i.test(navigator.userAgent)) { btn.hidden = false; btn.textContent = '⬇ Přidat na plochu'; }
  btn.onclick = async () => {
    if (evt) { evt.prompt(); await evt.userChoice.catch(() => {}); evt = null; btn.hidden = true; }
    else alert('Na iPhonu: klepni na tlačítko Sdílet (čtverec se šipkou) a vyber „Přidat na plochu“.');
  };
})();
