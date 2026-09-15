import "./loadEnv";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { EMAIL_CONFIG } from "@/config/site";
import {
  appLink,
  emailContext,
  passwordResetEmail,
  welcomeEmail,
  type EmailLocale,
} from "@/lib/email/templates";
import { staffAccountEmail } from "@/lib/email/templates/staffAccount";

const OUTPUT = path.resolve(".email-preview");

async function main() {
  await mkdir(OUTPUT, { recursive: true });
  const email = process.argv[2] ?? "user@example.com";

  for (const locale of ["bn", "en"] as EmailLocale[]) {
    const context = emailContext({ locale });
    const previews = {
      "password-reset": passwordResetEmail(
        {
          email,
          name: locale === "bn" ? "আব্দুল্লাহ" : "Abdullah",
          resetUrl: appLink(context, EMAIL_CONFIG.links.passwordReset, { token: "preview-token" }),
          ipAddress: "203.0.113.24",
          device: "Chrome, Windows",
        },
        { locale },
      ),
      "welcome-verify": welcomeEmail(
        {
          email,
          name: locale === "bn" ? "আব্দুল্লাহ" : "Abdullah",
          verifyUrl: appLink(context, EMAIL_CONFIG.links.verifyEmail, { token: "preview-token" }),
        },
        { locale },
      ),
      welcome: welcomeEmail({ email }, { locale }),
      "staff-created": staffAccountEmail(
        {
          kind: "created",
          email,
          name: locale === "bn" ? "মাওলানা আব্দুল্লাহ" : "Maulana Abdullah",
          password: "Preview#Pass42",
          categoryName: "মুফতি",
          role: "scholar",
        },
        { locale },
      ),
      "staff-reset": staffAccountEmail(
        {
          kind: "reset",
          email,
          name: locale === "bn" ? "আব্দুর রহমান" : "Abdur Rahman",
          password: "Reset@Pass77",
          categoryName: "মডারেটর",
          role: "moderator",
        },
        { locale },
      ),
    };

    for (const [name, rendered] of Object.entries(previews)) {
      await writeFile(path.join(OUTPUT, `${name}.${locale}.html`), rendered.html, "utf8");
      await writeFile(path.join(OUTPUT, `${name}.${locale}.txt`), rendered.text, "utf8");
      console.log(`${name}.${locale}: ${rendered.subject}`);
    }
  }
  console.log(`Previews written to ${OUTPUT}`);
}

void main();
