import path from "path";
import { config } from "dotenv";

const root = process.cwd();

config({
  path: [
    path.join(root, ".env.local"),
    path.join(root, ".env.development.local"),
    path.join(root, ".env"),
  ],
  quiet: true,
});
