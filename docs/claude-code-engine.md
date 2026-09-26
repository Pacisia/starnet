# Claude Code engine

Pick **CLAUDE CODE** as an agent's provider and that agent's turns run through the official `claude` CLI, billed to your own Claude plan.

## How it works

- StarNet spawns the unmodified `claude` binary: `claude -p --output-format stream-json …`.
  - It runs in the agent's workspace, or in the project folder when one is set.
  - The CLI authenticates with your own `claude` login.
  - StarNet never reads, stores or forwards the Claude credential. It strips `ANTHROPIC_API_KEY` and similar variables from the child's environment and never passes `--bare`.
- Claude Code runs its own loop and its own tools (files, shell, web).
- StarNet's granted tools that Claude Code doesn't already have reach it through a per-run MCP server, `sidecar/engines/claude-code-mcp.js`. Examples are memory, quests, skills, team, connectors, station and deliverables.
  - Each call goes back into StarNet's normal `dispatch`, so every capability, consent and hook gate still applies.
  - StarNet's file, shell and web tools are withheld, because Claude Code's own versions replace them.
- Claude Code's permission asks go to `--permission-prompt-tool mcp__starnet__approve`, which shows StarNet's normal approval card.
  - *Session*, *Always* and *Full* grants are remembered for the rest of the run.
  - Unattended runs (cron, messaging) deny Claude Code's mutating tools unless the agent has Full Access.
- The agent's persona, skills, capability notes and quests are passed with `--append-system-prompt-file`.
- Each workstream keeps its own Claude session (`workspaces/claude-code.sessions.json`), so follow-ups resume the same conversation.
- Cost shows as $0, because it's your subscription. Token counts are still recorded.
- Background helper calls (titles, summaries, reflection) on a Claude Code agent use the CLI in text-only mode (`--tools ""`).

## Setup (macOS)

1. Install Claude Code: see <https://code.claude.com>.
2. In Terminal, run `claude` once and sign in with your Claude account.
3. In StarNet, go to **Settings → Connections → CLAUDE CODE** and press **↻ RECHECK**. It should read **SIGNED IN**.
4. Choose CLAUDE CODE as the agent's provider, then pick a model (`default`, `opus`, `sonnet`, `haiku`).

If StarNet can't find the binary (GUI apps don't inherit your shell `PATH`), set `STARNET_CLAUDE_BIN=/full/path/to/claude`. `which claude` in Terminal shows the path.

## Limits

- StarNet's own loop features don't apply to these agents: step and iteration limits, compaction, model fallback chains, and per-run dollar caps. Your plan's usage limits apply instead.
- Tool calls show in the station as Claude Code reports them. `ToolSearch` may appear as Claude Code discovers StarNet tools on demand.
