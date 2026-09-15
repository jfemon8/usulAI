import { adminJson, adminRoute } from "@/lib/admin/http";
import { listSurahs } from "@/lib/admin/notes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminRoute("notes.manage", async () =>
  adminJson({ surahs: await listSurahs() }),
);
