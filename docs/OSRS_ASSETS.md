# OSRS client asset provenance

- `frontend/assets/osrs-client/reference.jpg`: the user's supplied StarNet concept image,
  `B02EF833-4B88-4B03-9F34-48009BB617AF(1).jpeg`, used as the requested visual reference.
- SVG wrappers crop decorative framing, the gold brand, material textures and navigation icons
  from that image. The SVGs embed the image so they also load safely as CSS images offline.
  They do not provide the live station scene or its agents. Dynamic minimap and count fields
  cover the reference's map and fixed values.
- `npc-atlas.png`: generated original character art for mage, elder scholar, ranger, guard,
  cook, banker, elf and dwarf, in four facing directions; eight columns by four rows.
- `traveller-atlas.png`: generated original operator and traveller/scout art, in four facing
  directions; four columns by two rows. These are theme assets, not app screenshots.
- `prop-atlas.png`: generated original timber/CRT computer desk, engineering bench, cabinet,
  dish, research desk, server equipment, map table and plant; four columns by two rows.
- `osrs-plain.ttf` and `osrs-bold.ttf`: RuneScape Plain 12 and Bold 12 from the RuneStar/fonts
  1.103-0 release at https://github.com/RuneStar/fonts/releases/tag/1.103-0.
  The accompanying repository license is preserved in `FONT-LICENSE.txt`.

The frontend fetches all assets locally; the experimental theme makes no external font or
image requests. It does not embed or run a RuneScape client. Core capabilities, permissions,
agent models, paths and station documents are unchanged.

## Armour and reference materials revision

`frontend/assets/osrs-client/armour-atlas.png` is the new original armour atlas, eight columns
(bronze, iron, steel, black, mithril, adamant, rune, dragon) by four rows (south, west, north, east).
Generated with the built-in image-generation tool, then copied into the project. No CLI model was
used. Its transparent alpha is retained. The NPC/prop/traveller atlases remain available.

The renderer samples the supplied reference's empty floor, stone wall/cap surfaces and hanging
blue star banner. These are textures applied to live geometry, rather than a flattened station
background. Minimap equipment is drawn from the same atlas as the physical station equipment.

Armour generation prompt: replace the existing eight-column, four-row NPC atlas with full bronze,
iron, steel, black, mithril, adamant, rune and dragon sets; each cell contains one slender, elevated
orthographic OSRS-style knight wearing full helm, platebody, platelegs, gloves and boots, holding
a kite shield and curved scimitar. Use four consistent facing directions, generous transparent
gutters, muted matte faceted materials and the exact supplied client as style reference. Rune
uses deep cyan-blue and dragon uses deep crimson with a swept-point helmet. No background,
floor, text, cape, glow, baked shadow or overlapping cells.

The full production prompt is preserved in `OSRS_ARMOUR_PROMPT.txt`.

`frontend/assets/osrs-client/npc-atlas-v2.png` is a further reference-guided NPC art pass, using
the built-in image-generation tool and the supplied client image. It keeps the same eight roles
and four facing rows with clearer transparent gutters and overhead poses. The previous atlas
is retained. Its full production prompt is preserved in `OSRS_NPC_PROMPT.txt`.
