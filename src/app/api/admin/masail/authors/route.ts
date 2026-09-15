import { adminJson, adminRoute } from "@/lib/admin/http";
import { listScholarAuthors } from "@/lib/analytics/verifiedAnswers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminRoute("masail.override", async () =>
  adminJson({ authors: await listScholarAuthors() }),
);
