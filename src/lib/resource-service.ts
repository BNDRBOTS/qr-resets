// Server-only resource mutation service. All resource content comes from the
// database; this module contains no seed rows, fallback rows, or demo records.

import { db } from "@/lib/db";
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
  const normalized = normalizeResource(input);

  return db.$transaction(async (tx) => {
    const created = await tx.resource.create({
      data: {
        name: normalized.name,
        acronym: input.acronym,
        description: normalized.description,
        category: input.category,
        subcategory: input.subcategory,
        phoneRaw: input.phoneRaw,
        phoneNormalized: normalized.phoneNormalized,
        email: normalized.email,
        address: input.address,
        website: normalized.website,
        tags: input.tags,
        priority: input.priority,
        verified: input.verified,
        published: input.published,
        sourceNote: input.sourceNote,
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

  const normalized = normalizeResource(merged);

  return db.$transaction(async (tx) => {
    const updated = await tx.resource.update({
      where: { id },
      data: {
        name: normalized.name,
        acronym: merged.acronym,
        description: normalized.description,
        category: merged.category,
        subcategory: merged.subcategory,
        phoneRaw: merged.phoneRaw,
        phoneNormalized: normalized.phoneNormalized,
        email: normalized.email,
        address: merged.address,
        website: normalized.website,
        tags: merged.tags,
        priority: merged.priority,
        verified: merged.verified,
        published: merged.published,
        sourceNote: merged.sourceNote,
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
