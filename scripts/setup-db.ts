import "./loadEnv";
import { getMongoClient } from "@/lib/db/mongoClient";
import { setupIndexes } from "@/lib/db/setupIndexes";

setupIndexes()
  .then(async () => {
    console.log("Database setup complete.");
    await (await getMongoClient()).close();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Database setup failed:", error);
    await (await getMongoClient()).close().catch(() => {});
    process.exit(1);
  });
