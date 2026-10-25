# Architecture decision records

An ADR records one decision that is hard to reverse or affects other features. Write a new one with the `new-adr` skill, starting from [0000-template.md](0000-template.md). Never rewrite an accepted ADR's decision. To change a decision, add a new ADR and set the old one's status to "superseded by NNNN". If the new ADR changes only one point of an older decision, the old status becomes "accepted (… refined by NNNN)" and names the point.

| #    | Decision                                                                                                     | Status   |
| ---- | ------------------------------------------------------------------------------------------------------------ | -------- |
| 0001 | [Next.js App Router + TS + React + Tailwind on Vercel, one repo](0001-nextjs-single-repo-on-vercel.md)       | accepted |
| 0002 | [The private GitHub repo is the database](0002-github-repo-as-database.md)                                   | accepted |
| 0003 | [Private repo, GitHub App for repo access](0003-private-repo-github-app.md)                                  | accepted |
| 0004 | [Auth.js GitHub login allowlisted to one user ID](0004-authjs-github-allowlist.md)                           | accepted |
| 0005 | [Direct browser-to-GitHub jar upload](0005-direct-jar-upload-to-github.md)                                   | accepted |
| 0006 | [Static extraction plus AI inference via the import-mods skill](0006-static-extraction-plus-ai-inference.md) | accepted |
| 0007 | [Target Minecraft 1.21.1 on NeoForge](0007-target-minecraft-1-21-1-neoforge.md)                              | accepted |
| 0008 | [KubeJS server scripts for modpack recipe changes](0008-kubejs-export.md)                                    | accepted |
| 0009 | [Entry types as Zod discriminated unions](0009-entry-types-zod-discriminated-unions.md)                      | accepted |
| 0010 | [Designer tasks derived from data](0010-derived-designer-tasks.md)                                           | accepted |
| 0011 | [Theming with semantic tokens from one source](0011-theming-semantic-tokens.md)                              | accepted |
| 0012 | [i18n with a typed in-repo catalog](0012-i18n-typed-catalog.md)                                              | accepted |
| 0013 | [Dynamic rendering; session check per segment](0013-dynamic-rendering-session-checks.md)                     | accepted |
| 0014 | [Dev-only fake mode](0014-dev-only-fake-mode.md)                                                             | accepted |
| 0015 | [Immutable custom mod and modpack IDs](0015-immutable-project-ids.md)                                        | accepted |
