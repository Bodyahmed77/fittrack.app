from pathlib import Path

APP = Path("src/App.jsx")
text = APP.read_text(encoding="utf-8")

IMPORT = 'import NutritionGoalsScreen from "./nutritionGoals";\n'
if IMPORT not in text:
    marker = 'import { deleteAccountServerData } from "./deleteAccount";\n'
    if marker not in text:
        raise SystemExit("nutrition goals patch: import marker not found")
    text = text.replace(marker, marker + IMPORT, 1)

ROUTE = '''  else if (screen === "nutritionGoals")
    content = (
      <NutritionGoalsScreen
        data={data}
        setData={setData}
        back={back}
        showToast={showToast}
      />
    );
'''
if 'screen === "nutritionGoals"' not in text:
    marker = '  else if (screen === "foodPicker")\n'
    if marker not in text:
        raise SystemExit("nutrition goals patch: route marker not found")
    text = text.replace(marker, ROUTE + marker, 1)

BUTTON = '''\n        <Card\n          onClick={() => go("nutritionGoals")}\n          style={{\n            marginBottom: 12,\n            display: "flex",\n            alignItems: "center",\n            gap: 12,\n            background: C.greenSoft,\n            border: `1px solid ${C.green}55`,\n          }}\n        >\n          <div style={{ width: 40, height: 40, borderRadius: 11, background: C.card2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🎯</div>\n          <div style={{ flex: 1 }}>\n            <div style={{ color: C.text, fontWeight: 800, fontSize: 13.5 }}>\n              {ar ? "تخصيص السعرات والماكروز" : "Customize Calories & Macros"}\n            </div>\n            <div style={{ color: C.sub, fontSize: 11.5, marginTop: 2 }}>\n              {ar ? "حدد السعرات ونسبة الكارب والبروتين والدهون بنفسك" : "Set your calorie and carb/protein/fat ratios yourself"}\n            </div>\n          </div>\n          <ChevronRight size={17} color={C.sub2} style={{ transform: ar ? "scaleX(-1)" : "none" }} />\n        </Card>\n'''
if 'Customize Calories & Macros' not in text:
    marker = '''        <div\n          style={{\n            marginTop: 16,\n            display: "flex",\n            flexDirection: "column",\n            gap: 10,\n          }}\n        >\n          {MEAL_ITEMS.map'''
    if marker not in text:
        raise SystemExit("nutrition goals patch: meals marker not found")
    text = text.replace(marker, BUTTON + marker, 1)

APP.write_text(text, encoding="utf-8")
print("nutrition goals patch applied")
