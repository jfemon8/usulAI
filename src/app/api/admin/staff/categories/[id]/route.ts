import { recordAudit } from "@/lib/admin/audit";
import { adminJson, adminRoute, readJson } from "@/lib/admin/http";
import { categoryUpdateInput, deleteCategory, updateCategory } from "@/lib/admin/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { id: string };

export const PATCH = adminRoute<Params>("staff.manage", async (request, session, params) => {
  const input = await readJson(request, categoryUpdateInput);
  const { category, previous, roleChanged, signedOut } = await updateCategory(
    params.id,
    {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    },
    session.email,
  );

  const changes = [
    previous.name !== category.name ? `name was ${previous.name}` : null,
    roleChanged ? `role ${previous.role} -> ${category.role}; ${signedOut} signed out` : null,
    (previous.description ?? "") !== category.description ? "description changed" : null,
  ].filter(Boolean);
  if (changes.length > 0) {
    await recordAudit(
      session.email,
      "categories.update",
      `category:${category.name}`,
      changes.join("; "),
    );
  }
  return adminJson({ category, roleChanged, signedOut });
});

export const DELETE = adminRoute<Params>("staff.manage", async (_request, session, params) => {
  const removed = await deleteCategory(params.id);
  await recordAudit(
    session.email,
    "categories.delete",
    `category:${removed.name}`,
    `role ${removed.role}`,
  );
  return adminJson({ ok: true });
});
