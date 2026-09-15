import "./loadEnv";
import { ADMIN_CONFIG, DB_CONFIG } from "@/config/site";
import { ensureAccount } from "@/lib/admin/accounts";
import { ensureDefaultCategories, ensureStaffIndexes, listCategories } from "@/lib/admin/staff";
import { getDb, getMongoClient } from "@/lib/db/mongoClient";

async function main() {
  const db = await getDb();
  await db
    .collection(DB_CONFIG.adminSessionCollection)
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection(DB_CONFIG.adminSessionCollection).createIndex({ email: 1 });
  await db
    .collection(DB_CONFIG.adminResetTokenCollection)
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection(DB_CONFIG.adminResetTokenCollection).createIndex({ email: 1, createdAt: 1 });

  for (const email of ADMIN_CONFIG.accounts) {
    const account = await ensureAccount(email);
    console.log(
      `${email}: ${account?.passwordHash ? "ready" : "no password yet, use forgot password or set ADMIN_INITIAL_PASSWORD"}`,
    );
  }

  await ensureStaffIndexes();
  await ensureDefaultCategories();
  const categories = await listCategories();
  console.log(
    `staff categories: ${categories.map((category) => `${category.name} (${category.role})`).join(", ")}`,
  );

  await (await getMongoClient()).close();
}

main().catch(async (error: unknown) => {
  console.error(error);
  await (await getMongoClient()).close();
  process.exit(1);
});
