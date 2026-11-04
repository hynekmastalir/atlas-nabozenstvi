# Atlas náboženství

Statická stránka bez build kroku. Funguje na GitHub Pages, data jsou v JSON.

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
| `share` | 6 čísel, podíl na světové populaci v % pro každou éru (pořadí jako `eras` v index.json). |
| `zones` | Klíč je číslo éry 0 až 5, hodnota je seznam kódů zemí ISO alfa-3 (např. `CZE`, `IND`). Když éra chybí, převezme se předchozí. Prázdný seznam `[]` zónu ukončí. |
| `places` | Posvátná místa: `id`, `name`, `lat`, `lon`, `era` (od které éry se zobrazí), `text`, `fact`, volitelně `source` (odkaz) a `image` (adresa fotky). |
| `events` | Události: `era`, `title`, `date`, `text`, volitelně `source` a `image`. |

Místo se stejným `id` ve více náboženstvích se na mapě sloučí do jednoho pinu s více barvami. Popis stačí uvést u jednoho z nich.

Fotky: dej soubor do složky `assets/` a do `image` napiš `assets/nazev.jpg`, nebo vlož celou https adresu.

## Éry

Šest milníků je v `data/index.json` v poli `eras`. Každá éra má titulek a hlavní událost, která se zobrazí v kartě události.

## Mapa

Obrysy zemí jsou v `data/world.json` (Natural Earth, 110m). Malé státy (Singapur, Mauricius, Vatikán a další) v ní nejsou, kód takové země se ignoruje a v konzoli se objeví varování.
Soubor vznikl skriptem `tools/build-world.mjs`.

## Barvy a vzhled

Všechny barvy jsou na začátku `css/style.css` v blocích `:root`.

## Kostra 3D

Ve složce `kostra/` je samostatná aplikace Kostra 3D (Vite + Three.js). Nasazuje se přes GitHub Actions společně s tímto atlasem
(viz `.github/workflows/deploy.yml`, v Settings, Pages nastav Source na „GitHub Actions“). Podrobnosti: `kostra/README.md`.
