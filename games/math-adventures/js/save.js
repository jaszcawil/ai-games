// ===================================================================
// save.js -- localStorage saves + save/load to a file on the device
// ===================================================================

const SAVE_KEY_PREFIX = 'mawnp_save_'; // Math Adventures Wonderblocks Noodle Pals
const AUTOSAVE_SLOT = 'auto';

function defaultSaveData() {
  return {
    version: SAVE_VERSION,
    heroId: null,
    badges: {},          // villageId -> true
    unlocked: ['village1'],
    mathLordUnlocked: false,
    completed: false,
    playtimeSec: 0,
    savedAt: Date.now()
  };
}

const SaveSystem = {
  current: defaultSaveData(),

  slotKey(slot) { return SAVE_KEY_PREFIX + slot; },

  saveToSlot(slot) {
    this.current.savedAt = Date.now();
    try {
      localStorage.setItem(this.slotKey(slot), JSON.stringify(this.current));
      return true;
    } catch (e) { console.warn('Save failed', e); return false; }
  },

  loadFromSlot(slot) {
    try {
      const raw = localStorage.getItem(this.slotKey(slot));
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || data.version !== SAVE_VERSION) return false;
      this.current = data;
      return true;
    } catch (e) { console.warn('Load failed', e); return false; }
  },

  hasAnySave() {
    for (const slot of ['1','2','3',AUTOSAVE_SLOT]) {
      if (localStorage.getItem(this.slotKey(slot))) return true;
    }
    return false;
  },

  listSaves() {
    const slots = ['1','2','3',AUTOSAVE_SLOT];
    return slots.map(slot => {
      const raw = localStorage.getItem(this.slotKey(slot));
      if (!raw) return { slot, empty: true };
      try {
        const d = JSON.parse(raw);
        return { slot, empty: false, heroId: d.heroId, badges: Object.keys(d.badges||{}).length, savedAt: d.savedAt };
      } catch (e) { return { slot, empty: true }; }
    });
  },

  autosave() { this.saveToSlot(AUTOSAVE_SLOT); },

  newGame(heroId) {
    this.current = defaultSaveData();
    this.current.heroId = heroId;
    this.autosave();
  },

  earnBadge(villageId) {
    this.current.badges[villageId] = true;
  },

  unlockNext(villageId) {
    if (this.current.unlocked.indexOf(villageId) === -1) this.current.unlocked.push(villageId);
  },

  allBadgesEarned() {
    return VILLAGES.every(v => this.current.badges[v.id]);
  },

  // -------- File export / import (works offline + online, no server needed) --------
  exportToFile() {
    const data = JSON.stringify(this.current, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const heroName = this.current.heroId || 'save';
    a.download = `math-adventures-${heroName}-save.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  importFromFile(file, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data || typeof data !== 'object' || !('unlocked' in data)) {
          callback(false, 'That does not look like a Math Adventures save file.');
          return;
        }
        data.version = SAVE_VERSION;
        this.current = data;
        this.autosave();
        callback(true);
      } catch (err) {
        callback(false, 'Could not read that file.');
      }
    };
    reader.onerror = () => callback(false, 'Could not read that file.');
    reader.readAsText(file);
  }
};
