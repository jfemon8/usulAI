import { adminFailure, adminJson, adminRoute } from "@/lib/admin/http";
import { listHelpAssignees } from "@/lib/help/requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminRoute("help.handle", async (_request, session) => {
  if (session.role !== "admin") return adminFailure("শুধু অ্যাডমিন এটি দেখতে পারেন।", 403);
  return adminJson({ items: await listHelpAssignees() });
});
