/* ==========================================================================
   Pause / Settings menu -- shared by world.js and dungeon-lab.js.
   Opens from the burger (☰) button or the Escape key. Houses Quick Save,
   Quick Load, full audio controls (bound to the same Settings module the
   Start Screen uses, so changes persist across scene loads), and an Exit
   to Main Menu button. Builds its own DOM (like challenge-system.js) so
   neither host page needs matching markup.
   ========================================================================== */

(function () {
  'use strict';

  var overlay, modal, hooks = {};
  var open = false;

  function el(tag, className, text) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  }

  function build() {
    if (overlay) return;

    overlay = el('div', 'modal-overlay hidden');
    overlay.id = 'pause-overlay';
    modal = el('section', 'modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-labelledby', 'pause-title');
    overlay.appendChild(modal);

    var header = el('div', 'modal-header');
    var h2 = el('h2', null, '⏸️ Paused');
    h2.id = 'pause-title';
    var closeBtn = el('button', 'modal-close', '✕');
    closeBtn.setAttribute('aria-label', 'Resume');
    closeBtn.addEventListener('click', function () { close(); });
    header.appendChild(h2);
    header.appendChild(closeBtn);
    modal.appendChild(header);

    var body = el('div', 'modal-body');
    modal.appendChild(body);

    // ---- quick actions ----
    var quickRow = el('div', 'pause-quick-row');
    var saveBtn = el('button', 'menu-btn small', '💾 Quick Save');
    saveBtn.addEventListener('click', function () {
      if (hooks.onQuickSave) hooks.onQuickSave();
      flashSaved(saveBtn);
    });
    var loadBtn = el('button', 'menu-btn small', '📂 Quick Load');
    loadBtn.addEventListener('click', function () {
      if (hooks.onQuickLoad) hooks.onQuickLoad();
    });
    quickRow.appendChild(saveBtn);
    quickRow.appendChild(loadBtn);
    body.appendChild(quickRow);

    // ---- audio ----
    var audioHeading = el('h3', 'pause-section-heading', '🔊 Audio');
    body.appendChild(audioHeading);

    body.appendChild(buildToggleRow('Background Music', function (on) {
      window.Settings.setBgmOn(on);
      if (hooks.onAudioChange) hooks.onAudioChange();
    }, 'pause-toggle-bgm'));
    body.appendChild(buildSliderRow('Music Volume', function (v) { window.Settings.setBgmVolume(v); }, 'pause-slider-bgm', 'pause-label-bgm'));
    body.appendChild(buildToggleRow('Sound Effects', function (on) {
      window.Settings.setSfxOn(on);
      if (hooks.onAudioChange) hooks.onAudioChange();
    }, 'pause-toggle-sfx'));
    body.appendChild(buildSliderRow('Effects Volume', function (v) { window.Settings.setSfxVolume(v); }, 'pause-slider-sfx', 'pause-label-sfx'));

    // ---- exit ----
    var exitBtn = el('button', 'menu-btn primary wide', '🚪 Exit to Main Menu');
    exitBtn.id = 'pause-exit-btn';
    exitBtn.style.marginTop = '18px';
    exitBtn.addEventListener('click', function () { if (hooks.onExit) hooks.onExit(); });
    body.appendChild(exitBtn);

    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (window.ChallengeUI && window.ChallengeUI.isOpen()) return;
      toggle();
    });
  }

  function flashSaved(btn) {
    var original = btn.textContent;
    btn.textContent = '✅ Saved!';
    setTimeout(function () { btn.textContent = original; }, 1400);
  }

  function buildToggleRow(label, onChange, id) {
    var row = el('div', 'setting-row');
    row.appendChild(el('label', null, label));
    var btn = el('button', 'toggle-switch');
    btn.id = id;
    btn.setAttribute('role', 'switch');
    btn.appendChild(el('span', 'toggle-knob'));
    btn.addEventListener('click', function () {
      var next = btn.getAttribute('aria-checked') !== 'true';
      btn.setAttribute('aria-checked', String(next));
      onChange(next);
    });
    row.appendChild(btn);
    return row;
  }

  function buildSliderRow(label, onChange, id, labelId) {
    var row = el('div', 'setting-row');
    row.appendChild(el('label', null, label));
    var sliderRow = el('div', 'slider-row');
    var input = document.createElement('input');
    input.type = 'range'; input.min = '0'; input.max = '100'; input.step = '10'; input.id = id;
    var valueLabel = el('span', 'slider-value');
    valueLabel.id = labelId;
    input.addEventListener('input', function () {
      valueLabel.textContent = input.value + '%';
      onChange(parseInt(input.value, 10));
    });
    sliderRow.appendChild(input);
    sliderRow.appendChild(valueLabel);
    row.appendChild(sliderRow);
    return row;
  }

  function syncUI() {
    if (!window.Settings) return;
    var s = window.Settings.get();
    setToggle('pause-toggle-bgm', s.audio.bgmOn);
    setToggle('pause-toggle-sfx', s.audio.sfxOn);
    setSlider('pause-slider-bgm', 'pause-label-bgm', s.audio.bgmVolume);
    setSlider('pause-slider-sfx', 'pause-label-sfx', s.audio.sfxVolume);
  }
  function setToggle(id, value) { document.getElementById(id).setAttribute('aria-checked', String(!!value)); }
  function setSlider(id, labelId, value) {
    document.getElementById(id).value = value;
    document.getElementById(labelId).textContent = value + '%';
  }

  function openMenu() {
    build();
    syncUI();
    overlay.classList.remove('hidden');
    void overlay.offsetWidth;
    overlay.classList.add('visible');
    modal.classList.remove('hidden');
    void modal.offsetWidth;
    modal.classList.add('open');
    open = true;
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove('visible');
    modal.classList.remove('open');
    setTimeout(function () { overlay.classList.add('hidden'); }, 180);
    open = false;
  }

  function toggle() { if (open) close(); else openMenu(); }

  window.PauseMenu = {
    init: function (opts) {
      build();
      hooks = opts || {};
      var exitBtn = document.getElementById('pause-exit-btn');
      if (exitBtn && hooks.exitLabel) exitBtn.textContent = hooks.exitLabel;
    },
    open: openMenu,
    close: close,
    toggle: toggle,
    isOpen: function () { return open; }
  };
})();
