// ===================================================================
// main.js -- bootstrapping, state machine, render loop, hub & village flow
// ===================================================================

let renderer, camera, clock;
let currentScene = null;
let player = null;
let currentWorld = null;   // { platforms, plazaPlat, chiefPos, obbyEntrancePos, obbyPlatforms, ... }
let currentTheme = null;
let quizDone = false;
let puzzleDone = false;
let chiefTriggered = false;
let obbyBonusGiven = false;
let stationTriggered = {};
let gameState = 'loading';
let heroModelId = null;
let freezeIndicatorUntil = 0;
let chiefSprite = null;
let chiefPrompt = null;

// -------------------- Renderer / camera setup --------------------
function initRenderer() {
  const canvas = document.getElementById('gameCanvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 200);
  clock = new THREE.Clock();
  window.addEventListener('resize', onResize);
  onResize();
}
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  // adaptive pixel ratio for low-end / very large screens
  const targetPR = Math.min(window.devicePixelRatio || 1, w > 1600 ? 1.5 : 2);
  renderer.setPixelRatio(targetPR);
}

// -------------------- Loading --------------------
async function boot() {
  initRenderer();
  AssetLibrary.init();
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
      goToHub(true);
    });
  };
  el('btnContinue').onclick = () => {
    if (SaveSystem.loadFromSlot(AUTOSAVE_SLOT)) {
      hide('titleScreen');
      goToHub(false);
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
        goToHub(false);
      } else {
        showToast(err || 'Could not load that file.');
      }
    });
    e.target.value = '';
  });
}

// -------------------- Pause menu wiring --------------------
let isPaused = false;
function wirePauseMenu() {
  el('btnPause').onclick = () => openPause();
  el('btnResume').onclick = () => closePause();
  el('btnSaveSlot').onclick = () => { SaveSystem.autosave(); showToast('Game saved! 💾'); };
  el('btnSaveFile').onclick = () => { SaveSystem.exportToFile(); showToast('Save file downloaded! 📁'); };
  el('btnLoadFileInGame').onclick = () => el('fileInput').click();
  el('btnHowTo').onclick = () => { show('howToScreen'); };
  el('btnHowToClose').onclick = () => { hide('howToScreen'); };
  el('btnTitle').onclick = () => {
    SaveSystem.autosave();
    closePause();
    hide('hud'); InputSystem.showTouchControls(false);
    show('titleScreen');
    gameState = 'title';
    el('btnContinue').disabled = !SaveSystem.hasAnySave();
  };
}
function openPause() {
  isPaused = true;
  show('pauseMenu');
}
function closePause() {
  isPaused = false;
  hide('pauseMenu');
}

// -------------------- Scene helpers --------------------
function freshScene() {
  currentScene = new THREE.Scene();
  return currentScene;
}

function spawnPlayerIfNeeded(scene) {
  if (player) scene.add(player.sprite, player.shadow);
  else player = new Player(scene, SaveSystem.current.heroId);
}

// -------------------- HUB (open radial plaza, free-roam) --------------------
const HUB_THEME = 'hexagon';
function goToHub(firstTime) {
  gameState = 'hub';
  hide('quizOverlay'); hide('puzzleOverlay'); hide('dialogueBox');
  show('hud'); InputSystem.showTouchControls(true);
  updateHUDBadges();
  updateHUDHero(SaveSystem.current.heroId);
  CameraRig.recenter();

  const scene = freshScene();
  applyVillageSky(scene, renderer, '#a8e6ff', '#5aa0d8');

  // one big open circular-ish plaza -- every village portal is reachable by
  // walking/orbiting freely, instead of a single straight corridor
  const hubSize = 40;
  const palette = THEME_ASSETS[HUB_THEME];
  AssetLibrary.tileFloor(scene, palette.floor[0], palette.floor[1], 0, 0, 0, hubSize, hubSize, 0.6);
  const hubPlatform = makePlatform(0, 0, 0, hubSize, 0.6, hubSize);

  // stations arranged in a ring around the plaza center
  const stations = [];
  const n = VILLAGES.length + 1;
  const ringRadius = hubSize * 0.34;
  VILLAGES.forEach((v, i) => {
    const angle = (i / n) * Math.PI * 2;
    stations.push({ id: v.id, name: v.name, x: Math.sin(angle) * ringRadius, z: Math.cos(angle) * ringRadius, chief: v.chief, isFinale: false, icon: v.badgeIcon });
  });
  const finaleAngle = (VILLAGES.length / n) * Math.PI * 2;
  stations.push({ id: 'mathlord', name: MATHLORD.name, x: Math.sin(finaleAngle) * ringRadius, z: Math.cos(finaleAngle) * ringRadius, chief: 'jasz', isFinale: true, icon: '👑' });

  const stationGroup = new THREE.Group();
  stations.forEach(st => {
    const locked = !st.isFinale ? SaveSystem.current.unlocked.indexOf(st.id) === -1 : !SaveSystem.allBadgesEarned();
    const done = !st.isFinale && !!SaveSystem.current.badges[st.id];
    const flagKey = THEME_ASSETS[VILLAGES.find(v=>v.id===st.id)?.theme || 'castle'].accentFlag;
    const flag = AssetLibrary.get(flagKey[0], flagKey[1]);
    AssetLibrary.fitUniform(flag, st.isFinale ? 3.4 : 2.6);
    flag.position.set(st.x, 0, st.z);
    stationGroup.add(flag);

    const faceCanvas = getChiefCanvas(st.chief);
    const tex = new THREE.CanvasTexture(faceCanvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: locked ? 0.45 : 1 });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.7, 1.7, 1);
    const inward = Math.atan2(-st.x, -st.z);
    sprite.position.set(st.x + Math.sin(inward) * 1.6, 1.6, st.z + Math.cos(inward) * 1.6);
    stationGroup.add(sprite);

    if (done) {
      const badgeMat = new THREE.SpriteMaterial({ map: makeEmojiTexture('⭐'), transparent: true });
      const badgeSprite = new THREE.Sprite(badgeMat);
      badgeSprite.scale.set(0.9,0.9,1);
      badgeSprite.position.set(sprite.position.x, 2.7, sprite.position.z);
      stationGroup.add(badgeSprite);
    }
    st.locked = locked;
  });
  scene.add(stationGroup);

  // a few decorative props scattered around the plaza center for atmosphere
  const hubDecor = new THREE.Group();
  const hrng = rngFor('hub-decor');
  const hubProps = palette.props || [];
  if (hubProps.length) {
    for (let i = 0; i < 8; i++) {
      const ang = hrng() * Math.PI * 2;
      const rad = hrng() * ringRadius * 0.45;
      const pk = hubProps[Math.floor(hrng() * hubProps.length)];
      const deco = AssetLibrary.get(pk[0], pk[1]);
      AssetLibrary.fitUniform(deco, 1.0 + hrng() * 0.8);
      deco.position.set(Math.sin(ang) * rad, 0, Math.cos(ang) * rad);
      deco.rotation.y = hrng() * Math.PI * 2;
      hubDecor.add(deco);
    }
  }
  scene.add(hubDecor);

  spawnPlayerIfNeeded(scene);
  // always spawn at the plaza center -- player.pos may be a leftover
  // coordinate from a different scene, so never reuse it here.
  player.setSpawn(new THREE.Vector3(0, 2, 0));
  player.usedDoubleJump = false;

  const hubPlatforms = [hubPlatform];
  let promptedStation = null;

  function hubUpdate(dt) {
    // proximity + trigger check uses the grounded state from BEFORE this
    // frame's player.update() runs -- otherwise the very jump that's meant to
    // enter a portal also un-grounds the player in the same frame, which
    // would make "grounded" read false by the time we checked it.
    let nearest = null, nearestDist = 999;
    stations.forEach(st => {
      const d = Math.hypot(player.pos.x - st.x, player.pos.z - st.z);
      if (d < 3.2 && d < nearestDist) { nearest = st; nearestDist = d; }
    });
    if (nearest !== promptedStation) {
      promptedStation = nearest;
      if (nearest) {
        showToast(nearest.locked ? `🔒 ${nearest.name} (finish earlier villages first)` : `Tap JUMP to enter ${nearest.name}!`, 2600);
      }
    }
    const wantsEnter = nearest && !nearest.locked && InputSystem.jumpPressed && player.grounded;

    player.update(dt, hubPlatforms, false);
    CameraRig.update(camera, player.pos, dt);

    if (wantsEnter) {
      if (nearest.isFinale) enterMathLord(); else enterVillage(nearest.id);
    }
  }
  currentUpdateFn = hubUpdate;
}

function makeEmojiTexture(emoji) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.font = '96px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 64, 72);
  return new THREE.CanvasTexture(c);
}

// -------------------- Village flow (open free-roam plaza + optional obby) --------------------
let currentUpdateFn = null;

function enterVillage(id) {
  const v = VILLAGES.find(x => x.id === id);
  buildEncounter(v, false);
}

function enterMathLord() {
  buildEncounter(MATHLORD, true);
}

function buildEncounter(def, isFinale) {
  gameState = isFinale ? 'mathlord' : 'village';
  quizDone = false; puzzleDone = false; chiefTriggered = false; obbyBonusGiven = false;
  const scene = freshScene();
  applyVillageSky(scene, renderer, def.skyTop, def.skyBottom);

  const obbyLength = isFinale ? 17 : 14;
  currentTheme = def.theme;
  currentWorld = buildVillageWorld(scene, def.theme, def.id, obbyLength);
  CameraRig.recenter();

  // chief stands out in the open plaza -- walk up and press JUMP to talk
  const chief = CHIEFS[def.chief];
  const faceCanvas = getChiefCanvas(def.chief);
  const chiefTex = new THREE.CanvasTexture(faceCanvas);
  chiefSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: chiefTex, transparent: true }));
  chiefSprite.scale.set(2.2, 2.2, 1);
  chiefSprite.position.set(currentWorld.chiefPos.x, 1.5, currentWorld.chiefPos.z);
  scene.add(chiefSprite);

  spawnPlayerIfNeeded(scene);
  player.setSpawn(currentWorld.spawnPos);
  player.usedDoubleJump = false;
  player.finished = false;

  showToast(`Explore ${def.name}! Find ${chief.name} to answer their math questions. ✨`, 3400);

  chiefPrompt = null;
  currentUpdateFn = (dt) => encounterUpdate(dt, def, isFinale);
}

function encounterUpdate(dt, def, isFinale) {
  const world = currentWorld;
  if (!world) return;

  // moving platform update inside the optional obby (paused during Stop's Freeze)
  if (world.movingPlatform) {
    const mp = world.movingPlatform;
    const frozen = performance.now() < (window.__freezeUntil || 0);
    const prevX = mp.plat.x;
    if (!frozen) {
      world._moveT = (world._moveT || 0) + dt;
      const offset = Math.sin(world._moveT * mp.speed) * mp.range;
      mp.plat.x = mp.baseX + offset;
      mp.visual.position.x = mp.plat.x;
    }
    const deltaX = mp.plat.x - prevX;
    if (deltaX !== 0 && player.grounded &&
        Math.abs(player.pos.z - mp.plat.z) < mp.plat.d/2 + 0.1 &&
        Math.abs(player.pos.y - mp.plat.getTop()) < 0.15) {
      player.pos.x += deltaX;
    }
  }

  // proximity to the chief -- free to approach any time, no gate blocking.
  // Checked BEFORE player.update() so this frame's jump press (which is what
  // triggers the chief conversation) isn't invalidated by that same jump
  // un-grounding the player before we get to read player.grounded.
  const dChief = Math.hypot(player.pos.x - world.chiefPos.x, player.pos.z - world.chiefPos.z);
  const nearChief = dChief < 3.0;
  if (nearChief !== chiefPrompt) {
    chiefPrompt = nearChief;
    if (nearChief && !quizDone) showToast(`Tap JUMP to talk to ${CHIEFS[def.chief].name}!`, 2200);
  }
  const wantsTalk = nearChief && !chiefTriggered && !quizDone && InputSystem.jumpPressed && player.grounded;

  let obbyTriggerReady = false;
  if (!obbyBonusGiven) {
    const ep = world.endPodiumPos;
    const d = Math.hypot(player.pos.x - ep.x, player.pos.z - ep.z);
    if (d < 2.2 && player.grounded) obbyTriggerReady = true;
  }

  player.update(dt, world.platforms, false);
  CameraRig.update(camera, player.pos, dt);

  if (wantsTalk) {
    chiefTriggered = true;
    const chief = CHIEFS[def.chief];
    const portraitCanvas = getChiefCanvas(def.chief);
    runDialogue(portraitCanvas, chief.name, [def.introText, "Answer my questions and solve my puzzle to earn your badge!"], () => {
      runQuiz(def.topic || 'mixed', 5, def.chief, () => {
        quizDone = true;
        runPuzzle(def.topic || 'mixed', def.chief, () => {
          puzzleDone = true;
          finishEncounter(def, isFinale);
        });
      });
    });
  }

  // optional obby bonus podium -- not required, just a fun extra
  if (obbyTriggerReady && !obbyBonusGiven) {
    obbyBonusGiven = true;
    showToast('🌟 Bonus obby complete! Great platforming!', 2600);
  }
}

function finishEncounter(def, isFinale) {
  if (isFinale) {
    SaveSystem.current.completed = true;
    SaveSystem.autosave();
    showEnding();
    return;
  }
  SaveSystem.earnBadge(def.id);
  const idx = VILLAGES.findIndex(v => v.id === def.id);
  if (idx >= 0 && idx + 1 < VILLAGES.length) SaveSystem.unlockNext(VILLAGES[idx+1].id);
  SaveSystem.autosave();
  updateHUDBadges();

  const chief = CHIEFS[def.chief];
  const portraitCanvas = getChiefCanvas(def.chief);
  showToast(`🏅 Badge earned: ${def.name}!`);
  setTimeout(() => {
    runDialogue(portraitCanvas, chief.name, [`Wonderful work! You earned the ${def.name} badge!`, 'Feel free to explore, then head back to the village map whenever you like.'], () => {
      goToHub(false);
    });
  }, 400);
}

function showEnding() {
  gameState = 'ending';
  hide('hud'); InputSystem.showTouchControls(false);
  const hero = HEROES.find(h => h.id === SaveSystem.current.heroId);
  el('endingText').innerHTML = `
    <p style="font-size:18px;">Again, Stop, Blossom, and Red have passed every challenge from Tiffany, Grey, Nayah, Naomi, and Carmela&nbsp;&mdash; and bested the Math Lord Jasz's Final Gauntlet!</p>
    <p style="font-weight:900; font-size:22px; color:#ff6b35;">👑 ${hero ? hero.name : 'Our hero'} is crowned a true Math Hero! 👑</p>
  `;
  show('endingScreen');
  el('btnEndingClose').onclick = () => {
    hide('endingScreen');
    SaveSystem.newGame(SaveSystem.current.heroId);
    goToHub(true);
  };
}

// -------------------- Main loop --------------------
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!isPaused && currentUpdateFn && (gameState === 'hub' || gameState === 'village' || gameState === 'mathlord')) {
    if (el('quizOverlay').classList.contains('hidden') && el('puzzleOverlay').classList.contains('hidden') && el('dialogueBox').classList.contains('hidden')) {
      InputSystem.update();
      currentUpdateFn(dt);
    } else {
      InputSystem.update();
    }
  }
  if (InputSystem.pausePressed && (gameState === 'hub' || gameState === 'village' || gameState === 'mathlord')) {
    isPaused ? closePause() : openPause();
  }
  if (currentScene) renderer.render(currentScene, camera);
}

// -------------------- Kickoff --------------------
window.addEventListener('DOMContentLoaded', () => {
  wireTitleScreen();
  wirePauseMenu();
  boot();
});
