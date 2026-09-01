// ===================================================================
// main.js -- bootstrapping, single persistent adventure world, render loop
// ===================================================================

let renderer, camera, clock;
let currentScene = null;
let player = null;
let world = null;            // { platforms, hubPlat, board, chains, lockGates }
let gameState = 'loading';
let isPaused = false;
let currentUpdateFn = null;

// per-chain runtime UI state (not persisted -- resets each session, see
// buildAdventureWorld's alreadyDone handling for already-badged villages)
let chiefPrompt = new Map();     // chain -> 'entry'|'stage'|'final'|null (last shown toast)

// -------------------- Renderer / camera setup --------------------
function initRenderer() {
  const canvas = document.getElementById('gameCanvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 260);
  clock = new THREE.Clock();
  window.addEventListener('resize', onResize);
  onResize();
}
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  const targetPR = Math.min(window.devicePixelRatio || 1, w > 1600 ? 1.5 : 2);
  renderer.setPixelRatio(targetPR);
}

// -------------------- Loading --------------------
async function boot() {
  initRenderer();
  AssetLibrary.init();
  AudioSystem.init();
  InputSystem.init();
  CameraRig.init();
  populateTitleHeroStrip();

  await AssetLibrary.preloadAll((done, total) => {
    const pct = Math.round((done / total) * 100);
    document.getElementById('loadingBar').style.width = pct + '%';
    document.getElementById('loadingText').textContent = `Packing the wonderblocks… ${pct}%`;
  });

  hide('loadingScreen');
  show('titleScreen');
  gameState = 'title';
  el('btnContinue').disabled = !SaveSystem.hasAnySave();
  requestAnimationFrame(animate);
}

// -------------------- Title screen wiring --------------------
function wireTitleScreen() {
  el('btnNewGame').onclick = () => {
    hide('titleScreen');
    show('heroSelectScreen');
    populateHeroSelect((heroId) => {
      SaveSystem.newGame(heroId);
      hide('heroSelectScreen');
      startAdventure();
    });
  };
  el('btnContinue').onclick = () => {
    if (SaveSystem.loadFromSlot(AUTOSAVE_SLOT)) {
      hide('titleScreen');
      startAdventure();
    } else {
      showToast('No saved game found yet!');
    }
  };
  el('btnLoadFile').onclick = () => el('fileInput').click();
  el('fileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    SaveSystem.importFromFile(file, (ok, err) => {
      if (ok) {
        showToast('Save loaded! 🎉');
        hide('titleScreen'); hide('pauseMenu');
        startAdventure();
      } else {
        showToast(err || 'Could not load that file.');
      }
    });
    e.target.value = '';
  });
}

// -------------------- Pause menu wiring --------------------
function wirePauseMenu() {
  el('btnPause').onclick = () => openPause();
  el('btnResume').onclick = () => closePause();
  el('btnSaveSlot').onclick = () => { SaveSystem.autosave(); showToast('Game saved! 💾'); };
  el('btnSaveFile').onclick = () => { SaveSystem.exportToFile(); showToast('Save file downloaded! 📁'); };
  el('btnLoadFileInGame').onclick = () => el('fileInput').click();
  el('btnHowTo').onclick = () => { show('howToScreen'); };
  el('btnHowToClose').onclick = () => { hide('howToScreen'); };
  el('btnAudioSettings').onclick = () => { show('audioSettingsScreen'); refreshAudioSettingsUI(); };
  el('btnTitle').onclick = () => {
    SaveSystem.autosave();
    closePause();
    hide('hud'); InputSystem.showTouchControls(false);
    show('titleScreen');
    gameState = 'title';
    el('btnContinue').disabled = !SaveSystem.hasAnySave();
  };
}

// -------------------- Audio settings screen wiring --------------------
function refreshAudioSettingsUI() {
  const s = AudioSystem.settings;
  const musicBtn = el('btnToggleMusic');
  musicBtn.textContent = s.musicOn ? 'On' : 'Off';
  musicBtn.className = 'toggle-btn ' + (s.musicOn ? 'on' : 'off');
  const sfxBtn = el('btnToggleSfx');
  sfxBtn.textContent = s.sfxOn ? 'On' : 'Off';
  sfxBtn.className = 'toggle-btn ' + (s.sfxOn ? 'on' : 'off');
  el('volumeValue').textContent = s.volume + '%';
  el('btnVolDown').disabled = s.volume <= 0;
  el('btnVolUp').disabled = s.volume >= 100;
}
function wireAudioSettingsScreen() {
  el('btnToggleMusic').onclick = () => { AudioSystem.setMusicOn(!AudioSystem.settings.musicOn); refreshAudioSettingsUI(); };
  el('btnToggleSfx').onclick = () => { AudioSystem.setSfxOn(!AudioSystem.settings.sfxOn); refreshAudioSettingsUI(); };
  el('btnVolDown').onclick = () => { AudioSystem.volumeDown(); refreshAudioSettingsUI(); };
  el('btnVolUp').onclick = () => { AudioSystem.volumeUp(); refreshAudioSettingsUI(); };
  el('btnAudioSettingsClose').onclick = () => { hide('audioSettingsScreen'); };
}

function openPause() { isPaused = true; show('pauseMenu'); }
function closePause() { isPaused = false; hide('pauseMenu'); }

// -------------------- Scene helpers --------------------
function freshScene() {
  currentScene = new THREE.Scene();
  return currentScene;
}
function spawnPlayerIfNeeded(scene) {
  if (player) scene.add(player.sprite, player.shadow);
  else player = new Player(scene, SaveSystem.current.heroId);
}

// -------------------- THE adventure world (built once per session) --------------------
function startAdventure() {
  gameState = 'adventure';
  hide('quizOverlay'); hide('puzzleOverlay'); hide('dialogueBox');
  show('hud'); InputSystem.showTouchControls(true);
  updateHUDBadges();
  updateHUDHero(SaveSystem.current.heroId);
  CameraRig.recenter();

  const scene = freshScene();
  // one sky for the whole persistent world -- a friendly daytime look;
  // each village's own theme (buildings/floor/props) still carries its
  // visual identity even though the sky no longer changes per-village.
  applyVillageSky(scene, renderer, '#a8e6ff', '#5aa0d8');

  world = buildAdventureWorld(scene);

  spawnPlayerIfNeeded(scene);
  player.setSpawn(new THREE.Vector3(0, 2, 0)); // always resume at the hub
  player.finished = false;
  chiefPrompt = new Map();

  currentUpdateFn = adventureUpdate;
}

// -------------------- Main per-frame update --------------------
function adventureUpdate(dt) {
  if (!world || !player) return;

  // ---- 1. Decide what an action-press would trigger, using state from
  // BEFORE this frame's movement/jump happens. (If we checked proximity+
  // grounded AFTER player.update(), a jump taken the same frame would
  // un-ground the player before the check ran, making it silently fail.)
  const actionWanted = InputSystem.actionPressed && player.grounded;
  let pendingAction = null; // { type, chain, stageIndex }

  if (actionWanted) {
    for (const chain of world.chains) {
      const locked = isChainLocked(chain);
      if (locked) continue;

      if (!chain.introGiven) {
        const d = Math.hypot(player.pos.x - chain.entrySpritePos.x, player.pos.z - chain.entrySpritePos.z);
        if (d < 3.0) { pendingAction = { type: 'intro', chain }; break; }
      }

      const stageIdx = chain.stages.findIndex(s => !s.done);
      if (stageIdx !== -1) {
        const marker = chain.stages[stageIdx].markerPos;
        const d = Math.hypot(player.pos.x - marker.x, player.pos.z - marker.z);
        if (d < 2.6) { pendingAction = { type: 'stage', chain, stageIndex: stageIdx }; break; }
      } else if (!chain.badgeGiven) {
        const d = Math.hypot(player.pos.x - chain.finalSpritePos.x, player.pos.z - chain.finalSpritePos.z);
        if (d < 3.0) { pendingAction = { type: 'final', chain }; break; }
      }
    }
  }

  // ---- 2. Move the player, then update the camera.
  player.update(dt, world.platforms);
  CameraRig.update(camera, player.pos, dt);

  // ---- 3. Physical gates: clamp progress at (a) a locked village's road
  // entrance, (b) the entry chief (until you've talked to them), (c) the
  // first not-yet-cleared stage, and (d) the final chief (until the badge
  // is collected) -- so every chief physically stands in the way instead of
  // being an optional decoration you can just walk past.
  for (const chain of world.chains) {
    const locked = isChainLocked(chain);
    world.lockGates[chain.def.id].visible = locked;

    if (locked) {
      const rel = { x: player.pos.x, z: player.pos.z }; // roads radiate from hub center (0,0,0)
      const advance = rel.x * chain.forward.x + rel.z * chain.forward.z;
      const lateral = rel.x * chain.right.x + rel.z * chain.right.z;
      if (Math.abs(lateral) < 4.5 && advance > SPOKE_GAP - 1) {
        const clampAdv = SPOKE_GAP - 1;
        player.pos.x = chain.forward.x * clampAdv + chain.right.x * lateral;
        player.pos.z = chain.forward.z * clampAdv + chain.right.z * lateral;
      }
      continue;
    }

    let gateAdvance;
    if (!chain.introGiven) {
      gateAdvance = chain.entryAdvance;
    } else {
      const stageIdx = chain.stages.findIndex(s => !s.done);
      if (stageIdx !== -1) {
        gateAdvance = chain.stages[stageIdx].gateAdvance;
      } else if (!chain.badgeGiven) {
        gateAdvance = chain.finalAdvance;
      } else {
        continue; // fully cleared -- no gate left in this chain
      }
    }

    const rel = { x: player.pos.x - chain.origin.x, z: player.pos.z - chain.origin.z };
    const advance = rel.x * chain.forward.x + rel.z * chain.forward.z;
    const lateral = rel.x * chain.right.x + rel.z * chain.right.z;
    if (Math.abs(lateral) < 6 && advance > gateAdvance) {
      player.pos.x = chain.origin.x + chain.forward.x * gateAdvance + chain.right.x * lateral;
      player.pos.z = chain.origin.z + chain.forward.z * gateAdvance + chain.right.z * lateral;
    }
  }

  // ---- 4. Proximity toasts (helpful hints, not gameplay-affecting)
  updateProximityToasts();

  // ---- 5. Fire whatever the action press queued up.
  if (pendingAction) runPendingAction(pendingAction);
}

// moves the player's respawn point (see Player.respawn in player.js) up to
// a just-cleared milestone -- a small upward margin keeps the checkpoint
// comfortably above the platform surface so gravity settles the player onto
// it cleanly on respawn, rather than starting them right at/below the top.
function setCheckpointAt(pos) {
  if (!player) return;
  player.setCheckpoint(new THREE.Vector3(pos.x, pos.y + 0.6, pos.z));
}

function isChainLocked(chain) {
  if (chain.isFinale) return !SaveSystem.allBadgesEarned();
  return SaveSystem.current.unlocked.indexOf(chain.def.id) === -1;
}

function updateProximityToasts() {
  for (const chain of world.chains) {
    if (isChainLocked(chain)) continue;
    const key = chain.def.id;
    const prev = chiefPrompt.get(key) || null;
    let next = null;

    if (!chain.introGiven) {
      const d = Math.hypot(player.pos.x - chain.entrySpritePos.x, player.pos.z - chain.entrySpritePos.z);
      if (d < 3.0) next = 'entry';
    }
    if (!next) {
      const stageIdx = chain.stages.findIndex(s => !s.done);
      if (stageIdx !== -1) {
        const marker = chain.stages[stageIdx].markerPos;
        const d = Math.hypot(player.pos.x - marker.x, player.pos.z - marker.z);
        if (d < 2.6) next = 'stage';
      } else if (!chain.badgeGiven) {
        const d = Math.hypot(player.pos.x - chain.finalSpritePos.x, player.pos.z - chain.finalSpritePos.z);
        if (d < 3.0) next = 'final';
      }
    }

    if (next !== prev) {
      chiefPrompt.set(key, next);
      if (next === 'entry') showToast(`Tap TALK to greet ${CHIEFS[chain.def.chief].name}!`, 2200);
      else if (next === 'stage') {
        const stageIdx = chain.stages.findIndex(s => !s.done);
        const kind = chain.stages[stageIdx].type === 'obby' ? 'the obby marker' : 'the puzzle stand';
        showToast(`Reach ${kind}, then tap TALK! (${stageIdx + 1}/5)`, 2400);
      } else if (next === 'final') showToast(`All 5 done! Tap TALK to see ${CHIEFS[chain.def.chief].name}!`, 2600);
    }
  }
}

function runPendingAction(action) {
  const { chain } = action;
  const def = chain.def;
  const chief = CHIEFS[def.chief];
  const portraitCanvas = getChiefCanvas(def.chief);

  if (action.type === 'intro') {
    chain.introGiven = true;
    setCheckpointAt(chain.entrySpritePos);
    runDialogue(portraitCanvas, chief.name, [def.introText, "Explore and find my 5 challenges scattered ahead!"], () => {});
    return;
  }

  if (action.type === 'stage') {
    const stage = chain.stages[action.stageIndex];
    const topic = def.topic || 'mixed';
    const stageLabel = `${action.stageIndex + 1}/5`;
    const afterQuiz = () => {
      stage.done = true;
      // checkpoint moves up to the stage the player just cleared, so a fall
      // on a LATER obby sends them back here instead of all the way to the
      // village entrance (or the hub)
      setCheckpointAt(stage.markerPos);
      showToast(`✅ Stage ${stageLabel} complete!`, 2200);
    };
    if (stage.type === 'puzzle') {
      runPuzzle(topic, def.chief, () => {
        showToast('🧩 Puzzle solved! One more question...', 1800);
        runQuiz(topic, 1, def.chief, afterQuiz);
      });
    } else {
      runQuiz(topic, 1, def.chief, afterQuiz);
    }
    return;
  }

  if (action.type === 'final') {
    chain.badgeGiven = true;
    // once a badge (or the Crown, for the finale) is earned, the resurrection
    // point moves to the hub rather than staying at the final chief -- the
    // player's "safe" checkpoint after finishing a village is home base, not
    // out in the field
    player.setCheckpoint(new THREE.Vector3(0, 2, 0));
    if (chain.isFinale) {
      SaveSystem.current.completed = true;
      SaveSystem.autosave();
      world.board.refresh();
      runDialogue(portraitCanvas, chief.name, ["You... you actually did it. All five villages, all five badges.", "The Crown of Math is yours. You are true Math Heroes!"], () => {
        showEnding();
      });
      return;
    }
    SaveSystem.earnBadge(def.id);
    const idx = VILLAGES.findIndex(v => v.id === def.id);
    if (idx >= 0 && idx + 1 < VILLAGES.length) SaveSystem.unlockNext(VILLAGES[idx + 1].id);
    SaveSystem.autosave();
    updateHUDBadges();
    world.board.refresh();
    showToast(`🏅 Badge earned: ${def.name}!`);
    setTimeout(() => {
      runDialogue(portraitCanvas, chief.name, [`Wonderful work! You earned the ${def.name} badge!`, 'Head back to the hub whenever you like -- your next path is waiting.'], () => {});
    }, 400);
  }
}

function showEnding() {
  gameState = 'ending';
  hide('hud'); InputSystem.showTouchControls(false);
  const hero = HEROES.find(h => h.id === SaveSystem.current.heroId);
  el('endingText').innerHTML = `
    <p style="font-size:18px;">Again, Stop, Blossom, and Red have passed every challenge from Tiffany, Grey, Nayah, Naomi, and Carmela&nbsp;&mdash; and bested the Math Master Jasz's Final Gauntlet!</p>
    <p style="font-weight:900; font-size:22px; color:#ff6b35;">👑 ${hero ? hero.name : 'Our hero'} is crowned a true Math Hero! 👑</p>
  `;
  show('endingScreen');
  el('btnEndingClose').onclick = () => {
    hide('endingScreen');
    SaveSystem.newGame(SaveSystem.current.heroId);
    startAdventure();
  };
}

// -------------------- Main loop --------------------
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!isPaused && currentUpdateFn && gameState === 'adventure') {
    if (el('quizOverlay').classList.contains('hidden') && el('puzzleOverlay').classList.contains('hidden') && el('dialogueBox').classList.contains('hidden')) {
      InputSystem.update();
      currentUpdateFn(dt);
    } else {
      InputSystem.update();
    }
  }
  if (InputSystem.pausePressed && gameState === 'adventure') {
    isPaused ? closePause() : openPause();
  }
  if (currentScene) renderer.render(currentScene, camera);
}

// -------------------- Kickoff --------------------
window.addEventListener('DOMContentLoaded', () => {
  wireTitleScreen();
  wirePauseMenu();
  wireAudioSettingsScreen();
  boot();
});
