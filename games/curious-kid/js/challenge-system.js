/* ==========================================================================
   Challenge UI -- the Pokemon-style "stop and ask" modal used for NPC
   quizzes, recruit greetings, obstacle messages and the boss fight. Pure
   DOM (no Three.js dependency) so it can be shared by world.js and
   dungeon-lab.js. Builds its own markup on init() so neither host page
   needs matching HTML.
   ========================================================================== */

(function () {
  'use strict';

  var root, card, thumbEl, nameEl, bodyEl, choicesEl, footerEl, hintBtn, revealBtn, hintTextEl, bannerEl;
  var open = false;
  var cooldowns = {}; // abilityKey -> timestamp (ms) when ready again
  var bannerTimer = null;
  var hideTimer = null;

  function init() {
    if (root) return;

    root = document.createElement('div');
    root.id = 'chal-overlay';
    root.className = 'chal-overlay hidden';

    card = document.createElement('div');
    card.className = 'chal-card';
    root.appendChild(card);

    var head = document.createElement('div');
    head.className = 'chal-head';
    thumbEl = document.createElement('img');
    thumbEl.className = 'chal-thumb';
    thumbEl.alt = '';
    nameEl = document.createElement('div');
    nameEl.className = 'chal-name';
    head.appendChild(thumbEl);
    head.appendChild(nameEl);
    card.appendChild(head);

    bodyEl = document.createElement('div');
    bodyEl.className = 'chal-body';
    card.appendChild(bodyEl);

    hintTextEl = document.createElement('div');
    hintTextEl.className = 'chal-hint hidden';
    card.appendChild(hintTextEl);

    choicesEl = document.createElement('div');
    choicesEl.className = 'chal-choices';
    card.appendChild(choicesEl);

    footerEl = document.createElement('div');
    footerEl.className = 'chal-footer';
    card.appendChild(footerEl);

    document.body.appendChild(root);

    bannerEl = document.createElement('div');
    bannerEl.id = 'chal-banner';
    bannerEl.className = 'chal-banner hidden';
    document.body.appendChild(bannerEl);
  }

  function isOpen() { return open; }

  function show() {
    clearTimeout(hideTimer);
    root.classList.remove('hidden');
    void root.offsetWidth;
    root.classList.add('visible');
    open = true;
  }
  function hide() {
    root.classList.remove('visible');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () { root.classList.add('hidden'); }, 220);
    open = false;
  }

  function clearChoices() { choicesEl.innerHTML = ''; }
  function clearFooter() { footerEl.innerHTML = ''; }

  // ---------------- Simple dismissible line (flavor NPC / obstacle message / boss intro) ----------------
  function showLine(opts) {
    init();
    thumbEl.src = opts.thumb || '';
    thumbEl.style.visibility = opts.thumb ? 'visible' : 'hidden';
    nameEl.textContent = opts.name || '';
    bodyEl.textContent = opts.text || '';
    hintTextEl.classList.add('hidden');
    clearChoices();
    clearFooter();
    var btn = document.createElement('button');
    btn.className = 'chal-btn chal-btn-primary';
    btn.textContent = opts.buttonLabel || 'Okay!';
    btn.addEventListener('click', function () { hide(); if (opts.onClose) opts.onClose(); });
    footerEl.appendChild(btn);
    show();
  }

  // ---------------- Recruit card ----------------
  function showRecruit(opts) {
    init();
    thumbEl.src = opts.thumb || '';
    thumbEl.style.visibility = 'visible';
    nameEl.textContent = opts.name || '';
    bodyEl.textContent = opts.greet || '';
    hintTextEl.classList.add('hidden');
    clearChoices();
    clearFooter();
    var btn = document.createElement('button');
    btn.className = 'chal-btn chal-btn-primary';
    btn.textContent = 'Team Up! 🤝';
    btn.addEventListener('click', function () { hide(); if (opts.onJoin) opts.onJoin(); });
    footerEl.appendChild(btn);
    show();
  }

  // ---------------- Quiz ----------------
  // opts: { name, thumb, greet, question:{category,prompt,choices,correctIndex,hint,fact},
  //         abilities: [{key,name,icon,cooldown}], onResult(correct) }
  function formatCooldown(sec) {
    if (sec <= 0) return 'ready';
    if (sec < 60) return Math.ceil(sec) + 's';
    return Math.ceil(sec / 60) + 'm';
  }

  function askQuestion(opts) {
    init();
    var q = opts.question;
    thumbEl.src = opts.thumb || '';
    thumbEl.style.visibility = opts.thumb ? 'visible' : 'hidden';
    nameEl.textContent = opts.name || '';
    bodyEl.textContent = (opts.greet ? opts.greet + ' ' : '') + q.prompt;
    hintTextEl.classList.add('hidden');
    hintTextEl.textContent = '';
    clearChoices();
    clearFooter();

    var answered = false;
    var revealedCorrect = false;

    q.choices.forEach(function (choiceText, i) {
      var btn = document.createElement('button');
      btn.className = 'chal-choice';
      btn.textContent = choiceText;
      btn.addEventListener('click', function () {
        if (answered) return;
        if (i === q.correctIndex) {
          answered = true;
          btn.classList.add('correct');
          bodyEl.textContent = '✨ That\'s right! ' + (q.fact || '');
          setTimeout(function () { hide(); if (opts.onResult) opts.onResult(true); }, 1100);
        } else {
          btn.classList.add('wrong');
          setTimeout(function () { btn.classList.remove('wrong'); }, 500);
        }
      });
      choicesEl.appendChild(btn);
    });

    // ---- ability buttons (Quick Thinker = hint, Good Heart = reveal answer) ----
    (opts.abilities || []).forEach(function (ab) {
      var remaining = Math.max(0, ((cooldowns[ab.key] || 0) - Date.now()) / 1000);
      var btn = document.createElement('button');
      btn.className = 'chal-btn chal-ability-btn';
      btn.disabled = remaining > 0;
      btn.innerHTML = ab.icon + ' ' + ab.name + (remaining > 0 ? ' <span class="chal-cd">(' + formatCooldown(remaining) + ')</span>' : '');
      btn.addEventListener('click', function () {
        if (answered) return;
        cooldowns[ab.key] = Date.now() + ab.cooldown * 1000;
        btn.disabled = true;
        if (ab.key === 'quickThinker') {
          hintTextEl.textContent = '🧠 Hint: ' + q.hint;
          hintTextEl.classList.remove('hidden');
        } else if (ab.key === 'goodHeart' && !revealedCorrect) {
          revealedCorrect = true;
          var kids = choicesEl.querySelectorAll('.chal-choice');
          kids[q.correctIndex].classList.add('revealed');
        }
        btn.innerHTML = ab.icon + ' ' + ab.name + ' <span class="chal-cd">(used)</span>';
      });
      footerEl.appendChild(btn);
    });

    show();
  }

  // ---------------- Boss battle: a queue of questions, tracks progress ----------------
  function askBossQuestion(opts) {
    // Same modal, different framing text via opts.greet (e.g. "Question 2 of 4")
    askQuestion(opts);
  }

  // ---------------- Toast-y banner (level up, obstacle cleared, party joined) ----------------
  function showBanner(text, duration) {
    init();
    bannerEl.textContent = text;
    bannerEl.classList.remove('hidden');
    void bannerEl.offsetWidth;
    bannerEl.classList.add('visible');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () {
      bannerEl.classList.remove('visible');
      setTimeout(function () { bannerEl.classList.add('hidden'); }, 400);
    }, duration || 3200);
  }

  window.ChallengeUI = {
    init: init,
    isOpen: isOpen,
    showLine: showLine,
    showRecruit: showRecruit,
    askQuestion: askQuestion,
    askBossQuestion: askBossQuestion,
    showBanner: showBanner
  };
})();
