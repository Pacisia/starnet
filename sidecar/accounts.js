/* sidecar/accounts.js — multi-account routing for subscription providers (Claude Code, ChatGPT/Codex).

   Dylan's fork runs two sign-ins per subscription provider (account "A" = the original, "B" = the second).
   This module decides WHICH account a run uses:

     - Each agent is STICKY to one account (so a session keeps one identity and its cache).
     - New agents are spread evenly across the accounts that are signed in.
     - When an account hits its usage/rate limit it is put on cooldown; the agent's NEXT run moves to the
       other account if that one is available ("seamless switch"). Never mid-run.
     - When the cooldown ends, agents keep whatever account they are on (no ping-pong).

   Pure + deterministic: time comes from the injected clock; no I/O. It never sees credentials — only the
   account ids 'A' / 'B'. */
'use strict';

const DEFAULT_COOLDOWN_MS = 30 * 60 * 1000;   // a usage-limit hit parks the account for 30 min unless the server says otherwise
const MAX_COOLDOWN_MS = 6 * 60 * 60 * 1000;   // cap a bogus "retry after" at 6 h
const RATE_LIMIT_RE = /usage limit|rate[ _-]?limit|limit reached|too many requests|\b429\b|quota|exceeded your|out of (?:credits|usage)|try again (?:in|at|later)/i;

function isRateLimitMessage(text) { return RATE_LIMIT_RE.test(String(text || '')); }

// "try again in 2h 15m" / "resets in 45 minutes" / "retry after 120 seconds" -> ms, else 0
function retryAfterMs(text) {
  const s = String(text || '').toLowerCase();
  let ms = 0;
  const h = /(\d+)\s*h(?:ours?|rs?)?\b/.exec(s); if (h) ms += (+h[1]) * 3600000;
  const m = /(\d+)\s*m(?:in(?:ute)?s?)?\b/.exec(s); if (m) ms += (+m[1]) * 60000;
  const sec = /(\d+)\s*s(?:ec(?:ond)?s?)?\b/.exec(s); if (sec && !h && !m) ms += (+sec[1]) * 1000;
  return ms;
}

function makeAccountRouter(opts) {
  opts = opts || {};
  const clock = opts.clock || { now: () => Date.now() };
  const cooldownMs = opts.cooldownMs > 0 ? opts.cooldownMs : DEFAULT_COOLDOWN_MS;
  const onSwitch = typeof opts.onSwitch === 'function' ? opts.onSwitch : () => {};
  const sticky = new Map();     // provider|agentId -> account id
  const cooling = new Map();    // provider|account -> ms timestamp cooling until
  const switches = [];          // recent switch events (last 50) for the dashboard

  const k = (a, b) => String(a) + '|' + String(b);
  function coolingUntil(provider, acct) {
    const t = cooling.get(k(provider, acct)) || 0;
    if (t && t <= clock.now()) { cooling.delete(k(provider, acct)); return 0; }
    return t;
  }
  function load(provider, acct) {
    let n = 0;
    for (const [key, v] of sticky) if (key.startsWith(String(provider) + '|') && v === acct) n++;
    return n;
  }

  /* available = account ids currently signed in, e.g. ['A','B'] or ['A'].
     preferred = an account the agent's profile pins (optional). Returns the account id to use now. */
  function pick(provider, agentId, available, preferred) {
    const accts = (available || []).filter(Boolean);
    if (!accts.length) return 'A';
    if (accts.length === 1) { sticky.set(k(provider, agentId), accts[0]); return accts[0]; }
    const key = k(provider, agentId);
    let cur = sticky.get(key);
    // A PINNED agent always goes home to its pinned account when that account is available and not resting.
    if (preferred && accts.indexOf(preferred) >= 0 && !coolingUntil(provider, preferred)) {
      sticky.set(key, preferred);
      return preferred;
    }
    if (!cur || accts.indexOf(cur) < 0) {
      if (preferred && accts.indexOf(preferred) >= 0 && !coolingUntil(provider, preferred)) cur = preferred;
      else {
        // least-loaded account that is not cooling; tie -> first listed (A)
        const ready = accts.filter(a => !coolingUntil(provider, a));
        const pool = ready.length ? ready : accts;
        cur = pool.slice().sort((a, b) => load(provider, a) - load(provider, b))[0];
      }
      sticky.set(key, cur);
      return cur;
    }
    if (coolingUntil(provider, cur)) {
      const other = accts.filter(a => a !== cur && !coolingUntil(provider, a))[0];
      if (other) {
        sticky.set(key, other);
        const ev = { at: clock.now(), provider: String(provider), agentId: String(agentId), from: cur, to: other };
        switches.push(ev); if (switches.length > 50) switches.shift();
        try { onSwitch(ev); } catch (_) {}
        return other;
      }
    }
    return cur;
  }

  function penalize(provider, acct, hintText) {
    const hinted = retryAfterMs(hintText);
    const ms = Math.min(MAX_COOLDOWN_MS, hinted > 0 ? hinted : cooldownMs);
    cooling.set(k(provider, acct), clock.now() + ms);
    return ms;
  }
  function clear(provider, acct) { cooling.delete(k(provider, acct)); }

  function status(provider, available) {
    return (available || []).map(a => ({
      account: a,
      coolingUntil: coolingUntil(provider, a) || null,
      agents: load(provider, a)
    }));
  }
  function recentSwitches() { return switches.slice(); }

  return { pick, penalize, clear, status, recentSwitches, coolingUntil };
}

module.exports = { makeAccountRouter, isRateLimitMessage, retryAfterMs, DEFAULT_COOLDOWN_MS };
