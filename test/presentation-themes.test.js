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
assert.equal(notices,4);unsubscribe();Themes.set('original',{persist:false});assert.equal(notices,4);

// Theme changes have exactly one persistence target, never StarNet's save or roster keys.
const writes=[];global.localStorage={setItem:(key,value)=>writes.push({key,value})};
Themes.set('osrs');assert.deepEqual(writes.map(x=>x.key),[Themes.KEY]);
delete global.localStorage;

const scope={module:{exports:{}},PresentationThemes:Themes};
vm.runInNewContext(fs.readFileSync(require.resolve('../frontend/app/station-presentation.js'),'utf8'),scope);
const Art=scope.module.exports;
const expected={researcher:'mage',analyst:'scholar',writer:'ranger',security:'guard',data:'cook',finance:'banker',integration:'elf',engineer:'dwarf',web:'scout'};
for(const [specialtyId,kind] of Object.entries(expected))assert.equal(Art.roleFor({specialtyId,role:'specialist'}).kind,kind);
assert.equal(Art.roleFor({id:'agent',specialtyId:'engineer'}).kind,'player');
assert.equal(Art.roleFor({specialtyId:'engineer',purpose:'Security and finance research'}).kind,'dwarf');
assert.equal(Art.roleFor({role:'specialist',name:'Unknown'}).kind,'scout');
const record=Object.freeze({id:'crew-a',specialtyId:'researcher'});
Art.bind({agentRecord:()=>record});
function context() {
  const calls=[];const ctx=new Proxy({calls,globalAlpha:1},{get(t,k){return k in t?t[k]:(...args)=>calls.push([k,...args]);},set(t,k,v){t[k]=v;return true;}});
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
const perspectiveScope={module:{exports:{}},StationPresentation:Art,PresentationThemes:Themes};
vm.runInNewContext(fs.readFileSync(require.resolve('../frontend/app/osrs-world.js'),'utf8'),perspectiveScope);
const Perspective=perspectiveScope.module.exports;
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
console.log('presentation-themes: storage isolation, roles, native fallback, immutable inputs and reduced-motion rendering passed');
