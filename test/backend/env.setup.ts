import { config } from "dotenv";
import path from "node:path";

process.env.NODE_ENV = "test";

config({
  path: path.resolve(process.cwd(), ".env.test"),
  override: true,
});

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set for backend tests.");
}
