#!/usr/bin/env python3
"""Dump a Titan Email IMAP account to a local mbox file.

Reads credentials from environment variables (loaded from `.env`):
    UNNE_TITAN_EMAIL
    UNNE_TITAN_PASSWORD

Default output: data/1_raw/unne/titan.mbox (relative to repo root).

Usage:
    python scripts/titan_to_mbox.py
    python scripts/titan_to_mbox.py --folder INBOX
    python scripts/titan_to_mbox.py --all-folders
    python scripts/titan_to_mbox.py --output /tmp/other.mbox
"""

from __future__ import annotations

import argparse
import email
import imaplib
import mailbox
import os
import re
import sys
import time
from pathlib import Path

IMAP_HOST = "imap.titan.email"
IMAP_PORT = 993
BATCH = 50

# Default imaplib line limit (1 MiB) trips on emails with big attachments.
imaplib._MAXLINE = 100 * 1024 * 1024
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_OUTPUT = REPO_ROOT / "data" / "1_raw" / "unne" / "titan.mbox"


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def parse_folder_list(raw: bytes) -> str:
    # IMAP LIST response: (\HasNoChildren) "/" "INBOX"
    match = re.match(rb'\(.*?\)\s+"[^"]*"\s+(.+)$', raw)
    if not match:
        return raw.decode(errors="replace")
    name = match.group(1).decode(errors="replace").strip()
    if name.startswith('"') and name.endswith('"'):
        name = name[1:-1]
    return name


def fetch_folder(imap: imaplib.IMAP4_SSL, folder: str, mbox: mailbox.mbox) -> int:
    typ, _ = imap.select(f'"{folder}"', readonly=True)
    if typ != "OK":
        print(f"  skip {folder!r}: cannot select", file=sys.stderr)
        return 0
    typ, data = imap.search(None, "ALL")
    if typ != "OK" or not data or not data[0]:
        return 0
    ids = data[0].split()
    total = len(ids)
    print(f"  {folder}: {total} messages")
    saved = 0
    for start in range(0, total, BATCH):
        chunk = ids[start : start + BATCH]
        seq = b",".join(chunk)
        typ, resp = imap.fetch(seq, "(BODY.PEEK[])")
        if typ != "OK":
            print(f"    fetch failed @ {start}", file=sys.stderr)
            continue
        for item in resp:
            if not isinstance(item, tuple):
                continue
            raw_bytes = item[1]
            if not raw_bytes:
                continue
            try:
                msg = email.message_from_bytes(raw_bytes)
                mbox_msg = mailbox.mboxMessage(msg)
                mbox_msg.set_from("imap@titan", time.gmtime())
                folder_clean = folder.replace("/", ".")
                mbox_msg.add_header("X-Titan-Folder", folder_clean)
                mbox.add(mbox_msg)
                saved += 1
            except Exception as exc:  # noqa: BLE001
                print(f"    parse error: {exc}", file=sys.stderr)
        mbox.flush()
        print(f"    progress {min(start + BATCH, total)}/{total}")
    return saved


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--folder",
        default=None,
        help="dump a single folder only (default: dump every folder)",
    )
    parser.add_argument(
        "--all-folders",
        action="store_true",
        default=True,
        help="(default) dump every folder the server lists",
    )
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="output mbox path")
    args = parser.parse_args()

    load_dotenv(REPO_ROOT / ".env")
    user = os.environ.get("UNNE_TITAN_EMAIL")
    password = os.environ.get("UNNE_TITAN_PASSWORD")
    if not user or not password or "REPLACE_ME" in (user + password):
        print(
            "Missing creds. Set UNNE_TITAN_EMAIL and UNNE_TITAN_PASSWORD in .env",
            file=sys.stderr,
        )
        return 2

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    mbox = mailbox.mbox(str(out_path))
    mbox.lock()
    try:
        print(f"Connecting to {IMAP_HOST}:{IMAP_PORT} as {user}")
        imap = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
        imap.login(user, password)
        try:
            folders: list[str]
            if args.folder:
                folders = [args.folder]
            else:
                typ, listing = imap.list()
                if typ != "OK" or not listing:
                    print("LIST failed", file=sys.stderr)
                    return 3
                folders = [parse_folder_list(row) for row in listing if row]
                print(f"Folders ({len(folders)}): {folders}")

            total_saved = 0
            for folder in folders:
                total_saved += fetch_folder(imap, folder, mbox)
            print(f"Done. Saved {total_saved} messages to {out_path}")
        finally:
            try:
                imap.logout()
            except Exception:  # noqa: BLE001
                pass
    finally:
        mbox.flush()
        mbox.unlock()
        mbox.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
