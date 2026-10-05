// TOM krajského ÚRÚ – pracoviště, scénáře Dne 1 a posouzení provozuschopnosti. Používá globální stav a pomocné funkce z app.js.
// state.kraj = { sites:{kod:{...stav dnes}}, scenarios:[{id,name,desc,doAis,cAis,cInst,eszEnforced,sites:{kod:{ais,inst,ss}}}], active, params, selSite }
const AIS_OPT=['VITA','VERA','ISSŘ','žádný'];   // stav dnes
const AIS_SC=['VITA','ISSŘ','žádný'];            // cílový stav ve scénářích – s provozem VERA se nepočítá (VITA data z VERA převezme)
const toTarget=a=>a==='VERA'?'VITA':a;
const INST={local:'u obce (lokální)',central:'krajská (centrální)',national:'celostátní'};
const SS_URU='Spisová služba ÚRÚ';
const pn=n=>`${n} ${n===1?'pracoviště':(n>=2&&n<=4)?'pracoviště':'pracovišť'}`;   // skloňování
const ST_LBL={ok:'v pořádku',warn:'podmínka',warnH:'náročná podmínka',fail:'překážka',info:'informace'};
const VERDICT={ok:['provozovatelné','#067647'],warn:['provozovatelné s podmínkami','#B54708'],warnH:['provozovatelné s náročnými podmínkami','#C4320A'],fail:['neprovozovatelné','#B42318']};
const stOf=c=>c.status==='warn'&&c.heavy?'warnH':c.status;   // zobrazovaný stupeň kontroly
const DEF_PARAMS={maxUsers:{VITA:300,'ISSŘ':100000},provenVITA:150,issrAno:100,issrPart:40,aisWarn:2,aisFail:3,moveFail:50,doFail:34,eszOk:80,eszFail:50};

// ---------- výchozí data ----------
function seedKraj(st){ const K=window.TOM_KRAJ||{sites:[]}; const sites={};
  K.sites.forEach(s=>sites[s.kod]={kod:s.kod,name:s.name,ais:s.ais||'žádný',ss:s.ss||'neuvedeno',issr:s.issr||'Ne',agenda:s.agenda||0,spisy:s.spisy||0,archiv:s.archiv||0,riziko:s.riziko||'',dnes:s.dnes||0,potreba:s.potreba||0,su:s.su||1,suList:s.suList||'',nAis:s.nAis??null,nSs:s.nSs??null,mistaAll:s.mistaAll??null,mistaKot:s.mistaKot??null,spisySu:s.spisySu??null,swSu:s.swSu??null,archSu:s.archSu??null});
  const sc=(id,name,desc,fn,extra)=>{ const o={id,name,desc,doAis:'VITA',cAis:'VITA',cInst:'central',eszEnforced:false,sites:{},...(extra||{})}; Object.values(sites).forEach(s=>o.sites[s.kod]=fn(s)); return o; };
  st.kraj={sites,noVera:true,issrSs:true,vitaV2:true,sc6:true,srcV:true,issrV2:true,xV:true,stayV:true,runV:true,active:'sc1',params:JSON.parse(JSON.stringify(DEF_PARAMS)),scenarios:[
    sc('sc1','Den 1: instance VITA u obcí','Každé pracoviště zůstává na své instanci u obce a na spisové službě obce; VERA převedena do VITA.',s=>({ais:toTarget(s.ais),inst:s.ais==='ISSŘ'?'national':'local',ss:s.ss})),
    sc('sc2','Jedna spisová služba ÚRÚ, instance VITA u obcí','Ke Dni 1 jediná centrální spisová služba ÚRÚ; VITA zůstává na instancích u obcí (VERA převedena).',s=>({ais:toTarget(s.ais),inst:s.ais==='ISSŘ'?'national':'local',ss:SS_URU})),
    sc('sc4','Vše na krajskou instanci VITA','Všechna pracoviště na jedné krajské instanci VITA (VERA převedena, data převezme VITA); veškerá evidence v ESPIS/VITA, ISSŘ jen jako komunikační brána pro dokumenty z Portálu a přístup k dokumentaci. Rozpracovaná řízení z ISSŘ v něm doběhnou.',s=>({ais:'VITA',inst:'central',ss:SS_URU}),{eszEnforced:true,issrRunOff:true}),
    sc('sc6','Kombinace: krajská VITA + ISSŘ','V ISSŘ pokračují pracoviště, která v něm dnes plně pracují (podle tabulky ORP „ISSŘ: Ano“); ostatní – dnes v obecních VITA a VERA – přecházejí na krajskou instanci VITA. Rozdělení lze upravit u každého pracoviště. Spojuje nevýhody obou cílových scénářů; klíčové je sdílení a předávání mezi VITA a ISSŘ (DO, přesun věcí).',s=>(s.issr==='Ano'?{ais:'ISSŘ',inst:'national',ss:SS_URU}:{ais:'VITA',inst:'central',ss:SS_URU}),{eszEnforced:true,issrStay:true}),
    sc('sc5','Vše do ISSŘ','Všechna pracoviště i centrála pracují v ISSŘ. ISSŘ dnes nemá funkcionalitu integrovaných DO, není napojené na spisovou službu a jako agendový systém nedosahuje funkčnosti VITA.',s=>({ais:'ISSŘ',inst:'national',ss:SS_URU}),{doAis:'ISSŘ',cAis:'ISSŘ',cInst:'national',eszEnforced:true})]}; }
function normKraj(){ if(!state.kraj||!state.kraj.sites) seedKraj(state); const k=state.kraj; if(!k.noVera) dropVera(state); if(!k.issrSs) issrSsUpdate(state); if(!k.vitaV2) vitaV2Update(state); if(!k.sc6) addSc6(state); if(!k.srcV) addSrcData(state); if(!k.runV){ k.runV=true; const s4=k.scenarios.find(x=>x.id==='sc4'); if(s4&&s4.issrRunOff===undefined){ s4.issrRunOff=true; if(s4.desc&&!/doběhnou/.test(s4.desc)) s4.desc+=' Rozpracovaná řízení z ISSŘ v něm doběhnou.'; if(typeof logChange==='function') logChange('scénář','Vše na krajskou VITA: rozpracovaná řízení doběhnou v ISSŘ'); } } if(!k.stayV){ k.stayV=true; const s6=k.scenarios.find(x=>x.id==='sc6'); if(s6&&s6.issrStay===undefined) s6.issrStay=true; } if(!k.xV){ k.xV=true; const s6=k.scenarios.find(x=>x.id==='sc6'); if(s6&&s6.desc==='V ISSŘ pokračují pracoviště, která v něm dnes plně pracují (podle tabulky ORP „ISSŘ: Ano“); ostatní – dnes v obecních VITA a VERA – přecházejí na krajskou instanci VITA. Rozdělení lze upravit u každého pracoviště.') s6.desc='V ISSŘ pokračují pracoviště, která v něm dnes plně pracují (podle tabulky ORP „ISSŘ: Ano“); ostatní – dnes v obecních VITA a VERA – přecházejí na krajskou instanci VITA. Rozdělení lze upravit u každého pracoviště. Spojuje nevýhody obou cílových scénářů; klíčové je sdílení a předávání mezi VITA a ISSŘ (DO, přesun věcí).'; addProcP4(state); } if(!k.issrV2){ k.issrV2=true; const s5=k.scenarios.find(x=>x.id==='sc5'); if(s5&&/koordinace DO v ISSŘ \(k ověření\)/.test(s5.desc||'')) s5.desc='Všechna pracoviště i centrála pracují v ISSŘ. ISSŘ dnes nemá funkcionalitu integrovaných DO, není napojené na spisovou službu a jako agendový systém nedosahuje funkčnosti VITA.'; } k.params=Object.assign(JSON.parse(JSON.stringify(DEF_PARAMS)),k.params||{}); k.params.maxUsers=Object.assign({},DEF_PARAMS.maxUsers,k.params.maxUsers||{});
  if(!k.scenarios.some(s=>s.id===k.active)) k.active=k.scenarios[0]&&k.scenarios[0].id; }
// s provozem VERA se nepočítá: scénáře VERA→VITA, systém VERA z modelu pryč (jen jednou)
function dropVera(st){ const k=st.kraj; k.noVera=true;
  k.scenarios=k.scenarios.filter(x=>!(x.id==='sc3'&&/VERA dobíhá/.test(x.name)));
  k.scenarios.forEach(x=>{ Object.values(x.sites).forEach(g=>{ if(g.ais==='VERA') g.ais='VITA'; }); if(x.doAis==='VERA') x.doAis='VITA'; if(x.cAis==='VERA') x.cAis='VITA';
    if(x.id==='sc1'&&x.name==='Den 1 bez změn (jak je)'){ x.name='Den 1: instance VITA u obcí'; x.desc='Každé pracoviště zůstává na své instanci u obce a na spisové službě obce; VERA převedena do VITA.'; }
    if(x.id==='sc2'&&x.name==='Jedna spisová služba ÚRÚ, AIS dobíhají u obcí'){ x.name='Jedna spisová služba ÚRÚ, instance VITA u obcí'; x.desc='Ke Dni 1 jediná centrální spisová služba ÚRÚ; VITA zůstává na instancích u obcí (VERA převedena).'; } });
  if(!k.scenarios.some(x=>x.id===k.active)) k.active=k.scenarios[0].id; if(k.params&&k.params.maxUsers) delete k.params.maxUsers.VERA;
  const v=st.funcs&&st.funcs.y5; if(v&&v.kind==='system'&&/^VERA$/.test(v.name)){ delete st.funcs.y5; st.links=(st.links||[]).filter(l=>l.from!=='y5'&&l.to!=='y5');
    (st.processes||[]).forEach(p=>{ p.lanes.forEach(l=>{ if(l.ref==='y5') l.ref='y4'; }); p.steps.forEach(s=>{ if(s.sys==='y5') s.sys='y4'; }); });
    st.links.forEach(l=>{ if(l.from==='k01'&&l.to==='y4'&&/pracovišť/.test(l.label||'')) l.label='všechna pracoviště (VERA převedena do VITA)'; }); }
  if(typeof logChange==='function') logChange('model','s provozem VERA se nepočítá – scénáře převedeny na VITA'); }
// ISSŘ není napojené na spisovou službu (jen jednou doplnit do uloženého modelu)
function issrSsUpdate(st){ st.kraj.issrSs=true; const y=st.funcs&&st.funcs.y2; if(!y) return;
  if(!y.desc) y.desc='Není napojené na spisovou službu – vlastní evidence (ESZ a správa dokumentací = ořezaný GINIS), samo přiděluje spisové značky a č. j.';
  if(st.funcs.y6&&!st.links.some(l=>l.from==='y6'&&l.to==='y2')) st.links.push({id:uid('l'),from:'y6',to:'y2',kind:'data',label:'integrace eSSL → ISSŘ (předávání podání)',planned:true});
  const sp=(window.TOM_SEED.processes||[]).find(p=>p.id==='p3'); if(sp&&!(st.processes||[]).some(p=>p.id==='p3')&&st.roles.some(r=>r.id==='r_pod')&&st.roles.some(r=>r.id==='r_rup')){ const tmp={funcs:st.funcs,roles:st.roles}; tmp.processes=null; const S=window.TOM_SEED; const save=S.processes; S.processes=[sp]; seedProcesses(tmp); S.processes=save; (tmp.processes||[]).forEach(p=>st.processes.push(p)); }
  if(typeof logChange==='function') logChange('model','ISSŘ: chybějící napojení na spisovou službu (kontrola, plánovaná integrace, proces)'); }
// zkušenosti s VITA (Brno ~150, DESÚ ~90 uživatelů; dle dodavatele 250–300 reálné) a stav vývoje – jen jednou
function vitaV2Update(st){ const k=st.kraj; k.vitaV2=true; k.params=k.params||{}; k.params.maxUsers=k.params.maxUsers||{}; if(!k.params.maxUsers.VITA||k.params.maxUsers.VITA===150) k.params.maxUsers.VITA=300; if(!k.params.provenVITA) k.params.provenVITA=150;
  const s4=k.scenarios.find(x=>x.id==='sc4'); if(s4&&/^Všechna pracoviště na jedné krajské instanci VITA/.test(s4.desc||'')) s4.desc='Všechna pracoviště na jedné krajské instanci VITA (VERA převedena, data převezme VITA); veškerá evidence v ESPIS/VITA, ISSŘ jen jako komunikační brána pro dokumenty z Portálu a přístup k dokumentaci. Rozpracovaná řízení z ISSŘ v něm doběhnou.';
  if(typeof logChange==='function') logChange('parametry posouzení','VITA: ověřeno ~150 uživatelů, reálné 250–300; vývoj integrace DO a předávání spisů ve VITA'); }
// doplnění scénáře kombinace krajská VITA + ISSŘ do uloženého modelu (jen jednou)
function addSc6(st){ const k=st.kraj; k.sc6=true; if(k.scenarios.some(x=>x.id==='sc6')) return;
  const sites={}; Object.values(k.sites).forEach(s=>sites[s.kod]=s.issr==='Ano'?{ais:'ISSŘ',inst:'national',ss:SS_URU}:{ais:'VITA',inst:'central',ss:SS_URU});
  const x={id:'sc6',name:'Kombinace: krajská VITA + ISSŘ',desc:'V ISSŘ pokračují pracoviště, která v něm dnes plně pracují (podle tabulky ORP „ISSŘ: Ano“); ostatní – dnes v obecních VITA a VERA – přecházejí na krajskou instanci VITA. Rozdělení lze upravit u každého pracoviště. Spojuje nevýhody obou cílových scénářů; klíčové je sdílení a předávání mezi VITA a ISSŘ (DO, přesun věcí).',doAis:'VITA',cAis:'VITA',cInst:'central',eszEnforced:true,issrStay:true,sites};
  const i=k.scenarios.findIndex(s=>s.id==='sc5'); if(i>=0) k.scenarios.splice(i,0,x); else k.scenarios.push(x);
  if(typeof logChange==='function') logChange('scénář','nový: '+x.name); }
// údaje o slučovaných (zrušených) stavebních úřadech z tabulky ORP – doplnit do uloženého modelu (jen jednou)
function addSrcData(st){ const k=st.kraj; k.srcV=true; const T={}; ((window.TOM_KRAJ||{}).sites||[]).forEach(s=>T[s.kod]=s);
  Object.values(k.sites).forEach(x=>{ const s=T[x.kod]; if(!s) return; ['su','suList','nAis','nSs','mistaAll','mistaKot','spisySu','swSu','archSu'].forEach(f=>{ if(x[f]===undefined) x[f]=s[f]??null; }); }); }
// proces DO pro řízení vedené v ISSŘ (doplnit do uloženého modelu)
function addProcP4(st){ const sp=(window.TOM_SEED.processes||[]).find(p=>p.id==='p4'); if(!sp||(st.processes||[]).some(p=>p.id==='p4')) return;
  if(!['r_rup','r_kdo','r_ido'].every(id=>(st.roles||[]).some(r=>r.id===id))) return;
  const S=window.TOM_SEED, keep=S.processes; S.processes=[sp]; const tmp={funcs:st.funcs,roles:st.roles,processes:null}; seedProcesses(tmp); S.processes=keep; (tmp.processes||[]).forEach(p=>st.processes.push(p)); }
// odhad podílu řízení vedených v ISSŘ (tabulka ORP ISSŘ mezi agendové systémy nepočítá; celostátně cca 30 %)
function issrShare(s){ if(s.issrPct!=null&&s.issrPct!=='') return Math.max(0,Math.min(100,+s.issrPct)); const P=state.kraj.params; return s.issr==='Ano'?P.issrAno:s.issr==='Částečně'?P.issrPart:0; }
const curSc=()=>{ normKraj(); return state.kraj.scenarios.find(s=>s.id===state.kraj.active); };

// ---------- uživatelé z krajského organigramu ----------
function siteUnit(kod){ return org.units.find(u=>u.orp&&u.orp.kod==kod); }
function siteUsers(s){ const u=siteUnit(s.kod); return u?u.positions.length:Math.ceil(Math.max(s.dnes,s.potreba)); }
function subtreeUsers(name){ const u=org.units.find(x=>x.name===name); if(!u) return 0; return subtree(u.id).reduce((a,id)=>a+((U[id].positions||[]).length),0); }

// ---------- posouzení scénáře ----------
function assess(sc){ const K=state.kraj, P=K.params; const S=Object.values(K.sites); const out=[];
  const add=(id,name,status,text,cond,heavy)=>out.push({id,name,status,text,cond:cond||'',heavy:!!heavy});
  const cfg=s=>sc.sites[s.kod]||{ais:s.ais,inst:'local',ss:s.ss};
  const totalAg=S.reduce((a,s)=>a+(s.agenda||0),0)||1; const pct=x=>Math.round(x*100);
  // 1 počet agendových systémů
  const none=S.filter(s=>cfg(s).ais==='žádný');
  const aisSet=new Set(S.map(s=>cfg(s).ais).filter(a=>a!=='žádný')); aisSet.add(sc.cAis);
  if(none.length) add('ais','Agendové systémy','fail',`${pn(none.length)} nemá agendový systém (${none.map(s=>s.name).join(', ')}).`,'Přidělit pracovištím bez systému agendový systém (např. ISSŘ).');
  else add('ais','Agendové systémy',aisSet.size>=P.aisFail?'fail':aisSet.size>=P.aisWarn?'warn':'ok',(aisSet.size===1?`V kraji se pracuje v jednom agendovém systému: ${[...aisSet][0]}.`:`V kraji se pracuje v ${aisSet.size} agendových systémech: ${[...aisSet].join(', ')}.`),aisSet.size>=P.aisWarn?'Obousměrná integrace mezi systémy a jednotný index řízení kraje.':'');
  // 2 přesun věci mezi pracovišti
  const key=s=>{ const c=cfg(s); return c.inst==='local'?c.ais+'#'+s.kod:c.ais+'#'+c.inst; };
  let pairs=0, manual=0, cross=0; for(let i=0;i<S.length;i++) for(let j=i+1;j<S.length;j++){ pairs++; if(key(S[i])!==key(S[j])){ manual++; if(cfg(S[i]).ais!==cfg(S[j]).ais) cross++; } }
  const mp=pairs?manual/pairs*100:0;
  const sharedVita=S.filter(s=>cfg(s).ais==='VITA'&&cfg(s).inst==='central').length>1;
  if(cross&&!sc.xInt) add('move','Přesun věci mezi pracovišti','fail',`${cross} z ${pairs} dvojic pracovišť má jiný agendový systém (${[...new Set(S.map(s=>cfg(s).ais))].join(' × ')}) – mezi systémy neexistuje předávání věcí; přesun = ruční převod spisu i stavu řízení a dvojí evidence.`,'Obousměrná integrace VITA ↔ ISSŘ pro předávání věcí, nebo všechna pracoviště v jednom systému.'); else   if(!mp&&sharedVita&&!sc.vitaMove) add('move','Přesun věci mezi pracovišti','warn','Pracoviště sdílejí krajskou instanci VITA, ale předávání spisů mezi útvary (pracovišti) je ve VITA dnes složité.','Dovyvinout ve VITA předávání spisů mezi útvary.');
  else add('move','Přesun věci mezi pracovišti',mp>=P.moveFail?'fail':mp>0?'warn':'ok',mp?`${manual} z ${pairs} dvojic pracovišť (${Math.round(mp)} %) nemá společnou instanci systému – přesun věci znamená ruční převod spisu a stavu řízení.`:'Všechna pracoviště sdílejí jednu instanci – věc lze přesunout bez převodu.',mp?'Pravidla přesunu věcí a podporovaný export/import mezi systémy, jinak přesun jen výjimečně.':(sharedVita?'Předpoklad: předávání spisů mezi útvary ve VITA je dovyvinuto.':''));
  // 3 integrované DO
  const outDo=S.filter(s=>{ const c=cfg(s); return !(c.ais===sc.doAis&&(c.inst!=='local')); }); const doShare=outDo.reduce((a,s)=>a+s.agenda,0)/totalAg*100;
  const vitaDoDev=sc.doAis==='VITA'&&!sc.vitaDo;
  const issrDoNone=sc.doAis==='ISSŘ'&&!sc.issrDo;
  const doCross=S.filter(s=>{ const a=cfg(s).ais; return (a!=='žádný'&&a!==sc.doAis)||(sc.issrStay&&sc.doAis!=='ISSŘ'&&issrShare(s)>0&&a!=='ISSŘ'); });   // i řízení, která v ISSŘ pokračují
  if(doCross.length&&!sc.xInt&&!issrDoNone) add('do','Integrované DO na centrále','fail',`DO koordinují ${sc.doAis==='VITA'?'ve VITA':'v '+sc.doAis}, ale ${pn(doCross.length)} (${doCross.map(s=>s.name).join(', ')}) vede řízení (nebo jejich část) v jiném systému (${[...new Set(doCross.map(s=>cfg(s).ais==='žádný'||cfg(s).ais===sc.doAis?'ISSŘ':cfg(s).ais))].join(', ')}). DO by musely pracovat ve dvou systémech: dokumentace v jednom, koordinace v druhém; sdílení podkladů a předání koordinovaného vyjádření mezi systémy neexistuje.`,'Obousměrná integrace VITA ↔ ISSŘ (podklady pro DO, předání KV), nebo všechna řízení v systému, ve kterém koordinují DO.'); else
  if(issrDoNone) add('do','Integrované DO na centrále','warn',`DO mají koordinovat v ISSŘ, ale ISSŘ funkcionalitu pro integrované dotčené orgány nemá (ani není zadaná).${outDo.length?` Mimo instanci DO je navíc ${pn(outDo.length)}.`:''}`,'Velké úsilí: zadat a rychle vyvinout v ISSŘ funkcionalitu integrovaných DO (koordinace, lhůty, parafa, koordinované vyjádření), otestovat a ověřit pilotním provozem před Dnem 1.',true); else
  add('do','Integrované DO na centrále',doShare>=P.doFail?'fail':(outDo.length||vitaDoDev||sc.doAis==='ISSŘ')?'warn':'ok',outDo.length?`DO koordinují v systému ${sc.doAis}; ${pn(outDo.length)} (${Math.round(doShare)} % agendy) je mimo jejich instanci – koordinované vyjádření se pro ně zakládá ručně: ${outDo.map(s=>s.name).join(', ')}.`:`Všechna pracoviště jsou v instanci, ve které DO koordinují (${sc.doAis}).`+(vitaDoDev?' Integrace dotčených orgánů ve VITA ale zatím není vyvinuta (zadaná, ve vývoji).':'')+(sc.doAis==='ISSŘ'?' Předpoklad: funkcionalita integrovaných DO v ISSŘ je vyvinuta.':''),
    [outDo.length?'Dvojí evidence koordinace; ověřit kapacitu koordinátorů na ruční zakládání.':'',vitaDoDev?'Dokončit vývoj integrace DO ve VITA a ověřit ji.':'',sc.doAis==='ISSŘ'?'Dodat funkcionalitu DO v ISSŘ včas a ověřit zkušebním provozem.':''].filter(Boolean).join(' '));
  // 4 jedna spisová služba
  const notUru=S.filter(s=>cfg(s).ss!==SS_URU); const veraUru=[];
  if(notUru.length) add('ss','Jedna spisová služba ÚRÚ','fail',`${pn(notUru.length)} zůstává na spisové službě obce (${[...new Set(notUru.map(s=>cfg(s).ss))].join(', ')}) – v rozporu se zásadou „mnoho vstupů, jeden spis“.`,'Napojit všechna pracoviště na spisovou službu ÚRÚ ke Dni 1.');
  else add('ss','Jedna spisová služba ÚRÚ',veraUru.length?'warn':'ok',veraUru.length?`Všechna pracoviště na spisové službě ÚRÚ; ${pn(veraUru.length)} ve VERA – napojení VERA na ESPIS není ověřené.`:'Všechna pracoviště používají spisovou službu ÚRÚ.',veraUru.length?'Ověřit napojení VERA na ESPIS.':'');
  // 4a migrace obecních spisových služeb do spisové služby ÚRÚ – samostatná kapitola, společná pro všechny scénáře s jednou spisovou službou
  const toUru=S.filter(s=>cfg(s).ss===SS_URU&&s.ss!==SS_URU);
  if(toUru.length){ const suN=toUru.reduce((a,s)=>a+(s.su||1),0), ssN=toUru.reduce((a,s)=>a+Math.max(1,s.nSs||1),0); const names=[...new Set(toUru.map(s=>s.ss))];
    add('ssmig','Migrace obecních spisových služeb','warn',`Do spisové služby ÚRÚ přechází ${pn(toUru.length)} (${suN} stavebních úřadů); dnes ${names.join(', ')}, uvnitř ORP odhadem ${ssN} instancí spisových služeb. Samostatná kapitola společná pro všechny scénáře s jednou spisovou službou.`,'Samostatný projekt migrace eSSL: inventura spisů, převod rozpracovaných a uzavření ostatních, předávací protokoly, archiv; zaručený přístup k uzavřeným spisům u obcí.'); }
  // 4b ISSŘ a spisová služba – ISSŘ má vlastní evidenci (ořezaný GINIS), samo přiděluje sp. zn. a č. j.
  const inIssr=S.filter(s=>cfg(s).ais==='ISSŘ'); const cIssr=sc.cAis==='ISSŘ';
  if(inIssr.length||cIssr){ const who=(inIssr.length?pn(inIssr.length):'')+(cIssr?(inIssr.length?' a centrála':'centrála'):'');
    add('issrss','ISSŘ a spisová služba','warn',sc.esslIssr?`Předpoklad: integrace eSSL → ISSŘ je vyvinuta. ${who} vede řízení v ISSŘ, které má vlastní evidenci a řadu č. j.; podání z DS, e-mailu a osobně se do něj předávají ze spisové služby ÚRÚ.`:
      `${who} vede řízení v ISSŘ, které není napojené na spisovou službu – samo přiděluje spisové značky a č. j. Podání doručená DS, e-mailem a osobně se evidují ve spisové službě ÚRÚ a do ISSŘ se musí zadávat ručně: dvojí evidence a dvě řady č. j. (párování podle č. j. nefunguje).`,
      sc.esslIssr?'Dodat integraci včas a ověřit zkušebním provozem; sjednotit řady č. j. nebo jejich převod.':'Urgentní vývoj integrace eSSL → ISSŘ a procesy předávání, testování a pilot; do té doby ruční zadávání a dvojí evidence.',!sc.esslIssr&&inIssr.length>1); }
  // 4c vyspělost agendového systému – ISSŘ nedosahuje propracovanosti a funkčnosti VITA
  if(inIssr.length||cIssr){ const ag=inIssr.reduce((a,s)=>a+(s.agenda||0),0)/totalAg*100;
    add('issrfn','Funkčnost ISSŘ jako agendového systému',sc.issrMature?'ok':'warn',sc.issrMature?'Předpoklad: agendová funkčnost ISSŘ je dovyvinuta na úroveň potřebnou pro výkon agendy.':`ISSŘ jako agendový systém nedosahuje propracovanosti a funkčnosti VITA; v ISSŘ by se vedlo asi ${Math.round(ag)} % agendy kraje${cIssr?' a agenda centrály':''}. Riziko nižší produktivity a ručních obchvatů.`,sc.issrMature?'':'Rozvoj agendových funkcí ISSŘ (minimálně na úroveň VITA), testování a pilot před přechodem; jinak počítat s nižší produktivitou.',!sc.issrMature&&ag>=50); }
  // 5 ESZ a přehled o řízeních
  const rel=s=>{ const c=cfg(s); if(c.ais==='ISSŘ') return 1; if(sc.eszEnforced) return 1; return {'Ano':1,'Částečně':0.5,'Ne':0}[s.issr]??0; };
  const ez=S.reduce((a,s)=>a+s.agenda*rel(s),0)/totalAg*100;
  const unified=S.length>0&&new Set(S.map(key)).size===1&&S.every(s=>cfg(s).ss===SS_URU)&&cfg(S[0]).ais!=='ISSŘ';
  if(unified) add('esz','ESZ a přehled o řízeních','ok',`Spolehlivost ESZ není podstatná – veškerá evidence kraje je v jedné instanci ${cfg(S[0]).ais} a ve spisové službě ÚRÚ; ISSŘ slouží jako komunikační brána pro dokumenty z Portálu a přístup k dokumentaci.`); else
  add('esz','ESZ a přehled o řízeních',ez>=P.eszOk?(sc.eszEnforced&&S.some(s=>cfg(s).ais!=='ISSŘ')?'warn':'ok'):ez>=P.eszFail?'warn':'fail',`Spolehlivě v ESZ je asi ${Math.round(ez)} % agendy kraje${sc.eszEnforced?' (předpoklad: smluvně vynucený plný zápis VITA do ESZ)':''}.`,ez<P.eszOk?'Bez úplné ESZ kraj nemá přehled o svých řízeních; náhradní index z denních extraktů.':(sc.eszEnforced&&S.some(s=>cfg(s).ais!=='ISSŘ')?'Smluvně vynutit plný zápis VITA do ESZ a obousměrnou synchronizaci stavu.':''));
  // 6 kapacita centrálních instancí
  const doU=subtreeUsers('Odbor integrovaných dotčených orgánů'), cU=subtreeUsers('Odbor stavebně správní'); const capRows=[];
  ['VITA'].forEach(ais=>{ const ss=S.filter(s=>cfg(s).ais===ais&&cfg(s).inst==='central'); let u=ss.reduce((a,s)=>a+siteUsers(s),0); if(sc.doAis===ais) u+=doU; if(sc.cAis===ais&&sc.cInst==='central') u+=cU; if(u) capRows.push({ais,u,max:P.maxUsers[ais]||1}); });
  if(!capRows.length) add('cap','Kapacita krajské instance','ok','Scénář nepočítá s krajskou instancí VITA.');
  capRows.forEach(r=>{ const pv=r.ais==='VITA'?(P.provenVITA||0):0; const st=r.u>r.max?'fail':(r.u>0.8*r.max||(pv&&r.u>pv))?'warn':'ok';
    add('cap','Kapacita krajské instance '+r.ais,st,`Krajská instance ${r.ais}: asi ${r.u} uživatelů (míst); reálné maximum ${r.max}${pv?`, v provozu ověřeno ~${pv} (Brno)`:''}.`,st==='fail'?`Rozdělit instanci nebo navýšit kapacitu; zátěžový test.`:st==='warn'?`Zátěžový test instance ${r.ais} pro ${r.u} uživatelů a více útvarů.`:''); });
  // 7 instance u obcí
  const loc=S.filter(s=>cfg(s).inst==='local');
  add('local','Instance u obcí',loc.length?'warn':'ok',loc.length?`${pn(loc.length)} zůstává na instancích u obcí – provoz, zálohy a bezpečnost mimo přímou kontrolu ÚRÚ.`:'Žádná instance u obcí.',loc.length?'Smlouvy o součinnosti a provozu s obcemi; centrální rámcové smlouvy s dodavateli.':'');
  // 7b převzetí dat ze zrušených stavebních úřadů
  const zr=S.reduce((a,s)=>a+Math.max(0,(s.su||1)-1),0), suAll=S.reduce((a,s)=>a+(s.su||1),0);
  const multiSs=S.filter(s=>(s.nSs||0)>1), multiAis=S.filter(s=>(s.nAis||0)>1);
  const noSp=S.filter(s=>(s.su||1)>((s.spisySu==null?0:s.spisySu))), noSw=S.filter(s=>(s.su||1)>((s.swSu==null?0:s.swSu)));
  if(zr) add('src','Převzetí dat ze zrušených úřadů','warn',`Do ${pn(S.filter(s=>(s.su||1)>1).length)} se slučuje ${zr} zanikajících stavebních úřadů (celkem ${suAll} úřadů). Data jejich řízení a spisů je nutné převést do cílového systému pracoviště, i když se systém kotevního úřadu nemění. Uvnitř ORP je víc spisových služeb u ${pn(multiSs.length)}${multiSs.length?' ('+multiSs.map(s=>s.name+' '+s.nSs).join(', ')+')':''}${multiAis.length?`, víc agendových programů u ${pn(multiAis.length)} (${multiAis.map(s=>s.name).join(', ')})`:''}. Údaje o rozpracovaných spisech chybí u ${pn(noSp.length)}, o software u ${pn(noSw.length)}.`,
    'Zmapovat systémy a data všech zanikajících úřadů (tabulka má jen souhrny za ORP); plán převzetí pro každou kombinaci systémů; zaručený přístup k uzavřeným spisům u obcí.');
  else add('src','Převzetí dat ze zrušených úřadů','ok','Žádné pracoviště nevzniká sloučením více úřadů.');
  // 8 migrace
  // změny agendového systému: VERA → VITA (převzetí dat), obecní VITA → krajská VITA (sloučení instancí), VITA/VERA → ISSŘ (migrace do ISSŘ)
  const chg=S.filter(s=>cfg(s).ais!==s.ais&&cfg(s).ais!=='žádný'&&!(cfg(s).ais==='ISSŘ'&&issrShare(s)>=100));   // kdo už vede vše v ISSŘ, nic nepřevádí
  const vv=chg.filter(s=>s.ais==='VERA'&&cfg(s).ais==='VITA');
  const toIssr=chg.filter(s=>cfg(s).ais==='ISSŘ'&&(s.ais==='VITA'||s.ais==='VERA'));
  const mig=chg.filter(s=>!vv.includes(s)&&!toIssr.includes(s)); const ms=mig.reduce((a,s)=>a+(s.spisy||0),0);
  const consol=S.filter(s=>s.ais==='VITA'&&cfg(s).ais==='VITA'&&cfg(s).inst==='central');
  const tiSp=toIssr.reduce((a,s)=>a+Math.round((s.spisy||0)*(1-issrShare(s)/100)),0), tiUnk=toIssr.filter(s=>s.spisy==null).length;
  const vvTxt=vv.length?` ${pn(vv.length)} přechází z VERA do VITA – VITA data převezme (${vv.map(s=>s.name).join(', ')}).`:'';
  const coTxt=consol.length?` ${pn(consol.length)} přechází z obecních instancí VITA do krajské instance – sloučení instancí (migrační nástroj dodavatele, k ověření).`:'';
  const tiTxt=toIssr.length?` ${pn(toIssr.length)} přechází z obecních VITA a VERA do ISSŘ: probíhající řízení (odhadem ${tiSp} rozpracovaných spisů, bez podílu už vedeného v ISSŘ${tiUnk?`; u ${pn(tiUnk)} počet neznámý`:''}) je nutné převést do ISSŘ – migrační cesta VITA/VERA → ISSŘ dnes neexistuje.`:'';
  const issrCand=S.filter(s=>issrShare(s)>0&&cfg(s).ais!=='ISSŘ'&&cfg(s).ais!=='žádný'&&(cfg(s).inst!=='local'||cfg(s).ais!==toTarget(s.ais)));
  const fromIssr=[];   // převod z ISSŘ má vlastní kontrolu 'issrmig'
  const issrSp=fromIssr.reduce((a,s)=>a+Math.round((s.spisy||0)*issrShare(s)/100),0), issrUnk=fromIssr.filter(s=>s.spisy==null).length;
  const isTxt=fromIssr.length?` Probíhající řízení vedená dnes v ISSŘ (${pn(fromIssr.length)}, odhadem ${issrSp} rozpracovaných spisů${issrUnk?`; u ${pn(issrUnk)} počet spisů neznámý`:''}) je nutné převést do ${[...new Set(fromIssr.map(s=>cfg(s).ais))].join('/')}/ESPIS – pravděpodobně ručně.`:'';
  const stayTxt=sc.issrStay&&issrCand.length?` Řízení vedená dnes v ISSŘ (${pn(issrCand.length)}) v něm pokračují – bez převodu do VITA (výhoda kombinace: migruje se jen z obecních VITA a VERA do krajské VITA).`:'';
  const migNeed=mig.length||fromIssr.length||toIssr.length||consol.length;
  const txt=((mig.length?`${pn(mig.length)} mění agendový systém; nová řízení v cílovém systému, dobíhá asi ${ms} rozpracovaných spisů (převést jen dlouhý chvost).`:'')+tiTxt+vvTxt+coTxt+isTxt+stayTxt).trim();
  add('mig','Migrace rozpracovaných řízení',migNeed?'warn':'ok',txt||'Žádné pracoviště nemění agendový systém.',
    [mig.length?'Zkušební migrace; povinnost součinnosti obcí při předání dat.':'',
     toIssr.length?'Vyvinout migraci VITA/VERA → ISSŘ (nebo ruční převod), zkušební migrace a pilot; alternativně doběh v obecních instancích po dobu jejich dalšího provozu.':'',
     consol.length?'Sloučení obecních instancí VITA do krajské – ověřit s dodavatelem, zkušební migrace.':'',
     fromIssr.length?'Ruční převod probíhajících řízení z ISSŘ, nebo jejich doběh v ISSŘ (po dobu doběhu ruční koordinace DO a přesunů).':''].filter(Boolean).join(' '),
    toIssr.length>1);
  // 8b převod rozpracovaných řízení z ISSŘ (25–30 % řízení, spíše jednodušší) – samostatně, aby nezanikl
  if(issrCand.length&&!sc.issrStay){ const sp=issrCand.reduce((a,s)=>a+Math.round((s.spisy||0)*issrShare(s)/100),0), unk=issrCand.filter(s=>s.spisy==null).length;
    const ag=issrCand.reduce((a,s)=>a+(s.agenda||0)*issrShare(s)/100,0)/totalAg*100; const tgt=[...new Set(issrCand.map(s=>cfg(s).ais))].join('/');
    const base=`${pn(issrCand.length)} vede dnes v ISSŘ odhadem ${Math.round(ag)} % agendy kraje (spíše jednodušší řízení); rozpracovaných odhadem ${sp} spisů${unk?` (u ${pn(unk)} počet neznámý)`:''}.`;
    if(sc.issrRunOff) add('issrmig','Převod rozpracovaných řízení z ISSŘ','warn',base+` Rozpracovaná řízení doběhnou v ISSŘ, nová se zakládají ${tgt==='VITA'?'ve VITA':'v '+tgt}. Bez převodu a bez koordinace DO – rozběhlá řízení už mají vyjádření a stanoviska DO.`,'Pravidlo doběhu (lhůta, kdy se dlouhý chvost převede ručně); přístup referentů k ISSŘ po dobu doběhu; přesun věci v ISSŘ jen výjimečně.');
    else add('issrmig','Převod rozpracovaných řízení z ISSŘ','warn',base+` Je nutné je převést do ${tgt}/ESPIS – migrační cesta ISSŘ → ${tgt} neexistuje, převod bude pravděpodobně ruční.`,`Ruční převod (kapacita, pravidla, kontrola úplnosti) nebo vývoj migrace ISSŘ → ${tgt}; alternativa: doběh v ISSŘ (volba scénáře).`,issrCand.length>1); }
  // 9 zaškolení lidí (informativně, bez vlivu na verdikt)
  let re=0, unk=0; const reS=[];
  S.forEach(s=>{ const t=cfg(s).ais, all=s.mistaAll||siteUsers(s), kot=s.mistaKot; if(t==='žádný') return;
    if(t==='ISSŘ'&&s.ais!=='ISSŘ'){ const f=s.issr==='Ano'?0:s.issr==='Částečně'?0.5:1; if(f){ re+=all*f; reS.push(s.name+(f<1?' (ISSŘ částečně znají)':'')); } return; }
    if(t!==toTarget(s.ais)||(t==='VITA'&&s.ais==='VERA')){ re+=all; reS.push(s.name); return; }
    if(t!=='ISSŘ'&&issrShare(s)>=80&&(cfg(s).inst!=='local'||t!==toTarget(s.ais))){ re+=all*issrShare(s)/100; reS.push(s.name+' (dnes převážně ISSŘ)'); return; }
    if((s.nAis||1)>1){ const other=kot!=null?Math.max(0,all-kot):null; if(other!=null) re+=other; else unk++; } });
  add('skills','Zaškolení lidí do cílového systému','info',`Asi ${Math.round(re)} lidí (pracovních míst) bude pracovat v jiném systému, než znají${reS.length?' – '+reS.join(', '):''}${unk?`; u ${pn(unk)} se programy uvnitř ORP liší a počet nelze určit`:''}. Lidé ze zrušených úřadů s jiným programem se zaškolí; není to blokační podmínka.`,'Plán školení podle zdrojového systému.');
  const v=out.some(c=>c.status==='fail')?'fail':out.some(c=>c.status==='warn'&&c.heavy)?'warnH':out.some(c=>c.status==='warn')?'warn':'ok';
  return {checks:out,verdict:v}; }
function verdictStat(){ const sc=curSc(); if(!sc) return ''; const a=assess(sc); const [t,c]=VERDICT[a.verdict];
  return `<div class="stat" title="aktivní scénář: ${esc(sc.name)}"><b style="color:${c};font-size:14px">${t}</b><span>scénář: ${esc(sc.name)}</span></div>`; }

// ---------- pohled Pracoviště a systémy ----------
function renderWs(){ const c=$('#v-ws'); const st=c.scrollTop; normKraj(); const K=state.kraj, sc=curSc(), ro=ROLE.org?'':'disabled'; const A=assess(sc); const [vt,vc]=VERDICT[A.verdict];
  const S=Object.values(K.sites).sort((a,b)=>a.name.localeCompare(b.name,'cs')); const ssOpts=[SS_URU,...new Set(S.map(s=>s.ss))];
  const sel=(cls,kod,opts,val,lbl)=>`<select class="${cls}" data-kod="${kod}" ${ro}>${opts.map(o=>`<option value="${esc(o)}" ${o===val?'selected':''}>${esc(lbl?lbl[o]:o)}</option>`).join('')}</select>`;
  const icon=s=>`<span class="sti st-${s}" title="${ST_LBL[s]}">${s==='ok'?'✓':s==='warn'?'!':s==='warnH'?'!!':s==='info'?'i':'✕'}</span>`;
  const all=K.scenarios.map(x=>({x,a:assess(x)})); const names=[...new Set(all.flatMap(o=>o.a.checks.map(ch=>ch.name.replace(/ (VITA|VERA)$/,''))))];
  c.innerHTML=`<div class="pad wide">
    <div class="row screw"><b>Scénář Dne 1:</b><select id="scSel">${K.scenarios.map(x=>`<option value="${x.id}" ${x===sc?'selected':''}>${esc(x.name)}</option>`).join('')}</select>
      ${ROLE.org?'<button id="scDup">Duplikovat</button><button id="scRen">Přejmenovat</button><button id="scDel" style="color:var(--danger)">Smazat</button>':''}<span class="muted">${esc(sc.desc||'')}</span></div>
    <div class="verdict" style="border-color:${vc}"><div class="vt" style="color:${vc}">${vt.toUpperCase()}</div><div class="muted">${esc(KRAJ)} · ${S.length} územních pracovišť · posouzení podle parametrů v pravém panelu</div></div>
    <div class="checks">${A.checks.map(ch=>`<div class="chk st-${stOf(ch)}">${icon(stOf(ch))}<div><b>${esc(ch.name)}</b><div>${esc(ch.text)}</div>${ch.cond?`<div class="cond">${ch.status==='fail'?'Řešení':ch.status==='info'?'Doporučení':ch.heavy?'Náročná podmínka':'Podmínka'}: ${esc(ch.cond)}</div>`:''}</div></div>`).join('')}</div>
    <h3>Pracoviště ve scénáři <span class="muted" style="font-weight:400">– žlutě, kde se mění systém proti dnešku · v ISSŘ se dnes vede odhadem ${Math.round(S.reduce((a,s)=>a+(s.agenda||0)*issrShare(s)/100,0)/(S.reduce((a,s)=>a+(s.agenda||0),0)||1)*100)} % agendy kraje</span></h3>
    ${ROLE.org?`<div class="row bulk">Všem pracovištím: ${sel('bAis','',['',...AIS_SC],'',Object.fromEntries([['','— AIS —'],...AIS_SC.map(x=>[x,x])]))} ${sel('bInst','',['',...Object.keys(INST)],'',{'':'— instance —',...INST})} ${sel('bSs','',['',...ssOpts],'',Object.fromEntries([['','— spisová služba —'],...ssOpts.map(x=>[x,x])]))} <button id="bApply" class="small">Nastavit</button></div>`:''}
    <div class="tw"><table class="tbl ws"><thead><tr><th>Pracoviště</th><th title="systemizovaná místa v krajském organigramu">Míst</th><th title="slučované stavební úřady">Úřadů</th><th title="úkony 2025">Agenda</th><th title="rozpracované spisy">Spisy</th><th>ISSŘ dnes</th><th>AIS dnes</th><th>Spis. služba dnes</th><th class="sc">AIS ve scénáři</th><th class="sc">Instance</th><th class="sc">Spis. služba ve scénáři</th></tr></thead><tbody>
    ${S.map(s=>{ const g=sc.sites[s.kod]||{}; return `<tr data-kod="${s.kod}" class="${K.selSite==s.kod?'sel':''}"><td><a href="#" class="siteLink">${esc(s.name)}</a>${s.riziko==='Vysoké'?' <span class="tagr" title="riziko IT vysoké">IT!</span>':''}</td><td>${siteUsers(s)}</td><td title="${esc(s.suList||'')}">${s.su||1}${(s.nSs||0)>1||(s.nAis||0)>1?` <span class="tagr" style="background:#B54708" title="uvnitř ORP: ${s.nAis||'?'} programů, ${s.nSs||'?'} spisových služeb">${(s.nAis||1)>1?s.nAis+' AIS':''}${(s.nAis||1)>1&&(s.nSs||0)>1?' · ':''}${(s.nSs||0)>1?s.nSs+' SS':''}</span>`:''}</td><td>${s.agenda||'—'}</td><td>${s.spisy||'—'}</td><td title="odhad podílu řízení vedených v ISSŘ">${esc(s.issr)}${issrShare(s)?` <span class="muted">~${issrShare(s)} %</span>`:''}</td><td>${esc(s.ais)}</td><td>${esc(s.ss)}</td>
      <td class="sc${g.ais!==s.ais?' chg':''}">${sel('sAis',s.kod,AIS_SC,g.ais)}</td><td class="sc">${sel('sInst',s.kod,Object.keys(INST),g.inst,INST)}</td><td class="sc${g.ss!==s.ss?' chg':''}">${sel('sSs',s.kod,ssOpts,g.ss)}</td></tr>`; }).join('')}</tbody></table></div>
    <h3>Porovnání scénářů</h3>
    <div class="tw"><table class="tbl cmp"><thead><tr><th>Kontrola</th>${all.map(o=>`<th class="${o.x===sc?'on':''}"><a href="#" data-sc="${o.x.id}">${esc(o.x.name)}</a></th>`).join('')}</tr></thead><tbody>
    ${names.map(n=>`<tr><td>${esc(n)}</td>${all.map(o=>{ const cs=o.a.checks.filter(ch=>ch.name.replace(/ (VITA|VERA)$/,'')===n); const s=cs.some(x=>x.status==='fail')?'fail':cs.some(x=>stOf(x)==='warnH')?'warnH':cs.some(x=>x.status==='warn')?'warn':cs.some(x=>x.status==='info')?'info':cs.length?'ok':null; return `<td class="${o.x===sc?'on':''}" title="${esc(cs.map(x=>x.text).join('\n'))}">${s?icon(s):'—'}</td>`; }).join('')}</tr>`).join('')}
    <tr class="vrow"><td><b>Verdikt</b></td>${all.map(o=>`<td class="${o.x===sc?'on':''}"><b style="color:${VERDICT[o.a.verdict][1]}">${VERDICT[o.a.verdict][0]}</b></td>`).join('')}</tr></tbody></table></div>
  </div>`;
  const set=fn=>{ fn(); save('scénář',sc.name); };
  $('#scSel').onchange=e=>{ K.active=e.target.value; K.selSite=null; persist(); render(); };
  c.querySelectorAll('a[data-sc]').forEach(x=>x.onclick=e=>{ e.preventDefault(); K.active=x.dataset.sc; persist(); render(); });
  c.querySelectorAll('a.siteLink').forEach(x=>x.onclick=e=>{ e.preventDefault(); K.selSite=+x.closest('tr').dataset.kod; render(); });
  if(!ROLE.org){ c.scrollTop=st; return; }
  c.querySelectorAll('select.sAis').forEach(x=>x.onchange=()=>set(()=>{ const g=sc.sites[x.dataset.kod]; g.ais=x.value; if(x.value==='ISSŘ') g.inst='national'; else if(g.inst==='national') g.inst='central'; }));
  c.querySelectorAll('select.sInst').forEach(x=>x.onchange=()=>set(()=>sc.sites[x.dataset.kod].inst=x.value));
  c.querySelectorAll('select.sSs').forEach(x=>x.onchange=()=>set(()=>sc.sites[x.dataset.kod].ss=x.value));
  $('#bApply').onclick=()=>{ const a=c.querySelector('.bAis').value, i=c.querySelector('.bInst').value, s=c.querySelector('.bSs').value; if(!a&&!i&&!s) return;
    set(()=>Object.values(sc.sites).forEach(g=>{ if(a){ g.ais=a; if(a==='ISSŘ') g.inst='national'; } if(i) g.inst=i; if(s) g.ss=s; })); };
  $('#scDup').onclick=()=>{ const n=prompt('Název nového scénáře:',sc.name+' (varianta)'); if(!n||!n.trim()) return; const x=JSON.parse(JSON.stringify(sc)); x.id=uid('sc'); x.name=n.trim(); K.scenarios.push(x); K.active=x.id; save('scénář','nový: '+x.name); };
  $('#scRen').onclick=()=>{ const n=prompt('Název scénáře:',sc.name); if(!n||!n.trim()) return; sc.name=n.trim(); save('scénář','přejmenován: '+sc.name); };
  $('#scDel').onclick=()=>{ if(K.scenarios.length<2){ toast('Poslední scénář nelze smazat.'); return; } if(!confirm(`Smazat scénář „${sc.name}“?`)) return; K.scenarios=K.scenarios.filter(x=>x!==sc); K.active=K.scenarios[0].id; save('scénář','smazán: '+sc.name); };
  c.scrollTop=st; }

// ---------- boční panel: scénář, parametry, pracoviště ----------
function renderWsSide(s){ normKraj(); const K=state.kraj, sc=curSc(), P=K.params, ro=ROLE.org?'':'disabled';
  const site=K.selSite&&K.sites[K.selSite];
  if(site){ const u=siteUnit(site.kod);
    s.innerHTML=`<div class="sh"><span class="muted">Pracoviště – stav dnes</span><button class="small" id="sClose">×</button></div><h3 style="margin:4px 0">${esc(site.name)}</h3>
      <p class="muted" style="font-size:12px">ORP ${site.kod} · ${u?esc(u.name):'útvar v organigramu nenalezen'} · riziko IT ${esc(site.riziko||'—')}</p>
      <div class="g2"><label>AIS dnes<select id="xsAis" ${ro}>${AIS_OPT.map(o=>`<option ${o===site.ais?'selected':''}>${o}</option>`).join('')}</select></label>
      <label>ISSŘ dnes<select id="xsIssr" ${ro}>${['Ano','Částečně','Ne'].map(o=>`<option ${o===site.issr?'selected':''}>${o}</option>`).join('')}</select></label>
      <label>Podíl řízení v ISSŘ (%)<input type="number" id="xsIp" min="0" max="100" value="${site.issrPct??''}" placeholder="výchozí ${issrShare(site)} %" ${ro}></label>
      <label>Spisová služba dnes<input type="text" id="xsSs" value="${esc(site.ss)}" ${ro}></label>
      <label>Agenda 2025 (úkony)<input type="number" id="xsAg" value="${site.agenda||0}" ${ro}></label>
      <label>Rozpracované spisy<input type="number" id="xsSp" value="${site.spisy||0}" ${ro}></label>
      <label>Archiv (bm)<input type="number" id="xsAr" value="${site.archiv||0}" ${ro}></label></div>
      <div class="lbl">Slučované stavební úřady (${site.su||1})</div><div style="font-size:13px">${esc(site.suList||'—').split('; ').join('<br>')}</div>
      <p class="muted" style="font-size:12px;margin-top:6px">Tabulka ORP ISSŘ mezi agendové systémy nepočítá. Řízení se v ISSŘ vedou podle typu nebo podle úředníka; podíl zadejte, pokud ho znáte (jinak výchozí podle kategorie v parametrech).</p>
      <p class="muted" style="font-size:12px;margin-top:6px">V ORP: ${site.nAis??'?'} agendových programů, ${site.nSs??'?'} spisových služeb · pracovní místa ${site.mistaAll??'?'} (kotevní úřad ${site.mistaKot??'neuvedeno'}) · data o spisech za ${site.spisySu??0}, o software za ${site.swSu??0}, o archivu za ${site.archSu??0} z ${site.su||1} úřadů</p>
      <p class="muted" style="font-size:12px;margin-top:10px">Výchozí hodnoty z tabulky URU_prehled_ORP_ver1.xlsx (MMR, 2026). Počet míst se bere z krajského organigramu.</p>`;
    $('#sClose').onclick=()=>{ K.selSite=null; render(); }; if(!ROLE.org) return;
    const ch=(id,fn)=>$(id).onchange=()=>{ fn($(id).value); save('pracoviště',site.name); };
    ch('#xsAis',v=>site.ais=v); ch('#xsIssr',v=>site.issr=v); ch('#xsSs',v=>site.ss=v.trim()||site.ss); ch('#xsIp',v=>{ if(v===''||v==null) delete site.issrPct; else site.issrPct=Math.max(0,Math.min(100,+v)); }); ch('#xsAg',v=>site.agenda=Math.max(0,+v||0)); ch('#xsSp',v=>site.spisy=Math.max(0,+v||0)); ch('#xsAr',v=>site.archiv=Math.max(0,+v||0));
    return; }
  s.innerHTML=`<div class="sh"><span class="muted">Scénář</span></div>
    <label>Popis<textarea id="scDesc" rows="3" ${ro}>${esc(sc.desc||'')}</textarea></label>
    <div class="g2"><label>DO na centrále koordinují v<select id="scDo" ${ro}>${AIS_SC.filter(x=>x!=='žádný').map(o=>`<option ${o===sc.doAis?'selected':''}>${o}</option>`).join('')}</select></label>
    <label>Centrála (složitější stavby)<select id="scCa" ${ro}>${AIS_SC.filter(x=>x!=='žádný').map(o=>`<option ${o===sc.cAis?'selected':''}>${o}</option>`).join('')}</select></label></div>
    <label style="display:flex;gap:6px;align-items:center;color:var(--ink);font-size:13px;margin-top:10px"><input type="checkbox" id="scEsz" style="width:auto" ${sc.eszEnforced?'checked':''} ${ro}> smluvně vynucený plný zápis VITA do ESZ</label>
    <label style="display:flex;gap:6px;align-items:flex-start;color:var(--ink);font-size:13px;margin-top:10px"><input type="checkbox" id="scXi" style="width:auto;margin-top:3px" ${sc.xInt?'checked':''} ${ro}> <span>obousměrná integrace VITA ↔ ISSŘ je vyvinuta <span class="muted">(předávání věcí, podklady pro DO, předání KV; jen pro scénáře se dvěma systémy)</span></span></label>
    <label style="display:flex;gap:6px;align-items:flex-start;color:var(--ink);font-size:13px;margin-top:6px"><input type="checkbox" id="scStay" style="width:auto;margin-top:3px" ${sc.issrStay?'checked':''} ${ro}> <span>řízení vedená dnes v ISSŘ v něm pokračují trvale <span class="muted">(kombinace; bez převodu do VITA)</span></span></label>
    <label style="display:flex;gap:6px;align-items:flex-start;color:var(--ink);font-size:13px;margin-top:6px"><input type="checkbox" id="scRun" style="width:auto;margin-top:3px" ${sc.issrRunOff?'checked':''} ${ro}> <span>rozpracovaná řízení z ISSŘ doběhnou v ISSŘ <span class="muted">(nová už v cílovém systému; místo ručního převodu)</span></span></label>
    <div class="lbl" style="margin-top:12px">Vývoj ISSŘ</div>
    <label style="display:flex;gap:6px;align-items:center;color:var(--ink);font-size:13px"><input type="checkbox" id="scEssl" style="width:auto" ${sc.esslIssr?'checked':''} ${ro}> integrace spisové služby → ISSŘ je vyvinuta</label>
    <label style="display:flex;gap:6px;align-items:center;color:var(--ink);font-size:13px;margin-top:6px"><input type="checkbox" id="scIdo" style="width:auto" ${sc.issrDo?'checked':''} ${ro}> funkcionalita integrovaných DO v ISSŘ je vyvinuta <span class="muted">(dnes neexistuje)</span></label>
    <label style="display:flex;gap:6px;align-items:center;color:var(--ink);font-size:13px;margin-top:6px"><input type="checkbox" id="scImt" style="width:auto" ${sc.issrMature?'checked':''} ${ro}> agendová funkčnost ISSŘ dovyvinuta (úroveň VITA)</label>
    <div class="lbl" style="margin-top:12px">Vývoj VITA</div>
    <label style="display:flex;gap:6px;align-items:center;color:var(--ink);font-size:13px"><input type="checkbox" id="scVdo" style="width:auto" ${sc.vitaDo?'checked':''} ${ro}> integrace dotčených orgánů ve VITA je vyvinuta <span class="muted">(dnes zadaná, ve vývoji)</span></label>
    <label style="display:flex;gap:6px;align-items:center;color:var(--ink);font-size:13px;margin-top:6px"><input type="checkbox" id="scVmv" style="width:auto" ${sc.vitaMove?'checked':''} ${ro}> předávání spisů mezi útvary ve VITA je dovyvinuto</label>
    <div class="lbl" style="margin-top:18px">Parametry posouzení (pro všechny scénáře)</div>
    <div class="g2"><label>VITA – reálné maximum uživatelů<input type="number" id="pVita" value="${P.maxUsers.VITA}" ${ro}></label><label>VITA – ověřeno v provozu<input type="number" id="pVpr" value="${P.provenVITA||0}" ${ro}></label>
    <label>AIS v kraji – podmínka od<input type="number" id="pAw" value="${P.aisWarn}" min="1" ${ro}></label><label>AIS v kraji – překážka od<input type="number" id="pAf" value="${P.aisFail}" min="1" ${ro}></label>
    <label>Ruční přesun – překážka od (% dvojic)<input type="number" id="pMv" value="${P.moveFail}" ${ro}></label><label>DO mimo instanci – překážka od (% agendy)<input type="number" id="pDo" value="${P.doFail}" ${ro}></label>
    <label>ISSŘ „Ano“ – podíl řízení (%)<input type="number" id="pIa" value="${P.issrAno}" ${ro}></label><label>ISSŘ „Částečně“ – podíl řízení (%)<input type="number" id="pIp" value="${P.issrPart}" ${ro}></label>
    <label>ESZ v pořádku od (% agendy)<input type="number" id="pEo" value="${P.eszOk}" ${ro}></label><label>ESZ překážka pod (% agendy)<input type="number" id="pEf" value="${P.eszFail}" ${ro}></label></div>
    <p class="muted" style="font-size:12px;margin-top:10px">Ověřeno: Brno cca 150, DESÚ cca 90 uživatelů; podle dodavatele je 250–300 uživatelů reálných. Nad ověřenou velikostí je podmínkou zátěžový test, nad reálným maximem překážka. S provozem VERA se nepočítá – VITA data z VERA převezme. Prahy jsou výchozí hodnoty k diskusi.</p>
    <p class="muted" style="font-size:12px">Kliknutím na název pracoviště v tabulce upravíte jeho dnešní stav.</p>`;
  if(!ROLE.org) return; const P2=(id,fn)=>$(id).onchange=()=>{ fn(+$(id).value||0); save('parametry posouzení'); };
  $('#scDesc').onchange=e=>{ sc.desc=e.target.value; save('scénář','popis'); };
  $('#scDo').onchange=e=>{ sc.doAis=e.target.value; save('scénář','DO v '+sc.doAis); }; $('#scCa').onchange=e=>{ sc.cAis=e.target.value; sc.cInst=sc.cAis==='ISSŘ'?'national':'central'; save('scénář','centrála v '+sc.cAis); };
  $('#scEsz').onchange=e=>{ sc.eszEnforced=e.target.checked; save('scénář','zápis do ESZ'); };
  $('#scEssl').onchange=e=>{ sc.esslIssr=e.target.checked; save('scénář','integrace eSSL → ISSŘ'); };
  $('#scRun').onchange=e=>{ sc.issrRunOff=e.target.checked; save('scénář','doběh řízení v ISSŘ'); };
  $('#scStay').onchange=e=>{ sc.issrStay=e.target.checked; save('scénář','řízení v ISSŘ pokračují'); };
  $('#scXi').onchange=e=>{ sc.xInt=e.target.checked; save('scénář','integrace VITA ↔ ISSŘ'); };
  $('#scIdo').onchange=e=>{ sc.issrDo=e.target.checked; save('scénář','funkcionalita DO v ISSŘ'); }; $('#scImt').onchange=e=>{ sc.issrMature=e.target.checked; save('scénář','agendová funkčnost ISSŘ'); };
  $('#scVdo').onchange=e=>{ sc.vitaDo=e.target.checked; save('scénář','integrace DO ve VITA'); }; $('#scVmv').onchange=e=>{ sc.vitaMove=e.target.checked; save('scénář','předávání spisů ve VITA'); };
  P2('#pVita',v=>P.maxUsers.VITA=v); P2('#pVpr',v=>P.provenVITA=v); P2('#pIa',v=>P.issrAno=Math.min(100,v)); P2('#pIp',v=>P.issrPart=Math.min(100,v)); P2('#pAw',v=>P.aisWarn=v); P2('#pAf',v=>P.aisFail=v); P2('#pMv',v=>P.moveFail=v); P2('#pDo',v=>P.doFail=v); P2('#pEo',v=>P.eszOk=v); P2('#pEf',v=>P.eszFail=v); }

// ---------- export ----------
function exportKraj(wb,X){ normKraj(); const K=state.kraj; const S=Object.values(K.sites);
  X.utils.book_append_sheet(wb,X.utils.json_to_sheet(S.map(s=>{ const r={'Pracoviště':s.name,'ORP':s.kod,'Míst':siteUsers(s),'Agenda 2025':s.agenda,'Rozpracované spisy':s.spisy,'Archiv (bm)':s.archiv,'ISSŘ dnes':s.issr,'Podíl řízení v ISSŘ (%)':issrShare(s),'AIS dnes':s.ais,'Spisová služba dnes':s.ss,'Riziko IT':s.riziko,'Slučované úřady':s.su,'Seznam úřadů':s.suList,'Programů v ORP':s.nAis,'Spisových služeb v ORP':s.nSs};
    K.scenarios.forEach((x,i)=>{ const g=x.sites[s.kod]||{}; r[`S${i+1} AIS`]=g.ais; r[`S${i+1} instance`]=INST[g.inst]||g.inst; r[`S${i+1} spis. služba`]=g.ss; }); return r; })),'Pracoviště');
  const rows=[]; K.scenarios.forEach((x,i)=>{ const a=assess(x); rows.push({'Scénář':`S${i+1} ${x.name}`,'Kontrola':'VERDIKT','Stav':VERDICT[a.verdict][0],'Zjištění':x.desc||'','Podmínka / řešení':''}); a.checks.forEach(ch=>rows.push({'Scénář':`S${i+1} ${x.name}`,'Kontrola':ch.name,'Stav':ST_LBL[stOf(ch)],'Zjištění':ch.text,'Podmínka / řešení':ch.cond})); });
  X.utils.book_append_sheet(wb,X.utils.json_to_sheet(rows),'Posouzení scénářů'); }
function wireKraj(){}
