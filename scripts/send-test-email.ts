import "./loadEnv";
import { EMAIL_CONFIG } from "@/config/site";
import { isEmailConfigured, sendEmail } from "@/lib/email/mailer";

async function main() {
  const to = process.argv[2];

  if (!isEmailConfigured()) {
    console.error("MAILTRAP_API_TOKEN is not set in .env.local");
    process.exit(1);
  }
  if (!to) {
    console.error("Pass a recipient: npm run email:test -- you@example.com");
    process.exit(1);
  }

  const result = await sendEmail({
    to,
    subject: "Usul AI: Mailtrap সংযোগ কাজ করছে",
    text: "Usul AI থেকে Mailtrap দিয়ে পাঠানো পরীক্ষামূলক ইমেইল।",
    category: EMAIL_CONFIG.categories.test,
  });

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.sent ? 0 : 1);
}

void main();
