/* OSRS station presentation. The model, paths, run states and equipment remain authoritative in
   World. This pass paints a perspective view AFTER the native simulation/transport work has run. */
'use strict';
const OSRSWorld = (() => {
  const assets = {}, rects = {}, hitRects = [], labels=[];
  let view = null, baseline = null, terrain = null, lookup = () => null;
  const WALL_HEIGHT=31, WALL_THICKNESS=6.5, FLOOR_DEPTH=.80;
  function alphaBounds(data,stride,left,top,w,h) {
    const visited=new Uint8Array(w*h),queue=new Int32Array(w*h),components=[];
    const opaque=(x,y)=>data[((top+y)*stride+left+x)*4+3]>40;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const start=y*w+x;if(visited[start]||!opaque(x,y))continue;
      let head=0,tail=1;queue[0]=start;visited[start]=1;
      const box={x0:x,y0:y,x1:x,y1:y,size:0};
      while(head<tail){const i=queue[head++],px=i%w,py=Math.floor(i/w);box.size++;
        box.x0=Math.min(box.x0,px);box.x1=Math.max(box.x1,px);box.y0=Math.min(box.y0,py);box.y1=Math.max(box.y1,py);
        for(const n of [px>0?i-1:-1,px+1<w?i+1:-1,py>0?i-w:-1,py+1<h?i+w:-1]){
          if(n>=0&&!visited[n]&&opaque(n%w,Math.floor(n/w))){visited[n]=1;queue[tail++]=n;}
        }
      }components.push(box);
    }
    components.sort((a,b)=>b.size-a.size);
    const main=components[0]||{x0:0,y0:0,x1:w-1,y1:h-1,size:1},out={...main};
    // Trim stray fragments from an adjacent atlas cell while retaining nearby held gear.
    for(const c of components.slice(1)){
      const gap=Math.hypot(Math.max(0,main.x0-c.x1,c.x0-main.x1),Math.max(0,main.y0-c.y1,c.y0-main.y1));
      if(c.size>=main.size*.012&&gap<Math.min(w,h)*.065){out.x0=Math.min(out.x0,c.x0);out.y0=Math.min(out.y0,c.y0);out.x1=Math.max(out.x1,c.x1);out.y1=Math.max(out.y1,c.y1);}
    }
    return {x:left+out.x0,y:top+out.y0,w:out.x1-out.x0+1,h:out.y1-out.y0+1};
  }
  const active = () => typeof PresentationThemes !== 'undefined' && PresentationThemes.get() === 'osrs';
  function load(name, path, columns, rows) {
    if (typeof Image === 'undefined') return;
    const image = new Image(); assets[name] = image;
    image.onload = () => {
      const c=document.createElement('canvas');c.width=image.width;c.height=image.height;
      const g=c.getContext('2d');
      // Grade once, so moving NPCs never require an image filter/composite on every frame.
      g.filter=name==='props'?'brightness(.82) saturate(.72)':'brightness(.86) saturate(.78)';
      g.drawImage(image,0,0);g.filter='none';assets[name]=c;
      const data=g.getImageData(0,0,c.width,c.height).data;
      rects[name]=[];
      // Asset-bound scanning is done once at load, never a frame-loop pixel readback.
      for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
        const x=Math.floor(col*image.width/columns),y=Math.floor(row*image.height/rows),w=Math.floor((col+1)*image.width/columns)-x,h=Math.floor((row+1)*image.height/rows)-y;
        rects[name].push(alphaBounds(data,c.width,x,y,w,h));
      }
    };image.src=path;
  }
  load('npc','assets/osrs-client/npc-atlas-v2.png',8,4);
  load('travellers','assets/osrs-client/traveller-atlas.png',4,2);
  load('armour','assets/osrs-client/armour-atlas.png',8,4);
  load('props','assets/osrs-client/prop-atlas.png',4,2);
  if(typeof Image!=='undefined'){assets.material=new Image();assets.material.src='assets/osrs-client/reference.jpg';}
  function bounds(layout) {
    const f=layout.floor;
    if(!f.length)return {x:0,y:0,w:layout.width,h:layout.height};
    const x=Math.min(...f.map(r=>r.x)),y=Math.min(...f.map(r=>r.y));
    return {x,y,w:Math.max(...f.map(r=>r.x+r.w))-x,h:Math.max(...f.map(r=>r.y+r.h))-y};
  }
  function makeView(layout, width, height, zoom, center) {
    const b=bounds(layout),v={b,width,height,cx:b.x+b.w/2,cy:b.y+b.h/2,center:center||{x:b.x+b.w/2,y:b.y+b.h/2}};
    let edges=edgesCache.get(layout);if(!edges){edges=outerEdges(layout);edgesCache.set(layout,edges);}
    const points=[];
    for(const [near,list] of [[false,edges.far],[true,edges.near]])for(const [a,c] of list){
      const len=Math.hypot(c.x-a.x,c.y-a.y)||1,dx=(c.y-a.y)/len*WALL_THICKNESS,dy=-(c.x-a.x)/len*WALL_THICKNESS;
      for(const p of [a,c]){points.push(local(v,p.x,p.y,near?-4:0),local(v,p.x+dx,p.y+dy,near?5:WALL_HEIGHT));}
    }
    if(!points.length)points.push(local(v,b.x,b.y,0),local(v,b.x+b.w,b.y+b.h,0));
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
    v.scale=Math.min((width-16)/Math.max(1,x1-x0),(height-12)/Math.max(1,y1-y0))*Math.max(.1,zoom||1);
    v.ox=width/2-(x0+x1)/2*v.scale;v.oy=height/2-(y0+y1)/2*v.scale;return v;
  }
  function breadth(v,y){return 1.06+.29*(y-v.b.y)/Math.max(1,v.b.h);}
  function local(v,x,y,z) {return {x:(x-v.cx)*breadth(v,y),y:(y-v.cy)*FLOOR_DEPTH-(z||0)};}
  function project(v,x,y,z) {const p=local(v,x,y,z),c=local(v,v.center.x,v.center.y,0);return {x:v.ox+(p.x-c.x)*v.scale,y:v.oy+(p.y-c.y)*v.scale};}
  function unproject(v,x,y) {const c=local(v,v.center.x,v.center.y,0),wy=v.cy+((y-v.oy)/v.scale+c.y)/FLOOR_DEPTH;
    return {x:v.cx+((x-v.ox)/v.scale+c.x)/breadth(v,wy),y:wy};}
  function polygon(g,points,fill,stroke,width) {
    g.beginPath();points.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();g.fillStyle=fill;g.fill();
    if(stroke){g.strokeStyle=stroke;g.lineWidth=width||.6;g.stroke();}
  }
  function quad(g,v,x,y,w,h,z,fill,stroke){polygon(g,[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(([a,b])=>project(v,a,b,z)),fill,stroke);}
  function face(g,v,a,b,z0,z1,color){polygon(g,[project(v,a.x,a.y,z0),project(v,b.x,b.y,z0),project(v,b.x,b.y,z1),project(v,a.x,a.y,z1)],color,'#39382f',.65);}
  function imageQuad(g,points,source){
    const image=assets.material;if(!image?.complete||!image.naturalWidth)return false;
    const [a,b,c,d]=points,[sx,sy,sw,sh]=source;
    for(const [p,q,r,second]of [[a,b,c,false],[c,d,a,true]]){
      g.save();g.beginPath();g.moveTo(p.x,p.y);g.lineTo(q.x,q.y);g.lineTo(r.x,r.y);g.closePath();g.clip();
      if(!second)g.transform((b.x-a.x)/sw,(b.y-a.y)/sw,(c.x-b.x)/sh,(c.y-b.y)/sh,a.x,a.y);
      else g.transform((c.x-d.x)/sw,(c.y-d.y)/sw,(d.x-a.x)/sh,(d.y-a.y)/sh,a.x,a.y);
      g.drawImage(image,sx,sy,sw,sh,0,0,sw,sh);g.restore();
    }return true;
  }
  function wall(g,v,a,b,near,index) {
    const H=near?5:WALL_HEIGHT,low=near?-4:0,rows=near?2:4,step=(H-low)/rows;
    face(g,v,a,b,low,H,near?'#686762':'#595750');
    const n=Math.max(1,Math.round(Math.hypot(a.x-b.x,a.y-b.y)/15));
    for(let row=0;row<rows;row++)for(let i=-1;i<n;i++){
      const offset=row%2?.5:0,t=Math.max(0,(i+offset)/n),u=Math.min(1,(i+1+offset)/n);if(u<=t)continue;
      const p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},q={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u};
      const hash=((index*19+i*23+row*43+137)%19)/19,base=near?86:66,z0=low+row*step,z1=z0+step;
      face(g,v,p,q,z0,z1,`rgb(${base+hash*18|0},${base+hash*17|0},${base-5+hash*17|0})`);
      g.save();g.globalAlpha=.42;imageQuad(g,[project(v,p.x,p.y,z1-.3),project(v,q.x,q.y,z1-.3),project(v,q.x,q.y,z0+.3),project(v,p.x,p.y,z0+.3)],[544,710,80,12]);g.restore();
      const pa=project(v,p.x,p.y,z1),pb=project(v,q.x,q.y,z1);
      g.strokeStyle='#d6d1ba30';g.lineWidth=.7;g.beginPath();g.moveTo(pa.x+1,pa.y+1);g.lineTo(pb.x-1,pb.y+1);g.stroke();
      if(hash>.62){const m=project(v,p.x+(q.x-p.x)*.7,p.y+(q.y-p.y)*.7,z0+step*.54);
        g.strokeStyle='#b8b09930';g.beginPath();g.moveTo(m.x-3*v.scale,m.y);g.lineTo(m.x+2*v.scale,m.y-.25*v.scale);g.stroke();}
    }
    const dx=(b.y-a.y),dy=-(b.x-a.x),len=Math.hypot(dx,dy)||1,th=WALL_THICKNESS;
    for(let i=0;i<n;i++){
      const p={x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n},q={x:a.x+(b.x-a.x)*(i+1)/n,y:a.y+(b.y-a.y)*(i+1)/n},shade=130+(i*13+index*7)%18;
      const cap=[project(v,p.x,p.y,H),project(v,q.x,q.y,H),project(v,q.x+dx/len*th,q.y+dy/len*th,H),project(v,p.x+dx/len*th,p.y+dy/len*th,H)];
      polygon(g,cap,`rgb(${shade},${shade-2},${shade-8})`,'#4d4c48',.8);
      g.save();g.globalAlpha=.78;imageQuad(g,cap,[538,698,80,7]);g.restore();
    }
    const pa=project(v,a.x+dx/len*th,a.y+dy/len*th,H),pb=project(v,b.x+dx/len*th,b.y+dy/len*th,H);
    g.strokeStyle='#c6c1ae88';g.lineWidth=.75;g.beginPath();g.moveTo(pa.x,pa.y);g.lineTo(pb.x,pb.y);g.stroke();
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
  function banner(g,v,x,y) {const p=project(v,x,y,29),s=v.scale;
    if(assets.material?.complete&&assets.material.naturalWidth){g.drawImage(assets.material,689,110,44,95,p.x-5.4*s,p.y,10.8*s,23.3*s);return;}
    polygon(g,[{x:p.x-5*s,y:p.y},{x:p.x+5*s,y:p.y},{x:p.x+5*s,y:p.y+23*s},{x:p.x,y:p.y+20*s},{x:p.x-5*s,y:p.y+23*s}],'#233950','#858070');
    star(g,p.x,p.y+10*s,4.5*s,'#b99d46');
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
      return role&&role.kind==='dwarf'?1:0;
    }return null;
  }
  function drawProp(g,v,p) {
    const foot=project(v,p.x+p.w/2,p.y+p.h*.78),index=propIndex(p),r=rects.props&&rects.props[index];
    const near=breadth(v,p.y);
    let w=Math.max(10,p.w*1.05)*v.scale*near,h=index===3?37*v.scale: index===2||index===5?29*v.scale:Math.min(30,Math.max(17,p.w*.9))*v.scale;
    if(index===7){w=12*v.scale;h=23*v.scale;}
    if(r&&index!=null){w=Math.min(w,h*r.w/r.h*1.2);h=w*r.h/r.w;
      g.save();g.fillStyle='#17150e32';g.beginPath();g.ellipse(foot.x+2*v.scale,foot.y,w*.34,1.8*v.scale,.05,0,Math.PI*2);g.fill();
      sprite(g,'props',index,foot.x,foot.y,w,h,false,0,true);g.restore();
    }else{
      // Unknown future equipment stays identifiable and clickable instead of vanishing.
      const a=project(v,p.x,p.y+p.h),b=project(v,p.x+p.w,p.y+p.h);face(g,v,{x:p.x,y:p.y+p.h},{x:p.x+p.w,y:p.y+p.h},0,8,'#78674a');
      quad(g,v,p.x,p.y,p.w,p.h,8,'#91816a','#3f372c');g.fillStyle='#a99b77';g.fillRect((a.x+b.x)/2-3,Math.min(a.y,b.y)-6,6,2);
    }
    if(p.users.length){g.fillStyle='#93c18f';g.shadowColor='#80b26c';g.shadowBlur=5;g.fillRect(foot.x+w*.24,foot.y-h*.5,2*v.scale,1.2*v.scale);g.shadowBlur=0;}
    hitRects.push({kind:'equipment',id:p.id,wx:p.x+p.w/2,wy:p.y+p.h/2,x:foot.x-w/2,y:foot.y-h,w,h});
  }
  function drawBody(g,v,b,now,still) {
    const record=lookup(b.id)||b,role=StationPresentation.roleFor(record),spec=OSRSAppearance.sprite(record,b.dir),kind=spec.atlas,index=spec.index,r=rects[kind]&&rects[kind][index];
    const p=project(v,b.x,b.y),n=.92+.10*(b.y-v.b.y)/Math.max(1,v.b.h);
    const fullH=(spec.look.kind==='dwarf'?27:33)*v.scale*n,fullW=r?fullH*r.w/r.h:fullH*.44;
    const h=b.lying?fullW:b.sitting?fullH*.78:fullH,w=b.lying?fullH:fullW;
    g.fillStyle='#15171040';g.beginPath();g.ellipse(p.x+v.scale,p.y,4.5*v.scale*n,1.3*v.scale*n,0,0,Math.PI*2);g.fill();
    let painted=false;
    g.save();
    if(b.lying&&r){g.save();g.translate(p.x,p.y-fullW*.5);g.rotate(Math.PI/2);painted=sprite(g,kind,index,0,fullH*.5,fullW,fullH,false,0,true);g.restore();}
    else painted=sprite(g,kind,index,p.x,p.y,w,h,b.moving,b.odo,still,b.sitting);
    g.restore();if(!painted){
      g.save();g.translate(p.x,p.y);g.scale(v.scale*n,v.scale*n);StationPresentation.drawBody(g,{...b,px:0,py:0},now,{reducedMotion:still});g.restore();
    }
    if(b.working&&!b.lying){g.fillStyle='#b0cc89';const pulse=still?1:.7+.3*Math.sin(now/180);g.globalAlpha=pulse;g.fillRect(p.x+w*.4,p.y-h*.45,2*v.scale,1.5*v.scale);g.globalAlpha=1;}
    if(b.waiting){g.fillStyle='#d55839';g.beginPath();g.arc(p.x,p.y-h-8,3,0,Math.PI*2);g.fill();}
    const font=Math.max(12,Math.min(17,v.scale*4.5));g.font=`${font}px OSRSBold,monospace`;g.textAlign='left';g.textBaseline='bottom';g.lineWidth=3;g.strokeStyle='#15150e';
    labels.push({b,role,p,w,h,font,text:spec.look.npcName,sub:role.job||b.name});
    hitRects.push({kind:'agent',id:b.id,appearance:spec.look.id,atlas:kind,spriteIndex:index,wx:b.x,wy:b.y,x:p.x-w/2,y:p.y-h,w,h});
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
  function textureQuad(g,v,x,y,T) {
    // Two affine triangles place the reference's empty stone surface onto the live floor.
    return imageQuad(g,[[x,y],[x+T,y],[x+T,y+T],[x,y+T]].map(([a,b])=>project(v,a,b)),[756,454,64,64]);
  }
  function drawTerrain(g,v,s,e){
    const loaded=!!assets.material?.naturalWidth,key=[v.width,v.height,v.scale,v.center.x,v.center.y,loaded].join(':');
    if(!terrain||terrain.key!==key||terrain.layout!==s.layout){
      const c=document.createElement('canvas');c.width=v.width;c.height=v.height;const t=c.getContext('2d'),T=s.layout.tileSize;
      t.save();t.beginPath();for(const points of e.loops){points.forEach((p,i)=>{const q=project(v,p.x,p.y);i?t.lineTo(q.x,q.y):t.moveTo(q.x,q.y);});t.closePath();}t.clip('evenodd');
      t.fillStyle='#69665c';t.fillRect(0,0,c.width,c.height);
      for(const row of s.layout.floor)for(let x=row.x;x<row.x+row.w;x+=T){
        const h=((x*73+row.y*31)%23)/23;
        if(!textureQuad(t,v,x,row.y,T))quad(t,v,x,row.y,T,T,0,`rgb(${99+h*13|0},${96+h*13|0},${87+h*11|0})`);
        quad(t,v,x,row.y,T,T,0,`rgba(25,22,16,${.025+h*.045})`,'#45443c16');
      }
      // The back walls cast a broad contact shadow into the actual room boundary.
      for(const [a,b] of e.far){const p=project(v,a.x,a.y),q=project(v,b.x,b.y);t.strokeStyle='#23211727';t.lineWidth=5*v.scale;t.beginPath();t.moveTo(p.x,p.y);t.lineTo(q.x,q.y);t.stroke();}
      t.restore();e.far.forEach(([a,b],i)=>wall(t,v,a,b,false,i));
      const b=bounds(s.layout);banner(t,v,b.x+b.w*.52,b.y);banner(t,v,b.x+b.w*.78,b.y);
      const front=document.createElement('canvas');front.width=v.width;front.height=v.height;
      e.near.forEach(([a,b],i)=>wall(front.getContext('2d'),v,a,b,true,i));
      terrain={key,layout:s.layout,canvas:c,front};
    }g.drawImage(terrain.canvas,0,0);
  }
  function drawPortrait(canvas,record,override){
    const g=canvas.getContext('2d'),spec=OSRSAppearance.sprite(record,'south',override),r=rects[spec.atlas]?.[spec.index];
    g.clearRect(0,0,canvas.width,canvas.height);if(!r)return false;
    const k=Math.min((canvas.width-4)/r.w,(canvas.height-4)/r.h);g.imageSmoothingEnabled=true;
    g.drawImage(assets[spec.atlas],r.x,r.y,r.w,r.h,(canvas.width-r.w*k)/2,canvas.height-r.h*k-2,r.w*k,r.h*k);return true;
  }
  function spriteBounds(record,dir,override){const spec=OSRSAppearance.sprite(record,dir,override),r=rects[spec.atlas]?.[spec.index];return r?{...r,atlas:spec.atlas,index:spec.index}:null;}
  function drawMapEquipment(g,p){
    const index=propIndex(p),r=rects.props?.[index];if(!r||index==null)return false;
    const w=Math.max(9,p.w),h=w*r.h/r.w;g.drawImage(assets.props,r.x,r.y,r.w,r.h,p.x+p.w/2-w/2,p.y+p.h*.85-h,w,h);
    if(p.users.length){g.strokeStyle='#edcb65';g.lineWidth=1.4;g.strokeRect(p.x-.5,p.y-.5,p.w+1,p.h+1);}return true;
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
    drawTerrain(g,view,s,e);
    torch(g,view,b.x+b.w*.26,b.y,frame.now,frame.reducedMotion);torch(g,view,b.x+b.w*.67,b.y,frame.now,frame.reducedMotion);
    for(const belt of s.layout.belts||[])quad(g,view,belt.x,belt.y,T,T,.1,'#524c3b','#b09a57');
    const items=s.equipment.map(p=>({y:p.y+p.h,draw:()=>drawProp(g,view,p)}));
    for(const body of s.bodies)if(!body.unplaced)items.push({y:body.y,draw:()=>drawBody(g,view,body,frame.now,frame.reducedMotion)});
    items.sort((a,b)=>a.y-b.y).forEach(i=>i.draw());
    for(const box of s.transports||[])quad(g,view,box.x-2,box.y-2,4,4,4,'#b1985a','#403b27');
    g.drawImage(terrain.front,0,0);
    drawLabels(g,view);
    if(!s.connected){g.fillStyle='#f2c882';g.font='17px OSRSBold';g.fillText('Station connection interrupted',12,24);}
    g.restore();return true;
  }
  function hitPoint(x,y) {for(let i=hitRects.length-1;i>=0;i--){const r=hitRects[i];if(x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h)return {...r};}return null;}
  function pointFromClient(e,canvas) {const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};}
  function clientToWorld(e,canvas) {if(!active()||!view)return null;const p=pointFromClient(e,canvas),hit=hitPoint(p.x,p.y);return hit?{x:hit.wx,y:hit.wy}:unproject(view,p.x,p.y);}
  function worldToCanvas(x,y) {return active()&&view?project(view,x,y):null;}
  function clientHit(e,canvas) {if(!active()||!view)return null;const p=pointFromClient(e,canvas);return hitPoint(p.x,p.y);}
  function reset(){view=null;baseline=null;terrain=null;hitRects.length=0;}
  return {active,draw,reset,bind:fn=>{lookup=fn||(()=>null);},clientToWorld,worldToCanvas,clientHit,makeView,project,unproject,propIndex,
    ready:()=>!!(rects.npc&&rects.props&&rects.travellers&&rects.armour),drawPortrait,drawMapEquipment,spriteBounds,alphaBounds,hitRects:()=>hitRects.map(r=>({...r})),bounds,outline:outerEdges};
})();
if(typeof StationPresentation!=='undefined')StationPresentation.registerView('osrs',OSRSWorld);
if(typeof module!=='undefined'&&module.exports)module.exports=OSRSWorld;
