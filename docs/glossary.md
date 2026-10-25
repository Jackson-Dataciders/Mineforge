# Glossary

These terms are canonical. Use them, with exactly these meanings, in code identifiers, file names, UI strings and docs. Do not introduce synonyms (e.g. "element", "addon", "card", "todo").

**Custom mod** — A mod the user designs in the Mod Designer. Stored in `data/custom-mods/<modid>/`. It has a mod ID, a current phase, entries, a layout (mind map positions) and manual tasks. Code: `CustomMod`.

**Library mod** — A third-party mod imported from a jar into the global library. Stored in `data/library/<modid>/`, created only by the `import-mods` skill, read-only in the app. Vanilla Minecraft data (`data/vanilla/1.21.1/`) is used alongside library mods but is not itself a library mod. Code: `LibraryMod`.

**Modpack** — A named set of references to library mods and custom mods, plus its recipe changes and manual tasks. Stored in `data/modpacks/<pack-id>/`. It references mods by ID and never copies their data. Code: `Modpack`.

**Entry** — One planned piece of content in a custom mod. Stored as `data/custom-mods/<modid>/entries/<entry-id>.json`. Every entry has an ID, a name, an entry type, a status, type-specific fields, and optionally recipes, an icon and relations to other entries. Code: `Entry`.

**Entry type** — The top-level category of an entry, stored in its `type` field. Exactly one of: `item`, `block`, `entity`, `structure`, `mechanic`, `multiblock`. It decides which fields the entry has (ADR 0009). Code: `EntryType`.

**Kind** — A subcategory within an entry type, stored in `kind`, which adds its own fields. For example, an item may be a tool or a food. Kinds exist only where a type's Zod schema defines them, and that schema is the only list of valid kinds. Code: `kind`, never "subtype" or "category".

**Status** — An entry's progress: `backlog` → `planned` → `implemented`. Completing a generated task advances it (ADR 0010); the user can also set it directly. Code: `EntryStatus`.

**Phase** — A custom mod's current project stage: `planning`, `implementation` or `optimization`. Each custom mod has exactly one current phase, which decides which generated tasks exist. Phases belong to custom mods; entries have a status, not a phase. Code: `ProjectPhase`.

**Generated task** — A task computed from entry data by a rule for the current phase. It is never stored as a task. Its stable key is `<rule-id>:<entry-id>`. Completing it advances the entry status. Code: `GeneratedTask`.

**Manual task** — A task the user creates by hand, stored with its own ID in a `tasks.json`. Custom mods have manual tasks next to generated tasks; modpacks have manual tasks next to KubeJS tasks. Completing one changes nothing else. Code: `ManualTask` (pack tasks: `type: "manual"`).

**KubeJS task** — A modpack task created automatically when a recipe change is saved, titled "Write KubeJS: <item name>" (the title comes from i18n, not from data). It offers "Export script" for its recipe change, is unchecked again when the change is edited, and is removed with the change (ADR 0020). Stored in the pack's `tasks.json` with `type: "kubejs"` and `recipeChangeId`. Code: `PackTask` with `type: "kubejs"`.

**Recipe change** — One modification to a modpack's recipes: add, remove or replace a recipe. Stored as `data/modpacks/<pack-id>/recipe-changes/<change-id>.json`; the change ID is also its KubeJS slug. Exported to KubeJS, one script per change (ADR 0008, 0018, 0020). Code: `RecipeChange`.

**Inferred data** — Library records (items, recipes) that the `import-mods` skill added from decompiled code rather than extracted from jar data files. Marked `"source": "inferred"` with an `"evidence"` field naming the class and method. The UI must show them as inferred. The opposite is `"source": "extracted"`.
