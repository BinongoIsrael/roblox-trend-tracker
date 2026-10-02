"""Schema migration and K-Means sub-genre label update for Roblox games in DuckDB."""

from pathlib import Path
import re
import sys
from typing import Any
import duckdb
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS, TfidfVectorizer
from sklearn.metrics import silhouette_score

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

DB_PATH = Path(__file__).resolve().parent / "roblox_trends.duckdb"


def preprocess_text(name: Any, description: Any) -> str:
    """Cleans title and description: lowercase, strips punctuation/emojis, removes stop words."""
    name_str = str(name) if pd.notna(name) else ""
    desc_str = str(description) if pd.notna(description) else ""
    combined = f"{name_str} {desc_str}".lower()

    # Strip punctuation, non-alphabetic chars, and emojis
    cleaned = re.sub(r"[^a-zA-Z\s]", " ", combined)

    # Filter out English stop words and single-character noise
    tokens = [
        word
        for word in cleaned.split()
        if word not in ENGLISH_STOP_WORDS and len(word) > 1
    ]
    return " ".join(tokens)


def update_database_schema_and_clusters(db_path: Path = DB_PATH) -> None:
    """Adds cluster_label column to games table and populates it via K-Means clustering."""
    if not db_path.exists():
        raise FileNotFoundError(f"Database '{db_path.name}' does not exist.")

    print(f"Connecting to database: {db_path.name}...")
    with duckdb.connect(str(db_path)) as con:
        # Step 1: Add cluster_label column if it doesn't already exist
        print("Checking/adding 'cluster_label' column in 'games' table...")
        con.execute("ALTER TABLE games ADD COLUMN IF NOT EXISTS cluster_label VARCHAR;")
        print("Column 'cluster_label' verified.")

        # Step 2: Fetch games for clustering
        df = con.execute(
            "SELECT universe_id, name, description FROM games;"
        ).df()
        if df.empty:
            print("No games found in the database. Please run scraper.py first.")
            return

        print(f"Loaded {len(df)} games for text clustering.")

        # Step 3: Text Preprocessing
        df["clean_text"] = df.apply(
            lambda r: preprocess_text(r["name"], r["description"]), axis=1
        )

        # Step 4: TF-IDF Vectorization
        print("Vectorizing text with TfidfVectorizer (max_features=100, ngram_range=(1,2))...")
        vectorizer = TfidfVectorizer(
            max_features=100,
            ngram_range=(1, 2),
            stop_words="english",
        )
        tfidf_matrix = vectorizer.fit_transform(df["clean_text"])
        feature_names = np.array(vectorizer.get_feature_names_out())

        # Step 5: K-Means Clustering (find best k or default to 5)
        best_k = 5
        best_score = -1.0
        for k_cand in range(3, min(8, len(df))):
            km_cand = KMeans(n_clusters=k_cand, random_state=42, n_init=10)
            cand_labels = km_cand.fit_predict(tfidf_matrix)
            score = float(silhouette_score(tfidf_matrix, cand_labels))
            if score > best_score:
                best_score = score
                best_k = k_cand

        print(f"Applying K-Means with optimal k = {best_k} (silhouette score: {best_score:.4f})...")
        kmeans = KMeans(n_clusters=best_k, random_state=42, n_init=10)
        df["cluster_id"] = kmeans.fit_predict(tfidf_matrix)

        # Generate descriptive labels from top 3 keywords of each cluster centroid
        cluster_labels = {}
        for c in range(best_k):
            centroid = kmeans.cluster_centers_[c]
            top_indices = centroid.argsort()[::-1][:3]
            top_words = [str(feature_names[i]) for i in top_indices]
            cluster_labels[c] = " / ".join(top_words).title()

        df["cluster_label"] = df["cluster_id"].map(cluster_labels)

        # Step 6: Update database with cluster labels
        print("Updating 'cluster_label' for all games in DuckDB...")
        con.executemany(
            "UPDATE games SET cluster_label = ? WHERE universe_id = ?;",
            df[["cluster_label", "universe_id"]].values.tolist(),
        )
        print("Successfully updated cluster labels.")

        # Step 7: Verify schema and data
        print("\n--- Verification Summary ---")
        summary_df = con.execute("""
            SELECT 
                cluster_label, 
                COUNT(*) AS game_count
            FROM games 
            GROUP BY cluster_label 
            ORDER BY game_count DESC;
        """).df()
        print(summary_df.to_string(index=False))

        total_games = con.execute("SELECT COUNT(*) FROM games;").fetchone()[0]
        labeled_games = con.execute("SELECT COUNT(cluster_label) FROM games;").fetchone()[0]
        print(f"\nTotal Games: {total_games} | Labeled Games: {labeled_games}")


if __name__ == "__main__":
    update_database_schema_and_clusters()
