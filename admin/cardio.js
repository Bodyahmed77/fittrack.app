/* Fifty Fit Admin — cardio helper
 * Adds a simple duration-based cardio flow to the existing training-plan editor
 * without changing the existing Firestore plan schema.
 */
(() => {
  const CARDIO = [
    ["treadmill", "Treadmill Walk/Run", "مشاية"],
    ["bike", "Stationary Bike", "دراجة ثابتة"],
    ["jump_rope", "Jump Rope", "نط الحبل"],
    ["burpees", "Burpees", "بيربيس"],
  ];

  const STYLE_ID = "fifty-fit-cardio-style";
  const BUTTON_ID = "fifty-fit-add-cardio";
  let modal = null;

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${BUTTON_ID}{margin-inline-start:8px}
      .ff-cardio-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.55);display:grid;place-items:center;z-index:99999;padding:18px}
      .ff-cardio-modal{width:min(460px,100%);background:#101513;border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:22px;box-shadow:0 24px 80px rgba(0,0,0,.45);color:#fff;font-family:inherit}
      .ff-cardio-modal h3{margin:0 0 6px;font-size:20px}.ff-cardio-modal p{margin:0 0 18px;color:#aab5af;font-size:13px}
      .ff-cardio-grid{display:grid;gap:12px}.ff-cardio-grid label{display:grid;gap:6px;font-size:13px;color:#cbd5cf}
      .ff-cardio-grid select,.ff-cardio-grid input{width:100%;box-sizing:border-box;background:#080b09;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:11px 12px;font:inherit}
      .ff-cardio-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}.ff-cardio-actions button{border:0;border-radius:10px;padding:10px 15px;font-weight:700;cursor:pointer}
      .ff-cardio-cancel{background:#202723;color:#dce4df}.ff-cardio-save{background:#1f8f57;color:#fff}
    `;
    document.head.appendChild(style);
  }

  function closeModal() {
    modal?.remove();
    modal = null;
  }

  function setInput(input, value) {
    if (!input) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(input, value); else input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function setSelect(select, value) {
    if (!select) return;
    select.value = value;
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function addCardio(exerciseId, minutes) {
    const add = document.getElementById("add-exercise");
    if (!add) return;
    add.click();
    requestAnimationFrame(() => {
      const rows = document.querySelectorAll(".exercise-row");
      const row = rows[rows.length - 1];
      if (!row) return;
      const select = row.querySelector("select[data-ex-field$=':id']");
      const sets = row.querySelector("input[data-ex-field$=':targetSets']");
      const reps = row.querySelector("input[data-ex-field$=':targetReps']");
      setSelect(select, exerciseId);
      setInput(sets, "1");
      setInput(reps, `${minutes} min`);
    });
  }

  function openModal() {
    closeModal();
    injectStyle();
    modal = document.createElement("div");
    modal.className = "ff-cardio-backdrop";
    modal.innerHTML = `
      <div class="ff-cardio-modal" role="dialog" aria-modal="true" aria-labelledby="ff-cardio-title">
        <h3 id="ff-cardio-title">Add Cardio</h3>
        <p>حدد نوع الكارديو والمدة. سيظهر للمستخدم كتمرين لمدة زمنية بدل نظام المجموعات والتكرارات.</p>
        <div class="ff-cardio-grid">
          <label>Cardio type
            <select id="ff-cardio-type">${CARDIO.map(([id,en,ar]) => `<option value="${id}">${en} — ${ar}</option>`).join("")}</select>
          </label>
          <label>Duration (minutes)
            <input id="ff-cardio-minutes" type="number" min="1" max="300" step="1" value="15" inputmode="numeric" />
          </label>
        </div>
        <div class="ff-cardio-actions">
          <button type="button" class="ff-cardio-cancel">Cancel</button>
          <button type="button" class="ff-cardio-save">Add cardio</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector(".ff-cardio-cancel").onclick = closeModal;
    modal.querySelector(".ff-cardio-save").onclick = () => {
      const type = modal.querySelector("#ff-cardio-type").value;
      const minutes = Math.max(1, Math.min(300, Number(modal.querySelector("#ff-cardio-minutes").value) || 15));
      addCardio(type, minutes);
      closeModal();
    };
    modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
    modal.querySelector("#ff-cardio-minutes").focus();
  }

  function install() {
    const add = document.getElementById("add-exercise");
    if (!add || document.getElementById(BUTTON_ID)) return;
    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.className = "secondary";
    button.textContent = "+ Add cardio";
    button.title = "Add a time-based cardio activity";
    button.onclick = openModal;
    add.insertAdjacentElement("afterend", button);
  }

  const observer = new MutationObserver(install);
  observer.observe(document.body, { childList: true, subtree: true });
  install();
})();
