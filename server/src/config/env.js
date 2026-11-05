import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "5000", 10),
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:5173",

  // SQLite configuration (zero-config local file by default; supports ":memory:" for tests)
  DB_FILE:
    process.env.DB_FILE ||
    path.join(__dirname, "..", "..", "data", "gitsummarizer.sqlite"),

  // GitHub API configuration
  GITHUB_API_BASE_URL: process.env.GITHUB_API_BASE_URL || "https://api.github.com",
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || "",
  GITHUB_TIMEOUT_MS: parseInt(process.env.GITHUB_TIMEOUT_MS || "10000", 10),
  DEFAULT_COMMIT_LIMIT: parseInt(process.env.DEFAULT_COMMIT_LIMIT || "20", 10),
  MAX_COMMIT_LIMIT: parseInt(process.env.MAX_COMMIT_LIMIT || "50", 10),
  MAX_README_CHARS: parseInt(process.env.MAX_README_CHARS || "12000", 10),

  // AI provider configuration
  AI_PROVIDER: (process.env.AI_PROVIDER || "openai").toLowerCase(),
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-4o-mini",
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  AI_TIMEOUT_MS: parseInt(process.env.AI_TIMEOUT_MS || "25000", 10),
  AI_STRICT_MODE: process.env.AI_STRICT_MODE === "true",

  // JWT / Auth configuration
  JWT_SECRET:
    process.env.JWT_SECRET || "gitsummarizer-dev-secret-change-in-production",
  JWT_EXPIRES_IN_SECONDS: parseInt(
    process.env.JWT_EXPIRES_IN_SECONDS || String(24 * 60 * 60),
    10
  ),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: parseInt(
    process.env.RATE_LIMIT_WINDOW_MS || String(15 * 60 * 1000),
    10
  ),
  RATE_LIMIT_MAX_REQUESTS: parseInt(
    process.env.RATE_LIMIT_MAX_REQUESTS || "100",
    10
  )
};

export default env;
