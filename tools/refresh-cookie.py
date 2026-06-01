#!/usr/bin/env python3
"""Refresh Schoology cookie from logged-in Chrome and push to GitHub secret.

Reads cookies from Chrome's local SQLite, decrypts them via the macOS Keychain
key, formats as a Cookie header string, and updates the SCHOOLOGY_COOKIE
GitHub Actions secret. Optionally also writes to tools/config.json and
dispatches the mirror workflow.

Usage:
  python3 tools/refresh-cookie.py                       # update GH secret
  python3 tools/refresh-cookie.py --also-local          # ...and local config.json
  python3 tools/refresh-cookie.py --trigger             # ...and dispatch the workflow
  python3 tools/refresh-cookie.py --print-only          # just print the cookie

Auth:
  Set GITHUB_TOKEN env var, or put the token in tools/.github-token (gitignored).
  Token needs `repo` scope (or fine-grained: Actions secrets write + workflow dispatch).

Dependencies:
  - macOS only (uses `security` for Keychain, `openssl` for AES)
  - Python stdlib + pynacl (already installed for GitHub secret encryption)
  - No pip install required
"""

import argparse
import base64
import hashlib
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path
from typing import List, Optional, Tuple

REPO = "coder-1611/schoology-archive"
SECRET_NAME = "SCHOOLOGY_COOKIE"
WORKFLOW = "mirror.yml"

CHROME_ROOT = Path.home() / "Library/Application Support/Google/Chrome"
DOMAIN_SUFFIX = "schoology.com"
TOOLS_DIR = Path(__file__).resolve().parent


def chrome_cookie_dbs() -> List[Path]:
    """Every existing Cookies file across Default + Profile N (both legacy and Network/ locations)."""
    if not CHROME_ROOT.exists():
        return []
    profiles = [CHROME_ROOT / "Default"] + sorted(CHROME_ROOT.glob("Profile *"))
    candidates = []
    for prof in profiles:
        for sub in ("Cookies", "Network/Cookies"):
            p = prof / sub
            if p.is_file():
                candidates.append(p)
    return candidates


def keychain_password() -> bytes:
    """Fetch the Chrome Safe Storage key from macOS Keychain.

    Pops a GUI password prompt the first time per terminal session.
    """
    try:
        out = subprocess.check_output(
            ["security", "find-generic-password", "-wa", "Chrome Safe Storage"],
            stderr=subprocess.PIPE,
        )
    except subprocess.CalledProcessError as e:
        raise SystemExit(
            "Could not read 'Chrome Safe Storage' from Keychain. "
            "If a GUI prompt appeared, click Always Allow and rerun.\n"
            f"stderr: {e.stderr.decode().strip()}"
        )
    return out.strip()


def derive_key(password: bytes) -> bytes:
    """PBKDF2-HMAC-SHA1, 1003 iterations, salt='saltysalt', 16 bytes — Chrome's macOS scheme."""
    return hashlib.pbkdf2_hmac("sha1", password, b"saltysalt", 1003, 16)


def decrypt_v10(blob: bytes, key: bytes) -> Optional[str]:
    """Decrypt a Chrome v10/v11 encrypted cookie value via openssl CLI."""
    iv = b" " * 16
    try:
        result = subprocess.run(
            ["openssl", "enc", "-d", "-aes-128-cbc",
             "-K", key.hex(), "-iv", iv.hex(), "-nopad"],
            input=blob, capture_output=True, check=True,
        )
    except subprocess.CalledProcessError:
        return None
    plaintext = result.stdout
    if not plaintext:
        return None
    # PKCS7 unpad
    pad = plaintext[-1]
    if 1 <= pad <= 16 and plaintext[-pad:] == bytes([pad]) * pad:
        plaintext = plaintext[:-pad]
    try:
        return plaintext.decode("utf-8")
    except UnicodeDecodeError:
        return None


def _read_cookies_from(db: Path) -> List[Tuple[str, str, str, bytes]]:
    """Snapshot a single cookies DB (Chrome may have it locked) and return matching rows."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        tmp = Path(f.name)
    try:
        shutil.copy(db, tmp)
        conn = sqlite3.connect(tmp)
        rows = conn.execute(
            "SELECT host_key, name, value, encrypted_value FROM cookies "
            "WHERE host_key LIKE '%' || ? || '%'",
            (DOMAIN_SUFFIX,),
        ).fetchall()
        conn.close()
        return rows
    finally:
        tmp.unlink(missing_ok=True)


def read_cookies() -> Tuple[List[Tuple[str, str, str, bytes]], Path]:
    """Find the Chrome profile with the most schoology cookies; return (rows, source_db)."""
    dbs = chrome_cookie_dbs()
    if not dbs:
        raise SystemExit(f"No Chrome cookie DBs found under {CHROME_ROOT}")

    best: Tuple[List, Path] = ([], dbs[0])
    for db in dbs:
        try:
            rows = _read_cookies_from(db)
        except sqlite3.DatabaseError:
            continue
        if len(rows) > len(best[0]):
            best = (rows, db)
    return best


def format_cookie_header(rows, key: bytes) -> str:
    """Build a `name=value; name=value` header from decrypted cookie rows."""
    pairs = []
    for host, name, value, enc in rows:
        if enc and len(enc) > 3 and enc[:3] in (b"v10", b"v11"):
            decrypted = decrypt_v10(enc[3:], key)
            if decrypted is None:
                print(f"  ! could not decrypt {host} {name}", file=sys.stderr)
                continue
            value = decrypted
        elif not value:
            continue
        pairs.append(f"{name}={value}")
    return "; ".join(pairs)


def github_token() -> str:
    tok = os.environ.get("GITHUB_TOKEN")
    if tok:
        return tok
    fpath = TOOLS_DIR / ".github-token"
    if fpath.exists():
        return fpath.read_text().strip()
    raise SystemExit(
        "No GitHub token found. Set GITHUB_TOKEN or write it to tools/.github-token.\n"
        "Token needs `repo` scope (or fine-grained: Actions secrets write + workflow dispatch)."
    )


def gh(token: str, method: str, path: str, data=None):
    req = urllib.request.Request(f"https://api.github.com{path}", method=method)
    req.add_header("Authorization", f"token {token}")
    req.add_header("Accept", "application/vnd.github.v3+json")
    body = json.dumps(data).encode() if data is not None else None
    if body:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, body) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def update_secret(token: str, value: str) -> int:
    from nacl import encoding, public  # lazy import — only needed for secret update

    status, body = gh(token, "GET", f"/repos/{REPO}/actions/secrets/public-key")
    if status != 200:
        raise SystemExit(f"public-key fetch failed: {status} {body[:200]!r}")
    pk = json.loads(body)
    pub = public.PublicKey(pk["key"].encode(), encoding.Base64Encoder())
    ev = base64.b64encode(public.SealedBox(pub).encrypt(value.encode())).decode()
    status, body = gh(token, "PUT", f"/repos/{REPO}/actions/secrets/{SECRET_NAME}",
                      {"encrypted_value": ev, "key_id": pk["key_id"]})
    return status


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--print-only", action="store_true", help="Print cookie to stdout, don't update anything")
    ap.add_argument("--also-local", action="store_true", help="Also write cookie into tools/config.json")
    ap.add_argument("--trigger", action="store_true", help="Dispatch mirror.yml after updating secret")
    ap.add_argument("--skip-secret", action="store_true", help="Don't update the GitHub secret (use with --also-local for local-only refresh)")
    args = ap.parse_args()

    print("Reading Chrome cookies for *.schoology.com…", file=sys.stderr)
    rows, source = read_cookies()
    if not rows:
        raise SystemExit(
            "No schoology.com cookies found in any Chrome profile. "
            "Are you logged in to Schoology in Chrome (check every profile)?"
        )
    # Show which profile we used so users can spot if it picked the wrong one
    profile_name = source.parent.parent.name if source.parent.name == "Network" else source.parent.name
    print(f"  found {len(rows)} cookie rows in profile '{profile_name}'", file=sys.stderr)

    print("Requesting Chrome Safe Storage key from Keychain (GUI may prompt)…", file=sys.stderr)
    key = derive_key(keychain_password())

    cookie = format_cookie_header(rows, key)
    if not cookie:
        raise SystemExit("Decrypted 0 cookies — Chrome may use a new encryption scheme, or wrong Keychain key")

    if "SESS" not in cookie:
        print("WARNING: no SESS* cookie present — Schoology session may be expired or you're not logged in", file=sys.stderr)

    if args.print_only:
        print(cookie)
        return

    if args.also_local:
        cfg_path = TOOLS_DIR / "config.json"
        if not cfg_path.exists():
            print(f"  ! {cfg_path} does not exist; skipping local update", file=sys.stderr)
        else:
            cfg = json.loads(cfg_path.read_text())
            cfg["cookie"] = cookie
            cfg_path.write_text(json.dumps(cfg, indent=2))
            print(f"✓ Updated {cfg_path}", file=sys.stderr)

    if not args.skip_secret:
        token = github_token()
        status = update_secret(token, cookie)
        if status == 204:
            print(f"✓ Updated GitHub secret {SECRET_NAME}", file=sys.stderr)
        else:
            raise SystemExit(f"Secret update failed: HTTP {status}")

        if args.trigger:
            status, body = gh(token, "POST", f"/repos/{REPO}/actions/workflows/{WORKFLOW}/dispatches",
                              {"ref": "main"})
            if status == 204:
                print(f"✓ Dispatched workflow {WORKFLOW}", file=sys.stderr)
            else:
                print(f"! Dispatch returned HTTP {status}: {body[:200]!r}", file=sys.stderr)


if __name__ == "__main__":
    main()
