/* The approved concepts supply materials and sprites, never station state. This final draw
   pass shares the existing perspective/picking geometry and runs after the native simulation. */
'use strict';
const OpenArtWorld = (() => {
  const hitRects=[], labels=[], outlines=new WeakMap();
  let view=null, terrain=null, lookup=()=>null, lastTheme=null;
  const current=()=>typeof PresentationThemes!=='undefined'?PresentationThemes.get():'original';
  const active=()=>typeof StationArt!=='undefined'&&StationArt.has(current());
  const project=(v,x,y,z)=>OSRSWorld.project(v,x,y,z);
  function polygon(g,points,fill,stroke,width){
    g.beginPath();points.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();
    if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=width||.7;g.stroke();}
  }
  function quad(g,v,x,y,w,h,z,fill,stroke){polygon(g,[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(([a,b])=>project(v,a,b,z)),fill,stroke);}
  function imageQuad(g,image,points,box){
    const [sx,sy,sw,sh]=box||[0,0,image.width,image.height],[a,b,c,d]=points;
    for(const [p,q,r,second]of [[a,b,c,false],[c,d,a,true]]){
      g.save();g.beginPath();g.moveTo(p.x,p.y);g.lineTo(q.x,q.y);g.lineTo(r.x,r.y);g.closePath();g.clip();
      if(!second)g.transform((b.x-a.x)/sw,(b.y-a.y)/sw,(c.x-b.x)/sh,(c.y-b.y)/sh,a.x,a.y);
      else g.transform((c.x-d.x)/sw,(c.y-d.y)/sw,(d.x-a.x)/sh,(d.y-a.y)/sh,a.x,a.y);
      g.drawImage(image,sx,sy,sw,sh,0,0,sw,sh);g.restore();
    }
  }
  function face(v,a,b,low,high){return[project(v,a.x,a.y,high),project(v,b.x,b.y,high),project(v,b.x,b.y,low),project(v,a.x,a.y,low)];}
  function wall(g,v,a,b,near,art){
    const H=near?5:31,low=near?-4:0,m=art.model,len=Math.hypot(b.x-a.x,b.y-a.y),n=Math.max(1,Math.ceil(len/(near?36:48)));
    const dx=(b.y-a.y)/(len||1)*6.5,dy=-(b.x-a.x)/(len||1)*6.5;
    for(let i=0;i<n;i++){
      const p={x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n},q={x:a.x+(b.x-a.x)*(i+1)/n,y:a.y+(b.y-a.y)*(i+1)/n};
      const panel=face(v,p,q,low,H),cap=[project(v,p.x,p.y,H),project(v,q.x,q.y,H),project(v,q.x+dx,q.y+dy,H),project(v,p.x+dx,p.y+dy,H)];
      polygon(g,panel,m.palette[1],'#06080b',.75);imageQuad(g,art.materials.wall,panel);
      // Broad hull plates and a dark lower sill read as one built room, rather than a
      // row of repeated sprite tiles. Their geometry follows every real outer/void edge.
      polygon(g,face(v,p,q,low,near?low+1.3:2.5),'#05080c55');
      polygon(g,cap,m.palette[2],'#151820',.85);imageQuad(g,art.materials.cap,cap);
      const pa=project(v,p.x+dx,p.y+dy,H),pb=project(v,q.x+dx,q.y+dy,H);
      g.strokeStyle=m.palette[2]+'99';g.lineWidth=.8;g.beginPath();g.moveTo(pa.x,pa.y);g.lineTo(pb.x,pb.y);g.stroke();
      if(!near){
        const fraction=1.2/(len/n),r={x:p.x+(q.x-p.x)*fraction,y:p.y+(q.y-p.y)*fraction};
        polygon(g,face(v,p,r,0,H),m.palette[1]+'bb','#080b0e55',.6);
        const from={x:p.x+(q.x-p.x)*.31,y:p.y+(q.y-p.y)*.31},to={x:p.x+(q.x-p.x)*.69,y:p.y+(q.y-p.y)*.69};
        // Fixed wall fittings are part of the hull, not capability or task markers.
        polygon(g,face(v,from,to,19.5,21),m.palette[1],'#070b1055',.7);
        polygon(g,face(v,from,to,19.9,20.6),m.palette[2]+'aa');
      }
    }
  }
  function drawTerrain(g,v,s,edges,art){
    const key=[current(),v.width,v.height,v.scale,v.center.x,v.center.y].join(':');
    if(!terrain||terrain.key!==key||terrain.layout!==s.layout){
      const c=document.createElement('canvas');c.width=v.width;c.height=v.height;const t=c.getContext('2d'),T=s.layout.tileSize*4,bounds=OSRSWorld.bounds(s.layout);
      t.save();t.beginPath();for(const loop of edges.loops){loop.forEach((p,i)=>{const q=project(v,p.x,p.y);i?t.lineTo(q.x,q.y):t.moveTo(q.x,q.y);});t.closePath();}t.clip('evenodd');
      t.fillStyle=art.model.palette[4];t.fillRect(0,0,c.width,c.height);
      for(let y=bounds.y;y<bounds.y+bounds.h;y+=T)for(let x=bounds.x;x<bounds.x+bounds.w;x+=T){
        const points=[[x,y],[x+T,y],[x+T,y+T],[x,y+T]].map(([a,b])=>project(v,a,b));
        imageQuad(t,art.materials.floor,points);
        polygon(t,points,null,'#10151b26',.65);
      }
      // A subtle room-wide light falloff keeps sampled floor plates coherent. The
      // floor clip retains courtyard holes and disconnected, newly built rooms.
      for(let row=0;row<8;row++){
        const y=bounds.y+bounds.h*row/8,alpha=Math.round(3+row*.75).toString(16).padStart(2,'0');
        quad(t,v,bounds.x,y,bounds.w,bounds.h/8,0,'#020609'+alpha);
      }
      for(const [a,b]of edges.far){const p=project(v,a.x,a.y),q=project(v,b.x,b.y);
        for(const [width,color]of [[9,'#03070d12'],[5,'#03070d24'],[2,'#03070d3c']]){
          t.strokeStyle=color;t.lineWidth=width*v.scale;t.beginPath();t.moveTo(p.x,p.y);t.lineTo(q.x,q.y);t.stroke();
        }
      }
      t.restore();edges.far.forEach(([a,b])=>wall(t,v,a,b,false,art));
      // The viewport is fitted to a real rear wall; additional rooms keep their own outline.
      const rear=edges.far.filter(([a,b])=>Math.abs(a.y-b.y)<.01).sort((a,b)=>(b[1].x-b[0].x)-(a[1].x-a[0].x))[0];
      if(rear&&rear[1].x-rear[0].x>40){
        const [a,b]=rear;
        if(art.model.id==='steampunk-airship'){
          for(const fraction of [.23,.5,.77]){const p=project(v,a.x+(b.x-a.x)*fraction,a.y,26),size=19*v.scale;
            t.save();t.beginPath();t.ellipse(p.x,p.y+size*.5,size*.50,size*.5,0,0,Math.PI*2);t.clip();t.drawImage(art.materials.window,p.x-size/2,p.y,size,size);t.restore();
            t.strokeStyle=art.model.palette[2];t.lineWidth=2*v.scale;t.beginPath();t.ellipse(p.x,p.y+size*.5,size*.50,size*.5,0,0,Math.PI*2);t.stroke();
          }
        }else{
          const inset=(b.x-a.x)*.10,p={x:a.x+inset,y:a.y},q={x:b.x-inset,y:b.y},window=face(v,p,q,7,29);
          polygon(t,window,'#050a11',art.model.palette[2],2.4*v.scale);imageQuad(t,art.materials.window,window);
          polygon(t,window,null,'#16191d',1.1*v.scale);
          polygon(t,face(v,p,q,6,7.5),art.model.palette[1],art.model.palette[2]+'77',.65);
          const inner=[project(v,p.x,p.y,28.4),project(v,q.x,q.y,28.4)];
          t.strokeStyle='#ffffff3a';t.lineWidth=.65*v.scale;t.beginPath();t.moveTo(inner[0].x,inner[0].y);t.lineTo(inner[1].x,inner[1].y);t.stroke();
        }
      }
      const front=document.createElement('canvas');front.width=v.width;front.height=v.height;const fg=front.getContext('2d');
      edges.near.forEach(([a,b])=>wall(fg,v,a,b,true,art));terrain={key,layout:s.layout,canvas:c,front};
    }g.drawImage(terrain.canvas,0,0);
  }
  function propKind(p){
    if(p.type==='plant'||p.type==='plant2')return'plant';
    if(['table','missionboard','trophycase'].includes(p.type))return'table';
    if(['computer','workbench','cabinet','dish','notebook','studio','portal'].includes(p.capability))return p.capability;
    return null;
  }
  function propSpriteKind(p){
    const kind=propKind(p);if(kind!=='computer'||!p.agentId)return kind;
    const role=StationPresentation.roleFor(lookup(p.agentId)).kind;
    // A specialist's assigned compute station uses the appropriate desk silhouette. Its
    // canonical capability, ownership, footprint and permissions are never rewritten.
    return role==='ranger'?'studio':['dwarf','cook'].includes(role)?'workbench':kind;
  }
  function drawGrounding(g,v,s,edges){
    g.save();g.beginPath();for(const loop of edges.loops){loop.forEach((p,i)=>{const q=project(v,p.x,p.y);i?g.lineTo(q.x,q.y):g.moveTo(q.x,q.y);});g.closePath();}g.clip('evenodd');
    // Shadows use canonical footprints and feet. Draw them before all entities so
    // one piece of furniture cannot paint its shadow across an already drawn NPC.
    for(const p of s.equipment){
      const kind=propKind(p),spread=kind==='plant'?.7:1.5,cast=['cabinet','notebook','portal','dish'].includes(kind)?3.5:2;
      for(const [pad,color]of [[spread*1.7,'#0000000a'],[spread,'#00000013'],[0,'#00000023']]){
        quad(g,v,p.x-pad+cast*.4,p.y-pad+cast*.7,p.w+pad*2,p.h+pad*2,.05,color);
      }
    }
    for(const b of s.bodies)if(!b.unplaced){
      const p=project(v,b.x,b.y),wide=b.lying?8:b.sitting?5.2:4.6;
      for(const [k,color]of [[1.6,'#00000009'],[1.2,'#00000014'],[.8,'#0000002a']]){
        g.fillStyle=color;g.beginPath();g.ellipse(p.x+v.scale*.45,p.y+.15*v.scale,wide*v.scale*k,1.5*v.scale*k,0,0,Math.PI*2);g.fill();
      }
    }
    g.restore();
  }
  function drawProp(g,v,p,art){
    const kind=propSpriteKind(p),image=art.props[kind],foot=project(v,p.x+p.w/2,p.y+p.h*.83);
    let h=(art.model.propHeights[kind]||(kind==='dish'?37:['cabinet','notebook','portal'].includes(kind)?30:kind==='plant'?24:23))*v.scale;
    let w=image?h*image.width/image.height:Math.max(10,p.w)*v.scale;
    if(kind==='table'||kind==='computer'||kind==='studio'||kind==='workbench'){
      w=Math.max(14,p.w)*v.scale*1.28;h=image?w*image.height/image.width:20*v.scale;
    }
    g.fillStyle='#00000025';g.beginPath();g.ellipse(foot.x,foot.y,w*.37,1.6*v.scale,.03,0,Math.PI*2);g.fill();
    const plinth=image&&['computer','studio','table'].includes(kind)&&image.height/image.width<.59?6:0;
    if(plinth){
      const front=face(v,{x:p.x,y:p.y+p.h},{x:p.x+p.w,y:p.y+p.h},0,plinth);
      const side=face(v,{x:p.x+p.w,y:p.y},{x:p.x+p.w,y:p.y+p.h},0,plinth);
      polygon(g,side,art.model.palette[1],'#080e15',.8);
      if(art.materials.housing)imageQuad(g,art.materials.housing,side);
      polygon(g,side,'#00000066');
      polygon(g,front,art.model.palette[1],'#080e15',.8);
      if(art.materials.housing)imageQuad(g,art.materials.housing,front);
      polygon(g,front,'#00000040');
      quad(g,v,p.x,p.y,p.w,p.h,plinth,art.model.palette[1],art.model.palette[2]);
      imageQuad(g,art.materials.cap,[[p.x,p.y],[p.x+p.w,p.y],[p.x+p.w,p.y+p.h],[p.x,p.y+p.h]].map(([x,y])=>project(v,x,y,plinth)));
      polygon(g,face(v,{x:p.x,y:p.y+p.h},{x:p.x+p.w,y:p.y+p.h},0,1),'#03050877');
      const start=project(v,p.x+p.w*.13,p.y+p.h,plinth*.4),end=project(v,p.x+p.w*.87,p.y+p.h,plinth*.4);
      g.strokeStyle=art.model.palette[2];g.lineWidth=.7;g.beginPath();g.moveTo(start.x,start.y);g.lineTo(end.x,end.y);g.stroke();
    }
    if(image)g.drawImage(image,foot.x-w/2,foot.y-h-plinth*v.scale,w,h);
    else{
      // Future props remain visible and pickable even before they have theme artwork.
      const a={x:p.x,y:p.y+p.h},b={x:p.x+p.w,y:p.y+p.h};polygon(g,face(v,a,b,0,8),art.model.palette[1],'#111418');
      quad(g,v,p.x,p.y,p.w,p.h,8,art.model.palette[2],'#111418');
    }
    if(p.users?.length){g.fillStyle='#a1d69b';g.shadowColor='#83cebe';g.shadowBlur=4;g.fillRect(foot.x+w*.3,foot.y-h*.4,2*v.scale,1.1*v.scale);g.shadowBlur=0;}
    hitRects.push({kind:'equipment',id:p.id,wx:p.x+p.w/2,wy:p.y+p.h/2,x:foot.x-w/2,y:foot.y-h-plinth*v.scale,w,h:h+plinth*v.scale});
  }
  function animate(g,image,x,y,w,h,b,still){
    g.save();g.translate(x,y);if(b.dir==='west')g.scale(-1,1);
    if(b.lying){g.translate(0,-w/2);g.rotate(Math.PI/2);g.drawImage(image,-w/2,-h/2,w,h);}
    else if(b.sitting){const upper=.73;g.drawImage(image,0,0,image.width,image.height*upper,-w/2,-h,w,h*.90);g.drawImage(image,0,image.height*upper,image.width,image.height*(1-upper),-w/2,-h*.10,w,h*.10);}
    else if(b.moving&&!still){
      const upper=.72,step=Math.sin((b.odo||0)*.48)*1.9,bob=Math.sin((b.odo||0)*.4)*.65;
      g.drawImage(image,0,0,image.width,image.height*upper,-w/2,-h+bob,w,h*upper);
      for(let i=0;i<2;i++)g.drawImage(image,image.width*i/2,image.height*upper,image.width/2,image.height*(1-upper),-w/2+w*i/2+step*(i?1:-1)*.35,-h*(1-upper)+bob+Math.abs(step)*(i?.25:-.25),w/2,h*(1-upper));
    }else g.drawImage(image,-w/2,-h,w,h);
    g.restore();
  }
  function drawBody(g,v,b,art,now,still){
    const record=lookup(b.id)||b,role=StationPresentation.roleFor(record),image=art.npc[role.kind]||art.npc.player,p=project(v,b.x,b.y);
    const size=.94+.10*(b.y-v.b.y)/Math.max(1,v.b.h),fullH=39*v.scale*size,fullW=fullH*image.width/image.height;
    const h=b.lying?fullW:b.sitting?fullH*.80:fullH,w=b.lying?fullH:fullW;
    animate(g,image,p.x,p.y,fullW,b.sitting?fullH*.80:fullH,b,still);
    if(b.working&&!b.lying){g.fillStyle='#b8e6a6';g.globalAlpha=still?1:.8+.2*Math.sin(now/180);g.fillRect(p.x+w*.4,p.y-h*.42,2*v.scale,1.5*v.scale);g.globalAlpha=1;}
    if(b.waiting){g.fillStyle='#ef895e';g.beginPath();g.arc(p.x,p.y-h-8,3,0,Math.PI*2);g.fill();}
    labels.push({b,role,p,w,h,name:record.name||b.name||b.id});
    hitRects.push({kind:'agent',id:b.id,role:role.kind,theme:current(),wx:b.x,wy:b.y,x:p.x-w/2,y:p.y-h,w,h});
  }
  function drawLabels(g,v,art){
    const occupied=[],font=Math.max(12,Math.min(16,v.scale*4.4));
    const family=art.model.id==='steampunk-airship'?'Georgia,"Times New Roman","Nimbus Roman",OSRSPlain,serif':'"Arial Narrow","Liberation Sans Narrow","Nimbus Sans Narrow","Helvetica Neue",Arial,OSRSPlain,sans-serif';
    const crowded=labels.length>12;
    const order=labels.slice().sort((a,b)=>Number(!!b.b.hovered)-Number(!!a.b.hovered)||Number(!!(b.b.waiting||b.b.tool||b.b.working))-Number(!!(a.b.waiting||a.b.tool||a.b.working)));
    for(const {b,role,p,w,h,name}of order){
      // At station overview, idle names belong in the crew panel. Hovering still names
      // any real NPC, and every body remains independently drawn and pickable.
      if(crowded&&!b.hovered&&!b.waiting&&!b.tool&&!b.working)continue;
      if(p.x+w/2<0||p.x-w/2>v.width||p.y<0||p.y-h>v.height)continue;
      g.font='600 '+font+'px '+family;const sub=role.job,width=Math.max(g.measureText(name).width,g.measureText(sub).width)+4,height=b.tool||b.waiting?44:29;
      const anchor={x:p.x+Math.min(w*.20,12),y:p.y-h-4};let chosen;
      for(const dy of [0,-32,32,-64,64])for(const x0 of [anchor.x,p.x-width-w*.15]){
        const x=Math.max(4,Math.min(v.width-width-4,x0)),y=Math.max(font+5,Math.min(v.height-height-4,anchor.y+dy)),r={x:x-2,y:y-font,w:width,h:height};
        const overlap=occupied.reduce((sum,q)=>sum+Math.max(0,Math.min(r.x+r.w,q.x+q.w)-Math.max(r.x,q.x))*Math.max(0,Math.min(r.y+r.h,q.y+q.h)-Math.max(r.y,q.y)),0);
        const cost=overlap+Math.abs(dy)*.05+(x0===anchor.x?0:1);
        if(!chosen||cost<chosen.cost)chosen={x,y,r,cost,overlap};
      }
      if(chosen.overlap>0&&!b.hovered)continue;
      const {x,y,r}=chosen;occupied.push(r);g.textAlign='left';g.textBaseline='bottom';g.lineWidth=3;g.strokeStyle='#060b11';
      g.font='600 '+font+'px '+family;g.strokeText(name,x,y);g.fillStyle=art.model.palette[3];g.fillText(name,x,y);
      g.font=Math.max(12,font-1)+'px '+family;g.strokeText(sub,x,y+15);g.fillStyle='#f1ede3';g.fillText(sub,x,y+15);
      if(b.tool||b.waiting){const text=b.waiting?'Awaiting approval':String(b.tool);g.strokeText(text,x,y+30);g.fillStyle=b.waiting?'#f7b66e':'#b8d9a8';g.fillText(text,x,y+30);}
      hitRects.push({kind:'agent',id:b.id,wx:b.x,wy:b.y,...r});
    }
  }
  function draw(g,canvas,frame){
    if(!active()||!frame.snapshot?.layout?.floor.length)return false;
    const theme=current(),art=StationArt.load(theme);if(!art?.ready)return false;
    if(lastTheme!==theme){reset();lastTheme=theme;}
    const s=frame.snapshot,W=canvas.width,H=canvas.height;
    // The native viewport owns zoom, focus and pan. Theme changes only replace artwork.
    view=OSRSWorld.makeStationView(s,W,H);hitRects.length=0;labels.length=0;
    let edges=outlines.get(s.layout);if(!edges){edges=OSRSWorld.outline(s.layout);outlines.set(s.layout,edges);}
    g.save();g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';g.imageSmoothingEnabled=true;
    OSRSWorld.drawBackdrop(g,W,H,frame.now,s.viewport);
    drawTerrain(g,view,s,edges,art);
    drawGrounding(g,view,s,edges);
    for(const belt of s.layout.belts||[])quad(g,view,belt.x,belt.y,s.layout.tileSize,s.layout.tileSize,.1,art.model.palette[1],art.model.palette[2]);
    const items=s.equipment.map(p=>({y:p.y+p.h,draw:()=>drawProp(g,view,p,art)}));
    for(const body of s.bodies)if(!body.unplaced)items.push({y:body.y,draw:()=>drawBody(g,view,body,art,frame.now,frame.reducedMotion)});
    items.sort((a,b)=>a.y-b.y).forEach(i=>i.draw());
    for(const box of s.transports||[])quad(g,view,box.x-2,box.y-2,4,4,4,art.model.palette[3],'#10121a');
    g.drawImage(terrain.front,0,0);drawLabels(g,view,art);
    if(!s.connected){g.fillStyle='#f2c882';g.font='17px OSRSBold';g.fillText('Station connection interrupted',12,24);}
    g.restore();return true;
  }
  function hitPoint(x,y){for(let i=hitRects.length-1;i>=0;i--){const r=hitRects[i];if(x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h)return{...r};}return null;}
  function pointFromClient(e,canvas){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};}
  function clientToWorld(e,canvas){if(!active()||!view)return null;const p=pointFromClient(e,canvas),hit=hitPoint(p.x,p.y);return hit?{x:hit.wx,y:hit.wy}:OSRSWorld.unproject(view,p.x,p.y);}
  function clientHit(e,canvas){if(!active()||!view)return null;const p=pointFromClient(e,canvas);return hitPoint(p.x,p.y);}
  function drawPortrait(canvas,record){
    const art=active()?StationArt.load(current()):null,role=StationPresentation.roleFor(record).kind,portrait=art?.portraits?.[role],image=portrait||art?.npc[role];if(!image)return false;
    const g=canvas.getContext('2d'),k=portrait?Math.max(canvas.width/image.width,canvas.height/image.height):Math.min((canvas.width-2)/image.width,(canvas.height-2)/image.height);g.clearRect(0,0,canvas.width,canvas.height);
    // The sidebar's square portrait crops fill the reused canvas instead of inheriting
    // the old full-body portrait's blank top margin. Whole-body fallbacks keep their feet.
    g.drawImage(image,(canvas.width-image.width*k)/2,portrait?(canvas.height-image.height*k)/2:canvas.height-image.height*k-1,image.width*k,image.height*k);return true;
  }
  function drawMapEquipment(g,p){
    const art=active()?StationArt.load(current()):null,image=art?.props[propSpriteKind(p)];if(!image)return false;
    const w=Math.max(8,p.w),h=w*image.height/image.width;g.drawImage(image,p.x+p.w/2-w/2,p.y+p.h*.9-h,w,h);
    if(p.users?.length){g.strokeStyle='#edcb65';g.lineWidth=1.4;g.strokeRect(p.x-.5,p.y-.5,p.w+1,p.h+1);}return true;
  }
  function reset(){view=null;terrain=null;hitRects.length=0;labels.length=0;}
  return{active,draw,reset,bind:fn=>{lookup=fn||(()=>null);},clientToWorld,clientHit,worldToCanvas:(x,y)=>active()&&view?project(view,x,y):null,
    ready:()=>active()&&StationArt.ready(current()),drawPortrait,drawMapEquipment,propKind,hitRects:()=>hitRects.map(r=>({...r}))};
})();
if(typeof StationPresentation!=='undefined'&&typeof StationArt!=='undefined')for(const id of Object.keys(StationArt.models))StationPresentation.registerView(id,OpenArtWorld);
if(typeof module!=='undefined'&&module.exports)module.exports=OpenArtWorld;
