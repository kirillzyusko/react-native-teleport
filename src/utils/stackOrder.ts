/** Keep web priorities inside the range representable by the native Codegen prop. */
export function assertStackOrder(value: number | undefined): void {
  if (
    value !== undefined &&
    (!Number.isInteger(value) || value < -2147483647 || value > 2147483647)
  ) {
    // INT32_MIN is reserved for "prop omitted" in the native specs. Reject it
    // instead of silently turning an explicit lowest priority into default 0.
    throw new RangeError(
      "Portal stackOrder must be an integer between -2147483647 and 2147483647.",
    );
  }
}
