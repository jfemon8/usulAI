import { readWidgetJob } from "@/lib/chat/widgetJobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JOB_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  if (!JOB_ID.test(id)) return new Response(null, { status: 404 });
  const fromParam = Number(new URL(request.url).searchParams.get("from") ?? "0");
  const from = Number.isSafeInteger(fromParam) && fromParam >= 0 ? fromParam : 0;
  try {
    const job = await readWidgetJob(id, from);
    if (!job) return new Response(null, { status: 404 });
    return Response.json(job, { headers: { "cache-control": "no-store" } });
  } catch {
    return new Response("Could not load answer generation.", { status: 503 });
  }
}
