/** Checkpoint JSON preserves unbounded timers and unlit-cylinder mixture ratios. */
export function encodeCheckpoint(value: unknown): string {
  return JSON.stringify(value, (_key, entry) =>
    typeof entry === "number" && !Number.isFinite(entry) ? { $simulationNumber: String(entry) } : entry,
  );
}

/** The runtime validates the decoded checkpoint's model, version and clock before restoring it. */
export function decodeCheckpoint<T>(json: string): T {
  return JSON.parse(json, (_key, value) => {
    if (value && typeof value === "object" && Object.keys(value).length === 1 && "$simulationNumber" in value) {
      if (value.$simulationNumber === "Infinity") return Infinity;
      if (value.$simulationNumber === "-Infinity") return -Infinity;
      if (value.$simulationNumber === "NaN") return NaN;
    }
    return value;
  }) as T;
}
