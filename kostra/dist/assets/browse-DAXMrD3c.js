import{G as B,a as $,b as P,g as G,s as q}from"./data-CshYx5mr.js";import{$ as n,s as y,e as b,a as O}from"./index-CJPXSVD8.js";function F(z){const{viewer:s}=z,l=n("#view-browse"),f=n("#info"),i=Object.assign({color:"real",ghost:!0,strength:.85},y.get("browse",{}));let c=null,E=y.get("infoOpen",!1);l.innerHTML=`
    <div class="section search">
      <label class="field"><span>Hledat kost</span>
        <input id="q" type="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="např. stehenní, femur, žebro, lopatka…"
          role="combobox" aria-expanded="false" aria-controls="sug" aria-autocomplete="list"></label>
      <ul id="sug" class="suggest" role="listbox" hidden></ul>
    </div>
    <div class="section">
      <h3>Zobrazení částí</h3>
      <div class="chips" id="groups"></div>
      <div class="row" style="margin-top:8px">
        <button class="btn small" id="show-all">Zobrazit vše</button>
        <button class="btn small" id="hide-all">Skrýt vše</button>
      </div>
    </div>
    <div class="section">
      <h3>Barvy</h3>
      <div class="seg" id="colors">
        <button data-v="real">Realistické</button><button data-v="distinct">Rozlišené</button>
      </div>
    </div>
    <div class="section">
      <h3>Průhlednost</h3>
      <label class="check"><input type="checkbox" id="ghost"> <span>Vybraná kost plná, ostatní vyblednou</span></label>
      <label class="field"><span>Síla vyblednutí: <b id="ghost-val"></b></span><input type="range" id="strength" min="0" max="95" step="1"></label>
    </div>
    <div class="section">
      <h3>Rozložení kostry</h3>
      <div class="row">
        <button class="btn small" id="explode-btn">Rozložit</button>
        <input type="range" id="explode" min="0" max="100" step="1" class="grow" aria-label="Míra rozložení">
      </div>
    </div>
    <div class="section tree">
      <h3>Seznam kostí</h3>
      <div id="tree"></div>
    </div>`;const S=n("#groups",l);S.innerHTML=B.map(e=>`<button class="chip" data-g="${e.id}" aria-pressed="true">${e.name}</button>`).join(""),S.addEventListener("click",e=>{const t=e.target.closest("[data-g]");if(!t)return;const a=$.filter(d=>d.group===t.dataset.g).map(d=>d.id),o=a.every(d=>s.isVisible(d));s.setMany(a,!o),c&&!s.isVisible(c)&&h()}),n("#show-all",l).onclick=()=>s.showAll(),n("#hide-all",l).onclick=()=>{s.setMany($.map(e=>e.id),!1),h()};const p=n("#tree",l);p.innerHTML=B.map(e=>{const t=$.filter(a=>a.group===e.id);return`<details data-g="${e.id}"><summary><span class="arrow">▸</span>
      <input type="checkbox" class="gcheck" aria-label="Zobrazit skupinu ${e.name}" style="width:22px;height:22px;accent-color:var(--accent)">
      <span>${e.name}</span><span class="count"></span></summary>
      ${t.map(a=>`<div class="bone" data-id="${a.id}">
        <input type="checkbox" aria-label="Zobrazit: ${b(a.label)}">
        <span class="swatch" style="background:${a.color}" hidden></span>
        <button>${b(a.cs)}${a.side!=="střední"?`<span class="side">${a.side[0]==="p"?"P":"L"}</span>`:""}</button></div>`).join("")}
    </details>`}).join(""),p.addEventListener("click",e=>{if(e.target.closest(".gcheck")){e.stopPropagation();const o=e.target.closest("details").dataset.g;s.setMany($.filter(d=>d.group===o).map(d=>d.id),e.target.checked),c&&!s.isVisible(c)&&h();return}const t=e.target.closest(".bone");if(!t)return;const a=t.dataset.id;e.target.matches("input")?(s.setVisible(a,e.target.checked),!e.target.checked&&c===a&&h()):e.target.closest("button")&&v(a,{reveal:!0})});function g(){for(const t of B){const a=$.filter(x=>x.group===t.id).map(x=>x.id),o=a.filter(x=>s.isVisible(x)).length;n(`.chip[data-g="${t.id}"]`,S).setAttribute("aria-pressed",o===a.length?"true":o===0?"false":"mixed");const w=n(`details[data-g="${t.id}"]`,p),D=n(".gcheck",w);D.checked=o===a.length,D.indeterminate=o>0&&o<a.length,n(".count",w).textContent=`${o}/${a.length}`}for(const t of O(".bone",p)){const a=s.isVisible(t.dataset.id);n("input",t).checked=a,t.classList.toggle("off",!a),n("button",t).classList.toggle("sel",t.dataset.id===c)}const e=i.color==="distinct";O(".swatch",p).forEach(t=>t.hidden=!e)}s.onVisibility=()=>{z.mode==="browse"&&g()};const R=n("#colors",l);function A(){s.setColorMode(i.color),O("button",R).forEach(e=>e.setAttribute("aria-pressed",String(e.dataset.v===i.color))),g()}R.addEventListener("click",e=>{const t=e.target.closest("[data-v]");t&&(i.color=t.dataset.v,y.set("browse",i),A())});const T=n("#ghost",l),L=n("#strength",l);function H(){T.checked=i.ghost,L.value=Math.round(i.strength*100),L.disabled=!i.ghost,n("#ghost-val",l).textContent=Math.round(i.strength*100)+" %",s.setGhost(i.ghost,i.strength)}T.onchange=()=>{i.ghost=T.checked,y.set("browse",i),H()},L.oninput=()=>{i.strength=L.value/100,y.set("browse",i),H()};const j=n("#explode",l),Z=n("#explode-btn",l),M=e=>{j.value=Math.round(e*100),Z.textContent=e>.5?"Složit":"Rozložit"};j.oninput=()=>{s.stopAnims(),s.setExplode(j.value/100),M(s.explode)},Z.onclick=()=>{const e=s.explode>.5?0:1;s.animateExplode(e,M),s.fitAll(!0,e)};function v(e,{reveal:t=!1,focus:a=!0}={}){const o=P.get(e);if(!o)return;t&&!s.isVisible(e)&&s.setVisible(e,!0),c=e,s.setFocus(e,"focus"),a&&s.focusBone(e),f.hidden=!1;const d=E;f.innerHTML=`<div class="info-head"><h2>${b(o.cs)}</h2>
        <button class="icon-sm" data-a="toggle" aria-expanded="${d}" aria-label="${d?"Skrýt podrobnosti":"Zobrazit podrobnosti"}">${d?"▲":"▼"}</button>
        <button class="icon-sm" data-a="close" aria-label="Zavřít">✕</button></div>
      <div class="info-body" ${d?"":"hidden"}><p class="la">${b(o.la)}</p>
      <div><span class="badge">${G(o.group)}</span>${o.side!=="střední"?`<span class="badge">${o.side} strana</span>`:""}</div>
      <p class="desc">${b(o.desc)}</p>
      <div class="row"><button class="btn small" data-a="hide">Skrýt</button><button class="btn small" data-a="iso">Jen tato</button>
      <button class="btn small" data-a="fly">Najet</button></div></div>`,g();const w=n(`details[data-g="${o.group}"]`,p);w&&(w.open=!0),n(`.bone[data-id="${e}"]`,p)?.scrollIntoView({block:"nearest"})}function h(){c=null,s.setFocus(null),f.hidden=!0,f.innerHTML="",g()}f.addEventListener("click",e=>{const t=e.target.closest("[data-a]")?.dataset.a;if(!(!t||!c))if(t==="hide"){const a=c;h(),s.setVisible(a,!1)}else if(t==="iso"){const a=c;s.setMany($.map(o=>o.id),!1),s.setVisible(a,!0),s.focusBone(a)}else t==="fly"?s.focusBone(c):t==="toggle"?(E=!E,y.set("infoOpen",E),v(c,{focus:!1})):h()}),s.onTap(e=>{z.mode==="browse"&&(e?v(e,{focus:!1}):h())});const r=n("#q",l),m=n("#sug",l);let k=[],u=-1;function V(){k=q(r.value),m.hidden=!k.length,r.setAttribute("aria-expanded",String(!!k.length)),m.innerHTML=k.map((e,t)=>`<li role="option" data-i="${t}" aria-selected="${t===u}"><span>${b(e.cs)}${e.side!=="střední"?` <span class="muted">· ${e.side}</span>`:""}</span><span class="s-la">${b(e.la)} · ${G(e.group)}</span></li>`).join("")}function C(e){const t=k[e];t&&(m.hidden=!0,r.value=t.cs+(t.side!=="střední"?` (${t.side})`:""),r.blur(),v(t.id,{reveal:!0}))}return r.addEventListener("input",()=>{u=-1,V()}),r.addEventListener("keydown",e=>{e.key==="ArrowDown"?(u=Math.min(k.length-1,u+1),V(),e.preventDefault()):e.key==="ArrowUp"?(u=Math.max(0,u-1),V(),e.preventDefault()):e.key==="Enter"?(C(u>=0?u:0),e.preventDefault()):e.key==="Escape"&&(m.hidden=!0)}),m.addEventListener("pointerdown",e=>{const t=e.target.closest("li");t&&(e.preventDefault(),C(+t.dataset.i))}),r.addEventListener("blur",()=>setTimeout(()=>{m.hidden=!0},120)),r.addEventListener("focus",()=>{r.value&&V()}),n("#reset-view").onclick=()=>s.resetView(),A(),H(),M(s.explode),g(),{enter(){l.hidden=!1,s.setGhost(i.ghost,i.strength),A(),M(s.explode),g(),c&&v(c,{focus:!1})},leave(){l.hidden=!0,f.hidden=!0},select:v}}export{F as createBrowse};
