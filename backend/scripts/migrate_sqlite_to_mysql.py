import argparse
import os
import sqlite3
import sys
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

from app.database import Base, SQLALCHEMY_DATABASE_URL  # noqa: E402
from app import models  # noqa: F401,E402

TABLE_ORDER = [
    "users",
    "videos",
    "streams",
    "comments",
    "comment_reactions",
    "video_likes",
    "chat_messages",
    "reports",
]


def create_database(database_url: str) -> None:
    url = make_url(database_url)
    if not url.get_backend_name().startswith("mysql") or not url.database:
        return

    server_engine = create_engine(url.set(database="mysql"), pool_pre_ping=True)
    try:
        with server_engine.begin() as connection:
            connection.execute(
                text(
                    f"CREATE DATABASE IF NOT EXISTS `{url.database}` "
                    "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
                )
            )
    finally:
        server_engine.dispose()


def sqlite_rows(sqlite_path: Path, table_name: str) -> list[dict]:
    connection = sqlite3.connect(sqlite_path)
    connection.row_factory = sqlite3.Row
    try:
        rows = connection.execute(f'SELECT * FROM "{table_name}"').fetchall()
        return [dict(row) for row in rows]
    finally:
        connection.close()


def table_count(connection, table_name: str) -> int:
    return connection.execute(text(f"SELECT COUNT(*) FROM `{table_name}`")).scalar_one()


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate videoHub SQLite data to MySQL.")
    parser.add_argument(
        "--sqlite-path",
        default=str(ROOT_DIR / "vidflow.db"),
        help="Path to the existing SQLite database.",
    )
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Delete existing MySQL rows before importing SQLite data.",
    )
    args = parser.parse_args()

    load_dotenv(ROOT_DIR / ".env")
    sqlite_path = Path(args.sqlite_path)
    if not sqlite_path.exists():
        raise SystemExit(f"SQLite database not found: {sqlite_path}")

    mysql_url = os.getenv("DATABASE_URL", SQLALCHEMY_DATABASE_URL)
    create_database(mysql_url)
    mysql_engine = create_engine(mysql_url, pool_pre_ping=True)
    Base.metadata.create_all(bind=mysql_engine)

    try:
        with mysql_engine.begin() as connection:
            existing_counts = {table: table_count(connection, table) for table in TABLE_ORDER}
            existing_total = sum(existing_counts.values())
            if existing_total and not args.replace:
                counts = ", ".join(f"{table}={count}" for table, count in existing_counts.items())
                raise SystemExit(
                    "Target MySQL database already has rows. "
                    f"Use --replace to overwrite. Current counts: {counts}"
                )

            if args.replace:
                connection.execute(text("SET FOREIGN_KEY_CHECKS=0"))
                for table in reversed(TABLE_ORDER):
                    connection.execute(text(f"DELETE FROM `{table}`"))
                connection.execute(text("SET FOREIGN_KEY_CHECKS=1"))

            imported_counts = {}
            for table in TABLE_ORDER:
                rows = sqlite_rows(sqlite_path, table)
                imported_counts[table] = len(rows)
                if rows:
                    connection.execute(Base.metadata.tables[table].insert(), rows)

        counts = ", ".join(f"{table}={count}" for table, count in imported_counts.items())
        print(f"Migration complete: {counts}")
    finally:
        mysql_engine.dispose()


if __name__ == "__main__":
    main()
