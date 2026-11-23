import { useCallback, useEffect, useState } from "react";
import {
  createSummary,
  deleteSummaryById,
  fetchSummaryById,
  fetchSummaryHistory,
} from "../api/summaries";

const getSavedKey = (user) => (user?.id ? `gitsummarizer.saved_${user.id}` : null);
const getHistoryCacheKey = (user) => (user?.id ? `gitsummarizer.history_cache_${user.id}` : null);

export function useSummaries(user = null) {
  const [currentSummary, setCurrentSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // History state from API (scoped to the authenticated/demo user)
  const [historyItems, setHistoryItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [historyLoading, setHistoryLoading] = useState(false);

  // Saved / bookmarked items (strictly scoped to user ID in localStorage)
  const [savedItems, setSavedItems] = useState(() => {
    const key = getSavedKey(user);
    if (!key) return [];
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Whenever user account changes (login, switch to demo, or logout), wipe in-memory state and load user-specific saved library
  useEffect(() => {
    setCurrentSummary(null);
    setError(null);
    setHistoryItems([]);
    setPagination({ page: 1, limit: 10, total: 0, totalPages: 1 });

    const key = getSavedKey(user);
    if (!key) {
      setSavedItems([]);
      return;
    }

    try {
      const stored = localStorage.getItem(key);
      setSavedItems(stored ? JSON.parse(stored) : []);
    } catch {
      setSavedItems([]);
    }
  }, [user?.id]);

  // Sync saved items strictly to the active user's storage key
  useEffect(() => {
    const key = getSavedKey(user);
    if (!key) return;

    try {
      localStorage.setItem(key, JSON.stringify(savedItems));
    } catch {
      // Ignore storage quota error
    }
  }, [savedItems, user?.id]);

  const loadHistory = useCallback(
    async (page = 1, limit = 10) => {
      setHistoryLoading(true);
      const cacheKey = getHistoryCacheKey(user);

      try {
        const result = await fetchSummaryHistory({ page, limit });
        setHistoryItems(result.items || []);
        setPagination(result.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });

        // Update user-scoped local cache
        if (cacheKey) {
          try {
            localStorage.setItem(cacheKey, JSON.stringify(result.items || []));
          } catch {
            // Ignore quota error
          }
        }
      } catch (err) {
        // If offline, fallback strictly to this user's cached history
        if (cacheKey) {
          try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
              const parsed = JSON.parse(cached);
              setHistoryItems(parsed);
              setPagination({ page: 1, limit: 10, total: parsed.length, totalPages: 1 });
            }
          } catch {
            // Ignore fallback error
          }
        }
      } finally {
        setHistoryLoading(false);
      }
    },
    [user?.id]
  );

  const generate = useCallback(
    async ({ repositoryUrl, commitRef = null, commitLimit = 20 }) => {
      setLoading(true);
      setError(null);

      try {
        const summaryData = await createSummary({ repositoryUrl, commitRef, commitLimit });
        setCurrentSummary(summaryData);
        // Refresh history for the active user
        await loadHistory(1, pagination.limit);
        return summaryData;
      } catch (err) {
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [loadHistory, pagination.limit]
  );

  const loadDetail = useCallback(async (summaryId) => {
    setLoading(true);
    setError(null);

    try {
      const detail = await fetchSummaryById(summaryId);
      setCurrentSummary(detail);
      return detail;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const remove = useCallback(
    async (summaryId) => {
      try {
        await deleteSummaryById(summaryId);
      } catch {
        // Continue to remove locally even if server fails
      }

      setHistoryItems((prev) => prev.filter((item) => item.id !== summaryId));
      setSavedItems((prev) => prev.filter((item) => item.id !== summaryId));
      if (currentSummary?.id === summaryId) {
        setCurrentSummary(null);
      }
    },
    [currentSummary?.id]
  );

  const toggleSave = useCallback((summaryToSave) => {
    if (!summaryToSave || !summaryToSave.id) return;

    setSavedItems((prev) => {
      const exists = prev.some((item) => item.id === summaryToSave.id);
      if (exists) {
        return prev.filter((item) => item.id !== summaryToSave.id);
      }
      return [summaryToSave, ...prev];
    });
  }, []);

  const isSaved = useCallback(
    (summaryId) => {
      if (!summaryId) return false;
      return savedItems.some((item) => item.id === summaryId);
    },
    [savedItems]
  );

  const resetWorkspace = useCallback(() => {
    setCurrentSummary(null);
    setError(null);
    setHistoryItems([]);
    setLoading(false);
  }, []);

  return {
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
    resetWorkspace,
  };
}

export default useSummaries;
