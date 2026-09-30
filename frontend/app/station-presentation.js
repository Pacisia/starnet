/* Swappable draw adapters. Inputs are geometry and copies of visual state, never mutable simulation
 * records. A renderer returns false/null to use StarNet's native art. No events, requests or saves. */
'use strict';
const StationPresentation = (() => {
  const renderers = new Map();
  let lookupAgent = () => null, plate = null, plateSource = null, plateTheme = null, plateGeo = null;
  const selected = () => typeof PresentationThemes === 'undefined' ? 'original' : PresentationThemes.get();
  const ROLES = Object.freeze({
    player: { name: 'Operator', npcName:'Operator', job:'Station Operator', color: '#63748b', trim: '#dccb89', kind: 'player' },
    mage: { name: 'Research Mage', npcName:'Zamorak Mage', job:'Research Agent', color: '#922e2c', trim: '#d4b44c', kind: 'mage' },
    scholar: { name: 'Elder Scholar', npcName:'Wise Old Man', job:'Analytics Agent', color: '#8e9999', trim: '#d6d9c5', kind: 'scholar' },
    ranger: { name: 'Ranger', npcName:'Robin Hood', job:'Content Agent', color: '#3c7035', trim: '#c4a14c', kind: 'ranger' },
    guard: { name: 'Knight', npcName:'Guard', job:'Security Agent', color: '#5d7790', trim: '#c2c8cb', kind: 'guard' },
    cook: { name: 'Crafter', npcName:'Cook', job:'Data Agent', color: '#d9d6c2', trim: '#747d7c', kind: 'cook' },
    banker: { name: 'Banker', npcName:'Banker', job:'Finance Agent', color: '#533e79', trim: '#d4bc57', kind: 'banker' },
    elf: { name: 'Elven Artificer', npcName:'Elven Guard', job:'Integration Agent', color: '#7e9462', trim: '#d1ce9e', kind: 'elf' },
    dwarf: { name: 'Dwarven Smith', npcName:'Dwarf', job:'Build Agent', color: '#867855', trim: '#b3a488', kind: 'dwarf' },
    scout: { name: 'Traveller', npcName:'Draynor Villager', job:'Web Agent', color: '#887443', trim: '#bdad80', kind: 'scout' }
  });
  function roleFor(record) {
    const a = record || {};
    if (a.role === 'orchestrator' || a.id === 'agent' || a.role === 'operator') return ROLES.player;
    // A declared specialty wins over words in a long prompt (an engineer may mention security).
    const declared = String(a.specialtyId || a.role || '').toLowerCase();
    const text = declared && !['specialist','agent','worker'].includes(declared) ? declared :
      [a.personaId, a.name, a.purpose].filter(Boolean).join(' ').toLowerCase();
    if (/security|guard|audit|cyber|test|qa\b/.test(text)) return ROLES.guard;
    if (/integrat|connector|api\b/.test(text)) return ROLES.elf;
    if (/financ|bank|budget|account|invest|money/.test(text)) return ROLES.banker;
    if (/analyst|analytic|statistic|insight/.test(text)) return ROLES.scholar;
    if (/research|scholar|science/.test(text)) return ROLES.mage;
    if (/content|writer|creat|social|design|market|bard/.test(text)) return ROLES.ranger;
    if (/data|database|etl|cook|craft/.test(text)) return ROLES.cook;
    if (/engineer|develop|cod|build|devops|smith/.test(text)) return ROLES.dwarf;
    if (/web|brows|scout|travel/.test(text)) return ROLES.scout;
    return ROLES.scout;
  }
  const CAPABILITIES = Object.freeze({ computer: 'Compute / agent workstation', workbench: 'Terminal / coding', dish: 'Web / communications',
    cabinet: 'Files / storage', notebook: 'Memory / research', studio: 'Media / content', jukebox: 'Music', portal: 'Connected tools' });
  function polygon(ctx, points, fill, stroke) {
    ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = .6; ctx.stroke(); }
  }
  function box(ctx, x, y, w, h, rise, top, front, side) {
    polygon(ctx, [[x,y-rise],[x+w,y-rise],[x+w,y+h-rise],[x,y+h-rise]], top, '#282724');
    polygon(ctx, [[x,y+h-rise],[x+w,y+h-rise],[x+w,y+h],[x,y+h]], front, '#282724');
    polygon(ctx, [[x+w,y-rise],[x+w+3,y-rise-2],[x+w+3,y+h-2],[x+w,y+h]], side, '#282724');
  }
  function floorPlate(frame, theme) {
    const source = frame.cache && frame.cache.baseCv, geo = frame.geo;
    if (!source || typeof document === 'undefined') return null;
    if (plate && plateSource === source && plateTheme === theme && plateGeo === geo) return plate;
    plate = document.createElement('canvas'); plate.width = source.width; plate.height = source.height;
    const g = plate.getContext('2d'); if (!g) return null;
    plateSource = source; plateTheme = theme; plateGeo = geo;
    g.filter = theme === 'osrs' ? 'sepia(.68) saturate(.52) brightness(1.25)' : theme === 'cyberpunk' ? 'hue-rotate(160deg) saturate(1.4) brightness(.82)' : 'grayscale(1) sepia(1) hue-rotate(150deg) saturate(1.8) brightness(.9)';
    g.drawImage(source, 0, 0); g.filter = 'none';
    const T = geo && geo.TILE || 12;
    if (geo && geo.zoneGrid) {
      // Paint only known interior tiles. Geometry, collision and station dimensions stay canonical.
      const startX = Math.max(0, Math.floor((frame.cache.viewport?.x || 0) / T));
      const startY = Math.max(0, Math.floor((frame.cache.viewport?.y || 0) / T));
      const endX = Math.min(geo.COLS, startX + Math.ceil(plate.width / T));
      const endY = Math.min(geo.ROWS, startY + Math.ceil(plate.height / T));
      for (let y = startY; y < endY; y++) for (let x = startX; x < endX; x++) {
        if (geo.zoneGrid[y * geo.COLS + x] == null) continue;
        const px = x * T, py = y * T, hash = ((x * 73 + y * 31) % 17) / 17;
        if (theme === 'osrs') {
          g.fillStyle = 'rgb(' + Math.round(82 + hash * 12) + ',' + Math.round(79 + hash * 11) + ',' + Math.round(65 + hash * 10) + ')';
          g.fillRect(px, py, T, T); g.strokeStyle = '#676353'; g.lineWidth = .45; g.strokeRect(px + .5, py + .5, T-1, T-1);
          g.fillStyle = '#77715d'; g.fillRect(px+2+(x%3),py+3+(y%5),.5,.5);
          if (hash > .75) { g.strokeStyle = '#46453b'; g.beginPath(); g.moveTo(px+T-2,py+1);g.lineTo(px+T-4,py+4);g.lineTo(px+T-3,py+6);g.stroke(); }
        } else {
          g.fillStyle = theme === 'cyberpunk' ? 'rgba(25,13,43,.68)' : 'rgba(5,27,40,.82)';g.fillRect(px,py,T,T);
          g.strokeStyle = theme === 'cyberpunk' ? 'rgba(129,78,180,.22)' : 'rgba(93,208,231,.23)';g.lineWidth=.45;g.strokeRect(px,py,T,T);
        }
      }
    }
    return plate;
  }
  function drawBase(ctx, frame) {
    const theme = selected(); if (theme === 'original') return false;
    const custom = renderers.get(theme); if (custom && custom.drawBase) return !!custom.drawBase(ctx, frame);
    const base = floorPlate(frame, theme); if (!base) return false;
    ctx.save();ctx.drawImage(base, 0, 0);ctx.restore();return true;
  }
  function drawProp(ctx, prop, state) {
    const theme = selected(); if (theme === 'original') return false;
    const custom = renderers.get(theme); if (custom && custom.drawProp) return !!custom.drawProp(ctx, prop, state);
    // The other looks keep the shipped industrial equipment; their world and crew are rendered differently.
    if (theme !== 'osrs') return false;
    const cap = state.capability || prop.t;
    const known = ['computer','workbench','dish','cabinet','notebook','studio','portal','bay','missionboard','trophycase','server','crate','chest','seatchair'];
    if (!known.includes(cap) && !known.includes(prop.t)) return false;
    const T = state.tileSize || 12, x = prop.x*T+1, y = prop.y*T+1, w = Math.max(8,(prop.w||1)*T-3), h = Math.max(7,(prop.h||1)*T-3);
    const lit = !!state.working, flick = state.reducedMotion ? 1 : .8+.2*Math.sin(state.now/220);
    ctx.save();
    // Each drawing occupies the existing footprint and the same painter-order slot.
    if (cap === 'dish') {
      box(ctx,x+w*.4,y+h*.5,w*.3,h*.5,5,'#98927e','#696554','#434137');
      ctx.strokeStyle='#aaa28c';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+w*.57,y+h-5);ctx.lineTo(x+w*.6,y-10);ctx.stroke();
      polygon(ctx,[[x+1,y-11],[x+w*.55,y-19],[x+w+2,y-11],[x+w*.85,y-3],[x+w*.3,y+2]],'#b7b5a1','#514d3f');
      polygon(ctx,[[x+2,y-11],[x+w*.55,y-17],[x+w-1,y-10],[x+w*.45,y-2]],'#918f7c');
      ctx.strokeStyle=lit?'#9cdcaa':'#cec5a8';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+w*.45,y-7);ctx.lineTo(x+w+5,y-16);ctx.stroke();
    } else if (cap === 'cabinet' || ['chest','crate'].includes(prop.t)) {
      box(ctx,x,y,w,h,18,'#686855','#69604b','#474534');
      for (let i=0;i<3;i++) {ctx.fillStyle='#4c4a3d';ctx.fillRect(x+2,y+h-17+i*5,w-4,4);ctx.fillStyle='#c5a961';ctx.fillRect(x+w/2-2,y+h-16+i*5,4,1);}
    } else if (prop.t === 'seatchair') {
      box(ctx,x,y,w,h,6,'#917c4e','#514631','#332f26');ctx.fillStyle='#735b37';ctx.fillRect(x+2,y-10,w-4,9);
    } else {
      box(ctx,x,y,w,h,9,'#827353','#625336','#39382f');
      ctx.fillStyle='#3e3527';ctx.fillRect(x+2,y+h-2,3,5);ctx.fillRect(x+w-5,y+h-2,3,5);
      if (cap === 'notebook' || prop.t === 'missionboard') {
        polygon(ctx,[[x+2,y-7],[x+w*.47,y-9],[x+w*.48,y+h-13],[x+2,y+h-11]],'#cbbb86','#6f6040');
        polygon(ctx,[[x+w*.49,y-9],[x+w-2,y-7],[x+w-2,y+h-11],[x+w*.49,y+h-13]],'#e0d1a2','#6f6040');
        ctx.strokeStyle='#736747';ctx.lineWidth=.5;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(x+4,y-5+i*2);ctx.lineTo(x+w*.4,y-6+i*2);ctx.stroke();}
      } else {
        const mw = Math.max(7,Math.min(w-3,21)), mx=x+(w-mw)/2;
        box(ctx,mx,y,mw,Math.max(4,h*.4),13,'#9b967e','#555a48','#343b32');
        ctx.fillStyle=lit?'#7ea991':'#344e40';ctx.fillRect(mx+2,y-10,mw-4,Math.max(4,h*.4-2));
        ctx.fillStyle=lit?'#badbc1':'#65836b';for(let i=0;i<3;i++)ctx.fillRect(mx+3,y-9+i*2,Math.max(2,mw-8-(i%2)*2),.6);
        ctx.fillStyle='#b1a278';ctx.fillRect(x+w*.3,y+h-11,w*.4,3);ctx.fillStyle='#36382f';ctx.fillRect(x+w*.35,y+h-10,w*.3,1);
        if(cap === 'workbench'){ctx.fillStyle='#c7c2a6';ctx.fillRect(x+1,y+h-10,5,1);ctx.fillStyle='#735135';ctx.fillRect(x+3,y+h-11,1,4);}
      }
      if (lit) {ctx.globalAlpha=.5*flick;ctx.fillStyle='#dcca72';ctx.fillRect(x+w-3,y+h-10,2,2);}
    }
    ctx.restore();return true;
  }
  function drawBody(ctx, body, now, options) {
    const theme = selected(); if (theme === 'original') return null;
    const custom = renderers.get(theme); if (custom && custom.drawBody) return custom.drawBody(ctx, body, now, options);
    const record=lookupAgent(body.agentId||body.id)||body, role=roleFor(record), kind=role.kind;
    const fantasy=theme==='osrs', holo=theme==='holographic';
    const height=fantasy&&kind==='dwarf'?21:27, px=body.px, py=body.py;
    const moving=body.state==='walk'||!!body.target, working=!!body.working||!!body.sitting;
    // The walk cycle follows the simulation odometer; a stopped body never marches in place.
    const stride=options&&options.reducedMotion?0:moving?Math.sin((body.odo||0)*.58)*2:0;
    const hand=options&&options.reducedMotion?0:working?Math.sin(now/180)*1.1:0;
    const back=body.dir==='north', side=body.dir==='west'?-1:body.dir==='east'?1:0;
    const coat=fantasy?role.color:holo?'#419ab5':'#2c344e', trim=fantasy?role.trim:holo?'#b6f4ff':'#ff5bad';
    const robe=fantasy&&['mage','scholar','banker','cook'].includes(kind);
    ctx.save();ctx.translate(px,py);ctx.lineJoin='miter';
    ctx.fillStyle='rgba(0,0,0,.27)';ctx.beginPath();ctx.ellipse(0,0,5.5,2,0,0,Math.PI*2);ctx.fill();
    if(body.lying){
      // Respect the shared simulation's bed pose instead of drawing a standing NPC through the bed.
      ctx.rotate(Math.PI/2);ctx.translate(0, -height/2);
    }
    if(holo){ctx.globalAlpha*=.72;ctx.strokeStyle=trim;ctx.lineWidth=.6;ctx.beginPath();ctx.ellipse(0,0,7,3,0,0,Math.PI*2);ctx.stroke();}
    const seated=body.sitting||body.seated, legTop=-(seated?7:9), top=-height+(seated?4:0);
    polygon(ctx,[[-4,legTop],[-.6,legTop],[-.6+stride,-1],[-4+stride,-1]],'#494437','#211f1e');
    polygon(ctx,[[.7,legTop],[4,legTop],[4-stride,-1],[.7-stride,-1]],'#665941','#211f1e');
    ctx.fillStyle='#342d25';ctx.fillRect(-4+stride,-1,4,1.5);ctx.fillRect(1-stride,-1,4,1.5);
    const shoulders=top+7, bottom=robe? -3 : legTop;
    polygon(ctx,[[-4.5,shoulders],[3.5,shoulders],[robe?6:4,bottom],[-(robe?5:4),bottom]],coat,'#272925');
    polygon(ctx,[[1,shoulders],[3.5,shoulders],[robe?6:4,bottom],[.6,bottom]], fantasy?'rgba(0,0,0,.23)':'rgba(100,240,255,.2)');
    ctx.fillStyle=trim;ctx.fillRect(-4,-9,8,1);
    polygon(ctx,[[-5,shoulders+1],[-3,shoulders+2],[-4+hand,-9],[-6+hand,-10]],coat,'#2b2b23');
    polygon(ctx,[[3,shoulders+1],[5,shoulders+2],[6-hand,-10],[4-hand,-9]],coat,'#2b2b23');
    ctx.fillStyle='#b39b7a';ctx.fillRect(-6+hand,-10,2,2);ctx.fillRect(4-hand,-10,2,2);
    const headX=side*1.2, headY=top+1;
    polygon(ctx,[[headX-2.5,headY],[headX+1.7,headY-1],[headX+3,headY+1],[headX+2,headY+5],[headX-2.5,headY+5],[headX-3,headY+2]],back?'#776448':'#c3a482','#594e3b');
    if(!back){ctx.fillStyle='#28251f';ctx.fillRect(headX+(side<0?-2:1),headY+1.5,.6,.6);}
    if(!fantasy){
      ctx.fillStyle='#37465b';ctx.fillRect(headX-3,headY-1,6,3);ctx.fillStyle=holo?'#b6f4ff':'#7de8f4';ctx.fillRect(headX-2,headY+1,4,1.2);
      ctx.strokeStyle=trim;ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(-2,shoulders+2);ctx.lineTo(0,-12);ctx.lineTo(2,shoulders+2);ctx.stroke();
    } else if(kind==='mage') {
      polygon(ctx,[[headX-5,headY],[headX,headY-8],[headX+2,headY-3],[headX+4,headY]],'#7e2724','#3e2c20');
      ctx.strokeStyle='#8b7348';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(-8,0);ctx.lineTo(-8,-24);ctx.stroke();ctx.fillStyle='#cec26c';ctx.beginPath();ctx.arc(-8,-24,1.5,0,Math.PI*2);ctx.fill();
    } else if(kind==='scholar'||kind==='dwarf') {
      ctx.fillStyle='#b7b6a6';ctx.fillRect(headX-3,headY-1,6,2);
      if(!back)polygon(ctx,[[headX-2.5,headY+4],[headX+2.5,headY+4],[headX,headY+(kind==='dwarf'?11:12)]],'#d7d5c4');
      if(kind==='dwarf'){ctx.strokeStyle='#9b8156';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(7,-3);ctx.lineTo(7,-19);ctx.stroke();ctx.fillStyle='#b5ada0';ctx.fillRect(5,-19,5,3);}
    } else if(kind==='ranger'||kind==='elf') {
      polygon(ctx,[[headX-4,headY],[headX,headY-4],[headX+3,headY],[headX+5,headY+1]],'#4c722d','#354827');
      if(kind==='ranger'){ctx.strokeStyle='#977846';ctx.lineWidth=.9;ctx.beginPath();ctx.ellipse(8,-11,3,10,0,-Math.PI/2,Math.PI/2);ctx.stroke();ctx.strokeStyle='#cdc29a';ctx.beginPath();ctx.moveTo(8,-21);ctx.lineTo(8,-1);ctx.stroke();}
      if(kind==='elf'){polygon(ctx,[[headX-3,headY+1],[headX-5,headY],[headX-3,headY+3]],'#c9b491');}
    } else if(kind==='guard') {
      polygon(ctx,[[headX-3,headY+2],[headX-3,headY-2],[headX+2,headY-3],[headX+4,headY+1]],'#a3a6a0','#454a47');
      ctx.strokeStyle='#9f8c5b';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-8,0);ctx.lineTo(-8,-30);ctx.stroke();polygon(ctx,[[-9.5,-28],[-8,-33],[-6.5,-28]],'#b2b7b4');
    } else if(kind==='cook') {
      polygon(ctx,[[headX-3,headY+1],[headX-4,headY-4],[headX-1,headY-6],[headX+3,headY-5],[headX+3,headY+1]],'#e4e2d1','#a5a390');
      ctx.fillStyle='#eee4c9';ctx.fillRect(-2,shoulders+2,4,8);
    } else if(kind==='banker') {ctx.fillStyle='#514632';ctx.fillRect(headX-3,headY-2,6,3);ctx.fillStyle='#d5c892';ctx.fillRect(-.7,shoulders+1,1.4,5);}
    else {ctx.fillStyle='#6f603e';ctx.fillRect(headX-3,headY-2,6,2);}
    if(holo){ctx.strokeStyle='rgba(189,249,255,.7)';ctx.lineWidth=.4;for(let y=top;y<-2;y+=3){ctx.beginPath();ctx.moveTo(-4,y);ctx.lineTo(4,y);ctx.stroke();}}
    ctx.restore();return { top: body.lying?py-7:py+top-(fantasy&&kind==='mage'?7:0), height:body.lying?14:height, width:body.lying?height:14 };
  }
  function reset() { plate=null;plateSource=null;plateTheme=null;plateGeo=null; }
  function bind(options) { lookupAgent=options&&typeof options.agentRecord==='function'?options.agentRecord:()=>null; }
  function register(id, renderer) { if (id === 'original' || !renderer) return false;renderers.set(id,renderer);return true; }
  return { bind, register, reset, roleFor, ROLES, CAPABILITIES, active: () => selected() !== 'original', drawBase, drawProp, drawBody };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = StationPresentation;
