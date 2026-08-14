from pathlib import Path

exec(Path('scripts/release-fixes-v5.py').read_text(encoding='utf-8'), {'__name__': '__release_fixes_v5__'})

APP = Path('src/App.jsx')
text = APP.read_text(encoding='utf-8')

old = '''function FullScreenVideoViewer({ videoId, ar, onClose }) {\n  const [videoLoaded, setVideoLoaded] = useState(false);\n  const looksTikTok = /tiktok\\.com/i.test(String(videoId || "")) || /^\\d+$/.test(String(videoId || ""));\n  const isTikTok = looksTikTok;\n  const embedSrc = isTikTok\n    ? String(videoId || "")\n    : `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;\n\n  useEffect(() => {\n    let cancelled = false;\n    setVideoLoaded(false);\n    registerFullScreenVideoClose(() => {\n      onClose();\n      return true;\n    });\n    return () => registerFullScreenVideoClose(null);\n  }, [onClose]);'''

new = '''async function resolveTikTokCanonicalWebUrl(value) {\n  const raw = String(value || "").trim();\n  if (!raw || !/tiktok\\.com/i.test(raw)) return raw;\n  if (/^https?:\\/\\/www\\.tiktok\\.com\\/@[^/]+\\/video\\/\\d+/i.test(raw)) return raw;\n  try {\n    const response = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(raw)}`);\n    if (!response.ok) return raw;\n    const payload = await response.json();\n    const html = String(payload?.html || "");\n    const cite = html.match(/\\bcite=["']([^"']+)["']/i)?.[1];\n    return cite || raw;\n  } catch {\n    return raw;\n  }\n}\n\nfunction FullScreenVideoViewer({ videoId, ar, onClose }) {\n  const [videoLoaded, setVideoLoaded] = useState(false);\n  const [webUrl, setWebUrl] = useState(String(videoId || ""));\n  const rawVideoId = String(videoId || "").trim();\n  const isTikTokUrl = /tiktok\\.com/i.test(rawVideoId);\n  const isTikTokNumericId = /^\\d+$/.test(rawVideoId);\n  const isTikTok = isTikTokUrl || isTikTokNumericId;\n  const embedSrc = isTikTokNumericId\n    ? `https://www.tiktok.com/player/v1/${rawVideoId}?music_info=1&description=1`\n    : isTikTokUrl\n      ? webUrl\n      : `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;\n\n  useEffect(() => {\n    let cancelled = false;\n    setVideoLoaded(false);\n    setWebUrl(rawVideoId);\n    if (isTikTokUrl) {\n      resolveTikTokCanonicalWebUrl(rawVideoId).then((resolved) => {\n        if (!cancelled) setWebUrl(resolved || rawVideoId);\n      });\n    }\n    registerFullScreenVideoClose(() => {\n      onClose();\n      return true;\n    });\n    return () => {\n      cancelled = true;\n      registerFullScreenVideoClose(null);\n    };\n  }, [isTikTokUrl, onClose, rawVideoId]);'''

if old not in text:
    raise SystemExit('v6: expected FullScreenVideoViewer block not found')
text = text.replace(old, new, 1)
text = text.replace('referrerPolicy="strict-origin-when-cross-origin"', 'referrerPolicy="no-referrer-when-downgrade"', 1)
APP.write_text(text, encoding='utf-8')

text = APP.read_text(encoding='utf-8')
assert 'resolveTikTokCanonicalWebUrl' in text
assert 'isTikTokNumericId' in text
assert 'isTikTokUrl' in text
assert 'https://www.tiktok.com/player/v1/${rawVideoId}' in text
assert 'referrerPolicy="no-referrer-when-downgrade"' in text
print('Release fixes v6 applied successfully')
