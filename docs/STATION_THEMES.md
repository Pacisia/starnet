# Station UI themes

This experiment starts at `f39699c723f28b56c358ef9079ccb0da15f77c21` (Pacisia's latest
`feat/harness-backend` on 30 September 2026). The working branch is
`feat/station-ui-themes`; `rollback/pre-station-ui-themes-f39699c` identifies the baseline.

## Using the picker

The **UI STYLE** picker is in the station's top bar. The same choices are available in
**Settings → Appearance → Station UI**:

- **Original StarNet**: the native station, sprites, panels and conversation layout.
- **OSRS Guild**: stone floors, timber and metal capability equipment, original low-poly
  fantasy crew, a stone-framed minimap and a parchment conversation/activity area.
- **Neon Cyberpunk**: violet floors, neon signals and armored crew.
- **Holographic Command**: a blue wireframe deck with translucent projected crew.

Selection applies immediately, including during a running task. It persists per browser/app
origin in `starnet.presentation.v1`. It is deliberately independent of the saved phosphor
color, station document, roster and cloud save. Picking Original restores the native view.

## Existing architecture and the small extension

StarNet is a Tauri desktop shell around the Node sidecar, with a dependency-ordered plain
JavaScript frontend. It has no React/Vue migration or frontend build step.

| Existing module | Authority retained |
| --- | --- |
| `app/app.js`, `app/save.js` | Agent roster, models, run state and saved station |
| `app/worldmodel.js` | Rooms, props, capability mapping and serializable station document |
| `app/world.js` | Pathfinding, world coordinates, seating, interactions, animation state and camera |
| `app/worldrenderer.js`, `app/stationbake.js` | Canvas composition, depth ordering, bake geometry and lighting |
| `app/toolprops.js`, sidecar capability registry | Tool-to-equipment mapping and permissions |
| `app/workstreams.js`, `app/chat.js`, `app/stationui.js` | Conversations, tasks, missions, agent dossiers and navigation |
| `shared/events.js` | Existing activity contract, unchanged |

The additions are confined to presentation:

1. `presentation-themes.js`: validated theme catalog and its independent local preference.
2. `station-presentation.js`: `drawBase`, `drawProp`, `drawBody` adapters and deterministic
   role-to-character mapping. A false/null result delegates to native rendering. Further
   render adapters can be registered without changing the agent engine.
3. `World.presentationSnapshot()`: immutable floor spans, equipment and visual agent state.
   It exposes no prompts, credentials or writable simulation references. The floor projection
   is cached by geometry identity; the minimap samples live bodies at four updates per second.
4. `station-theme-ui.js` and `station-themes.css`: picker, optional game-client layout,
   minimap, read-only instruments and a bounded activity feed. Existing windows and handlers
   remain the navigation targets. There are no new backend API endpoints or capability grants.

Only small hooks are added at the existing world/base, prop and body draw boundaries. Native
pathfinding, hit testing, conveyors, ownership, task progress, permissions and save logic remain
authoritative. No agent skin is rewritten in the roster when changing theme.

Alternate renderers bypass the native CRT grain, bloom and curved-screen pass, including its
inverse pointer transform, for clean readable art. The stored CRT/phosphor preferences are retained
and apply again in Original. The generated `website/app` mirror is synchronized from `frontend`,
including the fork's latest custom-provider endpoint form changes already present in the source.

## Crew and activity

Research → mage; analytics → elder scholar; content → ranger; security → knight;
data → crafter/cook; finance → banker; integrations → elf; engineering → dwarf;
web → traveller; orchestrator → operator. Explicit specialties take priority over names
or purpose text. Characters are drawn from original procedural artwork, rather than
embedded screenshots or a downloaded RuneScape client. This is an OSRS-inspired experiment,
not a pixel-identical reproduction of the supplied concept images.

Walking uses the existing body's position, facing and odometer. Idle, working, seated and sleeping
poses use the simulation's state; reduced motion makes the added animation steady. The
existing simulation moves working agents to their assigned workstation and handles leisure
equipment interactions. This change does not invent a separate movement simulation or make
every tool call trigger a new physical trip. The existing equipment pulse and activity
mapping still identify real tool operations. More detailed per-tool trips would be a
separate simulation feature shared by all renderers.

The minimap displays current crew, placed equipment and the camera viewport. Click crew to
focus their real body and open its existing dossier. Click equipment to inspect its capability
and current users; click the map to pan. Enter/Space restores the station overview. Token
usage, models, queues and detailed task history remain in the existing dossier/conversation
surfaces; no invented metrics or mission percentages are shown.

**Conversation / Station activity** changes which log is visible while keeping the existing
composer. Focusing the composer returns to the conversation. The activity log subscribes to
existing run/tool/verification/delivery events, uses escaped text, stores at most 120 entries
in memory and starts with an honest empty state. Current Work lists actual busy sessions.

The compact layout retains the live world, a small minimap, conversation and all existing dock
menus on narrow screens. Expanded conversation mode still uses the original conversation.

## Rollback and parallel use

The default branch is never overwritten or merged by this experiment. Keep the original
checkout running and use a second checkout/worktree for the theme branch. If running both
sidecars, use a different `SKYNET_PORT` and a separate `SKYNET_WORKSPACES` directory; do not
run two sidecars against the same workspace. Use StarNet's normal backup/export and restore
workflow when copying real station data into the experimental instance.

UI-only rollback is simply **UI STYLE → Original StarNet**. Code rollback is returning the
experimental checkout to the baseline branch/commit. No station migration is needed.

## Verification

Passed on the isolated copy:

- `node test/presentation-themes.test.js`: preference isolation, invalid storage, role identity,
  frozen render inputs, native fallback, sleeping pose and reduced motion.
- `SKYNET_CHROME=<chrome-path> node scripts/run-fast-tests.mjs presentation-themes world station-authority crew-containment settings-p1 bootguard`:
  20 suites, including actual WebGL/Canvas renderer parity, geometry, lifecycle, seating, movement,
  station authority and settings.
- `SKYNET_CHROME=<chrome-path> node scripts/verify-station-themes.mjs`: real browser picker changes,
  station/roster identity preservation, frozen projections, real minimap clicks opening native
  dossiers and equipment inspection, event escaping/filter/cap, working-state preservation,
  Settings cards, expanded conversation, reload persistence and 390 × 844 layout.
- Desktop captures of all four styles at 1536 × 1024 and the OSRS phone layout: no browser exceptions.
- Website mirror synchronization and `git diff --check`.

The complete `npm run test:fast` gate is **not green**. It reached step 293/844 and failed
`qa-product-perfect-claims.test.js`. Read-only inspection against the untouched baseline commit
`f39699c` confirms the existing source-lock audit already rejects seven changed frontend files;
the shallow clone also lacks the source commit's ancestry. The claims ledger was not weakened or
restamped by this experiment. The preceding 292 steps passed. These checks do not certify the
repository's release claims.

Browser validation should use the seeded sidecar with its own workspace and port. Check all
four themes, Settings, the minimap, agent dossiers, real event projection, expanded
conversation, return to Original, persistence after reload and a narrow viewport. The
seed has placeholder credentials: it exercises the real local app without making paid model
calls. It does not certify an actual provider run or desktop packaging on iPhone/Windows/macOS.
