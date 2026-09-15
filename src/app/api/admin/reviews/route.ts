import { adminJson, adminRoute } from "@/lib/admin/http";
import {
  listReviews,
  type ReviewSort,
  type ReviewStatusFilter,
  type ReviewVerdictFilter,
} from "@/lib/reviews/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: readonly ReviewStatusFilter[] = ["all", "unclaimed", "claimed", "mine"];
const VERDICTS: readonly ReviewVerdictFilter[] = ["", "unhelpful", "wrong-citation", "implicit"];
const SORTS: readonly ReviewSort[] = ["flagged", "newest"];

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.find((entry) => entry === value) ?? fallback;
}

export const GET = adminRoute("reviews.view", async (request, session) => {
  const url = new URL(request.url);
  return adminJson(
    await listReviews(
      {
        status: pick(url.searchParams.get("status"), STATUSES, "all"),
        verdict: pick(url.searchParams.get("verdict"), VERDICTS, ""),
        sort: pick(url.searchParams.get("sort"), SORTS, "flagged"),
        cursor: url.searchParams.get("cursor") || undefined,
      },
      session,
    ),
  );
});
