/* ==========================================================================
   Settings Controller -- the single source of truth for "current" audio +
   controller settings while on the Start Screen. Reads/writes via
   SaveManager (localStorage) and pushes live changes into SoundManager.
   When a save is loaded, its embedded settings become the current settings.
   ========================================================================== */

(function () {
  'use strict';

  var current = null;

  function load() {
    current = window.SaveManager.getSettings();
    return current;
  }

  function persist() {
    window.SaveManager.setSettings(current);
  }

  function get() {
    return current || load();
  }

  function applyToAudio() {
    window.SoundManager.init(current.audio);
  }

  function adoptFromSave(save) {
    current = JSON.parse(JSON.stringify(save.settings));
    persist();
    applyToAudio();
  }

  function setBgmOn(on) {
    get().audio.bgmOn = !!on;
    window.SoundManager.setBgmOn(on);
    persist();
  }
  function setBgmVolume(v) {
    get().audio.bgmVolume = v;
    window.SoundManager.setBgmVolume(v);
    persist();
  }
  function setSfxOn(on) {
    get().audio.sfxOn = !!on;
    window.SoundManager.setSfxOn(on);
    persist();
  }
  function setSfxVolume(v) {
    get().audio.sfxVolume = v;
    window.SoundManager.setSfxVolume(v);
    persist();
  }
  function setController(mode) {
    get().controller = mode;
    persist();
  }
  function resetAudioToDefault() {
    var d = window.SaveManager.defaultSettings().audio;
    current.audio = d;
    window.SoundManager.init(d);
    persist();
    return d;
  }

  window.Settings = {
    load: load,
    get: get,
    applyToAudio: applyToAudio,
    adoptFromSave: adoptFromSave,
    setBgmOn: setBgmOn,
    setBgmVolume: setBgmVolume,
    setSfxOn: setSfxOn,
    setSfxVolume: setSfxVolume,
    setController: setController,
    resetAudioToDefault: resetAudioToDefault
  };
})();
