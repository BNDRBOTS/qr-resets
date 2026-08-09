import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const csvPath = path.join(root, "prisma", "verified-resources.csv");
const jsonPath = path.join(root, "prisma", "verified-resources.json");
const [csv, payloadText] = await Promise.all([
  readFile(csvPath),
  readFile(jsonPath, "utf8"),
]);
const payload = JSON.parse(payloadText);
const EXPECTED_SOURCE_SHA256 = "5e9a8438ee652c9be5b44fb781a2ba94db9dafffddcc720c254bc291aab2d72b";
const hash = createHash("sha256").update(csv).digest("hex");
if (hash !== EXPECTED_SOURCE_SHA256) {
  throw new Error(`Source dataset hash changed: ${hash}`);
}
if (hash !== payload.dataset.sha256) {
  throw new Error(`Dataset hash mismatch: CSV=${hash} JSON=${payload.dataset.sha256}`);
}
if (!Array.isArray(payload.resources) || payload.resources.length !== 114) {
  throw new Error(`Expected 114 source dataset rows; found ${payload.resources?.length ?? "invalid"}.`);
}
const ids = new Set();
for (const [index, row] of payload.resources.entries()) {
  if (!row.id || !row.name || !row.category) {
    throw new Error(`Row ${index + 1} is missing id, name, or canonical category.`);
  }
  if (ids.has(row.id)) throw new Error(`Duplicate resource id: ${row.id}`);
  ids.add(row.id);
}
const sourceVerified = payload.resources.filter((row) => row.verified === true).length;
console.log(JSON.stringify({ ok: true, rows: payload.resources.length, sourceVerified, sha256: hash }));
