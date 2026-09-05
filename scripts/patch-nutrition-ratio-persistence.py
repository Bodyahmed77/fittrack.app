from pathlib import Path

APP = Path("src/App.jsx")
text = APP.read_text(encoding="utf-8")

EFFECT = '''\n  // User-selected nutrition ratios remain authoritative when calories are\n  // recalculated elsewhere (for example after a weight/profile change).\n  useEffect(() => {\n    const pref = data?.nutritionMacroPreferences;\n    const kcal = Number(data?.dailyTargets?.kcal);\n    if (!pref || !Number.isFinite(kcal) || kcal <= 0) return;\n    const cp = Number(pref.carbsPct);\n    const pp = Number(pref.proteinPct);\n    const fp = Number(pref.fatPct);\n    if (![cp, pp, fp].every(Number.isFinite) || Math.round(cp + pp + fp) !== 100) return;\n    const nextTargets = {\n      ...(data.dailyTargets || {}),\n      kcal: Math.round(kcal),\n      carbs: Math.round((kcal * cp / 100) / 4),\n      protein: Math.round((kcal * pp / 100) / 4),\n      fat: Math.round((kcal * fp / 100) / 9),\n    };\n    const same =\n      Number(data?.dailyTargets?.kcal) === nextTargets.kcal &&\n      Number(data?.dailyTargets?.carbs) === nextTargets.carbs &&\n      Number(data?.dailyTargets?.protein) === nextTargets.protein &&\n      Number(data?.dailyTargets?.fat) === nextTargets.fat;\n    if (!same) setData({ ...data, dailyTargets: nextTargets });\n  }, [data?.nutritionMacroPreferences, data?.dailyTargets?.kcal, data?.dailyTargets?.carbs, data?.dailyTargets?.protein, data?.dailyTargets?.fat]);\n'''

if 'User-selected nutrition ratios remain authoritative' in text:
    print('nutrition ratio persistence already applied')
    raise SystemExit(0)

anchor = '''  const { data, setData, setVerifiedEntitlements, loaded, writePending, saveError } = useAppData(\n    firebaseUser?.uid,\n  );'''
if anchor not in text:
    raise SystemExit('nutrition ratio patch: GymApp data hook anchor not found')
text = text.replace(anchor, anchor + EFFECT, 1)
APP.write_text(text, encoding='utf-8')
print('nutrition ratio persistence applied')
