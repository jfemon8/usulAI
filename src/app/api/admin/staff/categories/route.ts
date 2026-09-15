import { recordAudit } from "@/lib/admin/audit";
import { adminJson, adminRoute, readJson } from "@/lib/admin/http";
import { categoryCreateInput, createCategory, listCategories } from "@/lib/admin/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminRoute("staff.manage", async () =>
  adminJson({ items: await listCategories() }),
);

export const POST = adminRoute("staff.manage", async (request, session) => {
  const input = await readJson(request, categoryCreateInput);
  const category = await createCategory(input, session.email);
  await recordAudit(
    session.email,
    "categories.create",
    `category:${category.name}`,
    `role ${category.role}`,
  );
  return adminJson(category, 201);
});
