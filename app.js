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
  sel.onclick=e=>e.stopPropagation(); sel.onchange=()=>{ u.loc=sel.value||null; logChange&&logChange('lokalita útvaru',u.name+' → '+(u.loc?LOC[u.loc].name:'dle nadřízeného')); save(); render(); }; return sel; }
const SRC_COLOR = {'DESÚ':'var(--c-desu)','MMR':'var(--c-mmr)','ÚÚR':'var(--c-uur)','MD':'var(--c-md)','MPO':'var(--c-mpo)','Nové':'var(--c-nove)','Jiný':'#E5E7EB'};
const SRC_DARK  = {'DESÚ':'var(--c-desu-d)','MMR':'var(--c-mmr-d)','ÚÚR':'var(--c-uur-d)','MD':'var(--c-md-d)','MPO':'var(--c-mpo-d)','Nové':'var(--c-nove-d)','Jiný':'#6B7280'};
const LEVEL_LBL = {predseda:'úřad',sekce:'sekce',odbor:'odbor',odd:'oddělení'};
const KIND_LBL = {head:'vedoucí',asst:'asistent/ka',ref:'referent'};
const LS_KEY = 'uru-organigram-v1';
const STATE_ID = 'main';

// ---------- state ----------

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
const snap=()=>JSON.stringify({units:state.units,people:state.people,nextPid:state.nextPid,structureVersion:state.structureVersion});
function markBaseline(){ baseline=snap(); }
function save(){
  if(!restoring&&baseline!==null){ const now=snap(); if(now!==baseline){ undoStack.push(baseline); if(undoStack.length>UNDO_MAX) undoStack.shift(); redoStack=[]; } baseline=now; }
  updateUndoBtns(); persist();
}
function applySnap(j){ const o=JSON.parse(j); restoring=true; state.units=o.units; state.people=o.people; state.nextPid=o.nextPid; state.structureVersion=o.structureVersion; baseline=snap(); restoring=false; persist(); render(); }
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
  d.draggable=true; d.dataset.pid=p.id; d.tabIndex=0;
  const meta=[p.src, p.role, p.cls?('tř. '+p.cls):null, (p.fte&&p.fte!=1)?('úv. '+p.fte):null].filter(Boolean).join(' · ');
  d.innerHTML=`<span class="nm">${esc(p.name)}</span><span class="meta">${esc(meta)}</span>`; d.appendChild(locTag(p));
  d.title=[p.name,p.src,p.unit,p.role,p.posId].filter(Boolean).join('\n');
  d.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/pid',p.id);e.dataTransfer.effectAllowed='move';d.classList.add('dragging');});
  d.addEventListener('dragend',()=>d.classList.remove('dragging'));
  d.addEventListener('click',e=>{e.stopPropagation();showPop(p,d);});
  d.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){e.preventDefault();showPop(p,d);} if(e.key==='Delete'||e.key==='Backspace'){unassign(p.id);render();} });
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
  head.addEventListener('drop',e=>{e.preventDefault();head.classList.remove('over');const pid=e.dataTransfer.getData('text/pid');if(!pid)return;placeInUnit(pid,u);});
  div.appendChild(head);

  const body=document.createElement('div'); body.className='ubody';
  u.positions.forEach(p=>{
    const row=document.createElement('div'); row.className='pos'; row.dataset.pid=p.id;
    const lab=document.createElement('div'); lab.className='plabel';
    lab.innerHTML=`<span class="cat ${p.cat==='nad'?'nad':''}" title="${p.cat==='nad'?'nadpožadavek (nové místo)':'delimitace'}"></span><span class="t" title="Dvojklik: přejmenovat">${esc(p.label)}</span>`;
    lab.querySelector('.t').ondblclick=()=>{const n=prompt('Označení místa:',p.label);if(n!==null&&n.trim()){p.label=n.trim();save();render();}};
    const slot=document.createElement('div'); slot.className='slot'+(p.person?' filled':'');
    if(p.person&&state.people[p.person]) slot.appendChild(personChip(state.people[p.person]));
    else slot.innerHTML='<span class="empty">volné místo</span>';
    slot.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='move';slot.classList.add('over');});
    slot.addEventListener('dragleave',()=>slot.classList.remove('over'));
    slot.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();slot.classList.remove('over');const pid=e.dataTransfer.getData('text/pid');if(pid)assign(pid,p.id);});
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
    <dt>Lokalita</dt><dd><select id="popLoc" style="width:100%"><option value="">dle útvaru${(()=>{const l=cur?unitLoc(cur.u):null;return l?' ('+LOC[l].name+')':' (neurčeno)';})()}</option>${LOCATIONS.map(l=>`<option value="${l.id}"${p.loc===l.id?' selected':''}>${l.abbr} · ${l.name}</option>`).join('')}</select></dd></dl>
    <div class="row">${cur?'<button id="popUn">Uvolnit místo</button>':''}<button id="popDel" style="color:var(--danger)">Smazat osobu</button><button id="popClose" class="primary">Zavřít</button></div>`;
  pop.hidden=false;
  const r=anchor.getBoundingClientRect(); let x=r.left, y=r.bottom+6;
  if(x+330>innerWidth) x=innerWidth-335; if(y+pop.offsetHeight>innerHeight) y=Math.max(8,r.top-pop.offsetHeight-6);
  pop.style.left=x+'px'; pop.style.top=y+'px';
  $('#popClose').onclick=hidePop;
  $('#popLoc').onchange=()=>{ p.loc=$('#popLoc').value||null; logChange&&logChange('lokalita osoby',p.name+' → '+(p.loc?LOC[p.loc].name:'dle útvaru')); save(); render(); };
  const un=$('#popUn'); if(un) un.onclick=()=>{unassign(p.id);hidePop();};
  $('#popDel').onclick=()=>{ if(confirm('Smazat '+p.name+' z aplikace?')){unassign(p.id);delete state.people[p.id];logChange('smazání osoby',p.name);save();render();hidePop();} };
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
function setView(v){ state.view=v; if(v==='chart') chartFresh=true; document.body.classList.toggle('view-chart',v==='chart'); document.body.classList.toggle('view-loc',v==='loc');
  $('#vwTree').classList.toggle('on',v!=='chart'&&v!=='loc'); $('#vwChart').classList.toggle('on',v==='chart'); $('#vwLoc').classList.toggle('on',v==='loc'); $('#zoomWrap').hidden=v!=='chart'; $('#critWrap').hidden=v!=='chart'; render(); }
$('#vwTree').onclick=()=>setView('tree'); $('#vwChart').onclick=()=>setView('chart'); $('#vwLoc').onclick=()=>setView('loc');
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
  box.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();box.classList.remove('over');const pid=e.dataTransfer.getData('text/pid');if(pid)placeInUnit(pid,u);});
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
    col.addEventListener('drop',e=>{e.preventDefault();col.classList.remove('over');const pid=e.dataTransfer.getData('text/pid'); const p=pid&&state.people[pid]; if(!p) return;
      p.loc=l.id||null; if(!p.loc) delete p.loc; logChange&&logChange('lokalita osoby',p.name+' → '+(l.id?l.name:'dle útvaru')); save(); render(); });
    grid.appendChild(col); });
  c.appendChild(grid); c.scrollTop=st;
}
function renderChart(){
  const c=$('#chart'); const sl=c.scrollLeft, st=c.scrollTop; c.innerHTML='';
  const oc=document.createElement('div'); oc.className='oc'; oc.style.transform='scale('+(state.zoom||85)/100+')';
  const root=document.createElement('ul'); root.className='oc-row oc-root';
  state.units.filter(u=>!u.parent).forEach(u=>root.appendChild(chartNode(u)));
  oc.appendChild(root); c.appendChild(oc);
  if(chartFresh){const pb=c.querySelector('.box.predseda'); const sc=(state.zoom||85)/100; c.scrollLeft=Math.max(0,pb.offsetLeft*sc+pb.offsetWidth*sc/2-c.clientWidth/2); c.scrollTop=0; chartFresh=false;} else {c.scrollLeft=sl; c.scrollTop=st;}
}

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
  renderLegend();
  if(!window.supabase||!window.CONFIG||!/^https:\/\/.+\.supabase\.co/.test(CONFIG.SUPABASE_URL)){ $('#authMsg').className='msg err'; $('#authMsg').textContent='Aplikace není nakonfigurována – doplňte config.js.'; return; }
  sb=supabase.createClient(CONFIG.SUPABASE_URL,CONFIG.SUPABASE_ANON_KEY);
  $('#authBtn').onclick=async()=>{ const email=$('#authMail').value.trim(); if(!email) return; $('#authMsg').className='msg'; $('#authMsg').textContent='Odesílám…';
    const {error}=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname,shouldCreateUser:false}});
    if(error){ $('#authMsg').className='msg err'; $('#authMsg').textContent='Nepodařilo se: '+error.message; } else { $('#authMsg').textContent='Hotovo – zkontrolujte e-mail a klikněte na odkaz.'; } };
  $('#authMail').addEventListener('keydown',e=>{ if(e.key==='Enter') $('#authBtn').click(); });
  $('#btnLogout').onclick=async()=>{ await flush(); await sb.auth.signOut(); location.reload(); };
  sb.auth.onAuthStateChange(async(ev,session)=>{ if(session&&!currentUser){ currentUser=session.user; await start(); } });
  const {data:{session}}=await sb.auth.getSession();
  if(session){ currentUser=session.user; await start(); }
}
async function start(){
  $('#userMail').textContent=currentUser.email; $('#btnUndo').onclick=undo; $('#btnRedo').onclick=redo;
  try{ await loadRemote(); }catch(e){ $('#authMsg').className='msg err'; $('#authMsg').textContent='Načtení dat selhalo: '+(e.message||e)+' (zkontrolujte tabulky a RLS)'; return; }
  $('#auth').style.display='none';
  $('#zoom').value=state.zoom; $('#zoomVal').textContent=state.zoom+' %';
  setView(state.view==='chart'||state.view==='loc'?state.view:'tree'); setDot('','připojeno');
  sb.channel('organigram').on('postgres_changes',{event:'UPDATE',schema:'public',table:'organigram_state',filter:'id=eq.'+STATE_ID},payload=>{
    if(payload.new&&payload.new.version>version&&!dirty&&!saving){ const v=state.view,z=state.zoom,c=state.collapsed; state=payload.new.data; version=payload.new.version; state.view=v; state.zoom=z; state.collapsed=c; render(); toast('Stav aktualizován z jiného okna.'); } }).subscribe();
  window.addEventListener('beforeunload',e=>{ if(dirty||saving){ flush(); e.preventDefault(); e.returnValue=''; } });
}
load(); boot();
