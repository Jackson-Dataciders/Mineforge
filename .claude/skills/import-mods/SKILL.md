---
name: import-mods
description: Import Minecraft mod jars into the planner's data. Use when asked to import, add or sync mods, or when jars in jars/ have no matching data in data/library/ or data/vanilla/.
---

# Import mods

Turns mod jars into planner data: metadata, items, recipes, tags and icons. The deterministic extraction script does the bulk of the work; you only add what the script cannot see, and you mark it clearly, because inferred data may be wrong and the user must be able to tell it apart.

## Inputs

The user may provide, in any combination:
- nothing → import all pending jars
- one or more Modrinth project slugs or URLs → download those first (see step 1)
- `--force <modid>` → re-import a mod that already has data

## Steps

### 1. Collect jars

- If Modrinth slugs or URLs were given: use the Modrinth API to find the newest version for Minecraft 1.21.1 with loader `neoforge`, and download its primary file into `jars/mods/`. If the network blocks Modrinth, stop this step, tell the user, and continue with jars already in the repo.
- Find pending jars: every jar in `jars/mods/` whose mod id has no `data/library/<modid>/meta.json`, plus the vanilla jar in `jars/vanilla/` if `data/vanilla/1.21.1/items.json` is missing. Read the mod id from the jar's metadata, not from the file name, because file names are unreliable.
- If nothing is pending and nothing was forced, say so and stop.

### 2. Extract (deterministic)

For each pending jar, run:

```
npx tsx tools/extract-jar.ts <path-to-jar>
```

Do not edit the generated files by hand in this step. If the script fails on a jar, record the error, skip that jar and continue with the others.

### 3. Infer what extraction missed (library mods only)

Skip this step for the vanilla jar.

1. Decompile the jar's classes with CFR (download the CFR jar from Maven Central if it isn't available). If Java or CFR is unavailable, skip this step and say so in the report.
2. Look for item and block registrations (`DeferredRegister`, `DeferredItems`/`DeferredBlocks`, `Registry.register`, registration helpers, registration inside loops over enums or material lists).
3. Compare them with the extracted `items.json`. Add an item only if the code shows a registration whose ID you can fully resolve from the code (constants, enum values, static lists). Never add IDs based on guesses, config values or runtime data.
4. Do the same for recipes built in code, if any are clearly resolvable.
5. Every added record gets `"source": "inferred"` and an `"evidence"` field naming the class (and method) it came from.
6. For items with no texture found, leave the icon empty rather than picking an unrelated texture.

Keep the files sorted and formatted like the script's output, so diffs stay clean.

### 4. Check dependencies

Compare each imported mod's declared required dependencies (from `meta.json`) with the mods present in `data/library/`. Ignore `minecraft`, `neoforge`, `forge`, `fabricloader` and `java`. List missing ones in the report; do not download them unless the user asked.

### 5. Commit

Commit all new and changed files under `jars/`, `data/` and `assets/` in one commit:

```
data: import <modid>[, <modid>...]
```

Push to the default branch.

## Report

End with a short report, one line per mod:

```
<modid> <version> — <n> items (<k> inferred), <r> recipes, <t> tags, <i> icons missing
```

Then list: skipped jars with their error, missing dependencies, and anything that could not be done (network, Java, CFR).

## Rules

- Never delete or modify data of mods that weren't part of this import, because the user's planning data references them.
- Never touch `data/custom-mods/` or `data/modpacks/`; those are edited only through the app.
- Never commit secrets or tokens.
