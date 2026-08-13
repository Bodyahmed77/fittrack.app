import { Keyboard } from "@capacitor/keyboard";

function findAiPanel() {
  const nodes = [...document.querySelectorAll("div")];
  return nodes.find((el) => {
    const cs = getComputedStyle(el);
    const parent = el.parentElement ? getComputedStyle(el.parentElement) : null;
    return cs.position === "absolute" && parent?.position === "fixed" && parent?.zIndex === "1200" && String(cs.width || "").includes("360px");
  }) || null;
}

function setPanelKeyboardOffset(height) {
  const panel = findAiPanel();
  if (!panel) return;
  const px = Math.max(0, Number(height) || 0);
  panel.style.setProperty("bottom", `${px}px`, "important");
  panel.style.setProperty("height", `calc(100% - ${px}px)`, "important");
  panel.style.setProperty("max-height", `calc(100% - ${px}px)`, "important");
}

Keyboard.addListener("keyboardWillShow", (event) => {
  setPanelKeyboardOffset(event?.keyboardHeight || 0);
});
Keyboard.addListener("keyboardDidShow", (event) => {
  setPanelKeyboardOffset(event?.keyboardHeight || 0);
});
Keyboard.addListener("keyboardWillHide", () => setPanelKeyboardOffset(0));
Keyboard.addListener("keyboardDidHide", () => setPanelKeyboardOffset(0));
