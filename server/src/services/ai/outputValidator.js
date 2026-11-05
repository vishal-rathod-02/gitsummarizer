import AppError from "../../utils/AppError.js";

/**
 * Validates and normalizes the structured output returned by the AI provider.
 * Ensures schema compliance before saving or returning to the client.
 *
 * @param {unknown} rawOutput - Parsed object or JSON string from LLM
 * @returns {{ overview: string, features: string[], prerequisites: string[], commitDigest: string }}
 */
export function validateSummaryOutput(rawOutput) {
  let parsed = rawOutput;

  if (typeof rawOutput === "string") {
    const cleaned = rawOutput
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "");
    try {
      parsed = JSON.parse(cleaned);
    } catch (_err) {
      throw new AppError(
        502,
        "AI_PROVIDER_ERROR",
        "AI provider returned malformed JSON output."
      );
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AppError(
      502,
      "AI_PROVIDER_ERROR",
      "AI provider returned an invalid summary structure."
    );
  }

  const overview =
    typeof parsed.overview === "string" ? parsed.overview.trim() : "";
  const commitDigest =
    typeof parsed.commitDigest === "string" ? parsed.commitDigest.trim() : "";

  if (!overview) {
    throw new AppError(
      502,
      "AI_PROVIDER_ERROR",
      "AI summary output is missing a valid overview."
    );
  }

  if (!commitDigest) {
    throw new AppError(
      502,
      "AI_PROVIDER_ERROR",
      "AI summary output is missing a valid commitDigest."
    );
  }

  if (!Array.isArray(parsed.features) || !Array.isArray(parsed.prerequisites)) {
    throw new AppError(
      502,
      "AI_PROVIDER_ERROR",
      "AI summary output must include features and prerequisites arrays."
    );
  }

  const features = parsed.features
    .filter((item) => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim().slice(0, 300))
    .slice(0, 15);

  const prerequisites = parsed.prerequisites
    .filter((item) => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim().slice(0, 300))
    .slice(0, 15);

  return {
    overview: overview.slice(0, 3000),
    features:
      features.length > 0
        ? features
        : ["Repository features are not explicitly listed in the available source."],
    prerequisites:
      prerequisites.length > 0
        ? prerequisites
        : ["Prerequisites are not explicitly specified in the repository documentation."],
    commitDigest: commitDigest.slice(0, 4000)
  };
}
