import env from "../config/env.js";
import AppError from "../utils/AppError.js";
import { parseRepositoryUrl } from "./github/urlParser.js";
import { fetchRepositoryBundle } from "./github/githubClient.js";
import { generateRepositorySummary } from "./ai/aiAdapter.js";
import {
  saveSummaryBundle,
  findSummaryById,
  listSummaries,
  deleteSummaryById
} from "../repositories/summaryRepository.js";

/**
 * Orchestrates full summary generation:
 * URL validation -> GitHub retrieval -> AI structured summary -> DB persistence.
 */
export async function createSummary({
  repositoryUrl,
  commitRef = null,
  commitLimit = env.DEFAULT_COMMIT_LIMIT,
  userId = null,
  githubFetchImpl,
  aiFetchImpl
}) {
  const parsedUrl = parseRepositoryUrl(repositoryUrl);
  const effectiveCommitRef = commitRef || parsedUrl.commitRef || null;

  const githubBundle = await fetchRepositoryBundle({
    owner: parsedUrl.owner,
    repo: parsedUrl.repo,
    commitRef: effectiveCommitRef,
    commitLimit,
    fetchImpl: githubFetchImpl
  });

  const aiResult = await generateRepositorySummary({
    repository: githubBundle.repository,
    readme: githubBundle.readme,
    commits: githubBundle.commits,
    commitRef: effectiveCommitRef,
    fetchImpl: aiFetchImpl
  });

  const persisted = saveSummaryBundle({
    userId,
    inputUrl: parsedUrl.canonicalUrl,
    commitRef: effectiveCommitRef,
    repository: githubBundle.repository,
    summary: aiResult.summary,
    readmeAvailable: githubBundle.readme.available,
    commitLimit: githubBundle.commitLimit,
    commits: githubBundle.commits,
    aiProvider: aiResult.provider,
    aiModel: aiResult.model
  });

  return persisted;
}

/**
 * Lists paginated summary history scoped to the current user (or anonymous history if unauthenticated).
 */
export function getSummaryHistory({ userId = null, page = 1, limit = 10 }) {
  return listSummaries({ userId, page, limit });
}

/**
 * Fetches a single summary by ID and enforces user ownership when the summary belongs to an account.
 */
export function getSummaryDetail({ summaryId, userId = null }) {
  const record = findSummaryById(summaryId);
  if (!record) {
    throw new AppError(404, "SUMMARY_NOT_FOUND", "Summary not found.");
  }

  // Enforce ownership if the summary was created by an authenticated user
  if (record.userId && record.userId !== userId) {
    throw new AppError(404, "SUMMARY_NOT_FOUND", "Summary not found.");
  }

  const { userId: _internalUserId, ...publicRecord } = record;
  return publicRecord;
}

/**
 * Deletes a single summary by ID and enforces user ownership.
 */
export function removeSummary({ summaryId, userId = null }) {
  const record = findSummaryById(summaryId);
  if (!record) {
    throw new AppError(404, "SUMMARY_NOT_FOUND", "Summary not found.");
  }

  if (record.userId && record.userId !== userId) {
    throw new AppError(404, "SUMMARY_NOT_FOUND", "Summary not found.");
  }

  deleteSummaryById(summaryId);
  return { deleted: true };
}
