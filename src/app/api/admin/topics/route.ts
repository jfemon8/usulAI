import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MASAIL_CONFIG } from "@/config/site";
import { recordAudit } from "@/lib/admin/audit";
import { adminJson, adminRoute, readJson } from "@/lib/admin/http";
import {
  categoryCounts,
  categoryInput,
  createMasailCategory,
  deleteMasailCategory,
  listMasailCategories,
  updateMasailCategory,
} from "@/lib/masail/categories";
import { logger } from "@/lib/utils/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const slugSchema = z.object({ slug: z.string().trim().min(1).max(MASAIL_CONFIG.slugChars * 2) });
const updateSchema = slugSchema.merge(categoryInput);

function refresh(): void {
  try {
    revalidatePath(MASAIL_CONFIG.path);
    revalidatePath(`${MASAIL_CONFIG.topicPath}/[slug]`, "page");
    revalidatePath("/sitemap.xml");
  } catch (error) {
    logger.warn("Topic revalidation failed", { error: String(error).slice(0, 160) });
  }
}

async function payload() {
  const [items, counts] = await Promise.all([listMasailCategories(), categoryCounts()]);
  return {
    items: items.map((item) => ({ ...item, count: counts[item.slug] ?? 0 })),
    limits: {
      nameChars: MASAIL_CONFIG.categoryNameChars,
      descriptionChars: MASAIL_CONFIG.categoryDescriptionChars,
      maxCategories: MASAIL_CONFIG.maxCategories,
    },
  };
}

export const GET = adminRoute("panel.use", async () => adminJson(await payload()));

export const POST = adminRoute("masail.categories", async (request, session) => {
  const input = await readJson(request, categoryInput);
  const created = await createMasailCategory(input, session.email);
  await recordAudit(session.email, "masail.topic-create", created.slug, created.name);
  refresh();
  return adminJson(await payload(), 201);
});

export const PATCH = adminRoute("masail.categories", async (request, session) => {
  const { slug, ...input } = await readJson(request, updateSchema);
  const updated = await updateMasailCategory(slug, input, session.email);
  await recordAudit(session.email, "masail.topic-update", slug, updated.name);
  refresh();
  return adminJson(await payload());
});

export const DELETE = adminRoute("masail.categories", async (request, session) => {
  const { slug } = await readJson(request, slugSchema);
  await deleteMasailCategory(slug);
  await recordAudit(session.email, "masail.topic-delete", slug);
  refresh();
  return adminJson(await payload());
});
