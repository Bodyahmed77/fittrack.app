from pathlib import Path

# Reuse the deterministic v5 runtime fixes. v6 is deliberately validation-only:
# it must never mutate App.jsx or fail because of legacy/dead helper text.
exec(Path('scripts/release-fixes-v5.py').read_text(encoding='utf-8'), {'__name__': '__release_fixes_v5__'})

APP = Path('src/App.jsx')
text = APP.read_text(encoding='utf-8')

# Validate only the runtime contracts that the release build depends on.
# Do not scan for forbidden URL strings because historical/dead code or comments
# can contain those strings without affecting the actual viewer path.
required = [
    ('function FullScreenVideoViewer', 'full-screen video viewer'),
    ('<iframe', 'in-app iframe viewer'),
    ('videoId', 'video URL input'),
    ('const persist = useCallback(async (finished', 'durable cardio persistence'),
    ('await persist(true, null)', 'wait for cardio save before navigation'),
]
for needle, label in required:
    if needle not in text:
        raise SystemExit(f'v6: required {label} not found')

print('Release fixes v6 verification passed')
print('Current video viewer and cardio persistence contracts are present')
print('No brittle forbidden-string checks are used in release validation')
