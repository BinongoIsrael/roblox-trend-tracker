"""NLP and KMeans clustering pipeline for Roblox game trends and sub-genre analysis."""

import argparse
from dataclasses import dataclass
from pathlib import Path
import re
import sys
from typing import Any, List, Optional, Tuple
import duckdb
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS, TfidfVectorizer
from sklearn.metrics import silhouette_score

# Ensure clean UTF-8 console output on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

DEFAULT_DB_PATH = Path(__file__).resolve().parent / "roblox_trends.duckdb"


@dataclass
class ClusterSummary:
    cluster_id: int
    label: str
    top_keywords: List[str]
    game_count: int
    total_ccu: int
    avg_ccu: float
    player_share_pct: float
    top_games: List[Tuple[int, str, int]]  # (universe_id, name, ccu)


def load_data_from_duckdb(db_path: Path) -> pd.DataFrame:
    """Loads games and their latest CCU snapshot from DuckDB into a DataFrame."""
    if not db_path.exists():
        raise FileNotFoundError(
            f"Database file '{db_path}' not found. Please run init_db.py and scraper.py first."
        )

    query = """
        SELECT 
            g.universe_id,
            g.name,
            g.description,
            COALESCE(ARG_MAX(m.ccu, m.timestamp), 0) AS ccu
        FROM games g
        LEFT JOIN metrics m ON g.universe_id = m.universe_id
        GROUP BY g.universe_id, g.name, g.description;
    """
    with duckdb.connect(str(db_path), read_only=True) as con:
        df = con.execute(query).df()

    return df


def preprocess_text(name: Any, description: Any) -> str:
    """Combines name and description, lowercases, removes punctuation/emojis and stop words."""
    name_str = str(name) if pd.notna(name) else ""
    desc_str = str(description) if pd.notna(description) else ""
    combined = f"{name_str} {desc_str}".lower()

    # Strip punctuation, symbols, numbers, and emojis
    cleaned = re.sub(r"[^a-zA-Z\s]", " ", combined)

    # Filter out standard English stop words and single-character tokens
    tokens = [
        word
        for word in cleaned.split()
        if word not in ENGLISH_STOP_WORDS and len(word) > 1
    ]
    return " ".join(tokens)


def determine_optimal_k(
    tfidf_matrix: Any, min_k: int = 3, max_k: int = 7
) -> Tuple[int, dict]:
    """Finds the optimal number of clusters based on silhouette scores."""
    scores = {}
    best_k = min_k
    best_score = -1.0

    print("\n--- Evaluating Silhouette Scores for Cluster Tuning ---")
    for k in range(min_k, min(max_k + 1, tfidf_matrix.shape[0])):
        km = KMeans(n_clusters=k, random_state=42, n_init=10)
        labels = km.fit_predict(tfidf_matrix)
        score = float(silhouette_score(tfidf_matrix, labels))
        scores[k] = score
        marker = " *" if score > best_score else ""
        print(f"  k = {k}: Silhouette Score = {score:.4f}{marker}")
        if score > best_score:
            best_score = score
            best_k = k

    print(f"Optimal cluster count selected: k = {best_k} (score: {best_score:.4f})\n")
    return best_k, scores


def analyze_clusters(
    df: pd.DataFrame,
    kmeans_model: KMeans,
    feature_names: np.ndarray,
) -> List[ClusterSummary]:
    """Computes cluster metrics, top TF-IDF keywords, and top games per cluster."""
    total_active_ccu = int(df["ccu"].sum())
    cluster_centers = kmeans_model.cluster_centers_
    summaries: List[ClusterSummary] = []

    for cluster_id in range(kmeans_model.n_clusters):
        # Extract top 5 TF-IDF terms from the cluster centroid
        centroid = cluster_centers[cluster_id]
        top_keyword_indices = centroid.argsort()[::-1][:5]
        top_keywords = [str(feature_names[i]) for i in top_keyword_indices]
        label = " / ".join(top_keywords[:3]).title()

        # Subset dataframe for this cluster
        cluster_df = df[df["cluster"] == cluster_id]
        game_count = len(cluster_df)
        total_ccu = int(cluster_df["ccu"].sum())
        avg_ccu = float(cluster_df["ccu"].mean()) if game_count > 0 else 0.0
        share_pct = (
            (total_ccu / total_active_ccu * 100.0) if total_active_ccu > 0 else 0.0
        )

        # Top 3 games by latest CCU
        top_3 = (
            cluster_df.sort_values(by="ccu", ascending=False)
            .head(3)[["universe_id", "name", "ccu"]]
            .values.tolist()
        )
        top_games = [(int(row[0]), str(row[1]), int(row[2])) for row in top_3]

        summaries.append(
            ClusterSummary(
                cluster_id=cluster_id,
                label=label,
                top_keywords=top_keywords,
                game_count=game_count,
                total_ccu=total_ccu,
                avg_ccu=avg_ccu,
                player_share_pct=share_pct,
                top_games=top_games,
            )
        )

    # Rank clusters by total player share descending
    summaries.sort(key=lambda s: s.total_ccu, reverse=True)
    return summaries


def print_clustering_report(
    summaries: List[ClusterSummary],
    total_games: int,
    total_ccu: int,
) -> None:
    """Prints a formatted summary table and detailed cluster profiles."""
    print("=" * 100)
    print("           ROBLOX TRENDING SUB-GENRE CLUSTERING & MARKET SHARE ANALYSIS")
    print("=" * 100)
    print(f"Analyzed Games: {total_games} | Total Tracked CCU: {total_ccu:,}\n")

    # Formatted Summary Table
    print("SUB-GENRE MARKET SHARE RANKING")
    header = (
        f"{'Rank':<5} {'ID':<4} {'Sub-Genre Label':<28} "
        f"{'Games':<7} {'Total CCU':<12} {'Share (%)':<11} {'Avg CCU/Game':<12}"
    )
    print("-" * len(header))
    print(header)
    print("-" * len(header))

    for rank, s in enumerate(summaries, start=1):
        print(
            f"{rank:<5} {s.cluster_id:<4} {s.label:<28} "
            f"{s.game_count:<7} {s.total_ccu:<12,} {s.player_share_pct:>6.2f}%    {s.avg_ccu:>10,.1f}"
        )
    print("-" * len(header))

    # Detailed Cluster Profiles
    print("\nDETAILED SUB-GENRE PROFILES & TOP TITLES")
    print("=" * 100)
    for rank, s in enumerate(summaries, start=1):
        keywords_str = ", ".join(f"'{kw}'" for kw in s.top_keywords)
        print(f"\n[Rank #{rank}] Cluster {s.cluster_id}: {s.label}")
        print(f"  • Representative Keywords: {keywords_str}")
        print(
            f"  • Size & Activity:        {s.game_count} games | {s.total_ccu:,} total CCU "
            f"({s.player_share_pct:.2f}% share) | {s.avg_ccu:,.1f} avg CCU"
        )
        print("  • Top 3 Games:")
        for g_rank, (uid, gname, gccu) in enumerate(s.top_games, start=1):
            clean_name = (gname[:40] + "...") if len(gname) > 43 else gname
            print(f"     {g_rank}. {clean_name:<45} (CCU: {gccu:,} | ID: {uid})")
    print("\n" + "=" * 100 + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Cluster Roblox trending games by sub-genre using NLP & KMeans."
    )
    parser.add_argument(
        "--db",
        type=Path,
        default=DEFAULT_DB_PATH,
        help="Path to the roblox_trends.duckdb database file.",
    )
    parser.add_argument(
        "--k",
        type=int,
        default=None,
        help="Number of clusters (default: automatically selected via silhouette score).",
    )
    args = parser.parse_args()

    # Step 1: Load Data
    print(f"Loading game records from DuckDB: {args.db.name}...")
    df = load_data_from_duckdb(args.db)
    if df.empty:
        print("No games found in the database. Please run scraper.py first.")
        return
    print(f"Loaded {len(df)} game records with latest CCU metrics.")

    # Step 2: Preprocess Text
    print("Preprocessing game titles and descriptions (cleaning, stop-word removal)...")
    df["clean_text"] = df.apply(
        lambda r: preprocess_text(r["name"], r["description"]), axis=1
    )

    # Step 3: TF-IDF Vectorization
    print("Vectorizing text corpus with TfidfVectorizer (max_features=100, ngram_range=(1,2))...")
    vectorizer = TfidfVectorizer(
        max_features=100,
        ngram_range=(1, 2),
        stop_words="english",
    )
    tfidf_matrix = vectorizer.fit_transform(df["clean_text"])
    feature_names = np.array(vectorizer.get_feature_names_out())

    # Step 4: KMeans Clustering
    if args.k is not None:
        k = args.k
        print(f"Using user-specified cluster count: k = {k}")
    else:
        k, _ = determine_optimal_k(tfidf_matrix, min_k=3, max_k=7)

    kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
    df["cluster"] = kmeans.fit_predict(tfidf_matrix)

    # Step 5: Analyze and Print Report
    summaries = analyze_clusters(df, kmeans, feature_names)
    total_active_ccu = int(df["ccu"].sum())
    print_clustering_report(summaries, len(df), total_active_ccu)


if __name__ == "__main__":
    main()
