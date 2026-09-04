import { createHash } from "node:crypto";

export type SnapshotScalar = string | number | boolean | null;
export type SnapshotValue = SnapshotScalar | SnapshotValue[] | { [key: string]: SnapshotValue };
export type SnapshotRow = { [key: string]: SnapshotValue };

function normalizeValue(value: unknown): SnapshotValue | undefined {
  if (value === undefined) return undefined;
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Snapshot contains a non-finite number");
    return value;
  }
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error("Snapshot contains an invalid date");
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item) ?? null);
  }
  if (typeof value === "object") {
    const out: Record<string, SnapshotValue> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const normalized = normalizeValue((value as Record<string, unknown>)[key]);
      if (normalized !== undefined) out[key] = normalized;
    }
    return out;
  }
  return String(value);
}

export function snapshotResourceRows(rows: readonly unknown[]): SnapshotRow[] {
  const normalized = rows.map((row) => {
    const value = normalizeValue(row);
    if (!value || Array.isArray(value) || typeof value !== "object") {
      throw new Error("Snapshot row is not an object");
    }
    return value as SnapshotRow;
  });
  normalized.sort((a, b) => String(a.id ?? "").localeCompare(String(b.id ?? "")));
  return normalized;
}

export function hashSnapshotRows(rows: readonly unknown[]): string {
  const stableRows = snapshotResourceRows(rows);
  return createHash("sha256").update(JSON.stringify(stableRows)).digest("hex");
}

export function prepareResourceSnapshot(rows: readonly unknown[]): {
  rows: SnapshotRow[];
  rowCount: number;
  datasetHash: string;
} {
  const stableRows = snapshotResourceRows(rows);
  return {
    rows: stableRows,
    rowCount: stableRows.length,
    datasetHash: createHash("sha256").update(JSON.stringify(stableRows)).digest("hex"),
  };
}

export function verifyResourceSnapshot(input: {
  dataJson: unknown;
  rowCount: number;
  datasetHash: string | null;
}): { ok: true; rows: SnapshotRow[]; datasetHash: string } | { ok: false; reason: string } {
  if (!Array.isArray(input.dataJson)) {
    return { ok: false, reason: "Snapshot payload is not an array." };
  }
  if (!input.datasetHash) {
    return { ok: false, reason: "Snapshot has no persisted dataset hash." };
  }
  const rows = snapshotResourceRows(input.dataJson);
  if (rows.length !== input.rowCount) {
    return {
      ok: false,
      reason: `Snapshot row payload (${rows.length}) does not match recorded rowCount (${input.rowCount}).`,
    };
  }
  const actualHash = createHash("sha256").update(JSON.stringify(rows)).digest("hex");
  if (actualHash !== input.datasetHash) {
    return {
      ok: false,
      reason: `Snapshot dataset hash mismatch (expected ${input.datasetHash}, got ${actualHash}).`,
    };
  }
  return { ok: true, rows, datasetHash: actualHash };
}
