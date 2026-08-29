// ===================================================================
// world.js -- asset loading, scene construction, village lane builder
// ===================================================================

// ---------------- Asset Library ----------------
const AssetLibrary = {
  cache: {},
  loader: null,
  textureLoader: null,

  init() {
    this.loader = new THREE.GLTFLoader();
    this.textureLoader = new THREE.TextureLoader();
  },

  // list of [pack, name] pairs to preload
  ALL_MODELS: (() => {
    const m = {
      blockbits: ['grass','dirt_with_grass','stone','sand_A','water','tree','wood',
        'colored_block_blue','colored_block_green','colored_block_red','colored_block_yellow',
        'striped_block_yellow','metal','glass'],
      forest: ['Tree_1_C_Color1','Tree_2_D_Color1','Bush_1_E_Color1','Bush_3_B_Color1',
        'Rock_1_J_Color1','Rock_2_E_Color1','Grass_1_C_Color1'],
      hexagon: ['hex_grass','hex_grass_sloped_high','hex_water',
        'building_home_A_yellow','building_well_yellow','building_market_yellow',
        'building_home_A_green','building_church_green','building_tower_A_green',
        'building_castle_blue','fence_wood_straight','wall_straight',
        'hills_A','tree_single_A','rock_single_B',
        'flag_blue','flag_green','flag_red','flag_yellow','crate_A_big','barrel'],
      furnitures: ['armchair','bed_single_A','cabinet_medium','chair_A','couch',
        'lamp_standing','rug_oval_A','table_medium'],
      restaurant: ['chair_A','table_round_A_decorated','crate_buns','crate_carrots','crate_tomatoes',
        'food_burger','oven','fridge_A','kitchencounter_straight_A','wall_doorway','wall','door_A','plate'],
      dungeon: ['wall','wall_doorway','floor_tile_large','floor_dirt_large','stairs_wide','stairs_long',
        'pillar_decorated','torch_lit','torch_mounted','chest_gold','chest','coin','coin_stack_medium',
        'banner_red','banner_blue','barrel_large','key','candle_lit','column'],
      resources: ['Gold_Bar','Gold_Bars_Stack_Medium','Gold_Nuggets','Silver_Bar','Silver_Bars_Stack_Medium',
        'Copper_Bar','Copper_Bars_Stack_Medium','Iron_Bar','Stone_Chunks_Small','Stone_Bricks_Stack_Medium',
        'Wood_Log_A','Wood_Plank_A','Wood_Planks_Stack_Medium','Parts_Cog','Textiles_A']
    };
    const out = [];
    for (const pack in m) for (const name of m[pack]) out.push([pack, name]);
    return out;
  })(),

  key(pack, name) { return pack + '/' + name; },

  async preloadAll(onProgress) {
    const total = this.ALL_MODELS.length;
    let done = 0;
    const promises = this.ALL_MODELS.map(([pack, name]) => {
      return new Promise((resolve) => {
        this.loader.load(MODEL(pack, name), (gltf) => {
          this.cache[this.key(pack, name)] = gltf.scene;
          done++; if (onProgress) onProgress(done, total);
          resolve();
        }, undefined, (err) => {
          console.warn('Failed to load', pack, name, err);
          done++; if (onProgress) onProgress(done, total);
          resolve();
        });
      });
    });
    await Promise.all(promises);
  },

  get(pack, name) {
    const src = this.cache[this.key(pack, name)];
    if (!src) return new THREE.Group();
    const clone = src.clone(true);
    clone.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    return clone;
  },

  // scales+repositions a cloned model so its bounding box exactly fills
  // a box of size (w,h,d) sitting with its BOTTOM centered at local origin
  fitToBox(obj, w, h, d) {
    let box = new THREE.Box3().setFromObject(obj);
    let size = box.getSize(new THREE.Vector3());
    const sx = w / Math.max(size.x, 1e-4);
    const sy = h / Math.max(size.y, 1e-4);
    const sz = d / Math.max(size.z, 1e-4);
    obj.scale.set(sx, sy, sz);
    box = new THREE.Box3().setFromObject(obj);
    const min = box.min, center = box.getCenter(new THREE.Vector3());
    obj.position.x -= center.x;
    obj.position.z -= center.z;
    obj.position.y -= min.y;
    return obj;
  },

  // uniform-scales+centers a cloned model to a target max dimension, sitting on y=0
  fitUniform(obj, targetSize) {
    let box = new THREE.Box3().setFromObject(obj);
    let size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 1e-4);
    const s = targetSize / maxDim;
    obj.scale.set(s, s, s);
    box = new THREE.Box3().setFromObject(obj);
    const min = box.min, center = box.getCenter(new THREE.Vector3());
    obj.position.x -= center.x;
    obj.position.z -= center.z;
    obj.position.y -= min.y;
    return obj;
  },

  // tiles a floor/block model across a (w x d) footprint instead of stretching
  // one instance -- avoids grotesque distortion on small tile-shaped meshes.
  // Hexagon-pack floors get true offset hex-grid packing (see tileHexFloor)
  // instead of plain square packing, since squashing a hexagon into a square
  // cell leaves visible triangular gaps ("holes") at every tile edge.
  tileFloor(scene, pack, name, cx, centerY, cz, w, d, h, maxTile) {
    if (pack === 'hexagon') {
      return this.tileHexFloor(scene, pack, name, cx, centerY, cz, w, d, h, maxTile);
    }
    maxTile = maxTile || 2.4;
    const cols = Math.max(1, Math.round(w / maxTile));
    const rows = Math.max(1, Math.round(d / maxTile));
    const tw = w / cols, td = d / rows;
    const group = new THREE.Group();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tile = this.get(pack, name);
        this.fitToBox(tile, tw * 1.04, h, td * 1.04); // tiny overlap hides seams
        const tx = cx - w/2 + tw * (c + 0.5);
        const tz = cz - d/2 + td * (r + 0.5);
        tile.position.set(tx, centerY - h/2, tz);
        group.add(tile);
      }
    }
    scene.add(group);
    return group;
  },

  // Proper offset hex-grid packing: keeps each hex tile's true (uniform,
  // undistorted) proportions via fitUniform, then lays them out in the
  // standard "brick-offset" pattern hexagons need to interlock without gaps
  // -- rows compacted to 0.75x tile depth, alternating rows shifted half a
  // tile width, with a slight overlap fudge to hide any seam.
  tileHexFloor(scene, pack, name, cx, centerY, cz, w, d, h, tileSize) {
    tileSize = tileSize || 2.8;

    // measure one fitted+rotated tile to learn its true on-ground footprint
    const probe = this.get(pack, name);
    this.fitUniform(probe, tileSize);
    probe.rotation.y = Math.PI / 2; // align flat edges to our row/col axes
    const pbox = new THREE.Box3().setFromObject(probe);
    const psize = pbox.getSize(new THREE.Vector3());
    const colSpacing = psize.x * 0.9;        // overlap hides the seams between hexes
    const rowSpacing = psize.z * 0.75 * 0.94;

    const cols = Math.max(1, Math.round(w / colSpacing));
    const rows = Math.max(1, Math.round(d / rowSpacing));
    const totalW = cols * colSpacing + colSpacing * 0.5;
    const totalD = rows * rowSpacing + rowSpacing * 0.35;

    const group = new THREE.Group();
    for (let r = 0; r < rows; r++) {
      const rowOffset = (r % 2) ? colSpacing / 2 : 0;
      for (let c = 0; c < cols; c++) {
        const tile = this.get(pack, name);
        this.fitUniform(tile, tileSize);
        tile.rotation.y = Math.PI / 2;
        const tx = cx - totalW / 2 + rowOffset + colSpacing * (c + 0.5);
        const tz = cz - totalD / 2 + rowSpacing * (r + 0.5);
        tile.position.set(tx, centerY - h / 2, tz);
        group.add(tile);
      }
    }
    scene.add(group);
    return group;
  }
};

// ---------------- Per-theme asset palette ----------------
const THEME_ASSETS = {
  hexagon: {
    floor: ['hexagon','hex_grass'], floorAlt: ['hexagon','hex_grass_sloped_high'],
    block: ['blockbits','colored_block_yellow'],
    buildings: [['hexagon','building_home_A_yellow'],['hexagon','building_well_yellow'],['hexagon','building_market_yellow']],
    props: [['hexagon','tree_single_A'],['hexagon','rock_single_B'],['hexagon','flag_yellow'],['hexagon','crate_A_big'],['hexagon','barrel']],
    accentFlag: ['hexagon','flag_yellow']
  },
  hexagon2: {
    floor: ['hexagon','hex_grass'], floorAlt: ['hexagon','hex_grass_sloped_high'],
    block: ['blockbits','colored_block_green'],
    buildings: [['hexagon','building_home_A_green'],['hexagon','building_church_green'],['hexagon','building_tower_A_green']],
    props: [['hexagon','tree_single_A'],['hexagon','rock_single_B'],['hexagon','flag_green'],['hexagon','crate_A_big'],['hexagon','barrel']],
    accentFlag: ['hexagon','flag_green']
  },
  forest: {
    floor: ['blockbits','dirt_with_grass'], floorAlt: ['blockbits','grass'],
    block: ['blockbits','wood'],
    buildings: [],
    props: [['forest','Tree_1_C_Color1'],['forest','Tree_2_D_Color1'],['forest','Bush_1_E_Color1'],['forest','Bush_3_B_Color1'],
             ['forest','Rock_1_J_Color1'],['forest','Rock_2_E_Color1'],['resources','Wood_Log_A']],
    accentFlag: ['hexagon','flag_green']
  },
  restaurant: {
    floor: ['blockbits','wood'], floorAlt: ['blockbits','stone'],
    block: ['blockbits','colored_block_red'],
    buildings: [['restaurant','wall_doorway']],
    props: [['restaurant','crate_buns'],['restaurant','crate_carrots'],['restaurant','crate_tomatoes'],
             ['restaurant','oven'],['restaurant','fridge_A'],['restaurant','table_round_A_decorated'],
             ['restaurant','chair_A'],['restaurant','food_burger']],
    accentFlag: ['hexagon','flag_red']
  },
  dungeon: {
    floor: ['dungeon','floor_tile_large'], floorAlt: ['dungeon','floor_dirt_large'],
    block: ['dungeon','floor_tile_large'],
    // plain flat "wall" segments loom like a giant blocking slab when scattered
    // as standalone radial "buildings" -- use the doorway (reads as an
    // entrance) and tall pillars/columns instead, which look right freestanding
    buildings: [['dungeon','wall_doorway'],['dungeon','column'],['dungeon','pillar_decorated']],
    props: [['dungeon','torch_mounted'],['dungeon','pillar_decorated'],['dungeon','chest_gold'],['dungeon','chest'],
             ['dungeon','coin_stack_medium'],['dungeon','barrel_large'],['dungeon','column'],['dungeon','banner_red'],
             ['resources','Gold_Bars_Stack_Medium'],['resources','Silver_Bars_Stack_Medium'],['resources','Copper_Bars_Stack_Medium'],
             ['resources','Stone_Chunks_Small']],
    accentFlag: ['dungeon','banner_red']
  },
  castle: {
    floor: ['dungeon','floor_tile_large'], floorAlt: ['dungeon','floor_tile_large'],
    block: ['dungeon','floor_tile_large'],
    buildings: [['dungeon','wall_doorway'],['hexagon','building_castle_blue'],['dungeon','column']],
    props: [['dungeon','pillar_decorated'],['dungeon','torch_lit'],['dungeon','banner_blue'],['dungeon','banner_red'],
             ['dungeon','chest_gold'],['resources','Gold_Bars_Stack_Medium'],['dungeon','column']],
    accentFlag: ['dungeon','banner_blue']
  }
};

function rngFor(seedStr) {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  return function() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// Platform helper object (kept simple, plain data + getTop)
function makePlatform(x, y, z, w, h, d) {
  return { x, y, z, w, h, d, getTop() { return this.y + this.h/2; } };
}

// ---------------- Open-world village builder (Emberfall-style) ----------------
// Builds an open walkable plaza (free-roam, no gates) where the chief can be
// found and approached, ringed with buildings/props, plus an OPTIONAL connected
// obby/platforming lane leading off the north edge for players who want extra
// challenge. Returns:
//   { platforms, plazaPlat, spawnPos, chiefPos, obbyEntrancePos,
//     obbyPlatforms, checkpoints, movingPlatform, endPodiumPos, palette }
function buildVillageWorld(scene, theme, seedKey, obbyLength) {
  const palette = THEME_ASSETS[theme] || THEME_ASSETS.hexagon;
  const rng = rngFor(seedKey);
  const decorGroup = new THREE.Group();
  scene.add(decorGroup);

  // ---------------- PLAZA ----------------
  const plazaSize = 24;
  const plazaX = 0, plazaZ = 0;
  AssetLibrary.tileFloor(scene, palette.floor[0], palette.floor[1], plazaX, 0, plazaZ, plazaSize, plazaSize, 0.6);
  const plazaPlat = makePlatform(plazaX, 0, plazaZ, plazaSize, 0.6, plazaSize);

  const spawnPos = new THREE.Vector3(plazaX, 2, plazaZ + plazaSize * 0.36);
  const chiefPos = new THREE.Vector3(plazaX, 0, plazaZ - plazaSize * 0.16);

  // buildings scattered around the plaza perimeter, facing inward
  if (palette.buildings.length) {
    const buildingCount = 5;
    for (let i = 0; i < buildingCount; i++) {
      const angle = (i / buildingCount) * Math.PI * 2 + rng() * 0.35;
      const radius = plazaSize * 0.47;
      const bx = plazaX + Math.sin(angle) * radius;
      const bz = plazaZ + Math.cos(angle) * radius;
      const bk = palette.buildings[Math.floor(rng() * palette.buildings.length)];
      const b = AssetLibrary.get(bk[0], bk[1]);
      AssetLibrary.fitUniform(b, 5 + rng() * 2.4);
      b.position.set(bx, 0, bz);
      b.rotation.y = angle + Math.PI + (rng() - 0.5) * 0.4;
      decorGroup.add(b);
    }
  }

  // props scattered randomly across the plaza, keeping clear zones open
  if (palette.props.length) {
    for (let i = 0; i < 14; i++) {
      const ang = rng() * Math.PI * 2;
      const rad = plazaSize * 0.12 + rng() * plazaSize * 0.32;
      const px = plazaX + Math.sin(ang) * rad;
      const pz = plazaZ + Math.cos(ang) * rad;
      if (Math.hypot(px - chiefPos.x, pz - chiefPos.z) < 2.8) continue;
      if (Math.hypot(px - spawnPos.x, pz - spawnPos.z) < 2.4) continue;
      const pk = palette.props[Math.floor(rng() * palette.props.length)];
      const deco = AssetLibrary.get(pk[0], pk[1]);
      AssetLibrary.fitUniform(deco, 1.0 + rng() * 0.9);
      deco.position.set(px, 0, pz);
      deco.rotation.y = rng() * Math.PI * 2;
      decorGroup.add(deco);
    }
  }

  // accent flags marking the (optional) obby entrance on the plaza's far edge
  const obbyEntranceZ = plazaZ - plazaSize / 2;
  const flagKey = palette.accentFlag;
  for (const side of [-1, 1]) {
    const flag = AssetLibrary.get(flagKey[0], flagKey[1]);
    AssetLibrary.fitUniform(flag, 2.6);
    flag.position.set(side * 2.3, 0, obbyEntranceZ);
    decorGroup.add(flag);
  }
  const obbyEntrancePos = new THREE.Vector3(0, 0.6, obbyEntranceZ);

  // ---------------- OPTIONAL OBBY ----------------
  // Continues from the plaza's north edge; same drift/gap/checkpoint/moving-
  // platform feel as before, but it is purely a bonus side-challenge now --
  // nothing here gates progress or is required for the chief's badge.
  const obbyPlatforms = [];
  const checkpoints = [];
  let z = obbyEntranceZ - 2.4;
  let x = 0;
  const y = 0;
  let movingPlatform = null;
  let prevD = 2.2;

  for (let i = 0; i < obbyLength; i++) {
    const isRest = (i % 5 === 0);
    const w = isRest ? 4.6 : (2.2 + rng() * 0.8);
    const d = isRest ? 3.4 : (2.2 + rng() * 0.6);
    if (i > 0) {
      const drift = isRest ? 0 : (rng() - 0.5) * 3.6;
      x = THREE.MathUtils.clamp(x + drift, -5.5, 5.5);
      const gap = isRest ? 0.6 : (1.0 + rng() * 1.1);
      z -= (d / 2 + gap + prevD / 2);
    }
    prevD = d;
    const plat = makePlatform(x, y, z, w, 0.6, d);
    obbyPlatforms.push(plat);

    const modelKey = isRest && palette.floorAlt ? palette.floorAlt : palette.floor;
    const visual = AssetLibrary.tileFloor(scene, modelKey[0], modelKey[1], x, y, z, w, d, plat.h);

    if (i % 5 === 0) checkpoints.push({ x, y: y + 1.4, z, index: checkpoints.length });

    if (palette.props.length && rng() < 0.5 && !isRest) {
      const side = rng() < 0.5 ? -1 : 1;
      const pk = palette.props[Math.floor(rng() * palette.props.length)];
      const deco = AssetLibrary.get(pk[0], pk[1]);
      AssetLibrary.fitUniform(deco, 1.1 + rng() * 0.9);
      deco.position.set(x + side * (w / 2 + 1.1 + rng() * 0.8), y, z + (rng() - 0.5) * 1.2);
      deco.rotation.y = rng() * Math.PI * 2;
      decorGroup.add(deco);
    }

    if (i === Math.floor(obbyLength * 0.55) && !movingPlatform) {
      movingPlatform = { plat, baseX: x, range: 3.2, speed: 0.9, visual };
    }
  }

  const last = obbyPlatforms[obbyPlatforms.length - 1] || plazaPlat;
  const endPodiumPos = { x: last.x, y: last.y + 0.3, z: last.z };

  const platforms = [plazaPlat, ...obbyPlatforms];

  return {
    platforms, plazaPlat, spawnPos, chiefPos, obbyEntrancePos,
    obbyPlatforms, checkpoints, movingPlatform, endPodiumPos, palette
  };
}

// ---------------- Sky / lighting ----------------
function applyVillageSky(scene, renderer, topColor, bottomColor) {
  const top = new THREE.Color(topColor), bottom = new THREE.Color(bottomColor);
  scene.background = top;
  scene.fog = new THREE.Fog(bottom.getHex(), 24, 68);

  const hemi = new THREE.HemisphereLight(top.getHex(), bottom.getHex(), 1.1);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(8, 14, 6);
  scene.add(dir);
  scene.userData.lights = [hemi, dir];
  return { hemi, dir };
}
