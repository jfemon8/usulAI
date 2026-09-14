import "./loadEnv";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { PUBLIC_DOMAIN_BOOKS, type PublicDomainBook } from "@/config/site";
import {
  convertGutenbergSira,
  convertWikisourceSira,
  type PublicDomainConversion,
} from "@/lib/ingestion/sources/publicDomain";
import { logger } from "@/lib/utils/logger";

async function download(url: string): Promise<string> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(url, { headers: { "user-agent": "UsulAI-importer/1.0" } });
    if (response.ok) return response.text();
    await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
  }
  throw new Error(`Download failed: ${url}`);
}

function convert(book: PublicDomainBook, raw: string): PublicDomainConversion {
  const meta = {
    title: book.title,
    author: book.author,
    license: book.license,
    source: book.url,
    note: book.note,
  };

  if (book.format === "gutenberg") {
    if (!book.gutenberg) throw new Error(`${book.slug} needs Gutenberg start and end lines`);
    return convertGutenbergSira(raw, meta, book.gutenberg);
  }

  return convertWikisourceSira(raw, meta);
}

async function main() {
  for (const book of PUBLIC_DOMAIN_BOOKS) {
    const directory = path.join(process.cwd(), "data", book.sourceType);
    await mkdir(directory, { recursive: true });

    const { markdown, chapters, pages } = convert(book, await download(book.url));

    await writeFile(path.join(directory, `${book.slug}.md`), markdown, "utf8");
    await writeFile(
      path.join(directory, `${book.slug}.json`),
      `${JSON.stringify(
        {
          title: book.title,
          author: book.author,
          edition: book.note,
          license: book.license,
          source: book.url,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    logger.info(
      `${book.sourceType}/${book.slug}: ${chapters} headings, ${pages} pages, ${markdown.length} characters`,
    );
  }
}

void main();
