"""Schema migration and K-Means sub-genre label update for Roblox games in DuckDB."""

from pathlib import Path
from typing import Any, Optional
from genre_clustering import (
    DEFAULT_DB_PATH,
    CUSTOM_STOP_WORDS,
    GAMEPLAY_KEYWORDS,
    ROBLOX_STOP_WORDS,
    main as run_clustering,
    preprocess_text,
)


def update_database_schema_and_clusters(db_path: Optional[Any] = None) -> None:
    """Ensures games table has cluster_label and updates genre assignments via genre_clustering."""
    run_clustering()


if __name__ == "__main__":
    update_database_schema_and_clusters()
