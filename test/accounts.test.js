'use strict';
const assert = require('assert');
const { makeAccountRouter, isRateLimitMessage, retryAfterMs } = require('../sidecar/accounts.js');
let now = 1000;
const clock = { now: () => now };
const seen = [];
const r = makeAccountRouter({ clock, cooldownMs: 60000, onSwitch: e => seen.push(e) });
// spreads new agents across A and B
assert.strictEqual(r.pick('codex', 'a1', ['A', 'B']), 'A');
assert.strictEqual(r.pick('codex', 'a2', ['A', 'B']), 'B');
assert.strictEqual(r.pick('codex', 'a3', ['A', 'B']), 'A');
// sticky
assert.strictEqual(r.pick('codex', 'a2', ['A', 'B']), 'B');
// only one signed in -> always that one
assert.strictEqual(r.pick('claude', 'x', ['A']), 'A');
// limit on A -> a1 moves to B on its next run, and stays there after cooldown
r.penalize('codex', 'A', 'You have hit your usage limit');
assert.strictEqual(r.pick('codex', 'a1', ['A', 'B']), 'B');
assert.strictEqual(seen.length, 1); assert.deepStrictEqual([seen[0].from, seen[0].to], ['A', 'B']);
now += 61000;
assert.strictEqual(r.pick('codex', 'a1', ['A', 'B']), 'B');
// both cooling -> stays put (no pointless switch)
r.penalize('codex', 'A'); r.penalize('codex', 'B');
assert.strictEqual(r.pick('codex', 'a1', ['A', 'B']), 'B');
// providers are independent
assert.strictEqual(r.coolingUntil('claude', 'A'), 0);
// preferred pin honoured for a new agent
assert.strictEqual(r.pick('claude', 'p1', ['A', 'B'], 'B'), 'B');
// detection + retry hints
assert.ok(isRateLimitMessage('Claude AI usage limit reached|1759000000'));
assert.ok(isRateLimitMessage('429 Too Many Requests'));
assert.ok(!isRateLimitMessage('file not found'));
assert.strictEqual(retryAfterMs('try again in 2h 15m'), 2 * 3600000 + 15 * 60000);
assert.strictEqual(retryAfterMs('retry after 90 seconds'), 90000);
console.log('accounts.test.js ok');
// Claude Code engine: account B = CLAUDE_CONFIG_DIR, account A = no override
const cc = require('../sidecar/engines/claude-code.js');
assert.strictEqual(cc.withConfigDir({ PATH: '/bin' }, '/Users/x/.claude-b').CLAUDE_CONFIG_DIR, '/Users/x/.claude-b');
assert.strictEqual(cc.withConfigDir({ PATH: '/bin', CLAUDE_CONFIG_DIR: '/stale' }, '').CLAUDE_CONFIG_DIR, undefined);
console.log('accounts.test.js claude config-dir ok');
