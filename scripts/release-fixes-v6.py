from pathlib import Path
import re

# Start from the already-verified deterministic v5 patch set.
exec(Path('scripts/release-fixes-v5.py').read_text(encoding='utf-8'), {'__name__': '__release_fixes_v5__'})

APP = Path('src/App.jsx')
text = APP.read_text(encoding='utf-8')

# v6 must patch the viewer that is actually present after v5. Do not depend on
# the old exact whitespace/header from an earlier App.jsx revision. Keep the
# existing full-screen JSX/UI intact and replace only the viewer's setup logic.
marker = 'function FullScreenVideoViewer({ videoId, ar, onClose }) {'
start = text.find(marker)
if start < 0:
    raise SystemExit('v6: FullScreenVideoViewer function not found')
return_marker = '  return ('
return_pos = text.find(return_marker, start)
if return_pos < 0:
    raise SystemExit('v6: FullScreenVideoViewer return block not found')

new_header = '''function FullScreenVideoViewer({ videoId, ar, onClose }) {
  const [videoLoaded, setVideoLoaded] = useState(false);
  const rawVideoId = String(videoId || "").trim();
  const isTikTokUrl = /tiktok\\.com/i.test(rawVideoId);
  const isTikTokNumericId = /^\\d+$/.test(rawVideoId);
  const isTikTok = isTikTokUrl || isTikTokNumericId;

  // Keep admin/configured TikTok URLs exactly as supplied. The viewer is a
  // full-screen in-app iframe; it must not rewrite the URL through oEmbed,
  // resolve short links, or launch the TikTok application. Numeric legacy IDs
  // are the only case that needs TikTok's documented player URL.
  const embedSrc = isTikTokNumericId
    ? `https://www.tiktok.com/player/v1/${rawVideoId}?music_info=1&description=1`
    : isTikTokUrl
      ? rawVideoId
      : `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;

  useEffect(() => {
    setVideoLoaded(false);
    registerFullScreenVideoClose(() => {
      onClose();
      return true;
    });
    return () => registerFullScreenVideoClose(null);
  }, [onClose, rawVideoId]);

'''
text = text[:start] + new_header + text[return_pos:]

# The TikTok web page is being hosted inside our iframe, so do not force the
# stricter referrer policy that can cause TikTok's web response to reject the
# embedded request. This does not change or expose the stored video URL.
text = text.replace(
    'referrerPolicy="strict-origin-when-cross-origin"',
    'referrerPolicy="no-referrer-when-downgrade"',
    1,
)

APP.write_text(text, encoding='utf-8')

# Build-time assertions: fail only if the intended current viewer was not
# actually patched. In particular, never silently ship the oEmbed/redirect
# implementation that caused the 404 behavior.
text = APP.read_text(encoding='utf-8')
assert 'const rawVideoId = String(videoId || "").trim();' in text
assert 'const isTikTokUrl = /tiktok\\.com/i.test(rawVideoId);' in text
assert 'const isTikTokNumericId = /^\\d+$/.test(rawVideoId);' in text
assert ': rawVideoId' in text
assert 'https://www.tiktok.com/oembed?url=' not in text
assert 'resolveTikTokCanonicalWebUrl' not in text
assert 'referrerPolicy="no-referrer-when-downgrade"' in text
print('Release fixes v6 applied successfully')
print('TikTok viewer keeps the configured normal URL inside the full-screen in-app iframe')
print('TikTok oEmbed/canonical URL rewriting is disabled')
