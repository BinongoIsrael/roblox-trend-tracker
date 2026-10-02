"""Initialize and verify DuckDB schema for the Roblox trend tracker pipeline."""

from pathlib import Path
import duckdb

DB_PATH = Path(__file__).resolve().parent / "roblox_trends.duckdb"


def init_database(db_path: Path = DB_PATH) -> None:
    """Creates the tables and constraints in the DuckDB database."""
    print(f"Connecting to database: {db_path.name}...")
    with duckdb.connect(str(db_path)) as con:
        # Create games table
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS games (
                universe_id BIGINT PRIMARY KEY,
                name VARCHAR,
                description VARCHAR,
                created_at TIMESTAMP,
                game_updated_at TIMESTAMP
            );
            """
        )

        # Create metrics table with foreign key reference
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS metrics (
                universe_id BIGINT,
                timestamp TIMESTAMP,
                ccu INTEGER,
                visits BIGINT,
                upvotes INTEGER,
                downvotes INTEGER,
                FOREIGN KEY (universe_id) REFERENCES games(universe_id)
            );
            """
        )
    print("Database tables created successfully.")


def verify_schema(db_path: Path = DB_PATH) -> None:
    """Verifies and displays table schemas and constraints from DuckDB."""
    print("\n--- Verifying Schema ---")
    with duckdb.connect(str(db_path), read_only=True) as con:
        tables = [row[0] for row in con.execute("SHOW TABLES;").fetchall()]
        print(f"Existing tables: {tables}")

        for table in ["games", "metrics"]:
            print(f"\n[Schema: {table}]")
            schema_info = con.execute(f"DESCRIBE {table};").fetchall()
            header = f"{'Column Name':<20} {'Type':<15} {'Nullable':<10} {'Key':<10}"
            print(header)
            print("-" * len(header))
            for col_name, col_type, nullable, key, default, extra in schema_info:
                print(f"{col_name:<20} {col_type:<15} {nullable:<10} {str(key or ''):<10}")

        print("\n[Constraints]")
        constraints = con.execute(
            """
            SELECT table_name, constraint_type, constraint_text
            FROM duckdb_constraints();
            """
        ).fetchall()
        c_header = f"{'Table':<15} {'Constraint Type':<20} {'Definition':<45}"
        print(c_header)
        print("-" * len(c_header))
        for table_name, c_type, c_def in constraints:
            print(f"{table_name:<15} {c_type:<20} {c_def:<45}")


if __name__ == "__main__":
    init_database()
    verify_schema()
