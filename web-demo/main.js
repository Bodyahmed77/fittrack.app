import './styles.css';

const KEY = 'fiftyfit:web-demo:v6';
const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
const seed = {
  tab:'home', done:false,
  account:{name:'Demo Athlete',weight:72,goal:'Muscle gain',days:4},
  weights:[{date:today,weight:72}],
  nutrition:{target:3000,eaten:1640,protein:150,carbs:413,fat:83},
  ai:{date:today,count:0}
};
let state = read();
const root = document.querySelector('#app');

function read(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return structuredClone(seed);
    const x = JSON.parse(raw);
    return {...structuredClone(seed),...x,account:{...seed.account,...(x.account||{})},nutrition:{...seed.nutrition,...(x.nutrition||{})},ai:{...seed.ai,...(x.ai||{})}};
  }catch{return structuredClone(seed)}
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}}
function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function percent(a,b){return Math.min(100,Math.max(0,Math.round((a/b)*100)))}
function reply(q){
  const s=q.toLowerCase();
  if(s.includes('protein')) return 'For muscle gain, a practical target is about 1.6–2.2 g/kg/day. At 72 kg, that is roughly 115–158 g per day.';
  if(s.includes('calorie')) return 'The demo target is 3000 kcal. Judge progress from your weight trend, performance, recovery, and consistency before changing the target.';
  if(s.includes('progress')) return 'Use progressive overload: keep technique stable, work around the planned RIR, then add reps or a small amount of load when you repeatedly hit the top of the range.';
  return 'I’m the local Fifty Fit Demo Coach. Ask about protein, calories, progressive overload, or training.';
}
function ask(q){
  if(state.ai.date!==today) state.ai={date:today,count:0};
  if(state.ai.count>=3){alert('Demo Coach daily limit reached.');return}
  state.ai.count++; save(); alert(reply(q)); render();
}
function home(){return `<section class="hero"><div><p class="eyebrow">${now.toLocaleDateString('en',{weekday:'long',month:'short',day:'numeric'})}</p><h1>Welcome back, ${esc(state.account.name.split(' ')[0])}.</h1><p class="muted">Your demo account starts on <strong>Day 1</strong> today.</p></div><div class="day"><span>DAY</span><b>1</b></div></section><div class="grid two"><article class="card"><div class="head"><span>Today’s target</span><b>${state.done?'Completed':'Ready'}</b></div><div class="big">${state.nutrition.target-state.nutrition.eaten}<small> kcal left</small></div><div class="bar"><i style="width:${percent(state.nutrition.eaten,state.nutrition.target)}%"></i></div><div class="split"><span>${state.nutrition.eaten} eaten</span><span>${state.nutrition.target} target</span></div></article><article class="card"><div class="head"><span>Body weight</span><b>Today</b></div><div class="big">${state.weights.at(-1).weight}<small> kg</small></div><p class="muted">Last check-in is saved locally.</p></article></div><article class="card workout"><div><p class="eyebrow">TRAINING</p><h2>Hypertrophy · Day 1</h2><p class="muted">Chest, shoulders & triceps · 55 min</p></div><button class="primary" data-act="workout">${state.done?'Workout completed':'Start workout'}</button></article><article class="card"><div class="head"><span>Demo Coach</span><b>${Math.max(0,3-state.ai.count)} free today</b></div><p class="muted">Ask about protein, calories, progressive overload, or your plan.</p><div class="quick"><button data-ai="protein">Protein</button><button data-ai="progress">Progressive overload</button><button data-ai="calorie">Calories</button></div></article>`}
function training(){const xs=[['Barbell Bench Press','4 × 8','RIR 2'],['Incline Dumbbell Press','3 × 10','RIR 2'],['Cable Lateral Raise','3 × 15','RIR 1–2'],['Rope Triceps Pushdown','3 × 12','RIR 1–2']];return `<section class="page"><p class="eyebrow">TRAINING</p><h1>Day 1 · Upper Push</h1><p class="muted">Day 1 is anchored to the account start date, not the weekday.</p></section><div class="stack">${xs.map((x,i)=>`<article class="card ex"><div class="num">0${i+1}</div><div><h3>${x[0]}</h3><p>${x[1]} · ${x[2]}</p></div><button class="ghost" data-log>Log set</button></article>`).join('')}</div><button class="primary wide" data-act="workout">${state.done?'Workout completed':'Complete workout'}</button>`}
function nutrition(){const n=state.nutrition;return `<section class="page"><p class="eyebrow">NUTRITION</p><h1>Daily fuel</h1><p class="muted">Local demo data only.</p></section><article class="card macros"><div><span>Calories</span><strong>${n.eaten}/${n.target}</strong><div class="bar"><i style="width:${percent(n.eaten,n.target)}%"></i></div></div><div><span>Protein</span><strong>${n.protein} g</strong><div class="bar"><i style="width:72%"></i></div></div><div><span>Carbs</span><strong>${n.carbs} g</strong><div class="bar"><i style="width:61%"></i></div></div><div><span>Fat</span><strong>${n.fat} g</strong><div class="bar"><i style="width:44%"></i></div></div></article><div class="grid two"><article class="card action"><h3>Quick add</h3><p class="muted">Add 250 kcal to today’s local log.</p><button class="primary" data-act="food">+250 kcal</button></article><article class="card action"><h3>Macro math</h3><p class="muted">20% protein · 55% carbs · 25% fat.</p><button class="ghost" data-act="nutrition-reset">Reset demo</button></article></div>`}
function progress(){return `<section class="page"><p class="eyebrow">PROGRESS</p><h1>Keep the trend moving</h1><p class="muted">Your check-ins stay in this browser.</p></section><article class="card"><div class="chart">${state.weights.map(w=>`<div class="bar-col"><b>${w.weight}</b><i></i><small>${w.date}</small></div>`).join('')}</div></article><article class="card"><h3>Add a check-in</h3><div class="input"><input id="weight" type="number" min="20" max="300" step="0.1" value="${state.account.weight}"><button class="primary" data-act="weight">Save weight</button></div></article>`}
function settings(){return `<section class="page"><p class="eyebrow">SETTINGS</p><h1>Demo controls</h1><p class="muted">All changes are local to this browser.</p></section><article class="card settings"><div><b>${esc(state.account.name)}</b><span>LOCAL</span></div><div><b>Data</b><span>LOCAL ONLY</span></div><div><b>Purchases</b><span>SIMULATED</span></div><button class="danger" data-act="reset">Reset demo data</button></article>`}
function render(){
  const views={home:home,training:training,nutrition:nutrition,progress:progress,settings:settings};
  root.innerHTML=`<div class="shell"><header class="top"><div class="logo">50</div><div><strong>Fifty Fit</strong><small>TRAIN · EAT · PROGRESS</small></div><em>WEB DEMO</em></header><main>${views[state.tab]()}</main><nav>${Object.keys(views).map(t=>`<button class="nav ${state.tab===t?'active':''}" data-tab="${t}"><span>${{home:'⌂',training:'▣',nutrition:'◒',progress:'↗',settings:'⚙'}[t]}</span><small>${t[0].toUpperCase()+t.slice(1)}</small></button>`).join('')}</nav></div>`;
  bind();
  root.dataset.mounted='1';
}
function bind(){
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;save();render()});
  document.querySelectorAll('[data-ai]').forEach(b=>b.onclick=()=>ask(b.dataset.ai));
  document.querySelectorAll('[data-log]').forEach(b=>b.onclick=()=>{b.textContent='Logged ✓';b.disabled=true});
  document.querySelectorAll('[data-act="workout"]').forEach(b=>b.onclick=()=>{state.done=true;save();render()});
  document.querySelectorAll('[data-act="food"]').forEach(b=>b.onclick=()=>{state.nutrition.eaten=Math.min(state.nutrition.target,state.nutrition.eaten+250);save();render()});
  document.querySelectorAll('[data-act="nutrition-reset"]').forEach(b=>b.onclick=()=>{state.nutrition=structuredClone(seed.nutrition);save();render()});
  document.querySelectorAll('[data-act="weight"]').forEach(b=>b.onclick=()=>{const v=Number(document.querySelector('#weight')?.value);if(!Number.isFinite(v)||v<20||v>300){alert('Enter a valid weight.');return}state.account.weight=v;state.weights.push({date:today,weight:v});save();render()});
  document.querySelectorAll('[data-act="reset"]').forEach(b=>b.onclick=()=>{if(confirm('Reset all local demo data?')){localStorage.removeItem(KEY);state=read();render()}});
}

render();
