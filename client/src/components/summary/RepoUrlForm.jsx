import React, { useState } from "react";
import Icon from "../common/Icon";
import GenerateButton from "./GenerateButton";
import { validateGitHubUrl } from "../../utils/urlValidator";

const SAMPLE_REPOS = [
  { label: "facebook/react", url: "https://github.com/facebook/react" },
  { label: "expressjs/express", url: "https://github.com/expressjs/express" },
  { label: "vitejs/vite", url: "https://github.com/vitejs/vite" },
];

export function RepoUrlForm({ onSubmit, loading = false, initialUrl = "" }) {
  const [url, setUrl] = useState(initialUrl);
  const [commitLimit, setCommitLimit] = useState(20);
  const [commitRef, setCommitRef] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [validationError, setValidationError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError("");

    const validation = validateGitHubUrl(url);
    if (!validation.isValid) {
      setValidationError(validation.error);
      return;
    }

    try {
      await onSubmit({
        repositoryUrl: validation.normalizedUrl,
        commitRef: commitRef.trim() || validation.commitRef || null,
        commitLimit: Number(commitLimit) || 20,
      });

      // Clear all form input data upon successful generation
      setUrl("");
      setCommitRef("");
      setCommitLimit(20);
      setShowAdvanced(false);
      setValidationError("");
    } catch {
      // Keep inputs if generation failed so user can review and retry
    }
  };

  const handleSampleClick = (sampleUrl) => {
    setUrl(sampleUrl);
    setValidationError("");
  };

  return (
    <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-[#122e23] via-[#1a4334] to-[#122e23] p-6 text-white shadow-xl sm:p-8 lg:p-10">
      <div className="relative z-10 max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Public Repository Analyzer
        </div>

        <h2 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Understand any GitHub repository in minutes.
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-emerald-100/80 sm:text-sm">
          Paste a public GitHub link or owner/repo. GitSummarizer extracts metadata, README documentation, and recent commits into a clear, structured developer brief.
        </p>

        <form onSubmit={handleSubmit} className="mt-6">
          <div className="flex flex-col gap-2 rounded-2xl bg-white p-2 shadow-2xl sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-1">
              <Icon name="github" size={20} className="shrink-0 text-slate-500" />
              <input
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (validationError) setValidationError("");
                }}
                placeholder="https://github.com/owner/repository or owner/repo"
                aria-label="GitHub repository URL"
                className="h-10 w-full min-w-0 bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden sm:text-sm font-medium"
                disabled={loading}
              />
              {url && (
                <button
                  type="button"
                  onClick={() => {
                    setUrl("");
                    setValidationError("");
                  }}
                  aria-label="Clear input"
                  className="rounded-full p-1 text-slate-400 hover:text-slate-600"
                >
                  <Icon name="close" size={14} />
                </button>
              )}
            </div>

            <GenerateButton loading={loading} disabled={!url.trim()} />
          </div>

          {/* Validation Feedback */}
          {validationError && (
            <p role="alert" className="mt-2 text-xs font-medium text-rose-300">
              {validationError}
            </p>
          )}

          {/* Advanced Options Toggle */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-100/70">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="inline-flex items-center gap-1.5 text-xs text-emerald-200 hover:text-white transition"
            >
              <Icon name={showAdvanced ? "chevronUp" : "chevronDown"} size={14} />
              <span>{showAdvanced ? "Hide options" : "Commit options (optional)"}</span>
            </button>

            {/* Sample Repos */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-emerald-200/60 hidden sm:inline">Try an example:</span>
              <div className="flex flex-wrap gap-1.5">
                {SAMPLE_REPOS.map((sample) => (
                  <button
                    key={sample.label}
                    type="button"
                    onClick={() => handleSampleClick(sample.url)}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium text-emerald-100 hover:bg-white/15 hover:text-white transition"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Collapsible Advanced Form Controls */}
          {showAdvanced && (
            <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:grid-cols-2">
              <div>
                <label htmlFor="commit-limit-input" className="block text-[11px] font-semibold text-emerald-200">
                  Recent commits to analyze (1 - 50)
                </label>
                <input
                  id="commit-limit-input"
                  type="number"
                  min="1"
                  max="50"
                  value={commitLimit}
                  onChange={(e) => setCommitLimit(Math.max(1, Math.min(50, Number(e.target.value) || 20)))}
                  className="mt-1 h-9 w-full rounded-xl border border-white/15 bg-white/10 px-3 text-xs text-white focus:outline-hidden focus:ring-1 focus:ring-emerald-400"
                />
              </div>

              <div>
                <label htmlFor="commit-ref-input" className="block text-[11px] font-semibold text-emerald-200">
                  Specific commit SHA or branch ref (optional)
                </label>
                <input
                  id="commit-ref-input"
                  type="text"
                  placeholder="e.g. main, v1.0.0, or 7-40 hex SHA"
                  value={commitRef}
                  onChange={(e) => setCommitRef(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-white/15 bg-white/10 px-3 text-xs text-white placeholder:text-emerald-100/40 focus:outline-hidden focus:ring-1 focus:ring-emerald-400"
                />
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Decorative backdrop rings */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-24 h-96 w-96 rounded-full border border-emerald-400/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-4 -top-12 h-72 w-72 rounded-full border border-emerald-400/10"
      />
    </section>
  );
}

export default RepoUrlForm;
