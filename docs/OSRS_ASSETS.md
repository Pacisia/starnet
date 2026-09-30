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
