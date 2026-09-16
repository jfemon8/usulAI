import { revalidatePath } from "next/cache";
import { MASAIL_CONFIG } from "@/config/site";
import { masalaPath } from "@/lib/analytics/verifiedAnswers";
import { logger } from "@/lib/utils/logger";

export function revalidateMasail(id?: string | null): void {
  try {
    revalidatePath(MASAIL_CONFIG.path);
    revalidatePath("/sitemap.xml");
    if (id) {
      revalidatePath(masalaPath(id));
      revalidatePath(`${MASAIL_CONFIG.path}/[slug]`, "page");
    }
  } catch (error) {
    logger.warn("Masail revalidation failed", { error: String(error).slice(0, 160) });
  }
}
