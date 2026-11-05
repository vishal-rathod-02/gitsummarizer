import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import env from "./env.js";
import AppError from "../utils/AppError.js";

let dbInstance = null;

const SCHEMA_DDL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS repositories (
  id TEXT PRIMARY KEY,
  github_id INTEGER UNIQUE,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL UNIQUE,
  html_url TEXT NOT NULL,
  description TEXT,
  default_branch TEXT,
  stars_count INTEGER NOT NULL DEFAULT 0 CHECK (stars_count >= 0),
  language TEXT,
  last_fetched_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS summaries (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  repository_id TEXT NOT NULL REFERENCES repositories(id),
  input_url TEXT NOT NULL,
  commit_ref TEXT,
  overview TEXT NOT NULL,
  features TEXT NOT NULL DEFAULT '[]',
  prerequisites TEXT NOT NULL DEFAULT '[]',
  commit_digest TEXT,
  readme_available INTEGER NOT NULL DEFAULT 1,
  commit_limit INTEGER NOT NULL DEFAULT 20,
  source_commit_count INTEGER NOT NULL DEFAULT 0 CHECK (source_commit_count >= 0),
  ai_provider TEXT NOT NULL,
  ai_model TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS summary_commits (
  id TEXT PRIMARY KEY,
  summary_id TEXT NOT NULL REFERENCES summaries(id) ON DELETE CASCADE,
  sha TEXT NOT NULL,
  message TEXT NOT NULL,
  author_name TEXT,
  committed_at TEXT,
  UNIQUE(summary_id, sha)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_summaries_user_created
  ON summaries(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_summaries_repo_created
  ON summaries(repository_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_summary_commits_summary
  ON summary_commits(summary_id);
`;

/**
 * Initializes and returns the SQLite database instance.
 * Runs idempotent schema migrations automatically.
 * @param {string} [customDbFile]
 * @returns {DatabaseSync}
 */
export function getDb(customDbFile) {
  if (dbInstance) {
    return dbInstance;
  }

  const targetFile = customDbFile || process.env.DB_FILE || env.DB_FILE;

  try {
    if (targetFile !== ":memory:") {
      const dir = path.dirname(targetFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    dbInstance = new DatabaseSync(targetFile);
    dbInstance.exec(SCHEMA_DDL);
    return dbInstance;
  } catch (err) {
    throw new AppError(
      503,
      "SERVICE_UNAVAILABLE",
      "Database service is currently unavailable.",
      { cause: err.message }
    );
  }
}

/**
 * Executes a synchronous callback inside a SQLite transaction.
 * Rolls back automatically if an error is thrown.
 * @template T
 * @param {(db: DatabaseSync) => T} fn
 * @returns {T}
 */
export function withTransaction(fn) {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE TRANSACTION");
  try {
    const result = fn(db);
    db.exec("COMMIT");
    return result;
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch (_rollbackErr) {
      // Ignore rollback errors if transaction already closed
    }
    throw err;
  }
}

/**
 * Verifies database connectivity without exposing credentials or file paths.
 * @returns {boolean}
 */
export function checkDatabaseHealth() {
  try {
    const db = getDb();
    const row = db.prepare("SELECT 1 AS ok").get();
    return Boolean(row && row.ok === 1);
  } catch (_err) {
    return false;
  }
}

/**
 * Closes and resets the current database instance (useful in automated tests).
 */
export function closeDb() {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch (_err) {
      // Ignore close error
    }
    dbInstance = null;
  }
}
