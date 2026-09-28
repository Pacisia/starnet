# Multi-account (Dylan's fork)

Branch: `feat/multi-account`. Adds a second Claude Code login, a second ChatGPT sign-in, a Xiaomi MiMo
(Singapore Token Plan) provider, and automatic switching between accounts when one hits its usage limit.

## How switching works
- Each agent sticks to one account. New agents are spread across the accounts that are signed in.
- When an account reports a usage/rate limit, it rests (30 min, or the "try again in …" time the provider gives,
  max 6 h). That agent's **next** run moves to the other account. Nothing switches mid-run.
- After the rest, agents stay where they are (no ping-pong).
- Optional pin: add `"account": "A"` or `"B"` to an agent's roster record to prefer one account.
- Code: `sidecar/accounts.js` (router, tested in `test/accounts.test.js`).

## One-time setup
1. **Claude account B** — in Terminal: `CLAUDE_CONFIG_DIR=~/.claude-b claude`, then type `/login` and sign in
   with the second Claude account. (Override the folder with `STARNET_CLAUDE_B_DIR`.)
2. **ChatGPT account B** — StarNet ▸ Settings ▸ ACCOUNTS ▸ SIGN IN ACCOUNT B, then sign in with the second
   ChatGPT account in the browser. Tokens are stored in `<workspaces>/codex-b/tokens.json`, same protection as account A.
3. **MiMo** — Settings ▸ PROVIDERS ▸ MIMO, paste the Token Plan key (`tp-…`). On the desktop app it goes to the
   macOS Keychain (`provider:mimo`). Endpoint defaults to `https://token-plan-sgp.xiaomimimo.com/v1`
   (override with `MIMO_BASE_URL`). Models: `mimo-v2.6-pro`, `mimo-v2.6-flash`.

## See what's happening
- Settings ▸ ACCOUNTS: signed-in state for A/B, which account is resting, agent counts, recent switches.
- `GET /api/accounts` returns the same (no credentials).
- Sidecar log lines start with `[accounts]`.

## Build
The release app bundles the sidecar, so rebuild after pulling this branch: `npm run desktop:build`
(the MiMo keychain slot needs the Rust change in `src-tauri/src/credentials.rs`).

## Choosing accounts per agent (pins)
- Settings ▸ ACCOUNTS ▸ "Which account each agent uses": set each agent to A, B or auto, then SAVE.
- Or tell the lead agent to write `<workspaces>/accounts.pins.json` (on Dylan's Mac: `~/starnet-data/accounts.pins.json`), e.g.
  `{"version":1,"pins":{"luna-producer-1":"A","luna-producer-2":"A","luna-producer-3":"A","luna-producer-4":"A","luna-producer-5":"B","luna-producer-6":"B","luna-producer-7":"B"}}`
  StarNet re-reads the file on the next run; no restart needed.
- A pinned agent borrows the other account only while its own is resting after a usage limit, then goes back.
