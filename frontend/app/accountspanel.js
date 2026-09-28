/* frontend/app/accountspanel.js — Dylan's fork: Settings ▸ ACCOUNTS.
   Shows the two Claude Code logins and the two ChatGPT sign-ins, which accounts are cooling after a usage
   limit, and recent automatic switches. Reads GET /api/accounts (booleans/timestamps only — never a credential).
   ChatGPT account B signs in through the same device-code engine as account A (OAuthSignIn.for('codex-b')).
   Claude account B is a second `claude` login done once in Terminal; this panel shows the exact command. */
'use strict';
const AccountsPanel = (function () {
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function openExternal(url) {
    if (!url) return;
    try {
      const invoke = window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke;
      if (invoke) { invoke('open_external_url', { url }).catch(() => { try { window.open(url, '_blank', 'noopener'); } catch (_) {} }); return; }
    } catch (_) {}
    try { window.open(url, '_blank', 'noopener'); } catch (_) {}
  }
  function when(ms) {
    if (!ms) return '';
    const mins = Math.max(0, Math.round((ms - Date.now()) / 60000));
    return mins >= 60 ? Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm' : mins + 'm';
  }
  function dot(ok) { return '<span class="conn-dot" style="background:' + (ok ? '#3fb950' : '#6e7681') + '"></span>'; }
  function routingLine(list) {
    return (list || []).map(r => 'account ' + esc(r.account) + ': ' + r.agents + ' agent' + (r.agents === 1 ? '' : 's') +
      (r.coolingUntil ? ' · <b>resting ' + when(r.coolingUntil) + '</b> (hit its limit)' : '')).join(' &nbsp;|&nbsp; ');
  }
  function usageLine(d, provider, acct) {
    const u = (d.usage || []).find(x => x.provider === provider && x.account === acct);
    if (!u || (!u.short && !u.weekly)) return '<div class="key-meta dim">&nbsp;&nbsp;usage: no reading yet (appears after its first run' + (provider === 'codex' ? ' or within 5 min' : '') + ')</div>';
    const bar = (w, label) => {
      if (!w) return '';
      const p = Math.round((w.used || 0) * 100);
      const col = p >= 90 ? '#f85149' : p >= 70 ? '#d29922' : '#3fb950';
      return label + ' <b style="color:' + col + '">' + p + '%</b>' + (w.resetsAt ? ' (resets ' + when(w.resetsAt) + ')' : '');
    };
    return '<div class="key-meta">&nbsp;&nbsp;' + [bar(u.short, (u.short && u.short.label) || 'short window'), bar(u.weekly, 'weekly')].filter(Boolean).join(' · ') +
      (u.plan ? ' · plan ' + esc(u.plan) : '') + '</div>';
  }
  function render(el, d) {
    const c = d.claude || {}, g = d.chatgpt || {};
    const sw = (d.switches || []).slice(-5).reverse().map(s =>
      '<li>' + esc(new Date(s.at).toLocaleTimeString()) + ' · ' + esc(s.provider === 'codex' ? 'ChatGPT' : 'Claude') +
      ' · ' + esc(s.agentId) + ' moved ' + esc(s.from) + ' → ' + esc(s.to) + '</li>').join('');
    el.innerHTML =
      '<div class="acct-wrap" style="display:grid;gap:14px">' +
      '<p class="dim">Agents stick to one account and move to the other on their next run when an account hits its usage limit. Nothing switches mid-task.</p>' +
      // Claude
      '<div class="key-row"><div class="key-main">' +
        '<div class="key-top"><span class="key-prov">CLAUDE CODE</span></div>' +
        '<div class="key-meta">' + dot(c.A && c.A.connected) + ' Account A (your normal <code>claude</code> login) — ' + (c.A && c.A.connected ? 'signed in' : 'not signed in') + '</div>' + usageLine(d, 'claude-code', 'A') +
        '<div class="key-meta">' + dot(c.B && c.B.connected) + ' Account B — ' +
          (c.B && c.B.connected ? 'signed in' : (c.B && c.B.setUp ? 'folder found, not signed in' : 'not set up')) + '</div>' + usageLine(d, 'claude-code', 'B') +
        (c.B && c.B.connected ? '' :
          '<div class="key-meta dim">To add account B, run this once in Terminal, then type <code>/login</code> and sign in with the second Claude account:<br>' +
          '<code class="key-mask" id="acct-cc-cmd">' + esc((c.B && c.B.signInCommand) || 'CLAUDE_CONFIG_DIR=~/.claude-b claude') + '</code> ' +
          '<button class="bb sm" data-acct="cc-copy">COPY</button></div>') +
        '<div class="key-meta">' + routingLine(c.routing) + '</div>' +
      '</div></div>' +
      // ChatGPT
      '<div class="key-row"><div class="key-main">' +
        '<div class="key-top"><span class="key-prov">CHATGPT (CODEX)</span></div>' +
        '<div class="key-meta">' + dot(g.A && g.A.connected) + ' Account A — ' + (g.A && g.A.connected ? 'signed in' : 'not signed in (use PROVIDERS)') + '</div>' + usageLine(d, 'codex', 'A') +
        '<div class="key-meta">' + dot(g.B && g.B.connected) + ' Account B — ' + (g.B && g.B.connected ? 'signed in' : 'not signed in') + ' ' +
          (g.B && g.B.connected
            ? '<button class="bb sm danger" data-acct="gb-logout">✕ DISCONNECT B</button>'
            : '<button class="bb sm" data-acct="gb-signin">SIGN IN ACCOUNT B</button>') + '</div>' + usageLine(d, 'codex', 'B') +
        '<div class="key-edit" id="acct-gb-box" hidden><span class="dim" id="acct-gb-status"></span> <code class="key-mask" id="acct-gb-code" hidden></code> <button class="bb sm" id="acct-gb-open" hidden>↗ OPEN PAGE</button></div>' +
        '<div class="key-meta">' + routingLine(g.routing) + '</div>' +
      '</div></div>' +
      pinsHtml(d) +
      '<div><div class="key-prov">RECENT SWITCHES</div>' + (sw ? '<ul class="dim">' + sw + '</ul>' : '<p class="dim">none yet</p>') + '</div>' +
      '<button class="bb sm" data-acct="refresh">↻ RECHECK</button>' +
      '</div>';
    wire(el);
  }
  function pinsHtml(d) {
    const agents = d.agents || [], pins = d.pins || {};
    if (!agents.length) return '';
    const counts = { A: 0, B: 0, auto: 0 };
    agents.forEach(a => { counts[pins[a.agentId] || 'auto']++; });
    const rows = agents.map(a => {
      const v = pins[a.agentId] || '';
      const opt = (val, label) => '<option value="' + val + '"' + (v === val ? ' selected' : '') + '>' + label + '</option>';
      return '<tr><td>' + esc(a.name) + '</td><td class="dim">' + esc(a.provider === 'codex' ? 'ChatGPT' : 'Claude') + '</td>' +
        '<td><select data-pin="' + esc(a.agentId) + '">' + opt('', 'auto') + opt('A', 'A') + opt('B', 'B') + '</select></td></tr>';
    }).join('');
    return '<div><div class="key-prov">WHICH ACCOUNT EACH AGENT USES</div>' +
      '<p class="dim">Pinned agents use their account and only borrow the other while theirs is resting. ' +
      'Now: ' + counts.A + ' on A, ' + counts.B + ' on B, ' + counts.auto + ' automatic.</p>' +
      '<table class="dim" style="width:100%">' + rows + '</table>' +
      '<button class="bb sm" data-acct="pins-save">SAVE</button> <span class="dim" id="acct-pins-msg"></span></div>';
  }
  function wire(el) {
    el.querySelectorAll('[data-acct]').forEach(b => b.addEventListener('click', ev => {
      ev.stopPropagation();
      const act = b.dataset.acct;
      if (act === 'refresh') return load(el, true);
      if (act === 'pins-save') {
        const pins = {};
        el.querySelectorAll('select[data-pin]').forEach(s => { pins[s.dataset.pin] = s.value; });
        const msg = el.querySelector('#acct-pins-msg');
        fetch('/api/accounts/pins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pins }) })
          .then(r => r.ok ? load(el, false) : (msg && (msg.textContent = 'could not save')))
          .catch(() => { if (msg) msg.textContent = 'could not save'; });
        return;
      }
      if (act === 'cc-copy') {
        const t = (el.querySelector('#acct-cc-cmd') || {}).textContent || '';
        try { navigator.clipboard.writeText(t); b.textContent = 'COPIED'; } catch (_) {}
        return;
      }
      if (act === 'gb-logout') {
        fetch('/api/auth/codex-b/logout', { method: 'POST' }).finally(() => load(el, true));
        return;
      }
      if (act === 'gb-signin') {
        if (typeof OAuthSignIn === 'undefined') return;
        const box = el.querySelector('#acct-gb-box'), st = el.querySelector('#acct-gb-status');
        const code = el.querySelector('#acct-gb-code'), open = el.querySelector('#acct-gb-open');
        if (box) box.hidden = false;
        OAuthSignIn.for('codex-b').start({
          onRequesting: () => { if (st) st.textContent = 'requesting a sign-in code…'; },
          onError: msg => { if (st) st.textContent = msg; },
          onTimeout: () => { if (st) st.textContent = 'sign-in timed out — try again'; },
          onCode: c => {
            if (code) { code.textContent = c.user_code; code.hidden = false; }
            if (st) st.innerHTML = 'sign in with your <b>second</b> ChatGPT account and enter this code at <b>' + esc(c.verification_uri) + '</b>';
            if (open) { open.hidden = false; open.onclick = () => openExternal(c.open_uri || c.verification_uri); }
            openExternal(c.open_uri || c.verification_uri);
          },
          onConnected: () => load(el, true)
        });
      }
    }));
  }
  function load(el, force) {
    el.innerHTML = '<span class="dim">checking accounts…</span>';
    return fetch('/api/accounts' + (force ? '?refresh=1' : ''), { cache: 'no-store' })
      .then(r => r.json()).then(d => render(el, d))
      .catch(() => { el.innerHTML = '<span class="dim">accounts unavailable — is the StarNet sidecar running?</span>'; });
  }
  return { mount: el => load(el, false) };
})();
if (typeof window !== 'undefined') window.AccountsPanel = AccountsPanel;
