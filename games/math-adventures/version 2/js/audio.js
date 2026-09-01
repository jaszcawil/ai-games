// ===================================================================
// audio.js -- background music, answer sound effects, and the audio
// settings (music on/off, sfx on/off, volume) persisted in localStorage
// separately from the game's save slots, so they stick across every
// save file / new game the same way a device setting would.
// ===================================================================

const AUDIO_SETTINGS_KEY = 'mawnp_audio_settings';

function defaultAudioSettings() {
  return { musicOn: true, sfxOn: true, volume: 50 }; // volume: 0-100, in steps of 10
}

const AudioSystem = {
  settings: defaultAudioSettings(),
  music: null,
  sfxCorrect: null,
  sfxWrong: null,
  _unlocked: false, // becomes true after the page's first user gesture -- see init()

  init() {
    this.loadSettings();

    this.music = new Audio('assets/audio/On the Island.mp3');
    this.music.loop = true;
    this.sfxCorrect = new Audio('assets/audio/correct.mp3');
    this.sfxWrong = new Audio('assets/audio/wrong.mp3');
    this._applyVolume();

    // Browsers refuse to autoplay audio before the page has seen a user
    // gesture. The title/hero-select screens always require at least one
    // tap/click before gameplay starts, so listening for the very first
    // pointerdown/keydown anywhere is enough to start music right away
    // without the player ever noticing a delay.
    const unlock = () => {
      if (this._unlocked) return;
      this._unlocked = true;
      if (this.settings.musicOn) this._playMusic();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  },

  loadSettings() {
    try {
      const raw = localStorage.getItem(AUDIO_SETTINGS_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        this.settings = {
          musicOn: typeof d.musicOn === 'boolean' ? d.musicOn : true,
          sfxOn: typeof d.sfxOn === 'boolean' ? d.sfxOn : true,
          volume: Number.isFinite(d.volume) ? Math.max(0, Math.min(100, d.volume)) : 50
        };
      }
    } catch (e) { /* keep defaults */ }
  },

  saveSettings() {
    try { localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(this.settings)); } catch (e) { /* best effort */ }
  },

  _applyVolume() {
    const v = this.settings.volume / 100;
    if (this.music) this.music.volume = v;
    if (this.sfxCorrect) this.sfxCorrect.volume = v;
    if (this.sfxWrong) this.sfxWrong.volume = v;
  },

  _playMusic() {
    if (!this.music) return;
    this.music.play().catch(() => { /* ignore a blocked/aborted autoplay attempt */ });
  },

  setMusicOn(on) {
    this.settings.musicOn = on;
    this.saveSettings();
    if (on) { if (this._unlocked) this._playMusic(); }
    else if (this.music) this.music.pause();
  },

  setSfxOn(on) {
    this.settings.sfxOn = on;
    this.saveSettings();
  },

  setVolume(v) {
    this.settings.volume = Math.max(0, Math.min(100, v));
    this.saveSettings();
    this._applyVolume();
  },

  volumeUp() { this.setVolume(this.settings.volume + 10); },
  volumeDown() { this.setVolume(this.settings.volume - 10); },

  playCorrect() {
    if (!this.settings.sfxOn || !this.sfxCorrect) return;
    this.sfxCorrect.currentTime = 0;
    this.sfxCorrect.play().catch(() => {});
  },

  playWrong() {
    if (!this.settings.sfxOn || !this.sfxWrong) return;
    this.sfxWrong.currentTime = 0;
    this.sfxWrong.play().catch(() => {});
  }
};
