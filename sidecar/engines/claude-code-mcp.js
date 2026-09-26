#!/usr/bin/env node
/* sidecar/engines/claude-code-mcp.js — the stdio MCP shim Claude Code launches for a StarNet run.

   Claude Code starts this as its "starnet" MCP server (see mcpConfig in claude-code.js). It speaks
   newline-delimited JSON-RPC 2.0 on stdin/stdout and forwards everything to the per-run loopback bridge
   the sidecar opened (STARNET_CC_BRIDGE_PORT), authenticating with the per-run secret
   (STARNET_CC_BRIDGE_SECRET). It exposes:
     · every StarNet tool the run is granted (minus the ones Claude Code already has natively);
     · `approve` — the --permission-prompt-tool target. It answers Claude Code's permission asks with the
       Commander's decision from StarNet's own consent card.
   It holds no state and no credentials beyond the per-run secret, and logs only to stderr. */
'use strict';

const net = require('net');
const { note: failNote } = require('../failopen.js');

const PORT = Number(process.env.STARNET_CC_BRIDGE_PORT || 0);
const SECRET = String(process.env.STARNET_CC_BRIDGE_SECRET || '');
const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];

const APPROVE_DEF = {
  name: 'approve',
  description: 'Internal: StarNet answers Claude Code permission prompts through the Commander\'s consent card. Not for direct use.',
  inputSchema: { type: 'object', properties: { tool_name: { type: 'string' }, input: { type: 'object' }, tool_use_id: { type: 'string' } }, required: ['tool_name'] }
};

/* ---- bridge client ---- */
let sock = null, ready = null, seq = 0, inbuf = '';
const waiting = new Map();
function connect() {
  if (ready) return ready;
  ready = new Promise((resolve, reject) => {
    if (!PORT || !SECRET) return reject(new Error('StarNet bridge not configured'));
    sock = net.connect(PORT, '127.0.0.1', () => resolve());
    sock.setEncoding('utf8');
    sock.on('data', (d) => {
      inbuf += d;
      let i;
      while ((i = inbuf.indexOf('\n')) >= 0) {
        const raw = inbuf.slice(0, i); inbuf = inbuf.slice(i + 1);
        let m; try { m = JSON.parse(raw); } catch (_) { continue; }
        const w = waiting.get(m.id); if (w) { waiting.delete(m.id); w(m); }
      }
    });
    const dead = (e) => { for (const w of waiting.values()) w({ ok: false, error: 'StarNet bridge closed' }); waiting.clear(); ready = null; };
    sock.on('error', (e) => { dead(e); reject(e); });
    sock.on('close', dead);
  });
  return ready;
}
async function bridge(op, extra) {
  await connect();
  const id = ++seq;
  return new Promise((resolve) => {
    waiting.set(id, resolve);
    sock.write(JSON.stringify(Object.assign({ id, op, secret: SECRET }, extra || {})) + '\n');
  });
}

/* ---- JSON-RPC ---- */
function send(obj) { process.stdout.write(JSON.stringify(obj) + '\n'); }
function reply(id, result) { send({ jsonrpc: '2.0', id, result }); }
function replyErr(id, code, message) { send({ jsonrpc: '2.0', id, error: { code, message } }); }

async function handle(msg) {
  const { id, method, params } = msg;
  const isRequest = id !== undefined && id !== null;
  try {
    if (method === 'initialize') {
      const want = params && params.protocolVersion;
      return reply(id, {
        protocolVersion: PROTOCOLS.indexOf(want) >= 0 ? want : PROTOCOLS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'starnet', version: '1.0.0' },
        instructions: 'StarNet station tools for this agent. Use them for station-specific work (memory, quests, skills, connectors, team, deliverables). Use your own built-in tools for files, shell and the web.'
      });
    }
    if (method === 'ping') return isRequest && reply(id, {});
    if (method === 'tools/list') {
      const r = await bridge('list');
      const tools = (r && r.ok && Array.isArray(r.tools)) ? r.tools : [];
      return reply(id, { tools: tools.concat([APPROVE_DEF]) });
    }
    if (method === 'tools/call') {
      const name = String((params && params.name) || '');
      const args = (params && params.arguments) || {};
      if (name === 'approve') {
        const r = await bridge('approve', { tool_name: args.tool_name, input: args.input || {} });
        const out = (r && r.ok && r.allow)
          ? { behavior: 'allow', updatedInput: args.input || {} }
          : { behavior: 'deny', message: (r && (r.message || r.error)) || 'Denied by StarNet.' };
        return reply(id, { content: [{ type: 'text', text: JSON.stringify(out) }] });
      }
      const r = await bridge('call', { name, args });
      if (!r || !r.ok) return reply(id, { isError: true, content: [{ type: 'text', text: 'StarNet bridge error: ' + ((r && r.error) || 'unavailable') }] });
      const content = [{ type: 'text', text: String(r.result.content || (r.result.isError ? 'error' : 'ok')) }];
      for (const img of (r.result.images || [])) {
        const m = /^data:([^;]+);base64,(.+)$/.exec(String((img && (img.url || img.data || img)) || ''));
        if (m) content.push({ type: 'image', mimeType: m[1], data: m[2] });
      }
      return reply(id, { isError: !!r.result.isError, content });
    }
    if (!isRequest) return;   // notifications (initialized, cancelled) need no answer
    replyErr(id, -32601, 'method not found: ' + method);
  } catch (e) {
    if (isRequest) replyErr(id, -32603, String((e && e.message) || e));
  }
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const raw = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (!raw) continue;
    let msg; try { msg = JSON.parse(raw); } catch (_) { continue; }
    handle(msg);
  }
});
process.stdin.on('end', () => { try { if (sock) sock.destroy(); } catch (err) { failNote('claude-code.mcp', err); } process.exit(0); });
