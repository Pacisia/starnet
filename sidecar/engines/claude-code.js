/* sidecar/engines/claude-code.js — the CLAUDE CODE ENGINE.

   Runs an agent's turn through the official, unmodified `claude` CLI (Claude Code) instead of StarNet's own
   loop. The Commander signs in ONCE with `claude login` in a terminal; StarNet never sees, stores or forwards
   the Claude subscription credential. It only spawns the binary, streams its stream-json output into the
   normal StarNet event vocabulary, and answers the CLI's permission prompts through the station's own
   consent card. That keeps the arrangement inside Anthropic's published rule ("sign in to the unmodified
   Claude Code binary with your own Claude subscription") — StarNet is a host for the CLI, not a client of the
   subscription.

   Pieces:
     · resolveClaudeBinary()     find the CLI (GUI apps on macOS do not inherit the shell PATH).
     · buildArgs()               the exact argv for one run.
     · makeStreamMapper()        stream-json line -> StarNet events + accumulated result (pure, tested).
     · startToolBridge()         a per-run loopback socket the MCP shim (claude-code-mcp.js) calls to list and
                                 run StarNet tools and to ask for permission. Guarded by a per-run secret.
     · runClaudeCodeEngine()     one run end to end; returns the runAgentLoop-shaped result.
     · makeClaudeCodeProvider()  a provider-shaped adapter (text only, no tools) so aux callers
                                 (summaries, titles, quests) that expect provider.stream() keep working.
     · makeSessionStore()        streamId -> Claude session id, so a workstream resumes its own conversation. */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const crypto = require('crypto');
const childProcess = require('child_process');
const { note: failNote } = require('../failopen.js');
// Relative milliseconds from a monotonic clock (durations and cache ages only; never wall time).
const monoMs = () => Number(process.hrtime.bigint() / 1000000n);

const ENGINE_ID = 'claude-code';
const MCP_SERVER_NAME = 'starnet';
const APPROVE_TOOL = 'approve';
const PERMISSION_TOOL = 'mcp__' + MCP_SERVER_NAME + '__' + APPROVE_TOOL;

// Model aliases the CLI resolves itself to the newest model of each family. 'default' omits --model so the
// CLI's own configured default (the one your plan/settings pick) is used.
const MODELS = [
  { id: 'default', name: 'Claude Code default', context_length: 200000, supportsTools: true, supportsReasoning: true },
  { id: 'claude-fable-5-1', name: 'Fable 5.1', context_length: 200000, supportsTools: true, supportsReasoning: true },
  { id: 'claude-opus-5-5', name: 'Opus 5.5', context_length: 200000, supportsTools: true, supportsReasoning: true },
  { id: 'sonnet', name: 'Sonnet (latest)', context_length: 200000, supportsTools: true, supportsReasoning: true },
  { id: 'haiku', name: 'Haiku (latest)', context_length: 200000, supportsTools: true, supportsReasoning: true }
];

// StarNet tools that Claude Code already does better natively. Advertising both copies makes the model pick
// between two file readers and two shells; the CLI's own versions stay, StarNet's are withheld from the bridge.
const DUPLICATE_TOOL = /^(fs|shell|terminal|code|todo|notebook|lsp)[._]|^web[._](fetch|search|request)$|^webreader[._]/;

/* ---------- binary discovery ---------- */
function listDir(dir) { try { return fs.readdirSync(dir); } catch (err) { return []; } }   // absent dir = nothing to add
function candidatePaths(env, home) {
  const out = [];
  if (env.STARNET_CLAUDE_BIN) out.push(env.STARNET_CLAUDE_BIN);
  const exe = process.platform === 'win32' ? 'claude.exe' : 'claude';
  for (const dir of String(env.PATH || '').split(path.delimiter)) if (dir) out.push(path.join(dir, exe));
  out.push(
    path.join(home, '.local', 'bin', exe),
    path.join(home, '.claude', 'local', exe),
    path.join(home, '.npm-global', 'bin', exe),
    path.join(home, '.bun', 'bin', exe),
    path.join(home, '.volta', 'bin', exe),
    path.join(home, '.asdf', 'shims', exe),
    path.join(home, 'Library', 'pnpm', exe),
    path.join(home, '.local', 'share', 'pnpm', exe),
    path.join(home, 'n', 'bin', exe),
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
    '/usr/bin/claude'
  );
  // Version managers keep one bin dir per Node version (nvm, fnm). A Mac app launched from the Dock never
  // sees the shell PATH that points into them, so look inside directly, newest version first.
  const nvm = path.join(home, '.nvm', 'versions', 'node');
  for (const v of listDir(nvm).sort().reverse()) out.push(path.join(nvm, v, 'bin', exe));
  for (const base of [path.join(home, 'Library', 'Application Support', 'fnm', 'node-versions'), path.join(home, '.local', 'share', 'fnm', 'node-versions'), path.join(home, '.fnm', 'node-versions')]) {
    for (const v of listDir(base).sort().reverse()) out.push(path.join(base, v, 'installation', 'bin', exe));
  }
  return out;
}
// Last resort: ask the Commander's own login shell where `claude` is (covers any PATH setup in .zshrc etc.).
// Run once per process and cached; a GUI app has no other way to learn the interactive shell's PATH.
let shellLookup;
function loginShellClaude(deps) {
  if (shellLookup !== undefined && !deps.noCache) return shellLookup;
  shellLookup = null;
  if (process.platform === 'win32' || deps.noShell) return shellLookup;
  try {
    const shell = (deps.env || process.env).SHELL || '/bin/zsh';
    const outp = String((deps.execFileSync || childProcess.execFileSync)(shell, ['-ilc', 'command -v claude'], { timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }) || '');
    const line = outp.split('\n').map(x => x.trim()).filter(x => x.startsWith('/')).pop();
    if (line) shellLookup = line;
  } catch (err) { failNote('claude-code.shell', err); }
  return shellLookup;
}
function resolveClaudeBinary(deps) {
  deps = deps || {};
  const env = deps.env || process.env;
  const exists = deps.exists || ((p) => { try { fs.accessSync(p, fs.constants.X_OK); return fs.statSync(p).isFile(); } catch (err) { return false; } });   // missing = not this candidate
  for (const p of candidatePaths(env, deps.home || os.homedir())) if (exists(p)) return p;
  const viaShell = loginShellClaude(deps);
  return viaShell && exists(viaShell) ? viaShell : null;
}

/* ---------- sign-in status (read-only; `claude auth status` prints JSON) ---------- */
const statusCaches = new Map();   // per CLAUDE_CONFIG_DIR ('' = the default ~/.claude login = account A)
function authStatus(deps) {
  deps = deps || {};
  const ttl = deps.ttlMs == null ? 30000 : deps.ttlMs;
  const dirKey = String(deps.configDir || '');
  const statusCache = statusCaches.get(dirKey) || null;
  if (statusCache && monoMs() - statusCache.at < ttl && !deps.force) return Promise.resolve(statusCache.value);
  const bin = deps.bin || resolveClaudeBinary(deps);
  if (!bin) return Promise.resolve({ installed: false, connected: false, bin: null, reason: 'Claude Code not found. Install it, then run `claude` in Terminal to sign in.' });
  return new Promise((resolve) => {
    (deps.execFile || childProcess.execFile)(bin, ['auth', 'status'], { timeout: 15000, env: withConfigDir(cleanEnv(process.env, bin), deps.configDir) }, (err, stdout) => {
      let j = null;
      try { j = JSON.parse(String(stdout || '').trim()); } catch (err) { failNote('claude-code.engine', err); }
      const value = j
        ? { installed: true, connected: !!j.loggedIn, authMethod: String(j.authMethod || ''), bin, reason: j.loggedIn ? '' : 'Not signed in. Run `claude` in Terminal and sign in with your Claude account.' }
        : { installed: true, connected: false, bin, reason: 'Could not read Claude Code sign-in status' + (err ? ': ' + String(err.message || err).slice(0, 200) : '') };
      statusCaches.set(dirKey, { at: monoMs(), value });
      resolve(value);
    });
  });
}

/* ---------- argv ---------- */

// StarNet's Reasoning setting -> `claude --effort`. The CLI takes low|medium|high|xhigh|max; StarNet's
// "off"/"minimal" have no CLI equivalent, so they map to the lowest real level (low). Unknown/empty = no flag,
// which leaves the CLI on its own default.
const CLI_EFFORTS = { off: 'low', none: 'low', minimal: 'low', low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max' };
function cliEffort(v) {
  const k = String(v || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  return CLI_EFFORTS[k] || null;
}

function buildArgs(o) {
  const a = ['-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages'];
  if (o.model && o.model !== 'default') a.push('--model', o.model);
  const effort = cliEffort(o.reasoningEffort);
  if (effort) a.push('--effort', effort);
  if (o.systemFile) a.push('--append-system-prompt-file', o.systemFile);
  if (o.mcpConfigFile) a.push('--mcp-config', o.mcpConfigFile);
  if (o.permissionTool) a.push('--permission-prompt-tool', o.permissionTool);
  if (o.permissionMode) a.push('--permission-mode', o.permissionMode);
  if (o.textOnly) a.push('--tools', '');
  if (o.resumeId) a.push('--resume', o.resumeId);
  else if (o.sessionId) a.push('--session-id', o.sessionId);
  if (o.noPersist) a.push('--no-session-persistence');
  for (const d of (o.addDirs || [])) if (d) a.push('--add-dir', d);
  return a;
}

/* ---------- stream-json -> StarNet events ---------- */
function summarizeArgs(input) {
  let s = '';
  try { s = typeof input === 'string' ? input : JSON.stringify(input); } catch (_) { s = ''; }
  return s.length > 160 ? s.slice(0, 157) + '…' : s;
}
function textOfToolResult(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(c => (c && c.type === 'text') ? c.text : (c && c.type ? '[' + c.type + ']' : '')).join('\n');
  return '';
}
function shortToolName(name) {
  const m = /^mcp__starnet__(.+)$/.exec(String(name || ''));
  return m ? m[1] : String(name || 'tool');
}

function makeStreamMapper(o) {
  const emit = o.emit, agentId = o.agentId, runId = o.runId;
  const now = o.now || monoMs;
  const st = {
    text: '', turnText: '', turns: 0, sessionId: null, result: null, model: null,
    toolStarts: new Map(), reasoningOn: false, sawPartialText: false, errorText: ''
  };
  function reasoning(on) {
    if (st.reasoningOn === on) return;
    st.reasoningOn = on;
    emit('agent.reasoning', { agentId, runId, on });
  }
  function token(delta) {
    if (!delta) return;
    reasoning(false);
    st.text += delta; st.turnText += delta;
    emit('agent.token', { agentId, runId, delta });
  }
  function line(raw) {
    const s = String(raw || '').trim();
    if (!s || s[0] !== '{') return;
    let e; try { e = JSON.parse(s); } catch (_) { return; }
    if (e.session_id && !st.sessionId) st.sessionId = e.session_id;
    switch (e.type) {
      case 'system':
        if (e.subtype === 'init' && e.model) st.model = e.model;
        return;
      case 'stream_event': {
        const ev = e.event || {};
        if (ev.type === 'message_start') {
          st.turns++; st.turnText = ''; st.sawPartialText = false;
          // CONTEXT FIX: the CLI's final result.usage is the SUM of every turn in the run, not what the model
          // held. The UI calibrates its context gauge from the run's FIRST cost event, so report the first
          // turn's real prompt size here (contextOnly: excluded from token totals, never double-counted).
          const mu = ev.message && ev.message.usage;
          if (mu) {
            const turnIn = (mu.input_tokens || 0) + (mu.cache_read_input_tokens || 0) + (mu.cache_creation_input_tokens || 0);
            st.lastTurnIn = turnIn;
            if (st.turns === 1 && turnIn > 0 && emit) emit('agent.cost', { agentId, runId, usd: 0, reconciled: false, contextOnly: true, model: st.model || undefined, tokensIn: turnIn, tokensOut: 0, reasoningTokens: 0, cachedTokens: mu.cache_read_input_tokens || 0 });
          }
        }
        else if (ev.type === 'content_block_start' && ev.content_block && ev.content_block.type === 'thinking') reasoning(true);
        else if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') { st.sawPartialText = true; token(ev.delta.text); }
        return;
      }
      case 'assistant': {
        const content = (e.message && e.message.content) || [];
        for (const c of content) {
          if (!c) continue;
          if (c.type === 'text' && !st.sawPartialText) token(c.text);   // no partials (older CLI): take the whole block
          else if (c.type === 'tool_use') {
            reasoning(false);
            st.toolStarts.set(c.id, now());
            emit('agent.tool_call', { agentId, runId, callId: String(c.id), name: shortToolName(c.name), argsSummary: summarizeArgs(c.input) });
          }
        }
        return;
      }
      case 'user': {
        const content = (e.message && e.message.content) || [];
        for (const c of content) {
          if (!c || c.type !== 'tool_result') continue;
          const t0 = st.toolStarts.get(c.tool_use_id);
          st.toolStarts.delete(c.tool_use_id);
          const isError = !!c.is_error;
          const body = textOfToolResult(c.content);
          emit('agent.tool_result', {
            agentId, runId, callId: String(c.tool_use_id), ok: !isError, isError,
            ms: t0 ? Math.max(0, now() - t0) : 0,
            summary: (isError ? 'error: ' : '') + (body.split('\n')[0] || (isError ? 'error' : 'ok')).slice(0, 120)
          });
        }
        return;
      }
      case 'result':
        st.result = e;
        if (e.is_error && typeof e.result === 'string') st.errorText = e.result;
        return;
      default: return;
    }
  }
  function finish() {
    reasoning(false);
    const r = st.result;
    const u = (r && r.usage) || {};
    const tokensIn = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
    const tokensOut = u.output_tokens || 0;
    const reasoningTokens = (u.output_tokens_details && u.output_tokens_details.thinking_tokens) || 0;
    // The final result text is authoritative when the stream had none (e.g. a resumed run that only answered).
    const text = st.text || (r && !r.is_error && typeof r.result === 'string' ? r.result : '');
    return {
      text, turns: (r && r.num_turns) || st.turns, sessionId: (r && r.session_id) || st.sessionId,
      ok: !!(r && !r.is_error && r.subtype === 'success'),
      subtype: r ? r.subtype : null,
      errorText: st.errorText || (r && r.is_error ? String(r.result || r.subtype || 'error') : ''),
      equivalentUsd: (r && typeof r.total_cost_usd === 'number') ? r.total_cost_usd : 0,
      usage: { tokensIn, tokensOut, reasoningTokens, cachedTokens: u.cache_read_input_tokens || 0, lastTurnIn: st.lastTurnIn || 0 },
      model: st.model
    };
  }
  return { line, finish, state: st };
}

/* ---------- conversation -> prompt ---------- */
function contentText(c) {
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map(p => (p && typeof p.text === 'string') ? p.text : (p && p.type === 'image_url' ? '[image attached]' : '')).filter(Boolean).join('\n');
  return '';
}
function splitConversation(messages) {
  const list = Array.isArray(messages) ? messages : [];
  let system = '';
  const dialogue = [];
  for (const m of list) {
    if (!m) continue;
    if (m.role === 'system') { system += (system ? '\n\n' : '') + contentText(m.content); continue; }
    if (m.role === 'user' || m.role === 'assistant') {
      const t = contentText(m.content);
      if (t) dialogue.push({ role: m.role, text: t });
    }
  }
  let lastUser = -1;
  for (let i = dialogue.length - 1; i >= 0; i--) if (dialogue[i].role === 'user') { lastUser = i; break; }
  const latest = lastUser >= 0 ? dialogue[lastUser].text : '';
  const history = lastUser >= 0 ? dialogue.slice(0, lastUser) : dialogue;
  return { system, latest, history };
}
function composePrompt(parts, resuming) {
  if (resuming || !parts.history.length) return parts.latest || '(continue)';
  const h = parts.history.slice(-30).map(d => (d.role === 'user' ? 'Commander: ' : 'You: ') + d.text).join('\n\n');
  return '<earlier_conversation>\n' + h + '\n</earlier_conversation>\n\n' + (parts.latest || '(continue)');
}

/* ---------- session store (streamId -> claude session) ---------- */
function makeSessionStore(file) {
  let map = Object.create(null);
  try { if (file) map = Object.assign(Object.create(null), JSON.parse(fs.readFileSync(file, 'utf8'))); } catch (err) { if (!err || err.code !== 'ENOENT') failNote('claude-code.engine', err); }   // first run: no file yet
  function save() {
    if (!file) return;
    try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(map), { mode: 0o600 }); } catch (err) { failNote('claude-code.engine', err); }
  }
  const key = (agentId, streamId) => String(agentId || '') + '::' + String(streamId || '');
  return {
    get: (agentId, streamId) => (streamId ? map[key(agentId, streamId)] || null : null),
    set: (agentId, streamId, id) => { if (!streamId || !id) return; map[key(agentId, streamId)] = id; save(); },
    clear: (agentId, streamId) => { delete map[key(agentId, streamId)]; save(); }
  };
}

/* ---------- per-run tool/permission bridge ---------- */
function mcpToolFromWire(def) {
  const f = (def && def.function) || {};
  return { name: String(f.name || ''), description: String(f.description || '').slice(0, 4000), inputSchema: f.parameters && typeof f.parameters === 'object' ? f.parameters : { type: 'object', properties: {} } };
}

/* o = { tools: wireDefs[], dispatch(c)->result, approve({tool_name,input})->Promise<{allow,message}>, onEvent? } */
function startToolBridge(o) {
  const secret = crypto.randomBytes(24).toString('hex');
  const tools = (o.tools || []).map(mcpToolFromWire).filter(t => t.name);
  const sockets = new Set();
  const server = net.createServer((sock) => {
    sockets.add(sock);
    sock.on('close', () => sockets.delete(sock));
    sock.on('error', () => {});
    let buf = '';
    let authed = false;
    sock.setEncoding('utf8');
    sock.on('data', (chunk) => {
      buf += chunk;
      if (buf.length > (8 << 20)) { sock.destroy(); return; }
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const raw = buf.slice(0, i); buf = buf.slice(i + 1);
        let msg; try { msg = JSON.parse(raw); } catch (_) { continue; }
        if (!authed) {
          const given = Buffer.from(String(msg && msg.secret || ''));
          const want = Buffer.from(secret);
          if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) { sock.destroy(); return; }
          authed = true;
        }
        handle(msg).then(res => { try { sock.write(JSON.stringify(Object.assign({ id: msg.id }, res)) + '\n'); } catch (err) { failNote('claude-code.engine', err); } });
      }
    });
  });
  async function handle(msg) {
    try {
      if (msg.op === 'hello') return { ok: true };
      if (msg.op === 'list') return { ok: true, tools };
      if (msg.op === 'call') {
        const name = String(msg.name || '');
        if (!tools.some(t => t.name === name)) return { ok: true, result: { isError: true, content: 'unknown or withheld StarNet tool: ' + name } };
        let r;
        try { const args = (msg.args && typeof msg.args === 'object' && !Array.isArray(msg.args)) ? msg.args : {};
          r = await o.dispatch({ id: 'cc_' + crypto.randomBytes(6).toString('hex'), name, args, argsRaw: JSON.stringify(args), parseError: null }); }
        catch (e) { r = { isError: true, content: 'tool dispatch threw: ' + ((e && e.message) || e) }; }
        r = r || { isError: true, content: 'tool returned nothing' };
        const content = typeof r.content === 'string' ? r.content : (r.content == null ? '' : JSON.stringify(r.content));
        return { ok: true, result: { isError: !!r.isError, content, images: Array.isArray(r.images) ? r.images.slice(0, 4) : null } };
      }
      if (msg.op === 'approve') {
        const d = await o.approve({ tool_name: String(msg.tool_name || ''), input: msg.input || {} });
        return { ok: true, allow: !!(d && d.allow), message: (d && d.message) || '' };
      }
      return { ok: false, error: 'bad op' };
    } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
  }
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({
        port, secret, toolCount: tools.length,
        close: () => new Promise(r => { for (const s of sockets) { try { s.destroy(); } catch (err) { failNote('claude-code.engine', err); } } server.close(() => r()); })
      });
    });
  });
}

/* ---------- approvals ---------- */
// Claude Code's read-only tools never prompt; everything that reaches the prompt tool is a mutation or an
// action. StarNet's own tools (mcp__starnet__*) already run the station's consent ladder inside dispatch,
// so the CLI-level ask for them is answered yes here and the real decision happens once, in dispatch.
function makeApprover(o) {
  const sessionAllowed = new Set();
  return async function approve(req) {
    const tool = String(req.tool_name || '');
    if (tool.indexOf('mcp__' + MCP_SERVER_NAME + '__') === 0) return { allow: true };
    if (o.bypass && o.bypass()) return { allow: true };
    if (sessionAllowed.has(tool)) return { allow: true };
    if (typeof o.prompt !== 'function') return { allow: false, message: 'StarNet denied ' + tool + ': this run is unattended and has no approval channel. Ask the Commander to run it live or grant Full Access.' };
    let decision = 'deny';
    try { decision = await o.prompt({ name: 'claude.' + tool, args: req.input || {}, argsRaw: JSON.stringify(req.input || {}) }, { scope: 'write' }); }
    catch (_) { decision = 'deny'; }
    if (decision === 'session' || decision === 'always' || decision === 'full') sessionAllowed.add(tool);
    if (decision && decision !== 'deny') return { allow: true };
    return { allow: false, message: 'The Commander denied ' + tool + ' in StarNet.' };
  };
}

/* ---------- process ---------- */
function killTree(child) {
  if (!child || child.exitCode != null) return;
  try {
    if (process.platform === 'win32') childProcess.spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    else process.kill(-child.pid, 'SIGTERM');
  } catch (_) { try { child.kill('SIGTERM'); } catch (err) { failNote('claude-code.engine', err); } }
  setTimeout(() => { try { if (child.exitCode == null) { if (process.platform === 'win32') child.kill('SIGKILL'); else process.kill(-child.pid, 'SIGKILL'); } } catch (err) { failNote('claude-code.engine', err); } }, 3000).unref();
}

function writeTemp(dir, name, body) {
  const p = path.join(dir, name);
  fs.writeFileSync(p, body, { mode: 0o600 });
  return p;
}

function cleanEnv(env, bin) {
  // The CLI must authenticate with the Commander's own `claude login`, never with a key StarNet happens to hold.
  const e = Object.assign({}, env);
  for (const k of Object.keys(e)) if (/^(ANTHROPIC_API_KEY|ANTHROPIC_AUTH_TOKEN|CLAUDE_CODE_OAUTH_TOKEN|STARNET_API_TOKEN|SKYNET_API_TOKEN|STARNET_TOKEN)$/.test(k)) delete e[k];
  // An npm-installed `claude` is a node script (#!/usr/bin/env node): put its own bin dir (where nvm/fnm keep
  // node too) first on PATH, then the usual Homebrew/local dirs a Dock-launched app is missing.
  const extra = [bin ? path.dirname(bin) : '', '/opt/homebrew/bin', '/usr/local/bin', path.join(os.homedir(), '.local', 'bin')].filter(Boolean);
  const have = String(e.PATH || '').split(path.delimiter).filter(Boolean);
  e.PATH = extra.filter(d => have.indexOf(d) < 0).concat(have).join(path.delimiter);
  return e;
}

/* Account B (and beyond) = a second `claude` login kept in its own config folder (CLAUDE_CONFIG_DIR). An empty
   dir means the default login (account A). The folder holds the CLI's own credentials; StarNet never reads them. */
function withConfigDir(env, configDir) {
  const e = Object.assign({}, env);
  if (configDir) e.CLAUDE_CONFIG_DIR = String(configDir);
  else delete e.CLAUDE_CONFIG_DIR;
  return e;
}

/* Spawn once and pump stdout lines into onLine. Resolves { code, stderr }. */
function runCli(o) {
  return new Promise((resolve) => {
    let child;
    try {
      child = (o.spawn || childProcess.spawn)(o.bin, o.args, {
        cwd: o.cwd, env: o.env, stdio: ['pipe', 'pipe', 'pipe'],
        detached: process.platform !== 'win32', windowsHide: true
      });
    } catch (e) { return resolve({ code: -1, stderr: String((e && e.message) || e), spawnError: true }); }
    let out = '', err = '';
    const onAbort = () => killTree(child);
    if (o.signal) { if (o.signal.aborted) onAbort(); else o.signal.addEventListener('abort', onAbort, { once: true }); }
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (d) => {
      out += d;
      let i;
      while ((i = out.indexOf('\n')) >= 0) { const l = out.slice(0, i); out = out.slice(i + 1); try { o.onLine(l); } catch (err) { failNote('claude-code.engine', err); } }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (d) => { if (err.length < 20000) err += d; });
    child.on('error', (e) => { err += String((e && e.message) || e); });
    child.on('close', (code) => {
      if (out) { try { o.onLine(out); } catch (err) { failNote('claude-code.engine', err); } }
      if (o.signal) o.signal.removeEventListener('abort', onAbort);
      resolve({ code, stderr: err, spawnError: code == null && /ENOENT/.test(err) });
    });
    try { child.stdin.end(o.stdin || ''); } catch (err) { failNote('claude-code.engine', err); }
  });
}

function mcpConfig(o) {
  return {
    mcpServers: {
      [MCP_SERVER_NAME]: {
        type: 'stdio',
        command: o.node || process.execPath,
        args: [o.shim],
        env: { STARNET_CC_BRIDGE_PORT: String(o.port), STARNET_CC_BRIDGE_SECRET: o.secret }
      }
    }
  };
}

/* ---------- one run ---------- */
/* o = { agentId, runId, trigger, model, messages, emit, signal, cwd, tools(wireDefs), dispatch, prompt,
         bypass, streamId, sessions, tmpRoot, bin, spawn, shimPath, addDirs } */
async function runClaudeCodeEngine(o) {
  const { agentId, runId, emit } = o;
  const model = o.model || 'default';
  emit('agent.run.start', { agentId, runId, trigger: o.trigger || 'directive', model });
  const fail = (message, transient) => {
    emit('agent.run.error', { agentId, runId, transient: !!transient, message });
    emit('agent.run.end', { agentId, runId, reason: 'error', turns: 0, usd: 0 });
    return { reason: 'error', messages: o.messages, text: '', usd: 0, turns: 0, tokens: 0, model };
  };
  const bin = o.bin || resolveClaudeBinary();
  if (!bin) return fail('Claude Code is not installed or not on PATH. Install it (https://code.claude.com), run `claude` once in Terminal to sign in, or set STARNET_CLAUDE_BIN to its full path.', false);

  const parts = splitConversation(o.messages);
  const resumeId = o.sessions ? o.sessions.get(agentId, o.streamId) : null;
  const sessionId = resumeId ? null : (o.streamId ? crypto.randomUUID() : null);
  const tmp = fs.mkdtempSync(path.join(o.tmpRoot || os.tmpdir(), 'starnet-cc-'));
  let bridge = null;
  try {
    const bridgeTools = (o.tools || []).filter(d => d && d.function && !DUPLICATE_TOOL.test(String(d.function.name || '')));
    bridge = await startToolBridge({
      tools: bridgeTools,
      dispatch: o.dispatch || (async () => ({ isError: true, content: 'StarNet tools unavailable in this run' })),
      approve: makeApprover({ prompt: o.prompt, bypass: o.bypass })
    });
    const shim = o.shimPath || path.join(__dirname, 'claude-code-mcp.js');
    const mcpFile = writeTemp(tmp, 'mcp.json', JSON.stringify(mcpConfig({ port: bridge.port, secret: bridge.secret, shim, node: o.node })));
    const systemFile = parts.system ? writeTemp(tmp, 'system.md', parts.system) : null;
    const args = buildArgs({
      model, reasoningEffort: o.reasoningEffort, systemFile, mcpConfigFile: mcpFile, permissionTool: PERMISSION_TOOL,
      resumeId, sessionId, noPersist: !o.streamId, addDirs: o.addDirs
    });
    const mapper = makeStreamMapper({ emit, agentId, runId });
    const proc = await runCli({
      bin, args, cwd: o.cwd || process.cwd(), env: withConfigDir(cleanEnv(o.env || process.env, bin), o.configDir), signal: o.signal,
      stdin: composePrompt(parts, !!resumeId), spawn: o.spawn,
      // Dylan's fork: the CLI streams `rate_limit_event` lines carrying the plan's live 5-hour / weekly
      // utilization. Hand them to the host (account usage tracking) before normal mapping.
      onLine: (line) => {
        if (o.onRateLimit && typeof line === 'string' && line.indexOf('rate_limit_event') >= 0) {
          try { const j = JSON.parse(line); if (j && j.type === 'rate_limit_event' && j.rate_limit_info) o.onRateLimit(j.rate_limit_info); } catch (_) {}
        }
        return mapper.line(line);
      }
    });
    const r = mapper.finish();
    const cancelled = !!(o.signal && o.signal.aborted);
    if (r.sessionId && o.sessions && !cancelled) o.sessions.set(agentId, o.streamId, r.sessionId);
    // A resumed session the CLI no longer has: forget it so the next run starts clean with history inlined.
    if (resumeId && !r.ok && /No conversation found|session.*not found/i.test(r.errorText + ' ' + proc.stderr) && o.sessions) o.sessions.clear(agentId, o.streamId);
    const tokens = r.usage.tokensIn + r.usage.tokensOut;
    emit('agent.cost', {
      agentId, runId, usd: 0, reconciled: true, model: r.model || model,
      tokensIn: r.usage.tokensIn, tokensOut: r.usage.tokensOut, reasoningTokens: r.usage.reasoningTokens, cachedTokens: r.usage.cachedTokens,
      contextTokens: r.usage.lastTurnIn || 0   // what the model actually held on its last turn (tokensIn is the run's cumulative sum)
    });
    let reason = 'done';
    const limitText = String(r.errorText || '') + ' ' + String(proc.stderr || '').slice(-600) + ' ' + (r.ok ? '' : String(r.text || '').slice(0, 400));
    const rateLimited = !cancelled && !r.ok && /usage limit|rate[ _-]?limit|limit reached|too many requests|\b429\b|quota|out of (?:credits|usage)/i.test(limitText);
    if (cancelled) reason = 'cancelled';
    else if (!r.subtype) {
      const hint = /not logged in|login|authenticat|OAuth|401/i.test(proc.stderr + r.errorText)
        ? 'Claude Code is not signed in. Open Terminal, run `claude`, and sign in with your Claude account.'
        : 'Claude Code exited without a result (code ' + proc.code + '). ' + String(proc.stderr || '').trim().slice(-600);
      emit('agent.run.error', { agentId, runId, transient: !/signed in/.test(hint), message: hint });
      reason = 'error';
    } else if (r.subtype === 'error_max_turns') reason = 'max_iters';
    else if (!r.ok) {
      emit('agent.run.error', { agentId, runId, transient: /rate|limit|overload|529|5\d\d/i.test(r.errorText), message: 'Claude Code: ' + (r.errorText || r.subtype).slice(0, 800) });
      reason = 'error';
    } else if (!r.text.trim()) reason = 'empty';
    emit('agent.run.end', { agentId, runId, reason, turns: r.turns || 0, usd: 0 });
    const messages = (o.messages || []).concat(r.text ? [{ role: 'assistant', content: r.text }] : []);
    return { reason, messages, text: r.text, usd: 0, turns: r.turns || 0, tokens, model: r.model || model, unpricedUsage: [], engine: ENGINE_ID, equivalentUsd: r.equivalentUsd,
      rateLimited, limitText: rateLimited ? limitText.trim().slice(0, 300) : '' };
  } catch (e) {
    return fail('Claude Code engine failed: ' + ((e && e.message) || e), true);
  } finally {
    if (bridge) { try { await bridge.close(); } catch (err) { failNote('claude-code.engine', err); } }
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (err) { failNote('claude-code.engine', err); }
  }
}

/* ---------- provider-shaped adapter (text only) ---------- */
function makeClaudeCodeProvider(opts) {
  opts = opts || {};
  return {
    id: ENGINE_ID,
    listModels: async () => MODELS.map(m => Object.assign({ pricing: { prompt: '0', completion: '0' } }, m)),
    contextLimit: () => 200000,
    priceOf: () => ({ in: 0, out: 0 }),
    supportsTools: () => true,
    async *stream(req) {
      const bin = opts.bin || resolveClaudeBinary();
      if (!bin) throw Object.assign(new Error('Claude Code is not installed or not on PATH'), { status: 400 });
      const parts = splitConversation(req.messages);
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'starnet-cc-aux-'));
      const queue = []; let wake = null; let finished = false;
      const push = (ev) => { queue.push(ev); if (wake) { const w = wake; wake = null; w(); } };
      const mapper = makeStreamMapper({ agentId: 'aux', runId: 'aux', emit: (name, p) => { if (name === 'agent.token') push({ type: 'text', delta: p.delta }); } });
      try {
        const systemFile = parts.system ? writeTemp(tmp, 'system.md', parts.system) : null;
        const args = buildArgs({ model: req.model, reasoningEffort: req.reasoningEffort, systemFile, textOnly: true, noPersist: true });
        const p = runCli({ bin, args, cwd: tmp, env: cleanEnv(process.env, bin), signal: req.signal, stdin: composePrompt(parts, false), onLine: mapper.line, spawn: opts.spawn })
          .then(() => { finished = true; push(null); });
        while (true) {
          if (!queue.length) { if (finished) break; await new Promise(r => { wake = r; }); continue; }
          const ev = queue.shift();
          if (ev) yield ev;
        }
        await p;
        const r = mapper.finish();
        if (!r.ok && !r.text) throw Object.assign(new Error('Claude Code: ' + (r.errorText || 'no result')), { status: 502 });
        yield { type: 'usage', usage: { prompt_tokens: r.usage.tokensIn, completion_tokens: r.usage.tokensOut, total_tokens: r.usage.tokensIn + r.usage.tokensOut, cost: 0 } };
        yield { type: 'done', finishReason: 'stop' };
      } finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (err) { failNote('claude-code.engine', err); } }
    }
  };
}

module.exports = {
  ENGINE_ID, MODELS, PERMISSION_TOOL, MCP_SERVER_NAME, APPROVE_TOOL, DUPLICATE_TOOL,
  resolveClaudeBinary, authStatus, buildArgs, makeStreamMapper, splitConversation, composePrompt,
  makeSessionStore, startToolBridge, makeApprover, runClaudeCodeEngine, makeClaudeCodeProvider, cleanEnv, mcpConfig, cliEffort, withConfigDir
};
