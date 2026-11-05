import env from "../config/env.js";
import AppError from "../utils/AppError.js";
import { parseRepositoryUrl } from "../services/github/urlParser.js";

/**
 * Validates the POST /api/summaries payload.
 */
export function validateCreateSummaryRequest(body = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError(
      400,
      "INVALID_REPOSITORY_URL",
      "Request body must be a JSON object containing repositoryUrl."
    );
  }

  const rawUrl = body.repositoryUrl ?? body.url ?? body.repoUrl;
  // Run canonical URL check immediately so invalid URLs fail fast with 400 INVALID_REPOSITORY_URL
  const parsedUrl = parseRepositoryUrl(rawUrl);

  let commitRef = null;
  if (body.commitRef !== undefined && body.commitRef !== null && body.commitRef !== "") {
    if (typeof body.commitRef !== "string" || body.commitRef.trim().length > 100) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "commitRef must be a valid commit SHA or branch reference."
      );
    }
    commitRef = body.commitRef.trim();
  }

  let commitLimit = env.DEFAULT_COMMIT_LIMIT;
  if (body.commitLimit !== undefined && body.commitLimit !== null) {
    const parsedLimit = Number(body.commitLimit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "commitLimit must be a positive integer."
      );
    }
    commitLimit = Math.min(parsedLimit, env.MAX_COMMIT_LIMIT);
  }

  return {
    repositoryUrl: parsedUrl.canonicalUrl,
    commitRef: commitRef || parsedUrl.commitRef || null,
    commitLimit
  };
}

/**
 * Validates pagination query parameters (?page=1&limit=10).
 */
export function validatePaginationQuery(query = {}) {
  let page = 1;
  let limit = 10;

  if (query.page !== undefined) {
    const parsedPage = Number(query.page);
    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Query parameter 'page' must be a positive integer."
      );
    }
    page = parsedPage;
  }

  if (query.limit !== undefined) {
    const parsedLimit = Number(query.limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Query parameter 'limit' must be a positive integer."
      );
    }
    limit = Math.min(parsedLimit, 50);
  }

  return { page, limit };
}

/**
 * Validates the :id route parameter.
 */
export function validateSummaryIdParam(params = {}) {
  const id = typeof params.id === "string" ? params.id.trim() : "";
  if (!id || id.length > 100) {
    throw new AppError(400, "VALIDATION_ERROR", "A valid summary ID is required.");
  }
  return id;
}
