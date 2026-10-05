// Výchozí návrh TOM krajského ÚRÚ (modelový kraj: Kraj Vysočina) – použije se jen při prvním spuštění (prázdný řádek 'tom-kraj').
// Přiřazení útvarů se zadávají výběrem z krajského organigramu: 'R:root' = ředitel kraje, 'n:Název' = útvar podle názvu, 'L:up' = všechna územní pracoviště.
// Vše je pracovní návrh k diskusi; rozhodnutí R1–R11 odkazují na TOM soustavy ÚRÚ.
window.TOM_SEED = {
  groups: [
    {id:'g1', name:'Rozhodování – 1. stupeň', color:'#4472C4'},
    {id:'g2', name:'Integrované dotčené orgány', color:'#70AD47'},
    {id:'g3', name:'Územní plánování', color:'#0E9AA7'},
    {id:'g4', name:'Klientské služby na pracovištích', color:'#C79400'},
    {id:'g5', name:'Řízení kraje', color:'#1B2430'},
    {id:'g6', name:'Sdílené služby (řízené z ÚRÚ ČR)', color:'#ED7D31'}
  ],
  funcs: [
    {id:'k01', g:'g1', type:'vykon', name:'Povolování běžných staveb (územní pracoviště)', refs:'R4, R8', a:[['R:root','own'],['L:up','do']]},
    {id:'k02', g:'g1', type:'vykon', name:'Povolování složitějších staveb (centrála kraje)', refs:'R4', desc:'Kritéria „složitější stavby“ zatím chybí.', a:[['n:Odbor stavebně správní','own'],['n:Oddělení stavebně správní I','do'],['n:Oddělení stavebně správní II','do']]},
    {id:'k03', g:'g5', type:'rizeni', name:'Řízení a podpora územních pracovišť, přesun věcí', refs:'R1, R4', desc:'Centrála i ÚP jsou jeden správní orgán – věc lze přesunout bez postoupení. Pravidla přesunu (vytížení, podjatost) chybí.', a:[['R:root','own'],['n:Odbor stavebně správní','do']]},
    {id:'k04', g:'g2', type:'vykon', name:'Ochrana životního prostředí (integrované DO)', refs:'R3, R11', a:[['n:Odbor integrovaných dotčených orgánů','own'],['n:Oddělení ochrany životního prostředí','do']]},
    {id:'k05', g:'g2', type:'vykon', name:'Ochrana ostatních veřejných zájmů (integrované DO)', refs:'R3, R11', a:[['n:Odbor integrovaných dotčených orgánů','own'],['n:Oddělení ochrany ostatních veřejných zájmů','do']]},
    {id:'k06', g:'g2', type:'vykon', name:'Koordinace DO a koordinované vyjádření', refs:'R11', desc:'Pro všechna pracoviště kraje bez ohledu na jejich agendový systém.', a:[['n:Odbor integrovaných dotčených orgánů','own']]},
    {id:'k07', g:'g3', type:'vykon', name:'Pořizování ÚPD za obce, které to nezvládnou', refs:'R7', a:[['n:Odbor územního plánování','own'],['n:Oddělení územně plánovací','do']]},
    {id:'k08', g:'g3', type:'vykon', name:'Územně analytické podklady kraje', a:[['n:Odbor územního plánování','own']]},
    {id:'k09', g:'g4', type:'podpora', name:'Podatelna a příjem podání (všechny kanály)', refs:'R6', desc:'Mnoho vstupů, jeden spis.', a:[['R:root','own'],['L:up','do']]},
    {id:'k10', g:'g4', type:'podpora', name:'Konzultace pro žadatele', refs:'R6', a:[['R:root','own'],['L:up','do']]},
    {id:'k11', g:'g5', type:'rizeni', name:'Řízení krajského ÚRÚ a kancelář ředitele', a:[['R:root','own'],['n:Samostatné oddělení kanceláře ředitele','do']]},
    {id:'k12', g:'g6', type:'podpora', name:'Personalistika', refs:'R5', a:[['n:Odbor personální, ekonomický a provozní','own'],['n:Oddělení personální','do']]},
    {id:'k13', g:'g6', type:'podpora', name:'Ekonomika', refs:'R5, R10', a:[['n:Odbor personální, ekonomický a provozní','own'],['n:Oddělení ekonomické','do']]},
    {id:'k14', g:'g6', type:'podpora', name:'Provoz a IT podpora pracovišť', refs:'R5', a:[['n:Odbor personální, ekonomický a provozní','own'],['n:Oddělení provozní a IT','do']]}
  ],
  sums: [
    {id:'s1', g:'g2', name:'Integrované dotčené orgány', children:['k04','k05','k06']},
    {id:'s2', g:'g6', name:'Sdílené služby', children:['k12','k13','k14']}
  ],
  actors: [
    {id:'a1', cat:'zad', name:'Stavebníci a žadatelé', ch:['portal','ds','email','osobne']},
    {id:'a2', cat:'zad', name:'Účastníci řízení a veřejnost', ch:['ds','email','osobne','listinne']},
    {id:'a3', cat:'sam', name:'Obce (pořizovatelé ÚPD, vlastníci budov)', ch:['ds']},
    {id:'a4', cat:'sous', name:'ÚRÚ ČR (centrála soustavy)', ch:['ds']},
    {id:'a5', cat:'stat', name:'Nezaintegrované dotčené orgány', ch:['ds']},
    {id:'a6', cat:'kon', name:'Soudy', ch:['ds']}
  ],
  systems: [
    {id:'y1', st:'portal', ss:'stav', name:'Portál stavebníka', admin:'ÚRÚ ČR (centrálně)'},
    {id:'y2', st:'agenda', ss:'stav', name:'ISSŘ', admin:'ÚRÚ ČR (centrálně)', desc:'Není napojené na spisovou službu – vlastní evidence (ESZ a správa dokumentací = ořezaný GINIS), samo přiděluje spisové značky a č. j. Nemá funkcionalitu integrovaných DO; jako agendový systém nedosahuje funkčnosti VITA.'},
    {id:'y3', st:'registr', ss:'stav', name:'Evidence stavebních záměrů (ESZ)', admin:'ÚRÚ ČR (centrálně)'},
    {id:'y4', st:'agenda', ss:'stav', name:'VITA', admin:'dodavatel VITA; instance u obcí'},
    {id:'y6', st:'spis', ss:'novy', name:'Spisová služba ÚRÚ (ESPIS)', admin:'ÚRÚ ČR (centrálně)', all:'evidence a oběh dokumentů, spisy'},
    {id:'y7', st:'externi', ss:'stav', name:'Obecní spisové služby (GINIS, EZOP, e-Spis, VERA…)', admin:'obce', desc:'Na Vysočině dnes 4 známé (VERA, GINIS, EZOP, ICZ e-Spis), u 3 pracovišť neuvedeno; ke Dni 1 se nepřebírají.'},
    {id:'y8', st:'externi', ss:'stav', name:'ISDS – datové schránky', admin:'Digitální a informační agentura'},
    {id:'y9', st:'externi', ss:'stav', name:'Základní registry', admin:'Digitální a informační agentura'},
    {id:'y10', st:'portal', ss:'stav', name:'NGÚP', admin:'ÚRÚ ČR (centrálně)'},
    {id:'y11', st:'podpora', ss:'stav', name:'Personální systém (VEMA)', admin:'ÚRÚ ČR (centrálně)', all:'docházka, dovolené, výplatní pásky'},
    {id:'y12', st:'podpora', ss:'stav', name:'Ekonomický systém (MÚZO)', admin:'ÚRÚ ČR (centrálně)'}
  ],
  links2: [
    ['a1','k09','zada'],['a1','y1','zada','podání přes portál'],['a2','a4','odvolava','odvolání míří na ÚRÚ ČR (R2)'],['a5','k01','stanovisko'],['a5','k02','stanovisko'],
    ['a4','k03','metodika','metodika, řízení soustavy'],['a4','s2','ridi','sdílené služby řízené centrálně (R5)'],['k07','a3','sluzba','pořízení ÚPD za obec'],['a3','k07','zada','žádost o převzetí pořizování'],
    ['k01','y4','pouziva','všechna pracoviště (VERA převedena do VITA)'],['k01','y2','pouziva','částečně'],['k02','y4','pouziva'],['s1','y4','pouziva','koordinované stanovisko jen ve VITA'],
    ['k07','y10','pouziva'],['k08','y10','pouziva'],['k09','y6','pouziva'],['k14','y4','spravuje','podpora uživatelů'],
    ['a4','y1','spravuje'],['a4','y2','spravuje'],['a4','y3','spravuje'],['a4','y6','spravuje'],['a4','y10','spravuje'],['a4','y11','spravuje'],['a4','y12','spravuje'],
    ['y1','y2','data'],['y2','y3','data'],['y4','y3','data','zatím neúplně'],['y8','y6','data'],['y4','y6','data','napojení – k ověření'],['y6','y2','data','integrace eSSL → ISSŘ (předávání podání)',1],
    ['k02','k01','predava','přesun věci mezi centrálou a ÚP'],['a6','k01','odvolani','správní žaloba'],['a6','k02','odvolani','správní žaloba'],['k01','s1','predava','žádost o koordinované vyjádření']
  ],
  links: [],
  rules: [],
  roles: [
    {id:'r_pod', name:'Podatelna ÚP', func:'k09'},
    {id:'r_vupA', name:'Vedoucí předávajícího ÚP', func:'k01'},
    {id:'r_rupA', name:'Referent předávajícího ÚP', func:'k01'},
    {id:'r_vupB', name:'Vedoucí přebírajícího ÚP', func:'k01'},
    {id:'r_rupB', name:'Referent přebírajícího ÚP', func:'k01'},
    {id:'r_rup', name:'Referent ÚP', func:'k01'},
    {id:'r_kdo', name:'Koordinátor DO', func:'k06'},
    {id:'r_ido', name:'Interní DO (úsek)', func:'s1'}
  ],
  processes: [
    {id:'p1', name:'Přesun věci mezi pracovišti na různých instancích VITA', desc:'Např. z ÚP s instancí VITA u obce na ÚP s jinou instancí (vytížení, podjatost). Bez postoupení – jeden správní orgán (R1). Na společné krajské instanci odpadá.',
     lanes:[['L1',null,'r_vupA'],['L2',null,'r_rupA'],['L3','y4'],['L4','y6'],['L5',null,'r_vupB'],['L6',null,'r_rupB'],['L7','y4']],
     steps:[['s1','L1',0,'Rozhodne o přesunu věci','decision',null,null,'Pravidla přesunu (vytížení, podjatost) zatím chybí.'],
       ['s2','L2',1,'Uzavře věc ve své instanci, připraví předání','step','y4'],
       ['s3','L3',2,'Export spisu a stavu řízení','step',null,null,'Přenos mezi dvěma instancemi VITA – k ověření.'],
       ['s4','L4',3,'Předání dokumentů přes spisovou službu ÚRÚ'],
       ['s5','L5',4,'Přidělí věc referentovi','step','y6'],
       ['s6','L6',5,'Ručně založí řízení a přepíše stav','step','y4',null,'Ruční převod: riziko chyb, ztráta historie, dvojí evidence v ESZ.'],
       ['s7','L7',6,'Řízení pokračuje ve VITA','end']],
     flows:[['s1','s2','přesunout'],['s2','s3'],['s3','s4'],['s4','s5'],['s5','s6'],['s6','s7']]},
    {id:'p2', name:'Koordinované vyjádření DO pro pracoviště na instanci VITA u obce', desc:'Integrované DO koordinují v krajské instanci VITA; řízení vedené v instanci u obce do ní nevidí. Na společné krajské instanci odpadá.',
     lanes:[['L1',null,'r_rup'],['L2','y4'],['L3','y6'],['L4',null,'r_kdo'],['L5',null,'r_ido'],['L6','y4']],
     steps:[['s1','L1',0,'Požádá o koordinované vyjádření','start','y4'],
       ['s2','L3',1,'Žádost a podklady jako dokument ve spisové službě'],
       ['s3','L4',2,'Ručně založí koordinaci v krajské instanci','step','y4',null,'Dvojí evidence téže věci (instance u obce + krajská instance).'],
       ['s4','L5',3,'Posoudí za svůj úsek','step','y4'],
       ['s5','L4',4,'Sestaví a podepíše KV','step','y4'],
       ['s6','L3',5,'KV zpět jako dokument'],
       ['s7','L1',6,'Vloží KV do své instance jako podklad','end','y4']],
     flows:[['s1','s2'],['s2','s3'],['s3','s4'],['s4','s5'],['s5','s6'],['s6','s7']]},
    {id:'p3', name:'Podání mimo Portál do řízení vedeného v ISSŘ', desc:'ISSŘ není napojené na spisovou službu: podání doručená DS, e-mailem nebo osobně se evidují ve spisové službě ÚRÚ a do ISSŘ se dnes musí zadat ručně.',
     lanes:[['L1','a1'],['L2',null,'r_pod'],['L3',null,'r_rup'],['L4','y2']],
     steps:[['s1','L1',0,'Podá žádost nebo doplnění','start',null,['ds','email','osobne']],
       ['s2','L2',1,'Zaeviduje ve spisové službě ÚRÚ (č. j. ESPIS)','step','y6'],
       ['s3','L3',2,'Převezme dokument ve spisové službě','step','y6'],
       ['s4','L3',3,'Ručně vloží dokument do ISSŘ (č. j. ISSŘ)','step','y2',null,'Dvojí evidence a dvě řady č. j. Řešení: urgentní vývoj integrace eSSL → ISSŘ a procesy předávání.'],
       ['s5','L4',4,'Řízení pokračuje v ISSŘ','end']],
     flows:[['s1','s2'],['s2','s3'],['s3','s4'],['s4','s5']]},
    {id:'p4', name:'Koordinované vyjádření DO pro řízení vedené v ISSŘ (kombinace VITA + ISSŘ)', desc:'DO koordinují v krajské VITA, řízení a dokumentace jsou v ISSŘ. Bez integrace VITA ↔ ISSŘ se podklady i výsledek předávají ručně přes spisovou službu a DO pracují ve dvou systémech.',
     lanes:[['L1',null,'r_rup'],['L2','y2'],['L3','y6'],['L4',null,'r_kdo'],['L5',null,'r_ido'],['L6','y4']],
     steps:[['s1','L1',0,'Požádá o koordinované vyjádření','start','y2'],
       ['s2','L2',1,'Dokumentace zůstává v ISSŘ','step',null,null,'Podklady pro DO nejsou ve VITA – export nebo přístup DO do ISSŘ.'],
       ['s3','L3',2,'Žádost a podklady jako dokument (č. j. ESPIS)'],
       ['s4','L4',3,'Ručně založí koordinaci ve VITA','step','y4',null,'Dvojí evidence téže věci (ISSŘ + VITA).'],
       ['s5','L5',4,'Posoudí – dokumentaci čte v ISSŘ, vyjádření píše ve VITA','step','y4',null,'DO pracují ve dvou systémech.'],
       ['s6','L4',5,'Sestaví a podepíše KV','step','y4'],
       ['s7','L3',6,'KV zpět jako dokument'],
       ['s8','L1',7,'Ručně vloží KV do ISSŘ jako podklad','end','y2',null,'Řešení: obousměrná integrace VITA ↔ ISSŘ, nebo řízení v jednom systému.']],
     flows:[['s1','s2'],['s2','s3'],['s3','s4'],['s4','s5'],['s5','s6'],['s6','s7'],['s7','s8']]}
  ]
};
// Pracoviště kraje – stav systémů podle tabulky URU_prehled_ORP_ver1.xlsx (MMR, data z území 2026).
// ais = hlavní agendový systém kotevního úřadu; ss = spisová služba; issr = používání ISSŘ; agenda = úkony 2025; spisy = rozpracované spisy; archiv = běžné metry.
// su = počet slučovaných stavebních úřadů (suList); nAis / nSs = počet různých agendových programů / spisových služeb v ORP; mistaAll / mistaKot = pracovní místa všech / kotevního úřadu;
// spisySu, swSu, archSu = u kolika úřadů jsou data o spisech / software / archivu (data za jednotlivé zrušené úřady tabulka nemá).
window.TOM_KRAJ = { kraj:'Kraj Vysočina', sites: [{"kod": 6101, "name": "Bystřice nad Pernštejnem", "ais": "VITA", "ss": "neuvedeno", "issr": "Ne", "agenda": 752, "spisy": 400, "archiv": 900, "riziko": "Střední", "dnes": 6, "potreba": 7, "su": 1, "suList": "Městský úřad Bystřice nad Pernštejnem", "nAis": 1, "nSs": 0, "mistaAll": 10, "mistaKot": 10, "spisySu": 1, "swSu": 1, "archSu": 1}, {"kod": 6102, "name": "Havlíčkův Brod", "ais": "VITA", "ss": "EZOP (SoftHouse)", "issr": "Ne", "agenda": 1603, "spisy": 30, "archiv": 1181, "riziko": "Vysoké", "dnes": 18, "potreba": 18, "su": 5, "suList": "Městský úřad Golčův Jeníkov; MÚ Habry; Městský úřad Havlíčkův Brod; Městský úřad Přibyslav; Úřad městyse Štoky", "nAis": 1, "nSs": 3, "mistaAll": 26, "mistaKot": null, "spisySu": 1, "swSu": 1, "archSu": 1}, {"kod": 6103, "name": "Humpolec", "ais": "VERA", "ss": "VERA", "issr": "Částečně", "agenda": 515, "spisy": null, "archiv": 392, "riziko": "Střední", "dnes": 4, "potreba": 4.5, "su": 1, "suList": "Městský úřad Humpolec", "nAis": 1, "nSs": 1, "mistaAll": 7, "mistaKot": 7, "spisySu": 0, "swSu": 1, "archSu": 0}, {"kod": 6104, "name": "Chotěboř", "ais": "VERA", "ss": "VERA", "issr": "Ne", "agenda": 607, "spisy": 185, "archiv": 449, "riziko": "Střední", "dnes": 9, "potreba": 9, "su": 2, "suList": "Městský úřad Chotěboř; Ždírec nad Doubravou", "nAis": 1, "nSs": 1, "mistaAll": 9.6, "mistaKot": 7, "spisySu": 1, "swSu": 1, "archSu": 1}, {"kod": 6105, "name": "Jihlava", "ais": "VITA", "ss": "VERA", "issr": "Částečně", "agenda": 2477, "spisy": 984, "archiv": 1801, "riziko": "Vysoké", "dnes": 34, "potreba": 37, "su": 5, "suList": "Magistrát města Jihlavy; Městský úřad Brtnice; Úřad městyse Batelova; Městský úřad Polná; Městský úřad Třešť", "nAis": 1, "nSs": 2, "mistaAll": 49.6, "mistaKot": 39, "spisySu": 4, "swSu": 4, "archSu": 4}, {"kod": 6106, "name": "Moravské Budějovice", "ais": "VITA", "ss": "GORDIC/GINIS", "issr": "Ano", "agenda": 769, "spisy": 160, "archiv": 601, "riziko": "Nízké", "dnes": 5, "potreba": 9, "su": 2, "suList": "Městský úřad Jemnice; Městský úřad Moravské Budějovice", "nAis": 1, "nSs": 1, "mistaAll": 11.6, "mistaKot": 9, "spisySu": 1, "swSu": 1, "archSu": 1}, {"kod": 6107, "name": "Náměšť nad Oslavou", "ais": "VITA", "ss": "GORDIC/GINIS", "issr": "Částečně", "agenda": 611, "spisy": null, "archiv": 336, "riziko": "Střední", "dnes": 6, "potreba": 6, "su": 1, "suList": "MěÚ Náměšť nad Oslavou", "nAis": 1, "nSs": 1, "mistaAll": 7.8, "mistaKot": null, "spisySu": 0, "swSu": 0, "archSu": 0}, {"kod": 6108, "name": "Nové Město na Moravě", "ais": "VITA", "ss": "neuvedeno", "issr": "Ne", "agenda": 649, "spisy": 166, "archiv": 604, "riziko": "Střední", "dnes": 6, "potreba": 6, "su": 1, "suList": "MěÚ Nové Město na Moravě", "nAis": 1, "nSs": 0, "mistaAll": 10, "mistaKot": 10, "spisySu": 1, "swSu": 1, "archSu": 1}, {"kod": 6109, "name": "Pacov", "ais": "VITA", "ss": "neuvedeno", "issr": "Ne", "agenda": 606, "spisy": null, "archiv": 392, "riziko": "Střední", "dnes": 5, "potreba": 10, "su": 1, "suList": "Městský úřad Pacov", "nAis": 1, "nSs": 0, "mistaAll": 9.1, "mistaKot": null, "spisySu": 0, "swSu": 0, "archSu": 0}, {"kod": 6110, "name": "Pelhřimov", "ais": "VITA", "ss": "ICZ e-Spis", "issr": "Ne", "agenda": 1069, "spisy": 228, "archiv": 1111, "riziko": "Vysoké", "dnes": 13, "potreba": 17, "su": 6, "suList": "Městský úřad Černovice; Městský úřad Horní Cerekev; Městský úřad Kamenice nad Lipou; Městský úřad Pelhřimov; Městský úřad Počátky; Městský úřad Žirovnice", "nAis": 1, "nSs": 4, "mistaAll": 24.7, "mistaKot": null, "spisySu": 3, "swSu": 4, "archSu": 3}, {"kod": 6111, "name": "Světlá nad Sázavou", "ais": "VITA", "ss": "EZOP (SoftHouse)", "issr": "Částečně", "agenda": 547, "spisy": 40, "archiv": 653, "riziko": "Střední", "dnes": 11, "potreba": 11, "su": 2, "suList": "Městský úřad Ledeč nad Sázavou; Světlá nad Sázavou", "nAis": 1, "nSs": 2, "mistaAll": 14.3, "mistaKot": null, "spisySu": 1, "swSu": 1, "archSu": 1}, {"kod": 6112, "name": "Telč", "ais": "VITA", "ss": "GORDIC/GINIS", "issr": "Částečně", "agenda": 844, "spisy": 6, "archiv": 368, "riziko": "Střední", "dnes": 6, "potreba": 6.7, "su": 2, "suList": "Úřad Městyse Nová Říše; Městský úřad Telč", "nAis": 1, "nSs": 1, "mistaAll": 4, "mistaKot": 3, "spisySu": 1, "swSu": 2, "archSu": 2}, {"kod": 6113, "name": "Třebíč", "ais": "VERA", "ss": "VERA", "issr": "Částečně", "agenda": 1978, "spisy": 570, "archiv": 1716, "riziko": "Vysoké", "dnes": 27, "potreba": 28, "su": 4, "suList": "Městský úřad Hrotovice; Městský úřad Jaroměřice nad Rokytnou; Městys Okříšky; Městský úřad Třebíč", "nAis": 2, "nSs": 2, "mistaAll": 39, "mistaKot": null, "spisySu": 2, "swSu": 2, "archSu": 1}, {"kod": 6114, "name": "Velké Meziříčí", "ais": "VERA", "ss": "VERA", "issr": "Částečně", "agenda": 939, "spisy": 304, "archiv": 721, "riziko": "Střední", "dnes": 11, "potreba": 11, "su": 2, "suList": "Městský úřad Velká Bíteš; Městský úřad Velké Meziříčí", "nAis": 1, "nSs": 1, "mistaAll": 17, "mistaKot": 12, "spisySu": 2, "swSu": 2, "archSu": 1}, {"kod": 6115, "name": "Žďár nad Sázavou", "ais": "VITA", "ss": "ICZ e-Spis", "issr": "Ne", "agenda": 1148, "spisy": 597, "archiv": 728, "riziko": "Střední", "dnes": 12, "potreba": 12, "su": 1, "suList": "Městský úřad Žďár nad Sázavou", "nAis": 1, "nSs": 1, "mistaAll": 6, "mistaKot": 6, "spisySu": 1, "swSu": 1, "archSu": 0}] };
