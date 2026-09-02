/* ==========================================================================
   Sound Manager -- background music + sound effects.
   Respects Settings (on/off + volume in 10% steps) and works around the
   browser autoplay policy by starting music on the first user interaction.
   ========================================================================== */

(function () {
  'use strict';

  var state = {
    bgmOn: true,
    bgmVolume: 100,
    sfxOn: true,
    sfxVolume: 100
  };

  var DEFAULT_BGM_SRC = 'assets/audio/start-theme.mp3';
  // A page can set window.CKQKC_BGM_TRACK (single looping track) or
  // window.CKQKC_BGM_PLAYLIST (an array of tracks played back-to-back, looping
  // as a set) before this script loads, so the right first byte gets fetched
  // immediately instead of wastefully starting on the default track.
  var playlist = null, playlistIndex = 0;
  var initialPlaylist = window.CKQKC_BGM_PLAYLIST;
  var currentBgmSrc;
  if (initialPlaylist && initialPlaylist.length) {
    playlist = initialPlaylist.slice();
    currentBgmSrc = playlist[0];
  } else {
    currentBgmSrc = window.CKQKC_BGM_TRACK || DEFAULT_BGM_SRC;
  }
  var bgm = new window.Audio(currentBgmSrc);
  bgm.loop = !playlist;
  bgm.preload = 'auto';
  bgm.volume = 1;
  bgm.addEventListener('ended', function () {
    if (!playlist || !playlist.length) return;
    playlistIndex = (playlistIndex + 1) % playlist.length;
    currentBgmSrc = playlist[playlistIndex];
    bgm.src = currentBgmSrc;
    bgm.load();
    tryStartBgm();
  });

  var sfxSources = {
    click: 'assets/audio/click.mp3'
  };
  var sfxBuffers = {}; // one <audio> element per sfx, cloned on play for overlap

  Object.keys(sfxSources).forEach(function (key) {
    var el = new window.Audio(sfxSources[key]);
    el.preload = 'auto';
    sfxBuffers[key] = el;
  });

  var unlocked = false;
  function tryStartBgm() {
    if (!state.bgmOn) return;
    var p = bgm.play();
    if (p && p.catch) p.catch(function () { /* still locked, will retry on next gesture */ });
  }

  function unlockAudio() {
    if (unlocked) return;
    unlocked = true;
    tryStartBgm();
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (evt) {
    window.addEventListener(evt, unlockAudio, { once: true, passive: true });
  });

  function applyVolumes() {
    bgm.volume = state.bgmOn ? state.bgmVolume / 100 : 0;
  }

  var SoundManager = {
    init: function (settings) {
      if (settings) Object.assign(state, settings);
      applyVolumes();
      if (state.bgmOn) tryStartBgm();
    },

    getSettings: function () {
      return { bgmOn: state.bgmOn, bgmVolume: state.bgmVolume, sfxOn: state.sfxOn, sfxVolume: state.sfxVolume };
    },

    setBgmOn: function (on) {
      state.bgmOn = !!on;
      if (state.bgmOn) { applyVolumes(); tryStartBgm(); }
      else { bgm.pause(); }
    },
    // Swap which track plays as BGM (e.g. a page-specific theme). No-op if it's
    // already the active track. Only takes effect once audio is unlocked/on.
    setBgmTrack: function (src) {
      if (!src || (src === currentBgmSrc && !playlist)) return;
      playlist = null; playlistIndex = 0;
      bgm.loop = true;
      currentBgmSrc = src;
      bgm.pause();
      bgm.src = src;
      bgm.load();
      applyVolumes();
      if (unlocked && state.bgmOn) tryStartBgm();
    },
    // Play a set of tracks back-to-back (not looping any one of them), looping
    // the whole set once the last one finishes. No-op if it's already this playlist.
    setBgmPlaylist: function (tracks) {
      if (!tracks || !tracks.length) return;
      if (playlist && playlist.length === tracks.length && playlist.every(function (t, i) { return t === tracks[i]; })) return;
      playlist = tracks.slice();
      playlistIndex = 0;
      bgm.loop = false;
      currentBgmSrc = playlist[0];
      bgm.pause();
      bgm.src = currentBgmSrc;
      bgm.load();
      applyVolumes();
      if (unlocked && state.bgmOn) tryStartBgm();
    },
    setBgmVolume: function (v) {
      state.bgmVolume = Math.max(0, Math.min(100, Math.round(v / 10) * 10));
      applyVolumes();
    },
    setSfxOn: function (on) { state.sfxOn = !!on; },
    setSfxVolume: function (v) { state.sfxVolume = Math.max(0, Math.min(100, Math.round(v / 10) * 10)); },

    setMuted: function (muted) {
      bgm.muted = muted;
    },

    playSfx: function (name) {
      if (!state.sfxOn) return;
      var src = sfxBuffers[name];
      if (!src) return;
      var node = src.cloneNode(true);
      node.volume = state.sfxVolume / 100;
      var p = node.play();
      if (p && p.catch) p.catch(function () {});
    }
  };

  window.SoundManager = SoundManager;
})();
