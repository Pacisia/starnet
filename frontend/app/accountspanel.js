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
        '<div class="key-meta">' + dot(c.A && c.A.connected) + ' Account A (your normal <code>claude</code> login) — ' + (c.A && c.A.connected ? 'signed in' : 'not signed in') + '</div>' +
        '<div class="key-meta">' + dot(c.B && c.B.connected) + ' Account B — ' +
          (c.B && c.B.connected ? 'signed in' : (c.B && c.B.setUp ? 'folder found, not signed in' : 'not set up')) + '</div>' +
        (c.B && c.B.connected ? '' :
          '<div class="key-meta dim">To add account B, run this once in Terminal, then type <code>/login</code> and sign in with the second Claude account:<br>' +
          '<code class="key-mask" id="acct-cc-cmd">' + esc((c.B && c.B.signInCommand) || 'CLAUDE_CONFIG_DIR=~/.claude-b claude') + '</code> ' +
          '<button class="bb sm" data-acct="cc-copy">COPY</button></div>') +
        '<div class="key-meta">' + routingLine(c.routing) + '</div>' +
      '</div></div>' +
      // ChatGPT
      '<div class="key-row"><div class="key-main">' +
        '<div class="key-top"><span class="key-prov">CHATGPT (CODEX)</span></div>' +
        '<div class="key-meta">' + dot(g.A && g.A.connected) + ' Account A — ' + (g.A && g.A.connected ? 'signed in' : 'not signed in (use PROVIDERS)') + '</div>' +
        '<div class="key-meta">' + dot(g.B && g.B.connected) + ' Account B — ' + (g.B && g.B.connected ? 'signed in' : 'not signed in') + ' ' +
          (g.B && g.B.connected
            ? '<button class="bb sm danger" data-acct="gb-logout">✕ DISCONNECT B</button>'
            : '<button class="bb sm" data-acct="gb-signin">SIGN IN ACCOUNT B</button>') + '</div>' +
        '<div class="key-edit" id="acct-gb-box" hidden><span class="dim" id="acct-gb-status"></span> <code class="key-mask" id="acct-gb-code" hidden></code> <button class="bb sm" id="acct-gb-open" hidden>↗ OPEN PAGE</button></div>' +
        '<div class="key-meta">' + routingLine(g.routing) + '</div>' +
      '</div></div>' +
      '<div><div class="key-prov">RECENT SWITCHES</div>' + (sw ? '<ul class="dim">' + sw + '</ul>' : '<p class="dim">none yet</p>') + '</div>' +
      '<button class="bb sm" data-acct="refresh">↻ RECHECK</button>' +
      '</div>';
    wire(el);
  }
  function wire(el) {
    el.querySelectorAll('[data-acct]').forEach(b => b.addEventListener('click', ev => {
      ev.stopPropagation();
      const act = b.dataset.acct;
      if (act === 'refresh') return load(el, true);
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
