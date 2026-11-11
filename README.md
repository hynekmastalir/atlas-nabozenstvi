# Atlas náboženství

Statická stránka bez build kroku. Funguje na GitHub Pages, data jsou v JSON.

Nasazení: v Settings, Pages nastav Source na „GitHub Actions“ (workflow `.github/workflows/deploy.yml`).

## Nasazení na GitHub Pages

1. Vytvoř nový repozitář a nahraj do něj obsah této složky (index.html musí být v kořeni).
2. V repozitáři otevři Settings, pak Pages.
3. Source nastav na "Deploy from a branch", větev `main`, složka `/ (root)`.
4. Za minutu až dvě je stránka na `https://TVOJE-JMENO.github.io/NAZEV-REPOZITARE/`.

Lokálně: `python3 -m http.server` ve složce a otevři `http://localhost:8000`.
Přímé otevření index.html ze souboru nefunguje, prohlížeč blokuje načítání JSON.

## Přidání nového náboženství

1. Zkopíruj `data/religions/_sablona.json` na nový soubor, např. `data/religions/sikhismus.json`.
2. Vyplň ho (pole jsou níže).
3. Přidej jeho název do pole `religions` v `data/index.json`.
4. Nahraj změny na GitHub. Filtr, mapa, graf i události se doplní samy.

Když je v souboru chyba, stránka ostatní náboženství načte a nahoře vypíše, který soubor selhal.

## Pole v souboru náboženství

| Pole | Význam |
|---|---|
| `id` | Unikátní krátký název bez mezer. |
| `name` | Název ve filtru a v grafu. |
| `color` | Barva ve tvaru `#rrggbb`. |
| `icon` | `cross`, `crescent`, `star`, `wheel`, `lotus`, nebo adresa vlastního obrázku. |
| `share` | 12 čísel, podíl na světové populaci v % pro každou éru (pořadí jako `eras` v index.json). |
| `zones` | Klíč je číslo éry 0 až 11, hodnota je seznam kódů zemí ISO alfa-3 (např. `CZE`, `IND`). Když éra chybí, převezme se předchozí. Prázdný seznam `[]` zónu ukončí. |
| `places` | Posvátná místa: `id`, `name`, `lat`, `lon`, `era` (od které éry se zobrazí), `text`, `fact`, volitelně `source` (odkaz) a `image` (adresa fotky). |
| `events` | Události: `era`, `title`, `date`, `text`, volitelně `source` a `image`. |

Místo se stejným `id` ve více náboženstvích se na mapě sloučí do jednoho pinu s více barvami. Popis stačí uvést u jednoho z nich.

Fotky: dej soubor do složky `assets/` a do `image` napiš `assets/nazev.jpg`, nebo vlož celou https adresu.

## Éry

Dvanáct milníků je v `data/index.json` v poli `eras`. Každá éra má titulek a hlavní událost, která se zobrazí v kartě události.

## Mapa

Obrysy zemí jsou v `data/world.json` (Natural Earth, 110m). Malé státy (Singapur, Mauricius, Vatikán a další) v ní nejsou, kód takové země se ignoruje a v konzoli se objeví varování.
Soubor vznikl skriptem `tools/build-world.mjs`.

## Barvy a vzhled

Všechny barvy jsou na začátku `css/style.css` v blocích `:root`.

## Časová osa (druhá verze)

Ve složce `osa/` je samostatná verze s jednou zoomovací osou pro všechna náboženství a konkrétními letopočty. Původní atlas zůstává beze změny.
Běží na `/osa/` (např. `https://TVOJE-JMENO.github.io/NAZEV-REPOZITARE/osa/`), lokálně `python3 -m http.server` a otevři `/osa/`.

### Data

Události jsou v `osa/data/udalosti.json`: `r` (id náboženství), `y` (rok, před naším letopočtem záporně), volitelně `e` (konec období), `ap` (1 = přibližný rok),
`c` (druh), `t` (název), `x` (krátký popis), `d` (podrobný text, volitelný), `s` (odkaz na zdroj), `i` (odkaz na obrázek). Náboženství, druhy a historická období jsou na začátku téhož souboru.

### Vlastní materiály přímo na stránce

Tlačítko **Přidat událost** (nebo dvojklik do dráhy na ose) otevře formulář: náboženství (i nové s vlastní barvou a ikonou), rok a letopočet, případný konec a „kolem“,
druh, název, popis, odkaz na zdroj a obrázek. Událost se hned objeví na ose. Dá se upravit i smazat.
Vlastní data se ukládají do `localStorage` v prohlížeči, nejsou na serveru. Panel **Moje materiály** je umí exportovat do JSON souboru a zpět importovat.
Aby byly události trvale vidět všem, vlož záznamy z exportu do polí `events` a `religions` v `osa/data/udalosti.json`.

### Instalace do telefonu (PWA)

Časovou osu lze nainstalovat jako aplikaci a po první návštěvě běží i bez internetu. Android (Chrome): tlačítko **Instalovat aplikaci** nebo menu „Přidat na plochu“. iPhone (Safari): **Sdílet, Přidat na plochu**.
Service worker je v `osa/sw.js`. Přidáš-li do `osa/` nový soubor, který má fungovat offline hned po první návštěvě, přidej ho do seznamu `PRECACHE` a zvyš `VERSION`.
