// Výchozí návrh modelu TOM ÚRÚ ČR – použije se jen při prvním spuštění (prázdný řádek 'tom-cr').
// Přiřazení odkazují na id útvarů organigramu ÚRÚ ČR (structure.js, verze 4). Vše je pracovní návrh k diskusi.
// role: own = vlastník (odpovídá), do = vykonává, sup = podporuje.   období: '2027' = kontroluje se, '2028' = výhled soustavy.
window.TOM_SEED = {
  groups: [
    {id:'g1', name:'Rozhodování – vyhrazené stavby a bydlení', color:'#4472C4'},
    {id:'g3', name:'Integrované dotčené orgány', color:'#70AD47'},
    {id:'g2', name:'Odvolání a přezkum', color:'#B42318'},
    {id:'g4', name:'Územní plánování', color:'#0E9AA7'},
    {id:'g5', name:'Metodika a legislativa', color:'#7C3AED'},
    {id:'g6', name:'Příprava soustavy 2028', color:'#C79400'},
    {id:'g7', name:'Řízení úřadu', color:'#1B2430'},
    {id:'g8', name:'Podpůrné a sdílené služby', color:'#ED7D31'}
  ],
  funcs: [
    {id:'f01', g:'g1', type:'vykon', name:'Povolování vyhrazených staveb pozemních komunikací', a:[['u27','own'],['u28','do'],['u29','do']]},
    {id:'f02', g:'g1', type:'vykon', name:'Povolování vyhrazených staveb drah', a:[['u30','own'],['u31','do'],['u32','do'],['u33','do'],['u34','do']]},
    {id:'f03', g:'g1', type:'vykon', name:'Povolování civilních leteckých staveb', a:[['u27','own'],['u35','do']]},
    {id:'f04', g:'g1', type:'vykon', name:'Povolování vodních děl a staveb pro vodní dopravu', a:[['u27','own'],['u36','do']]},
    {id:'f05', g:'g1', type:'vykon', name:'Povolování energetických a průmyslových staveb', a:[['u37','own'],['u38','do'],['u39','do'],['u40','do'],['u41','do']]},
    {id:'f06', g:'g1', type:'vykon', name:'Povolování staveb pro bydlení', desc:'Rozsah agendy podle novely – k ověření.', a:[['u03','own'],['u04','do'],['u05','do'],['u06','do']]},
    {id:'f07', g:'g1', type:'vykon', name:'Vyvlastnění', a:[['u27','own'],['u42','do'],['u43','do']]},
    {id:'f08', g:'g2', type:'odvolani', name:'Rozklad proti rozhodnutím ÚRÚ ČR', refs:'R2', desc:'U vyhrazených staveb rozhoduje o rozkladu předseda.', a:[['u01','own'],['u44','do'],['u45','do']]},
    {id:'f09', g:'g2', type:'odvolani', name:'Odvolání a přezkum proti rozhodnutím krajských úřadů', a:[['u10','own'],['u11','do'],['u12','do'],['u13','do']]},
    {id:'f10', g:'g3', type:'vykon', name:'Ochrana životního prostředí (integrované DO)', refs:'R11', a:[['u47','own'],['u48','do'],['u49','do'],['u50','do']]},
    {id:'f11', g:'g3', type:'vykon', name:'Ochrana ostatních veřejných zájmů a veřejného zdraví (integrované DO)', refs:'R11', a:[['u51','own'],['u52','do'],['u53','do'],['u54','do']]},
    {id:'f12', g:'g4', type:'vykon', name:'Územně analytické podklady a informace o území', a:[['u07','own'],['u08','do']]},
    {id:'f13', g:'g4', type:'vykon', name:'Zpracování územně plánovací dokumentace', a:[['u07','own'],['u09','do']]},
    {id:'f14', g:'g4', type:'podpora', name:'Národní geoportál územního plánování (NGÚP)', a:[['u55','own'],['u56','do'],['u57','do']]},
    {id:'f15', g:'g5', type:'metodika', name:'Metodika územního plánování', a:[['u55','own'],['u58','do']]},
    {id:'f16', g:'g5', type:'metodika', name:'Metodika stavebního řádu', a:[['u62','own'],['u63','do'],['u64','do'],['u65','do']]},
    {id:'f17', g:'g5', type:'metodika', name:'Legislativa (národní a evropská)', a:[['u59','own'],['u60','do'],['u61','do']]},
    {id:'f18', g:'g6', type:'priprava', name:'Příprava a realizace transformace stavební správy', refs:'R9', a:[['u19','own'],['u20','do'],['u21','do'],['u22','do'],['u23','do'],['u24','do'],['u25','do']]},
    {id:'f19', g:'g7', type:'rizeni', name:'Řízení úřadu a kancelář předsedy', a:[['u01','own'],['u02','sup'],['u67','do']]},
    {id:'f20', g:'g7', type:'rizeni', name:'Interní audit', a:[['u01','own'],['u66','do']]},
    {id:'f21', g:'g7', type:'rizeni', name:'Kybernetická bezpečnost', a:[['u01','own'],['u68','do']]},
    {id:'f22', g:'g8', type:'podpora', name:'Právní služby a zastupování před soudy', a:[['u26','own']]},
    {id:'f23', g:'g8', type:'podpora', name:'Personalistika a mzdy', a:[['u14','own'],['u15','do']]},
    {id:'f24', g:'g8', type:'podpora', name:'Ekonomika a rozpočet', a:[['u14','own'],['u16','do']]},
    {id:'f25', g:'g8', type:'podpora', name:'Provoz a IT', a:[['u14','own'],['u18','do']]},
    {id:'f26', g:'g8', type:'podpora', name:'Provoz digitálních služeb stavebního řízení', desc:'Portál stavebníka, ISSŘ, ESZ – rozsah k ověření.', a:[['u14','own'],['u17','do']]},
    {id:'f27', g:'g8', type:'podpora', name:'Spisová služba a podatelna', refs:'R6', desc:'Mnoho vstupů, jeden spis.', a:[]},
    {id:'f28', g:'g8', type:'podpora', name:'Konzultace a komunikace se žadateli', refs:'R6', a:[]},
    // výhled 2028 – součást TOM soustavy, nekontroluje se
    {id:'f29', g:'g2', type:'odvolani', p:'2028', name:'Odvolání proti rozhodnutím krajských ÚRÚ', refs:'R2', a:[]},
    {id:'f30', g:'g7', type:'rizeni', p:'2028', name:'Řízení a metodické vedení krajských ÚRÚ', refs:'R4, R5', a:[]},
    {id:'f31', g:'g8', type:'podpora', p:'2028', name:'Sdílené služby pro celou soustavu', refs:'R5, R10', a:[]},
    {id:'f32', g:'g4', type:'vykon', p:'2028', name:'Převzetí pořizování ÚPD za obce', refs:'R7', a:[]},
    {id:'f33', g:'g8', type:'podpora', p:'2028', name:'Jedna spisová služba soustavy', refs:'R6', a:[]}
  ],
  // souhrnné funkce (sbalené dlaždice); vazby vedoucí na více dílčích funkcí stejného souhrnu se sloučí na souhrn
  sums: [
    {id:'s1', g:'g1', name:'Povolování vyhrazených staveb', children:['f01','f02','f03','f04','f05']},
    {id:'s2', g:'g3', name:'Integrované dotčené orgány', children:['f10','f11']},
    {id:'s3', g:'g5', name:'Metodika a legislativa', children:['f15','f16','f17']},
    {id:'s4', g:'g7', name:'Řízení úřadu', children:['f19','f20','f21']},
    {id:'s5', g:'g8', name:'Podpůrné služby', children:['f22','f23','f24','f25','f26']}
  ],
  links: [
    ['f08','f01','odvolani'],['f08','f02','odvolani'],['f08','f05','odvolani'],
    ['f10','f05','podklad','stanovisko jako vnitřní podklad'],['f11','f01','podklad','stanovisko jako vnitřní podklad'],
    ['f09','f16','zpetna','poznatky z odvolací praxe'],['f16','f17','podklad','legislativní podněty'],
    ['f14','f12','sluzba','data'],['f12','f13','podklad'],
    ['f26','f01','sluzba','Portál, ISSŘ'],['f27','f01','spis'],
    ['f09','f29','vyvoj'],['f18','f30','vyvoj'],['f27','f33','vyvoj']
  ],
  rules: [
    {id:'r1', name:'Rozklad oddělit od prvního stupně', level:'sekce', a:['f08'], b:['f01','f02','f03','f04','f05','f06','f07'],
     desc:'Útvar, který připravuje rozhodnutí o rozkladu, by neměl být ve stejné sekci jako útvar, který rozhodl v 1. stupni.'},
    {id:'r2', name:'Odvolání oddělit od metodiky', level:'sekce', a:['f09'], b:['f15','f16'],
     desc:'Odvolací útvar oddělit od metodiky; zpětná vazba z odvolací praxe do metodiky se řeší vazbou, ne společným útvarem.'}
  ]
};
