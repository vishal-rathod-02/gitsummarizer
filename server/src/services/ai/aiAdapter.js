import env from "../../config/env.js";
import AppError from "../../utils/AppError.js";
import { buildSummaryPrompts } from "./promptBuilder.js";
import { validateSummaryOutput } from "./outputValidator.js";

/**
 * Extracts bullet points under a matching Markdown section heading if present.
 * Used by the local fallback analyzer when no OpenAI API key is configured.
 */
function extractMarkdownBullets(markdown, sectionKeywords, maxItems = 5) {
  if (!markdown || typeof markdown !== "string") {
    return [];
  }

  const lines = markdown.split(/\r?\n/);
  const items = [];
  let inMatchingSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const headingMatch = line.match(/^#{1,4}\s+(.+)$/);

    if (headingMatch) {
      const headingText = headingMatch[1].toLowerCase();
      inMatchingSection = sectionKeywords.some((kw) => headingText.includes(kw));
      continue;
    }

    if (inMatchingSection) {
      const bulletMatch = line.match(/^[-*+]\s+(.+)$/);
      if (bulletMatch) {
        const cleaned = bulletMatch[1]
          .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
          .replace(/[`*_~]/g, "")
          .trim();
        if (cleaned && cleaned.length > 2) {
          items.push(cleaned);
          if (items.length >= maxItems) {
            break;
          }
        }
      }
    }
  }

  return items;
}

/**
 * Builds a deterministic, grounded summary from actual fetched GitHub repository
 * metadata, README content, and commits when OPENAI_API_KEY is not configured.
 * Allows frontend and backend collaborators to test end-to-end without blocking on paid keys.
 */
export function buildHeuristicFallbackSummary({ repository, readme, commits }) {
  const descriptionPart = repository.description
    ? `${repository.fullName} is a ${repository.language ? `${repository.language} ` : ""}repository described as: "${repository.description}".`
    : `${repository.fullName} is a public ${repository.language || "software"} repository hosted on GitHub.`;

  let readmeIntro = "";
  if (readme && readme.available && readme.content) {
    const paragraphs = readme.content
      .split(/\r?\n\r?\n/)
      .map((p) => p.replace(/^#+\s+.*/gm, "").trim())
      .filter((p) => p.length > 30 && !p.startsWith("```") && !p.startsWith("!["));
    if (paragraphs.length > 0) {
      readmeIntro = ` ${paragraphs[0].replace(/\r?\n/g, " ").slice(0, 320)}`;
    }
  } else {
    readmeIntro =
      " Note: No README file was found in this repository, so this summary is derived from repository metadata and recent commit activity.";
  }

  const overview = `${descriptionPart}${readmeIntro}`.trim();

  // Extract features from README or derive from metadata
  let features = extractMarkdownBullets(readme?.content, [
    "feature",
    "overview",
    "capability",
    "what",
    "highlight",
    "about"
  ]);

  if (features.length === 0) {
    features = [
      repository.description
        ? `Core focus: ${repository.description}`
        : `Public repository maintained under ${repository.fullName}`,
      repository.language
        ? `Primarily implemented in ${repository.language}`
        : "Language stack not explicitly specified in metadata",
      readme && readme.available
        ? "Includes project README documentation"
        : "README documentation is not present in the default branch"
    ];
  }

  // Extract prerequisites from README or derive sensible defaults based on language
  let prerequisites = extractMarkdownBullets(readme?.content, [
    "prerequisite",
    "requirement",
    "install",
    "getting started",
    "setup"
  ]);

  if (prerequisites.length === 0) {
    const lang = (repository.language || "").toLowerCase();
    if (lang === "javascript" || lang === "typescript") {
      prerequisites = [
        "Node.js LTS and npm (inferred from JavaScript/TypeScript project metadata)",
        "Git for cloning the repository"
      ];
    } else if (lang === "python") {
      prerequisites = [
        "Python 3.x and pip (inferred from Python project metadata)",
        "Git for cloning the repository"
      ];
    } else {
      prerequisites = [
        "Git for cloning and inspecting the repository",
        readme && readme.available
          ? "See repository README for specific environment setup details"
          : "No explicit prerequisites specified (README is absent)"
      ];
    }
  }

  // Build commit digest from actual commits
  let commitDigest = "No recent commits were found in this repository.";
  if (Array.isArray(commits) && commits.length > 0) {
    const sample = commits.slice(0, 5).map((c) => {
      const firstLine = (c.message || "").split(/\r?\n/)[0].trim();
      const shortSha = (c.sha || "").slice(0, 7);
      return `${firstLine} (${shortSha} by ${c.authorName || "contributor"})`;
    });
    commitDigest = `Recent activity across ${commits.length} commit(s) includes: ${sample.join("; ")}.`;
  }

  return validateSummaryOutput({
    overview,
    features,
    prerequisites,
    commitDigest
  });
}

/**
 * Generates a structured repository summary using OpenAI API, or falls back to
 * heuristic summarization when OPENAI_API_KEY is not configured in development.
 *
 * @param {{ repository: object, readme: { available: boolean, content: string }, commits: Array<object>, commitRef?: string | null, fetchImpl?: typeof fetch }} params
 * @returns {Promise<{ summary: { overview: string, features: string[], prerequisites: string[], commitDigest: string }, provider: string, model: string }>}
 */
export async function generateRepositorySummary({
  repository,
  readme,
  commits,
  commitRef = null,
  fetchImpl
}) {
  const provider = (process.env.AI_PROVIDER || env.AI_PROVIDER || "openai").toLowerCase();
  const apiKey = (process.env.OPENAI_API_KEY || env.OPENAI_API_KEY || "").trim();
  const model = process.env.OPENAI_MODEL || env.OPENAI_MODEL || "gpt-4o-mini";
  const strictMode =
    process.env.AI_STRICT_MODE === "true" || env.AI_STRICT_MODE === true;

  // Use heuristic fallback when provider is "mock" or when no API key is configured in non-strict mode
  if (provider === "mock" || (!apiKey && !strictMode)) {
    const fallbackSummary = buildHeuristicFallbackSummary({
      repository,
      readme,
      commits
    });
    return {
      summary: fallbackSummary,
      provider: provider === "mock" ? "mock" : "openai-fallback",
      model: "heuristic-v1"
    };
  }

  if (!apiKey) {
    throw new AppError(
      503,
      "SERVICE_UNAVAILABLE",
      "AI provider API key is not configured on the server."
    );
  }

  const { systemPrompt, userPrompt } = buildSummaryPrompts({
    repository,
    readme,
    commits,
    commitRef
  });

  const fetchFn = fetchImpl || global.fetch;
  const baseUrl = (process.env.OPENAI_BASE_URL || env.OPENAI_BASE_URL).replace(
    /\/+$/,
    ""
  );
  const timeoutMs = env.AI_TIMEOUT_MS || 25000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetchFn(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      }),
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err && err.name === "AbortError") {
      throw new AppError(
        502,
        "AI_PROVIDER_ERROR",
        "AI summary generation timed out. Please try again."
      );
    }
    throw new AppError(
      502,
      "AI_PROVIDER_ERROR",
      "Unable to reach AI provider service."
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 429) {
    throw new AppError(
      429,
      "RATE_LIMITED",
      "AI provider rate limit reached. Please wait a moment and retry."
    );
  }

  if (!response.ok) {
    throw new AppError(
      502,
      "AI_PROVIDER_ERROR",
      `AI provider returned an error (status ${response.status}).`
    );
  }

  let payload;
  try {
    payload = await response.json();
  } catch (_err) {
    throw new AppError(
      502,
      "AI_PROVIDER_ERROR",
      "Received invalid JSON response from AI provider."
    );
  }

  const content =
    payload &&
    Array.isArray(payload.choices) &&
    payload.choices[0] &&
    payload.choices[0].message &&
    payload.choices[0].message.content;

  if (!content) {
    throw new AppError(
      502,
      "AI_PROVIDER_ERROR",
      "AI provider returned an empty summary completion."
    );
  }

  const validatedSummary = validateSummaryOutput(content);

  return {
    summary: validatedSummary,
    provider: "openai",
    model: payload.model || model
  };
}
