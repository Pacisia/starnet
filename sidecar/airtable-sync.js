'use strict';
/* Airtable mirror for the Pacisia fork (added 2026-09-28).
   Watches the sidecar event stream (hooked in wrapEmitDiag in index.js) and mirrors
   agent status + finished runs into two Airtable tables so a claude.ai dashboard can
   read StarNet from anywhere:
     StarNet Agents (one row per agentId, upserted every FLUSH_MS)
     StarNet Runs   (one row per finished run, upserted on Run ID)
   Status and cost only. No transcripts, tool args, tokens-as-text or secrets are sent.
   Off unless STARNET_AIRTABLE_TOKEN (or AIRTABLE_TOKEN) is set. Fail-open: any error is
   logged once per minute and never touches the agent loop. */

const https = require('https');
const os = require('os');

function readTokenFile() {
  // Desktop app launched from the Dock doesn't inherit shell variables, so also accept a private file.
  try { return require('fs').readFileSync(require('path').join(os.homedir(), '.starnet-airtable-token'), 'utf8').trim(); } catch (_) { return ''; }
}
const TOKEN = process.env.STARNET_AIRTABLE_TOKEN || process.env.AIRTABLE_TOKEN || readTokenFile();
const BASE = process.env.STARNET_AIRTABLE_BASE || 'appzAlEvhohmE2rbA';
const AGENTS_TABLE = process.env.STARNET_AIRTABLE_AGENTS || 'tblQlVnACbyLJYhUA';
const RUNS_TABLE = process.env.STARNET_AIRTABLE_RUNS || 'tbliDOg976JAnnRY3';
const FLUSH_MS = Math.max(10000, Number(process.env.STARNET_AIRTABLE_FLUSH_MS) || 30000);
const HOST = (os.hostname() || 'mac').slice(0, 60);
const TASK_ID_RE = /\b(?:PAC|RBL|NEW|SPR|SYS|BDR|S100)-[A-Z0-9]+(?:-[A-Z0-9]+)?\b/;

const clip = (s, n) => (s == null ? '' : String(s)).slice(0, n);
const sydneyDay = (t) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' });

function createSync(opts = {}) {
  const token = opts.token !== undefined ? opts.token : TOKEN;
  const request = opts.request || airtableRequest;
  const now = opts.now || Date.now;
  const agents = new Map();   // agentId -> state
  const runs = new Map();     // runId -> in-flight run
  const doneRuns = [];        // finished runs waiting to be written
  const dirty = new Set();
  let lastErrLog = 0;

  function agent(id) {
    let a = agents.get(id);
    const day = sydneyDay(now());
    if (!a) { a = { id, state: 'idle', runId: '', task: '', model: '', tool: '', runs: 0, usd: 0, tokens: 0, approval: '', error: '', day, seen: now() }; agents.set(id, a); }
    if (a.day !== day) { a.day = day; a.runs = 0; a.usd = 0; a.tokens = 0; }
    a.seen = now();
    dirty.add(id);
    return a;
  }

  function observe(name, p) {
    if (!token || !p || typeof p !== 'object') return;
    try {
      const id = p.agentId;
      switch (name) {
        case 'agent.run.start': {
          const a = agent(id);
          a.state = 'running'; a.runId = p.runId; a.model = clip(p.model, 80); a.error = ''; a.task = '';
          runs.set(p.runId, { runId: p.runId, agentId: id, trigger: p.trigger, model: a.model, objective: '', tools: 0, tokens: 0, started: now(), error: '' });
          break;
        }
        case 'taskbrief.settled': {
          const a = agent(id); a.task = clip(p.objective, 500);
          const r = runs.get(p.runId); if (r) r.objective = clip(p.objective, 2000);
          break;
        }
        case 'agent.tool_call': {
          const a = agent(id); a.tool = clip(p.name, 80);
          const r = runs.get(p.runId); if (r) r.tools++;
          break;
        }
        case 'agent.cost': {
          const t = (p.tokensIn || 0) + (p.tokensOut || 0);
          const a = agent(id); a.tokens += t; a.usd += Number(p.usd) || 0;
          const r = runs.get(p.runId); if (r) r.tokens += t;
          break;
        }
        case 'permission.prompt': {
          const a = agent(id); a.state = 'waiting approval'; a.approval = clip(p.tool + ' (' + p.scope + ')', 300);
          break;
        }
        case 'permission.response': {
          for (const a of agents.values()) if (a.state === 'waiting approval') { a.state = 'running'; a.approval = ''; dirty.add(a.id); }
          break;
        }
        case 'agent.run.error': {
          const a = agent(id); a.error = clip(p.message, 500);
          const r = runs.get(p.runId); if (r) r.error = clip(p.message, 1000);
          break;
        }
        case 'agent.run.end': {
          const a = agent(id);
          a.state = p.reason === 'error' ? 'error' : 'idle';
          a.runs++; a.runId = ''; a.approval = '';
          const r = runs.get(p.runId) || { runId: p.runId, agentId: id, trigger: '', model: a.model, objective: '', tools: 0, tokens: 0, started: null, error: '' };
          runs.delete(p.runId);
          doneRuns.push(Object.assign(r, { reason: p.reason, turns: p.turns, usd: p.usd, finished: now() }));
          break;
        }
        default: break;
      }
    } catch (e) { logErr(e); }
  }

  function logErr(e) {
    const t = now();
    if (t - lastErrLog > 60000) { lastErrLog = t; console.warn('[airtable-sync]', e && e.message ? e.message : e); }
  }

  async function upsert(table, mergeField, records) {
    for (let i = 0; i < records.length; i += 10) {
      const res = await request('PATCH', `/v0/${BASE}/${table}`, token, {
        performUpsert: { fieldsToMergeOn: [mergeField] }, typecast: true, records: records.slice(i, i + 10)
      });
      if (!res || res.status < 200 || res.status >= 300) throw new Error('Airtable ' + (res && res.status) + ' on ' + table);
    }
  }

  async function flush() {
    if (!token) return;
    const iso = (t) => (t ? new Date(t).toISOString() : null);
    const agentRows = [...dirty].map(id => agents.get(id)).filter(Boolean).map(a => ({ fields: {
      'Agent ID': a.id, 'State': a.state, 'Current Run ID': a.runId, 'Current Task': a.task, 'Model': a.model,
      'Last Tool': a.tool, 'Runs Today': a.runs, 'USD Today': Math.round(a.usd * 10000) / 10000, 'Tokens Today': a.tokens,
      'Pending Approval': a.approval, 'Last Error': a.error, 'Last Seen': iso(a.seen), 'Host': HOST
    } }));
    const runBatch = doneRuns.splice(0, doneRuns.length);
    const runRows = runBatch.map(r => { const m = TASK_ID_RE.exec(r.objective || ''); return { fields: {
      'Run ID': r.runId, 'Agent ID': r.agentId, 'Trigger': r.trigger || '', 'Model': r.model || '', 'Objective': r.objective,
      'Outcome': r.reason, 'Turns': r.turns || 0, 'Tool Calls': r.tools, 'USD': Number(r.usd) || 0, 'Tokens': r.tokens,
      'Started': iso(r.started), 'Finished': iso(r.finished), 'Error': r.error, 'Pacisia Task ID': m ? m[0] : ''
    } }; });
    dirty.clear();
    try {
      if (agentRows.length) await upsert(AGENTS_TABLE, 'Agent ID', agentRows);
      if (runRows.length) await upsert(RUNS_TABLE, 'Run ID', runRows);
    } catch (e) {
      doneRuns.unshift(...runBatch.slice(0, 200));   // retry runs next flush; agents re-mark on next event
      for (const r of agentRows) dirty.add(r.fields['Agent ID']);
      logErr(e);
    }
  }

  let timer = null;
  function start() {
    if (!token || timer) return false;
    timer = setInterval(() => { flush(); }, FLUSH_MS);
    if (timer.unref) timer.unref();
    console.log('[airtable-sync] on: mirroring agents/runs to Airtable every ' + FLUSH_MS / 1000 + 's');
    return true;
  }

  return { observe, flush, start, _state: { agents, runs, doneRuns } };
}

function airtableRequest(method, path, token, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({ hostname: 'api.airtable.com', path, method, timeout: 20000,
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) }
    }, (res) => { let out = ''; res.on('data', d => { out += d; }); res.on('end', () => resolve({ status: res.statusCode, body: out })); });
    req.on('error', () => resolve({ status: 0 }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0 }); });
    if (data) req.write(data);
    req.end();
  });
}

const shared = createSync();
module.exports = { createSync, observe: shared.observe, start: shared.start, flush: shared.flush };
