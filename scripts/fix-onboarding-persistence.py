from pathlib import Path

APP = Path("src/App.jsx")
text = APP.read_text(encoding="utf-8")

start = text.find("function useAppData(")
end = text.find("\nfunction nutritionCycleState", start)
if start < 0 or end < 0:
    raise SystemExit("fix-onboarding-persistence: useAppData scope not found")

store = text[start:end]

if "const latestLocalWriteAtRef = useRef(null);" not in store:
    marker = "  const verifiedEntitlementsRef = useRef(null);"
    if marker not in store:
        raise SystemExit("fix-onboarding-persistence: write ref marker not found")
    store = store.replace(
        marker,
        marker + "\n  const latestLocalWriteAtRef = useRef(null);",
        1,
    )

old_guard = '''        const snapUpdatedAt = String(parsed.updatedAt || "");
        const latestLocalWriteAt = String(latestLocalWriteAtRef.current || "");
        if (
          latestLocalWriteAt &&
          snapUpdatedAt &&
          snapUpdatedAt < latestLocalWriteAt
        ) {
          return;
        }
'''

new_guard = '''        const snapUpdatedAt = String(parsed.updatedAt || "");
        const latestLocalWriteAt = String(latestLocalWriteAtRef.current || "");
        if (latestLocalWriteAt) {
          // A snapshot without updatedAt is the cached/initial Firestore
          // document and must never overwrite a newer local write.
          if (!snapUpdatedAt || snapUpdatedAt < latestLocalWriteAt) return;
          // This snapshot contains our write (or something newer), so the
          // pending-write guard can be cleared safely.
          latestLocalWriteAtRef.current = null;
        }
'''

if old_guard in store:
    store = store.replace(old_guard, new_guard, 1)
elif "const latestLocalWriteAt = String(latestLocalWriteAtRef.current || \"\");" not in store:
    marker = "        const merged = {\n"
    if marker not in store:
        raise SystemExit("fix-onboarding-persistence: snapshot merge marker not found")
    store = store.replace(marker, new_guard + marker, 1)

write_marker = '''        const updatedAt = new Date().toISOString();
        latestLocalWriteAtRef.current = updatedAt;
        await setDoc(
'''
if write_marker not in store:
    old_write = '''        await setDoc(
          doc(db, "users", uid),
          { ...persisted, updatedAt: new Date().toISOString() },
          { merge: true },
        );'''
    new_write = '''        const updatedAt = new Date().toISOString();
        latestLocalWriteAtRef.current = updatedAt;
        await setDoc(
          doc(db, "users", uid),
          { ...persisted, updatedAt },
          { merge: true },
        );'''
    if old_write not in store:
        raise SystemExit("fix-onboarding-persistence: setData write marker not found")
    store = store.replace(old_write, new_write, 1)

text = text[:start] + store + text[end:]
APP.write_text(text, encoding="utf-8")
print("fix-onboarding-persistence: Firestore cached-snapshot race guard applied")
