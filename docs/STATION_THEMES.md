# Station UI themes

This experiment starts at `f39699c723f28b56c358ef9079ccb0da15f77c21` (Pacisia's latest
`feat/harness-backend` on 30 September 2026). The working branch is
`feat/station-ui-themes`; `rollback/pre-station-ui-themes-f39699c` identifies the baseline.
`rollback/osrs-v1-267c8fe` preserves the first theme implementation before the reference revision.

## Using the picker

The **UI STYLE** picker is in the station's top bar. The same choices are available in
**Settings → Appearance → Station UI**:

- **Original StarNet**: the native station, sprites, panels and conversation layout.
- **OSRS Guild**: the supplied reference's gold header, stone and wood client framing,
  perspective stone station, detailed fantasy NPCs, timber/CRT capability equipment,
  circular live minimap with real station counts and parchment chat/activity area.
- **Space Colony**: rugged habitat equipment, astronaut crew, off-white hull panels and a planet window.
- **Cyberpunk Workshop**: detailed neon-city workshop, specialist crew and industrial consoles.
- **Starship Bridge**: command uniforms, polished consoles, tactical table and orbital observation window.
- **Steampunk Airship**: brass machinery, timber deck, Victorian crew and circular portholes.
- **Secret-Agent HQ**: covert operatives, green intelligence consoles, archives and a mission map.
- **Holographic Command**: a blue wireframe deck with translucent projected crew.

The five new styles use the approved OpenArt concepts as their actual asset sources, including
crew, equipment, framing, icons and room materials. Their settings cards display those concepts.
The OSRS renderer, appearance dialog and all OSRS assets are unchanged from `d99ff0e`.

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
5. `osrs-world.js` and `osrs-client.css`: a separate perspective renderer and the reference client
   layout. The renderer consumes the same immutable snapshot, paints after native simulation,
   conveyor and delivery processing, and inverts its own projection for native mouse picking.
   Sprite and label hit rectangles resolve to canonical agent/equipment coordinates. Pan, zoom,
   camera focus, minimap selection and station expansion continue to use the existing world.
   Sprite alpha bounds and wall outlines are cached; the frame loop does no pixel readback.
   Complete views register through `StationPresentation.registerView(themeId, renderer)` with
   `draw`, `clientToWorld`, `worldToCanvas` and `reset` methods. Future perspective/3D renderers
   use the same hooks; core world code contains no OSRS-specific view selection.
6. `station-art.js`, `openart-world.js` and `openart-client.css`: five concept-backed complete
   views using that existing renderer API. Each loads its own preserved 3072 × 2048 source PNG
   on demand, extracts and caches presentation assets, and draws the actual station layout,
   equipment and agent state. The geometry helpers are shared with the existing perspective
   view. Neither the artwork nor its printed example values become application state.

Only small hooks are added at the existing world/base, prop and body draw boundaries. Native
pathfinding, entity selection, conveyors, ownership, task progress, permissions and save logic remain
authoritative. No agent skin is rewritten in the roster when changing theme.

Alternate renderers bypass the native CRT grain, bloom and curved-screen pass, including its
inverse pointer transform, for clean readable art. The stored CRT/phosphor preferences are retained
and apply again in Original. The generated `website/app` mirror is synchronized from `frontend`,
including the fork's latest custom-provider endpoint form changes already present in the source.

## Crew and activity

Research → mage; analytics → elder scholar; content → ranger; security → knight;
data → crafter/cook; finance → banker; integrations → elf; engineering → dwarf;
web → traveller; orchestrator → operator. Explicit specialties take priority over names
or purpose text. The OSRS revision uses generated sprite atlases with four facing directions,
including distinct traveller and operator art. The five OpenArt styles use role-specific source
crew cutouts and matching sidebar portraits; Holographic Command retains its procedural art.
The supplied images provide decorative client framing and icons. The station scene,
NPC locations, equipment, minimap, counts and activity are rendered from live state.
The current revision also samples empty stone surfaces and banners from the supplied reference,
projects them onto canonical floor/wall geometry and caches terrain and sprite colour grading.
The source image's fixed values, agents and progress messages are never used as live telemetry.
See `OSRS_ASSETS.md` for asset provenance and the bundled font license.
See `OPENART_STYLES.md` and `OPENART_SOURCES.json` for the five concepts, extraction method,
animation limits and exact source provenance.

Walking uses the existing body's position, facing and odometer. Idle, working, seated and sleeping
poses use the simulation's state; seated sprites compress their lower pose, resting sprites lie
down, and working equipment/agents show activity. Labels avoid each other when a crew gathers.
Reduced motion makes the added animation steady. The
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

**Conversation / Station activity**, or the OSRS footer's real activity channels, changes which log is visible while keeping the existing
composer. Focusing the composer returns to the conversation. The activity log subscribes to
existing run/tool/verification/delivery events, uses escaped text, stores at most 120 entries
in memory. Connection and crew arrivals are reported from observed state. Current Mission lists
actual busy sessions and never invents a progress percentage. **Controls** exposes the existing
agent/model/attachment/voice controls; they also appear when the composer receives focus.

The compact layout retains the live world, a small minimap, conversation and all existing dock
menus on narrow screens. Expanded conversation mode still uses the original conversation.

## Per-agent NPCs and armour

**NPCs & armour** in the OSRS header opens a keyboard-accessible appearance picker. The small
appearance button beside each crew member opens it for that agent; dossiers opened through the
minimap/crew also expose Appearance. Choose any of the ten role archetypes or full bronze, iron,
steel, black, mithril, adamant, rune or dragon armour. Each armour includes a full helm, platebody,
platelegs, shield and scimitar in four facing directions. **Follow role** restores the default.

`osrs-appearance.js` owns a validated cosmetic catalog and the separate local preference
`starnet.osrs.appearances.v1`, indexed by stable agent ID. `osrs-appearance-ui.js` owns the dialog.
Neither changes canonical skins, specialties, models, capabilities, paths, tasks or station saves.
An armoured research agent remains a research agent. Labels retain the actual role, the sidebar
portrait matches the current look, and changes take effect on the existing moving body. Preferences
persist for the browser/app origin and synchronize across windows. Original and the other themes
continue to use their original art. The original character atlases are retained.

## Rollback and parallel use

The default branch is never overwritten or merged by this experiment. Keep the original
checkout running and use a second checkout/worktree for the theme branch. If running both
sidecars, use a different `SKYNET_PORT` and a separate `SKYNET_WORKSPACES` directory; do not
run two sidecars against the same workspace. Use StarNet's normal backup/export and restore
workflow when copying real station data into the experimental instance.

UI-only rollback is simply **UI STYLE → Original StarNet**. Code rollback is returning the
experimental checkout to the baseline branch/commit. No station migration is needed.
`rollback/pre-openart-styles-d99ff0e` preserves the approved OSRS/armour revision before these
five new styles. The bundle includes that commit, so the same rollback branch can be recreated.

## Verification

The previous complete browser pass was at commit `c83f238`; it validated the four original
presentations before the armour/material and OpenArt revisions. Current validation:

- 16 focused headless suites passed for cosmetic/theme isolation, world model, native body clicks,
  character rendering, settings, station authority, containment, seating, approval and movement.
- Direct execution of the actual `OSRSWorld` renderer against immutable seeded state validated
  the loaded atlases, rune/dragon body draws, and all 684 agent × appearance × facing sprite
  combinations. Renderer previews are explicitly identified; they are not live app screenshots.
- Direct execution of all five shipped `OpenArtWorld` views loaded the preserved source images,
  rendered nine real fixture agents and 19 placed props, produced picking bounds, and left all
  immutable station inputs unchanged. The current previews capture this renderer execution.
- Theme tests also cover all eight catalog entries, the source PNG dimensions, immutable asset
  definitions, complete-view switching, real equipment identities, inverse coordinates, native
  fallback and reduced-motion/odometer behavior. The source and assets for OSRS are byte-identical
  to the pre-OpenArt rollback commit.
- The expanded `scripts/verify-station-themes.mjs` checks all eight styles, real new-theme agent
  picking, source-backed framing, rune/dragon on a working agent, unchanged canonical data,
  per-agent reload/reset and a phone-size appearance picker. Current browser checks remain
  unverified: the available Chrome attempt was blocked by local IPC policy, escalation was
  rejected, and a later configured Chrome path had no executable. Do not treat these checks as passed.
- Website mirror synchronization and `git diff --check` passed.

Earlier browser validation (before this revision):

- `node test/presentation-themes.test.js`: preference isolation, invalid storage, role identity,
  frozen render inputs, native fallback, sleeping pose and reduced motion.
  Also checks inverse perspective picking across camera pans and zooms, and equipment mappings.
- `SKYNET_CHROME=<chrome-path> node scripts/run-fast-tests.mjs presentation-themes world station-authority crew-containment settings-p1 bootguard`:
  20 suites, including actual WebGL/Canvas renderer parity, geometry, lifecycle, seating, movement,
  station authority and settings.
- `SKYNET_CHROME=<chrome-path> node scripts/verify-station-themes.mjs`: real browser picker changes,
  station/roster identity preservation, frozen projections, real minimap clicks opening native
  dossiers and equipment inspection, perspective NPC clicks and canonical equipment picking,
  event escaping/filter/cap, working-state preservation,
  Settings cards, expanded conversation, reload persistence and 390 × 844 layout.
- Desktop captures of all four styles at 1536 × 1024 and the OSRS phone layout: no browser exceptions.
  The reference review uses a separate seeded workspace with a shaped floor, placed capability
  equipment and role-specific agents, at 100% text size. Agent placement uses existing review
  controls for the screenshot; no user station is rearranged by switching renderer.
- Website mirror synchronization and `git diff --check`.

The complete `npm run test:fast` gate is **not green**. It reached step 293/844 and failed
`qa-product-perfect-claims.test.js`. Read-only inspection against the untouched baseline commit
`f39699c` confirms the existing source-lock audit already rejects seven changed frontend files;
the shallow clone also lacks the source commit's ancestry. The claims ledger was not weakened or
restamped by this experiment. The preceding 292 steps passed. These checks do not certify the
repository's release claims.

Browser validation should use the seeded sidecar with its own workspace and port. Check all
eight themes, Settings, the minimap, agent dossiers, real event projection, expanded
conversation, return to Original, persistence after reload and a narrow viewport. The
seed has placeholder credentials: it exercises the real local app without making paid model
calls. It does not certify an actual provider run or desktop packaging on iPhone/Windows/macOS.

A graphics-only rollback branch is `rollback/pre-armour-and-reference-c83f238`, retaining the
previous OSRS client. The new material/cosmetic preferences require no station migration.
