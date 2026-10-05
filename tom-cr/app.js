// TOM ÚRÚ ČR – cílový provozní model úřadu od 1. 1. 2027.
// Samostatná aplikace: model v organigram_state.id='tom-cr'; organigram ÚRÚ ČR ('main') se jen čte (živě).
const APP_VERSION='2026-10-05.1';
const APP_ID='tom-cr', STATE_ID='tom-cr', ORG_ID='main', LS_KEY='uru-tom-cr-v1';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>(+v||0).toLocaleString('cs-CZ',{maximumFractionDigits:1});
const uid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
const today=()=>new Date().toISOString().slice(0,10);

const TYPES={vykon:'výkon agendy',odvolani:'odvolání a přezkum',metodika:'metodika a legislativa',rizeni:'řízení',podpora:'podpůrná služba',priprava:'příprava změny'};
const STATUS={navrh:'návrh',diskuse:'v diskusi',ok:'odsouhlaseno',sporne:'sporné'};
const STATUS_COLOR={navrh:'#9AA4B2',diskuse:'#2563EB',ok:'#067647',sporne:'#B42318'};
const ROLES={own:'vlastník',do:'vykonává',sup:'podporuje'};
const LINK_KINDS={ridi:['řídí','#1B2430'],metodika:['metodicky vede','#7C3AED'],odvolani:['přezkoumává','#B42318'],podklad:['dává podklad','#0E9AA7'],
  sluzba:['poskytuje službu','#C79400'],spis:['předává spis','#ED7D31'],zpetna:['zpětná vazba','#4D8B31'],vyvoj:['vývoj do 2028','#9AA4B2']};
const LEVELS={sekce:'sekce',odbor:'odbor',unit:'útvar (včetně podřízených)'};
const LEVEL_LBL={predseda:'úřad',sekce:'sekce',odbor:'odbor',odd:'oddělení',up:'územní pracoviště'};
const LOCATIONS=[['MD','MD – sídlo'],['LET','Letenská'],['BR','Brno'],['OL','Olomouc'],['PL','Plzeň'],['CB','České Budějovice'],['LTS','Letiště']];
const LOC=Object.fromEntries(LOCATIONS);
const PALETTE=['#4472C4','#B42318','#70AD47','#0E9AA7','#7C3AED','#C79400','#1B2430','#ED7D31','#C25BB9','#5D6B7A'];
const SEV={err:'chyba',warn:'varování',info:'informace'};
const BW=230;

let state=null, ROLE={name:'admin',org:true};
let org={units:[],people:{}}, U={}, KIDS={};
let sel=null;            // {t:'f'|'l'|'u'|'g', id}
let connectFrom=null, conflicts=[], zoom=0.8;

// ---------- organigram ÚRÚ ČR (jen ke čtení) ----------
function setOrg(d){
  org={units:(d&&d.units)||[],people:(d&&d.people)||{}};
  if(d&&d.ws==='kr') org.units=d.krUnits||[];      // pojistka: vždy ÚRÚ ČR
  U={}; KIDS={}; org.units.forEach(u=>{ U[u.id]=u; (KIDS[u.parent]=KIDS[u.parent]||[]).push(u.id); });
}
const kids=id=>KIDS[id]||[];
function subtree(id){ const out=[]; const w=x=>{ out.push(x); kids(x).forEach(w); }; if(U[id]) w(id); return out; }
function upChain(id){ const out=[]; let c=U[id]; while(c){ out.push(c.id); c=U[c.parent]; } return out; }
function ancestorAt(id,level){ let c=U[id]; while(c){ if(c.level===level) return c.id; c=U[c.parent]; } return null; }
function unitLoc(id){ let c=U[id]; while(c){ if(c.loc) return c.loc; c=U[c.parent]; } return null; }
const persons=p=>Array.isArray(p.persons)?p.persons:(p.person?[p.person]:[]);
function unitCap(id){ const u=U[id]; let cap=0,occ=0,n=0,f=0; (u&&u.positions||[]).forEach(p=>{ n++; cap+=(+p.fte>0?+p.fte:1); const ps=persons(p).filter(x=>org.people[x]); if(ps.length) f++;
  ps.forEach(x=>{ const v=parseFloat(String(org.people[x].fte??'1').replace(',','.')); occ+=isNaN(v)||v<=0?1:Math.min(v,1); }); }); return {cap,occ,n,f}; }
function shortName(id){ const u=U[id]; if(!u) return '?'; return u.name.replace(/^Vrchní ředitel sekce – sekce /,'sekce ').replace(/^Samostatné oddělení /,'s. odd. ').replace(/^Oddělení /,'odd. ').replace(/^Odbor /,'o. ').replace(/^Předseda\/předsedkyně .*/,'předseda'); }
function unitPath(id){ return upChain(id).reverse().map(x=>U[x].name).slice(1).join(' › ')||(U[id]?U[id].name:''); }
function orgOrder(){ const out=[]; const w=(id,d)=>{ out.push([id,d]); kids(id).forEach(k=>w(k,d+1)); }; (KIDS[null]||KIDS[undefined]||[]).forEach(r=>w(r,0)); return out; }

// ---------- stav modelu ----------
function seedState(){
  const S=window.TOM_SEED; const st={app:APP_ID,groups:JSON.parse(JSON.stringify(S.groups)),funcs:{},links:[],rules:[],proposals:[],versions:[],ignored:{},show2028:true,colorBy:'conf'};
  S.funcs.forEach(f=>{ st.funcs[f.id]={id:f.id,name:f.name,group:f.g,type:f.type,period:f.p||'2027',refs:f.refs||'',desc:f.desc||'',fte:null,locs:[],status:'navrh',notes:[],
    assign:(f.a||[]).map(([u,r])=>({unit:u,role:r,name:U[u]?U[u].name:''}))}; });
  S.links.forEach(([a,b,k,l])=>st.links.push({id:uid('l'),from:a,to:b,kind:k,label:l||''}));
  S.rules.forEach(r=>st.rules.push({...r,on:true}));
  autoLayout(st); return st;
}
// rozmístění po oblastech (4 sloupce); h = skutečné výšky krabiček, pokud jsou známé
function autoLayout(st,h){ const cols=4, GW=BW+50, GAP=14; let y0=50; h=h||{};
  for(let i=0;i<st.groups.length;i+=cols){ let rowH=0;
    st.groups.slice(i,i+cols).forEach((g,ci)=>{ const fs=Object.values(st.funcs).filter(f=>f.group===g.id).sort((a,b)=>(a.period>b.period)-(a.period<b.period));
      let y=y0; fs.forEach(f=>{ f.x=30+ci*GW; f.y=y; y+=(h[f.id]||84)+GAP; }); rowH=Math.max(rowH,y-y0); });
    y0+=rowH+70; }
  st._layout=!Object.keys(h).length; }
const F=id=>state.funcs[id];
const activeFuncs=()=>Object.values(state.funcs).filter(f=>f.period!=='2028');

// ---------- undo / redo ----------
const UNDO_MAX=60; let undoStack=[],redoStack=[],baseline=null,restoring=false;
const snap=()=>JSON.stringify({groups:state.groups,funcs:state.funcs,links:state.links,rules:state.rules,proposals:state.proposals,ignored:state.ignored});
function markBaseline(){ baseline=snap(); }
function save(action,detail){ if(!restoring&&baseline!==null){ const now=snap(); if(now!==baseline){ undoStack.push(baseline); if(undoStack.length>UNDO_MAX) undoStack.shift(); redoStack=[]; } baseline=now; }
  if(action) logChange(action,detail); updateUndo(); persist(); render(); }
function applySnap(j){ const o=JSON.parse(j); restoring=true; Object.assign(state,o); baseline=snap(); restoring=false; persist(); render(); }
function undo(){ if(!ROLE.org||!undoStack.length) return; redoStack.push(snap()); applySnap(undoStack.pop()); logChange('zpět','vrácena změna'); updateUndo(); }
function redo(){ if(!ROLE.org||!redoStack.length) return; undoStack.push(snap()); applySnap(redoStack.pop()); logChange('znovu','obnovena změna'); updateUndo(); }
function updateUndo(){ $('#btnUndo').disabled=!undoStack.length; $('#btnRedo').disabled=!redoStack.length; }
document.addEventListener('keydown',e=>{ const t=e.target; if(t&&/INPUT|TEXTAREA|SELECT/.test(t.tagName)) return; if(document.querySelector('dialog[open]')) return;
  if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==='z'){e.preventDefault();undo();}
  else if((e.ctrlKey||e.metaKey)&&(e.key.toLowerCase()==='y'||(e.shiftKey&&e.key.toLowerCase()==='z'))){e.preventDefault();redo();}
  else if(e.key==='Escape'){ if(document.body.classList.contains('presenting')) present(false); else if(connectFrom||document.body.classList.contains('connecting')) setConnect(false); else { sel=null; render(); } }
  else if((e.key==='Delete'||e.key==='Backspace')&&sel&&ROLE.org){ if(sel.t==='l') delLink(sel.id); } });

// ---------- persistence (Supabase) ----------
let sb=null,currentUser=null,version=0,saveTimer=null,saving=false,dirty=false,pendingLog=[];
function setDot(c,t){ const d=$('#syncDot'); d.className='dot '+(c||''); d.title=t||''; }
function persist(){ try{ localStorage.setItem(LS_KEY,JSON.stringify(state)); }catch(e){} if(!sb) return; dirty=true; setDot('busy','ukládám…'); clearTimeout(saveTimer); saveTimer=setTimeout(flush,700); }
async function flush(){ if(!sb||!currentUser||saving||!dirty) return; saving=true; dirty=false;
  try{ const {data,error}=await sb.from('organigram_state').update({data:state,version:version+1,updated_at:new Date().toISOString(),updated_by:currentUser.email}).eq('id',STATE_ID).eq('version',version).select('version');
    if(error) throw error;
    if(!data||!data.length){ setDot('err','konflikt verzí'); toast('Model byl mezitím změněn jinde – načítám aktuální verzi.'); await loadRemote(); render(); saving=false; return; }
    version=data[0].version; setDot('','uloženo '+new Date().toLocaleTimeString('cs-CZ'));
    if(pendingLog.length){ const r=await sb.from('organigram_log').insert(pendingLog.splice(0)); if(r.error) console.warn(r.error); }
  }catch(e){ console.error(e); setDot('err','uložení selhalo'); toast('Uložení selhalo. Zkuste to znovu, nebo použijte „Uložit (json)“.'); dirty=true; }
  saving=false; if(dirty){ clearTimeout(saveTimer); saveTimer=setTimeout(flush,1500); } }
function logChange(action,detail){ pendingLog.push({app:APP_ID,user_email:currentUser?currentUser.email:null,action,detail}); }
async function loadOrg(){ const {data,error}=await sb.from('organigram_state').select('data').eq('id',ORG_ID).maybeSingle(); if(error) throw error; setOrg(data&&data.data); }
async function loadRemote(){
  const {data,error}=await sb.from('organigram_state').select('data,version').eq('id',STATE_ID).maybeSingle(); if(error) throw error;
  if(data&&data.data&&data.data.funcs){ state=data.data; version=data.version||0; }
  else { state=seedState(); version=0; const r=await sb.from('organigram_state').upsert({id:STATE_ID,data:state,version:0,updated_by:currentUser.email}); if(r.error) throw r.error;
    logChange('založení','model TOM ÚRÚ ČR založen z výchozího návrhu'); setTimeout(()=>toast('Model založen z výchozího návrhu. Vše je pracovní návrh k diskusi.'),400); }
  normalize(); markBaseline();
}
function normalize(){ ['groups','links','rules','proposals','versions'].forEach(k=>state[k]=state[k]||[]); state.funcs=state.funcs||{}; state.ignored=state.ignored||{};
  if(state.show2028===undefined) state.show2028=true; state.colorBy=state.colorBy||'conf'; state.view=state.view||'map';
  Object.values(state.funcs).forEach(f=>{ f.assign=f.assign||[]; f.notes=f.notes||[]; f.locs=f.locs||[]; f.status=f.status||'navrh'; f.period=f.period||'2027'; }); }

// ---------- kontroly rozporů ----------
function capUnits(f){ const as=(f.assign||[]).filter(a=>U[a.unit]); const d=as.filter(a=>a.role==='do'); return (d.length?d:as.filter(a=>a.role==='own')).map(a=>a.unit); }
function check(){
  const out=[]; const act=activeFuncs();
  const add=(sev,code,text,o={})=>{ const key=[code,o.f||'',o.f2||'',o.u||'',o.r||'',o.loc||''].join(':'); out.push({sev,code,text,key,...o,ignored:!!state.ignored[key]}); };
  // sdílení kapacity útvarů mezi funkcemi
  const covers={}; const capSet={};
  act.forEach(f=>{ const s=new Set(); capUnits(f).forEach(u=>subtree(u).forEach(x=>s.add(x))); capSet[f.id]=s; s.forEach(x=>covers[x]=(covers[x]||0)+1); });
  act.forEach(f=>{
    const nm=`„${f.name}“`;
    f.assign.filter(a=>!U[a.unit]).forEach(a=>add('err','orphan',`${nm} je přiřazena útvaru, který v organigramu už není${a.name?' ('+a.name+')':''}.`,{f:f.id,u:a.unit}));
    const as=f.assign.filter(a=>U[a.unit]);
    if(!as.length){ add('err','none',`${nm} nemá v organigramu žádný útvar.`,{f:f.id}); return; }
    const own=as.filter(a=>a.role==='own');
    if(!own.length) add('err','noown',`${nm} nemá vlastníka.`,{f:f.id});
    else if(own.length>1) add('warn','multiown',`${nm} má více vlastníků: ${own.map(a=>shortName(a.unit)).join(', ')}.`,{f:f.id});
    if(f.fte>0){ let cap=0,occ=0; capSet[f.id].forEach(x=>{ const c=unitCap(x); cap+=c.cap/covers[x]; occ+=c.occ/covers[x]; });
      if(cap<f.fte*0.9) add('warn','cap',`${nm}: útvary mají ${fmt(cap)} FTE míst, model počítá s ${fmt(f.fte)} FTE.`,{f:f.id});
      else if(occ<f.fte*0.9) add('info','occ',`${nm}: místa jsou obsazena na ${fmt(occ)} FTE z potřebných ${fmt(f.fte)} FTE.`,{f:f.id}); }
    if(f.locs.length){ const have=new Set(); as.filter(a=>a.role!=='sup').forEach(a=>subtree(a.unit).forEach(x=>{ const l=unitLoc(x); if(l) have.add(l); }));
      f.locs.filter(l=>!have.has(l)).forEach(l=>add('warn','loc',`${nm} má být vykonávána i v lokalitě ${LOC[l]}, ale žádný její útvar tam nesídlí.`,{f:f.id,loc:l})); }
  });
  state.rules.filter(r=>r.on!==false).forEach(r=>{
    const perf=ids=>ids.filter(id=>F(id)&&F(id).period!=='2028').flatMap(id=>F(id).assign.filter(a=>U[a.unit]&&a.role!=='sup').map(a=>({f:id,u:a.unit})));
    const A=perf(r.a||[]), B=perf(r.b||[]), hit={};
    A.forEach(a=>B.forEach(b=>{ if(a.f===b.f) return; let x=null;
      if(r.level==='unit'){ if(upChain(a.u).includes(b.u)) x=b.u; else if(upChain(b.u).includes(a.u)) x=a.u; }
      else { const p=ancestorAt(a.u,r.level), q=ancestorAt(b.u,r.level); if(p&&p===q) x=p; }
      if(!x) return; const h=hit[x]=hit[x]||{A:new Set(),B:new Set()}; h.A.add(a.f); h.B.add(b.f); }));
    Object.entries(hit).forEach(([x,h])=>{ const nm=s=>[...s].map(id=>'„'+F(id).name+'“').join(', ');
      add('err','rule',`Pravidlo „${r.name}“: ${nm(h.A)} a ${nm(h.B)} spadají pod stejný útvar – ${U[x].name}.`,{r:r.id,u:x,f:[...h.A][0],fs:[...h.A,...h.B]}); });
  });
  const covered=new Set(); act.forEach(f=>f.assign.forEach(a=>{ if(U[a.unit]){ subtree(a.unit).forEach(x=>covered.add(x)); upChain(a.unit).forEach(x=>covered.add(x)); } }));
  org.units.forEach(u=>{ if(!covered.has(u.id)&&(u.positions||[]).length) add('warn','unit',`Útvar „${u.name}“ nemá v modelu žádnou funkci.`,{u:u.id}); });
  return out;
}
const live=()=>conflicts.filter(c=>!c.ignored);
const touches=(c,id)=>c.f===id||c.f2===id||(c.fs&&c.fs.includes(id));
function funcSev(id){ const cs=live().filter(c=>touches(c,id)); return cs.some(c=>c.sev==='err')?'err':cs.some(c=>c.sev==='warn')?'warn':cs.length?'info':''; }
function unitSev(id){ const cs=live().filter(c=>c.u===id); return cs.some(c=>c.sev==='err')?'err':cs.some(c=>c.sev==='warn')?'warn':''; }

// ---------- vykreslení ----------
function render(){
  if(!state) return; conflicts=check();
  const L=live(), ne=L.filter(c=>c.sev==='err').length, nw=L.filter(c=>c.sev==='warn').length, act=activeFuncs();
  const cov=act.filter(f=>f.assign.some(a=>U[a.unit])).length;
  $('#stats').innerHTML=`<div class="stat"><b>${act.length}</b><span>funkcí 2027</span></div><div class="stat"><b>${cov}/${act.length}</b><span>pokryto organigramem</span></div>
    <div class="stat ${ne?'bad':''}"><b>${ne}</b><span>chyb</span></div><div class="stat ${nw?'warnc':''}"><b>${nw}</b><span>varování</span></div>
    <div class="stat"><b>${state.proposals.filter(p=>p.status==='navrh'||p.status==='predano').length}</b><span>otevřených návrhů</span></div>`;
  $('#tabConf').textContent='Rozpory'+(ne+nw?` (${ne+nw})`:'');
  const v=state.view; $$('.viewsw button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
  ['map','org','conf','prop','ver'].forEach(x=>$('#v-'+x).hidden=x!==v);
  document.body.dataset.view=v;
  ({map:renderMap,org:renderOrg,conf:renderConf,prop:renderProp,ver:renderVer})[v]();
  renderSide();
}
function setView(v){ state.view=v; if(v!=='map') setConnect(false); render(); }

// --- mapa funkcí ---
function renderMap(){
  $('#show2028').checked=!!state.show2028; $('#colorBy').value=state.colorBy; $('#zoom').value=Math.round(zoom*100); $('#zoomVal').textContent=Math.round(zoom*100)+' %';
  const wrap=$('#canvasWrap'), cv=$('#canvas'); const sl=wrap.scrollLeft, st=wrap.scrollTop; cv.innerHTML='';
  cv.style.transform=`scale(${zoom})`;
  const fs=Object.values(state.funcs).filter(f=>state.show2028||f.period!=='2028');
  const boxes={};
  fs.forEach(f=>{ const g=state.groups.find(x=>x.id===f.group); const b=document.createElement('div'); boxes[f.id]=b;
    const sev=funcSev(f.id); const cs=live().filter(c=>touches(c,f.id));
    b.className='fbox'+(f.period==='2028'?' p2028':'')+(state.colorBy==='conf'&&f.period!=='2028'?' sev-'+(sev||'ok'):'')+(sel&&sel.t==='f'&&sel.id===f.id?' sel':'')+(connectFrom===f.id?' from':'');
    if(state.colorBy==='status') b.style.boxShadow=`inset 4px 0 0 ${STATUS_COLOR[f.status]}`;
    b.style.left=f.x+'px'; b.style.top=f.y+'px'; b.style.borderTopColor=g?g.color:'#999'; b.dataset.fid=f.id;
    const own=f.assign.filter(a=>a.role==='own'), rest=f.assign.filter(a=>a.role!=='own');
    const chips=[...own,...rest].slice(0,4).map(a=>`<span class="uchip r-${a.role}${U[a.unit]?'':' gone'}" title="${esc(ROLES[a.role]+': '+(U[a.unit]?unitPath(a.unit):(a.name||a.unit)+' (v organigramu už není)'))}">${esc(U[a.unit]?shortName(a.unit):(a.name||'?'))}</span>`).join('')+(f.assign.length>4?`<span class="uchip more">+${f.assign.length-4}</span>`:'');
    const ne=cs.filter(c=>c.sev==='err').length, nw=cs.filter(c=>c.sev==='warn').length;
    b.innerHTML=`<div class="fn">${esc(f.name)}</div><div class="fm"><span class="st" style="background:${STATUS_COLOR[f.status]}" title="${STATUS[f.status]}"></span>${esc(TYPES[f.type]||'')}${f.period==='2028'?' · <b>2028</b>':''}${f.refs?' · '+esc(f.refs):''}${f.fte?' · '+fmt(f.fte)+' FTE':''}
      ${ne?`<span class="cb err" title="chyby">${ne}</span>`:''}${nw?`<span class="cb warn" title="varování">${nw}</span>`:''}${f.notes.length?`<span class="cb note" title="poznámky z diskuse">✎${f.notes.length}</span>`:''}</div>
      <div class="fu">${chips||(f.period==='2028'?'<span class="hint">výhled soustavy</span>':'<span class="hint">bez útvaru</span>')}</div>`;
    b.addEventListener('pointerdown',e=>boxDown(e,f));
    cv.appendChild(b); });
  if(state._layout&&fs.length&&boxes[fs[0].id].offsetHeight){ const h={}; fs.forEach(f=>h[f.id]=boxes[f.id].offsetHeight); autoLayout(state,h); fs.forEach(f=>{ boxes[f.id].style.left=f.x+'px'; boxes[f.id].style.top=f.y+'px'; }); persist(); }
  // rámečky oblastí podle skutečných rozměrů krabiček
  state.groups.forEach(g=>{ const ms=fs.filter(f=>f.group===g.id); if(!ms.length) return;
    let x1=1e9,y1=1e9,x2=-1e9,y2=-1e9; ms.forEach(f=>{ const b=boxes[f.id]; x1=Math.min(x1,f.x); y1=Math.min(y1,f.y); x2=Math.max(x2,f.x+b.offsetWidth); y2=Math.max(y2,f.y+b.offsetHeight); });
    const fr=document.createElement('div'); fr.className='gframe'+(sel&&sel.t==='g'&&sel.id===g.id?' sel':''); fr.style.cssText=`left:${x1-14}px;top:${y1-34}px;width:${x2-x1+28}px;height:${y2-y1+48}px;border-color:${g.color}`;
    fr.innerHTML=`<div class="gl" style="color:${g.color}" title="${esc(g.name)} – táhnutím přesunete celou oblast">${esc(g.name)}</div>`; fr.querySelector('.gl').addEventListener('pointerdown',e=>groupDown(e,g,ms));
    cv.insertBefore(fr,cv.firstChild); });
  // vazby
  let W=600,H=400; fs.forEach(f=>{ W=Math.max(W,f.x+BW+200); H=Math.max(H,f.y+boxes[f.id].offsetHeight+160); }); cv.style.width=W+'px'; cv.style.height=H+'px';
  const NS='http://www.w3.org/2000/svg'; const svg=document.createElementNS(NS,'svg'); svg.setAttribute('class','links'); svg.setAttribute('width',W); svg.setAttribute('height',H);
  let defs='<defs>'+Object.entries(LINK_KINDS).map(([k,[,c]])=>`<marker id="ar-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="${c}"/></marker>`).join('')+'</defs>';
  svg.innerHTML=defs;
  const rect=id=>{ const f=F(id), b=boxes[id]; return {x:f.x,y:f.y,w:b.offsetWidth,h:b.offsetHeight}; };
  const edge=(r,tx,ty)=>{ const cx=r.x+r.w/2, cy=r.y+r.h/2, dx=tx-cx, dy=ty-cy; if(!dx&&!dy) return [cx,cy]; const s=Math.min(dx?Math.abs(r.w/2/dx):1e9, dy?Math.abs(r.h/2/dy):1e9); return [cx+dx*s,cy+dy*s]; };
  state.links.forEach(l=>{ if(!boxes[l.from]||!boxes[l.to]) return; const a=rect(l.from), b=rect(l.to); const [k0,c]=LINK_KINDS[l.kind]||LINK_KINDS.podklad;
    const [x1,y1]=edge(a,b.x+b.w/2,b.y+b.h/2), [x2,y2]=edge(b,a.x+a.w/2,a.y+a.h/2);
    const gEl=document.createElementNS(NS,'g'); gEl.setAttribute('class','lk'+(sel&&sel.t==='l'&&sel.id===l.id?' sel':'')); gEl.dataset.lid=l.id;
    gEl.innerHTML=`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="hit"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${sel&&sel.id===l.id?3:1.8}" ${l.kind==='vyvoj'?'stroke-dasharray="6 4"':''} marker-end="url(#ar-${l.kind})"/>`+
      `<text x="${(x1+x2)/2}" y="${(y1+y2)/2-4}" fill="${c}" text-anchor="middle">${esc(l.label||k0)}</text>`;
    gEl.addEventListener('pointerdown',e=>{ e.stopPropagation(); sel={t:'l',id:l.id}; render(); });
    svg.appendChild(gEl); });
  cv.insertBefore(svg,cv.firstChild);
  wrap.scrollLeft=sl; wrap.scrollTop=st;
}
// tažení krabiček (myš i dotyk)
function dragItems(e,items,onClick){ if(e.button>0) return; const sx=e.clientX, sy=e.clientY; let moved=false; const t=e.currentTarget; try{ t.setPointerCapture(e.pointerId); }catch(_){}
  const mv=ev=>{ const dx=(ev.clientX-sx)/zoom, dy=(ev.clientY-sy)/zoom; if(!moved&&Math.abs(dx)+Math.abs(dy)<4) return; if(!ROLE.org) return; moved=true;
    items.forEach(it=>{ it.f.x=Math.max(0,Math.round(it.x0+dx)); it.f.y=Math.max(20,Math.round(it.y0+dy)); const b=document.querySelector(`.fbox[data-fid="${it.f.id}"]`); if(b){ b.style.left=it.f.x+'px'; b.style.top=it.f.y+'px'; } }); };
  const up=()=>{ t.removeEventListener('pointermove',mv); t.removeEventListener('pointerup',up); t.removeEventListener('pointercancel',up);
    if(moved){ items.forEach(it=>{ it.f.x=Math.round(it.f.x/10)*10; it.f.y=Math.round(it.f.y/10)*10; }); save(); } else onClick(); };
  t.addEventListener('pointermove',mv); t.addEventListener('pointerup',up); t.addEventListener('pointercancel',up); }
function boxDown(e,f){ e.stopPropagation(); if(document.body.classList.contains('connecting')){ connectClick(f.id); return; }
  dragItems(e,[{f,x0:f.x,y0:f.y}],()=>{ sel={t:'f',id:f.id}; render(); }); }
function groupDown(e,g,ms){ e.stopPropagation(); dragItems(e,ms.map(f=>({f,x0:f.x,y0:f.y})),()=>{ sel={t:'g',id:g.id}; render(); }); }
function setConnect(on){ connectFrom=null; document.body.classList.toggle('connecting',!!on); $('#btnConnect').classList.toggle('on',!!on); $('#connHint').hidden=!on; if(state&&state.view==='map') renderMap(); }
function connectClick(id){ if(!connectFrom){ connectFrom=id; $('#connHint').textContent='Teď klikněte na cílovou funkci (Esc = konec).'; renderMap(); return; }
  if(connectFrom===id) return; const from=connectFrom; connectFrom=null; $('#connHint').textContent='Klikněte na funkci, ze které vazba vede.';
  openLinkDlg(null,from,id); }
function openLinkDlg(l,from,to){ const d=$('#dlgLink'); $('#lkKind').innerHTML=Object.entries(LINK_KINDS).map(([k,[n]])=>`<option value="${k}">${n}</option>`).join('');
  $('#lkKind').value=l?l.kind:'podklad'; $('#lkLabel').value=l?l.label:''; $('#lkWhat').textContent=`${F(l?l.from:from).name} → ${F(l?l.to:to).name}`;
  $('#lkOk').onclick=()=>{ if(l){ l.kind=$('#lkKind').value; l.label=$('#lkLabel').value.trim(); save('vazba','upravena: '+$('#lkWhat').textContent); }
    else { const nl={id:uid('l'),from,to,kind:$('#lkKind').value,label:$('#lkLabel').value.trim()}; state.links.push(nl); sel={t:'l',id:nl.id}; save('vazba','nová: '+$('#lkWhat').textContent); } d.close(); };
  $('#lkCancel').onclick=()=>{ d.close(); renderMap(); }; d.showModal(); }
function delLink(id){ const l=state.links.find(x=>x.id===id); if(!l) return; state.links=state.links.filter(x=>x!==l); sel=null; save('vazba','smazána: '+(F(l.from)||{}).name+' → '+(F(l.to)||{}).name); }

// --- organigram s funkcemi ---
function renderOrg(){ const c=$('#v-org'); const st=c.scrollTop; c.innerHTML='';
  if(!org.units.length){ c.innerHTML='<div class="empty">Organigram ÚRÚ ČR se nepodařilo načíst.</div>'; return; }
  const byUnit={}; Object.values(state.funcs).forEach(f=>f.assign.forEach(a=>(byUnit[a.unit]=byUnit[a.unit]||[]).push({f,a})));
  const nUn=live().filter(x=>x.code==='unit').length;
  c.insertAdjacentHTML('beforeend',`<div class="orghint">Organigram ÚRÚ ČR (živě, jen ke čtení). Klikněte na útvar a přiřaďte mu funkce. ${nUn?`<b class="warnc">${nUn} útvarů bez funkce.</b>`:'Všechny útvary mají funkci.'}</div>`);
  orgOrder().forEach(([id,d])=>{ const u=U[id]; const cap=unitCap(id); const sev=unitSev(id);
    const row=document.createElement('div'); row.className='orow lv-'+u.level+(sev?' sev-'+sev:'')+(sel&&sel.t==='u'&&sel.id===id?' sel':''); row.style.paddingLeft=(10+d*22)+'px';
    const fs=(byUnit[id]||[]).sort((x,y)=>(x.a.role!=='own')-(y.a.role!=='own'));
    row.innerHTML=`<span class="on">${esc(u.name)}<span class="lvl">${LEVEL_LBL[u.level]||''}${unitLoc(id)?' · '+esc(LOC[unitLoc(id)]||unitLoc(id)):''}</span></span>
      <span class="ocap" title="obsazená / systemizovaná místa">${cap.f}/${cap.n}</span>
      <span class="ofs">${fs.map(({f,a})=>`<span class="fchip r-${a.role}${f.period==='2028'?' p2028':''}" data-fid="${f.id}" title="${esc(ROLES[a.role])}">${a.role==='own'?'★ ':''}${esc(f.name)}</span>`).join('')||(sev?'<span class="hint">bez funkce</span>':'')}</span>`;
    row.onclick=e=>{ const fc=e.target.closest('.fchip'); if(fc){ sel={t:'f',id:fc.dataset.fid}; } else sel={t:'u',id}; render(); };
    c.appendChild(row); });
  c.scrollTop=st; }

// --- rozpory a pravidla ---
function renderConf(){ const c=$('#v-conf'); const st=c.scrollTop;
  const item=x=>`<div class="citem sev-${x.sev}" data-key="${esc(x.key)}"><span class="sv">${SEV[x.sev]}</span><span class="ct">${esc(x.text)}${state.proposals.some(p=>p.key===x.key&&p.status!=='zamitnuto')?' <span class="tag">návrh změny podán</span>':''}${x.ignored?`<div class="why">Přijato: ${esc(state.ignored[x.key].why||'')} <span class="muted">(${esc(state.ignored[x.key].who||'')}, ${esc(state.ignored[x.key].t||'')})</span></div>`:''}</span>
    <span class="ca">${x.f||x.u?'<button class="small" data-a="show">Zobrazit</button>':''}${ROLE.org?(x.ignored?'<button class="small" data-a="unign">Zrušit přijetí</button>':`<button class="small" data-a="ign" title="Rozpor je vědomě přijat (např. na základě diskuse)">Přijmout odchylku</button><button class="small" data-a="prop">→ návrh změny</button>`):''}</span></div>`;
  const L=live(), I=conflicts.filter(x=>x.ignored);
  const sec=(t,arr)=>arr.length?`<h3>${t} <span class="muted">(${arr.length})</span></h3>`+arr.map(item).join(''):'';
  c.innerHTML=`<div class="pad"><h2>Rozpory mezi modelem a organigramem</h2><p class="muted">Kontrolují se jen funkce platné od 1. 1. 2027. Organigram se čte živě – po úpravě v aplikaci ÚRÚ ČR se rozpory přepočítají samy.</p>
    ${L.length?'':'<p class="okmsg">Bez rozporů.</p>'}${sec('Chyby',L.filter(x=>x.sev==='err'))}${sec('Varování',L.filter(x=>x.sev==='warn'))}${sec('Informace',L.filter(x=>x.sev==='info'))}${sec('Přijaté odchylky',I)}
    <h2 style="margin-top:28px">Pravidla modelu</h2><p class="muted">Pravidlo „oddělit“ hlásí chybu, když funkce ze skupiny A a B vykonávají útvary pod stejnou sekcí / odborem / útvarem.</p>
    <div id="rules">${state.rules.map(r=>`<div class="rule${r.on===false?' off':''}" data-rid="${r.id}"><label><input type="checkbox" ${r.on!==false?'checked':''} ${ROLE.org?'':'disabled'}> <b>${esc(r.name)}</b></label> <span class="muted">– oddělit na úrovni: ${LEVELS[r.level]}</span>
      <div class="muted">${esc(r.desc||'')}</div><div class="rab"><span>A: ${(r.a||[]).map(id=>F(id)?esc(F(id).name):'?').join('; ')}</span><span>B: ${(r.b||[]).map(id=>F(id)?esc(F(id).name):'?').join('; ')}</span></div>
      ${ROLE.org?'<button class="small" data-a="edit">Upravit</button> <button class="small" data-a="del" style="color:var(--danger)">Smazat</button>':''}</div>`).join('')}</div>
    ${ROLE.org?'<button id="ruleAdd">+ pravidlo</button>':''}</div>`;
  c.querySelectorAll('.citem').forEach(el=>{ const x=conflicts.find(k=>k.key===el.dataset.key);
    el.querySelectorAll('button').forEach(b=>b.onclick=()=>{ const a=b.dataset.a;
      if(a==='show'){ if(x.f){ sel={t:'f',id:x.f}; setView('map'); focusFunc(x.f); } else { sel={t:'u',id:x.u}; setView('org'); } }
      if(a==='ign'){ const why=prompt('Proč je odchylka přijata? (např. „dohodnuto na poradě 12. 10.“)',''); if(why===null) return; state.ignored[x.key]={why,who:currentUser?currentUser.email:'',t:today()}; save('odchylka přijata',x.text); }
      if(a==='unign'){ delete state.ignored[x.key]; save('odchylka zrušena',x.text); }
      if(a==='prop'){ state.proposals.push({id:uid('n'),text:proposalText(x),unit:x.u||null,func:x.f||null,key:x.key,status:'navrh',who:currentUser?currentUser.email:'',t:today()}); save('návrh změny',x.text); toast('Návrh změny organigramu přidán.'); }
    }); });
  c.querySelectorAll('.rule').forEach(el=>{ const r=state.rules.find(q=>q.id===el.dataset.rid);
    el.querySelector('input').onchange=e=>{ r.on=e.target.checked; save('pravidlo',(r.on?'zapnuto: ':'vypnuto: ')+r.name); };
    el.querySelectorAll('button').forEach(b=>b.onclick=()=>{ if(b.dataset.a==='edit') openRuleDlg(r); else if(confirm('Smazat pravidlo „'+r.name+'“?')){ state.rules=state.rules.filter(q=>q!==r); save('pravidlo','smazáno: '+r.name); } }); });
  if($('#ruleAdd')) $('#ruleAdd').onclick=()=>openRuleDlg(null);
  c.scrollTop=st; }
function proposalText(x){ const f=x.f?F(x.f):null;
  switch(x.code){ case 'none': return `Určit útvar, který bude vykonávat „${f.name}“ (případně zřídit nový).`;
    case 'noown': return `Určit vlastníka funkce „${f.name}“.`; case 'multiown': return `Ponechat jednoho vlastníka funkce „${f.name}“.`;
    case 'orphan': return `Funkce „${f.name}“ ztratila útvar – přiřadit nový útvar.`;
    case 'cap': return `Posílit útvary pro „${f.name}“ o místa (nebo snížit potřebu v modelu).`; case 'occ': return `Doobsadit místa pro „${f.name}“.`;
    case 'loc': return `Zajistit výkon „${f.name}“ v lokalitě ${LOC[x.loc]}.`;
    case 'rule': return `Organizačně oddělit ${x.fs.filter(id=>F(id)).map(id=>'„'+F(id).name+'“').slice(0,1).join('')} od ostatních funkcí pod útvarem ${U[x.u]?U[x.u].name:'?'} (pravidlo ${(state.rules.find(r=>r.id===x.r)||{}).name||''}).`;
    case 'unit': return `Útvar „${U[x.u]?U[x.u].name:'?'}“: doplnit funkci do modelu, nebo útvar v organigramu zrušit/sloučit.`; }
  return x.text; }
function openRuleDlg(r){ const d=$('#dlgRule'); const fs=Object.values(state.funcs).filter(f=>f.period!=='2028');
  $('#ruName').value=r?r.name:''; $('#ruDesc').value=r?r.desc||'':''; $('#ruLevel').innerHTML=Object.entries(LEVELS).map(([k,v])=>`<option value="${k}">${v}</option>`).join(''); $('#ruLevel').value=r?r.level:'sekce';
  const list=(el,on)=>{ el.innerHTML=fs.map(f=>`<label><input type="checkbox" value="${f.id}" ${on.includes(f.id)?'checked':''}> ${esc(f.name)}</label>`).join(''); };
  list($('#ruA'),r?r.a||[]:[]); list($('#ruB'),r?r.b||[]:[]);
  $('#ruOk').onclick=()=>{ const name=$('#ruName').value.trim(); const a=[...$$('#ruA input:checked')].map(i=>i.value), b=[...$$('#ruB input:checked')].map(i=>i.value);
    if(!name||!a.length||!b.length){ alert('Vyplňte název a vyberte funkce do obou skupin.'); return; }
    if(r) Object.assign(r,{name,desc:$('#ruDesc').value.trim(),level:$('#ruLevel').value,a,b}); else state.rules.push({id:uid('r'),name,desc:$('#ruDesc').value.trim(),level:$('#ruLevel').value,a,b,on:true});
    d.close(); save('pravidlo',(r?'upraveno: ':'nové: ')+name); };
  $('#ruCancel').onclick=()=>d.close(); d.showModal(); }

// --- návrhy změn organigramu ---
const PSTAT={navrh:'navrženo',predano:'předáno k provedení',provedeno:'provedeno',zamitnuto:'zamítnuto'};
function renderProp(){ const c=$('#v-prop');
  c.innerHTML=`<div class="pad"><h2>Návrhy změn organigramu</h2><p class="muted">Model do organigramu nezapisuje. Návrhy se provedou v aplikaci ÚRÚ ČR; rozpor, ze kterého návrh vznikl, pak sám zmizí.</p>
    <div class="row">${ROLE.org?'<button id="propAdd">+ návrh</button>':''}<button id="propXlsx">Stáhnout (xlsx)</button></div>
    <table class="tbl"><thead><tr><th>Návrh</th><th>Útvar</th><th>Funkce</th><th>Stav</th><th>Rozpor</th><th>Kdo / kdy</th><th></th></tr></thead><tbody>
    ${state.proposals.map(p=>{ const still=p.key?conflicts.some(x=>x.key===p.key&&!x.ignored):null; return `<tr data-pid="${p.id}" class="ps-${p.status}">
      <td><textarea rows="2" ${ROLE.org?'':'disabled'}>${esc(p.text)}</textarea></td><td>${p.unit&&U[p.unit]?esc(shortName(p.unit)):'—'}</td><td>${p.func&&F(p.func)?esc(F(p.func).name):'—'}</td>
      <td><select ${ROLE.org?'':'disabled'}>${Object.entries(PSTAT).map(([k,v])=>`<option value="${k}" ${p.status===k?'selected':''}>${v}</option>`).join('')}</select></td>
      <td>${still===null?'—':still?'<span class="warnc">trvá</span>':'<span class="okc">vyřešen</span>'}</td><td class="muted">${esc(p.who||'')}<br>${esc(p.t||'')}</td>
      <td>${ROLE.org?'<button class="small" data-a="del">×</button>':''}</td></tr>`; }).join('')||'<tr><td colspan="7" class="muted">Zatím žádné návrhy. Vznikají z rozporů tlačítkem „→ návrh změny“.</td></tr>'}</tbody></table></div>`;
  c.querySelectorAll('tr[data-pid]').forEach(tr=>{ const p=state.proposals.find(x=>x.id===tr.dataset.pid);
    tr.querySelector('textarea').onchange=e=>{ p.text=e.target.value; save('návrh','upraven'); };
    tr.querySelector('select').onchange=e=>{ p.status=e.target.value; save('návrh',PSTAT[p.status]+': '+p.text); };
    const del=tr.querySelector('[data-a=del]'); if(del) del.onclick=()=>{ if(confirm('Smazat návrh?')){ state.proposals=state.proposals.filter(x=>x!==p); save('návrh','smazán'); } }; });
  if($('#propAdd')) $('#propAdd').onclick=()=>{ const t=prompt('Text návrhu změny organigramu:'); if(t&&t.trim()){ state.proposals.push({id:uid('n'),text:t.trim(),status:'navrh',who:currentUser?currentUser.email:'',t:today()}); save('návrh','nový: '+t.trim()); } };
  $('#propXlsx').onclick=()=>{ const rows=state.proposals.map(p=>({'Návrh':p.text,'Útvar':p.unit&&U[p.unit]?U[p.unit].name:'','Funkce':p.func&&F(p.func)?F(p.func).name:'','Stav':PSTAT[p.status],'Autor':p.who,'Datum':p.t}));
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows.length?rows:[{'Návrh':''}]),'Návrhy změn'); XLSX.writeFile(wb,`TOM_URU_CR_navrhy_${today()}.xlsx`); }; }

// --- verze modelu ---
function modelPart(){ return JSON.parse(JSON.stringify({groups:state.groups,funcs:state.funcs,links:state.links,rules:state.rules})); }
function diff(a,b){ const out=[]; const fa=a.funcs||{}, fb=b.funcs||{};
  Object.keys(fb).filter(k=>!fa[k]).forEach(k=>out.push('+ nová funkce: '+fb[k].name)); Object.keys(fa).filter(k=>!fb[k]).forEach(k=>out.push('− zrušená funkce: '+fa[k].name));
  Object.keys(fb).filter(k=>fa[k]).forEach(k=>{ const x=fa[k], y=fb[k]; const ch=[];
    if(x.name!==y.name) ch.push(`název „${x.name}“ → „${y.name}“`); if(x.status!==y.status) ch.push(`stav ${STATUS[x.status]} → ${STATUS[y.status]}`); if(x.period!==y.period) ch.push(`období ${x.period} → ${y.period}`);
    if((x.fte||0)!==(y.fte||0)) ch.push(`FTE ${x.fte||'—'} → ${y.fte||'—'}`); if(x.group!==y.group) ch.push('jiná oblast');
    const as=z=>z.assign.map(q=>q.unit+':'+q.role).sort().join(','); if(as(x)!==as(y)){ const A=new Set(x.assign.map(q=>q.unit+':'+q.role)), B=new Set(y.assign.map(q=>q.unit+':'+q.role));
      const nm=s=>{ const [u,r]=s.split(':'); return (U[u]?shortName(u):u)+' ('+ROLES[r]+')'; };
      [...B].filter(s=>!A.has(s)).forEach(s=>ch.push('+ '+nm(s))); [...A].filter(s=>!B.has(s)).forEach(s=>ch.push('− '+nm(s))); }
    if(ch.length) out.push('~ '+y.name+': '+ch.join('; ')); });
  const lk=l=>l.from+'>'+l.to+':'+l.kind; const LA=new Set((a.links||[]).map(lk)), LB=new Set((b.links||[]).map(lk));
  const ln=s=>{ const [ft,k]=s.split(':'); const [x,y]=ft.split('>'); return `${(fb[x]||fa[x]||{}).name} → ${(fb[y]||fa[y]||{}).name} (${(LINK_KINDS[k]||[''])[0]})`; };
  [...LB].filter(s=>!LA.has(s)).forEach(s=>out.push('+ vazba: '+ln(s))); [...LA].filter(s=>!LB.has(s)).forEach(s=>out.push('− vazba: '+ln(s)));
  const ra=JSON.stringify(a.rules||[]), rb=JSON.stringify(b.rules||[]); if(ra!==rb) out.push('~ změněna pravidla');
  return out; }
function renderVer(){ const c=$('#v-ver');
  c.innerHTML=`<div class="pad"><h2>Verze modelu</h2><p class="muted">Uložte stav modelu před diskusí a po ní; verze lze porovnat s aktuálním stavem nebo obnovit.</p>
    ${ROLE.org?'<div class="row"><button id="verAdd" class="primary">Uložit aktuální verzi</button></div>':''}
    <table class="tbl"><thead><tr><th>Verze</th><th>Uloženo</th><th>Funkcí</th><th></th></tr></thead><tbody>
    ${state.versions.slice().reverse().map(v=>`<tr data-vid="${v.id}"><td><b>${esc(v.name)}</b></td><td class="muted">${esc(v.t)} · ${esc(v.who||'')}</td><td>${Object.keys(v.data.funcs||{}).length}</td>
      <td><button class="small" data-a="cmp">Porovnat s aktuálním</button> ${ROLE.org?'<button class="small" data-a="rest">Obnovit</button> <button class="small" data-a="del">×</button>':''}</td></tr>`).join('')||'<tr><td colspan="4" class="muted">Zatím žádná uložená verze.</td></tr>'}</tbody></table>
    <div id="verDiff"></div></div>`;
  if($('#verAdd')) $('#verAdd').onclick=()=>{ const n=prompt('Název verze (např. „před poradou 12. 10.“):',''); if(!n||!n.trim()) return;
    state.versions.push({id:uid('v'),name:n.trim(),t:new Date().toLocaleString('cs-CZ'),who:currentUser?currentUser.email:'',data:modelPart()}); save('verze','uložena: '+n.trim()); };
  c.querySelectorAll('tr[data-vid]').forEach(tr=>{ const v=state.versions.find(x=>x.id===tr.dataset.vid);
    tr.querySelectorAll('button').forEach(b=>b.onclick=()=>{ const a=b.dataset.a;
      if(a==='cmp'){ const d=diff(v.data,modelPart()); $('#verDiff').innerHTML=`<h3>Změny od verze „${esc(v.name)}“</h3>`+(d.length?'<ul class="diff">'+d.map(x=>`<li class="${x[0]==='+'?'add':x[0]==='−'?'rem':'chg'}">${esc(x)}</li>`).join('')+'</ul>':'<p class="muted">Beze změn.</p>'); }
      if(a==='rest'&&confirm(`Obnovit model do stavu „${v.name}“? Aktuální stav lze vrátit tlačítkem Zpět.`)){ Object.assign(state,JSON.parse(JSON.stringify(v.data))); normalize(); sel=null; save('verze','obnovena: '+v.name); }
      if(a==='del'&&confirm('Smazat verzi „'+v.name+'“?')){ state.versions=state.versions.filter(x=>x!==v); save('verze','smazána: '+v.name); } }); }); }

// ---------- boční panel ----------
function unitOptions(selected){ return orgOrder().map(([id,d])=>`<option value="${id}" ${id===selected?'selected':''}>${'  '.repeat(d).replace(/ /g,'\u00a0')}${esc(U[id].name)}</option>`).join(''); }
function renderSide(){ const s=$('#side'); const ro=ROLE.org?'':'disabled';
  if(sel&&sel.t==='f'&&F(sel.id)){ const f=F(sel.id); const cs=conflicts.filter(c=>touches(c,f.id));
    s.innerHTML=`<div class="sh"><span class="muted">Funkce</span><button class="small" id="sClose">×</button></div>
    <label>Název<textarea id="fName" rows="2" ${ro}>${esc(f.name)}</textarea></label>
    <div class="g2"><label>Oblast<select id="fGroup" ${ro}>${state.groups.map(g=>`<option value="${g.id}" ${g.id===f.group?'selected':''}>${esc(g.name)}</option>`).join('')}</select></label>
    <label>Typ<select id="fType" ${ro}>${Object.entries(TYPES).map(([k,v])=>`<option value="${k}" ${k===f.type?'selected':''}>${v}</option>`).join('')}</select></label>
    <label>Platí<select id="fPeriod" ${ro}><option value="2027" ${f.period!=='2028'?'selected':''}>od 1. 1. 2027</option><option value="2028" ${f.period==='2028'?'selected':''}>od 2028 (výhled)</option></select></label>
    <label>Stav diskuse<select id="fStatus" ${ro}>${Object.entries(STATUS).map(([k,v])=>`<option value="${k}" ${k===f.status?'selected':''}>${v}</option>`).join('')}</select></label>
    <label>Rozhodnutí TOM<input type="text" id="fRefs" value="${esc(f.refs)}" placeholder="např. R2, R11" ${ro}></label>
    <label>Potřeba FTE<input type="number" id="fFte" min="0" step="0.5" value="${f.fte??''}" placeholder="neurčeno" ${ro}></label></div>
    <div class="lbl">Lokality výkonu <span class="muted">(nepovinné)</span></div><div class="locs">${LOCATIONS.map(([k,n])=>`<label><input type="checkbox" value="${k}" ${f.locs.includes(k)?'checked':''} ${ro}> ${n}</label>`).join('')}</div>
    <label>Popis<textarea id="fDesc" rows="3" ${ro}>${esc(f.desc)}</textarea></label>
    <div class="lbl">Útvary organigramu</div>
    <div class="asg">${f.assign.map((a,i)=>`<div class="arow${U[a.unit]?'':' gone'}" data-i="${i}"><span title="${esc(U[a.unit]?unitPath(a.unit):'v organigramu už není')}">${esc(U[a.unit]?U[a.unit].name:(a.name||a.unit)+' ✕')}</span>
      <select ${ro}>${Object.entries(ROLES).map(([k,v])=>`<option value="${k}" ${k===a.role?'selected':''}>${v}</option>`).join('')}</select>${ROLE.org?'<button class="small" data-a="x">×</button>':''}</div>`).join('')||'<div class="muted">žádný útvar</div>'}</div>
    ${ROLE.org?`<div class="addasg"><select id="aUnit"><option value="">— vyberte útvar —</option>${unitOptions()}</select><select id="aRole">${Object.entries(ROLES).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select><button class="small" id="aAdd">Přidat</button></div>`:''}
    ${cs.length?`<div class="lbl">Rozpory</div>${cs.map(c=>`<div class="mini sev-${c.sev}${c.ignored?' ign':''}">${esc(c.text)}${c.ignored?' <i>(přijato)</i>':''}</div>`).join('')}`:''}
    <div class="lbl">Poznámky z diskuse</div><div class="notes">${f.notes.map((n,i)=>`<div class="note"><div class="muted">${esc(n.t)} · ${esc(n.who||'')}${ROLE.org?` <button class="small" data-n="${i}">×</button>`:''}</div>${esc(n.text)}</div>`).join('')||'<div class="muted">zatím nic</div>'}</div>
    ${ROLE.org?`<textarea id="nText" rows="2" placeholder="např. MMR navrhuje přesunout pod sekci…"></textarea><button class="small" id="nAdd">Přidat poznámku</button>`:''}
    <div class="row" style="margin-top:14px">${ROLE.org?'<button id="fDel" style="color:var(--danger)">Smazat funkci</button>':''}<button id="fLinks">Vazby (${state.links.filter(l=>l.from===f.id||l.to===f.id).length})</button></div>`;
    const ch=(fn,act)=>()=>{ fn(); save('funkce',act+': '+f.name); };
    $('#sClose').onclick=()=>{ sel=null; render(); };
    if(!ROLE.org){ $('#fLinks').onclick=()=>toast(state.links.filter(l=>l.from===f.id||l.to===f.id).map(l=>(l.from===f.id?'→ '+F(l.to).name:'← '+F(l.from).name)).join('\n')||'Bez vazeb'); return; }
    $('#fName').onchange=e=>{ const o=f.name; f.name=e.target.value.trim()||o; save('funkce',`přejmenována: ${o} → ${f.name}`); };
    $('#fGroup').onchange=ch(()=>f.group=$('#fGroup').value,'oblast'); $('#fType').onchange=ch(()=>f.type=$('#fType').value,'typ');
    $('#fPeriod').onchange=ch(()=>f.period=$('#fPeriod').value,'období'); $('#fStatus').onchange=ch(()=>f.status=$('#fStatus').value,'stav '+STATUS[$('#fStatus').value]);
    $('#fRefs').onchange=ch(()=>f.refs=$('#fRefs').value.trim(),'rozhodnutí'); $('#fFte').onchange=ch(()=>f.fte=$('#fFte').value===''?null:Math.max(0,+$('#fFte').value),'FTE');
    $('#fDesc').onchange=ch(()=>f.desc=$('#fDesc').value,'popis');
    s.querySelectorAll('.locs input').forEach(i=>i.onchange=ch(()=>f.locs=[...s.querySelectorAll('.locs input:checked')].map(x=>x.value),'lokality'));
    s.querySelectorAll('.arow').forEach(r=>{ const a=f.assign[+r.dataset.i]; r.querySelector('select').onchange=e=>{ a.role=e.target.value; save('přiřazení',`${f.name}: ${a.name} → ${ROLES[a.role]}`); };
      r.querySelector('[data-a=x]').onclick=()=>{ f.assign.splice(+r.dataset.i,1); save('přiřazení',`${f.name}: odebrán ${a.name||a.unit}`); }; });
    $('#aAdd').onclick=()=>{ const u=$('#aUnit').value; if(!u) return; if(f.assign.some(a=>a.unit===u)){ toast('Útvar už je přiřazen.'); return; } f.assign.push({unit:u,role:$('#aRole').value,name:U[u].name}); save('přiřazení',`${f.name}: + ${U[u].name} (${ROLES[$('#aRole').value]})`); };
    $('#nAdd').onclick=()=>{ const t=$('#nText').value.trim(); if(!t) return; f.notes.push({t:today(),who:currentUser?currentUser.email:'',text:t}); save('poznámka',f.name+': '+t); };
    s.querySelectorAll('[data-n]').forEach(b=>b.onclick=()=>{ if(confirm('Smazat poznámku?')){ f.notes.splice(+b.dataset.n,1); save('poznámka','smazána: '+f.name); } });
    $('#fDel').onclick=()=>{ if(!confirm(`Smazat funkci „${f.name}“ včetně jejích vazeb?`)) return; delete state.funcs[f.id]; state.links=state.links.filter(l=>l.from!==f.id&&l.to!==f.id);
      state.rules.forEach(r=>{ r.a=(r.a||[]).filter(x=>x!==f.id); r.b=(r.b||[]).filter(x=>x!==f.id); }); sel=null; save('funkce','smazána: '+f.name); };
    $('#fLinks').onclick=()=>{ setView('map'); focusFunc(f.id); };
    return; }
  if(sel&&sel.t==='l'){ const l=state.links.find(x=>x.id===sel.id); if(l){ s.innerHTML=`<div class="sh"><span class="muted">Vazba</span><button class="small" id="sClose">×</button></div>
    <p><b>${esc(F(l.from).name)}</b><br>→ <b>${esc(F(l.to).name)}</b></p><p>${esc(LINK_KINDS[l.kind][0])}${l.label?' – '+esc(l.label):''}</p>
    ${ROLE.org?'<div class="row"><button id="lEdit">Upravit</button><button id="lRev">Obrátit směr</button><button id="lDel" style="color:var(--danger)">Smazat</button></div>':''}`;
    $('#sClose').onclick=()=>{ sel=null; render(); };
    if(ROLE.org){ $('#lEdit').onclick=()=>openLinkDlg(l); $('#lRev').onclick=()=>{ [l.from,l.to]=[l.to,l.from]; save('vazba','obrácena'); }; $('#lDel').onclick=()=>delLink(l.id); } return; } }
  if(sel&&sel.t==='g'){ const g=state.groups.find(x=>x.id===sel.id); if(g){ const n=Object.values(state.funcs).filter(f=>f.group===g.id).length;
    s.innerHTML=`<div class="sh"><span class="muted">Oblast</span><button class="small" id="sClose">×</button></div><label>Název<input type="text" id="gName" value="${esc(g.name)}" ${ro}></label>
    <div class="lbl">Barva</div><div class="pal">${PALETTE.map(c=>`<button class="sw${c===g.color?' on':''}" style="background:${c}" data-c="${c}" ${ro}></button>`).join('')}</div>
    <p class="muted">${n} funkcí. Oblast přesunete tažením za její název.</p>${ROLE.org?`<div class="row"><button id="gUp">↑ dřív</button><button id="gAddF">+ funkce do oblasti</button><button id="gDel" style="color:var(--danger)" ${n?'disabled title="nejdřív přesuňte nebo smažte funkce"':''}>Smazat</button></div>`:''}`;
    $('#sClose').onclick=()=>{ sel=null; render(); }; if(!ROLE.org) return;
    $('#gName').onchange=e=>{ g.name=e.target.value.trim()||g.name; save('oblast','přejmenována: '+g.name); };
    s.querySelectorAll('.sw').forEach(b=>b.onclick=()=>{ g.color=b.dataset.c; save(); });
    $('#gUp').onclick=()=>{ const i=state.groups.indexOf(g); if(i>0){ state.groups.splice(i,1); state.groups.splice(i-1,0,g); save(); } };
    $('#gAddF').onclick=()=>addFunc(g.id); $('#gDel').onclick=()=>{ state.groups=state.groups.filter(x=>x!==g); sel=null; save('oblast','smazána: '+g.name); }; return; } }
  if(sel&&sel.t==='u'&&U[sel.id]){ const u=U[sel.id]; const cap=unitCap(u.id); const fs=Object.values(state.funcs).filter(f=>f.assign.some(a=>a.unit===u.id)); const cs=conflicts.filter(c=>c.u===u.id);
    s.innerHTML=`<div class="sh"><span class="muted">Útvar organigramu (jen ke čtení)</span><button class="small" id="sClose">×</button></div>
    <h3 style="margin:4px 0">${esc(u.name)}</h3><div class="muted">${esc(unitPath(u.id))}</div>
    <p>Místa: <b>${cap.f}/${cap.n}</b> obsazeno · ${fmt(cap.occ)}/${fmt(cap.cap)} FTE${unitLoc(u.id)?' · '+esc(LOC[unitLoc(u.id)]||''):''}</p>
    <div class="lbl">Funkce útvaru</div>${fs.map(f=>{ const a=f.assign.find(x=>x.unit===u.id); return `<div class="arow"><a href="#" data-f="${f.id}">${esc(f.name)}</a><select data-f="${f.id}" ${ro}>${Object.entries(ROLES).map(([k,v])=>`<option value="${k}" ${k===a.role?'selected':''}>${v}</option>`).join('')}</select>${ROLE.org?`<button class="small" data-x="${f.id}">×</button>`:''}</div>`; }).join('')||'<div class="muted">žádná – útvar v modelu nefiguruje</div>'}
    ${ROLE.org?`<div class="addasg"><select id="uFunc"><option value="">— přidat funkci —</option>${state.groups.map(g=>`<optgroup label="${esc(g.name)}">${Object.values(state.funcs).filter(f=>f.group===g.id&&!fs.includes(f)).map(f=>`<option value="${f.id}">${esc(f.name)}</option>`).join('')}</optgroup>`).join('')}</select><select id="uRole">${Object.entries(ROLES).map(([k,v])=>`<option value="${k}" ${k==='do'?'selected':''}>${v}</option>`).join('')}</select><button class="small" id="uAdd">Přidat</button></div>`:''}
    ${cs.length?`<div class="lbl">Rozpory</div>${cs.map(c=>`<div class="mini sev-${c.sev}${c.ignored?' ign':''}">${esc(c.text)}</div>`).join('')}`:''}`;
    $('#sClose').onclick=()=>{ sel=null; render(); };
    s.querySelectorAll('a[data-f]').forEach(a=>a.onclick=e=>{ e.preventDefault(); sel={t:'f',id:a.dataset.f}; render(); });
    if(!ROLE.org) return;
    s.querySelectorAll('select[data-f]').forEach(x=>x.onchange=()=>{ const f=F(x.dataset.f); f.assign.find(a=>a.unit===u.id).role=x.value; save('přiřazení',`${f.name}: ${u.name} → ${ROLES[x.value]}`); });
    s.querySelectorAll('[data-x]').forEach(b=>b.onclick=()=>{ const f=F(b.dataset.x); f.assign=f.assign.filter(a=>a.unit!==u.id); save('přiřazení',`${f.name}: odebrán ${u.name}`); });
    $('#uAdd').onclick=()=>{ const f=F($('#uFunc').value); if(!f) return; f.assign.push({unit:u.id,role:$('#uRole').value,name:u.name}); save('přiřazení',`${f.name}: + ${u.name} (${ROLES[$('#uRole').value]})`); };
    return; }
  // výchozí: legenda
  const L=live();
  s.innerHTML=`<div class="sh"><span class="muted">Legenda</span></div>
    <div class="lbl">Rámeček funkce</div><div class="leg"><span><i class="b ok"></i>bez rozporu</span><span><i class="b warn"></i>varování</span><span><i class="b err"></i>chyba</span><span><i class="b p28"></i>výhled 2028</span></div>
    <div class="lbl">Útvary u funkce</div><div class="leg"><span class="uchip r-own">vlastník</span><span class="uchip r-do">vykonává</span><span class="uchip r-sup">podporuje</span></div>
    <div class="lbl">Stav diskuse</div><div class="leg">${Object.entries(STATUS).map(([k,v])=>`<span><i style="background:${STATUS_COLOR[k]};border-radius:50%"></i>${v}</span>`).join('')}</div>
    <div class="lbl">Vazby</div><div class="leg col">${Object.values(LINK_KINDS).map(([n,c])=>`<span><i style="background:${c};height:3px;width:18px;border:0"></i>${n}</span>`).join('')}</div>
    <p class="muted" style="margin-top:16px">Klikněte na funkci, vazbu nebo název oblasti. Krabičky se přesouvají tažením. Vazbu vytvoříte tlačítkem „Spojit“.</p>
    ${L.length?`<p><a href="#" id="toConf">${L.filter(c=>c.sev==='err').length} chyb a ${L.filter(c=>c.sev==='warn').length} varování →</a></p>`:'<p class="okc">Model je bez rozporů.</p>'}`;
  if($('#toConf')) $('#toConf').onclick=e=>{ e.preventDefault(); setView('conf'); };
}
function focusFunc(id){ setTimeout(()=>{ const b=document.querySelector(`.fbox[data-fid="${id}"]`); if(b){ b.scrollIntoView({block:'center',inline:'center'}); b.classList.add('flash'); setTimeout(()=>b.classList.remove('flash'),1500); } },60); }
function addFunc(gid){ const n=prompt('Název nové funkce:'); if(!n||!n.trim()) return; const g=gid||(state.groups[0]&&state.groups[0].id);
  const ms=Object.values(state.funcs).filter(f=>f.group===g); const x=ms.length?Math.min(...ms.map(f=>f.x)):40, y=ms.length?Math.max(...ms.map(f=>f.y))+96:60;
  const f={id:uid('f'),name:n.trim(),group:g,type:'vykon',period:'2027',refs:'',desc:'',fte:null,locs:[],status:'navrh',notes:[],assign:[],x,y};
  state.funcs[f.id]=f; sel={t:'f',id:f.id}; save('funkce','nová: '+f.name); if(state.view!=='map') setView('map'); focusFunc(f.id); }

// ---------- export, json, historie, prezentace ----------
function exportXlsx(){ const wb=XLSX.utils.book_new(); const gn=id=>(state.groups.find(g=>g.id===id)||{}).name||'';
  const us=(f,r)=>f.assign.filter(a=>a.role===r).map(a=>U[a.unit]?U[a.unit].name:(a.name||a.unit)+' (zrušen)').join('; ');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(Object.values(state.funcs).map(f=>({'Oblast':gn(f.group),'Funkce':f.name,'Typ':TYPES[f.type],'Platí od':f.period==='2028'?'2028':'1. 1. 2027','Stav diskuse':STATUS[f.status],'Rozhodnutí TOM':f.refs,'Potřeba FTE':f.fte??'','Lokality':f.locs.map(l=>LOC[l]).join(', '),'Vlastník':us(f,'own'),'Vykonává':us(f,'do'),'Podporuje':us(f,'sup'),'Popis':f.desc,'Poznámky':f.notes.map(n=>n.t+' '+n.text).join(' | ')}))),'Funkce');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(state.links.map(l=>({'Od':(F(l.from)||{}).name,'Vazba':LINK_KINDS[l.kind][0],'K':(F(l.to)||{}).name,'Popisek':l.label})).concat(state.links.length?[]:[{'Od':''}])),'Vazby');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(conflicts.map(c=>({'Závažnost':SEV[c.sev],'Rozpor':c.text,'Přijato':c.ignored?state.ignored[c.key].why:''})).concat(conflicts.length?[]:[{'Rozpor':'bez rozporů'}])),'Rozpory');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(orgOrder().map(([id,d])=>{ const fs=Object.values(state.funcs).filter(f=>f.assign.some(a=>a.unit===id)); const c=unitCap(id);
    return {'Útvar':'  '.repeat(d)+U[id].name,'Míst':c.n,'Obsazeno':c.f,'Funkce (vlastník)':fs.filter(f=>f.assign.find(a=>a.unit===id).role==='own').map(f=>f.name).join('; '),'Funkce (vykonává / podporuje)':fs.filter(f=>f.assign.find(a=>a.unit===id).role!=='own').map(f=>f.name).join('; ')}; })),'Útvary');
  XLSX.writeFile(wb,`TOM_URU_CR_${today()}.xlsx`); }
function present(on){ document.body.classList.toggle('presenting',on); if(on){ sel=null; setConnect(false); if(state.view!=='map') state.view='map'; } render(); }
function toast(m){ const t=$('#toast'); t.textContent=m; t.classList.add('show'); clearTimeout(toast.t); toast.t=setTimeout(()=>t.classList.remove('show'),3500); }
window.addEventListener('error',e=>toast('Chyba: '+(e.message||'?')));

function wire(){
  $$('.viewsw button').forEach(b=>b.onclick=()=>setView(b.dataset.v));
  $('#btnUndo').onclick=undo; $('#btnRedo').onclick=redo;
  $('#btnAddF').onclick=()=>addFunc(sel&&sel.t==='g'?sel.id:(sel&&sel.t==='f'?F(sel.id).group:null));
  $('#btnAddG').onclick=()=>{ const n=prompt('Název nové oblasti:'); if(!n||!n.trim()) return; const g={id:uid('g'),name:n.trim(),color:PALETTE[state.groups.length%PALETTE.length]}; state.groups.push(g); sel={t:'g',id:g.id}; save('oblast','nová: '+g.name); toast('Oblast vytvořena – přidejte do ní funkci.'); };
  $('#btnConnect').onclick=()=>setConnect(!document.body.classList.contains('connecting'));
  $('#btnLayout').onclick=()=>{ if(confirm('Rozmístit všechny funkce znovu podle oblastí? (Lze vrátit tlačítkem Zpět.)')){ autoLayout(state); save('mapa','automatické rozmístění'); } };
  $('#show2028').onchange=e=>{ state.show2028=e.target.checked; persist(); render(); };
  $('#colorBy').onchange=e=>{ state.colorBy=e.target.value; persist(); render(); };
  $('#zoom').oninput=e=>{ zoom=+e.target.value/100; $('#zoomVal').textContent=e.target.value+' %'; $('#canvas').style.transform=`scale(${zoom})`; };
  $('#canvasWrap').addEventListener('pointerdown',e=>{ if(e.target.closest('.fbox,.lk,.gl')) return; if(sel){ sel=null; render(); } });
  $('#btnXlsx').onclick=exportXlsx;
  $('#btnSave').onclick=()=>{ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,1)],{type:'application/json'})); a.download=`TOM_URU_CR_${today()}.json`; a.click(); };
  $('#btnLoad').onclick=()=>$('#fileJson').click();
  $('#fileJson').onchange=async e=>{ const f=e.target.files[0]; if(!f) return; e.target.value='';
    try{ const s=JSON.parse(await f.text()); if(s.app!==APP_ID||!s.funcs) throw new Error('soubor není uložený model TOM ÚRÚ ČR'); state=s; normalize(); sel=null; save('načtení','model nahrazen ze souboru '+f.name); toast('Model načten.'); }catch(err){ alert('Soubor se nepodařilo načíst: '+err.message); } };
  $('#btnLog').onclick=async()=>{ $('#logBody').innerHTML='Načítám…'; $('#dlgLog').showModal();
    const {data,error}=await sb.from('organigram_log').select('created_at,user_email,action,detail').eq('app',APP_ID).order('created_at',{ascending:false}).limit(300);
    $('#logBody').innerHTML=error?'Historii se nepodařilo načíst: '+esc(error.message):(data.length?data.map(l=>`<div><time>${new Date(l.created_at).toLocaleString('cs-CZ')}</time><span><b>${esc(l.action)}</b> ${esc(l.detail||'')} <span class="muted">· ${esc(l.user_email||'')}</span></span></div>`).join(''):'Zatím žádné změny.'); };
  $('#logClose').onclick=()=>$('#dlgLog').close();
  $('#btnPresent').onclick=()=>present(true); $('#presExit').onclick=()=>present(false);
}

// ---------- přihlášení a start ----------
async function boot(){
  $('#ver').textContent='verze '+APP_VERSION; console.log('TOM ÚRÚ ČR app.js',APP_VERSION); wire();
  if(!window.supabase||!window.CONFIG||!/^https:\/\/[a-z0-9-]+\.supabase\.co/.test(String(CONFIG.SUPABASE_URL).trim())){ $('#authMsg').className='msg err'; $('#authMsg').textContent='Aplikace není nakonfigurována – doplňte config.js.'; return; }
  const url=String(CONFIG.SUPABASE_URL).trim().replace(/\/(rest|auth|storage|realtime)\/v1.*$/,'').replace(/\/+$/,'');
  sb=supabase.createClient(url,String(CONFIG.SUPABASE_ANON_KEY).trim());
  $('#authBtn').onclick=async()=>{ const email=$('#authMail').value.trim(), pass=$('#authPass').value; if(!email) return; $('#authMsg').className='msg'; $('#authMsg').textContent=pass?'Přihlašuji…':'Odesílám odkaz…';
    if(pass){ const {error}=await sb.auth.signInWithPassword({email,password:pass}); if(error){ $('#authMsg').className='msg err'; $('#authMsg').textContent='Nepodařilo se: '+(error.message==='Invalid login credentials'?'nesprávný e-mail nebo heslo':error.message); } return; }
    const {error}=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname,shouldCreateUser:false}});
    if(error){ $('#authMsg').className='msg err'; $('#authMsg').textContent='Nepodařilo se: '+(error.message.includes('rate limit')?'vyčerpán hodinový limit e-mailů – přihlaste se heslem':error.message); } else $('#authMsg').textContent='Hotovo – zkontrolujte e-mail a klikněte na odkaz.'; };
  ['#authMail','#authPass'].forEach(id=>$(id).addEventListener('keydown',e=>{ if(e.key==='Enter') $('#authBtn').click(); }));
  $('#btnLogout').onclick=async()=>{ await flush(); await sb.auth.signOut(); location.reload(); };
  sb.auth.onAuthStateChange(async(ev,session)=>{ if(session&&!currentUser){ currentUser=session.user; await start(); } });
  const {data:{session}}=await sb.auth.getSession(); if(session){ currentUser=session.user; await start(); }
}
async function start(){
  try{ const {data}=await sb.from('organigram_roles').select('role').eq('email',(currentUser.email||'').toLowerCase()).maybeSingle(); ROLE.name=(data&&data.role)||'admin'; }catch(e){ ROLE.name='admin'; }
  ROLE.org=ROLE.name==='admin'; document.body.classList.toggle('role-ro',!ROLE.org);
  $('#userMail').textContent=currentUser.email+(ROLE.org?'':' · jen čtení');
  try{ await loadOrg(); await loadRemote(); }catch(e){ $('#authMsg').className='msg err'; $('#authMsg').textContent='Načtení dat selhalo: '+(e.message||e); return; }
  $('#auth').style.display='none'; setDot('','připojeno'); updateUndo(); render();
  sb.channel('tom-cr').on('postgres_changes',{event:'UPDATE',schema:'public',table:'organigram_state',filter:'id=eq.'+STATE_ID},p=>{
    if(p.new&&p.new.version>version&&!dirty&&!saving){ const v=state.view; state=p.new.data; version=p.new.version; normalize(); state.view=v; markBaseline(); render(); toast('Model aktualizován z jiného okna.'); } }).subscribe();
  sb.channel('tom-cr-org').on('postgres_changes',{event:'UPDATE',schema:'public',table:'organigram_state',filter:'id=eq.'+ORG_ID},p=>{
    if(p.new&&p.new.data){ setOrg(p.new.data); render(); toast('Organigram ÚRÚ ČR se změnil – rozpory přepočítány.'); } }).subscribe();
  window.addEventListener('beforeunload',e=>{ if(dirty||saving){ flush(); e.preventDefault(); e.returnValue=''; } });
}
boot();
