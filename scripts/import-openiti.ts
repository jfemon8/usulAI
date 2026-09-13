import "./loadEnv";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { OPENITI_CONFIG, type OpenItiBook, type OpenItiSource } from "@/config/site";
import { convertOpenIti, headingsByPage } from "@/lib/ingestion/sources/openiti";
import { logger } from "@/lib/utils/logger";

function versionUrl(book: OpenItiBook, version: string): string {
  const [authorWork] = version.split(/\.(?=[^.]+-\w+$)/);
  const author = authorWork?.split(".")[0] ?? "";
  return `${OPENITI_CONFIG.rawBase}/${book.repo}/master/data/${author}/${authorWork}/${version}`;
}

async function download(url: string): Promise<string> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(url);
    if (response.ok) return response.text();
    await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
  }
  throw new Error(`Download failed: ${url}`);
}

const SOURCES: readonly OpenItiSource[] = ["ijma", "qiyas"];

async function importSource(sourceType: OpenItiSource) {
  const directory = path.join(process.cwd(), "data", sourceType);
  await mkdir(directory, { recursive: true });
  const books: readonly OpenItiBook[] = OPENITI_CONFIG[sourceType];

  for (const book of books) {
    const source = versionUrl(book, book.version);
    const raw = await download(source);
    const injected = book.headingsFrom
      ? headingsByPage(await download(versionUrl(book, book.headingsFrom)))
      : new Map<string, string[]>();

    const { markdown, pages, headings } = convertOpenIti(
      raw,
      {
        title: book.title,
        author: book.author,
        part: book.part,
        license: OPENITI_CONFIG.license,
        source,
        version: book.version,
      },
      injected,
      {
        ranges: book.pages,
        inlineHeadings: book.inlineHeadings,
        tidyHeadings: sourceType !== "ijma",
      },
    );

    await writeFile(path.join(directory, `${book.slug}.md`), markdown, "utf8");
    await writeFile(
      path.join(directory, `${book.slug}.json`),
      `${JSON.stringify(
        {
          title: book.title,
          author: book.author,
          ...(book.part ? { edition: book.part } : {}),
          license: OPENITI_CONFIG.license,
          source,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    logger.info(
      `${sourceType}/${book.slug}: ${pages} pages, ${headings} headings, ${markdown.length} characters`,
    );
  }
}

async function main() {
  const requested = process.argv
    .slice(2)
    .filter((arg): arg is OpenItiSource => SOURCES.includes(arg as OpenItiSource));
  for (const sourceType of requested.length > 0 ? requested : SOURCES) {
    await importSource(sourceType);
  }
}

void main();
