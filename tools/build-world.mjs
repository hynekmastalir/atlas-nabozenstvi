// Generuje data/world.json (obrysy zemí + české názvy). Spouští se jen při změně mapy:
//   npm i world-atlas@2 topojson-client d3-geo i18n-iso-countries && node tools/build-world.mjs
import {readFileSync,writeFileSync} from 'fs';
import {feature} from 'topojson-client';
import {geoEquirectangular,geoPath} from 'd3-geo';
import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const iso=require('i18n-iso-countries');
iso.registerLocale(require('i18n-iso-countries/langs/cs.json'));
const topo=JSON.parse(readFileSync(require.resolve('world-atlas/countries-110m.json'),'utf8'));
const W=1000,H=500;
const proj=geoEquirectangular().scale(W/(2*Math.PI)).translate([W/2,H/2]).precision(.1);
const path=geoPath(proj).digits?geoPath(proj).digits(1):geoPath(proj);
const out={width:W,height:H,countries:{}};
for(const f of feature(topo,topo.objects.countries).features){
  const num=String(f.id).padStart(3,'0');
  if(num==='010')continue; // Antarktida
  const a3=iso.numericToAlpha3(num);
  if(!a3)continue;
  const d=path(f); if(!d)continue;
  out.countries[a3]={n:iso.getName(a3,'cs')||f.properties.name,d:d.replace(/(\d+\.\d)\d+/g,'$1')};
}
writeFileSync('data/world.json',JSON.stringify(out));
console.log(Object.keys(out.countries).length,'zemí');
