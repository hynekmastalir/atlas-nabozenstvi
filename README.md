# Časová osa náboženství

Zoomovací časová osa křesťanství, islámu, buddhismu, judaismu a hinduismu s konkrétními letopočty, filtry, popisem událostí a vlastními materiály. Statická stránka bez build kroku, instalovatelná jako aplikace (PWA).

Adresa po nasazení: `https://hynekmastalir.github.io/atlas-nabozenstvi/`

## Soubory

- `index.html`, `css/osa.css`, `js/osa.js`: aplikace
- `data/udalosti.json`: náboženství, druhy událostí, období a všechny události
- `manifest.webmanifest`, `sw.js`, `js/pwa.js`, `icons/`: instalace a offline provoz
- `.github/workflows/deploy.yml`: nasazení na GitHub Pages (Settings, Pages, Source = GitHub Actions)

## Kam se ukládají vlastní události

Tlačítkem „＋ Událost“ přidaná událost nebo náboženství se uloží **jen do prohlížeče**, ve kterém ji vytvoříš:

- úložiště `localStorage`, klíč `osa:custom` (vlastní události a náboženství), klíč `osa:filters` (poslední filtry),
- nejde na server ani do repozitáře a nikdo jiný ji neuvidí,
- přežije zavření stránky i restart, ale zmizí při smazání dat stránek, odinstalování aplikace nebo v anonymním okně,
- limit je zhruba 5 MB a v aplikaci je nejvýše 500 vlastních událostí.

Zálohu a přenos mezi zařízeními zajišťuje část „Moje materiály“ (Export a Import do souboru JSON). Aby se událost zobrazila všem návštěvníkům, vlož její záznam z exportu do `data/udalosti.json` (pole `events`, případně `religions`) a nahraj do větve `main`. Stránka se sama znovu nasadí.

Záznam události: `{ "id": "…", "r": "krestanstvi", "y": 1415, "c": "zaklad", "t": "Název", "x": "Popis", "s": "https://zdroj", "i": "https://obrázek" }`. Volitelně `e` (konec, rok) a `ap: 1` (přibližný rok). Roky před naším letopočtem jsou záporné.

Lokálně: `python3 -m http.server` a otevři `http://localhost:8000`.
