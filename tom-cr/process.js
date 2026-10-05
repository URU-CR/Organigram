// TOM ÚRÚ ČR – pohled Procesy (plavecké dráhy). Samostatný modul; používá globální stav a pomocné funkce z app.js.
// proces: {id,name,desc,lanes:[{id,ref?|role?}],steps:[{id,lane,row,name,kind,sys,ch,note,sub}],flows:[{id,from,to,label}]}
// role:   {id,name,func,desc}   (role patří k funkci; funkce určuje útvar v organigramu)
const LANE_W=210, BOX_W=180, ROW_H=104, HEAD_H=58, PTOP=HEAD_H+22;
const STEP_KINDS={step:'krok',decision:'rozhodnutí',start:'začátek',end:'konec'};
let procSel=null, pConnect=null, pzoom=0.85;

function seedProcesses(st){ const S=window.TOM_SEED; if(!st.roles||!st.roles.length) st.roles=(S.roles||[]).filter(r=>!r.func||st.funcs[r.func]).map(r=>({...r,desc:r.desc||''}));
  if(!st.processes||!st.processes.length) st.processes=(S.processes||[]).map(p=>({id:p.id,name:p.name,desc:p.desc||'',
    lanes:p.lanes.map(([id,ref,role])=>role?{id,role}:{id,ref}).filter(l=>l.role||st.funcs[l.ref]),
    steps:p.steps.map(([id,lane,row,name,kind,sys,ch,note])=>({id,lane,row,name,kind:kind||'step',sys:sys||null,ch:ch||null,note:note||'',sub:''})),
    flows:p.flows.map(([a,b,l])=>({id:uid('w'),from:a,to:b,label:l||''}))})); }
const roleOf=id=>(state.roles||[]).find(r=>r.id===id);
function curProc(){ let p=(state.processes||[]).find(x=>x.id===state.proc); if(!p&&state.processes.length){ p=state.processes[0]; state.proc=p.id; } return p||null; }
function laneInfo(l){ if(l.role){ const r=roleOf(l.role); return r?{type:'role',name:r.name,sub:r.func&&F(r.func)?F(r.func).name:'role bez funkce'}:null; }
  const f=F(l.ref); if(!f) return null; return {type:f.kind||'func',name:f.name,sub:f.kind==='actor'?'vnější okolí':f.kind==='system'?'systém':'funkce'}; }
const LANE_TYPE={actor:'aktér',system:'systém',role:'role',func:'funkce'};
// prvek modelu, který krok reprezentuje pro odvozené vazby
function stepEl(p,s){ const l=p.lanes.find(x=>x.id===s.lane); if(!l) return null; if(l.role){ const r=roleOf(l.role); return s.sys||(r&&r.func)||null; } return l.ref; }
function derivedLinks(p){ const out=[]; const add=(a,b,k,why)=>{ if(!a||!b||a===b||!F(a)||!F(b)||!LINK_KINDS[k]) return; if(out.some(x=>x.from===a&&x.to===b&&x.kind===k)) return; out.push({from:a,to:b,kind:k,why}); };
  p.steps.forEach(s=>{ const l=p.lanes.find(x=>x.id===s.lane); if(l&&l.role&&s.sys){ const r=roleOf(l.role); if(r&&r.func) add(r.func,s.sys,'pouziva',s.name); } });
  p.flows.forEach(w=>{ const A=p.steps.find(s=>s.id===w.from), B=p.steps.find(s=>s.id===w.to); if(!A||!B) return; const a=stepEl(p,A), b=stepEl(p,B); if(!F(a)||!F(b)) return;
    const ta=F(a).kind||'func', tb=F(b).kind||'func'; if(ta==='actor') add(a,b,'zada',A.name); else if(ta==='system'&&tb==='system') add(a,b,'data',A.name+' → '+B.name); });
  return out; }
const fam=id=>{ const f=F(id); if(!f) return [id]; return [id,...(f.parent?[f.parent]:[]),...(f.sum?kidsOf(id).map(k=>k.id):[])]; };
const inMap=d=>state.links.some(l=>fam(d.from).includes(l.from)&&fam(d.to).includes(l.to)&&(l.kind===d.kind||(d.kind==='pouziva'&&l.kind==='spravuje')));
function procsOf(id){ return (state.processes||[]).filter(p=>p.lanes.some(l=>l.ref===id||(l.role&&roleOf(l.role)&&fam(id).includes(roleOf(l.role).func)))||p.steps.some(s=>s.sys===id)); }
// kontroly procesů (volá check() v app.js)
function checkProcesses(add){
  (state.processes||[]).forEach(p=>{
    p.lanes.forEach(l=>{ if(!laneInfo(l)) add('err','plane',`Proces „${p.name}“: dráha odkazuje na prvek, který v modelu už není.`,{proc:p.id,step:l.id}); });
    p.steps.forEach(s=>{ const l=p.lanes.find(x=>x.id===s.lane); if(!l) return;
      if(l.role){ const r=roleOf(l.role); if(r&&!r.func) return;
        if(r&&s.sys&&F(r.func)&&F(s.sys)&&!state.links.some(x=>fam(r.func).includes(x.from)&&x.to===s.sys&&(x.kind==='pouziva'||x.kind==='spravuje')))
          add('warn','procsys',`Proces „${p.name}“, krok „${s.name}“: ${r.name} pracuje v systému ${F(s.sys).name}, ale funkce „${F(r.func).name}“ ho v mapě nepoužívá.`,{proc:p.id,step:s.id,f:r.func}); } });
    p.steps.filter(s=>s.kind!=='end'&&!p.flows.some(w=>w.from===s.id)).forEach(s=>add('info','pdead',`Proces „${p.name}“: z kroku „${s.name}“ nic nevede.`,{proc:p.id,step:s.id}));
  });
  (state.roles||[]).forEach(r=>{ if(!r.func) add('info','rolefunc',`Role „${r.name}“ není přiřazena k žádné funkci, a tedy ani k útvaru.`,{}); });
}

// ---------- vykreslení ----------
function renderProc(){
  const sel=$('#procSel'); sel.innerHTML=(state.processes||[]).map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')||'<option value="">— žádný proces —</option>';
  const p=curProc(); sel.value=p?p.id:''; $('#pzoomVal').textContent=Math.round(pzoom*100)+' %'; $('#pzoom').value=Math.round(pzoom*100);
  const wrap=$('#pWrap'), cv=$('#pCanvas'); const sl=wrap.scrollLeft, st=wrap.scrollTop; cv.innerHTML=''; cv.style.transform=`scale(${pzoom})`;
  if(!p){ cv.innerHTML='<div class="empty">Zatím žádný proces. Založte ho tlačítkem „+ proces“.</div>'; cv.style.width='600px'; cv.style.height='200px'; return; }
  const rows=Math.max(1,...p.steps.map(s=>s.row+1)); const W=Math.max(1,p.lanes.length)*LANE_W+40, H=PTOP+rows*ROW_H+80; cv.style.width=W+'px'; cv.style.height=H+'px';
  const L=live();
  p.lanes.forEach((l,i)=>{ const li=laneInfo(l); const bg=document.createElement('div'); bg.className='plane'+(i%2?' odd':''); bg.style.cssText=`left:${i*LANE_W}px;top:0;width:${LANE_W}px;height:${H}px`; cv.appendChild(bg);
    const h=document.createElement('div'); h.className='phead t-'+(li?li.type:'gone')+(procSel&&procSel.t==='lane'&&procSel.id===l.id?' sel':''); h.style.cssText=`left:${i*LANE_W+6}px;top:6px;width:${LANE_W-12}px;height:${HEAD_H-8}px`;
    h.innerHTML=li?`<span class="pt">${LANE_TYPE[li.type]}</span><b>${esc(li.name)}</b>${li.type==='role'?`<span class="ps">${esc(li.sub)}</span>`:''}`:'<b>chybějící prvek</b>';
    h.onclick=e=>{ e.stopPropagation(); if(pConnect) return; procSel={t:'lane',id:l.id}; render(); }; cv.appendChild(h); });
  const pos=s=>{ const i=p.lanes.findIndex(l=>l.id===s.lane); return {x:i*LANE_W+(LANE_W-BOX_W)/2,y:PTOP+s.row*ROW_H}; };
  const boxes={};
  p.steps.forEach(s=>{ const q=pos(s); const b=document.createElement('div'); boxes[s.id]=b; const cs=L.filter(c=>c.proc===p.id&&c.step===s.id);
    b.className='pstep k-'+s.kind+(procSel&&procSel.t==='step'&&procSel.id===s.id?' sel':'')+(pConnect===s.id?' from':'')+(cs.some(c=>c.sev==='err')?' sev-err':cs.some(c=>c.sev==='warn')?' sev-warn':'');
    b.style.left=q.x+'px'; b.style.top=q.y+'px'; b.dataset.sid=s.id;
    const meta=[s.sys&&F(s.sys)?'v '+F(s.sys).name:null, s.ch?(CHANNELS[s.ch]||s.ch):null].filter(Boolean).join(' · ');
    b.innerHTML=`<div class="pn">${esc(s.name)}</div>${meta?`<div class="pm">${esc(meta)}</div>`:''}${s.sub?`<div class="pm">${esc(s.sub)}</div>`:''}${s.note?`<span class="pnote" title="${esc(s.note)}">?</span>`:''}${cs.length?`<span class="cb ${cs.some(c=>c.sev==='err')?'err':'warn'}" title="${esc(cs.map(c=>c.text).join('\n'))}">!</span>`:''}`;
    b.addEventListener('pointerdown',e=>stepDown(e,p,s)); cv.appendChild(b); });
  // šipky (pravoúhlé)
  const NS='http://www.w3.org/2000/svg'; const svg=document.createElementNS(NS,'svg'); svg.setAttribute('class','pflows'); svg.setAttribute('width',W); svg.setAttribute('height',H);
  svg.innerHTML='<defs><marker id="par" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="#5D6B7A"/></marker><marker id="pars" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="#1D4ED8"/></marker></defs>';
  const labels=[];
  p.flows.forEach(w=>{ const A=p.steps.find(s=>s.id===w.from), B=p.steps.find(s=>s.id===w.to); if(!A||!B||!boxes[A.id]||!boxes[B.id]) return;
    const a=pos(A), b=pos(B), ah=boxes[A.id].offsetHeight, bh=boxes[B.id].offsetHeight; let d, lx, ly, anchor='middle';
    if(B.row>A.row){ const x1=a.x+BOX_W/2, y1=a.y+ah, x2=b.x+BOX_W/2, y2=b.y; anchor='start';
      if(Math.abs(x1-x2)<1){ d=`M${x1} ${y1}L${x2} ${y2-2}`; lx=x1+6; ly=y1+16; }
      else { const k=p.flows.filter(z=>z.from===A.id).filter(z=>{ const T=p.steps.find(s=>s.id===z.to); return T&&T.row>A.row&&T.lane!==A.lane; }).sort((u,v)=>{ const pu=pos(p.steps.find(s=>s.id===u.to)).x, pv=pos(p.steps.find(s=>s.id===v.to)).x; return pu-pv; }).indexOf(w);
        const ym=y1+12+Math.max(0,k)*14; d=`M${x1} ${y1}L${x1} ${ym}L${x2} ${ym}L${x2} ${y2-2}`; lx=x2+6; ly=Math.max(ym+14,y2-8); } }
    else if(B.row===A.row){ const dir=b.x>a.x?1:-1; const x1=dir>0?a.x+BOX_W:a.x, x2=dir>0?b.x:b.x+BOX_W, y=a.y+Math.min(ah,bh)/2; d=`M${x1} ${y}L${x2-2*dir} ${y}`; lx=(x1+x2)/2; ly=y-6; }
    else { anchor='start'; const xr=Math.max(a.x,b.x)+BOX_W+14, y1=a.y+ah/2, y2=b.y+bh/2; d=`M${a.x+BOX_W} ${y1}L${xr} ${y1}L${xr} ${y2}L${b.x+BOX_W+2} ${y2}`; lx=xr+4; ly=(y1+y2)/2; }
    const on=procSel&&procSel.t==='flow'&&procSel.id===w.id; const g=document.createElementNS(NS,'g'); g.setAttribute('class','pf'+(on?' sel':''));
    g.innerHTML=`<path d="${d}" class="hit" fill="none"/><path d="${d}" fill="none" stroke="${on?'#1D4ED8':'#5D6B7A'}" stroke-width="${on?2.4:1.5}" marker-end="url(#${on?'pars':'par'})"/>`;
    g.addEventListener('pointerdown',e=>{ e.stopPropagation(); procSel={t:'flow',id:w.id}; render(); }); svg.appendChild(g);
    if(w.label) labels.push(`<text x="${lx}" y="${ly}" text-anchor="${B.row<A.row?'start':anchor}"${on?' class="on"':''}>${esc(w.label)}</text>`); });
  cv.insertBefore(svg,cv.querySelector('.pstep'));
  if(labels.length){ const lv=document.createElementNS(NS,'svg'); lv.setAttribute('class','pflows plabels'); lv.setAttribute('width',W); lv.setAttribute('height',H); lv.innerHTML=labels.join(''); cv.appendChild(lv); }
  wrap.scrollLeft=sl; wrap.scrollTop=st;
}
function stepDown(e,p,s){ e.stopPropagation(); if(e.button>0) return;
  if(document.body.classList.contains('pconnecting')){ if(!pConnect){ pConnect=s.id; $('#pconnHint').textContent='Teď klikněte na následující krok (Esc = konec).'; renderProc(); } else if(pConnect!==s.id){ if(!p.flows.some(w=>w.from===pConnect&&w.to===s.id)){ const w={id:uid('w'),from:pConnect,to:s.id,label:''}; p.flows.push(w); procSel={t:'flow',id:w.id}; save('proces','šipka: '+p.name); } pConnect=null; $('#pconnHint').textContent='Klikněte na krok, ze kterého šipka vede.'; } return; }
  const t=e.currentTarget, sx=e.clientX, sy=e.clientY, x0=parseFloat(t.style.left), y0=parseFloat(t.style.top); let moved=false; try{ t.setPointerCapture(e.pointerId); }catch(_){}
  const mv=ev=>{ const dx=(ev.clientX-sx)/pzoom, dy=(ev.clientY-sy)/pzoom; if(!moved&&Math.abs(dx)+Math.abs(dy)<4) return; if(!ROLE.org) return; moved=true; t.style.left=(x0+dx)+'px'; t.style.top=(y0+dy)+'px'; t.classList.add('drag'); };
  const up=()=>{ t.removeEventListener('pointermove',mv); t.removeEventListener('pointerup',up); t.removeEventListener('pointercancel',up);
    if(!moved){ procSel={t:'step',id:s.id}; render(); return; }
    const li=Math.max(0,Math.min(p.lanes.length-1,Math.round((parseFloat(t.style.left)-(LANE_W-BOX_W)/2)/LANE_W))), row=Math.max(0,Math.round((parseFloat(t.style.top)-PTOP)/ROW_H));
    const lane=p.lanes[li].id; const other=p.steps.find(x=>x!==s&&x.lane===lane&&x.row===row);
    if(other){ other.lane=s.lane; other.row=s.row; } s.lane=lane; s.row=row; procSel={t:'step',id:s.id}; save('proces',`krok přesunut: ${s.name}`); };
  t.addEventListener('pointermove',mv); t.addEventListener('pointerup',up); t.addEventListener('pointercancel',up); }
function setPConnect(on){ pConnect=null; document.body.classList.toggle('pconnecting',!!on); $('#pBtnConnect').classList.toggle('on',!!on); $('#pconnHint').hidden=!on; $('#pconnHint').textContent='Klikněte na krok, ze kterého šipka vede.'; if(state&&state.view==='proc') renderProc(); }

// ---------- výběr prvku pro dráhu ----------
function laneOptions(cur){ const o=(lbl,items)=>items.length?`<optgroup label="${lbl}">${items.join('')}</optgroup>`:'';
  const opt=(v,n)=>`<option value="${v}" ${v===cur?'selected':''}>${esc(n)}</option>`;
  return o('Role',(state.roles||[]).map(r=>opt('role:'+r.id,r.name+(r.func&&F(r.func)?' ('+F(r.func).name+')':''))))+o('Aktéři',envEls('actor').map(f=>opt('ref:'+f.id,f.name)))+o('Systémy',envEls('system').map(f=>opt('ref:'+f.id,f.name)))+
    o('Funkce',Object.values(state.funcs).filter(f=>!f.kind).map(f=>opt('ref:'+f.id,(f.sum?'▣ ':'')+f.name)))+'<option value="newrole">+ nová role…</option>'; }
function laneFromValue(v){ if(v==='newrole'){ const r=newRole(); return r?{role:r.id}:null; } const [t,id]=v.split(':'); return t==='role'?{role:id}:{ref:id}; }
function newRole(){ const n=prompt('Název role (např. „Vedoucí územního pracoviště“):'); if(!n||!n.trim()) return null; const r={id:uid('r'),name:n.trim(),func:null,desc:''}; state.roles.push(r); toast('Role vytvořena – v „Role…“ ji přiřaďte k funkci.'); return r; }

// ---------- boční panel ----------
function renderProcSide(s){ const ro=ROLE.org?'':'disabled'; const p=curProc();
  if(!p){ s.innerHTML='<div class="sh"><span class="muted">Procesy</span></div><p class="muted">Proces popisuje, kdo v jakém pořadí a v jakém systému jedná. Založte první proces tlačítkem „+ proces“.</p>'; return; }
  const step=procSel&&procSel.t==='step'&&p.steps.find(x=>x.id===procSel.id), flow=procSel&&procSel.t==='flow'&&p.flows.find(x=>x.id===procSel.id), lane=procSel&&procSel.t==='lane'&&p.lanes.find(x=>x.id===procSel.id);
  const close=()=>{ const b=$('#sClose'); if(b) b.onclick=()=>{ procSel=null; render(); }; };
  if(step){ const l=p.lanes.find(x=>x.id===step.lane), li=l&&laneInfo(l); const outs=p.flows.filter(w=>w.from===step.id), ins=p.flows.filter(w=>w.to===step.id); const cs=conflicts.filter(c=>c.proc===p.id&&c.step===step.id);
    s.innerHTML=`<div class="sh"><span class="muted">Krok procesu</span><button class="small" id="sClose">×</button></div>
    <label>Název<textarea id="psName" rows="2" ${ro}>${esc(step.name)}</textarea></label>
    <div class="g2"><label>Dráha (kdo)<select id="psLane" ${ro}>${p.lanes.map(x=>`<option value="${x.id}" ${x.id===step.lane?'selected':''}>${esc((laneInfo(x)||{name:'?'}).name)}</option>`).join('')}</select></label>
    <label>Druh<select id="psKind" ${ro}>${Object.entries(STEP_KINDS).map(([k,v])=>`<option value="${k}" ${k===step.kind?'selected':''}>${v}</option>`).join('')}</select></label>
    <label>V systému<select id="psSys" ${ro}><option value="">—</option>${envEls('system').map(f=>`<option value="${f.id}" ${f.id===step.sys?'selected':''}>${esc(f.name)}</option>`).join('')}</select></label>
    <label>Kanál<select id="psCh" ${ro}><option value="">—</option>${Object.entries(CHANNELS).map(([k,v])=>`<option value="${k}" ${k===step.ch?'selected':''}>${v}</option>`).join('')}</select></label></div>
    <label>Upřesnění<input type="text" id="psSub" value="${esc(step.sub||'')}" placeholder="např. „DS, e-mail, osobně“" ${ro}></label>
    <label>Otevřená otázka / k ověření<textarea id="psNote" rows="2" ${ro}>${esc(step.note||'')}</textarea></label>
    <div class="lbl">Pokračuje do</div>${outs.map(w=>{ const t=p.steps.find(x=>x.id===w.to); return `<div class="arow"><span>→ ${esc(t?t.name:'?')}</span><input type="text" data-w="${w.id}" value="${esc(w.label)}" placeholder="popisek (např. ano)" ${ro} style="font-size:12px;padding:2px 5px">${ROLE.org?`<button class="small" data-x="${w.id}">×</button>`:''}</div>`; }).join('')||'<div class="muted">nikam</div>'}
    ${ROLE.org?`<div class="addasg"><select id="psNext"><option value="">— přidat pokračování —</option>${p.steps.filter(x=>x!==step).map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}<option value="__new">+ nový krok pod tímto</option></select><span></span><button class="small" id="psNextAdd">Přidat</button></div>`:''}
    ${ins.length?`<div class="lbl">Přichází z</div>${ins.map(w=>{ const f=p.steps.find(x=>x.id===w.from); return `<div class="muted" style="font-size:13px">← ${esc(f?f.name:'?')}${w.label?' ('+esc(w.label)+')':''}</div>`; }).join('')}`:''}
    ${cs.length?`<div class="lbl">Rozpory</div>${cs.map(c=>`<div class="mini sev-${c.sev}${c.ignored?' ign':''}">${esc(c.text)}</div>`).join('')}`:''}
    ${li&&li.type!=='role'&&F(l.ref)?`<p style="margin-top:12px"><a href="#" id="psMap">Zobrazit „${esc(li.name)}“ v mapě</a></p>`:''}
    ${ROLE.org?'<div class="row" style="margin-top:14px"><button id="psDel" style="color:var(--danger)">Smazat krok</button></div>':''}`;
    close(); if($('#psMap')) $('#psMap').onclick=e=>{ e.preventDefault(); sel={t:'f',id:l.ref}; state.view='map'; focusFunc(l.ref); render(); };
    if(!ROLE.org) return; const ch=(fn,w)=>()=>{ fn(); save('proces',w+': '+step.name); };
    $('#psName').onchange=e=>{ step.name=e.target.value.trim()||step.name; save('proces','krok přejmenován: '+step.name); };
    $('#psLane').onchange=()=>{ const ln=$('#psLane').value; const o=p.steps.find(x=>x!==step&&x.lane===ln&&x.row===step.row); if(o){ o.lane=step.lane; } step.lane=ln; save('proces','krok přesunut: '+step.name); };
    $('#psKind').onchange=ch(()=>step.kind=$('#psKind').value,'druh'); $('#psSys').onchange=ch(()=>step.sys=$('#psSys').value||null,'systém'); $('#psCh').onchange=ch(()=>step.ch=$('#psCh').value||null,'kanál');
    $('#psSub').onchange=ch(()=>step.sub=$('#psSub').value.trim(),'upřesnění'); $('#psNote').onchange=ch(()=>step.note=$('#psNote').value.trim(),'poznámka');
    s.querySelectorAll('input[data-w]').forEach(i=>i.onchange=()=>{ p.flows.find(w=>w.id===i.dataset.w).label=i.value.trim(); save('proces','popisek šipky'); });
    s.querySelectorAll('[data-x]').forEach(b=>b.onclick=()=>{ p.flows=p.flows.filter(w=>w.id!==b.dataset.x); save('proces','šipka smazána'); });
    $('#psNextAdd').onclick=()=>{ const v=$('#psNext').value; if(!v) return; let to=v;
      if(v==='__new'){ const n=prompt('Název nového kroku:'); if(!n||!n.trim()) return; p.steps.forEach(x=>{ if(x.row>step.row) x.row++; }); const ns={id:uid('s'),lane:step.lane,row:step.row+1,name:n.trim(),kind:'step',sys:step.sys||null,ch:null,note:'',sub:''}; p.steps.push(ns); to=ns.id; }
      if(!p.flows.some(w=>w.from===step.id&&w.to===to)) p.flows.push({id:uid('w'),from:step.id,to,label:''}); save('proces','pokračování: '+step.name); };
    $('#psDel').onclick=()=>{ if(!confirm(`Smazat krok „${step.name}“ včetně jeho šipek?`)) return; p.steps=p.steps.filter(x=>x!==step); p.flows=p.flows.filter(w=>w.from!==step.id&&w.to!==step.id); procSel=null; save('proces','krok smazán: '+step.name); };
    return; }
  if(flow){ const A=p.steps.find(x=>x.id===flow.from), B=p.steps.find(x=>x.id===flow.to);
    s.innerHTML=`<div class="sh"><span class="muted">Šipka procesu</span><button class="small" id="sClose">×</button></div><p><b>${esc(A?A.name:'?')}</b><br>→ <b>${esc(B?B.name:'?')}</b></p>
    <label>Popisek<input type="text" id="pfLabel" value="${esc(flow.label)}" placeholder="např. ano / ne – nový spis" ${ro}></label>
    ${ROLE.org?'<div class="row" style="margin-top:12px"><button id="pfRev">Obrátit směr</button><button id="pfDel" style="color:var(--danger)">Smazat</button></div>':''}`;
    close(); if(!ROLE.org) return; $('#pfLabel').onchange=e=>{ flow.label=e.target.value.trim(); save('proces','popisek šipky'); };
    $('#pfRev').onclick=()=>{ [flow.from,flow.to]=[flow.to,flow.from]; save('proces','šipka obrácena'); }; $('#pfDel').onclick=()=>{ p.flows=p.flows.filter(w=>w!==flow); procSel=null; save('proces','šipka smazána'); }; return; }
  if(lane){ const i=p.lanes.indexOf(lane), li=laneInfo(lane), n=p.steps.filter(x=>x.lane===lane.id).length; const r=lane.role&&roleOf(lane.role);
    s.innerHTML=`<div class="sh"><span class="muted">Dráha</span><button class="small" id="sClose">×</button></div>
    <label>Kdo / co<select id="plEl" ${ro}>${laneOptions(lane.role?'role:'+lane.role:'ref:'+lane.ref)}</select></label>
    ${r?`<label>Role patří k funkci<select id="plFunc" ${ro}><option value="">— bez funkce —</option>${Object.values(state.funcs).filter(f=>!f.kind).map(f=>`<option value="${f.id}" ${f.id===r.func?'selected':''}>${f.sum?'▣ ':''}${esc(f.name)}</option>`).join('')}</select></label><p class="muted" style="font-size:12px">Funkce určuje útvar v organigramu. Změna platí pro roli ve všech procesech.</p>`:''}
    <p class="muted">${n} kroků v dráze.</p>
    ${ROLE.org?`<div class="row"><button id="plL" ${i<=0?'disabled':''}>← doleva</button><button id="plR" ${i>=p.lanes.length-1?'disabled':''}>doprava →</button><button id="plDel" style="color:var(--danger)">Smazat dráhu</button></div>`:''}
    ${li&&li.type!=='role'?`<p style="margin-top:12px"><a href="#" id="plMap">Zobrazit v mapě</a></p>`:''}`;
    close(); if($('#plMap')) $('#plMap').onclick=e=>{ e.preventDefault(); sel={t:'f',id:lane.ref}; state.view='map'; focusFunc(lane.ref); render(); };
    if(!ROLE.org) return;
    $('#plEl').onchange=e=>{ const v=laneFromValue(e.target.value); if(!v){ render(); return; } delete lane.role; delete lane.ref; Object.assign(lane,v); save('proces','dráha změněna'); };
    if($('#plFunc')) $('#plFunc').onchange=e=>{ r.func=e.target.value||null; save('role',r.name+' → '+(r.func?F(r.func).name:'bez funkce')); };
    $('#plL').onclick=()=>{ p.lanes.splice(i,1); p.lanes.splice(i-1,0,lane); save('proces','dráha posunuta'); }; $('#plR').onclick=()=>{ p.lanes.splice(i,1); p.lanes.splice(i+1,0,lane); save('proces','dráha posunuta'); };
    $('#plDel').onclick=()=>{ if(n&&!confirm(`Dráha obsahuje ${n} kroků – smazat i je?`)) return; const ids=new Set(p.steps.filter(x=>x.lane===lane.id).map(x=>x.id)); p.steps=p.steps.filter(x=>!ids.has(x.id)); p.flows=p.flows.filter(w=>!ids.has(w.from)&&!ids.has(w.to)); p.lanes=p.lanes.filter(x=>x!==lane); procSel=null; save('proces','dráha smazána'); };
    return; }
  // proces jako celek
  const dl=derivedLinks(p), miss=dl.filter(d=>!inMap(d)); const cs=conflicts.filter(c=>c.proc===p.id&&!c.ignored);
  s.innerHTML=`<div class="sh"><span class="muted">Proces</span></div>
    <label>Název<input type="text" id="ppName" value="${esc(p.name)}" ${ro}></label><label>Popis<textarea id="ppDesc" rows="3" ${ro}>${esc(p.desc||'')}</textarea></label>
    <p class="muted" style="font-size:12px">${p.lanes.length} drah · ${p.steps.length} kroků · ${p.steps.filter(x=>x.note).length} otevřených otázek</p>
    <div class="lbl">Vazby odvozené z procesu (${dl.length})</div>
    ${dl.map(d=>`<div class="arow kid"><span style="font-size:12px">${esc(F(d.from).name)} → ${esc(F(d.to).name)} <span class="muted">(${esc(KIND(d.kind)[0])})</span></span><span>${inMap(d)?'<span class="okc" title="v mapě je">✓</span>':'<span class="warnc" title="v mapě chybí">chybí</span>'}</span></div>`).join('')||'<div class="muted">žádné</div>'}
    ${miss.length&&ROLE.org?`<button id="ppSync" class="primary" style="margin-top:8px">Doplnit ${miss.length} vazeb do mapy</button>`:''}
    ${cs.length?`<div class="lbl">Rozpory procesu</div>${cs.map(c=>`<div class="mini sev-${c.sev}">${esc(c.text)}</div>`).join('')}`:''}
    <p class="muted" style="font-size:12px;margin-top:14px">Klikněte na krok, šipku nebo záhlaví dráhy. Kroky se přesouvají tažením do jiné dráhy nebo řádku; obsazené místo se prohodí.</p>
    ${ROLE.org?'<div class="row" style="margin-top:10px"><button id="ppDup">Duplikovat proces</button><button id="ppDel" style="color:var(--danger)">Smazat proces</button></div>':''}`;
  if(!ROLE.org) return;
  $('#ppName').onchange=e=>{ p.name=e.target.value.trim()||p.name; save('proces','přejmenován: '+p.name); }; $('#ppDesc').onchange=e=>{ p.desc=e.target.value; save('proces','popis: '+p.name); };
  if($('#ppSync')) $('#ppSync').onclick=()=>{ miss.forEach(d=>state.links.push({id:uid('l'),from:d.from,to:d.to,kind:d.kind,label:''})); save('proces',`do mapy doplněno ${miss.length} vazeb z procesu ${p.name}`); toast(`Do mapy doplněno ${miss.length} vazeb.`); };
  $('#ppDup').onclick=()=>{ const c=JSON.parse(JSON.stringify(p)); c.id=uid('p'); c.name=p.name+' (kopie)'; state.processes.push(c); state.proc=c.id; save('proces','duplikován: '+p.name); };
  $('#ppDel').onclick=()=>{ if(!confirm(`Smazat proces „${p.name}“?`)) return; state.processes=state.processes.filter(x=>x!==p); state.proc=null; procSel=null; save('proces','smazán: '+p.name); };
}

// ---------- role ----------
function openRolesDlg(){ const d=$('#dlgRoles'); const draw=()=>{ const used=r=>(state.processes||[]).filter(p=>p.lanes.some(l=>l.role===r.id)).length;
    $('#rolesBody').innerHTML=(state.roles||[]).map(r=>`<div class="rrow" data-r="${r.id}"><input type="text" value="${esc(r.name)}" ${ROLE.org?'':'disabled'}>
      <select ${ROLE.org?'':'disabled'}><option value="">— bez funkce —</option>${Object.values(state.funcs).filter(f=>!f.kind).map(f=>`<option value="${f.id}" ${f.id===r.func?'selected':''}>${f.sum?'▣ ':''}${esc(f.name)}</option>`).join('')}</select>
      <span class="muted" title="počet procesů">${used(r)}×</span>${ROLE.org?`<button class="small" ${used(r)?'disabled title="role je použita v procesu"':''}>×</button>`:''}</div>`).join('')||'<p class="muted">Zatím žádné role.</p>';
    $('#rolesBody').querySelectorAll('.rrow').forEach(row=>{ const r=roleOf(row.dataset.r); const [nm]=row.querySelectorAll('input'); const fs=row.querySelector('select');
      nm.onchange=()=>{ r.name=nm.value.trim()||r.name; save('role','přejmenována: '+r.name); }; fs.onchange=()=>{ r.func=fs.value||null; save('role',r.name+' → '+(r.func?F(r.func).name:'bez funkce')); };
      const b=row.querySelector('button'); if(b) b.onclick=()=>{ state.roles=state.roles.filter(x=>x!==r); save('role','smazána: '+r.name); draw(); }; }); };
  $('#roleAdd').onclick=()=>{ const n=$('#roleNew').value.trim(); if(!n) return; state.roles.push({id:uid('r'),name:n,func:null,desc:''}); $('#roleNew').value=''; save('role','nová: '+n); draw(); };
  $('#roleNew').onkeydown=e=>{ if(e.key==='Enter') $('#roleAdd').click(); }; $('#rolesClose').onclick=()=>{ d.close(); render(); }; draw(); d.showModal(); }

function wireProc(){
  $('#procSel').onchange=e=>{ state.proc=e.target.value; procSel=null; setPConnect(false); persist(); render(); };
  $('#pBtnNew').onclick=()=>{ const n=prompt('Název procesu (např. „Vydání rozhodnutí“):'); if(!n||!n.trim()) return; const p={id:uid('p'),name:n.trim(),desc:'',lanes:[],steps:[],flows:[]}; state.processes.push(p); state.proc=p.id; procSel=null; save('proces','nový: '+p.name); toast('Proces založen – přidejte dráhy (kdo jedná) a kroky.'); };
  $('#pBtnLane').onclick=()=>{ const p=curProc(); if(!p) return; const d=$('#dlgLane'); $('#laneEl').innerHTML=laneOptions(''); $('#laneOk').onclick=()=>{ const v=laneFromValue($('#laneEl').value); if(!v) return; const l={id:uid('L'),...v}; p.lanes.push(l); d.close(); procSel={t:'lane',id:l.id}; save('proces','nová dráha: '+(laneInfo(l)||{}).name); }; $('#laneCancel').onclick=()=>d.close(); d.showModal(); };
  $('#pBtnStep').onclick=()=>{ const p=curProc(); if(!p) return; if(!p.lanes.length){ toast('Nejdřív přidejte dráhu.'); return; } const n=prompt('Název kroku:'); if(!n||!n.trim()) return;
    const sel0=procSel&&procSel.t==='step'&&p.steps.find(x=>x.id===procSel.id); const lane=procSel&&procSel.t==='lane'?procSel.id:(sel0?sel0.lane:p.lanes[0].id);
    const row=sel0?sel0.row+1:Math.max(-1,...p.steps.map(x=>x.row))+1; if(sel0) p.steps.forEach(x=>{ if(x.row>=row) x.row++; });
    const s={id:uid('s'),lane,row,name:n.trim(),kind:'step',sys:null,ch:null,note:'',sub:''}; p.steps.push(s); if(sel0) p.flows.push({id:uid('w'),from:sel0.id,to:s.id,label:''}); procSel={t:'step',id:s.id}; save('proces','nový krok: '+s.name); };
  $('#pBtnConnect').onclick=()=>setPConnect(!document.body.classList.contains('pconnecting'));
  $('#pBtnRoles').onclick=openRolesDlg;
  $('#pzoom').oninput=e=>{ pzoom=+e.target.value/100; $('#pzoomVal').textContent=e.target.value+' %'; $('#pCanvas').style.transform=`scale(${pzoom})`; };
  $('#pWrap').addEventListener('pointerdown',e=>{ if(e.target.closest('.pstep,.pf,.phead')) return; if(procSel){ procSel=null; render(); } });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&document.body.classList.contains('pconnecting')){ setPConnect(false); e.stopPropagation(); } },true);
}
