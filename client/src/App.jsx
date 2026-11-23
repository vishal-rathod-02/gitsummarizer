import React, { useEffect, useState } from "react";
import Header from "./components/layout/Header";
import Sidebar from "./components/layout/Sidebar";
import Footer from "./components/layout/Footer";
import AuthNavbar from "./components/auth/AuthNavbar";
import AuthPage from "./components/auth/AuthPage";
import RepoUrlForm from "./components/summary/RepoUrlForm";
import RepositoryHeader from "./components/summary/RepositoryHeader";
import SummarySection from "./components/summary/SummarySection";
import HistoryList from "./components/history/HistoryList";
import LoadingState from "./components/common/LoadingState";
import ErrorBanner from "./components/common/ErrorBanner";
import Toast from "./components/common/Toast";
import Icon from "./components/common/Icon";
import { useAuth } from "./context/AuthContext";
import { useSummaries } from "./hooks/useSummaries";
import { useClipboard } from "./hooks/useClipboard";
import { checkApiHealth } from "./api/summaries";

export default function App() {
  const { user, isAuthenticated, loading: authLoading, continueAsGuest } = useAuth();

  const [activeView, setActiveView] = useState("generate"); // "generate" | "history" | "saved"
  const [authMode, setAuthMode] = useState("login"); // "login" | "register"
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [apiHealthy, setApiHealthy] = useState(true);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");

  const {
    currentSummary,
    setCurrentSummary,
    loading,
    error,
    setError,
    generate,
    loadDetail,
    remove,
    historyItems,
    pagination,
    historyLoading,
    loadHistory,
    savedItems,
    toggleSave,
    isSaved,
  } = useSummaries(user);

  const { copy: copyAll, hasCopied: hasCopiedAll } = useClipboard();

  // Check backend API health on mount
  useEffect(() => {
    async function verifyHealth() {
      try {
        await checkApiHealth();
        setApiHealthy(true);
      } catch {
        setApiHealthy(false);
      }
    }
    verifyHealth();
  }, []);

  // When active user changes (or signs in), load initial history strictly for this account
  useEffect(() => {
    if (user?.id) {
      loadHistory(1, 10);
    }
  }, [user?.id, loadHistory]);

  const showToast = (message, type = "success") => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => setToastMessage(""), 3500);
  };

  const handleGuestDemo = async () => {
    await continueAsGuest();
    showToast("Welcome! Exploring workspace in Guest Mode.");
  };

  const handleGenerate = async (params) => {
    try {
      await generate(params);
      showToast("Repository summary generated successfully!");
    } catch (err) {
      // Re-throw so RepoUrlForm knows generation failed and preserves input for review
      throw err;
    }
  };

  const handleSelectHistoryItem = async (summaryId) => {
    try {
      await loadDetail(summaryId);
      setActiveView("generate");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      showToast("Failed to load summary details.", "error");
    }
  };

  const handleDeleteHistoryItem = async (summaryId) => {
    await remove(summaryId);
    showToast("Summary removed.");
  };

  const handleToggleSave = () => {
    if (!currentSummary) return;
    const currentlySaved = isSaved(currentSummary.id);
    toggleSave(currentSummary);
    showToast(currentlySaved ? "Removed from saved library." : "Saved to your library!");
  };

  const handleCopyFullBrief = () => {
    if (!currentSummary) return;
    const { repository, summary } = currentSummary;
    const text = [
      `# ${repository.fullName} Summary`,
      `Repository: ${repository.url}`,
      "",
      "## Overview",
      summary.overview,
      "",
      "## Key Features",
      ...(summary.features || []).map((f) => `- ${f}`),
      "",
      "## Prerequisites",
      ...(summary.prerequisites || []).map((p) => `- ${p}`),
      "",
      "## Recent Changes Digest",
      summary.commitDigest,
    ].join("\n");

    copyAll(text);
    showToast("Full summary copied to clipboard!");
  };

  // 1. Splash Screen while checking stored JWT
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f7f5]">
        <div className="flex flex-col items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-700 text-white shadow-md animate-pulse">
            <Icon name="code" size={24} />
          </span>
          <p className="text-xs font-semibold text-slate-500">Initializing GitSummarizer...</p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated State: Auth Page with dedicated AuthNavbar
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col bg-[#f5f7f5] text-slate-800 antialiased selection:bg-emerald-200 selection:text-emerald-900">
        <AuthNavbar
          mode={authMode}
          onToggleMode={() => setAuthMode((m) => (m === "login" ? "register" : "login"))}
          apiHealthy={apiHealthy}
          onGuestDemo={handleGuestDemo}
        />

        <AuthPage
          mode={authMode}
          onToggleMode={() => setAuthMode((m) => (m === "login" ? "register" : "login"))}
          onGuestDemo={handleGuestDemo}
        />

        <Footer />

        {toastMessage && (
          <Toast
            message={toastMessage}
            type={toastType}
            onClose={() => setToastMessage("")}
          />
        )}
      </div>
    );
  }

  // 3. Authenticated State: Full-featured responsive Main Layout
  return (
    <div className="flex min-h-screen flex-col bg-[#f5f7f5] text-slate-800 antialiased selection:bg-emerald-200 selection:text-emerald-900">
      {/* Top Navigation Bar with user profile & status */}
      <Header
        activeView={activeView}
        onNavigate={setActiveView}
        apiHealthy={apiHealthy}
        onToggleMobileMenu={() => setMobileMenuOpen(true)}
      />

      {/* Mobile Drawer Navigation */}
      <Sidebar
        activeView={activeView}
        onNavigate={setActiveView}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      {/* Main Workspace Area (adapts to mobile, tablet, and desktop) */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {activeView === "generate" && (
          <div className="space-y-6 sm:space-y-8 animate-fade-in">
            {/* Input Form with fresh account-scoped key */}
            <RepoUrlForm
              key={`repo-url-form-${user?.id || "guest"}`}
              onSubmit={handleGenerate}
              loading={loading}
            />

            {/* Error Message */}
            {error && (
              <ErrorBanner
                error={error}
                onDismiss={() => setError(null)}
                onRetry={() => {
                  if (currentSummary?.repository?.url) {
                    handleGenerate({ repositoryUrl: currentSummary.repository.url });
                  }
                }}
              />
            )}

            {/* Loading Indicator */}
            {loading && <LoadingState message="Analyzing GitHub codebase..." />}

            {/* Summary Result Screen */}
            {!loading && currentSummary && (
              <section className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xs">
                <RepositoryHeader
                  repository={currentSummary.repository}
                  isSaved={isSaved(currentSummary.id)}
                  onToggleSave={handleToggleSave}
                  onCopyAll={handleCopyFullBrief}
                  hasCopiedAll={hasCopiedAll}
                  source={currentSummary.source}
                />
                <SummarySection
                  data={currentSummary}
                  onRerun={() =>
                    handleGenerate({
                      repositoryUrl: currentSummary.repository.url,
                      commitLimit: currentSummary.source?.commitLimit || 20,
                    })
                  }
                />
              </section>
            )}

            {/* Explainer cards when idle */}
            {!loading && !currentSummary && (
              <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                    <Icon name="book" size={17} />
                  </div>
                  <h3 className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-800">
                    Plain-English Overview
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                    Understand what an unfamiliar repository does, why it exists, and its core architecture at a glance.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                    <Icon name="spark" size={17} />
                  </div>
                  <h3 className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-800">
                    Feature Extraction
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                    Key capabilities and technical strengths surfaced automatically from repository documentation.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                    <Icon name="check" size={17} />
                  </div>
                  <h3 className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-800">
                    Prerequisites & Setup
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                    Required runtimes, package managers, and setup commands detected before you clone.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                    <Icon name="commit" size={17} />
                  </div>
                  <h3 className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-800">
                    Recent Changes Digest
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                    Translates recent commit messages into readable, release-note style bullet points for stakeholders.
                  </p>
                </div>
              </div>
            )}

            {/* Quick history preview when idle */}
            {!loading && !currentSummary && historyItems.length > 0 && (
              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xs sm:p-8">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Recently Analyzed Repositories</h3>
                    <p className="text-xs text-slate-500">Pick up right where you or your teammates left off</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveView("history")}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                  >
                    <span>View all ({historyItems.length})</span>
                    <Icon name="arrow" size={12} />
                  </button>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {historyItems.slice(0, 4).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectHistoryItem(item.id)}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 text-left hover:border-emerald-200 hover:bg-emerald-50/30 transition group"
                    >
                      <div className="min-w-0 pr-3">
                        <span className="block text-xs font-bold text-slate-800 group-hover:text-emerald-700 truncate">
                          {item.repository?.fullName || item.repository?.name || "Repository"}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-slate-500 truncate">
                          {item.overviewPreview || item.repository?.description || "Open brief"}
                        </span>
                      </div>
                      <Icon name="arrow" size={14} className="text-slate-400 group-hover:text-emerald-700 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* History View */}
        {activeView === "history" && (
          <div className="animate-fade-in">
            <HistoryList
              items={historyItems}
              pagination={pagination}
              onPageChange={(page) => loadHistory(page, pagination.limit)}
              onSelect={handleSelectHistoryItem}
              onDelete={handleDeleteHistoryItem}
              onNewSummary={() => setActiveView("generate")}
              loading={historyLoading}
            />
          </div>
        )}

        {/* Saved Library View */}
        {activeView === "saved" && (
          <div className="animate-fade-in">
            <HistoryList
              items={savedItems}
              pagination={{ page: 1, limit: savedItems.length || 1, total: savedItems.length, totalPages: 1 }}
              onPageChange={() => {}}
              onSelect={handleSelectHistoryItem}
              onDelete={handleDeleteHistoryItem}
              onNewSummary={() => setActiveView("generate")}
              loading={false}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <Footer />

      {/* Notification Toast */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setToastMessage("")}
        />
      )}
    </div>
  );
}
