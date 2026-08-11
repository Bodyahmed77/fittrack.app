from pathlib import Path
import re

p = Path('src/privacy.js')
s = p.read_text(encoding='utf-8')

report = "If you report an AI answer, the reported answer snippet and your report reason are stored in Supabase so we can review safety and quality issues."
s = re.sub(r'(?:\s*' + re.escape(report) + r'){2,}', ' ' + report, s)

medical = "AI Coach is for general fitness and nutrition guidance only and should not be used for diagnosis, treatment, or emergency decisions."
s = re.sub(r'(?:\s*' + re.escape(medical) + r'){2,}', ' ' + medical, s)

# Explicitly disclose optional phone information if the user chooses to provide it.
s = s.replace(
    '• Account Information: name, email address, and Google sign-in information.',
    '• Account Information: name, email address, Google sign-in information, and an optional phone number if you choose to provide one for support.',
    1,
)
p.write_text(s, encoding='utf-8')

# Keep the public static policy aligned with the normalized wording.
p = Path('docs/privacy-policy.html')
if p.exists():
    s = p.read_text(encoding='utf-8')
    s = re.sub(r'(If you report an AI answer,.*?quality issues\.)(?:\s*\1)+', r'\1', s)
    p.write_text(s, encoding='utf-8')
print('legal text normalized')
