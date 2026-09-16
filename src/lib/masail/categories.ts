import { z } from "zod";
import { DB_CONFIG, MASAIL_CONFIG } from "@/config/site";
import { AdminError } from "@/lib/admin/errors";
import { masalaSlug } from "@/lib/analytics/verifiedAnswers";
import { getDb } from "@/lib/db/mongoClient";
import { logger } from "@/lib/utils/logger";

export interface MasailCategoryDoc {
  _id: string;
  name: string;
  description: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string;
}

export interface MasailCategory {
  slug: string;
  name: string;
  description: string;
  order: number;
  path: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

export const categoryInput = z.object({
  name: z.string().trim().min(1).max(MASAIL_CONFIG.categoryNameChars),
  description: z.string().trim().max(MASAIL_CONFIG.categoryDescriptionChars).default(""),
  order: z.number().int().min(0).max(9999).default(0),
});

export type CategoryInput = z.infer<typeof categoryInput>;

let cache: { at: number; items: MasailCategory[] } | null = null;

async function collection() {
  return (await getDb()).collection<MasailCategoryDoc>(DB_CONFIG.masailCategoryCollection);
}

export function categoryPath(slug: string): string {
  return `${MASAIL_CONFIG.topicPath}/${encodeURIComponent(slug)}`;
}

function toCategory(row: MasailCategoryDoc): MasailCategory {
  return {
    slug: row._id,
    name: row.name,
    description: row.description ?? "",
    order: row.order ?? 0,
    path: categoryPath(row._id),
    updatedAt: row.updatedAt?.toISOString() ?? null,
    updatedBy: row.updatedBy ?? null,
  };
}

export function forgetCategories(): void {
  cache = null;
}

export async function listMasailCategories(): Promise<MasailCategory[]> {
  if (cache && Date.now() - cache.at < MASAIL_CONFIG.categoryCacheMs) return cache.items;

  try {
    const rows = await (await collection())
      .find({}, { sort: { order: 1, name: 1 } })
      .limit(MASAIL_CONFIG.maxCategories)
      .toArray();
    const items = rows.map(toCategory);
    cache = { at: Date.now(), items };
    return items;
  } catch (error) {
    logger.warn("Masail categories load failed", { error: String(error).slice(0, 160) });
    return cache?.items ?? [];
  }
}

export async function getMasailCategory(slug: string): Promise<MasailCategory | null> {
  const known = (await listMasailCategories()).find((category) => category.slug === slug);
  return known ?? null;
}

function slugFor(name: string): string {
  const slug = masalaSlug(name);
  if (!slug) throw new AdminError("বিষয়ের নাম থেকে ঠিকানা তৈরি করা যায়নি।");
  return slug;
}

export async function createMasailCategory(
  input: CategoryInput,
  email: string,
): Promise<MasailCategory> {
  const categories = await collection();
  if ((await categories.countDocuments()) >= MASAIL_CONFIG.maxCategories) {
    throw new AdminError("বিষয়ের সংখ্যা সর্বোচ্চ সীমায় পৌঁছেছে।");
  }

  const slug = slugFor(input.name);
  const now = new Date();
  const doc: MasailCategoryDoc = {
    _id: slug,
    name: input.name,
    description: input.description,
    order: input.order,
    createdAt: now,
    updatedAt: now,
    updatedBy: email,
  };

  const result = await categories.updateOne({ _id: slug }, { $setOnInsert: doc }, { upsert: true });
  if (result.upsertedCount === 0) throw new AdminError("এই নামে একটি বিষয় আগে থেকেই আছে।", 409);

  forgetCategories();
  return toCategory(doc);
}

export async function updateMasailCategory(
  slug: string,
  input: CategoryInput,
  email: string,
): Promise<MasailCategory> {
  const categories = await collection();
  const now = new Date();
  const updated = await categories.findOneAndUpdate(
    { _id: slug },
    {
      $set: {
        name: input.name,
        description: input.description,
        order: input.order,
        updatedAt: now,
        updatedBy: email,
      },
    },
    { returnDocument: "after" },
  );

  if (!updated) throw new AdminError("বিষয়টি পাওয়া যায়নি।", 404);
  forgetCategories();
  return toCategory(updated);
}

export async function deleteMasailCategory(slug: string): Promise<void> {
  const verified = (await getDb()).collection(DB_CONFIG.verifiedAnswerCollection);
  const used = await verified.countDocuments({ category: slug }, { limit: 1 });
  if (used > 0) {
    throw new AdminError(
      "এই বিষয়ে মাসআলা যুক্ত আছে। আগে মাসআলাগুলোর বিষয় বদলে নিন, তারপর মুছুন।",
      409,
    );
  }

  const result = await (await collection()).deleteOne({ _id: slug });
  if (result.deletedCount === 0) throw new AdminError("বিষয়টি পাওয়া যায়নি।", 404);
  forgetCategories();
}

export async function categoryCounts(): Promise<Record<string, number>> {
  const verified = (await getDb()).collection(DB_CONFIG.verifiedAnswerCollection);
  const rows = await verified
    .aggregate<{ _id: string | null; count: number }>([
      { $match: { origin: "scholar", category: { $type: "string" } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ])
    .toArray();

  return Object.fromEntries(rows.filter((row) => row._id).map((row) => [row._id as string, row.count]));
}

export async function publishedCategoryCounts(): Promise<Record<string, number>> {
  const verified = (await getDb()).collection(DB_CONFIG.verifiedAnswerCollection);
  const rows = await verified
    .aggregate<{ _id: string | null; count: number }>([
      { $match: { origin: "scholar", published: true, category: { $type: "string" } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ])
    .toArray();

  return Object.fromEntries(rows.filter((row) => row._id).map((row) => [row._id as string, row.count]));
}
