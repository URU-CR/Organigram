// TOM krajského ÚRÚ – pracoviště, scénáře Dne 1 a posouzení provozuschopnosti. Používá globální stav a pomocné funkce z app.js.
// state.kraj = { sites:{kod:{...stav dnes}}, scenarios:[{id,name,desc,doAis,cAis,cInst,eszEnforced,sites:{kod:{ais,inst,ss}}}], active, params, selSite }
const AIS_OPT=['VITA','VERA','ISSŘ','žádný'];   // stav dnes
const AIS_SC=['VITA','ISSŘ','žádný'];            // cílový stav ve scénářích – s provozem VERA se nepočítá (VITA data z VERA převezme)
const toTarget=a=>a==='VERA'?'VITA':a;
const INST={local:'u obce (lokální)',central:'krajská (centrální)',national:'celostátní'};
const SS_URU='Spisová služba ÚRÚ';
const ST_LBL={ok:'v pořádku',warn:'podmínka',fail:'překážka'};
const VERDICT={ok:['provozovatelné','#067647'],warn:['provozovatelné s podmínkami','#B54708'],fail:['neprovozovatelné','#B42318']};
const DEF_PARAMS={maxUsers:{VITA:150,'ISSŘ':100000},aisWarn:2,aisFail:3,moveFail:50,doFail:34,eszOk:80,eszFail:50};

// ---------- výchozí data ----------
function seedKraj(st){ const K=window.TOM_KRAJ||{sites:[]}; const sites={};
  K.sites.forEach(s=>sites[s.kod]={kod:s.kod,name:s.name,ais:s.ais||'žádný',ss:s.ss||'neuvedeno',issr:s.issr||'Ne',agenda:s.agenda||0,spisy:s.spisy||0,archiv:s.archiv||0,riziko:s.riziko||'',dnes:s.dnes||0,potreba:s.potreba||0});
  const sc=(id,name,desc,fn,extra)=>{ const o={id,name,desc,doAis:'VITA',cAis:'VITA',cInst:'central',eszEnforced:false,sites:{},...(extra||{})}; Object.values(sites).forEach(s=>o.sites[s.kod]=fn(s)); return o; };
  st.kraj={sites,noVera:true,active:'sc1',params:JSON.parse(JSON.stringify(DEF_PARAMS)),scenarios:[
    sc('sc1','Den 1: instance VITA u obcí','Každé pracoviště zůstává na své instanci u obce a na spisové službě obce; VERA převedena do VITA.',s=>({ais:toTarget(s.ais),inst:s.ais==='ISSŘ'?'national':'local',ss:s.ss})),
    sc('sc2','Jedna spisová služba ÚRÚ, instance VITA u obcí','Ke Dni 1 jediná centrální spisová služba ÚRÚ; VITA zůstává na instancích u obcí (VERA převedena).',s=>({ais:toTarget(s.ais),inst:s.ais==='ISSŘ'?'national':'local',ss:SS_URU})),
    sc('sc4','Vše na krajskou instanci VITA','Všechna pracoviště na jedné krajské instanci VITA (VERA převedena, data převezme VITA). Smluvně vynucený zápis do ESZ.',s=>({ais:'VITA',inst:'central',ss:SS_URU}),{eszEnforced:true}),
    sc('sc5','Vše do ISSŘ','Všechna pracoviště i centrála pracují v ISSŘ; koordinace DO v ISSŘ (k ověření).',s=>({ais:'ISSŘ',inst:'national',ss:SS_URU}),{doAis:'ISSŘ',cAis:'ISSŘ',cInst:'national',eszEnforced:true})]}; }
function normKraj(){ if(!state.kraj||!state.kraj.sites) seedKraj(state); const k=state.kraj; if(!k.noVera) dropVera(state); k.params=Object.assign(JSON.parse(JSON.stringify(DEF_PARAMS)),k.params||{}); k.params.maxUsers=Object.assign({},DEF_PARAMS.maxUsers,k.params.maxUsers||{});
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
const curSc=()=>{ normKraj(); return state.kraj.scenarios.find(s=>s.id===state.kraj.active); };

// ---------- uživatelé z krajského organigramu ----------
function siteUnit(kod){ return org.units.find(u=>u.orp&&u.orp.kod==kod); }
function siteUsers(s){ const u=siteUnit(s.kod); return u?u.positions.length:Math.ceil(Math.max(s.dnes,s.potreba)); }
function subtreeUsers(name){ const u=org.units.find(x=>x.name===name); if(!u) return 0; return subtree(u.id).reduce((a,id)=>a+((U[id].positions||[]).length),0); }

// ---------- posouzení scénáře ----------
function assess(sc){ const K=state.kraj, P=K.params; const S=Object.values(K.sites); const out=[];
  const add=(id,name,status,text,cond)=>out.push({id,name,status,text,cond:cond||''});
  const cfg=s=>sc.sites[s.kod]||{ais:s.ais,inst:'local',ss:s.ss};
  const totalAg=S.reduce((a,s)=>a+(s.agenda||0),0)||1; const pct=x=>Math.round(x*100);
  // 1 počet agendových systémů
  const none=S.filter(s=>cfg(s).ais==='žádný');
  const aisSet=new Set(S.map(s=>cfg(s).ais).filter(a=>a!=='žádný')); aisSet.add(sc.cAis);
  if(none.length) add('ais','Agendové systémy','fail',`${none.length} pracovišť nemá agendový systém (${none.map(s=>s.name).join(', ')}).`,'Přidělit pracovištím bez systému agendový systém (např. ISSŘ).');
  else add('ais','Agendové systémy',aisSet.size>=P.aisFail?'fail':aisSet.size>=P.aisWarn?'warn':'ok',`V kraji se pracuje v ${aisSet.size} agendových systémech: ${[...aisSet].join(', ')}.`,aisSet.size>=P.aisWarn?'Obousměrná integrace mezi systémy a jednotný index řízení kraje.':'');
  // 2 přesun věci mezi pracovišti
  const key=s=>{ const c=cfg(s); return c.inst==='local'?c.ais+'#'+s.kod:c.ais+'#'+c.inst; };
  let pairs=0, manual=0; for(let i=0;i<S.length;i++) for(let j=i+1;j<S.length;j++){ pairs++; if(key(S[i])!==key(S[j])) manual++; }
  const mp=pairs?manual/pairs*100:0;
  add('move','Přesun věci mezi pracovišti',mp>=P.moveFail?'fail':mp>0?'warn':'ok',mp?`${manual} z ${pairs} dvojic pracovišť (${Math.round(mp)} %) nemá společnou instanci systému – přesun věci znamená ruční převod spisu a stavu řízení.`:'Všechna pracoviště sdílejí jednu instanci – věc lze přesunout bez převodu.',mp?'Pravidla přesunu věcí a podporovaný export/import mezi systémy, jinak přesun jen výjimečně.':'');
  // 3 integrované DO
  const outDo=S.filter(s=>{ const c=cfg(s); return !(c.ais===sc.doAis&&(c.inst!=='local')); }); const doShare=outDo.reduce((a,s)=>a+s.agenda,0)/totalAg*100;
  add('do','Integrované DO na centrále',doShare>=P.doFail?'fail':outDo.length?'warn':'ok',outDo.length?`DO koordinují v systému ${sc.doAis}; ${outDo.length} pracovišť (${Math.round(doShare)} % agendy) je mimo jejich instanci – koordinované vyjádření se pro ně zakládá ručně: ${outDo.map(s=>s.name).join(', ')}.`:`Všechna pracoviště jsou v instanci, ve které DO koordinují (${sc.doAis}).`,outDo.length?'Dvojí evidence koordinace; ověřit kapacitu koordinátorů na ruční zakládání.':'');
  // 4 jedna spisová služba
  const notUru=S.filter(s=>cfg(s).ss!==SS_URU); const veraUru=[];
  if(notUru.length) add('ss','Jedna spisová služba ÚRÚ','fail',`${notUru.length} pracovišť zůstává na spisové službě obce (${[...new Set(notUru.map(s=>cfg(s).ss))].join(', ')}) – v rozporu se zásadou „mnoho vstupů, jeden spis“.`,'Napojit všechna pracoviště na spisovou službu ÚRÚ ke Dni 1.');
  else add('ss','Jedna spisová služba ÚRÚ',veraUru.length?'warn':'ok',veraUru.length?`Všechna pracoviště na spisové službě ÚRÚ; ${veraUru.length} pracovišť ve VERA – napojení VERA na ESPIS není ověřené.`:'Všechna pracoviště používají spisovou službu ÚRÚ.',veraUru.length?'Ověřit napojení VERA na ESPIS.':'');
  // 5 ESZ a přehled o řízeních
  const rel=s=>{ const c=cfg(s); if(c.ais==='ISSŘ') return 1; if(sc.eszEnforced) return 1; return {'Ano':1,'Částečně':0.5,'Ne':0}[s.issr]??0; };
  const ez=S.reduce((a,s)=>a+s.agenda*rel(s),0)/totalAg*100;
  add('esz','ESZ a přehled o řízeních',ez>=P.eszOk?(sc.eszEnforced&&S.some(s=>cfg(s).ais!=='ISSŘ')?'warn':'ok'):ez>=P.eszFail?'warn':'fail',`Spolehlivě v ESZ je asi ${Math.round(ez)} % agendy kraje${sc.eszEnforced?' (předpoklad: smluvně vynucený plný zápis VITA/VERA do ESZ)':''}.`,ez<P.eszOk?'Bez úplné ESZ kraj nemá přehled o svých řízeních; náhradní index z denních extraktů.':(sc.eszEnforced&&S.some(s=>cfg(s).ais!=='ISSŘ')?'Smluvně vynutit plný zápis VITA/VERA do ESZ a obousměrnou synchronizaci stavu.':''));
  // 6 kapacita centrálních instancí
  const doU=subtreeUsers('Odbor integrovaných dotčených orgánů'), cU=subtreeUsers('Odbor stavebně správní'); const capRows=[];
  ['VITA'].forEach(ais=>{ const ss=S.filter(s=>cfg(s).ais===ais&&cfg(s).inst==='central'); let u=ss.reduce((a,s)=>a+siteUsers(s),0); if(sc.doAis===ais) u+=doU; if(sc.cAis===ais&&sc.cInst==='central') u+=cU; if(u) capRows.push({ais,u,max:P.maxUsers[ais]||1}); });
  if(!capRows.length) add('cap','Kapacita krajské instance','ok','Scénář nepočítá s krajskou instancí VITA.');
  capRows.forEach(r=>add('cap','Kapacita krajské instance '+r.ais,r.u>r.max?'fail':r.u>0.8*r.max?'warn':'ok',`Krajská instance ${r.ais}: asi ${r.u} uživatelů (míst) proti ověřenému maximu ${r.max}.`,r.u>0.8*r.max?`Zátěžový test instance ${r.ais} pro ${r.u} uživatelů a více útvarů.`:''));
  // 7 instance u obcí
  const loc=S.filter(s=>cfg(s).inst==='local');
  add('local','Instance u obcí',loc.length?'warn':'ok',loc.length?`${loc.length} pracovišť zůstává na instancích u obcí – provoz, zálohy a bezpečnost mimo přímou kontrolu ÚRÚ.`:'Žádná instance u obcí.',loc.length?'Smlouvy o součinnosti a provozu s obcemi; centrální rámcové smlouvy s dodavateli.':'');
  // 8 migrace
  const chg=S.filter(s=>cfg(s).ais!==s.ais&&cfg(s).ais!=='žádný'); const vv=chg.filter(s=>s.ais==='VERA'&&cfg(s).ais==='VITA'); const mig=chg.filter(s=>!vv.includes(s)); const ms=mig.reduce((a,s)=>a+(s.spisy||0),0);
  const prac=n=>n===1?'pracoviště':n<5?'pracoviště':'pracovišť';
  const vvTxt=vv.length?` ${vv.length} ${prac(vv.length)} přechází z VERA do VITA – VITA data převezme (${vv.map(s=>s.name).join(', ')}).`:'';
  add('mig','Migrace rozpracovaných řízení',mig.length?'warn':'ok',mig.length?`${mig.length} pracovišť mění agendový systém; nová řízení v cílovém systému, dobíhá asi ${ms} rozpracovaných spisů (převést jen dlouhý chvost).${vvTxt}`:(vv.length?vvTxt.trim():'Žádné pracoviště nemění agendový systém.'),mig.length?'Zkušební migrace; povinnost součinnosti obcí při předání dat.':'');
  const v=out.some(c=>c.status==='fail')?'fail':out.some(c=>c.status==='warn')?'warn':'ok';
  return {checks:out,verdict:v}; }
function verdictStat(){ const sc=curSc(); if(!sc) return ''; const a=assess(sc); const [t,c]=VERDICT[a.verdict];
  return `<div class="stat" title="aktivní scénář: ${esc(sc.name)}"><b style="color:${c};font-size:14px">${t}</b><span>scénář: ${esc(sc.name)}</span></div>`; }

// ---------- pohled Pracoviště a systémy ----------
function renderWs(){ const c=$('#v-ws'); const st=c.scrollTop; normKraj(); const K=state.kraj, sc=curSc(), ro=ROLE.org?'':'disabled'; const A=assess(sc); const [vt,vc]=VERDICT[A.verdict];
  const S=Object.values(K.sites).sort((a,b)=>a.name.localeCompare(b.name,'cs')); const ssOpts=[SS_URU,...new Set(S.map(s=>s.ss))];
  const sel=(cls,kod,opts,val,lbl)=>`<select class="${cls}" data-kod="${kod}" ${ro}>${opts.map(o=>`<option value="${esc(o)}" ${o===val?'selected':''}>${esc(lbl?lbl[o]:o)}</option>`).join('')}</select>`;
  const icon=s=>`<span class="sti st-${s}" title="${ST_LBL[s]}">${s==='ok'?'✓':s==='warn'?'!':'✕'}</span>`;
  const all=K.scenarios.map(x=>({x,a:assess(x)})); const names=[...new Set(all.flatMap(o=>o.a.checks.map(ch=>ch.name.replace(/ (VITA|VERA)$/,''))))];
  c.innerHTML=`<div class="pad wide">
    <div class="row screw"><b>Scénář Dne 1:</b><select id="scSel">${K.scenarios.map(x=>`<option value="${x.id}" ${x===sc?'selected':''}>${esc(x.name)}</option>`).join('')}</select>
      ${ROLE.org?'<button id="scDup">Duplikovat</button><button id="scRen">Přejmenovat</button><button id="scDel" style="color:var(--danger)">Smazat</button>':''}<span class="muted">${esc(sc.desc||'')}</span></div>
    <div class="verdict" style="border-color:${vc}"><div class="vt" style="color:${vc}">${vt.toUpperCase()}</div><div class="muted">${esc(KRAJ)} · ${S.length} územních pracovišť · posouzení podle parametrů v pravém panelu</div></div>
    <div class="checks">${A.checks.map(ch=>`<div class="chk st-${ch.status}">${icon(ch.status)}<div><b>${esc(ch.name)}</b><div>${esc(ch.text)}</div>${ch.cond?`<div class="cond">${ch.status==='fail'?'Řešení':'Podmínka'}: ${esc(ch.cond)}</div>`:''}</div></div>`).join('')}</div>
    <h3>Pracoviště ve scénáři <span class="muted" style="font-weight:400">– žlutě, kde se mění systém proti dnešku</span></h3>
    ${ROLE.org?`<div class="row bulk">Všem pracovištím: ${sel('bAis','',['',...AIS_SC],'',Object.fromEntries([['','— AIS —'],...AIS_SC.map(x=>[x,x])]))} ${sel('bInst','',['',...Object.keys(INST)],'',{'':'— instance —',...INST})} ${sel('bSs','',['',...ssOpts],'',Object.fromEntries([['','— spisová služba —'],...ssOpts.map(x=>[x,x])]))} <button id="bApply" class="small">Nastavit</button></div>`:''}
    <div class="tw"><table class="tbl ws"><thead><tr><th>Pracoviště</th><th title="systemizovaná místa v krajském organigramu">Míst</th><th title="úkony 2025">Agenda</th><th title="rozpracované spisy">Spisy</th><th>ISSŘ dnes</th><th>AIS dnes</th><th>Spis. služba dnes</th><th class="sc">AIS ve scénáři</th><th class="sc">Instance</th><th class="sc">Spis. služba ve scénáři</th></tr></thead><tbody>
    ${S.map(s=>{ const g=sc.sites[s.kod]||{}; return `<tr data-kod="${s.kod}" class="${K.selSite==s.kod?'sel':''}"><td><a href="#" class="siteLink">${esc(s.name)}</a>${s.riziko==='Vysoké'?' <span class="tagr" title="riziko IT vysoké">IT!</span>':''}</td><td>${siteUsers(s)}</td><td>${s.agenda||'—'}</td><td>${s.spisy||'—'}</td><td>${esc(s.issr)}</td><td>${esc(s.ais)}</td><td>${esc(s.ss)}</td>
      <td class="sc${g.ais!==s.ais?' chg':''}">${sel('sAis',s.kod,AIS_SC,g.ais)}</td><td class="sc">${sel('sInst',s.kod,Object.keys(INST),g.inst,INST)}</td><td class="sc${g.ss!==s.ss?' chg':''}">${sel('sSs',s.kod,ssOpts,g.ss)}</td></tr>`; }).join('')}</tbody></table></div>
    <h3>Porovnání scénářů</h3>
    <div class="tw"><table class="tbl cmp"><thead><tr><th>Kontrola</th>${all.map(o=>`<th class="${o.x===sc?'on':''}"><a href="#" data-sc="${o.x.id}">${esc(o.x.name)}</a></th>`).join('')}</tr></thead><tbody>
    ${names.map(n=>`<tr><td>${esc(n)}</td>${all.map(o=>{ const cs=o.a.checks.filter(ch=>ch.name.replace(/ (VITA|VERA)$/,'')===n); const s=cs.some(x=>x.status==='fail')?'fail':cs.some(x=>x.status==='warn')?'warn':cs.length?'ok':null; return `<td class="${o.x===sc?'on':''}" title="${esc(cs.map(x=>x.text).join('\n'))}">${s?icon(s):'—'}</td>`; }).join('')}</tr>`).join('')}
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
      <label>Spisová služba dnes<input type="text" id="xsSs" value="${esc(site.ss)}" ${ro}></label>
      <label>Agenda 2025 (úkony)<input type="number" id="xsAg" value="${site.agenda||0}" ${ro}></label>
      <label>Rozpracované spisy<input type="number" id="xsSp" value="${site.spisy||0}" ${ro}></label>
      <label>Archiv (bm)<input type="number" id="xsAr" value="${site.archiv||0}" ${ro}></label></div>
      <p class="muted" style="font-size:12px;margin-top:10px">Výchozí hodnoty z tabulky URU_prehled_ORP_ver1.xlsx (MMR, 2026). Počet míst se bere z krajského organigramu.</p>`;
    $('#sClose').onclick=()=>{ K.selSite=null; render(); }; if(!ROLE.org) return;
    const ch=(id,fn)=>$(id).onchange=()=>{ fn($(id).value); save('pracoviště',site.name); };
    ch('#xsAis',v=>site.ais=v); ch('#xsIssr',v=>site.issr=v); ch('#xsSs',v=>site.ss=v.trim()||site.ss); ch('#xsAg',v=>site.agenda=Math.max(0,+v||0)); ch('#xsSp',v=>site.spisy=Math.max(0,+v||0)); ch('#xsAr',v=>site.archiv=Math.max(0,+v||0));
    return; }
  s.innerHTML=`<div class="sh"><span class="muted">Scénář</span></div>
    <label>Popis<textarea id="scDesc" rows="3" ${ro}>${esc(sc.desc||'')}</textarea></label>
    <div class="g2"><label>DO na centrále koordinují v<select id="scDo" ${ro}>${AIS_SC.filter(x=>x!=='žádný').map(o=>`<option ${o===sc.doAis?'selected':''}>${o}</option>`).join('')}</select></label>
    <label>Centrála (složitější stavby)<select id="scCa" ${ro}>${AIS_SC.filter(x=>x!=='žádný').map(o=>`<option ${o===sc.cAis?'selected':''}>${o}</option>`).join('')}</select></label></div>
    <label style="display:flex;gap:6px;align-items:center;color:var(--ink);font-size:13px;margin-top:10px"><input type="checkbox" id="scEsz" style="width:auto" ${sc.eszEnforced?'checked':''} ${ro}> smluvně vynucený plný zápis VITA/VERA do ESZ</label>
    <div class="lbl" style="margin-top:18px">Parametry posouzení (pro všechny scénáře)</div>
    <div class="g2"><label>Max. uživatelů VITA<input type="number" id="pVita" value="${P.maxUsers.VITA}" ${ro}></label><span></span>
    <label>AIS v kraji – podmínka od<input type="number" id="pAw" value="${P.aisWarn}" min="1" ${ro}></label><label>AIS v kraji – překážka od<input type="number" id="pAf" value="${P.aisFail}" min="1" ${ro}></label>
    <label>Ruční přesun – překážka od (% dvojic)<input type="number" id="pMv" value="${P.moveFail}" ${ro}></label><label>DO mimo instanci – překážka od (% agendy)<input type="number" id="pDo" value="${P.doFail}" ${ro}></label>
    <label>ESZ v pořádku od (% agendy)<input type="number" id="pEo" value="${P.eszOk}" ${ro}></label><label>ESZ překážka pod (% agendy)<input type="number" id="pEf" value="${P.eszFail}" ${ro}></label></div>
    <p class="muted" style="font-size:12px;margin-top:10px">Maximum VITA vychází z největší dnešní instance (cca 150 uživatelů). S provozem VERA se nepočítá – VITA data z VERA převezme. Prahy jsou výchozí hodnoty k diskusi.</p>
    <p class="muted" style="font-size:12px">Kliknutím na název pracoviště v tabulce upravíte jeho dnešní stav.</p>`;
  if(!ROLE.org) return; const P2=(id,fn)=>$(id).onchange=()=>{ fn(+$(id).value||0); save('parametry posouzení'); };
  $('#scDesc').onchange=e=>{ sc.desc=e.target.value; save('scénář','popis'); };
  $('#scDo').onchange=e=>{ sc.doAis=e.target.value; save('scénář','DO v '+sc.doAis); }; $('#scCa').onchange=e=>{ sc.cAis=e.target.value; sc.cInst=sc.cAis==='ISSŘ'?'national':'central'; save('scénář','centrála v '+sc.cAis); };
  $('#scEsz').onchange=e=>{ sc.eszEnforced=e.target.checked; save('scénář','zápis do ESZ'); };
  P2('#pVita',v=>P.maxUsers.VITA=v); P2('#pAw',v=>P.aisWarn=v); P2('#pAf',v=>P.aisFail=v); P2('#pMv',v=>P.moveFail=v); P2('#pDo',v=>P.doFail=v); P2('#pEo',v=>P.eszOk=v); P2('#pEf',v=>P.eszFail=v); }

// ---------- export ----------
function exportKraj(wb,X){ normKraj(); const K=state.kraj; const S=Object.values(K.sites);
  X.utils.book_append_sheet(wb,X.utils.json_to_sheet(S.map(s=>{ const r={'Pracoviště':s.name,'ORP':s.kod,'Míst':siteUsers(s),'Agenda 2025':s.agenda,'Rozpracované spisy':s.spisy,'Archiv (bm)':s.archiv,'ISSŘ dnes':s.issr,'AIS dnes':s.ais,'Spisová služba dnes':s.ss,'Riziko IT':s.riziko};
    K.scenarios.forEach((x,i)=>{ const g=x.sites[s.kod]||{}; r[`S${i+1} AIS`]=g.ais; r[`S${i+1} instance`]=INST[g.inst]||g.inst; r[`S${i+1} spis. služba`]=g.ss; }); return r; })),'Pracoviště');
  const rows=[]; K.scenarios.forEach((x,i)=>{ const a=assess(x); rows.push({'Scénář':`S${i+1} ${x.name}`,'Kontrola':'VERDIKT','Stav':VERDICT[a.verdict][0],'Zjištění':x.desc||'','Podmínka / řešení':''}); a.checks.forEach(ch=>rows.push({'Scénář':`S${i+1} ${x.name}`,'Kontrola':ch.name,'Stav':ST_LBL[ch.status],'Zjištění':ch.text,'Podmínka / řešení':ch.cond})); });
  X.utils.book_append_sheet(wb,X.utils.json_to_sheet(rows),'Posouzení scénářů'); }
function wireKraj(){}
