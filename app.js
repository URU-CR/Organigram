const APP_VERSION='2026-09-18.1';

const STRUCTURE = window.STRUCTURE;
const SOURCES = ['DESÚ','MMR','ÚÚR','MD','MPO','Nové','Jiný'];
const LOCATIONS = [
  {id:'MD', abbr:'MD', name:'MD – sídlo (Ministerstvo dopravy)'},
  {id:'LET',abbr:'LET',name:'Letenská'},
  {id:'BR', abbr:'BR', name:'Brno'},
  {id:'OL', abbr:'OL', name:'Olomouc'},
  {id:'PL', abbr:'PL', name:'Plzeň'},
  {id:'CB', abbr:'ČB', name:'České Budějovice'},
  {id:'LTS',abbr:'LTŠ',name:'Letiště'}];
const LOC = Object.fromEntries(LOCATIONS.map(l=>[l.id,l]));
function guessUnitLoc(name){ const n=name.toLowerCase(); if(n.includes('plzeň'))return 'PL'; if(n.includes('olomouc'))return 'OL'; if(n.includes('brno'))return 'BR'; if(n.includes('budějovice'))return 'CB'; if(n.includes('letiště')||n.includes('leteck'))return null; return null; }
// effective location of a unit (own or inherited from parent chain)
function unitLoc(u){ const m=byId(); let c=u; while(c){ if(c.loc) return c.loc; c=m[c.parent]; } return null; }
function unitLocSource(u){ const m=byId(); let c=u; while(c){ if(c.loc) return c; c=m[c.parent]; } return null; }
// effective location of a person: own override, else unit of assigned position
function personLoc(p){ if(p.loc) return {id:p.loc,own:true}; const c=currentPosOf(p.id); const l=c?unitLoc(c.u):null; return {id:l,own:false}; }
function locTag(p){ const l=personLoc(p); const sp=document.createElement('span'); sp.className='loc '+(l.id?(l.own?'':'inh'):'none'); sp.textContent=l.id?LOC[l.id].abbr:'?'; sp.title=l.id?(LOC[l.id].name+(l.own?' (nastaveno u osoby)':' (dle útvaru)')):'lokalita neurčena'; return sp; }
function locSelect(u,cls){ const sel=document.createElement('select'); sel.className='locsel'+(u.loc?'':' inh')+(cls?' '+cls:'');
  const src=unitLocSource(u); const inh=src&&src!==u?src:null;
  sel.innerHTML=`<option value="">${inh?'dle nadřízeného: '+LOC[inh.loc].abbr:'— lokalita —'}</option>`+LOCATIONS.map(l=>`<option value="${l.id}">${l.abbr} · ${l.name}</option>`).join('');
  sel.value=u.loc||''; sel.title='Lokalita útvaru – přenese se na všechny jeho zaměstnance, kteří nemají nastavenou vlastní';
  sel.disabled=!ROLE.org; sel.onclick=e=>e.stopPropagation(); sel.onchange=()=>{ u.loc=sel.value||null; logChange&&logChange('lokalita útvaru',u.name+' → '+(u.loc?LOC[u.loc].name:'dle nadřízeného')); save(); render(); }; return sel; }
const SRC_COLOR = {'DESÚ':'var(--c-desu)','MMR':'var(--c-mmr)','ÚÚR':'var(--c-uur)','MD':'var(--c-md)','MPO':'var(--c-mpo)','Nové':'var(--c-nove)','Jiný':'#E5E7EB'};
const SRC_DARK  = {'DESÚ':'var(--c-desu-d)','MMR':'var(--c-mmr-d)','ÚÚR':'var(--c-uur-d)','MD':'var(--c-md-d)','MPO':'var(--c-mpo-d)','Nové':'var(--c-nove-d)','Jiný':'#6B7280'};
const LEVEL_LBL = {predseda:'úřad',sekce:'sekce',odbor:'odbor',odd:'oddělení'};
const KIND_LBL = {head:'vedoucí',asst:'asistent/ka',ref:'referent'};
const LS_KEY = 'uru-organigram-v1';
const STATE_ID = 'main';

// ---------- state ----------

const ROLE={name:'admin',org:true,it:true};  // org = úpravy organigramu/lidí, it = úpravy IT vybavení
let state = null;   // {units:[{id,parent,name,level,src,positions:[{id,kind,label,cat,person}]}], people:{id:{...}}, collapsed:{}}
let people = {};    // id -> person
let pidCounter = 1;

function freshState(){
  let n=1;
  return { structureVersion:STRUCTURE_VERSION,
    units: STRUCTURE.map(u=>({...u, loc:guessUnitLoc(u.name), positions:u.positions.map(p=>({id:'p'+(n++), ...p, person:null}))})),
    people:{}, collapsed:{}, nextPid:1
  };
}
function persist(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(state)); }catch(e){} dirty=true; setDot('busy','ukládám…'); clearTimeout(saveTimer); saveTimer=setTimeout(flush,700); }
// ---------- undo / redo ----------
const UNDO_MAX=60; let undoStack=[], redoStack=[], baseline=null, restoring=false;
const snap=()=>JSON.stringify({units:state.units,people:state.people,nextPid:state.nextPid,structureVersion:state.structureVersion,itCatalog:state.itCatalog,itPool:state.itPool});
function markBaseline(){ baseline=snap(); }
function save(){
  if(!restoring&&baseline!==null){ const now=snap(); if(now!==baseline){ undoStack.push(baseline); if(undoStack.length>UNDO_MAX) undoStack.shift(); redoStack=[]; } baseline=now; }
  updateUndoBtns(); persist();
}
function applySnap(j){ const o=JSON.parse(j); restoring=true; state.units=o.units; state.people=o.people; state.nextPid=o.nextPid; state.structureVersion=o.structureVersion; state.itCatalog=o.itCatalog; state.itPool=o.itPool; baseline=snap(); restoring=false; persist(); render(); }
function undo(){ if(!undoStack.length) return; redoStack.push(snap()); applySnap(undoStack.pop()); logChange&&logChange('zpět','vrácena poslední změna'); toast('Změna vrácena'); updateUndoBtns(); }
function redo(){ if(!redoStack.length) return; undoStack.push(snap()); applySnap(redoStack.pop()); logChange&&logChange('znovu','obnovena vrácená změna'); updateUndoBtns(); }
function updateUndoBtns(){ const u=$('#btnUndo'),r=$('#btnRedo'); if(u){u.disabled=!undoStack.length; r.disabled=!redoStack.length;} }
document.addEventListener('keydown',e=>{ const t=e.target; if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT')) return; if(document.querySelector('dialog[open]')) return;
  if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==='z'){e.preventDefault();undo();} else if((e.ctrlKey||e.metaKey)&&(e.key.toLowerCase()==='y'||(e.shiftKey&&e.key.toLowerCase()==='z'))){e.preventDefault();redo();} });
// ---------- persistence: Supabase (single shared state row) ----------
let sb=null, currentUser=null, version=0, saveTimer=null, saving=false, dirty=false, pendingLog=[];
function setDot(cls,title){ const d=$('#syncDot'); d.className='dot '+(cls||''); d.title=title||''; }
async function flush(){
  if(!sb||!currentUser||saving||!dirty) return; saving=true; dirty=false;
  try{
    const {data,error}=await sb.from('organigram_state').update({data:state,version:version+1,updated_at:new Date().toISOString(),updated_by:currentUser.email}).eq('id',STATE_ID).eq('version',version).select('version');
    if(error) throw error;
    if(!data||!data.length){ setDot('err','konflikt verzí – načítám aktuální stav'); toast('Stav byl mezitím změněn jinde – načítám aktuální verzi.'); await loadRemote(); render(); saving=false; return; }
    version=data[0].version; setDot('', 'uloženo '+new Date().toLocaleTimeString('cs-CZ'));
    if(pendingLog.length){ const rows=pendingLog.splice(0); const r=await sb.from('organigram_log').insert(rows); if(r.error) console.warn(r.error); }
  }catch(e){ console.error(e); setDot('err','uložení selhalo: '+(e.message||e)); toast('Uložení do databáze selhalo. Zkuste to znovu, nebo použijte „Uložit stav (json)“.'); dirty=true; }
  saving=false; if(dirty){ clearTimeout(saveTimer); saveTimer=setTimeout(flush,1500); }
}
function logChange(action,detail){ pendingLog.push({user_email:currentUser?currentUser.email:null,action,detail}); }
async function loadRemote(){
  const {data,error}=await sb.from('organigram_state').select('data,version').eq('id',STATE_ID).maybeSingle();
  if(error) throw error;
  if(data&&data.data&&data.data.units){ state=data.data; version=data.version||0; }
  else { state=freshState(); version=0; const r=await sb.from('organigram_state').upsert({id:STATE_ID,data:state,version:0,updated_by:currentUser.email}); if(r.error) throw r.error; }
  state.view=state.view||'tree'; if(!state.zoom) state.zoom=85;
  const mg=migrateStructure(state); markBaseline(); if(mg){ logChange('aktualizace struktury','organigram v'+STRUCTURE_VERSION); persist(); setTimeout(()=>reportMigration(mg),300); }
  try{ localStorage.setItem(LS_KEY, JSON.stringify(state)); }catch(e){}
}
function load(){ state=freshState(); }
const byId = ()=>Object.fromEntries(state.units.map(u=>[u.id,u]));
const childrenOf = id => state.units.filter(u=>u.parent===id);
function allPositions(){ return state.units.flatMap(u=>u.positions.map(p=>({u,p}))); }
function unitPath(u){ const m=byId(); const out=[]; let c=u; while(c){ out.unshift(c.name); c=m[c.parent]; } return out; }


// ---------- structure versioning / migration ----------
const STRUCTURE_VERSION = 2; // 2 = organigram MMR z 10. 9. 2026
const RENAMES = {'Odbor stavebně správní':'Odbor odvolací a přezkumné agendy','Oddělení územně a stavebně správní I':'Oddělení odvolací a přezkumné agendy I','Oddělení územně a stavebně správní II':'Oddělení odvolací a přezkumné agendy II','Oddělení územně a stavebně správní III':'Oddělení odvolací a přezkumné agendy III'};
function migrateStructure(st){
  if((st.structureVersion||1)>=STRUCTURE_VERSION) return null;
  const oldByName={}; st.units.forEach(u=>oldByName[RENAMES[u.name]||u.name]=u);
  let n=1; const usedOld=new Set(); const newUnits=STRUCTURE.map(tpl=>{
    const old=oldByName[tpl.name];
    if(old){ usedOld.add(old); return {...tpl, loc:old.loc||guessUnitLoc(tpl.name), positions:old.positions}; }
    return {...tpl, loc:guessUnitLoc(tpl.name), positions:tpl.positions.map(p=>({id:'p'+Date.now().toString(36)+(n++), ...p, person:null}))};
  });
  const removed=st.units.filter(u=>!usedOld.has(u)); const freed=[];
  removed.forEach(u=>u.positions.forEach(p=>{ if(p.person&&st.people[p.person]) freed.push(st.people[p.person].name); }));
  const added=STRUCTURE.filter(t=>!oldByName[t.name]).map(t=>t.name);
  const renamed=st.units.filter(u=>RENAMES[u.name]).map(u=>u.name+' → '+RENAMES[u.name]);
  st.units=newUnits; st.collapsed={}; st.structureVersion=STRUCTURE_VERSION;
  return {removed:removed.map(u=>u.name),added,renamed,freed};
}
function reportMigration(m){ if(!m) return; const parts=[];
  if(m.renamed.length) parts.push('Přejmenováno: '+m.renamed.join('; '));
  if(m.removed.length) parts.push('Zrušeno: '+m.removed.join('; ')+(m.freed.length?' (do nezařazených: '+m.freed.join(', ')+')':''));
  if(m.added.length) parts.push('Nově: '+m.added.join('; '));
  alert('Organigram byl aktualizován na verzi z 10. 9. 2026. Obsazení míst zůstalo zachováno.\n\n'+parts.join('\n')); }

// ---------- rendering ----------
const $ = s=>document.querySelector(s);
function esc(s){ return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function personChip(p, opts={}){
  const d=document.createElement('div');
  d.className='person src-'+(SOURCES.includes(p.src)?p.src:'Jiný');
  d.draggable=ROLE.org; d.dataset.pid=p.id; d.tabIndex=0;
  const meta=[p.src, p.role, p.cls?('tř. '+p.cls):null, (p.fte&&p.fte!=1)?('úv. '+p.fte):null].filter(Boolean).join(' · ');
  d.innerHTML=`<span class="nm">${esc(p.name)}</span><span class="meta">${esc(meta)}</span>`; d.appendChild(locTag(p));
  d.title=[p.name,p.src,p.unit,p.role,p.posId].filter(Boolean).join('\n');
  d.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/pid',p.id);e.dataTransfer.effectAllowed='move';d.classList.add('dragging');});
  d.addEventListener('dragend',()=>d.classList.remove('dragging'));
  d.addEventListener('click',e=>{e.stopPropagation();showPop(p,d);});
  d.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){e.preventDefault();showPop(p,d);} if(ROLE.org&&(e.key==='Delete'||e.key==='Backspace')){unassign(p.id);render();} });
  return d;
}

function renderUnit(u){
  const div=document.createElement('div');
  div.className='unit '+u.level+(state.collapsed[u.id]?' collapsed':'');
  div.dataset.uid=u.id;
  const filled=u.positions.filter(p=>p.person).length, total=u.positions.length;
  const sub=subtreeCount(u);
  const head=document.createElement('div'); head.className='uhead';
  head.innerHTML=`<span class="bar" style="background:${SRC_DARK[u.src]||'#999'}"></span>
    <button class="tog" aria-label="Sbalit/rozbalit">${state.collapsed[u.id]?'▸':'▾'}</button>
    <span class="uname">${esc(u.name)}<span class="lvl">${LEVEL_LBL[u.level]||''}</span></span>
    <span class="srcbadge" style="background:${SRC_COLOR[u.src]}">${esc(u.src)}</span>
    <span class="fill ${filled===total&&total?'full':''}" title="obsazeno / míst (včetně podřízených útvarů)">${filled}/${total}${sub.total!==total?` <span style="opacity:.7">(${sub.filled}/${sub.total})</span>`:''}</span>`;
  head.querySelector('.fill').before(locSelect(u));
  head.querySelector('.tog').onclick=()=>{state.collapsed[u.id]=!state.collapsed[u.id];render();};
  // drop on header -> first free slot
  head.addEventListener('dragover',e=>{e.preventDefault();head.classList.add('over');});
  head.addEventListener('dragleave',()=>head.classList.remove('over'));
  head.addEventListener('drop',e=>{e.preventDefault();head.classList.remove('over');const pid=e.dataTransfer.getData('text/pid');if(!pid||!ROLE.org)return;placeInUnit(pid,u);});
  div.appendChild(head);

  const body=document.createElement('div'); body.className='ubody';
  u.positions.forEach(p=>{
    const row=document.createElement('div'); row.className='pos'; row.dataset.pid=p.id;
    const lab=document.createElement('div'); lab.className='plabel';
    lab.innerHTML=`<span class="cat ${p.cat==='nad'?'nad':''}" title="${p.cat==='nad'?'nadpožadavek (nové místo)':'delimitace'}"></span><span class="t" title="Dvojklik: přejmenovat">${esc(p.label)}</span>${(()=>{const c=sysOf(u,p).cls;return c?`<span class="clsb" title="platová třída místa">${c}</span>`:'';})()}`;
    lab.querySelector('.t').ondblclick=()=>{const n=prompt('Označení místa:',p.label);if(n!==null&&n.trim()){p.label=n.trim();save();render();}};
    const slot=document.createElement('div'); slot.className='slot'+(p.person?' filled':'');
    if(p.person&&state.people[p.person]) slot.appendChild(personChip(state.people[p.person]));
    else slot.innerHTML='<span class="empty">volné místo</span>';
    slot.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='move';slot.classList.add('over');});
    slot.addEventListener('dragleave',()=>slot.classList.remove('over'));
    slot.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();slot.classList.remove('over');const pid=e.dataTransfer.getData('text/pid');if(pid&&ROLE.org)assign(pid,p.id);});
    const del=document.createElement('button'); del.className='small del'; del.textContent='×'; del.title=p.person?'Uvolnit místo':'Odebrat místo';
    del.onclick=()=>{ if(p.person){unassign(p.person);} else { if(confirm('Odebrat toto místo z organigramu?')){u.positions=u.positions.filter(x=>x!==p);} } save();render(); };
    row.append(lab,slot,del); body.appendChild(row);
  });
  const add=document.createElement('div'); add.className='addpos';
  add.innerHTML=`<button class="small">+ místo</button><select><option value="ref">referent</option><option value="head">vedoucí</option><option value="asst">asistent/ka</option></select><select><option value="delim">delimitace</option><option value="nad">nadpožadavek</option></select>`;
  add.querySelector('button').onclick=()=>{const [k,c]=[...add.querySelectorAll('select')].map(s=>s.value);
    const lbl=k==='head'?({odd:'vedoucí oddělení',odbor:'ředitel odboru',sekce:'místopředseda'}[u.level]||'vedoucí'):KIND_LBL[k];
    u.positions.push({id:'p'+Date.now()+Math.random().toString(36).slice(2,6),kind:k,label:lbl,cat:c,person:null});save();render();};
  body.appendChild(add);
  div.appendChild(body);

  const kids=childrenOf(u.id);
  if(kids.length){const c=document.createElement('div');c.className='children';kids.forEach(k=>c.appendChild(renderUnit(k)));div.appendChild(c);}
  return div;
}
function subtreeCount(u){ let t=u.positions.length,f=u.positions.filter(p=>p.person).length; childrenOf(u.id).forEach(k=>{const s=subtreeCount(k);t+=s.total;f+=s.filled;}); return {total:t,filled:f}; }

let activeFilters=new Set(SOURCES);
function render(){
  const tree=$('#tree'); const scroll=tree.scrollTop; tree.innerHTML='';
  state.units.filter(u=>!u.parent).forEach(u=>tree.appendChild(renderUnit(u)));
  tree.scrollTop=scroll;
  if(document.body.classList.contains('view-chart')) renderChart(); else $('#chart').innerHTML='';
  if(document.body.classList.contains('view-loc')) renderLoc(); else $('#locview').innerHTML='';
  if(document.body.classList.contains('view-it')){ try{ renderIT(); }catch(e){ console.error(e); $('#itview').innerHTML='<div style="padding:20px;color:var(--danger)">Pohled IT se nepodařilo vykreslit: '+esc(e.message||e)+'</div>'; } } else $('#itview').innerHTML='';
  if(document.body.classList.contains('view-sys')){ try{ renderSys(); }catch(e){ console.error(e); $('#sysview').innerHTML='<div style="padding:20px;color:var(--danger)">Pohled Systemizace se nepodařilo vykreslit: '+esc(e.message||e)+'<br><span style="color:var(--muted);font-size:12px">'+esc((e.stack||'').split('\n').slice(0,3).join(' | '))+'</span></div>'; } } else $('#sysview').innerHTML='';
  // pool
  const pool=$('#pool'); pool.innerHTML='';
  const assigned=new Set(allPositions().map(x=>x.p.person).filter(Boolean));
  const q=$('#search').value.trim().toLowerCase();
  let list=Object.values(state.people).filter(p=>!assigned.has(p.id));
  const totalUn=list.length;
  list=list.filter(p=>activeFilters.has(SOURCES.includes(p.src)?p.src:'Jiný'));
  if(q) list=list.filter(p=>matches(p,q));
  list.sort((a,b)=>(a.src+a.unit+a.name).localeCompare(b.src+b.unit+b.name,'cs'));
  $('#poolCount').textContent=totalUn?`(${totalUn})`:'';
  if(!Object.keys(state.people).length){pool.innerHTML='<div class="hint">Zatím tu nikdo není.<br>Nahrajte Excel s přehledem lidí (tlačítko vlevo nahoře) nebo přidejte osobu ručně.</div>';}
  else if(!list.length){pool.innerHTML='<div class="hint">Nikdo neodpovídá filtru.</div>';}
  let lastGroup=null;
  list.forEach(p=>{const g=p.src+' · '+(p.unit||'—'); if(g!==lastGroup){const h=document.createElement('div');h.className='group';h.textContent=g;pool.appendChild(h);lastGroup=g;} pool.appendChild(personChip(p));});
  // highlight search in tree
  if(q){ document.querySelectorAll('#tree .person, #chart .person, #locview .person').forEach(el=>{const p=state.people[el.dataset.pid];const hit=matches(p,q);el.classList.toggle('hl',hit);el.classList.toggle('dim',!hit);}); }
  renderStats();
}
function renderStats(){
  const ps=allPositions(); const total=ps.length, filled=ps.filter(x=>x.p.person).length;
  const delim=ps.filter(x=>x.p.cat==='delim'), nad=ps.filter(x=>x.p.cat==='nad');
  const un=Object.values(state.people).length - filled;
  $('#stats').innerHTML=`<div class="stat"><b>${filled}</b><span>obsazeno z ${total} míst</span></div>
    <div class="stat"><b>${delim.filter(x=>x.p.person).length}/${delim.length}</b><span>delimitace</span></div>
    <div class="stat"><b>${nad.filter(x=>x.p.person).length}/${nad.length}</b><span>nadpožadavek</span></div>
    <div class="stat"><b>${Math.max(un,0)}</b><span>nezařazených lidí</span></div>`;
}
function renderLegend(){
  $('#legend').innerHTML=SOURCES.filter(s=>s!=='Jiný').map(s=>`<span><i style="background:${SRC_COLOR[s]}"></i>${s}</span>`).join('')+`<span title="delimitace / nadpožadavek"><i style="background:#7C8796;border-radius:50%"></i>delimitace <i style="background:#fff;border:2px solid #7C8796;border-radius:50%;margin-left:6px"></i>nadpožadavek</span>`;
  $('#filters').innerHTML=SOURCES.map(s=>`<label style="background:${SRC_COLOR[s]}"><input type="checkbox" checked data-src="${s}">${s}</label>`).join('');
  $('#filters').querySelectorAll('input').forEach(i=>i.onchange=()=>{i.checked?activeFilters.add(i.dataset.src):activeFilters.delete(i.dataset.src);render();});
  [$('#impSrc'),$('#npSrc')].forEach(sel=>sel.innerHTML=SOURCES.map(s=>`<option>${s}</option>`).join(''));
}

// ---------- assignment ----------
function findPos(pid){ for(const u of state.units){const p=u.positions.find(x=>x.id===pid); if(p) return {u,p};} return null; }
function currentPosOf(personId){ for(const u of state.units){const p=u.positions.find(x=>x.person===personId); if(p) return {u,p};} return null; }
function assign(personId, posId){
  const t=findPos(posId); if(!t) return;
  const from=currentPosOf(personId);
  if(from&&from.p.id===posId) return;
  const displaced=t.p.person;
  t.p.person=personId;
  if(from) from.p.person = displaced && displaced!==personId ? displaced : null;  // swap
  const nm=id=>state.people[id]?state.people[id].name:'?';
  logChange('přesun',`${nm(personId)}: ${from?unitPath(from.u).slice(-1)[0]+' ('+from.p.label+')':'nezařazení'} → ${t.u.name} (${t.p.label})`+(displaced?`; ${nm(displaced)} ${from?'prohozen/a na původní místo':'uvolněn/a do nezařazených'}`:''));
  save(); render();
  if(displaced&&!from) toast(`${state.people[displaced].name} přesunut/a do nezařazených`);
}
function unassign(personId){ const c=currentPosOf(personId); if(c){c.p.person=null; logChange('uvolnění',`${state.people[personId]?state.people[personId].name:'?'}: ${c.u.name} (${c.p.label}) → nezařazení`);} save(); render(); }
function placeInUnit(personId,u){
  const prs=state.people[personId]; const kind=guessKind(prs);
  let slot=u.positions.find(p=>!p.person&&p.kind===kind&&p.cat==='delim')||u.positions.find(p=>!p.person&&p.kind===kind)||u.positions.find(p=>!p.person&&p.kind==='ref')||u.positions.find(p=>!p.person);
  if(!slot){ toast('V útvaru „'+u.name+'“ není volné místo. Přidejte místo tlačítkem „+ místo“.'); return; }
  assign(personId,slot.id);
}
function guessKind(p){
  const r=(p.role||'').toLowerCase();
  if(/vedoucí|ředitel|předsed|místopředsed/.test(r)) return 'head';
  if(/asistent|sekretá/.test(r)||/PM dle/.test(p.cat||'')) return 'asst';
  return 'ref';
}

// ---------- popover ----------
function showPop(p,anchor){
  const pop=$('#pop'); const cur=currentPosOf(p.id);
  pop.innerHTML=`<h3>${esc(p.name)}</h3><dl>
    <dt>Zdrojový úřad</dt><dd>${esc(p.src)}</dd>
    <dt>Současný útvar</dt><dd>${esc(p.unit||'—')}</dd>
    <dt>Označení místa</dt><dd>${esc(p.role||'—')}</dd>
    <dt>Číslo místa</dt><dd>${esc(p.posId||'—')}</dd>
    <dt>Kategorie</dt><dd>${esc(p.cat||'—')}</dd>
    <dt>Obory služby</dt><dd>${esc(p.fields||'—')}</dd>
    <dt>Platová třída</dt><dd>${esc(p.cls||'—')}</dd>
    <dt>Úvazek</dt><dd>${esc(p.fte??'—')}</dd>
    ${p.note?`<dt>Poznámka</dt><dd>${esc(p.note)}</dd>`:''}
    <dt>V ÚRÚ</dt><dd>${cur?esc(unitPath(cur.u).slice(-2).join(' › '))+' – '+esc(cur.p.label):'<i>nezařazen/a</i>'}</dd>
    <dt>IT vybavení</dt><dd>${(()=>{const its=personItems(p);return its.length?esc(its.map(x=>catById()[x.id].name).join(', ')):'<i>nic</i>';})()}</dd>
    <dt>Lokalita</dt><dd>${ROLE.org?`<select id="popLoc" style="width:100%"><option value="">dle útvaru${(()=>{const l=cur?unitLoc(cur.u):null;return l?' ('+LOC[l].name+')':' (neurčeno)';})()}</option>${LOCATIONS.map(l=>`<option value="${l.id}"${p.loc===l.id?' selected':''}>${l.abbr} · ${l.name}</option>`).join('')}</select>`:(()=>{const l=personLoc(p).id;return l?esc(LOC[l].name):'—';})()}</dd></dl>
    <div class="row">${ROLE.org&&cur?'<button id="popUn">Uvolnit místo</button>':''}${ROLE.org?'<button id="popDel" style="color:var(--danger)">Smazat osobu</button>':''}<button id="popClose" class="primary">Zavřít</button></div>`;
  pop.hidden=false;
  const r=anchor.getBoundingClientRect(); let x=r.left, y=r.bottom+6;
  if(x+330>innerWidth) x=innerWidth-335; if(y+pop.offsetHeight>innerHeight) y=Math.max(8,r.top-pop.offsetHeight-6);
  pop.style.left=x+'px'; pop.style.top=y+'px';
  $('#popClose').onclick=hidePop;
  if($('#popLoc')) $('#popLoc').onchange=()=>{ p.loc=$('#popLoc').value||null; logChange&&logChange('lokalita osoby',p.name+' → '+(p.loc?LOC[p.loc].name:'dle útvaru')); save(); render(); };
  const un=$('#popUn'); if(un) un.onclick=()=>{unassign(p.id);hidePop();};
  if($('#popDel')) $('#popDel').onclick=()=>{ if(confirm('Smazat '+p.name+' z aplikace?')){unassign(p.id);delete state.people[p.id];logChange('smazání osoby',p.name);save();render();hidePop();} };
}
function hidePop(){$('#pop').hidden=true;}
document.addEventListener('click',e=>{ if(!$('#pop').contains(e.target)) hidePop(); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape') hidePop(); });

// pool drop = unassign
const poolEl=$('#pool');
poolEl.addEventListener('dragover',e=>{e.preventDefault();poolEl.classList.add('over');});
poolEl.addEventListener('dragleave',()=>poolEl.classList.remove('over'));
poolEl.addEventListener('drop',e=>{e.preventDefault();poolEl.classList.remove('over');const pid=e.dataTransfer.getData('text/pid');if(pid)unassign(pid);});

// ---------- import ----------
const HEADERS = {
  unitNo:['číslo útvaru','cislo utvaru'], unit:['název útvaru','nazev utvaru','útvar','organizační útvar'],
  posId:['pořadové číslo místa','číslo místa','systemizované místo','id místa'], fields:['obory služby','obor služby'],
  cat:['kategorie syst. místa','kategorie'], role:['označení systemizovaného místa','označemí systemizovaného místa','funkční a služební označení','označení místa','pozice','funkce'],
  cls:['platová třída','plat. třída','třída'], name:['jméno zaměstnance','příjmení a jméno','jméno a příjmení','zaměstnanec','jméno'],
  fund:['zdroj financování'], note:['poznámka'], fte:['úvazek'], until:['platnost do'], loc:['lokalita','pracoviště','místo výkonu','umístění']
};
const norm=s=>String(s??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
function detectColumns(rows){
  for(let i=0;i<Math.min(rows.length,15);i++){
    const r=rows[i].map(norm); const map={}; const used=new Set();
    for(const [key,alts] of Object.entries(HEADERS)){
      let idx=-1;
      for(const a of alts){ idx=r.findIndex((c,j)=>c&&!used.has(j)&&c===norm(a)); if(idx>=0) break; }
      if(idx<0) for(const a of alts){ idx=r.findIndex((c,j)=>c&&!used.has(j)&&c.includes(norm(a))); if(idx>=0) break; }
      if(idx>=0){map[key]=idx;used.add(idx);} }
    if(map.name!==undefined && (map.unit!==undefined||map.role!==undefined)) return {headerRow:i,map};
  }
  return null;
}
function parseWorkbook(wb){
  for(const sn of wb.SheetNames){
    const rows=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:''});
    const det=detectColumns(rows); if(!det) continue;
    const out=[];
    for(let i=det.headerRow+1;i<rows.length;i++){
      const r=rows[i]; const g=k=>det.map[k]!==undefined?String(r[det.map[k]]??'').trim():'';
      const name=g('name'); if(!name) continue;
      out.push({name,unit:g('unit'),unitNo:g('unitNo'),posId:g('posId'),fields:g('fields'),cat:g('cat'),role:g('role'),cls:g('cls'),fund:g('fund'),note:g('note'),fte:g('fte')?Number(String(g('fte')).replace(',','.')).toFixed(2).replace(/\.?0+$/,''):'',until:g('until'),loc:parseLoc(g('loc'))});
    }
    if(out.length) return {rows:out,sheet:sn};
  }
  return null;
}
function parseLoc(v){ const n=norm(v); if(!n) return null; for(const l of LOCATIONS){ if(n===norm(l.abbr)||n.includes(norm(l.name.split(' –')[0]))||n===norm(l.id)) return l.id; } if(n.includes('budejovice')) return 'CB'; if(n.includes('letenska')) return 'LET'; if(n.includes('letiste')) return 'LTS'; if(n.includes('ministerstvo dopravy')||n.includes('nabrezi')) return 'MD'; return null; }
// unit name similarity
const STOP=new Set(['samostatne','oddeleni','odbor','sekce','a','pro']);
const toks=s=>norm(s).split(' ').filter(t=>t&&!STOP.has(t)).map(t=>t.length>4?t.replace(/(ych|ich|eho|emu|ho|ou|em|ek|ka|ky|ni|ne)$/,''):t);
function similarity(a,b){ const A=new Set(toks(a)),B=new Set(toks(b)); if(!A.size||!B.size) return 0; let inter=0; A.forEach(t=>{if(B.has(t))inter++;}); return 2*inter/(A.size+B.size); }
function suggestUnit(srcUnit){
  let best=null,score=0;
  for(const u of state.units){ const s=similarity(srcUnit,u.name); if(s>score){score=s;best=u;} }
  return {unit:score>=0.45?best:null,score};
}
function guessSource(fileName,rows){
  const fn=norm(fileName); const first=norm((rows[0]&&rows[0].posId)||'');
  for(const s of ['DESÚ','MMR','ÚÚR','MD','MPO']){ const n=norm(s); if(fn.includes(n)||first.startsWith(n)) return s; }
  if(fn.includes('desu')||first.startsWith('desu')) return 'DESÚ';
  if(fn.includes('uur')||first.startsWith('uur')) return 'ÚÚR';
  return 'MMR';
}
let pendingImport=null;
$('#btnImport').onclick=()=>$('#fileXlsx').click();
$('#fileXlsx').onchange=async e=>{
  const f=e.target.files[0]; if(!f) return; e.target.value='';
  try{
    const wb=XLSX.read(await f.arrayBuffer(),{type:'array'});
    const parsed=parseWorkbook(wb);
    if(!parsed){ alert('V sešitu se nepodařilo najít tabulku s lidmi. Očekávám sloupce jako „Název útvaru“, „Jméno zaměstnance“, „…označení systemizovaného místa“.'); return; }
    openMapDialog(parsed.rows, guessSource(f.name,parsed.rows));
  }catch(err){ alert('Soubor se nepodařilo načíst: '+err.message); }
};
function openMapDialog(rows,src){
  pendingImport=rows;
  $('#impSrc').value=src;
  const groups={}; rows.forEach(r=>{(groups[r.unit||'—']=groups[r.unit||'—']||[]).push(r);});
  $('#mapIntro').textContent=`Načteno ${rows.length} lidí v ${Object.keys(groups).length} útvarech. Zkontrolujte navržené cílové útvary; do každého se lidé posadí na volná místa (vedoucí → vedoucí, asistent → asistent, ostatní → referent). Kdo se nevejde, zůstane v nezařazených.`;
  const um=byId(); const opts='<option value="">— nechat v nezařazených —</option>'+state.units.map(u=>{const par=um[u.parent];const hint=par&&par.level!=='predseda'?' ('+par.name.replace(/^Místopředseda – /,'')+')':'';return `<option value="${u.id}">${esc(u.name+hint)}</option>`;}).join('');
  $('#mapBody').innerHTML=Object.entries(groups).map(([g,ps])=>{const s=suggestUnit(g);const cls=s.score>=0.8?'hi':(s.unit?'mid':'lo');
    return `<tr data-group="${esc(g)}"><td><span class="conf ${cls}"></span>${esc(g)}</td><td>${ps.length}</td><td><select>${opts}</select></td></tr>`;}).join('');
  $('#mapBody').querySelectorAll('tr').forEach(tr=>{const s=suggestUnit(tr.dataset.group);tr.querySelector('select').value=s.unit?s.unit.id:'';});
  $('#dlgMap').showModal();
}
$('#mapCancel').onclick=()=>{pendingImport=null;$('#dlgMap').close();};
function ingest(placeByMap){
  const src=$('#impSrc').value; const rows=pendingImport; if(!rows) return;
  if($('#impReplace').checked){ Object.values(state.people).filter(p=>p.src===src).forEach(p=>{unassign(p.id);delete state.people[p.id];}); }
  const existing=new Set(Object.values(state.people).map(p=>norm(p.src+'|'+p.name)));
  const map={}; $('#mapBody').querySelectorAll('tr').forEach(tr=>map[tr.dataset.group]=tr.querySelector('select').value);
  const units=byId(); let added=0,placed=0,skipped=0;
  for(const r of rows){
    const key=norm(src+'|'+r.name); if(existing.has(key)){skipped++;continue;} existing.add(key);
    const id='h'+(state.nextPid++); const p={id,src,...r}; if(!p.loc) delete p.loc; state.people[id]=p; added++;
    if(placeByMap){ const u=units[map[r.unit||'—']]; if(u){ const kind=guessKind(p);
        const slot=u.positions.find(x=>!x.person&&x.kind===kind&&x.cat==='delim')||u.positions.find(x=>!x.person&&x.kind===kind)||(kind!=='head'?u.positions.find(x=>!x.person&&x.kind==='ref'):null);
        if(slot){slot.person=id;placed++;} } }
  }
  logChange('import',`${src}: přidáno ${added} lidí, ${placed} posazeno`);
  pendingImport=null; $('#dlgMap').close(); save(); render();
  toast(`Přidáno ${added} lidí${placed?`, ${placed} posazeno na místa`:''}${skipped?`, ${skipped} duplicitních přeskočeno`:''}.`);
}
$('#mapOk').onclick=()=>ingest(true);
$('#mapPoolOnly').onclick=()=>ingest(false);

// manual person
$('#btnAddPerson').onclick=()=>{$('#npName').value='';$('#npUnit').value='';$('#npRole').value='';$('#npClass').value='';$('#npFte').value='1';$('#dlgPerson').showModal();};
$('#npCancel').onclick=()=>$('#dlgPerson').close();
$('#npOk').onclick=()=>{const name=$('#npName').value.trim(); if(!name){$('#npName').focus();return;}
  const id='h'+(state.nextPid++); state.people[id]={id,name,src:$('#npSrc').value,unit:$('#npUnit').value.trim(),role:$('#npRole').value.trim(),cls:$('#npClass').value.trim(),fte:$('#npFte').value.trim()};
  logChange('přidání osoby',name+' ('+$('#npSrc').value+')'); $('#dlgPerson').close(); save(); render();};

// ---------- export / persistence ----------
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);}
const stamp=()=>new Date().toISOString().slice(0,10);
$('#btnVacant').onclick=()=>{
  const m=byId(); const rows=[];
  for(const u of state.units){ const path=unitPath(u); const loc=unitLoc(u);
    u.positions.filter(p=>!p.person).forEach(p=>rows.push({'Sekce':path[1]||'', 'Odbor':u.level==='odbor'?u.name:(m[u.parent]&&m[u.parent].level==='odbor'?m[u.parent].name:''), 'Útvar':u.name,'Úroveň':LEVEL_LBL[u.level],'Lokalita':loc?LOC[loc].name:'','Místo':p.label,'Druh':KIND_LBL[p.kind],'Kategorie':p.cat==='nad'?'nadpožadavek':'delimitace','Zdroj útvaru':u.src})); }
  const byUnit=state.units.map(u=>{const f=u.positions.filter(p=>!p.person); const loc=unitLoc(u); return {'Útvar':u.name,'Úroveň':LEVEL_LBL[u.level],'Lokalita':loc?LOC[loc].name:'','Volných míst':f.length,'z toho vedoucí':f.filter(p=>p.kind==='head').length,'z toho delimitace':f.filter(p=>p.cat==='delim').length,'z toho nadpožadavek':f.filter(p=>p.cat==='nad').length,'Míst celkem':u.positions.length};}).filter(r=>r['Volných míst']);
  const cols=[...LOCATIONS,{id:null,name:'Neurčeno'}].map(l=>{const f=rows.filter(r=>r['Lokalita']===(l.id?l.name:'')); return {'Lokalita':l.name,'Volných míst':f.length,'z toho vedoucí':f.filter(r=>r['Druh']==='vedoucí').length,'delimitace':f.filter(r=>r['Kategorie']==='delimitace').length,'nadpožadavek':f.filter(r=>r['Kategorie']==='nadpožadavek').length};}).filter(r=>r['Volných míst']);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows.length?rows:[{'Útvar':'žádná volná místa'}]),'Volná místa');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(byUnit.length?byUnit:[{'Útvar':''}]),'Podle útvarů');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(cols.length?cols:[{'Lokalita':''}]),'Podle lokalit');
  XLSX.writeFile(wb,`URU_volna_mista_${stamp()}.xlsx`); toast(`Exportováno ${rows.length} volných míst.`);
};
$('#btnExport').onclick=()=>{
  const rows=[]; const m=byId();
  for(const u of state.units){ const path=unitPath(u);
    for(const p of u.positions){ const h=p.person?state.people[p.person]:null;
      rows.push({'Sekce':path[1]||'', 'Odbor':u.level==='odbor'?u.name:(m[u.parent]&&m[u.parent].level==='odbor'?m[u.parent].name:''), 'Útvar':u.name,'Úroveň':LEVEL_LBL[u.level],'Zdroj útvaru':u.src,
        'Místo':p.label,'Druh':KIND_LBL[p.kind],'Kategorie místa':p.cat==='nad'?'nadpožadavek':'delimitace',
        'Lokalita':(()=>{const l=h?personLoc(h).id:unitLoc(u);return l?LOC[l].name:'';})(),'Jméno':h?h.name:'','Zdrojový úřad':h?h.src:'','Současný útvar':h?h.unit:'','Současné označení místa':h?h.role:'','Číslo místa':h?h.posId:'','Kategorie':h?h.cat:'','Obory služby':h?h.fields:'','Platová třída':h?h.cls:'','Úvazek':h?h.fte:'','Poznámka':h?h.note:''}); } }
  const assigned=new Set(allPositions().map(x=>x.p.person).filter(Boolean));
  const un=Object.values(state.people).filter(p=>!assigned.has(p.id)).map(p=>({'Jméno':p.name,'Lokalita':p.loc?LOC[p.loc].name:'','Zdrojový úřad':p.src,'Současný útvar':p.unit,'Označení místa':p.role,'Číslo místa':p.posId,'Kategorie':p.cat,'Obory služby':p.fields,'Platová třída':p.cls,'Úvazek':p.fte,'Poznámka':p.note}));
  const sum=state.units.map(u=>({'Útvar':u.name,'Úroveň':LEVEL_LBL[u.level],'Zdroj':u.src,'Míst':u.positions.length,'Obsazeno':u.positions.filter(p=>p.person).length,'Volných':u.positions.filter(p=>!p.person).length,'z toho nadpožadavek volných':u.positions.filter(p=>!p.person&&p.cat==='nad').length}));
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'Obsazení');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(un.length?un:[{'Jméno':''}]),'Nezařazení');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(sum),'Souhrn útvarů');
  XLSX.writeFile(wb,`URU_obsazeni_${stamp()}.xlsx`);
};
$('#btnSave').onclick=()=>download(new Blob([JSON.stringify(state,null,1)],{type:'application/json'}),`URU_obsazeni_${stamp()}.json`);
$('#btnLoad').onclick=()=>$('#fileJson').click();
$('#fileJson').onchange=async e=>{const f=e.target.files[0];if(!f)return;e.target.value='';
  try{const s=JSON.parse(await f.text()); if(!s.units||!s.people) throw new Error('neplatný formát'); state=s; const mg=migrateStructure(state); logChange('načtení','stav nahrazen ze souboru '+f.name); save(); render(); toast('Stav načten.'); reportMigration(mg); toast('Stav načten.');}catch(err){alert('Soubor se nepodařilo načíst: '+err.message);}};
$('#btnReset').onclick=()=>{ if(confirm('Opravdu vymazat všechny lidi i úpravy míst a vrátit prázdný organigram? (Doporučuji nejdřív „Uložit stav“.)')){const v=state.view,z=state.zoom;state=freshState();state.view=v;state.zoom=z;logChange('vymazání','celý stav vymazán');save();render();} };
let allCollapsed=false;
$('#btnCollapse').onclick=()=>{allCollapsed=!allCollapsed; state.units.forEach(u=>{ if(u.level!=='predseda') state.collapsed[u.id]=allCollapsed; }); $('#btnCollapse').textContent=allCollapsed?'Rozbalit vše':'Sbalit vše'; render();};
// ---------- global search ----------
const matches=(p,q)=>[p.name,p.unit,p.role,p.posId,p.src].join(' ').toLowerCase().includes(q);
function searchHits(){ const q=$('#search').value.trim().toLowerCase(); if(!q) return {q,hits:[]};
  return {q,hits:Object.values(state.people).filter(p=>matches(p,q)).map(p=>({p,at:currentPosOf(p.id)})).sort((a,b)=>(a.at?0:1)-(b.at?0:1)||a.p.name.localeCompare(b.p.name,'cs'))}; }
function renderSearch(){
  const {q,hits}=searchHits(); const res=$('#sres');
  if(!q){ $('#scnt').textContent=''; res.classList.remove('open'); res.innerHTML=''; return; }
  const asg=hits.filter(h=>h.at).length;
  $('#scnt').textContent=hits.length?`${hits.length} nalezeno (${asg} zařazených, ${hits.length-asg} nezařazených)`:'nic nenalezeno';
  res.innerHTML=hits.slice(0,40).map(h=>`<div class="r ${h.at?'':'un'}" data-pid="${h.p.id}"><span><b>${esc(h.p.name)}</b> <span style="color:var(--muted);font-size:12px">${esc(h.p.role||'')}</span></span><span class="s" style="background:${SRC_COLOR[SOURCES.includes(h.p.src)?h.p.src:'Jiný']}">${esc(h.p.src)}</span><span class="w">${h.at?esc(unitPath(h.at.u).slice(1).join(' › '))+' – '+esc(h.at.p.label):'nezařazen/a · dříve '+esc(h.p.unit||'—')}</span></div>`).join('')+(hits.length>40?`<div class="more">… a dalších ${hits.length-40}</div>`:'');
  res.classList.toggle('open',hits.length>0&&document.activeElement===$('#search'));
  res.querySelectorAll('.r').forEach(r=>r.onmousedown=e=>{e.preventDefault(); jumpTo(r.dataset.pid);});
}
function jumpTo(pid){
  const at=currentPosOf(pid); const m=byId();
  if(at){ let c=at.u; while(c){ state.collapsed[c.id]=false; c=m[c.parent]; } if(state.view!=='chart'&&state.view!=='loc'&&state.view!=='tree') state.view='tree'; }
  else { activeFilters=new Set(SOURCES); $('#filters').querySelectorAll('input').forEach(i=>i.checked=true); }
  render(); $('#sres').classList.remove('open');
  const cont=at?(state.view==='chart'?'#chart':state.view==='loc'?'#locview':'#tree'):'#pool';
  const el=document.querySelector(`${cont} .person[data-pid="${pid}"]`)||document.querySelector(`.person[data-pid="${pid}"]`);
  if(el){ el.scrollIntoView({block:'center',inline:'center'}); el.classList.add('flash'); setTimeout(()=>el.classList.remove('flash'),1700); el.focus({preventScroll:true}); }
}
$('#search').oninput=()=>{ const {q,hits}=searchHits(); if(q){ const m=byId(); hits.forEach(h=>{ if(h.at){ let c=h.at.u; while(c){ state.collapsed[c.id]=false; c=m[c.parent]; } } }); } render(); renderSearch(); };
$('#search').onfocus=()=>{ if($('#search').value.trim()) renderSearch(); };
$('#search').onblur=()=>setTimeout(()=>$('#sres').classList.remove('open'),150);
$('#search').onkeydown=e=>{ if(e.key==='Enter'){ const {hits}=searchHits(); if(hits.length) jumpTo(hits[0].p.id); } if(e.key==='Escape'){ $('#search').value=''; render(); renderSearch(); $('#search').blur(); } };


// ---------- box diagram view ----------
let chartFresh=true;
const CRIT_STEPS=[null,25,50,75]; let critLevel=0;
function isCrit(u){ const v=CRIT_STEPS[critLevel]; if(!v) return false; const c=childrenOf(u.id).length?subtreeCount(u):{total:u.positions.length,filled:u.positions.filter(p=>p.person).length}; if(!c.total) return false; return 100*c.filled/c.total<=v; }
$('#crit').oninput=()=>{ critLevel=+$('#crit').value; const v=CRIT_STEPS[critLevel]; $('#critVal').textContent=v?`obsazeno 0–${v} %`:'vypnuto'; document.body.classList.toggle('critmode',!!v); render(); };
function setView(v){ if(!ROLE.org&&!['it','chart','loc'].includes(v)) v='it'; state.view=v; if(v==='chart') chartFresh=true; document.body.classList.toggle('view-chart',v==='chart'); document.body.classList.toggle('view-loc',v==='loc'); document.body.classList.toggle('view-sys',v==='sys'); document.body.classList.toggle('view-it',v==='it');
  $('#vwTree').classList.toggle('on',!['chart','loc','sys','it'].includes(v)); $('#vwSys').classList.toggle('on',v==='sys'); $('#vwIT').classList.toggle('on',v==='it'); $('#vwChart').classList.toggle('on',v==='chart'); $('#vwLoc').classList.toggle('on',v==='loc'); $('#zoomWrap').hidden=v!=='chart'; $('#critWrap').hidden=v!=='chart'; render(); }
$('#vwTree').onclick=()=>setView('tree'); $('#vwChart').onclick=()=>setView('chart'); $('#vwLoc').onclick=()=>setView('loc'); $('#vwSys').onclick=()=>setView('sys'); $('#vwIT').onclick=()=>setView('it');
$('#zoom').oninput=()=>{ state.zoom=+$('#zoom').value; $('#zoomVal').textContent=state.zoom+' %'; const oc=$('#chart .oc'); if(oc) oc.style.transform='scale('+state.zoom/100+')'; };

function boxEl(u){
  const box=document.createElement('div'); box.className='box '+u.level; box.dataset.uid=u.id;
  const filled=u.positions.filter(p=>p.person).length,total=u.positions.length,free=total-filled;
  const sub=subtreeCount(u); const crit=isCrit(u); if(crit) box.classList.add('crit'); const cs=childrenOf(u.id).length?sub:{total,filled}; const pctTxt=cs.total?Math.round(100*cs.filled/cs.total)+' %':'';
  box.innerHTML=`<div class="bh" style="border-top-color:${SRC_DARK[u.src]||'#999'}"><div class="bn">${esc(u.name)}</div>
    <div class="bm"><span class="srcbadge" style="background:${SRC_COLOR[u.src]}">${esc(u.src)}</span><span class="pct">${pctTxt}</span><span class="fill ${filled===total&&total?'full':''}" title="obsazeno / míst${sub.total!==total?' (v závorce včetně podřízených)':''}">${filled}/${total}${sub.total!==total?` <span style="opacity:.7">(${sub.filled}/${sub.total})</span>`:''}</span></div></div>`;
  box.querySelector('.bm').insertBefore(locSelect(u),box.querySelector('.bm .fill'));
  const bp=document.createElement('div'); bp.className='bp';
  const heads=u.positions.filter(p=>p.kind==='head'), rest=u.positions.filter(p=>p.kind!=='head');
  [...heads,...rest].forEach(p=>{ if(p.person&&state.people[p.person]){const c=personChip(state.people[p.person]); if(p.kind==='head') c.classList.add('lead'); c.title=p.label+'\n'+c.title; bp.appendChild(c);} });
  if(free>0){const f=document.createElement('div');f.className='free';f.textContent=free===1?'1 volné místo':(free<5?free+' volná místa':free+' volných míst');bp.appendChild(f);}
  const open=document.createElement('button'); open.className='bopen'; open.textContent='otevřít ve stromu'; open.onclick=e=>{e.stopPropagation(); let c=u; const m=byId(); while(c){state.collapsed[c.id]=false;c=m[c.parent];} setView('tree'); const el=document.querySelector(`#tree .unit[data-uid="${u.id}"]`); if(el) el.scrollIntoView({block:'start'});};
  bp.appendChild(open); box.appendChild(bp);
  box.addEventListener('dragover',e=>{e.preventDefault();box.classList.add('over');});
  box.addEventListener('dragleave',()=>box.classList.remove('over'));
  box.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();box.classList.remove('over');const pid=e.dataTransfer.getData('text/pid');if(pid&&ROLE.org)placeInUnit(pid,u);});
  return box;
}
// children of odbor-level (and stacked oddělení under sekce/predseda) render as a vertical stack; sekce and odbory render horizontally
function chartNode(u){
  const li=document.createElement('li'); li.appendChild(boxEl(u));
  const kids=childrenOf(u.id); if(!kids.length) return li;
  const horiz=kids.filter(k=>k.level==='sekce'||k.level==='odbor'), stack=kids.filter(k=>k.level==='odd');
  const wrap=document.createElement('div'); wrap.className='oc-down'+(horiz.length?'':' stack-only'); wrap.style.width='100%';
  if(horiz.length||stack.length){
    const row=document.createElement('ul'); row.className='oc-row';
    horiz.forEach(k=>row.appendChild(chartNode(k)));
    if(stack.length){ const sli=document.createElement('li'); const st=document.createElement('ul'); st.className='oc-stack'; st.style.width='218px'; sli.className='oc-stackcol';
      stack.forEach(k=>{const x=document.createElement('li'); x.appendChild(boxEl(k)); st.appendChild(x);}); sli.appendChild(st); row.appendChild(sli); }
    wrap.appendChild(row);
  }
  li.appendChild(wrap); return li;
}
function renderLoc(){
  const c=$('#locview'); const st=c.scrollTop; c.innerHTML='';
  const cols=[...LOCATIONS,{id:null,abbr:'?',name:'Lokalita neurčena'}];
  const grid=document.createElement('div'); grid.className='loccols';
  const assignedPeople=allPositions().filter(x=>x.p.person&&state.people[x.p.person]).map(x=>({p:state.people[x.p.person],u:x.u,pos:x.p}));
  cols.forEach(l=>{
    const people=assignedPeople.filter(x=>personLoc(x.p).id===l.id);
    const col=document.createElement('div'); col.className='loccol'+(l.id?'':' none');
    const bySrc={}; people.forEach(x=>bySrc[x.p.src]=(bySrc[x.p.src]||0)+1);
    col.innerHTML=`<div class="lh"><span class="abbr">${esc(l.abbr)}</span><b>${esc(l.name)}</b><span class="n">${people.length}</span></div>
      <div class="srcline">${Object.entries(bySrc).sort().map(([s,n])=>`${esc(s)} ${n}`).join(' · ')||'&nbsp;'}</div>`;
    const lb=document.createElement('div'); lb.className='lb';
    const byUnit=new Map(); people.forEach(x=>{ if(!byUnit.has(x.u)) byUnit.set(x.u,[]); byUnit.get(x.u).push(x); });
    [...byUnit.entries()].sort((a,b)=>state.units.indexOf(a[0])-state.units.indexOf(b[0])).forEach(([u,xs])=>{
      const h=document.createElement('div'); h.className='lu'; const ul=unitLoc(u); h.innerHTML=`${esc(u.name)} <span>${xs.length}/${u.positions.length}${ul&&ul!==l.id?' · útvar: '+LOC[ul].abbr:''}</span>`; lb.appendChild(h);
      const pl=document.createElement('div'); pl.className='people'; xs.sort((a,b)=>(a.pos.kind==='head'?0:1)-(b.pos.kind==='head'?0:1)).forEach(x=>{const ch=personChip(x.p); if(x.pos.kind==='head') ch.classList.add('lead'); ch.title=x.pos.label+'\n'+ch.title; pl.appendChild(ch);}); lb.appendChild(pl); });
    if(!people.length){ const e=document.createElement('div'); e.className='hint'; e.style.cssText='color:var(--muted);font-size:12px;padding:12px 4px;text-align:center'; e.textContent=l.id?'Nikdo. Přetáhněte sem osobu, nebo nastavte lokalitu u útvaru.':'Všichni zařazení mají lokalitu.'; lb.appendChild(e); }
    col.appendChild(lb);
    col.addEventListener('dragover',e=>{e.preventDefault();col.classList.add('over');}); col.addEventListener('dragleave',()=>col.classList.remove('over'));
    col.addEventListener('drop',e=>{e.preventDefault();col.classList.remove('over');const pid=e.dataTransfer.getData('text/pid'); const p=pid&&state.people[pid]; if(!p||!ROLE.org) return;
      p.loc=l.id||null; if(!p.loc) delete p.loc; logChange&&logChange('lokalita osoby',p.name+' → '+(l.id?l.name:'dle útvaru')); save(); render(); });
    grid.appendChild(col); });
  c.appendChild(grid); c.scrollTop=st;
}

// ---------- IT vybavení ----------
const IT_DEFAULT=[['hw','Notebook',1],['hw','Dokovací stanice',1],['hw','Monitor 24"',1],['hw','Monitor 27"',0],['hw','Klávesnice a myš',1],['hw','Mobilní telefon',0],['hw','Sluchátka s mikrofonem',0],['hw','Čtečka čipových karet',1],
  ['sw','Microsoft 365 (Office, Teams)',1],['sw','ESPIS – spisová služba',1],['sw','VITA Stavební úřad',0],['sw','Portál stavebníka / ISSŘ',0],['sw','Ekonomický systém',0],['sw','Personální systém',0],['sw','GIS / CAD prohlížeč',0],['sw','VPN',1]];
function ensureCatalog(){ if(state.itCatalog&&state.itCatalog.length) return false; state.itCatalog=IT_DEFAULT.map((x,i)=>({id:'it'+(i+1),cat:x[0],name:x[1],std:!!x[2],note:''})); return true; }
const catById=()=>Object.fromEntries((state.itCatalog||[]).map(c=>[c.id,c]));
function personItems(h){ return (h.it||[]).filter(x=>catById()[x.id]); }
const IT_SRC=['nový','DESÚ','MMR','ÚÚR','MD','MPO'];
function defaultItemSrc(h){ return IT_SRC.includes(h.src)?h.src:'nový'; }
function addItem(h,id,src,sn){ h.it=h.it||[]; if(h.it.some(x=>x.id===id)) return false; h.it.push({id,src:src||defaultItemSrc(h),sn:sn||''}); return true; }
let itSel=new Set(), itFilter={q:'',loc:'',none:false,notready:false}, itCollapsed={};
function poolRows(){ return (state.itPool||[]); }
function assignedCount(id,src){ let n=0; Object.values(state.people).forEach(h=>(h.it||[]).forEach(x=>{ if(x.id===id&&(x.src||defaultItemSrc(h))===src) n++; })); return n; }
function renderItPool(){
  const cat=catById(); const list=$('#itpoolList'); list.innerHTML='';
  const keys=new Map(); poolRows().forEach(r=>{ const k=r.id+'|'+r.src; keys.set(k,{id:r.id,src:r.src,qty:(keys.get(k)?.qty||0)+r.qty}); });
  Object.values(state.people).forEach(h=>(h.it||[]).forEach(x=>{ const src=x.src||defaultItemSrc(h); const k=x.id+'|'+src; if(!keys.has(k)) keys.set(k,{id:x.id,src,qty:0}); }));
  const byItem=new Map(); [...keys.values()].forEach(r=>{ if(!cat[r.id]) return; if(!byItem.has(r.id)) byItem.set(r.id,[]); byItem.get(r.id).push(r); });
  let totalAv=0, totalNeg=0;
  (state.itCatalog||[]).forEach(it=>{ const rs=byItem.get(it.id); if(!rs) return;
    const box=document.createElement('div'); box.className='pit'; let sumAv=0;
    const rowsHtml=rs.sort((a,b)=>IT_SRC.indexOf(a.src)-IT_SRC.indexOf(b.src)).map(r=>{ const used=assignedCount(r.id,r.src); const av=r.qty-used; sumAv+=av; if(av<0) totalNeg+=-av; else totalAv+=av;
      return `<div class="r" data-id="${r.id}" data-src="${r.src}"><span class="chip src-${r.src==='nový'?'Nové':r.src}" draggable="true" style="background:${SRC_COLOR[r.src==='nový'?'Nové':r.src]||'#eee'}">${esc(r.src)}</span><span style="color:var(--muted)">${r.qty} ks · přiděleno ${used}</span><span class="av ${av<0?'neg':(av===0?'zero':'')}" title="k dispozici">${av<0?'chybí '+(-av):av}</span><button class="q" data-d="-1" title="ubrat 1 ks ze zásoby">−</button><button class="q" data-d="1" title="přidat 1 ks">+</button></div>`; }).join('');
    box.innerHTML=`<div class="t"><span>${esc(it.name)}</span><span class="tot">${it.cat.toUpperCase()}</span></div>`+rowsHtml;
    box.querySelectorAll('.r').forEach(row=>{ const id=row.dataset.id, src=row.dataset.src;
      row.querySelector('.chip').addEventListener('dragstart',e=>{ e.dataTransfer.setData('text/it',id+'|'+src); e.dataTransfer.effectAllowed='copy'; });
      row.querySelectorAll('button.q').forEach(b=>b.onclick=()=>{ addStock(id,src,+b.dataset.d); }); });
    list.appendChild(box); });
  if(!list.children.length) list.innerHTML='<div class="hint" style="padding:20px 6px;text-align:center;color:var(--muted);font-size:13px">Zásoba je prázdná. Přidejte materiál tlačítkem výše.</div>';
  $('#itpoolCount').textContent=`(${totalAv} k dispozici${totalNeg?', chybí '+totalNeg:''})`;
}
function addStock(id,src,d,note){ state.itPool=state.itPool||[]; let r=state.itPool.find(x=>x.id===id&&x.src===src); if(!r){ r={id,src,qty:0,note:''}; state.itPool.push(r); } r.qty=Math.max(0,r.qty+d); if(note) r.note=note; if(!r.qty&&!assignedCount(id,src)) state.itPool=state.itPool.filter(x=>x!==r); logChange&&logChange('IT zásoba',`${catById()[id].name} (${src}): ${d>0?'+':''}${d} ks → ${r.qty}`); save(); render(); }
$('#itpoolAdd').onclick=()=>{ ensureCatalog(); $('#stItem').innerHTML=state.itCatalog.map(x=>`<option value="${x.id}">${x.cat.toUpperCase()} · ${esc(x.name)}</option>`).join(''); $('#stSrc').innerHTML=IT_SRC.map(v=>`<option>${v}</option>`).join(''); $('#stQty').value=1; $('#stNote').value=''; $('#dlgStock').showModal(); };
$('#stCancel').onclick=()=>$('#dlgStock').close();
$('#stOk').onclick=()=>{ const q=parseInt($('#stQty').value); if(!q||q<1) return; $('#dlgStock').close(); addStock($('#stItem').value,$('#stSrc').value,q,$('#stNote').value.trim()); };
function dropIt(e,targets){ const d=e.dataTransfer.getData('text/it'); if(!d) return false; const [id,src]=d.split('|'); let n=0; targets.forEach(h=>{ if(addItem(h,id,src)) n++; }); if(n){ logChange&&logChange('IT',`${catById()[id].name} (${src}) přiděleno ${n}×`); save(); render(); toast(`Přiděleno ${n}×.`); } return true; }
function itCounts(){ const c={}; Object.values(state.people).forEach(h=>personItems(h).forEach(x=>c[x.id]=(c[x.id]||0)+1)); return c; }
function renderIT(){
  const c=$('#itview'); const st=c.scrollTop; c.innerHTML='';
  if(ensureCatalog()) save();
  renderItPool();
  const cat=catById(); const counts=itCounts();
  const assigned=allPositions().filter(x=>x.p.person&&state.people[x.p.person]).map(x=>({h:state.people[x.p.person],u:x.u,p:x.p}));
  const q=itFilter.q.toLowerCase();
  const rows=assigned.filter(r=>(!q||(r.h.name+' '+unitPath(r.u).join(' ')).toLowerCase().includes(q))&&(!itFilter.loc||personLoc(r.h).id===itFilter.loc)&&(!itFilter.none||!personItems(r.h).length)&&(!itFilter.notready||personItems(r.h).some(x=>!x.ready)));
  let readyN=0,itemN=0; assigned.forEach(({h})=>personItems(h).forEach(x=>{ itemN++; if(x.ready) readyN++; }));
  const withNone=assigned.filter(r=>!personItems(r.h).length).length;
  const bar=document.createElement('div'); bar.className='itbar';
  const bySrc={}; assigned.forEach(({h})=>personItems(h).forEach(x=>{ const k=x.src||defaultItemSrc(h); bySrc[k]=(bySrc[k]||0)+1; }));
  bar.innerHTML=`<span class="sum"><b>${assigned.length}</b> rozsazených lidí · <b>${assigned.length-withNone}</b> s vybavením · <b style="${withNone?'color:var(--danger)':''}">${withNone}</b> bez vybavení${Object.keys(bySrc).length?' · položky: '+IT_SRC.filter(k=>bySrc[k]).map(k=>`${k} <b>${bySrc[k]}</b>`).join(', '):''}${itemN?` · připraveno <b style="color:${readyN===itemN?'var(--ok)':'inherit'}">${readyN}/${itemN}</b>`:''}</span>
    <input type="search" id="itQ" placeholder="filtr jména / útvaru…" value="${esc(itFilter.q)}" style="width:200px">
    <select id="itLoc"><option value="">všechny lokality</option>${LOCATIONS.map(l=>`<option value="${l.id}" ${itFilter.loc===l.id?'selected':''}>${l.abbr} · ${l.name}</option>`).join('')}</select>
    <label><input type="checkbox" id="itNone" ${itFilter.none?'checked':''}> jen bez vybavení</label><label><input type="checkbox" id="itNotReady" ${itFilter.notready?'checked':''}> jen s nepřipraveným</label>
    <button class="small" id="itCat">Katalog vybavení</button><button class="small" id="itXlsx">Export (xlsx)</button>
    <div class="bulk" id="itBulk" ${itSel.size?'':'hidden'}><b>${itSel.size} vybraných:</b><select id="itBulkSrc" title="zdroj přiřazovaných položek"><option value="">zdroj dle úřadu zaměstnance</option>${IT_SRC.map(v=>`<option value="${v}">${v}</option>`).join('')}</select><button class="small primary" id="itStd">Přiřadit standardní sadu</button><select id="itBulkItem"><option value="">— položku —</option>${(state.itCatalog||[]).map(x=>`<option value="${x.id}">${x.cat.toUpperCase()} · ${esc(x.name)}</option>`).join('')}</select><button class="small" id="itBulkAdd">Přidat</button><button class="small" id="itBulkDel">Odebrat</button><button class="small" id="itReady" title="označí všechny položky vybraných lidí jako připravené">Vše připraveno</button><button class="small" id="itClear">Zrušit výběr</button></div>`;
  c.appendChild(bar);
  // group by unit in structure order
  const byUnit=new Map(); rows.forEach(r=>{ if(!byUnit.has(r.u)) byUnit.set(r.u,[]); byUnit.get(r.u).push(r); });
  const units=state.units.filter(u=>byUnit.has(u));
  if(!units.length){ const e=document.createElement('div'); e.style.cssText='padding:24px;color:var(--muted)'; e.textContent=assigned.length?'Nikdo neodpovídá filtru.':'Zatím nikdo není rozsazen na místa – vybavení se přiřazuje rozsazeným lidem.'; c.appendChild(e); }
  units.forEach(u=>{
    const box=document.createElement('div'); box.className='itu'+(itCollapsed[u.id]?' collapsed':''); const ids=byUnit.get(u).map(r=>r.h.id); const allSel=ids.every(i=>itSel.has(i));
    const h=document.createElement('div'); h.className='h';
    h.innerHTML=`<input type="checkbox" ${allSel?'checked':''} title="vybrat celý útvar"><button class="tog">${itCollapsed[u.id]?'▸':'▾'}</button><span class="bar" style="background:${SRC_DARK[u.src]}"></span><span class="nm">${esc(unitPath(u).slice(1).join(' › ')||u.name)}</span><span class="lv">${LEVEL_LBL[u.level]} · ${ids.length} lidí${unitLoc(u)?' · '+LOC[unitLoc(u)].abbr:''}</span>`;
    h.querySelector('input').onchange=e=>{ ids.forEach(i=>e.target.checked?itSel.add(i):itSel.delete(i)); renderIT(); };
    h.querySelector('.tog').onclick=()=>{ itCollapsed[u.id]=!itCollapsed[u.id]; renderIT(); };
    h.addEventListener('dragover',e=>{ if([...e.dataTransfer.types].includes('text/it')){ e.preventDefault(); h.classList.add('over'); } }); h.addEventListener('dragleave',()=>h.classList.remove('over')); h.addEventListener('drop',e=>{ e.preventDefault(); h.classList.remove('over'); dropIt(e,byUnit.get(u).map(r=>r.h)); });
    box.appendChild(h);
    const rw=document.createElement('div'); rw.className='rows';
    byUnit.get(u).sort((a,b)=>(a.p.kind==='head'?0:1)-(b.p.kind==='head'?0:1)).forEach(r=>{
      const row=document.createElement('div'); row.className='itp'+(itSel.has(r.h.id)?' sel':''); const l=personLoc(r.h).id;
      row.innerHTML=`<input type="checkbox" ${itSel.has(r.h.id)?'checked':''}><div class="who"><span class="n">${esc(r.h.name)}</span><span class="m">${esc(r.p.label)} · ${esc(r.h.src)}${l?' · '+LOC[l].abbr:''}</span></div><div class="items"></div>`;
      row.querySelector('input').onchange=e=>{ e.target.checked?itSel.add(r.h.id):itSel.delete(r.h.id); renderIT(); };
      row.addEventListener('dragover',e=>{ if([...e.dataTransfer.types].includes('text/it')){ e.preventDefault(); e.stopPropagation(); row.classList.add('over'); } }); row.addEventListener('dragleave',()=>row.classList.remove('over')); row.addEventListener('drop',e=>{ e.preventDefault(); e.stopPropagation(); row.classList.remove('over'); dropIt(e,[r.h]); });
      const items=row.querySelector('.items'); const list=personItems(r.h);
      list.forEach(x=>{ const it=cat[x.id]; const chip=document.createElement('span'); chip.className='iti '+it.cat+(x.ready?' ready':'');
        const xs=x.src||defaultItemSrc(r.h);
        chip.innerHTML=`<span>${esc(it.name)}</span><select class="isrc ${xs==='nový'?'new':''}" title="zdroj: nový nákup, nebo delimitace z úřadu">${IT_SRC.map(v=>`<option ${v===xs?'selected':''}>${v}</option>`).join('')}</select>${it.cat==='hw'?`<span class="sn" contenteditable="true" spellcheck="false" title="inventární / sériové číslo">${esc(x.sn||'')}</span>`:''}<label class="rd" title="připraveno – nainstalováno pro sítě a systémy ÚRÚ"><input type="checkbox" ${x.ready?'checked':''}>${x.ready?'připraveno':'připravit'}</label><button class="x" title="odebrat">×</button>`;
        chip.querySelector('.rd input').onchange=e=>{ x.ready=e.target.checked; if(!x.ready) delete x.ready; logChange&&logChange('IT',`${r.h.name}: ${it.name} ${x.ready?'připraveno':'zrušeno připraveno'}`); save(); render(); };
        chip.querySelector('.isrc').onchange=e=>{ x.src=e.target.value; logChange&&logChange('IT',`${r.h.name}: ${it.name} zdroj ${x.src}`); save(); render(); };
        chip.querySelector('.x').onclick=()=>{ r.h.it=r.h.it.filter(y=>y!==x); logChange&&logChange('IT',`${r.h.name}: odebráno ${it.name}`); save(); render(); };
        const sn=chip.querySelector('.sn'); if(sn){ sn.onblur=()=>{ const v=sn.textContent.trim(); if(v!==(x.sn||'')){ x.sn=v; logChange&&logChange('IT',`${r.h.name}: ${it.name} inv. č. ${v}`); save(); } }; sn.onkeydown=e=>{ if(e.key==='Enter'){e.preventDefault();sn.blur();} }; }
        items.appendChild(chip); });
      if(!list.length){ const n=document.createElement('span'); n.className='no'; n.textContent='bez vybavení'; items.appendChild(n); }
      const add=document.createElement('span'); add.className='itadd'; add.innerHTML='<button>+ přidat</button>';
      add.querySelector('button').onclick=e=>{ e.stopPropagation(); openItMenu(add,r.h); };
      items.appendChild(add); rw.appendChild(row); });
    box.appendChild(rw); c.appendChild(box); });
  c.scrollTop=st;
  $('#itQ').oninput=()=>{ itFilter.q=$('#itQ').value; renderIT(); $('#itQ').focus(); $('#itQ').setSelectionRange(99,99); };
  $('#itLoc').onchange=()=>{ itFilter.loc=$('#itLoc').value; renderIT(); };
  $('#itNone').onchange=()=>{ itFilter.none=$('#itNone').checked; renderIT(); };
  $('#itNotReady').onchange=()=>{ itFilter.notready=$('#itNotReady').checked; renderIT(); };
  $('#itCat').onclick=openCatalog; $('#itXlsx').onclick=exportIT;
  const selPeople=()=>[...itSel].map(i=>state.people[i]).filter(Boolean);
  const bs=$('#itStd'); if(bs){ bs.onclick=()=>{ let n=0; const bsrc=$('#itBulkSrc').value||null; selPeople().forEach(h=>state.itCatalog.filter(x=>x.std).forEach(x=>{ if(addItem(h,x.id,bsrc)) n++; })); logChange&&logChange('IT',`standardní sada u ${itSel.size} lidí (+${n} položek)`); save(); render(); toast(`Přidáno ${n} položek.`); };
    $('#itBulkAdd').onclick=()=>{ const id=$('#itBulkItem').value; if(!id) return; let n=0; const bsrc=$('#itBulkSrc').value||null; selPeople().forEach(h=>{ if(addItem(h,id,bsrc)) n++; }); logChange&&logChange('IT',`hromadně přidáno ${cat[id].name} u ${n} lidí`); save(); render(); toast(`Přidáno u ${n} lidí.`); };
    $('#itBulkDel').onclick=()=>{ const id=$('#itBulkItem').value; if(!id) return; let n=0; selPeople().forEach(h=>{ const b=(h.it||[]).length; h.it=(h.it||[]).filter(x=>x.id!==id); if(h.it.length<b) n++; }); logChange&&logChange('IT',`hromadně odebráno ${cat[id].name} u ${n} lidí`); save(); render(); toast(`Odebráno u ${n} lidí.`); };
    $('#itReady').onclick=()=>{ let n=0; selPeople().forEach(h=>(h.it||[]).forEach(x=>{ if(!x.ready){ x.ready=true; n++; } })); logChange&&logChange('IT',`připraveno: ${n} položek u ${itSel.size} lidí`); save(); render(); toast(`Označeno ${n} položek.`); };
    $('#itClear').onclick=()=>{ itSel.clear(); renderIT(); }; }
}
function openItMenu(anchor,h){
  document.querySelectorAll('.itmenu').forEach(m=>m.remove());
  const m=document.createElement('div'); m.className='itmenu'; const have=new Set((h.it||[]).map(x=>x.id));
  const draw=q=>{ const items=(state.itCatalog||[]).filter(x=>!q||x.name.toLowerCase().includes(q)); let html='';
    ['hw','sw'].forEach(cat=>{ const xs=items.filter(x=>x.cat===cat); if(!xs.length) return; html+=`<div class="g">${cat==='hw'?'Hardware':'Software'}</div>`+xs.map(x=>`<div class="o ${have.has(x.id)?'have':''}" data-id="${x.id}"><span>${esc(x.name)}</span><span class="st">${have.has(x.id)?'má':(x.std?'standard':'')}</span></div>`).join(''); });
    html+=`<div class="o" data-id="__std"><b>Celá standardní sada</b></div>`; return html; };
  m.innerHTML=`<input type="search" placeholder="hledat…">`+`<div class="list">${draw('')}</div>`;
  const inp=m.querySelector('input'); inp.oninput=()=>{ m.querySelector('.list').innerHTML=draw(inp.value.trim().toLowerCase()); bindOpts(); };
  const bindOpts=()=>m.querySelectorAll('.o').forEach(o=>o.onclick=()=>{ const id=o.dataset.id; let n=0;
    if(id==='__std') state.itCatalog.filter(x=>x.std).forEach(x=>{ if(addItem(h,x.id)) n++; }); else if(addItem(h,id)) n++;
    if(n){ logChange&&logChange('IT',`${h.name}: přidáno ${id==='__std'?'standardní sada':catById()[id].name}`); save(); render(); } else m.remove(); });
  bindOpts(); anchor.appendChild(m); inp.focus();
  setTimeout(()=>document.addEventListener('click',function off(e){ if(!m.contains(e.target)){ m.remove(); document.removeEventListener('click',off); } }),0);
}
function openCatalog(){ ensureCatalog(); const counts=itCounts();
  $('#catBody').innerHTML=(state.itCatalog).map(x=>`<tr data-id="${x.id}"><td>${x.cat.toUpperCase()}</td><td><input type="text" value="${esc(x.name)}"></td><td><input type="text" value="${esc(x.note||'')}"></td><td><input type="checkbox" ${x.std?'checked':''}></td><td class="n">${counts[x.id]||0}</td><td>${counts[x.id]?'':'<button class="small del">×</button>'}</td></tr>`).join('');
  $('#catBody').querySelectorAll('tr').forEach(tr=>{ const x=state.itCatalog.find(y=>y.id===tr.dataset.id); const [nm,nt,std]=tr.querySelectorAll('input');
    nm.onchange=()=>{ x.name=nm.value.trim(); save(); }; nt.onchange=()=>{ x.note=nt.value.trim(); save(); }; std.onchange=()=>{ x.std=std.checked; save(); };
    const d=tr.querySelector('.del'); if(d) d.onclick=()=>{ state.itCatalog=state.itCatalog.filter(y=>y!==x); save(); openCatalog(); }; });
  $('#dlgCat').showModal(); }
$('#catAdd').onclick=()=>{ const name=$('#catName').value.trim(); if(!name) return; state.itCatalog.push({id:'it'+Date.now().toString(36),cat:$('#catType').value,name,note:$('#catNote').value.trim(),std:$('#catStd').checked}); $('#catName').value=''; $('#catNote').value=''; $('#catStd').checked=false; logChange&&logChange('IT','katalog: přidáno '+name); save(); openCatalog(); };
$('#catClose').onclick=()=>{ $('#dlgCat').close(); render(); };
function exportIT(){ const cat=catById();
  const assigned=allPositions().filter(x=>x.p.person&&state.people[x.p.person]).map(x=>({h:state.people[x.p.person],u:x.u,p:x.p}));
  const people=assigned.map(({h,u,p})=>{ const l=personLoc(h).id; const its=personItems(h); return {'Jméno':h.name,'Zdrojový úřad':h.src,'Útvar':u.name,'Místo':p.label,'Lokalita':l?LOC[l].name:'','HW':its.filter(x=>cat[x.id].cat==='hw').map(x=>cat[x.id].name+' ['+(x.src||defaultItemSrc(h))+']'+(x.sn?' ('+x.sn+')':'')).join('; '),'SW':its.filter(x=>cat[x.id].cat==='sw').map(x=>cat[x.id].name+' ['+(x.src||defaultItemSrc(h))+']').join('; '),'Počet položek':its.length,'z toho nových':its.filter(x=>(x.src||defaultItemSrc(h))==='nový').length,'Připraveno':its.filter(x=>x.ready).length+'/'+its.length}; });
  const lines=[]; assigned.forEach(({h,u})=>personItems(h).forEach(x=>lines.push({'Jméno':h.name,'Útvar':u.name,'Lokalita':(()=>{const l=personLoc(h).id;return l?LOC[l].name:'';})(),'Typ':cat[x.id].cat.toUpperCase(),'Položka':cat[x.id].name,'Zdroj':x.src||defaultItemSrc(h),'Připraveno':x.ready?'ano':'','Inventární / sériové č.':x.sn||''})));
  const locs=[...LOCATIONS,{id:null,name:'Neurčeno'}];
  const totals=(state.itCatalog||[]).map(x=>{ const o={'Typ':x.cat.toUpperCase(),'Položka':x.name,'Standard':x.std?'ano':'','Celkem':0}; IT_SRC.forEach(k=>o[k==='nový'?'nový nákup':'delim. '+k]=0); locs.forEach(l=>o[l.name]=0);
    assigned.forEach(({h})=>{ const y=(h.it||[]).find(y=>y.id===x.id); if(y){ o['Celkem']++; const k=y.src||defaultItemSrc(h); o[k==='nový'?'nový nákup':'delim. '+k]++; const l=personLoc(h).id; o[l?LOC[l].name:'Neurčeno']++; } }); return o; });
  const buy=(state.itCatalog||[]).map(x=>{ const o={'Typ':x.cat.toUpperCase(),'Položka':x.name,'Nových celkem':0}; locs.forEach(l=>o[l.name]=0);
    assigned.forEach(({h})=>{ const y=(h.it||[]).find(y=>y.id===x.id); if(y&&(y.src||defaultItemSrc(h))==='nový'){ o['Nových celkem']++; const l=personLoc(h).id; o[l?LOC[l].name:'Neurčeno']++; } }); return o; }).filter(o=>o['Nových celkem']);
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(people.length?people:[{'Jméno':''}]),'Lidé'); XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(lines.length?lines:[{'Jméno':''}]),'Položky'); XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(totals),'Součty zdroj a lokalita'); XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(buy.length?buy:[{'Položka':'žádné nové položky'}]),'K nákupu');
  const stock=poolRows().map(r=>({'Typ':cat[r.id]?cat[r.id].cat.toUpperCase():'','Položka':cat[r.id]?cat[r.id].name:r.id,'Zdroj':r.src,'V zásobě celkem':r.qty,'Přiděleno':assignedCount(r.id,r.src),'K dispozici':r.qty-assignedCount(r.id,r.src),'Poznámka':r.note||''}));
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(stock.length?stock:[{'Položka':''}]),'Zásoba');
  XLSX.writeFile(wb,`URU_IT_vybaveni_${stamp()}.xlsx`); }
// ---------- systemizace ----------
const SYS_TYP={sluz:'služební',prac:'pracovní'};
function stupen(u,p){ if(p.kind!=='head') return 0; return {predseda:4,sekce:3,odbor:2,odd:1}[u.level]||0; }
function defaultOzn(u,p){ if(p.kind==='asst') return 'ORef/VRef'; if(p.kind==='ref') return 'ORa';
  return {predseda:'vedoucí služebního úřadu',sekce:'VRa/místopředseda/'+u.name.replace(/^Místopředseda – /,''),odbor:'VRa/ředitel odboru/'+u.name.replace(/^Odbor /,'odbor '),odd:'ORa/vedoucí oddělení/'+u.name.replace(/^(Samostatné )?[Oo]ddělení /,m=>m.toLowerCase())}[u.level]||p.label; }
function defaultCls(u,p){ if(p.kind==='asst') return 9; if(p.kind==='ref') return 13; return {predseda:16,sekce:15,odbor:14,odd:13}[u.level]||13; }
function sysOf(u,p){ const typ=p.typ||(p.kind==='asst'?'prac':'sluz');
  return {typ, fte:p.fte??1, ozn:p.ozn??defaultOzn(u,p), obor:p.obor||'', kod:p.kod||'', odb:p.odb||'', cls:p.cls??defaultCls(u,p), obc:p.obc??(typ==='sluz'), zk:!!p.zk, zanik:p.zanik||''}; }
function personCls(h){ const n=parseInt(String(h.cls||'').replace(/\D/g,'')); return isNaN(n)?null:n; }
function clsMismatch(u,p){ if(!p.person||!state.people[p.person]) return false; const pc=personCls(state.people[p.person]); const sc=sysOf(u,p).cls; return pc!==null&&sc&&pc!==sc; }
let sysSel=new Set(), sysFilter={q:'',free:false,mis:false};
function sysRows(){ const rows=[]; let n=0; const m=byId();
  for(const u of state.units){ for(const p of u.positions){ n++; rows.push({n,u,p,sys:sysOf(u,p)}); } } return rows; }
function renderSys(){
  const c=$('#sysview'); const st=c.scrollTop; c.innerHTML='<div style="padding:20px;color:var(--muted)">Sestavuji tabulku…</div>';
  const all=sysRows(); const q=sysFilter.q.toLowerCase();
  const rows=all.filter(r=>(!q||unitPath(r.u).join(' ').toLowerCase().includes(q)||r.sys.ozn.toLowerCase().includes(q))&&(!sysFilter.free||!r.p.person)&&(!sysFilter.mis||clsMismatch(r.u,r.p)));
  const sluz=all.filter(r=>r.sys.typ==='sluz').length, prac=all.length-sluz, mis=all.filter(r=>clsMismatch(r.u,r.p)).length, fte=all.reduce((a,r)=>a+(+r.sys.fte||0),0);
  const bar=document.createElement('div'); bar.className='sysbar';
  bar.innerHTML=`<span class="sum"><b>${all.length}</b> míst · <b>${sluz}</b> služebních · <b>${prac}</b> pracovních · úvazky <b>${fte.toLocaleString('cs-CZ')}</b>${mis?` · <b style="color:var(--danger)">${mis}</b> nesoulad tříd`:''}</span>
    <input type="search" id="sysQ" placeholder="filtr útvaru / označení…" value="${esc(sysFilter.q)}" style="width:220px">
    <label><input type="checkbox" id="sysFree" ${sysFilter.free?'checked':''}> jen neobsazená</label>
    <label><input type="checkbox" id="sysMis" ${sysFilter.mis?'checked':''}> jen nesoulad třídy</label>
    <span class="kbd">Vybrat: klik na zaškrtávátko řádku nebo útvaru · Shift = rozsah</span>
    <div class="bulk" id="sysBulk" ${sysSel.size?'':'hidden'}><b>${sysSel.size} vybraných:</b>
      <select id="bkField"><option value="cls">platová třída</option><option value="typ">typ místa</option><option value="obor">obor služby</option><option value="kod">kód činností</option><option value="odb">odb. požadavky</option><option value="fte">úvazek</option><option value="obc">občanství ČR</option><option value="zk">zákaz konkurence</option></select>
      <input type="text" id="bkVal" placeholder="hodnota" style="width:120px"><button class="small primary" id="bkApply">Nastavit</button><button class="small" id="bkClear">Zrušit výběr</button></div>`;
  c.appendChild(bar);
  const t=document.createElement('table'); t.className='sys';
  t.innerHTML=`<thead><tr><th></th><th>#</th><th title="stupeň řízení (4 = vedoucí úřadu … 1 = vedoucí oddělení)">St.</th><th>Typ</th><th style="min-width:260px">Funkční a služební označení</th><th>Úvazek</th><th>Obor služby</th><th>Kód činn.</th><th>Odb. pož.</th><th>Tř.</th><th title="požadavek na státní občanství ČR">Obč.</th><th title="zákaz konkurence">Z.k.</th><th>Zánik</th><th>Obsazeno</th></tr></thead>`;
  const tb=document.createElement('tbody'); let lastU=null, lastClicked=null; const visIds=rows.map(r=>r.p.id);
  const bind=(el,r,field,conv)=>{ el.onchange=()=>{ let v=conv?conv(el):el.value; if(v===''||v===null||v===undefined) delete r.p[field]; else r.p[field]=v; logChange&&logChange('systemizace',`${r.u.name} / ${r.sys.ozn}: ${field} = ${v}`); save(); render(); }; };
  rows.forEach(r=>{
    if(r.u!==lastU){ lastU=r.u; const tr=document.createElement('tr'); tr.className='ug'; const uid=r.u.id;
      const ids=rows.filter(x=>x.u===r.u).map(x=>x.p.id); const allSel=ids.every(i=>sysSel.has(i));
      tr.innerHTML=`<td><input type="checkbox" ${allSel?'checked':''} title="vybrat celý útvar"></td><td colspan="13"><span class="bar" style="background:${SRC_DARK[r.u.src]}"></span>${esc(unitPath(r.u).slice(1).join(' › ')||r.u.name)}<span class="lv">${LEVEL_LBL[r.u.level]} · ${r.u.positions.length} míst · ${esc(r.u.src)}</span></td>`;
      tr.querySelector('input').onchange=e=>{ ids.forEach(i=>e.target.checked?sysSel.add(i):sysSel.delete(i)); renderSys(); };
      tb.appendChild(tr); }
    const tr=document.createElement('tr'); const S=r.sys; const mis=clsMismatch(r.u,r.p); tr.className=(sysSel.has(r.p.id)?'sel ':'')+(r.p.cat==='nad'?'nad ':'')+(mis?'mis':''); tr.dataset.pid=r.p.id;
    const h=r.p.person?state.people[r.p.person]:null; const stp=stupen(r.u,r.p);
    tr.innerHTML=`<td><input type="checkbox" ${sysSel.has(r.p.id)?'checked':''}></td><td class="num">${r.n}</td><td class="st">${stp?`<b>${stp}</b>`:'ost.'}</td>
      <td><select><option value="sluz" ${S.typ==='sluz'?'selected':''}>služ.</option><option value="prac" ${S.typ==='prac'?'selected':''}>prac.</option></select></td>
      <td><input type="text" value="${esc(S.ozn)}" title="${esc(r.p.label)} · ${r.p.cat==='nad'?'nadpožadavek':'delimitace'}"></td>
      <td><input type="number" step="0.1" min="0" max="1" value="${S.fte}"></td>
      <td><input type="text" value="${esc(S.obor)}" placeholder="např. 41, 63" style="width:90px"></td>
      <td><input type="text" value="${esc(S.kod)}" placeholder="1.00.13" style="width:70px"></td>
      <td><input type="text" value="${esc(S.odb)}" style="width:110px"></td>
      <td class="cls"><input type="number" min="1" max="16" value="${S.cls}"></td>
      <td><input type="checkbox" ${S.obc?'checked':''}></td><td><input type="checkbox" ${S.zk?'checked':''}></td>
      <td><input type="date" value="${esc(S.zanik)}" style="width:125px"></td>
      <td class="who ${mis?'mis':''}">${h?`<span class="pc">${esc(h.name)}</span> <span class="m">${esc(h.src)}${h.cls?' · tř. '+esc(h.cls):''}${mis?' ≠ místo '+S.cls:''}</span>`:'<span class="m">volné</span>'}</td>`;
    const [chk,sel,ozn,fte,obor,kod,odb,cls,obc,zk,zanik]=tr.querySelectorAll('input,select');
    chk.onclick=e=>{ if(e.shiftKey&&lastClicked){ const a=visIds.indexOf(lastClicked),b=visIds.indexOf(r.p.id); const [lo,hi]=[Math.min(a,b),Math.max(a,b)]; for(let i=lo;i<=hi;i++) chk.checked?sysSel.add(visIds[i]):sysSel.delete(visIds[i]); } else { chk.checked?sysSel.add(r.p.id):sysSel.delete(r.p.id); } lastClicked=r.p.id; renderSys(); };
    bind(sel,r,'typ'); bind(ozn,r,'ozn',e=>e.value.trim()); bind(fte,r,'fte',e=>e.value===''?'':Math.max(0,Math.min(1,+e.value))); bind(obor,r,'obor',e=>e.value.trim()); bind(kod,r,'kod',e=>e.value.trim()); bind(odb,r,'odb',e=>e.value.trim());
    bind(cls,r,'cls',e=>e.value===''?'':parseInt(e.value)); bind(obc,r,'obc',e=>e.checked); bind(zk,r,'zk',e=>e.checked); bind(zanik,r,'zanik');
    tb.appendChild(tr); });
  t.appendChild(tb); c.appendChild(t); c.scrollTop=st;
  $('#sysQ').oninput=()=>{ sysFilter.q=$('#sysQ').value; const st2=c.scrollTop; renderSys(); $('#sysQ').focus(); $('#sysQ').setSelectionRange(99,99); };
  $('#sysFree').onchange=()=>{ sysFilter.free=$('#sysFree').checked; renderSys(); };
  $('#sysMis').onchange=()=>{ sysFilter.mis=$('#sysMis').checked; renderSys(); };
  const bk=$('#bkApply'); if(bk){ const fld=$('#bkField'), val=$('#bkVal');
    const syncPh=()=>{ val.placeholder={cls:'např. 13',typ:'sluz / prac',obor:'např. 41, 63',kod:'např. 1.00.13',odb:'text',fte:'0–1',obc:'ano / ne',zk:'ano / ne'}[fld.value]; }; syncPh(); fld.onchange=syncPh;
    bk.onclick=()=>{ const f=fld.value; let raw=val.value.trim(); let v;
      if(f==='cls') v=raw===''?'':parseInt(raw); else if(f==='fte') v=raw===''?'':+raw.replace(',','.'); else if(f==='typ') v=/^p/i.test(raw)?'prac':'sluz'; else if(f==='obc'||f==='zk') v=/^(a|y|1|t)/i.test(raw); else v=raw;
      let n=0; for(const u of state.units) for(const p of u.positions) if(sysSel.has(p.id)){ if(v===''||Number.isNaN(v)) delete p[f]; else p[f]=v; n++; }
      logChange&&logChange('systemizace',`hromadně ${f} = ${v} u ${n} míst`); save(); render(); toast(`Nastaveno u ${n} míst.`); };
    $('#bkClear').onclick=()=>{ sysSel.clear(); renderSys(); }; }
}
// export in the MV form layout
$('#btnSys').onclick=()=>{
  const A=[]; const put=(r,c,v)=>{ while(A.length<=r) A.push([]); A[r][c]=v; };
  const H=[['Správní úřad:',null,null,null,'Úřad rozvoje území ČR'],['IČO :',null,null,null,'24858234'],['Kapitola státního rozpočtu:',null,null,null,''],[],['NÁVRH SYSTEMIZACE '],['SLUŽEBNÍCH A PRACOVNÍCH MÍST'],[],
    ['Služební/pracovní místa',null,null,null,null,null,null,'Rozdělení',null,null,null,null,null,null,null,null,null,'Platová třída','Požadavek na státní občanství ČR','Zákaz konkurence','Datum zániku místa'],
    ['Pořad. číslo','Představený/Ved. zaměstnanec',null,null,null,'Ostatní','Funkční  a služební označení služebního/pracovního místa','Služební místa',null,null,null,null,null,'Pracovní místa'],
    [null,'4. stupeň řízení','3. stupeň řízení','2. stupeň řízení','1. stupeň řízení',null,null,'Představení','Ostatní','Úvazek na služ. místě','Obor služby ','Kód správ. činností','Odb. požadavky','Vedoucí zaměst.','Ostatní','Úvazek na prac. místě','Kód prací'],
    ['a','b','c','d','e','f','g','h','i','j',null,'l','m','n','o','p','q','r','s','t','v']];
  H.forEach((r,i)=>r.forEach((v,j)=>{ if(v!==null&&v!==undefined) put(i,j,v); }));
  let n=0; const first=12;
  for(const u of state.units) for(const p of u.positions){ const S=sysOf(u,p); const st=stupen(u,p); const r=first-1+n; n++;
    put(r,0,n); if(st) put(r,5-st,1); else put(r,5,1); put(r,6,S.ozn);
    if(S.typ==='sluz'){ put(r,st?7:8,1); put(r,9,+S.fte); put(r,10,S.obor); put(r,11,S.kod); put(r,12,S.odb); }
    else { put(r,st?13:14,1); put(r,15,+S.fte); put(r,16,S.kod); }
    put(r,17,S.cls); if(S.obc) put(r,18,1); if(S.zk) put(r,19,1); if(S.zanik) put(r,20,S.zanik); }
  const last=first+n-1, tot=last+1; const col=i=>String.fromCharCode(65+i); const sum=i=>({f:`SUM(${col(i)}${first}:${col(i)}${last})`});
  put(tot-1,0,'Celkem:'); [1,2,3,4,5,7,8,9,13,14,15,18,19].forEach(i=>put(tot-1,i,sum(i)));
  put(tot,1,'Služební a pracovní místa :'); put(tot,7,'Služební místa:'); put(tot,13,'Pracovní místa:');
  put(tot+1,1,'b+c+d+e+f ='); put(tot+1,3,{f:`SUM(B${tot}:F${tot})`}); put(tot+1,7,'h+i ='); put(tot+1,8,{f:`H${tot}+I${tot}`}); put(tot+1,13,'n+o ='); put(tot+1,14,{f:`N${tot}+O${tot}`});
  const ws=XLSX.utils.aoa_to_sheet(A);
  const M=s=>{ const d=XLSX.utils.decode_range(s); return d; };
  ws['!merges']=['A1:D1','E1:T1','A2:D2','E2:T2','E3:T3','A5:U5','A6:U6','A8:G8','H8:Q8','R8:R10','S8:S10','T8:T10','U8:U10','A9:A10','B9:E9','F9:F10','G9:G10','H9:M9','N9:Q9',
    `A${tot}:A${tot+2}`,`B${tot+1}:F${tot+1}`,`B${tot+2}:C${tot+2}`,`D${tot+2}:F${tot+2}`,`G${tot}:G${tot+2}`,`H${tot+1}:I${tot+1}`,`J${tot}:J${tot+2}`,`N${tot+1}:O${tot+1}`,`P${tot}:P${tot+2}`,`Q${tot}:Q${tot+2}`,`R${tot}:R${tot+2}`,`S${tot}:S${tot+2}`,`T${tot}:T${tot+2}`,`U${tot}:U${tot+2}`].map(M);
  ws['!cols']=[4.3,5.7,5.7,5.7,5.7,5.5,46,5.2,4.7,6.2,8,7.7,12.7,6.5,5.8,6,6.5,3.8,6,5.8,10].map(w=>({wch:w}));
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Systemizace');
  // second sheet: same data with unit names, for work
  const flat=sysRows().map(r=>{const h=r.p.person?state.people[r.p.person]:null; return {'Pořad. č.':r.n,'Sekce':unitPath(r.u)[1]||'','Útvar':r.u.name,'Stupeň řízení':stupen(r.u,r.p)||'','Typ':SYS_TYP[r.sys.typ],'Funkční označení':r.sys.ozn,'Úvazek':+r.sys.fte,'Obor služby':r.sys.obor,'Kód činností':r.sys.kod,'Odb. požadavky':r.sys.odb,'Platová třída':r.sys.cls,'Občanství ČR':r.sys.obc?'ano':'','Zákaz konkurence':r.sys.zk?'ano':'','Datum zániku':r.sys.zanik,'Kategorie':r.p.cat==='nad'?'nadpožadavek':'delimitace','Lokalita':(()=>{const l=h?personLoc(h).id:unitLoc(r.u);return l?LOC[l].name:'';})(),'Obsazeno':h?h.name:'','Zdrojový úřad':h?h.src:'','Třída zaměstnance':h?h.cls:''};});
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(flat),'Podle útvarů');
  XLSX.writeFile(wb,`URU_systemizace_${stamp()}.xlsx`);
};
function renderChart(){
  const c=$('#chart'); const sl=c.scrollLeft, st=c.scrollTop; c.innerHTML='';
  const oc=document.createElement('div'); oc.className='oc'; oc.style.transform='scale('+(state.zoom||85)/100+')';
  const root=document.createElement('ul'); root.className='oc-row oc-root';
  state.units.filter(u=>!u.parent).forEach(u=>root.appendChild(chartNode(u)));
  oc.appendChild(root); c.appendChild(oc);
  if(chartFresh){const pb=c.querySelector('.box.predseda'); const sc=(state.zoom||85)/100; c.scrollLeft=Math.max(0,pb.offsetLeft*sc+pb.offsetWidth*sc/2-c.clientWidth/2); c.scrollTop=0; chartFresh=false;} else {c.scrollLeft=sl; c.scrollTop=st;}
}

window.addEventListener('error',e=>{ try{ const t=$('#toast'); t.textContent='Chyba: '+(e.message||e.error||'?'); t.style.background='var(--danger)'; t.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>{t.classList.remove('show');t.style.background='';},8000); }catch(_){} });
window.addEventListener('unhandledrejection',e=>{ try{ const t=$('#toast'); t.textContent='Chyba: '+(e.reason&&e.reason.message||e.reason||'?'); t.style.background='var(--danger)'; t.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>{t.classList.remove('show');t.style.background='';},8000); }catch(_){} });
let toastT; function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),3500);}


// ---------- overview ----------
function overviewRows(){
  const rows=[];
  const agg=u=>{ const r={name:u.name,level:u.level,total:0,filled:0,delim:0,delimF:0,nad:0,nadF:0,free:0}; SOURCES.forEach(s=>r[s]=0);
    const walk=x=>{ x.positions.forEach(p=>{ r.total++; if(p.cat==='nad'){r.nad++; if(p.person) r.nadF++;} else {r.delim++; if(p.person) r.delimF++;} if(p.person){ r.filled++; const src=state.people[p.person]?state.people[p.person].src:'Jiný'; r[SOURCES.includes(src)?src:'Jiný']++; } else r.free++; }); childrenOf(x.id).forEach(walk); }; walk(u); return r; };
  const visit=u=>{ rows.push(agg(u)); childrenOf(u.id).forEach(visit); };
  state.units.filter(u=>!u.parent).forEach(visit); return rows;
}
function locRows(){
  const cols=[...LOCATIONS,{id:null,abbr:'?',name:'Neurčeno'}];
  return cols.map(l=>{ const r={name:l.name,people:0,free:0}; SOURCES.forEach(s=>r[s]=0);
    allPositions().forEach(({u,p})=>{ if(p.person&&state.people[p.person]){ const pl=personLoc(state.people[p.person]).id; if(pl===l.id){ r.people++; const src=state.people[p.person].src; r[SOURCES.includes(src)?src:'Jiný']++; } } else if(unitLoc(u)===l.id) r.free++; });
    return r; });
}
$('#btnOverview').onclick=()=>{ const rows=overviewRows(); const srcs=SOURCES.filter(s=>s!=='Jiný'||rows.some(r=>r['Jiný'])); const lr=locRows();
  $('#ovBody').innerHTML=`<div class="ovh">Podle lokalit</div><table class="ov"><thead><tr><th>Lokalita</th><th>Lidí</th><th>Volných míst</th>${srcs.map(s=>`<th>${s}</th>`).join('')}</tr></thead><tbody>${lr.map(r=>`<tr><td>${esc(r.name)}</td><td>${r.people}</td><td${r.free?'':' class="z"'}>${r.free}</td>${srcs.map(s=>`<td${r[s]?'':' class="z"'}>${r[s]}</td>`).join('')}</tr>`).join('')}</tbody></table>
  <div class="ovh">Podle útvarů</div><table class="ov"><thead><tr><th>Útvar</th><th>Míst</th><th>Obsazeno</th><th>Volných</th><th>Delim.</th><th>Nadpož.</th>${srcs.map(s=>`<th>${s}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr class="${r.level}"><td>${esc(r.name)}</td><td>${r.total}</td><td>${r.filled}</td><td${r.free?'':' class="z"'}>${r.free}</td><td>${r.delimF}/${r.delim}</td><td>${r.nadF}/${r.nad}</td>${srcs.map(s=>`<td${r[s]?'':' class="z"'}>${r[s]}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  $('#dlgOverview').showModal(); };
$('#ovClose').onclick=()=>$('#dlgOverview').close();
$('#ovXlsx').onclick=()=>{ const rows=overviewRows().map(r=>{const o={'Útvar':r.name,'Úroveň':LEVEL_LBL[r.level],'Míst':r.total,'Obsazeno':r.filled,'Volných':r.free,'Delimitace obsazeno':r.delimF,'Delimitace míst':r.delim,'Nadpožadavek obsazeno':r.nadF,'Nadpožadavek míst':r.nad}; SOURCES.forEach(s=>o['z '+s]=r[s]); return o;});
  const lrs=locRows().map(r=>{const o={'Lokalita':r.name,'Lidí':r.people,'Volných míst':r.free}; SOURCES.forEach(s=>o['z '+s]=r[s]); return o;});
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'Útvary'); XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(lrs),'Lokality'); XLSX.writeFile(wb,`URU_prehled_${stamp()}.xlsx`); };

// ---------- log ----------
$('#btnLog').onclick=async()=>{ $('#logBody').innerHTML='<div>Načítám…</div>'; $('#dlgLog').showModal();
  const {data,error}=await sb.from('organigram_log').select('created_at,user_email,action,detail').order('created_at',{ascending:false}).limit(300);
  if(error){ $('#logBody').innerHTML='<div>Historii se nepodařilo načíst: '+esc(error.message)+'</div>'; return; }
  $('#logBody').innerHTML=data.length?data.map(l=>`<div><time>${new Date(l.created_at).toLocaleString('cs-CZ')}</time><span><b>${esc(l.action)}</b> ${esc(l.detail||'')} <span style="color:var(--muted)">· ${esc(l.user_email||'')}</span></span></div>`).join(''):'<div>Zatím žádné změny.</div>'; };
$('#logClose').onclick=()=>$('#dlgLog').close();

// ---------- presentation ----------
function present(on){ document.body.classList.toggle('presenting',on); if(on){ if(state.view!=='chart'&&state.view!=='loc') setView('chart'); } render(); }
$('#btnPresent').onclick=()=>present(true); $('#presExit').onclick=()=>present(false);
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&document.body.classList.contains('presenting')) present(false); });

// ---------- auth & boot ----------
async function boot(){
  renderLegend(); const vr=$('#ver'); if(vr) vr.textContent='verze '+APP_VERSION; console.log('ÚRÚ organigram app.js',APP_VERSION);
  if(!window.supabase||!window.CONFIG||!/^https:\/\/[a-z0-9-]+\.supabase\.co/.test(String(CONFIG.SUPABASE_URL).trim())){ $('#authMsg').className='msg err'; $('#authMsg').textContent='Aplikace není nakonfigurována – doplňte config.js.'; return; }
  const url=String(CONFIG.SUPABASE_URL).trim().replace(/\/(rest|auth|storage|realtime)\/v1.*$/,'').replace(/\/+$/,'');
  const key=String(CONFIG.SUPABASE_ANON_KEY).trim();
  sb=supabase.createClient(url,key);
  $('#authBtn').onclick=async()=>{ const email=$('#authMail').value.trim(); const pass=$('#authPass').value; if(!email) return; $('#authMsg').className='msg'; $('#authMsg').textContent=pass?'Přihlašuji…':'Odesílám odkaz…';
    if(pass){ const {error}=await sb.auth.signInWithPassword({email,password:pass});
      if(error){ $('#authMsg').className='msg err'; $('#authMsg').textContent='Nepodařilo se: '+(error.message==='Invalid login credentials'?'nesprávný e-mail nebo heslo':error.message); } return; }
    const {error}=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname,shouldCreateUser:false}});
    if(error){ $('#authMsg').className='msg err'; $('#authMsg').textContent='Nepodařilo se: '+(error.message.includes('rate limit')?'vyčerpán hodinový limit odeslaných e-mailů – zkuste to později, nebo se přihlaste heslem':error.message); } else { $('#authMsg').textContent='Hotovo – zkontrolujte e-mail a klikněte na odkaz.'; } };
  ['#authMail','#authPass'].forEach(id=>$(id).addEventListener('keydown',e=>{ if(e.key==='Enter') $('#authBtn').click(); }));
  $('#btnLogout').onclick=async()=>{ await flush(); await sb.auth.signOut(); location.reload(); };
  sb.auth.onAuthStateChange(async(ev,session)=>{ if(session&&!currentUser){ currentUser=session.user; await start(); } });
  const {data:{session}}=await sb.auth.getSession();
  if(session){ currentUser=session.user; await start(); }
}
async function loadRole(){
  try{ const {data,error}=await sb.from('organigram_roles').select('role').eq('email',(currentUser.email||'').toLowerCase()).maybeSingle(); if(error) throw error;
    const r=(data&&data.role)||'admin'; ROLE.name=r; ROLE.org=r==='admin'; ROLE.it=(r==='admin'||r==='it');
  }catch(e){ console.warn('role',e); ROLE.name='admin'; ROLE.org=true; ROLE.it=true; }
  document.body.classList.toggle('role-it',ROLE.name==='it');
  $('#userMail').textContent=currentUser.email+(ROLE.name==='it'?' · IT':'');
}
async function start(){
  $('#userMail').textContent=currentUser.email; $('#btnUndo').onclick=undo; $('#btnRedo').onclick=redo;
  await loadRole();
  try{ await loadRemote(); }catch(e){ $('#authMsg').className='msg err'; $('#authMsg').textContent='Načtení dat selhalo: '+(e.message||e)+' (zkontrolujte tabulky a RLS)'; return; }
  $('#auth').style.display='none';
  $('#zoom').value=state.zoom; $('#zoomVal').textContent=state.zoom+' %';
  setView(ROLE.org?(['chart','loc','sys','it'].includes(state.view)?state.view:'tree'):'it'); setDot('','připojeno');
  sb.channel('organigram').on('postgres_changes',{event:'UPDATE',schema:'public',table:'organigram_state',filter:'id=eq.'+STATE_ID},payload=>{
    if(payload.new&&payload.new.version>version&&!dirty&&!saving){ const v=state.view,z=state.zoom,c=state.collapsed; state=payload.new.data; version=payload.new.version; state.view=v; state.zoom=z; state.collapsed=c; render(); toast('Stav aktualizován z jiného okna.'); } }).subscribe();
  window.addEventListener('beforeunload',e=>{ if(dirty||saving){ flush(); e.preventDefault(); e.returnValue=''; } });
}
load(); boot();
