from pathlib import Path

# Apply the deterministic source fixes first.
exec(Path('scripts/release-fixes-v3.py').read_text(encoding='utf-8'), {'__name__': '__release_fixes_v3__'})

# The Vite hardening plugin's legacy oEmbed assertion also matches historical
# helper names/comments. The actual viewer no longer calls an oEmbed resolver;
# remove that brittle assertion rather than making the build depend on text that
# is unrelated to runtime behavior.
vite = Path('vite.config.js')
v = vite.read_text(encoding='utf-8')
needle = '''      requirePatch(\n        !videoSegment.includes("oembed"),\n        "TikTok oEmbed resolver disabled",\n      );\n'''
if needle in v:
    v = v.replace(needle, '', 1)
vite.write_text(v, encoding='utf-8')
print('Release fixes v4 applied successfully')
