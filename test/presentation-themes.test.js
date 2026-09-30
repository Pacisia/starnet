'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Themes = require('../frontend/app/presentation-themes.js');
assert.equal(Themes.read({getItem:()=>null}),'original');
assert.equal(Themes.read({getItem:()=>'{broken'}),'original');
assert.equal(Themes.read({getItem:()=>'{"theme":"removed"}'}),'original');
assert.equal(Themes.read({getItem:()=>'{"theme":"osrs"}'}),'osrs');
assert.equal(Themes.read({getItem(){throw new Error('storage blocked');}}),'original');
assert.equal(Themes.set('does-not-exist'),false);
let notices=0;const unsubscribe=Themes.subscribe(()=>notices++);
for(const t of Themes.catalog)assert.equal(Themes.set(t.id,{persist:false}),true);
assert.equal(notices,Themes.catalog.length);unsubscribe();Themes.set('original',{persist:false});assert.equal(notices,Themes.catalog.length);

// Theme changes have exactly one persistence target, never StarNet's save or roster keys.
const writes=[];global.localStorage={setItem:(key,value)=>writes.push({key,value})};
Themes.set('osrs');assert.deepEqual(writes.map(x=>x.key),[Themes.KEY]);
delete global.localStorage;

const scope={module:{exports:{}},PresentationThemes:Themes};
vm.runInNewContext(fs.readFileSync(require.resolve('../frontend/app/station-presentation.js'),'utf8'),scope);
const Art=scope.module.exports;
const appearanceScope={module:{exports:{}},StationPresentation:Art};
vm.runInNewContext(fs.readFileSync(require.resolve('../frontend/app/osrs-appearance.js'),'utf8'),appearanceScope);
const Looks=appearanceScope.module.exports,lookWrites=[];
const lookStorage={getItem:()=>null,setItem:(key,value)=>lookWrites.push({key,value})};
Looks.init(lookStorage);
assert.equal(Looks.catalog.length,19,'ten NPC archetypes and eight armour sets plus role default');
const researcher=Object.freeze({id:'crew-r',specialtyId:'researcher',model:'unchanged-model',skin:'native-skin'});
const researcherBefore=JSON.stringify(researcher);
assert.equal(Looks.resolve(researcher).kind,'mage');
assert.equal(Looks.set(researcher.id,'rune'),true);
assert.equal(Looks.resolve(researcher).npcName,'Rune Knight');
assert.equal(Looks.resolve(researcher).job,'Research Agent','cosmetics do not turn a research agent into a security agent');
assert.equal(Looks.sprite(researcher,'north').index,22,'rune keeps its own atlas column when facing away');
assert.equal(Looks.set(researcher.id,'dragon'),true);
assert.equal(Looks.sprite(researcher,'east').index,31);
assert.equal(JSON.stringify(researcher),researcherBefore,'appearance never rewrites canonical skin, model or specialty');
assert.equal(Looks.forAgent('another-agent'),'role','each agent has its own appearance');
assert.equal(Looks.set('','rune'),false);assert.equal(Looks.set(researcher.id,'unknown'),false);
assert.ok(lookWrites.every(w=>w.key===Looks.KEY),'all cosmetic writes use their own storage key');
const persisted=lookWrites.at(-1).value;
Looks.init({getItem:()=>persisted,setItem:()=>{}});assert.equal(Looks.forAgent(researcher.id),'dragon','cosmetics persist on a fresh read');
Looks.set(researcher.id,'role');assert.equal(Looks.resolve(researcher).kind,'mage','follow role restores the current role mapping');
for(const raw of ['{broken','{"v":2,"agents":{"crew-r":"rune"}}','{"v":1,"agents":["rune"]}','{"v":1,"agents":{"crew-r":"removed"}}'])assert.equal(Looks.read({getItem:()=>raw}).size,0);
assert.equal(Looks.read({getItem(){throw new Error('storage denied');}}).size,0);
const expected={researcher:'mage',analyst:'scholar',writer:'ranger',security:'guard',data:'cook',finance:'banker',integration:'elf',engineer:'dwarf',web:'scout'};
for(const [specialtyId,kind] of Object.entries(expected))assert.equal(Art.roleFor({specialtyId,role:'specialist'}).kind,kind);
assert.equal(Art.roleFor({id:'agent',specialtyId:'engineer'}).kind,'player');
assert.equal(Art.roleFor({specialtyId:'engineer',purpose:'Security and finance research'}).kind,'dwarf');
assert.equal(Art.roleFor({role:'specialist',name:'Unknown'}).kind,'scout');
const record=Object.freeze({id:'crew-a',specialtyId:'researcher'});
Art.bind({agentRecord:()=>record});
function context() {
  const calls=[];const ctx=new Proxy({calls,globalAlpha:1,measureText:t=>({width:String(t).length*7})},{get(t,k){return k in t?t[k]:(...args)=>calls.push([k,...args]);},set(t,k,v){t[k]=v;return true;}});
  return ctx;
}
const body=Object.freeze({id:'crew-a',px:30,py:50,dir:'south',state:'walk',target:true,odo:7,working:false});
const before=JSON.stringify(body);
const ctx=context();const geom=Art.drawBody(ctx,body,100,{reducedMotion:false});
assert.ok(geom.top<50);assert.ok(ctx.calls.length>20);assert.equal(JSON.stringify(body),before);
const stillA=context(),stillB=context();Art.drawBody(stillA,body,100,{reducedMotion:true});Art.drawBody(stillB,body,50000,{reducedMotion:true});
assert.deepEqual(stillA.calls,stillB.calls,'reduced motion disables all procedural animation while preserving pose');
const idle=Object.freeze({...body,state:'idle',target:false});
const idleA=context(),idleB=context();Art.drawBody(idleA,idle,100,{});Art.drawBody(idleB,{...idle,odo:999},100,{});
assert.deepEqual(idleA.calls,idleB.calls,'stopped NPCs do not keep marching');
const sleeping=context();const sleepGeom=Art.drawBody(sleeping,{...idle,lying:true},100,{});
assert.ok(sleeping.calls.some(c=>c[0]==='rotate'),'sleeping bodies retain the shared bed pose');
assert.equal(sleepGeom.height,14);
const prop=Object.freeze({id:'files',t:'cabinet',x:3,y:4,w:2,h:2,r:1});
const propBefore=JSON.stringify(prop);assert.equal(Art.drawProp(context(),prop,{tileSize:12,now:100,capability:'cabinet'}),true);
assert.equal(JSON.stringify(prop),propBefore);assert.equal(Art.drawProp(context(),{t:'unsupported'},{}),false,'unknown props retain native art');
Themes.set('original',{persist:false});const native=context();
assert.equal(Art.drawBody(native,body,100,{}),null);assert.equal(Art.drawProp(native,prop,{}),false);assert.equal(Art.drawBase(native,{}),false);
assert.equal(native.calls.length,0,'original takes the native path without painting replacement art');
for(const id of ['cyberpunk','holographic']){Themes.set(id,{persist:false});assert.ok(Art.drawBody(context(),body,100,{}));assert.equal(Art.drawProp(context(),prop,{}),false);}
assert.equal(Art.register('original',{}),false,'the original renderer cannot be replaced through registration');
const perspectiveScope={module:{exports:{}},StationPresentation:Art,PresentationThemes:Themes,OSRSAppearance:Looks};
vm.runInNewContext(fs.readFileSync(require.resolve('../frontend/app/osrs-world.js'),'utf8'),perspectiveScope);
const Perspective=perspectiveScope.module.exports;
const atlasData=new Uint8ClampedArray(21*14*4);
for(let y=8;y<13;y++)for(let x=13;x<18;x++)atlasData[(y*21+x)*4+3]=255;
atlasData[(13*21+10)*4+3]=255;
const trim=Perspective.alphaBounds(atlasData,21,10,7,11,7);
assert.deepEqual({...trim},{x:13,y:8,w:5,h:5},'integer cell bounds handle odd-sized atlases and reject neighbouring fragments');
const layout=Object.freeze({width:288,height:240,tileSize:12,floor:Object.freeze([Object.freeze({x:36,y:24,w:216,h:180})])});
for(const zoom of [.25,1,3])for(const center of [{x:144,y:114},{x:90,y:150}]){
  const view=Perspective.makeView(layout,962,610,zoom,center);
  for(const [x,y]of [[36,24],[100,100],[252,204],[144,114]]){
    const p=Perspective.project(view,x,y),world=Perspective.unproject(view,p.x,p.y);
    assert.ok(Math.abs(world.x-x)<1e-9&&Math.abs(world.y-y)<1e-9,'perspective picking inverts the displayed camera at each pan/zoom');
  }
}
assert.equal(Perspective.propIndex({type:'comms_dish',capability:'dish'}),3);
assert.equal(Perspective.propIndex({type:'war_intelcab',capability:'cabinet'}),2);
assert.equal(Perspective.propIndex({type:'future_equipment',capability:'future_capability'}),null,'future equipment has a visible fallback');
assert.equal(Perspective.active(),false,'perspective pass never takes over another renderer');
const area=points=>Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p.x*q.y-q.x*p.y;},0))/2;
const diagonal=Perspective.outline({tileSize:12,floor:[{x:0,y:0,w:12,h:12},{x:12,y:12,w:12,h:12}]});
assert.equal(diagonal.loops.length,2,'diagonal contacts keep both independent floor outlines');
assert.equal(diagonal.loops.reduce((sum,loop)=>sum+area(loop),0),288,'small rooms retain their full visible floor');
const hole=Perspective.outline({tileSize:12,floor:[{x:0,y:0,w:36,h:12},{x:0,y:12,w:12,h:12},{x:24,y:12,w:12,h:12},{x:0,y:24,w:36,h:12}]});
assert.equal(hole.loops.length,2,'courtyard/void holes keep a separate clipping boundary');
assert.deepEqual(Array.from(hole.loops,area).sort((a,b)=>a-b),[144,1296]);
assert.equal(Art.registerView('original',{}),false,'the native complete view remains protected');
const frame=Object.freeze({snapshot:Object.freeze({fixture:true})});
Art.registerView('holographic',{draw:(_ctx,_canvas,value)=>value,clientToWorld:()=>({x:12,y:24}),worldToCanvas:()=>({x:30,y:40})});
Themes.set('holographic',{persist:false});
assert.equal(Art.hasWorldRenderer(),true);assert.equal(Art.drawWorld(null,null,frame),frame,'complete views consume the read-only presentation frame');
assert.deepEqual(Art.clientToWorld({}),{x:12,y:24});assert.deepEqual(Art.worldToCanvas(1,2),{x:30,y:40});
Themes.set('original',{persist:false});assert.equal(Art.hasWorldRenderer(),false);assert.equal(Art.drawWorld(null,null,frame),null);assert.equal(Art.clientToWorld({}),null);
// The approved-art views use existing station geometry and read-only entities, including
// rooms added after the concepts were made. Their assets/preferences confer no capability.
const Sources=require('../frontend/app/station-art.js');
assert.equal(Object.keys(Sources.models).length,5);
assert.equal(Sources.has('osrs'),false,'the retained OSRS renderer owns its own art');
assert.equal(Sources.load('missing'),null);
for(const [id,model]of Object.entries(Sources.models)){
  assert.ok(Themes.valid(id));assert.ok(Object.isFrozen(model)&&Object.isFrozen(model.npc.player));
  const file=fs.readFileSync(require('node:path').join(__dirname,'../frontend',model.source));
  assert.equal(file.subarray(1,4).toString(),'PNG');assert.equal(file.readUInt32BE(16),3072);assert.equal(file.readUInt32BE(20),2048);
  assert.ok(model.historyId&&Themes.catalog.find(t=>t.id===id).preview===model.source);
}
const fakeCanvas=()=>({width:0,height:0,getContext:()=>{const g=context();g.measureText=t=>({width:String(t).length*7});return g;}});
const pictures={};for(const k of ['player','mage','scholar','ranger','guard','cook','banker','elf','dwarf','scout'])pictures[k]={width:60,height:120};
const props={};for(const k of ['computer','workbench','cabinet','dish','notebook','studio','table','plant','portal'])props[k]={width:100,height:100};
const fixtureArt={ready:true,npc:pictures,props,materials:{floor:{width:56,height:56},wall:{width:80,height:24},cap:{width:80,height:8},window:{width:180,height:60}}};
const modernScope={module:{exports:{}},StationPresentation:Art,PresentationThemes:Themes,OSRSWorld:Perspective,
  StationArt:{models:Sources.models,has:Sources.has,ready:()=>true,load:id=>({...fixtureArt,model:Sources.models[id]})},document:{createElement:fakeCanvas}};
vm.runInNewContext(fs.readFileSync(require.resolve('../frontend/app/openart-world.js'),'utf8'),modernScope);
const Modern=modernScope.module.exports;
const room=Object.freeze({width:240,height:180,tileSize:12,floor:Object.freeze(Array.from({length:12},(_,i)=>Object.freeze({x:24,y:12+i*12,w:192,h:12}))),belts:Object.freeze([])});
const actors=Object.freeze([
  Object.freeze({id:'r',name:'Research',x:78,y:60,dir:'south',odo:8,moving:true,working:false}),
  Object.freeze({id:'e',name:'Build',x:168,y:96,dir:'west',odo:0,moving:false,working:true,sitting:true}),
  Object.freeze({id:'s',name:'Guard',x:66,y:126,dir:'east',odo:0,moving:false,working:false,lying:true,waiting:true})
]);
const gear=Object.freeze([
  Object.freeze({id:'research',type:'desk',capability:'computer',x:72,y:24,w:24,h:12,users:Object.freeze(['r'])}),
  Object.freeze({id:'future',type:'future-module',capability:'future-capability',x:180,y:126,w:12,h:12,users:Object.freeze([])})
]);
const projected=Object.freeze({layout:room,bodies:actors,equipment:gear,connected:true,viewport:Object.freeze({x:0,y:0,w:240,h:180}),transports:Object.freeze([])}),projectionBefore=JSON.stringify(projected);
Modern.bind(id=>({id,specialtyId:id==='r'?'researcher':id==='e'?'engineer':'security',model:'unchanged',skin:'unchanged'}));
const screen={width:962,height:639,getBoundingClientRect:()=>({left:10,top:20,width:481,height:319.5})};
for(const id of Object.keys(Sources.models)){
  Themes.set(id,{persist:false});Art.reset();
  assert.equal(Art.hasWorldRenderer(),true);assert.equal(Art.drawWorld(context(),screen,{snapshot:projected,now:1000,reducedMotion:true}),true);
  const hits=Modern.hitRects();assert.equal(hits.filter(h=>h.kind==='agent'&&h.theme).length,3);assert.equal(hits.filter(h=>h.kind==='equipment').length,2);
  const hit=hits.filter(h=>h.kind==='agent').at(-1),event={clientX:10+(hit.x+hit.w/2)/2,clientY:20+(hit.y+hit.h/2)/2};
  assert.equal(Modern.clientHit(event,screen).id,hit.id);assert.deepEqual({...Art.clientToWorld(event,screen)},{x:hit.wx,y:hit.wy});
  assert.ok(Modern.drawPortrait(fakeCanvas(),{id:'r',specialtyId:'researcher'}));
  assert.equal(JSON.stringify(projected),projectionBefore,'rendering, picking, seating and lying do not mutate station state');
}
Themes.set('space-colony',{persist:false});
const paint=(now,odo,still)=>{Art.reset();const g=context(),b=Object.freeze({...actors[0],odo});Modern.draw(g,screen,{snapshot:{...projected,bodies:[b]},now,reducedMotion:still});return g.calls.map(c=>c[0]==='drawImage'&&c[1]?.getContext?[c[0],'cached terrain',...c.slice(2)]:c);};
assert.deepEqual(paint(100,8,true),paint(9000,90,true),'reduced motion disables the movement bands and work pulse');
assert.notDeepEqual(paint(100,8,false),paint(100,90,false),'walking animation follows the authoritative movement odometer');
Themes.set('osrs',{persist:false});assert.equal(Modern.active(),false);assert.equal(Modern.draw(context(),screen,{snapshot:projected}),false);assert.equal(Modern.clientToWorld({},screen),null);
Themes.set('original',{persist:false});assert.equal(Art.hasWorldRenderer(),false);
console.log('presentation-themes: isolated theme/cosmetic preferences, armour facing, unchanged roles/models/skins, inverse picking, atlas bounds, native fallback and reduced motion passed');
