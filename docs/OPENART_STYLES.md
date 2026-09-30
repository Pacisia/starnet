# Five OpenArt station presentations

The approved five concepts are used as asset sources in working views of the existing StarNet
station. This revision changes presentation files, the picker, checks and the generated website
mirror. It does not change the autonomous-agent engine, APIs, station save format, capability
registry, pathfinding or original/OSRS art.

## Sources

OpenArt project: **StarNet — Five Station Styles**, `zf4FouqMBEcNBGReHqEg`.
All five generation jobs completed on 30 September 2026. Each original PNG is 3072 × 2048.
`OPENART_SOURCES.json` records the complete prompts, generation IDs, CDN URLs, local paths and
SHA-256 hashes. Originals are preserved without recompression.

| Picker style | Source history ID | Room and crew direction |
| --- | --- | --- |
| Space Colony | `qmAyhwuvo0zonqYjTdgA` | Industrial orbital habitat, astronaut specialists, rugged blue consoles |
| Cyberpunk Workshop | `OKvsp0UYpZ7zYNYq9JrT` | Neon city, augmented technicians, industrial benches and media equipment |
| Starship Bridge | `P4XJcfdWVViXfltDF4lG` | Command uniforms, orbital view, polished consoles and a tactical table |
| Steampunk Airship | `vcscF6o8wdFPlCPucRLk` | Brass machinery, timber floor, portholes and Victorian specialists |
| Secret-Agent HQ | `byQf0pxPAgRquxY2mbZA` | Covert operatives, intelligence desks, archive equipment and a mission map |

Their local source path is `frontend/assets/station-styles/<theme-id>/reference.png`.
The generated website mirror contains identical bytes. These source images are concept art;
their example task counts, names, mission progress and printed chat are not live telemetry.

## From concept to functioning station

`StationArt` owns frozen source definitions on a 1536 × 1024 coordinate grid. It lazily loads
the selected original, extracts role silhouettes, equipment, matching sidebar portraits,
clean material patches and decorative client surfaces, then caches the results. Where a source
desk hides a character's legs, compatible trouser/boot pixels from that same concept complete
the walking entity. Where a source worker covers equipment, clean source console panels replace
the occluded portion so a frozen duplicate worker is not painted into the station.

`OpenArtWorld` registers five complete views through the existing `StationPresentation` API.
It shares the perspective projection and outline helpers, consumes the immutable station
snapshot, and renders real rooms, equipment footprints, ownership, crew positions and activity.
The native simulation still runs first. The artwork never decides an agent's destination, task,
tool permission, capability or station layout. Specialist compute stations can use a role-specific
desk silhouette; their canonical capability and ID are retained.

Floor patches project onto actual floor spans, including holes and added rooms. Wall and cap
patches follow the station outline. Planet/city windows fit a real rear wall; the airship uses
portholes. Flat console sources receive textured bases. Depth ordering, contact shadows and
collision-aware live name/role labels keep crew and equipment readable. Unrecognized future
props get a visible, pickable fallback instead of disappearing.

Walking animation uses the native position, facing and odometer. Working, waiting, seated and
resting poses use native state; reduced motion disables the added gait/pulse. Sprite and label
hits resolve to real agent/equipment identities. Clicking them opens the existing StarNet
inspection surfaces. The live minimap uses canonical placement and equipment users.

`openart-client.css` supplies each concept's client composition and decorative surfaces without
reusing its printed example values. The original event stream, conversations, command composer,
model/agent/attachment/voice controls, native windows and automation-resume control remain wired
to their existing handlers. No mock task percentages or status feed are introduced.

## Scope and visual limits

These are source-backed 2D perspective renderers, not fully modeled 3D scenes. Source characters
have one photographed pose plus mirroring, gait, seat and rest transformations; they do not have
the OSRS atlas's four authored facings or bespoke tool-use clips. Occluded portions are
reconstructed from the approved image. A production asset pass can replace those cutouts with
clean isolated sprites or rigged models behind the same renderer API.

The working view adapts the art to the user's actual station geometry and activity. It therefore
does not reproduce the static concept pixel for pixel. Its equipment count, layout, agent names,
locations, mission state and messages follow the real application. Switching style does not
rearrange a station to match a concept. More precise per-tool trips remain a shared simulation
feature, rather than theme-specific decorative behavior.

## Validation and review

The 16 focused headless suites pass. The presentation checks include all eight picker entries,
source dimensions, frozen definitions, real identity/picking, coordinate inversion, fallback,
role/model/skin preservation, motion continuity and cosmetic preference isolation.

All five shipped renderers were also executed directly with decoded source assets against an
immutable seeded station containing nine agents and 19 placed props. Each rendered successfully,
produced agent/equipment hit bounds and left the input state unchanged. `renderer-previews/`
in the handoff ZIP contains these direct outputs, not live-browser screenshots or provider runs.
The prior OSRS renderer previews are retained. OSRS source and assets compare byte for byte
against `d99ff0e7341baa14d5959127ba4bd67f2d8778fb`.

Full current browser validation remains pending. `scripts/verify-station-themes.mjs` is extended
for the five loaded sources and their real NPC interactions, as well as the existing original,
OSRS/armour, holographic, persistence and compact-layout checks. Run it in a normal development
environment with a working `SKYNET_CHROME` executable. The last completed browser pass was
`c83f238`, before this revision. The existing full release-claims audit failure is documented in
`STATION_THEMES.md`; its ledger was not weakened.

## Rollback and further styles

**UI STYLE → Original StarNet** restores native presentation. OSRS remains independently
available with all existing NPC/armour options. `rollback/pre-openart-styles-d99ff0e` preserves
the pre-OpenArt code; no data migration is required.

For another concept-backed view, add a catalog entry, a source image and a frozen asset definition.
For a different rendering system, register its own complete view with `draw`, `clientToWorld`,
`worldToCanvas` and `reset`. Keep all core state and mutations in the existing StarNet modules.
