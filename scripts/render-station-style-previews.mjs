#!/usr/bin/env node
/* Direct execution of the shipped source-backed renderers. No server, browser, provider
   credentials or model calls. The public fixture is a canonical station document. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';

const file=fileURLToPath(import.meta.url),root=resolve(dirname(file),'..');
const args=process.argv.slice(2),value=flag=>{const at=args.indexOf(flag);return at<0?null:args[at+1];};
const out=resolve(value('--out')||join(root,'artifacts','station-style-previews'));
const ids=['space-colony','cyberpunk','starship-bridge','steampunk-airship','secret-agent-hq'];
const theme=value('--theme'),dense=args.includes('--dense');
if(!theme){
  // Separate processes keep decoded 4K canvases bounded between styles, even on machines
  // where native image memory is reclaimed later than the JavaScript objects.
  for(const id of ids){
    const r=spawnSync(process.execPath,[file,'--theme',id,'--out',out,...(dense?['--dense']:[])],{encoding:'utf8'});
    if(r.stdout)process.stdout.write(r.stdout);
    if(r.status!==0){if(r.stderr)process.stderr.write(r.stderr);process.exit(r.status||1);}
  }
  process.exit(0);
}
assert.ok(ids.includes(theme),'--theme must name one of the five source-backed styles');
const require=createRequire(import.meta.url);
const {createCanvas,ImageData,GlobalFonts}=require('@napi-rs/canvas');
const sharp=require('sharp');
const WorldModel=require('../frontend/app/worldmodel.js');
GlobalFonts.registerFromPath(join(root,'frontend/assets/osrs-client/osrs-plain.ttf'),'OSRSPlain');
GlobalFonts.registerFromPath(join(root,'frontend/assets/osrs-client/osrs-bold.ttf'),'OSRSBold');

const pending=[];
function LocalImage(){
  const c=createCanvas(1,1);c.complete=false;
  Object.defineProperty(c,'src',{set:path=>pending.push((async()=>{
    const {data,info}=await sharp(readFileSync(join(root,'frontend',path))).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    c.width=info.width;c.height=info.height;
    c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data),info.width,info.height),0,0);
    c.naturalWidth=info.width;c.naturalHeight=info.height;c.complete=true;c.onload?.();
  })())});
  return c;
}
const scope={module:{exports:{}},document:{createElement:()=>createCanvas(1,1),body:{style:{setProperty:()=>{}}}},
  PresentationThemes:{get:()=>theme},localStorage:{getItem:()=>null,setItem:()=>{}},console};
for(const [source,name]of [['station-presentation.js','StationPresentation'],['osrs-appearance.js','OSRSAppearance'],['osrs-world.js','OSRSWorld']]){
  scope.module={exports:{}};vm.runInNewContext(readFileSync(join(root,'frontend/app',source),'utf8'),scope);scope[name]=scope.module.exports;
}
scope.Image=LocalImage;
for(const [source,name]of [['station-art.js','StationArt'],['openart-world.js','OpenArtWorld']]){
  scope.module={exports:{}};vm.runInNewContext(readFileSync(join(root,'frontend/app',source),'utf8'),scope);scope[name]=scope.module.exports;
}
const art=scope.StationArt.load(theme);await Promise.all(pending);
assert.ok(art.ready&&!art.error,'approved source and sampled assets load');
for(const image of [...Object.values(art.npc),...Object.values(art.props)]){
  assert.ok(image.width>0&&image.height>0,'each agent and capability has a decoded asset');
  const data=image.getContext('2d').getImageData(0,0,image.width,image.height).data;
  let visible=0,transparent=0;for(let i=3;i<data.length;i+=4){if(data[i])visible++;else transparent++;}
  assert.ok(visible>20&&transparent>20,'isolated sprites retain visible art and transparent silhouette boundaries');
}
const fixture=JSON.parse(readFileSync(join(root,'scripts/fixtures',dense?'station-art-dense-review.json':'station-art-review.json'),'utf8'));
const fixtureBefore=JSON.stringify(fixture);
// WorldModel normalises missing station defaults on import. Keep that preparation
// separate from the read-only fixture used to validate the presentation pass.
const station=WorldModel.create(JSON.parse(JSON.stringify(fixture.station))),geo=station.projectGeometry(),T=geo.TILE,floor=[];
for(let y=0;y<geo.ROWS;y++)for(let x=0;x<geo.COLS;){
  if(geo.zoneGrid[y*geo.COLS+x]==null){x++;continue;}
  const from=x;while(x<geo.COLS&&geo.zoneGrid[y*geo.COLS+x]!=null)x++;
  floor.push(Object.freeze({x:from*T,y:y*T,w:(x-from)*T,h:T}));
}
const layout=Object.freeze({width:geo.W,height:geo.H,tileSize:T,floor:Object.freeze(floor),belts:Object.freeze([])});
const bodies=Object.freeze(fixture.agents.map(a=>Object.freeze({id:a.id,name:a.name,
  x:(fixture.positions[a.id][0]-geo.origin.tx+.5)*T,y:(fixture.positions[a.id][1]-geo.origin.ty+.5)*T,dir:'south',state:'idle',odo:0,
  working:false,waiting:false,moving:false,unplaced:false,sitting:false,lying:false,...fixture.states?.[a.id]})));
const equipment=Object.freeze(geo.props.map(p=>Object.freeze({id:p.id,type:p.t,capability:station.capForProp(p.t),agentId:p.agentId,
  x:p.x*T,y:p.y*T,w:(p.w||1)*T,h:(p.h||1)*T,users:Object.freeze([])})));
const dimensions={width:962,height:639},bounds=scope.OSRSWorld.bounds(layout),aspect=dimensions.width/dimensions.height;
// The native renderer uses an aspect-correct viewport, with enough margin for the
// raised hull. Passing raw map dimensions would create a different camera baseline.
const viewportWidth=Math.max(bounds.w+96,(bounds.h+96)*aspect),viewportHeight=viewportWidth/aspect;
const snapshot=Object.freeze({layout,bodies,equipment,connected:true,paused:false,
  viewport:Object.freeze({x:bounds.x+bounds.w/2-viewportWidth/2,y:bounds.y+bounds.h/2-12-viewportHeight/2,w:viewportWidth,h:viewportHeight}),transports:Object.freeze([])});
const before=JSON.stringify(snapshot),record=id=>fixture.agents.find(a=>a.id===id);
scope.StationPresentation.bind({agentRecord:record});scope.OpenArtWorld.bind(record);
mkdirSync(out,{recursive:true});
const canvas=createCanvas(dimensions.width,dimensions.height);
const outputPath=join(out,theme+(dense?'-dense':'')+'-renderer-preview.png');
assert.equal(scope.OpenArtWorld.draw(canvas.getContext('2d'),canvas,{snapshot,now:1000,reducedMotion:true}),true);
writeFileSync(outputPath,canvas.toBuffer('image/png'));
assert.equal(JSON.stringify(snapshot),before,'rendering leaves frozen station state unchanged');
const hits=scope.OpenArtWorld.hitRects();
assert.equal(hits.filter(r=>r.kind==='agent'&&r.theme).length,bodies.length);
assert.equal(hits.filter(r=>r.kind==='equipment').length,equipment.length);
assert.equal(bodies.length,dense?39:9,'review fixture includes every agent');
assert.equal(equipment.length,dense?102:19,'review fixture includes every capability object');
if(dense)assert.ok(equipment.every(p=>p.capability),'dense fixture equipment represents real capabilities');
assert.equal(new Set(bodies.map(b=>b.id)).size,bodies.length,'every agent retains a unique identity');
assert.equal(new Set(equipment.map(p=>p.id)).size,equipment.length,'every equipment object retains a unique identity');
canvas.getBoundingClientRect=()=>({left:0,top:0,width:canvas.width,height:canvas.height});
for(const b of bodies){const p=scope.OpenArtWorld.worldToCanvas(b.x,b.y);assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));}
const top=hits.filter(r=>r.kind==='agent').at(-1);
assert.equal(scope.OpenArtWorld.clientHit({clientX:top.x+top.w/2,clientY:top.y+top.h/2},canvas).id,top.id);
let sparseIdleLabels=false,hoverLabel=false;
if(dense){
  const labelled=new Set(hits.filter(r=>r.kind==='agent'&&!r.theme).map(r=>r.id));
  const idle=bodies.find(b=>!b.working&&!b.waiting&&!b.tool);
  assert.ok(idle&&!labelled.has(idle.id),'dense station idle labels are omitted at overview');
  assert.ok(labelled.size<bodies.length,'dense station labels do not cover every crew member');
  sparseIdleLabels=true;
  const hovered=Object.freeze({...snapshot,bodies:Object.freeze(bodies.map(b=>Object.freeze({...b,hovered:b.id===idle.id})))});
  const hoverBefore=JSON.stringify(hovered);
  assert.equal(scope.OpenArtWorld.draw(canvas.getContext('2d'),canvas,{snapshot:hovered,now:1000,reducedMotion:true}),true);
  const hoverHits=scope.OpenArtWorld.hitRects();
  assert.equal(hoverHits.filter(r=>r.kind==='agent'&&r.theme).length,39,'hovering never removes real agent bodies');
  assert.ok(hoverHits.some(r=>r.kind==='agent'&&!r.theme&&r.id===idle.id),'hovering labels the selected idle NPC');
  assert.equal(JSON.stringify(hovered),hoverBefore,'hovering leaves state unchanged');hoverLabel=true;
}
// Native-camera continuity is checked against the visible rectangle, not just the
// theme's own inverse. Unequal rooms make depth compression and skew observable.
const near=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<1e-7,message+': '+actual+' versus '+expected);
const center={x:snapshot.viewport.x+snapshot.viewport.w/2,y:snapshot.viewport.y+snapshot.viewport.h/2};
const variants=[{name:'native fit',width:962,height:639,viewport:snapshot.viewport},
  {name:'pan',width:962,height:639,viewport:{...snapshot.viewport,x:snapshot.viewport.x+31,y:snapshot.viewport.y-17}},
  {name:'zoom',width:962,height:639,viewport:{x:center.x-snapshot.viewport.w*.375,y:center.y-snapshot.viewport.h*.375,w:snapshot.viewport.w*.75,h:snapshot.viewport.h*.75}},
  {name:'resize',width:1176,height:504,viewport:{x:center.x-snapshot.viewport.w/2,y:center.y-snapshot.viewport.w*504/1176/2,w:snapshot.viewport.w,h:snapshot.viewport.w*504/1176}}];
for(const variant of variants){
  const resized=createCanvas(variant.width,variant.height),viewport=Object.freeze(variant.viewport),state=Object.freeze({...snapshot,viewport}),cameraBefore=JSON.stringify(state);
  resized.getBoundingClientRect=()=>({left:0,top:0,width:resized.width,height:resized.height});
  assert.equal(scope.OpenArtWorld.draw(resized.getContext('2d'),resized,{snapshot:state,now:1000,reducedMotion:true}),true);
  const camera=scope.OSRSWorld.makeStationView(state,resized.width,resized.height),scale=resized.width/viewport.w;
  for(const body of bodies){
    const point=scope.OpenArtWorld.worldToCanvas(body.x,body.y);
    near(point.x,(body.x-viewport.x)*scale,variant.name+' native horizontal axis');
    near(point.y,(body.y-viewport.y)*scale,variant.name+' native vertical axis');
    const inverse=scope.OSRSWorld.unproject(camera,point.x,point.y);
    near(inverse.x,body.x,variant.name+' inverse x');near(inverse.y,body.y,variant.name+' inverse y');
  }
  const a=scope.OpenArtWorld.worldToCanvas(bounds.x,bounds.y),right=scope.OpenArtWorld.worldToCanvas(bounds.x+100,bounds.y),down=scope.OpenArtWorld.worldToCanvas(bounds.x,bounds.y+100);
  near(right.y,a.y,variant.name+' rows remain horizontal');near(down.x,a.x,variant.name+' columns remain vertical');
  near(right.x-a.x,down.y-a.y,variant.name+' both axes retain native scale');
  assert.equal(scope.OpenArtWorld.hitRects().filter(r=>r.kind==='agent'&&r.theme).length,bodies.length);
  assert.equal(scope.OpenArtWorld.hitRects().filter(r=>r.kind==='equipment').length,equipment.length);
  assert.equal(JSON.stringify(state),cameraBefore,'camera changes leave inputs unchanged');
}
// Exercise the actual decoded sprites in each pose transformation, rather than relying
// solely on the renderer's small mocked canvas unit tests. These are state fixtures.
const poseStates=[{moving:true,dir:'north',odo:37},{sitting:true,working:true,tool:'web.search'},
  {lying:true},{waiting:true}];
for(const state of poseStates){
  const posed=Object.freeze({...snapshot,bodies:Object.freeze(bodies.map(b=>Object.freeze({...b,...state})))});
  const poseBefore=JSON.stringify(posed);
  assert.equal(scope.OpenArtWorld.draw(canvas.getContext('2d'),canvas,{snapshot:posed,now:2400,reducedMotion:false}),true);
  assert.equal(JSON.stringify(posed),poseBefore,'pose transformations leave presentation inputs immutable');
  assert.equal(scope.OpenArtWorld.hitRects().filter(r=>r.kind==='agent'&&r.theme).length,bodies.length);
}
assert.equal(JSON.stringify(fixture),fixtureBefore,'the source fixture is never mutated');
console.log(JSON.stringify({theme,result:'passed',dense,agents:bodies.length,equipment:equipment.length,immutableInputs:true,
  isolatedAssets:true,canonicalPicking:true,nativeCamera:['fit','pan','zoom','resize'],sparseIdleLabels,hoverLabel,
  poseStates:['walking','working/seated','resting','waiting'],
  capture:'direct shipped renderer; seeded review state, not browser screenshot',path:outputPath}));
