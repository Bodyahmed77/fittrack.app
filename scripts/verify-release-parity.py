from pathlib import Path
import hashlib
import zipfile

APK = Path("android/app/build/outputs/apk/release/app-release.apk")
AAB = Path("android/app/build/outputs/bundle/release/app-release.aab")
SOURCE = Path("android/app/src/main/assets/public")

if not APK.is_file() or APK.stat().st_size == 0:
    raise SystemExit("release-parity: APK missing or empty")
if not AAB.is_file() or AAB.stat().st_size == 0:
    raise SystemExit("release-parity: AAB missing or empty")
if not SOURCE.is_dir():
    raise SystemExit("release-parity: Capacitor public asset directory missing")


def digest_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def source_assets():
    result = {}
    for p in sorted(SOURCE.rglob("*")):
        if p.is_file():
            rel = p.relative_to(SOURCE).as_posix()
            result[rel] = digest_bytes(p.read_bytes())
    if not result:
        raise SystemExit("release-parity: no web assets found")
    return result

src = source_assets()

with zipfile.ZipFile(APK) as z:
    apk_assets = {
        name[len("assets/") :]: digest_bytes(z.read(name))
        for name in z.namelist()
        if name.startswith("assets/") and not name.endswith("/")
    }

with zipfile.ZipFile(AAB) as z:
    base_prefix = "base/assets/"
    aab_assets = {
        name[len(base_prefix) :]: digest_bytes(z.read(name))
        for name in z.namelist()
        if name.startswith(base_prefix) and not name.endswith("/")
    }

missing_apk = sorted(set(src) - set(apk_assets))
missing_aab = sorted(set(src) - set(aab_assets))
if missing_apk or missing_aab:
    raise SystemExit(f"release-parity: missing assets APK={missing_apk} AAB={missing_aab}")

mismatched_apk = sorted(k for k in src if apk_assets.get(k) != src[k])
mismatched_aab = sorted(k for k in src if aab_assets.get(k) != src[k])
if mismatched_apk or mismatched_aab:
    raise SystemExit(f"release-parity: asset hash mismatch APK={mismatched_apk} AAB={mismatched_aab}")

print(f"release-parity: verified {len(src)} web assets in both APK and AAB")
print(f"release-parity: APK bytes={APK.stat().st_size} AAB bytes={AAB.stat().st_size}")
