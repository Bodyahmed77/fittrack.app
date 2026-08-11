from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Standardize user-facing brand name without touching technical storage keys or env variable names.
p = ROOT / 'src/App.jsx'
s = p.read_text(encoding='utf-8')
s = s.replace('Fifty Fit Pro', 'FitTrack Pro')
s = s.replace('Fifty Fit', 'FitTrack')
s = s.replace('"Fifty Pro"', '"FitTrack Pro"')
s = s.replace('"Fifty"', '"FitTrack"')
s = s.replace('>Fifty<', '>FitTrack<')
s = s.replace('(Fifty Fit)', '(FitTrack)')
p.write_text(s, encoding='utf-8')

# Keep the public privacy page aligned with the in-app policy.
p = ROOT / 'docs/privacy-policy.html'
s = p.read_text(encoding='utf-8')
needle = '<h2>AI Coach</h2>\n  <p>When you use AI Coach, the app sends the information needed to answer your request to Google\'s Gemini API. FitTrack does not maintain a chat-history database; chat messages are held in app memory while the AI Coach screen is open. Google\'s processing and retention are governed by the applicable Gemini API terms and policies.</p>'
replacement = '<h2>AI Coach</h2>\n  <p>When you use AI Coach, the app sends the information needed to answer your request to Google\'s Gemini API. FitTrack does not maintain a chat-history database; chat messages are held in app memory while the AI Coach screen is open. If you report an AI answer, the reported answer snippet and your report reason are stored in Supabase for safety and quality review. Google\'s processing and retention are governed by the applicable Gemini API terms and policies.</p>'
if needle in s:
    s = s.replace(needle, replacement, 1)
p.write_text(s, encoding='utf-8')

# Make the server prompt consistent with the public product name.
p = ROOT / 'supabase/functions/ai-coach/index.ts'
s = p.read_text(encoding='utf-8').replace('FitTrack (Fifty Fit)', 'FitTrack')
p.write_text(s, encoding='utf-8')

print('final launch cleanup prepared')
