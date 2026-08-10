# TikTok Full-Screen Video Viewer

## Problem
Inline TikTok iframe inside Exercise Screen captured vertical pans (cross-origin), so users could not scroll to Sets/Reps/Weight from the middle of the video.

## Solution
Architectural change (no gesture hacks):

1. **Exercise Screen** — only a "Watch Short" / "دوس على الشورت" button. No TikTok iframe in the page DOM when the viewer is closed.
2. **FullScreenVideoViewer** — mounts only when open; `position: fixed; inset: 0; z-index: 4000`; TikTok/YouTube embed fully interactive.
3. **Android Back / Close** — closes viewer only; returns to the same Exercise Screen state (sets/reps/weight preserved).
4. Same `EXERCISE_VIDEOS` IDs — no mapping changes.

Removed: gesture overlays, `preventDefault` on touchmove, `pointer-events` tricks, `iframeInteractive` modes.

## Apply
Replace `src/App.jsx` with the full file from the PR agent (~12384 lines) containing `FullScreenVideoViewer` and the simplified `VideoPlayer`.

```bash
grep -c FullScreenVideoViewer src/App.jsx  # expect > 0
grep -c iframeInteractive src/App.jsx       # expect 0
grep -c keyboardInset src/App.jsx           # AI Coach still present
```

## Untouched
Google Auth, AI Coach/keyboard, system bars, billing, Firebase.

## Testing
NOT VERIFIED ON REAL ANDROID DEVICE until APK is built and tested.
