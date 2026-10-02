"""Streamlit analytics dashboard for Roblox game trends, genre clustering, and time-series CCU tracking."""

from pathlib import Path
import duckdb
import pandas as pd
import plotly.express as px
import streamlit as st

# Configure wide layout
st.set_page_config(
    page_title="Roblox Trend Tracker & Genre Analytics",
    page_icon="🎮",
    layout="wide",
    initial_sidebar_state="expanded",
)

DB_PATH = Path(__file__).resolve().parent / "roblox_trends.duckdb"


def load_dashboard_data(db_path: Path):
    """Executes analytical DuckDB queries for top games, genre market share, and historical CCU."""
    if not db_path.exists():
        st.error(
            f"Database '{db_path.name}' not found. Please run init_db.py, scraper.py, and update_schema.py first."
        )
        st.stop()

    with duckdb.connect(str(db_path), read_only=True) as con:
        # Query 1: Latest snapshot of top 20 games by CCU
        query_top20 = """
            WITH latest_metrics AS (
                SELECT 
                    universe_id,
                    timestamp,
                    ccu,
                    visits,
                    upvotes,
                    downvotes,
                    ROW_NUMBER() OVER (PARTITION BY universe_id ORDER BY timestamp DESC) AS rn
                FROM metrics
            )
            SELECT 
                g.universe_id,
                g.name,
                COALESCE(g.cluster_label, 'Unclassified') AS cluster_label,
                m.ccu,
                m.visits,
                m.upvotes,
                m.downvotes,
                m.timestamp AS snapshot_time
            FROM latest_metrics m
            JOIN games g ON m.universe_id = g.universe_id
            WHERE m.rn = 1
            ORDER BY m.ccu DESC
            LIMIT 20;
        """
        df_top20 = con.execute(query_top20).df()

        # Query 2: Genre Market Share (group by cluster_label, sum latest CCU)
        query_genres = """
            WITH latest_metrics AS (
                SELECT 
                    universe_id,
                    ccu,
                    ROW_NUMBER() OVER (PARTITION BY universe_id ORDER BY timestamp DESC) AS rn
                FROM metrics
            )
            SELECT 
                COALESCE(g.cluster_label, 'Unclassified') AS cluster_label,
                COUNT(g.universe_id) AS game_count,
                CAST(SUM(m.ccu) AS BIGINT) AS total_ccu,
                ROUND(AVG(m.ccu), 1) AS avg_ccu
            FROM games g
            JOIN latest_metrics m ON g.universe_id = m.universe_id
            WHERE m.rn = 1
            GROUP BY g.cluster_label
            ORDER BY total_ccu ASC;
        """
        df_genres = con.execute(query_genres).df()

        # Query 3: Historical time-series CCU data for the top 5 games
        query_top5_history = """
            WITH top_5_games AS (
                SELECT 
                    m.universe_id,
                    g.name,
                    ARG_MAX(m.ccu, m.timestamp) AS latest_ccu
                FROM metrics m
                JOIN games g ON m.universe_id = g.universe_id
                GROUP BY m.universe_id, g.name
                ORDER BY latest_ccu DESC
                LIMIT 5
            )
            SELECT 
                m.universe_id,
                t.name,
                m.timestamp,
                m.ccu
            FROM metrics m
            JOIN top_5_games t ON m.universe_id = t.universe_id
            ORDER BY m.timestamp ASC;
        """
        df_top5_history = con.execute(query_top5_history).df()

        # Database summary metrics
        total_games = con.execute("SELECT COUNT(*) FROM games;").fetchone()[0]
        total_snapshots = con.execute("SELECT COUNT(*) FROM metrics;").fetchone()[0]

    return df_top20, df_genres, df_top5_history, total_games, total_snapshots


def main():
    st.title("🎮 Roblox Real-Time Trend & Genre Analytics")
    st.caption(
        "Interactive machine learning and market analysis pipeline powered by DuckDB, Streamlit, and Plotly."
    )

    # Load data
    df_top20, df_genres, df_top5_history, total_games, total_snapshots = load_dashboard_data(DB_PATH)

    # Calculate high-level KPIs
    total_active_ccu = int(df_genres["total_ccu"].sum()) if not df_genres.empty else 0
    top_game_name = df_top20.iloc[0]["name"] if not df_top20.empty else "N/A"
    top_game_ccu = int(df_top20.iloc[0]["ccu"]) if not df_top20.empty else 0

    top_genre_row = df_genres.sort_values(by="total_ccu", ascending=False).iloc[0] if not df_genres.empty else None
    top_genre_name = top_genre_row["cluster_label"] if top_genre_row is not None else "N/A"
    top_genre_ccu = int(top_genre_row["total_ccu"]) if top_genre_row is not None else 0

    # Top KPI Metrics Cards
    kpi1, kpi2, kpi3, kpi4 = st.columns(4)
    with kpi1:
        st.metric(label="Total Tracked Games", value=f"{total_games}")
    with kpi2:
        st.metric(label="Total Active Player CCU", value=f"{total_active_ccu:,}")
    with kpi3:
        clean_top_genre = (top_genre_name[:20] + "...") if len(top_genre_name) > 23 else top_genre_name
        st.metric(label=f"Leading Genre: {clean_top_genre}", value=f"{top_genre_ccu:,} CCU")
    with kpi4:
        clean_top_game = (top_game_name[:18] + "...") if len(top_game_name) > 21 else top_game_name
        st.metric(label=f"Top Game: {clean_top_game}", value=f"{top_game_ccu:,} CCU")

    st.divider()

    # Section 1: Two-column layout for Top Games and Genre Market Share
    col_games, col_genres = st.columns([1, 1], gap="large")

    with col_games:
        st.subheader("🏆 Top 20 Games by Current CCU")
        df_games_bar = df_top20.sort_values(by="ccu", ascending=True).copy()

        fig_games = px.bar(
            df_games_bar,
            x="ccu",
            y="name",
            orientation="h",
            text="ccu",
            color="ccu",
            color_continuous_scale="Viridis",
            labels={"ccu": "Concurrent Players (CCU)", "name": "Game Name"},
            hover_data={
                "cluster_label": True,
                "visits": ":,",
                "upvotes": ":,",
                "ccu": ":,",
            },
        )
        fig_games.update_traces(
            texttemplate="%{text:,.0f}",
            textposition="outside",
            cliponaxis=False,
        )
        fig_games.update_layout(
            height=620,
            margin=dict(l=20, r=40, t=20, b=40),
            xaxis_title="Concurrent Players (CCU)",
            yaxis_title=None,
            coloraxis_showscale=False,
        )
        st.plotly_chart(fig_games, use_container_width=True)

    with col_genres:
        st.subheader("🥧 Genre Market Share (Total CCU)")
        df_genres_bar = df_genres.copy()
        total_genre_ccu = df_genres_bar["total_ccu"].sum()
        df_genres_bar["share_pct"] = (
            (df_genres_bar["total_ccu"] / total_genre_ccu * 100.0) if total_genre_ccu > 0 else 0.0
        )
        df_genres_bar["display_text"] = df_genres_bar.apply(
            lambda r: f"{int(r['total_ccu']):,} ({r['share_pct']:.1f}%)", axis=1
        )

        fig_genres = px.bar(
            df_genres_bar,
            x="total_ccu",
            y="cluster_label",
            orientation="h",
            text="display_text",
            color="total_ccu",
            color_continuous_scale="Plasma",
            labels={
                "total_ccu": "Total Concurrent Players (CCU)",
                "cluster_label": "Sub-Genre",
            },
            hover_data={
                "game_count": True,
                "avg_ccu": ":,.1f",
                "share_pct": ":.2f%",
                "total_ccu": ":,",
            },
        )
        fig_genres.update_traces(
            textposition="outside",
            cliponaxis=False,
        )
        fig_genres.update_layout(
            height=620,
            margin=dict(l=20, r=60, t=20, b=40),
            xaxis_title="Total Concurrent Players (CCU)",
            yaxis_title=None,
            coloraxis_showscale=False,
        )
        st.plotly_chart(fig_genres, use_container_width=True)

    st.divider()

    # Section 2: Full-width Time-Series Chart for Top 5 Games
    st.subheader("📈 Time-Series Trends (Top 5 Games CCU Over Time)")
    if not df_top5_history.empty:
        fig_timeline = px.line(
            df_top5_history,
            x="timestamp",
            y="ccu",
            color="name",
            markers=True,
            labels={
                "timestamp": "Snapshot Timestamp (UTC)",
                "ccu": "Concurrent Players (CCU)",
                "name": "Game Title",
            },
            hover_data={"universe_id": True, "ccu": ":,"},
        )
        fig_timeline.update_layout(
            height=480,
            margin=dict(l=20, r=20, t=20, b=40),
            legend=dict(
                orientation="h",
                yanchor="bottom",
                y=-0.28,
                xanchor="center",
                x=0.5,
            ),
            xaxis_title="Timestamp",
            yaxis_title="Concurrent Players (CCU)",
        )
        st.plotly_chart(fig_timeline, use_container_width=True)
    else:
        st.info("No time-series history records found in database.")

    st.divider()

    # Section 3: Expandable Raw Data Tables
    col_tab1, col_tab2 = st.columns(2)
    with col_tab1:
        with st.expander("📋 Top 20 Games Latest Snapshot Table"):
            display_games = df_top20[
                ["universe_id", "name", "cluster_label", "ccu", "visits", "upvotes", "downvotes"]
            ].copy()
            display_games["ccu"] = display_games["ccu"].apply(lambda v: f"{v:,}")
            display_games["visits"] = display_games["visits"].apply(lambda v: f"{v:,}")
            display_games["upvotes"] = display_games["upvotes"].apply(lambda v: f"{v:,}")
            display_games["downvotes"] = display_games["downvotes"].apply(lambda v: f"{v:,}")
            st.dataframe(display_games, use_container_width=True)

    with col_tab2:
        with st.expander("📊 Sub-Genre Aggregation Table"):
            display_genres_table = df_genres.sort_values(by="total_ccu", ascending=False).copy()
            display_genres_table["share_pct"] = (
                display_genres_table["total_ccu"] / display_genres_table["total_ccu"].sum() * 100.0
            ).apply(lambda p: f"{p:.2f}%")
            display_genres_table["total_ccu"] = display_genres_table["total_ccu"].apply(lambda v: f"{int(v):,}")
            display_genres_table["avg_ccu"] = display_genres_table["avg_ccu"].apply(lambda v: f"{v:,.1f}")
            display_genres_table.rename(
                columns={
                    "cluster_label": "Sub-Genre",
                    "game_count": "Games",
                    "total_ccu": "Total CCU",
                    "avg_ccu": "Avg CCU/Game",
                    "share_pct": "Market Share",
                },
                inplace=True,
            )
            st.dataframe(display_genres_table, use_container_width=True)


if __name__ == "__main__":
    main()
