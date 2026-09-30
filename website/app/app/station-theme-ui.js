/* Read-only game-client instruments. Navigation delegates to existing StarNet windows. */
'use strict';
const StationThemeUI = (() => {
  let snapshot = null, mapTransform = null, feedMode = 'conversation', filter = 'all', roster = [], lastSignature = '';
  const events = [], seenBodies=new Set(), CAP = typeof StationPresentation !== 'undefined' ? StationPresentation.CAPABILITIES : {};
  let welcomed=false,mapLayout=null,mapOutline=null;
  const el = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function agentName(id) { const a=roster.find(a=>a.id===id);return a&&a.name||id||'StarNet'; }
  function openAgent(id) {
    const index=roster.findIndex(a=>a.id===id);
    if(index<0)return;
    if(typeof World!=='undefined')World.focusBody(id);
    if(typeof StationUI!=='undefined')StationUI.openAgent(index);
    if(PresentationThemes.get()==='osrs'){
      const head=document.querySelector('.term.dossier .term-head');
      if(head){let look=head.querySelector('[data-osrs-looks]');if(!look){look=document.createElement('button');look.type='button';look.className='osrs-dossier-look';look.textContent='Appearance';head.insertBefore(look,head.querySelector('.term-x'));}look.dataset.osrsLooks=id;}
    }
  }
  function nav(action) {
    el('left')?.classList.toggle('osrs-projects-open',action==='projects');
    document.querySelectorAll('.station-game-nav [data-station-nav]').forEach(b=>b.setAttribute('aria-current',b.dataset.stationNav===action?'page':'false'));
    if(action==='station'){ if(typeof OSRSWorld!=='undefined')OSRSWorld.reset();if(typeof OpenArtWorld!=='undefined'&&OpenArtWorld.active())OpenArtWorld.reset();if(typeof World!=='undefined'&&World.presentationOverview)World.presentationOverview();return; }
    if(action==='missions'){el('bb-missions')?.click();return;}
    if(action==='projects'){document.querySelector('[data-ws-tab="projects"]')?.click();el('ws-tab-projects')?.click();return;}
    if(action==='analytics'){StationUI.openTerm('agents','record');return;}
    if(action==='refit'){el('bb-build')?.click();return;}
    if(action==='recruit'){el('bb-recruit')?.click();return;}
    if(typeof StationUI!=='undefined')StationUI.openTerm(action);
  }
  function mount() {
    const top=el('topbar'), game=el('screen-game'), chat=el('chat-panel');if(!top||!game||!chat)return;
    const picker=document.createElement('label');picker.className='station-ui-picker';picker.innerHTML='<span>UI STYLE</span><select id="station-ui-select" aria-label="Station UI style">'+PresentationThemes.catalog.map(t=>'<option value="'+t.id+'">'+t.name+'</option>').join('')+'</select>';
    top.insertBefore(picker,top.querySelector('.tb-stats'));el('station-ui-select').value=PresentationThemes.get();
    picker.addEventListener('change',e=>PresentationThemes.set(e.target.value));
    const looks=document.createElement('button');looks.type='button';looks.className='osrs-looks-button';looks.dataset.osrsLooks='';looks.textContent='NPCs & armour';top.appendChild(looks);
    const status=document.createElement('div');status.className='osrs-station-status';status.id='osrs-station-status';status.setAttribute('role','status');top.appendChild(status);
    const navBar=document.createElement('nav');navBar.className='station-game-nav';navBar.setAttribute('aria-label','Station navigation');
    navBar.innerHTML=[['station','✦','Station'],['agents','♟','Agents'],['missions','▤','Missions'],['projects','▥','Projects'],['deliverables','▣','Files'],['connectors','◎','Integrations'],['analytics','▥','Analytics'],['settings','⚒','Settings']].map(([id,glyph,label])=>'<button type="button" data-station-nav="'+id+'"'+(id==='station'?' aria-current="page"':'')+'><i class="osrs-nav-icon icon-'+id+'" aria-hidden="true">'+glyph+'</i>'+label+'</button>').join('');
    el('left')?.insertBefore(navBar,el('left').firstChild);
    navBar.addEventListener('click',e=>{const b=e.target.closest('[data-station-nav]');if(b)nav(b.dataset.stationNav);});
    const aside=document.createElement('aside');aside.id='station-game-overview';aside.setAttribute('aria-label','Station map and overview');
    aside.innerHTML='<div class="station-map-shell"><span class="station-map-north" aria-hidden="true">N<br>✦</span><canvas id="station-minimap" width="280" height="280" tabindex="0" role="button" aria-label="Live station minimap. Click an agent or equipment to inspect. Press Enter for the station overview."></canvas><div class="station-map-legend"><span>● Crew</span><span>▪ Equipment</span><span>◆ Active</span></div></div>'+
      '<dl class="osrs-map-orbs" aria-label="Live station counts"><div title="Agents on station"><dt>Agents</dt><dd id="osrs-orb-crew">0</dd></div><div title="Agents currently working"><dt>Working</dt><dd id="osrs-orb-work">0</dd></div><div title="Station equipment"><dt>Equipment</dt><dd id="osrs-orb-gear">0</dd></div><div title="Agents waiting for approval"><dt>Waiting</dt><dd id="osrs-orb-wait">0</dd></div></dl>'+
      '<div class="station-overview-heading"><span class="osrs-nav-icon icon-station">✦</span><div>Station Overview<small id="station-overview-link">Connecting…</small></div></div>'+
      '<dl class="station-overview-stats"><div><dt>Agents Online</dt><dd id="station-overview-crew">—</dd></div><div><dt>Working Agents</dt><dd id="station-overview-working">—</dd></div><div><dt>Station Equipment</dt><dd id="station-overview-gear">—</dd></div></dl>'+
      '<section class="station-equipment-detail" id="station-equipment-detail" hidden><h4 id="station-equipment-name"></h4><p id="station-equipment-cap"></p><p id="station-equipment-users"></p><button type="button" data-station-nav="connectors">View abilities</button></section>'+
      '<section class="station-mission-card"><h4 class="station-side-title"><i class="osrs-nav-icon icon-missions" aria-hidden="true">▤</i>Current Mission</h4><div id="station-current-work" class="station-current-work"></div></section>'+
      '<section class="station-crew-card"><h4 class="station-side-title">Active Agents</h4><div id="station-map-crew" class="station-map-crew"></div></section>'+
      '<div class="station-side-actions"><button type="button" data-station-nav="tasks">Task board</button><button type="button" data-station-nav="connectors">Capabilities</button></div>'+
      '<nav class="osrs-client-tabs" aria-label="Station windows">'+[['tasks','Missions'],['analytics','Agent records'],['quests','Quests'],['deliverables','Files'],['recruit','Recruit'],['connectors','Abilities'],['agents','Agents'],['settings','Settings']].map(([id,label],i)=>'<button type="button" data-station-nav="'+id+'" aria-label="'+label+'" title="'+label+'" style="--tab-index:'+i+'"></button>').join('')+'</nav>';
    game.appendChild(aside);
    aside.addEventListener('click',e=>{const a=e.target.closest('[data-map-agent]');if(a)openAgent(a.dataset.mapAgent);const b=e.target.closest('[data-station-nav]');if(b)nav(b.dataset.stationNav);const w=e.target.closest('[data-map-work]');if(w&&typeof App!=='undefined')App.openWorkstream(w.dataset.mapWork);});
    const tabs=document.createElement('div');tabs.className='station-feed-tabs';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Conversation or station activity');
    tabs.innerHTML='<button type="button" data-station-feed="conversation" aria-pressed="true">Conversation</button><button type="button" data-station-feed="activity" aria-pressed="false">Station activity</button><select id="station-feed-filter" aria-label="Activity filter"><option value="all">All activity</option><option value="agent">Agents</option><option value="system">System</option><option value="error">Errors</option></select>';
    chat.insertBefore(tabs,el('chat-log'));
    const log=document.createElement('div');log.id='station-event-log';log.setAttribute('role','log');log.setAttribute('aria-label','Station activity');log.setAttribute('aria-live','polite');log.hidden=true;
    chat.insertBefore(log,el('chat-log'));
    tabs.addEventListener('click',e=>{const b=e.target.closest('[data-station-feed]');if(b)setFeed(b.dataset.stationFeed);});
    el('station-feed-filter').addEventListener('change',e=>{filter=e.target.value;renderEvents();});
    el('chat-input')?.addEventListener('focus',()=>setFeed('conversation'));
    const prompt=document.createElement('span');prompt.className='osrs-player-prompt';prompt.textContent='Commander:';chat.querySelector('.chat-editline')?.prepend(prompt);
    const filters=document.createElement('nav');filters.className='osrs-chat-filters';filters.setAttribute('aria-label','Station chat channels');
    filters.innerHTML=[['all','All'],['agent','Agents'],['system','System'],['error','Errors'],['conversation','Chat'],['tools','Controls']].map(([id,label])=>'<button type="button" data-osrs-channel="'+id+'">'+label+'<small>On</small></button>').join('');
    el('bottombar').prepend(filters);
    filters.addEventListener('click',e=>{const b=e.target.closest('[data-osrs-channel]');if(!b)return;const mode=b.dataset.osrsChannel;if(mode==='tools'){chat.classList.toggle('osrs-controls-open');b.setAttribute('aria-pressed',String(chat.classList.contains('osrs-controls-open')));return;}if(mode==='conversation')setFeed('conversation');else{filter=mode;el('station-feed-filter').value=mode;setFeed('activity');renderEvents();}});
    el('station-minimap').addEventListener('click',mapClick);
    el('station-minimap').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();nav('station');}});
    document.addEventListener('click',e=>{const b=e.target.closest('[data-station-theme]');if(b)PresentationThemes.set(b.dataset.stationTheme);});
    StationPresentation.bind({agentRecord:id=>roster.find(a=>a.id===id)||null});
    if(typeof OSRSWorld!=='undefined')OSRSWorld.bind(id=>roster.find(a=>a.id===id)||null);
    if(typeof OpenArtWorld!=='undefined')OpenArtWorld.bind(id=>roster.find(a=>a.id===id)||null);
    if(typeof StationArt!=='undefined')StationArt.subscribe(()=>{lastSignature='';tick();});
    PresentationThemes.subscribe(changed);changed(PresentationThemes.get());
    OSRSAppearance.subscribe(()=>{lastSignature='';tick();});
    wireEvents();setInterval(tick,250);tick();
  }
  function changed(id) {
    if(el('station-ui-select'))el('station-ui-select').value=id;
    document.querySelectorAll('[data-station-theme]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.stationTheme===id)));
    StationPresentation.reset();if(typeof OSRSWorld!=='undefined')OSRSWorld.reset();setFeed(id==='osrs'?'activity':id==='original'?'conversation':feedMode);
    lastSignature='';renderEvents();
    if(typeof StationArt!=='undefined'&&StationArt.has(id))StationArt.applyUI(id);
    // Let the existing resize observer rebuild its canvas and camera using the new layout.
    window.dispatchEvent(new Event('resize'));tick();
    if(typeof World!=='undefined'&&World.presentationOverview)World.presentationOverview();
  }
  function setFeed(mode) {
    feedMode=mode==='activity'?'activity':'conversation';
    const active=PresentationThemes.get()!=='original'&&feedMode==='activity';
    el('chat-panel')?.classList.toggle('station-activity-selected',active);
    if(el('station-event-log'))el('station-event-log').hidden=!active;
    document.querySelectorAll('[data-station-feed]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.stationFeed===feedMode)));
    document.querySelectorAll('[data-osrs-channel]:not([data-osrs-channel="tools"])').forEach(b=>b.setAttribute('aria-pressed',String(feedMode==='conversation'?b.dataset.osrsChannel==='conversation':b.dataset.osrsChannel===filter)));
  }
  function addEvent(kind,agentId,message) {
    const date=new Date();events.push({kind,agentId,message:String(message).slice(0,240),time:date.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',hour12:false})});
    if(events.length>120)events.shift();renderEvents();
  }
  function wireEvents() {
    if(typeof U==='undefined'||!U.bus)return;
    U.bus.on('agent.run.start',p=>addEvent('agent',p?.agentId,'Run started.'));
    U.bus.on('agent.tool_call',p=>{if(p?.name)addEvent('agent',p.agentId,'Using '+p.name.replace(/^mcp__/,'').replace(/__/g,' / ')+'.');});
    U.bus.on('agent.tool_result',p=>{if(p?.isError||p?.error)addEvent('error',p.agentId,'Tool reported an error. Open the conversation for details.');});
    U.bus.on('agent.run.end',p=>addEvent(['error','budget','max_iters'].includes(p?.reason)?'error':'agent',p?.agentId,'Run finished: '+(p?.reason||'finished')+'.'));
    U.bus.on('agent.run.error',p=>addEvent('error',p?.agentId,'Run blocked. Open the agent record for details.'));
    U.bus.on('shell.exec',p=>addEvent('agent',p?.agentId,'Using terminal / coding equipment.'));
    U.bus.on('verify.result',p=>addEvent(p?.ok===false?'error':'agent',p?.agentId,'Verification result received.'));
    U.bus.on('workitem.delivered',p=>addEvent('system',p?.agentId,'Work delivered to the outbox.'));
    U.bus.on('queue.status',p=>{if(Number(p?.pending)>0)addEvent('system',null,p.pending+' queued jobs.');});
    U.bus.on('capdenied',p=>addEvent('error',p?.agentId,'Capability unavailable. Check station equipment and permissions.'));
  }
  function renderEvents() {
    const host=el('station-event-log');if(!host)return;
    const stick=host.scrollHeight-host.scrollTop-host.clientHeight<45;
    const visible=events.filter(e=>filter==='all'||e.kind===filter);
    host.innerHTML=visible.length?visible.map(e=>'<p class="station-event '+e.kind+'"><time>['+esc(e.time)+']</time> <b>'+esc(agentName(e.agentId))+':</b> '+esc(e.message)+'</p>').join(''):'<p class="station-feed-empty">Watching for station activity. Agent runs, tool calls and results appear here as they happen.</p>';
    if(stick)host.scrollTop=host.scrollHeight;
  }
  function tick() {
    if(typeof App!=='undefined'&&App.agents)roster=App.agents();
    if(PresentationThemes.get()==='original'||!el('screen-game')?.classList.contains('active'))return;
    if(typeof World==='undefined'||!World.presentationSnapshot)return;
    snapshot=World.presentationSnapshot();if(!snapshot||!snapshot.layout)return;
    drawMap(snapshot);
    const bodies=snapshot.bodies.filter(b=>!b.unplaced);
    if(snapshot.connected&&!welcomed){welcomed=true;addEvent('system',null,'Welcome to your station.');}
    for(const b of bodies)if(!seenBodies.has(b.id)){seenBodies.add(b.id);addEvent('agent',b.id,'On station.');}
    const clock=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:false});
    const state=snapshot.paused?'Paused':snapshot.connected?'Online':'Reconnecting';
    el('station-overview-link').innerHTML='StarNet <span class="osrs-online">'+state+'</span> | '+clock;
    el('osrs-station-status').innerHTML='<i aria-hidden="true">▂▅▇</i><span>'+state+'</span><time>'+clock+'</time>';
    el('station-overview-crew').textContent=bodies.length+'/'+roster.length;
    el('station-overview-working').textContent=bodies.filter(b=>b.working).length;
    el('station-overview-gear').textContent=snapshot.equipment.length;
    el('osrs-orb-crew').textContent=bodies.length;el('osrs-orb-work').textContent=bodies.filter(b=>b.working).length;el('osrs-orb-gear').textContent=snapshot.equipment.length;el('osrs-orb-wait').textContent=bodies.filter(b=>b.waiting).length;
    const signature=bodies.map(b=>[b.id,b.name,b.working,b.waiting,b.moving,b.tool,b.role]).join('|')+roster.map(a=>[a.id,a.name,a.specialtyId,a.model]).join('|')+OSRSAppearance.revision();
    if(signature!==lastSignature){lastSignature=signature;el('station-map-crew').innerHTML=bodies.map(b=>{
      const a=roster.find(a=>a.id===b.id)||b, role=StationPresentation.roleFor(a), label=b.waiting?'Awaiting approval':b.tool?'Using '+b.tool:b.working?'Working…':b.moving?'Walking…':'Idle';
      const osrs=PresentationThemes.get()==='osrs',illustrated=typeof OpenArtWorld!=='undefined'&&OpenArtWorld.active(),look=OSRSAppearance.resolve(a);
      return '<div class="station-crew-row"><button type="button" data-map-agent="'+esc(b.id)+'" class="station-crew-entry" title="'+esc(b.name+' · '+role.job+' · '+label)+'">'+(osrs||illustrated?'<canvas class="station-npc-mark" width="40" height="52" data-npc-portrait="'+esc(b.id)+'" aria-hidden="true"></canvas>':'<span class="station-npc-mark" style="--npc-color:'+role.color+'" aria-hidden="true">♟</span>')+'<span><b>'+esc(osrs?look.npcName:b.name)+'</b><small>'+esc(osrs?label:illustrated?label:role.name+' · '+label)+'</small></span><i class="'+(b.waiting?'waiting':b.working?'working':'idle')+'" aria-hidden="true"></i></button><button type="button" class="osrs-crew-look" data-osrs-looks="'+esc(b.id)+'" aria-label="Change '+esc(b.name)+' appearance" title="Change appearance">⚒</button></div>';
    }).join('')||'<p class="station-feed-empty">Your crew appears here after onboarding.</p>';}
    if(PresentationThemes.get()==='osrs')document.querySelectorAll('[data-npc-portrait]').forEach(c=>OSRSWorld.drawPortrait(c,roster.find(a=>a.id===c.dataset.npcPortrait)||{id:c.dataset.npcPortrait}));
    else if(typeof OpenArtWorld!=='undefined'&&OpenArtWorld.active())document.querySelectorAll('[data-npc-portrait]').forEach(c=>OpenArtWorld.drawPortrait(c,roster.find(a=>a.id===c.dataset.npcPortrait)||{id:c.dataset.npcPortrait}));
    const work=typeof Workstreams!=='undefined'&&Workstreams.all?Workstreams.all().filter(w=>w.busy):[];
    const ws=JSON.stringify(work.map(w=>[w.id,w.title,w.agentId]));
    if(el('station-current-work').dataset.signature!==ws){el('station-current-work').dataset.signature=ws;el('station-current-work').innerHTML=work.length?work.slice(0,5).map(w=>'<button type="button" data-map-work="'+esc(w.id)+'"><b>'+esc(w.title||'Agent session')+'</b><small>'+esc(agentName(w.agentId))+' · in progress</small></button>').join(''):'<p class="station-feed-empty">No active sessions.<br>Start a mission or talk to your crew.</p>';}
  }
  function drawMap(s) {
    const canvas=el('station-minimap'),g=canvas.getContext('2d');if(!g)return;
    const W=canvas.width,H=canvas.height,margin=29,l=s.layout,k=Math.min((W-margin*2)/l.width,(H-margin*2)/l.height);
    const ox=(W-l.width*k)/2,oy=(H-l.height*k)/2;mapTransform={k,ox,oy};
    g.clearRect(0,0,W,H);g.save();g.beginPath();g.arc(W/2,H/2,W/2-9,0,Math.PI*2);g.clip();
    g.fillStyle='#060b0d';g.fillRect(0,0,W,H);g.translate(ox,oy);g.scale(k,k);
    const osrs=PresentationThemes.get()==='osrs',illustrated=typeof OpenArtWorld!=='undefined'&&OpenArtWorld.active(),palette=illustrated?StationArt.models[PresentationThemes.get()].palette:null;
    g.fillStyle=osrs?'#5a5847':palette?palette[4]:'#19364b';
    g.strokeStyle=osrs?'#97907a33':palette?palette[2]+'33':'#427991';g.lineWidth=1/k;
    for(const r of l.floor){g.fillRect(r.x,r.y,r.w,r.h);g.strokeRect(r.x,r.y,r.w,r.h);}
    if(osrs||illustrated){
      if(mapLayout!==l){mapLayout=l;mapOutline=OSRSWorld.outline(l);}
      for(const points of mapOutline.loops){g.beginPath();points.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();g.strokeStyle=palette?palette[1]:'#34332e';g.lineWidth=9;g.stroke();g.strokeStyle=palette?palette[2]:'#8c8a81';g.lineWidth=5;g.stroke();}
    }
    for(const p of s.equipment){if(osrs&&OSRSWorld.drawMapEquipment(g,p))continue;if(illustrated&&OpenArtWorld.drawMapEquipment(g,p))continue;g.fillStyle=p.users.length?'#c9ae55':'#818e84';g.fillRect(p.x,p.y,p.w,p.h);}
    for(const b of s.bodies){if(b.unplaced)continue;g.beginPath();g.arc(b.x,b.y,(b.working?3.3:2.5)/k,0,Math.PI*2);g.fillStyle=b.waiting?'#e76954':b.working?'#ffdc64':osrs?'#e9d26b':'#c9dbb3';g.fill();g.strokeStyle='#282c22';g.stroke();}
    const v=s.viewport,bounds=typeof OSRSWorld!=='undefined'?OSRSWorld.bounds(l):null;
    if(v&&(!bounds||v.x>bounds.x||v.y>bounds.y||v.x+v.w<bounds.x+bounds.w||v.y+v.h<bounds.y+bounds.h)){g.strokeStyle='#d5ca99';g.lineWidth=1/k;g.strokeRect(v.x,v.y,v.w,v.h);}
    g.restore();g.strokeStyle=osrs?'#887855':palette?palette[2]:'#4aa7c6';g.lineWidth=5;g.beginPath();g.arc(W/2,H/2,W/2-7,0,Math.PI*2);g.stroke();
  }
  function mapClick(e) {
    if(!snapshot||!mapTransform)return;const c=el('station-minimap'),r=c.getBoundingClientRect();
    const cx=(e.clientX-r.left)*c.width/r.width,cy=(e.clientY-r.top)*c.height/r.height;
    if(Math.hypot(cx-c.width/2,cy-c.height/2)>c.width/2-9)return;
    const {k,ox,oy}=mapTransform,x=(cx-ox)/k,y=(cy-oy)/k;
    const body=snapshot.bodies.filter(b=>!b.unplaced).find(b=>Math.hypot(b.x-x,b.y-y)*k<9);
    if(body){openAgent(body.id);return;}
    const prop=snapshot.equipment.find(p=>x>=p.x-3/k&&x<=p.x+p.w+3/k&&y>=p.y-3/k&&y<=p.y+p.h+3/k);
    if(prop){el('station-equipment-detail').hidden=false;el('station-equipment-name').textContent=prop.type.replace(/_/g,' ');el('station-equipment-cap').textContent=CAP[prop.capability]||prop.capability||'Station equipment';el('station-equipment-users').textContent=prop.users.length?'In use by '+prop.users.map(agentName).join(', '):'No active operators';}
    if(typeof World!=='undefined'&&World.presentationFocus)World.presentationFocus(x,y);
  }
  if(typeof document!=='undefined'&&typeof PresentationThemes!=='undefined')mount();
  return {openAgent,nav,tick,events:()=>events.map(e=>({...e}))};
})();
