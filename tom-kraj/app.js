// TOM krajského ÚRÚ – cílový provozní model kraje v soustavě ÚRÚ (od 2028), modelový kraj Vysočina.
// Odvozeno z TOM ÚRÚ ČR. Model v organigram_state.id='tom-kraj'; krajský organigram ('kraje') se jen čte (živě). Pracoviště, scénáře a posouzení: kraj.js.
const APP_VERSION='2026-10-05.12';
const APP_ID='tom-kraj', STATE_ID='tom-kraj', ORG_ID='kraje', LS_KEY='uru-tom-kraj-v1';
const KRAJ=(window.TOM_KRAJ||{}).kraj||'Kraj Vysočina';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>(+v||0).toLocaleString('cs-CZ',{maximumFractionDigits:1});
const uid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
const today=()=>new Date().toISOString().slice(0,10);

const TYPES={vykon:'výkon agendy',odvolani:'odvolání a přezkum',metodika:'metodika a legislativa',rizeni:'řízení',podpora:'podpůrná služba',priprava:'příprava změny'};
const STATUS={navrh:'návrh',diskuse:'v diskusi',ok:'odsouhlaseno',sporne:'sporné'};
const STATUS_COLOR={navrh:'#9AA4B2',diskuse:'#2563EB',ok:'#067647',sporne:'#B42318'};
const ROLES={own:'vlastník',do:'vykonává',sup:'podporuje'};
const DEFAULT_KINDS={ridi:['řídí','#1B2430'],metodika:['metodicky vede','#7C3AED'],odvolani:['přezkoumává','#B42318'],zada:['podává / žádá','#334155'],rozhodnuti:['vydává rozhodnutí','#1D4ED8'],stanovisko:['poskytuje stanovisko','#65A30D'],odvolava:['podává odvolání / žalobu','#9F1239'],pouziva:['používá','#0F766E'],spravuje:['spravuje','#115E59',true],predava:['předává práci','#475569'],data:['předává data','#64748B',true],podklad:['dává podklad','#0E9AA7'],
  sluzba:['poskytuje službu','#C79400'],spis:['předává spis','#ED7D31'],zpetna:['zpětná vazba','#4D8B31'],vyvoj:['vývoj do 2028','#9AA4B2',true]};
let LINK_KINDS=DEFAULT_KINDS;
const KIND=k=>LINK_KINDS[k]||['(neznámý druh)','#9AA4B2'];
const LEVELS={sekce:'sekce',odbor:'odbor',unit:'útvar (včetně podřízených)'};
const ACAT={zad:'žadatelé a veřejnost',sam:'samospráva',stat:'státní správa',kon:'kontrola a soudy',sous:'soustava ÚRÚ',jiny:'jiný'};
const CHANNELS={portal:'Portál stavebníka',ds:'datová schránka',email:'e-mail',osobne:'osobně',listinne:'listinně / poštou',tel:'telefon'};
const STYPE={agenda:'agendový',spis:'spisová služba',portal:'portál',registr:'evidence / registr',podpora:'podpůrný',externi:'externí služba'};
const SSTATE={stav:'stávající',prevzeti:'přebírá se k 1. 1. 2027',novy:'nový',vyhled:'výhled'};
const AW=180;   // šířka dlaždic aktérů a systémů
const LEVEL_LBL={predseda:'úřad',sekce:'sekce',odbor:'odbor',odd:'oddělení',up:'územní pracoviště'};
const LOCATIONS=[], LOC={};   // lokality = sídla územních pracovišť kraje (plní setOrg)
const PALETTE=['#4472C4','#B42318','#70AD47','#0E9AA7','#7C3AED','#C79400','#1B2430','#ED7D31','#C25BB9','#5D6B7A'];
const SEV={err:'chyba',warn:'varování',info:'informace'};
const BW=230;

let state=null, ROLE={name:'admin',org:true};
let org={units:[],people:{}}, U={}, KIDS={};
let sel=null;            // {t:'f'|'l'|'u'|'g', id}
let connectFrom=null, conflicts=[], zoom=0.8, drill=null, LINKS=[];   // LINKS = ruční vazby + vazby z procesů   // drill = id otevřeného souhrnu

// ---------- krajský organigram (jen ke čtení) ----------
function setOrg(d){
  const all=(d&&d.units)||[]; const root=all.find(u=>!u.parent&&u.vzor)||all.find(u=>!u.parent&&u.kraj===KRAJ)||all.find(u=>!u.parent);
  const ids=new Set(); const w=id=>{ ids.add(id); all.filter(x=>x.parent===id).forEach(x=>w(x.id)); }; if(root) w(root.id);
  org={units:all.filter(u=>ids.has(u.id)),people:(d&&d.people)||{},root:root?root.id:null};
  LOCATIONS.length=0; Object.keys(LOC).forEach(k=>delete LOC[k]); org.units.filter(u=>u.orp).sort((x,y)=>x.orp.name.localeCompare(y.orp.name,'cs')).forEach(u=>{ const id='orp'+u.orp.kod; if(!LOC[id]){ LOCATIONS.push([id,u.orp.name]); LOC[id]=u.orp.name; } });
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
    assign:(f.a||[]).flatMap(([u,r])=>resolveUnits(u).map(id=>({unit:id,role:r,name:U[id]?U[id].name:''})))}; });
  S.links.forEach(([a,b,k,l])=>st.links.push({id:uid('l'),from:a,to:b,kind:k,label:l||''}));
  S.rules.forEach(r=>st.rules.push({...r,on:true}));
  applySums(st); addEnv(st); seedProcesses(st); st.show2028=true; st.modelVersion=10; seedKraj(st); autoLayout(st); return st;
}
// vnější okolí a systémy z výchozího návrhu (doplní jen chybějící)
// rozdělení „Ekonomický a personální systém“ na MÚZO a VEMA (model verze 8)
function splitEconSystem(st){ const y9=st.funcs.y9; if(!y9||st.funcs.y10) return;
  if(/ekonomický a personální/i.test(y9.name)){ y9.name='Ekonomický systém (MÚZO)'; if(!y9.admin||/ověření/.test(y9.admin)) y9.admin='MÚZO'; }
  const sys=Object.values(st.funcs).filter(f=>f.kind==='system'&&f!==y9); const lastY=Math.max(y9.y,...sys.map(f=>f.y)); const row=[y9,...sys].filter(f=>Math.abs(f.y-lastY)<5);
  st.funcs.y10={id:'y10',kind:'system',name:'Personální systém (VEMA)',stype:'podpora',sstate:'stav',admin:'VEMA',period:'2027',desc:'',status:'navrh',notes:[],assign:[],locs:[],x:Math.max(...row.map(f=>f.x))+AW+44,y:lastY};
  st.links.forEach(l=>{ if(l.from==='f23'&&l.to==='y9'){ l.to='y10'; if(l.kind==='pouziva') l.kind='spravuje'; } });
  (st.processes||[]).forEach(p=>p.steps.forEach(s=>{ if(s.sys==='y9'&&p.lanes.some(l=>l.id===s.lane&&l.role&&st.roles.some(r=>r.id===l.role&&r.func==='f23'))) s.sys='y10'; }));
  logChange('model','systém rozdělen: Ekonomický systém (MÚZO) a Personální systém (VEMA)'); setTimeout(()=>toast('Ekonomický a personální systém rozdělen na MÚZO a VEMA.'),1000); }
function addEnv(st){ const S=window.TOM_SEED; const base={desc:'',status:'navrh',notes:[],assign:[],locs:[],x:0,y:0};
  (S.actors||[]).forEach(x=>{ if(!st.funcs[x.id]) st.funcs[x.id]={...base,notes:[],assign:[],locs:[],id:x.id,kind:'actor',name:x.name,cat:x.cat,channels:x.ch||[],period:x.p||'2027'}; });
  (S.systems||[]).forEach(x=>{ if(!st.funcs[x.id]) st.funcs[x.id]={...base,notes:[],assign:[],locs:[],id:x.id,kind:'system',name:x.name,stype:x.st,sstate:x.ss,admin:x.admin||'',period:x.p||'2027',allUsers:!!x.all,allUse:x.all||''}; });
  if(st.linkKinds) Object.entries(DEFAULT_KINDS).forEach(([k,v])=>{ if(!st.linkKinds[k]&&['zada','rozhodnuti','stanovisko','odvolava','pouziva','spravuje','data'].includes(k)) st.linkKinds[k]=[...v]; });
  (S.links2||[]).forEach(([f,t,k,l,pl])=>{ if(st.funcs[f]&&st.funcs[t]&&!st.links.some(x=>x.from===f&&x.to===t&&x.kind===k)) st.links.push({id:uid('l'),from:f,to:t,kind:k,label:l||'',...(pl?{planned:true}:{})}); });
  if(st.showActors===undefined) st.showActors=true; if(st.showSystems===undefined) st.showSystems=true; }
// souhrnné funkce z výchozího návrhu + sloučení vazeb, které vedou na více dílčích funkcí jednoho souhrnu
function applySums(st){ (window.TOM_SEED.sums||[]).forEach(s=>{ const ch=s.children.filter(id=>st.funcs[id]&&!st.funcs[id].parent&&!st.funcs[id].sum); if(ch.length<2||st.funcs[s.id]) return;
    const f0=st.funcs[ch[0]]; st.funcs[s.id]={id:s.id,sum:true,name:s.name,group:s.g,desc:'',status:'navrh',notes:[],assign:[],locs:[],period:'2027',type:f0.type,x:f0.x,y:f0.y};
    ch.forEach(id=>st.funcs[id].parent=s.id); mergeLinks(st,s.id); }); }
function mergeLinks(st,sid){ const kids=new Set(Object.values(st.funcs).filter(f=>f.parent===sid).map(f=>f.id));
  [['from','to'],['to','from']].forEach(([fix,var_])=>{ const grp={}; st.links.forEach(l=>{ if(kids.has(l[var_])&&!kids.has(l[fix])) (grp[l[fix]+'|'+l.kind]=grp[l[fix]+'|'+l.kind]||[]).push(l); });
    Object.values(grp).filter(g=>g.length>=2).forEach(g=>{ st.links=st.links.filter(l=>!g.includes(l)); st.links.push({id:uid('l'),[fix]:g[0][fix],[var_]:sid,kind:g[0].kind,label:g.every(l=>l.label===g[0].label)?g[0].label:''}); }); }); }
// rozmístění po oblastech (4 sloupce); h = skutečné výšky krabiček, pokud jsou známé
// výběr útvarů krajského organigramu: 'R:root', 'n:Název', 'L:up' (všechna územní pracoviště), nebo přímo id
function resolveUnits(sel){ if(sel==='R:root') return org.root?[org.root]:[]; if(sel==='L:up') return org.units.filter(u=>u.level==='up').map(u=>u.id);
  if(sel.startsWith('n:')){ const u=org.units.find(x=>x.name===sel.slice(2)); return u?[u.id]:[]; } return U[sel]?[sel]:[]; }
function autoLayout(st,h){ const cols=4, GW=BW+50, GAP=14; let y0=50; h=h||{};
  const band=kind=>{ const xs=Object.values(st.funcs).filter(f=>f.kind===kind&&(st.show2028||f.period!=='2028')); if(!xs.length) return; const per=5; let rowH=0;
    xs.forEach((f,i)=>{ if(i&&i%per===0){ y0+=rowH+GAP; rowH=0; } f.x=30+(i%per)*(AW+(cols*GW-per*AW)/per); f.y=y0; rowH=Math.max(rowH,h[f.id]||60); }); y0+=rowH+80; };
  if(st.showActors!==false) band('actor');
  for(let i=0;i<st.groups.length;i+=cols){ let rowH=0;
    st.groups.slice(i,i+cols).forEach((g,ci)=>{ const fs=Object.values(st.funcs).filter(f=>!f.kind&&f.group===g.id&&!f.parent&&(st.show2028||f.period!=='2028')).sort((a,b)=>(!!b.sum-!!a.sum)||((a.period>b.period)-(a.period<b.period)));
      let y=y0; fs.forEach(f=>{ f.x=30+ci*GW; f.y=y; y+=(h[f.id]||84)+GAP; }); rowH=Math.max(rowH,y-y0); });
    y0+=rowH+70; }
  if(st.showSystems!==false){ y0+=10; band('system'); }
  st._layout=!Object.keys(h).length; }
const F=id=>state.funcs[id];
const activeFuncs=()=>Object.values(state.funcs).filter(f=>!f.sum&&!f.kind&&f.period!=='2028');
const kidsOf=sid=>Object.values(state.funcs).filter(f=>f.parent===sid);
const leaves=()=>Object.values(state.funcs).filter(f=>!f.sum&&!f.kind);
const envEls=kind=>Object.values(state.funcs).filter(f=>f.kind===kind);
function sumStatus(s){ const k=kidsOf(s.id).filter(f=>f.period!=='2028'); if(!k.length) return 'navrh'; if(k.some(f=>f.status==='sporne')) return 'sporne'; if(k.every(f=>f.status==='ok')) return 'ok'; if(k.some(f=>f.status!=='navrh')) return 'diskuse'; return 'navrh'; }
function sumOwner(s){ const own=[...new Set(kidsOf(s.id).flatMap(f=>f.assign.filter(a=>a.role==='own'&&U[a.unit]).map(a=>a.unit)))]; if(!own.length) return null;
  let common=upChain(own[0]); own.slice(1).forEach(u=>{ const c=new Set(upChain(u)); common=common.filter(x=>c.has(x)); }); const lca=common[0];
  return lca&&(own.length===1||U[lca].level!=='predseda')?lca:null; }

// ---------- undo / redo ----------
const UNDO_MAX=60; let undoStack=[],redoStack=[],baseline=null,restoring=false;
const snap=()=>JSON.stringify({kraj:state.kraj,roles:state.roles,processes:state.processes,linkKinds:state.linkKinds,groups:state.groups,funcs:state.funcs,links:state.links,rules:state.rules,proposals:state.proposals,ignored:state.ignored});
function markBaseline(){ baseline=snap(); }
function save(action,detail){ if(!restoring&&baseline!==null){ const now=snap(); if(now!==baseline){ undoStack.push(baseline); if(undoStack.length>UNDO_MAX) undoStack.shift(); redoStack=[]; } baseline=now; }
  if(action) logChange(action,detail); updateUndo(); persist(); render(); }
function applySnap(j){ const o=JSON.parse(j); restoring=true; Object.assign(state,o); if(!state.linkKinds) state.linkKinds=JSON.parse(JSON.stringify(DEFAULT_KINDS)); LINK_KINDS=state.linkKinds; baseline=snap(); restoring=false; persist(); render(); }
function undo(){ if(!ROLE.org||!undoStack.length) return; redoStack.push(snap()); applySnap(undoStack.pop()); logChange('zpět','vrácena změna'); updateUndo(); }
function redo(){ if(!ROLE.org||!redoStack.length) return; undoStack.push(snap()); applySnap(redoStack.pop()); logChange('znovu','obnovena změna'); updateUndo(); }
function updateUndo(){ $('#btnUndo').disabled=!undoStack.length; $('#btnRedo').disabled=!redoStack.length; }
document.addEventListener('keydown',e=>{ const t=e.target; if(t&&/INPUT|TEXTAREA|SELECT/.test(t.tagName)) return; if(document.querySelector('dialog[open]')) return;
  if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==='z'){e.preventDefault();undo();}
  else if((e.ctrlKey||e.metaKey)&&(e.key.toLowerCase()==='y'||(e.shiftKey&&e.key.toLowerCase()==='z'))){e.preventDefault();redo();}
  else if(e.key==='Escape'){ if(document.body.classList.contains('presenting')) present(false); else if(connectFrom||document.body.classList.contains('connecting')) setConnect(false); else if(state.view==='proc'&&procSel){ procSel=null; render(); } else if(sel){ sel=null; render(); } else if(drill) closeSum(); }
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
    logChange('založení','model TOM krajského ÚRÚ založen z výchozího návrhu'); setTimeout(()=>toast('Model založen z výchozího návrhu. Vše je pracovní návrh k diskusi.'),400); }
  normalize(); state.view='map'; drill=null; sel=null; markBaseline();   // po načtení vždy Mapa funkcí (pohled je věc okna, ne modelu)
}
function normalize(){ ['groups','links','rules','proposals','versions'].forEach(k=>state[k]=state[k]||[]); state.funcs=state.funcs||{}; state.ignored=state.ignored||{};
  if(!state.linkKinds||!Object.keys(state.linkKinds).length) state.linkKinds=JSON.parse(JSON.stringify(DEFAULT_KINDS)); LINK_KINDS=state.linkKinds;
  if((state.modelVersion||1)<2){ applySums(state); state.show2028=false; state.modelVersion=2; state._layout=true; logChange('model','souhrnné funkce (sbalené dlaždice)'); setTimeout(()=>toast('Mapa zjednodušena: obdobné funkce jsou sbalené do souhrnů. Souhrn otevřete dvojklikem nebo tlačítkem „Otevřít“.'),500); }
  if(state.modelVersion<3){ // integrované DO hned vedle vyhrazených staveb (nejčetnější vazby)
    const i1=state.groups.findIndex(g=>g.id==='g1'), g3=state.groups.find(g=>g.id==='g3');
    if(i1>=0&&g3){ state.groups=state.groups.filter(g=>g!==g3); state.groups.splice(i1+1,0,g3); state._layout=true; }
    state.modelVersion=3; }
  if(state.modelVersion<4){ addEnv(state); state.modelVersion=4; state._layout=true; logChange('model','doplněno vnější okolí a systémy');
    setTimeout(()=>toast('Model doplněn o vnější okolí (nahoře) a systémy (dole). Vrstvy lze vypnout v liště.'),700); }
  if(state.showActors===undefined) state.showActors=true; if(state.showSystems===undefined) state.showSystems=true;
  state.roles=state.roles||[]; state.processes=state.processes||[]; normProcesses(state);
  if(state.showInternal===false&&state.showSysLinks===undefined) state.showSysLinks=false;
  if(state.modelVersion<6&&state.modelVersion>=5){ const p2=state.processes.find(x=>x.id==='p2'), s1=p2&&p2.steps.find(x=>x.id==='s1'); if(s1&&s1.chs.length===1&&s1.chs[0]==='ds') s1.chs=['ds','email','osobne']; state.modelVersion=6; }
  if(state.modelVersion===6){ addCoordination(state); normProcesses(state); state.modelVersion=7; logChange('model','doplněna koordinace DO (proces, role, funkce)'); setTimeout(()=>toast('Doplněn proces „Koordinace DO – koordinované vyjádření“ a související role.'),900); }
  if(state.modelVersion===7){ splitEconSystem(state); state.modelVersion=8; }
  if(state.modelVersion===8){ [['y10','docházka, dovolené, výplatní pásky'],['y5','evidence a oběh dokumentů, spisy']].forEach(([id,use])=>{ const s=state.funcs[id]; if(s&&s.kind==='system'&&s.allUsers===undefined){ s.allUsers=true; s.allUse=use; } });
    state.modelVersion=9; logChange('model','průřezové systémy: VEMA, ESPIS (používají všichni zaměstnanci)'); }
  if(state.modelVersion===9){ let n=0; if(state.funcs.y2) ['s1','f06','s2'].forEach(f=>{ if(state.funcs[f]&&!state.links.some(l=>l.from===f&&l.to==='y2'&&l.kind==='pouziva')){ state.links.push({id:uid('l'),from:f,to:'y2',kind:'pouziva',label:'elektronická dokumentace'}); n++; } });
    state.modelVersion=10; if(n) logChange('vazba',`ISSŘ – elektronická dokumentace: doplněno ${n} vazeb (povolování, integrované DO)`); }
  if(state.modelVersion<5){ seedProcesses(state); addCoordination(state); normProcesses(state); state.modelVersion=10; logChange('model','doplněny procesy a role'); setTimeout(()=>toast('Nový pohled Procesy: příjem žádosti (Portál; DS, e-mail, osobně).'),900); }
  if(drill&&!(state.funcs[drill]&&state.funcs[drill].sum)) drill=null;
  normKraj();
  if(state.show2028===undefined) state.show2028=true; state.colorBy=state.colorBy||'conf'; state.view=state.view||'map';
  Object.values(state.funcs).forEach(f=>{ f.assign=f.assign||[]; f.notes=f.notes||[]; f.locs=f.locs||[]; f.status=f.status||'navrh'; f.period=f.period||'2027'; }); }

// ---------- kontroly rozporů ----------
function capUnits(f){ const as=(f.assign||[]).filter(a=>U[a.unit]); const d=as.filter(a=>a.role==='do'); return (d.length?d:as.filter(a=>a.role==='own')).map(a=>a.unit); }
function check(){
  const out=[]; const act=activeFuncs();
  const add=(sev,code,text,o={})=>{ const key=[code,o.f||'',o.f2||'',o.u||'',o.r||'',o.loc||'',o.proc||'',o.step||''].join(':'); out.push({sev,code,text,key,...o,ignored:!!state.ignored[key]}); };
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
  // systémy a okolí
  const linked=(id,pred)=>LINKS.some(l=>(l.from===id&&pred(l.to,l))||(l.to===id&&pred(l.from,l)));
  const isSys=id=>F(id)&&F(id).kind==='system';
  act.filter(f=>f.type==='vykon'||f.type==='odvolani').forEach(f=>{ if(!linked(f.id,isSys)&&!(f.parent&&linked(f.parent,isSys))) add('warn','nosys',`„${f.name}“ nepoužívá žádný systém.`,{f:f.id}); });
  if(LINK_KINDS.spravuje) envEls('system').filter(s=>s.period!=='2028'&&s.sstate!=='vyhled'&&s.stype!=='externi').forEach(s=>{
    if(!LINKS.some(l=>l.to===s.id&&l.kind==='spravuje'&&F(l.from)&&(!F(l.from).kind||F(l.from).cat==='sous'))) add('warn','noadmin',`Systém „${s.name}“ nemá spravující funkci (vazba „${LINK_KINDS.spravuje[0]}“), tedy ani útvar, který za něj odpovídá.`,{f:s.id}); });
  checkProcesses(add);
  envEls('actor').filter(x=>x.period!=='2028').forEach(x=>{ if(!LINKS.some(l=>l.from===x.id||l.to===x.id)) add('info','noact',`Aktér „${x.name}“ nemá v modelu žádnou vazbu.`,{f:x.id}); });
  const covered=new Set(); act.forEach(f=>f.assign.forEach(a=>{ if(U[a.unit]){ subtree(a.unit).forEach(x=>covered.add(x)); upChain(a.unit).forEach(x=>covered.add(x)); } }));
  org.units.forEach(u=>{ if(!covered.has(u.id)&&(u.positions||[]).length) add('warn','unit',`Útvar „${u.name}“ nemá v modelu žádnou funkci.`,{u:u.id}); });
  return out;
}
const live=()=>conflicts.filter(c=>!c.ignored);
const touches=(c,id)=>{ const f=F(id); if(f&&f.sum) return kidsOf(id).some(k=>touches(c,k.id)); return c.f===id||c.f2===id||(c.fs&&c.fs.includes(id)); };
function funcSev(id){ const cs=live().filter(c=>touches(c,id)); return cs.some(c=>c.sev==='err')?'err':cs.some(c=>c.sev==='warn')?'warn':cs.length?'info':''; }
function unitSev(id){ const cs=live().filter(c=>c.u===id); return cs.some(c=>c.sev==='err')?'err':cs.some(c=>c.sev==='warn')?'warn':''; }

// ---------- vykreslení ----------
function render(){
  if(!state) return; LINKS=allLinks(); conflicts=check();
  const L=live(), ne=L.filter(c=>c.sev==='err').length, nw=L.filter(c=>c.sev==='warn').length, act=activeFuncs();
  const cov=act.filter(f=>f.assign.some(a=>U[a.unit])).length;
  $('#stats').innerHTML=`<div class="stat"><b>${act.length}</b><span>funkcí 2027</span></div><div class="stat"><b>${cov}/${act.length}</b><span>pokryto organigramem</span></div>
    <div class="stat ${ne?'bad':''}"><b>${ne}</b><span>chyb</span></div><div class="stat ${nw?'warnc':''}"><b>${nw}</b><span>varování</span></div>
    <div class="stat"><b>${state.proposals.filter(p=>p.status==='navrh'||p.status==='predano').length}</b><span>otevřených návrhů</span></div>${verdictStat()}`;
  $('#tabConf').textContent='Rozpory'+(ne+nw?` (${ne+nw})`:'');
  const v=state.view; $$('.viewsw button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
  ['map','org','proc','ws','conf','prop','ver'].forEach(x=>$('#v-'+x).hidden=x!==v);
  document.body.dataset.view=v;
  ({map:renderMap,org:renderOrg,proc:renderProc,ws:renderWs,conf:renderConf,prop:renderProp,ver:renderVer})[v]();
  renderSide();
}
function setView(v){ state.view=v; if(v!=='map') setConnect(false); if(v!=='proc') setPConnect(false); render(); }

// --- mapa funkcí ---
// hlavní mapa: dlaždice nejvyšší úrovně (samostatné funkce a sbalené souhrny); otevřený souhrn (drill): jeho dílčí funkce + ztlumené vnější funkce po stranách
const visible=f=>(f.kind!=='actor'||state.showActors!==false)&&(f.kind!=='system'||state.showSystems!==false)&&(state.show2028||f.period!=='2028'||(f.sum&&kidsOf(f.id).some(k=>k.period!=='2028')));
const P=f=>drill?{x:f.sx,y:f.sy}:{x:f.x,y:f.y};
function setP(f,x,y){ if(drill){ f.sx=x; f.sy=y; } else { f.x=x; f.y=y; } }
function tileHTML(f,cs){ const ne=cs.filter(c=>c.sev==='err').length, nw=cs.filter(c=>c.sev==='warn').length;
  const badges=`${ne?`<span class="cb err" title="chyby">${ne}</span>`:''}${nw?`<span class="cb warn" title="varování">${nw}</span>`:''}`;
  if(f.kind==='actor') return `<div class="fn">${esc(f.name)}</div><div class="fm">${esc(ACAT[f.cat]||'')}${f.period==='2028'?' · <b>2028</b>':''}${badges}</div>${(f.channels||[]).length?`<div class="fu ch">${f.channels.map(c=>`<span class="uchip" title="komunikační kanál">${esc(CHANNELS[c]||c)}</span>`).join('')}</div>`:''}`;
  if(f.kind==='system') return `<div class="fn">${esc(f.name)}</div>${f.allUsers?`<span class="allu" title="Používají všichni zaměstnanci${f.allUse?': '+esc(f.allUse):''} – vazby od jednotlivých funkcí se nekreslí.">∀ všichni</span>`:''}<div class="fm">${esc(STYPE[f.stype]||'')} · ${esc(SSTATE[f.sstate]||'')}${f.period==='2028'?' · <b>2028</b>':''}${badges}</div>${f.admin?`<div class="fm" title="správce / dodavatel">${esc(f.admin)}</div>`:''}`;
  if(f.sum){ const k=kidsOf(f.id).filter(x=>state.show2028||x.period!=='2028'); const o=sumOwner(f);
    return `<div class="fn">${esc(f.name)}</div><div class="fm"><span class="st" style="background:${STATUS_COLOR[sumStatus(f)]}" title="${STATUS[sumStatus(f)]}"></span>${k.length} funkcí${badges}</div>
      <div class="fu">${o?`<span class="uchip r-own" title="${esc(unitPath(o))}">${esc(shortName(o))}</span>`:'<span class="hint">více vlastníků</span>'}<button class="small open" data-open="${f.id}">Otevřít ▸</button></div>`; }
  const own=f.assign.filter(a=>a.role==='own'), others=f.assign.length-own.length;
  const chips=own.slice(0,2).map(a=>`<span class="uchip r-own${U[a.unit]?'':' gone'}" title="${esc(U[a.unit]?unitPath(a.unit):(a.name||a.unit)+' (v organigramu už není)')}">${esc(U[a.unit]?shortName(a.unit):(a.name||'?'))}</span>`).join('')+(others?`<span class="uchip more" title="${esc(f.assign.filter(a=>a.role!=='own').map(a=>ROLES[a.role]+': '+(U[a.unit]?U[a.unit].name:a.name)).join('\n'))}">+${others} útv.</span>`:'');
  return `<div class="fn">${esc(f.name)}</div><div class="fm"><span class="st" style="background:${STATUS_COLOR[f.status]}" title="${STATUS[f.status]}"></span>${esc(TYPES[f.type]||'')}${f.period==='2028'?' · <b>2028</b>':''}${badges}${f.notes.length?`<span class="cb note" title="poznámky z diskuse">✎${f.notes.length}</span>`:''}</div>
    <div class="fu">${chips||(f.period==='2028'?'<span class="hint">výhled soustavy</span>':'<span class="hint">bez útvaru</span>')}</div>`; }
function renderMap(){
  $('#show2028').checked=!!state.show2028; $('#showI').checked=state.showInternal!==false; $('#showLS').checked=state.showSysLinks!==false; $('#showLE').checked=state.showEnvLinks!==false; $('#showEx').checked=state.showExisting!==false; $('#showPl').checked=state.showPlanned!==false; $('#showA').checked=state.showActors!==false; $('#showS').checked=state.showSystems!==false; $('#colorBy').value=state.colorBy; $('#zoom').value=Math.round(zoom*100); $('#zoomVal').textContent=Math.round(zoom*100)+' %';
  const D=drill&&F(drill); $('#crumb').hidden=!D; document.body.classList.toggle('drilling',!!D); if(D) $('#crumbName').textContent=D.name;
  const wrap=$('#canvasWrap'), cv=$('#canvas'); const sl=wrap.scrollLeft, st=wrap.scrollTop; cv.innerHTML=''; cv.style.transform=`scale(${zoom})`;
  const fs=D?kidsOf(D.id).filter(visible):Object.values(state.funcs).filter(f=>!f.parent&&visible(f));
  if(D&&fs.some(f=>f.sx===undefined)) layoutKids(fs,null);
  // vazby převedené na zobrazené dlaždice (sloučené)
  const shown=new Set(fs.map(f=>f.id)); const agg={}; const ext={in:new Set(),out:new Set()};
  // filtr vazeb: mezi funkcemi / se systémy / s okolím (vazba aktér–systém se ukáže, je-li zapnuto kterékoli z obou)
  const isAct=id=>F(id)&&F(id).kind==='actor', isSysE=id=>F(id)&&F(id).kind==='system';
  const lkShown=(a,b)=>{ const ac=isAct(a)||isAct(b), sy=isSysE(a)||isSysE(b); if(ac) return state.showEnvLinks!==false||(sy&&state.showSysLinks!==false); if(sy) return state.showSysLinks!==false; return state.showInternal!==false; };
  LINKS.forEach(l=>{ let a=l.from, b=l.to; if(!lkShown(a,b)) return; if(l.planned?state.showPlanned===false:state.showExisting===false) return;
    if(D){ const inA=a===D.id||F(a)&&F(a).parent===D.id, inB=b===D.id||F(b)&&F(b).parent===D.id; if(!inA&&!inB) return;
      const top=id=>{ const f=F(id); return f&&f.parent?f.parent:id; }; if(!inA){ a=top(a); ext.in.add(a); } if(!inB){ b=top(b); ext.out.add(b); } }
    else { a=F(a)&&F(a).parent?F(a).parent:a; b=F(b)&&F(b).parent?F(b).parent:b; }
    if(a===b||!F(a)||!F(b)) return; const k=a+'>'+b+':'+l.kind+(l.planned?':p':''); (agg[k]=agg[k]||{from:a,to:b,kind:l.kind,planned:!!l.planned,ids:[],labels:new Set()}).ids.push(l.id); if(l.label) agg[k].labels.add(l.label); });
  const boxes={}; const isSel=id=>sel&&(sel.t==='f')&&sel.id===id;
  const selRep=sel&&sel.t==='f'&&F(sel.id)?(D?sel.id:(F(sel.id).parent||sel.id)):null;
  const nb=new Set(); if(selRep){ nb.add(selRep); Object.values(agg).forEach(g=>{ if(g.from===selRep) nb.add(g.to); if(g.to===selRep) nb.add(g.from); }); }
  const mk=(f,ghost)=>{ const g=state.groups.find(x=>x.id===f.group); const b=document.createElement('div'); boxes[f.id]=b; const cs=live().filter(c=>touches(c,f.id)); const sev=funcSev(f.id);
    b.className='fbox'+(f.kind?' '+f.kind:'')+(f.sum?' sum':'')+(ghost?' ghost':'')+(f.period==='2028'&&!f.sum?' p2028':'')+(state.colorBy==='conf'&&!ghost&&!(f.period==='2028'&&!f.sum)?' sev-'+(sev||'ok'):'')+(isSel(f.id)||selRep===f.id&&!D?' sel':'')+(connectFrom===f.id?' from':'')+(selRep&&!nb.has(f.id)?' dim':'');
    if(state.colorBy==='status'&&!ghost) b.style.boxShadow=`inset 4px 0 0 ${STATUS_COLOR[f.sum?sumStatus(f):f.status]}`;
    b.style.borderTopColor=g?g.color:'#999'; b.dataset.fid=f.id; b.innerHTML=ghost?`<div class="fn">${esc(f.name)}</div><div class="fm">${f.kind==='actor'?'vnější okolí':f.kind==='system'?'systém':(f.sum?'souhrn · ':'')+esc((g||{}).name||'')}</div>`:tileHTML(f,cs);
    b.addEventListener('pointerdown',e=>boxDown(e,f,ghost)); if(f.sum&&!ghost) b.addEventListener('dblclick',()=>openSum(f.id));
    const ob=b.querySelector('[data-open]'); if(ob){ ob.addEventListener('pointerdown',e=>e.stopPropagation()); ob.onclick=e=>{ e.stopPropagation(); openSum(f.id); }; }
    cv.appendChild(b); return b; };
  fs.forEach(f=>{ const b=mk(f,false); const p=P(f); b.style.left=p.x+'px'; b.style.top=p.y+'px'; });
  if(state._layout&&!D&&fs.length&&boxes[fs[0].id].offsetHeight){ const h={}; fs.forEach(f=>h[f.id]=boxes[f.id].offsetHeight); autoLayout(state,h); fs.forEach(f=>{ boxes[f.id].style.left=f.x+'px'; boxes[f.id].style.top=f.y+'px'; }); persist(); }
  if(D&&fs.some(f=>f.sx===undefined||f._lay)){ const h={}; fs.forEach(f=>h[f.id]=boxes[f.id].offsetHeight); layoutKids(fs,h); fs.forEach(f=>{ boxes[f.id].style.left=f.sx+'px'; boxes[f.id].style.top=f.sy+'px'; }); persist(); }
  const rect=id=>{ const b=boxes[id]; return {x:parseFloat(b.style.left),y:parseFloat(b.style.top),w:b.offsetWidth,h:b.offsetHeight}; };
  if(!D&&state.show2028) place2028(fs,boxes,rect);
  let W=600,H=400;
  if(D){ // rámeček souhrnu + vnější funkce po stranách
    let x1=1e9,y1=1e9,x2=-1e9,y2=-1e9; fs.forEach(f=>{ const r=rect(f.id); x1=Math.min(x1,r.x); y1=Math.min(y1,r.y); x2=Math.max(x2,r.x+r.w); y2=Math.max(y2,r.y+r.h); }); if(!fs.length){ x1=320;y1=80;x2=560;y2=200; }
    const g=state.groups.find(x=>x.id===D.group); const fr=document.createElement('div'); fr.className='gframe drill'+(selRep===D.id?' sel':''); fr.dataset.fid=D.id;
    fr.style.cssText=`left:${x1-18}px;top:${y1-40}px;width:${x2-x1+36}px;height:${y2-y1+58}px;border-color:${g?g.color:'#999'}`; fr.innerHTML=`<div class="gl" style="color:${g?g.color:'#333'}">${esc(D.name)}</div>`;
    fr.querySelector('.gl').addEventListener('pointerdown',e=>{ e.stopPropagation(); if(document.body.classList.contains('connecting')) connectClick(D.id); else { sel={t:'f',id:D.id}; render(); } });
    cv.insertBefore(fr,cv.firstChild); boxes[D.id]=fr; 
    const place=(ids,x)=>{ let y=y1; [...ids].filter(id=>F(id)&&!shown.has(id)&&id!==D.id).forEach(id=>{ const b=mk(F(id),true); b.style.left=x+'px'; b.style.top=y+'px'; y+=b.offsetHeight+16; }); };
    place(ext.in,Math.max(20,x1-BW-140)); const outOnly=[...ext.out].filter(id=>!ext.in.has(id)); place(outOnly,x2+140);
    W=Math.max(W,x2+BW+300); H=Math.max(H,y2+200);
  } else { // rámečky oblastí
    state.groups.forEach(g=>{ const ms=fs.filter(f=>f.group===g.id); if(!ms.length) return; let x1=1e9,y1=1e9,x2=-1e9,y2=-1e9; ms.forEach(f=>{ const r=rect(f.id); x1=Math.min(x1,r.x); y1=Math.min(y1,r.y); x2=Math.max(x2,r.x+r.w); y2=Math.max(y2,r.y+r.h); });
      const fr=document.createElement('div'); fr.className='gframe'+(sel&&sel.t==='g'&&sel.id===g.id?' sel':'')+(selRep?' dim':''); fr.style.cssText=`left:${x1-14}px;top:${y1-34}px;width:${x2-x1+28}px;height:${y2-y1+48}px;border-color:${g.color}`;
      fr.innerHTML=`<div class="gl" style="color:${g.color}" title="${esc(g.name)} – tažením přesunete celou oblast">${esc(g.name)}</div>`; fr.querySelector('.gl').addEventListener('pointerdown',e=>groupDown(e,g,ms)); cv.insertBefore(fr,cv.firstChild); });
    [['actor','Vnější okolí','#334155'],['system','Systémy','#0F766E']].forEach(([kind,name,col])=>{ const ms=fs.filter(f=>f.kind===kind); if(!ms.length) return; let x1=1e9,y1=1e9,x2=-1e9,y2=-1e9; ms.forEach(f=>{ const r=rect(f.id); x1=Math.min(x1,r.x); y1=Math.min(y1,r.y); x2=Math.max(x2,r.x+r.w); y2=Math.max(y2,r.y+r.h); });
      const fr=document.createElement('div'); fr.className='gframe band band-'+kind+(sel&&sel.t==='band'&&sel.id===kind?' sel':'')+(selRep?' dim':''); fr.style.cssText=`left:${x1-14}px;top:${y1-34}px;width:${x2-x1+28}px;height:${y2-y1+48}px;border-color:${col}`;
      fr.innerHTML=`<div class="gl" style="color:${col}" title="${name} – tažením přesunete celý pás">${name}</div>`; fr.querySelector('.gl').addEventListener('pointerdown',e=>{ e.stopPropagation(); dragItems(e,ms.map(f=>({f,x0:f.x,y0:f.y})),()=>{ sel={t:'band',id:kind}; render(); }); }); cv.insertBefore(fr,cv.firstChild); }); }
  Object.keys(boxes).forEach(id=>{ const r=rect(id); W=Math.max(W,r.x+r.w+200); H=Math.max(H,r.y+r.h+160); }); cv.style.width=W+'px'; cv.style.height=H+'px';
  const NS='http://www.w3.org/2000/svg'; const svg=document.createElementNS(NS,'svg'); svg.setAttribute('class','links'); svg.setAttribute('width',W); svg.setAttribute('height',H);
  svg.innerHTML='<defs>'+Object.entries({...LINK_KINDS,x:KIND('x')}).map(([k,[,c]])=>`<marker id="ar-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="${c}"/></marker>`).join('')+'</defs>';
  const edge=(r,tx,ty)=>{ const cx=r.x+r.w/2, cy=r.y+r.h/2, dx=tx-cx, dy=ty-cy; if(!dx&&!dy) return [cx,cy]; const s=Math.min(dx?Math.abs(r.w/2/dx):1e9, dy?Math.abs(r.h/2/dy):1e9); return [cx+dx*s,cy+dy*s]; };
  const labels=[]; const pairIdx={}, pairCnt={}; Object.values(agg).forEach(g=>{ if(boxes[g.from]&&boxes[g.to]){ const k=[g.from,g.to].sort().join('|'); pairCnt[k]=(pairCnt[k]||0)+1; } });
  Object.values(agg).forEach(g=>{ if(!boxes[g.from]||!boxes[g.to]) return; const a=rect(g.from), b=rect(g.to); const [k0,c,dash]=KIND(g.kind);
    let [x1,y1]=edge(a,b.x+b.w/2,b.y+b.h/2), [x2,y2]=edge(b,a.x+a.w/2,a.y+a.h/2);
    // souběžné vazby mezi stejnou dvojicí prvků odsadit, aby se nepřekrývaly čáry ani popisky
    const pk=[g.from,g.to].sort().join('|'), pi=(pairIdx[pk]=(pairIdx[pk]??-1)+1), pn=pairCnt[pk];
    if(pn>1){ const off=(pi-(pn-1)/2)*9, len=Math.hypot(x2-x1,y2-y1)||1, nx=-(y2-y1)/len*off, ny=(x2-x1)/len*off; x1+=nx; y1+=ny; x2+=nx; y2+=ny; }
    const lsel=sel&&sel.t==='l'&&g.ids.includes(sel.id); const hot=lsel||(selRep&&(g.from===selRep||g.to===selRep)); const faint=selRep&&!hot;
    const lbl=[...g.labels].join('; ')||k0; const el=document.createElementNS(NS,'g'); const soft=!selRep&&!lsel&&state.showInternal!==false&&(F(g.from).kind||F(g.to).kind); el.setAttribute('class','lk'+(lsel?' sel':'')+(faint?' faint':'')+(soft?' soft':''));
    el.innerHTML=`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="hit"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${hot?2.6:(g.planned?2.2:1.6)}" ${g.planned?'stroke-dasharray="1 6" stroke-linecap="round"':dash?'stroke-dasharray="6 4"':''} marker-end="url(#ar-${LINK_KINDS[g.kind]?g.kind:'x'})"/>`+
      `<title>${esc(F(g.from).name+' → '+F(g.to).name+': '+lbl+(g.planned?' (k vytvoření)':''))}</title>`;
    el.addEventListener('pointerdown',e=>{ e.stopPropagation(); sel={t:'l',id:g.ids[0],ids:g.ids}; render(); }); svg.appendChild(el);
    if(hot) labels.push(`<text x="${(x1+x2)/2}" y="${(y1+y2)/2-5+(pn>1?(pi-(pn-1)/2)*14:0)}" fill="${c}" text-anchor="middle"${lsel?' class="on"':''}>${g.planned?'⊕ ':''}${esc(lbl)}${g.ids.length>1?' ('+g.ids.length+'×)':''}</text>`); });
  cv.insertBefore(svg,cv.firstChild);
  // popisky vazeb ve vlastní vrstvě nad dlaždicemi – nepřekryje je sousední dlaždice
  if(labels.length){ const lv=document.createElementNS(NS,'svg'); lv.setAttribute('class','links labels'); lv.setAttribute('width',W); lv.setAttribute('height',H); lv.innerHTML=labels.join(''); cv.appendChild(lv); }
  wrap.scrollLeft=sl; wrap.scrollTop=st;
}
// dlaždice výhledu 2028, které překrývají jiné dlaždice, přesune na konec své oblasti (pásu) a dlaždice pod nimi odsune níž
function place2028(fs,boxes,rect){ const GAP=14; let moved=false;
  const hit=(r,q)=>r.x<q.x+q.w+6&&q.x<r.x+r.w+6&&r.y<q.y+q.h+6&&q.y<r.y+r.h+6;
  const setPos=(f,x,y)=>{ f.x=Math.round(x); f.y=Math.round(y); boxes[f.id].style.left=f.x+'px'; boxes[f.id].style.top=f.y+'px'; };
  fs.filter(f=>f.period==='2028'&&!f.sum).forEach(t=>{ const r=rect(t.id); const unplaced=!Number.isFinite(t.x)||!Number.isFinite(t.y); if(!unplaced&&!fs.some(o=>o!==t&&hit(r,rect(o.id)))) return;
    const mates=fs.filter(o=>o!==t&&o.period!=='2028'&&Number.isFinite(o.x)&&(t.kind?o.kind===t.kind:(!o.kind&&o.group===t.group)));
    if(!mates.length){ if(unplaced){ setPos(t,30,Math.max(60,...fs.filter(o=>o!==t&&Number.isFinite(o.y)).map(o=>o.y+rect(o.id).h))+60); moved=true; } return; } moved=true;
    if(t.kind){ const ly=Math.max(...mates.map(o=>o.y)); const row=mates.filter(o=>Math.abs(o.y-ly)<5); setPos(t,Math.max(...row.map(o=>o.x+rect(o.id).w))+44,ly); return; }
    const col=fs.filter(o=>o!==t&&Number.isFinite(o.x)&&Number.isFinite(o.y)&&!o.kind&&o.group===t.group&&(o.period!=='2028'||o._p28));
    const x=Math.min(...mates.map(o=>o.x)), y=Math.max(...col.map(o=>o.y+rect(o.id).h))+GAP; setPos(t,x,y); t._p28=1;
    // odsunout celé oblasti / pásy, které začínají pod novou dlaždicí (zachová se řádková struktura mapy)
    const tr=rect(t.id), need=tr.y+tr.h+GAP+40; const unitOf=o=>o.kind?'k:'+o.kind:'g:'+o.group; const tops={};
    fs.forEach(o=>{ if(o===t||!Number.isFinite(o.y)) return; const u=unitOf(o); tops[u]=Math.min(tops[u]??1e9,o.y); });
    const myU=unitOf(t); const units=Object.keys(tops).filter(u=>u!==myU&&tops[u]>=y-2);
    if(units.length){ const d=need-Math.min(...units.map(u=>tops[u])); if(d>0) fs.forEach(o=>{ if(o!==t&&units.includes(unitOf(o))) setPos(o,o.x,o.y+d); }); } });
  fs.forEach(f=>delete f._p28); if(moved) persist(); }
function layoutKids(fs,h){ let y=[70,70]; fs.forEach((f,i)=>{ const c=y[0]<=y[1]?0:1; f.sx=380+c*(BW+40); f.sy=y[c]; y[c]+=((h&&h[f.id])||90)+18; delete f._lay; }); }
function openSum(id){ drill=id; sel=null; setConnect(false); if(state.view!=='map') state.view='map'; $('#canvasWrap').scrollTo(0,0); render(); }
function closeSum(){ const d=drill; drill=null; sel=d?{t:'f',id:d}:null; render(); if(d) focusFunc(d); }
// tažení krabiček (myš i dotyk)
function dragItems(e,items,onClick){ if(e.button>0) return; const sx=e.clientX, sy=e.clientY; let moved=false; const t=e.currentTarget; try{ t.setPointerCapture(e.pointerId); }catch(_){}
  const mv=ev=>{ const dx=(ev.clientX-sx)/zoom, dy=(ev.clientY-sy)/zoom; if(!moved&&Math.abs(dx)+Math.abs(dy)<4) return; if(!ROLE.org) return; moved=true;
    items.forEach(it=>{ setP(it.f,Math.max(0,Math.round(it.x0+dx)),Math.max(20,Math.round(it.y0+dy))); const b=document.querySelector(`.fbox[data-fid="${it.f.id}"]`); if(b){ const p=P(it.f); b.style.left=p.x+'px'; b.style.top=p.y+'px'; } }); };
  const up=()=>{ t.removeEventListener('pointermove',mv); t.removeEventListener('pointerup',up); t.removeEventListener('pointercancel',up);
    if(moved){ items.forEach(it=>{ const p=P(it.f); setP(it.f,Math.round(p.x/10)*10,Math.round(p.y/10)*10); }); save(); } else onClick(); };
  t.addEventListener('pointermove',mv); t.addEventListener('pointerup',up); t.addEventListener('pointercancel',up); }
function boxDown(e,f,ghost){ e.stopPropagation(); if(document.body.classList.contains('connecting')){ connectClick(f.id); return; }
  if(ghost){ drill=null; sel={t:'f',id:f.id}; render(); focusFunc(f.id); return; }
  dragItems(e,[{f,x0:P(f).x,y0:P(f).y}],()=>{ sel={t:'f',id:f.id}; render(); }); }
function groupDown(e,g,ms){ e.stopPropagation(); dragItems(e,ms.map(f=>({f,x0:f.x,y0:f.y})),()=>{ sel={t:'g',id:g.id}; render(); }); }
function setConnect(on){ connectFrom=null; document.body.classList.toggle('connecting',!!on); $('#btnConnect').classList.toggle('on',!!on); $('#connHint').hidden=!on; $('#connHint').textContent='Klikněte na funkci, ze které vazba vede.'; if(state&&state.view==='map') renderMap(); }
function connectClick(id){ if(!connectFrom){ connectFrom=id; $('#connHint').textContent='Teď klikněte na cílovou funkci (Esc = konec).'; renderMap(); return; }
  if(connectFrom===id) return; const from=connectFrom; connectFrom=null; $('#connHint').textContent='Klikněte na funkci, ze které vazba vede.';
  openLinkDlg(null,from,id); }
function openLinkDlg(l,from,to){ const d=$('#dlgLink'); $('#lkKind').innerHTML=Object.entries(LINK_KINDS).map(([k,[n]])=>`<option value="${k}">${esc(n)}</option>`).join('');
  $('#lkKind').value=l&&LINK_KINDS[l.kind]?l.kind:(LINK_KINDS.podklad?'podklad':Object.keys(LINK_KINDS)[0]); $('#lkLabel').value=l?l.label:''; $('#lkExist').checked=!(l&&l.planned); $('#lkWhat').textContent=`${F(l?l.from:from).name} → ${F(l?l.to:to).name}`+((F(l?l.to:to)||{}).sum||(F(l?l.from:from)||{}).sum?' (vazba na souhrn platí pro všechny jeho funkce)':'');
  $('#lkOk').onclick=()=>{ if(l){ l.kind=$('#lkKind').value; l.label=$('#lkLabel').value.trim(); if($('#lkExist').checked) delete l.planned; else l.planned=true; save('vazba','upravena: '+$('#lkWhat').textContent); }
    else { const nl={id:uid('l'),from,to,kind:$('#lkKind').value,label:$('#lkLabel').value.trim()}; if(!$('#lkExist').checked) nl.planned=true; state.links.push(nl); sel={t:'l',id:nl.id,ids:[nl.id]}; save('vazba','nová: '+$('#lkWhat').textContent); } d.close(); };
  $('#lkCancel').onclick=()=>{ d.close(); renderMap(); }; $('#lkKinds').onclick=()=>{ openKindsDlg(()=>{ const v=$('#lkKind').value; $('#lkKind').innerHTML=Object.entries(LINK_KINDS).map(([k,[n]])=>`<option value="${k}">${esc(n)}</option>`).join(''); $('#lkKind').value=LINK_KINDS[v]?v:Object.keys(LINK_KINDS)[0]; }); };
  if(!d.open) d.showModal(); }
// ---------- druhy vazeb (editovatelné) ----------
const KCOLORS=['#1B2430','#7C3AED','#B42318','#0E9AA7','#C79400','#ED7D31','#4D8B31','#9AA4B2','#2563EB','#C25BB9','#0F766E','#92400E'];
function openKindsDlg(after){ const d=$('#dlgKinds'); const draw=()=>{ const used=k=>state.links.filter(l=>l.kind===k).length;
    $('#kindsBody').innerHTML=Object.entries(LINK_KINDS).map(([k,[n,c,dash]])=>`<div class="krow" data-k="${k}">
      <input type="color" value="${c}" title="barva"><input type="text" value="${esc(n)}" placeholder="název vazby (sloveso, např. „řídí“)">
      <label title="čárkovaná čára"><input type="checkbox" ${dash?'checked':''}> čárkovaně</label><span class="muted">${used(k)}×</span>
      ${used(k)?`<select title="Převede všechny vazby tohoto druhu na jiný druh a tento smaže"><option value="">sloučit do…</option>${Object.entries(LINK_KINDS).filter(([x])=>x!==k).map(([x,[m]])=>`<option value="${x}">${esc(m)}</option>`).join('')}</select>`:'<button class="small" title="smazat nepoužitý druh">×</button>'}</div>`).join('');
    $('#kindsBody').querySelectorAll('.krow').forEach(r=>{ const k=r.dataset.k, K=LINK_KINDS[k]; const [col,txt]=r.querySelectorAll('input');
      col.onchange=()=>{ K[1]=col.value; save('druh vazby','barva: '+K[0]); };
      txt.onchange=()=>{ const v=txt.value.trim(); if(!v){ txt.value=K[0]; return; } const o=K[0]; K[0]=v; save('druh vazby',`přejmenován: ${o} → ${v}`); };
      r.querySelector('input[type=checkbox]').onchange=e=>{ K[2]=e.target.checked; save('druh vazby',K[0]+(K[2]?': čárkovaně':': plnou čarou')); };
      const sl=r.querySelector('select'); if(sl) sl.onchange=()=>{ const t=sl.value; if(!t) return; const n=state.links.filter(l=>l.kind===k).length;
        if(!confirm(`Převést ${n} vazeb „${K[0]}“ na „${LINK_KINDS[t][0]}“ a druh „${K[0]}“ smazat?`)){ sl.value=''; return; }
        state.links.forEach(l=>{ if(l.kind===k) l.kind=t; }); delete LINK_KINDS[k]; save('druh vazby',`sloučen: ${K[0]} → ${LINK_KINDS[t][0]}`); draw(); };
      const del=r.querySelector('button'); if(del) del.onclick=()=>{ if(Object.keys(LINK_KINDS).length<2) return; delete LINK_KINDS[k]; save('druh vazby','smazán: '+K[0]); draw(); }; }); };
  $('#kindAdd').onclick=()=>{ const n=$('#kindNew').value.trim(); if(!n) return; const used=Object.values(LINK_KINDS).map(x=>x[1]); const c=KCOLORS.find(x=>!used.includes(x))||KCOLORS[0];
    LINK_KINDS[uid('k')]=[n,c,false]; $('#kindNew').value=''; save('druh vazby','nový: '+n); draw(); };
  $('#kindNew').onkeydown=e=>{ if(e.key==='Enter') $('#kindAdd').click(); };
  $('#kindsClose').onclick=()=>{ d.close(); if(typeof after==='function') after(); render(); }; draw(); d.showModal(); }
function delLink(id){ const l=state.links.find(x=>x.id===id); if(!l) return; state.links=state.links.filter(x=>x!==l); sel=null; save('vazba','smazána: '+(F(l.from)||{}).name+' → '+(F(l.to)||{}).name); }

// --- organigram s funkcemi ---
function renderOrg(){ const c=$('#v-org'); const st=c.scrollTop; c.innerHTML='';
  if(!org.units.length){ c.innerHTML='<div class="empty">Krajský organigram se nepodařilo načíst.</div>'; return; }
  const byUnit={}; Object.values(state.funcs).forEach(f=>f.assign.forEach(a=>(byUnit[a.unit]=byUnit[a.unit]||[]).push({f,a})));
  const nUn=live().filter(x=>x.code==='unit').length;
  c.insertAdjacentHTML('beforeend',`<div class="orghint">Krajský organigram – ${esc(KRAJ)} (živě, jen ke čtení). Klikněte na útvar a přiřaďte mu funkce. ${nUn?`<b class="warnc">${nUn} útvarů bez funkce.</b>`:'Všechny útvary mají funkci.'}</div>`);
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
    <span class="ca">${x.f||x.u||x.proc?'<button class="small" data-a="show">Zobrazit</button>':''}${ROLE.org?(x.ignored?'<button class="small" data-a="unign">Zrušit přijetí</button>':`<button class="small" data-a="ign" title="Rozpor je vědomě přijat (např. na základě diskuse)">Přijmout odchylku</button><button class="small" data-a="prop">→ návrh změny</button>`):''}</span></div>`;
  const L=live(), I=conflicts.filter(x=>x.ignored);
  const sec=(t,arr)=>arr.length?`<h3>${t} <span class="muted">(${arr.length})</span></h3>`+arr.map(item).join(''):'';
  c.innerHTML=`<div class="pad"><h2>Rozpory mezi modelem a organigramem</h2><p class="muted">Kontrolují se jen funkce platné od 1. 1. 2027. Organigram se čte živě – po úpravě v krajské aplikaci se rozpory přepočítají samy.</p>
    ${L.length?'':'<p class="okmsg">Bez rozporů.</p>'}${sec('Chyby',L.filter(x=>x.sev==='err'))}${sec('Varování',L.filter(x=>x.sev==='warn'))}${sec('Informace',L.filter(x=>x.sev==='info'))}${sec('Přijaté odchylky',I)}
    <h2 style="margin-top:28px">Pravidla modelu</h2><p class="muted">Pravidlo „oddělit“ hlásí chybu, když funkce ze skupiny A a B vykonávají útvary pod stejnou sekcí / odborem / útvarem.</p>
    <div id="rules">${state.rules.map(r=>`<div class="rule${r.on===false?' off':''}" data-rid="${r.id}"><label><input type="checkbox" ${r.on!==false?'checked':''} ${ROLE.org?'':'disabled'}> <b>${esc(r.name)}</b></label> <span class="muted">– oddělit na úrovni: ${LEVELS[r.level]}</span>
      <div class="muted">${esc(r.desc||'')}</div><div class="rab"><span>A: ${(r.a||[]).map(id=>F(id)?esc(F(id).name):'?').join('; ')}</span><span>B: ${(r.b||[]).map(id=>F(id)?esc(F(id).name):'?').join('; ')}</span></div>
      ${ROLE.org?'<button class="small" data-a="edit">Upravit</button> <button class="small" data-a="del" style="color:var(--danger)">Smazat</button>':''}</div>`).join('')}</div>
    ${ROLE.org?'<button id="ruleAdd">+ pravidlo</button>':''}</div>`;
  c.querySelectorAll('.citem').forEach(el=>{ const x=conflicts.find(k=>k.key===el.dataset.key);
    el.querySelectorAll('button').forEach(b=>b.onclick=()=>{ const a=b.dataset.a;
      if(a==='show'&&x.proc){ state.proc=x.proc; procSel=x.step?{t:(x.code==='plane'?'lane':'step'),id:x.step}:null; setView('proc'); return; }
      if(a==='show'){ if(x.f){ sel={t:'f',id:x.f}; state.view='map'; focusFunc(x.f); render(); } else { sel={t:'u',id:x.u}; setView('org'); } }
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
    case 'nosys': return `Určit systém, ve kterém se vykonává „${f.name}“.`;
    case 'noadmin': return `Určit útvar (funkci), který bude spravovat systém „${f.name}“.`;
    case 'noact': return `Doplnit vazby aktéra „${f.name}“.`;
    case 'unit': return `Útvar „${U[x.u]?U[x.u].name:'?'}“: doplnit funkci do modelu, nebo útvar v organigramu zrušit/sloučit.`; }
  return x.text; }
function openRuleDlg(r){ const d=$('#dlgRule'); const fs=leaves().filter(f=>f.period!=='2028');
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
  c.innerHTML=`<div class="pad"><h2>Návrhy změn organigramu</h2><p class="muted">Model do organigramu nezapisuje. Návrhy se provedou v krajské aplikaci; rozpor, ze kterého návrh vznikl, pak sám zmizí.</p>
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
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows.length?rows:[{'Návrh':''}]),'Návrhy změn'); XLSX.writeFile(wb,`TOM_kraj_navrhy_${today()}.xlsx`); }; }

// --- verze modelu ---
function modelPart(){ return JSON.parse(JSON.stringify({kraj:state.kraj,groups:state.groups,funcs:state.funcs,links:state.links,rules:state.rules,roles:state.roles,processes:state.processes})); }
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
  const ln=s=>{ const [ft,k]=s.split(':'); const [x,y]=ft.split('>'); return `${(fb[x]||fa[x]||{}).name} → ${(fb[y]||fa[y]||{}).name} (${KIND(k)[0]})`; };
  [...LB].filter(s=>!LA.has(s)).forEach(s=>out.push('+ vazba: '+ln(s))); [...LA].filter(s=>!LB.has(s)).forEach(s=>out.push('− vazba: '+ln(s)));
  const ra=JSON.stringify(a.rules||[]), rb=JSON.stringify(b.rules||[]); if(ra!==rb) out.push('~ změněna pravidla');
  const pa=a.processes||[], pb=b.processes||[]; pb.filter(x=>!pa.some(y=>y.id===x.id)).forEach(x=>out.push('+ nový proces: '+x.name)); pa.filter(x=>!pb.some(y=>y.id===x.id)).forEach(x=>out.push('− zrušený proces: '+x.name));
  pb.forEach(x=>{ const y=pa.find(z=>z.id===x.id); if(y&&JSON.stringify(y)!==JSON.stringify(x)) out.push(`~ proces ${x.name}: ${y.steps.length} → ${x.steps.length} kroků`+(JSON.stringify(y.flows)!==JSON.stringify(x.flows)?', změněny šipky':'')); });
  if(JSON.stringify(a.roles||[])!==JSON.stringify(b.roles||[])) out.push('~ změněny role');
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
  if(state.view==='proc'){ renderProcSide(s); return; }
  if(state.view==='ws'){ renderWsSide(s); return; }
  if(sel&&sel.t==='band'){ const k=sel.id, xs=envEls(k);
    s.innerHTML=`<div class="sh"><span class="muted">${k==='actor'?'Vnější okolí':'Systémy'}</span><button class="small" id="sClose">×</button></div>
    <p class="muted" style="font-size:12px">${k==='actor'?'Aktéři, se kterými úřad komunikuje. Vazby od aktérů vedou na funkce (podání, stanoviska, odvolání), případně na systémy (portál).':'Systémy, na kterých funkce běží. Vazba „používá“ vede od funkce k systému, „spravuje“ určuje, která funkce (a tedy útvar) za systém odpovídá.'}</p>
    ${xs.map(x=>`<div class="arow kid"><a href="#" data-k="${x.id}">${esc(x.name)}</a><span class="muted" style="font-size:11px">${esc(k==='actor'?ACAT[x.cat]||'':STYPE[x.stype]||'')}</span></div>`).join('')}
    ${ROLE.org?`<div class="row" style="margin-top:10px"><button id="bAdd" class="primary">+ ${k==='actor'?'aktér':'systém'}</button></div>`:''}`;
    $('#sClose').onclick=()=>{ sel=null; render(); }; s.querySelectorAll('a[data-k]').forEach(x=>x.onclick=e=>{ e.preventDefault(); sel={t:'f',id:x.dataset.k}; render(); focusFunc(x.dataset.k); });
    if($('#bAdd')) $('#bAdd').onclick=()=>addEl(k); return; }
  if(sel&&sel.t==='f'&&F(sel.id)&&F(sel.id).kind){ const f=F(sel.id); const isA=f.kind==='actor'; const cs=conflicts.filter(c=>c.f===f.id);
    const ls=LINKS.filter(l=>l.from===f.id||l.to===f.id);
    s.innerHTML=`<div class="sh"><span class="muted">${isA?'Aktér vnějšího okolí':'Systém'}</span><button class="small" id="sClose">×</button></div>
    <label>Název<textarea id="eName" rows="2" ${ro}>${esc(f.name)}</textarea></label>
    ${isA?`<label>Kategorie<select id="eCat" ${ro}>${Object.entries(ACAT).map(([k,v])=>`<option value="${k}" ${k===f.cat?'selected':''}>${v}</option>`).join('')}</select></label>
      <div class="lbl">Komunikační kanály</div><div class="locs" id="eCh">${Object.entries(CHANNELS).map(([k,v])=>`<label><input type="checkbox" value="${k}" ${(f.channels||[]).includes(k)?'checked':''} ${ro}> ${v}</label>`).join('')}</div>`
    :`<div class="g2"><label>Typ<select id="eType" ${ro}>${Object.entries(STYPE).map(([k,v])=>`<option value="${k}" ${k===f.stype?'selected':''}>${v}</option>`).join('')}</select></label>
      <label>Stav<select id="eState" ${ro}>${Object.entries(SSTATE).map(([k,v])=>`<option value="${k}" ${k===f.sstate?'selected':''}>${v}</option>`).join('')}</select></label></div>
      <label>Správce / dodavatel<input type="text" id="eAdmin" value="${esc(f.admin||'')}" placeholder="např. ICZ, DIA, k ověření" ${ro}></label>
      <div class="lbl"><label style="display:inline-flex;gap:6px;align-items:center;margin:0;color:var(--ink);font-size:13px"><input type="checkbox" id="eAll" style="width:auto" ${f.allUsers?'checked':''} ${ro}> Průřezový systém – používají všichni zaměstnanci</label></div>
      ${f.allUsers?`<label>K čemu ho používají všichni<input type="text" id="eAllUse" value="${esc(f.allUse||'')}" placeholder="např. docházka, dovolené" ${ro}></label>`:''}
      <p class="muted" style="font-size:12px;margin:4px 0 0">Průřezové používání se nekreslí čarami a nezapočítává se do kontroly „funkce nepoužívá žádný systém“. Specifické vazby (např. „spravuje“) zůstávají.</p>`}
    <label>Platí<select id="ePeriod" ${ro}><option value="2027" ${f.period!=='2028'?'selected':''}>od 1. 1. 2027</option><option value="2028" ${f.period==='2028'?'selected':''}>od 2028 (výhled)</option></select></label>
    <label>Popis<textarea id="eDesc" rows="3" ${ro}>${esc(f.desc||'')}</textarea></label>
    ${procLinks(f.id)}
    ${linksBlock(f)}
    ${cs.length?`<div class="lbl">Rozpory</div>${cs.map(c=>`<div class="mini sev-${c.sev}${c.ignored?' ign':''}">${esc(c.text)}</div>`).join('')}`:''}
    <div class="lbl">Poznámky z diskuse</div><div class="notes">${f.notes.map((n,i)=>`<div class="note"><div class="muted">${esc(n.t)} · ${esc(n.who||'')}${ROLE.org?` <button class="small" data-n="${i}">×</button>`:''}</div>${esc(n.text)}</div>`).join('')||'<div class="muted">zatím nic</div>'}</div>
    ${ROLE.org?`<textarea id="nText" rows="2"></textarea><button class="small" id="nAdd">Přidat poznámku</button><div class="row" style="margin-top:14px"><button id="eDel" style="color:var(--danger)">Smazat ${isA?'aktéra':'systém'}</button></div>`:''}`;
    $('#sClose').onclick=()=>{ sel=null; render(); };
    if(!ROLE.org) return; const nm=isA?'aktér':'systém'; const ch=(fn,what)=>()=>{ fn(); save(nm,what+': '+f.name); };
    $('#eName').onchange=e=>{ const o=f.name; f.name=e.target.value.trim()||o; save(nm,`přejmenován: ${o} → ${f.name}`); };
    if(isA){ $('#eCat').onchange=ch(()=>f.cat=$('#eCat').value,'kategorie'); s.querySelectorAll('#eCh input').forEach(i=>i.onchange=ch(()=>f.channels=[...s.querySelectorAll('#eCh input:checked')].map(x=>x.value),'kanály')); }
    else { $('#eAll').onchange=ch(()=>f.allUsers=$('#eAll').checked,'průřezový'); if($('#eAllUse')) $('#eAllUse').onchange=ch(()=>f.allUse=$('#eAllUse').value.trim(),'průřezové použití'); $('#eType').onchange=ch(()=>f.stype=$('#eType').value,'typ'); $('#eState').onchange=ch(()=>f.sstate=$('#eState').value,'stav'); $('#eAdmin').onchange=ch(()=>f.admin=$('#eAdmin').value.trim(),'správce'); }
    $('#ePeriod').onchange=ch(()=>f.period=$('#ePeriod').value,'období'); $('#eDesc').onchange=ch(()=>f.desc=$('#eDesc').value,'popis');
    $('#nAdd').onclick=()=>{ const t=$('#nText').value.trim(); if(!t) return; f.notes.push({t:today(),who:currentUser?currentUser.email:'',text:t}); save('poznámka',f.name+': '+t); };
    s.querySelectorAll('[data-n]').forEach(b=>b.onclick=()=>{ if(confirm('Smazat poznámku?')){ f.notes.splice(+b.dataset.n,1); save('poznámka','smazána: '+f.name); } });
    $('#eDel').onclick=()=>{ if(!confirm(`Smazat ${isA?'aktéra':'systém'} „${f.name}“ včetně ${state.links.filter(l=>l.from===f.id||l.to===f.id).length} ručních vazeb?`)) return; delete state.funcs[f.id]; state.links=state.links.filter(l=>l.from!==f.id&&l.to!==f.id); sel=null; save(nm,'smazán: '+f.name); };
    return; }
  if(sel&&sel.t==='f'&&F(sel.id)&&F(sel.id).sum){ const f=F(sel.id); const ks=kidsOf(f.id); const cs=conflicts.filter(c=>touches(c,f.id)); const o=sumOwner(f);
    s.innerHTML=`<div class="sh"><span class="muted">Souhrnná funkce</span><button class="small" id="sClose">×</button></div>
    <label>Název<textarea id="fName" rows="2" ${ro}>${esc(f.name)}</textarea></label>
    <label>Oblast<select id="fGroup" ${ro}>${state.groups.map(g=>`<option value="${g.id}" ${g.id===f.group?'selected':''}>${esc(g.name)}</option>`).join('')}</select></label>
    <label>Popis<textarea id="fDesc" rows="2" ${ro}>${esc(f.desc||'')}</textarea></label>
    <p class="muted" style="font-size:12px">Souhrnný vlastník: <b>${o?esc(U[o].name):'více vlastníků'}</b>. Vazba vedená na souhrn platí pro všechny jeho funkce.</p>
    <div class="lbl">Dílčí funkce (${ks.length})</div>
    ${ks.map(k=>{ const kc=live().filter(c=>touches(c,k.id)); return `<div class="arow kid"><a href="#" data-k="${k.id}"><span class="st" style="background:${STATUS_COLOR[k.status]}"></span> ${esc(k.name)}${k.period==='2028'?' <i class="muted">(2028)</i>':''}</a><span>${kc.some(c=>c.sev==='err')?'<span class="cb err">!</span>':kc.length?'<span class="cb warn">!</span>':''}</span></div>`; }).join('')||'<div class="muted">žádné</div>'}
    ${linksBlock(f)}
    ${procLinks(f.id)}
    <div class="row" style="margin-top:10px"><button id="sOpen" class="primary">Otevřít souhrn ▸</button>${ROLE.org?'<button id="sAddK">+ dílčí funkce</button>':''}</div>
    ${cs.length?`<div class="lbl">Rozpory dílčích funkcí</div>${cs.map(c=>`<div class="mini sev-${c.sev}${c.ignored?' ign':''}">${esc(c.text)}</div>`).join('')}`:''}
    ${ROLE.org?'<div class="row" style="margin-top:14px"><button id="sDissolve" title="Dílčí funkce se stanou samostatnými dlaždicemi">Rozpustit souhrn</button></div>':''}`;
    $('#sClose').onclick=()=>{ sel=null; render(); }; $('#sOpen').onclick=()=>openSum(f.id);
    s.querySelectorAll('a[data-k]').forEach(x=>x.onclick=e=>{ e.preventDefault(); drill=f.id; sel={t:'f',id:x.dataset.k}; if(state.view!=='map') state.view='map'; render(); focusFunc(x.dataset.k); });
    if(!ROLE.org) return;
    $('#fName').onchange=e=>{ const o2=f.name; f.name=e.target.value.trim()||o2; save('souhrn',`přejmenován: ${o2} → ${f.name}`); };
    $('#fGroup').onchange=()=>{ f.group=$('#fGroup').value; ks.forEach(k=>k.group=f.group); save('souhrn','oblast: '+f.name); };
    $('#fDesc').onchange=()=>{ f.desc=$('#fDesc').value; save('souhrn','popis: '+f.name); };
    $('#sAddK').onclick=()=>{ drill=f.id; addFunc(f.group); };
    $('#sDissolve').onclick=()=>{ if(!confirm(`Rozpustit souhrn „${f.name}“? Jeho ${ks.length} funkcí se stanou samostatnými dlaždicemi a vazby vedené na souhrn se přenesou na každou z nich.`)) return;
      ks.forEach((k,i)=>{ delete k.parent; k.x=f.x+(i%2)*(BW+30); k.y=f.y+Math.floor(i/2)*110; });
      const ls=state.links.filter(l=>l.from===f.id||l.to===f.id); state.links=state.links.filter(l=>!ls.includes(l));
      ls.forEach(l=>ks.forEach(k=>state.links.push({...l,id:uid('l'),from:l.from===f.id?k.id:l.from,to:l.to===f.id?k.id:l.to})));
      delete state.funcs[f.id]; if(drill===f.id) drill=null; sel=null; save('souhrn','rozpuštěn: '+f.name); };
    return; }
  if(sel&&sel.t==='f'&&F(sel.id)){ const f=F(sel.id); const cs=conflicts.filter(c=>touches(c,f.id));
    const sums=Object.values(state.funcs).filter(x=>x.sum);
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
    <label>Souhrn (sbalená dlaždice)<select id="fParent" ${ro}><option value="">— samostatná dlaždice —</option>${sums.map(x=>`<option value="${x.id}" ${x.id===f.parent?'selected':''}>${esc(x.name)}</option>`).join('')}<option value="__new">+ nový souhrn…</option></select></label>
    <div class="lbl">Útvary organigramu</div>
    <div class="asg">${f.assign.map((a,i)=>`<div class="arow${U[a.unit]?'':' gone'}" data-i="${i}"><span title="${esc(U[a.unit]?unitPath(a.unit):'v organigramu už není')}">${esc(U[a.unit]?U[a.unit].name:(a.name||a.unit)+' ✕')}</span>
      <select ${ro}>${Object.entries(ROLES).map(([k,v])=>`<option value="${k}" ${k===a.role?'selected':''}>${v}</option>`).join('')}</select>${ROLE.org?'<button class="small" data-a="x">×</button>':''}</div>`).join('')||'<div class="muted">žádný útvar</div>'}</div>
    ${ROLE.org?`<div class="addasg"><select id="aUnit"><option value="">— vyberte útvar —</option>${unitOptions()}</select><select id="aRole">${Object.entries(ROLES).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select><button class="small" id="aAdd">Přidat</button></div>`:''}
    ${cs.length?`<div class="lbl">Rozpory</div>${cs.map(c=>`<div class="mini sev-${c.sev}${c.ignored?' ign':''}">${esc(c.text)}${c.ignored?' <i>(přijato)</i>':''}</div>`).join('')}`:''}
    <div class="lbl">Poznámky z diskuse</div><div class="notes">${f.notes.map((n,i)=>`<div class="note"><div class="muted">${esc(n.t)} · ${esc(n.who||'')}${ROLE.org?` <button class="small" data-n="${i}">×</button>`:''}</div>${esc(n.text)}</div>`).join('')||'<div class="muted">zatím nic</div>'}</div>
    ${ROLE.org?`<textarea id="nText" rows="2" placeholder="např. MMR navrhuje přesunout pod sekci…"></textarea><button class="small" id="nAdd">Přidat poznámku</button>`:''}
    ${linksBlock(f)}
    ${procLinks(f.id)}
    <div class="row" style="margin-top:14px">${ROLE.org?'<button id="fDel" style="color:var(--danger)">Smazat funkci</button>':''}<button id="fLinks">Vazby (${LINKS.filter(l=>l.from===f.id||l.to===f.id).length})</button></div>`;
    const ch=(fn,act)=>()=>{ fn(); save('funkce',act+': '+f.name); };
    $('#sClose').onclick=()=>{ sel=null; render(); };
    if(!ROLE.org){ $('#fLinks').onclick=()=>toast(LINKS.filter(l=>l.from===f.id||l.to===f.id).map(l=>(l.from===f.id?'→ '+F(l.to).name:'← '+F(l.from).name)).join('\n')||'Bez vazeb'); return; }
    $('#fName').onchange=e=>{ const o=f.name; f.name=e.target.value.trim()||o; save('funkce',`přejmenována: ${o} → ${f.name}`); };
    $('#fGroup').onchange=ch(()=>f.group=$('#fGroup').value,'oblast'); $('#fType').onchange=ch(()=>f.type=$('#fType').value,'typ');
    $('#fPeriod').onchange=ch(()=>f.period=$('#fPeriod').value,'období'); $('#fStatus').onchange=ch(()=>f.status=$('#fStatus').value,'stav '+STATUS[$('#fStatus').value]);
    $('#fRefs').onchange=ch(()=>f.refs=$('#fRefs').value.trim(),'rozhodnutí'); $('#fFte').onchange=ch(()=>f.fte=$('#fFte').value===''?null:Math.max(0,+$('#fFte').value),'FTE');
    $('#fDesc').onchange=ch(()=>f.desc=$('#fDesc').value,'popis');
    $('#fParent').onchange=e=>{ let v=e.target.value; const old=f.parent;
      if(v==='__new'){ const n=prompt('Název nového souhrnu (např. „Povolování vyhrazených staveb“):'); if(!n||!n.trim()){ e.target.value=f.parent||''; return; }
        const s2={id:uid('s'),sum:true,name:n.trim(),group:f.group,desc:'',status:'navrh',notes:[],assign:[],locs:[],period:'2027',type:f.type,x:old?F(old).x:f.x,y:old?F(old).y:f.y}; state.funcs[s2.id]=s2; v=s2.id; }
      if(v){ f.parent=v; f.group=F(v).group; f._lay=true; delete f.sx; } else { delete f.parent; const s0=F(old); f.x=(s0?s0.x:f.x)+30; f.y=(s0?s0.y:f.y)+120; }
      save('souhrn',f.name+(v?' → '+F(v).name:' → samostatná')); };
    s.querySelectorAll('.locs input').forEach(i=>i.onchange=ch(()=>f.locs=[...s.querySelectorAll('.locs input:checked')].map(x=>x.value),'lokality'));
    s.querySelectorAll('.arow[data-i]').forEach(r=>{ const a=f.assign[+r.dataset.i]; r.querySelector('select').onchange=e=>{ a.role=e.target.value; save('přiřazení',`${f.name}: ${a.name} → ${ROLES[a.role]}`); };
      r.querySelector('[data-a=x]').onclick=()=>{ f.assign.splice(+r.dataset.i,1); save('přiřazení',`${f.name}: odebrán ${a.name||a.unit}`); }; });
    $('#aAdd').onclick=()=>{ const u=$('#aUnit').value; if(!u) return; if(f.assign.some(a=>a.unit===u)){ toast('Útvar už je přiřazen.'); return; } f.assign.push({unit:u,role:$('#aRole').value,name:U[u].name}); save('přiřazení',`${f.name}: + ${U[u].name} (${ROLES[$('#aRole').value]})`); };
    $('#nAdd').onclick=()=>{ const t=$('#nText').value.trim(); if(!t) return; f.notes.push({t:today(),who:currentUser?currentUser.email:'',text:t}); save('poznámka',f.name+': '+t); };
    s.querySelectorAll('[data-n]').forEach(b=>b.onclick=()=>{ if(confirm('Smazat poznámku?')){ f.notes.splice(+b.dataset.n,1); save('poznámka','smazána: '+f.name); } });
    $('#fDel').onclick=()=>{ if(!confirm(`Smazat funkci „${f.name}“ včetně jejích vazeb?`)) return; delete state.funcs[f.id]; state.links=state.links.filter(l=>l.from!==f.id&&l.to!==f.id);
      state.rules.forEach(r=>{ r.a=(r.a||[]).filter(x=>x!==f.id); r.b=(r.b||[]).filter(x=>x!==f.id); }); sel=null; save('funkce','smazána: '+f.name); };
    $('#fLinks').onclick=()=>{ setView('map'); focusFunc(f.id); };
    return; }
  if(sel&&sel.t==='l'&&sel.ids&&sel.ids.length>1){ const ls=sel.ids.map(id=>LINKS.find(x=>x.id===id)).filter(Boolean);
    s.innerHTML=`<div class="sh"><span class="muted">Sloučená vazba (${ls.length})</span><button class="small" id="sClose">×</button></div><p class="muted" style="font-size:12px">Ve sbaleném zobrazení se sloučilo více vazeb stejného druhu. Podrobně je uvidíte po otevření souhrnu.</p>
    ${ls.map(l=>`<div class="arow"><span>${esc(F(l.from).name)} → ${esc(F(l.to).name)}<br><span class="muted">${esc(KIND(l.kind)[0])}${l.label?' – '+esc(l.label):''}${l.derived?' · z procesu':''}${l.planned?' · <b style="color:#7C3AED">k vytvoření</b>':''}</span>${l.procs&&l.procs.length?`<div class="row" style="margin-top:3px">${procButtons(l)}</div>`:''}</span><span></span>${ROLE.org&&!l.derived?`<button class="small" data-l="${l.id}">×</button>`:''}</div>`).join('')}`;
    $('#sClose').onclick=()=>{ sel=null; render(); }; s.querySelectorAll('[data-l]').forEach(b=>b.onclick=()=>delLink(b.dataset.l)); return; }
  if(sel&&sel.t==='l'){ const l=LINKS.find(x=>x.id===sel.id); if(l&&l.derived){ s.innerHTML=`<div class="sh"><span class="muted">Vazba z procesu</span><button class="small" id="sClose">×</button></div>
    <p><b>${esc(F(l.from).name)}</b><br>→ <b>${esc(F(l.to).name)}</b></p><p>${esc(KIND(l.kind)[0])}${l.label?' – '+esc(l.label):''}</p>
    <p class="muted" style="font-size:12px">Vazba vzniká z procesu; upravuje se změnou procesu.</p><div class="lbl">Procesy</div><div class="row">${procButtons(l)}</div>`;
    $('#sClose').onclick=()=>{ sel=null; render(); }; return; } }
  if(sel&&sel.t==='l'){ const l=LINKS.find(x=>x.id===sel.id); if(l){ s.innerHTML=`<div class="sh"><span class="muted">Vazba</span><button class="small" id="sClose">×</button></div>
    <p><b>${esc(F(l.from).name)}</b><br>→ <b>${esc(F(l.to).name)}</b></p><p>${esc(KIND(l.kind)[0])}${l.label?' – '+esc(l.label):''}</p>
    <label style="display:flex;gap:6px;align-items:flex-start;color:var(--ink);font-size:13px;margin:0 0 10px"><input type="checkbox" id="lExist" style="width:auto;margin-top:3px" ${l.planned?'':'checked'} ${ROLE.org&&!l.derived?'':'disabled'}> <span>existuje <span class="muted">(prostředky k jejímu naplnění už jsou)</span>${l.planned?'<br><b style="color:#7C3AED">⊕ vazbu je teprve potřeba vytvořit</b>':''}</span></label>
    ${l.procs&&l.procs.length?`<div class="lbl">Popsáno v procesech</div><div class="row" style="margin-bottom:10px">${procButtons(l)}</div>`:''}
    ${ROLE.org?'<div class="row"><button id="lEdit">Upravit</button><button id="lRev">Obrátit směr</button><button id="lDel" style="color:var(--danger)">Smazat</button></div>':''}`;
    $('#sClose').onclick=()=>{ sel=null; render(); };
    const lm=state.links.find(x=>x.id===l.id);
    if(ROLE.org&&lm){ const l=lm; $('#lExist').onchange=e=>{ if(e.target.checked) delete l.planned; else l.planned=true; save('vazba',(l.planned?'k vytvoření: ':'existuje: ')+F(l.from).name+' → '+F(l.to).name); }; $('#lEdit').onclick=()=>openLinkDlg(l); $('#lRev').onclick=()=>{ [l.from,l.to]=[l.to,l.from]; save('vazba','obrácena'); }; $('#lDel').onclick=()=>delLink(l.id); } return; } }
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
    ${ROLE.org?`<div class="addasg"><select id="uFunc"><option value="">— přidat funkci —</option>${state.groups.map(g=>`<optgroup label="${esc(g.name)}">${leaves().filter(f=>f.group===g.id&&!fs.includes(f)).map(f=>`<option value="${f.id}">${esc(f.name)}</option>`).join('')}</optgroup>`).join('')}</select><select id="uRole">${Object.entries(ROLES).map(([k,v])=>`<option value="${k}" ${k==='do'?'selected':''}>${v}</option>`).join('')}</select><button class="small" id="uAdd">Přidat</button></div>`:''}
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
    <div class="lbl">Dlaždice</div><div class="leg"><span><i class="b acti"></i>aktér okolí</span><span><i class="b sysi"></i>systém</span><span><span class="allu" style="position:static;margin:0">∀</span> průřezový systém</span><span><i class="b sumi"></i>souhrn funkcí</span><span><i class="b ok"></i>bez rozporu</span><span><i class="b warn"></i>varování</span><span><i class="b err"></i>chyba</span><span><i class="b p28"></i>výhled 2028</span></div>
    <div class="lbl">Útvar na dlaždici</div><div class="leg"><span class="uchip r-own">vlastník</span><span class="uchip more">+N útv.</span><span class="muted">ostatní útvary v panelu</span></div>
    <div class="lbl">Stav diskuse</div><div class="leg">${Object.entries(STATUS).map(([k,v])=>`<span><i style="background:${STATUS_COLOR[k]};border-radius:50%"></i>${v}</span>`).join('')}</div>
    <div class="lbl">Stav vazby</div><div class="leg col"><span><i style="height:0;width:22px;border:0;border-top:2px solid #5D6B7A;vertical-align:3px"></i>existuje</span><span><i style="height:0;width:22px;border:0;border-top:3px dotted #7C3AED;vertical-align:3px"></i>⊕ k vytvoření (tečkovaně)</span></div>
    <div class="lbl">Vazby ${ROLE.org?'<button class="small" id="kindsEdit" style="margin-left:6px">Upravit druhy…</button>':''}</div><div class="leg col">${Object.values(LINK_KINDS).map(([n,c,d])=>`<span><i style="height:0;width:18px;border:0;border-top:3px ${d?'dashed':'solid'} ${c};vertical-align:3px"></i>${esc(n)}</span>`).join('')}</div>
    <p class="muted" style="margin-top:16px">Klikněte na dlaždici – zvýrazní se její vazby a ostatní se ztlumí. Souhrn (dlaždice se stínem) otevřete dvojklikem nebo „Otevřít ▸“. Dlaždice se přesouvají tažením, vazbu vytvoříte tlačítkem „Spojit“. Esc = zrušit výběr / zavřít souhrn.</p>
    ${L.length?`<p><a href="#" id="toConf">${L.filter(c=>c.sev==='err').length} chyb a ${L.filter(c=>c.sev==='warn').length} varování →</a></p>`:'<p class="okc">Model je bez rozporů.</p>'}`;
  if($('#kindsEdit')) $('#kindsEdit').onclick=()=>openKindsDlg();
  if($('#toConf')) $('#toConf').onclick=e=>{ e.preventDefault(); setView('conf'); };
}
// seznam vazeb prvku + rychlé přidání vazby přímo z panelu
function linksBlock(f){ const ls=LINKS.filter(l=>l.from===f.id||l.to===f.id);
  const list=ls.map(l=>{ const o=F(l.from===f.id?l.to:l.from); return `<div class="arow kid"><a href="#" data-o="${o?o.id:''}">${l.from===f.id?'→':'←'} ${esc(o?o.name:'?')}</a><span class="muted" style="font-size:11px">${esc(KIND(l.kind)[0])}${l.derived?' · z procesu':l.procs&&l.procs.length?' · i v procesu':''}${l.planned?' · <b style="color:#7C3AED">k vytvoření</b>':''}</span></div>`; }).join('')||'<div class="muted">žádné</div>';
  const og=(lbl,xs)=>xs.length?`<optgroup label="${lbl}">${xs.map(x=>`<option value="${x.id}">${x.sum?'▣ ':''}${esc(x.name)}</option>`).join('')}</optgroup>`:'';
  const all=Object.values(state.funcs).filter(x=>x.id!==f.id);
  const opts=og('Systémy',all.filter(x=>x.kind==='system'))+og('Aktéři',all.filter(x=>x.kind==='actor'))+og('Funkce',all.filter(x=>!x.kind));
  const def=f.kind==='system'?'data':(f.kind==='actor'?'zada':'pouziva');
  const cross=!f.kind?envEls('system').filter(s=>s.allUsers&&s.period!=='2028'):[];
  const crossHtml=cross.length?`<div class="muted" style="font-size:12px;margin-top:4px">Průřezové systémy (všichni zaměstnanci): ${cross.map(s=>`<a href="#" data-o="${s.id}">${esc(s.name)}</a>${s.allUse?' – '+esc(s.allUse):''}`).join('; ')}</div>`:'';
  return `<div class="lbl">Vazby (${ls.length})</div>${list}${crossHtml}${ROLE.org?`<div class="ladd" data-f="${f.id}"><div class="lr"><select class="laDir" title="směr"><option value="out">→ k</option><option value="in">← od</option></select><select class="laEl"><option value="">— vyberte prvek —</option>${opts}</select></div>
    <div class="lr"><select class="laKind">${Object.entries(LINK_KINDS).map(([k,[n]])=>`<option value="${k}" ${k===def?'selected':''}>${esc(n)}</option>`).join('')}</select><input type="text" class="laLbl" placeholder="popisek (nepovinný)"><button class="small laAdd">Přidat vazbu</button></div><label class="lr" style="font-size:12px;color:var(--ink);margin:0"><input type="checkbox" class="laPlan" style="width:auto"> vazbu je teprve potřeba vytvořit</label></div>`:''}`; }
document.addEventListener('click',e=>{ const b=e.target.closest('.ladd .laAdd'); if(!b) return; const box=b.closest('.ladd'); const f=F(box.dataset.f); const t=box.querySelector('.laEl').value; if(!f||!t) { toast('Vyberte prvek, ke kterému vazba vede.'); return; }
  const out=box.querySelector('.laDir').value==='out', kind=box.querySelector('.laKind').value, label=box.querySelector('.laLbl').value.trim(); const from=out?f.id:t, to=out?t:f.id;
  if(state.links.some(l=>l.from===from&&l.to===to&&l.kind===kind)){ toast('Taková vazba už existuje.'); return; }
  const nl={id:uid('l'),from,to,kind,label}; if(box.querySelector('.laPlan').checked) nl.planned=true; state.links.push(nl); save('vazba',`nová${nl.planned?' (k vytvoření)':''}: ${F(from).name} → ${F(to).name} (${KIND(kind)[0]})`); toast('Vazba přidána.'); });
document.addEventListener('click',e=>{ const a=e.target.closest('#side a[data-o]'); if(!a||!a.dataset.o) return; e.preventDefault(); sel={t:'f',id:a.dataset.o}; render(); focusFunc(a.dataset.o); });
function procLinks(id){ const ps=procsOf(id); return ps.length?`<div class="lbl">V procesech</div>${ps.map(p=>`<div><a href="#" class="plink" data-p="${p.id}">${esc(p.name)}</a></div>`).join('')}`:''; }
document.addEventListener('click',e=>{ const a=e.target.closest('a.plink'); if(!a) return; e.preventDefault(); state.proc=a.dataset.p; procSel=null; setView('proc'); });
function focusFunc(id){ const f=F(id); if(f&&f.parent&&drill!==f.parent){ drill=f.parent; render(); } else if(f&&!f.parent&&drill&&drill!==id){ drill=null; render(); } setTimeout(()=>{ const b=document.querySelector(`.fbox[data-fid="${id}"]`); if(b){ b.scrollIntoView({block:'center',inline:'center'}); b.classList.add('flash'); setTimeout(()=>b.classList.remove('flash'),1500); } },60); }
function addEl(kind){ const n=prompt(kind==='actor'?'Název aktéra (např. „Správci technické infrastruktury“):':'Název systému:'); if(!n||!n.trim()) return;
  const xs=envEls(kind); const x=xs.length?Math.max(...xs.map(f=>f.x))+AW+40:30, y=xs.length?Math.min(...xs.map(f=>f.y)):50;
  const f={id:uid(kind==='actor'?'a':'y'),kind,name:n.trim(),period:'2027',desc:'',status:'navrh',notes:[],assign:[],locs:[],x,y};
  if(kind==='actor'){ f.cat='jiny'; f.channels=[]; state.showActors=true; } else { f.stype='agenda'; f.sstate='stav'; f.admin=''; state.showSystems=true; }
  state.funcs[f.id]=f; drill=null; sel={t:'f',id:f.id}; save(kind==='actor'?'aktér':'systém','nový: '+f.name); if(state.view!=='map') setView('map'); focusFunc(f.id); }
function addFunc(gid){ const n=prompt('Název nové funkce:'); if(!n||!n.trim()) return; const g=gid||(state.groups[0]&&state.groups[0].id);
  const D=drill&&F(drill); const ms=Object.values(state.funcs).filter(f=>f.group===g&&!f.parent); const x=ms.length?Math.min(...ms.map(f=>f.x)):40, y=ms.length?Math.max(...ms.map(f=>f.y))+110:60;
  const f={id:uid('f'),name:n.trim(),group:D?D.group:g,type:'vykon',period:'2027',refs:'',desc:'',fte:null,locs:[],status:'navrh',notes:[],assign:[],x,y};
  if(D){ f.parent=D.id; const ks=kidsOf(D.id); f.sx=ks.length?Math.min(...ks.map(k=>k.sx||380)):380; f.sy=ks.length?Math.max(...ks.map(k=>k.sy||70))+110:70; }
  state.funcs[f.id]=f; sel={t:'f',id:f.id}; save('funkce','nová: '+f.name); if(state.view!=='map') setView('map'); focusFunc(f.id); }

// ---------- export, json, historie, prezentace ----------
function exportXlsx(){ const wb=XLSX.utils.book_new(); const gn=id=>(state.groups.find(g=>g.id===id)||{}).name||'';
  const us=(f,r)=>f.assign.filter(a=>a.role===r).map(a=>U[a.unit]?U[a.unit].name:(a.name||a.unit)+' (zrušen)').join('; ');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(leaves().map(f=>({'Oblast':gn(f.group),'Souhrn':f.parent&&F(f.parent)?F(f.parent).name:'','Funkce':f.name,'Typ':TYPES[f.type],'Platí od':f.period==='2028'?'2028':'1. 1. 2027','Stav diskuse':STATUS[f.status],'Rozhodnutí TOM':f.refs,'Potřeba FTE':f.fte??'','Lokality':f.locs.map(l=>LOC[l]).join(', '),'Vlastník':us(f,'own'),'Vykonává':us(f,'do'),'Podporuje':us(f,'sup'),'Popis':f.desc,'Poznámky':f.notes.map(n=>n.t+' '+n.text).join(' | ')}))),'Funkce');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(envEls('actor').map(x=>({'Aktér':x.name,'Kategorie':ACAT[x.cat]||'','Kanály':(x.channels||[]).map(c=>CHANNELS[c]||c).join(', '),'Platí od':x.period==='2028'?'2028':'1. 1. 2027','Popis':x.desc||''})).concat(envEls('actor').length?[]:[{'Aktér':''}])),'Vnější okolí');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(envEls('system').map(x=>({'Systém':x.name,'Typ':STYPE[x.stype]||'','Stav':SSTATE[x.sstate]||'','Správce / dodavatel':x.admin||'','Používají všichni':x.allUsers?('ano'+(x.allUse?' – '+x.allUse:'')):'','Spravuje (funkce)':state.links.filter(l=>l.to===x.id&&l.kind==='spravuje').map(l=>(F(l.from)||{}).name).join('; '),'Používají':state.links.filter(l=>l.to===x.id&&l.kind==='pouziva').map(l=>(F(l.from)||{}).name).join('; '),'Popis':x.desc||''})).concat(envEls('system').length?[]:[{'Systém':''}])),'Systémy');
  const prow=[]; (state.processes||[]).forEach(p=>p.steps.slice().sort((x,y)=>x.row-y.row).forEach(s=>{ const l=p.lanes.find(x=>x.id===s.lane); prow.push({'Proces':p.name,'Pořadí':s.row+1,'Krok':s.name,'Kdo':l&&laneInfo(l)?laneInfo(l).name:'','Druh':STEP_KINDS[s.kind],'Systém':s.sys&&F(s.sys)?F(s.sys).name:'','Kanál':s.ch?CHANNELS[s.ch]:'','Pokračuje do':p.flows.filter(w=>w.from===s.id).map(w=>{ const t=p.steps.find(x=>x.id===w.to); return (t?t.name:'?')+(w.label?' ('+w.label+')':''); }).join('; '),'K ověření':s.note||''}); }));
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(prow.length?prow:[{'Proces':''}]),'Procesy');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet((state.roles||[]).map(r=>({'Role':r.name,'Funkce':r.func&&F(r.func)?F(r.func).name:'','Útvar (vlastník funkce)':r.func&&F(r.func)?(F(r.func).sum?(sumOwner(F(r.func))?U[sumOwner(F(r.func))].name:''):F(r.func).assign.filter(x=>x.role==='own'&&U[x.unit]).map(x=>U[x.unit].name).join('; ')):''})).concat((state.roles||[]).length?[]:[{'Role':''}])),'Role');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(LINKS.map(l=>({'Od':(F(l.from)||{}).name,'Vazba':KIND(l.kind)[0],'K':(F(l.to)||{}).name,'Popisek':l.label,'Stav':l.planned?'k vytvoření':'existuje','Zdroj':l.derived?'proces':'ručně','Procesy':(l.procs||[]).map(r=>((state.processes||[]).find(p=>p.id===r.p)||{}).name).join('; ')})).concat(LINKS.length?[]:[{'Od':''}])),'Vazby');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(conflicts.map(c=>({'Závažnost':SEV[c.sev],'Rozpor':c.text,'Přijato':c.ignored?state.ignored[c.key].why:''})).concat(conflicts.length?[]:[{'Rozpor':'bez rozporů'}])),'Rozpory');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(orgOrder().map(([id,d])=>{ const fs=Object.values(state.funcs).filter(f=>f.assign.some(a=>a.unit===id)); const c=unitCap(id);
    return {'Útvar':'  '.repeat(d)+U[id].name,'Míst':c.n,'Obsazeno':c.f,'Funkce (vlastník)':fs.filter(f=>f.assign.find(a=>a.unit===id).role==='own').map(f=>f.name).join('; '),'Funkce (vykonává / podporuje)':fs.filter(f=>f.assign.find(a=>a.unit===id).role!=='own').map(f=>f.name).join('; ')}; })),'Útvary');
  exportKraj(wb,XLSX); XLSX.writeFile(wb,`TOM_kraj_${today()}.xlsx`); }
function present(on){ document.body.classList.toggle('presenting',on); if(on){ sel=null; procSel=null; setConnect(false); setPConnect(false); if(state.view!=='map'&&state.view!=='proc') state.view='map'; } render(); }
function toast(m){ const t=$('#toast'); t.textContent=m; t.classList.add('show'); clearTimeout(toast.t); toast.t=setTimeout(()=>t.classList.remove('show'),3500); }
window.addEventListener('error',e=>toast('Chyba: '+(e.message||'?')));

function wire(){
  $$('.viewsw button').forEach(b=>b.onclick=()=>setView(b.dataset.v));
  $('#btnUndo').onclick=undo; $('#btnRedo').onclick=redo;
  $('#btnAddF').onclick=()=>addFunc(sel&&sel.t==='g'?sel.id:(sel&&sel.t==='f'?F(sel.id).group:null));
  $('#btnAddG').onclick=()=>{ const n=prompt('Název nové oblasti:'); if(!n||!n.trim()) return; const g={id:uid('g'),name:n.trim(),color:PALETTE[state.groups.length%PALETTE.length]}; state.groups.push(g); sel={t:'g',id:g.id}; save('oblast','nová: '+g.name); toast('Oblast vytvořena – přidejte do ní funkci.'); };
  $('#crumbBack').onclick=closeSum; wireProc();
  $('#btnAddA').onclick=()=>addEl('actor'); $('#btnAddS').onclick=()=>addEl('system');
  $('#showA').onchange=e=>{ state.showActors=e.target.checked; persist(); render(); };
  $('#showI').onchange=e=>{ state.showInternal=e.target.checked; persist(); render(); };
  $('#showLS').onchange=e=>{ state.showSysLinks=e.target.checked; if(e.target.checked) state.showSystems=true; persist(); render(); };
  $('#showEx').onchange=e=>{ state.showExisting=e.target.checked; persist(); render(); };
  $('#showPl').onchange=e=>{ state.showPlanned=e.target.checked; persist(); render(); };
  $('#showLE').onchange=e=>{ state.showEnvLinks=e.target.checked; if(e.target.checked) state.showActors=true; persist(); render(); }; $('#showS').onchange=e=>{ state.showSystems=e.target.checked; persist(); render(); };
  $('#btnConnect').onclick=()=>setConnect(!document.body.classList.contains('connecting'));
  $('#btnLayout').onclick=()=>{ if(drill){ kidsOf(drill).forEach(k=>k._lay=true); renderMap(); save('mapa','přeskládán souhrn'); return; } if(confirm('Rozmístit všechny funkce znovu podle oblastí? (Lze vrátit tlačítkem Zpět.)')){ autoLayout(state); save('mapa','automatické rozmístění'); } };
  $('#show2028').onchange=e=>{ state.show2028=e.target.checked; persist(); render(); };
  $('#colorBy').onchange=e=>{ state.colorBy=e.target.value; persist(); render(); };
  $('#zoom').oninput=e=>{ zoom=+e.target.value/100; $('#zoomVal').textContent=e.target.value+' %'; $('#canvas').style.transform=`scale(${zoom})`; };
  $('#canvasWrap').addEventListener('pointerdown',e=>{ if(e.target.closest('.fbox,.lk,.gl')) return; if(sel){ sel=null; render(); } });
  $('#btnXlsx').onclick=exportXlsx;
  $('#btnSave').onclick=()=>{ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,1)],{type:'application/json'})); a.download=`TOM_kraj_${today()}.json`; a.click(); };
  $('#btnLoad').onclick=()=>$('#fileJson').click();
  $('#fileJson').onchange=async e=>{ const f=e.target.files[0]; if(!f) return; e.target.value='';
    try{ const s=JSON.parse(await f.text()); if(s.app!==APP_ID||!s.funcs) throw new Error('soubor není uložený model TOM kraje'); state=s; normalize(); sel=null; save('načtení','model nahrazen ze souboru '+f.name); toast('Model načten.'); }catch(err){ alert('Soubor se nepodařilo načíst: '+err.message); } };
  $('#btnLog').onclick=async()=>{ $('#logBody').innerHTML='Načítám…'; $('#dlgLog').showModal();
    const {data,error}=await sb.from('organigram_log').select('created_at,user_email,action,detail').eq('app',APP_ID).order('created_at',{ascending:false}).limit(300);
    $('#logBody').innerHTML=error?'Historii se nepodařilo načíst: '+esc(error.message):(data.length?data.map(l=>`<div><time>${new Date(l.created_at).toLocaleString('cs-CZ')}</time><span><b>${esc(l.action)}</b> ${esc(l.detail||'')} <span class="muted">· ${esc(l.user_email||'')}</span></span></div>`).join(''):'Zatím žádné změny.'); };
  $('#logClose').onclick=()=>$('#dlgLog').close();
  $('#btnPresent').onclick=()=>present(true); $('#presExit').onclick=()=>present(false);
}

// ---------- přihlášení a start ----------
async function boot(){
  $('#ver').textContent='verze '+APP_VERSION; console.log('TOM kraj app.js',APP_VERSION); wire(); wireKraj();
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
  sb.channel('tom-kraj').on('postgres_changes',{event:'UPDATE',schema:'public',table:'organigram_state',filter:'id=eq.'+STATE_ID},p=>{
    if(p.new&&p.new.version>version&&!dirty&&!saving){ const v=state.view; state=p.new.data; version=p.new.version; normalize(); state.view=v; markBaseline(); render(); toast('Model aktualizován z jiného okna.'); } }).subscribe();
  sb.channel('tom-kraj-org').on('postgres_changes',{event:'UPDATE',schema:'public',table:'organigram_state',filter:'id=eq.'+ORG_ID},p=>{
    if(p.new&&p.new.data){ setOrg(p.new.data); render(); toast('Krajský organigram se změnil – rozpory a posouzení přepočítány.'); } }).subscribe();
  window.addEventListener('beforeunload',e=>{ if(dirty||saving){ flush(); e.preventDefault(); e.returnValue=''; } });
}
boot();
