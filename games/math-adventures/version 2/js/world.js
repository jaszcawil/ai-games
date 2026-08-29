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

  // KayKit "Adventurers" character models, used for the village chiefs & the
  // Math Master -- keyed by model name (see CHIEFS[key].characterModel).
  CHARACTER_NAMES: ['Ranger', 'Barbarian', 'Rogue', 'Rogue_Hooded', 'Mage'],
  characterCache: {},

  key(pack, name) { return pack + '/' + name; },

  async preloadAll(onProgress) {
    const total = this.ALL_MODELS.length + this.CHARACTER_NAMES.length;
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
    const charPromises = this.CHARACTER_NAMES.map((name) => {
      return new Promise((resolve) => {
        this.loader.load(CHARACTER_MODEL(name), (gltf) => {
          this.characterCache[name] = gltf.scene;
          done++; if (onProgress) onProgress(done, total);
          resolve();
        }, undefined, (err) => {
          console.warn('Failed to load character', name, err);
          done++; if (onProgress) onProgress(done, total);
          resolve();
        });
      });
    });
    await Promise.all([...promises, ...charPromises]);
  },

  get(pack, name) {
    const src = this.cache[this.key(pack, name)];
    if (!src) return new THREE.Group();
    const clone = src.clone(true);
    clone.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    return clone;
  },

  // a standing 3D character (chief / Math Master), fitted to a target height.
  // tintHex (e.g. '#ffd166') recolors the model -- lets two chiefs share the
  // same base character (e.g. Tiffany & Nayah both use Mage) while still
  // looking distinct. Materials are cloned per-instance so the tint never
  // leaks onto other clones of the same cached model.
  getCharacter(modelName, targetHeight, tintHex) {
    const src = this.characterCache[modelName];
    if (!src) return new THREE.Group();
    const clone = src.clone(true);
    const tint = tintHex ? new THREE.Color(tintHex) : null;
    clone.traverse(o => {
      if (o.isMesh) {
        o.castShadow = false; o.receiveShadow = false;
        if (tint && o.material) {
          o.material = o.material.clone();
          // multiply-tint against the texture rather than replacing it, so
          // KayKit's painted details stay visible under the color
          if (o.material.color) o.material.color.lerp(tint, 0.55);
        }
      }
    });
    this.fitUniform(clone, targetHeight || 2.3);
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
  // maxTiles caps the total instance count for any one floor patch, auto-
  // growing the tile size if needed -- keeps memory/instance-count bounded
  // now that a whole persistent adventure world (hub + 6 chains + roads) is
  // built at once instead of one small scene at a time.
  tileFloor(scene, pack, name, cx, centerY, cz, w, d, h, maxTile, maxTiles) {
    if (pack === 'hexagon') {
      return this.tileHexFloor(scene, pack, name, cx, centerY, cz, w, d, h, maxTile, maxTiles);
    }
    maxTile = maxTile || 2.4;
    maxTiles = maxTiles || 90;
    let cols = Math.max(1, Math.round(w / maxTile));
    let rows = Math.max(1, Math.round(d / maxTile));
    if (cols * rows > maxTiles) {
      maxTile *= Math.sqrt((cols * rows) / maxTiles);
      cols = Math.max(1, Math.round(w / maxTile));
      rows = Math.max(1, Math.round(d / maxTile));
    }
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
  tileHexFloor(scene, pack, name, cx, centerY, cz, w, d, h, tileSize, maxTiles) {
    tileSize = tileSize || 2.8;
    maxTiles = maxTiles || 90;

    const probeAt = (size) => {
      const probe = this.get(pack, name);
      this.fitUniform(probe, size);
      probe.rotation.y = Math.PI / 2; // align flat edges to our row/col axes
      return new THREE.Box3().setFromObject(probe).getSize(new THREE.Vector3());
    };

    let psize = probeAt(tileSize);
    let colSpacing = psize.x * 0.9;        // overlap hides the seams between hexes
    let rowSpacing = psize.z * 0.75 * 0.94;
    let cols = Math.max(1, Math.round(w / colSpacing));
    let rows = Math.max(1, Math.round(d / rowSpacing));

    if (cols * rows > maxTiles) {
      tileSize *= Math.sqrt((cols * rows) / maxTiles);
      psize = probeAt(tileSize);
      colSpacing = psize.x * 0.9;
      rowSpacing = psize.z * 0.75 * 0.94;
      cols = Math.max(1, Math.round(w / colSpacing));
      rows = Math.max(1, Math.round(d / rowSpacing));
    }

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

// ---------------- Adventure world (one continuous, persistent world) ----------------
// The whole game is ONE THREE.Scene: a central hub (home base, with an
// achievement board) with six roads radiating out to the 5 villages + the
// Math Master's castle. Nothing here ever teleports the player -- every
// place is reached by physically walking a connecting road, per the
// "adventure, not a series of teleports" design.
//
// Each village is a straight CHAIN of 5 required stages alternating obby
// (platform-jump) and puzzle (drag/tap) content. Reaching a stage's end
// always requires one math question before the next stage opens -- the
// chain only lets the player advance as far as the first not-yet-cleared
// stage's gate (an invisible clamp), same idea as the classic "gate" but
// generalized to work at any angle since chains radiate out from the hub.

const STAGE_PATTERN = ['obby', 'puzzle', 'obby', 'puzzle', 'obby'];
const HUB_RADIUS = 15;          // walkable hub plaza radius
const SPOKE_GAP = 13;           // distance from hub center where roads begin
const SPOKE_ROAD_LEN = 16;      // road length from hub edge to village entry

// world-space forward/right unit vectors for a chain running at angle `ang`
function chainAxes(ang) {
  return {
    forward: new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang)),
    right: new THREE.Vector3(Math.cos(ang), 0, -Math.sin(ang))
  };
}

// ---------------- Achievement board (lives in the hub) ----------------
// A small row of pedestals showing every chief + the Math Master; each
// lights up with a star once its badge is earned. refresh() can be called
// any time (e.g. right after a badge is won) to update the stars live,
// since this is the SAME persistent scene for the whole session.
function buildAchievementBoard(scene, boardCenter) {
  const entries = [];
  const ids = [...VILLAGES.map(v => v.id), 'mathlord'];
  const n = ids.length;
  const spread = 11;
  ids.forEach((id, i) => {
    const chiefKey = id === 'mathlord' ? 'jasz' : VILLAGES.find(v => v.id === id).chief;
    const x = boardCenter.x + (i - (n - 1) / 2) * (spread / (n - 1));
    const z = boardCenter.z;

    const pedestal = AssetLibrary.get('dungeon', 'column');
    AssetLibrary.fitUniform(pedestal, 1.4);
    pedestal.position.set(x, 0, z);
    scene.add(pedestal);

    const faceTex = new THREE.CanvasTexture(getChiefCanvas(chiefKey));
    const faceSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: faceTex, transparent: true }));
    faceSprite.scale.set(1.5, 1.5, 1);
    faceSprite.position.set(x, 2.1, z);
    scene.add(faceSprite);

    const starMat = new THREE.SpriteMaterial({ map: makeEmojiTextureShared('⭐'), transparent: true });
    const starSprite = new THREE.Sprite(starMat);
    starSprite.scale.set(1.0, 1.0, 1);
    starSprite.position.set(x, 3.0, z);
    starSprite.visible = false;
    scene.add(starSprite);

    entries.push({ id, starSprite });
  });

  return {
    entries,
    refresh() {
      entries.forEach(e => {
        const earned = e.id === 'mathlord'
          ? !!SaveSystem.current.completed
          : !!SaveSystem.current.badges[e.id];
        e.starSprite.visible = earned;
      });
    }
  };
}

let _emojiTexCache = {};
function makeEmojiTextureShared(emoji) {
  if (_emojiTexCache[emoji]) return _emojiTexCache[emoji];
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.font = '96px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 64, 72);
  const tex = new THREE.CanvasTexture(c);
  _emojiTexCache[emoji] = tex;
  return tex;
}

// ---------------- Spoke road (hub <-> village entry) ----------------
function buildSpokeRoad(scene, theme, ang, seedKey) {
  const palette = THEME_ASSETS[theme] || THEME_ASSETS.hexagon;
  const rng = rngFor(seedKey + '-road');
  const { forward, right } = chainAxes(ang);
  const decorGroup = new THREE.Group();
  scene.add(decorGroup);

  const roadWidth = 5;
  const midAdvance = SPOKE_GAP + SPOKE_ROAD_LEN / 2;
  const cx = forward.x * midAdvance, cz = forward.z * midAdvance;

  // Build the strip in LOCAL space (as if this spoke pointed along +Z, i.e.
  // ang=0), then rotate the whole tile group around the world origin by
  // `ang` -- the road's own pivot IS the hub center, so this rigidly rotates
  // it to line up with the chain's actual direction. (Using cx/cz directly
  // here would only be correct for a spoke that happens to point along +Z --
  // any other angle would tile an axis-aligned patch that doesn't follow the
  // road at all.)
  const roadGroup = AssetLibrary.tileFloor(scene, palette.floor[0], palette.floor[1], 0, 0, midAdvance, roadWidth, SPOKE_ROAD_LEN + 4, 0.6, undefined, 60);
  roadGroup.rotation.y = ang;

  // Collision can't be one rotated rectangle (our AABBs don't rotate), so
  // cover the corridor with a short chain of square platforms instead --
  // squares are rotation-agnostic, so this works at any spoke angle without
  // leaving gaps or drifting off the visual road.
  const platforms = [];
  const segCount = 4;
  const segLen = SPOKE_ROAD_LEN / segCount;
  for (let i = 0; i <= segCount; i++) {
    const adv = SPOKE_GAP + i * segLen;
    const px = forward.x * adv, pz = forward.z * adv;
    platforms.push(makePlatform(px, 0, pz, roadWidth + segLen * 1.3, 0.6, roadWidth + segLen * 1.3));
  }

  // a few light decorations flanking the road
  if (palette.props.length) {
    for (let i = 0; i < 4; i++) {
      const adv = SPOKE_GAP + 2 + i * (SPOKE_ROAD_LEN / 4);
      const side = i % 2 === 0 ? -1 : 1;
      const pk = palette.props[Math.floor(rng() * palette.props.length)];
      const deco = AssetLibrary.get(pk[0], pk[1]);
      AssetLibrary.fitUniform(deco, 1.0 + rng() * 0.7);
      const px = forward.x * adv + right.x * side * (roadWidth / 2 + 1.4);
      const pz = forward.z * adv + right.z * side * (roadWidth / 2 + 1.4);
      deco.position.set(px, 0, pz);
      deco.rotation.y = rng() * Math.PI * 2;
      decorGroup.add(deco);
    }
  }

  return { platforms };
}

// a simple barrier prop marking a locked road entrance; toggled visible/
// invisible live as SaveSystem.current.unlocked changes
function buildLockGate(scene, ang) {
  const { forward } = chainAxes(ang);
  const adv = SPOKE_GAP + 1.2;
  const gate = AssetLibrary.get('hexagon', 'wall_straight');
  AssetLibrary.fitToBox(gate, 5, 2.6, 0.6);
  gate.position.set(forward.x * adv, 0, forward.z * adv);
  gate.rotation.y = ang;
  scene.add(gate);
  return gate;
}

// ---------------- Village chain: 5 required obby/puzzle stages ----------------
// Returns a descriptor with everything main.js needs to drive the chain:
//   platforms, entrySprite/finalSprite (the chief's 3D character),
//   entryPos/finalPos, stages: [{type, gateAdvance, markerPos, done}],
//   forward/right/entryOrigin (for projecting the player's position),
//   introGiven (one-shot flag for the entry dialogue)
function buildVillageChain(scene, def, isFinale, ang, alreadyDone) {
  const palette = THEME_ASSETS[def.theme] || THEME_ASSETS.hexagon;
  const rng = rngFor(def.id + '-chain');
  const { forward, right } = chainAxes(ang);
  const origin = new THREE.Vector3(forward.x * SPOKE_GAP, 0, forward.z * SPOKE_GAP)
    .add(new THREE.Vector3(forward.x * SPOKE_ROAD_LEN, 0, forward.z * SPOKE_ROAD_LEN));
  // origin = point where the chain begins (far end of its spoke road)

  const decorGroup = new THREE.Group();
  scene.add(decorGroup);
  const platforms = [];

  function worldAt(adv, lat, y) {
    return new THREE.Vector3(
      origin.x + forward.x * adv + right.x * lat,
      y || 0,
      origin.z + forward.z * adv + right.z * lat
    );
  }

  let cursor = 0;

  // ENTRY PAD
  const entryPadSize = 9;
  cursor += entryPadSize / 2;
  const entryCenter = worldAt(cursor, 0);
  AssetLibrary.tileFloor(scene, palette.floor[0], palette.floor[1], entryCenter.x, 0, entryCenter.z, entryPadSize, entryPadSize, 0.6, undefined, 40);
  platforms.push(makePlatform(entryCenter.x, 0, entryCenter.z, entryPadSize, 0.6, entryPadSize));
  const entryAdvance = cursor;
  cursor += entryPadSize / 2;

  // 5 STAGES
  const stages = [];
  STAGE_PATTERN.forEach((type) => {
    if (type === 'obby') {
      const steps = 4;
      let lat = 0, prevD = 2.4;
      const stagePlatforms = [];
      for (let i = 0; i < steps; i++) {
        const w = 2.3 + rng() * 0.7, d = 2.3 + rng() * 0.5;
        if (i === 0) {
          cursor += d / 2 + 1.6;
        } else {
          const drift = (rng() - 0.5) * 3.0;
          lat = THREE.MathUtils.clamp(lat + drift, -4, 4);
          const gap = 1.0 + rng() * 1.0;
          cursor += d / 2 + gap + prevD / 2;
        }
        prevD = d;
        const p = worldAt(cursor, lat);
        const plat = makePlatform(p.x, 0, p.z, w, 0.6, d);
        platforms.push(plat); stagePlatforms.push(plat);
        AssetLibrary.tileFloor(scene, palette.floor[0], palette.floor[1], p.x, 0, p.z, w, d, 0.6, undefined, 12);
        if (palette.props.length && rng() < 0.4) {
          const pk = palette.props[Math.floor(rng() * palette.props.length)];
          const deco = AssetLibrary.get(pk[0], pk[1]);
          AssetLibrary.fitUniform(deco, 1.0 + rng() * 0.7);
          const side = rng() < 0.5 ? -1 : 1;
          const dp = worldAt(cursor, lat + side * (w / 2 + 1.2));
          deco.position.set(dp.x, 0, dp.z);
          deco.rotation.y = rng() * Math.PI * 2;
          decorGroup.add(deco);
        }
      }
      const last = stagePlatforms[stagePlatforms.length - 1];
      stages.push({ type: 'obby', gateAdvance: cursor, markerPos: new THREE.Vector3(last.x, last.y + 0.3, last.z) });
    } else {
      const padSize = 7;
      cursor += padSize / 2 + 1.6;
      const c = worldAt(cursor, 0);
      const plat = makePlatform(c.x, 0, c.z, padSize, 0.6, padSize);
      platforms.push(plat);
      AssetLibrary.tileFloor(scene, palette.floor[0], palette.floor[1], c.x, 0, c.z, padSize, padSize, 0.6, undefined, 20);
      const marker = AssetLibrary.get(palette.accentFlag[0], palette.accentFlag[1]);
      AssetLibrary.fitUniform(marker, 2.3);
      marker.position.set(c.x, 0, c.z);
      decorGroup.add(marker);
      cursor += padSize / 2;
      stages.push({ type: 'puzzle', gateAdvance: cursor, markerPos: new THREE.Vector3(c.x, 0.3, c.z) });
    }
  });
  stages.forEach(s => { s.done = !!alreadyDone; });

  // FINAL PAD (chief awards the badge here)
  cursor += 3.5;
  const finalPadSize = 9;
  const finalCenter = worldAt(cursor, 0);
  AssetLibrary.tileFloor(scene, palette.floor[0], palette.floor[1], finalCenter.x, 0, finalCenter.z, finalPadSize, finalPadSize, 0.6, undefined, 40);
  platforms.push(makePlatform(finalCenter.x, 0, finalCenter.z, finalPadSize, 0.6, finalPadSize));
  const finalAdvance = cursor;

  // scattered buildings for atmosphere near the entry & final pads
  if (palette.buildings.length) {
    for (let i = 0; i < 4; i++) {
      const bk = palette.buildings[Math.floor(rng() * palette.buildings.length)];
      const b = AssetLibrary.get(bk[0], bk[1]);
      AssetLibrary.fitUniform(b, 4.2 + rng() * 2);
      const side = i % 2 === 0 ? -1 : 1;
      const adv = i < 2 ? entryAdvance * 0.6 : finalAdvance - entryPadSize * 0.6;
      const bp = worldAt(adv, side * (6 + rng() * 2.5));
      b.position.set(bp.x, 0, bp.z);
      b.rotation.y = rng() * Math.PI * 2;
      decorGroup.add(b);
    }
  }

  // chief: a real 3D character standing at the entry (intro) and again at
  // the final pad (badge award)
  const chiefInfo = CHIEFS[def.chief];
  const chiefHeight = chiefInfo.characterHeight || 2.2;
  const entrySpritePos = worldAt(entryAdvance, 2.6, 0);
  const entrySprite = AssetLibrary.getCharacter(chiefInfo.characterModel, chiefHeight, chiefInfo.color);
  entrySprite.position.copy(entrySpritePos);
  entrySprite.rotation.y = ang + Math.PI;
  scene.add(entrySprite);

  const finalSpritePos = worldAt(finalAdvance, 2.6, 0);
  const finalSprite = AssetLibrary.getCharacter(chiefInfo.characterModel, chiefHeight, chiefInfo.color);
  finalSprite.position.copy(finalSpritePos);
  finalSprite.rotation.y = ang + Math.PI;
  scene.add(finalSprite);

  return {
    def, isFinale, ang, forward, right, origin,
    platforms, stages,
    entrySpritePos, finalSpritePos,
    introGiven: !!alreadyDone,
    badgeGiven: !!alreadyDone
  };
}

// ---------------- Whole adventure world ----------------
// Builds the hub + all 6 spokes/chains in one persistent scene. Returns
// { platforms (combined, for collision), hubPlatforms, board, chains,
//   lockGates: {villageId: THREE.Object3D} } for main.js to drive each frame.
function buildAdventureWorld(scene) {
  const platforms = [];

  // ---- HUB (home base) ----
  const hubSize = HUB_RADIUS * 2;
  const hubPalette = THEME_ASSETS.hexagon;
  AssetLibrary.tileFloor(scene, hubPalette.floor[0], hubPalette.floor[1], 0, 0, 0, hubSize, hubSize, 0.6, undefined, 100);
  const hubPlat = makePlatform(0, 0, 0, hubSize, 0.6, hubSize);
  platforms.push(hubPlat);

  const board = buildAchievementBoard(scene, new THREE.Vector3(0, 0, -6));
  board.refresh();

  // decorative props scattered lightly around the hub
  const hrng = rngFor('hub-decor');
  if (hubPalette.props.length) {
    for (let i = 0; i < 8; i++) {
      const ang2 = hrng() * Math.PI * 2;
      const rad = 4 + hrng() * (HUB_RADIUS * 0.55);
      const pk = hubPalette.props[Math.floor(hrng() * hubPalette.props.length)];
      const deco = AssetLibrary.get(pk[0], pk[1]);
      AssetLibrary.fitUniform(deco, 1.0 + hrng() * 0.8);
      const x = Math.sin(ang2) * rad, z = Math.cos(ang2) * rad;
      if (Math.abs(z + 6) < 6 && Math.abs(x) < 6) continue; // keep the board area clear
      deco.position.set(x, 0, z);
      deco.rotation.y = hrng() * Math.PI * 2;
      scene.add(deco);
    }
  }

  // ---- SPOKES + CHAINS (5 villages + Math Master) ----
  const defs = [...VILLAGES.map(v => ({ def: v, isFinale: false })), { def: MATHLORD, isFinale: true }];
  const n = defs.length;
  const chains = [];
  const lockGates = {};

  defs.forEach(({ def, isFinale }, i) => {
    const ang = (i / n) * Math.PI * 2;
    const road = buildSpokeRoad(scene, def.theme, ang, def.id);
    platforms.push(...road.platforms);

    const alreadyDone = isFinale ? !!SaveSystem.current.completed : !!SaveSystem.current.badges[def.id];
    const chain = buildVillageChain(scene, def, isFinale, ang, alreadyDone);
    platforms.push(...chain.platforms);
    chains.push(chain);

    const gate = buildLockGate(scene, ang);
    lockGates[def.id] = gate;
  });

  return { platforms, hubPlat, board, chains, lockGates };
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
