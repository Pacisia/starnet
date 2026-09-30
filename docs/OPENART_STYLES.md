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

The refinement pass uses role-specific contours instead of applying a single human outline to
every outfit. Portrait crops follow each concept's actual row positions. These are presentation
definitions; they do not write an appearance, model or role back into the roster.

`OpenArtWorld` registers five complete views through the existing `StationPresentation` API.
It shares the station projection and outline helpers, consumes the immutable station snapshot,
and renders real rooms, corridors, equipment footprints, ownership, crew positions and activity.
The current correction uses the native floor mask exactly, including holes and expanded rooms,
and the native viewport directly for pan, zoom, focus and resizing. Both world axes keep the
native scale: the floor is no longer skewed or compressed to fit the concept room. Switching
style preserves the camera rather than starting a new fitting baseline.
The native simulation still runs first. The artwork never decides an agent's destination, task,
tool permission, capability or station layout. Specialist compute stations can use a role-specific
desk silhouette; their canonical capability and ID are retained.

Floor patches project onto actual native floor spans, including holes, corridors and added
rooms. Wall and cap patches follow that same station outline; raised hull and sprite artwork
provide visual depth without changing the floor footprint. The native `SpaceBG` paints the
space backdrop using the current camera. Isolated previews use a cached starfield/nebula
fallback when that native module is absent. Planet/city windows fit a real rear wall; the airship uses
portholes. Flat console sources receive textured bases. Depth ordering, contact shadows and
collision-aware live name/role labels keep crew and equipment readable. Unrecognized future
props get a visible, pickable fallback instead of disappearing.

Hull panels use wider structural spans, raised trim and lower sills. Floor material panels share
a restrained room-wide light falloff. Layered equipment-footprint and foot shadows are clipped
to the actual floor, including holes, and drawn before all entities. The frame loop does no
pixel readback and cached terrain is reused until geometry or the view changes.

Walking animation uses the native position, facing and odometer. Working, waiting, seated and
resting poses use native state; reduced motion disables the added gait/pulse. Sprite and label
hits resolve to real agent/equipment identities. Clicking them opens the existing StarNet
inspection surfaces. With more than 12 crew, hovered, waiting and active/tool-using names take
priority; idle names remain in the crew panel and appear on hover. Overlapping non-hovered
labels can be omitted. Every real body and equipment object remains drawn and pickable. The
live minimap uses canonical placement and equipment users.

`openart-client.css` supplies each concept's client composition and decorative surfaces without
reusing its printed example values. The original event stream, conversations, command composer,
model/agent/attachment/voice controls, native windows and automation-resume control remain wired
to their existing handlers. No mock task percentages or status feed are introduced.

The footer's eight real-window buttons now sample the actual reference icon cells. Their desktop
strip spans the reference's bottom-right area. At desktop widths of 861–1100 px it now fits
inside the narrower right rail, while chat filters and the four native footer menus use separate
rows. Minimized-window restore chips get their own row when present. At widths up to 860 px
the decorative dock is hidden and the native menu row remains. Crew cards retain their full
contents in the scrolling rail. Rows show the real agent name and current status alongside the
source portrait. Alternate styles hide the native and sampled header logos while retaining
style/camera controls; Original keeps its native header. Actual roles
remain available in the row title and native dossier. System font stacks match the four sci-fi
concepts' condensed sans lettering and the airship's serif treatment; no external font requests
are added. OSRS's independent fonts, markup behavior and appearance options remain unchanged.

## Scope and visual limits

These are source-backed 2D overhead station renderers with raised walls and sprites, not fully
modeled 3D scenes. Source characters
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

Before the current native geometry/camera correction, 16 focused headless suites passed. Those
earlier presentation checks included all eight picker entries,
source dimensions, frozen definitions, real identity/picking, coordinate inversion, fallback,
role/model/skin preservation, motion continuity and cosmetic preference isolation.

All five shipped renderers were also executed directly with decoded source assets against an
immutable seeded station containing nine agents and 19 placed props. Each rendered successfully,
produced agent/equipment hit bounds and left the input state unchanged. `renderer-previews/`
in the handoff ZIP contains these direct outputs, not live-browser screenshots or provider runs.
The prior OSRS renderer previews are retained. OSRS art assets and cosmetic options are retained;
its world renderer now shares the corrected native camera, backdrop and dense-label behavior.

The direct check is reproducible after the existing `npm ci`:

```sh
node scripts/render-station-style-previews.mjs --out /absolute/path/to/renderer-previews
```

It uses the bundled canonical review-station fixture, decodes the actual PNG sources and runs
each shipped renderer in a separate process to bound native image memory. It checks decoded
visible/transparent sprite boundaries, the immutable snapshot, agent/equipment hit counts and
canonical picking. The current script also checks native fit, pan, zoom and resize. Add
`--dense` for the frozen 39-agent, 102-equipment station and dense-label/hover identity checks.
It performs no provider calls and needs no saved user workspace, server or browser. These captures verify renderer execution; they do not replace browser layout checks.

This correction passed 18 focused suites and direct dense execution of all five shipped views
with 39 agents and 102 equipment objects, including native fit/pan/zoom/resize, exact tile
boundaries, canonical picking, sparse idle labels, hover identification and immutable inputs.
The current browser attempt booted the isolated sidecar but Chrome aborted before CDP because
its local singleton socket returned `EPERM`. Current browser layout validation is therefore
blocked, not passing. Earlier Chrome runs on 1 October 2026 had a similar local IPC limitation
and a rejected escalation.
`scripts/verify-station-themes.mjs` is extended
for the five loaded sources and their real NPC interactions, as well as the existing original,
OSRS/armour, holographic, persistence and compact-layout checks. Run it in a normal development
environment with a working `SKYNET_CHROME` executable. The last completed browser pass was
`c83f238`, before this revision. The existing full release-claims audit failure is documented in
`STATION_THEMES.md`; its ledger was not weakened.

## Rollback and further styles

**UI STYLE → Original StarNet** restores native presentation. OSRS remains independently
available with all existing NPC/armour options. `rollback/pre-openart-styles-d99ff0e` preserves
the pre-OpenArt code; no data migration is required.
`rollback/pre-openart-polish-7b9b8ba` preserves the first five-style revision before the graphics
refinement pass.

For another concept-backed view, add a catalog entry, a source image and a frozen asset definition.
For a different rendering system, register its own complete view with `draw`, `clientToWorld`,
`worldToCanvas` and `reset`. Keep all core state and mutations in the existing StarNet modules.
