/* SHIFT quiz — controller */
(() => {
  "use strict";

  const { LIFELINES, DIFFICULTIES, CATEGORIES } = window.SHIFT_DATA;

  /* ------------ State ------------ */
  const state = {
    screen: "landing",
    gameName: "",
    teams: [
      { name: "الفريق الأول", score: 0, lifelines: [], usedLifelines: new Set() },
      { name: "الفريق الثاني", score: 0, lifelines: [], usedLifelines: new Set() }
    ],
    selectedCats: [],         // array of category ids (up to 6)
    turn: 0,                  // 0 or 1 — whose turn to pick a cell
    board: [],                // 36 cells: {catId, difficulty, q, a, used, awarded:null|0|1|-1}
    activeCellIndex: null,    // currently open question index
    activeLifeline: null,     // highlight which lifeline is "in effect" for the current question
    answerRevealed: false,
    timer: { running: false, remaining: 60, intervalId: null, max: 60 },
    history: []               // undo stack (snapshots)
  };

  /* ------------ Helpers ------------ */
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const SCREENS = ["landing","setup","categories","board","question","results"];
  function show(screen){
    state.screen = screen;
    SCREENS.forEach(s => {
      const el = document.querySelector(`[data-screen="${s}"]`);
      if (el) el.hidden = (s !== screen);
    });
    document.body.classList.toggle("no-scroll", screen === "board");
    window.scrollTo({top:0, behavior:"instant"});
  }

  function pushHistory(){
    // shallow snapshot of mutable fields
    const snap = {
      teams: state.teams.map(t => ({ ...t, usedLifelines: new Set(t.usedLifelines) })),
      turn: state.turn,
      board: state.board.map(c => ({ ...c })),
      activeCellIndex: state.activeCellIndex,
      answerRevealed: state.answerRevealed
    };
    state.history.push(snap);
    if (state.history.length > 40) state.history.shift();
  }
  function undo(){
    const snap = state.history.pop();
    if (!snap){ flash("لا يوجد ما يمكن التراجع عنه"); return; }
    state.teams = snap.teams;
    state.turn = snap.turn;
    state.board = snap.board;
    state.activeCellIndex = snap.activeCellIndex;
    state.answerRevealed = snap.answerRevealed;
    renderAll();
  }

  function flash(msg){
    openModal({ title: "تنبيه", body: `<div>${msg}</div>`,
      actions: [{ label:"حسناً", primary:true, close:true }]});
  }

  /* ------------ Modal ------------ */
  function openModal({ title, body, actions=[], onOpen }){
    $("#modalTitle").textContent = title || "";
    $("#modalBody").innerHTML = body || "";
    const actionsEl = $("#modalActions");
    actionsEl.innerHTML = "";
    actions.forEach(a => {
      const b = document.createElement("button");
      b.className = "btn " + (a.primary ? "btn--primary" : (a.dark ? "btn--dark" : ""));
      b.textContent = a.label;
      b.addEventListener("click", () => {
        if (a.onClick) a.onClick();
        if (a.close !== false) closeModal();
      });
      actionsEl.appendChild(b);
    });
    $("#modal").hidden = false;
    if (onOpen) onOpen($("#modalBody"));
  }
  function closeModal(){ $("#modal").hidden = true; }
  $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });

  /* ------------ Landing ------------ */

  /* ------------ Setup ------------ */
  function renderLifelineChoosers(){
    [1,2].forEach(teamNum => {
      const root = document.querySelector(`.lifelines[data-team="${teamNum}"]`);
      root.innerHTML = "";
      const team = state.teams[teamNum - 1];
      LIFELINES.forEach(l => {
        const div = document.createElement("div");
        div.className = "lifeline" + (team.lifelines.includes(l.id) ? " selected" : "");
        div.innerHTML = `
          <div class="icon" title="${l.desc}">${l.emoji}</div>
          <div class="label">${l.name}</div>
        `;
        div.addEventListener("click", () => toggleLifeline(teamNum - 1, l.id));
        // if team already has 3 and this one isn't selected, show disabled look
        if (team.lifelines.length >= 3 && !team.lifelines.includes(l.id)){
          div.classList.add("disabled");
        }
        root.appendChild(div);
      });
    });
  }
  function toggleLifeline(teamIdx, id){
    const t = state.teams[teamIdx];
    if (t.lifelines.includes(id)){
      t.lifelines = t.lifelines.filter(x => x !== id);
    } else {
      if (t.lifelines.length >= 3) return;
      t.lifelines.push(id);
    }
    renderLifelineChoosers();
  }
  function splitTeams(){
    const raw = $("#playersPool").value.split(/\n|,/).map(s => s.trim()).filter(Boolean);
    if (raw.length < 2){ flash("أضف على الأقل لاعبين."); return; }
    const shuffled = raw.slice().sort(() => Math.random() - 0.5);
    const half = Math.ceil(shuffled.length / 2);
    const t1 = shuffled.slice(0, half);
    const t2 = shuffled.slice(half);
    $("#splitResult").innerHTML =
      `<div><b>${state.teams[0].name}:</b> ${t1.join("، ")}</div>
       <div><b>${state.teams[1].name}:</b> ${t2.join("، ")}</div>`;
  }

  /* ------------ Categories ------------ */
  function renderCategoryGroups(){
    const groups = {};
    CATEGORIES.forEach(c => {
      (groups[c.group] ||= []).push(c);
    });
    const root = $("#catGroups");
    root.innerHTML = "";
    Object.keys(groups).forEach(groupName => {
      const section = document.createElement("div");
      section.className = "catgroup";
      section.innerHTML = `
        <div class="catgroup__title-wrap"><div class="catgroup__title">${groupName}</div></div>
        <div class="catgroup__grid"></div>
      `;
      const grid = section.querySelector(".catgroup__grid");
      groups[groupName].forEach(cat => {
        const card = document.createElement("div");
        card.className = "catcard";
        card.dataset.id = cat.id;
        card.innerHTML = `
          <div class="catcard__emoji">${cat.emoji}</div>
          <div class="catcard__label">${cat.name}</div>
        `;
        card.addEventListener("click", () => toggleCategory(cat.id));
        grid.appendChild(card);
      });
      root.appendChild(section);
    });
    updateCatSelectionUI();
  }
  function toggleCategory(id){
    const i = state.selectedCats.indexOf(id);
    if (i >= 0) state.selectedCats.splice(i, 1);
    else{
      if (state.selectedCats.length >= 6) return;
      state.selectedCats.push(id);
    }
    updateCatSelectionUI();
  }
  function updateCatSelectionUI(){
    $$(".catcard").forEach(card => {
      const sel = state.selectedCats.includes(card.dataset.id);
      card.classList.toggle("selected", sel);
      card.classList.toggle("disabled", !sel && state.selectedCats.length >= 6);
    });
    const count = state.selectedCats.length;
    $("#catCounter").textContent = `${toArabicNum(count)} / ٦`;
    $("#catStartBtn").disabled = count !== 6;
  }

  function toArabicNum(n){
    const map = ["٠","١","٢","٣","٤","٥","٦","٧","٨","٩"];
    return String(n).split("").map(c => /[0-9]/.test(c) ? map[+c] : c).join("");
  }

  /* ------------ Board ------------ */
  function buildBoard(){
    const cells = [];
    state.selectedCats.forEach(catId => {
      const cat = CATEGORIES.find(c => c.id === catId);
      // Ensure we have 2 of each difficulty; take first 6 from data.
      const byDiff = { easy: [], medium: [], hard: [] };
      cat.questions.forEach(q => byDiff[q.d]?.push(q));
      const ordered = [
        ...byDiff.easy.slice(0,2),
        ...byDiff.medium.slice(0,2),
        ...byDiff.hard.slice(0,2)
      ];
      ordered.forEach(q => {
        cells.push({
          catId: cat.id, catName: cat.name, catEmoji: cat.emoji,
          difficulty: q.d,
          points: DIFFICULTIES.find(d => d.id === q.d).points,
          q: q.q, a: q.a,
          used: false, awardedTo: null  // null, 0, 1, -1
        });
      });
    });
    state.board = cells;
  }
  function renderBoardChrome(){
    $("#t1Name").textContent = state.teams[0].name;
    $("#t2Name").textContent = state.teams[1].name;
    $("#t1Score").textContent = state.teams[0].score;
    $("#t2Score").textContent = state.teams[1].score;
    document.querySelector(".score--t1").classList.toggle("is-turn", state.turn === 0);
    document.querySelector(".score--t2").classList.toggle("is-turn", state.turn === 1);
    $("#turnTeamName").textContent = state.teams[state.turn].name;
    renderBoardLifelines();
  }

  function renderBoard(){
    // Single-page board: each category card embeds its 6 point cells.
    // Cells per category in state.board are ordered [easy0, easy1, med0, med1, hard0, hard1];
    // arrange them as a 3-col × 2-row grid that reads 200 / 400 / 600 across each row.
    const grid = $("#hubGrid");
    grid.innerHTML = "";
    state.selectedCats.forEach(catId => {
      const cat = CATEGORIES.find(c => c.id === catId);
      const cells = state.board.filter(c => c.catId === catId);
      const ordered = [cells[0], cells[2], cells[4], cells[1], cells[3], cells[5]];
      const usedCount = cells.filter(c => c.used).length;
      const complete = usedCount === cells.length;

      const tile = document.createElement("article");
      tile.className = "hub-tile" + (complete ? " complete" : "");

      const cellsHTML = ordered.map(c => {
        const idx = state.board.indexOf(c);
        return `
          <button type="button"
                  class="hub-tile__cell${c.used ? " used" : ""}"
                  data-diff="${c.difficulty}" data-idx="${idx}"
                  ${c.used ? "disabled" : ""}>${c.points}</button>`;
      }).join("");

      tile.innerHTML = `
        <div class="hub-tile__art">${cat.emoji}</div>
        <h3 class="hub-tile__name">${cat.name}</h3>
        <div class="hub-tile__cells">${cellsHTML}</div>
      `;

      tile.querySelectorAll(".hub-tile__cell:not(.used)").forEach(btn => {
        btn.addEventListener("click", () => openQuestion(parseInt(btn.dataset.idx, 10)));
      });
      grid.appendChild(tile);
    });
    renderBoardChrome();
  }

  function renderBoardLifelines(){
    [1,2].forEach(n => {
      const root = document.getElementById("ll" + n);
      root.innerHTML = "";
      const team = state.teams[n - 1];
      team.lifelines.forEach(id => {
        const l = LIFELINES.find(x => x.id === id);
        const chip = document.createElement("span");
        chip.className = "ll-chip" + (team.usedLifelines.has(id) ? " used" : "");
        chip.title = l.desc;
        chip.innerHTML = `<span class="icon">${l.emoji}</span><span>${l.name}</span>`;
        root.appendChild(chip);
      });
    });
  }

  /* ------------ Question ------------ */
  function openQuestion(idx){
    const cell = state.board[idx];
    if (cell.used) return;
    pushHistory();
    state.activeCellIndex = idx;
    state.answerRevealed = false;
    state.activeLifeline = null;
    resetTimer();
    renderQuestion();
    show("question");
    // Auto-start the countdown as soon as the question screen opens.
    startTimer();
  }

  function renderQuestion(){
    const cell = state.board[state.activeCellIndex];
    const diffLabel = { easy:"سهل", medium:"متوسط", hard:"صعب" }[cell.difficulty];
    $("#qCategory").textContent = `${cell.catEmoji} ${cell.catName}`;
    $("#qDifficulty").textContent = diffLabel;
    $("#qPoints").textContent = `${cell.points} نقطة`;
    $("#qText").textContent = cell.q;
    $("#qAnswerText").textContent = cell.a;
    $("#qAnswer").hidden = !state.answerRevealed;
    $("#qAward").hidden = !state.answerRevealed;
    $("#awardT1").textContent = `${state.teams[0].name} +${cell.points}`;
    $("#awardT2").textContent = `${state.teams[1].name} +${cell.points}`;

    $("#qT1Name").textContent = state.teams[0].name;
    $("#qT2Name").textContent = state.teams[1].name;
    renderQLifelines();
  }
  function renderQLifelines(){
    [1,2].forEach(n => {
      const root = document.getElementById("qLL" + n);
      root.innerHTML = "";
      const team = state.teams[n - 1];
      team.lifelines.forEach(id => {
        const l = LIFELINES.find(x => x.id === id);
        const chip = document.createElement("span");
        const used = team.usedLifelines.has(id);
        chip.className = "ll-chip" + (used ? " used" : "");
        chip.title = l.desc;
        chip.innerHTML = `<span class="icon">${l.emoji}</span><span>${l.name}</span>`;
        if (!used) chip.addEventListener("click", () => useLifeline(n - 1, id));
        root.appendChild(chip);
      });
    });
  }

  function useLifeline(teamIdx, id){
    const team = state.teams[teamIdx];
    if (team.usedLifelines.has(id)) return;
    const l = LIFELINES.find(x => x.id === id);

    openModal({
      title: `${l.emoji} ${l.name}`,
      body: `<div>${l.desc}</div><div style="margin-top:10px;color:var(--muted);font-size:13px">تفعيل هذه الوسيلة لصالح <b>${team.name}</b>.</div>`,
      actions: [
        { label: "إلغاء" },
        { label: "تأكيد التفعيل", primary: true, onClick: () => {
          pushHistory();
          team.usedLifelines.add(id);
          state.activeLifeline = { teamIdx, id };
          // Lifeline-specific side effects
          if (id === "call_friend"){
            state.timer.max = 30;
            resetTimer();
            startTimer();
          }
          if (id === "rest"){
            // skip the question — mark as used with no award
            const cell = state.board[state.activeCellIndex];
            cell.used = true; cell.awardedTo = -1;
            stopTimer();
            // pass turn
            state.turn = 1 - state.turn;
            renderQLifelines();
            show("board");
            renderBoard();
            return;
          }
          renderQLifelines();
          flash(`تم تفعيل: ${l.name}`);
        }}
      ]
    });
  }

  function revealAnswer(){
    state.answerRevealed = true;
    stopTimer();
    renderQuestion();
  }

  function award(to){
    const cell = state.board[state.activeCellIndex];
    pushHistory();
    const pts = cell.points;
    cell.used = true;
    if (to === "1"){
      state.teams[0].score += pts;
      cell.awardedTo = 0;
    } else if (to === "2"){
      state.teams[1].score += pts;
      cell.awardedTo = 1;
    } else {
      cell.awardedTo = -1;
    }

    // Trap: if the active lifeline was "trap" for team X, and the opposite team answered wrong
    if (state.activeLifeline && state.activeLifeline.id === "trap"){
      const trapTeam = state.activeLifeline.teamIdx;
      const oppTeam = 1 - trapTeam;
      const oppAnsweredWrong = (to === "none") || (Number(to) - 1 === trapTeam);
      if (oppAnsweredWrong){
        state.teams[oppTeam].score -= pts * 2;
        flash(`الفخ: خُصمت ${pts * 2} من ${state.teams[oppTeam].name}.`);
      }
    }
    // Pit: if pit was used by team X, and opp team answered wrong, award half to pit-user
    if (state.activeLifeline && state.activeLifeline.id === "pit"){
      const pitTeam = state.activeLifeline.teamIdx;
      const oppTeam = 1 - pitTeam;
      const oppAnsweredWrong = (to === "none") || (Number(to) - 1 === pitTeam);
      if (oppAnsweredWrong){
        state.teams[pitTeam].score += Math.floor(pts / 2);
        state.teams[oppTeam].score -= Math.floor(pts / 2);
      }
    }
    // reset per-question flags
    state.activeLifeline = null;
    state.timer.max = 60;

    // Alternate turn
    state.turn = 1 - state.turn;

    // Check end
    if (state.board.every(c => c.used)){
      show("results");
      renderResults();
      return;
    }
    show("board");
    renderBoard();
  }

  function passTurn(){
    flash("الدور للفريق الآخر للإجابة. إذا أخطأ، ارجع واعرض الإجابة ثم وزّع النقاط.");
  }

  /* ------------ Timer (countdown) ------------ */
  const CIRC = 2 * Math.PI * 54; // 339.292
  function fmtMMSS(secs){
    const s = Math.max(0, Math.floor(secs));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2,"0")}:${String(r).padStart(2,"0")}`;
  }
  function renderTimer(){
    const t = state.timer;
    const ring = $("#timerRing");
    // Ring fills clockwise as time elapses; full at start, empty at zero.
    const pct = t.max > 0 ? Math.max(0, Math.min(t.remaining / t.max, 1)) : 0;
    ring.style.strokeDashoffset = (CIRC * (1 - pct)).toString();
    $("#timerText").textContent = fmtMMSS(t.remaining);
    const timerEl = $("#timer");
    // Warn at <=33% remaining; danger at zero.
    timerEl.classList.toggle("is-warn",   t.remaining > 0 && t.remaining <= t.max * 0.34);
    timerEl.classList.toggle("is-danger", t.remaining <= 0);
    $("#timerToggleBtn").textContent = t.running ? "أوقف الوقت" : "ابدأ الوقت";
  }
  function startTimer(){
    if (state.timer.running) return;
    if (state.timer.remaining <= 0) return;
    state.timer.running = true;
    state.timer.intervalId = setInterval(() => {
      state.timer.remaining -= 1;
      if (state.timer.remaining <= 0){
        state.timer.remaining = 0;
        stopTimer();
      }
      renderTimer();
    }, 1000);
    renderTimer();
  }
  function stopTimer(){
    state.timer.running = false;
    if (state.timer.intervalId){ clearInterval(state.timer.intervalId); state.timer.intervalId = null; }
    renderTimer();
  }
  function resetTimer(){
    stopTimer();
    state.timer.remaining = state.timer.max;
    renderTimer();
  }
  function toggleTimer(){ state.timer.running ? stopTimer() : startTimer(); }

  /* ------------ Results ------------ */
  function renderResults(){
    $("#rT1Name").textContent = state.teams[0].name;
    $("#rT2Name").textContent = state.teams[1].name;
    $("#rT1Score").textContent = state.teams[0].score;
    $("#rT2Score").textContent = state.teams[1].score;
    const a = state.teams[0].score, b = state.teams[1].score;
    $("#winnerLine").textContent =
      a === b ? "تعادل! 🤝" :
      a > b ? `${state.teams[0].name} هو الفائز 🏆` :
              `${state.teams[1].name} هو الفائز 🏆`;
  }

  function resetGameKeepTeams(){
    state.teams.forEach(t => { t.score = 0; t.usedLifelines = new Set(); });
    state.selectedCats = [];
    state.board = [];
    state.turn = 0;
    state.history = [];
    state.activeCellIndex = null;
    state.answerRevealed = false;
  }
  function resetAll(){
    state.teams = [
      { name: "الفريق الأول", score: 0, lifelines: [], usedLifelines: new Set() },
      { name: "الفريق الثاني", score: 0, lifelines: [], usedLifelines: new Set() }
    ];
    state.gameName = "";
    state.selectedCats = [];
    state.board = [];
    state.turn = 0;
    state.history = [];
    state.activeCellIndex = null;
    state.answerRevealed = false;
  }

  /* ------------ Score edit ------------ */
  function editScore(teamNum){
    const team = state.teams[teamNum - 1];
    openModal({
      title: `تعديل نقاط ${team.name}`,
      body: `
        <div>النقاط الحالية: <b>${team.score}</b></div>
        <label class="field" style="margin-top:10px">
          <span class="field__label">النقاط الجديدة</span>
          <input type="number" id="scoreEditInput" value="${team.score}" />
        </label>
      `,
      actions: [
        { label: "إلغاء" },
        { label: "حفظ", primary: true, onClick: () => {
          const v = parseInt(document.getElementById("scoreEditInput").value, 10);
          if (Number.isFinite(v)){
            pushHistory();
            team.score = v;
            renderBoard();
          }
        }}
      ]
    });
  }

  /* ------------ Render all ------------ */
  function renderAll(){
    renderLifelineChoosers();
    if (state.screen === "board") renderBoard();
    if (state.screen === "question") { renderQuestion(); renderTimer(); }
  }

  /* ------------ Wiring ------------ */
  function onClick(e){
    const t = e.target.closest("[data-action]");
    if (!t) return;
    const action = t.dataset.action;
    switch (action){
      case "go-setup":
        show("setup"); renderLifelineChoosers(); break;
      case "back-landing":
        show("landing"); break;
      case "go-categories":
        // validate
        state.gameName = $("#gameName").value.trim();
        state.teams[0].name = $("#team1Name").value.trim() || "الفريق الأول";
        state.teams[1].name = $("#team2Name").value.trim() || "الفريق الثاني";
        if (state.teams[0].lifelines.length !== 3 || state.teams[1].lifelines.length !== 3){
          flash("يرجى اختيار ٣ وسائل مساعدة لكل فريق.");
          return;
        }
        show("categories"); renderCategoryGroups(); break;
      case "back-setup":
        show("setup"); renderLifelineChoosers(); break;
      case "split-teams":
        splitTeams(); break;
      case "go-board":
        if (state.selectedCats.length !== 6){ flash("اختر ٦ فئات."); return; }
        buildBoard(); state.turn = 0; state.history = [];
        show("board"); renderBoard(); break;
      case "home-confirm":
        openModal({
          title: "إنهاء اللعبة؟",
          body: "سيتم الانتقال إلى شاشة النتائج.",
          actions: [
            { label: "إلغاء" },
            { label: "إنهاء", primary: true, onClick: () => { show("results"); renderResults(); }}
          ]
        });
        break;
      case "edit-score":
        editScore(t.dataset.team); break;
      case "undo":
        undo(); break;
      case "back-board":
        show("board"); renderBoard(); break;
      case "timer-toggle": toggleTimer(); break;
      case "timer-reset": resetTimer(); break;
      case "pass-turn": passTurn(); break;
      case "reveal": revealAnswer(); break;
      case "award": award(t.dataset.to); break;
      case "play-again":
        resetGameKeepTeams(); show("setup"); renderLifelineChoosers(); break;
      case "go-home":
        resetAll(); show("landing"); break;
    }
  }
  document.addEventListener("click", onClick);

  /* initial paint */
  renderLifelineChoosers();

})();
