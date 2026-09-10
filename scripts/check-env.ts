import "./loadEnv";
import { getEnv } from "@/lib/utils/env";

const PRODUCTION_ONLY = ["NEXT_PUBLIC_APP_URL"] as const;

function main() {
  try {
    const env = getEnv();

    console.log("Environment is valid.");
    console.log(`  database        ${env.MONGODB_DB}`);
    console.log(`  mongo pool      ${env.MONGODB_MAX_POOL_SIZE}`);
    console.log(`  cloudinary      ${env.CLOUDINARY_CLOUD_NAME}`);
    console.log(`  hadith api key  ${env.HADITH_API_KEY ? "set" : "(not set, CDN fallback)"}`);
    console.log(`  sunnah api key  ${env.SUNNAH_API_KEY ? "set" : "(not set, CDN fallback)"}`);

    const missing = PRODUCTION_ONLY.filter((key) => !process.env[key]);

    if (missing.length > 0) {
      console.warn(
        `\nWarning: ${missing.join(", ")} not set. ` +
          "These are inlined at build time; social preview URLs will point at localhost.",
      );
    }

    process.exit(0);
  } catch (error) {
    console.error("Environment is invalid:\n");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
