/* OSRS cosmetics only: independent local preferences, never roster skins or station saves. */
'use strict';
const OSRSAppearance = (() => {
  const KEY = 'starnet.osrs.appearances.v1';
  const roles = [
    ['player','Operator','A player-style station commander.'],
    ['mage','Zamorak Mage','Crimson robes, pointed hat and a staff.'],
    ['scholar','Wise Old Man','An elder scholar in grey robes.'],
    ['ranger','Robin Hood','Green ranger gear and a bow.'],
    ['guard','Guard','Chainmail, helmet and a spear.'],
    ['cook','Cook','Chef whites and a tall cooking hat.'],
    ['banker','Banker','Purple suit with gold trim.'],
    ['elf','Elven Guard','Green elven gear and silver hair.'],
    ['dwarf','Dwarf','A bearded smith with a horned helmet.'],
    ['scout','Draynor Villager','A traveller with a satchel.']
  ];
  const metals = ['Bronze','Iron','Steel','Black','Mithril','Adamant','Rune','Dragon'];
  const catalog = Object.freeze([
    Object.freeze({id:'role',name:'Follow role',description:'Use the character that matches this agent’s role.'}),
    ...roles.map(([id,name,description])=>Object.freeze({id,name,description,kind:id})),
    ...metals.map((metal,col)=>Object.freeze({id:metal.toLowerCase(),name:'Full '+metal.toLowerCase()+' armour',npcName:metal+' Knight',description:'Full helm, platebody, platelegs, shield and scimitar.',kind:'armour',col}))
  ]);
  const valid = id => catalog.some(c=>c.id===id);
  const validAgent = id => typeof id==='string'&&id.length>0&&id.length<=160;
  const listeners = new Set();
  let prefs = new Map(), storage = null, revision = 0;
  function read(source) {
    try {
      const raw=source.getItem(KEY);if(!raw||raw.length>65536)return new Map();
      const data=JSON.parse(raw);if(data?.v!==1||!data.agents||typeof data.agents!=='object'||Array.isArray(data.agents))return new Map();
      return new Map(Object.entries(data.agents).filter(([id,look])=>validAgent(id)&&valid(look)&&look!=='role').slice(0,512));
    } catch (_) { return new Map(); }
  }
  function init(source) {storage=source;prefs=read(source);revision++;return prefs.size;}
  function forAgent(id) {return prefs.get(id)||'role';}
  function set(id,look) {
    if(!validAgent(id)||!valid(look))return false;
    if(look==='role')prefs.delete(id);else{if(prefs.size>=512&&!prefs.has(id))return false;prefs.set(id,look);}
    try {(storage||localStorage).setItem(KEY,JSON.stringify({v:1,agents:Object.fromEntries(prefs)}));}catch(_){}
    revision++;listeners.forEach(fn=>fn(id));return true;
  }
  function resolve(record,override) {
    const role=typeof StationPresentation!=='undefined'?StationPresentation.roleFor(record):{kind:'player',npcName:'Operator',job:'Station Operator'};
    const selected=valid(override)?override:forAgent(record?.id);
    const look=catalog.find(c=>c.id===(selected==='role'?role.kind:selected))||catalog[1];
    return {...look,selected,npcName:look.npcName||look.name,job:role.job};
  }
  function sprite(record,dir,override) {
    const look=resolve(record,override),row=({south:0,southwest:1,west:1,northwest:2,north:2,northeast:3,east:3,southeast:0})[dir]??0;
    if(look.kind==='armour')return {look,atlas:'armour',index:row*8+look.col};
    if(look.kind==='scout'||look.kind==='player')return {look,atlas:'travellers',index:(look.kind==='scout'?4:0)+row};
    const col=({mage:0,scholar:1,ranger:2,guard:3,cook:4,banker:5,elf:6,dwarf:7})[look.kind]??0;
    return {look,atlas:'npc',index:row*8+col};
  }
  function subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}
  if(typeof document!=='undefined'){
    try{init(localStorage);}catch(_){}
    if(typeof window!=='undefined')window.addEventListener('storage',e=>{
      if(e.key===KEY||e.key===null){prefs=read(storage);revision++;listeners.forEach(fn=>fn(null));}
    });
  }
  return {KEY,catalog,valid,read,init,forAgent,set,resolve,sprite,subscribe,revision:()=>revision};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=OSRSAppearance;
