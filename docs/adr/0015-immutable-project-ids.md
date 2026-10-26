# 0015. Custom mod and modpack IDs are immutable folder names

- **Status:** accepted
- **Date:** 2026-10-25

## Context

Custom mods and modpacks live in folders named after their ID (`data/custom-mods/<modid>/`, `data/modpacks/<pack-id>/`). Entry IDs embed the mod ID (`<modid>:<name>`), packs reference custom mods by ID, and icons live under `assets/icons/<modid>/`. Renaming an ID would touch many files and references.

## Decision

- **Custom mod ID:** matches the NeoForge rule `^[a-z][a-z0-9_]{1,63}$`. It is suggested from the name (`suggestModId`) and editable on create. It must be unique among custom mods and must not equal a library mod ID. The namespaces `minecraft`, `neoforge`, `forge`, `fabric`, `fabricloader`, `kubejs` and `java` are reserved (`RESERVED_MOD_IDS`, error `idReserved`), so entries can't collide with game or loader IDs.
- **Modpack ID:** a kebab-case slug, `^[a-z0-9]+(-[a-z0-9]+)*$`, at most 64 characters. It is suggested from the name (`suggestPackId`) and unique among modpacks.
- IDs never change. "Rename" changes only `name`.
- Deleting a custom mod removes `data/custom-mods/<modid>/**`, `assets/icons/<modid>/**` and its ID from every `pack.json`, in one atomic commit after a confirmation that lists the affected packs.
- Deleting a modpack removes `data/modpacks/<pack-id>/**` in one commit.

## Consequences

- References stay valid forever; there is no rename migration.
- A typo in an ID can only be fixed by deleting and recreating (acceptable before content exists; later phases may add an export or copy if needed).

## Alternatives considered

- **Random IDs with display names only:** the mod ID is part of Minecraft item IDs and must be meaningful.
- **Renamable IDs with a migration:** many files and references per rename, with no benefit for a single user.
