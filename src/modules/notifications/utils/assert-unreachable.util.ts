/** Compile-time exhaustiveness guard for discriminated unions. */
export function assertUnreachable(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}
