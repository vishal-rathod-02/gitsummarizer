import env from "../../config/env.js";
import AppError from "../../utils/AppError.js";

/**
 * Builds standard GitHub REST API headers.
 * @returns {Record<string, string>}
 */
function buildGitHubHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "GitSummarizer-API/1.0",
    "X-GitHub-Api-Version": "2022-11-28"
  };

  const token = process.env.GITHUB_TOKEN || env.GITHUB_TOKEN;
  if (token && token.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }

  return headers;
}

/**
 * Performs a bounded-timeout GET request against the GitHub REST API.
 * @param {string} endpointPath
 * @param {{ fetchImpl?: typeof fetch, allow404?: boolean, allow409?: boolean }} [options]
 */
export async function requestGitHub(endpointPath, options = {}) {
  const fetchFn = options.fetchImpl || global.fetch;
  const baseUrl = (process.env.GITHUB_API_BASE_URL || env.GITHUB_API_BASE_URL).replace(
    /\/+$/,
    ""
  );
  const url = `${baseUrl}${endpointPath}`;
  const timeoutMs = env.GITHUB_TIMEOUT_MS || 10000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetchFn(url, {
      method: "GET",
      headers: buildGitHubHeaders(),
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err && err.name === "AbortError") {
      throw new AppError(
        502,
        "GITHUB_UPSTREAM_ERROR",
        "GitHub API request timed out. Please try again shortly."
      );
    }
    throw new AppError(
      502,
      "GITHUB_UPSTREAM_ERROR",
      "Unable to reach GitHub API. Please check network connectivity and try again."
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const rateLimitRemaining =
    response.headers && typeof response.headers.get === "function"
      ? response.headers.get("x-ratelimit-remaining")
      : null;
  const rateLimitReset =
    response.headers && typeof response.headers.get === "function"
      ? response.headers.get("x-ratelimit-reset")
      : null;

  if (
    response.status === 429 ||
    (response.status === 403 && rateLimitRemaining === "0")
  ) {
    let resetMessage = "Please wait and try again later.";
    if (rateLimitReset && !Number.isNaN(Number(rateLimitReset))) {
      const resetDate = new Date(Number(rateLimitReset) * 1000).toISOString();
      resetMessage = `GitHub API rate limit reached. Resets at ${resetDate}.`;
    }
    throw new AppError(
      429,
      "RATE_LIMITED",
      `GitHub rate limit exceeded. ${resetMessage}`
    );
  }

  if (response.status === 404 && options.allow404) {
    return null;
  }

  if (response.status === 409 && options.allow409) {
    return null;
  }

  if (response.status === 404) {
    throw new AppError(
      404,
      "REPOSITORY_NOT_FOUND",
      "Repository not found or is private. Please enter a valid public GitHub repository URL."
    );
  }

  if (response.status === 403 || response.status === 451) {
    throw new AppError(
      422,
      "REPOSITORY_NOT_PUBLIC_OR_ACCESSIBLE",
      "This repository is not publicly accessible."
    );
  }

  if (response.status >= 500) {
    throw new AppError(
      502,
      "GITHUB_UPSTREAM_ERROR",
      "GitHub service is temporarily unavailable. Please try again later."
    );
  }

  if (!response.ok) {
    throw new AppError(
      502,
      "GITHUB_UPSTREAM_ERROR",
      `Unexpected response from GitHub API (status ${response.status}).`
    );
  }

  try {
    return await response.json();
  } catch (_err) {
    throw new AppError(
      502,
      "GITHUB_UPSTREAM_ERROR",
      "Received an invalid response payload from GitHub API."
    );
  }
}

/**
 * Normalizes upstream GitHub repository metadata.
 * Follows FEATURE_DEVELOPMENT.md Feature 2.
 */
export function normalizeRepositoryMetadata(rawRepo, fallbackOwner, fallbackRepo) {
  if (!rawRepo || typeof rawRepo !== "object") {
    throw new AppError(
      502,
      "GITHUB_UPSTREAM_ERROR",
      "Invalid repository metadata received from GitHub."
    );
  }

  if (rawRepo.private === true) {
    throw new AppError(
      422,
      "REPOSITORY_NOT_PUBLIC_OR_ACCESSIBLE",
      "Private repositories are not supported. Please provide a public GitHub repository."
    );
  }

  const owner =
    (rawRepo.owner && rawRepo.owner.login) ||
    (rawRepo.full_name ? rawRepo.full_name.split("/")[0] : fallbackOwner);
  const name = rawRepo.name || fallbackRepo;
  const fullName = rawRepo.full_name || `${owner}/${name}`;

  return {
    githubId: typeof rawRepo.id === "number" ? rawRepo.id : null,
    owner,
    name,
    fullName,
    url: rawRepo.html_url || `https://github.com/${fullName}`,
    description: rawRepo.description || null,
    defaultBranch: rawRepo.default_branch || "main",
    stars:
      typeof rawRepo.stargazers_count === "number" && rawRepo.stargazers_count >= 0
        ? rawRepo.stargazers_count
        : 0,
    language: rawRepo.language || null
  };
}

/**
 * Decodes Base64 README payload and truncates to configured limit.
 * Follows FEATURE_DEVELOPMENT.md Feature 3.
 */
export function decodeAndTruncateReadme(readmePayload, maxChars = env.MAX_README_CHARS) {
  if (!readmePayload || typeof readmePayload.content !== "string") {
    return { available: false, content: "" };
  }

  try {
    const encoding = (readmePayload.encoding || "base64").toLowerCase();
    let decoded = "";
    if (encoding === "base64") {
      const cleaned = readmePayload.content.replace(/\s+/g, "");
      decoded = Buffer.from(cleaned, "base64").toString("utf8");
    } else {
      decoded = String(readmePayload.content);
    }

    const trimmed = decoded.trim();
    if (!trimmed) {
      return { available: false, content: "" };
    }

    const bounded =
      trimmed.length > maxChars
        ? `${trimmed.slice(0, maxChars)}\n...[truncated]`
        : trimmed;

    return {
      available: true,
      content: bounded
    };
  } catch (_err) {
    return { available: false, content: "" };
  }
}

/**
 * Normalizes upstream GitHub commits list.
 * Follows FEATURE_DEVELOPMENT.md Feature 4.
 */
export function normalizeCommits(rawCommits, limit) {
  if (!Array.isArray(rawCommits)) {
    return [];
  }

  return rawCommits.slice(0, limit).map((item) => {
    const sha = typeof item.sha === "string" ? item.sha : "";
    const rawMessage =
      item.commit && typeof item.commit.message === "string"
        ? item.commit.message
        : "";
    const message = rawMessage.trim().slice(0, 500) || "No commit message provided";
    const authorName =
      (item.commit && item.commit.author && item.commit.author.name) ||
      (item.author && item.author.login) ||
      "Unknown";
    const committedAt =
      (item.commit && item.commit.author && item.commit.author.date) ||
      (item.commit && item.commit.committer && item.commit.committer.date) ||
      null;

    return {
      sha,
      message,
      authorName,
      committedAt
    };
  });
}

/**
 * Fetches repository metadata, README, and recent commits from GitHub REST API.
 *
 * @param {{ owner: string, repo: string, commitRef?: string | null, commitLimit?: number, fetchImpl?: typeof fetch }} params
 */
export async function fetchRepositoryBundle({
  owner,
  repo,
  commitRef = null,
  commitLimit = env.DEFAULT_COMMIT_LIMIT,
  fetchImpl
}) {
  const safeLimit = Math.min(
    Math.max(1, Number(commitLimit) || env.DEFAULT_COMMIT_LIMIT),
    env.MAX_COMMIT_LIMIT
  );

  const encodedOwner = encodeURIComponent(owner);
  const encodedRepo = encodeURIComponent(repo);

  // 1. Fetch repository metadata first (validates repo existence and visibility)
  const rawRepo = await requestGitHub(`/repos/${encodedOwner}/${encodedRepo}`, {
    fetchImpl
  });
  const repository = normalizeRepositoryMetadata(rawRepo, owner, repo);

  // 2. Fetch README and commits in parallel
  const commitQuery = new URLSearchParams({ per_page: String(safeLimit) });
  if (commitRef) {
    commitQuery.set("sha", commitRef);
  }

  const [rawReadme, rawCommits] = await Promise.all([
    requestGitHub(`/repos/${encodedOwner}/${encodedRepo}/readme`, {
      fetchImpl,
      allow404: true
    }),
    requestGitHub(
      `/repos/${encodedOwner}/${encodedRepo}/commits?${commitQuery.toString()}`,
      {
        fetchImpl,
        allow404: true,
        allow409: true // Empty git repository
      }
    )
  ]);

  const readme = decodeAndTruncateReadme(rawReadme, env.MAX_README_CHARS);
  const commits = normalizeCommits(rawCommits, safeLimit);

  return {
    repository,
    readme,
    commits,
    commitLimit: safeLimit
  };
}
