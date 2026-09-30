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
const theme=value('--theme');
if(!theme){
  // Separate processes keep decoded 4K canvases bounded between styles, even on machines
  // where native image memory is reclaimed later than the JavaScript objects.
  for(const id of ids){
    const r=spawnSync(process.execPath,[file,'--theme',id,'--out',out],{encoding:'utf8'});
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
const fixture=JSON.parse(readFileSync(join(root,'scripts/fixtures/station-art-review.json'),'utf8'));
const station=WorldModel.create(fixture.station),geo=station.projectGeometry(),T=geo.TILE,floor=[];
for(let y=0;y<geo.ROWS;y++)for(let x=0;x<geo.COLS;){
  if(geo.zoneGrid[y*geo.COLS+x]==null){x++;continue;}
  const from=x;while(x<geo.COLS&&geo.zoneGrid[y*geo.COLS+x]!=null)x++;
  floor.push(Object.freeze({x:from*T,y:y*T,w:(x-from)*T,h:T}));
}
const layout=Object.freeze({width:geo.W,height:geo.H,tileSize:T,floor:Object.freeze(floor),belts:Object.freeze([])});
const ox=floor[0].x/T-3,oy=floor[0].y/T;
const bodies=Object.freeze(fixture.agents.map(a=>Object.freeze({id:a.id,name:a.name,
  x:(ox+fixture.positions[a.id][0]+.5)*T,y:(oy+fixture.positions[a.id][1]+.5)*T,dir:'south',state:'idle',odo:0,
  working:false,waiting:false,moving:false,unplaced:false,sitting:false,lying:false})));
const equipment=Object.freeze(geo.props.map(p=>Object.freeze({id:p.id,type:p.t,capability:station.capForProp(p.t),agentId:p.agentId,
  x:p.x*T,y:p.y*T,w:(p.w||1)*T,h:(p.h||1)*T,users:Object.freeze([])})));
const snapshot=Object.freeze({layout,bodies,equipment,connected:true,paused:false,
  viewport:Object.freeze({x:0,y:0,w:geo.W,h:geo.H}),transports:Object.freeze([])});
const before=JSON.stringify(snapshot),record=id=>fixture.agents.find(a=>a.id===id);
scope.StationPresentation.bind({agentRecord:record});scope.OpenArtWorld.bind(record);
mkdirSync(out,{recursive:true});
const canvas=createCanvas(962,639);
assert.equal(scope.OpenArtWorld.draw(canvas.getContext('2d'),canvas,{snapshot,now:1000,reducedMotion:true}),true);
writeFileSync(join(out,theme+'-renderer-preview.png'),canvas.toBuffer('image/png'));
assert.equal(JSON.stringify(snapshot),before,'rendering leaves frozen station state unchanged');
const hits=scope.OpenArtWorld.hitRects();
assert.equal(hits.filter(r=>r.kind==='agent'&&r.theme).length,bodies.length);
assert.equal(hits.filter(r=>r.kind==='equipment').length,equipment.length);
canvas.getBoundingClientRect=()=>({left:0,top:0,width:canvas.width,height:canvas.height});
for(const b of bodies){const p=scope.OpenArtWorld.worldToCanvas(b.x,b.y);assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));}
const top=hits.filter(r=>r.kind==='agent').at(-1);
assert.equal(scope.OpenArtWorld.clientHit({clientX:top.x+top.w/2,clientY:top.y+top.h/2},canvas).id,top.id);
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
console.log(JSON.stringify({theme,result:'passed',agents:bodies.length,equipment:equipment.length,immutableInputs:true,
  isolatedAssets:true,canonicalPicking:true,poseStates:['walking','working/seated','resting','waiting'],
  capture:'direct shipped renderer; seeded review state, not browser screenshot',path:join(out,theme+'-renderer-preview.png')}));
