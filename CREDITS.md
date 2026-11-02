# Credits

Aerondel's code, models and names are original. Meshes are built in code (no downloaded models), so the game stays light on phones.

## Third-party assets (all CC0 1.0 / public domain)

- **ambientCG** (https://ambientcg.com): Moss002, Ground037, Rock030, Grass004, ScatteredLeaves008, Snow010A photo sets, used as terrain detail. See `textures/CREDITS.md`.
- **Poly Haven** (https://polyhaven.com): cobblestone_floor_04, used as plaza cobble detail.

CC0 needs no attribution; it's listed here anyway. Other free CC0 sources that fit the art style for later
(models are not bundled yet, to keep the download small): Kenney (https://kenney.nl), Quaternius (https://quaternius.com).

## Libraries

- three.js (MIT), loaded from a CDN.

## 3D models (`models/`)

All models are **CC0 1.0 (public domain)** by **Kenney** (https://kenney.nl), downloaded Nov 2026 and
rebuilt with `tools/build-models.mjs` (dedup, weld, simplify, WebP textures ≤512 px, meshopt). In-game
names are original; pack names are only listed here. License: https://creativecommons.org/publicdomain/zero/1.0/

| Folder | Pack | URL | Used for |
|---|---|---|---|
| `models/nature/` | Nature Kit (Kenney) | https://kenney.nl/assets/nature-kit | broadleaf, autumn, pine, palm, cactus and dead trees; rocks; bushes |
| `models/nature/dead_a`, `dead_b`, `models/props/pillar_c`, `models/buildings/ogre_*` | Graveyard Kit (Kenney) | https://kenney.nl/assets/graveyard-kit | crooked dead pines, stone pillar, ogre stone halls |
| `models/props/`, `models/buildings/gob_*` | Survival Kit (Kenney) | https://kenney.nl/assets/survival-kit | crates, barrels, fire pit, goblin tents and huts |
| `models/props/`, `models/buildings/human_*`, `elf_*` | Fantasy Town Kit (Kenney) | https://kenney.nl/assets/fantasy-town-kit | fences, market stalls, cart; cottages and elven towers composed from its wall/roof modules |
| `models/characters/` | Mini Characters (Kenney) | https://kenney.nl/assets/mini-characters | animated townsfolk (idle, walk, gather, emote) |
