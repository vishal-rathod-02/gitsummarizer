import crypto from "node:crypto";
import { getDb } from "../config/db.js";

/**
 * Upserts repository metadata in the repositories table.
 * Can be called inside an active transaction by passing `db`.
 *
 * @param {object} repository - Normalized repository metadata
 * @param {import("node:sqlite").DatabaseSync} [dbOverride]
 * @returns {{ id: string, owner: string, name: string, fullName: string, url: string, description: string | null, defaultBranch: string, stars: number, language: string | null }}
 */
export function upsertRepository(repository, dbOverride) {
  const db = dbOverride || getDb();
  const now = new Date().toISOString();

  const existing = db
    .prepare("SELECT id FROM repositories WHERE full_name = ?")
    .get(repository.fullName);

  const id = existing ? existing.id : crypto.randomUUID();

  if (existing) {
    db.prepare(
      `UPDATE repositories
       SET github_id = COALESCE(?, github_id),
           owner = ?,
           name = ?,
           html_url = ?,
           description = ?,
           default_branch = ?,
           stars_count = ?,
           language = ?,
           last_fetched_at = ?,
           updated_at = ?
       WHERE id = ?`
    ).run(
      repository.githubId ?? null,
      repository.owner,
      repository.name,
      repository.url,
      repository.description ?? null,
      repository.defaultBranch || "main",
      Math.max(0, Number(repository.stars) || 0),
      repository.language ?? null,
      now,
      now,
      id
    );
  } else {
    db.prepare(
      `INSERT INTO repositories (
         id, github_id, owner, name, full_name, html_url,
         description, default_branch, stars_count, language,
         last_fetched_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      repository.githubId ?? null,
      repository.owner,
      repository.name,
      repository.fullName,
      repository.url,
      repository.description ?? null,
      repository.defaultBranch || "main",
      Math.max(0, Number(repository.stars) || 0),
      repository.language ?? null,
      now,
      now,
      now
    );
  }

  return {
    id,
    owner: repository.owner,
    name: repository.name,
    fullName: repository.fullName,
    url: repository.url,
    description: repository.description ?? null,
    defaultBranch: repository.defaultBranch || "main",
    stars: Math.max(0, Number(repository.stars) || 0),
    language: repository.language ?? null
  };
}
