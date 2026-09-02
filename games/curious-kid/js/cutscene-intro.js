/* ==========================================================================
   Intro Cutscene -- "How the Crystals Went Missing"
   One continuous procedural 3D scene; a virtual camera moves through a
   timeline of beats while captions, a party reveal, and a title card
   overlay in sync. Nothing is loaded from the network except the (local)
   diamond crystal model already used on the Start Screen -- everything
   else is generated in code, so there is no loading screen.
   ========================================================================== */

(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var slot = params.get('slot') || window.localStorage.getItem('ckqkc.lastSlot');

  var party = [
    { role: 'hero', name: 'Curious Kid', characterLabel: '' },
    { role: 'musician', name: 'the Musician', characterLabel: '' },
    { role: 'inventor', name: 'the Inventor', characterLabel: '' },
    { role: 'guide', name: 'the Guide', characterLabel: '' }
  ];
  if (slot) {
    var save = window.SaveManager && window.SaveManager.readSlot(slot);
    if (save && save.progress && save.progress.party && save.progress.party.length === 4) {
      party = save.progress.party;
    }
  }
  var heroName = party[0].name;

  // ---------------- Timeline (seconds) ----------------
  var T = {
    flightStart: 0, flightEnd: 7,
    libraryStart: 7, libraryEnd: 14,
    vanishStart: 14, vanishTrigger: 15.2, vanishEnd: 20,
    chaosStart: 20, chaosEnd: 28,
    discoveryStart: 28, discoveryEnd: 34,
    partyStart: 34, partyEnd: 41,
    titleStart: 41, autoAdvance: 46.5
  };

  var CAPTIONS = [
    { start: 1.2, end: 6.6, text: 'Welcome to Chokmah — a world where knowledge is magic.' },
    { start: 7.6, end: 13.6, text: 'For generations, four Knowledge Crystals powered the Great Library of Chokmah.' },
    { start: 14.4, end: 19.6, text: 'But one night... the four crystals vanished without a trace!' },
    { start: 20.6, end: 24.0, text: 'Plants stopped growing. Machines broke down.' },
    { start: 24.2, end: 27.8, text: 'Numbers scrambled, music fell silent, and people forgot how to be kind.' },
    { start: 28.6, end: 33.8, text: 'The Great Librarian discovered the truth: the crystals had scattered across the world, waiting for someone to bring them home.' }
  ];

  // ---------------- DOM ----------------
  var els = {
    skyA: document.getElementById('cut-sky-a'),
    skyB: document.getElementById('cut-sky-b'),
    canvas: document.getElementById('cut-canvas'),
    caption: document.getElementById('cut-caption'),
    partyReveal: document.getElementById('cut-party-reveal'),
    partyHeading: document.getElementById('cut-party-heading'),
    partyCards: document.getElementById('cut-party-cards'),
    titleCard: document.getElementById('cut-title-card'),
    continueBtn: document.getElementById('cut-continue'),
    skipBtn: document.getElementById('cut-skip'),
    fadeCurtain: document.getElementById('fade-curtain')
  };

  document.addEventListener('DOMContentLoaded', init);

  var finished = false;
  var startedAt = null;
  var skySwitched = false;
  var skyBackTo = false;
  var vanished = false;
  var chaosSpritesShown = false;
  var partyCardsShown = false;
  var titleShown = false;
  var lastCaption = null;
  var autoAdvanceTimer = null;

  function init() {
    if (window.Settings && window.SoundManager) {
      window.Settings.load();
      window.Settings.applyToAudio();
    }
    buildPartyCards();
    buildScene();
    bindControls();
    startedAt = performance.now();
    requestAnimationFrame(tick);
  }

  function bindControls() {
    els.skipBtn.addEventListener('click', function () { finish(); });
    els.continueBtn.addEventListener('click', function () { finish(); });
  }

  function buildPartyCards() {
    els.partyHeading.textContent = 'That someone is ' + heroName + '!';
    els.partyCards.innerHTML = '';
    party.forEach(function (member) {
      var char = (window.CHARACTER_ROSTER || []).filter(function (c) { return c.id === member.character; })[0];
      var card = document.createElement('div');
      card.className = 'cut-party-card';
      var img = document.createElement('img');
      img.src = char ? char.thumb : '';
      img.alt = member.name;
      var pname = document.createElement('div');
      pname.className = 'pname';
      pname.textContent = member.name;
      var role = document.createElement('div');
      role.className = 'role';
      role.textContent = member.role;
      card.appendChild(img);
      card.appendChild(pname);
      card.appendChild(role);
      els.partyCards.appendChild(card);
    });
  }

  // ================= 3D SCENE =================

  var scene, camera, renderer, clock;
  var bird, birdWings = [];
  var crystalGroup, crystals = [];
  var chaosSprites = [];
  var libraryGroup;

  function makeGlowTexture() {
    var size = 128;
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var ctx = c.getContext('2d');
    var g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    var tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }

  function makeEmojiTexture(glyph) {
    var size = 128;
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var ctx = c.getContext('2d');
    ctx.font = '92px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, size / 2, size / 2 + 6);
    var tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }

  function buildScene() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);

    renderer = new THREE.WebGLRenderer({ canvas: els.canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    resize();
    window.addEventListener('resize', resize);

    clock = new THREE.Clock();

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    var sun = new THREE.DirectionalLight(0xfff4dd, 1.0);
    sun.position.set(10, 16, 8);
    scene.add(sun);
    var fill = new THREE.DirectionalLight(0xbfd8ff, 0.4);
    fill.position.set(-8, 6, -6);
    scene.add(fill);

    buildTerrain();
    buildLibrary();
    buildBird();
    buildCrystals();
    buildChaosSprites();
  }

  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function buildTerrain() {
    var ground = new THREE.Mesh(
      new THREE.CircleGeometry(46, 40),
      new THREE.MeshStandardMaterial({ color: 0x5fb85a, roughness: 0.95, flatShading: true })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // rolling hills
    var hillColors = [0x4fa84c, 0x6bc464, 0x3f9748];
    for (var i = 0; i < 16; i++) {
      var ang = Math.random() * Math.PI * 2;
      var dist = 10 + Math.random() * 26;
      var hill = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.6 + Math.random() * 2.4, 0),
        new THREE.MeshStandardMaterial({ color: hillColors[i % hillColors.length], roughness: 1, flatShading: true })
      );
      hill.position.set(Math.cos(ang) * dist, -0.6, Math.sin(ang) * dist - 4);
      hill.scale.y = 0.42;
      scene.add(hill);
    }

    // distant mountains
    for (var m = 0; m < 10; m++) {
      var ma = (m / 10) * Math.PI * 2;
      var mountain = new THREE.Mesh(
        new THREE.ConeGeometry(5 + Math.random() * 3, 9 + Math.random() * 6, 5),
        new THREE.MeshStandardMaterial({ color: 0x7d7ec9, roughness: 1, flatShading: true })
      );
      mountain.position.set(Math.cos(ma) * 42, 3, Math.sin(ma) * 42 - 4);
      scene.add(mountain);
    }

    // winding river (a few flattened segments forming a gentle curve)
    var riverMat = new THREE.MeshStandardMaterial({ color: 0x5cc7e6, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.88 });
    var riverPts = [[-20, 10], [-12, 4], [-4, 1], [4, -2], [14, -6], [24, -9]];
    for (var r = 0; r < riverPts.length - 1; r++) {
      var a = riverPts[r], b = riverPts[r + 1];
      var dx = b[0] - a[0], dz = b[1] - a[1];
      var len = Math.sqrt(dx * dx + dz * dz);
      var seg = new THREE.Mesh(new THREE.PlaneGeometry(len + 1.5, 2.4), riverMat);
      seg.rotation.x = -Math.PI / 2;
      seg.rotation.z = -Math.atan2(dz, dx);
      seg.position.set((a[0] + b[0]) / 2, 0.02, (a[1] + b[1]) / 2);
      scene.add(seg);
    }

    // trees
    var trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a5a3a, flatShading: true });
    var leafMats = [
      new THREE.MeshStandardMaterial({ color: 0x3f9748, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0x59b357, flatShading: true })
    ];
    for (var t = 0; t < 26; t++) {
      var tAng = Math.random() * Math.PI * 2;
      var tDist = 8 + Math.random() * 30;
      var tx = Math.cos(tAng) * tDist, tz = Math.sin(tAng) * tDist - 4;
      if (Math.abs(tx) < 5 && tz > -6 && tz < 4) continue; // keep clear near the library
      var group = new THREE.Group();
      var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.9, 6), trunkMat);
      trunk.position.y = 0.45;
      group.add(trunk);
      var leaf = new THREE.Mesh(new THREE.ConeGeometry(0.65, 1.5, 7), leafMats[t % 2]);
      leaf.position.y = 1.5;
      group.add(leaf);
      group.position.set(tx, 0, tz);
      var s = 0.7 + Math.random() * 0.6;
      group.scale.setScalar(s);
      scene.add(group);
    }
  }

  function buildLibrary() {
    libraryGroup = new THREE.Group();

    var base = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 3.6, 1.2, 10),
      new THREE.MeshStandardMaterial({ color: 0xe8ddc4, roughness: 0.9, flatShading: true })
    );
    base.position.y = 0.6;
    libraryGroup.add(base);

    var tower = new THREE.Mesh(
      new THREE.CylinderGeometry(1.9, 2.3, 5.2, 10),
      new THREE.MeshStandardMaterial({ color: 0xf3ead2, roughness: 0.85, flatShading: true })
    );
    tower.position.y = 4.3;
    libraryGroup.add(tower);

    var roof = new THREE.Mesh(
      new THREE.ConeGeometry(2.6, 2.6, 10),
      new THREE.MeshStandardMaterial({ color: 0x5b3f8f, roughness: 0.6, flatShading: true, emissive: 0x2a1a55, emissiveIntensity: 0.3 })
    );
    roof.position.y = 8.2;
    libraryGroup.add(roof);

    var spireGlow = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.35, 0),
      new THREE.MeshStandardMaterial({ color: 0xffe27a, emissive: 0xffcf5c, emissiveIntensity: 1.4 })
    );
    spireGlow.position.y = 9.6;
    libraryGroup.add(spireGlow);
    var spireLight = new THREE.PointLight(0xffcf5c, 1.2, 10);
    spireLight.position.y = 9.6;
    libraryGroup.add(spireLight);

    [-1, 1].forEach(function (side) {
      var sTower = new THREE.Mesh(
        new THREE.CylinderGeometry(1, 1.15, 3.2, 8),
        new THREE.MeshStandardMaterial({ color: 0xf3ead2, roughness: 0.85, flatShading: true })
      );
      sTower.position.set(side * 3.4, 2.2, -0.6);
      libraryGroup.add(sTower);
      var sRoof = new THREE.Mesh(
        new THREE.ConeGeometry(1.35, 1.6, 8),
        new THREE.MeshStandardMaterial({ color: 0x5b3f8f, roughness: 0.6, flatShading: true })
      );
      sRoof.position.set(side * 3.4, 4.6, -0.6);
      libraryGroup.add(sRoof);
    });

    libraryGroup.position.set(0, 0, -2);
    scene.add(libraryGroup);
  }

  function buildBird() {
    bird = new THREE.Group();
    var bodyMat = new THREE.MeshStandardMaterial({ color: 0x6bb9e8, flatShading: true });
    var bellyMat = new THREE.MeshStandardMaterial({ color: 0xfff6e6, flatShading: true });
    var beakMat = new THREE.MeshStandardMaterial({ color: 0xffb04a, flatShading: true });

    var body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), bodyMat);
    body.scale.set(1.3, 1, 1);
    bird.add(body);

    var belly = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), bellyMat);
    belly.position.set(0, -0.1, 0.05);
    belly.scale.set(1.1, 0.8, 0.9);
    bird.add(belly);

    var beak = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 6), beakMat);
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(0.42, 0, 0);
    bird.add(beak);

    var tail = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.4, 6), bodyMat);
    tail.rotation.z = Math.PI / 2;
    tail.position.set(-0.42, 0.02, 0);
    bird.add(tail);

    [-1, 1].forEach(function (side) {
      var wing = new THREE.Mesh(new THREE.CircleGeometry(0.34, 8, 0, Math.PI), bodyMat);
      wing.material = bodyMat.clone();
      wing.material.side = THREE.DoubleSide;
      wing.rotation.y = Math.PI / 2;
      wing.rotation.z = side > 0 ? 0 : Math.PI;
      wing.position.set(0, 0.02, side * 0.1);
      var pivot = new THREE.Group();
      pivot.add(wing);
      wing.position.set(0, 0, side * 0.25);
      pivot.position.set(0, 0.05, 0);
      bird.add(pivot);
      birdWings.push({ pivot: pivot, side: side });
    });

    bird.scale.setScalar(1.6);
    scene.add(bird);
  }

  function buildCrystals() {
    crystalGroup = new THREE.Group();
    crystalGroup.position.set(0, 9.4, -2);
    scene.add(crystalGroup);

    var glowTex = makeGlowTexture();
    var CRYSTAL_DATA = [
      { color: 0x4fc3ff, ang: 0 },
      { color: 0xb586ff, ang: Math.PI / 2 },
      { color: 0xffd34f, ang: Math.PI },
      { color: 0xff6f9c, ang: Math.PI * 1.5 }
    ];

    CRYSTAL_DATA.forEach(function (data) {
      var group = new THREE.Group();
      var geo = new THREE.OctahedronGeometry(0.42, 0);
      var mat = new THREE.MeshStandardMaterial({
        color: data.color, emissive: data.color, emissiveIntensity: 0.8,
        roughness: 0.15, metalness: 0.1, flatShading: true, transparent: true, opacity: 0.94
      });
      var mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);

      var glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: data.color, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending
      }));
      glow.scale.setScalar(1.6);
      group.add(glow);

      var orbitRadius = 1.7;
      group.position.set(Math.cos(data.ang) * orbitRadius, 0, Math.sin(data.ang) * orbitRadius);
      crystalGroup.add(group);

      crystals.push({
        group: group, mesh: mesh, mat: mat, glow: glow,
        ang: data.ang, orbitRadius: orbitRadius,
        flyDir: new THREE.Vector3(Math.cos(data.ang), 0.35, Math.sin(data.ang)).normalize(),
        scattered: false
      });
    });
  }

  function buildChaosSprites() {
    var glyphs = ['🥀', '⚙️', '🔢', '🎵', '💢'];
    var glowTex = makeGlowTexture();
    glyphs.forEach(function (glyph, i) {
      var tex = makeEmojiTexture(glyph);
      var mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0 });
      var sprite = new THREE.Sprite(mat);
      var ang = (i / glyphs.length) * Math.PI * 2;
      var radius = 6.5;
      sprite.position.set(Math.cos(ang) * radius, 3 + (i % 3) * 0.8, Math.sin(ang) * radius - 2);
      sprite.scale.setScalar(1.1);
      scene.add(sprite);
      chaosSprites.push({ sprite: sprite, baseY: sprite.position.y, phase: Math.random() * Math.PI * 2 });
    });
  }

  // ================= TIMELINE / CAMERA =================

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function vlerp(out, a, b, t) {
    out.set(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));
    return out;
  }

  var camPos = new THREE.Vector3();
  var camLook = new THREE.Vector3();

  // Bird's flight direction is a fixed straight line (see updateBird); precompute its unit vector.
  var BIRD_DIR_X = 0.9375, BIRD_DIR_Z = -0.3512;

  function updateCamera(t) {
    if (t < T.libraryStart) {
      // Chase-cam: trail the bird on its flyover so it reads clearly against a wide vista,
      // then smoothly hand off into the fixed library-approach shot as the bird nears home.
      var pRaw = clamp01((t - T.flightStart) / (T.libraryStart - T.flightStart));
      var bx = lerp(-14, 10, pRaw), bz = lerp(6, -3, pRaw), by = 5.5 + Math.sin(pRaw * Math.PI) * 2.2;
      var chaseEase = easeInOut(clamp01(pRaw / 0.74));
      var dist = lerp(11, 6, chaseEase);
      var height = lerp(4.8, 2.8, chaseEase);
      var chasePos = [bx - BIRD_DIR_X * dist, by + height, bz - BIRD_DIR_Z * dist];
      var chaseLook = [bx + BIRD_DIR_X * 6.5, by - 1.2, bz + BIRD_DIR_Z * 6.5];
      if (pRaw < 0.74) {
        camPos.set(chasePos[0], chasePos[1], chasePos[2]);
        camLook.set(chaseLook[0], chaseLook[1], chaseLook[2]);
      } else {
        var blend = easeInOut(clamp01((pRaw - 0.74) / 0.26));
        vlerp(camPos, chasePos, [4, 5, 11], blend);
        vlerp(camLook, chaseLook, [0, 6, -2], blend);
      }
    } else if (t < T.vanishStart) {
      var p2 = easeInOut(clamp01((t - T.libraryStart) / (T.vanishStart - T.libraryStart)));
      vlerp(camPos, [4, 5, 11], [1.5, 4.2, 8], p2);
      vlerp(camLook, [0, 6, -2], [0, 8, -2], p2);
    } else if (t < T.chaosStart) {
      var p3 = easeInOut(clamp01((t - T.vanishStart) / (T.chaosStart - T.vanishStart)));
      vlerp(camPos, [1.5, 4.2, 8], [-2, 4.6, 8.6], p3);
      vlerp(camLook, [0, 8, -2], [0, 6, -2], p3);
      if (t > T.vanishTrigger) {
        var shake = Math.max(0, 1 - (t - T.vanishTrigger) * 1.6);
        camPos.x += Math.sin(t * 40) * 0.06 * shake;
        camPos.y += Math.cos(t * 33) * 0.05 * shake;
      }
    } else if (t < T.discoveryStart) {
      var p4 = easeInOut(clamp01((t - T.chaosStart) / (T.discoveryStart - T.chaosStart)));
      var ang = lerp(-0.35, 0.35, p4);
      camPos.set(Math.sin(ang) * 9 - 2, 4.8, Math.cos(ang) * 9 - 2);
      vlerp(camLook, [0, 4, -2], [0, 4, -2], p4);
    } else if (t < T.partyStart) {
      var p5 = easeInOut(clamp01((t - T.discoveryStart) / (T.partyStart - T.discoveryStart)));
      vlerp(camPos, [-2, 4.6, 8.6], [0, 5, 13], p5);
      vlerp(camLook, [0, 4, -2], [0, 3, -2], p5);
    } else {
      var p6 = clamp01((t - T.partyStart) / 6);
      vlerp(camPos, [0, 5, 13], [0, 5.6, 16], p6);
      vlerp(camLook, [0, 3, -2], [0, 3, -3], p6);
    }
    camera.position.copy(camPos);
    camera.lookAt(camLook);
  }

  function updateBird(t) {
    var span = T.flightEnd - T.flightStart;
    var p = clamp01((t - T.flightStart) / span);
    if (t < T.flightStart - 0.5 || p >= 1.001) {
      bird.visible = t < T.libraryStart + 1.5;
      if (bird.visible) {
        // gentle continued cameo further away
        bird.position.set(lerp(6, 14, clamp01((t - T.flightEnd) / 3)), 6.5, -6);
        bird.scale.setScalar(Math.max(0.2, 1.6 * (1 - clamp01((t - T.flightEnd) / 3))));
      }
    } else {
      bird.visible = true;
      bird.scale.setScalar(1.6);
      var x = lerp(-14, 10, p);
      var z = lerp(6, -3, p) ;
      var y = 5.5 + Math.sin(p * Math.PI) * 2.2 + Math.sin(t * 3) * 0.15;
      bird.position.set(x, y, z);
      var ahead = lerp(-14, 10, clamp01(p + 0.02));
      bird.rotation.y = Math.atan2(-1, (ahead - x) || 0.001) + Math.PI / 2;
      bird.rotation.z = Math.sin(t * 3) * 0.06;
    }
    birdWings.forEach(function (w) {
      w.pivot.rotation.z = w.side * (0.25 + Math.sin(t * 16) * 0.55);
    });
  }

  function triggerVanish() {
    if (vanished) return;
    vanished = true;
    crystals.forEach(function (c) {
      burstParticles(c.group.position.clone().add(crystalGroup.position));
    });
  }

  function burstParticles(worldPos) {
    var count = 22;
    var positions = new Float32Array(count * 3);
    var velocities = [];
    for (var i = 0; i < count; i++) {
      positions[i * 3] = worldPos.x; positions[i * 3 + 1] = worldPos.y; positions[i * 3 + 2] = worldPos.z;
      var dir = new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.2), (Math.random() - 0.5)).normalize().multiplyScalar(1.5 + Math.random() * 2);
      velocities.push(dir);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    var mat = new THREE.PointsMaterial({ size: 0.18, color: 0xffe9b0, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
    var pts = new THREE.Points(geo, mat);
    scene.add(pts);
    var born = clock.getElapsedTime();
    (function anim() {
      var age = clock.getElapsedTime() - born;
      if (age > 1.2) { scene.remove(pts); geo.dispose(); mat.dispose(); return; }
      var pos = geo.attributes.position;
      for (var i = 0; i < count; i++) {
        pos.setXYZ(i,
          worldPos.x + velocities[i].x * age,
          worldPos.y + velocities[i].y * age - age * age * 1.2,
          worldPos.z + velocities[i].z * age
        );
      }
      pos.needsUpdate = true;
      mat.opacity = Math.max(0, 1 - age / 1.2);
      requestAnimationFrame(anim);
    })();
  }

  function updateCrystals(t) {
    var orbitT = t < T.vanishTrigger ? t : T.vanishTrigger;
    crystalGroup.rotation.y = orbitT * 0.25;

    if (t >= T.vanishStart && t < T.vanishTrigger) {
      var p = clamp01((t - T.vanishStart) / (T.vanishTrigger - T.vanishStart));
      var pulse = 1 + Math.sin(p * Math.PI * 6) * 0.25 * p;
      crystals.forEach(function (c) { c.mesh.scale.setScalar(pulse); c.mat.emissiveIntensity = 0.8 + p * 2; });
    } else if (t >= T.vanishTrigger) {
      if (!vanished) triggerVanish();
      var p2 = clamp01((t - T.vanishTrigger) / 2.2);
      var ease = easeInOut(p2);
      crystals.forEach(function (c) {
        c.group.position.set(
          Math.cos(c.ang) * c.orbitRadius + c.flyDir.x * ease * 30,
          c.flyDir.y * ease * 20,
          Math.sin(c.ang) * c.orbitRadius + c.flyDir.z * ease * 30
        );
        c.mesh.material.opacity = Math.max(0, 0.94 - ease);
        c.glow.material.opacity = Math.max(0, 0.6 - ease * 0.7);
      });
      crystalGroup.visible = p2 < 0.98;
    }
  }

  function updateChaos(t) {
    var fadeIn = clamp01((t - T.chaosStart) / 2);
    var fadeOut = t > T.discoveryStart + 3 ? clamp01(1 - (t - (T.discoveryStart + 3)) / 3) : 1;
    var opacity = Math.min(fadeIn, fadeOut);
    chaosSprites.forEach(function (c, i) {
      c.sprite.material.opacity = opacity * 0.95;
      c.sprite.position.y = c.baseY + Math.sin(t * 0.8 + c.phase) * 0.3;
    });
  }

  function updateSky(t) {
    if (t >= T.vanishStart && !skySwitched) {
      skySwitched = true;
      els.skyB.style.opacity = '1';
    }
    if (t >= T.discoveryStart + 4 && !skyBackTo) {
      skyBackTo = true;
      els.skyB.style.opacity = '0.35';
    }
  }

  // ================= CAPTIONS / OVERLAYS =================

  function updateCaption(t) {
    var active = null;
    for (var i = 0; i < CAPTIONS.length; i++) {
      if (t >= CAPTIONS[i].start && t < CAPTIONS[i].end) { active = CAPTIONS[i]; break; }
    }
    if (active !== lastCaption) {
      lastCaption = active;
      if (active) {
        els.caption.textContent = active.text;
        requestAnimationFrame(function () { els.caption.classList.add('visible'); });
      } else {
        els.caption.classList.remove('visible');
      }
    }
  }

  function updateOverlays(t) {
    if (t >= T.partyStart && !partyCardsShown) {
      partyCardsShown = true;
      els.partyReveal.classList.remove('hidden');
      requestAnimationFrame(function () { els.partyReveal.classList.add('visible'); });
      var cards = els.partyCards.querySelectorAll('.cut-party-card');
      cards.forEach(function (card, i) {
        setTimeout(function () { card.classList.add('visible'); }, 200 + i * 220);
      });
    }
    if (t >= T.partyEnd && partyCardsShown && els.partyReveal.classList.contains('visible')) {
      els.partyReveal.classList.remove('visible');
    }
    if (t >= T.titleStart && !titleShown) {
      titleShown = true;
      els.titleCard.classList.remove('hidden');
      requestAnimationFrame(function () { els.titleCard.classList.add('visible'); });
      autoAdvanceTimer = setTimeout(finish, (T.autoAdvance - T.titleStart) * 1000);
    }
  }

  // ================= MAIN LOOP =================

  function tick() {
    if (finished) return;
    var t = (performance.now() - startedAt) / 1000;
    updateCamera(t);
    updateBird(t);
    updateCrystals(t);
    updateChaos(t);
    updateSky(t);
    updateCaption(t);
    updateOverlays(t);
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(autoAdvanceTimer);

    if (slot && window.SaveManager) {
      var s = window.SaveManager.readSlot(slot);
      if (s) {
        s.progress.introCutsceneSeen = true;
        window.SaveManager.writeSlot(slot, s);
      }
    }

    els.fadeCurtain.classList.remove('hidden');
    els.fadeCurtain.classList.add('active');
    setTimeout(function () {
      window.location.href = 'world.html?slot=' + encodeURIComponent(slot || '');
    }, 550);
  }
})();
