import { EMAIL_CONFIG } from "@/config/site";
import { fill, type EmailContext } from "@/lib/email/templates/context";

export type EmailBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string; muted?: boolean }
  | { kind: "button"; label: string; url: string }
  | { kind: "link"; intro: string; url: string }
  | { kind: "details"; title?: string; rows: readonly { label: string; value: string }[] }
  | { kind: "list"; title?: string; items: readonly string[] }
  | { kind: "notice"; text: string };

export interface EmailDocument {
  subject: string;
  preheader: string;
  recipientEmail: string;
  blocks: readonly EmailBlock[];
}

export interface RenderedEmail {
  subject: string;
  preheader: string;
  html: string;
  text: string;
}

const FONT_STACK =
  "'Hind Siliguri','Noto Sans Bengali','Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const FOOTER = {
  bn: {
    sentTo: "এই ইমেইলটি {email} ঠিকানায় পাঠানো হয়েছে।",
    support: "সহায়তা লাগলে লিখুন",
    rights: "© {year} {appName}",
  },
  en: {
    sentTo: "This email was sent to {email}.",
    support: "Need help? Write to",
    rights: "© {year} {appName}",
  },
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function safeUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`Email links must use http or https, got ${url.protocol}`);
  }
  return url.toString();
}

function blockHtml(block: EmailBlock): string {
  const { colors } = EMAIL_CONFIG;

  switch (block.kind) {
    case "heading":
      return `<h1 style="margin:0 0 16px;font-size:22px;line-height:1.4;font-weight:700;color:${colors.text};">${escapeHtml(block.text)}</h1>`;
    case "paragraph":
      return `<p style="margin:0 0 16px;font-size:${block.muted ? "14px" : "16px"};line-height:1.7;color:${block.muted ? colors.muted : colors.text};">${escapeHtml(block.text)}</p>`;
    case "button": {
      const url = escapeHtml(safeUrl(block.url));
      return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;"><tr><td align="center" bgcolor="${colors.button}" style="border-radius:8px;"><a href="${url}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 28px;font-family:${FONT_STACK};font-size:16px;font-weight:600;line-height:1.2;color:${colors.buttonText};text-decoration:none;border-radius:8px;">${escapeHtml(block.label)}</a></td></tr></table>`;
    }
    case "link": {
      const url = escapeHtml(safeUrl(block.url));
      return `<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:${colors.muted};">${escapeHtml(block.intro)}<br><a href="${url}" target="_blank" rel="noopener" style="color:${colors.button};word-break:break-all;">${url}</a></p>`;
    }
    case "details": {
      const rows = block.rows
        .map(
          (row) =>
            `<tr><td style="padding:6px 12px 6px 0;font-size:14px;color:${colors.muted};white-space:nowrap;vertical-align:top;">${escapeHtml(row.label)}</td><td style="padding:6px 0;font-size:14px;color:${colors.text};word-break:break-word;">${escapeHtml(row.value)}</td></tr>`,
        )
        .join("");
      const title = block.title
        ? `<p style="margin:0 0 8px;font-size:14px;font-weight:600;color:${colors.text};">${escapeHtml(block.title)}</p>`
        : "";
      return `<div style="margin:0 0 20px;padding:16px;background:${colors.notice};border-radius:8px;">${title}<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${rows}</table></div>`;
    }
    case "list": {
      const title = block.title
        ? `<p style="margin:0 0 8px;font-size:16px;font-weight:600;color:${colors.text};">${escapeHtml(block.title)}</p>`
        : "";
      const items = block.items
        .map(
          (item) =>
            `<li style="margin:0 0 8px;font-size:15px;line-height:1.6;color:${colors.text};">${escapeHtml(item)}</li>`,
        )
        .join("");
      return `${title}<ul style="margin:0 0 20px;padding-left:20px;">${items}</ul>`;
    }
    case "notice":
      return `<p style="margin:0 0 16px;padding:12px 16px;background:${colors.notice};border-left:3px solid ${colors.button};border-radius:4px;font-size:14px;line-height:1.6;color:${colors.text};">${escapeHtml(block.text)}</p>`;
  }
}

function blockText(block: EmailBlock): string {
  switch (block.kind) {
    case "heading":
      return block.text.toUpperCase();
    case "paragraph":
    case "notice":
      return block.text;
    case "button":
      return `${block.label}: ${safeUrl(block.url)}`;
    case "link":
      return `${block.intro}\n${safeUrl(block.url)}`;
    case "details":
      return [block.title, ...block.rows.map((row) => `${row.label}: ${row.value}`)]
        .filter(Boolean)
        .join("\n");
    case "list":
      return [block.title, ...block.items.map((item) => `- ${item}`)].filter(Boolean).join("\n");
  }
}

export function renderEmail(context: EmailContext, document: EmailDocument): RenderedEmail {
  const { colors } = EMAIL_CONFIG;
  const footer = FOOTER[context.locale];
  const values = { email: document.recipientEmail, year: context.year, appName: context.appName };
  const appUrl = escapeHtml(safeUrl(context.appUrl));
  const supportEmail = escapeHtml(context.supportEmail);

  const html = `<!DOCTYPE html>
<html lang="${context.locale}" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(document.subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap" rel="stylesheet">
<style>
@media (max-width:620px){.email-card{padding:24px 20px!important}.email-shell{padding:16px 8px!important}}
a{color:${colors.button}}
</style>
</head>
<body style="margin:0;padding:0;background:${colors.background};font-family:${FONT_STACK};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(document.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${colors.background};">
<tr><td class="email-shell" align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
<tr><td align="center" style="padding:0 0 20px;">
<a href="${appUrl}" target="_blank" rel="noopener" style="text-decoration:none;color:${colors.text};">
<img src="${escapeHtml(safeUrl(context.logoUrl))}" width="48" height="48" alt="${escapeHtml(context.appName)}" style="display:block;margin:0 auto 8px;border:0;border-radius:12px;">
<span style="display:block;font-size:20px;font-weight:700;color:${colors.text};">${escapeHtml(context.appName)}</span>
<span style="display:block;font-size:13px;color:${colors.muted};">${escapeHtml(context.tagline)}</span>
</a>
</td></tr>
<tr><td class="email-card" style="background:${colors.card};border:1px solid ${colors.border};border-radius:12px;padding:32px;">
${document.blocks.map(blockHtml).join("\n")}
</td></tr>
<tr><td align="center" style="padding:24px 8px 0;font-size:12px;line-height:1.7;color:${colors.muted};">
<p style="margin:0 0 6px;">${escapeHtml(footer.support)} <a href="mailto:${supportEmail}" style="color:${colors.button};">${supportEmail}</a></p>
<p style="margin:0 0 6px;">${escapeHtml(fill(footer.sentTo, values))}</p>
<p style="margin:0;"><a href="${appUrl}" target="_blank" rel="noopener" style="color:${colors.muted};">${escapeHtml(context.appHost)}</a> · ${escapeHtml(fill(footer.rights, values))}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    `${context.appName} | ${context.tagline}`,
    "",
    ...document.blocks.map(blockText).flatMap((part) => [part, ""]),
    "--",
    `${footer.support} ${context.supportEmail}`,
    fill(footer.sentTo, values),
    `${context.appUrl} · ${fill(footer.rights, values)}`,
  ].join("\n");

  return { subject: document.subject, preheader: document.preheader, html, text };
}
