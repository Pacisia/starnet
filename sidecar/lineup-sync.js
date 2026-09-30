/* Pacisia line-up: read the Agent Profiles table from Airtable (written by the Console artifact) and hand the
   desired crew to the app window, which does the summoning. Read-only against Airtable. Uses the same token
   file / env as airtable-sync.js. GET /api/lineup returns { ok, profiles:[...] } or { ok:false, error }. */
const https = require('https'); const os = require('os'); const path = require('path'); const fs = require('fs');
function token() {
  const e = process.env.STARNET_AIRTABLE_TOKEN || process.env.AIRTABLE_TOKEN; if (e) return e;
  try { return fs.readFileSync(path.join(os.homedir(), '.starnet-airtable-token'), 'utf8').trim(); } catch (_) { return ''; }
}
const BASE = process.env.STARNET_AIRTABLE_BASE || 'appzAlEvhohmE2rbA';
const PROFILES = process.env.STARNET_AIRTABLE_PROFILES || 'tblQQkY6HsViytODz';
const F = { name: 'fldF4GrepHttdH50j', status: 'fldG0NGkUWfdaND9K', role: 'fldjgdXdOPQNzDmWc', model: 'fldfBnQp2pO4MiIwS', effort: 'fldm64q8r6lI0l8To', worker: 'fldfb7KDyw7aCpm0d', slots: 'fldZf38Of6oIkNdlP', account: 'fldrO4dAvfADRpv8j', note: 'fldxE5joQdcFF99nS' };
function get(t, p) {
  return new Promise(resolve => {
    const req = https.request({ hostname: 'api.airtable.com', path: p, method: 'GET', timeout: 20000, headers: { Authorization: 'Bearer ' + t } },
      res => { let o = ''; res.on('data', d => { o += d; }); res.on('end', () => resolve({ status: res.statusCode, body: o })); });
    req.on('error', () => resolve({ status: 0 })); req.on('timeout', () => { req.destroy(); resolve({ status: 0 }); }); req.end();
  });
}
const sel = v => (v && typeof v === 'object' ? v.name : v) || '';
async function fetchLineup() {
  const t = token(); if (!t) return { ok: false, error: 'no airtable token' };
  const q = '?returnFieldsByFieldId=true&pageSize=100' + Object.values(F).map(f => '&fields%5B%5D=' + f).join('');
  const r = await get(t, '/v0/' + BASE + '/' + PROFILES + q);
  if (r.status !== 200) return { ok: false, error: 'airtable ' + r.status };
  let j; try { j = JSON.parse(r.body); } catch (_) { return { ok: false, error: 'bad json' }; }
  const profiles = (j.records || []).map(rec => { const f = rec.fields || {}; return {
    rec: rec.id, name: f[F.name] || '', status: sel(f[F.status]), role: sel(f[F.role]), model: f[F.model] || '', effort: sel(f[F.effort]),
    worker: f[F.worker] || '', slots: Number(f[F.slots]) || 0, account: sel(f[F.account]), note: f[F.note] || '' }; });
  return { ok: true, at: Date.now(), profiles };
}
module.exports = { fetchLineup };
