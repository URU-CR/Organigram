// Vzorová struktura krajského ÚRÚ (podle TOM: centrála = řízení, integrované DO, 1. stupeň složitějších staveb;
// územní pracoviště = 1. stupeň běžných staveb, podatelna, konzultace). counts = [vedoucí, asistenti, referenti].
// Používá se při založení prázdné aplikace a při „Vymazat vše“. Úpravy vzoru v aplikaci se sem nepropisují.
window.KRAJE=['Hlavní město Praha','Středočeský kraj','Jihočeský kraj','Plzeňský kraj','Karlovarský kraj','Ústecký kraj','Liberecký kraj','Královéhradecký kraj','Pardubický kraj','Kraj Vysočina','Jihomoravský kraj','Olomoucký kraj','Zlínský kraj','Moravskoslezský kraj'];
window.KRAJ_TEMPLATE=[
  {id:'k1',parent:null,name:'Ředitel krajského ÚRÚ – {kraj}',level:'predseda',src:'Nové',head_lbl:'ředitel krajského ÚRÚ',counts:[1,1,0],vzor:true},
  {id:'k2',parent:'k1',name:'Samostatné oddělení kanceláře ředitele',level:'odd',src:'Nové',counts:[1,0,3]},
  {id:'k3',parent:'k1',name:'Odbor stavebně správní',level:'odbor',src:'Nové',counts:[1,1,0]},
  {id:'k4',parent:'k3',name:'Oddělení stavebně správní I',level:'odd',src:'Nové',counts:[1,0,8]},
  {id:'k5',parent:'k3',name:'Oddělení stavebně správní II',level:'odd',src:'Nové',counts:[1,0,8]},
  {id:'k6',parent:'k1',name:'Odbor integrovaných dotčených orgánů',level:'odbor',src:'Nové',counts:[1,1,0]},
  {id:'k7',parent:'k6',name:'Oddělení ochrany životního prostředí',level:'odd',src:'Nové',counts:[1,0,8]},
  {id:'k8',parent:'k6',name:'Oddělení ochrany ostatních veřejných zájmů',level:'odd',src:'Nové',counts:[1,0,6]},
  {id:'k9',parent:'k1',name:'Odbor územního plánování',level:'odbor',src:'Nové',counts:[1,1,0]},
  {id:'k10',parent:'k9',name:'Oddělení územně plánovací',level:'odd',src:'Nové',counts:[1,0,6]},
  {id:'k11',parent:'k1',name:'Územní pracoviště A',level:'up',src:'Nové',counts:[1,0,12]},
  {id:'k12',parent:'k1',name:'Územní pracoviště B',level:'up',src:'Nové',counts:[1,0,12]},
  {id:'k13',parent:'k1',name:'Územní pracoviště C',level:'up',src:'Nové',counts:[1,0,12]}];
