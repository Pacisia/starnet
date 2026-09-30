#!/usr/bin/env node
/* Optional real-browser integration check. Uses StarNet's existing CDP/seed helpers, an isolated
   workspace and placeholder credentials. Fixtures project events; no provider request is made. */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { launchChrome, connectCDP, evalJS, sleep } from './lib/cdp.mjs';
import { materializeSeedWorkspace, bootSeededSidecar, waitUp } from './lib/seed.mjs';

const freePort = () => new Promise((resolve, reject) => {
  const server = createServer(); server.once('error', reject);
  server.listen(0, '127.0.0.1', () => { const port = server.address().port;
    server.close(error => error ? reject(error) : resolve(port)); });
});
const scratch = mkdtempSync(join(tmpdir(), 'starnet-theme-check-'));
let server, chrome, cdp;
const errors = [];
const evaluate = expression => evalJS(cdp, expression);
async function waitFor(expression, message) {
  for (let i = 0; i < 70; i++) { if (await evaluate(expression)) return; await sleep(500); }
  throw new Error(message);
}
async function clickPoint(point) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}
const choose = id => evaluate(`(() => { const before=window.__themeCheckIdentity?.();const s=document.getElementById('station-ui-select');s.value=${JSON.stringify(id)};s.dispatchEvent(new Event('change',{bubbles:true}));return {id:PresentationThemes.get(),unchanged:before===window.__themeCheckIdentity?.()}; })()`);

try {
  const port = await freePort(), cdpPort = await freePort();
  materializeSeedWorkspace(join(scratch, 'workspace'));
  server = bootSeededSidecar({ port, scratchDir: join(scratch, 'workspace'), key: 'sk-or-theme-test-placeholder' });
  assert.ok(await waitUp(`http://127.0.0.1:${port}/`, 30), 'seeded sidecar boots');
  chrome = launchChrome({ cdpPort, win: '1536,1024', profileDir: join(scratch, 'chrome') }).proc;
  cdp = await connectCDP(cdpPort);
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable');
  cdp.on('Runtime.exceptionThrown', p => errors.push(p.exceptionDetails?.text || 'browser exception'));
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/` });
  await waitFor(`typeof World!=='undefined'&&typeof App!=='undefined'&&document.getElementById('screen-game').classList.contains('active')&&World.bodies().length>0`, 'live station ready');
  await evaluate(`App.summonAgent({id:'researcher',name:'THEME CHECK',purpose:'Research specialist',manual:'Browser fixture',model:'balanced',skills:[]},{desk:true})`);
  await sleep(1000);
  await evaluate(`window.__themeCheckIdentity=()=>JSON.stringify({station:World.stationDoc(),agents:App.agents()})`);
  for (const id of ['osrs', 'cyberpunk', 'holographic', 'original']) {
    const switched = await choose(id);
    assert.equal(switched.id, id);
    assert.ok(switched.unchanged, 'theme change preserves canonical station and roster');
    await sleep(350);
    assert.ok(await evaluate(`document.body.dataset.stationTheme===${JSON.stringify(id)}`), 'picker applies ' + id);
  }
  await choose('osrs');
  await waitFor(`typeof OSRSWorld!=='undefined'&&OSRSWorld.ready()&&OSRSWorld.hitRects().some(r=>r.kind==='agent')`, 'perspective assets and real entities ready');
  assert.ok(await evaluate(`(() => {const s=World.presentationSnapshot();return Object.isFrozen(s)&&Object.isFrozen(s.bodies)&&Object.isFrozen(s.bodies[0])&&Object.isFrozen(s.layout.floor)&&Object.isFrozen(s.equipment[0].users);})()`), 'projection is immutable');
  assert.ok(await evaluate(`World.presentationSnapshot().bodies.every(b=>{const original=World.bodies().find(a=>a.id===b.id);return original&&Math.abs(original.px-b.x)<2&&Math.abs(original.py-b.y)<2;})`), 'minimap projects actual body positions');

  // Dispatch actual canvas clicks through the browser input path.
  const mapPoint = target => evaluate(`(() => {const s=World.presentationSnapshot(),c=document.getElementById('station-minimap'),r=c.getBoundingClientRect(),l=s.layout,k=Math.min(222/l.width,222/l.height),ox=(280-l.width*k)/2,oy=(280-l.height*k)/2;const p=${target};return {x:r.left+(ox+p.x*k)*r.width/280,y:r.top+(oy+p.y*k)*r.height/280};})()`);
  await clickPoint(await mapPoint('s.bodies[0]'));
  await waitFor(`!!document.querySelector('.term.dossier')`, 'minimap opens native dossier');
  await evaluate(`StationUI.closeTerm('agents')`);
  // Perspective sprites and their labels use the same real body picking path as Original.
  const actorPoint=await evaluate(`(() => {const r=OSRSWorld.hitRects().find(r=>r.kind==='agent'),c=document.getElementById('stage'),b=c.getBoundingClientRect();return {x:b.left+(r.x+r.w/2)*b.width/c.width,y:b.top+(r.y+r.h/2)*b.height/c.height};})()`);
  await clickPoint(actorPoint);
  await waitFor(`!!document.querySelector('.term.dossier')`, 'perspective NPC opens native dossier');
  await evaluate(`StationUI.closeTerm('agents');StationThemeUI.nav('station')`);
  await sleep(400);
  assert.ok(await evaluate(`(() => {const c=document.getElementById('stage'),r=c.getBoundingClientRect(),p=OSRSWorld.hitRects().find(r=>r.kind==='equipment');if(!p)return false;const e={clientX:r.left+(p.x+p.w/2)*r.width/c.width,clientY:r.top+(p.y+p.h/2)*r.height/c.height};const hit=OSRSWorld.clientHit(e,c);return hit&&hit.kind==='equipment'&&World.presentationSnapshot().equipment.some(p=>p.id===hit.id);})()`), 'equipment sprite picks a canonical equipment ID');
  await clickPoint(await mapPoint(`(() => {const p=s.equipment.find(p=>p.capability==='cabinet')||s.equipment[s.equipment.length-1];return {x:p.x+p.w/2,y:p.y+p.h/2};})()`));
  await waitFor(`!document.getElementById('station-equipment-detail').hidden`, 'minimap equipment inspector opens');
  assert.ok(await evaluate(`document.getElementById('station-equipment-cap').textContent.length>0`), 'equipment has canonical capability');

  // Event fixtures test the real subscriptions, escaping, filters and bounded activity projection.
  await evaluate(`U.bus.emit('agent.tool_call',{agentId:App.agents()[0].id,name:'web.search <fixture>'});U.bus.emit('capdenied',{agentId:App.agents()[0].id});U.bus.emit('workitem.delivered',{});document.querySelector('[data-station-feed="activity"]').click()`);
  assert.ok(await evaluate(`document.getElementById('station-event-log').textContent.includes('web.search <fixture>')&&!document.querySelector('#station-event-log fixture')`), 'activity text is escaped');
  await evaluate(`const f=document.getElementById('station-feed-filter');f.value='error';f.dispatchEvent(new Event('change'))`);
  assert.ok(await evaluate(`document.querySelectorAll('#station-event-log .station-event').length===1&&document.querySelector('#station-event-log .station-event.error')`), 'error filter selects real event kinds');
  await evaluate(`for(let i=0;i<130;i++)U.bus.emit('queue.status',{pending:1});document.getElementById('station-feed-filter').value='all';document.getElementById('station-feed-filter').dispatchEvent(new Event('change'))`);
  assert.equal(await evaluate(`StationThemeUI.events().length`), 120, 'bounded feed');
  await evaluate(`document.getElementById('chat-input').focus()`);
  assert.ok(await evaluate(`!document.getElementById('chat-panel').classList.contains('station-activity-selected')`), 'composer returns to actual conversation');

  const worker = await evaluate(`App.agents().find(a=>a.name==='THEME CHECK').id`);
  await evaluate(`World.setActivityFor(${JSON.stringify(worker)},'task')`);
  await waitFor(`World.bodies().some(b=>b.id===${JSON.stringify(worker)}&&b.working&&(b.moving||b.sitting))`, 'working fixture routes to its station');
  await choose('holographic');
  assert.ok(await evaluate(`World.bodies().find(b=>b.id===${JSON.stringify(worker)}).working`), 'changing renderer preserves running body state');
  await evaluate(`World.setActivityFor(${JSON.stringify(worker)},'idle');StationUI.openTerm('settings','appearance')`);
  await waitFor(`!!document.querySelector('.station-theme-card[data-station-theme="osrs"]')`, 'Appearance contains picker cards');
  await evaluate(`document.querySelector('.station-theme-card[data-station-theme="osrs"]').click();StationUI.closeTerm('settings')`);
  assert.equal(await evaluate(`PresentationThemes.get()`), 'osrs', 'settings picker uses the same preference');
  await evaluate(`document.getElementById('comms-expand').click()`);
  assert.ok(await evaluate(`getComputedStyle(document.getElementById('station-game-overview')).display==='none'`), 'expanded conversation hides instruments');
  await evaluate(`document.getElementById('comms-expand').click()`);
  await cdp.send('Page.reload');
  await waitFor(`typeof PresentationThemes!=='undefined'&&PresentationThemes.get()==='osrs'&&document.getElementById('screen-game').classList.contains('active')`, 'selected theme survives reload');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await sleep(1200);
  assert.ok(await evaluate(`(() => {const input=document.getElementById('chat-input').getBoundingClientRect(),dock=document.getElementById('bottombar').getBoundingClientRect(),stage=document.getElementById('stage').getBoundingClientRect();return input.width>100&&input.top>stage.bottom&&dock.bottom<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth;})()`), 'phone retains usable composer, station and dock');
  assert.ok(await evaluate(`getComputedStyle(document.getElementById('chat-inputrow')).backgroundColor==='rgb(202, 188, 151)'`), 'OSRS composer uses a readable parchment surface');
  await choose('original');
  assert.ok(await evaluate(`getComputedStyle(document.getElementById('station-game-overview')).display==='none'&&!document.getElementById('chat-panel').classList.contains('station-activity-selected')`), 'original restores native UI');
  assert.deepEqual(errors, [], 'no browser exceptions');
  console.log('station-themes browser: all four renderers, state preservation, perspective NPC and equipment picking, minimap clicks, event filters, working state, Settings, persistence, expanded conversation and 390px layout passed; no provider calls');
} finally {
  if (cdp) { try { await cdp.send('Browser.close'); } catch {} }
  for (const p of [chrome, server]) { if (p && p.exitCode == null) p.kill('SIGKILL'); }
  await sleep(300); rmSync(scratch, { recursive: true, force: true });
}
