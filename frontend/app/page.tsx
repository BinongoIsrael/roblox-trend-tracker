"use client";

import { useEffect, useState, useCallback } from "react";

interface GameMetric {
  universe_id: string | number;
  name: string;
  description?: string;
  genre?: string;
  ccu: number;
  visits: string | number;
  upvotes: number;
  downvotes: number;
  timestamp: string;
}

export default function Home() {
  const [metrics, setMetrics] = useState<GameMetric[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDark, setIsDark] = useState<boolean>(true);

  // Synchronize dark mode state with html tag on mount
  useEffect(() => {
    const root = document.documentElement;
    const hasDark = root.classList.contains("dark");
    setIsDark(hasDark);
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    if (root.classList.contains("dark")) {
      root.classList.remove("dark");
      setIsDark(false);
    } else {
      root.classList.add("dark");
      setIsDark(true);
    }
  };

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch("/api/metrics");
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.error || `Request failed with status ${response.status}`
        );
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        setMetrics(data);
        setError(null);
      } else {
        throw new Error("Invalid response format received from server.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    await fetchMetrics();
  };

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const totalCCU = metrics.reduce(
    (acc, item) => acc + (Number(item.ccu) || 0),
    0
  );

  return (
    <div className="min-h-screen bg-brand-light text-brand-darkest dark:bg-brand-darkest dark:text-brand-light flex flex-col font-sans transition-colors duration-200">
      {/* Top Header */}
      <header className="border-b border-brand-main/30 bg-white/70 dark:bg-brand-darkest/80 dark:border-brand-dark/50 backdrop-blur-md sticky top-0 z-20 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-brand-main/20 border border-brand-main text-brand-dark dark:text-brand-light flex items-center justify-center font-bold text-base shadow-sm">
              🎮
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-brand-darkest dark:text-brand-light flex items-center gap-2">
                Roblox Trend Tracker
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-brand-main/20 text-brand-dark dark:text-brand-light border border-brand-main/40">
                  MotherDuck Live
                </span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Light / Dark Mode Toggle Button */}
            <button
              onClick={toggleTheme}
              title={`Switch to ${isDark ? "Light" : "Dark"} Mode`}
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white/80 dark:bg-brand-dark/40 hover:bg-brand-main/20 dark:hover:bg-brand-dark/70 text-brand-darkest dark:text-brand-light border border-brand-main/40 dark:border-brand-dark/60 transition shadow-xs"
            >
              {isDark ? (
                // Sun Icon (Switch to Light)
                <svg
                  className="w-4 h-4 text-amber-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              ) : (
                // Moon Icon (Switch to Dark)
                <svg
                  className="w-4 h-4 text-brand-dark"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
              )}
            </button>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-main text-white dark:bg-brand-dark hover:bg-brand-dark dark:hover:bg-brand-main/80 border border-brand-dark/30 dark:border-brand-main/40 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            >
              <svg
                className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white/80 dark:bg-brand-darkest/70 border border-brand-main/30 dark:border-brand-dark/60 rounded-xl p-5 shadow-sm transition-colors">
            <span className="text-xs font-semibold text-brand-dark dark:text-brand-light/80 uppercase tracking-wider">
              Top 10 Aggregate CCU
            </span>
            <div className="mt-2 text-2xl font-bold text-brand-dark dark:text-brand-light tracking-tight">
              {loading ? "..." : totalCCU.toLocaleString()}
            </div>
            <p className="mt-1 text-xs text-brand-dark/70 dark:text-brand-light/60">
              Live concurrent players across top 10 titles
            </p>
          </div>

          <div className="bg-white/80 dark:bg-brand-darkest/70 border border-brand-main/30 dark:border-brand-dark/60 rounded-xl p-5 shadow-sm transition-colors">
            <span className="text-xs font-semibold text-brand-dark dark:text-brand-light/80 uppercase tracking-wider">
              #1 Ranked Title
            </span>
            <div className="mt-2 text-lg font-bold text-brand-darkest dark:text-brand-light truncate">
              {loading ? "..." : metrics[0]?.name || "N/A"}
            </div>
            <p className="mt-1 text-xs text-brand-dark/70 dark:text-brand-light/60">
              {metrics[0]
                ? `${Number(metrics[0].ccu).toLocaleString()} active players`
                : "No data available"}
            </p>
          </div>

          <div className="bg-white/80 dark:bg-brand-darkest/70 border border-brand-main/30 dark:border-brand-dark/60 rounded-xl p-5 shadow-sm transition-colors">
            <span className="text-xs font-semibold text-brand-dark dark:text-brand-light/80 uppercase tracking-wider">
              Pipeline Status
            </span>
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-brand-main animate-pulse" />
              <span className="text-sm font-bold text-brand-darkest dark:text-brand-light">
                MotherDuck Connected
              </span>
            </div>
            <p className="mt-1 text-xs text-brand-dark/70 dark:text-brand-light/60">
              NLP Genre Classification & Metrics
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-700 dark:text-red-300 flex items-start justify-between">
            <div className="flex gap-3">
              <span className="text-red-500 text-lg">⚠️</span>
              <div>
                <h3 className="text-sm font-semibold">Failed to fetch metrics</h3>
                <p className="text-xs opacity-90 mt-0.5">{error}</p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              className="text-xs font-semibold bg-red-500/20 hover:bg-red-500/30 px-3 py-1.5 rounded-md transition border border-red-500/30"
            >
              Retry
            </button>
          </div>
        )}

        {/* Leaderboard Table Container */}
        <div className="bg-white/85 dark:bg-brand-darkest/80 border border-brand-main/30 dark:border-brand-dark/60 rounded-xl shadow-lg overflow-hidden backdrop-blur-sm transition-colors">
          <div className="px-5 py-4 border-b border-brand-main/20 dark:border-brand-dark/60 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-brand-darkest dark:text-brand-light">
                Top 10 Trending Games & Genre Analytics
              </h2>
              <p className="text-xs text-brand-dark/80 dark:text-brand-light/70 mt-0.5">
                Real-time leaderboard ranked by CCU with machine-learning sub-genre clustering
              </p>
            </div>
            {metrics.length > 0 && (
              <span className="text-xs text-brand-dark/70 dark:text-brand-light/60 font-mono">
                {metrics.length} entries loaded
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-brand-main/10 dark:bg-brand-dark/30 text-brand-dark dark:text-brand-light/90 text-xs font-semibold uppercase tracking-wider border-b border-brand-main/20 dark:border-brand-dark/60">
                  <th scope="col" className="py-3.5 px-4 w-12 text-center">
                    #
                  </th>
                  <th scope="col" className="py-3.5 px-4">
                    Game Title
                  </th>
                  <th scope="col" className="py-3.5 px-4">
                    Genre
                  </th>
                  <th scope="col" className="py-3.5 px-4 text-right">
                    CCU
                  </th>
                  <th scope="col" className="py-3.5 px-4 text-right">
                    Total Visits
                  </th>
                  <th scope="col" className="py-3.5 px-4 text-right">
                    Upvotes
                  </th>
                  <th scope="col" className="py-3.5 px-4 text-right">
                    Downvotes
                  </th>
                  <th scope="col" className="py-3.5 px-4 text-right">
                    Approval
                  </th>
                  <th scope="col" className="py-3.5 px-4 text-right">
                    Snapshot Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-main/15 dark:divide-brand-dark/40 font-medium">
                {loading ? (
                  Array.from({ length: 10 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="py-4 px-4 text-center">
                        <div className="h-4 w-5 bg-brand-main/20 dark:bg-brand-dark/50 rounded mx-auto" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 w-44 bg-brand-main/20 dark:bg-brand-dark/50 rounded" />
                        <div className="h-3 w-20 bg-brand-main/10 dark:bg-brand-dark/30 rounded mt-1.5" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-5 w-24 bg-brand-main/20 dark:bg-brand-dark/50 rounded-full" />
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="h-4 w-16 bg-brand-main/20 dark:bg-brand-dark/50 rounded ml-auto" />
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="h-4 w-20 bg-brand-main/20 dark:bg-brand-dark/50 rounded ml-auto" />
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="h-4 w-14 bg-brand-main/20 dark:bg-brand-dark/50 rounded ml-auto" />
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="h-4 w-14 bg-brand-main/20 dark:bg-brand-dark/50 rounded ml-auto" />
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="h-4 w-12 bg-brand-main/20 dark:bg-brand-dark/50 rounded ml-auto" />
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="h-4 w-20 bg-brand-main/20 dark:bg-brand-dark/50 rounded ml-auto" />
                      </td>
                    </tr>
                  ))
                ) : metrics.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="py-12 text-center text-brand-dark/60 dark:text-brand-light/50 text-sm"
                    >
                      No metrics records found in MotherDuck database.
                    </td>
                  </tr>
                ) : (
                  metrics.map((game, idx) => {
                    const up = Number(game.upvotes) || 0;
                    const down = Number(game.downvotes) || 0;
                    const totalVotes = up + down;
                    const rating =
                      totalVotes > 0 ? Math.round((up / totalVotes) * 100) : null;

                    const rankBadgeColor =
                      idx === 0
                        ? "bg-amber-400/20 text-amber-700 dark:text-amber-400 border-amber-400/40"
                        : idx === 1
                        ? "bg-zinc-400/20 text-zinc-700 dark:text-zinc-300 border-zinc-400/40"
                        : idx === 2
                        ? "bg-amber-700/20 text-amber-800 dark:text-amber-500 border-amber-700/40"
                        : "text-brand-dark/70 dark:text-brand-light/50 border-brand-main/20 dark:border-brand-dark/40";

                    return (
                      <tr
                        key={String(game.universe_id) + idx}
                        className="hover:bg-brand-main/5 dark:hover:bg-brand-dark/30 transition-colors"
                      >
                        {/* Rank */}
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold border ${rankBadgeColor}`}
                          >
                            {idx + 1}
                          </span>
                        </td>

                        {/* Game Title */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-brand-darkest dark:text-brand-light hover:text-brand-main dark:hover:text-brand-main transition-colors">
                            {game.name}
                          </div>
                          <div className="text-[11px] text-brand-dark/60 dark:text-brand-light/50 font-mono mt-0.5">
                            ID: {String(game.universe_id)}
                          </div>
                        </td>

                        {/* Stylized Genre Badge using brand-main */}
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-main/15 text-brand-dark border border-brand-main/40 dark:bg-brand-main/25 dark:text-brand-light dark:border-brand-main/60 shadow-2xs whitespace-nowrap">
                            {game.genre || "Unclassified"}
                          </span>
                        </td>

                        {/* CCU */}
                        <td className="py-3.5 px-4 text-right">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-brand-main/20 text-brand-darkest dark:text-brand-light border border-brand-main/50">
                            {Number(game.ccu).toLocaleString()}
                          </span>
                        </td>

                        {/* Total Visits */}
                        <td className="py-3.5 px-4 text-right text-brand-darkest/90 dark:text-brand-light/90 font-mono text-xs">
                          {Number(game.visits).toLocaleString()}
                        </td>

                        {/* Upvotes */}
                        <td className="py-3.5 px-4 text-right text-emerald-600 dark:text-emerald-400 font-mono text-xs font-semibold">
                          👍 {up.toLocaleString()}
                        </td>

                        {/* Downvotes */}
                        <td className="py-3.5 px-4 text-right text-rose-600 dark:text-rose-400 font-mono text-xs font-semibold">
                          👎 {down.toLocaleString()}
                        </td>

                        {/* Approval */}
                        <td className="py-3.5 px-4 text-right">
                          {rating !== null ? (
                            <span
                              className={`text-xs font-bold ${
                                rating >= 80
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : rating >= 60
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-rose-600 dark:text-rose-400"
                              }`}
                            >
                              {rating}%
                            </span>
                          ) : (
                            <span className="text-xs text-brand-dark/50 dark:text-brand-light/40">
                              N/A
                            </span>
                          )}
                        </td>

                        {/* Snapshot Time */}
                        <td className="py-3.5 px-4 text-right text-brand-dark/70 dark:text-brand-light/60 text-xs font-mono">
                          {game.timestamp
                            ? new Date(game.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "N/A"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-brand-main/20 dark:border-brand-dark/50 py-4 text-center text-xs text-brand-dark/70 dark:text-brand-light/60 transition-colors">
        Roblox Trend Tracker • Powered by Next.js, Tailwind CSS & MotherDuck
      </footer>
    </div>
  );
}
