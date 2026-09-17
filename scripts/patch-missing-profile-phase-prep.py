from pathlib import Path
import re

p = Path("src/App.jsx")
s = p.read_text(encoding="utf-8")

# patch-production-final-2 historically depended on an exact router fragment.
# The router has since been hardened by other patches, so establish its intended
# recovery gate first using a tolerant match. This keeps the legacy patcher
# idempotent while making the resulting App deterministic.
if 'setPhase("accountRecovery")' not in s:
    root_start = s.find('export default function GymApp()')
    if root_start < 0:
        raise SystemExit("missing-profile-phase-prep: app root not found")

    # Find the signed-out branch inside GymApp, then inject recovery immediately
    # after it. This is independent of line wrapping or a preceding load gate.
    branch = re.search(
        r'(\n\s*)if\s*\(firebaseUser\s*===\s*null\)\s*\{\s*'
        r'setPhase\(["\']welcome["\']\);\s*return;\s*\}',
        s[root_start:],
        re.S,
    )
    if not branch:
        raise SystemExit("missing-profile-phase-prep: signed-out branch not found")

    absolute_end = root_start + branch.end()
    indent = branch.group(1)
    gate = (
        f'{indent}if (profileMissing) {{\n'
        f'{indent}  setPhase("accountRecovery");\n'
        f'{indent}  return;\n'
        f'{indent}}}'
    )
    s = s[:absolute_end] + gate + s[absolute_end:]

if "/* FIFTYFIT_MISSING_PROFILE_PHASE_PREP_V1 */" not in s:
    s = "/* FIFTYFIT_MISSING_PROFILE_PHASE_PREP_V1 */\n" + s

p.write_text(s, encoding="utf-8")
print("missing-profile phase prep applied")
