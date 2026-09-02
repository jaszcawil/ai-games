/* ==========================================================================
   The Abandoned Laboratory -- Chapter 1's dungeon. A single hallway built
   from the CC0 "trash-polka" lab-interior kit, ending in a science-question
   gauntlet against Professor Glitch. The Hero explores alone here (the rest
   of the party waits outside); reuses the same joystick/keyboard movement
   scheme and the shared ChallengeUI modal used in the open world.
   ========================================================================== */

(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var slot = params.get('slot') || window.localStorage.getItem('ckqkc.lastSlot');
  var save = slot && window.SaveManager ? window.SaveManager.readSlot(slot) : null;
  if (!save) { window.location.href = 'index.html'; return; }
  if (!save.progress.abilities) save.progress.abilities = {};
  if (!save.progress.dungeonState) save.progress.dungeonState = { position: null, defeated: false, stationsSolved: [] };

  var heroMember = (save.progress.party || [])[0] || { character: 'kid', name: 'Curious Kid' };

  var els = {
    canvas: document.getElementById('world-canvas'),
    progressPill: document.getElementById('world-progress'),
    joyBase: document.getElementById('joy-base'),
    joyKnob: document.getElementById('joy-knob'),
    btnRun: document.getElementById('btn-run'),
    btnInteract: document.getElementById('btn-interact'),
    btnMenu: document.getElementById('btn-menu'),
    btnMute: document.getElementById('btn-mute'),
    zoneLabel: document.getElementById('zone-label'),
    toast: document.getElementById('world-toast'),
    fadeCurtain: document.getElementById('fade-curtain')
  };

  document.addEventListener('DOMContentLoaded', init);

  // ---------------- Lab kit asset table (measured bounding boxes) ----------------
  var LAB_ASSETS = {
    Door: { url: 'assets/world/trash-polka/Door.glb', size: [4.835, 5.891, 1.140], minY: -0.000 },
    ExteriorDoor: { url: 'assets/world/trash-polka/ExteriorDoor.glb', size: [8.231, 7.543, 9.664], minY: -0.001 },
    InfoPanel: { url: 'assets/world/trash-polka/InfoPanel.glb', size: [2.404, 4.209, 0.155], minY: -0.000 },
    InteriorDoor: { url: 'assets/world/trash-polka/InteriorDoor.glb', size: [10.790, 5.954, 0.317], minY: -0.000 },
    InteriorFloor: { url: 'assets/world/trash-polka/InteriorFloor.glb', size: [10.700, 0.200, 10.700], minY: -0.000 },
    InteriorRoof: { url: 'assets/world/trash-polka/InteriorRoof.glb', size: [7.540, 0.100, 6.695], minY: -0.000 },
    InteriorWall: { url: 'assets/world/trash-polka/InteriorWall.glb', size: [10.700, 5.954, 0.150], minY: -0.000 },
    InteriorWall02: { url: 'assets/world/trash-polka/InteriorWall02.glb', size: [10.700, 3.471, 0.150], minY: -0.000 },
    Kiosco: { url: 'assets/world/trash-polka/Kiosco.glb', size: [5.752, 1.763, 1.731], minY: -0.000 },
    Light02: { url: 'assets/world/trash-polka/Light02.glb', size: [0.436, 1.816, 0.282], minY: -0.000 },
    Light03: { url: 'assets/world/trash-polka/Light03.glb', size: [0.639, 1.972, 0.184], minY: 0.000 },
    Light04: { url: 'assets/world/trash-polka/Light04.glb', size: [1.350, 1.672, 0.826], minY: -0.000 },
    Light07: { url: 'assets/world/trash-polka/Light07.glb', size: [2.233, 1.082, 0.615], minY: -0.000 },
    Light08: { url: 'assets/world/trash-polka/Light08.glb', size: [0.671, 0.998, 1.106], minY: -0.000 },
    LowerPipe: { url: 'assets/world/trash-polka/LowerPipe.glb', size: [2.093, 1.232, 1.813], minY: -0.000 },
    PoapMachine: { url: 'assets/world/trash-polka/PoapMachine.glb', size: [1.634, 2.170, 1.951], minY: -0.000 },
    Robot: { url: 'assets/world/trash-polka/Robot.glb', size: [1.465, 2.135, 1.119], minY: -0.003 },
    Rock: { url: 'assets/world/trash-polka/Rock.glb', size: [4.028, 2.593, 3.679], minY: -0.000 },
    Screen: { url: 'assets/world/trash-polka/Screen.glb', size: [5.519, 2.894, 0.147], minY: -0.000 },
    Structure01: { url: 'assets/world/trash-polka/Structure01.glb', size: [11.641, 5.809, 1.260], minY: -0.000 },
    Structure02: { url: 'assets/world/trash-polka/Structure02.glb', size: [0.884, 0.464, 0.083], minY: -0.000 },
    Tank: { url: 'assets/world/trash-polka/Tank.glb', size: [12.102, 6.920, 23.386], minY: -0.005 },
    UpperPipe: { url: 'assets/world/trash-polka/UpperPipe.glb', size: [1.813, 4.297, 2.436], minY: -0.000 }
  };

  // ---------------- Hallway layout (own coordinate system) ----------------
  var TILE = 10.7;
  var HALL_LEN_TILES = 4;
  var HALF_W = TILE / 2;

  var LAB_STATIONS = [
    { id: 'lab-station-1', x: 0, z: 14, radius: 3.4,
      greet: 'A dusty lab-bot whirs to life. "Oh! A visitor. Answer this before the door will let you through:"',
      question: { category: 'science', prompt: 'What do we call a careful test scientists use to check if an idea is true?', choices: ['A guess', 'An experiment', 'A daydream', 'A rhyme'], correctIndex: 1,
        hint: 'It\'s the main tool of science.', fact: 'An experiment is a careful, repeatable test of an idea!' } },
    { id: 'lab-station-2', x: 0, z: 25, radius: 3.4,
      greet: 'Another lab-bot beeps and blocks a shelf of beakers. "One more question, if you please:"',
      question: { category: 'science', prompt: 'Which of these is something you should always do during a science experiment?', choices: ['Guess and never check', 'Write down what you observe', 'Ignore anything surprising', 'Skip safety rules'], correctIndex: 1,
        hint: 'Think about how scientists remember what happened.', fact: 'Careful observation and note-taking are at the heart of every experiment!' } }
  ];

  var BOSS_TRIGGER = { x: 0, z: 38, radius: 5 };
  var EXIT_TRIGGER = { x: 0, z: -2, radius: 1.5 }; // only fires once the player walks BACK toward the entrance
  var SPAWN = { x: 0, z: 3, ry: 0 }; // a few steps in from the exit threshold, so arriving never immediately bounces back out

  // ================= STATE =================

  var scene, camera, renderer, clock;
  var heroRig = null, mixers = [];
  var moveInput = { x: 0, y: 0 };
  var running = false;
  var keys = {};
  var stationInstances = [];
  var bossState = { triggered: false, defeated: save.progress.dungeonState.defeated, questionIndex: 0 };

  function init() {
    if (window.Settings && window.SoundManager) { window.Settings.load(); window.Settings.applyToAudio(); }
    if (window.ChallengeUI) window.ChallengeUI.init();

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d16);
    scene.fog = new THREE.Fog(0x0a0d16, 14, 60);
    camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 200);
    renderer = new THREE.WebGLRenderer({ canvas: els.canvas, antialias: true });
    renderer.setClearColor(0x0a0d16, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    resize();
    window.addEventListener('resize', resize);
    clock = new THREE.Clock();

    buildLighting();
    buildHallway();

    var pos = save.progress.dungeonState.position || SPAWN;
    loadHero(pos.x, pos.z, pos.ry || 0);
    spawnStations();
    spawnBoss();

    bindControls();
    if (els.progressPill) setTimeout(function () { els.progressPill.classList.add('hidden'); }, 1400);
    requestAnimationFrame(tick);
  }

  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function buildLighting() {
    scene.add(new THREE.AmbientLight(0x9fb8ff, 0.55));
    var key = new THREE.DirectionalLight(0x7fd6ff, 0.5);
    key.position.set(6, 14, 4);
    scene.add(key);
    var warm = new THREE.PointLight(0xffcf8a, 0.9, 30);
    warm.position.set(0, 4, 20);
    scene.add(warm);
  }

  var gltfLoader = null, fbxLoader = null;
  function getGltf() { if (!gltfLoader) gltfLoader = new THREE.GLTFLoader(); return gltfLoader; }
  function getFbx() { if (!fbxLoader) fbxLoader = new THREE.FBXLoader(); return fbxLoader; }

  var templateCache = {};
  function loadLabAsset(key, x, y, z, ry, scale) {
    var meta = LAB_ASSETS[key];
    if (!meta) return;
    var use = function (template) {
      var inst = template.clone(true);
      inst.scale.setScalar(scale || 1);
      inst.position.set(x, (y || 0) - meta.minY * (scale || 1), z);
      inst.rotation.y = ry || 0;
      scene.add(inst);
    };
    if (templateCache[key]) { templateCache[key].then(use); return; }
    templateCache[key] = new Promise(function (resolve) {
      getGltf().load(meta.url, function (gltf) { resolve(gltf.scene); }, undefined, function () { resolve(new THREE.Group()); });
    });
    templateCache[key].then(use);
  }

  function buildHallway() {
    for (var i = 0; i < HALL_LEN_TILES; i++) {
      var z = i * TILE + TILE / 2;
      loadLabAsset('InteriorFloor', 0, 0, z, 0, 1);
      // side walls (rotated so their length runs along Z)
      loadLabAsset('InteriorWall', -HALF_W, 0, z, Math.PI / 2, 1);
      loadLabAsset('InteriorWall', HALF_W, 0, z, Math.PI / 2, 1);
    }
    // far wall caps the hallway behind the boss
    loadLabAsset('InteriorWall', 0, 0, HALL_LEN_TILES * TILE, 0, 1);

    // clutter, lights and set-dressing along the way
    loadLabAsset('Kiosco', -3, 0, 3, 0.3, 1);
    loadLabAsset('InfoPanel', HALF_W - 0.3, 0, 4, -Math.PI / 2, 1);
    loadLabAsset('Light02', -HALF_W + 0.3, 0, 6, Math.PI / 2, 1);
    loadLabAsset('Light03', HALF_W - 0.3, 0, 9, -Math.PI / 2, 1);

    loadLabAsset('Tank', HALF_W + 5.5, 0, 17, -Math.PI / 2, 0.8);
    loadLabAsset('LowerPipe', -HALF_W + 0.6, 0, 18, 0, 1);
    loadLabAsset('UpperPipe', -HALF_W + 0.6, 1.2, 20, 0, 1);
    loadLabAsset('Light04', HALF_W - 0.4, 0, 22, -Math.PI / 2, 1);

    loadLabAsset('PoapMachine', -HALF_W + 0.8, 0, 27, 0.2, 1);
    loadLabAsset('Screen', HALF_W - 0.1, 1.4, 29, -Math.PI / 2, 1);
    loadLabAsset('Rock', -3, 0, 32, 0.5, 0.8);
    loadLabAsset('Structure02', 2, 0.5, 31, 0.1, 1.4);
    loadLabAsset('Light07', -HALF_W + 0.4, 0, 33, Math.PI / 2, 1);
    loadLabAsset('Light08', HALF_W - 0.4, 0, 24, -Math.PI / 2, 1);

    // boss arena dressing
    loadLabAsset('Structure01', 0, 3, HALL_LEN_TILES * TILE - 0.6, 0, 0.9);
    loadLabAsset('Rock', -3.5, 0, 39, 1.1, 1);
    loadLabAsset('Rock', 3.4, 0, 40, -0.6, 0.9);
  }

  // ================= HERO =================

  function findRosterEntry(charId) {
    var roster = window.CHARACTER_ROSTER || [];
    for (var i = 0; i < roster.length; i++) if (roster[i].id === charId) return roster[i];
    return roster[0];
  }
  function findClip(clips, keyword) {
    if (!clips || !clips.length) return null;
    var kw = keyword.toLowerCase();
    for (var i = 0; i < clips.length; i++) {
      var parts = clips[i].name.split('|');
      if (parts[parts.length - 1].toLowerCase().indexOf(kw) !== -1) return clips[i];
    }
    return null;
  }
  function normalizeToHeight(root, targetHeight) {
    var box = new THREE.Box3().setFromObject(root);
    var size = new THREE.Vector3(); box.getSize(size);
    var scale = targetHeight / (size.y || 1);
    var wrapper = new THREE.Group();
    var center = new THREE.Vector3(); box.getCenter(center);
    root.position.x -= center.x; root.position.z -= center.z; root.position.y -= box.min.y;
    wrapper.add(root);
    wrapper.scale.setScalar(scale);
    return wrapper;
  }

  function loadHero(x, z, ry) {
    var entry = findRosterEntry(heroMember.character);
    var handleLoaded = function (root, clips) {
      var wrapper = normalizeToHeight(root, 1.6);
      var rig = new THREE.Group();
      rig.add(wrapper);
      var mixer = new THREE.AnimationMixer(wrapper);
      var actions = {
        idle: findClip(clips, 'idle') ? mixer.clipAction(findClip(clips, 'idle')) : null,
        walk: findClip(clips, 'walk') ? mixer.clipAction(findClip(clips, 'walk')) : null,
        run: findClip(clips, 'run') ? mixer.clipAction(findClip(clips, 'run')) : null
      };
      var current = null;
      function play(name) {
        var next = actions[name] || actions.idle || actions.walk;
        if (!next || current === next) return;
        if (current) current.fadeOut(0.25);
        next.reset().fadeIn(0.25).play();
        current = next;
      }
      if (actions.idle) play('idle');
      mixers.push(mixer);
      rig.userData.play = play;
      rig.position.set(x, 0, z);
      rig.rotation.y = ry;
      scene.add(rig);
      heroRig = rig;
    };
    if (entry.fbx) getFbx().load(entry.file, function (obj) { handleLoaded(obj, obj.animations); });
    else getGltf().load(entry.file, function (gltf) { handleLoaded(gltf.scene, gltf.animations); });
  }

  function loadStaticFbx(url, targetHeight, onReady) {
    getFbx().load(url, function (obj) {
      var wrapper = normalizeToHeight(obj, targetHeight);
      var rig = new THREE.Group();
      rig.add(wrapper);
      onReady(rig);
    });
  }

  // ================= STATIONS + BOSS =================

  function spawnStations() {
    LAB_STATIONS.forEach(function (data) {
      var solved = save.progress.dungeonState.stationsSolved.indexOf(data.id) !== -1;
      var inst = { data: data, inside: false, solved: solved };
      stationInstances.push(inst);
      if (solved) return;
      loadLabAsset('Robot', data.x + 1.1, 0, data.z, -Math.PI / 2, 1);
    });
  }

  var bossRig = null, bossMarker = null;
  function spawnBoss() {
    if (bossState.defeated) return;
    loadStaticFbx(window.BOSS_DATA.model, 1.9, function (rig) {
      rig.position.set(0, 0, HALL_LEN_TILES * TILE - 2.2);
      rig.rotation.y = Math.PI;
      var mat = new THREE.MeshStandardMaterial({ color: window.BOSS_DATA.tint || 0x8fd6ff, emissive: 0x123a55, emissiveIntensity: 0.25 });
      rig.traverse(function (o) { if (o.isMesh) { /* keep original texture; just add a faint glow rim via a child sprite instead of overwriting material */ } });
      var glow = new THREE.PointLight(0x8fd6ff, 1.1, 10);
      glow.position.set(0, 2, 0);
      rig.add(glow);
      scene.add(rig);
      bossRig = rig;
    });
  }

  // ================= INPUT (single-character version of the world controller) =================

  function bindControls() {
    window.addEventListener('keydown', function (e) { keys[e.key.toLowerCase()] = true; if (e.key === 'Shift') running = true; });
    window.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; if (e.key === 'Shift') running = false; });

    var dragging = false, baseRect = null, knobMax = 42;
    function setKnob(dx, dy) {
      var len = Math.sqrt(dx * dx + dy * dy);
      if (len > knobMax) { dx = dx / len * knobMax; dy = dy / len * knobMax; }
      els.joyKnob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      moveInput.x = dx / knobMax; moveInput.y = -dy / knobMax;
    }
    function resetKnob() { els.joyKnob.style.transform = 'translate(0px,0px)'; moveInput.x = 0; moveInput.y = 0; }
    function pointerDown(cx, cy) { dragging = true; baseRect = els.joyBase.getBoundingClientRect(); pointerMove(cx, cy); }
    function pointerMove(cx, cy) { if (!dragging || !baseRect) return; setKnob(cx - (baseRect.left + baseRect.width / 2), cy - (baseRect.top + baseRect.height / 2)); }
    function pointerUp() { dragging = false; resetKnob(); }
    els.joyBase.addEventListener('touchstart', function (e) { e.preventDefault(); var t = e.touches[0]; pointerDown(t.clientX, t.clientY); }, { passive: false });
    window.addEventListener('touchmove', function (e) { if (dragging) { e.preventDefault(); var t = e.touches[0]; pointerMove(t.clientX, t.clientY); } }, { passive: false });
    window.addEventListener('touchend', pointerUp);
    els.joyBase.addEventListener('mousedown', function (e) { pointerDown(e.clientX, e.clientY); });
    window.addEventListener('mousemove', function (e) { pointerMove(e.clientX, e.clientY); });
    window.addEventListener('mouseup', pointerUp);

    els.btnRun.addEventListener('touchstart', function (e) { e.preventDefault(); running = true; }, { passive: false });
    els.btnRun.addEventListener('touchend', function (e) { e.preventDefault(); running = false; }, { passive: false });
    els.btnRun.addEventListener('mousedown', function () { running = true; });
    window.addEventListener('mouseup', function () { running = false; });

    els.btnInteract.addEventListener('click', function () {
      if (window.ChallengeUI && window.ChallengeUI.isOpen()) return;
      showToast('Explore the lab -- walk up to anything glowing!');
    });

    els.btnMenu.addEventListener('click', leaveToWorld);

    var muted = false;
    els.btnMute.addEventListener('click', function () {
      muted = !muted;
      if (window.SoundManager) window.SoundManager.setMuted(muted);
      els.btnMute.textContent = muted ? '🔇' : '🔊';
    });

    window.addEventListener('beforeunload', saveDungeonProgress);
  }

  var toastTimer = null;
  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.classList.remove('visible'); }, 2600);
  }

  function getKeyboardVector() {
    var x = 0, y = 0;
    if (keys['arrowup'] || keys['w']) y += 1;
    if (keys['arrowdown'] || keys['s']) y -= 1;
    if (keys['arrowleft'] || keys['a']) x -= 1;
    if (keys['arrowright'] || keys['d']) x += 1;
    return { x: x, y: y };
  }

  // ================= MOVEMENT =================

  var WALK_SPEED = 4.0, RUN_SPEED = 7.2;
  var cameraYaw = 0, cameraDist = 6.6, cameraHeight = 3.4, cameraLookHeight = 1.4;

  function lerpAngle(a, b, t) {
    var diff = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    return a + diff * t;
  }

  function resolveCollisions(pos) {
    if (pos.x < -HALF_W + 0.5) pos.x = -HALF_W + 0.5;
    if (pos.x > HALF_W - 0.5) pos.x = HALF_W - 0.5;
    if (pos.z < -4) pos.z = -4;
    if (pos.z > HALL_LEN_TILES * TILE - 1) pos.z = HALL_LEN_TILES * TILE - 1;
  }

  function updateHero(dt) {
    if (!heroRig) return;
    if (window.ChallengeUI && window.ChallengeUI.isOpen()) {
      if (heroRig.userData.play) heroRig.userData.play('idle');
      return;
    }
    var kb = getKeyboardVector();
    var ix = moveInput.x !== 0 ? moveInput.x : kb.x;
    var iy = moveInput.y !== 0 ? moveInput.y : kb.y;
    var len = Math.sqrt(ix * ix + iy * iy);
    if (len > 0.08) {
      ix /= len; iy /= len;
      var camF = new THREE.Vector3(Math.sin(cameraYaw), 0, Math.cos(cameraYaw));
      var camR = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
      var move = new THREE.Vector3().addScaledVector(camF, iy).addScaledVector(camR, ix);
      if (move.lengthSq() > 0.0001) {
        move.normalize();
        var isRunning = running && Math.min(len, 1) > 0.4;
        var speed = isRunning ? RUN_SPEED : WALK_SPEED;
        var next = heroRig.position.clone().addScaledVector(move, speed * dt);
        resolveCollisions(next);
        heroRig.position.copy(next);
        var targetAngle = Math.atan2(move.x, move.z);
        heroRig.rotation.y = lerpAngle(heroRig.rotation.y, targetAngle, 1 - Math.pow(0.0001, dt));
        var yawDiff = ((targetAngle - cameraYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        if (Math.abs(yawDiff) < 2.2) cameraYaw = lerpAngle(cameraYaw, targetAngle, 1 - Math.pow(0.02, dt));
        if (heroRig.userData.play) heroRig.userData.play(isRunning ? 'run' : 'walk');
      }
    } else if (heroRig.userData.play) {
      heroRig.userData.play('idle');
    }
    checkProximity(heroRig.position);
  }

  function updateCamera(dt) {
    if (!heroRig) return;
    var targetX = heroRig.position.x - Math.sin(cameraYaw) * cameraDist;
    var targetZ = heroRig.position.z - Math.cos(cameraYaw) * cameraDist;
    var damp = 1 - Math.pow(0.0008, dt);
    camera.position.x += (targetX - camera.position.x) * damp;
    camera.position.y += (cameraHeight - camera.position.y) * damp;
    camera.position.z += (targetZ - camera.position.z) * damp;
    var lookAt = heroRig.position.clone(); lookAt.y += cameraLookHeight;
    camera.lookAt(lookAt);
  }

  // ================= TRIGGERS =================

  function dist2D(x1, z1, x2, z2) { var dx = x1 - x2, dz = z1 - z2; return Math.sqrt(dx * dx + dz * dz); }

  function heroAbilityButtons() {
    if (!save.progress.abilities.hero) save.progress.abilities.hero = window.AbilitiesData.newProgress();
    var progress = save.progress.abilities.hero;
    var out = [];
    ['quickThinker', 'goodHeart'].forEach(function (key) {
      var stats = window.AbilitiesData.abilityStats('hero', key, progress);
      if (stats) out.push(stats);
    });
    return out;
  }

  function checkProximity(pos) {
    if (window.ChallengeUI && window.ChallengeUI.isOpen()) return;

    if (pos.z <= EXIT_TRIGGER.z + EXIT_TRIGGER.radius) { leaveToWorld(); return; }

    for (var i = 0; i < stationInstances.length; i++) {
      var s = stationInstances[i];
      if (s.solved) continue;
      var d = dist2D(pos.x, pos.z, s.data.x, s.data.z);
      if (d <= s.data.radius && !s.inside) {
        s.inside = true;
        triggerStation(s);
        return;
      } else if (d > s.data.radius * 1.5) { s.inside = false; }
    }

    if (!bossState.defeated && !bossState.triggered) {
      var bd = dist2D(pos.x, pos.z, BOSS_TRIGGER.x, BOSS_TRIGGER.z);
      if (bd <= BOSS_TRIGGER.radius) { bossState.triggered = true; startBossFight(); }
    }
  }

  function triggerStation(s) {
    window.ChallengeUI.askQuestion({
      name: 'Lab Assistant', thumb: '', greet: s.data.greet, question: s.data.question,
      abilities: heroAbilityButtons(),
      onResult: function (correct) {
        if (!correct) return;
        s.solved = true;
        save.progress.dungeonState.stationsSolved.push(s.data.id);
        var progress = save.progress.abilities.hero || (save.progress.abilities.hero = window.AbilitiesData.newProgress());
        var res = window.AbilitiesData.addXP(progress, 'hero', 20);
        if (res.leveledUp) window.ChallengeUI.showBanner('Your hero reached level ' + res.newLevel + '! ⭐', 3600);
      }
    });
  }

  function startBossFight() {
    window.ChallengeUI.showLine({
      name: window.BOSS_DATA.name, thumb: window.BOSS_DATA.thumb, text: window.BOSS_DATA.intro, buttonLabel: 'Face the challenge!',
      onClose: function () { askNextBossQuestion(); }
    });
  }

  function askNextBossQuestion() {
    var questions = window.BOSS_DATA.questions;
    if (bossState.questionIndex >= questions.length) { finishBossFight(); return; }
    var q = questions[bossState.questionIndex];
    window.ChallengeUI.askQuestion({
      name: window.BOSS_DATA.name, thumb: window.BOSS_DATA.thumb,
      greet: 'Question ' + (bossState.questionIndex + 1) + ' of ' + questions.length + ':', question: q,
      abilities: heroAbilityButtons(),
      onResult: function (correct) {
        if (!correct) return;
        bossState.questionIndex++;
        setTimeout(askNextBossQuestion, 300);
      }
    });
  }

  function finishBossFight() {
    bossState.defeated = true;
    save.progress.dungeonState.defeated = true;
    save.progress.crystals.science = true;
    if (bossRig) { scene.remove(bossRig); bossRig = null; }
    window.ChallengeUI.showLine({
      name: window.BOSS_DATA.name, thumb: window.BOSS_DATA.thumb, text: window.BOSS_DATA.outro, buttonLabel: 'Take the Crystal! 💎',
      onClose: function () {
        window.ChallengeUI.showBanner('💎 The Crystal of Science is yours! Chapter 1 complete!', 5000);
        var progress = save.progress.abilities.hero || (save.progress.abilities.hero = window.AbilitiesData.newProgress());
        window.AbilitiesData.addXP(progress, 'hero', 80);
        saveDungeonProgress();
      }
    });
  }

  function leaveToWorld() {
    saveDungeonProgress();
    save.progress.worldPosition = { x: -14, z: -94, ry: 0 };
    window.SaveManager.writeSlot(slot, save);
    els.fadeCurtain.classList.remove('hidden');
    els.fadeCurtain.classList.add('active');
    setTimeout(function () { window.location.href = 'world.html?slot=' + encodeURIComponent(slot); }, 500);
  }

  function saveDungeonProgress() {
    if (!heroRig) return;
    save.progress.dungeonState.position = { x: heroRig.position.x, z: heroRig.position.z, ry: heroRig.rotation.y };
    save.updatedAt = new Date().toISOString();
    window.SaveManager.writeSlot(slot, save);
  }

  // ================= MAIN LOOP =================

  var lastAutosave = 0;
  function tick() {
    var dt = Math.min(clock.getDelta(), 0.1);
    updateHero(dt);
    updateCamera(dt);
    mixers.forEach(function (m) { m.update(dt); });
    var now = performance.now();
    if (now - lastAutosave > 6000) { lastAutosave = now; saveDungeonProgress(); }
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
})();
