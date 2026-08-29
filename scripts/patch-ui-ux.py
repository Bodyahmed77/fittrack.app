#!/usr/bin/env python3
"""UI/UX fixes applied at build time (idempotent):

1) getUsableExercises: user-added custom exercises are always free (not capped).
2) Root shell: block horizontal page scroll (overflow-x hidden).
3) TopBar / AI Coach safe-area (delegates to patterns already in patch-fullscreen-ui).
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src" / "App.jsx"
MAIN = ROOT / "src" / "main.jsx"


OLD_USABLE = '''function getUsableExercises(data, day) {
  const base = getMergedExercises(data, day);
  const pro = !!data.entitlements.trainingPro;
  const customActive = isCustomTrainingPlanActive(data);
  const freeBase = customActive || pro
    ? base
    : base.slice(0, FREE_EXERCISE_CAP);
  const lockedCount = customActive || pro
    ? 0
    : Math.max(0, base.length - FREE_EXERCISE_CAP);
  return {
    list: freeBase,
    lockedCount,
  };
}'''

NEW_USABLE = '''function getUsableExercises(data, day) {
  // Template exercises may be capped on free; user-added custom exercises
  // (customPlan[day].added) are always available for free — that is a core
  // free feature of Fifty Fit.
  const pro = !!data.entitlements.trainingPro;
  const customActive = isCustomTrainingPlanActive(data);
  const activePlan =
    PLAN_TEMPLATES[data.activePlanId] || PLAN_TEMPLATES.beginner;
  const customTrainingDay = isCustomTrainingPlanActive(data)
    ? data.customTrainingPlan?.days?.[DAYS.indexOf(day)]
    : null;
  const templateBase = customTrainingDay
    ? (customTrainingDay.exercises || []).map((e) => ({
        ...EX[e.id],
        ...e,
        name: e.name || EX[e.id]?.name || e.id,
        nameAr: e.nameAr || EX[e.id]?.nameAr || e.name || e.id,
        startWeight: e.startWeight ?? EX[e.id]?.startWeight ?? 0,
        vid: e.vid || EX[e.id]?.vid || null,
        demoImage: e.demoImage || EX[e.id]?.demoImage || null,
      }))
    : (activePlan.schedule[day]?.exercises || []);
  const custom = data.customPlan[day] || { added: [], removedIds: [] };
  const removed = new Set(custom.removedIds || []);
  const added = custom.added || [];
  const templateVisibleAll = templateBase.filter((e) => !removed.has(e.id));
  if (customActive || pro) {
    return { list: [...templateVisibleAll, ...added], lockedCount: 0 };
  }
  const freeTemplate = templateVisibleAll.slice(0, FREE_EXERCISE_CAP);
  const lockedCount = Math.max(0, templateVisibleAll.length - FREE_EXERCISE_CAP);
  return {
    list: [...freeTemplate, ...added],
    lockedCount,
  };
}'''


def patch_app() -> str:
    if not APP.is_file():
        return "App.jsx missing"
    src = APP.read_text(encoding="utf-8")
    original = src
    if "user-added custom exercises" in src and "always available for free" in src:
        return "getUsableExercises already free-custom"
    if OLD_USABLE not in src:
        return "WARN: getUsableExercises pattern not found"
    src = src.replace(OLD_USABLE, NEW_USABLE, 1)
    if src != original:
        APP.write_text(src, encoding="utf-8")
        return "getUsableExercises: custom adds always free"
    return "no change"


def patch_main() -> str:
    if not MAIN.is_file():
        return "main.jsx missing"
    src = MAIN.read_text(encoding="utf-8")
    original = src
    notes = []

    if "overflowX" not in src and "overflow-x" not in src:
        old = '''  document.documentElement.style.backgroundColor = bg;
  document.documentElement.style.minHeight = "100%";
  if (document.body) {
    document.body.style.backgroundColor = bg;
    document.body.style.color = isDark ? "#ffffff" : "#000000";
    document.body.style.margin = "0";
    document.body.style.minHeight = "100%";
  }
  const root = document.getElementById("root");
  if (root) {
    root.style.minHeight = "100vh";
    root.style.minHeight = "100dvh";
    root.style.backgroundColor = bg;
  }'''
        new = '''  document.documentElement.style.backgroundColor = bg;
  document.documentElement.style.minHeight = "100%";
  document.documentElement.style.overflowX = "hidden";
  document.documentElement.style.width = "100%";
  if (document.body) {
    document.body.style.backgroundColor = bg;
    document.body.style.color = isDark ? "#ffffff" : "#000000";
    document.body.style.margin = "0";
    document.body.style.minHeight = "100%";
    document.body.style.overflowX = "hidden";
    document.body.style.width = "100%";
    document.body.style.position = "relative";
  }
  const root = document.getElementById("root");
  if (root) {
    root.style.minHeight = "100vh";
    root.style.minHeight = "100dvh";
    root.style.backgroundColor = bg;
    root.style.overflowX = "hidden";
    root.style.width = "100%";
    root.style.maxWidth = "100vw";
  }'''
        if old in src:
            src = src.replace(old, new, 1)
            notes.append("overflow-x hidden on html/body/root")
        else:
            notes.append("WARN: syncDocumentChrome block not matched")

    old_hide = '''    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setBackgroundColor({ color: dark ? "#000000" : "#ffffff" });
    await StatusBar.setStyle({ style: dark ? Style.Light : Style.Dark });
    // Immersive: hide status bar icons (Wi‑Fi, clock, battery) so the app owns the top edge.
    await StatusBar.hide();'''
    new_show = '''    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setBackgroundColor({ color: dark ? "#000000" : "#ffffff" });
    await StatusBar.setStyle({ style: dark ? Style.Light : Style.Dark });
    // Keep status bar visible but fully black so the top edge matches the app
    // (hiding it on some devices leaves a gray system margin instead).
    await StatusBar.show();'''
    if old_hide in src:
        src = src.replace(old_hide, new_show, 1)
        notes.append("StatusBar.show black overlay instead of hide")
    elif "StatusBar.show()" in src:
        notes.append("StatusBar.show already set")
    else:
        notes.append("WARN: StatusBar hide block not matched")

    if src != original:
        MAIN.write_text(src, encoding="utf-8")
    return "; ".join(notes) if notes else "main unchanged"


def main() -> None:
    print("patch-ui-ux App:", patch_app())
    print("patch-ui-ux main:", patch_main())


if __name__ == "__main__":
    main()
