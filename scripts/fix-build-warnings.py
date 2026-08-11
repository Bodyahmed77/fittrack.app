from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Remove the duplicate object-literal key introduced by the AI report overlay patch.
p = ROOT / 'src/App.jsx'
s = p.read_text(encoding='utf-8')
dup = '          position: "absolute",\n          position: "absolute",\n'
if dup in s:
    s = s.replace(dup, '          position: "absolute",\n', 1)
p.write_text(s, encoding='utf-8')

# These files are not valid patch-package filenames and are ignored on every install.
# Their functionality is already present in the source code; keeping them only adds
# warnings and dead repository artifacts.
for name in [
    'ai-coach-app-toast.patch',
    'billing-server-verify-app.jsx.patch',
    'tiktok-parent-scroll.patch',
]:
    path = ROOT / 'patches' / name
    if path.exists():
        path.unlink()

print('build warnings cleaned')
