"""SQLite helpers for reading/writing profile memory shared with Prisma."""

from __future__ import annotations

import json
import os
import sqlite3
from typing import Any


def _db_path() -> str:
    return os.getenv("DATABASE_PATH", "../frontend/prisma/dev.db")


def fetch_profile_memories(profile_id: str, limit: int = 5) -> list[dict[str, Any]]:
    path = _db_path()
    if not profile_id or not os.path.exists(path):
        return []

    try:
        conn = sqlite3.connect(path)
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT category, errorPattern, correctionNote, occurrenceCount
            FROM ProfileMemory
            WHERE profileId = ?
            ORDER BY occurrenceCount DESC, lastSeenAt DESC
            LIMIT ?
            """,
            (profile_id, limit),
        )
        rows = cursor.fetchall()
        conn.close()
        return [
            {
                "category": r[0],
                "errorPattern": r[1],
                "correctionNote": r[2],
                "occurrenceCount": r[3],
            }
            for r in rows
        ]
    except Exception as exc:  # noqa: BLE001
        print(f"[memory] fetch failed: {exc}")
        return []


def extract_heuristic_mistakes(transcript: str) -> list[dict[str, str]]:
    """Offline fallback detectors when no LLM summarize call is available."""
    text = (transcript or "").lower()
    mistakes: list[dict[str, str]] = []

    checks = [
        (
            "mit der " in text or "mit die " in text or "mit das " in text,
            {
                "category": "Grammar",
                "errorPattern": "Confuses case after Dativ preposition 'mit'",
                "correctionNote": "Always use Dativ after 'mit' → mit dem Hund / mit der Frau",
            },
        ),
        (
            "ich habe gegangen" in text,
            {
                "category": "Grammar",
                "errorPattern": "Uses haben instead of sein with gehen",
                "correctionNote": "Motion verbs use sein → ich bin gegangen",
            },
        ),
        (
            "ich bin gehabt" in text,
            {
                "category": "Grammar",
                "errorPattern": "Incorrect Perfekt auxiliary for haben",
                "correctionNote": "Use haben → ich habe gehabt",
            },
        ),
        (
            "auf dem tisch legen" in text and "legt" not in text,
            {
                "category": "Vocabulary",
                "errorPattern": "Confuses legen/liegen or Akkusativ/Dativ location",
                "correctionNote": "legen (Akk) = put onto; liegen (Dat) = be lying on",
            },
        ),
    ]

    for matched, item in checks:
        if matched:
            mistakes.append(item)
    return mistakes


def format_mistakes_json(mistakes: list[dict[str, str]]) -> str:
    return json.dumps(mistakes, ensure_ascii=False)
