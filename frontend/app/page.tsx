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

  // Synchronize dark mode state with html class on mount
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
    <div className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 font-mono flex flex-col transition-colors duration-150 p-3 sm:p-6 lg:p-8">
      {/* Outer Retro Terminal Window Frame */}
      <div className="max-w-7xl mx-auto w-full border-2 border-zinc-900 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-[6px_6px_0px_0px_#09090b] dark:shadow-[6px_6px_0px_0px_#27272a] flex flex-col flex-1">
        {/* Terminal Title Bar */}
        <div className="border-b-2 border-zinc-900 dark:border-zinc-700 bg-zinc-200 dark:bg-zinc-800 px-4 py-2.5 flex items-center justify-between select-none">
          {/* Left: Pixel Arcade Window Buttons & Title */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 border border-zinc-900 dark:border-zinc-600 bg-rose-500 inline-block shadow-[1px_1px_0px_0px_#000]" />
              <span className="w-3 h-3 border border-zinc-900 dark:border-zinc-600 bg-amber-400 inline-block shadow-[1px_1px_0px_0px_#000]" />
              <span className="w-3 h-3 border border-zinc-900 dark:border-zinc-600 bg-emerald-500 inline-block shadow-[1px_1px_0px_0px_#000]" />
            </div>
            <div className="h-4 w-[2px] bg-zinc-400 dark:bg-zinc-600 hidden sm:block" />
            <div className="text-xs font-bold tracking-tight uppercase flex items-center gap-1.5 text-zinc-800 dark:text-zinc-200">
              <span>👾</span>
              <span>ROBLOX_TRENDS_CLI v2.0</span>
              <span className="hidden md:inline text-zinc-500 dark:text-zinc-400">
                [SESSION: LIVE_MOTHERDUCK]
              </span>
            </div>
          </div>

          {/* Right: Retro Action Buttons */}
          <div className="flex items-center space-x-2">
            {/* Light / Dark Mode Pixel Switch */}
            <button
              onClick={toggleTheme}
              title={`Switch to ${isDark ? "Light" : "Dark"} Mode`}
              className="border-2 border-zinc-900 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 px-2.5 py-1 text-xs font-bold uppercase shadow-[2px_2px_0px_0px_#000] dark:shadow-[2px_2px_0px_0px_#52525b] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center gap-1.5"
            >
              {isDark ? (
                <>
                  <span className="text-amber-300">☀️</span>
                  <span className="hidden sm:inline">LIGHT_MODE</span>
                </>
              ) : (
                <>
                  <span className="text-indigo-600">🌙</span>
                  <span className="hidden sm:inline">DARK_MODE</span>
                </>
              )}
            </button>

            {/* Refresh Pixel Button */}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="border-2 border-zinc-900 dark:border-zinc-600 bg-emerald-400 text-zinc-950 dark:bg-emerald-500 hover:bg-emerald-300 dark:hover:bg-emerald-400 px-3 py-1 text-xs font-bold uppercase shadow-[2px_2px_0px_0px_#000] dark:shadow-[2px_2px_0px_0px_#52525b] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <span className={loading ? "animate-spin" : ""}>⟳</span>
              <span>FETCH</span>
            </button>
          </div>
        </div>

        {/* Command Line / Console Prompt Header */}
        <div className="border-b-2 border-zinc-900 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950/60 p-4 space-y-1">
          <div className="text-xs text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
              SYS@MOTHERDUCK:~$
            </span>
            <span className="text-zinc-800 dark:text-zinc-200">
              run query --table games+metrics --order ccu_desc --limit 10
            </span>
            <span className="pixel-cursor text-emerald-500 font-black">▋</span>
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex flex-wrap gap-4 pt-1">
            <span>[DB: md:roblox_trends]</span>
            <span>[STATUS: ONLINE]</span>
            <span>[RETENTION: 30-DAY ROLLING]</span>
            <span>[CLUSTER_ENGINE: KMEANS_NLP]</span>
          </div>
        </div>

        {/* Inner Content Area */}
        <div className="p-4 sm:p-6 space-y-6 flex-1">
          {/* KPI Stat Blocks (Pixel Styled) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Stat 1 */}
            <div className="border-2 border-zinc-900 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950/80 p-4 shadow-[4px_4px_0px_0px_#000] dark:shadow-[4px_4px_0px_0px_#27272a] relative">
              <div className="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
                <span>[01] // TOTAL_TOP10_CCU</span>
                <span className="text-emerald-500">● LIVE</span>
              </div>
              <div className="mt-2 text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                {loading ? "FETCHING..." : totalCCU.toLocaleString()}
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">
                Sum of active concurrent players across leaderboard
              </p>
            </div>

            {/* Stat 2 */}
            <div className="border-2 border-zinc-900 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950/80 p-4 shadow-[4px_4px_0px_0px_#000] dark:shadow-[4px_4px_0px_0px_#27272a]">
              <div className="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
                <span>[02] // #1_TOP_TITLE</span>
                <span className="text-amber-500">👑 LEADER</span>
              </div>
              <div className="mt-2 text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100 truncate">
                {loading ? "LOADING..." : metrics[0]?.name || "N/A"}
              </div>
              <p className="mt-1 text-[11px] text-zinc-500 truncate">
                {metrics[0]
                  ? `${Number(metrics[0].ccu).toLocaleString()} CCU | ${
                      metrics[0].genre || "Genre: N/A"
                    }`
                  : "No data available"}
              </p>
            </div>

            {/* Stat 3 */}
            <div className="border-2 border-zinc-900 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950/80 p-4 shadow-[4px_4px_0px_0px_#000] dark:shadow-[4px_4px_0px_0px_#27272a]">
              <div className="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
                <span>[03] // TELEMETRY_STREAM</span>
                <span className="text-cyan-500">⚡ ACTIVE</span>
              </div>
              <div className="mt-2 text-base font-bold text-zinc-800 dark:text-zinc-200">
                {loading ? "QUERYING..." : `${metrics.length} TITLES TRACKED`}
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">
                Synchronized with MotherDuck Cloud Data Warehouse
              </p>
            </div>
          </div>

          {/* Error Alert Box */}
          {error && (
            <div className="border-2 border-rose-600 bg-rose-100 dark:bg-rose-950/50 p-4 text-rose-900 dark:text-rose-200 shadow-[4px_4px_0px_0px_#e11d48] flex items-center justify-between">
              <div className="flex items-center gap-3 text-xs">
                <span className="text-lg">❌</span>
                <div>
                  <div className="font-bold uppercase tracking-wider">
                    CRITICAL_ERROR // QUERY_FAILED
                  </div>
                  <div className="mt-0.5 font-mono opacity-90">{error}</div>
                </div>
              </div>
              <button
                onClick={handleRefresh}
                className="border-2 border-rose-900 dark:border-rose-400 bg-rose-200 dark:bg-rose-900 hover:bg-rose-300 px-3 py-1 text-xs font-bold uppercase shadow-[2px_2px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
              >
                [RETRY]
              </button>
            </div>
          )}

          {/* Table Container (Chunky Pixel Window) */}
          <div className="border-2 border-zinc-900 dark:border-zinc-700 bg-white dark:bg-zinc-950 shadow-[5px_5px_0px_0px_#000] dark:shadow-[5px_5px_0px_0px_#27272a] overflow-hidden">
            {/* Table Header Bar */}
            <div className="border-b-2 border-zinc-900 dark:border-zinc-700 bg-zinc-200 dark:bg-zinc-800 px-4 py-2.5 flex items-center justify-between text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase">
              <div className="flex items-center gap-2">
                <span>📊</span>
                <span>LEADERBOARD // TOP_10_CONCURRENT_PLAYERS</span>
              </div>
              <span className="text-[11px] font-normal text-zinc-600 dark:text-zinc-400">
                TOTAL: {metrics.length} ROWS
              </span>
            </div>

            {/* Scrollable Data Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-zinc-900 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900/90 text-zinc-700 dark:text-zinc-300 font-bold uppercase tracking-wider">
                    <th className="py-3 px-3 w-14 text-center border-r border-zinc-300 dark:border-zinc-800">
                      RANK
                    </th>
                    <th className="py-3 px-4 border-r border-zinc-300 dark:border-zinc-800">
                      GAME TITLE
                    </th>
                    <th className="py-3 px-4 border-r border-zinc-300 dark:border-zinc-800">
                      GENRE
                    </th>
                    <th className="py-3 px-4 text-right border-r border-zinc-300 dark:border-zinc-800">
                      CCU
                    </th>
                    <th className="py-3 px-4 text-right border-r border-zinc-300 dark:border-zinc-800">
                      VISITS
                    </th>
                    <th className="py-3 px-4 text-right border-r border-zinc-300 dark:border-zinc-800">
                      UPVOTES
                    </th>
                    <th className="py-3 px-4 text-right border-r border-zinc-300 dark:border-zinc-800">
                      DOWNVOTES
                    </th>
                    <th className="py-3 px-4 text-right border-r border-zinc-300 dark:border-zinc-800">
                      APPROVAL
                    </th>
                    <th className="py-3 px-4 text-right">
                      TIMESTAMP
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/80 font-mono">
                  {loading ? (
                    Array.from({ length: 10 }).map((_, idx) => (
                      <tr
                        key={idx}
                        className="animate-pulse bg-zinc-50 dark:bg-zinc-950/40"
                      >
                        <td className="py-3.5 px-3 text-center border-r border-zinc-200 dark:border-zinc-800">
                          <div className="h-4 w-7 bg-zinc-300 dark:bg-zinc-800 mx-auto" />
                        </td>
                        <td className="py-3.5 px-4 border-r border-zinc-200 dark:border-zinc-800">
                          <div className="h-4 w-44 bg-zinc-300 dark:bg-zinc-800" />
                        </td>
                        <td className="py-3.5 px-4 border-r border-zinc-200 dark:border-zinc-800">
                          <div className="h-4 w-28 bg-zinc-300 dark:bg-zinc-800" />
                        </td>
                        <td className="py-3.5 px-4 text-right border-r border-zinc-200 dark:border-zinc-800">
                          <div className="h-4 w-16 bg-zinc-300 dark:bg-zinc-800 ml-auto" />
                        </td>
                        <td className="py-3.5 px-4 text-right border-r border-zinc-200 dark:border-zinc-800">
                          <div className="h-4 w-20 bg-zinc-300 dark:bg-zinc-800 ml-auto" />
                        </td>
                        <td className="py-3.5 px-4 text-right border-r border-zinc-200 dark:border-zinc-800">
                          <div className="h-4 w-14 bg-zinc-300 dark:bg-zinc-800 ml-auto" />
                        </td>
                        <td className="py-3.5 px-4 text-right border-r border-zinc-200 dark:border-zinc-800">
                          <div className="h-4 w-14 bg-zinc-300 dark:bg-zinc-800 ml-auto" />
                        </td>
                        <td className="py-3.5 px-4 text-right border-r border-zinc-200 dark:border-zinc-800">
                          <div className="h-4 w-12 bg-zinc-300 dark:bg-zinc-800 ml-auto" />
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="h-4 w-16 bg-zinc-300 dark:bg-zinc-800 ml-auto" />
                        </td>
                      </tr>
                    ))
                  ) : metrics.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="py-12 text-center text-zinc-500 font-mono"
                      >
                        [NO_RECORDS_FOUND_IN_MOTHERDUCK]
                      </td>
                    </tr>
                  ) : (
                    metrics.map((game, idx) => {
                      const up = Number(game.upvotes) || 0;
                      const down = Number(game.downvotes) || 0;
                      const totalVotes = up + down;
                      const rating =
                        totalVotes > 0
                          ? Math.round((up / totalVotes) * 100)
                          : null;

                      // Pixel rank tag styling
                      const rankClass =
                        idx === 0
                          ? "border border-amber-600 bg-amber-200 text-amber-950 dark:bg-amber-900/60 dark:text-amber-200 dark:border-amber-500 font-black shadow-[1px_1px_0px_0px_#000]"
                          : idx === 1
                          ? "border border-zinc-600 bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-500 font-black shadow-[1px_1px_0px_0px_#000]"
                          : idx === 2
                          ? "border border-orange-600 bg-orange-200 text-orange-950 dark:bg-orange-900/60 dark:text-orange-200 dark:border-orange-500 font-black shadow-[1px_1px_0px_0px_#000]"
                          : "text-zinc-600 dark:text-zinc-400 font-bold";

                      return (
                        <tr
                          key={String(game.universe_id) + idx}
                          className="hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                        >
                          {/* Rank Badge */}
                          <td className="py-3 px-3 text-center border-r border-zinc-200 dark:border-zinc-800/80">
                            <span
                              className={`inline-block px-1.5 py-0.5 text-[11px] ${rankClass}`}
                            >
                              #{idx + 1}
                            </span>
                          </td>

                          {/* Game Title */}
                          <td className="py-3 px-4 border-r border-zinc-200 dark:border-zinc-800/80">
                            <div className="font-bold text-zinc-950 dark:text-zinc-100 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                              {game.name}
                            </div>
                            <div className="text-[10px] text-zinc-500 dark:text-zinc-500 font-mono mt-0.5">
                              ID: {String(game.universe_id)}
                            </div>
                          </td>

                          {/* Stylized Pixel Genre Badge */}
                          <td className="py-3 px-4 border-r border-zinc-200 dark:border-zinc-800/80 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-zinc-800 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800/90 text-zinc-800 dark:text-zinc-200 text-[11px] font-bold shadow-[2px_2px_0px_0px_#000] dark:shadow-[2px_2px_0px_0px_#3f3f46]">
                              <span className="text-emerald-500">▶</span>
                              <span>{game.genre || "UNCLASSIFIED"}</span>
                            </span>
                          </td>

                          {/* CCU */}
                          <td className="py-3 px-4 text-right border-r border-zinc-200 dark:border-zinc-800/80 whitespace-nowrap">
                            <span className="inline-block px-2 py-0.5 border border-emerald-600 dark:border-emerald-500 bg-emerald-100 text-emerald-950 dark:bg-emerald-950/80 dark:text-emerald-300 font-black text-xs shadow-[2px_2px_0px_0px_#059669]">
                              {Number(game.ccu).toLocaleString()} CCU
                            </span>
                          </td>

                          {/* Total Visits */}
                          <td className="py-3 px-4 text-right border-r border-zinc-200 dark:border-zinc-800/80 font-bold text-zinc-700 dark:text-zinc-300">
                            {Number(game.visits).toLocaleString()}
                          </td>

                          {/* Upvotes */}
                          <td className="py-3 px-4 text-right border-r border-zinc-200 dark:border-zinc-800/80 text-emerald-600 dark:text-emerald-400 font-bold">
                            ▲ {up.toLocaleString()}
                          </td>

                          {/* Downvotes */}
                          <td className="py-3 px-4 text-right border-r border-zinc-200 dark:border-zinc-800/80 text-rose-600 dark:text-rose-400 font-bold">
                            ▼ {down.toLocaleString()}
                          </td>

                          {/* Approval Rating */}
                          <td className="py-3 px-4 text-right border-r border-zinc-200 dark:border-zinc-800/80 font-bold">
                            {rating !== null ? (
                              <span
                                className={`px-1.5 py-0.5 border text-[11px] ${
                                  rating >= 80
                                    ? "border-emerald-600 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300"
                                    : rating >= 60
                                    ? "border-amber-600 text-amber-700 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-300"
                                    : "border-rose-600 text-rose-700 bg-rose-50 dark:bg-rose-950/50 dark:text-rose-300"
                                }`}
                              >
                                {rating}%
                              </span>
                            ) : (
                              <span className="text-zinc-400">N/A</span>
                            )}
                          </td>

                          {/* Snapshot Timestamp */}
                          <td className="py-3 px-4 text-right text-zinc-500 dark:text-zinc-400 whitespace-nowrap text-[11px]">
                            {game.timestamp
                              ? new Date(game.timestamp).toLocaleTimeString(
                                  [],
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                  }
                                )
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
        </div>

        {/* Retro Terminal Footer */}
        <div className="border-t-2 border-zinc-900 dark:border-zinc-700 bg-zinc-200 dark:bg-zinc-800 px-4 py-2 text-center text-[11px] text-zinc-600 dark:text-zinc-400 flex flex-col sm:flex-row items-center justify-between gap-1">
          <div>
            <span>[SYS]</span> ROBLOX_TREND_TRACKER // MOTHERDUCK_ENGINE // NEXT.JS
          </div>
          <div>
            <span>[STATUS]</span> 100% OPERATIONAL // SCAN_CYCLE: 30m
          </div>
        </div>
      </div>
    </div>
  );
}
