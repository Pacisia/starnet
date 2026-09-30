/* Approved OpenArt pixels, sampled by the presentation layer only. Coordinates use a 1536×1024
   reference grid; the original 3072×2048 PNGs are preserved byte for byte. No saved scene authority. */
'use strict';
const StationArt = (() => {
  const standing=[[.36,.012],[.62,.012],[.68,.075],[.65,.145],[.78,.20],[.88,.40],[.90,.54],[.80,.56],[.74,.48],[.70,.64],[.65,.85],[.73,.97],[.59,.99],[.50,.86],[.48,.70],[.42,.70],[.42,.85],[.38,.99],[.25,.99],[.24,.90],[.28,.64],[.23,.48],[.14,.56],[.06,.51],[.09,.38],[.22,.20],[.33,.15],[.30,.075]];
  const device=[[.12,0],[.84,0],[1,.16],[.98,.84],[.84,1],[.10,1],[0,.83],[0,.15]];
  const dish=[[.34,0],[.63,0],[.94,.16],[1,.49],[.86,.67],[.61,.76],[.60,.86],[.82,.89],[.89,1],[.15,1],[.22,.85],[.39,.80],[.40,.69],[.15,.62],[0,.34],[.08,.12]];
  const models = {
    'space-colony': {name:'Space Colony',historyId:'qmAyhwuvo0zonqYjTdgA',floor:[589,338,18,20],wall:[556,674,51,26],cap:[593,649,113,6],window:[477,4,385,82],palette:['#131920','#45505a','#dbb273','#eab84c','#797d79'],chatTop:729,
      npc:{player:[645,298,55,124],mage:[470,158,46,94],scholar:[642,142,62,85],ranger:[850,193,58,62],guard:[940,312,65,133],cook:[292,316,59,110],banker:[406,474,60,120],elf:[862,524,63,91],dwarf:[997,477,70,116]},
      props:{computer:[595,109,164,119],workbench:[1043,515,88,79],cabinet:[341,210,38,71],dish:[1026,225,106,154],notebook:[949,452,42,113],studio:[872,184,98,79],table:[599,441,155,152],plant:[799,68,48,122],portal:[949,452,42,113]},
      portraits:{player:0,mage:1,scholar:2,ranger:3,guard:4,cook:5,banker:6,elf:7,dwarf:8}},
    cyberpunk:{name:'Cyberpunk Workshop',historyId:'OKvsp0UYpZ7zYNYq9JrT',floor:[570,407,45,54],wall:[864,728,78,21],cap:[875,716,59,7],window:[460,0,462,110],palette:['#061017','#26343d','#58d8e9','#edc553','#536573'],chatTop:763,
      npc:{player:[662,381,57,126],mage:[414,231,59,124],scholar:[660,227,64,124],ranger:[918,232,61,127],guard:[1010,388,68,137],cook:[366,393,58,132],banker:[441,553,66,156],elf:[836,518,63,134],dwarf:[941,562,75,141]},
      props:{computer:[625,139,176,64],workbench:[1004,593,93,84],cabinet:[518,274,49,101],dish:[1033,238,40,96],notebook:[785,355,65,143],studio:[949,245,107,101],table:[553,539,251,167],plant:[326,595,34,62],portal:[785,355,65,143]},
      portraits:{player:0,mage:1,scholar:2,ranger:3,guard:4,cook:5,banker:6,elf:7,dwarf:8}},
    'starship-bridge':{name:'Starship Bridge',historyId:'P4XJcfdWVViXfltDF4lG',floor:[565,321,48,48],wall:[404,696,60,10],cap:[394,674,89,8],window:[516,74,434,46],palette:['#08141f','#243949','#bcbcad','#ecc66c','#526574'],chatTop:729,
      npc:{player:[642,303,65,121],mage:[404,188,55,124],scholar:[644,157,66,73],ranger:[897,193,44,62],guard:[898,308,60,139],cook:[297,337,66,146],banker:[372,509,64,85],elf:[971,464,61,137],dwarf:[802,550,57,75]},
      props:{computer:[585,126,179,78],workbench:[832,590,137,94],cabinet:[239,185,84,125],dish:[1031,150,81,155],notebook:[1076,401,63,141],studio:[891,152,113,86],table:[595,421,187,153],plant:[803,126,55,131],portal:[973,405,72,48]},
      portraits:{player:0,mage:1,scholar:2,ranger:3,guard:4,cook:5,banker:6,elf:7,dwarf:8}},
    'steampunk-airship':{name:'Steampunk Airship',historyId:'vcscF6o8wdFPlCPucRLk',floor:[523,331,55,54],wall:[567,47,86,20],cap:[572,37,77,9],window:[387,155,58,53],palette:['#100e0b','#433322','#bc9346','#eed07c','#886f42'],chatTop:729,
      npc:{player:[641,306,63,130],mage:[436,188,61,137],scholar:[638,170,63,122],ranger:[842,190,60,136],guard:[978,311,73,151],cook:[315,340,73,143],banker:[371,498,67,85],elf:[918,473,63,144],dwarf:[846,561,65,94]},
      props:{computer:[622,136,111,80],workbench:[863,630,146,65],cabinet:[502,158,27,61],dish:[1027,109,106,208],notebook:[351,568,70,38],studio:[891,177,66,95],table:[564,477,223,200],plant:[827,92,67,127],portal:[1029,488,36,67]},
      portraits:{player:0,mage:1,scholar:2,ranger:3,guard:4,cook:5,banker:6,elf:7,dwarf:8}},
    'secret-agent-hq':{name:'Secret-Agent HQ',historyId:'byQf0pxPAgRquxY2mbZA',floor:[557,344,56,56],wall:[1092,277,17,18],cap:[439,721,76,9],window:[553,5,324,81],palette:['#100f0b','#2e2d25','#a99e7a','#e0be59','#676955'],chatTop:763,
      npc:{player:[690,338,58,134],mage:[378,217,61,132],scholar:[623,156,57,132],ranger:[914,191,62,60],guard:[1035,365,65,165],cook:[351,401,62,130],banker:[404,558,56,147],elf:[890,538,62,156],dwarf:[994,582,78,155]},
      props:{computer:[598,120,184,84],workbench:[1060,614,92,108],cabinet:[914,392,64,96],dish:[487,133,38,29],notebook:[259,308,51,125],studio:[943,175,69,77],table:[563,506,267,123],plant:[785,89,48,132],portal:[914,392,64,96]},
      portraits:{player:0,mage:1,scholar:2,ranger:3,guard:4,cook:5,banker:6,elf:7,dwarf:8}}
  };
  const cache=new Map(),listeners=new Set();
  // Printed labels cross a few NPCs in the concept. Omit these narrow source bands;
  // their names/roles are rendered separately from canonical records, never baked text.
  const omittedBands={'steampunk-airship':{mage:[[.60,.75]],scholar:[[.79,.94]],ranger:[[.61,.78]]}};
  const propHeights={'secret-agent-hq':{dish:14},'steampunk-airship':{notebook:11}};
  const repairs={
    'space-colony':{computer:[600,188,22,34],studio:[928,232,35,17],workbench:[1086,545,29,34]},
    cyberpunk:{computer:[745,181,28,20],studio:[1010,271,30,38],workbench:[1044,598,24,67]},
    'starship-bridge':{computer:[718,165,28,36],studio:[950,197,29,34],workbench:[898,611,38,48]},
    'steampunk-airship':{computer:[704,182,24,32],studio:[919,227,32,24],workbench:[958,642,29,34],notebook:[356,591,30,10]},
    'secret-agent-hq':{computer:[710,160,25,38],studio:[978,225,28,24],workbench:[1092,655,30,42]}
  };
  // The concept hides some lower bodies behind desks. For moving entities, complete those
  // poses with compatible trouser/boot pixels from the same approved crew, at the same scale.
  const fullPoses={
    'space-colony':{ranger:['banker',.88],elf:['banker',.82]},
    'starship-bridge':{scholar:['player',.86],ranger:['player',.88],banker:['player',.82],dwarf:['cook',.86]},
    'steampunk-airship':{banker:['player',.84],dwarf:['cook',.82]},
    'secret-agent-hq':{ranger:['banker',.88]}
  };
  const plant=[[.40,0],[.65,.02],[.73,.12],[.90,.10],[.95,.25],[.82,.35],[1,.46],[.79,.57],[.77,.70],[.86,.82],[.75,.99],[.24,1],[.10,.88],[.20,.64],[.09,.56],[0,.33],[.18,.28],[.09,.14],[.34,.22]];
  const propMasks={
    'space-colony':{workbench:[[.10,0],[.75,0],[.96,.25],[.96,.62],[.62,1],[.05,.8],[0,.3]]},
    'secret-agent-hq':{workbench:[[0,.20],[.63,0],[.95,.18],[.73,.40],[.22,.93],[0,.78]]}
  };
  for(const [id,m]of Object.entries(models)){
    m.id=id;m.source='assets/station-styles/'+id+'/reference.png';m.npc.scout=m.npc.player;m.portraits.scout=0;m.propHeights=Object.freeze(propHeights[id]||{});
    for(const table of [m.npc,m.props])for(const box of Object.values(table))Object.freeze(box);
    for(const kind of ['floor','wall','cap','window'])Object.freeze(m[kind]);
    Object.freeze(m.npc);Object.freeze(m.props);Object.freeze(m.portraits);Object.freeze(m.palette);Object.freeze(m);
  }
  function sample(image,box,width,height,path,holes,base){
    const c=document.createElement('canvas');c.width=width||Math.round(box[2]);c.height=height||Math.round(box[3]);const g=c.getContext('2d');
    if(path){g.beginPath();path.forEach(([x,y],i)=>i?g.lineTo(x*c.width,y*c.height):g.moveTo(x*c.width,y*c.height));g.closePath();g.clip();}
    if(holes?.length){
      if(base){g.fillStyle=base;g.fillRect(0,0,c.width,c.height);}
      g.beginPath();g.rect(0,0,c.width,c.height);
      for(const hole of holes){hole.forEach(([x,y],i)=>i?g.lineTo(x*c.width,y*c.height):g.moveTo(x*c.width,y*c.height));g.closePath();}g.clip('evenodd');
    }
    const k=image.naturalWidth/1536;g.drawImage(image,...box.map(n=>n*k),0,0,c.width,c.height);return c;
  }
  function load(id){
    if(!models[id]||typeof Image==='undefined'||typeof document==='undefined')return null;
    if(cache.has(id))return cache.get(id);
    const a={image:new Image(),ready:false,npc:{},portraits:{},props:{},materials:{},ui:{},model:models[id],error:false};cache.set(id,a);
    a.image.onload=()=>{try{
      const m=a.model;
      for(const kind of ['floor','wall','cap','window'])a.materials[kind]=sample(a.image,m[kind],m[kind][2]*2,m[kind][3]*2);
      const housing=id==='cyberpunk'?[1053,640,29,17]:repairs[id].computer;
      a.materials.housing=sample(a.image,housing,housing[2]*2,housing[3]*2);
      for(const [role,box]of Object.entries(m.npc)){
        const source=sample(a.image,box,box[2]*2,box[3]*2,standing),bands=omittedBands[id]?.[role];
        if(!bands){a.npc[role]=source;continue;}
        const c=document.createElement('canvas');c.width=source.width;c.height=Math.round(source.height*(1-bands.reduce((sum,[a,b])=>sum+b-a,0)));
        const g=c.getContext('2d');let from=0,to=0;
        for(const [start,end]of bands){const y=Math.round(start*source.height),h=y-from;g.drawImage(source,0,from,source.width,h,0,to,source.width,h);to+=h;from=Math.round(end*source.height);}
        const h=source.height-from;if(h>0)g.drawImage(source,0,from,source.width,h,0,to,source.width,h);a.npc[role]=c;
      }
      for(const [role,[donor,upper]]of Object.entries(fullPoses[id]||{})){
        const source=a.npc[role],legs=a.npc[donor],upperH=Math.round(source.height*upper),legY=Math.round(legs.height*.57),legH=legs.height-legY;
        const c=document.createElement('canvas');c.width=source.width;c.height=upperH+legH;const g=c.getContext('2d'),legW=c.width*.89;
        g.drawImage(legs,0,legY,legs.width,legH,(c.width-legW)/2,upperH-1,legW,legH+1);g.drawImage(source,0,0,source.width,upperH,0,0,source.width,upperH);a.npc[role]=c;
      }
      for(const [role,row]of Object.entries(m.portraits))a.portraits[role]=sample(a.image,[1205,636+33*row,32,32],64,64);
      for(const [kind,box]of Object.entries(m.props)){
        // Reconstruct occluded desk panels from clean areas of the SAME concept. Rectangular
        // housings avoid leaving a frozen worker or worker-shaped cutout inside live equipment.
        const path=propMasks[id]?.[kind]||(kind==='dish'?dish:kind==='plant'?plant:device),c=sample(a.image,box,box[2]*2,box[3]*2,path),g=c.getContext('2d'),clean=repairs[id]?.[kind];
        if(clean){g.save();g.beginPath();path.forEach(([x,y],i)=>i?g.lineTo(x*c.width,y*c.height):g.moveTo(x*c.width,y*c.height));g.closePath();g.clip();}
        for(const [role,npc]of Object.entries(m.npc)){if(role==='scout')continue;
          if(clean&&npc[0]<box[0]+box[2]&&npc[0]+npc[2]>box[0]&&npc[1]<box[1]+box[3]&&npc[1]+npc[3]>box[1]){
            const k=a.image.naturalWidth/1536,x=Math.max(box[0],npc[0]-1),y=Math.max(box[1],npc[1]-1),right=Math.min(box[0]+box[2],npc[0]+npc[2]+1),bottom=Math.min(box[1]+box[3],npc[1]+npc[3]+1);
            g.drawImage(a.image,...clean.map(n=>n*k),(x-box[0])*2,(y-box[1])*2,(right-x)*2,(bottom-y)*2);
          }
        }
        if(clean)g.restore();a.props[kind]=c;
      }
      const chatH=947-m.chatTop;
      const surfaces={brand:[0,0,452,118],nav:[0,116,205,m.chatTop-116],panel:[1175,296,361,650],map:[1175,0,361,296],chat:[0,m.chatTop,1175,chatH],texture:[18,645,164,39],chatTexture:[620,m.chatTop+125,235,30],button:[8,951,114,62]};
      for(const [name,box]of Object.entries(surfaces))a.ui[name]=sample(a.image,box).toDataURL('image/png');
      a.ready=true;listeners.forEach(fn=>fn(id));applyUI(id);
    }catch(_){a.error=true;listeners.forEach(fn=>fn(id));}};
    a.image.onerror=()=>{a.error=true;listeners.forEach(fn=>fn(id));};a.image.src=a.model.source;return a;
  }
  function applyUI(id){
    if(typeof PresentationThemes==='undefined'||PresentationThemes.get()!==id||typeof document==='undefined'||!document.body)return;
    const a=load(id);if(!a?.ready)return;
    for(const [name,url]of Object.entries(a.ui))document.body.style.setProperty('--station-art-'+name,'url("'+url+'")');
    document.body.style.setProperty('--station-art-source','url("'+a.model.source+'")');
    document.body.style.setProperty('--station-art-chat-height',String(a.model.chatTop===729?213:179)+'px');
    document.body.style.setProperty('--station-art-floor',a.model.palette[0]);
    document.body.style.setProperty('--station-art-frame',a.model.palette[1]);
    document.body.style.setProperty('--station-art-edge',a.model.palette[2]);
    document.body.style.setProperty('--station-art-gold',a.model.palette[3]);
  }
  return {models:Object.freeze(models),has:id=>!!models[id],load,sample,applyUI,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},ready:id=>!!cache.get(id)?.ready};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StationArt;
