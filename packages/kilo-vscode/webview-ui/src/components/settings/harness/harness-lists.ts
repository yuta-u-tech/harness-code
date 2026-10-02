/** Add or remove a value without mutating the list or duplicating entries. */
export function toggled<T>(list: readonly T[], value: T, on: boolean): T[] {
  const without = list.filter((x) => x !== value)
  return on ? [...without, value] : without
}

/** One entry per non-empty line. */
export function splitLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}
