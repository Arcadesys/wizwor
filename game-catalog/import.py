#!/usr/bin/env python3
"""Import EveryVideoGameEver's per-platform JSON files into a SQLite database.

Source: https://github.com/Elbriga14/EveryVideoGameEver (GamesDB/*.json)
"""
import json
import glob
import os
import sqlite3

SOURCE_DIR = os.path.join(os.path.dirname(__file__), "source", "GamesDB")
DB_PATH = os.path.join(os.path.dirname(__file__), "games.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    year INTEGER,
    dev TEXT,
    dev_link TEXT,
    publisher TEXT,
    publisher_link TEXT,
    genre TEXT,
    description TEXT,
    game_link TEXT,
    platform TEXT,
    platform_link TEXT,
    youtube_link TEXT
);

CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS game_tags (
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (game_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_games_platform ON games(platform);
CREATE INDEX IF NOT EXISTS idx_games_title ON games(title);
"""


def to_year(value):
    if value is None:
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


def main():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA)

    total_inserted = 0
    skipped = 0
    per_file_counts = {}
    for path in sorted(glob.glob(os.path.join(SOURCE_DIR, "*.json"))):
        fname = os.path.basename(path)
        with open(path, encoding="utf-8") as f:
            games = json.load(f)

        rows = []
        for g in games:
            if not g.get("Game"):
                skipped += 1
                continue
            rows.append((
                g.get("Game"),
                to_year(g.get("Year")),
                g.get("Dev"),
                g.get("DevLink"),
                g.get("Publisher"),
                g.get("PublisherLink") or g.get("PubLink"),
                g.get("Genre"),
                g.get("Description"),
                g.get("GameLink"),
                g.get("Platform"),
                g.get("PlatformLink"),
            ))

        conn.executemany(
            """INSERT INTO games
               (title, year, dev, dev_link, publisher, publisher_link, genre,
                description, game_link, platform, platform_link)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            rows,
        )
        per_file_counts[fname] = len(rows)
        total_inserted += len(rows)

    conn.commit()

    row_count = conn.execute("SELECT COUNT(*) FROM games").fetchone()[0]
    print(f"Files processed: {len(per_file_counts)}")
    print(f"Rows inserted:   {total_inserted}")
    print(f"Rows skipped (no title): {skipped}")
    print(f"Rows in table:   {row_count}")
    conn.close()


if __name__ == "__main__":
    main()
