/**
 * Exhaustiveness check for discriminated unions (see ADR 0009).
 * Call it in the `default` branch of a switch over `type` or `kind`, so adding
 * a variant without handling it becomes a type error.
 */
export function assertNever(value: never): never {
  throw new Error(`Unexpected variant: ${JSON.stringify(value)}`);
}
