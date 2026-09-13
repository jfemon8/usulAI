import mammoth from "mammoth";

export async function parseDocxHtml(buffer: Buffer): Promise<string> {
  const { value } = await mammoth.convertToHtml({ buffer });
  return value;
}
