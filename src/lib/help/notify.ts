import { EMAIL_CONFIG, HELP_CONFIG } from "@/config/site";
import { detectQuestionLanguage } from "@/lib/ai/language";
import { masalaPath } from "@/lib/analytics/verifiedAnswers";
import { sendRenderedEmail } from "@/lib/email/mailer";
import { appLink, emailContext } from "@/lib/email/templates/context";
import { helpAnsweredEmail } from "@/lib/email/templates/helpAnswered";
import type { HelpRequestDoc } from "@/lib/help/shape";
import { signedHelpToken } from "@/lib/help/tokens";
import { logger } from "@/lib/utils/logger";

export const HELP_EMAIL_CATEGORY = EMAIL_CONFIG.categories.helpAnswered;

export interface HelpNotificationRecord {
  sent: boolean;
  at: Date;
  error?: string;
}

export async function notifyHelpAnswered(doc: HelpRequestDoc): Promise<HelpNotificationRecord> {
  const at = new Date();
  if (!doc.email) return { sent: false, at, error: "no-email" };

  const token = signedHelpToken(doc._id.toHexString());
  if (!token) return { sent: false, at, error: "signing-secret-missing" };

  try {
    const locale = detectQuestionLanguage(doc.question) === "other" ? "en" : "bn";
    const context = emailContext({ locale });
    const email = helpAnsweredEmail(
      {
        email: doc.email,
        ...(doc.name ? { name: doc.name } : {}),
        question: doc.question,
        scholarName: doc.answeredBy?.name ?? "",
        scholarCategory: doc.answeredBy?.category ?? "",
        trackUrl: appLink(context, `${HELP_CONFIG.path}/${token}`),
        answeredAt: doc.answeredAt ?? at,
        ...(doc.published && doc.masalaId
          ? { masalaUrl: appLink(context, masalaPath(doc.masalaId)) }
          : {}),
      },
      { locale },
    );
    const result = await sendRenderedEmail(doc.email, email, HELP_EMAIL_CATEGORY);
    return result.sent
      ? { sent: true, at }
      : {
          sent: false,
          at,
          error: (result.error ?? "send-failed")
            .replace(/[^\s@"'<>]+@[^\s@"'<>]+/g, "***")
            .slice(0, 200),
        };
  } catch (error) {
    logger.warn("Help answer notification failed", { error: String(error).slice(0, 160) });
    return { sent: false, at, error: "render-failed" };
  }
}
