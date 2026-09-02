/* ==========================================================================
   The open world of Chokmah -- free-roam exploration.
   Renders the procedural terrain instantly (no loading screen), then streams
   in the real 3D props while the player is already free to walk around.

   Chapter 1 gameplay layered on top of the original free-roam base:
   - A Pokemon-style NPC roster that stops the player on approach to ask a
     grade-school question (or just say hello).
   - Three future party members (Musician/Inventor/Guide) found and
     recruited as the story unfolds, starting with the Hero alone.
   - Interchangeable character control: click a party portrait or press
     1-4 to take direct control of any recruited member; the rest follow.
   - Leveling + the ability system from the story bible (see abilities-data.js).
   - Skill-gated obstacles that only a specific companion can clear.
   ========================================================================== */

(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var slot = params.get('slot') || window.localStorage.getItem('ckqkc.lastSlot');

  var PARTY_ORDER = ['hero', 'musician', 'inventor', 'guide'];
  var PARTY_KEY = { hero: '1', musician: '2', inventor: '3', guide: '4' };
  var RECRUIT_BY_ROLE = {};
  (window.RECRUIT_NPCS || []).forEach(function (r) { RECRUIT_BY_ROLE[r.role] = r; });

  var DEFAULT_HERO = { role: 'hero', name: 'Curious Kid', character: 'kid', characterLabel: 'Kid' };

  var save = slot && window.SaveManager ? window.SaveManager.readSlot(slot) : null;
  if (!save) {
    save = window.SaveManager ? window.SaveManager.newSave('Curious Kid', window.Settings ? window.Settings.get() : null) : null;
  }
  if (!save.progress.party || !save.progress.party.length) save.progress.party = [DEFAULT_HERO];
  if (!save.progress.activeRole) save.progress.activeRole = 'hero';
  if (!save.progress.npcsResolved) save.progress.npcsResolved = [];
  if (!save.progress.obstaclesCleared) save.progress.obstaclesCleared = [];
  if (!save.progress.abilities) save.progress.abilities = {};

  // ---------------- DOM ----------------
  var els = {
    canvas: document.getElementById('world-canvas'),
    vignette: document.getElementById('world-vignette'),
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

  // ================= STATE =================

  var scene, camera, renderer, clock;
  var groups;
  var party = {};           // role -> { role, rig, joined, name, character, characterLabel, progress }
  var activeRole = save.progress.activeRole;
  var mixers = [];
  var trail = [];
  var TRAIL_MAX = 240;
  var cameraYaw = Math.PI;
  var cameraDist = 8.2, cameraHeight = 4.2, cameraLookHeight = 1.5;
  var moveInput = { x: 0, y: 0 };
  var running = false;
  var lastAutosave = 0;
  var colliders = [];
  var obstacleColliders = []; // dynamic, one entry per unresolved obstacle
  var ENTITY_RADIUS = 0.4;
  var playtimeAccum = save.progress.playtimeSeconds || 0;
  var sessionStart = performance.now();

  var worldNpcInstances = [];   // { data, x, z, radius, inside, resolved }
  var recruitInstances = [];    // { data, rig, x, z, radius, inside }
  var obstacleInstances = [];   // { data, x, z, radius, inside, cleared, colliderRef }
  var emojiSpriteCache = {};

  function init() {
    if (window.Settings && window.SoundManager) {
      window.Settings.load();
      window.Settings.applyToAudio();
    }
    if (window.ChallengeUI) window.ChallengeUI.init();

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 400);
    renderer = new THREE.WebGLRenderer({ canvas: els.canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x8fd0f0, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    resize();
    window.addEventListener('resize', resize);
    clock = new THREE.Clock();

    groups = window.WorldTerrain.build(scene);

    var spawn = window.WorldTerrain.SPAWN;
    var startX = spawn.x, startZ = spawn.z, startRy = spawn.ry;
    if (save.progress.worldPosition) {
      startX = save.progress.worldPosition.x;
      startZ = save.progress.worldPosition.z;
      startRy = save.progress.worldPosition.ry;
    }
    cameraYaw = startRy;
    colliders = window.WorldTerrain.getColliders();

    loadParty(startX, startZ, startRy);
    buildPartyBar();
    spawnWorldNpcs();
    spawnRecruits();
    spawnObstacles();
    spawnLabEntrance();

    window.WorldTerrain.streamProps(groups.props, function (done, total) {
      if (els.progressPill) {
        if (done >= total) {
          els.progressPill.classList.add('done');
          setTimeout(function () { els.progressPill.classList.add('hidden'); }, 900);
        } else {
          els.progressPill.textContent = 'Building the world of Chokmah… ' + done + '/' + total;
        }
      }
    });

    bindControls();
    requestAnimationFrame(tick);
  }

  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  // ================= LOADERS =================

  var gltfLoader = null, fbxLoader = null;
  function getGltfLoader() { if (!gltfLoader) gltfLoader = new THREE.GLTFLoader(); return gltfLoader; }
  function getFbxLoader() { if (!fbxLoader) fbxLoader = new THREE.FBXLoader(); return fbxLoader; }

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
      var suffix = parts[parts.length - 1].toLowerCase();
      if (suffix === kw) return clips[i];
    }
    for (var j = 0; j < clips.length; j++) {
      var parts2 = clips[j].name.split('|');
      var suffix2 = parts2[parts2.length - 1].toLowerCase();
      if (suffix2.indexOf(kw) >= 0) return clips[j];
    }
    return null;
  }

  function normalizeToHeight(root, targetHeight) {
    var box = new THREE.Box3().setFromObject(root);
    var size = new THREE.Vector3();
    box.getSize(size);
    var h = size.y || 1;
    var scale = targetHeight / h;
    var wrapper = new THREE.Group();
    var center = new THREE.Vector3();
    box.getCenter(center);
    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= box.min.y;
    wrapper.add(root);
    wrapper.scale.setScalar(scale);
    return wrapper;
  }

  function loadCharacter(charId, targetHeight, onReady) {
    var entry = findRosterEntry(charId);
    var handleLoaded = function (root, clips) {
      var wrapper = normalizeToHeight(root, targetHeight);
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
      if (actions.idle) play('idle'); else if (actions.walk) play('walk');
      mixers.push(mixer);
      rig.userData.mixer = mixer;
      rig.userData.play = play;
      onReady(rig);
    };

    if (entry.fbx) {
      getFbxLoader().load(entry.file, function (obj) { handleLoaded(obj, obj.animations); }, undefined, function () {
        onReady(fallbackBlob(targetHeight));
      });
    } else {
      getGltfLoader().load(entry.file, function (gltf) { handleLoaded(gltf.scene, gltf.animations); }, undefined, function () {
        onReady(fallbackBlob(targetHeight));
      });
    }
  }

  function fallbackBlob(targetHeight) {
    var rig = new THREE.Group();
    var m = new THREE.Mesh(
      new THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(targetHeight * 0.18, targetHeight * 0.6, 4, 8) : new THREE.BoxGeometry(targetHeight * 0.4, targetHeight, targetHeight * 0.4),
      new THREE.MeshStandardMaterial({ color: 0xffcc88 })
    );
    m.position.y = targetHeight * 0.5;
    rig.add(m);
    rig.userData.play = function () {};
    return rig;
  }

  // static (non-animated) FBX loader for the 100Avatars NPC cast
  function loadStaticFbx(url, targetHeight, onReady) {
    getFbxLoader().load(url, function (obj) {
      var wrapper = normalizeToHeight(obj, targetHeight);
      var rig = new THREE.Group();
      rig.add(wrapper);
      onReady(rig);
    }, undefined, function () { onReady(fallbackBlob(targetHeight)); });
  }

  function makeEmojiSprite(emoji, tint) {
    var cacheKey = emoji + '|' + (tint || '');
    if (emojiSpriteCache[cacheKey]) return emojiSpriteCache[cacheKey].clone();
    var size = 96;
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var ctx = c.getContext('2d');
    ctx.font = (size * 0.72) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, size / 2, size / 2 + 4);
    var tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    var mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    var sprite = new THREE.Sprite(mat);
    sprite.scale.setScalar(0.62);
    emojiSpriteCache[cacheKey] = sprite;
    return sprite.clone();
  }

  // ================= PARTY (playable roster) =================

  function ensureAbilityProgress(role) {
    if (!save.progress.abilities[role]) save.progress.abilities[role] = window.AbilitiesData.newProgress();
    return save.progress.abilities[role];
  }

  function loadParty(startX, startZ, startRy) {
    save.progress.party.forEach(function (member, idx) {
      party[member.role] = {
        role: member.role, name: member.name, character: member.character, characterLabel: member.characterLabel,
        rig: null, joined: true, progress: ensureAbilityProgress(member.role)
      };
      var isActive = member.role === activeRole;
      loadCharacter(member.character, isActive ? 1.6 : 1.5, function (rig) {
        var followerIndex = followerSlotIndex(member.role);
        var off = followerIndex >= 0 ? followerOffset(followerIndex) : [0, 0];
        rig.position.set(startX + off[0], 0, startZ + off[1]);
        rig.rotation.y = startRy;
        scene.add(rig);
        party[member.role].rig = rig;
      });
    });
  }

  var FOLLOW_LANES = [-1.6, 1.8, -3.4, 2.6];
  function followerOffset(idx) {
    var d = 24 + idx * 22;
    return [FOLLOW_LANES[idx] || (idx % 2 === 0 ? -1 : 1) * (1.3 + idx * 0.2), d];
  }
  function joinedFollowers() {
    return PARTY_ORDER.filter(function (r) { return party[r] && party[r].joined && r !== activeRole; });
  }
  function followerSlotIndex(role) {
    var list = joinedFollowers();
    return list.indexOf(role);
  }

  function setActiveRole(role) {
    if (!party[role] || !party[role].joined || role === activeRole) return;
    activeRole = role;
    save.progress.activeRole = role;
    var rig = party[role].rig;
    if (rig) cameraYaw = rig.rotation.y;
    refreshPartyBar();
    if (window.SoundManager) window.SoundManager.playSfx('click');
    showToast('Now controlling ' + party[role].name + '!');
  }

  function recruitMember(role) {
    var def = RECRUIT_BY_ROLE[role];
    if (!def || (party[role] && party[role].joined)) return;
    var activeRig = party[activeRole] && party[activeRole].rig;
    var spawnX = activeRig ? activeRig.position.x : def.x;
    var spawnZ = activeRig ? activeRig.position.z : def.z;

    // remove the standing greeter model
    var inst = recruitInstances.filter(function (r) { return r.data.role === role; })[0];
    if (inst && inst.rig) scene.remove(inst.rig);
    recruitInstances = recruitInstances.filter(function (r) { return r.data.role !== role; });

    party[role] = { role: role, name: def.name, character: def.character, characterLabel: def.name, rig: null, joined: true, progress: ensureAbilityProgress(role) };
    save.progress.party.push({ role: role, name: def.name, character: def.character, characterLabel: def.name });

    loadCharacter(def.character, 1.5, function (rig) {
      rig.position.set(spawnX, 0, spawnZ);
      rig.rotation.y = cameraYaw;
      scene.add(rig);
      party[role].rig = rig;
    });

    refreshPartyBar();
    if (window.ChallengeUI) window.ChallengeUI.showBanner(def.joinLine, 4200);
  }

  // ================= PARTY PORTRAIT BAR =================

  var partyBarEls = {};
  function buildPartyBar() {
    var bar = document.createElement('div');
    bar.id = 'party-bar';
    PARTY_ORDER.forEach(function (role) {
      var slotEl = document.createElement('div');
      slotEl.className = 'party-slot';
      slotEl.dataset.role = role;
      slotEl.addEventListener('click', function () { setActiveRole(role); });
      bar.appendChild(slotEl);
      partyBarEls[role] = slotEl;
    });
    document.body.appendChild(bar);
    refreshPartyBar();
  }

  function thumbFor(role) {
    if (role === 'hero') {
      var entry = findRosterEntry(party.hero ? party.hero.character : 'kid');
      return entry ? entry.thumb : '';
    }
    var def = RECRUIT_BY_ROLE[role];
    if (!def) return '';
    var ch = findRosterEntry(def.character);
    return ch ? ch.thumb : '';
  }

  function refreshPartyBar() {
    PARTY_ORDER.forEach(function (role) {
      var el = partyBarEls[role];
      if (!el) return;
      var joined = party[role] && party[role].joined;
      el.innerHTML = '';
      el.classList.toggle('locked', !joined);
      el.classList.toggle('active', role === activeRole);
      if (joined) {
        var img = document.createElement('img');
        img.src = thumbFor(role);
        img.alt = party[role].name;
        el.appendChild(img);
        var lvlBadge = document.createElement('div');
        lvlBadge.className = 'party-slot-lvl';
        lvlBadge.textContent = 'Lv' + ((party[role].progress && party[role].progress.level) || 1);
        el.appendChild(lvlBadge);
        el.title = party[role].name;
      } else {
        var icon = document.createElement('div');
        icon.className = 'party-slot-icon';
        icon.textContent = '🔒';
        el.appendChild(icon);
        el.title = 'Not met yet';
      }
      var keyBadge = document.createElement('div');
      keyBadge.className = 'party-slot-key';
      keyBadge.textContent = PARTY_KEY[role];
      el.appendChild(keyBadge);
    });
  }

  // ================= WORLD NPCs (quiz / flavor) =================

  function spawnWorldNpcs() {
    (window.WORLD_NPCS || []).forEach(function (data) {
      var resolved = save.progress.npcsResolved.indexOf(data.id) !== -1;
      var inst = { data: data, x: data.x, z: data.z, radius: data.radius, inside: false, resolved: resolved };
      worldNpcInstances.push(inst);
      if (resolved && data.type === 'quiz') return; // no need to render a resolved quiz-gate, but keep flavor ones around
      loadStaticFbx(data.model, 1.55, function (rig) {
        rig.position.set(data.x, 0, data.z);
        rig.rotation.y = Math.random() * Math.PI * 2;
        var icon = makeEmojiSprite(data.type === 'quiz' ? '❓' : '💬');
        icon.position.set(0, 2.0, 0);
        rig.add(icon);
        scene.add(rig);
        inst.rig = rig;
      });
    });
  }

  function spawnRecruits() {
    (window.RECRUIT_NPCS || []).forEach(function (data) {
      if (party[data.role] && party[data.role].joined) return; // already recruited from a save
      var inst = { data: data, x: data.x, z: data.z, radius: data.radius, inside: false };
      recruitInstances.push(inst);
      loadCharacter(data.character, 1.55, function (rig) {
        rig.position.set(data.x, 0, data.z);
        var icon = makeEmojiSprite('⭐');
        icon.position.set(0, 2.05, 0);
        rig.add(icon);
        scene.add(rig);
        inst.rig = rig;
      });
    });
  }

  function spawnObstacles() {
    (window.WORLD_OBSTACLES || []).forEach(function (data) {
      var cleared = save.progress.obstaclesCleared.indexOf(data.id) !== -1;
      var inst = { data: data, x: data.x, z: data.z, radius: data.radius, inside: false, cleared: cleared };
      obstacleInstances.push(inst);
      if (!cleared) {
        obstacleColliders.push({ x: data.x, z: data.z, r: data.colliderRadius, __obstacleId: data.id });
        var marker = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.9, 0),
          new THREE.MeshStandardMaterial({ color: 0xff8a5c, emissive: 0xaa4422, emissiveIntensity: 0.6, flatShading: true })
        );
        marker.position.set(data.x, 1.1, data.z);
        var icon = makeEmojiSprite('🔒');
        icon.position.set(0, 1.4, 0);
        marker.add(icon);
        scene.add(marker);
        inst.marker = marker;
      }
    });
  }

  function clearObstacle(inst) {
    inst.cleared = true;
    save.progress.obstaclesCleared.push(inst.data.id);
    obstacleColliders = obstacleColliders.filter(function (c) { return c.__obstacleId !== inst.data.id; });
    if (inst.marker) { scene.remove(inst.marker); inst.marker = null; }
    if (window.ChallengeUI) window.ChallengeUI.showBanner(inst.data.clearMsg, 4200);
  }

  // ================= ABANDONED LABORATORY ENTRANCE =================
  // Sits just beyond the Inventor-gated rubble, deep in the forest. Loads the
  // trash-polka ExteriorDoor as a visual landmark and hands off to
  // dungeon-lab.html when the player walks up to it.

  var LAB_ENTRANCE = { x: -14, z: -108, radius: 4.5 };
  var labEntranceTriggered = false;

  function spawnLabEntrance() {
    var loader = getGltfLoader();
    loader.load('assets/world/trash-polka/ExteriorDoor.glb', function (gltf) {
      var box = new THREE.Box3().setFromObject(gltf.scene);
      gltf.scene.position.y -= box.min.y;
      gltf.scene.position.x -= (box.min.x + box.max.x) / 2;
      gltf.scene.rotation.y = Math.PI;
      var wrapper = new THREE.Group();
      wrapper.add(gltf.scene);
      wrapper.position.set(LAB_ENTRANCE.x, 0, LAB_ENTRANCE.z);
      wrapper.scale.setScalar(0.85);
      scene.add(wrapper);
    });
    var glow = new THREE.PointLight(0x8fd6ff, 1.1, 14);
    glow.position.set(LAB_ENTRANCE.x, 3, LAB_ENTRANCE.z);
    scene.add(glow);
    var icon = makeEmojiSprite('🔬');
    icon.position.set(LAB_ENTRANCE.x, 3.4, LAB_ENTRANCE.z);
    scene.add(icon);
  }

  function enterLab() {
    saveProgress();
    els.fadeCurtain.classList.remove('hidden');
    els.fadeCurtain.classList.add('active');
    setTimeout(function () { window.location.href = 'dungeon-lab.html?slot=' + encodeURIComponent(slot); }, 550);
  }

  // ================= INPUT =================

  var keys = {};
  function bindControls() {
    window.addEventListener('keydown', function (e) {
      keys[e.key.toLowerCase()] = true;
      if (e.key === 'Shift') running = true;
      if (['1', '2', '3', '4'].indexOf(e.key) !== -1) {
        var role = PARTY_ORDER[parseInt(e.key, 10) - 1];
        if (role) setActiveRole(role);
      }
    });
    window.addEventListener('keyup', function (e) {
      keys[e.key.toLowerCase()] = false;
      if (e.key === 'Shift') running = false;
    });

    // ---- virtual joystick ----
    var dragging = false, baseRect = null, knobMax = 42;
    function setKnob(dx, dy) {
      var len = Math.sqrt(dx * dx + dy * dy);
      if (len > knobMax) { dx = dx / len * knobMax; dy = dy / len * knobMax; }
      els.joyKnob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      moveInput.x = dx / knobMax;
      moveInput.y = -dy / knobMax;
    }
    function resetKnob() {
      els.joyKnob.style.transform = 'translate(0px,0px)';
      moveInput.x = 0; moveInput.y = 0;
    }
    function pointerDown(clientX, clientY) {
      dragging = true;
      baseRect = els.joyBase.getBoundingClientRect();
      pointerMove(clientX, clientY);
    }
    function pointerMove(clientX, clientY) {
      if (!dragging || !baseRect) return;
      var cx = baseRect.left + baseRect.width / 2;
      var cy = baseRect.top + baseRect.height / 2;
      setKnob(clientX - cx, clientY - cy);
    }
    function pointerUp() { dragging = false; resetKnob(); }

    els.joyBase.addEventListener('touchstart', function (e) { e.preventDefault(); var t = e.touches[0]; pointerDown(t.clientX, t.clientY); }, { passive: false });
    window.addEventListener('touchmove', function (e) { if (dragging) { e.preventDefault(); var t = e.touches[0]; pointerMove(t.clientX, t.clientY); } }, { passive: false });
    window.addEventListener('touchend', pointerUp);
    els.joyBase.addEventListener('mousedown', function (e) { pointerDown(e.clientX, e.clientY); });
    window.addEventListener('mousemove', function (e) { pointerMove(e.clientX, e.clientY); });
    window.addEventListener('mouseup', pointerUp);

    // ---- buttons ----
    var runHeld = false;
    function setRun(v) { runHeld = v; running = v || keys['shift']; }
    els.btnRun.addEventListener('touchstart', function (e) { e.preventDefault(); setRun(true); }, { passive: false });
    els.btnRun.addEventListener('touchend', function (e) { e.preventDefault(); setRun(false); }, { passive: false });
    els.btnRun.addEventListener('mousedown', function () { setRun(true); });
    window.addEventListener('mouseup', function () { setRun(false); });

    els.btnInteract.addEventListener('click', function () {
      if (window.ChallengeUI && window.ChallengeUI.isOpen()) return;
      showToast('Walk up to someone new to say hello!');
    });

    els.btnMenu.addEventListener('click', function () {
      saveProgress();
      els.fadeCurtain.classList.remove('hidden');
      els.fadeCurtain.classList.add('active');
      setTimeout(function () { window.location.href = 'index.html'; }, 500);
    });

    var muted = false;
    els.btnMute.addEventListener('click', function () {
      muted = !muted;
      if (window.SoundManager) window.SoundManager.setMuted(muted);
      els.btnMute.textContent = muted ? '🔇' : '🔊';
    });

    window.addEventListener('beforeunload', saveProgress);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') saveProgress();
    });
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

  // ================= MOVEMENT / CAMERA =================

  var WALK_SPEED = 4.2, RUN_SPEED = 7.6;
  var GROUND_RADIUS = 0;

  function updatePlayer(dt) {
    var active = party[activeRole];
    var playerRig = active && active.rig;
    if (!playerRig) return;

    if (window.ChallengeUI && window.ChallengeUI.isOpen()) {
      if (playerRig.userData.play) playerRig.userData.play('idle');
      return;
    }

    GROUND_RADIUS = window.WorldTerrain.GROUND_RADIUS - 2;

    var kb = getKeyboardVector();
    var ix = moveInput.x !== 0 ? moveInput.x : kb.x;
    var iy = moveInput.y !== 0 ? moveInput.y : kb.y;
    var len = Math.sqrt(ix * ix + iy * iy);
    var moving = len > 0.08;

    if (moving) {
      ix /= (len || 1); iy /= (len || 1);
      var camF = new THREE.Vector3(Math.sin(cameraYaw), 0, Math.cos(cameraYaw));
      var camR = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
      var move = new THREE.Vector3();
      move.addScaledVector(camF, iy);
      move.addScaledVector(camR, ix);
      if (move.lengthSq() > 0.0001) {
        move.normalize();
        var isRunning = running && (Math.min(len, 1) > 0.4);
        var speed = isRunning ? RUN_SPEED : WALK_SPEED;
        var next = playerRig.position.clone().addScaledVector(move, speed * dt);
        var dist = Math.sqrt(next.x * next.x + next.z * next.z);
        if (dist > GROUND_RADIUS) { next.x *= GROUND_RADIUS / dist; next.z *= GROUND_RADIUS / dist; }
        resolveCollisions(next);
        playerRig.position.copy(next);
        var targetAngle = Math.atan2(move.x, move.z);
        playerRig.rotation.y = lerpAngle(playerRig.rotation.y, targetAngle, 1 - Math.pow(0.0001, dt));
        // The camera only re-centers behind the player while the movement direction is
        // reasonably close to where the camera already faces (roughly forward/diagonal
        // turning). Moving straight backward or strafing sideways defines a movement
        // target that sits at a near-constant angular offset from cameraYaw itself --
        // continuously chasing that would make the camera (and the player, since input
        // is camera-relative) spin in place forever instead of translating. Freezing the
        // camera yaw for those sharp angles keeps backpedal/strafe stable; it resumes
        // following as soon as the player turns back toward roughly the camera's facing.
        var yawDiff = ((targetAngle - cameraYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        if (Math.abs(yawDiff) < 2.2) {
          cameraYaw = lerpAngle(cameraYaw, targetAngle, 1 - Math.pow(0.02, dt));
        }
        if (playerRig.userData.play) playerRig.userData.play(isRunning ? 'run' : 'walk');
      }
    } else {
      if (playerRig.userData.play) playerRig.userData.play('idle');
    }

    resolveCollisions(playerRig.position);

    trail.push({ x: playerRig.position.x, z: playerRig.position.z, ry: playerRig.rotation.y });
    if (trail.length > TRAIL_MAX) trail.shift();

    checkProximity(playerRig.position);
  }

  function resolveCollisions(pos) {
    for (var i = 0; i < colliders.length; i++) {
      var c = colliders[i];
      var dx = pos.x - c.x, dz = pos.z - c.z;
      var minDist = c.r + ENTITY_RADIUS;
      var distSq = dx * dx + dz * dz;
      if (distSq < minDist * minDist && distSq > 0.000001) {
        var dist = Math.sqrt(distSq);
        var push = (minDist - dist);
        pos.x += (dx / dist) * push;
        pos.z += (dz / dist) * push;
      }
    }
    for (var j = 0; j < obstacleColliders.length; j++) {
      var oc = obstacleColliders[j];
      var odx = pos.x - oc.x, odz = pos.z - oc.z;
      var ominDist = oc.r + ENTITY_RADIUS;
      var odistSq = odx * odx + odz * odz;
      if (odistSq < ominDist * ominDist && odistSq > 0.000001) {
        var odist = Math.sqrt(odistSq);
        var opush = (ominDist - odist);
        pos.x += (odx / odist) * opush;
        pos.z += (odz / odist) * opush;
      }
    }
    return pos;
  }

  function lerpAngle(a, b, t) {
    var diff = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    return a + diff * t;
  }

  function updateCompanions(dt) {
    var followers = joinedFollowers();
    followers.forEach(function (role, idx) {
      var m = party[role];
      if (!m || !m.rig || !trail.length) return;
      var off = followerOffset(idx);
      var sampleOffset = off[1], lateral = off[0];
      var sampleIdx = Math.max(0, trail.length - 1 - sampleOffset);
      var sample = trail[sampleIdx];
      var targetX = sample.x + Math.cos(sample.ry) * lateral;
      var targetZ = sample.z - Math.sin(sample.ry) * lateral;
      var dx = targetX - m.rig.position.x, dz = targetZ - m.rig.position.z;
      var d = Math.sqrt(dx * dx + dz * dz);
      var followSpeed = d > 6 ? RUN_SPEED : WALK_SPEED;
      if (d > 0.05) {
        var t = Math.min(1, (followSpeed * dt) / d);
        m.rig.position.x += dx * t;
        m.rig.position.z += dz * t;
        resolveCollisions(m.rig.position);
        var ang = Math.atan2(dx, dz);
        m.rig.rotation.y = lerpAngle(m.rig.rotation.y, ang, 1 - Math.pow(0.0005, dt));
        if (m.rig.userData.play) m.rig.userData.play(d > 6 ? 'run' : 'walk');
      } else if (m.rig.userData.play) {
        m.rig.userData.play('idle');
      }
    });
  }

  function updateCamera(dt) {
    var active = party[activeRole];
    var playerRig = active && active.rig;
    if (!playerRig) return;
    var targetX = playerRig.position.x - Math.sin(cameraYaw) * cameraDist;
    var targetZ = playerRig.position.z - Math.cos(cameraYaw) * cameraDist;
    var targetY = cameraHeight;
    var damp = 1 - Math.pow(0.0008, dt);
    camera.position.x += (targetX - camera.position.x) * damp;
    camera.position.y += (targetY - camera.position.y) * damp;
    camera.position.z += (targetZ - camera.position.z) * damp;
    var lookAt = playerRig.position.clone();
    lookAt.y += cameraLookHeight;
    camera.lookAt(lookAt);
  }

  function updateZoneLabel() {
    var active = party[activeRole];
    var playerRig = active && active.rig;
    if (!playerRig || !els.zoneLabel) return;
    var p = playerRig.position;
    var zones = window.WorldTerrain.ZONES;
    var closest = 'The Great Library', bestD = Math.sqrt(p.x * p.x + p.z * p.z) - 14;
    Object.keys(zones).forEach(function (k) {
      var z = zones[k];
      var dx = p.x - z.cx, dz = p.z - z.cz;
      var d = Math.sqrt(dx * dx + dz * dz) - z.radius;
      if (d < bestD) {
        bestD = d;
        closest = k === 'fair' ? 'The Fairgrounds' : k === 'ruins' ? 'The Ancient Ruins' : k === 'forest' ? 'The Whispering Forest' : 'The Traveler\'s Garden';
      }
    });
    if (els.zoneLabel.textContent !== closest) els.zoneLabel.textContent = closest;
  }

  // ================= PROXIMITY TRIGGERS =================

  function dist2D(x1, z1, x2, z2) {
    var dx = x1 - x2, dz = z1 - z2;
    return Math.sqrt(dx * dx + dz * dz);
  }

  function checkProximity(playerPos) {
    if (window.ChallengeUI && window.ChallengeUI.isOpen()) return;

    // ---- lab entrance ----
    if (!labEntranceTriggered && dist2D(playerPos.x, playerPos.z, LAB_ENTRANCE.x, LAB_ENTRANCE.z) <= LAB_ENTRANCE.radius) {
      labEntranceTriggered = true;
      enterLab();
      return;
    }

    // ---- recruits ----
    for (var r = 0; r < recruitInstances.length; r++) {
      var ri = recruitInstances[r];
      var rd = dist2D(playerPos.x, playerPos.z, ri.x, ri.z);
      if (rd <= ri.radius && !ri.inside) {
        ri.inside = true;
        triggerRecruit(ri);
        return;
      } else if (rd > ri.radius * 1.4) {
        ri.inside = false;
      }
    }

    // ---- obstacles ----
    for (var o = 0; o < obstacleInstances.length; o++) {
      var oi = obstacleInstances[o];
      if (oi.cleared) continue;
      var od = dist2D(playerPos.x, playerPos.z, oi.x, oi.z);
      if (od <= oi.radius && !oi.inside) {
        oi.inside = true;
        triggerObstacle(oi);
        return;
      } else if (od > oi.radius * 1.4) {
        oi.inside = false;
      }
    }

    // ---- world NPCs ----
    for (var n = 0; n < worldNpcInstances.length; n++) {
      var ni = worldNpcInstances[n];
      var nd = dist2D(playerPos.x, playerPos.z, ni.x, ni.z);
      if (nd <= ni.radius && !ni.inside) {
        ni.inside = true;
        if (!ni.resolved) { triggerNpc(ni); return; }
      } else if (nd > ni.radius * 1.4) {
        ni.inside = false;
      }
    }
  }

  function triggerRecruit(ri) {
    var def = ri.data;
    if (window.ChallengeUI) {
      window.ChallengeUI.showRecruit({
        name: def.name, thumb: thumbFor(def.role), greet: def.greet,
        onJoin: function () { recruitMember(def.role); }
      });
    } else {
      recruitMember(def.role);
    }
  }

  function triggerObstacle(oi) {
    var def = oi.data;
    var have = party[def.requiredRole] && party[def.requiredRole].joined;
    if (window.ChallengeUI) {
      window.ChallengeUI.showLine({
        name: 'Blocked Path', thumb: '', text: have ? def.lockedMsg : (def.lockedMsg + ' ' + def.needMsg),
        buttonLabel: have ? 'Try!' : 'Okay',
        onClose: function () { if (have) clearObstacle(oi); }
      });
    } else if (have) {
      clearObstacle(oi);
    }
  }

  function heroAbilityButtons() {
    var heroProgress = ensureAbilityProgress('hero');
    var out = [];
    ['quickThinker', 'goodHeart'].forEach(function (key) {
      var stats = window.AbilitiesData.abilityStats('hero', key, heroProgress);
      if (stats) out.push(stats);
    });
    return out;
  }

  function triggerNpc(ni) {
    var data = ni.data;
    if (data.type === 'flavor') {
      if (window.ChallengeUI) window.ChallengeUI.showLine({ name: data.name, thumb: data.thumb, text: data.greet, buttonLabel: 'Bye!' });
      return;
    }
    if (window.ChallengeUI) {
      window.ChallengeUI.askQuestion({
        name: data.name, thumb: data.thumb, greet: data.greet, question: data.question,
        abilities: heroAbilityButtons(),
        onResult: function (correct) {
          if (!correct) return;
          ni.resolved = true;
          save.progress.npcsResolved.push(data.id);
          var progress = ensureAbilityProgress(activeRole);
          var res = window.AbilitiesData.addXP(progress, activeRole, 20);
          refreshPartyBar();
          if (res.leveledUp) {
            window.ChallengeUI.showBanner((party[activeRole] ? party[activeRole].name : 'Your hero') + ' reached level ' + res.newLevel + '! ⭐', 3600);
          }
          if (ni.rig) { scene.remove(ni.rig); ni.rig = null; }
        }
      });
    }
  }

  // ================= SAVE =================

  function saveProgress() {
    if (!slot || !window.SaveManager) return;
    var active = party[activeRole];
    if (active && active.rig) {
      save.progress.worldPosition = { x: active.rig.position.x, z: active.rig.position.z, ry: active.rig.rotation.y };
    }
    save.progress.activeRole = activeRole;
    save.progress.playtimeSeconds = playtimeAccum + (performance.now() - sessionStart) / 1000;
    save.updatedAt = new Date().toISOString();
    window.SaveManager.writeSlot(slot, save);
  }

  // ================= MAIN LOOP =================

  function tick() {
    var dt = Math.min(clock.getDelta(), 0.1);
    updatePlayer(dt);
    updateCompanions(dt);
    updateCamera(dt);
    updateZoneLabel();
    mixers.forEach(function (m) { m.update(dt); });
    if (groups && groups.library.userData.crystalRing) {
      groups.library.userData.crystalRing.rotation.y += dt * 0.3;
    }
    var now = performance.now();
    if (now - lastAutosave > 6000) { lastAutosave = now; saveProgress(); }
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
})();
