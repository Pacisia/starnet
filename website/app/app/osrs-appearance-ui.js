/* A native, keyboard-accessible cosmetics picker. Agent identity comes from the existing roster. */
'use strict';
const OSRSAppearanceUI = (() => {
  let dialog=null,agentId=null;
  const roster=()=>typeof App!=='undefined'?App.agents():[];
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function paint(){
    if(!dialog?.open)return;
    const agent=roster().find(a=>a.id===agentId);if(!agent)return;
    dialog.querySelectorAll('[data-osrs-look] canvas').forEach(c=>OSRSWorld.drawPortrait(c,agent,c.parentElement.dataset.osrsLook));
    if(!OSRSWorld.ready())setTimeout(paint,150);
  }
  function render(){
    const focused=document.activeElement?.closest('[data-osrs-look]')?.dataset.osrsLook;
    const agents=roster(),agent=agents.find(a=>a.id===agentId)||agents[0];if(!agent)return;
    agentId=agent.id;
    const select=dialog.querySelector('select');select.innerHTML=agents.map(a=>'<option value="'+esc(a.id)+'">'+esc(a.name)+'</option>').join('');select.value=agentId;
    dialog.querySelector('#osrs-appearance-role').textContent=StationPresentation.roleFor(agent).job;
    dialog.querySelector('.osrs-look-grid').innerHTML=OSRSAppearance.catalog.map(c=>'<button type="button" class="osrs-look-option" data-osrs-look="'+c.id+'" aria-pressed="'+(OSRSAppearance.forAgent(agentId)===c.id)+'"><canvas width="84" height="118" aria-hidden="true"></canvas><b>'+esc(c.name)+'</b><small>'+esc(c.description)+'</small></button>').join('');
    paint();
    if(focused)dialog.querySelector('[data-osrs-look="'+focused+'"]')?.focus();
  }
  function mount(){
    if(dialog)return;
    dialog=document.createElement('dialog');dialog.id='osrs-appearance';dialog.setAttribute('aria-labelledby','osrs-appearance-title');
    dialog.innerHTML='<header><div><h2 id="osrs-appearance-title">NPCs &amp; armour</h2><p>Choose a look for your station crew.</p></div><button type="button" class="osrs-appearance-close" aria-label="Close NPC appearance picker">✕</button></header><div class="osrs-appearance-agent"><label for="osrs-appearance-agent">Agent</label><select id="osrs-appearance-agent"></select><span id="osrs-appearance-role"></span></div><div class="osrs-look-grid" role="group" aria-label="NPC appearance"></div><footer>Your choice is saved on this device. Follow role restores the default character.</footer>';
    document.body.appendChild(dialog);
    dialog.querySelector('.osrs-appearance-close').addEventListener('click',()=>dialog.close());
    dialog.querySelector('select').addEventListener('change',e=>{agentId=e.target.value;render();});
    dialog.addEventListener('click',e=>{
      const button=e.target.closest('[data-osrs-look]');if(!button)return;
      if(OSRSAppearance.set(agentId,button.dataset.osrsLook)){
        dialog.querySelectorAll('[data-osrs-look]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.osrsLook===OSRSAppearance.forAgent(agentId))));
      }
    });
    OSRSAppearance.subscribe(()=>{if(dialog.open)render();});
    PresentationThemes.subscribe(id=>{if(id!=='osrs'&&dialog.open)dialog.close();});
  }
  function open(id){
    if(PresentationThemes.get()!=='osrs'||!roster().length)return false;
    mount();agentId=roster().some(a=>a.id===id)?id:roster()[0].id;render();
    if(!dialog.open)dialog.showModal();paint();return true;
  }
  if(typeof document!=='undefined')document.addEventListener('click',e=>{
    const button=e.target.closest('[data-osrs-looks]');if(button)open(button.dataset.osrsLooks);
  });
  return {open};
})();
