import "./loadEnv";
import { ARABIC_TEXT_SOURCES, OPENITI_CONFIG, SOURCE_TRANSLATION_CONFIG } from "@/config/site";
import { getDocumentsCollection, getMongoClient } from "@/lib/db/mongoClient";
import { loadTranslations, translateSource, translationKey } from "@/lib/ai/sourceTranslation";
import { logger } from "@/lib/utils/logger";

function flag(name: string): string | undefined {
  return process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];
}

const BOOK_ORDER = OPENITI_CONFIG.ijma.map((book) => `${book.slug}.md`);

async function main() {
  const limit = Number(flag("limit") ?? "25");
  const book = flag("book");
  const models = flag("models")?.split(",") ?? SOURCE_TRANSLATION_CONFIG.approvedModels;
  const documents = await getDocumentsCollection();

  const rows = await documents
    .find(
      {
        sourceType: { $in: [...ARABIC_TEXT_SOURCES] as never[] },
        ...(book ? { "metadata.fileName": { $regex: book } } : {}),
      },
      {
        projection: {
          content: 1,
          "citation.reference": 1,
          "metadata.fileName": 1,
          "metadata.page": 1,
          "metadata.volume": 1,
        },
      },
    )
    .toArray();

  const ordered = rows.sort((a, b) => {
    const bookA = BOOK_ORDER.indexOf(String(a.metadata.fileName));
    const bookB = BOOK_ORDER.indexOf(String(b.metadata.fileName));
    return (
      bookA - bookB ||
      Number(a.metadata.volume ?? 0) - Number(b.metadata.volume ?? 0) ||
      Number(a.metadata.page ?? 0) - Number(b.metadata.page ?? 0)
    );
  });

  const cached = await loadTranslations(ordered.map((row) => translationKey(row.content)));
  const pending = ordered.filter((row) => !cached.has(translationKey(row.content)));
  logger.info(
    `${ordered.length} book passages, ${cached.size} already translated, ${pending.length} pending, translating up to ${Math.min(limit, pending.length)} with ${models.join(", ")}`,
  );

  let done = 0;
  let failed = 0;
  let streak = 0;

  for (const row of pending.slice(0, limit)) {
    const started = Date.now();
    const translation = await translateSource(row.content, row.citation.reference, models);

    if (translation) {
      done += 1;
      streak = 0;
    } else {
      failed += 1;
      streak += 1;
    }

    logger.info(
      `${translation ? "translated" : "FAILED"} ${row.citation.reference} in ${Math.round((Date.now() - started) / 1000)}s${translation ? `, ${translation.segments.length} segments, ${translation.segments.filter((segment) => segment.vocalized).length} vocalised` : ""}`,
    );

    if (streak >= SOURCE_TRANSLATION_CONFIG.maxConsecutiveFailures) {
      logger.warn(
        `Stopping after ${streak} failures in a row; check that ${models.join(", ")} is reachable`,
      );
      break;
    }
  }

  logger.info(
    `Finished: ${done} translated, ${failed} failed, ${pending.length - done} still pending`,
  );
  await (await getMongoClient()).close();
}

void main();
