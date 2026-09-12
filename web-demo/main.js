import './styles.css';

const STORAGE_KEY = 'fiftyfit:web-demo:v6';
const today = new Date();
const isoToday = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

const seed = {
  account: { name: 'Demo Athlete', weight: 72, goal: 'Muscle gain', daysPerWeek: 4 },
  activeTab: 'home',
  trainingDone: false,
  weights: [{ date: isoToday, weight: 72, time: '08:00' }],
  nutrition: { calories: 3000, protein: 150, carbs: 413, fat: 83, eaten: 1640 },
  ai: { date: isoToday, count: 0 },
};

let state = loadState();
const app = document.querySelector('#app');

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(seed);
    const saved = JSON.parse(raw);
    return {
      ...structuredClone(seed), ...saved,
      account: { ...seed.account, ...(saved.account || {}) },
      nutrition: { ...seed.nutrition, ...(saved.nutrition || {}) },
      ai: { ...seed.ai, ...(saved.ai || {}) },
    };
  } catch { return structuredClone(seed); }
}
function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {} }
function esc(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
function kcalLeft() { return Math.max(0, state.nutrition.calories - state.nutrition.eaten); }
function pct(v,m) { return Math.min(100, Math.round((v/m)*100)); }
function dateLabel() { return new Intl.DateTimeFormat('en', { weekday:'long', month:'short', day:'numeric' }).format(today); }

const icon = { home:'⌂', training:'▣', nutrition:'◒', progress:'↗', settings:'⚙' };

function render() {
  document.documentElement.lang = 'en';
  document.documentElement.dir = 'ltr';
  const screens = { home: home(), training: training(), nutrition: nutrition(), progress: progress(), settings: settings() };
  app.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div class="brand"><div class="brand-mark">50</div><div><strong>Fifty Fit</strong><span>TRAIN • EAT • PROGRESS</span></div></div>
        <div class="demo-pill">WEB DEMO</div>
      </header>
      <main class="content">${screens[state.activeTab]}</main>
      <nav class="nav">${Object.entries(icon).map(([tab, glyph]) => `<button class="nav-item ${state.activeTab===tab?'active':''}" data-tab="${tab}"><span>${glyph}</span><small>${tab[0].toUpperCase()+tab.slice(1)}</small></button>`).join('')}</nav>
    </div>`;
  bind();
}

function home() {
  const remaining = kcalLeft();
  return `
    <section class="hero"><div><p class="eyebrow">${dateLabel()}</p><h1>Welcome back, ${esc(state.account.name.split(' ')[0])}.</h1><p class="muted">Your demo account starts on <strong>Day 1</strong> today.</p></div><div class="day-badge"><span>DAY</span><strong>1</strong></div></section>
    <div class="grid two">
      <article class="card highlight"><div class="card-head"><span>Today’s target</span><b>${state.trainingDone?'Completed':'Ready'}</b></div><div class="big-number">${remaining}<span> kcal left</span></div><div class="progress"><i style="width:${pct(state.nutrition.eaten,state.nutrition.calories)}%"></i></div><div class="split"><span>${state.nutrition.eaten} eaten</span><span>${state.nutrition.calories} target</span></div></article>
      <article class="card"><div class="card-head"><span>Body weight</span><b>+${(state.weights.at(-1).weight-state.weights[0].weight).toFixed(1)} kg</b></div><div class="big-number">${state.weights.at(-1).weight}<span> kg</span></div><div class="muted">Last check-in today</div></article>
    </div>
    <article class="card workout"><div><p class="eyebrow">TRAINING</p><h2>Hypertrophy • Day 1</h2><p class="muted">Chest, shoulders & triceps · 55 min</p></div><button class="primary" data-action="workout">${state.trainingDone?'View workout':'Start workout'}</button></article>
    <article class="card"><div class="card-head"><span>Demo Coach</span><b>${Math.max(0,3-state.ai.count)} free today</b></div><p class="coach-text">Ask about protein, calories, progressive overload, or your training plan.</p><div class="quick"><button data-ai="How much protein should I eat?">Protein</button><button data-ai="How do I progress my lifts?">Progressive overload</button><button data-ai="How many calories should I eat?">Calories</button></div></article>`;
}
function training() {
  const exercises = [['Barbell Bench Press','4 × 8','RIR 2'],['Incline Dumbbell Press','3 × 10','RIR 2'],['Cable Lateral Raise','3 × 15','RIR 1–2'],['Rope Triceps Pushdown','3 × 12','RIR 1–2']];
  return `<section class="page-head"><p class="eyebrow">TRAINING</p><h1>Day 1 · Upper Push</h1><p class="muted">Start today — your demo schedule never turns Day 1 into a rest day.</p></section><div class="stack">${exercises.map((e,i)=>`<article class="exercise card"><div class="exercise-no">0${i+1}</div><div class="exercise-main"><h3>${e[0]}</h3><p>${e[1]} · ${e[2]}</p></div><button class="ghost" data-action="complete-exercise">Log set</button></article>`).join('')}</div><button class="primary wide" data-action="workout">${state.trainingDone?'Workout completed':'Complete workout'}</button>`;
}
function nutrition() {
  const n=state.nutrition;
  return `<section class="page-head"><p class="eyebrow">NUTRITION</p><h1>Daily fuel</h1><p class="muted">Local demo data only. Nothing touches your real account.</p></section><div class="card macros"><div class="macro"><span>Calories</span><strong>${n.eaten}/${n.calories}</strong><div class="progress"><i style="width:${pct(n.eaten,n.calories)}%"></i></div></div><div class="macro"><span>Protein</span><strong>${n.protein} g</strong><div class="progress"><i style="width:72%"></i></div></div><div class="macro"><span>Carbs</span><strong>${n.carbs} g</strong><div class="progress"><i style="width:61%"></i></div></div><div class="macro"><span>Fat</span><strong>${n.fat} g</strong><div class="progress"><i style="width:44%"></i></div></div></div><div class="grid two"><article class="card action"><h3>Quick add</h3><p class="muted">Add 250 kcal to today’s local demo log.</p><button class="primary" data-action="add-food">+250 kcal</button></article><article class="card action"><h3>Macro math</h3><p class="muted">3000 kcal · 20% protein · 55% carbs · 25% fat.</p><button class="ghost" data-action="reset-nutrition">Reset demo</button></article></div>`;
}
function progress() {
  return `<section class="page-head"><p class="eyebrow">PROGRESS</p><h1>Keep the trend moving</h1><p class="muted">Weight history is saved in your browser only.</p></section><article class="card"><div class="weight-chart">${state.weights.map((w,i)=>`<div class="bar" style="height:${Math.max(35,90-(i*7))}%"><span>${w.weight}</span></div>`).join('')}</div><div class="history">${[...state.weights].reverse().slice(0,5).map(w=>`<div><span>${w.date}</span><strong>${w.weight} kg</strong></div>`).join('')}</div></article><article class="card"><h3>Add a check-in</h3><div class="input-row"><input id="weight-input" type="number" min="20" max="300" step="0.1" value="${state.account.weight}"><button class="primary" data-action="add-weight">Save weight</button></div></article>`;
}
function settings() {
  return `<section class="page-head"><p class="eyebrow">SETTINGS</p><h1>Demo controls</h1><p class="muted">Everything here is local to this browser.</p></section><article class="card settings-list"><div><div><strong>${esc(state.account.name)}</strong><p>${esc(state.account.goal)} · ${state.account.daysPerWeek} days/week</p></div><span class="ok">LOCAL</span></div><div><div><strong>Data persistence</strong><p>localStorage · no Firebase session</p></div><span class="ok">ON</span></div><div><div><strong>Purchases</strong><p>Simulated only · no Google Play Billing</p></div><span class="ok">SAFE</span></div><button class="danger" data-action="reset-demo">Reset demo data</button></article>`;
}

function coachReply(q) {
  const s=q.toLowerCase();
  if(s.includes('protein')) return 'For muscle gain, a practical target is roughly 1.6–2.2 g/kg/day. For this demo athlete at 72 kg, that is about 115–158 g/day.';
  if(s.includes('calorie')) return 'The demo target is 3000 kcal. Use your weight trend, performance, and recovery to adjust rather than changing calories every day.';
  if(s.includes('progress')) return 'Use progressive overload: keep form stable, work near the planned RIR, then add reps or a small amount of load when you consistently hit the top of the range.';
  return 'I’m the local Fifty Fit Demo Coach. Ask about training, nutrition, protein, calories, or progressive overload.';
}
function askAI(q) {
  const limit=3;
  if(state.ai.date!==isoToday) state.ai={date:isoToday,count:0};
  if(state.ai.count>=limit) return alert('Demo Coach daily limit reached (3 messages).');
  state.ai.count += 1; save(); alert(coachReply(q)); render();
}
function bind() {
  document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{state.activeTab=b.dataset.tab;save();render();}));
  document.querySelectorAll('[data-ai]').forEach(b=>b.addEventListener('click',()=>askAI(b.dataset.ai)));
  document.querySelectorAll('[data-action="workout"]').forEach(b=>b.addEventListener('click',()=>{state.trainingDone=true;save();render();}));
  document.querySelectorAll('[data-action="complete-exercise"]').forEach(b=>b.addEventListener('click',()=>b.textContent='Logged ✓'));
  document.querySelectorAll('[data-action="add-food"]').forEach(b=>b.addEventListener('click',()=>{state.nutrition.eaten=Math.min(state.nutrition.calories,state.nutrition.eaten+250);save();render();}));
  document.querySelectorAll('[data-action="reset-nutrition"]').forEach(b=>b.addEventListener('click',()=>{state.nutrition=structuredClone(seed.nutrition);save();render();}));
  document.querySelectorAll('[data-action="add-weight"]').forEach(b=>b.addEventListener('click',()=>{const v=Number(document.querySelector('#weight-input')?.value);if(!Number.isFinite(v)||v<20||v>300)return alert('Enter a valid weight.');state.account.weight=v;state.weights.push({date:isoToday,weight:v,time:new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})});save();render();}));
  document.querySelectorAll('[data-action="reset-demo"]').forEach(b=>b.addEventListener('click',()=>{if(confirm('Reset all local demo data?')){localStorage.removeItem(STORAGE_KEY);state=loadState();render();}}));
}

render();
