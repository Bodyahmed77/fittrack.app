import fs from 'node:fs';
const p='src/App.jsx';
let s=fs.readFileSync(p,'utf8');
s=s.replace('  const [resolvedTikTokId, setResolvedTikTokId] = useState(() => extractTikTokVideoId(videoId));\n  const [videoResolveError, setVideoResolveError] = useState(false);\n','');
s=s.replace('    setVideoResolveError(false);\n    setResolvedTikTokId(extractTikTokVideoId(videoId));\n    if (looksTikTok && !extractTikTokVideoId(videoId)) {\n      resolveTikTokVideoId(videoId)\n        .then((id) => { if (!cancelled) setResolvedTikTokId(id); })\n        .catch(() => { if (!cancelled) setVideoResolveError(true); });\n    }\n','');
s=s.replace('        {videoResolveError && (\n          <div style={{ position: "absolute", inset: 0, zIndex: 2, display: "grid", placeItems: "center", padding: 24, textAlign: "center", background: C.card2, color: C.sub, fontSize: 13 }}>\n            {ar ? "تعذر تحميل فيديو TikTok" : "Could not load the TikTok video"}\n          </div>\n        )}\n','');
fs.writeFileSync(p,s);
try{fs.rmSync('scripts/cleanup-tiktok.mjs')}catch{}
try{fs.rmSync('.github/workflows/cleanup-tiktok.yml')}catch{}
