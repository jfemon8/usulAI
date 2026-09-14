import { readFile } from "fs/promises";
import path from "path";
import PDFDocument from "pdfkit";
import { SITE_NAME, SOURCE_VIEW_CONFIG } from "@/config/site";
import type { SourceView } from "@/lib/sourceView/loadSourceView";
import { isArabicText, type ViewBlock } from "@/lib/sourceView/pageText";
import { splitRightToLeftToken, visualPunctuation, wrapWords } from "@/lib/sourceView/textLayout";

export interface RenderedSourcePdf {
  pdf: Buffer;
  highlight?: { page: number; top: number };
}

type FontName = keyof typeof SOURCE_VIEW_CONFIG.fonts;

interface LineStyle {
  font: FontName;
  size: number;
  color: string;
  rightToLeft: boolean;
  lineGap: number;
}

const FONT_DIRECTORY = path.join(process.cwd(), "src", "assets", "fonts");
let fontCache: Promise<Record<FontName, Buffer>> | undefined;

function loadFonts(): Promise<Record<FontName, Buffer>> {
  fontCache ??= Promise.all(
    (Object.entries(SOURCE_VIEW_CONFIG.fonts) as [FontName, string][]).map(
      async ([name, file]) => [name, await readFile(path.join(FONT_DIRECTORY, file))] as const,
    ),
  ).then((entries) => Object.fromEntries(entries) as Record<FontName, Buffer>);
  return fontCache;
}

export async function renderSourcePdf(view: SourceView): Promise<RenderedSourcePdf> {
  const fonts = await loadFonts();
  const { page, fontSize, colors } = SOURCE_VIEW_CONFIG;
  const doc = new PDFDocument({
    size: [page.width, page.height],
    margin: page.margin,
    bufferPages: true,
    info: { Title: view.reference, Author: SITE_NAME, Creator: SITE_NAME },
  });

  for (const name of Object.keys(fonts) as FontName[]) doc.registerFont(name, fonts[name]);

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const left = page.margin;
  const width = page.width - page.margin * 2;
  const right = left + width;
  const top = page.margin;
  const bottom = page.height - page.margin - fontSize.footer * 2;
  let y = top;
  let pageNumber = 1;
  let highlight: RenderedSourcePdf["highlight"];

  const nextPage = () => {
    doc.addPage();
    pageNumber += 1;
    y = top;
  };

  const lineHeight = (style: LineStyle) => {
    doc.font(style.font).fontSize(style.size);
    return doc.currentLineHeight(true) + style.lineGap;
  };

  const drawToken = (text: string, x: number) => {
    doc.text(text, x, y, { lineBreak: false });
    return doc.widthOfString(text);
  };

  const drawLine = (words: string[], style: LineStyle) => {
    doc.font(style.font).fontSize(style.size).fillColor(style.color);

    if (!style.rightToLeft) {
      doc.text(words.join(" "), left, y, { lineBreak: false });
      return;
    }

    const space = doc.widthOfString(" ");
    let x = right;
    for (const word of words) {
      const { leading, core, trailing } = splitRightToLeftToken(word);
      const pieces = [visualPunctuation(leading), core, visualPunctuation(trailing)].filter(
        Boolean,
      );
      const total = pieces.reduce((sum, piece) => sum + doc.widthOfString(piece), 0);
      let cursor = x - total;
      for (const piece of [...pieces].reverse()) cursor += drawToken(piece, cursor);
      x -= total + space;
    }
  };

  const paragraph = (
    text: string,
    style: LineStyle,
    options: { highlighted?: boolean; extendBelow?: number } = {},
  ) => {
    doc.font(style.font).fontSize(style.size);
    const lines = wrapWords(text, width, (value) => doc.widthOfString(value));
    const height = lineHeight(style);

    lines.forEach((words, index) => {
      if (y + height > bottom) nextPage();
      if (options.highlighted) {
        const last = index === lines.length - 1;
        const boxTop = y - (index === 0 ? 4 : 0.5);
        const boxHeight = y + height + (last ? (options.extendBelow ?? 0) + 2 : 0.5) - boxTop;
        doc
          .rect(left - 8, boxTop, width + 16, boxHeight)
          .fillColor(colors.highlight)
          .fill();
        doc
          .rect(left - 8, boxTop, 3, boxHeight)
          .fillColor(colors.highlightEdge)
          .fill();
        highlight ??= { page: pageNumber, top: Math.max(0, boxTop / page.height) };
      }
      drawLine(words, style);
      y += height;
    });
  };

  const styleFor = (text: string, font: FontName, size: number, color: string): LineStyle =>
    isArabicText(text)
      ? { font: "arabic", size: size + 3, color, rightToLeft: true, lineGap: 1 }
      : { font, size, color, rightToLeft: false, lineGap: 1 };

  paragraph(view.title, styleFor(view.title, "banglaBold", fontSize.title, colors.text));
  y += 2;
  for (const detail of view.details) {
    paragraph(detail, styleFor(detail, "bangla", fontSize.detail, colors.muted));
  }
  y += 6;
  doc.moveTo(left, y).lineTo(right, y).lineWidth(0.6).strokeColor(colors.rule).stroke();
  y += 12;

  const blockStyle = (block: ViewBlock): LineStyle => {
    const color = block.heading ? colors.accent : colors.text;
    return block.kind === "arabic"
      ? {
          font: "arabic",
          size: fontSize.arabic + (block.heading ? 1 : 0),
          color,
          rightToLeft: true,
          lineGap: 3,
        }
      : {
          font: block.heading ? "banglaBold" : "bangla",
          size: fontSize.text,
          color,
          rightToLeft: false,
          lineGap: 2.5,
        };
  };

  view.blocks.forEach((block, index) => {
    const style = blockStyle(block);
    const gap = lineHeight(style) * 0.45;
    const joinsNext = Boolean(block.highlight && view.blocks[index + 1]?.highlight);
    const labelStyle: LineStyle = {
      font: "banglaBold",
      size: fontSize.label,
      color: colors.accent,
      rightToLeft: false,
      lineGap: 1,
    };

    const keepLines = block.heading ? 3 : 1;
    if (y + lineHeight(labelStyle) + lineHeight(style) * keepLines > bottom) nextPage();
    if (block.label) paragraph(block.label, labelStyle, { highlighted: block.highlight });
    paragraph(block.text, style, {
      highlighted: block.highlight,
      extendBelow: joinsNext ? gap : 0,
    });
    y += gap;
  });

  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    doc.page.margins.bottom = 0;
    doc
      .font("bangla")
      .fontSize(fontSize.footer)
      .fillColor(colors.muted)
      .text(
        [SITE_NAME, view.attribution, `${index + 1}/${range.count}`].filter(Boolean).join(" · "),
        left,
        page.height - page.margin,
        { width, align: "center", lineBreak: false, height: fontSize.footer * 2 },
      );
  }

  doc.end();
  return { pdf: await finished, ...(highlight ? { highlight } : {}) };
}
