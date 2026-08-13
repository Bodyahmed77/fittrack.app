/* Fifty Fit — Pro Nutrition UX enhancement
 * Presentation-only layer over the existing NutritionPlanScreen.
 * Existing checkboxes, Firestore logging, targets and progress calculations
 * remain the source of truth. This layer only improves hierarchy/feedback.
 */
const MARKER = "data-fiftyfit-pro-nutrition";

function findScreen() {
  const root = document.getElementById("root");
  if (!root) return null;
  const title = [...root.querySelectorAll("div")].find((el) => {
    const t = (el.textContent || "").trim();
    return t === "Your Nutrition Plan" || t === "خطتك الغذائية";
  });
  return title?.closest("div[dir]") || null;
}

function enhance() {
  const screen = findScreen();
  if (!screen) return;

  if (screen.getAttribute(MARKER) !== "1") {
    screen.setAttribute(MARKER, "1");

    // Keep the existing black/white identity. Add only subtle structure.
    const cards = [...screen.querySelectorAll("div")].filter((el) => {
      const s = getComputedStyle(el);
      return s.borderRadius !== "0px" && el.children.length > 0 && s.backgroundColor;
    });
    cards.slice(0, 10).forEach((el) => {
      if (!el.dataset.ffNutritionTouched) {
        el.dataset.ffNutritionTouched = "1";
        if (!el.style.border || el.style.border === "none") {
          el.style.border = "1px solid rgba(255,255,255,.10)";
        }
        el.style.boxShadow = "0 8px 30px rgba(0,0,0,.18)";
      }
    });
  }

  // Improve tap targets for existing food-item buttons without replacing their
  // handlers. The underlying React component remains responsible for toggling.
  [...screen.querySelectorAll("button")].forEach((button) => {
    const text = (button.textContent || "").trim();
    if (!text || text === "Back" || text === "رجوع") return;
    if (/\d+\s*(g|ج|kcal|سعرة)/i.test(text)) {
      button.style.minHeight = "58px";
      button.style.borderRadius = "12px";
      button.style.paddingInline = "8px";
      button.style.transition = "background .2s ease, transform .15s ease";
    }
  });

  // Make the daily summary card visually dominant while preserving its existing
  // progress values and text.
  const firstCard = [...screen.querySelectorAll("div")].find((el) => {
    const t = (el.textContent || "").trim();
    return /Calories|السعرات/i.test(t) && /Protein|البروتين/i.test(t) && /Carbs|الكارب/i.test(t);
  });
  if (firstCard && !firstCard.dataset.ffNutritionHero) {
    firstCard.dataset.ffNutritionHero = "1";
    firstCard.style.borderColor = "rgba(255,255,255,.18)";
    firstCard.style.padding = "16px";
  }
}

let queued = false;
const observer = new MutationObserver(() => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; enhance(); });
});
observer.observe(document.getElementById("root") || document.body, { childList: true, subtree: true });
requestAnimationFrame(enhance);
