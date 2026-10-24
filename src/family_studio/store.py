import json
import sqlite3
import threading
import time
import uuid
from pathlib import Path


class Store:
    """Small owner-scoped store; image bytes keep their original PNG metadata."""

    def __init__(self, root: Path):
        self.root = root
        self.media = root / "media"
        self.media.mkdir(parents=True, exist_ok=True)
        self.lock = threading.RLock()
        self.db = sqlite3.connect(root / "studio.sqlite", check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        with self.db:
            self.db.executescript("""
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS records (
                    id TEXT PRIMARY KEY, owner TEXT NOT NULL, kind TEXT NOT NULL,
                    created REAL NOT NULL, updated REAL NOT NULL, value TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS records_owner_kind ON records(owner,kind,created);
            """)

    def put(self, owner, kind, value, ident=None):
        ident = ident or str(uuid.uuid4())
        now = time.time()
        with self.lock, self.db:
            existing = self.db.execute("SELECT owner,kind,value FROM records WHERE id=?", (ident,)).fetchone()
            if existing and (existing["owner"] != owner or existing["kind"] != kind):
                raise PermissionError("Record belongs to another account")
            if existing and kind == "chat":
                value = {**value, "locked": bool(json.loads(existing["value"]).get("locked", False))}
            self.db.execute("""INSERT INTO records VALUES (?,?,?,?,?,?)
                ON CONFLICT(id) DO UPDATE SET updated=excluded.updated,value=excluded.value""",
                (ident, owner, kind, now, now, json.dumps(value)))
        return self.get(owner, ident, kind)

    @staticmethod
    def _decode(row):
        if not row:
            return None
        return {**json.loads(row["value"]), "id": row["id"], "created": row["created"], "updated": row["updated"]}

    def get(self, owner, ident, kind=None):
        with self.lock:
            row = self.db.execute("SELECT * FROM records WHERE owner=? AND id=?", (owner, ident)).fetchone()
        if row and kind and row["kind"] != kind:
            return None
        return self._decode(row)

    def list(self, owner, kind, limit=200):
        order = "updated" if kind == "chat" else "created"
        with self.lock:
            rows = self.db.execute(f"SELECT * FROM records WHERE owner=? AND kind=? ORDER BY {order} DESC, id DESC LIMIT ?",
                                   (owner, kind, limit)).fetchall()
        return [self._decode(row) for row in rows]

    def interrupt_old_jobs(self):
        with self.lock:
            rows = self.db.execute("SELECT * FROM records WHERE kind='job'").fetchall()
        for row in rows:
            value = json.loads(row["value"])
            if value.get("state") in {"queued", "running"}:
                value.update(state="interrupted", message="Studio restarted. Recover this job instead of creating a duplicate.")
                self.put(row["owner"], "job", value, row["id"])

    def trash_image(self, owner, ident, restore=False):
        """Move an owned creation between the library and recoverable trash."""
        source, destination = ("trashed_image", "image") if restore else ("image", "trashed_image")
        with self.lock, self.db:
            result = self.db.execute(
                "UPDATE records SET kind=?,updated=? WHERE owner=? AND id=? AND kind=?",
                (destination, time.time(), owner, ident, source),
            )
        return result.rowcount == 1

    def manage_chat(self, owner, ident, action):
        source = "trashed_chat" if action == "restore" else "chat"
        with self.lock, self.db:
            row = self.db.execute("SELECT value FROM records WHERE owner=? AND id=? AND kind=?",
                                  (owner, ident, source)).fetchone()
            if not row:
                return False
            value = json.loads(row["value"])
            if action in {"lock", "unlock"}:
                value["locked"] = action == "lock"
                self.db.execute("UPDATE records SET value=? WHERE owner=? AND id=? AND kind='chat'",
                                (json.dumps(value), owner, ident))
            elif action in {"trash", "restore"}:
                if action == "trash" and value.get("locked"):
                    raise ValueError("Unlock this conversation before deleting it.")
                destination = "chat" if action == "restore" else "trashed_chat"
                self.db.execute("UPDATE records SET kind=?,updated=? WHERE owner=? AND id=? AND kind=?",
                                (destination, time.time(), owner, ident, source))
            else:
                raise ValueError("Unknown conversation action")
        return True

    def close(self):
        self.db.close()
