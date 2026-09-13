import { isPwaIconName, PWA_ICONS, renderPwaIcon } from "@/lib/pwaIcon";

export const dynamic = "force-static";

export function generateStaticParams() {
  return Object.keys(PWA_ICONS).map((name) => ({ name }));
}

export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  if (!isPwaIconName(name)) return new Response("Not found", { status: 404 });
  return renderPwaIcon(name);
}
