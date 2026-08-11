# App.jsx wiring for FitTrack-aware AI Coach

The Edge Function and `src/aiCoachContext.js` are on this branch.
Apply the following **minimal** changes in `src/App.jsx` (or use the full file from the PR artifacts).

## 1) Import

```js
import { buildFitTrackAiContext } from "./aiCoachContext";
```

(near the existing `import { generateCoachReply, aiUsageToday } from "./aiCoach"`)

## 2) In `AICoachDrawer` → `send()` → `generateCoachReply({...})`

Replace the old `userContext: { age, gender, ... }` with:

```js
const dayName = DAYS[todayIdx];
const plan = PLAN_TEMPLATES[data.activePlanId] || PLAN_TEMPLATES.beginner;
const dayMeta = plan.schedule[dayName] || {};
const { list: todayExercises } = getUsableExercises(data, dayName);

// ...
const result = await generateCoachReply({
  messages: nextMsgs,
  lang,
  localDate: today,
  hasAiPro: !!data.entitlements?.aiCoachPro,
  userContext: buildFitTrackAiContext(data, lang, {
    dayName,
    todayDate: today,
    dayTitle: lang === "ar" ? dayMeta.titleAr || dayMeta.title : dayMeta.title,
    planName: lang === "ar" ? plan.nameAr || plan.name : plan.name,
    planId: data.activePlanId,
    exercises: todayExercises,
  }),
});
```

`generateCoachReply` already sends `context: userContext` to the Edge Function.

## Do not
- Persist chat messages
- Change FREE/PRO limits
- Touch TikTok / Google / Billing
