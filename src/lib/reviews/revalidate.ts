import { revalidatePath } from "next/cache";
import { MASAIL_CONFIG } from "@/config/site";
import { masalaPath } from "@/lib/analytics/verifiedAnswers";
import { logger } from "@/lib/utils/logger";

export function revalidateMasail(id?: string | null): void {
  try {
    revalidatePath(MASAIL_CONFIG.path);
    if (id) revalidatePath(masalaPath(id));
  } catch (error) {
    logger.warn("Masail revalidation failed", { error: String(error).slice(0, 160) });
  }
}
