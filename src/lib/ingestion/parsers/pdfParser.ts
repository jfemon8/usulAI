import { extractText, getDocumentProxy } from "unpdf";

export async function parsePdfPages(buffer: Buffer): Promise<string[]> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: false });
  return text;
}
