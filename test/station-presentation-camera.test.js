'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Native=require('../frontend/app/worldrenderer.js');
const source=fs.readFileSync(require.resolve('../frontend/app/osrs-world.js'),'utf8');
const skyCalls=[],painted=[],canvases=[];
function context(){
  const calls=[];
  return new Proxy({calls,measureText:text=>({width:String(text).length*7})},{get(target,key){
    if(key in target)return target[key];
    return (...args)=>{calls.push([key,...args]);if(key==='createRadialGradient')return {addColorStop(){}};};
  }});
}
const scope={module:{exports:{}},PresentationThemes:{get:()=> 'osrs'},
  SpaceBG:{draw:(...args)=>skyCalls.push(args)},
  StationPresentation:{registerView(){},roleFor:()=>({kind:'guard',job:'Security Agent'}),drawBody:(_g,b)=>painted.push(b.id)},
  OSRSAppearance:{sprite:record=>({atlas:'npc',index:0,look:{kind:'guard',id:'guard',npcName:record.name||'Guard'}})},
  document:{createElement(tag){assert.equal(tag,'canvas');const g=context(),canvas={width:0,height:0,getContext:()=>g};canvases.push(canvas);return canvas;}}
};
vm.runInNewContext(source,scope);
const Camera=scope.module.exports;
const layout=Object.freeze({width:720,height:360,tileSize:12,floor:Object.freeze([
  ...Array.from({length:12},(_,y)=>Object.freeze({x:12,y:72+y*12,w:228,h:12})),
  ...Array.from({length:24},(_,y)=>Object.freeze({x:324,y:24+y*12,w:348,h:12})),
  ...Array.from({length:3},(_,y)=>Object.freeze({x:240,y:120+y*12,w:84,h:12}))
]),belts:Object.freeze([])});
const actors=Object.freeze(Array.from({length:39},(_,i)=>Object.freeze({id:'crew-'+i,name:'Crew '+i,x:36+(i%8)*24,y:96+Math.floor(i/8)*24,
  dir:'south',odo:0,moving:false,working:false,waiting:i===1,hovered:i===0,unplaced:false})));
const equipment=Object.freeze(Array.from({length:102},(_,i)=>Object.freeze({id:'equipment-'+i,type:'desk',capability:'computer',x:336+(i%17)*18,y:36+Math.floor(i/17)*24,w:12,h:12,users:Object.freeze([])})));
const base=Object.freeze({layout,bodies:actors,equipment,transports:Object.freeze([]),connected:true}),before=JSON.stringify(base);
const near=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-8,label+': '+a+' versus '+b);

// Reconstruct every exposed native tile edge and compare it with the rendered outlines.
// This detects clipped/beveled staircase corners as well as filled holes or joined rooms.
const outlines=[
  {name:'staircase',floor:Array.from({length:7},(_,y)=>({x:0,y:y*12,w:84-y*12,h:12})),loops:1},
  {name:'courtyard',floor:[{x:0,y:0,w:36,h:12},{x:0,y:12,w:12,h:12},{x:24,y:12,w:12,h:12},{x:0,y:24,w:36,h:12}],loops:2},
  {name:'disconnected rooms',floor:[{x:0,y:0,w:36,h:12},{x:0,y:12,w:36,h:12},{x:60,y:24,w:24,h:12},{x:60,y:36,w:24,h:12}],loops:2},
  {name:'diagonal touch',floor:[{x:0,y:0,w:12,h:12},{x:12,y:12,w:12,h:12}],loops:2}
];
const edgeKey=(a,b)=>[a.x+','+a.y,b.x+','+b.y].sort().join('|');
for(const fixture of outlines){
  const expected=new Set();
  for(const row of fixture.floor)for(let x=row.x;x<row.x+row.w;x+=12){
    const corners=[{x,y:row.y},{x:x+12,y:row.y},{x:x+12,y:row.y+12},{x,y:row.y+12}];
    for(let i=0;i<4;i++){const key=edgeKey(corners[i],corners[(i+1)%4]);if(expected.has(key))expected.delete(key);else expected.add(key);}
  }
  const actual=new Set(),outline=Camera.outline({tileSize:12,floor:fixture.floor});assert.equal(outline.loops.length,fixture.loops,fixture.name+' keeps independent boundaries');
  for(const loop of outline.loops)for(let i=0;i<loop.length;i++){
    const a=loop[i],b=loop[(i+1)%loop.length];assert.ok(a.x===b.x||a.y===b.y,fixture.name+' never adds a diagonal bevel');
    const dx=Math.sign(b.x-a.x)*12,dy=Math.sign(b.y-a.y)*12,steps=(Math.abs(b.x-a.x)+Math.abs(b.y-a.y))/12;assert.ok(Number.isInteger(steps));
    for(let step=0;step<steps;step++){const p={x:a.x+dx*step,y:a.y+dy*step},q={x:p.x+dx,y:p.y+dy};actual.add(edgeKey(p,q));}
  }
  assert.deepEqual([...actual].sort(),[...expected].sort(),fixture.name+' retains the exact exposed native tile edges');
}

for(const scale of [.45,1,3.2])for(const [panX,panY]of [[48,22],[-190,-64]]){
  const native={scale,panX,panY,width:1068,height:648},viewport=Object.freeze(Native.visibleRect(native));
  const snapshot=Object.freeze({...base,viewport}),view=Camera.makeStationView(snapshot,native.width,native.height);
  for(const [x,y]of [[12,72],[240,216],[324,24],[672,312],[498,150]]){
    const point=Camera.project(view,x,y),back=Camera.unproject(view,point.x,point.y);
    near(point.x,x*scale+panX,'theme preserves native horizontal position');near(point.y,y*scale+panY,'theme preserves native vertical position');
    near(back.x,x,'inverse horizontal picking');near(back.y,y,'inverse vertical picking');
  }
  const rear=Camera.project(view,672,24),front=Camera.project(view,672,312);
  near(rear.x,front.x,'separate room wall stays vertical, without outward trapezoid shear');
  Camera.drawBackdrop(context(),native.width,native.height,1234,viewport);
  const call=skyCalls.at(-1);assert.equal(call[3],1234);near(call[4].scale,scale,'background uses native zoom');near(call[4].panX,panX,'background uses native horizontal parallax');near(call[4].panY,panY,'background uses native vertical parallax');
}

// Native resize retains scale and moves the same world center to the new screen center.
const oldCamera={width:1068,height:648,scale:.8,panX:25,panY:73},nextCamera={...oldCamera,width:1320,height:768,panX:25+(1320-1068)/2,panY:73+(768-648)/2};
const oldView=Camera.makeStationView({...base,viewport:Native.visibleRect(oldCamera)},oldCamera.width,oldCamera.height),nextView=Camera.makeStationView({...base,viewport:Native.visibleRect(nextCamera)},nextCamera.width,nextCamera.height);
near(oldView.scale,nextView.scale,'resize never normalizes the zoom again');
for(const [x,y]of [[12,72],[324,24],[672,312]]){const old=Camera.project(oldView,x,y),next=Camera.project(nextView,x,y);near(next.x-old.x,(nextCamera.width-oldCamera.width)/2,'resize preserves horizontal anchor');near(next.y-old.y,(nextCamera.height-oldCamera.height)/2,'resize preserves vertical anchor');}
const fallback=Camera.makeStationView(base,1068,648),a=Camera.project(fallback,324,24),b=Camera.project(fallback,324,312);
near(a.x,b.x,'isolated snapshots also use an overhead camera');
for(const [x,y]of [[12,72],[672,312]]){const p=Camera.project(fallback,x,y),back=Camera.unproject(fallback,p.x,p.y);near(back.x,x,'fallback inverse X');near(back.y,y,'fallback inverse Y');}

const g=context(),canvas={width:1068,height:648},snapshot=Object.freeze({...base,viewport:Object.freeze(Native.visibleRect({width:1068,height:648,scale:1.2,panX:40,panY:110}))});
assert.equal(Camera.draw(g,canvas,{snapshot,now:2000,reducedMotion:true}),true);
assert.equal(painted.length,39,'dense stations keep every actual NPC entity visible');
const hits=Camera.hitRects();assert.equal(hits.filter(h=>h.kind==='agent'&&h.appearance).length,39,'dense stations retain every NPC body hit target');assert.equal(hits.filter(h=>h.kind==='equipment').length,102,'dense stations retain every capability hit target');
const nameLabels=g.calls.filter(c=>c[0]==='fillText'&&String(c[1]).startsWith('Crew '));
assert.ok(nameLabels.length<12,'idle crew no longer make a wall of overlapping labels');assert.ok(nameLabels.some(c=>c[1]==='Crew 0'),'hovered idle agent remains identifiable');assert.ok(nameLabels.some(c=>c[1]==='Crew 1'),'approval-blocked agent remains identifiable');
assert.equal(JSON.stringify(base),before,'camera, sky and label choices never mutate canonical station state');

// Standalone renderer captures lack SpaceBG; its fallback must show actual detail and be cached.
delete scope.SpaceBG;
const first=context(),second=context(),count=canvases.length;
Camera.drawBackdrop(first,700,420,0,null);Camera.drawBackdrop(second,700,420,1000,null);
assert.equal(canvases.length,count+1,'fallback sky is cached instead of rebuilt per frame');
const sky=canvases.at(-1).getContext('2d');assert.equal(sky.calls.filter(c=>c[0]==='createRadialGradient').length,3,'fallback includes a visible nebula');assert.ok(sky.calls.filter(c=>c[0]==='fillRect').length>200,'fallback includes stars rather than a flat color');
assert.equal(first.calls.filter(c=>c[0]==='drawImage').length,1);assert.equal(second.calls.filter(c=>c[0]==='drawImage').length,1);
console.log('station-presentation-camera: native pan/zoom, resize, overhead rooms, backdrop parallax, dense crew picking and immutable state passed');
