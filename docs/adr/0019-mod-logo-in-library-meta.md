# 0019. Mod logo in library meta

- **Status:** accepted
- **Date:** 2026-10-25
- **Refines:** [0017](0017-library-data-format.md) (adds the `logo` field to `meta.json`)

## Context

The phase 3 library page shows an icon per library mod. The phase 2 extraction copied only item textures, so there was no mod-level icon. Mods declare a logo in their metadata: `logoFile` in `neoforge.mods.toml`/`mods.toml`, and `icon` in `fabric.mod.json`, where `icon` is a path or a map from size to path. The user chose extracting that logo over using the first item's icon.

## Decision

- **Source:**
  - NeoForge/Forge: the first `[[mods]]` entry's `logoFile`, else the top-level `logoFile`;
  - Fabric: `icon`. For a size map, the largest size ≤ 256, else the smallest.
- **Copied only if** the path ends in `.png` and the file exists in the jar.
- **Destination:** `assets/textures/<modid>/_logo.png`, served by the existing texture route. The leading `_` keeps it apart from the mod's own textures, which live in `item/`, `block/` and similar folders.
- **`meta.json`:** `logo: "<modid>/_logo.png" | null`. The schema defaults it to `null`, so meta files written before this change stay valid.

## Consequences

- Library mods imported before this change show a placeholder until they are re-imported (re-running the script adds the logo).
- Logos are often larger than 16×16, so the UI scales them down without pixelated rendering.
- The script's output now includes one more texture file per mod.

## Alternatives considered

- **First item's icon:** needs no extraction change, but is often not representative of the mod. The user rejected it.
- **A separate `assets/logos/` folder:** would need another authenticated asset route for no gain.
