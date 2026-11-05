import AppError from "../../utils/AppError.js";

// GitHub owner: 1-39 alphanumeric or single hyphens, cannot start/end with hyphen
const OWNER_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;
// GitHub repo name: alphanumeric, hyphens, underscores, dots (cannot be "." or "..")
const REPO_REGEX = /^[a-zA-Z0-9._-]{1,100}$/;
// Commit SHA: 7 to 40 hex characters
const COMMIT_SHA_REGEX = /^[0-9a-fA-F]{7,40}$/;

/**
 * Parses, validates, and normalizes a public GitHub repository URL.
 * Follows TRD.md Section 5 and FEATURE_DEVELOPMENT.md Feature 1.
 *
 * @param {string} rawUrl
 * @returns {{ owner: string, repo: string, fullName: string, canonicalUrl: string, commitRef: string | null }}
 */
export function parseRepositoryUrl(rawUrl) {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    throw new AppError(
      400,
      "INVALID_REPOSITORY_URL",
      "Enter a valid public GitHub repository URL."
    );
  }

  const trimmed = rawUrl.trim();
  if (trimmed.length > 500) {
    throw new AppError(
      400,
      "INVALID_REPOSITORY_URL",
      "Repository URL exceeds the maximum allowed length."
    );
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (_err) {
    throw new AppError(
      400,
      "INVALID_REPOSITORY_URL",
      "Enter a valid public GitHub repository URL (e.g., https://github.com/owner/repository)."
    );
  }

  // 1. Require https:
  if (parsed.protocol !== "https:") {
    throw new AppError(
      400,
      "INVALID_REPOSITORY_URL",
      "Repository URL must use HTTPS (https://github.com/owner/repository)."
    );
  }

  // 2. Require hostname exactly github.com
  if (parsed.hostname.toLowerCase() !== "github.com" || parsed.port !== "") {
    throw new AppError(
      400,
      "INVALID_REPOSITORY_URL",
      "Only public github.com repository URLs are supported."
    );
  }

  // 3. Reject URL credentials, query strings, or fragments
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new AppError(
      400,
      "INVALID_REPOSITORY_URL",
      "Repository URL must not contain credentials, query parameters, or fragments."
    );
  }

  // 4. Reject percent-encoded traversal or control characters in path
  if (/%2f|%5c|%00|\.\./i.test(parsed.pathname)) {
    throw new AppError(
      400,
      "INVALID_REPOSITORY_URL",
      "Enter a valid public GitHub repository URL."
    );
  }

  // 5. Split path segments and normalize trailing slash
  const segments = parsed.pathname.split("/").filter(Boolean);

  if (segments.length !== 2 && !(segments.length === 4 && segments[2] === "commit")) {
    throw new AppError(
      400,
      "INVALID_REPOSITORY_URL",
      "URL must point to a GitHub repository (https://github.com/owner/repository)."
    );
  }

  const owner = segments[0];
  let repo = segments[1];

  // Normalize optional .git suffix
  if (repo.toLowerCase().endsWith(".git")) {
    repo = repo.slice(0, -4);
  }

  if (
    !owner ||
    !repo ||
    repo === "." ||
    repo === ".." ||
    !OWNER_REGEX.test(owner) ||
    !REPO_REGEX.test(repo)
  ) {
    throw new AppError(
      400,
      "INVALID_REPOSITORY_URL",
      "Invalid GitHub repository owner or repository name."
    );
  }

  let commitRef = null;
  if (segments.length === 4 && segments[2] === "commit") {
    commitRef = segments[3];
    if (!COMMIT_SHA_REGEX.test(commitRef)) {
      throw new AppError(
        400,
        "INVALID_REPOSITORY_URL",
        "Invalid commit SHA in GitHub commit URL."
      );
    }
  }

  const fullName = `${owner}/${repo}`;
  const canonicalUrl = `https://github.com/${owner}/${repo}`;

  return {
    owner,
    repo,
    fullName,
    canonicalUrl,
    commitRef
  };
}
