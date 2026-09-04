// Server-only resource mutation service. All resource content comes from the
// database; this module contains no seed rows, fallback rows, or demo records.

import { db } from "@/lib/db";
import {
  findExistingIdentityConflict,
  prepareResourceCandidate,
  ResourceIngestionError,
} from "@/lib/resource-ingestion";
import { normalizeResource } from "@/lib/pii";
import type { CategorySlug, ResourceInput } from "@/lib/types";

export class ResourceNotFoundError extends Error {
  constructor() {
    super("Resource not found");
    this.name = "ResourceNotFoundError";
  }
}

export async function createResourceRecord(
  input: ResourceInput,
  actor: string,
) {
  const prepared = prepareResourceCandidate(input as unknown as Record<string, unknown>);
  const normalized = normalizeResource(prepared.input);
  const existing = await db.resource.findMany({
    select: { id: true, name: true, email: true, website: true, phoneNormalized: true },
  });
  const conflict = findExistingIdentityConflict(prepared, existing);
  if (conflict) {
    throw new ResourceIngestionError(
      "DUPLICATE_RESOURCE",
      `An existing resource already has the same exact name/contact identity (${conflict.name}).`,
    );
  }

  return db.$transaction(async (tx) => {
    const created = await tx.resource.create({
      data: {
        name: normalized.name,
        acronym: prepared.input.acronym,
        description: normalized.description,
        category: prepared.input.category,
        subcategory: prepared.input.subcategory,
        phoneRaw: prepared.input.phoneRaw,
        phoneNormalized: prepared.phoneNormalized,
        email: normalized.email,
        address: prepared.input.address,
        website: normalized.website,
        tags: prepared.input.tags,
        priority: prepared.input.priority,
        verified: prepared.input.verified,
        published: prepared.input.published,
        sourceNote: prepared.input.sourceNote,
        piipassAt: new Date(),
        piipassNotes: normalized.changes.length
          ? normalized.changes.join(" | ")
          : "no changes",
      },
    });

    await tx.auditLog.create({
      data: {
        action: "create",
        resourceId: created.id,
        actor,
        summary: `Created resource: ${created.name}`,
        details: JSON.stringify({
          changes: normalized.changes,
          issues: prepared.issues,
          viability: prepared.viability,
          source: "admin",
        }),
      },
    });

    return created;
  });
}

export async function updateResourceRecord(
  id: string,
  patch: Partial<ResourceInput>,
  actor: string,
) {
  const existing = await db.resource.findUnique({ where: { id } });
  if (!existing) throw new ResourceNotFoundError();

  const merged: ResourceInput = {
    name: patch.name ?? existing.name,
    acronym: patch.acronym !== undefined ? patch.acronym : existing.acronym,
    description:
      patch.description !== undefined ? patch.description : existing.description,
    category:
      (patch.category as CategorySlug | undefined) ??
      (existing.category as CategorySlug),
    subcategory:
      patch.subcategory !== undefined ? patch.subcategory : existing.subcategory,
    phoneRaw: patch.phoneRaw !== undefined ? patch.phoneRaw : existing.phoneRaw,
    email: patch.email !== undefined ? patch.email : existing.email,
    address: patch.address !== undefined ? patch.address : existing.address,
    website: patch.website !== undefined ? patch.website : existing.website,
    tags: patch.tags ?? existing.tags,
    priority: patch.priority ?? existing.priority,
    verified: patch.verified ?? existing.verified,
    published: patch.published ?? existing.published,
    sourceNote:
      patch.sourceNote !== undefined ? patch.sourceNote : existing.sourceNote,
  };

  const prepared = prepareResourceCandidate(merged as unknown as Record<string, unknown>);
  const normalized = normalizeResource(prepared.input);
  const allResources = await db.resource.findMany({
    select: { id: true, name: true, email: true, website: true, phoneNormalized: true },
  });
  const conflict = findExistingIdentityConflict(prepared, allResources, id);
  if (conflict) {
    throw new ResourceIngestionError(
      "DUPLICATE_RESOURCE",
      `Another resource already has the same exact name/contact identity (${conflict.name}).`,
    );
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.resource.update({
      where: { id },
      data: {
        name: normalized.name,
        acronym: prepared.input.acronym,
        description: normalized.description,
        category: prepared.input.category,
        subcategory: prepared.input.subcategory,
        phoneRaw: prepared.input.phoneRaw,
        phoneNormalized: prepared.phoneNormalized,
        email: normalized.email,
        address: prepared.input.address,
        website: normalized.website,
        tags: prepared.input.tags,
        priority: prepared.input.priority,
        verified: prepared.input.verified,
        published: prepared.input.published,
        sourceNote: prepared.input.sourceNote,
        piipassAt: new Date(),
        piipassNotes: normalized.changes.length
          ? normalized.changes.join(" | ")
          : "no changes",
      },
    });

    await tx.auditLog.create({
      data: {
        action: "update",
        resourceId: updated.id,
        actor,
        summary: `Updated resource: ${updated.name}`,
        details: JSON.stringify({
          changes: normalized.changes,
          issues: prepared.issues,
          viability: prepared.viability,
          fields: Object.keys(patch),
        }),
      },
    });

    return updated;
  });
}

export async function deleteResourceRecord(id: string, actor: string) {
  const existing = await db.resource.findUnique({ where: { id } });
  if (!existing) throw new ResourceNotFoundError();

  await db.$transaction(async (tx) => {
    // Create the deletion record before deleting the resource so the FK can be
    // set to null by ON DELETE SET NULL while retaining the forensic log.
    await tx.auditLog.create({
      data: {
        action: "delete",
        resourceId: existing.id,
        actor,
        summary: `Deleted resource: ${existing.name}`,
        details: JSON.stringify({
          name: existing.name,
          category: existing.category,
        }),
      },
    });
    await tx.resource.delete({ where: { id } });
  });

  return existing;
}
