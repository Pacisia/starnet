  // ---- LINE-UP LOOP: Airtable Agent Profiles (edited from the Console artifact) -> StarNet crew --------------
  // Every 60s: GET /api/lineup; for each Approved profile keep Slots agents named "<PROFILE>" / "<PROFILE> 2"..;
  // summon missing ones (same summonAgent the Recruitment Bay uses), pin Claude/ChatGPT account A/B, clone the
  // worker-loop routine from an existing agent of the same profile; pause routines when Slots drop or the profile
  // is Paused/Retired; remove loop-created agents when the profile is deleted or shrinks. Only touches agents it tagged.
  const lineupLog = [];
  let lineupBusy = false, lineupTimer = null;
  function lineupNote(m) { const s = new Date().toISOString() + ' ' + m; lineupLog.push(s); if (lineupLog.length > 200) lineupLog.shift(); try { console.log('[lineup]', m); } catch (_) {} }
  function lineupProvider(model) {
    const m = String(model || '').toLowerCase();
    if (/^claude|opus|sonnet|haiku/.test(m)) return 'claude-code';
    if (/^gpt|codex|o\d/.test(m)) return 'codex';
    for (const a of liveAgents()) if (a.model === model && a.provider) return a.provider;
    return null;
  }
  function lineupAgentName(profileName, n) { return (String(profileName).toUpperCase().replace(/\s+/g, ' ').trim() + (n > 1 ? ' ' + n : '')).slice(0, 18); }
  async function lineupTick() {
    if (lineupBusy || !agent) return;
    lineupBusy = true;
    try {
      const r = await Harness.apiFetch('/api/lineup');
      const L = await r.json();
      if (!L || !L.ok) { lineupNote('lineup unavailable: ' + ((L && L.error) || r.status)); return; }
      const profiles = L.profiles || [];
      const known = new Set(profiles.map(p => lineupAgentName(p.name, 1)));
      const cronRes = await Harness.api.get('/api/cron');
      const jobs = (cronRes && cronRes.jobs) || [];
      const jobsFor = id => jobs.filter(j => j && j.agentId === id);
      const pins = {};
      let pinsChanged = false;
      // 1) profiles -> agents
      for (const p of profiles) {
        const base = lineupAgentName(p.name, 1);
        const want = (p.status === 'Approved') ? Math.max(0, parseInt(p.slots, 10) || 0) : 0;
        const mine = liveAgents().filter(a => a.lineup && a.lineup.profile === base).sort((x, y) => (x.lineup.n || 1) - (y.lineup.n || 1));
        // create missing slots
        for (let n = 1; n <= want; n++) {
          if (mine.some(a => (a.lineup.n || 1) === n)) continue;
          const provider = lineupProvider(p.model);
          const spec = { agentName: lineupAgentName(p.name, n), name: p.name, purpose: p.role || ('Line-up agent: ' + p.name),
            modelPin: { model: p.model || undefined, provider: provider || undefined, effort: (p.effort || '').toLowerCase() || undefined } };
          let a = null;
          try { a = summonAgent(spec, { activate: false, desk: true }); } catch (e) { lineupNote('summon failed ' + spec.agentName + ': ' + e.message); }
          if (!a) continue;
          a.lineup = { profile: base, n, worker: p.worker || '', rec: p.rec };
          mine.push(a);
          lineupNote('summoned ' + a.name + ' (' + (p.model || 'default') + ')');
          try { persist(); } catch (_) {}
        }
        // account pin
        const acc = /\b([AB])\s*$/i.exec(p.account || '');
        for (const a of mine) if (acc) { pins[a.id] = acc[1].toUpperCase(); pinsChanged = true; }
        // routines: clone from a sibling/template if a slot has none
        const tpl = (mine.map(a => jobsFor(a.id)[0]).find(Boolean)) ||
          jobs.find(j => j && j.agentId && /^Pacisia worker loop/i.test(j.name || '') && (liveAgents().find(a => a.id === j.agentId) || {}).model === p.model);
        for (let i = 0; i < mine.length; i++) {
          const a = mine[i];
          const active = (p.status === 'Approved') && (a.lineup.n || 1) <= want;
          const js = jobsFor(a.id);
          if (active && !js.length && tpl) {
            try {
              const body = { name: 'Pacisia worker loop: ' + a.id, prompt: tpl.prompt, schedule: (tpl.schedule && tpl.schedule.kind === 'interval' && tpl.schedule.minutes ? 'every ' + tpl.schedule.minutes + 'm' : 'every 5m'),
                agentId: a.id, provider: tpl.provider, model: tpl.model, deliver: tpl.deliver, workdir: tpl.workdir, enabled: true };
              const rr = await Harness.api.post('/api/cron', body);
              lineupNote('routine for ' + a.name + ': ' + (rr.ok ? 'created' : (rr.j && rr.j.error) || 'refused'));
            } catch (e) { lineupNote('routine failed ' + a.name + ': ' + e.message); }
          }
          for (const j of js) {
            if (active && j.enabled === false) { await Harness.api.post('/api/cron/update', { id: j.id, patch: { enabled: true } }).catch(() => {}); lineupNote('resumed ' + a.name); }
            if (!active && j.enabled !== false) { await Harness.api.post('/api/cron/update', { id: j.id, patch: { enabled: false } }).catch(() => {}); lineupNote('paused ' + a.name); }
          }
        }
        // slots dropped below existing loop-created agents beyond want: routines already paused above
      }
      // 2) loop-created agents whose profile no longer exists -> remove
      for (const a of liveAgents().filter(x => x.lineup && !known.has(x.lineup.profile))) {
        for (const j of jobsFor(a.id)) await Harness.api.post('/api/cron/remove', { id: j.id }).catch(() => {});
        try { await Harness.api.post('/api/agent/delete', { agentId: a.id }); lineupNote('removed ' + a.name); } catch (e) { lineupNote('remove failed ' + a.name); }
        try { agents.delete(a.id); if (typeof StationUI !== 'undefined' && StationUI.setRoster) StationUI.setRoster(liveAgents()); persist(); } catch (_) {}
      }
      // 3) account pins (merge with current server pins so manual pins on other agents are kept)
      if (pinsChanged) {
        try {
          await Harness.api.post('/api/accounts/pins', { pins });
          lineupNote('account pins set');
        } catch (e) { lineupNote('pins failed: ' + e.message); }
      }
    } catch (e) { lineupNote('tick error: ' + (e && e.message)); }
    finally { lineupBusy = false; }
  }
  function startLineupLoop() {
    if (lineupTimer) return;
    lineupTimer = setInterval(lineupTick, 60000);
    setTimeout(lineupTick, 8000);
    window.__lineupLog = lineupLog; window.__lineupTick = lineupTick;
  }

