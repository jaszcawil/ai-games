/* ==========================================================================
   Main -- ties the Start Screen UI to Settings / SaveManager / SoundManager.
   ========================================================================== */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', init);

  var overlay = document.getElementById('modal-overlay');
  var quickMuteBtn = document.getElementById('btn-quick-mute');
  var fadeCurtain = document.getElementById('fade-curtain');

  var pendingImportSave = null; // holds a save object awaiting slot choice after import
  var pendingNewGameSlot = null; // holds slot id chosen when all slots are full

  function init() {
    window.Settings.load();
    window.Settings.applyToAudio();
    syncSettingsUI();
    syncQuickMuteIcon();

    bindMenuButtons();
    bindModalChrome();
    bindNewGame();
    bindSettingsPanel();
    bindLoadGame();
    bindQuickMute();
  }

  // ---------------- Modal plumbing ----------------

  function openModal(id) {
    var modal = document.getElementById(id);
    if (!modal) return;
    overlay.classList.remove('hidden');
    // force reflow so the transition plays
    void overlay.offsetWidth;
    overlay.classList.add('visible');
    document.querySelectorAll('#modal-overlay .modal').forEach(function (m) { m.classList.add('hidden'); m.classList.remove('open'); });
    modal.classList.remove('hidden');
    void modal.offsetWidth;
    modal.classList.add('open');
    click();
  }

  function closeAllModals() {
    overlay.classList.remove('visible');
    setTimeout(function () {
      overlay.classList.add('hidden');
      document.querySelectorAll('#modal-overlay .modal').forEach(function (m) { m.classList.add('hidden'); m.classList.remove('open'); });
    }, 180);
  }

  function bindModalChrome() {
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeAllModals();
    });
    document.querySelectorAll('.modal-close').forEach(function (btn) {
      btn.addEventListener('click', function () { click(); closeAllModals(); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAllModals();
    });
  }

  function bindMenuButtons() {
    document.getElementById('btn-start').addEventListener('click', function () { startNewGame(); });
    document.getElementById('btn-load').addEventListener('click', function () { renderSlotList(); openModal('modal-load'); });
    document.getElementById('btn-settings').addEventListener('click', function () { syncSettingsUI(); openModal('modal-settings'); });
    document.getElementById('btn-credits').addEventListener('click', function () { openModal('modal-credits'); });
  }

  function click() { window.SoundManager.playSfx('click'); }

  // ---------------- New Game ----------------

  function startNewGame() {
    click();
    var emptySlot = window.SaveManager.firstEmptySlot();
    if (emptySlot) {
      goToCharacterSelect(emptySlot);
      return;
    }
    pendingNewGameSlot = null;
    renderNewGameSlotPicker();
    openModal('modal-newgame');
  }

  function renderNewGameSlotPicker() {
    var box = document.getElementById('newgame-slot-picker');
    box.innerHTML = '';
    if (pendingNewGameSlot !== null) return; // an empty slot exists, nothing to pick

    var hint = document.createElement('p');
    hint.className = 'hint-text';
    hint.textContent = 'All 3 save slots are full. Choose one to start fresh on (it will be overwritten):';
    box.appendChild(hint);

    window.SaveManager.SLOT_IDS.forEach(function (id) {
      var save = window.SaveManager.readSlot(id);
      var btn = document.createElement('button');
      btn.className = 'slot-pick-btn';
      btn.type = 'button';
      btn.textContent = 'Slot ' + id + ' — ' + save.playerName + ' (' + window.SaveManager.formatPlaytime(save.progress.playtimeSeconds) + ')';
      btn.addEventListener('click', function () {
        pendingNewGameSlot = id;
        box.querySelectorAll('.slot-pick-btn').forEach(function (b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
      });
      box.appendChild(btn);
    });
  }

  function bindNewGame() {
    document.getElementById('btn-begin-adventure').addEventListener('click', function () {
      click();
      if (pendingNewGameSlot === null) {
        showToast('Please choose a slot to start on.');
        return;
      }
      closeAllModals();
      goToCharacterSelect(pendingNewGameSlot);
    });
  }

  function goToCharacterSelect(slotId) {
    window.localStorage.setItem('ckqkc.pendingSlot', slotId);
    fadeCurtain.classList.remove('hidden');
    fadeCurtain.classList.add('active');
    setTimeout(function () {
      window.location.href = 'character-select.html?slot=' + encodeURIComponent(slotId);
    }, 550);
  }

  // ---------------- Load Game ----------------

  function bindLoadGame() {
    var fileInput = document.getElementById('file-import');
    document.getElementById('btn-import-device').addEventListener('click', function () {
      click();
      fileInput.value = '';
      fileInput.click();
    });
    fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      window.SaveManager.importFromFile(file).then(function (save) {
        pendingImportSave = save;
        openImportSlotChooser(save);
      }).catch(function (err) {
        showToast(err.message || 'Could not import that save.');
      });
    });
  }

  function openImportSlotChooser(save) {
    var list = document.getElementById('slot-list');
    var box = document.createElement('div');
    box.className = 'slot-picker';
    var hint = document.createElement('p');
    hint.className = 'hint-text';
    hint.textContent = 'Importing "' + save.playerName + '" — choose a slot to place it in:';
    box.appendChild(hint);
    window.SaveManager.SLOT_IDS.forEach(function (id) {
      var existing = window.SaveManager.readSlot(id);
      var btn = document.createElement('button');
      btn.className = 'slot-pick-btn';
      btn.type = 'button';
      btn.textContent = 'Slot ' + id + (existing ? ' — overwrite ' + existing.playerName : ' — empty');
      btn.addEventListener('click', function () {
        window.SaveManager.writeSlot(id, pendingImportSave);
        pendingImportSave = null;
        box.remove();
        renderSlotList();
        showToast('Save imported into Slot ' + id + '!');
      });
      box.appendChild(btn);
    });
    list.parentNode.insertBefore(box, list.nextSibling);
  }

  function renderSlotList() {
    var list = document.getElementById('slot-list');
    list.innerHTML = '';
    var ids = ['auto', '1', '2', '3'];
    ids.forEach(function (id) {
      list.appendChild(buildSlotRow(id));
    });
  }

  function buildSlotRow(id) {
    var save = window.SaveManager.readSlot(id);
    var row = document.createElement('div');
    row.className = 'save-slot' + (id === 'auto' ? ' auto' : '');

    var icon = document.createElement('div');
    icon.className = 'slot-icon';
    icon.textContent = id === 'auto' ? '🌟' : id;
    row.appendChild(icon);

    var info = document.createElement('div');
    info.className = 'slot-info';
    if (save) {
      var title = document.createElement('div');
      title.className = 'slot-title';
      title.textContent = (id === 'auto' ? 'Autosave — ' : 'Slot ' + id + ' — ') + save.playerName;
      var detail = document.createElement('div');
      detail.className = 'slot-detail';
      var crystals = window.SaveManager.crystalCount(save);
      var partySize = save.progress.party ? save.progress.party.length : 0;
      detail.textContent = save.progress.chapter + ' · ' + window.SaveManager.formatPlaytime(save.progress.playtimeSeconds) +
        ' · 👥' + partySize + '/4 · 💎' + crystals + '/4 · ' + window.SaveManager.formatDate(save.updatedAt);
      info.appendChild(title);
      info.appendChild(detail);
    } else {
      var emptyTitle = document.createElement('div');
      emptyTitle.className = 'slot-title';
      emptyTitle.textContent = id === 'auto' ? 'Autosave — empty' : 'Slot ' + id + ' — empty';
      var emptyDetail = document.createElement('div');
      emptyDetail.className = 'slot-detail';
      emptyDetail.textContent = id === 'auto' ? 'Created automatically as you play' : 'Start a new game to fill this slot';
      info.appendChild(emptyTitle);
      info.appendChild(emptyDetail);
    }
    row.appendChild(info);

    var actions = document.createElement('div');
    actions.className = 'slot-actions';

    if (save) {
      var continueBtn = document.createElement('button');
      continueBtn.className = 'slot-btn continue';
      continueBtn.textContent = 'Continue';
      continueBtn.addEventListener('click', function () {
        click();
        window.Settings.adoptFromSave(save);
        window.localStorage.setItem('ckqkc.lastSlot', id);
        closeAllModals();
        goToWorld(id);
      });
      actions.appendChild(continueBtn);

      var exportBtn = document.createElement('button');
      exportBtn.className = 'slot-btn';
      exportBtn.textContent = 'Export';
      exportBtn.addEventListener('click', function () {
        click();
        window.SaveManager.exportToDevice(id);
        showToast('Save file downloaded.');
      });
      actions.appendChild(exportBtn);

      var deleteBtn = document.createElement('button');
      deleteBtn.className = 'slot-btn danger';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', function () {
        click();
        if (window.confirm('Delete this save? This cannot be undone.')) {
          window.SaveManager.deleteSlot(id);
          renderSlotList();
          showToast('Save deleted.');
        }
      });
      actions.appendChild(deleteBtn);
    }

    row.appendChild(actions);
    return row;
  }

  // ---------------- Settings panel ----------------

  function bindSettingsPanel() {
    document.querySelectorAll('.tab-btn').forEach(function (tab) {
      tab.addEventListener('click', function () {
        click();
        document.querySelectorAll('.tab-btn').forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        var target = tab.getAttribute('data-tab');
        document.querySelectorAll('.tab-panel').forEach(function (panel) {
          panel.hidden = panel.getAttribute('data-panel') !== target;
        });
      });
    });

    bindToggle('toggle-bgm', function (on) { window.Settings.setBgmOn(on); syncQuickMuteIcon(); });
    bindToggle('toggle-sfx', function (on) { window.Settings.setSfxOn(on); syncQuickMuteIcon(); });

    bindSlider('slider-bgm', 'label-bgm', function (v) { window.Settings.setBgmVolume(v); });
    bindSlider('slider-sfx', 'label-sfx', function (v) { window.Settings.setSfxVolume(v); });

    document.getElementById('btn-reset-audio').addEventListener('click', function () {
      click();
      window.Settings.resetAudioToDefault();
      syncSettingsUI();
      syncQuickMuteIcon();
      showToast('Audio settings reset.');
    });

    document.querySelectorAll('.controller-card').forEach(function (card) {
      card.addEventListener('click', function () {
        click();
        document.querySelectorAll('.controller-card').forEach(function (c) { c.classList.remove('active'); });
        card.classList.add('active');
        window.Settings.setController(card.getAttribute('data-controller'));
      });
    });
  }

  function bindToggle(id, onChange) {
    var el = document.getElementById(id);
    el.addEventListener('click', function () {
      var next = el.getAttribute('aria-checked') !== 'true';
      el.setAttribute('aria-checked', String(next));
      onChange(next);
    });
  }

  function bindSlider(id, labelId, onChange) {
    var el = document.getElementById(id);
    var label = document.getElementById(labelId);
    el.addEventListener('input', function () {
      label.textContent = el.value + '%';
      onChange(parseInt(el.value, 10));
    });
  }

  function syncSettingsUI() {
    var s = window.Settings.get();
    setToggle('toggle-bgm', s.audio.bgmOn);
    setToggle('toggle-sfx', s.audio.sfxOn);
    setSlider('slider-bgm', 'label-bgm', s.audio.bgmVolume);
    setSlider('slider-sfx', 'label-sfx', s.audio.sfxVolume);
    document.querySelectorAll('.controller-card').forEach(function (card) {
      card.classList.toggle('active', card.getAttribute('data-controller') === s.controller);
    });
  }

  function setToggle(id, value) {
    document.getElementById(id).setAttribute('aria-checked', String(!!value));
  }
  function setSlider(id, labelId, value) {
    document.getElementById(id).value = value;
    document.getElementById(labelId).textContent = value + '%';
  }

  // ---------------- Quick mute ----------------

  function bindQuickMute() {
    quickMuteBtn.addEventListener('click', function () {
      var s = window.Settings.get();
      var nowOn = !(s.audio.bgmOn || s.audio.sfxOn);
      window.Settings.setBgmOn(nowOn);
      window.Settings.setSfxOn(nowOn);
      syncSettingsUI();
      syncQuickMuteIcon();
      if (nowOn) click();
    });
  }

  function syncQuickMuteIcon() {
    var s = window.Settings.get();
    var anyOn = s.audio.bgmOn || s.audio.sfxOn;
    quickMuteBtn.textContent = anyOn ? '🔊' : '🔇';
  }

  // ---------------- Toast ----------------

  var toastTimer = null;
  function showToast(message) {
    var toast = document.getElementById('app-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'app-toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('visible'); }, 2400);
  }

  // ---------------- Scene transition ----------------

  function goToWorld(slotId) {
    fadeCurtain.classList.remove('hidden');
    fadeCurtain.classList.add('active');
    setTimeout(function () {
      window.location.href = 'world.html?slot=' + encodeURIComponent(slotId);
    }, 550);
  }
})();
