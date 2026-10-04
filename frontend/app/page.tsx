"use client";

import { useEffect, useState, useCallback } from "react";

interface GameMetric {
  universe_id: string | number;
  name: string;
  description?: string;
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Banner / Navbar */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm">
              🎮
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Roblox Trend Tracker
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  MotherDuck Cloud
                </span>
              </h1>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
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
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 shadow-sm">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Top 10 Aggregate CCU
            </span>
            <div className="mt-2 text-2xl font-bold text-emerald-400 tracking-tight">
              {loading ? "..." : totalCCU.toLocaleString()}
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Live concurrent players across top 10 titles
            </p>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 shadow-sm">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              #1 Ranked Title
            </span>
            <div className="mt-2 text-lg font-bold text-white truncate">
              {loading ? "..." : metrics[0]?.name || "N/A"}
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {metrics[0]
                ? `${Number(metrics[0].ccu).toLocaleString()} active players`
                : "No data available"}
            </p>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 shadow-sm">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Pipeline Status
            </span>
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-semibold text-zinc-200">
                MotherDuck Connected
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Queried via @duckdb/node-api
            </p>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-4 text-red-200 flex items-start justify-between">
            <div className="flex gap-3">
              <span className="text-red-400 text-lg">⚠️</span>
              <div>
                <h3 className="text-sm font-semibold text-red-300">
                  Failed to fetch metrics
                </h3>
                <p className="text-xs text-red-400/90 mt-0.5">{error}</p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              className="text-xs font-medium bg-red-500/20 hover:bg-red-500/30 text-red-300 px-3 py-1.5 rounded-md transition border border-red-500/30"
            >
              Retry
            </button>
          </div>
        )}

        {/* Dark-Themed Table Container */}
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden backdrop-blur-sm">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">
                Top 10 Trending Games
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Real-time leaderboard ranked by concurrent player count (CCU)
              </p>
            </div>
            {metrics.length > 0 && (
              <span className="text-xs text-zinc-500 font-mono">
                {metrics.length} entries loaded
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-zinc-900/90 text-zinc-400 text-xs font-semibold uppercase tracking-wider border-b border-zinc-800">
                  <th scope="col" className="py-3.5 px-4 w-12 text-center">
                    #
                  </th>
                  <th scope="col" className="py-3.5 px-4">
                    Game Title
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
              <tbody className="divide-y divide-zinc-800/60 font-medium">
                {loading ? (
                  // Loading Skeleton Rows
                  Array.from({ length: 10 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="py-4 px-4 text-center">
                        <div className="h-4 w-5 bg-zinc-800 rounded mx-auto" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 w-48 bg-zinc-800 rounded" />
                        <div className="h-3 w-24 bg-zinc-800/60 rounded mt-1.5" />
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="h-4 w-16 bg-zinc-800 rounded ml-auto" />
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="h-4 w-20 bg-zinc-800 rounded ml-auto" />
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="h-4 w-16 bg-zinc-800 rounded ml-auto" />
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="h-4 w-16 bg-zinc-800 rounded ml-auto" />
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="h-4 w-12 bg-zinc-800 rounded ml-auto" />
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="h-4 w-24 bg-zinc-800 rounded ml-auto" />
                      </td>
                    </tr>
                  ))
                ) : metrics.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-12 text-center text-zinc-500 text-sm"
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
                        ? "bg-amber-400/10 text-amber-400 border-amber-400/20"
                        : idx === 1
                        ? "bg-zinc-300/10 text-zinc-300 border-zinc-300/20"
                        : idx === 2
                        ? "bg-amber-700/10 text-amber-500 border-amber-700/20"
                        : "text-zinc-500";

                    return (
                      <tr
                        key={String(game.universe_id) + idx}
                        className="hover:bg-zinc-800/40 transition-colors"
                      >
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold border ${rankBadgeColor}`}
                          >
                            {idx + 1}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-zinc-100 hover:text-emerald-400 transition-colors">
                            {game.name}
                          </div>
                          <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                            ID: {String(game.universe_id)}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {Number(game.ccu).toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right text-zinc-300 font-mono text-xs">
                          {Number(game.visits).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right text-emerald-400/90 font-mono text-xs">
                          👍 {up.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right text-red-400/90 font-mono text-xs">
                          👎 {down.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {rating !== null ? (
                            <span
                              className={`text-xs font-semibold ${
                                rating >= 80
                                  ? "text-emerald-400"
                                  : rating >= 60
                                  ? "text-amber-400"
                                  : "text-red-400"
                              }`}
                            >
                              {rating}%
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-500">N/A</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right text-zinc-500 text-xs font-mono">
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
      <footer className="border-t border-zinc-800/60 py-4 text-center text-xs text-zinc-600">
        Roblox Trend Tracker • Powered by Next.js, Tailwind CSS & MotherDuck
      </footer>
    </div>
  );
}
