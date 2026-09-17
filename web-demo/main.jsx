import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const STORAGE_KEY = "fiftyfit:web-demo:v7";
const DAY_MS = 86400000;

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const clone = (value) => JSON.parse(JSON.stringify(value));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const dateLabel = (iso) => {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : iso;
};

const seedState = () => {
  const today = todayKey();
  return {
    version: 7,
    tab: "home",
    startDate: today,
    account: { name: "Demo Athlete", weight: 72, goal: "Muscle gain", daysPerWeek: 4 },
    nutrition: { target: 3000, eaten: 1640, protein: 150, carbs: 225, fat: 74, carbPct: 45, proteinPct: 20, fatPct: 35 },
    progress: [
      { date: today, weight: 72, note: "Account start" },
      { date: new Date(Date.now() - DAY_MS * 3).toISOString().slice(0, 10), weight: 71.7 },
      { date: new Date(Date.now() - DAY_MS * 7).toISOString().slice(0, 10), weight: 71.4 },
    ].sort((a, b) => a.date.localeCompare(b.date)),
    workout: { completed: false, logged: {} },
    ai: { date: today, count: 0 },
  };
};

function readState() {
  const fallback = seedState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    const fresh = { ...fallback, ...parsed };
    fresh.account = { ...fallback.account, ...(parsed.account || {}) };
    fresh.nutrition = { ...fallback.nutrition, ...(parsed.nutrition || {}) };
    fresh.workout = { ...fallback.workout, ...(parsed.workout || {}) };
    fresh.ai = { ...fallback.ai, ...(parsed.ai || {}) };
    fresh.progress = Array.isArray(parsed.progress) && parsed.progress.length ? parsed.progress : fallback.progress;
    return fresh.startDate ? fresh : fallback;
  } catch {
    return fallback;
  }
}

function persist(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

function macroTotals(calories, carbPct, proteinPct, fatPct) {
  const total = clamp(Number(calories) || 0, 0, 20000);
  const c = clamp(Number(carbPct) || 0, 0, 100);
  const p = clamp(Number(proteinPct) || 0, 0, 100);
  const f = clamp(Number(fatPct) || 0, 0, 100);
  return { carbs: Math.round((total * c) / 100 / 4), protein: Math.round((total * p) / 100 / 4), fat: Math.round((total * f) / 100 / 9) };
}

function localCoach(question) {
  const q = question.toLowerCase();
  if (q.includes("protein")) return "For muscle gain, a practical daily protein target is around 1.6–2.2 g/kg. Use your weight trend and training performance to adjust the whole plan, not one meal.";
  if (q.includes("calorie")) return "The demo target is 3,000 kcal. Keep the target stable long enough to read your weight trend, gym performance, recovery, and consistency before changing it.";
  if (q.includes("progress") || q.includes("overload")) return "Progressive overload does not mean adding weight every session. Keep technique stable, train near the planned RIR, then add reps or a small load increase when performance is repeatable.";
  if (q.includes("rir") || q.includes("rpe")) return "RIR is how many clean reps you had left. An RIR 2 set means you likely could have done two more good reps without breaking technique.";
  if (q.includes("rest")) return "For hypertrophy, use enough rest to keep your next hard set productive. Compounds often need more recovery than isolation work.";
  return "I’m the local Fifty Fit Demo Coach. Ask me about protein, calories, progressive overload, RIR/RPE, or recovery.";
}

const workouts = [
  ["Barbell Bench Press", "4 × 8", "RIR 2"],
  ["Incline Dumbbell Press", "3 × 10", "RIR 2"],
  ["Cable Lateral Raise", "3 × 15", "RIR 1–2"],
  ["Rope Triceps Pushdown", "3 × 12", "RIR 1–2"],
];

function App() {
  const [state, setState] = useState(readState);
  const [question, setQuestion] = useState("");
  const [toast, setToast] = useState("");
  const today = todayKey();

  useEffect(() => persist(state), [state]);
  useEffect(() => {
    const root = document.getElementById("app");
    if (root) {
      root.dataset.fiftyfitDemoMode = "1";
      root.dataset.fiftyfitDemoReady = "1";
      root.dataset.fiftyfitDemoDay = String(dayNumber(state.startDate, today));
    }
  }, [state, today]);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(""), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const usage = state.ai.date === today ? state.ai : { date: today, count: 0 };
  const remaining = Math.max(0, 3 - usage.count);
  const caloriesLeft = Math.max(0, state.nutrition.target - state.nutrition.eaten);
  const day = dayNumber(state.startDate, today);
  const firstName = String(state.account.name || "Demo Athlete").trim().split(/\s+/)[0] || "Athlete";

  const setTab = (tab) => setState((current) => ({ ...current, tab }));
  const resetDemo = () => {
    if (window.confirm("Reset the local demo data?")) {
      const fresh = seedState();
      setState(fresh);
      setToast("Demo data reset locally");
    }
  };

  const askCoach = (text = question) => {
    const q = String(text || "").trim();
    if (!q) return;
    if (usage.count >= 3) {
      setToast("Demo Coach daily limit reached");
      return;
    }
    setState((current) => ({ ...current, ai: { date: today, count: usage.count + 1 } }));
    setQuestion("");
    setToast(localCoach(q));
  };

  const logSet = (index) => setState((current) => ({ ...current, workout: { ...current.workout, logged: { ...current.workout.logged, [index]: true } } }));
  const completeWorkout = () => {
    setState((current) => ({ ...current, workout: { ...current.workout, completed: true } }));
    setToast("Workout saved locally");
  };
  const addFood = () => setState((current) => ({ ...current, nutrition: { ...current.nutrition, eaten: Math.min(current.nutrition.target, current.nutrition.eaten + 250) } }));
  const addWeight = (value) => {
    const weight = Number(value);
    if (!(weight >= 20 && weight <= 300)) return;
    setState((current) => ({ ...current, account: { ...current.account, weight }, progress: [...current.progress.filter((x) => x.date !== today), { date: today, weight }].sort((a, b) => a.date.localeCompare(b.date)) }));
    setToast("Check-in saved locally");
  };

  const topWeight = useMemo(() => Math.max(...state.progress.map((x) => Number(x.weight) || 0), 1), [state.progress]);

  return (
    <div className="shell" data-fiftyfit-demo-app="1">
      <header className="top">
        <div className="logo">50</div>
        <div>
          <strong>Fifty Fit</strong>
          <small>TRAIN · EAT · PROGRESS</small>
        </div>
        <em>WEB DEMO · LOCAL</em>
      </header>

      <main>
        {state.tab === "home" && (
          <>
            <section className="hero">
              <div>
                <p className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</p>
                <h1>Welcome back, {firstName}.</h1>
                <p className="muted">This local demo starts on <strong>Day 1</strong> from the account start date, never from the weekday.</p>
              </div>
              <div className="day"><span>DAY</span><b>{day}</b></div>
            </section>

            <div className="grid two">
              <article className="card">
                <div className="head"><span>Today’s target</span><b>{state.workout.completed ? "Completed" : "Ready"}</b></div>
                <div className="big">{caloriesLeft}<small> kcal left</small></div>
                <div className="bar"><i style={{ width: `${clamp((state.nutrition.eaten / state.nutrition.target) * 100, 0, 100)}%` }} /></div>
                <div className="split"><span>{state.nutrition.eaten} eaten</span><span>{state.nutrition.target} target</span></div>
              </article>
              <article className="card">
                <div className="head"><span>Body weight</span><b>Local</b></div>
                <div className="big">{state.account.weight}<small> kg</small></div>
                <p className="muted">Last check-in is stored only in this browser.</p>
              </article>
            </div>

            <article className="card workout">
              <div><p className="eyebrow">TRAINING</p><h2>Hypertrophy · Day {day}</h2><p className="muted">Upper push · 55 min · RIR-based guidance</p></div>
              <button className="primary" onClick={() => setTab("training")}>{state.workout.completed ? "Review workout" : "Start workout"}</button>
            </article>

            <article className="card coach">
              <div className="head"><span>Demo Coach</span><b>{remaining} free today</b></div>
              <p className="muted">Simulated locally. Production AI is not used by this demo.</p>
              <div className="quick">
                {[["Protein", "How much protein should I eat?"], ["Overload", "How should I progress my lifts?"], ["RIR", "Explain RIR for hypertrophy"], ["Recovery", "How much rest should I use?"]].map(([label, q]) => <button key={label} onClick={() => askCoach(q)}>{label}</button>)}
              </div>
              <div className="input"><input value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => e.key === "Enter" && askCoach()} placeholder="Ask the local Demo Coach…" /><button className="primary" onClick={() => askCoach()}>Ask</button></div>
            </article>
          </>
        )}

        {state.tab === "training" && (
          <section>
            <section className="page"><p className="eyebrow">TRAINING</p><h1>Day {day} · Upper Push</h1><p className="muted">The first training day is anchored to <strong>{dateLabel(state.startDate)}</strong>.</p></section>
            <div className="stack">
              {workouts.map(([name, sets, rir], i) => <article className="card ex" key={name}><div className="num">0{i + 1}</div><div><h3>{name}</h3><p>{sets} · {rir}</p></div><button className="ghost" disabled={!!state.workout.logged[i]} onClick={() => logSet(i)}>{state.workout.logged[i] ? "Logged ✓" : "Log set"}</button></article>)}
            </div>
            <button className="primary wide" onClick={completeWorkout}>{state.workout.completed ? "Workout completed ✓" : "Complete workout"}</button>
          </section>
        )}

        {state.tab === "nutrition" && (
          <section>
            <section className="page"><p className="eyebrow">NUTRITION</p><h1>Daily fuel</h1><p className="muted">Demo values are local and editable; production nutrition remains separate.</p></section>
            <article className="card macros">
              {[["Calories", `${state.nutrition.eaten}/${state.nutrition.target}`, state.nutrition.eaten / state.nutrition.target], ["Protein", `${state.nutrition.protein} g`, state.nutrition.protein / 160], ["Carbs", `${state.nutrition.carbs} g`, state.nutrition.carbs / 350], ["Fat", `${state.nutrition.fat} g`, state.nutrition.fat / 100]].map(([label, value, pct]) => <div key={label}><span>{label}<strong>{value}</strong></span><div className="bar"><i style={{ width: `${clamp(Number(pct) * 100, 0, 100)}%` }} /></div></div>)}
            </article>
            <div className="grid two"><article className="card action"><h3>Quick add</h3><p className="muted">Add 250 kcal to the local demo log.</p><button className="primary" onClick={addFood}>+250 kcal</button></article><article className="card action"><h3>4 / 4 / 9 macro math</h3><p className="muted">45% carbs · 20% protein · 35% fat.</p><code>{macroTotals(state.nutrition.target, 45, 20, 35).carbs}g C · {macroTotals(state.nutrition.target, 45, 20, 35).protein}g P · {macroTotals(state.nutrition.target, 45, 20, 35).fat}g F</code></article></div>
          </section>
        )}

        {state.tab === "progress" && (
          <section>
            <section className="page"><p className="eyebrow">PROGRESS</p><h1>Keep the trend moving</h1><p className="muted">Local check-ins only. The demo never writes to your real account.</p></section>
            <article className="card"><div className="chart">{state.progress.map((point) => <div className="bar-col" key={point.date}><b>{point.weight}</b><i style={{ height: `${clamp((Number(point.weight) / topWeight) * 100, 20, 100)}%` }} /><small>{dateLabel(point.date)}</small></div>)}</div></article>
            <article className="card"><h3>Add a check-in</h3><div className="input"><input id="weight" type="number" min="20" max="300" step="0.1" defaultValue={state.account.weight} /><button className="primary" onClick={() => addWeight(document.getElementById("weight")?.value)}>Save weight</button></div></article>
          </section>
        )}

        {state.tab === "settings" && (
          <section>
            <section className="page"><p className="eyebrow">SETTINGS</p><h1>Demo controls</h1><p className="muted">Everything here is local to this browser.</p></section>
            <article className="card settings">
              <div><b>{state.account.name}</b><span>LOCAL</span></div>
              <div><b>Start date</b><span>{state.startDate}</span></div>
              <div><b>Day indexing</b><span>START DATE</span></div>
              <div><b>Purchases</b><span>NOT USED</span></div>
              <div><b>Data destination</b><span>THIS BROWSER</span></div>
              <button className="danger" onClick={resetDemo}>Reset demo data</button>
            </article>
          </section>
        )}
      </main>

      <nav>{[["home", "⌂"], ["training", "▣"], ["nutrition", "◒"], ["progress", "↗"], ["settings", "⚙"]].map(([id, icon]) => <button className={`nav ${state.tab === id ? "active" : ""}`} key={id} onClick={() => setTab(id)}><span>{icon}</span><small>{id[0].toUpperCase() + id.slice(1)}</small></button>)}</nav>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function dayNumber(start, today) {
  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${today}T00:00:00`);
  if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime())) return 1;
  return Math.max(1, Math.floor((b - a) / DAY_MS) + 1);
}

try {
  createRoot(document.getElementById("app")).render(<App />);
} catch (error) {
  const root = document.getElementById("app");
  if (root) {
    root.dataset.fiftyfitDemoRuntimeError = "1";
    root.innerHTML = '<div class="fatal"><strong>Fifty Fit Demo</strong><span>The demo could not start. No production account or data was accessed.</span></div>';
  }
}
