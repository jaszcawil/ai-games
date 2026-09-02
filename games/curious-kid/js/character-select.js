/* ==========================================================================
   Party / Character Selection -- 4-step flow (Hero, Musician, Inventor,
   Guide). Each step: pick a character from the full roster (slider strip +
   big animated 3D stage) and type a name. No character can be used twice.
   ========================================================================== */

(function () {
  'use strict';

  var ROLE_COLORS = { hero: '#ffcf5c', musician: '#ffd34f', inventor: '#4fc3ff', guide: '#ff6f9c' };
  var ROSTER = window.HERO_ROSTER || window.CHARACTER_ROSTER;
  var ROLES = window.PARTY_ROLES;

  var params = new URLSearchParams(window.location.search);
  var slot = params.get('slot') || window.localStorage.getItem('ckqkc.pendingSlot');
  if (!slot) { window.location.href = 'index.html'; return; }

  var state = {
    roleIndex: 0,
    charIndex: 0,
    used: {},          // characterId -> roleKey
    party: {},          // roleKey -> { character, name }
    loadToken: 0
  };

  var modelCache = {}; // characterId -> { root, animations }

  // ---------------- DOM refs ----------------
  var els = {};
  document.addEventListener('DOMContentLoaded', init);

  function q(id) { return document.getElementById(id); }

  function init() {
    els.progress = q('cs-progress');
    els.roleTitle = q('cs-role-title');
    els.roleSubtitle = q('cs-role-subtitle');
    els.stage = document.querySelector('.cs-stage');
    els.canvas = q('cs-canvas');
    els.thumbImg = q('cs-stage-thumb');
    els.charLabel = q('cs-char-label');
    els.strip = q('cs-strip');
    els.prevBtn = q('cs-prev');
    els.nextBtn = q('cs-next');
    els.nameLabel = q('cs-name-label');
    els.nameInput = q('cs-name-input');
    els.backBtn = q('cs-back');
    els.confirmBtn = q('cs-confirm');
    els.fadeCurtain = q('fade-curtain');

    window.Settings.load();
    window.Settings.applyToAudio();

    buildProgress();
    buildStrip();
    initStage3D();
    bindControls();
    goToRole(0, true);
  }

  function click() { window.SoundManager.playSfx('click'); }

  // ---------------- Progress row ----------------

  function buildProgress() {
    els.progress.innerHTML = '';
    ROLES.forEach(function (role, i) {
      if (i > 0) {
        var connector = document.createElement('div');
        connector.className = 'cs-progress-connector';
        els.progress.appendChild(connector);
      }
      var step = document.createElement('div');
      step.className = 'cs-progress-step';
      step.dataset.role = role.key;
      var dot = document.createElement('div');
      dot.className = 'cs-progress-dot';
      dot.textContent = role.icon;
      step.appendChild(dot);
      els.progress.appendChild(step);
    });
  }

  function refreshProgress() {
    var steps = els.progress.querySelectorAll('.cs-progress-step');
    steps.forEach(function (step, i) {
      var role = ROLES[i];
      var dot = step.querySelector('.cs-progress-dot');
      step.classList.toggle('current', i === state.roleIndex);
      var entry = state.party[role.key];
      if (entry) {
        step.classList.add('done');
        var ch = ROSTER.filter(function (c) { return c.id === entry.character; })[0];
        dot.innerHTML = ch ? '<img src="' + ch.thumb + '" alt="">' : role.icon;
      } else {
        step.classList.remove('done');
        dot.textContent = role.icon;
      }
    });
  }

  // ---------------- Thumbnail strip ----------------

  function buildStrip() {
    els.strip.innerHTML = '';
    ROSTER.forEach(function (char, i) {
      var btn = document.createElement('button');
      btn.className = 'cs-thumb-btn';
      btn.type = 'button';
      btn.title = char.label;
      btn.dataset.index = String(i);
      var img = document.createElement('img');
      img.src = char.thumb;
      img.alt = char.label;
      btn.appendChild(img);
      btn.addEventListener('click', function () { onThumbClick(i); });
      els.strip.appendChild(btn);
    });
  }

  function refreshStrip() {
    var buttons = els.strip.querySelectorAll('.cs-thumb-btn');
    buttons.forEach(function (btn, i) {
      var char = ROSTER[i];
      var usedBy = state.used[char.id];
      var isCurrentRoleOwner = usedBy === ROLES[state.roleIndex].key;
      btn.classList.toggle('used', !!usedBy && !isCurrentRoleOwner);
      btn.classList.toggle('active', i === state.charIndex);
    });
    var active = els.strip.querySelector('.cs-thumb-btn.active');
    if (active) active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  function onThumbClick(i) {
    var char = ROSTER[i];
    var usedBy = state.used[char.id];
    if (usedBy && usedBy !== ROLES[state.roleIndex].key) {
      showBumpDenied(i);
      return;
    }
    click();
    setCharacter(i);
  }

  function showBumpDenied(i) {
    var buttons = els.strip.querySelectorAll('.cs-thumb-btn');
    var btn = buttons[i];
    if (!btn) return;
    btn.style.animation = 'none';
    void btn.offsetWidth;
    btn.style.animation = 'cs-shake 0.35s ease';
  }

  // ---------------- Role flow ----------------

  function goToRole(index, isInitial) {
    state.roleIndex = index;
    var role = ROLES[index];
    document.documentElement.style.setProperty('--role-color', ROLE_COLORS[role.key]);
    els.roleTitle.textContent = role.title;
    els.roleSubtitle.textContent = role.subtitle;
    els.nameLabel.textContent = 'Name ' + role.promptLabel + ' character';
    els.nameInput.placeholder = 'Type a name...';
    els.backBtn.textContent = index === 0 ? '◀ Start Screen' : '◀ Back';
    els.confirmBtn.textContent = index === ROLES.length - 1 ? 'Begin Adventure ▶' : 'Confirm ▶';

    var existing = state.party[role.key];
    var startIndex = 0;
    if (existing) {
      els.nameInput.value = existing.name;
      var idx = indexOfCharacter(existing.character);
      if (idx !== -1) startIndex = idx;
    } else {
      els.nameInput.value = '';
      startIndex = firstAvailableIndex();
    }

    refreshProgress();
    setCharacter(startIndex, isInitial);
  }

  function indexOfCharacter(id) {
    for (var i = 0; i < ROSTER.length; i++) if (ROSTER[i].id === id) return i;
    return -1;
  }

  function firstAvailableIndex() {
    for (var i = 0; i < ROSTER.length; i++) {
      var owner = state.used[ROSTER[i].id];
      if (!owner) return i;
    }
    return 0;
  }

  function isAvailable(i) {
    var owner = state.used[ROSTER[i].id];
    return !owner || owner === ROLES[state.roleIndex].key;
  }

  function stepCharacter(dir) {
    var n = ROSTER.length;
    var i = state.charIndex;
    for (var tries = 0; tries < n; tries++) {
      i = (i + dir + n) % n;
      if (isAvailable(i)) { setCharacter(i); return; }
    }
  }

  // ---------------- Footer controls ----------------

  function bindControls() {
    els.prevBtn.addEventListener('click', function () { click(); stepCharacter(-1); });
    els.nextBtn.addEventListener('click', function () { click(); stepCharacter(1); });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') stepCharacter(-1);
      else if (e.key === 'ArrowRight') stepCharacter(1);
    });

    // basic swipe support on the stage
    var startX = null;
    els.stage.addEventListener('pointerdown', function (e) { startX = e.clientX; });
    els.stage.addEventListener('pointerup', function (e) {
      if (startX === null) return;
      var dx = e.clientX - startX;
      startX = null;
      if (Math.abs(dx) > 40) stepCharacter(dx < 0 ? 1 : -1);
    });

    els.backBtn.addEventListener('click', function () {
      click();
      if (state.roleIndex === 0) {
        fadeTo('index.html');
        return;
      }
      var role = ROLES[state.roleIndex];
      delete state.party[role.key];
      var usedKeys = Object.keys(state.used);
      for (var k = 0; k < usedKeys.length; k++) {
        if (state.used[usedKeys[k]] === role.key) delete state.used[usedKeys[k]];
      }
      goToRole(state.roleIndex - 1);
    });

    els.confirmBtn.addEventListener('click', onConfirm);
  }

  function onConfirm() {
    var role = ROLES[state.roleIndex];
    var char = ROSTER[state.charIndex];
    var name = (els.nameInput.value || '').trim().slice(0, 16) || char.label;

    state.party[role.key] = { character: char.id, name: name };
    state.used[char.id] = role.key;
    click();

    if (state.roleIndex < ROLES.length - 1) {
      goToRole(state.roleIndex + 1);
    } else {
      finalizeParty();
    }
  }

  function finalizeParty() {
    var heroName = state.party.hero.name;
    var save = window.SaveManager.newSave(heroName, window.Settings.get());
    save.progress.party = ROLES.map(function (role) {
      var entry = state.party[role.key];
      var char = ROSTER.filter(function (c) { return c.id === entry.character; })[0];
      return { role: role.key, name: entry.name, character: entry.character, characterLabel: char ? char.label : entry.character };
    });
    window.SaveManager.writeSlot(slot, save);
    window.localStorage.setItem('ckqkc.lastSlot', slot);
    window.localStorage.removeItem('ckqkc.pendingSlot');
    fadeTo('cutscene-intro.html?slot=' + encodeURIComponent(slot));
  }

  function fadeTo(url) {
    els.fadeCurtain.classList.remove('hidden');
    els.fadeCurtain.classList.add('active');
    setTimeout(function () { window.location.href = url; }, 550);
  }

  // ---------------- 3D stage ----------------

  var stageScene, stageCamera, stageRenderer, stageGroup, mixer, clock;
  var entranceTween = null;

  function initStage3D() {
    stageScene = new THREE.Scene();
    stageCamera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    stageCamera.position.set(0, 1.1, 4.6);
    stageCamera.lookAt(0, 0.95, 0);

    stageRenderer = new THREE.WebGLRenderer({ canvas: els.canvas, alpha: true, antialias: true });
    stageRenderer.setClearColor(0x000000, 0);
    stageRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    stageScene.add(new THREE.AmbientLight(0xffffff, 0.65));
    var key = new THREE.DirectionalLight(0xfff3da, 1.15);
    key.position.set(2.2, 3.5, 3.2);
    stageScene.add(key);
    var rim = new THREE.DirectionalLight(0xb5d6ff, 0.55);
    rim.position.set(-2.5, 2, -2.5);
    stageScene.add(rim);
    var fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-1.5, 1, 2.5);
    stageScene.add(fill);

    stageGroup = new THREE.Group();
    stageScene.add(stageGroup);

    clock = new THREE.Clock();

    resizeStage();
    window.addEventListener('resize', resizeStage);

    requestAnimationFrame(animateStage);
  }

  function resizeStage() {
    var w = els.stage.clientWidth, h = els.stage.clientHeight;
    if (!w || !h) return;
    stageRenderer.setSize(w, h, false);
    stageCamera.aspect = w / h;
    stageCamera.updateProjectionMatrix();
  }

  function findClip(animations, preferred) {
    if (!animations || !animations.length) return null;
    for (var p = 0; p < preferred.length; p++) {
      for (var i = 0; i < animations.length; i++) {
        if (animations[i].name.toLowerCase().indexOf(preferred[p]) !== -1) return animations[i];
      }
    }
    return animations[0];
  }

  function normalize(root) {
    var box = new THREE.Box3().setFromObject(root);
    var size = new THREE.Vector3(); box.getSize(size);
    var center = new THREE.Vector3(); box.getCenter(center);
    var targetHeight = 1.7;
    var scale = targetHeight / (size.y || 1);
    root.scale.setScalar(scale);
    root.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
  }

  function setCharacter(index, skipEntranceDelay) {
    state.charIndex = index;
    var char = ROSTER[index];

    els.charLabel.textContent = char.label;
    els.thumbImg.src = char.thumb;
    els.thumbImg.style.opacity = '1';
    els.canvas.classList.remove('ready');

    refreshStrip();

    state.loadToken++;
    var myToken = state.loadToken;

    if (modelCache[char.id]) {
      showModel(modelCache[char.id], myToken, skipEntranceDelay);
      return;
    }

    var onLoaded = function (root, animations) {
      if (myToken !== state.loadToken) return; // user already moved on
      modelCache[char.id] = { root: root, animations: animations || [] };
      showModel(modelCache[char.id], myToken, skipEntranceDelay);
    };
    var onError = function () {
      // Keep the thumbnail visible -- selection still works even if the
      // live 3D preview couldn't load.
    };

    if (char.fbx) {
      new THREE.FBXLoader().load(char.file, function (obj) { onLoaded(obj, obj.animations); }, undefined, onError);
    } else {
      new THREE.GLTFLoader().load(char.file, function (gltf) { onLoaded(gltf.scene, gltf.animations); }, undefined, onError);
    }
  }

  function showModel(entry, myToken, skipEntranceDelay) {
    if (myToken !== state.loadToken) return;

    while (stageGroup.children.length) stageGroup.remove(stageGroup.children[0]);
    stageGroup.add(entry.root);
    normalize(entry.root);

    mixer = new THREE.AnimationMixer(entry.root);
    var clip = findClip(entry.animations, ['idle', 'stand']);
    if (clip) mixer.clipAction(clip).play();

    stageGroup.scale.setScalar(0.001);
    stageGroup.rotation.y = Math.PI * 0.15;
    entranceTween = { start: performance.now(), duration: skipEntranceDelay ? 380 : 520 };

    var reveal = function () {
      els.canvas.classList.add('ready');
      els.thumbImg.style.opacity = '0';
    };
    if (skipEntranceDelay) reveal(); else setTimeout(reveal, 60);
  }

  function easeOutBack(t) {
    var c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function animateStage(now) {
    requestAnimationFrame(animateStage);
    var dt = clock.getDelta();
    if (mixer) mixer.update(dt);

    if (entranceTween) {
      var t = (now - entranceTween.start) / entranceTween.duration;
      if (t >= 1) {
        t = 1;
        entranceTween = null;
      }
      var eased = easeOutBack(Math.min(t, 1));
      stageGroup.scale.setScalar(Math.max(0.001, eased));
    }

    stageGroup.rotation.y += dt * 0.35;
    stageRenderer.render(stageScene, stageCamera);
  }
})();
