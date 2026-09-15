import { recordAudit } from "@/lib/admin/audit";
import { adminJson, adminRoute, readJson } from "@/lib/admin/http";
import { categoryOrderInput, reorderCategories } from "@/lib/admin/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = adminRoute("staff.manage", async (request, session) => {
  const { ids } = await readJson(request, categoryOrderInput);
  const { categories, moved } = await reorderCategories(ids, session.email);
  if (moved > 0) {
    await recordAudit(
      session.email,
      "categories.update",
      "category:order",
      `reordered: ${categories.map((category) => category.name).join(", ")}`,
    );
  }
  return adminJson({ items: categories });
});
