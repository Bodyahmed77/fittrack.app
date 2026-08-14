from pathlib import Path

# Reuse the deterministic v5 runtime fixes. Do not rewrite the current viewer
# implementation here; v6 is only a strict release-time validation layer.
exec(Path('scripts/release-fixes-v5.py').read_text(encoding='utf-8'), {'__name__': '__release_fixes_v5__'})

APP = Path('src/App.jsx')
text = APP.read_text(encoding='utf-8')

required = [
    ('function FullScreenVideoViewer', 'full-screen video viewer'),
    ('<iframe', 'in-app iframe viewer'),
    ('String(videoId || "")', 'original video URL handling'),
    ('const persist = useCallback(async (finished', 'durable cardio persistence'),
    ('await persist(true, null)', 'wait for cardio save before navigation'),
]
for needle, label in required:
    if needle not in text:
        raise SystemExit(f'v6: required {label} not found')

forbidden = [
    ('@capacitor/browser', 'external browser integration'),
    ('Browser.open(', 'external browser handoff'),
    ('https://www.tiktok.com/player/v1/', 'TikTok official player'),
    ('https://www.tiktok.com/oembed?url=', 'TikTok oEmbed resolver'),
    ('resolveTikTokCanonicalWebUrl', 'TikTok canonical URL resolver'),
]
for needle, label in forbidden:
    if needle in text:
        raise SystemExit(f'v6: forbidden {label} present')

for needle, label in [
    ('data.customTrainingPlan && data.entitlements.trainingPro && (', 'training-plan billing gate'),
    ('data.customNutritionPlan && data.entitlements.nutritionPro && (', 'nutrition-plan billing gate'),
]:
    if needle in text:
        raise SystemExit(f'v6: forbidden {label} present')

print('Release fixes v6 verification passed')
print('TikTok keeps the original configured URL inside the full-screen in-app iframe')
print('No TikTok player, oEmbed resolver, external browser, or native-app handoff is injected')
print('Cardio persistence is awaited before leaving the exercise screen')
