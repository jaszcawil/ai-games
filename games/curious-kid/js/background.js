/* ==========================================================================
   Procedural animated 3D background for the Start Screen.
   Everything here is generated in code (no textures/models to fetch), so the
   scene appears on the very first frame -- there is nothing to "load".
   ========================================================================== */

(function () {
  'use strict';

  var canvas = document.getElementById('bg-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var motionScale = reduceMotion ? 0.15 : 1;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch (e) {
    canvas.style.display = 'none';
    return; // CSS gradient body background still looks fine without WebGL.
  }
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0.4, 9);

  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Widen the field of view on tall/narrow (portrait/mobile) screens so the
    // horizontal framing -- and crystal placement -- stays roughly consistent.
    camera.fov = camera.aspect < 0.85 ? 72 : 48;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);

  // ---- soft glow sprite texture, drawn procedurally on a canvas ----
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
  var glowTex = makeGlowTexture();

  // ---- starfield ----
  (function buildStars() {
    var count = window.innerWidth < 700 ? 350 : 700;
    var geo = new THREE.BufferGeometry();
    var positions = new Float32Array(count * 3);
    for (var i = 0; i < count; i++) {
      var r = 20 + Math.random() * 30;
      var theta = Math.random() * Math.PI * 2;
      var phi = Math.acos((Math.random() * 2) - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) * 0.6 + 1;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta) - 6;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    var mat = new THREE.PointsMaterial({
      size: 0.06,
      map: glowTex,
      color: 0xfff3d6,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    var stars = new THREE.Points(geo, mat);
    scene.add(stars);
  })();

  // ---- drifting sparkle dust (closer to camera) ----
  var dust = (function buildDust() {
    var count = window.innerWidth < 700 ? 40 : 80;
    var geo = new THREE.BufferGeometry();
    var positions = new Float32Array(count * 3);
    var speeds = new Float32Array(count);
    for (var i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 14;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 8 - 1;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 8 + 3;
      speeds[i] = 0.15 + Math.random() * 0.25;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    var mat = new THREE.PointsMaterial({
      size: 0.09,
      map: glowTex,
      color: 0xffd88a,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    var pts = new THREE.Points(geo, mat);
    scene.add(pts);
    return { points: pts, speeds: speeds, count: count };
  })();

  // ---- the four Knowledge Crystals ----
  // Placeholder low-poly gems appear immediately (no loading screen); if the
  // hand-modeled diamond geometry (assets/models/crystals/diamonds1.obj)
  // loads in time, each crystal is upgraded in place to the real gem cut.
  var CRYSTAL_DATA = [
    { color: 0x4fc3ff, pos: [-4.6, 1.7, -3.6], scale: 0.55, gem: 'diamondblue' },   // Science
    { color: 0xb586ff, pos: [4.7, 1.9, -3.2], scale: 0.62, gem: 'diamondred' },     // Mathematics
    { color: 0xffd34f, pos: [-4.9, -2.3, -4.0], scale: 0.52, gem: 'diamondwhite' }, // Music
    { color: 0xff6f9c, pos: [5.0, -2.1, -3.8], scale: 0.52, gem: 'diamondpink' }    // Goodness
  ];

  function makePlaceholderGeometry() {
    return new THREE.IcosahedronGeometry(1, 0);
  }

  function makeCrystalMaterial(color) {
    return new THREE.MeshPhysicalMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.55,
      metalness: 0.05,
      roughness: 0.1,
      clearcoat: 0.6,
      clearcoatRoughness: 0.15,
      flatShading: true,
      transparent: true,
      opacity: 0.9
    });
  }

  var crystals = CRYSTAL_DATA.map(function (data) {
    var group = new THREE.Group();

    var geo = makePlaceholderGeometry();
    var mat = makeCrystalMaterial(data.color);
    var mesh = new THREE.Mesh(geo, mat);
    mesh.scale.setScalar(data.scale);
    group.add(mesh);

    var glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex,
      color: data.color,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    }));
    glow.scale.setScalar(data.scale * 2.8);
    group.add(glow);

    var light = new THREE.PointLight(data.color, 1.1, 6);
    group.add(light);

    group.position.set(data.pos[0], data.pos[1], data.pos[2]);
    scene.add(group);

    return {
      group: group,
      mesh: mesh,
      data: data,
      baseScale: data.scale,
      bobSpeed: 0.5 + Math.random() * 0.3,
      bobPhase: Math.random() * Math.PI * 2,
      bobAmount: 0.18 + Math.random() * 0.08,
      spinSpeed: (0.15 + Math.random() * 0.15) * (Math.random() < 0.5 ? -1 : 1)
    };
  });

  // ---- upgrade placeholders to the real hand-modeled diamond gems ----
  (function loadGemModel() {
    if (typeof THREE.OBJLoader === 'undefined') return;
    new THREE.OBJLoader().load(
      'assets/models/crystals/diamonds1.obj',
      function (group) {
        var found = {};
        group.traverse(function (child) {
          if (!child.isMesh) return;
          ['diamondblue', 'diamondred', 'diamondwhite', 'diamondpink', 'diamondgreen'].forEach(function (name) {
            if (found[name]) return;
            if (child.name.indexOf(name) === 0) found[name] = child.geometry;
          });
        });

        crystals.forEach(function (c) {
          var sourceGeo = found[c.data.gem];
          if (!sourceGeo) return;

          var geo = sourceGeo.clone();
          geo.computeBoundingBox();
          var center = new THREE.Vector3();
          geo.boundingBox.getCenter(center);
          geo.translate(-center.x, -center.y, -center.z);
          geo.computeBoundingSphere();
          var radius = geo.boundingSphere.radius || 1;
          geo.computeVertexNormals();

          c.mesh.geometry.dispose();
          c.mesh.geometry = geo;
          var normalize = 1 / radius;
          c.mesh.scale.setScalar(c.baseScale * normalize);
        });
      },
      undefined,
      function () {
        // Load failed (offline copy missing, etc.) -- the placeholder gems
        // stay on screen, so the scene never looks broken.
      }
    );
  })();

  scene.add(new THREE.AmbientLight(0x8866cc, 0.55));

  // ---- gentle camera parallax from pointer / device tilt ----
  var targetX = 0, targetY = 0;
  window.addEventListener('pointermove', function (e) {
    targetX = (e.clientX / window.innerWidth - 0.5) * 0.6;
    targetY = (e.clientY / window.innerHeight - 0.5) * 0.35;
  }, { passive: true });
  window.addEventListener('deviceorientation', function (e) {
    if (e.gamma == null || e.beta == null) return;
    targetX = Math.max(-1, Math.min(1, e.gamma / 30)) * 0.5;
    targetY = Math.max(-1, Math.min(1, (e.beta - 40) / 30)) * 0.3;
  }, { passive: true });

  // ---- render loop ----
  var running = true;
  document.addEventListener('visibilitychange', function () {
    running = document.visibilityState === 'visible';
  });

  var clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    if (!running) return;
    var t = clock.getElapsedTime() * motionScale;

    crystals.forEach(function (c) {
      c.group.position.y += 0; // base set once; use sin offset instead:
      c.group.rotation.y = t * c.spinSpeed;
      c.group.rotation.x = Math.sin(t * 0.3 + c.bobPhase) * 0.08;
      c.mesh.position.y = Math.sin(t * c.bobSpeed + c.bobPhase) * c.bobAmount;
    });

    var dustPos = dust.points.geometry.attributes.position;
    for (var i = 0; i < dust.count; i++) {
      var y = dustPos.getY(i) + dust.speeds[i] * 0.01;
      if (y > 4) y = -4;
      dustPos.setY(i, y);
    }
    dustPos.needsUpdate = true;

    camera.position.x += (targetX - camera.position.x) * 0.02;
    camera.position.y += (0.4 + targetY - camera.position.y) * 0.02;
    camera.lookAt(0, 0.1, -1);

    renderer.render(scene, camera);
  }
  animate();
})();
