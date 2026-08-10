#!/usr/bin/env python3
"""Write src/googleWebClientId.js from android/app/google-services.json (client_type 3)."""
from pathlib import Path
import json
import sys

GS = Path("android/app/google-services.json")
OUT = Path("src/googleWebClientId.js")

def main():
    if not GS.exists():
        print("skip: google-services.json not present")
        return 0
    data = json.loads(GS.read_text(encoding="utf-8"))
    web_id = ""
    for client in data.get("client") or []:
        for oa in client.get("oauth_client") or []:
            if oa.get("client_type") == 3 and oa.get("client_id"):
                web_id = oa["client_id"]
                break
        if web_id:
            break
        # Some files list oauth only under one client; also accept type 3 anywhere
    if not web_id:
        for client in data.get("client") or []:
            for oa in client.get("oauth_client") or []:
                cid = oa.get("client_id") or ""
                if cid.endswith(".apps.googleusercontent.com") and oa.get("client_type") in (3, None):
                    if oa.get("client_type") == 3:
                        web_id = cid
                        break
            if web_id:
                break
    if not web_id:
        print("::warning::No Web OAuth client_type 3 found in google-services.json")
        return 0
    OUT.write_text(
        "// Auto-generated from google-services.json (public Web client id — not a secret)\n"
        f'export const GOOGLE_WEB_CLIENT_ID = "{web_id}";\n',
        encoding="utf-8",
    )
    print(f"wrote {OUT} (web client id length={len(web_id)})")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
