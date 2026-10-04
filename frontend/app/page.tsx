"use client";

import { useEffect, useState, useCallback, useMemo } from "react";

export interface GameMetric {
  universe_id: string | number;
  name: string;
  description?: string;
  created_at?: string;
  genre?: string;
  ccu: number;
  prev_ccu?: number | null;
  ccu_diff?: number | null;
  ccu_pct_change?: number | null;
  visits: string | number;
  upvotes: number;
  downvotes: number;
  timestamp: string;
  peak_ccu?: number | null;
  ccu_history?: number[];
}

function Sparkline({
  data,
  isUp,
}: {
  data?: number[];
  isUp?: boolean | null;
}) {
  if (!data || data.length < 2) {
    return (
      <span className="text-[10px] text-zinc-400 font-mono select-none px-1">
        [─]
      </span>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 58;
  const height = 18;
  const padding = 2;

  const points = data
    .map((val, idx) => {
      const x = padding + (idx / (data.length - 1)) * (width - 2 * padding);
      const y =
        height - padding - ((val - min) / range) * (height - 2 * padding);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const lastVal = data[data.length - 1];
  const lastX = width - padding;
  const lastY =
    height - padding - ((lastVal - min) / range) * (height - 2 * padding);

  const strokeColor =
    isUp === true
      ? "#10b981"
      : isUp === false
      ? "#f43f5e"
      : "#71717a";

  return (
    <span
      className="inline-block"
      title={`CCU History: ${data.map((d) => d.toLocaleString()).join(" → ")}`}
    >
      <svg
        width={width}
        height={height}
        className="inline-block overflow-visible"
      >
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
        <circle cx={lastX} cy={lastY} r="2" fill={strokeColor} />
      </svg>
    </span>
  );
}

export default function Home() {
  const [metrics, setMetrics] = useState<GameMetric[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDark, setIsDark] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<"leaderboard" | "breakout">("leaderboard");

  // Usability & filter states
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedGenre, setSelectedGenre] = useState<string>("ALL");
  const [rowLimit, setRowLimit] = useState<number | "ALL">(10);
  const [sortColumn, setSortColumn] = useState<string>("ccu");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [showMarketShare, setShowMarketShare] = useState<boolean>(true);

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
      const response = await fetch("/api/metrics?limit=100");
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

  const totalCCU = useMemo(() => {
    return metrics.reduce((acc, item) => acc + (Number(item.ccu) || 0), 0);
  }, [metrics]);

  const topGainer = useMemo(() => {
    const candidates = metrics.filter(
      (m) =>
        m.ccu_pct_change !== null &&
        m.ccu_pct_change !== undefined &&
        m.ccu_pct_change > 0
    );
    if (candidates.length === 0) return null;
    return candidates.reduce((prev, curr) =>
      (curr.ccu_pct_change || 0) > (prev.ccu_pct_change || 0) ? curr : prev
    );
  }, [metrics]);

  const availableGenres = useMemo(() => {
    const set = new Set<string>();
    metrics.forEach((m) => {
      if (m.genre) set.add(m.genre);
    });
    return ["ALL", ...Array.from(set).sort()];
  }, [metrics]);

  // Genre Market Share calculation
  const genreMarketShare = useMemo(() => {
    const map: Record<string, number> = {};
    metrics.forEach((m) => {
      const g = m.genre || "Unclassified";
      map[g] = (map[g] || 0) + (Number(m.ccu) || 0);
    });
    const total = Object.values(map).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(map)
      .map(([genre, ccu]) => ({
        genre,
        ccu,
        pct: Math.round((ccu / total) * 1000) / 10,
      }))
      .sort((a, b) => b.ccu - a.ccu);
  }, [metrics]);

  const handleModeChange = (mode: "leaderboard" | "breakout") => {
    setViewMode(mode);
    if (mode === "breakout") {
      setSortColumn("trend");
      setSortDirection("desc");
    } else {
      setSortColumn("ccu");
      setSortDirection("desc");
    }
  };

  const handleSort = (col: string) => {
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection("desc");
    }
  };

  const renderSortIndicator = (col: string) => {
    if (sortColumn !== col) {
      return <span className="opacity-30 ml-1 select-none">⇅</span>;
    }
    return (
      <span className="text-emerald-500 dark:text-emerald-400 ml-1 font-bold select-none">
        {sortDirection === "asc" ? "▲" : "▼"}
      </span>
    );
  };

  const processedMetrics = useMemo(() => {
    let list = [...metrics];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          (m.genre && m.genre.toLowerCase().includes(q)) ||
          String(m.universe_id).includes(q)
      );
    }

    // Genre filter
    if (selectedGenre !== "ALL") {
      list = list.filter((m) => m.genre === selectedGenre);
    }

    // Sorting
    list.sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "genre":
          comparison = (a.genre || "").localeCompare(b.genre || "");
          break;
        case "trend": {
          const aVal = a.ccu_pct_change ?? (a.prev_ccu === null ? 9999 : -9999);
          const bVal = b.ccu_pct_change ?? (b.prev_ccu === null ? 9999 : -9999);
          comparison = aVal - bVal;
          break;
        }
        case "visits":
          comparison = Number(a.visits || 0) - Number(b.visits || 0);
          break;
        case "approval": {
          const aTot = (Number(a.upvotes) || 0) + (Number(a.downvotes) || 0);
          const bTot = (Number(b.upvotes) || 0) + (Number(b.downvotes) || 0);
          const aRate = aTot > 0 ? (Number(a.upvotes) || 0) / aTot : -1;
          const bRate = bTot > 0 ? (Number(b.upvotes) || 0) / bTot : -1;
          comparison = aRate - bRate;
          break;
        }
        case "ccu":
        default:
          comparison = Number(a.ccu || 0) - Number(b.ccu || 0);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    // Row limit
    if (rowLimit !== "ALL") {
      list = list.slice(0, rowLimit);
    }

    return list;
  }, [
    metrics,
    searchQuery,
    selectedGenre,
    sortColumn,
    sortDirection,
    rowLimit,
  ]);

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
              <span>ROBLOX_TRENDS_CLI v2.4</span>
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
              run query --table games+metrics --view {viewMode} --genre {selectedGenre} --limit {rowLimit}
            </span>
            <span className="pixel-cursor text-emerald-500 font-black">▋</span>
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex flex-wrap gap-4 pt-1">
            <span>[DB: md:roblox_trends]</span>
            <span>[STATUS: ONLINE]</span>
            <span>[TOTAL_POOL: {metrics.length} GAMES]</span>
            <span>[CLUSTER_ENGINE: KMEANS_NLP]</span>
            <span>[SPARKLINE_TELEMETRY: ACTIVE]</span>
          </div>
        </div>

        {/* Inner Content Area */}
        <div className="p-4 sm:p-6 space-y-6 flex-1">
          {/* KPI Stat Blocks (Pixel Styled) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Stat 1: Total CCU */}
            <div className="border-2 border-zinc-900 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950/80 p-4 shadow-[4px_4px_0px_0px_#000] dark:shadow-[4px_4px_0px_0px_#27272a] relative">
              <div className="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
                <span>[01] // TOTAL_POOL_CCU</span>
                <span className="text-emerald-500">● LIVE</span>
              </div>
              <div className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                {loading ? "FETCHING..." : totalCCU.toLocaleString()}
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">
                Sum of active players across all tracked games
              </p>
            </div>

            {/* Stat 2: #1 Top Title */}
            <div className="border-2 border-zinc-900 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950/80 p-4 shadow-[4px_4px_0px_0px_#000] dark:shadow-[4px_4px_0px_0px_#27272a]">
              <div className="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
                <span>[02] // #1_TOP_TITLE</span>
                <span className="text-amber-500">👑 LEADER</span>
              </div>
              <div className="mt-2 text-base font-bold text-zinc-900 dark:text-zinc-100 truncate">
                {loading ? (
                  "LOADING..."
                ) : metrics[0]?.name ? (
                  <a
                    href={`https://www.roblox.com/discover/?Keyword=${encodeURIComponent(
                      metrics[0].name
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`View ${metrics[0].name} on Roblox`}
                    className="hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline inline-flex items-center gap-1 truncate"
                  >
                    <span className="truncate">{metrics[0].name}</span>
                    <span className="text-xs text-zinc-400">↗</span>
                  </a>
                ) : (
                  "N/A"
                )}
              </div>
              <p className="mt-1 text-[11px] text-zinc-500 truncate">
                {metrics[0]
                  ? `${Number(metrics[0].ccu).toLocaleString()} CCU | ${
                      metrics[0].genre || "Genre: N/A"
                    }`
                  : "No data available"}
              </p>
            </div>

            {/* Stat 3: Top Gainer / Rising Star */}
            <div className="border-2 border-zinc-900 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950/80 p-4 shadow-[4px_4px_0px_0px_#000] dark:shadow-[4px_4px_0px_0px_#27272a]">
              <div className="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
                <span>[03] // TOP_BREAKOUT</span>
                <span className="text-purple-500">🚀 SURGE</span>
              </div>
              <div className="mt-2 text-base font-bold text-purple-600 dark:text-purple-400 truncate">
                {loading ? (
                  "COMPUTING..."
                ) : topGainer ? (
                  <a
                    href={`https://www.roblox.com/discover/?Keyword=${encodeURIComponent(
                      topGainer.name
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline truncate inline-flex items-center gap-1"
                  >
                    <span className="truncate">{topGainer.name}</span>
                    <span className="text-xs">↗</span>
                  </a>
                ) : (
                  "STABLE / NO SURGE"
                )}
              </div>
              <p className="mt-1 text-[11px] text-zinc-500 truncate">
                {topGainer && topGainer.ccu_pct_change !== null
                  ? `+${topGainer.ccu_pct_change}% growth | ${Number(
                      topGainer.ccu
                    ).toLocaleString()} CCU`
                  : "Tracking historical deltas"}
              </p>
            </div>

            {/* Stat 4: Telemetry Stream */}
            <div className="border-2 border-zinc-900 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950/80 p-4 shadow-[4px_4px_0px_0px_#000] dark:shadow-[4px_4px_0px_0px_#27272a]">
              <div className="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
                <span>[04] // TELEMETRY_STREAM</span>
                <span className="text-cyan-500">⚡ ACTIVE</span>
              </div>
              <div className="mt-2 text-base font-bold text-zinc-800 dark:text-zinc-200">
                {loading ? "QUERYING..." : `${metrics.length} TITLES TRACKED`}
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">
                MotherDuck Cloud Warehouse synced
              </p>
            </div>
          </div>

          {/* Genre Market Share Visualizer Card */}
          <div className="border-2 border-zinc-900 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950/90 p-4 shadow-[4px_4px_0px_0px_#000] dark:shadow-[4px_4px_0px_0px_#27272a]">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-zinc-800 dark:text-zinc-200">
                <span>📊</span>
                <span>GENRE_MARKET_SHARE // CONCURRENT_PLAYER_DISTRIBUTION</span>
              </div>
              <button
                onClick={() => setShowMarketShare(!showMarketShare)}
                className="text-[11px] font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 uppercase"
              >
                {showMarketShare ? "[COLLAPSE -]" : "[EXPAND +]"}
              </button>
            </div>

            {showMarketShare && (
              <div className="space-y-2.5">
                {genreMarketShare.map((item) => {
                  const isSelected = selectedGenre === item.genre;
                  return (
                    <div
                      key={item.genre}
                      onClick={() =>
                        setSelectedGenre(isSelected ? "ALL" : item.genre)
                      }
                      title={`Click to filter by ${item.genre}`}
                      className="group cursor-pointer select-none"
                    >
                      <div className="flex items-center justify-between text-xs font-mono mb-1">
                        <span
                          className={`font-bold flex items-center gap-1.5 ${
                            isSelected
                              ? "text-emerald-600 dark:text-emerald-400 underline"
                              : "text-zinc-700 dark:text-zinc-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400"
                          }`}
                        >
                          <span>▶</span>
                          <span>{item.genre}</span>
                        </span>
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                          {item.ccu.toLocaleString()} CCU ({item.pct}%)
                        </span>
                      </div>
                      {/* Pixel Progress Bar */}
                      <div className="h-3 border border-zinc-900 dark:border-zinc-700 bg-zinc-200 dark:bg-zinc-800 overflow-hidden relative shadow-[1px_1px_0px_0px_#000] dark:shadow-[1px_1px_0px_0px_#3f3f46]">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isSelected
                              ? "bg-emerald-500"
                              : "bg-emerald-600 dark:bg-emerald-500 group-hover:bg-emerald-400"
                          }`}
                          style={{ width: `${Math.max(item.pct, 1.5)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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

          {/* Interactive Filter & Controls Console */}
          <div className="border-2 border-zinc-900 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800/90 p-3 sm:p-4 space-y-3 shadow-[4px_4px_0px_0px_#000] dark:shadow-[4px_4px_0px_0px_#27272a]">
            {/* Row 1: Search & Mode Switcher */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Terminal Search Input */}
              <div className="relative flex-1">
                <div className="flex items-center border-2 border-zinc-900 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-1.5 shadow-[2px_2px_0px_0px_#000] dark:shadow-[2px_2px_0px_0px_#3f3f46]">
                  <span className="text-emerald-500 font-bold mr-2 text-xs select-none">
                    &gt;
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="SEARCH GAME TITLE, GENRE, OR ID..."
                    className="w-full bg-transparent text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none font-mono"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="text-xs text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 font-bold uppercase ml-2"
                    >
                      [CLEAR]
                    </button>
                  )}
                </div>
              </div>

              {/* View Mode Tabs */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleModeChange("leaderboard")}
                  className={`px-3 py-1.5 text-xs font-bold uppercase border-2 transition-all shadow-[2px_2px_0px_0px_#000] dark:shadow-[2px_2px_0px_0px_#3f3f46] ${
                    viewMode === "leaderboard"
                      ? "border-zinc-900 bg-emerald-400 text-zinc-950 dark:border-emerald-400 dark:bg-emerald-500"
                      : "border-zinc-400 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200"
                  }`}
                >
                  🔥 LEADERBOARD
                </button>
                <button
                  onClick={() => handleModeChange("breakout")}
                  className={`px-3 py-1.5 text-xs font-bold uppercase border-2 transition-all shadow-[2px_2px_0px_0px_#000] dark:shadow-[2px_2px_0px_0px_#3f3f46] ${
                    viewMode === "breakout"
                      ? "border-zinc-900 bg-purple-400 text-zinc-950 dark:border-purple-400 dark:bg-purple-500"
                      : "border-zinc-400 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200"
                  }`}
                >
                  🚀 RISING STARS
                </button>
              </div>
            </div>

            {/* Row 2: Genre Filters & Limit Selector */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1 border-t border-zinc-200 dark:border-zinc-700/80">
              {/* Genre Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
                <span className="font-bold uppercase text-[11px] text-zinc-500 dark:text-zinc-400 mr-1 select-none">
                  GENRE:
                </span>
                {availableGenres.map((genre) => (
                  <button
                    key={genre}
                    onClick={() => setSelectedGenre(genre)}
                    className={`whitespace-nowrap px-2 py-0.5 text-[11px] font-bold border uppercase transition-all ${
                      selectedGenre === genre
                        ? "border-emerald-600 bg-emerald-500 text-zinc-950 dark:border-emerald-400 dark:bg-emerald-400 shadow-[1px_1px_0px_0px_#000]"
                        : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {genre === "ALL" ? "ALL GENRES" : genre}
                  </button>
                ))}
              </div>

              {/* Rows Limit Selector */}
              <div className="flex items-center gap-1.5 text-xs self-end md:self-auto">
                <span className="font-bold uppercase text-[11px] text-zinc-500 dark:text-zinc-400 mr-1 select-none">
                  ROWS:
                </span>
                {([10, 25, 50, "ALL"] as const).map((limit) => (
                  <button
                    key={limit}
                    onClick={() => setRowLimit(limit)}
                    className={`px-2 py-0.5 text-[11px] font-bold border transition-all ${
                      rowLimit === limit
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-300 dark:bg-zinc-100 dark:text-zinc-950 shadow-[1px_1px_0px_0px_#000]"
                        : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200"
                    }`}
                  >
                    {limit}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table Container (Chunky Pixel Window) */}
          <div className="border-2 border-zinc-900 dark:border-zinc-700 bg-white dark:bg-zinc-950 shadow-[5px_5px_0px_0px_#000] dark:shadow-[5px_5px_0px_0px_#27272a] overflow-hidden">
            {/* Table Header Bar */}
            <div className="border-b-2 border-zinc-900 dark:border-zinc-700 bg-zinc-200 dark:bg-zinc-800 px-4 py-2.5 flex items-center justify-between text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase">
              <div className="flex items-center gap-2">
                <span>{viewMode === "leaderboard" ? "📊" : "🚀"}</span>
                <span>
                  {viewMode === "leaderboard"
                    ? "LEADERBOARD // TOP_CONCURRENT_PLAYERS"
                    : "RISING STARS // RAPID_MOMENTUM_BREAKOUTS"}
                </span>
                {selectedGenre !== "ALL" && (
                  <span className="text-emerald-700 dark:text-emerald-400 text-[11px]">
                    [GENRE: {selectedGenre}]
                  </span>
                )}
              </div>
              <span className="text-[11px] font-normal text-zinc-600 dark:text-zinc-400">
                DISPLAYING: {processedMetrics.length} / {metrics.length} GAMES
              </span>
            </div>

            {/* Scrollable Data Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-zinc-900 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900/90 text-zinc-700 dark:text-zinc-300 font-bold uppercase tracking-wider select-none">
                    <th className="py-3 px-3 w-14 text-center border-r border-zinc-300 dark:border-zinc-800">
                      RANK
                    </th>
                    <th
                      onClick={() => handleSort("name")}
                      className="py-3 px-4 border-r border-zinc-300 dark:border-zinc-800 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span>GAME TITLE</span>
                        {renderSortIndicator("name")}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("genre")}
                      className="py-3 px-4 border-r border-zinc-300 dark:border-zinc-800 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span>GENRE</span>
                        {renderSortIndicator("genre")}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("ccu")}
                      className="py-3 px-4 text-right border-r border-zinc-300 dark:border-zinc-800 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <div className="flex items-center justify-end">
                        <span>CCU</span>
                        {renderSortIndicator("ccu")}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("trend")}
                      className="py-3 px-4 text-center border-r border-zinc-300 dark:border-zinc-800 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <div className="flex items-center justify-center">
                        <span>TREND & TRAJECTORY</span>
                        {renderSortIndicator("trend")}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("visits")}
                      className="py-3 px-4 text-right border-r border-zinc-300 dark:border-zinc-800 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <div className="flex items-center justify-end">
                        <span>VISITS</span>
                        {renderSortIndicator("visits")}
                      </div>
                    </th>
                    <th className="py-3 px-4 text-right border-r border-zinc-300 dark:border-zinc-800">
                      UPVOTES
                    </th>
                    <th className="py-3 px-4 text-right border-r border-zinc-300 dark:border-zinc-800">
                      DOWNVOTES
                    </th>
                    <th
                      onClick={() => handleSort("approval")}
                      className="py-3 px-4 text-right border-r border-zinc-300 dark:border-zinc-800 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <div className="flex items-center justify-end">
                        <span>APPROVAL</span>
                        {renderSortIndicator("approval")}
                      </div>
                    </th>
                    <th className="py-3 px-4 text-right">
                      SNAPSHOT
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
                        <td className="py-3.5 px-4 text-center border-r border-zinc-200 dark:border-zinc-800">
                          <div className="h-4 w-24 bg-zinc-300 dark:bg-zinc-800 mx-auto" />
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
                  ) : processedMetrics.length === 0 ? (
                    <tr>
                      <td
                        colSpan={10}
                        className="py-12 text-center text-zinc-500 font-mono"
                      >
                        [NO_MATCHING_RECORDS_FOUND]
                      </td>
                    </tr>
                  ) : (
                    processedMetrics.map((game, idx) => {
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

                      const pct = game.ccu_pct_change;

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

                          {/* Game Title with Direct Roblox Link */}
                          <td className="py-3 px-4 border-r border-zinc-200 dark:border-zinc-800/80">
                            <a
                              href={`https://www.roblox.com/discover/?Keyword=${encodeURIComponent(
                                game.name
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`Play ${game.name} on Roblox`}
                              className="group inline-flex items-center gap-1 font-bold text-zinc-950 dark:text-zinc-100 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                            >
                              <span className="group-hover:underline underline-offset-2">
                                {game.name}
                              </span>
                              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 group-hover:text-emerald-500 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 inline-block">
                                ↗
                              </span>
                            </a>
                            <div className="text-[10px] text-zinc-500 dark:text-zinc-500 font-mono mt-0.5 flex items-center gap-2">
                              <span>ID: {String(game.universe_id)}</span>
                              <span>•</span>
                              <a
                                href={`https://www.roblox.com/discover/?Keyword=${encodeURIComponent(
                                  game.name
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[9px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 hover:underline font-bold"
                              >
                                [PLAY ↗]
                              </a>
                            </div>
                          </td>

                          {/* Stylized Pixel Genre Badge (Clickable to Filter) */}
                          <td className="py-3 px-4 border-r border-zinc-200 dark:border-zinc-800/80 whitespace-nowrap">
                            <button
                              onClick={() => setSelectedGenre(game.genre || "Unclassified")}
                              title={`Filter by genre: ${game.genre || "Unclassified"}`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 border border-zinc-800 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800/90 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-[11px] font-bold shadow-[2px_2px_0px_0px_#000] dark:shadow-[2px_2px_0px_0px_#3f3f46] transition-all"
                            >
                              <span className="text-emerald-500">▶</span>
                              <span>{game.genre || "UNCLASSIFIED"}</span>
                            </button>
                          </td>

                          {/* CCU */}
                          <td className="py-3 px-4 text-right border-r border-zinc-200 dark:border-zinc-800/80 whitespace-nowrap">
                            <span className="inline-block px-2 py-0.5 border border-emerald-600 dark:border-emerald-500 bg-emerald-100 text-emerald-950 dark:bg-emerald-950/80 dark:text-emerald-300 font-black text-xs shadow-[2px_2px_0px_0px_#059669]">
                              {Number(game.ccu).toLocaleString()} CCU
                            </span>
                          </td>

                          {/* Trend & Trajectory Sparkline */}
                          <td className="py-3 px-4 text-center border-r border-zinc-200 dark:border-zinc-800/80 whitespace-nowrap">
                            <div className="flex items-center justify-center gap-2">
                              <Sparkline
                                data={game.ccu_history}
                                isUp={
                                  pct === null || pct === undefined
                                    ? null
                                    : pct > 0
                                    ? true
                                    : pct < 0
                                    ? false
                                    : null
                                }
                              />
                              {pct === null || pct === undefined ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 border border-cyan-600 dark:border-cyan-500 bg-cyan-100 text-cyan-950 dark:bg-cyan-950/80 dark:text-cyan-300 font-bold text-[10px] shadow-[1px_1px_0px_0px_#0891b2]">
                                  ★ NEW
                                </span>
                              ) : pct > 0 ? (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 border border-emerald-600 dark:border-emerald-500 bg-emerald-100 text-emerald-950 dark:bg-emerald-950/80 dark:text-emerald-300 font-bold text-[10px] shadow-[1px_1px_0px_0px_#059669]">
                                  <span>+{pct}%</span>
                                  <span>▲</span>
                                </span>
                              ) : pct < 0 ? (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 border border-rose-600 dark:border-rose-500 bg-rose-100 text-rose-950 dark:bg-rose-950/80 dark:text-rose-300 font-bold text-[10px] shadow-[1px_1px_0px_0px_#e11d48]">
                                  <span>{pct}%</span>
                                  <span>▼</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 border border-zinc-400 dark:border-zinc-700 bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 font-bold text-[10px]">
                                  0.0% ━
                                </span>
                              )}
                            </div>
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
