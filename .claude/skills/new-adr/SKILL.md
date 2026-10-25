---
name: new-adr
description: Record an architecture decision as the next numbered ADR in docs/adr/ and update the ADR index. Use when a decision is made that is hard to reverse or affects other features, when the user asks to record or document a decision, or when a feature workflow reaches its ADR step.
argument-hint: "[decision title]"
---

# New ADR

Creates `docs/adr/NNNN-<slug>.md` from the template and fills it from the current conversation.

## Steps

1. **Number:** list `docs/adr/` and take the highest `NNNN-*.md` number plus one, zero-padded to four digits. `0000` is the template, never a decision.
2. **Title and slug:** use `$ARGUMENTS` as the title if given, otherwise derive a short noun-phrase title from the decision. Slug: lowercase kebab-case English, at most ~6 words.
3. **Check for overlap:** read `docs/adr/README.md`. If an existing ADR covers the same topic, the new ADR supersedes it. Set the old ADR's status line to `superseded by [NNNN](NNNN-<slug>.md)` and change nothing else in it.
4. **Write the file** from `docs/adr/0000-template.md`:
   - **Status:** `accepted` if the user decided it, otherwise `proposed`, and ask the user to confirm.
   - **Date:** today's date (YYYY-MM-DD).
   - **Context:** the forces and constraints from the conversation, facts only.
   - **Decision:** concrete and checkable (names, paths, limits), so code can be reviewed against it.
   - **Consequences:** both positive and negative, plus rules or follow-up work it creates.
   - **Alternatives considered:** every alternative that came up, each with the reason it was rejected. If none came up, write that, rather than inventing any.
   - Use the terms from `docs/glossary.md`. Keep it under ~40 lines.
5. **Update the index:** add a row to the table in `docs/adr/README.md` (number, linked title, status), and update the status column of a superseded ADR.
6. **Cross-references:** if the decision changes structure or flows, update `docs/architecture.md`. If it adds a hard rule, add one line to `CLAUDE.md`'s hard rules with the ADR number. Link the ADR from the related spec in `docs/specs/`.
7. **Report:** give the file path and a one-line summary of the decision. Don't commit unless the surrounding workflow does.

## Rules

- Never rewrite the decision of an accepted ADR. Changes go into a new ADR that supersedes it.
- An ADR records a decision that was made. Don't make the decision yourself; if it is still open, ask the user first.
