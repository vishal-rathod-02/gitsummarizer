import crypto from "node:crypto";
import { getDb, withTransaction } from "../config/db.js";
import { upsertRepository } from "./repoRepository.js";

function safeParseJsonArray(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_err) {
    return [];
  }
}

/**
 * Formats a joined summary + repository database row into the API response shape
 * defined in API.md Section 2 & Section 4.
 */
function formatSummaryDetail(row, commitRows = []) {
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id || null,
    inputUrl: row.input_url,
    commitRef: row.commit_ref || null,
    repository: {
      owner: row.owner,
      name: row.name,
      fullName: row.full_name,
      url: row.html_url,
      description: row.description,
      defaultBranch: row.default_branch,
      stars: row.stars_count,
      language: row.language
    },
    summary: {
      overview: row.overview,
      features: safeParseJsonArray(row.features),
      prerequisites: safeParseJsonArray(row.prerequisites),
      commitDigest: row.commit_digest || ""
    },
    source: {
      readmeAvailable: Boolean(row.readme_available),
      commitCount: row.source_commit_count,
      commitLimit: row.commit_limit
    },
    commits: commitRows.map((c) => ({
      sha: c.sha,
      message: c.message,
      authorName: c.author_name,
      committedAt: c.committed_at
    })),
    ai: {
      provider: row.ai_provider,
      model: row.ai_model
    },
    createdAt: row.created_at
  };
}

/**
 * Persists repository metadata, generated summary, and source commits inside a single transaction.
 */
export function saveSummaryBundle({
  userId = null,
  inputUrl,
  commitRef = null,
  repository,
  summary,
  readmeAvailable = true,
  commitLimit = 20,
  commits = [],
  aiProvider = "openai",
  aiModel = "gpt-4o-mini"
}) {
  return withTransaction((db) => {
    const savedRepo = upsertRepository(repository, db);
    const summaryId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    db.prepare(
      `INSERT INTO summaries (
         id, user_id, repository_id, input_url, commit_ref,
         overview, features, prerequisites, commit_digest,
         readme_available, commit_limit, source_commit_count,
         ai_provider, ai_model, status, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)`
    ).run(
      summaryId,
      userId || null,
      savedRepo.id,
      inputUrl,
      commitRef || null,
      summary.overview,
      JSON.stringify(summary.features || []),
      JSON.stringify(summary.prerequisites || []),
      summary.commitDigest || "",
      readmeAvailable ? 1 : 0,
      Number(commitLimit) || 20,
      Array.isArray(commits) ? commits.length : 0,
      aiProvider,
      aiModel || null,
      createdAt
    );

    const insertCommitStmt = db.prepare(
      `INSERT OR IGNORE INTO summary_commits (
         id, summary_id, sha, message, author_name, committed_at
       ) VALUES (?, ?, ?, ?, ?, ?)`
    );

    const seenShas = new Set();
    const persistedCommits = [];
    if (Array.isArray(commits)) {
      for (const c of commits) {
        if (!c || !c.sha || seenShas.has(c.sha)) continue;
        seenShas.add(c.sha);
        insertCommitStmt.run(
          crypto.randomUUID(),
          summaryId,
          c.sha,
          c.message || "",
          c.authorName || null,
          c.committedAt || null
        );
        persistedCommits.push({
          sha: c.sha,
          message: c.message || "",
          authorName: c.authorName || null,
          committedAt: c.committedAt || null
        });
      }
    }

    return {
      id: summaryId,
      repository: {
        owner: savedRepo.owner,
        name: savedRepo.name,
        fullName: savedRepo.fullName,
        url: savedRepo.url,
        description: savedRepo.description,
        defaultBranch: savedRepo.defaultBranch,
        stars: savedRepo.stars,
        language: savedRepo.language
      },
      summary: {
        overview: summary.overview,
        features: summary.features || [],
        prerequisites: summary.prerequisites || [],
        commitDigest: summary.commitDigest || ""
      },
      source: {
        readmeAvailable: Boolean(readmeAvailable),
        commitCount: persistedCommits.length,
        commitLimit: Number(commitLimit) || 20
      },
      commits: persistedCommits,
      ai: {
        provider: aiProvider,
        model: aiModel
      },
      commitRef: commitRef || null,
      createdAt
    };
  });
}

/**
 * Retrieves a single summary by ID, including repository metadata and saved commits.
 */
export function findSummaryById(summaryId) {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT
         s.*,
         r.owner,
         r.name,
         r.full_name,
         r.html_url,
         r.description,
         r.default_branch,
         r.stars_count,
         r.language
       FROM summaries s
       INNER JOIN repositories r ON r.id = s.repository_id
       WHERE s.id = ?`
    )
    .get(summaryId);

  if (!row) {
    return null;
  }

  const commitRows = db
    .prepare(
      `SELECT sha, message, author_name, committed_at
       FROM summary_commits
       WHERE summary_id = ?
       ORDER BY committed_at DESC`
    )
    .all(summaryId);

  return formatSummaryDetail(row, commitRows);
}

/**
 * Lists paginated summaries.
 * - When `userId` is provided, scopes strictly to that user's summaries.
 * - When `userId` is null (anonymous mode), returns anonymous summaries (`user_id IS NULL`).
 */
export function listSummaries({ userId = null, page = 1, limit = 10 }) {
  const db = getDb();
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(Math.max(1, Number(limit) || 10), 50);
  const offset = (safePage - 1) * safeLimit;

  const whereClause = userId ? "WHERE s.user_id = ?" : "WHERE s.user_id IS NULL";
  const countParams = userId ? [userId] : [];
  const queryParams = userId ? [userId, safeLimit, offset] : [safeLimit, offset];

  const countRow = db
    .prepare(`SELECT COUNT(*) AS total FROM summaries s ${whereClause}`)
    .get(...countParams);
  const total = countRow ? Number(countRow.total) : 0;
  const totalPages = total === 0 ? 0 : Math.ceil(total / safeLimit);

  const rows = db
    .prepare(
      `SELECT
         s.id,
         s.overview,
         s.created_at,
         r.owner,
         r.name,
         r.full_name,
         r.html_url,
         r.description,
         r.stars_count,
         r.language
       FROM summaries s
       INNER JOIN repositories r ON r.id = s.repository_id
       ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...queryParams);

  const data = rows.map((row) => {
    const overviewText = row.overview || "";
    const overviewPreview =
      overviewText.length > 180
        ? `${overviewText.slice(0, 177).trim()}...`
        : overviewText;

    return {
      id: row.id,
      repository: {
        owner: row.owner,
        name: row.name,
        fullName: row.full_name,
        url: row.html_url,
        description: row.description,
        stars: row.stars_count,
        language: row.language
      },
      overviewPreview,
      createdAt: row.created_at
    };
  });

  return {
    data,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages
    }
  };
}

/**
 * Deletes a summary by ID. Cascades to summary_commits while keeping shared repository row intact.
 */
export function deleteSummaryById(summaryId) {
  const db = getDb();
  const result = db
    .prepare("DELETE FROM summaries WHERE id = ?")
    .run(summaryId);
  return result.changes > 0;
}
