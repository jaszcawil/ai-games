// ===================================================================
// ui.js -- HUD, dialogue, quiz overlay, puzzle overlay, menus
// ===================================================================

let _toastTimer = null;
function showToast(msg, ms) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.add('hidden'), ms || 1800);
}

function el(id) { return document.getElementById(id); }
function show(id) { el(id).classList.remove('hidden'); }
function hide(id) { el(id).classList.add('hidden'); }

// ---------------- Title / Hero select population ----------------
function populateTitleHeroStrip() {
  const strip = el('titleHeroStrip');
  strip.innerHTML = '';
  HEROES.forEach(h => {
    const img = document.createElement('img');
    img.src = h.img; img.alt = h.name;
    strip.appendChild(img);
  });
}

let _selectedHeroId = null;
function populateHeroSelect(onConfirm) {
  const grid = el('heroSelectGrid');
  grid.innerHTML = '';
  _selectedHeroId = null;
  el('btnConfirmHero').disabled = true;
  HEROES.forEach(h => {
    const card = document.createElement('div');
    card.className = 'hero-card';
    card.innerHTML = `
      <img src="${h.img}" alt="${h.name}">
      <div class="hero-name">${h.name}</div>
      <div class="hero-power">${h.power}</div>
    `;
    card.addEventListener('click', () => {
      [...grid.children].forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      _selectedHeroId = h.id;
      el('btnConfirmHero').disabled = false;
    });
    grid.appendChild(card);
  });
  el('btnConfirmHero').onclick = () => { if (_selectedHeroId) onConfirm(_selectedHeroId); };
}

// ---------------- Dialogue ----------------
function runDialogue(speakerImgOrCanvas, name, lines, onDone) {
  const box = el('dialogueBox');
  const portrait = el('dialoguePortrait');
  portrait.innerHTML = '';
  if (speakerImgOrCanvas instanceof HTMLCanvasElement) {
    portrait.appendChild(speakerImgOrCanvas);
  } else {
    const img = document.createElement('img');
    img.src = speakerImgOrCanvas;
    portrait.appendChild(img);
  }
  el('dialogueName').textContent = name;
  let idx = 0;
  const textEl = el('dialogueText');
  const nextBtn = el('btnDialogueNext');
  function showLine() {
    textEl.textContent = lines[idx];
    nextBtn.textContent = (idx === lines.length - 1) ? "Let's Go!" : 'Next';
  }
  showLine();
  box.classList.remove('hidden');
  nextBtn.onclick = () => {
    idx++;
    if (idx >= lines.length) {
      box.classList.add('hidden');
      nextBtn.onclick = null;
      if (onDone) onDone();
    } else {
      showLine();
    }
  };
}

// ---------------- Quiz ----------------
function runQuiz(topic, targetCorrect, chiefKey, onComplete) {
  show('quizOverlay');
  const progressEl = el('quizProgress');
  progressEl.innerHTML = '';
  const dots = [];
  for (let i = 0; i < targetCorrect; i++) {
    const d = document.createElement('span');
    progressEl.appendChild(d);
    dots.push(d);
  }
  const portrait = el('quizChiefPortrait');
  portrait.innerHTML = '';
  const canvas = getChiefCanvas(chiefKey);
  const c2 = document.createElement('canvas');
  c2.width = 64; c2.height = 64;
  c2.getContext('2d').drawImage(canvas, 0, 0, 64, 64);
  portrait.appendChild(c2);
  el('quizChiefSpeech').textContent = `Answer ${targetCorrect} correctly to open the path!`;

  let correctCount = 0;
  let current = null;
  let wrongChosen = new Set();

  function newQuestion() {
    current = TOPIC_GENERATORS[topic] ? TOPIC_GENERATORS[topic]() : genMixed();
    wrongChosen = new Set();
    el('quizQuestion').textContent = current.q;
    el('quizFeedback').textContent = '';
    const answersEl = el('quizAnswers');
    answersEl.innerHTML = '';
    current.choices.forEach(choiceVal => {
      const btn = document.createElement('button');
      btn.className = 'quiz-answer-btn';
      btn.textContent = typeof choiceVal === 'number' ? choiceVal.toLocaleString() : choiceVal;
      btn.addEventListener('click', () => handleAnswer(btn, choiceVal));
      answersEl.appendChild(btn);
    });
  }

  function handleAnswer(btn, val) {
    const isCorrect = String(val) === String(current.answer);
    if (isCorrect) {
      btn.classList.add('correct');
      el('quizFeedback').textContent = '🎉 Correct!';
      el('quizFeedback').style.color = '#4caf50';
      correctCount++;
      dots[correctCount-1].classList.add('done');
      [...el('quizAnswers').children].forEach(b => b.disabled = true);
      setTimeout(() => {
        if (correctCount >= targetCorrect) {
          hide('quizOverlay');
          onComplete(true);
        } else {
          newQuestion();
        }
      }, 700);
    } else {
      btn.classList.add('wrong');
      btn.disabled = true;
      el('quizFeedback').textContent = 'Not quite — try again!';
      el('quizFeedback').style.color = '#ef5350';
    }
  }

  newQuestion();
}

// ---------------- Puzzle ----------------
function runPuzzle(topic, chiefKey, onComplete) {
  show('puzzleOverlay');
  const puzzle = generatePuzzle(topic);
  el('puzzleFeedback').textContent = '';
  const workArea = el('puzzleWorkArea');
  const tray = el('puzzleTray');
  workArea.innerHTML = ''; tray.innerHTML = '';
  el('puzzlePrompt').textContent = puzzle.prompt;

  if (puzzle.kind === 'blockbuilder') {
    let h = 0, t = 0, o = 0;
    function renderWork() {
      workArea.innerHTML = `<div style="font-size:28px;font-weight:900;color:#3a6ea5;">
        ${h}&#215;100 + ${t}&#215;10 + ${o}&#215;1 = <span style="color:#ff6b35">${(h*100+t*10+o).toLocaleString()}</span></div>`;
    }
    renderWork();
    const mk = (label, onClick) => {
      const b = document.createElement('button');
      b.className = 'puzzle-chip';
      b.textContent = label;
      b.addEventListener('click', onClick);
      return b;
    };
    tray.appendChild(mk('+100 (Hundreds)', () => { if (h<9){h++; renderWork();} }));
    tray.appendChild(mk('+10 (Tens)', () => { if (t<9){t++; renderWork();} }));
    tray.appendChild(mk('+1 (Ones)', () => { if (o<9){o++; renderWork();} }));
    tray.appendChild(mk('↺ Reset', () => { h=0;t=0;o=0; renderWork(); }));

    el('btnPuzzleCheck').onclick = () => {
      const val = h*100+t*10+o;
      if (val === puzzle.target) {
        el('puzzleFeedback').style.color = '#4caf50';
        el('puzzleFeedback').textContent = '🎉 Perfect! That matches!';
        setTimeout(() => { hide('puzzleOverlay'); onComplete(true); }, 900);
      } else {
        el('puzzleFeedback').style.color = '#ef5350';
        el('puzzleFeedback').textContent = val < puzzle.target ? 'Too small — add more blocks!' : 'Too many blocks — try removing some! (Reset to start over)';
      }
    };
  } else if (puzzle.kind === 'ordertap') {
    let placed = [];
    workArea.innerHTML = `<div id="orderWorkText" style="font-size:22px;font-weight:900;color:#3a6ea5;">Tap steps below&hellip;</div>`;
    function renderTray() {
      tray.innerHTML = '';
      puzzle.steps.forEach((s, i) => {
        const chip = document.createElement('button');
        chip.className = 'puzzle-chip' + (placed.includes(i) ? ' used' : '');
        chip.textContent = s.label;
        chip.disabled = placed.includes(i);
        chip.addEventListener('click', () => {
          placed.push(i);
          document.getElementById('orderWorkText').textContent =
            'Order: ' + placed.map(pi => puzzle.steps[pi].label).join('  →  ');
          renderTray();
        });
        tray.appendChild(chip);
      });
      const reset = document.createElement('button');
      reset.className = 'puzzle-chip';
      reset.textContent = '↺ Reset';
      reset.addEventListener('click', () => { placed = []; document.getElementById('orderWorkText').textContent='Tap steps below…'; renderTray(); });
      tray.appendChild(reset);
    }
    renderTray();

    el('btnPuzzleCheck').onclick = () => {
      const orderOk = placed.length === puzzle.steps.length &&
        placed.every((si, idx) => puzzle.steps[si].order === idx + 1);
      if (orderOk) {
        el('puzzleFeedback').style.color = '#4caf50';
        el('puzzleFeedback').textContent = `🎉 Correct order! The answer is ${puzzle.resultValue}.`;
        setTimeout(() => { hide('puzzleOverlay'); onComplete(true); }, 1000);
      } else {
        el('puzzleFeedback').style.color = '#ef5350';
        el('puzzleFeedback').textContent = 'Hmm, try a different order! (Reset to start over)';
      }
    };
  }
}

// ---------------- HUD ----------------
function updateHUDBadges() {
  const row = el('hudBadgeRow');
  row.innerHTML = '';
  VILLAGES.forEach(v => {
    const b = document.createElement('div');
    b.className = 'hud-badge' + (SaveSystem.current.badges[v.id] ? ' earned' : '');
    b.textContent = v.badgeIcon;
    row.appendChild(b);
  });
}
function updateHUDHero(heroId) {
  const hero = HEROES.find(h => h.id === heroId);
  if (!hero) return;
  el('hudHeroIcon').src = hero.img;
  el('hudHeroName').textContent = hero.name;
}
