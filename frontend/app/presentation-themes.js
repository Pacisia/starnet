/* Presentation preferences only. Never part of a station save, roster or capability grant. */
'use strict';
const PresentationThemes = (() => {
  const KEY = 'starnet.presentation.v1';
  const catalog = Object.freeze([
    Object.freeze({ id: 'original', name: 'Original StarNet', mark: '◆', description: 'The original living space station.', colors: ['#121b20', '#ffc660', '#40566d'] }),
    Object.freeze({ id: 'osrs', name: 'OSRS Guild', mark: '✦', description: 'Stone halls, timber consoles and a crew of fantasy NPCs.', colors: ['#38362c', '#e8c76e', '#cbbb92'] }),
    Object.freeze({ id: 'space-colony', name: 'Space Colony', mark: '◈', description: 'Worn hull plating, astronaut crew and a planet-side viewport.', colors: ['#131920', '#eab84c', '#45505a'], preview: 'assets/station-styles/space-colony/reference.png' }),
    Object.freeze({ id: 'cyberpunk', name: 'Cyberpunk Workshop', mark: '⌁', description: 'Neon machinery, night-city windows and a specialist workshop crew.', colors: ['#061017', '#58d8e9', '#26343d'], preview: 'assets/station-styles/cyberpunk/reference.png' }),
    Object.freeze({ id: 'starship-bridge', name: 'Starship Bridge', mark: '✧', description: 'Ivory hulls, tailored uniforms and a refined deep-space command deck.', colors: ['#08141f', '#ecc66c', '#243949'], preview: 'assets/station-styles/starship-bridge/reference.png' }),
    Object.freeze({ id: 'steampunk-airship', name: 'Steampunk Airship', mark: '⚙', description: 'Brass instruments, timber decking and a Victorian airship crew.', colors: ['#100e0b', '#eed07c', '#433322'], preview: 'assets/station-styles/steampunk-airship/reference.png' }),
    Object.freeze({ id: 'secret-agent-hq', name: 'Secret-Agent HQ', mark: '◉', description: 'A concrete bunker, green CRT desks, archives and suited operatives.', colors: ['#100f0b', '#e0be59', '#2e2d25'], preview: 'assets/station-styles/secret-agent-hq/reference.png' }),
    Object.freeze({ id: 'holographic', name: 'Holographic Command', mark: '◇', description: 'A blue light command deck with wireframe floors and projected crew.', colors: ['#061824', '#98eeff', '#33778f'] })
  ]);
  let active = 'original';
  const listeners = new Set();
  const valid = id => catalog.some(t => t.id === id);
  function read(storage) {
    try { const v = JSON.parse(storage.getItem(KEY)); return v && valid(v.theme) ? v.theme : 'original'; }
    catch (_) { return 'original'; }
  }
  function apply() {
    if (typeof document !== 'undefined' && document.body) {
      document.body.dataset.stationTheme = active;
      document.body.dataset.stationArt = catalog.find(t => t.id === active)?.preview ? 'openart' : 'legacy';
    }
  }
  function set(id, options) {
    if (!valid(id)) return false;
    active = id; apply();
    if (!(options && options.persist === false)) {
      try { localStorage.setItem(KEY, JSON.stringify({ v: 1, theme: id })); } catch (_) {}
    }
    listeners.forEach(fn => fn(id));
    return true;
  }
  function init(storage) {
    active = read(storage); apply(); return active;
  }
  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  function settingsHTML() {
    return '<h4 class="ms-h">STATION UI</h4><p class="set-about">Change the station art and interface instantly. Your agents, tools and work stay in the same station.</p>' +
      '<div class="station-theme-cards" role="group" aria-label="Station UI style">' + catalog.map(t =>
        '<button type="button" class="station-theme-card" data-station-theme="' + t.id + '" aria-pressed="' + (t.id === active) + '">' +
        '<span class="station-theme-sample' + (t.preview ? ' station-theme-art-sample' : '') + '" style="--sample-bg:' + t.colors[0] + ';--sample-accent:' + t.colors[1] + ';--sample-second:' + t.colors[2] + (t.preview ? ';background-image:url(\'' + t.preview + '\')' : '') + '"><i></i><b>' + t.mark + '</b></span>' +
        '<strong>' + t.name + '</strong><small>' + t.description + '</small></button>').join('') + '</div>';
  }
  if (typeof document !== 'undefined') {
    try { init(localStorage); } catch (_) { apply(); }
    // Other windows on this origin may share the preference; storage changes never write back.
    if (typeof window !== 'undefined') window.addEventListener('storage', ev => {
      if (ev.key === KEY || ev.key === null) { try { set(read(localStorage), { persist: false }); } catch (_) {} }
    });
  }
  return { KEY, catalog, valid, read, init, get: () => active, set, subscribe, settingsHTML };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = PresentationThemes;
