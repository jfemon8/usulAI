import { adminJson, adminRoute } from "@/lib/admin/http";
import { helpActor, listHelpRequests } from "@/lib/help/requests";
import { parseFilter } from "@/lib/help/shape";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminRoute("help.view", async (request, session) => {
  const url = new URL(request.url);
  return adminJson(
    await listHelpRequests(helpActor(session), {
      filter: parseFilter(url.searchParams.get("filter")),
      search: url.searchParams.get("q") ?? undefined,
      cursor: url.searchParams.get("cursor") || undefined,
    }),
  );
});
