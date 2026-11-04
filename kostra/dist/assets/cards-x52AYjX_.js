import{G as j,b as O,g as C,a as z}from"./data-CshYx5mr.js";import{$ as D,s as h,e as x,b as A}from"./index-CJPXSVD8.js";const $=864e5,K=[0,0,1*$,3*$,7*$,14*$],L="leitner";function N(M){const{viewer:l}=M,c=D("#view-cards");let f=Object.assign({scope:"all"},h.get("cardsCfg",{})),v=h.get(L,{}),u=[],n=null,d=!1,p=0,y=!1;const b=()=>z.filter(t=>f.scope==="all"||t.group===f.scope),r=t=>v[t]??{b:1,due:0},E=()=>h.set(L,v);function g(t=!1){const s=Date.now();let o=b().filter(a=>t||r(a.id).due<=s);o=A(o).sort((a,e)=>r(a.id).b-r(e.id).b),u=o.map(a=>a.id),p=0}function w(){const t='<option value="all">Celá kostra</option>'+j.map(e=>`<option value="${e.id}" ${f.scope===e.id?"selected":""}>${e.name}</option>`).join(""),o=`<div class="boxes">${[1,2,3,4,5].map(e=>b().filter(i=>r(i.id).b===e).length).map((e,i)=>`<div>Krabička ${i+1}<b>${e}</b></div>`).join("")}</div>`;let a;if(n){const e=O.get(n),i=u.length;a=d?`
        <div class="card">
          <div class="name">${x(e.cs)}</div><div class="la">${x(e.la)}</div>
          <div><span class="badge">${C(e.group)}</span>${e.side!=="střední"?`<span class="badge">${e.side} strana</span>`:""}</div>
          <p class="desc">${x(e.desc)}</p>
        </div>
        <div class="row"><button class="btn bad grow" id="no">✗ Neumím</button><button class="btn ok grow" id="yes">✓ Umím</button></div>
        <p class="muted small" style="text-align:center">Klávesy: ← neumím, → umím</p>`:`
        <div class="card">
          <div class="q">Která kost je zvýrazněna v modelu?</div>
          <div><span class="badge">${C(e.group)}</span></div>
          <p class="muted small">Model můžeš otáčet a přibližovat. Pak kartičku otoč.</p>
        </div>
        <button class="btn primary block" id="flip">Otočit kartičku</button>
        <p class="muted small" style="text-align:center">Klávesa: mezerník</p>`,a=`<div class="progress" aria-hidden="true"><i style="width:${Math.round(100*p/(p+i||1))}%"></i></div>
        <div class="muted small">Ve frontě ${i} · krabička ${r(n).b}</div>`+a}else{const e=Math.min(...b().map(i=>r(i.id).due).filter(i=>i>Date.now()),1/0);a=`<div class="card"><div class="q">🎉 Hotovo</div>
        <p class="muted">${p?`Zopakováno ${p} kartiček.`:"Na teď není nic k opakování."}
        ${isFinite(e)?`Další kartička přijde na řadu ${new Date(e).toLocaleString("cs-CZ",{day:"numeric",month:"numeric",hour:"2-digit",minute:"2-digit"})}.`:""}</p>
        <button class="btn primary block" id="again-all">Procvičit i tak (od nejslabších)</button></div>`}c.innerHTML=`<label class="field"><span>Okruh</span><select id="scope">${t}</select></label>${o}${a}
      <button class="btn small" id="reset-prog" style="margin-top:14px">Smazat postup v tomto okruhu</button>`}function m(){n=u[0]??null,d=!1,n?(l.setFocus(n,"focus"),l.focusBone(n)):l.setFocus(null),w()}function k(t){const s=n,o=r(s),a=Date.now();if(u.shift(),t){const e=Math.min(5,o.b+1);v[s]={b:e,due:a+K[e]},p++}else v[s]={b:1,due:a},u.splice(Math.min(u.length,3),0,s);E(),m()}return c.addEventListener("click",t=>{const s=t.target.closest("button");s&&(s.id==="flip"?(d=!0,w(),D("#yes",c)?.focus({preventScroll:!0})):s.id==="yes"?k(!0):s.id==="no"?k(!1):s.id==="again-all"?(g(!0),m()):s.id==="reset-prog"&&confirm("Opravdu smazat postup kartiček v tomto okruhu?")&&(b().forEach(o=>delete v[o.id]),E(),g(),m()))}),c.addEventListener("change",t=>{t.target.id==="scope"&&(f.scope=t.target.value,h.set("cardsCfg",f),g(),m())}),document.addEventListener("keydown",t=>{!y||t.target.matches("input, select, textarea")||!n||(!d&&(t.key===" "||t.key==="Enter")?(t.preventDefault(),d=!0,w()):d&&t.key==="ArrowRight"?k(!0):d&&t.key==="ArrowLeft"&&k(!1))}),{enter(){y=!0,c.hidden=!1,l.showAll(),l.setExplode(0),l.setMark(null),l.setGhost(!0,.88),g(),m()},leave(){y=!1,c.hidden=!0,l.setFocus(null)}}}export{N as createCards};
