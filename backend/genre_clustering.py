"""NLP and KMeans clustering pipeline for Roblox game trends and sub-genre analysis."""

import argparse
from dataclasses import dataclass
import os
from pathlib import Path
import re
import sys
from typing import Any, List, Optional, Set, Tuple
from dotenv import load_dotenv
import duckdb

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
load_dotenv('../.env')
load_dotenv()
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS, TfidfVectorizer
from sklearn.metrics import silhouette_score

# Ensure clean UTF-8 console output on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

DEFAULT_DB_PATH = Path(__file__).resolve().parent / "roblox_trends.duckdb"

# Custom stop-word list filtering out generic Roblox terms and filler noise
ROBLOX_STOP_WORDS: Set[str] = {
    # Mandatory terms from user specification
    "game", "play", "player", "players", "new", "update", "like", "likes",
    "favorite", "leave", "join", "group", "time", "experience", "code",
    "codes", "free", "beta", "alpha", "release", "build",
    
    # Common variations and generic Roblox/meta terms
    "games", "gaming", "played", "playing", "updates", "updated", "upd",
    "favorited", "favorites", "leaving", "joining", "joined", "groups",
    "times", "experiences", "releases", "released", "building", "builder",
    "builders", "follow", "following", "follows", "follower", "followers",
    "thumb", "thumbs", "thumbsup", "server", "servers", "vip", "shutdown",
    "rejoin", "reward", "rewards", "badge", "badges", "enjoy", "welcome",
    "world", "item", "items", "buy", "shop", "store", "bonus", "daily",
    "click", "clicking", "mobile", "pc", "console", "xbox", "playstation",
    "tablet", "desktop", "device", "devices", "controls", "supports", "tags",
    "link", "links", "discord", "twitter", "youtube", "social", "subscribe",
    "channel", "credits", "rules", "help", "tips", "info", "information",
    "developer", "developers", "dev", "devs", "studio", "studios", "team",
    "member", "members", "community", "fan", "fans", "official", "thank",
    "thanks", "everyone", "robux", "event", "events", "notes", "log", "patch",
    "fixes", "fixed", "bug", "bugs", "glitch", "glitches", "version", "soon",
    "coming", "friends", "friend", "press", "button", "buttons", "wait",
    "need", "want", "good", "best", "great", "awesome", "cool", "super",
    "mega", "ultra", "check", "make", "use", "using", "way", "fun", "start",
    "place", "explore", "open", "unlock", "development", "inspired", "just",
    "don", "ve", "ll", "re", "exclusive", "ultimate", "content", "different",
    "special", "level", "levels", "tap", "tapping"
}

CUSTOM_STOP_WORDS: Set[str] = set(ENGLISH_STOP_WORDS).union(ROBLOX_STOP_WORDS)

# Priority gameplay keywords to surface for cluster names and genre labeling
GAMEPLAY_KEYWORDS: Set[str] = {
    # Key gameplay genres specified in prompt
    "simulator", "tycoon", "obby", "rpg", "fps", "roleplay", "pvp",
    "survival", "pets", "anime", "horror",
    
    # Additional actual gameplay keywords and mechanics
    "survive", "pet", "scary", "rp", "shooter", "fighting", "fight",
    "battle", "escape", "racing", "adventure", "action", "strategy",
    "defense", "tower defense", "puzzle", "mystery", "parkour", "stealth",
    "sandbox", "sports", "combat", "boss", "tactical", "weapons", "guns",
    "magic", "sword", "swords", "speed", "climb", "duels", "arena",
    "steal", "hatch", "coins", "multiplayer", "zombie", "zombies",
    "dungeon", "quest", "drive", "driving", "cars", "car"
}

# Standard gaming acronyms to format in all-caps in cluster labels
ACRONYMS: Set[str] = {"fps", "pvp", "rpg", "rp", "pve"}


def format_keyword(kw: str) -> str:
    """Formats a keyword for cluster label display, preserving standard acronyms."""
    words = kw.split()
    formatted = [w.upper() if w.lower() in ACRONYMS else w.title() for w in words]
    return " ".join(formatted)


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


def load_data_from_duckdb(db_path: Optional[Any] = None) -> pd.DataFrame:
    """Loads games and their latest CCU snapshot from DuckDB/MotherDuck into a DataFrame."""
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
    token = os.environ.get("MOTHERDUCK_TOKEN")
    connection_str = (
        f"md:roblox_trends?motherduck_token={token}"
        if token
        else str(db_path or DEFAULT_DB_PATH)
    )
    with duckdb.connect(connection_str) as con:
        df = con.execute(query).df()

    return df


def preprocess_text(name: Any, description: Any) -> str:
    """Combines name and description, lowercases, cleans symbols, removes stop words,
    and boosts gameplay keywords and title tokens to emphasize genre signals."""
    name_str = str(name).lower() if pd.notna(name) else ""
    desc_str = str(description).lower() if pd.notna(description) else ""

    cleaned_all = re.sub(r"[^a-zA-Z\s]", " ", f"{name_str} {desc_str}")
    tokens: List[str] = []
    boost_tokens: List[str] = []

    for word in cleaned_all.split():
        if len(word) <= 1 or word in CUSTOM_STOP_WORDS:
            continue
        tokens.append(word)
        if word in GAMEPLAY_KEYWORDS:
            boost_tokens.append(word)

    # Game titles have high signal for sub-genre, so emphasize title tokens
    cleaned_name = re.sub(r"[^a-zA-Z\s]", " ", name_str)
    for word in cleaned_name.split():
        if len(word) > 1 and word not in CUSTOM_STOP_WORDS:
            boost_tokens.append(word)

    return " ".join(tokens + boost_tokens)


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
    """Computes cluster metrics, top TF-IDF keywords, and top games per cluster,
    prioritizing actual gameplay keywords for cluster names."""
    total_active_ccu = int(df["ccu"].sum())
    cluster_centers = kmeans_model.cluster_centers_
    summaries: List[ClusterSummary] = []

    for cluster_id in range(kmeans_model.n_clusters):
        # Extract candidate terms from cluster centroid
        centroid = cluster_centers[cluster_id]
        top_candidate_indices = centroid.argsort()[::-1][:25]
        candidate_terms = [str(feature_names[i]) for i in top_candidate_indices]

        # Prioritize actual gameplay keywords for cluster naming
        gameplay_terms: List[str] = []
        general_terms: List[str] = []

        for term in candidate_terms:
            parts = term.split()
            # Skip duplicated n-grams like "speed speed"
            if len(parts) == 2 and parts[0] == parts[1]:
                continue
            is_gameplay = bool(set(parts).intersection(GAMEPLAY_KEYWORDS)) or any(
                gk in term for gk in GAMEPLAY_KEYWORDS
            )
            if is_gameplay:
                if term not in gameplay_terms:
                    gameplay_terms.append(term)
            else:
                if term not in general_terms:
                    general_terms.append(term)

        ordered_terms = gameplay_terms + general_terms
        top_keywords = ordered_terms[:5]

        # Format label with uppercase acronyms (RP, FPS, PVP, RPG)
        formatted_label_terms = [format_keyword(term) for term in top_keywords[:3]]
        label = " / ".join(formatted_label_terms)

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
        f"{'Rank':<5} {'ID':<4} {'Sub-Genre Label':<32} "
        f"{'Games':<7} {'Total CCU':<12} {'Share (%)':<11} {'Avg CCU/Game':<12}"
    )
    print("-" * len(header))
    print(header)
    print("-" * len(header))

    for rank, s in enumerate(summaries, start=1):
        print(
            f"{rank:<5} {s.cluster_id:<4} {s.label:<32} "
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


def save_clusters_to_duckdb(df: pd.DataFrame, db_path: Optional[Any] = None) -> None:
    """Overwrites the genre assignments (cluster_label) in MotherDuck and local DuckDB."""
    token = os.environ.get("MOTHERDUCK_TOKEN")
    update_data = df[["universe_id", "cluster_label"]].copy()

    # 1. Update MotherDuck if token is available
    if token:
        md_url = f"md:roblox_trends?motherduck_token={token}"
        print("Connecting to MotherDuck database to overwrite genre assignments...")
        with duckdb.connect(md_url) as con:
            con.execute("ALTER TABLE games ADD COLUMN IF NOT EXISTS cluster_label VARCHAR;")
            try:
                con.register("cluster_updates_df", update_data)
                con.execute(
                    """
                    UPDATE games 
                    SET cluster_label = cluster_updates_df.cluster_label 
                    FROM cluster_updates_df 
                    WHERE games.universe_id = cluster_updates_df.universe_id;
                    """
                )
            except Exception:
                con.executemany(
                    "UPDATE games SET cluster_label = ? WHERE universe_id = ?;",
                    update_data.values.tolist(),
                )
            count = con.execute(
                "SELECT COUNT(cluster_label) FROM games WHERE cluster_label IS NOT NULL;"
            ).fetchone()[0]
            print(f"Successfully updated MotherDuck: {count} games updated with new genre labels.")
    else:
        print("Warning: MOTHERDUCK_TOKEN not found in environment. MotherDuck update skipped.")

    # 2. Also update local duckdb file if it exists or if db_path specified
    local_path = Path(db_path) if db_path else DEFAULT_DB_PATH
    if local_path.exists():
        try:
            with duckdb.connect(str(local_path)) as con:
                con.execute("ALTER TABLE games ADD COLUMN IF NOT EXISTS cluster_label VARCHAR;")
                con.register("cluster_updates_df", update_data)
                con.execute(
                    """
                    UPDATE games 
                    SET cluster_label = cluster_updates_df.cluster_label 
                    FROM cluster_updates_df 
                    WHERE games.universe_id = cluster_updates_df.universe_id;
                    """
                )
                print(f"Successfully updated local DuckDB ({local_path.name}) with new genre labels.")
        except Exception as e:
            print(f"Note: Local DuckDB update skipped ({e}).")


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
    print("Loading game records from DuckDB: roblox_trends...")
    df = load_data_from_duckdb(args.db)
    if df.empty:
        print("No games found in the database. Please run scraper.py first.")
        return
    print(f"Loaded {len(df)} game records with latest CCU metrics.")

    # Step 2: Preprocess Text
    print("Preprocessing game titles and descriptions with custom stop-words and genre boosting...")
    df["clean_text"] = df.apply(
        lambda r: preprocess_text(r["name"], r["description"]), axis=1
    )

    # Step 3: TF-IDF Vectorization
    print("Vectorizing text corpus with TfidfVectorizer (max_features=200, ngram_range=(1,2))...")
    vectorizer = TfidfVectorizer(
        max_features=200,
        ngram_range=(1, 2),
        stop_words=list(CUSTOM_STOP_WORDS),
        min_df=2,
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

    # Step 6: Overwrite genre assignments in MotherDuck database
    cluster_labels = {s.cluster_id: s.label for s in summaries}
    df["cluster_label"] = df["cluster"].map(cluster_labels)
    save_clusters_to_duckdb(df, args.db)


if __name__ == "__main__":
    main()
