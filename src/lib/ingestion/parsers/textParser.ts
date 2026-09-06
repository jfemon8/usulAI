export function parsePlainText(buffer: Buffer): string {
  return buffer.toString("utf8").replace(/\r\n/g, "\n");
}
