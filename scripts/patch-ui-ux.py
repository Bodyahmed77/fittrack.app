#!/usr/bin/env python3
"""UI/UX fixes applied at build time (idempotent).

1) User-added custom exercises are always free.
2) Root shell blocks horizontal page scroll.
3) Native status bar stays visible with a matching background.
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
  const pro = !!data.entitlements.trainingPro;
  const customActive = isCustomTrainingPlanActive(data);
  const activePlan =
    PLAN_TEMPLATES[data.activePlanId] || PLAN_TEMPLATES.beginner;
  const customTrainingDay = isCustomTrainingPlanActive(data)
    ? data.customTrainingPlan?.days?.[DAYS.indexOf(day)]
    : null;
  const templateBase = customTrainingDay
    ? (customTrainingDay.exercises || []).map((e) => ({
        ...EX[e.id], ...e,
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
  if (customActive || pro) return { list: [...templateVisibleAll, ...added], lockedCount: 0 };
  const freeTemplate = templateVisibleAll.slice(0, FREE_EXERCISE_CAP);
  return {
    list: [...freeTemplate, ...added],
    lockedCount: Math.max(0, templateVisibleAll.length - FREE_EXERCISE_CAP),
  };
}'''


def patch_app() -> str:
    src = APP.read_text(encoding="utf-8")
    if "user-added custom exercises" in src and "always available for free" in src:
        return "already applied"
    if OLD_USABLE not in src:
        return "INFO: exercise cap handled by a later transform"
    APP.write_text(src.replace(OLD_USABLE, NEW_USABLE, 1), encoding="utf-8")
    return "custom adds always free"


def patch_main() -> str:
    src = MAIN.read_text(encoding="utf-8")
    original = src
    notes = []

    if "document.documentElement.style.overflowX" not in src:
        old = '''  document.documentElement.style.backgroundColor = bg;
  document.documentElement.style.minHeight = "100%";
  if (document.body) {
    document.body.style.backgroundColor = bg;
    document.body.style.color = isDark ? "#ffffff" : "#000000";
    document.body.style.margin = "0";
    document.body.style.minHeight = "100%";
  }
  const root = document.getElementById("root");'''
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
  }
  const root = document.getElementById("root");'''
        if old in src:
            src = src.replace(old, new, 1)
            notes.append("overflow-x guarded")
        else:
            notes.append("INFO: overflow guard already supplied elsewhere")

    if "await StatusBar.hide();" in src:
        src = src.replace("    await StatusBar.hide();", "    await StatusBar.show();", 1)
        notes.append("StatusBar.show")
    elif "await StatusBar.show();" in src:
        notes.append("StatusBar.show already applied")
    else:
        notes.append("INFO: status bar handled by current source")

    if src != original:
        MAIN.write_text(src, encoding="utf-8")
    return "; ".join(notes) if notes else "unchanged"


def main() -> None:
    print("patch-ui-ux App:", patch_app())
    print("patch-ui-ux main:", patch_main())

if __name__ == "__main__":
    main()
