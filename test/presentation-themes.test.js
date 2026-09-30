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
console.log('presentation-themes: storage isolation, roles, native fallback, immutable inputs and reduced-motion rendering passed');
