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
}

const MAX_CACHED_SOURCES = 12;
const cache = new Map<string, Promise<RenderedSource>>();

export function sourcePdfUrl(reference: string): string {
  return `/api/source-view?ref=${encodeURIComponent(reference)}`;
}

function release(entry: Promise<RenderedSource>) {
  void entry
    .then((rendered) => rendered.pages.forEach((page) => URL.revokeObjectURL(page.src)))
    .catch(() => undefined);
}

async function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("render failed"))),
      "image/png",
    ),
  );
}

async function renderSource(reference: string): Promise<RenderedSource> {
  const pdfUrl = sourcePdfUrl(reference);
  const response = await fetch(pdfUrl);

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "সূত্রটি এখন দেখানো যাচ্ছে না।");
  }

  const data = new Uint8Array(await response.arrayBuffer());
  const highlightPage = Number(response.headers.get("x-highlight-page"));
  const highlightTop = Number(response.headers.get("x-highlight-top"));
  const externalUrl = response.headers.get("x-source-external-url") ?? undefined;

  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(data);
  const pages: RenderedPage[] = [];

  for (let number = 1; number <= pdf.numPages; number += 1) {
    const page = await pdf.getPage(number);
    const viewport = page.getViewport({ scale: SOURCE_VIEW_CONFIG.renderScale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas unavailable");
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    pages.push({
      src: URL.createObjectURL(await canvasBlob(canvas)),
      width: canvas.width,
      height: canvas.height,
    });
    page.cleanup();
  }

  await pdf.cleanup();

  return {
    pdfUrl,
    pages,
    ...(highlightPage > 0 ? { highlight: { page: highlightPage, top: highlightTop || 0 } } : {}),
    ...(externalUrl ? { externalUrl } : {}),
  };
}

export function loadRenderedSource(reference: string): Promise<RenderedSource> {
  const cached = cache.get(reference);
  if (cached) {
    cache.delete(reference);
    cache.set(reference, cached);
    return cached;
  }

  const pending = renderSource(reference).catch((error: unknown) => {
    cache.delete(reference);
    throw error;
  });
  cache.set(reference, pending);

  while (cache.size > MAX_CACHED_SOURCES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    const entry = cache.get(oldest);
    cache.delete(oldest);
    if (entry) release(entry);
  }

  return pending;
}
