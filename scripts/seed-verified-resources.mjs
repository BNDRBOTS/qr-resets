import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_SOURCE_SHA256 = "5e9a8438ee652c9be5b44fb781a2ba94db9dafffddcc720c254bc291aab2d72b";
const db = new PrismaClient();
const root = fileURLToPath(new URL("../", import.meta.url));

function asDate(value, fallback) {
  if (!value) return fallback;
  const normalized = String(value).replace(/[‐‑‒–−]/g, "-");
  const date = new Date(normalized);
  return Number.isNaN(date.valueOf()) ? fallback : date;
}

function resourceData(row, datasetHash, now) {
  return {
    name: row.name,
    acronym: row.acronym ?? null,
    description: row.description ?? null,
    category: row.category,
    sourceCategory: row.sourceCategory ?? null,
    subcategory: row.subcategory ?? null,
    phoneRaw: row.phoneRaw ?? null,
    phoneNormalized: row.phoneNormalized ?? null,
    phoneDisplay: row.phoneDisplay ?? null,
    email: row.email ?? null,
    address: row.address ?? null,
    website: row.website ?? null,
    tags: row.tags ?? "",
    priority: Number.isInteger(row.priority) ? row.priority : 0,
    verified: Boolean(row.verified),
    published: Boolean(row.published),
    sourceNote: row.sourceNote ?? null,
    piipassAt: row.piipassNotes ? asDate(row.updatedAt, now) : null,
    piipassNotes: row.piipassNotes ?? null,
    sourceDatasetHash: datasetHash,
    sourceRow: row.sourceRow ?? null,
    createdAt: asDate(row.createdAt, now),
    updatedAt: asDate(row.updatedAt, now),
  };
}

try {
  const [csv, payloadText, taxonomyText] = await Promise.all([
    readFile(path.join(root, "prisma", "verified-resources.csv")),
    readFile(path.join(root, "prisma", "verified-resources.json"), "utf8"),
    readFile(path.join(root, "prisma", "category-taxonomy.json"), "utf8"),
  ]);
  const payload = JSON.parse(payloadText);
  const taxonomy = JSON.parse(taxonomyText);
  const datasetHash = createHash("sha256").update(csv).digest("hex");

  if (datasetHash !== EXPECTED_SOURCE_SHA256) {
    throw new Error(`Source CSV hash changed: ${datasetHash}`);
  }
  if (datasetHash !== payload.dataset.sha256) {
    throw new Error(`Source CSV/JSON hash mismatch: ${datasetHash}`);
  }
  if (!Array.isArray(payload.resources) || payload.resources.length !== 114) {
    throw new Error(`Expected 114 source dataset rows, found ${payload.resources?.length ?? "invalid"}.`);
  }
  if (!Array.isArray(taxonomy) || taxonomy.length === 0) {
    throw new Error("Category taxonomy is empty or invalid.");
  }

  const [prior, matchingRows] = await Promise.all([
    db.datasetImport.findUnique({ where: { datasetHash } }),
    db.resource.count({ where: { sourceDatasetHash: datasetHash } }),
  ]);

  // Idempotent deploys must never wipe administrator-added resources, QR data,
  // verification history, or audit history. If the canonical source rows for
  // this exact hash are already present, the seed is complete.
  if (prior && matchingRows === payload.resources.length) {
    console.log(`Source dataset already current (${datasetHash}, ${prior.rowCount} rows).`);
    await db.$disconnect();
    process.exit(0);
  }

  const now = new Date();

  await db.$transaction(async (tx) => {
    // Upsert taxonomy instead of replacing it so deploys do not destroy any
    // administrator-maintained categories that are outside this source file.
    for (let index = 0; index < taxonomy.length; index += 1) {
      const category = taxonomy[index];
      await tx.category.upsert({
        where: { slug: category.slug },
        update: {
          name: category.name,
          description: category.description ?? null,
          sortOrder: index,
        },
        create: {
          slug: category.slug,
          name: category.name,
          description: category.description ?? null,
          sortOrder: index,
        },
      });
    }

    // Never delete pre-existing resources during deployment. The packaged
    // source dataset is additive/updating only: stable IDs are upserted below,
    // while administrator-created and older source rows remain intact. Any
    // later retirement must be an explicit reviewed admin action, not a deploy.

    // Stable IDs let us update packaged source rows in place, preserving their
    // related audit/verification history rather than delete/recreate cycles.
    for (const row of payload.resources) {
      const data = resourceData(row, datasetHash, now);
      await tx.resource.upsert({
        where: { id: row.id },
        update: data,
        create: { id: row.id, ...data },
      });
    }

    await tx.datasetImport.upsert({
      where: { datasetHash },
      update: {
        filename: payload.dataset.filename,
        rowCount: payload.resources.length,
        mode: "upsert",
        appliedAt: now,
      },
      create: {
        datasetHash,
        filename: payload.dataset.filename,
        rowCount: payload.resources.length,
        mode: "upsert",
      },
    });

    await tx.auditLog.create({
      data: {
        action: "dataset-import",
        actor: "deployment",
        summary: `Upserted packaged resource dataset with ${payload.resources.length} source rows`,
        details: JSON.stringify({
          filename: payload.dataset.filename,
          sha256: datasetHash,
          rowCount: payload.resources.length,
          mode: "upsert",
        }),
      },
    });
  }, { timeout: 120000 });

  const sourceVerified = payload.resources.filter((row) => row.verified === true).length;
  console.log(`Applied source dataset ${datasetHash}: ${payload.resources.length} rows (${sourceVerified} source-verified).`);
} finally {
  await db.$disconnect();
}
