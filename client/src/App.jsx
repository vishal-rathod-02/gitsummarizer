import { useEffect, useMemo, useState } from "react";

const sampleSummary = {
  id: "sample-vite",
  repository: "vitejs/vite",
  url: "https://github.com/vitejs/vite",
  title: "Vite",
  description:
    "Vite is a modern frontend build tool that gives developers a fast server during development and bundles production code with Rollup.",
  highlights: [
    "Starts a development server with near-instant startup and fast hot module replacement.",
    "Uses native ES modules in development, so only the code you edit needs to be reloaded.",
    "Builds optimized production assets and supports a broad plugin ecosystem.",
  ],
  prerequisites: ["Node.js 20.19+ or 22.12+", "A package manager such as npm, pnpm, or yarn"],
  releaseNotes: [
    "Development updates keep the feedback loop fast with improved dependency handling.",
    "The plugin API makes it possible to extend builds for different frameworks and workflows.",
  ],
  techStack: ["TypeScript", "Rollup", "esbuild"],
  files: ["packages/vite/", "docs/", "playground/"],
  updatedAt: new Date().toISOString(),
  sample: true,
};

const navigation = [
  { id: "overview", label: "Overview", icon: "grid" },
  { id: "history", label: "History", icon: "clock" },
  { id: "saved", label: "Saved summaries", icon: "bookmark" },
];

const iconPaths = {
  grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.2 2" /></>,
  bookmark: <path d="M6.5 4.5h11a1 1 0 0 1 1 1v15l-6.5-4-6.5 4v-15a1 1 0 0 1 1-1Z" />,
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
  arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  external: <><path d="M14 4h6v6" /><path d="m20 4-9 9" /><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></>,
  file: <><path d="M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10Z" /><path d="M13 3v7h7M8 14h8M8 17h6" /></>,
  spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  close: <><path d="m18 6-12 12M6 6l12 12" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5z" /><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20M8 7h7" /></>,
  code: <><path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" /></>,
  github: <><path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 6v-3.9a3.4 3.4 0 0 0-1-2.7c3.3-.4 6.8-1.6 6.8-7.3A5.7 5.7 0 0 0 19.3 4a5.3 5.3 0 0 0-.1-4S18 0 15 2.1a13.4 13.4 0 0 0-7 0C5 0 3.8 0 3.8 0a5.3 5.3 0 0 0-.1 4A5.7 5.7 0 0 0 2.2 8c0 5.7 3.5 6.9 6.8 7.3a3.4 3.4 0 0 0-1 2.7V22" transform="translate(2 1) scale(.9)" /></>,
};

function Icon({ name, size = 18, className = "" }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPaths[name]}
    </svg>
  );
}

function readStored(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeSummary(payload, target) {
  const result = payload?.summary ?? payload?.data ?? payload;
  return {
    id: crypto.randomUUID(),
    repository: result.repository ?? target.repository,
    url: result.url ?? target.url,
    title: result.title ?? target.repository.split("/").pop() ?? "Repository summary",
    description: result.description ?? result.overview ?? "",
    highlights: result.highlights ?? result.keyFeatures ?? [],
    prerequisites: result.prerequisites ?? [],
    releaseNotes: result.releaseNotes ?? result.release_notes ?? [],
    techStack: result.techStack ?? result.tech_stack ?? [],
    files: result.files ?? result.keyFiles ?? [],
    updatedAt: new Date().toISOString(),
    sample: false,
  };
}

function parseTarget(value) {
  const input = value.trim();
  if (!input) return null;

  const commitMatch = input.match(
    /^(?:https?:\/\/github\.com\/([^/]+)\/([^/]+)\/commit\/([a-f0-9]{7,40})|([a-f0-9]{7,40}))$/i,
  );
  if (commitMatch) {
    const owner = commitMatch[1];
    const repo = commitMatch[2]?.replace(/\.git$/, "");
    const sha = commitMatch[3] ?? commitMatch[4];
    return {
      kind: "commit",
      repository: owner && repo ? `${owner}/${repo}` : "Commit",
      url: owner && repo ? `https://github.com/${owner}/${repo}/commit/${sha}` : "",
      commit: sha,
    };
  }

  const normalized = input.replace(/\/+$/, "").replace(/\.git$/, "");
  const repoMatch = normalized.match(
    /^(?:https?:\/\/github\.com\/)?([^/\s]+)\/([^/\s]+)$/i,
  );
  if (!repoMatch) return null;
  return {
    kind: "repository",
    repository: `${repoMatch[1]}/${repoMatch[2]}`,
    url: `https://github.com/${repoMatch[1]}/${repoMatch[2]}`,
  };
}

function formatDate(date) {
  if (!date) return "Just now";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

function Sidebar({ activeView, onNavigate, mobileOpen, closeMobile }) {
  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={closeMobile}
          className="fixed inset-0 z-30 bg-[#10231c]/35 lg:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col border-r border-[#e8ede8] bg-[#fbfcfb] px-5 py-6 transition-transform lg:static lg:z-auto lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-1">
          <button type="button" onClick={() => onNavigate("overview")} className="flex items-center gap-3 text-left">
            <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#dff5e7] text-[#236a4d]">
              <Icon name="code" size={21} />
            </span>
            <span>
              <span className="block text-[15px] font-bold tracking-[-0.04em] text-[#1d3028]">GitSummarizer</span>
              <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#91a199]">Developer workspace</span>
            </span>
          </button>
          <button type="button" aria-label="Close navigation" onClick={closeMobile} className="rounded-lg p-2 text-[#73827a] hover:bg-[#eff3ef] lg:hidden">
            <Icon name="close" />
          </button>
        </div>

        <div className="mt-12 px-2 text-[10px] font-bold uppercase tracking-[0.17em] text-[#9aa79f]">Workspace</div>
        <nav className="mt-3 space-y-1">
          {navigation.map((item) => {
            const active = activeView === item.id;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  closeMobile();
                }}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-semibold transition ${
                  active
                    ? "bg-[#eaf5ee] text-[#256649]"
                    : "text-[#75827b] hover:bg-[#f1f5f1] hover:text-[#31463b]"
                }`}
              >
                <Icon name={item.icon} size={17} />
                <span className="flex-1">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto rounded-2xl border border-[#e8eee8] bg-white p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f0f7f2] text-[#357453]">
            <Icon name="spark" size={18} />
          </div>
          <p className="mt-3 text-[13px] font-semibold text-[#263b30]">Understand more, faster.</p>
          <p className="mt-1 text-[11px] leading-5 text-[#839087]">Turn a repository or commit into a clear starting point.</p>
          <button
            type="button"
            onClick={() => {
              onNavigate("overview");
              closeMobile();
            }}
            className="mt-3 inline-flex items-center gap-2 text-[11px] font-bold text-[#26714f] hover:text-[#174c35]"
          >
            Start a new summary <Icon name="arrow" size={14} />
          </button>
        </div>
        <div className="mt-5 flex items-center gap-3 border-t border-[#edf0ed] px-1 pt-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e8eee9] text-[12px] font-bold text-[#52655a]">GS</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-[#34473c]">Your workspace</p>
            <p className="mt-0.5 text-[10px] text-[#95a098]">Frontend preview</p>
          </div>
          <span className="h-2 w-2 rounded-full bg-[#5bb681]" />
        </div>
      </aside>
    </>
  );
}

function TopBar({ activeView, openMobile }) {
  const title = navigation.find((item) => item.id === activeView)?.label ?? "Overview";
  return (
    <header className="flex h-[72px] items-center justify-between border-b border-[#e9ede9] bg-[#f8faf8]/90 px-5 sm:px-8 lg:px-10">
      <div className="flex items-center gap-3">
        <button type="button" onClick={openMobile} aria-label="Open navigation" className="rounded-lg p-2 text-[#52645a] hover:bg-white lg:hidden">
          <Icon name="menu" />
        </button>
        <div className="hidden text-[12px] text-[#97a39b] sm:block">Workspace <span className="mx-2 text-[#c5cec7]">/</span></div>
        <h1 className="text-[13px] font-semibold text-[#34473c]">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-2 rounded-full border border-[#e2eae3] bg-white px-3 py-1.5 text-[10px] font-semibold text-[#68796e] sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-[#dc9c53]" /> Frontend preview
        </span>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#dcece1] text-[10px] font-bold text-[#326547]">GS</div>
      </div>
    </header>
  );
}

function SummaryCard({ summary, saved, onToggleSaved, activeTab, onTabChange }) {
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "highlights", label: "Key highlights" },
    { id: "releaseNotes", label: "Release notes" },
  ];
  const lines = activeTab === "highlights" ? summary.highlights : activeTab === "releaseNotes" ? summary.releaseNotes : [];
  return (
    <section className="soft-shadow overflow-hidden rounded-[20px] border border-[#e9eee9] bg-white">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#edf1ed] px-5 py-5 sm:px-7">
        <div className="flex min-w-0 items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#f0f4f1] text-[#344d3e]">
            <Icon name="github" size={21} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[16px] font-bold tracking-[-0.03em] text-[#25382d]">{summary.title}</h2>
              {summary.sample && <span className="rounded-full bg-[#fff4df] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.09em] text-[#9a6b27]">Sample</span>}
            </div>
            <a href={summary.url || "#"} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] text-[#7d8c82] hover:text-[#286c4d]">
              {summary.repository} {summary.url && <Icon name="external" size={12} />}
            </a>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onToggleSaved} className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-[11px] font-semibold transition ${saved ? "border-[#c5e8d0] bg-[#eff9f2] text-[#286b4a]" : "border-[#e7ece7] text-[#67766d] hover:bg-[#f8faf8]"}`}>
            <Icon name="bookmark" size={15} /> {saved ? "Saved" : "Save"}
          </button>
          {summary.url && <a href={summary.url} target="_blank" rel="noreferrer" aria-label="Open repository on GitHub" className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#e7ece7] text-[#67766d] hover:bg-[#f8faf8]"><Icon name="external" size={15} /></a>}
        </div>
      </div>
      <div className="scrollbar-hidden flex gap-6 overflow-x-auto border-b border-[#edf1ed] px-5 sm:px-7">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`relative shrink-0 py-3.5 text-[11px] font-semibold transition ${activeTab === tab.id ? "text-[#2b704e]" : "text-[#8b978f] hover:text-[#53675b]"}`}
          >
            {tab.label}
            {activeTab === tab.id && <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-[#43a66d]" />}
          </button>
        ))}
      </div>
      <div className="px-5 py-6 sm:px-7 sm:py-7">
        {activeTab === "overview" ? (
          <>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.13em] text-[#93a097]"><Icon name="book" size={14} /> Plain-English overview</div>
            <p className="mt-3 max-w-3xl text-[13px] leading-7 text-[#596a60]">{summary.description || "No overview was returned. Check the backend response mapping and try again."}</p>
            <div className="mt-6 grid gap-5 border-t border-[#edf1ed] pt-5 sm:grid-cols-2">
              <div>
                <p className="mb-3 text-[11px] font-bold text-[#354a3c]">Prerequisites</p>
                {summary.prerequisites?.length ? (
                  <ul className="space-y-2.5">
                    {summary.prerequisites.map((item, index) => <li key={`${item}-${index}`} className="flex items-start gap-2.5 text-[11px] leading-5 text-[#738077]"><span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#edf6ef] text-[#4c9869]"><Icon name="check" size={11} /></span>{item}</li>)}
                  </ul>
                ) : <p className="text-[11px] text-[#97a198]">No prerequisites provided.</p>}
              </div>
              <div>
                <p className="mb-3 text-[11px] font-bold text-[#354a3c]">Technology</p>
                <div className="flex flex-wrap gap-2">
                  {(summary.techStack?.length ? summary.techStack : ["Not specified"]).map((item) => <span key={item} className="rounded-lg border border-[#e9eee9] bg-[#fafcfa] px-2.5 py-1.5 text-[10px] font-medium text-[#748178]">{item}</span>)}
                </div>
              </div>
            </div>
          </>
        ) : lines?.length ? (
          <ul className="space-y-4">
            {lines.map((item, index) => <li key={`${item}-${index}`} className="flex gap-3 text-[12px] leading-6 text-[#5b6b61]"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#54a976]" />{item}</li>)}
          </ul>
        ) : <p className="text-[12px] text-[#839087]">No {activeTab === "highlights" ? "highlights" : "release notes"} were included in this response.</p>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf1ed] bg-[#fcfdfc] px-5 py-3.5 sm:px-7">
        <span className="text-[10px] text-[#99a49c]">Updated {formatDate(summary.updatedAt)}</span>
        {summary.sample && <span className="text-[10px] font-medium text-[#9a7a43]">Example content · live repository data is not connected</span>}
      </div>
    </section>
  );
}

function StatCard({ label, value, caption, icon }) {
  return (
    <div className="rounded-2xl border border-[#e8eee8] bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-[#8a978e]">{label}</span>
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f0f6f1] text-[#57916d]"><Icon name={icon} size={14} /></span>
      </div>
      <p className="mt-3 text-[18px] font-bold tracking-[-0.04em] text-[#34473b]">{value}</p>
      <p className="mt-1 text-[10px] text-[#9aa49c]">{caption}</p>
    </div>
  );
}

function ListingView({ view, items, onSelect, onNavigate }) {
  const isSaved = view === "saved";
  const entries = isSaved ? items.saved : items.history;
  return (
    <section className="rise-in">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[#799080]">{isSaved ? "Your library" : "Your activity"}</p>
          <h2 className="mt-2 text-[25px] font-bold tracking-[-0.05em] text-[#26392e]">{isSaved ? "Saved summaries" : "Recent history"}</h2>
          <p className="mt-2 text-[12px] text-[#829087]">{isSaved ? "Keep useful repository notes close at hand." : "Pick up where you left off."}</p>
        </div>
        <button type="button" onClick={() => onNavigate("overview")} className="inline-flex items-center gap-2 rounded-xl bg-[#236948] px-4 py-2.5 text-[11px] font-semibold text-white hover:bg-[#19563b]"><Icon name="search" size={14} /> New summary</button>
      </div>
      {entries.length ? (
        <div className="grid gap-3">
          {entries.map((summary) => (
            <button type="button" key={summary.id} onClick={() => onSelect(summary)} className="flex w-full items-center gap-4 rounded-2xl border border-[#e7ede7] bg-white p-4 text-left transition hover:border-[#cfe4d4] hover:shadow-[0_8px_24px_rgba(27,65,43,.05)] sm:p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f0f5f1] text-[#496251]"><Icon name="github" size={19} /></span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 text-[13px] font-bold text-[#34483b]">{summary.repository}<span className="rounded-full bg-[#f2f6f2] px-2 py-0.5 text-[9px] font-medium text-[#7b897f]">{summary.sample ? "Sample" : "Summary"}</span></span>
                <span className="mt-1 block truncate text-[11px] text-[#86938a]">{summary.description}</span>
              </span>
              <span className="hidden whitespace-nowrap text-[10px] text-[#a0aaa2] sm:block">{formatDate(summary.updatedAt)}</span>
              <Icon name="arrow" size={16} className="shrink-0 text-[#9aa69d]" />
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#dce5dd] bg-white px-6 py-14 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eff6f0] text-[#538667]"><Icon name={isSaved ? "bookmark" : "clock"} size={21} /></div>
          <p className="mt-4 text-[13px] font-semibold text-[#46594c]">{isSaved ? "Nothing saved yet" : "No summaries yet"}</p>
          <p className="mx-auto mt-1 max-w-xs text-[11px] leading-5 text-[#8b978f]">{isSaved ? "Save a summary to find it here later." : "Summaries you generate will appear here in your browser."}</p>
          <button type="button" onClick={() => onNavigate("overview")} className="mt-4 text-[11px] font-bold text-[#2e7651]">Explore a repository →</button>
        </div>
      )}
    </section>
  );
}

export default function App() {
  const [activeView, setActiveView] = useState("overview");
  const [activeTab, setActiveTab] = useState("overview");
  const [targetValue, setTargetValue] = useState("");
  const [summary, setSummary] = useState(sampleSummary);
  const [history, setHistory] = useState(() => readStored("gitsummarizer.history", []));
  const [saved, setSaved] = useState(() => readStored("gitsummarizer.saved", []));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => localStorage.setItem("gitsummarizer.history", JSON.stringify(history)), [history]);
  useEffect(() => localStorage.setItem("gitsummarizer.saved", JSON.stringify(saved)), [saved]);

  const endpoint = import.meta.env.VITE_SUMMARIZE_ENDPOINT || "/api/summaries";
  const apiBase = import.meta.env.VITE_API_BASE_URL || "";
  const isSaved = useMemo(() => saved.some((item) => item.id === summary.id), [saved, summary.id]);

  function showNotice(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3800);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    const target = parseTarget(targetValue);
    if (!target) {
      setError("Enter a GitHub repository URL, owner/repository, or a commit SHA.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${apiBase}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(target),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || `The summary service returned ${response.status}.`);
      }
      if (!response.headers.get("content-type")?.toLowerCase().includes("json")) {
        throw new Error("The summary service did not return JSON. Check VITE_API_BASE_URL and VITE_SUMMARIZE_ENDPOINT.");
      }
      const result = normalizeSummary(await response.json(), target);
      setSummary(result);
      setActiveTab("overview");
      setHistory((previous) => [result, ...previous.filter((item) => item.repository !== result.repository)].slice(0, 30));
      setTargetValue("");
      showNotice("Your summary is ready.");
    } catch (requestError) {
      const isUnavailable = requestError instanceof TypeError;
      setError(
        isUnavailable
          ? "The summary service is not connected yet. Set VITE_API_BASE_URL when your backend is ready."
          : requestError.message || "We couldn't create that summary. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  function toggleSaved() {
    if (isSaved) {
      setSaved((previous) => previous.filter((item) => item.id !== summary.id));
      showNotice("Removed from saved summaries.");
    } else {
      setSaved((previous) => [summary, ...previous.filter((item) => item.id !== summary.id)]);
      showNotice("Saved to your library.");
    }
  }

  function selectSummary(item) {
    setSummary(item);
    setActiveTab("overview");
    setActiveView("overview");
  }

  return (
    <div className="min-h-screen bg-[#f5f7f5] text-[#26382e]">
      <Sidebar activeView={activeView} onNavigate={setActiveView} mobileOpen={mobileOpen} closeMobile={() => setMobileOpen(false)} />
      <div className="min-h-screen lg:ml-[264px]">
        <TopBar activeView={activeView} openMobile={() => setMobileOpen(true)} />
        <main className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
          {activeView !== "overview" ? (
            <ListingView view={activeView} items={{ saved, history }} onSelect={selectSummary} onNavigate={setActiveView} />
          ) : (
            <div className="rise-in">
              <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[#799080]">Your codebase, made clear</p>
                  <h2 className="mt-2 text-[27px] font-bold tracking-[-0.055em] text-[#23372b] sm:text-[31px]">A clearer view of any repo.</h2>
                  <p className="mt-2 max-w-xl text-[12px] leading-6 text-[#839087]">Get the context you need to understand a project, review a change, or share what shipped.</p>
                </div>
                <div className="hidden items-center gap-2 rounded-full border border-[#e5ebe5] bg-white px-3 py-2 text-[10px] font-medium text-[#839087] md:flex">
                  <Icon name="spark" size={14} className="text-[#469468]" /> AI-powered project notes
                </div>
              </div>

              <section className="hero-grid relative overflow-hidden rounded-[22px] px-5 py-6 text-white sm:px-8 sm:py-8">
                <div className="relative z-10 max-w-3xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#ccebd8]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#8ee4ac]" /> Start with a link
                  </div>
                  <h3 className="mt-4 text-[20px] font-semibold tracking-[-0.04em] sm:text-[23px]">What are you trying to understand?</h3>
                  <p className="mt-1.5 text-[11px] leading-5 text-[#c5dacf]">Paste a public GitHub repository or commit. We’ll turn the technical details into a useful brief.</p>
                  <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-2 rounded-2xl bg-white p-2 shadow-[0_12px_35px_rgba(8,29,20,.18)] sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3 px-2 sm:px-3">
                      <Icon name="github" size={19} className="shrink-0 text-[#73847a]" />
                      <input
                        value={targetValue}
                        onChange={(event) => {
                          setTargetValue(event.target.value);
                          if (error) setError("");
                        }}
                        placeholder="github.com/owner/repository or commit URL"
                        aria-label="GitHub repository URL or commit"
                        className="h-10 min-w-0 flex-1 bg-transparent text-[12px] text-[#33463a] outline-none placeholder:text-[#a5afa8]"
                      />
                    </div>
                    <button disabled={loading} type="submit" className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#286d4b] px-4 text-[11px] font-bold text-white transition hover:bg-[#205b3e] disabled:cursor-wait disabled:opacity-70">
                      {loading ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Generating</> : <>Generate summary <Icon name="arrow" size={14} /></>}
                    </button>
                  </form>
                  {error ? <p role="alert" className="mt-2 rounded-lg bg-[#fff1ec] px-3 py-2 text-[10px] font-medium text-[#a64631]">{error}</p> : <p className="mt-2.5 text-[9px] text-[#b8d2c2]">Supports repository links, owner/repository, and commit hashes · Public repositories</p>}
                </div>
                <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-20 hidden h-72 w-72 rounded-full border border-white/[0.08] lg:block" />
                <div aria-hidden="true" className="pointer-events-none absolute -right-2 -top-12 hidden h-56 w-56 rounded-full border border-white/[0.08] lg:block" />
                <div aria-hidden="true" className="pointer-events-none absolute right-11 top-12 hidden h-28 w-28 rounded-full border border-white/[0.08] lg:block" />
              </section>

              <div className="mb-4 mt-7 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[14px] font-bold tracking-[-0.02em] text-[#35483b]">Repository brief</h3>
                  <p className="mt-1 text-[10px] text-[#929e95]">A quick, readable overview of the project.</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e9f4ec] px-2.5 py-1.5 text-[9px] font-semibold text-[#43815a]"><Icon name="check" size={12} /> Ready to explore</span>
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(240px,.78fr)]">
                <SummaryCard summary={summary} saved={isSaved} onToggleSaved={toggleSaved} activeTab={activeTab} onTabChange={setActiveTab} />
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 xl:grid-cols-1">
                    <StatCard label="Key highlights" value={summary.highlights?.length ?? 0} caption="Things worth knowing" icon="spark" />
                    <StatCard label="Prerequisites" value={summary.prerequisites?.length ?? 0} caption="Before you get started" icon="check" />
                  </div>
                  <div className="rounded-2xl border border-[#e8eee8] bg-white p-5">
                    <div className="flex items-center gap-2 text-[11px] font-bold text-[#3b4e41]"><Icon name="file" size={15} className="text-[#5b946d]" /> Project map</div>
                    <p className="mt-1 text-[10px] text-[#9aa49c]">A few places to start exploring</p>
                    <ul className="mt-4 space-y-3">
                      {(summary.files?.length ? summary.files : ["No key paths provided"]).slice(0, 4).map((file) => <li key={file} className="flex items-center gap-2.5 text-[10px] text-[#748178]"><span className="h-1.5 w-1.5 rounded-full bg-[#77b28a]" /><span className="truncate">{file}</span></li>)}
                    </ul>
                    {summary.url && <a href={summary.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-[10px] font-semibold text-[#36774f] hover:text-[#205b3e]">Browse repository <Icon name="arrow" size={12} /></a>}
                  </div>
                  <button type="button" onClick={() => setActiveView("history")} className="flex w-full items-center justify-between rounded-2xl border border-[#e8eee8] bg-white p-4 text-left hover:border-[#cfe2d3]">
                    <span className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f1f5f1] text-[#688071]"><Icon name="clock" size={16} /></span><span><span className="block text-[11px] font-bold text-[#435448]">Recent history</span><span className="mt-1 block text-[9px] text-[#98a39a]">{history.length} {history.length === 1 ? "summary" : "summaries"} in this browser</span></span></span>
                    <Icon name="arrow" size={15} className="text-[#9ba69e]" />
                  </button>
                </div>
              </div>
              <div className="mt-5 flex items-start gap-2 rounded-xl border border-[#ede9dc] bg-[#fcfbf6] px-4 py-3 text-[10px] leading-5 text-[#8c8065]">
                <Icon name="spark" size={14} className="mt-0.5 shrink-0 text-[#b59251]" />
                <span>{summary.sample ? "You’re viewing an example summary. Connect a backend service to analyze live GitHub repositories; saved items and history stay in this browser." : "Summary generated by your connected service. This frontend stores history and saved items locally in your browser."}</span>
              </div>
            </div>
          )}
        </main>
      </div>
      {notice && <div role="status" className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-[#173c2c] px-4 py-3 text-[11px] font-semibold text-white shadow-xl"><Icon name="check" size={15} />{notice}</div>}
    </div>
  );
}
