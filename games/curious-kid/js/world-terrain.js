/* ==========================================================================
   World Terrain & Content Builder -- the open world of Chokmah.
   Builds an instantly-rendering procedural terrain (ground, library, hills,
   river, boundary mountains) on frame 1 -- "no loading screen" -- then
   streams in the real toxsam CC0 GLB props asynchronously afterward,
   nearest-to-spawn first, popping each in as it finishes loading.
   ========================================================================== */

(function () {
  'use strict';

  var GROUND_RADIUS = 130;
  var PLAZA_CLEAR_RADIUS = 15;

  // ---------------- small deterministic PRNG (so the world looks the same every run) ----------------
  function makeRng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  // ================= PUBLIC ENTRY =================

  window.WorldTerrain = {
    GROUND_RADIUS: GROUND_RADIUS,
    PLAZA_CLEAR_RADIUS: PLAZA_CLEAR_RADIUS,
    SPAWN: { x: 0, z: 20, ry: Math.PI },
    build: build,
    streamProps: streamProps
  };

  function build(scene) {
    var groups = {
      ground: new THREE.Group(),
      library: new THREE.Group(),
      nature: new THREE.Group(),
      props: new THREE.Group() // real GLB props stream in here
    };
    scene.add(groups.ground, groups.library, groups.nature, groups.props);

    buildLighting(scene);
    buildSky(scene);
    buildGround(groups.ground);
    buildBoundaryMountains(groups.nature);
    buildRiver(groups.ground);
    buildLibrary(groups.library);

    return groups;
  }

  // ================= LIGHTING / SKY =================

  function buildLighting(scene) {
    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    var sun = new THREE.DirectionalLight(0xfff4dd, 1.05);
    sun.position.set(30, 50, 20);
    scene.add(sun);
    var fill = new THREE.DirectionalLight(0xbfd8ff, 0.35);
    fill.position.set(-25, 20, -15);
    scene.add(fill);
    scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x5fb85a, 0.4));
  }

  function buildSky(scene) {
    scene.fog = new THREE.Fog(0xbfe0f5, 90, 210);
    scene.background = new THREE.Color(0x8fd0f0);
  }

  // ================= GROUND =================

  var ZONES = {
    fair: { name: 'fair', cx: 0, cz: 66, radius: 40, tint: 0xe9d9a8 },
    ruins: { name: 'ruins', cx: 72, cz: -6, radius: 38, tint: 0xcfc6b8 },
    forest: { name: 'forest', cx: -14, cz: -78, radius: 42, tint: 0x4fa84c },
    garden: { name: 'garden', cx: -78, cz: 22, radius: 38, tint: 0x8fce7a }
  };
  window.WorldTerrain.ZONES = ZONES;

  function buildGround(group) {
    var ground = new THREE.Mesh(
      new THREE.CircleGeometry(GROUND_RADIUS, 64),
      new THREE.MeshStandardMaterial({ color: 0x5fb85a, roughness: 0.95, flatShading: true })
    );
    ground.rotation.x = -Math.PI / 2;
    group.add(ground);

    // soft zone-tinted patches so each region reads distinctly even before props stream in
    Object.keys(ZONES).forEach(function (key) {
      var z = ZONES[key];
      var patch = new THREE.Mesh(
        new THREE.CircleGeometry(z.radius * 1.05, 28),
        new THREE.MeshStandardMaterial({ color: z.tint, roughness: 1, flatShading: true, transparent: true, opacity: 0.55 })
      );
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(z.cx, 0.015, z.cz);
      group.add(patch);
    });

    // plaza (paved circle right at the library)
    var plaza = new THREE.Mesh(
      new THREE.CircleGeometry(PLAZA_CLEAR_RADIUS, 32),
      new THREE.MeshStandardMaterial({ color: 0xd8cfa8, roughness: 0.9, flatShading: true })
    );
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.02;
    group.add(plaza);

    // gentle rolling hills scattered outside the zones, for horizon texture
    var rng = makeRng(7);
    var hillColors = [0x4fa84c, 0x6bc464, 0x3f9748];
    for (var i = 0; i < 26; i++) {
      var ang = rng() * Math.PI * 2;
      var dist = 96 + rng() * 26;
      var hill = new THREE.Mesh(
        new THREE.IcosahedronGeometry(2.2 + rng() * 3.4, 0),
        new THREE.MeshStandardMaterial({ color: hillColors[i % hillColors.length], roughness: 1, flatShading: true })
      );
      hill.position.set(Math.cos(ang) * dist, -1, Math.sin(ang) * dist);
      hill.scale.y = 0.4;
      group.add(hill);
    }
  }

  function buildBoundaryMountains(group) {
    var rng = makeRng(21);
    for (var m = 0; m < 22; m++) {
      var ma = (m / 22) * Math.PI * 2 + rng() * 0.1;
      var mountain = new THREE.Mesh(
        new THREE.ConeGeometry(7 + rng() * 5, 13 + rng() * 9, 5),
        new THREE.MeshStandardMaterial({ color: 0x7d7ec9, roughness: 1, flatShading: true })
      );
      mountain.position.set(Math.cos(ma) * 148, 4, Math.sin(ma) * 148);
      group.add(mountain);
    }
  }

  function buildRiver(group) {
    var riverMat = new THREE.MeshStandardMaterial({ color: 0x5cc7e6, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.85 });
    var pts = [[-130, -55], [-90, -50], [-50, -40], [-10, -34], [30, -30], [70, -34], [120, -45]];
    for (var r = 0; r < pts.length - 1; r++) {
      var a = pts[r], b = pts[r + 1];
      var dx = b[0] - a[0], dz = b[1] - a[1];
      var len = Math.sqrt(dx * dx + dz * dz);
      var seg = new THREE.Mesh(new THREE.PlaneGeometry(len + 2, 4.5), riverMat);
      seg.rotation.x = -Math.PI / 2;
      seg.rotation.z = -Math.atan2(dz, dx);
      seg.position.set((a[0] + b[0]) / 2, 0.03, (a[1] + b[1]) / 2);
      group.add(seg);
    }
  }

  // ================= LIBRARY (home base) =================

  function buildLibrary(group) {
    var base = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 3.6, 1.2, 10),
      new THREE.MeshStandardMaterial({ color: 0xe8ddc4, roughness: 0.9, flatShading: true })
    );
    base.position.y = 0.6;
    group.add(base);

    var tower = new THREE.Mesh(
      new THREE.CylinderGeometry(1.9, 2.3, 5.2, 10),
      new THREE.MeshStandardMaterial({ color: 0xf3ead2, roughness: 0.85, flatShading: true })
    );
    tower.position.y = 4.3;
    group.add(tower);

    var roof = new THREE.Mesh(
      new THREE.ConeGeometry(2.6, 2.6, 10),
      new THREE.MeshStandardMaterial({ color: 0x5b3f8f, roughness: 0.6, flatShading: true, emissive: 0x2a1a55, emissiveIntensity: 0.3 })
    );
    roof.position.y = 8.2;
    group.add(roof);

    var spireGlow = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.35, 0),
      new THREE.MeshStandardMaterial({ color: 0xffe27a, emissive: 0xffcf5c, emissiveIntensity: 1.4 })
    );
    spireGlow.position.y = 9.6;
    group.add(spireGlow);
    var spireLight = new THREE.PointLight(0xffcf5c, 1.2, 14);
    spireLight.position.y = 9.6;
    group.add(spireLight);

    [-1, 1].forEach(function (side) {
      var sTower = new THREE.Mesh(
        new THREE.CylinderGeometry(1, 1.15, 3.2, 8),
        new THREE.MeshStandardMaterial({ color: 0xf3ead2, roughness: 0.85, flatShading: true })
      );
      sTower.position.set(side * 3.4, 2.2, -0.6);
      group.add(sTower);
      var sRoof = new THREE.Mesh(
        new THREE.ConeGeometry(1.35, 1.6, 8),
        new THREE.MeshStandardMaterial({ color: 0x5b3f8f, roughness: 0.6, flatShading: true })
      );
      sRoof.position.set(side * 3.4, 4.6, -0.6);
      group.add(sRoof);
    });

    // four small floating Knowledge Crystals atop the spire, echoing the start screen + cutscene
    var glowTex = makeGlowTexture();
    var CRYSTAL_DATA = [
      { color: 0x4fc3ff, ang: 0 }, { color: 0xb586ff, ang: Math.PI / 2 },
      { color: 0xffd34f, ang: Math.PI }, { color: 0xff6f9c, ang: Math.PI * 1.5 }
    ];
    var ring = new THREE.Group();
    ring.position.set(0, 10.6, 0);
    CRYSTAL_DATA.forEach(function (d) {
      var m = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.34, 0),
        new THREE.MeshStandardMaterial({ color: d.color, emissive: d.color, emissiveIntensity: 0.9, roughness: 0.15, flatShading: true })
      );
      m.position.set(Math.cos(d.ang) * 1.4, 0, Math.sin(d.ang) * 1.4);
      var glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: d.color, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.setScalar(1.3);
      m.add(glow);
      ring.add(m);
    });
    group.add(ring);
    group.userData.crystalRing = ring;
  }

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

  // ================= PROP PLACEMENT (landmarks + scatter) =================

  function ringPlacements(assetKey, cx, cz, count, radius, opts) {
    opts = opts || {};
    var out = [];
    for (var i = 0; i < count; i++) {
      var ang = (i / count) * Math.PI * 2 + (opts.angOffset || 0);
      out.push({
        key: assetKey,
        x: cx + Math.cos(ang) * radius,
        z: cz + Math.sin(ang) * radius,
        ry: opts.faceOut ? ang + Math.PI / 2 : (opts.faceCenter ? ang + Math.PI * 1.5 : 0),
        scale: opts.scale || 1,
        scatter: true
      });
    }
    return out;
  }

  function scatterPlacements(rng, pool, cx, cz, minR, maxR, count, scaleRange, avoid) {
    var out = [];
    var tries = 0;
    while (out.length < count && tries < count * 6) {
      tries++;
      var ang = rng() * Math.PI * 2;
      var dist = minR + rng() * (maxR - minR);
      var x = cx + Math.cos(ang) * dist;
      var z = cz + Math.sin(ang) * dist;
      if (Math.sqrt(x * x + z * z) < PLAZA_CLEAR_RADIUS + 3) continue;
      var blocked = false;
      if (avoid) {
        for (var a = 0; a < avoid.length; a++) {
          var av = avoid[a];
          var dx = x - av.x, dz = z - av.z;
          if (Math.sqrt(dx * dx + dz * dz) < av.r) { blocked = true; break; }
        }
      }
      if (blocked) continue;
      var key = pool[Math.floor(rng() * pool.length)];
      out.push({
        key: key, x: x, z: z,
        ry: rng() * Math.PI * 2,
        scale: (scaleRange[0] + rng() * (scaleRange[1] - scaleRange[0])),
        scatter: true
      });
    }
    return out;
  }

  // Lays a walkable trail of path-tile props in a straight line between two points,
  // each tile rotated to face along the direction of travel, with a touch of
  // jitter so it doesn't look ruler-straight. Used to visually connect the
  // plaza to the zones (and, in the forest, all the way to the lab entrance).
  function pathLine(rng, pool, x1, z1, x2, z2, spacing, jitter) {
    var out = [];
    var dx = x2 - x1, dz = z2 - z1;
    var len = Math.sqrt(dx * dx + dz * dz);
    var steps = Math.max(1, Math.round(len / spacing));
    var ry = Math.atan2(dx, dz);
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      var px = x1 + dx * t + (rng() - 0.5) * (jitter || 0);
      var pz = z1 + dz * t + (rng() - 0.5) * (jitter || 0);
      if (Math.sqrt(px * px + pz * pz) < PLAZA_CLEAR_RADIUS + 2) continue;
      var key = pool[Math.floor(rng() * pool.length)];
      out.push({ key: key, x: px, z: pz, ry: ry, scale: 1, scatter: true });
    }
    return out;
  }

  var NO_COLLIDE_KEYWORDS = ['Flags', 'Balloon', 'Coin', 'Pretzel', 'Sausage', 'FlowerPot', 'Vase', 'Sign', 'Lamp', 'Cloud'];

  var cachedPlan = null;
  function buildPlacementPlan() {
    if (cachedPlan) return cachedPlan;
    var rng = makeRng(1337);
    var plan = [];

    // ---- Library plaza: crystal-crossroads ancient-library motif right at home base ----
    plan.push({ key: 'crystal-crossroads/Arc', x: 0, z: 9.5, ry: Math.PI, scale: 1.15 });
    plan.push({ key: 'crystal-crossroads/Column_Regular', x: -6, z: 7, ry: 0, scale: 1 });
    plan.push({ key: 'crystal-crossroads/Column_Regular', x: 6, z: 7, ry: 0, scale: 1 });
    plan.push({ key: 'crystal-crossroads/FlowerPot_Large_01', x: -3.2, z: 10.5, ry: 0, scale: 1 });
    plan.push({ key: 'crystal-crossroads/FlowerPot_Large_02', x: 3.2, z: 10.5, ry: 0, scale: 1 });
    plan.push({ key: 'crystal-crossroads/Crystal_Small_01', x: -10, z: -3, ry: 0.4, scale: 1 });
    plan.push({ key: 'crystal-crossroads/Crystal_Small_02', x: 10, z: -3, ry: -0.4, scale: 1 });

    // ---- FAIR zone (south) ----
    var fair = ZONES.fair;
    plan.push({ key: 'medieval-fair/Floor', x: fair.cx, z: fair.cz, ry: 0, scale: 1.3 });
    plan.push({ key: 'medieval-fair/Fair_Entry', x: fair.cx, z: fair.cz - 30, ry: Math.PI, scale: 1 });
    plan.push({ key: 'medieval-fair/CenterPlatform', x: fair.cx, z: fair.cz, ry: 0, scale: 1 });
    plan.push({ key: 'medieval-fair/Booth_Food01', x: fair.cx - 16, z: fair.cz - 6, ry: 0.5, scale: 1 });
    plan.push({ key: 'medieval-fair/Booth_Food02', x: fair.cx + 16, z: fair.cz - 6, ry: -0.5, scale: 1 });
    plan.push({ key: 'medieval-fair/Booth_Pretzelgame', x: fair.cx - 18, z: fair.cz + 12, ry: 0.8, scale: 1 });
    plan.push({ key: 'medieval-fair/Booth_Wearables', x: fair.cx + 18, z: fair.cz + 12, ry: -0.8, scale: 1 });
    plan.push({ key: 'medieval-fair/Cart', x: fair.cx - 9, z: fair.cz + 20, ry: 1.1, scale: 1 });
    plan.push({ key: 'medieval-fair/Cart', x: fair.cx + 11, z: fair.cz - 18, ry: -1.4, scale: 1 });
    plan.push({ key: 'medieval-fair/Table_Dessert', x: fair.cx - 6, z: fair.cz + 2, ry: 0.3, scale: 1 });
    plan.push({ key: 'medieval-fair/Table_Dinner', x: fair.cx + 7, z: fair.cz + 3, ry: -0.3, scale: 1 });
    plan.push({ key: 'medieval-fair/EntranceBoard', x: fair.cx - 3, z: fair.cz - 26, ry: Math.PI, scale: 1 });
    plan.push({ key: 'medieval-fair/Signbook', x: fair.cx + 3, z: fair.cz - 26, ry: Math.PI, scale: 1 });
    plan.push({ key: 'medieval-fair/SignPost', x: fair.cx, z: fair.cz - 22, ry: 0, scale: 1 });
    plan.push({ key: 'medieval-fair/Fair_Flags_Line', x: fair.cx, z: fair.cz - 14, ry: 0, scale: 1 });
    plan.push({ key: 'medieval-fair/Fair_Flags_Line', x: fair.cx, z: fair.cz + 20, ry: 0, scale: 1 });
    plan.push({ key: 'medieval-fair/Balloon_Interactible_Red', x: fair.cx - 12, z: fair.cz - 2, ry: 0, scale: 1 });
    plan.push({ key: 'medieval-fair/Balloon_Interactible_Yellow', x: fair.cx + 13, z: fair.cz + 1, ry: 0, scale: 1 });
    plan = plan.concat(ringPlacements('medieval-fair/Lamp', fair.cx, fair.cz, 8, 24, { faceCenter: true, scale: 1 }));
    plan = plan.concat(scatterPlacements(rng, ['medieval-fair/SmallBarrel_Art', 'medieval-fair/Barrel', 'medieval-fair/Coin_PolygonalMind', 'medieval-fair/Pretzel', 'medieval-fair/Sausage'],
      fair.cx, fair.cz, 6, 34, 34, [0.8, 1.15]));

    // ---- RUINS zone (east) -- ancient hall tied to the library's science lore ----
    var ruins = ZONES.ruins;
    plan.push({ key: 'crystal-crossroads/Floor_Tiles_Large', x: ruins.cx, z: ruins.cz, ry: 0, scale: 1.1 });
    plan.push({ key: 'crystal-crossroads/Crystal_Cluster', x: ruins.cx + 6, z: ruins.cz - 8, ry: 0, scale: 1 });
    plan.push({ key: 'crystal-crossroads/Crystal_ClusterSurrounded', x: ruins.cx - 10, z: ruins.cz + 10, ry: 0.6, scale: 0.9 });
    plan.push({ key: 'crystal-crossroads/Crystal_Small_03', x: ruins.cx + 14, z: ruins.cz + 6, ry: 0, scale: 1 });
    plan.push({ key: 'crystal-crossroads/Crystal_Small_04', x: ruins.cx - 4, z: ruins.cz - 16, ry: 0, scale: 1 });
    plan.push({ key: 'crystal-crossroads/Stairs', x: ruins.cx, z: ruins.cz + 16, ry: Math.PI, scale: 1 });
    plan.push({ key: 'crystal-crossroads/Platform_03', x: ruins.cx, z: ruins.cz - 2, ry: 0, scale: 1.4 });
    plan.push({ key: 'crystal-crossroads/Roof_01', x: ruins.cx - 6, z: ruins.cz + 2, ry: 0.2, scale: 1 });
    plan.push({ key: 'crystal-crossroads/Wall_Broken_01', x: ruins.cx - 16, z: ruins.cz - 4, ry: 1.57, scale: 1 });
    plan.push({ key: 'crystal-crossroads/Wall_CornerBroken', x: ruins.cx - 16, z: ruins.cz + 14, ry: 0, scale: 1.3 });
    plan.push({ key: 'crystal-crossroads/Wall_Small_01', x: ruins.cx + 16, z: ruins.cz - 12, ry: 1.57, scale: 1 });
    plan = plan.concat(ringPlacements('crystal-crossroads/Column_Regular', ruins.cx, ruins.cz, 6, 20, { scale: 1 }));
    plan = plan.concat(ringPlacements('crystal-crossroads/Column_SmallBroken_01', ruins.cx, ruins.cz, 5, 28, { angOffset: 0.5, scale: 1 }));
    plan = plan.concat(scatterPlacements(rng, ['crystal-crossroads/Vase_Large', 'crystal-crossroads/Vase_Mid', 'crystal-crossroads/Vase_Small', 'crystal-crossroads/FlowerPot_Small_01'],
      ruins.cx, ruins.cz, 8, 32, 24, [0.8, 1.1]));

    // ---- FOREST zone (north) -- ties to the Valley of Discovery / abandoned lab lore ----
    var forest = ZONES.forest;
    plan.push({ key: 'momuspark/Str_Fountain_01_Art', x: forest.cx, z: forest.cz, ry: 0, scale: 1.2 });
    plan.push({ key: 'momuspark/Str_Amphitheater_01_Art', x: forest.cx + 20, z: forest.cz - 10, ry: -0.6, scale: 1 });
    plan.push({ key: 'momuspark/Str_Column_04_Art', x: forest.cx - 14, z: forest.cz + 8, ry: 0, scale: 1 });
    plan.push({ key: 'momuspark/Str_Ruins_01_Art', x: forest.cx - 18, z: forest.cz - 6, ry: 0.3, scale: 1 });
    plan.push({ key: 'momuspark/Str_Ruins_02_Art', x: forest.cx - 22, z: forest.cz - 12, ry: 1.1, scale: 1 });
    plan.push({ key: 'momuspark/Str_Ruins_03_Art', x: forest.cx + 8, z: forest.cz + 18, ry: 0.8, scale: 1 });
    plan.push({ key: 'momuspark/Str_Ruins_05_Art', x: forest.cx + 14, z: forest.cz + 22, ry: -0.4, scale: 1 });
    plan.push({ key: 'momuspark/Statue_greek_01_Art', x: forest.cx - 4, z: forest.cz - 4, ry: 0, scale: 1 });
    plan.push({ key: 'momuspark/Statue_greek_02_Art', x: forest.cx + 4, z: forest.cz - 4, ry: 0, scale: 1 });
    plan.push({ key: 'momuspark/Shelter_Art', x: forest.cx - 26, z: forest.cz + 16, ry: 0.4, scale: 1 });
    plan.push({ key: 'momuspark/Bench_01_Art', x: forest.cx - 2, z: forest.cz + 6, ry: 0, scale: 1 });
    plan.push({ key: 'momuspark/Bench_01_Art', x: forest.cx + 2, z: forest.cz + 8, ry: 3.14, scale: 1 });
    plan.push({ key: 'momuspark/Water_Pond_01_Art', x: forest.cx + 24, z: forest.cz + 2, ry: 0, scale: 1 });
    plan.push({ key: 'momuspark/Fence_01_Art', x: forest.cx - 8, z: forest.cz - 18, ry: 0, scale: 1 });
    plan.push({ key: 'momuspark/Fence_01_Post_Art', x: forest.cx - 8, z: forest.cz - 18, ry: 0, scale: 1 });
    plan.push({ key: 'momuspark/Owl', x: forest.cx - 6, z: forest.cz - 2, ry: 0, scale: 1 });
    plan.push({ key: 'momuspark/PigArmature', x: forest.cx + 10, z: forest.cz - 8, ry: 1, scale: 1 });
    plan.push({ key: 'momuspark/Butterfly', x: forest.cx + 2, z: forest.cz + 2, ry: 0, scale: 1.4 });
    // dense woods -- lots of trees, rocks and undergrowth so the forest reads
    // as a real, walk-through-able wood rather than a scattering of props
    plan = plan.concat(scatterPlacements(rng, ['momuspark/Tree_01_Art', 'momuspark/Tree_02_Art', 'momuspark/Tree_04_Art'],
      forest.cx, forest.cz, 13, 44, 46, [0.6, 1.1], [{ x: forest.cx, z: forest.cz, r: 11 }]));
    plan = plan.concat(scatterPlacements(rng, ['momuspark/Tree_03_Art', 'momuspark/Tree_Trunk_01_Art', 'momuspark/Root_01_Art', 'momuspark/Root_02_Art'],
      forest.cx, forest.cz, 9, 44, 30, [0.7, 1.2]));
    plan = plan.concat(scatterPlacements(rng, ['momuspark/Rock_01_Art', 'momuspark/Rock_02_Art', 'momuspark/Rock_03_Art', 'momuspark/Rock_04_Art', 'momuspark/Rock_05_Art'],
      forest.cx, forest.cz, 6, 44, 34, [0.7, 1.25]));
    plan = plan.concat(scatterPlacements(rng, ['momuspark/Mushroom_01_Art', 'momuspark/Mushroom_02_Art'],
      forest.cx, forest.cz, 4, 40, 22, [0.8, 1.3]));
    plan = plan.concat(scatterPlacements(rng, ['momuspark/Flower_01_a', 'momuspark/Flower_01_b', 'momuspark/Flower_02_a_Art', 'momuspark/Flower_02_b_Art', 'momuspark/Flower_03_a', 'momuspark/Flower_03_b'],
      forest.cx, forest.cz, 4, 42, 38, [0.9, 1.3]));
    plan = plan.concat(scatterPlacements(rng, ['momuspark/Grass_01_a', 'momuspark/Grass_01_b'],
      forest.cx, forest.cz, 4, 42, 50, [1.0, 1.7]));

    // a real walking trail: plaza -> forest edge -> forest heart -> the lab entrance,
    // deep in the trees, so the path to the dungeon reads as a proper forest track
    plan = plan.concat(pathLine(rng, ['momuspark/Path_01_Art', 'momuspark/Path_02_Art'], 0, 15, forest.cx + 2, forest.cz + 34, 3.4, 1.6));
    plan = plan.concat(pathLine(rng, ['momuspark/Path_01_Art', 'momuspark/Path_02_Art', 'momuspark/Path_03_Art'], forest.cx + 2, forest.cz + 34, forest.cx, forest.cz, 3.4, 1.6));
    plan = plan.concat(pathLine(rng, ['momuspark/Path_02_Art', 'momuspark/Path_03_Art', 'momuspark/Path_04_Art'], forest.cx, forest.cz, forest.cx, forest.cz - 30, 3.4, 1.4));

    // slightly denser groundcover right along the trail so it feels like an
    // established route through the woods rather than a bare line
    plan = plan.concat(scatterPlacements(rng, ['momuspark/Grass_01_a', 'momuspark/Grass_01_b', 'momuspark/Flower_01_a'],
      forest.cx, forest.cz - 15, 2, 10, 14, [0.9, 1.3]));

    // ---- GARDEN zone (west) -- the Traveler's Gate ----
    var garden = ZONES.garden;
    plan.push({ key: 'avatar-garden/Portal01', x: garden.cx - 6, z: garden.cz, ry: Math.PI / 2, scale: 0.55 });
    plan.push({ key: 'avatar-garden/Mountain01', x: garden.cx - 26, z: garden.cz + 10, ry: 0, scale: 1 });
    plan.push({ key: 'avatar-garden/Mountain01', x: garden.cx - 20, z: garden.cz - 22, ry: 0.7, scale: 0.85 });
    plan = plan.concat(scatterPlacements(rng, ['avatar-garden/Flower01'], garden.cx, garden.cz, 4, 36, 48, [0.8, 1.3]));
    plan = plan.concat(scatterPlacements(rng, ['avatar-garden/Stone01'], garden.cx, garden.cz, 4, 36, 20, [0.7, 1.15]));
    plan = plan.concat(scatterPlacements(rng, ['avatar-garden/SmallGrass01'], garden.cx, garden.cz, 4, 36, 34, [0.9, 1.4]));
    plan = plan.concat(scatterPlacements(rng, ['avatar-garden/Bush04'], garden.cx, garden.cz, 6, 34, 20, [0.7, 1.1]));
    plan = plan.concat(pathLine(rng, ['avatar-garden/Stone01'], -16, 17, garden.cx + 14, garden.cz - 2, 4, 1.2));
    // clouds drifting overhead
    plan.push({ key: 'avatar-garden/Cloud01', x: garden.cx + 6, z: garden.cz - 8, y: 16, ry: 0.3, scale: 0.7 });
    plan.push({ key: 'avatar-garden/Cloud02', x: -20, z: -20, y: 19, ry: 1.2, scale: 0.8 });
    plan.push({ key: 'avatar-garden/Cloud01', x: 40, z: 30, y: 17, ry: 2.1, scale: 0.6 });

    // sort nearest-to-spawn first so props pop in where the player will look first
    var spawnX = window.WorldTerrain.SPAWN.x, spawnZ = window.WorldTerrain.SPAWN.z;
    plan.forEach(function (p) {
      var dx = p.x - spawnX, dz = p.z - spawnZ;
      p._dist = Math.sqrt(dx * dx + dz * dz);
    });
    plan.sort(function (a, b) { return a._dist - b._dist; });

    cachedPlan = plan;
    return plan;
  }

  // Solid-feeling landmark props (buildings, booths, columns, walls, statues...) get a simple
  // circular collider so the player and companions can't walk straight through them. Small
  // scattered decor (flowers, grass, mushrooms...) and thin/flat/hanging items stay walk-through.
  function getColliders() {
    var plan = buildPlacementPlan();
    var colliders = [{ x: 0, z: 0, r: 4.2 }]; // the library itself
    plan.forEach(function (p) {
      if (p.scatter) return;
      var meta = window.WORLD_ASSET_MANIFEST[p.key];
      if (!meta) return;
      var size = meta.size;
      if (size[1] < 0.5) return; // flat ground decals / floor tiles / paths
      var name = p.key.split('/')[1] || '';
      var skip = NO_COLLIDE_KEYWORDS.some(function (kw) { return name.indexOf(kw) >= 0; });
      if (skip) return;
      var footprint = Math.max(size[0], size[2]) * (p.scale || 1);
      var r = Math.min(6, Math.max(0.5, footprint * 0.32));
      colliders.push({ x: p.x, z: p.z, r: r });
    });
    return colliders;
  }
  window.WorldTerrain.getColliders = getColliders;

  // ================= ASYNC GLB STREAMING =================

  var gltfLoader = null;
  var templateCache = {}; // manifest key -> Promise<THREE.Object3D template>

  function getLoader() {
    if (!gltfLoader) gltfLoader = new THREE.GLTFLoader();
    return gltfLoader;
  }

  function loadTemplate(key) {
    if (templateCache[key]) return templateCache[key];
    var meta = window.WORLD_ASSET_MANIFEST[key];
    if (!meta) return Promise.reject(new Error('Unknown world asset: ' + key));
    templateCache[key] = new Promise(function (resolve, reject) {
      getLoader().load(meta.url, function (gltf) {
        gltf.scene.traverse(function (o) {
          if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; }
        });
        resolve(gltf.scene);
      }, undefined, function (err) { reject(err); });
    });
    return templateCache[key];
  }

  // simple concurrency-limited pool runner
  function runPool(items, worker, limit, onEach) {
    return new Promise(function (resolveAll) {
      var idx = 0, active = 0, done = 0;
      function next() {
        if (idx >= items.length) {
          if (active === 0) resolveAll();
          return;
        }
        var item = items[idx++];
        active++;
        worker(item).then(function (result) {
          active--; done++;
          if (onEach) onEach(result, done, items.length);
          next();
        }).catch(function () {
          active--; done++;
          if (onEach) onEach(null, done, items.length);
          next();
        });
      }
      for (var i = 0; i < limit; i++) next();
    });
  }

  function streamProps(propsGroup, onProgress) {
    var plan = buildPlacementPlan();
    runPool(plan, function (p) {
      var meta = window.WORLD_ASSET_MANIFEST[p.key];
      if (!meta) return Promise.resolve(null);
      return loadTemplate(p.key).then(function (template) {
        var inst = template.clone(true);
        var scale = p.scale || 1;
        inst.scale.setScalar(scale);
        var groundY = (p.y || 0) - meta.minY * scale;
        inst.position.set(p.x, groundY, p.z);
        inst.rotation.y = p.ry || 0;
        propsGroup.add(inst);
        return inst;
      });
    }, 14, function (result, done, total) {
      if (onProgress) onProgress(done, total);
    });
  }
})();
