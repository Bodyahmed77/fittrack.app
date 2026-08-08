// ============================================================
// AI Coach — session-only chat + daily message limits
// ============================================================
// Conversation messages live ONLY in React state for the open
// session. They are never written to Firestore or localStorage.
// Only a lightweight daily counter (date + count) is persisted
// on the user profile to enforce free/pro limits across opens.
// ============================================================

import {
  FREE_AI_MESSAGES_PER_DAY,
  PRO_AI_MESSAGES_PER_DAY,
} from "./config";

export function aiDailyLimit(hasAiPro) {
  return hasAiPro ? PRO_AI_MESSAGES_PER_DAY : FREE_AI_MESSAGES_PER_DAY;
}

/** Returns { used, limit, remaining, date } for today (local calendar). */
export function aiUsageToday(data, todayISO) {
  const hasPro = !!data?.entitlements?.aiCoachPro;
  const limit = aiDailyLimit(hasPro);
  const usage = data?.aiUsage || {};
  const used =
    usage.date === todayISO && Number.isFinite(Number(usage.count))
      ? Number(usage.count)
      : 0;
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    date: todayISO,
    hasPro,
  };
}

/** Increment the persisted daily counter (not the chat transcript). */
export function bumpAiUsage(data, todayISO) {
  const usage = data?.aiUsage || {};
  const prev =
    usage.date === todayISO && Number.isFinite(Number(usage.count))
      ? Number(usage.count)
      : 0;
  return { date: todayISO, count: prev + 1 };
}

/**
 * Generate a fitness/nutrition coach reply.
 * Prefer a configured remote endpoint; otherwise use a safe local
 * knowledge fallback so the feature works offline / without keys.
 *
 * Set window.__FIFTYFIT_AI_ENDPOINT__ (or VITE_AI_ENDPOINT at build)
 * to a POST JSON { messages, lang } → { reply } service when ready.
 */
export async function generateCoachReply({ messages, lang, userContext }) {
  const endpoint =
    (typeof window !== "undefined" && window.__FIFTYFIT_AI_ENDPOINT__) ||
    (typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env.VITE_AI_ENDPOINT) ||
    "";

  if (endpoint) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages.slice(-8), // cost control — short context window
          lang,
          context: userContext || {},
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.reply) return String(data.reply);
      }
    } catch (e) {
      console.warn("AI endpoint failed, using local coach", e);
    }
  }

  return localCoachReply(messages, lang, userContext);
}

function localCoachReply(messages, lang, ctx = {}) {
  const ar = lang === "ar";
  const last = (messages[messages.length - 1]?.content || "").toLowerCase();
  const original = messages[messages.length - 1]?.content || "";

  // Medical caution
  if (
    /diagnos|مرض|دواء|medicine|doctor|طبيب|ألم صدر|chest pain|suicide|انتحار/.test(
      last,
    )
  ) {
    return ar
      ? "أنا مدرب لياقة وتغذية، مش بديل عن طبيب. لأي عرض طبي أو دوائي راجع متخصص صحي مؤهل."
      : "I'm a fitness & nutrition coach, not a doctor. For medical symptoms or medication questions, please see a qualified clinician.";
  }

  if (/protein|بروتين/.test(last)) {
    const w = Number(ctx.weight) || 70;
    const g = Math.round(w * 1.8);
    return ar
      ? `هدف بروتين تقريبي حسب وزنك (~${w} كجم): حوالي ${g} جرام في اليوم. وزّعه على 3–4 وجبات. مصادر كويسة: صدور فراخ، بيض، زبادي يوناني، سمك، بقوليات.`
      : `A solid protein target for ~${w} kg is about ${g} g/day, split across 3–4 meals. Good sources: chicken breast, eggs, Greek yogurt, fish, legumes.`;
  }

  if (/calorie|سعرات|كالوري|عجز|deficit|bulk|زيادة وزن|خسارة/.test(last)) {
    return ar
      ? "للتنشيف: عجز سعرات معتدل (~300–500 تحت الاحتياج) مع بروتين عالي وتمارين مقاومة. للتضخيم: فائض بسيط (~200–300) مع تركيز على البروتين والتدرج في الأوزان. استخدم شاشة التغذية في التطبيق لأهدافك الدقيقة."
      : "Fat loss: a moderate calorie deficit (~300–500 below maintenance) plus high protein and resistance training. Muscle gain: a small surplus (~200–300) with progressive overload. Use the in-app nutrition targets for your exact numbers.";
  }

  if (/squat|deadlift|bench|تمرين|exercise|form|تكنيك|ظهر|صدر|أرجل/.test(last)) {
    return ar
      ? "ركّز على تكنيك سليم قبل زيادة الوزن: تحكم كامل في المدى، تنفس ثابت، وتوقف قبل فشل الشكل. لو تمرين معين مؤلم بشكل حاد، وقّفه وراجع فورم أو بديل أخف. تقدر تشوف فيديو التمرين من شاشة التمرين داخل التطبيق."
      : "Prioritize clean form before heavier loads: full control through the range, steady breathing, and stop before form breaks. Sharp joint pain means stop and regress. Open any exercise in the Workout screen for the demo video.";
  }

  if (/motiv|كسل|تعبان|tired|consistency|انتظام|هقلع/.test(last)) {
    return ar
      ? "الانتظام أهم من المثالية. لو مش قادر تعمل التمرين كامل، اعمل نصّه. سلسلة أيام قصيرة متتابعة بتبني عادة أقوى من جلسة وحيدة مثالية. ابدأ دلوقتي بأصغر خطوة."
      : "Consistency beats perfection. If you can't do the full session, do half. Short consecutive days build a stronger habit than one perfect workout. Start with the smallest next step.";
  }

  if (/meal|وجبه|فطور|غداء|عشا|أكل|food|diet/.test(last)) {
    return ar
      ? "وجبه متوازنة: بروتين + كارب معقّد + خضار + دهون صحية. مثال مصري: صدور/بانية مشوية + رز أو عيش بلدي + سلطة + ملعقة طحينة. سجّل الأكل في شاشة الوجبات عشان تتابع السعرات."
      : "Build meals around protein + complex carbs + vegetables + healthy fat. Example: grilled chicken + rice or whole bread + salad + a spoon of tahini. Log meals in the app to stay on target.";
  }

  // Default
  if (ar) {
    return (
      "أنا مدرب Fifty Fit 💪 اسألني عن التمارين، التغذية، السعرات، البروتين، أو التحفيز. " +
      (original.trim()
        ? `بخصوص سؤالك: ركّز على الانتظام، بروتين كافي، ونوم كويس — ولو حددت أكتر (تمرين معيّن أو هدف وزن) أقدر أدقّق الإجابة.`
        : "اكتب سؤالك بصراحة بالعربي أو الإنجليزي.")
    );
  }
  return (
    "I'm the Fifty Fit coach 💪 Ask about workouts, nutrition, calories, protein, or motivation. " +
    (original.trim()
      ? "For your question: prioritize consistency, enough protein, and sleep — share a specific exercise or goal and I'll get more precise."
      : "Write your question in English or Arabic.")
  );
}
