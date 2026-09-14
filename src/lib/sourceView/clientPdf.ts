import { SOURCE_VIEW_CONFIG } from "@/config/site";

export interface RenderedPage {
  src: string;
  width: number;
  height: number;
}

export interface RenderedSource {
  pdfUrl: string;
  pages: RenderedPage[];
  highlight?: { page: number; top: number };
  externalUrl?: string;
  translationPending?: boolean;
}

interface CacheEntry {
  promise: Promise<RenderedSource>;
  value?: RenderedSource;
  usedAt: number;
  refresh?: Promise<RenderedSource>;
}

const FALLBACK_ERROR = "সূত্রটি এখন দেখানো যাচ্ছে না।";
const cache = new Map<string, CacheEntry>();
const holds = new Map<string, number>();
const fullFetchedAt = new Map<string, number>();

export function sourcePdfUrl(reference: string, prefetch = false): string {
  return `/api/source-view?ref=${encodeURIComponent(reference)}${prefetch ? "&prefetch=1" : ""}`;
}

function revoke(rendered: RenderedSource) {
  URL.revokeObjectURL(rendered.pdfUrl);
  rendered.pages.forEach((page) => URL.revokeObjectURL(page.src));
}

function isFresh(reference: string, entry: CacheEntry, now: number): boolean {
  return holds.has(reference) || now - entry.usedAt < SOURCE_VIEW_CONFIG.clientCacheMs;
}

function prune(now: number) {
  const evictable = [...cache.entries()].filter(
    ([reference, entry]) => entry.value && !holds.has(reference),
  );

  for (const [reference, entry] of evictable) {
    if (!isFresh(reference, entry, now) && entry.value) {
      cache.delete(reference);
      revoke(entry.value);
    }
  }

  const overflow = cache.size - SOURCE_VIEW_CONFIG.clientCacheEntries;
  if (overflow <= 0) return;

  evictable
    .filter(([reference]) => cache.has(reference))
    .sort(([, a], [, b]) => a.usedAt - b.usedAt)
    .slice(0, overflow)
    .forEach(([reference, entry]) => {
      cache.delete(reference);
      if (entry.value) revoke(entry.value);
    });
}

async function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error(FALLBACK_ERROR))),
      "image/png",
    ),
  );
}

async function renderSource(reference: string, prefetch: boolean): Promise<RenderedSource> {
  const response = await fetch(sourcePdfUrl(reference, prefetch));

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? FALLBACK_ERROR);
  }

  const bytes = await response.arrayBuffer();
  const highlightPage = Number(response.headers.get("x-highlight-page"));
  const highlightTop = Number(response.headers.get("x-highlight-top"));
  const externalUrl = response.headers.get("x-source-external-url") ?? undefined;
  const translationPending = response.headers.get("x-translation-pending") === "1";
  const pdfUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const pages: RenderedPage[] = [];

  try {
    const { getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(bytes.slice(0)));

    try {
      for (let number = 1; number <= pdf.numPages; number += 1) {
        const page = await pdf.getPage(number);
        const viewport = page.getViewport({ scale: SOURCE_VIEW_CONFIG.renderScale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d");
        if (!context) throw new Error(FALLBACK_ERROR);
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        const blob = await canvasBlob(canvas);
        pages.push({ src: URL.createObjectURL(blob), width: canvas.width, height: canvas.height });
        canvas.width = 0;
        canvas.height = 0;
        page.cleanup();
      }
    } finally {
      await pdf.loadingTask.destroy();
    }
  } catch (error) {
    revoke({ pdfUrl, pages });
    throw error instanceof Error && error.message ? error : new Error(FALLBACK_ERROR);
  }

  return {
    pdfUrl,
    pages,
    ...(highlightPage > 0
      ? {
          highlight: { page: highlightPage, top: Number.isFinite(highlightTop) ? highlightTop : 0 },
        }
      : {}),
    ...(externalUrl ? { externalUrl } : {}),
    ...(translationPending ? { translationPending } : {}),
  };
}

export type PdfDelivery = "downloaded" | "opened" | "failed";

const UNSAFE_FILE_CHARACTERS = /[\\/:*?"<>|]+/g;
const DOWNLOAD_UNSUPPORTED_AGENT = /FBAN|FBAV|Instagram|Line\/|MicroMessenger|; wv\)/i;

export function sourcePdfFileName(reference: string): string {
  const base = [...reference]
    .map((character) => ((character.codePointAt(0) ?? 0) < 32 ? " " : character))
    .join("")
    .replace(UNSAFE_FILE_CHARACTERS, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SOURCE_VIEW_CONFIG.maxFileNameChars);
  return `${base || "source"}.pdf`;
}

function clickLink(href: string, attributes: Record<string, string>) {
  const link = document.createElement("a");
  link.href = href;
  link.rel = "noopener noreferrer";
  link.style.display = "none";
  for (const [name, value] of Object.entries(attributes)) link.setAttribute(name, value);
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
  }
}

function canDownload(): boolean {
  return (
    "download" in HTMLAnchorElement.prototype &&
    !DOWNLOAD_UNSUPPORTED_AGENT.test(navigator.userAgent)
  );
}

export function openPdfInNewTab(href: string): PdfDelivery {
  try {
    const opened = window.open(href, "_blank");
    if (opened) {
      opened.opener = null;
      return "opened";
    }
    clickLink(href, { target: "_blank" });
    return "opened";
  } catch {
    return "failed";
  }
}

export function downloadRenderedSource(rendered: RenderedSource, reference: string): PdfDelivery {
  if (!canDownload()) return openPdfInNewTab(rendered.pdfUrl);

  try {
    clickLink(rendered.pdfUrl, { download: sourcePdfFileName(reference) });
    return "downloaded";
  } catch {
    return openPdfInNewTab(rendered.pdfUrl);
  }
}

export function peekRenderedSource(reference: string): RenderedSource | undefined {
  const entry = cache.get(reference);
  return entry?.value && isFresh(reference, entry, Date.now()) ? entry.value : undefined;
}

function refreshPending(
  reference: string,
  entry: CacheEntry,
  now: number,
): Promise<RenderedSource> {
  if (entry.refresh) return entry.refresh;
  fullFetchedAt.set(reference, now);

  const previous = entry.value;
  const refresh = renderSource(reference, false).then(
    (rendered) => {
      cache.set(reference, {
        promise: Promise.resolve(rendered),
        value: rendered,
        usedAt: Date.now(),
      });
      if (previous) setTimeout(() => revoke(previous), SOURCE_VIEW_CONFIG.revokeDelayMs);
      prune(Date.now());
      return rendered;
    },
    (error: unknown) => {
      entry.refresh = undefined;
      throw error;
    },
  );
  entry.refresh = refresh;
  return refresh;
}

export function loadRenderedSource(reference: string, prefetch = false): Promise<RenderedSource> {
  const now = Date.now();
  const cached = cache.get(reference);

  if (cached && (!cached.value || isFresh(reference, cached, now))) {
    cached.usedAt = now;
    const retryDue = now - (fullFetchedAt.get(reference) ?? 0) >= SOURCE_VIEW_CONFIG.pendingRetryMs;
    if (!prefetch && cached.value?.translationPending && retryDue) {
      return refreshPending(reference, cached, now);
    }
    return cached.refresh ?? cached.promise;
  }

  if (cached?.value) {
    cache.delete(reference);
    revoke(cached.value);
  }

  if (!prefetch) fullFetchedAt.set(reference, now);
  const entry: Partial<CacheEntry> & { usedAt: number } = { usedAt: now };
  const promise = renderSource(reference, prefetch).then(
    (rendered) => {
      entry.value = rendered;
      entry.usedAt = Date.now();
      prune(entry.usedAt);
      return rendered;
    },
    (error: unknown) => {
      if (cache.get(reference) === entry) cache.delete(reference);
      throw error;
    },
  );
  const stored: CacheEntry = Object.assign(entry, { promise });
  cache.set(reference, stored);
  return promise;
}

export function prefetchRenderedSource(reference: string): void {
  if (cache.has(reference)) return;
  loadRenderedSource(reference, true).catch(() => undefined);
}

export function holdRenderedSource(reference: string): () => void {
  holds.set(reference, (holds.get(reference) ?? 0) + 1);
  const entry = cache.get(reference);
  if (entry) entry.usedAt = Date.now();

  return () => {
    const count = (holds.get(reference) ?? 1) - 1;
    if (count > 0) holds.set(reference, count);
    else holds.delete(reference);
    const current = cache.get(reference);
    if (current) current.usedAt = Date.now();
    prune(Date.now());
  };
}
