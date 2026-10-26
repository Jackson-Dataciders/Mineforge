# Specs

Every feature or phase gets a spec **before** implementation starts. A spec is the agreement on what to build; the plan and the code follow it.

- **File name:** `NN-name.md`, numbered in creation order (`01-auth.md`, `02-storage-layer.md`, …). Use kebab-case and English.
- **Start from** [00-template.md](00-template.md). The `new-feature` skill does this for you.
- **Status** at the top: `draft` → `approved` (by the user) → `implemented`. Do not implement a draft.
- Use the terms from [../glossary.md](../glossary.md).
- If implementation shows the spec is wrong, update the spec in the same change. Never leave code and spec disagreeing.
- Decisions that are hard to reverse or affect other features go into an ADR (`docs/adr/`), linked from the spec.

## Index

| #   | Spec                                                                | Status      |
| --- | ------------------------------------------------------------------- | ----------- |
| 01  | [Foundation](01-foundation.md)                                      | implemented |
| 02  | [Jar extraction and import skill](02-jar-extraction.md)             | implemented |
| 03  | [Modpack Planner](03-modpack-planner.md)                            | implemented |
| 04  | [Mod Designer entries](04-mod-designer-entries.md)                  | implemented |
| 05  | [Designer tasks and taskboard](05-designer-tasks.md)                | implemented |
| 06  | [Mind map](06-mind-map.md)                                          | implemented |
| 07  | [Phone pass, README and final review](07-phone-pass-and-release.md) | implemented |

Add a row here for every new spec.
