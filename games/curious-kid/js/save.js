/* ==========================================================================
   Save Manager -- browser storage (localStorage) + local device save/load.
   3 manual slots + 1 autosave slot. Settings (audio + controller) travel
   with every save, and a global "current" settings record is kept so the
   Start Screen has sensible defaults before any save is loaded.
   ========================================================================== */

(function () {
  'use strict';

  var STORAGE_PREFIX = 'ckqkc.save.';
  var SETTINGS_KEY = 'ckqkc.settings';
  var SAVE_VERSION = 1;
  var SLOT_IDS = ['1', '2', '3'];

  function defaultSettings() {
    return { audio: { bgmOn: true, bgmVolume: 100, sfxOn: true, sfxVolume: 100 }, controller: 'arrows' };
  }

  function slotKey(id) { return STORAGE_PREFIX + (id === 'auto' ? 'auto' : 'slot' + id); }

  function safeParse(raw) {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function isValidSave(obj) {
    return !!(obj && typeof obj === 'object' && obj.version && obj.progress && obj.settings && obj.playerName);
  }

  function readSlot(id) {
    var obj = safeParse(localStorage.getItem(slotKey(id)));
    return isValidSave(obj) ? obj : null;
  }

  function writeSlot(id, data) {
    try {
      localStorage.setItem(slotKey(id), JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('Could not write save (storage full or unavailable):', e);
      return false;
    }
  }

  function deleteSlot(id) {
    localStorage.removeItem(slotKey(id));
  }

  function getSettings() {
    var s = safeParse(localStorage.getItem(SETTINGS_KEY));
    return s && s.audio && s.controller ? s : defaultSettings();
  }

  function setSettings(settings) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {}
  }

  function newSave(playerName, settingsSnapshot) {
    var now = new Date().toISOString();
    return {
      version: SAVE_VERSION,
      playerName: playerName || 'Curious Kid',
      createdAt: now,
      updatedAt: now,
      progress: {
        chapter: 'Chapter 1 — The Valley of Discovery',
        location: 'Chokmah, the beginning of the journey',
        playtimeSeconds: 0,
        crystals: { science: false, mathematics: false, music: false, goodness: false },
        party: [], // starts with just the Hero; companions are appended as they're recruited in-world: [{ role, name, character, characterLabel }, ...]
        activeRole: 'hero', // which party member is currently under player control
        npcsResolved: [], // ids of WORLD_NPCS whose quiz has been answered correctly
        obstaclesCleared: [], // ids of WORLD_OBSTACLES already cleared
        abilities: {} // role -> { level, xp, points } -- see abilities-data.js AbilitiesData.newProgress()
      },
      settings: settingsSnapshot || defaultSettings()
    };
  }

  function firstEmptySlot() {
    for (var i = 0; i < SLOT_IDS.length; i++) {
      if (!readSlot(SLOT_IDS[i])) return SLOT_IDS[i];
    }
    return null;
  }

  function formatDate(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' +
        d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  function formatPlaytime(seconds) {
    seconds = seconds || 0;
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return h + 'h ' + m + 'm played';
    if (m > 0) return m + 'm played';
    return 'Just started';
  }

  function crystalCount(save) {
    var c = save.progress && save.progress.crystals;
    if (!c) return 0;
    return Object.keys(c).filter(function (k) { return c[k]; }).length;
  }

  function exportToDevice(id) {
    var data = readSlot(id);
    if (!data) return false;
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var stamp = new Date().toISOString().slice(0, 10);
    var label = id === 'auto' ? 'AutoSave' : 'Slot' + id;
    a.href = url;
    a.download = 'CuriousKid_' + label + '_' + stamp + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    return true;
  }

  function importFromFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file) { reject(new Error('No file selected')); return; }
      var reader = new FileReader();
      reader.onload = function () {
        var obj = safeParse(reader.result);
        if (!isValidSave(obj)) { reject(new Error('That file is not a valid Curious Kid save.')); return; }
        resolve(obj);
      };
      reader.onerror = function () { reject(new Error('Could not read that file.')); };
      reader.readAsText(file);
    });
  }

  window.SaveManager = {
    SLOT_IDS: SLOT_IDS,
    defaultSettings: defaultSettings,
    getSettings: getSettings,
    setSettings: setSettings,
    readSlot: readSlot,
    writeSlot: writeSlot,
    deleteSlot: deleteSlot,
    newSave: newSave,
    firstEmptySlot: firstEmptySlot,
    formatDate: formatDate,
    formatPlaytime: formatPlaytime,
    crystalCount: crystalCount,
    exportToDevice: exportToDevice,
    importFromFile: importFromFile
  };
})();
