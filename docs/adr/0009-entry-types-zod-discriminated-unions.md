# 0009. Entry types are discriminated unions with Zod schemas

- **Status:** accepted
- **Date:** 2026-10-25

## Context

Custom mod entries come in several types (item, block, entity, structure, mechanic, multiblock), each with its own fields, and some types have kinds with further fields. Forms must show only valid fields, and stored JSON must not contain impossible combinations.

## Decision

- Each entry type is a Zod schema. Entries form a discriminated union on `type`. Where a type has kinds, it is a nested discriminated union on `kind`.
- TypeScript types are inferred from the schemas (`z.infer`), never written separately.
- Forms derive their visible fields from the schema for the current `type` and `kind`.
- The storage layer validates every entry against the schema on read and before write. Invalid data is rejected, not saved.
- Schemas live in `src/domain/` and are the source of truth for the entry file format.

## Consequences

- Adding a type or kind is a schema change plus form and task-rule updates; `assertNever` in switches makes missed cases type errors.
- Changing a schema in a way that invalidates stored entries needs a migration of `data/custom-mods/` in the same change.
- Type-specific fields must not be added anywhere except the schemas.

## Alternatives considered

None were listed when the decision was made.
