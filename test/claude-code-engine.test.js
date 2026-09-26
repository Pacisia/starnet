/* node test/claude-code-engine.test.js — the Claude Code CLI engine (sidecar/engines/claude-code.js).

   Locks the parts that keep the engine honest and compliant without needing the real CLI:
     · argv never uses --bare (it would drop the Commander's OAuth login) and always routes permission asks
       to StarNet's approve tool;
     · the spawned CLI never inherits an Anthropic key or StarNet's own API token;
     · stream-json lines map onto the frozen StarNet event vocabulary;
     · the approver fails closed on unattended runs and remembers session grants;
     · the per-run bridge + stdio MCP shim round-trip tools/list, tools/call and approve;
     · the registry exposes a keyless, unmetered 'claude-code' profile distinct from the Anthropic API one. */
'use strict';
const A = require('./_assert.js');
const path = require('path');
const { spawn } = require('child_process');
const E = require('../sidecar/engines/claude-code.js');
const registry = require('../sidecar/providers/registry.js');
const { validate } = (() => { try { return require('../shared/events.js'); } catch (_) { return {}; } })();

(async () => {
  /* ---- argv ---- */
  const args = E.buildArgs({ model: 'sonnet', systemFile: '/t/s.md', mcpConfigFile: '/t/m.json', permissionTool: E.PERMISSION_TOOL, sessionId: 'abc' });
  A.ok(args.indexOf('--bare') < 0, 'never --bare (it disables OAuth/keychain auth)');
  A.eq(args.slice(0, 5), ['-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages'], 'print + stream-json');
  A.ok(args.join(' ').indexOf('--permission-prompt-tool mcp__starnet__approve') >= 0, 'permission asks go to StarNet');
  A.ok(args.join(' ').indexOf('--model sonnet') >= 0, 'model passed');
  A.ok(E.buildArgs({ model: 'default' }).indexOf('--model') < 0, "'default' leaves the CLI's own model");
  const resumed = E.buildArgs({ resumeId: 'r1', sessionId: 'x' });
  A.ok(resumed.indexOf('--resume') >= 0 && resumed.indexOf('--session-id') < 0, 'resume wins over a new session id');

  /* ---- env ---- */
  const env = E.cleanEnv({ PATH: '/usr/bin', ANTHROPIC_API_KEY: 'sk-ant-x', CLAUDE_CODE_OAUTH_TOKEN: 't', STARNET_API_TOKEN: 's', HOME: '/h' });
  A.ok(!env.ANTHROPIC_API_KEY && !env.CLAUDE_CODE_OAUTH_TOKEN && !env.STARNET_API_TOKEN, 'no keys/tokens leak into the CLI');
  A.eq(env.HOME, '/h', 'ordinary env kept');

  /* ---- binary discovery ---- */
  A.eq(E.resolveClaudeBinary({ env: { PATH: '' }, home: '/home/u', exists: p => p === '/home/u/.local/bin/claude' }), '/home/u/.local/bin/claude', 'finds ~/.local/bin/claude without PATH');
  A.eq(E.resolveClaudeBinary({ env: { PATH: '', STARNET_CLAUDE_BIN: '/x/claude' }, home: '/h', exists: p => p === '/x/claude' }), '/x/claude', 'STARNET_CLAUDE_BIN override');
  A.eq(E.resolveClaudeBinary({ env: { PATH: '' }, home: '/h', exists: () => false }), null, 'null when absent');

  /* ---- conversation ---- */
  const parts = E.splitConversation([
    { role: 'system', content: 'SYS' }, { role: 'user', content: 'one' }, { role: 'assistant', content: 'two' },
    { role: 'user', content: [{ type: 'text', text: 'three' }] }
  ]);
  A.eq(parts.system, 'SYS', 'system split out');
  A.eq(parts.latest, 'three', 'latest user turn');
  A.ok(/Commander: one[\s\S]*You: two/.test(E.composePrompt(parts, false)) && /three$/.test(E.composePrompt(parts, false)), 'history inlined on a fresh session');
  A.eq(E.composePrompt(parts, true), 'three', 'resumed session sends only the new turn');

  /* ---- stream mapping ---- */
  const evs = [];
  let t = 1000;
  const m = E.makeStreamMapper({ agentId: 'a', runId: 'r', emit: (n, p) => evs.push([n, p]), now: () => (t += 5) });
  const L = o => m.line(JSON.stringify(o));
  L({ type: 'system', subtype: 'init', model: 'claude-x', session_id: 'S1' });
  L({ type: 'stream_event', event: { type: 'message_start' } });
  L({ type: 'stream_event', event: { type: 'content_block_start', content_block: { type: 'thinking' } } });
  L({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hel' } } });
  L({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'lo' } } });
  L({ type: 'assistant', message: { content: [{ type: 'text', text: 'Hello' }, { type: 'tool_use', id: 'tu1', name: 'mcp__starnet__quests_list', input: { a: 1 } }] } });
  L({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'tu1', content: [{ type: 'text', text: 'two quests\nmore' }] }] } });
  m.line('not json');
  L({ type: 'result', subtype: 'success', is_error: false, num_turns: 2, session_id: 'S1', total_cost_usd: 0.5, result: 'Hello',
    usage: { input_tokens: 10, cache_read_input_tokens: 100, cache_creation_input_tokens: 5, output_tokens: 20, output_tokens_details: { thinking_tokens: 7 } } });
  const r = m.finish();
  A.eq(evs.filter(e => e[0] === 'agent.token').map(e => e[1].delta).join(''), 'Hello', 'text streamed once (partials win over the full block)');
  const call = evs.find(e => e[0] === 'agent.tool_call');
  A.ok(call && call[1].name === 'quests_list' && call[1].callId === 'tu1', 'StarNet MCP tool shown by its own name');
  const res = evs.find(e => e[0] === 'agent.tool_result');
  A.ok(res && res[1].ok === true && res[1].isError === false && res[1].summary === 'two quests' && res[1].ms > 0, 'tool result mapped');
  A.ok(evs.some(e => e[0] === 'agent.reasoning' && e[1].on === true) && evs.filter(e => e[0] === 'agent.reasoning').pop()[1].on === false, 'reasoning toggles on then off');
  A.eq([r.ok, r.turns, r.sessionId, r.model, r.usage.tokensIn, r.usage.tokensOut, r.usage.reasoningTokens, r.usage.cachedTokens],
    [true, 2, 'S1', 'claude-x', 115, 20, 7, 100], 'result folded');
  if (typeof validate === 'function') {
    const bad = evs.map(e => [e[0], validate(e[0], e[1])]).filter(x => x[1] && x[1].ok === false);
    A.eq(bad.length, 0, 'every emitted event validates against shared/events.js');
  }
  const m2 = E.makeStreamMapper({ agentId: 'a', runId: 'r', emit: () => {} });
  m2.line(JSON.stringify({ type: 'result', subtype: 'error_during_execution', is_error: true, result: 'boom' }));
  const r2 = m2.finish();
  A.ok(!r2.ok && r2.errorText === 'boom', 'error result surfaced');

  /* ---- approver ---- */
  const unattended = E.makeApprover({ prompt: null, bypass: () => false });
  A.eq((await unattended({ tool_name: 'Bash', input: {} })).allow, false, 'unattended run: CLI mutations denied (fail closed)');
  A.eq((await unattended({ tool_name: 'mcp__starnet__x', input: {} })).allow, true, 'StarNet tools defer to dispatch consent');
  A.eq((await E.makeApprover({ prompt: null, bypass: () => true })({ tool_name: 'Bash' })).allow, true, 'full access bypass');
  let asks = 0;
  const live = E.makeApprover({ prompt: async (c) => { asks++; A.eq(c.name, 'claude.Write', 'card names the CLI tool'); return 'session'; } });
  await live({ tool_name: 'Write', input: { file_path: 'x' } });
  await live({ tool_name: 'Write', input: { file_path: 'y' } });
  A.eq(asks, 1, "'session' grant remembered for the rest of the run");
  A.eq((await E.makeApprover({ prompt: async () => 'deny' })({ tool_name: 'Edit' })).allow, false, 'deny honoured');

  /* ---- bridge + stdio shim round trip ---- */
  const dispatched = [];
  const bridge = await E.startToolBridge({
    tools: [{ type: 'function', function: { name: 'quests_list', description: 'list quests', parameters: { type: 'object', properties: {} } } }],
    dispatch: async (c) => { dispatched.push(c); return { ok: true, content: 'Q1, Q2' }; },
    approve: async (q) => ({ allow: q.tool_name === 'Read' })
  });
  const shim = spawn(process.execPath, [path.join(__dirname, '..', 'sidecar', 'engines', 'claude-code-mcp.js')], {
    env: Object.assign({}, process.env, { STARNET_CC_BRIDGE_PORT: String(bridge.port), STARNET_CC_BRIDGE_SECRET: bridge.secret }), stdio: ['pipe', 'pipe', 'inherit']
  });
  let out = '';
  const waiters = new Map();
  shim.stdout.setEncoding('utf8');
  shim.stdout.on('data', d => { out += d; let i; while ((i = out.indexOf('\n')) >= 0) { const msg = JSON.parse(out.slice(0, i)); out = out.slice(i + 1); const w = waiters.get(msg.id); if (w) w(msg); } });
  let id = 0;
  const rpc = (method, params) => new Promise(res => { const n = ++id; waiters.set(n, res); shim.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: n, method, params }) + '\n'); });
  const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } });
  A.eq(init.result.serverInfo.name, 'starnet', 'shim initializes');
  shim.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  const list = await rpc('tools/list', {});
  A.eq(list.result.tools.map(x => x.name).sort(), ['approve', 'quests_list'], 'granted tools + approve listed');
  const called = await rpc('tools/call', { name: 'quests_list', arguments: { status: 'open' } });
  A.eq(called.result.content[0].text, 'Q1, Q2', 'tool call routed to dispatch');
  A.ok(dispatched[0] && dispatched[0].args.status === 'open' && dispatched[0].argsRaw === '{"status":"open"}', 'dispatch receives parsed args + raw JSON');
  const withheld = await rpc('tools/call', { name: 'shell_exec', arguments: {} });
  A.ok(withheld.result.isError === true && dispatched.length === 1, 'a tool not granted to the run is refused without dispatch');
  const yes = JSON.parse((await rpc('tools/call', { name: 'approve', arguments: { tool_name: 'Read', input: { p: 1 } } })).result.content[0].text);
  const no = JSON.parse((await rpc('tools/call', { name: 'approve', arguments: { tool_name: 'Bash', input: {} } })).result.content[0].text);
  A.eq(yes, { behavior: 'allow', updatedInput: { p: 1 } }, 'approve -> allow shape');
  A.eq(no.behavior, 'deny', 'approve -> deny shape');
  shim.stdin.end();
  await bridge.close();

  /* bad secret is dropped */
  const b2 = await E.startToolBridge({ tools: [], dispatch: async () => ({}), approve: async () => ({ allow: true }) });
  const closed = await new Promise(res => {
    const s = require('net').connect(b2.port, '127.0.0.1', () => s.write(JSON.stringify({ id: 1, op: 'list', secret: 'wrong' }) + '\n'));
    let got = '';
    s.on('data', d => { got += d; });
    s.on('close', () => res(got));
  });
  A.eq(closed, '', 'wrong secret gets no answer');
  await b2.close();

  /* ---- registry ---- */
  const prof = registry.getProviderProfile('claude-code');
  A.ok(prof && prof.adapter === 'claude-code' && prof.keyRequired === false && prof.unmetered === true, 'keyless, unmetered claude-code profile');
  A.eq(registry.normalizeProviderId('claude'), 'anthropic', "'claude' still means the Anthropic API-key provider");
  A.ok(registry.providerUsesClaudeCode('claude-code') && !registry.providerUsesClaudeCode('anthropic'), 'providerUsesClaudeCode');
  A.ok(!registry.providerUsesDeviceOAuth('claude-code'), 'not a device-OAuth provider: StarNet never runs a Claude sign-in flow');

  A.report();
})().catch(e => { console.log('FAIL: threw ' + (e && e.stack)); process.exit(1); });
