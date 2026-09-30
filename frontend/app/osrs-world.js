/* OSRS station presentation. The model, paths, run states and equipment remain authoritative in
   World. This pass paints a perspective view AFTER the native simulation/transport work has run. */
'use strict';
const OSRSWorld = (() => {
  const COLS = {mage:0,scholar:1,ranger:2,guard:3,cook:4,banker:5,elf:6,dwarf:7,scout:2,player:3};
  const assets = {}, rects = {}, hitRects = [], labels=[];
  let view = null, baseline = null, lookup = () => null;
  const active = () => typeof PresentationThemes !== 'undefined' && PresentationThemes.get() === 'osrs';
  function load(name, path, columns, rows) {
    if (typeof Image === 'undefined') return;
    const image = new Image(); assets[name] = image;
    image.onload = () => {
      const c=document.createElement('canvas');c.width=image.width;c.height=image.height;
      const g=c.getContext('2d');g.drawImage(image,0,0);const data=g.getImageData(0,0,c.width,c.height).data;
      const w=image.width/columns,h=image.height/rows;rects[name]=[];
      // Asset-bound scanning is done once at load, never a frame-loop pixel readback.
      for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
        let x0=w,y0=h,x1=0,y1=0;
        for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[((row*h+y)*c.width+col*w+x)*4+3]>40){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
        rects[name].push({x:col*w+x0,y:row*h+y0,w:Math.max(1,x1-x0+1),h:Math.max(1,y1-y0+1)});
      }
    };image.src=path;
  }
  load('npc','assets/osrs-client/npc-atlas.png',8,4);
  load('travellers','assets/osrs-client/traveller-atlas.png',4,2);
  load('props','assets/osrs-client/prop-atlas.png',4,2);
  function bounds(layout) {
    const f=layout.floor;
    if(!f.length)return {x:0,y:0,w:layout.width,h:layout.height};
    const x=Math.min(...f.map(r=>r.x)),y=Math.min(...f.map(r=>r.y));
    return {x,y,w:Math.max(...f.map(r=>r.x+r.w))-x,h:Math.max(...f.map(r=>r.y+r.h))-y};
  }
  function makeView(layout, width, height, zoom, center) {
    const b=bounds(layout),scale=Math.min((width-22)/(b.w*1.18+20),(height-16)/(b.h*.9+38))*Math.max(.1,zoom||1);
    return {b,width,height,scale,cx:b.x+b.w/2,cy:b.y+b.h/2,
      ox:width/2,oy:height/2+10*scale,center:center||{x:b.x+b.w/2,y:b.y+b.h/2}};
  }
  function local(v,x,y,z) {return {x:(x-v.cx)*(.83+.34*(y-v.b.y)/Math.max(1,v.b.h)),y:(y-v.cy)*.9-(z||0)};}
  function project(v,x,y,z) {const p=local(v,x,y,z),c=local(v,v.center.x,v.center.y,0);return {x:v.ox+(p.x-c.x)*v.scale,y:v.oy+(p.y-c.y)*v.scale};}
  function unproject(v,x,y) {const c=local(v,v.center.x,v.center.y,0),wy=v.cy+((y-v.oy)/v.scale+c.y)/.9;
    return {x:v.cx+((x-v.ox)/v.scale+c.x)/(.83+.34*(wy-v.b.y)/Math.max(1,v.b.h)),y:wy};}
  function polygon(g,points,fill,stroke,width) {
    g.beginPath();points.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();g.fillStyle=fill;g.fill();
    if(stroke){g.strokeStyle=stroke;g.lineWidth=width||.6;g.stroke();}
  }
  function quad(g,v,x,y,w,h,z,fill,stroke){polygon(g,[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(([a,b])=>project(v,a,b,z)),fill,stroke);}
  function face(g,v,a,b,z0,z1,color){polygon(g,[project(v,a.x,a.y,z0),project(v,b.x,b.y,z0),project(v,b.x,b.y,z1),project(v,a.x,a.y,z1)],color,'#39382f',.65);}
  function wall(g,v,a,b,near,index) {
    const H=near?7:26;
    face(g,v,a,b,near?-7:0,H,near?'#676659':'#514f43');
    const n=Math.max(1,Math.round(Math.hypot(a.x-b.x,a.y-b.y)/10));
    for(let row=0;row<(near?2:4);row++)for(let i=0;i<n;i++){
      const t=i/n,u=(i+1)/n,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},q={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u};
      const hash=((index*19+i*23+row*43)%19)/19,base=near?91:70;
      face(g,v,p,q,near?-7+row*7:row*6,H/(near?2:4)+ (near?-7+row*7:row*6),`rgb(${base+hash*12|0},${base+hash*11|0},${base-8+hash*10|0})`);
      const pa=project(v,p.x,p.y,near?0:row*6+5);const pb=project(v,q.x,q.y,near?0:row*6+5);
      g.strokeStyle='#928a703a';g.lineWidth=.55;g.beginPath();g.moveTo(pa.x+2,pa.y);g.lineTo(pb.x-2,pb.y);g.stroke();
    }
    const dx=(b.y-a.y),dy=-(b.x-a.x),len=Math.hypot(dx,dy)||1,th=4;
    polygon(g,[project(v,a.x,a.y,H),project(v,b.x,b.y,H),project(v,b.x+dx/len*th,b.y+dy/len*th,H),project(v,a.x+dx/len*th,a.y+dy/len*th,H)],'#929083','#55564c');
  }
  function outerEdges(layout) {
    const T=layout.tileSize,tiles=new Set(),raw=[],far=[],near=[],loops=[];
    for(const r of layout.floor)for(let x=r.x;x<r.x+r.w;x+=T)tiles.add(x+','+r.y);
    for(const key of tiles){const [x,y]=key.split(',').map(Number);
      if(!tiles.has(x+','+(y-T)))raw.push([{x,y},{x:x+T,y}]);
      if(!tiles.has((x-T)+','+y))raw.push([{x,y:y+T},{x,y}]);
      if(!tiles.has(x+','+(y+T)))raw.push([{x:x+T,y:y+T},{x,y:y+T}]);
      if(!tiles.has((x+T)+','+y))raw.push([{x:x+T,y},{x:x+T,y:y+T}]);
    }
    const keyed=new Map();for(const edge of raw){const key=edge[0].x+','+edge[0].y;if(!keyed.has(key))keyed.set(key,[]);keyed.get(key).push(edge);}
    while(keyed.size){const first=keyed.values().next().value[0],start=first[0],points=[];let edge=first;
      while(edge){points.push(edge[0]);const key=edge[0].x+','+edge[0].y,bucket=keyed.get(key);bucket.splice(bucket.indexOf(edge),1);if(!bucket.length)keyed.delete(key);
        const end=edge[1];if(end.x===start.x&&end.y===start.y)break;const next=keyed.get(end.x+','+end.y)||[];
        const dx=end.x-edge[0].x,dy=end.y-edge[0].y;
        // At diagonal contacts each loop keeps its own right turn, preserving separate rooms/holes.
        edge=next.find(e=>dx*(e[1].y-e[0].y)-dy*(e[1].x-e[0].x)>0)||next[0];
      }
      // Join wall blocks across collinear tile edges, then bevel short staircase corners.
      let merged=points.filter((p,i)=>{const a=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length];return (p.x-a.x)*(b.y-p.y)!==(p.y-a.y)*(b.x-p.x);});
      if(merged.length>3){const long=merged.findIndex((p,i)=>{const q=merged[(i+1)%merged.length];return Math.hypot(q.x-p.x,q.y-p.y)>T*1.1;});if(long>0)merged=merged.slice(long).concat(merged.slice(0,long));
        const joined=[];for(let i=0;i<merged.length;){const p=merged[i];joined.push(p);let j=i+1,dx=0,dy=0;
          while(j<merged.length){const a=merged[j-1],q=merged[j],sx=q.x-a.x,sy=q.y-a.y;
            if(Math.hypot(sx,sy)>T*1.1||(sx&&dx&&Math.sign(sx)!==Math.sign(dx))||(sy&&dy&&Math.sign(sy)!==Math.sign(dy)))break;
            dx+=sx;dy+=sy;j++;
          }
          i=dx&&dy&&j-i>=5?j-1:i+1;
        }merged=joined;
      }
      loops.push(merged);
      for(let i=0;i<merged.length;i++){const a=merged[i],b=merged[(i+1)%merged.length],dx=b.x-a.x,dy=b.y-a.y;
        (dy<0||dx>0?far:near).push([a,b]);}
    }
    return {far,near,loops};
  }
  const edgesCache=new WeakMap();
  function sprite(g,kind,index,x,y,w,h,walking,odo,still,seated) {
    const img=assets[kind],r=rects[kind]&&rects[kind][index];if(!img||!r)return false;
    const bob=walking&&!still?Math.sin(odo*.4)*.7:0;
    g.save();g.imageSmoothingEnabled=true;
    if(seated){const upper=.72,top=h*.93;
      g.drawImage(img,r.x,r.y,r.w,r.h*upper,x-w/2,y-h,w,top);
      g.drawImage(img,r.x,r.y+r.h*upper,r.w,r.h*(1-upper),x-w/2,y-h+top,w,h-top);
    }else if(!walking||still){g.drawImage(img,r.x,r.y,r.w,r.h,x-w/2,y-h+bob,w,h);}
    else{
      // Articulated lower sprite bands follow the core odometer, not a decorative timer.
      const upper=.72,legH=h*(1-upper),step=Math.sin(odo*.48)*2;
      g.drawImage(img,r.x,r.y,r.w,r.h*upper,x-w/2,y-h+bob,w,h*upper);
      for(let i=0;i<2;i++)g.drawImage(img,r.x+r.w/2*i,r.y+r.h*upper,r.w/2,r.h*(1-upper),x-w/2+i*w/2+step*(i?1:-1)*.35,y-legH+bob+Math.abs(step)*(i?.25:-.25),w/2,legH);
    }g.restore();return true;
  }
  function star(g,x,y,r,color) {const p=[];for(let i=0;i<16;i++){const a=i*Math.PI/8-Math.PI/2,n=i%4===0?r:i%2===0?r*.62:r*.18;p.push({x:x+Math.cos(a)*n,y:y+Math.sin(a)*n});}polygon(g,p,color,'#796224',.7);}
  function banner(g,v,x,y) {const p=project(v,x,y,25),s=v.scale;
    polygon(g,[{x:p.x-5*s,y:p.y},{x:p.x+5*s,y:p.y},{x:p.x+5*s,y:p.y+19*s},{x:p.x,y:p.y+16*s},{x:p.x-5*s,y:p.y+19*s}],'#233950','#858070');
    star(g,p.x,p.y+8*s,4.5*s,'#b99d46');g.strokeStyle='#a29059';g.lineWidth=1;g.beginPath();g.moveTo(p.x-7*s,p.y);g.lineTo(p.x+7*s,p.y);g.stroke();
  }
  function torch(g,v,x,y,now,still) {const p=project(v,x,y,18),s=v.scale;
    g.strokeStyle='#42341e';g.lineWidth=2*s;g.beginPath();g.moveTo(p.x,p.y+6*s);g.lineTo(p.x,p.y);g.stroke();
    const glow=g.createRadialGradient(p.x,p.y,1,p.x,p.y,9*s);glow.addColorStop(0,'#ffb93645');glow.addColorStop(1,'#ffb93600');g.fillStyle=glow;g.fillRect(p.x-9*s,p.y-9*s,18*s,18*s);
    const f=still?0:Math.sin(now/110+x)*.6;polygon(g,[{x:p.x-1.5*s,y:p.y},{x:p.x-.8*s,y:p.y-4*s},{x:p.x+f*s,y:p.y-7*s},{x:p.x+1.5*s,y:p.y-2*s}],'#f1b33d');
    polygon(g,[{x:p.x-.6*s,y:p.y},{x:p.x,y:p.y-3.2*s},{x:p.x+.8*s,y:p.y-1*s}],'#ffeb94');
  }
  function propIndex(p) {
    if(p.type==='plant'||p.type==='plant2')return 7;
    if(p.type==='missionboard'||p.type==='trophycase'||p.type==='table')return 6;
    if(p.capability==='dish')return 3;if(p.capability==='cabinet')return 2;
    if(p.capability==='workbench')return 1;if(p.capability==='notebook')return 5;
    if(p.capability==='studio')return 1;if(p.capability==='computer'){
      const role=typeof StationPresentation!=='undefined'?StationPresentation.roleFor(lookup(p.agentId)):null;
      return role&&['mage','scholar'].includes(role.kind)?4:role&&role.kind==='dwarf'?1:0;
    }return null;
  }
  function drawProp(g,v,p) {
    const foot=project(v,p.x+p.w/2,p.y+p.h*.78),index=propIndex(p),r=rects.props&&rects.props[index];
    const near=.83+.34*(p.y-v.b.y)/Math.max(1,v.b.h);
    let w=Math.max(10,p.w*1.10)*v.scale*near,h=index===3?35*v.scale: index===2||index===5?27*v.scale:Math.min(28,Math.max(16,p.w*.9))*v.scale;
    if(index===7){w=12*v.scale;h=23*v.scale;}
    if(r&&index!=null){w=Math.min(w,h*r.w/r.h*1.2);h=w*r.h/r.w;
      g.save();g.fillStyle='#17150e42';g.beginPath();g.ellipse(foot.x+3*v.scale,foot.y,w*.36,3*v.scale,.05,0,Math.PI*2);g.fill();g.restore();
      sprite(g,'props',index,foot.x,foot.y,w,h,false,0,true);
    }else{
      // Unknown future equipment stays identifiable and clickable instead of vanishing.
      const a=project(v,p.x,p.y+p.h),b=project(v,p.x+p.w,p.y+p.h);face(g,v,{x:p.x,y:p.y+p.h},{x:p.x+p.w,y:p.y+p.h},0,8,'#78674a');
      quad(g,v,p.x,p.y,p.w,p.h,8,'#91816a','#3f372c');g.fillStyle='#a99b77';g.fillRect((a.x+b.x)/2-3,Math.min(a.y,b.y)-6,6,2);
    }
    if(p.users.length){g.fillStyle='#93c18f';g.shadowColor='#80b26c';g.shadowBlur=5;g.fillRect(foot.x+w*.24,foot.y-h*.5,2*v.scale,1.2*v.scale);g.shadowBlur=0;}
    hitRects.push({kind:'equipment',id:p.id,wx:p.x+p.w/2,wy:p.y+p.h/2,x:foot.x-w/2,y:foot.y-h,w,h});
  }
  function drawBody(g,v,b,now,still) {
    const record=lookup(b.id)||b,role=StationPresentation.roleFor(record),col=COLS[role.kind]??2;
    const row=({south:0,southwest:1,west:1,northwest:2,north:2,northeast:3,east:3,southeast:0})[b.dir]??0;
    const kind=['scout','player'].includes(role.kind)?'travellers':'npc',index=kind==='travellers'?(role.kind==='scout'?4:0)+row:row*8+col,r=rects[kind]&&rects[kind][index];
    const p=project(v,b.x,b.y),n=.83+.34*(b.y-v.b.y)/Math.max(1,v.b.h);
    const fullH=(role.kind==='dwarf'?27:33)*v.scale*n,fullW=r?fullH*r.w/r.h:fullH*.44;
    const h=b.lying?fullW:b.sitting?fullH*.78:fullH,w=b.lying?fullH:fullW;
    g.fillStyle='#15171055';g.beginPath();g.ellipse(p.x,p.y,5*v.scale*n,1.8*v.scale*n,0,0,Math.PI*2);g.fill();
    let painted=false;
    if(b.lying&&r){g.save();g.translate(p.x,p.y-fullW*.5);g.rotate(Math.PI/2);painted=sprite(g,kind,index,0,fullH*.5,fullW,fullH,false,0,true);g.restore();}
    else painted=sprite(g,kind,index,p.x,p.y,w,h,b.moving,b.odo,still,b.sitting);
    if(!painted){
      g.save();g.translate(p.x,p.y);g.scale(v.scale*n,v.scale*n);StationPresentation.drawBody(g,{...b,px:0,py:0},now,{reducedMotion:still});g.restore();
    }
    if(b.working&&!b.lying){g.fillStyle='#b0cc89';const pulse=still?1:.7+.3*Math.sin(now/180);g.globalAlpha=pulse;g.fillRect(p.x+w*.4,p.y-h*.45,2*v.scale,1.5*v.scale);g.globalAlpha=1;}
    if(b.waiting){g.fillStyle='#d55839';g.beginPath();g.arc(p.x,p.y-h-8,3,0,Math.PI*2);g.fill();}
    const font=Math.max(12,Math.min(17,v.scale*4.5));g.font=`${font}px OSRSBold,monospace`;g.textAlign='left';g.textBaseline='bottom';g.lineWidth=3;g.strokeStyle='#15150e';
    labels.push({b,role,p,w,h,font,text:role.npcName||role.name,sub:role.job||b.name});
    hitRects.push({kind:'agent',id:b.id,wx:b.x,wy:b.y,x:p.x-w/2,y:p.y-h,w,h});
  }
  function drawLabels(g,v){
    const occupied=[];
    for(const l of labels){const {b,role,p,w,h,font,text,sub}=l;
      g.font=`${font}px OSRSBold,monospace`;
      const width=Math.max(g.measureText(text).width,g.measureText(sub).width)+4,height=b.tool||b.waiting?46:31;
      const anchor={x:p.x+Math.min(w*.23,15),y:p.y-h-5};let chosen=null;
      for(const dy of [0,-34,34,-68,68,-102])for(const x0 of [anchor.x,p.x-width-w*.1]){
        const x=Math.max(4,Math.min(v.width-width-4,x0)),y=Math.max(height+4,Math.min(v.height-height-4,anchor.y+dy));
        const r={x:x-2,y:y-font,w:width,h:height};
        const cost=occupied.reduce((sum,q)=>sum+Math.max(0,Math.min(r.x+r.w,q.x+q.w)-Math.max(r.x,q.x))*Math.max(0,Math.min(r.y+r.h,q.y+q.h)-Math.max(r.y,q.y)),0)+Math.abs(dy)*.05+(x0===anchor.x?0:1);
        if(!chosen||cost<chosen.cost)chosen={x,y,r,cost};
      }
      const {x,y,r}=chosen;occupied.push(r);
      if(Math.abs(y-anchor.y)>8){g.strokeStyle='#dfd7a944';g.lineWidth=.7;g.beginPath();g.moveTo(p.x,p.y-h);g.lineTo(x,y+5);g.stroke();}
      g.textAlign='left';g.textBaseline='bottom';g.lineWidth=3;g.strokeStyle='#15150e';g.font=`${font}px OSRSBold,monospace`;
      g.strokeText(text,x,y);g.fillStyle='#ead653';g.fillText(text,x,y);
      g.font=`${Math.max(12,font-1)}px OSRSPlain,monospace`;g.strokeText(sub,x,y+16);g.fillStyle='#f4efe2';g.fillText(sub,x,y+16);
      if(b.tool||b.waiting){const status=b.waiting?'Awaiting approval':b.tool;g.font='13px OSRSPlain,monospace';g.strokeText(status,x,y+31);g.fillStyle=b.waiting?'#f1b66b':'#b9d6a6';g.fillText(status,x,y+31);}
      hitRects.push({kind:'agent',id:b.id,wx:b.x,wy:b.y,...r});
    }
  }
  function draw(g,canvas,frame) {
    if(!active()||!frame.snapshot||!frame.snapshot.layout.floor.length)return false;
    const s=frame.snapshot,W=canvas.width,H=canvas.height;
    const nativeScale=s.viewport?W/s.viewport.w:1,nativeCenter=s.viewport?{x:s.viewport.x+s.viewport.w/2,y:s.viewport.y+s.viewport.h/2}:null;
    if(!baseline||baseline.layout!==s.layout||baseline.w!==W||baseline.h!==H){baseline={layout:s.layout,w:W,h:H,scale:nativeScale,center:nativeCenter};}
    const b=bounds(s.layout),center={x:b.x+b.w/2+(nativeCenter&&baseline.center?nativeCenter.x-baseline.center.x:0),y:b.y+b.h/2+(nativeCenter&&baseline.center?nativeCenter.y-baseline.center.y:0)};
    view=makeView(s.layout,W,H,nativeScale/baseline.scale,center);hitRects.length=0;labels.length=0;
    g.save();g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';g.imageSmoothingEnabled=true;
    g.fillStyle='#050509';g.fillRect(0,0,W,H);
    for(let i=0;i<125;i++){const x=(i*377+71)%W,y=(i*719+47)%H;g.fillStyle=i%7?'#c8c6c46a':'#ddc385';g.fillRect(x,y,i%7?.6:1.1,.7);}
    const T=s.layout.tileSize;
    let e=edgesCache.get(s.layout);if(!e){e=outerEdges(s.layout);edgesCache.set(s.layout,e);}
    g.save();g.beginPath();for(const points of e.loops){points.forEach((p,i)=>{const q=project(view,p.x,p.y);i?g.lineTo(q.x,q.y):g.moveTo(q.x,q.y);});g.closePath();}g.clip('evenodd');
    g.fillStyle='#655f4d';g.fillRect(0,0,W,H);
    for(const row of s.layout.floor)for(let x=row.x;x<row.x+row.w;x+=T){const h=((x*73+row.y*31)%23)/23;
      quad(g,view,x,row.y,T,T,0,`rgb(${99+h*13|0},${94+h*13|0},${78+h*11|0})`,'#6b665548');
      for(let k=0;k<3;k++){const q=project(view,x+2+((x+k*31)%8),row.y+2+((row.y+k*43)%8));g.fillStyle=k%2?'#4f4c3b28':'#b4a98424';g.fillRect(q.x,q.y,.55*view.scale,.3*view.scale);}
    }
    g.restore();
    e.far.forEach(([a,b],i)=>wall(g,view,a,b,false,i));
    banner(g,view,b.x+b.w*.28,b.y);banner(g,view,b.x+b.w*.70,b.y);
    torch(g,view,b.x+b.w*.08,b.y,frame.now,frame.reducedMotion);torch(g,view,b.x+b.w*.88,b.y,frame.now,frame.reducedMotion);
    for(const belt of s.layout.belts||[])quad(g,view,belt.x,belt.y,T,T,.1,'#524c3b','#b09a57');
    const items=s.equipment.map(p=>({y:p.y+p.h,draw:()=>drawProp(g,view,p)}));
    for(const body of s.bodies)if(!body.unplaced)items.push({y:body.y,draw:()=>drawBody(g,view,body,frame.now,frame.reducedMotion)});
    items.sort((a,b)=>a.y-b.y).forEach(i=>i.draw());
    for(const box of s.transports||[])quad(g,view,box.x-2,box.y-2,4,4,4,'#b1985a','#403b27');
    e.near.forEach(([a,b],i)=>wall(g,view,a,b,true,i));
    drawLabels(g,view);
    if(!s.connected){g.fillStyle='#f2c882';g.font='17px OSRSBold';g.fillText('Station connection interrupted',12,24);}
    g.restore();return true;
  }
  function hitPoint(x,y) {for(let i=hitRects.length-1;i>=0;i--){const r=hitRects[i];if(x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h)return {...r};}return null;}
  function pointFromClient(e,canvas) {const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};}
  function clientToWorld(e,canvas) {if(!active()||!view)return null;const p=pointFromClient(e,canvas),hit=hitPoint(p.x,p.y);return hit?{x:hit.wx,y:hit.wy}:unproject(view,p.x,p.y);}
  function worldToCanvas(x,y) {return active()&&view?project(view,x,y):null;}
  function clientHit(e,canvas) {if(!active()||!view)return null;const p=pointFromClient(e,canvas);return hitPoint(p.x,p.y);}
  function reset(){view=null;baseline=null;hitRects.length=0;}
  return {active,draw,reset,bind:fn=>{lookup=fn||(()=>null);},clientToWorld,worldToCanvas,clientHit,makeView,project,unproject,propIndex,
    ready:()=>!!(rects.npc&&rects.props&&rects.travellers),hitRects:()=>hitRects.map(r=>({...r})),bounds,outline:outerEdges};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=OSRSWorld;
