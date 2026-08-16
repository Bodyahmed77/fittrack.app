#!/usr/bin/env python3
"""Independent Google Sign-In configuration sanity check for CI and audits."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = "com.bodyahmed77.fiftyfit"
CONFIG = ROOT / "capacitor.config.json"


def main() -> None:
    cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
    assert cfg.get("appId") == PACKAGE
    auth = cfg.get("plugins", {}).get("FirebaseAuthentication", {})
    assert "google.com" in (auth.get("providers") or [])
    web_id = str(auth.get("googleWebClientId") or "")
    assert web_id.endswith(".apps.googleusercontent.com")
    print(f"Google Sign-In config OK: package={PACKAGE}, webClientId=…{web_id[-24:]}")


if __name__ == "__main__":
    main()
