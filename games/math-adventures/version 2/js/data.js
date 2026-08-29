// ===================================================================
// data.js  -- static game data: heroes, chiefs, villages, model paths
// ===================================================================

const GAME_TITLE = "Math Adventures with Wonderblocks and Noodle and Pals";
const SAVE_VERSION = 1;

// ---------------- Heroes ----------------
const HEROES = [
  {
    id: 'again',
    name: 'Again',
    img: 'assets/heroes/Again.png',
    color: '#ffb703',
    power: 'Bounce Jump',
    powerDesc: 'Jump a second time in the air!',
    tagline: '"If I miss, I just try again!"'
  },
  {
    id: 'stop',
    name: 'Stop',
    img: 'assets/heroes/Stop.png',
    color: '#e63946',
    power: 'Freeze Power',
    powerDesc: 'Freezes moving obstacles for a few seconds.',
    tagline: '"Whoa there -- let\'s slow down and think!"'
  },
  {
    id: 'blossom',
    name: 'Blossom',
    img: 'assets/heroes/Blossom.png',
    color: '#ff6fa5',
    power: 'Petal Float',
    powerDesc: 'Float gently across wide gaps.',
    tagline: '"Float like a flower petal!"'
  },
  {
    id: 'red',
    name: 'Red',
    img: 'assets/heroes/Red.png',
    color: '#d62828',
    power: 'Power Dash',
    powerDesc: 'A strong burst of speed to cross gaps fast.',
    tagline: '"Leave it to me -- I\'m strong!"'
  }
];

// ---------------- Chiefs / Math Master ----------------
// characterModel points at a real 3D KayKit "Adventurers" character used to
// represent this chief in the world; `color` also tints that model (so
// Tiffany & Nayah, who share the Mage model, still look distinct).
// characterHeight overrides the default standing height (Jasz = "Barbarian
// Large", an imposing final-boss scale).
const CHIEFS = {
  tiffany: { name: 'Tiffany', color: '#ffd166', role: 'Village Chief', village: 'village1', characterModel: 'Mage' },
  grey:    { name: 'Grey',    color: '#8d99ae', role: 'Village Chief', village: 'village2', characterModel: 'Ranger' },
  nayah:   { name: 'Nayah',   color: '#06d6a0', role: 'Village Chief', village: 'village3', characterModel: 'Mage' },
  naomi:   { name: 'Naomi',   color: '#118ab2', role: 'Village Chief', village: 'village4', characterModel: 'Rogue_Hooded' },
  carmela: { name: 'Carmela', color: '#ef476f', role: 'Village Chief', village: 'village5', characterModel: 'Rogue' },
  jasz:    { name: 'Jasz',    color: '#7b2cbf', role: 'The Math Master', village: 'mathlord', characterModel: 'Barbarian', characterHeight: 3.4 }
};

// ---------------- Model path manifest ----------------
// pack -> base folder; use MODEL(pack, name) to get full relative path
const MODEL_BASE = 'assets/models/';
function MODEL(pack, name) { return MODEL_BASE + pack + '/' + name + '.gltf'; }

// 3D character models (KayKit "Adventurers" pack) used for chiefs/Math Master
const CHARACTER_MODEL_BASE = 'assets/adventurers/';
function CHARACTER_MODEL(name) { return CHARACTER_MODEL_BASE + name + '.glb'; }

// ---------------- Village definitions ----------------
// Each village is a straight "lane" world running along -Z (forward).
// Platforms are boxes: {x,y,z, w,h,d}  (w=width X, h=height Y, d=depth Z)
// Player starts at z=0 and the goal / chief podium is at the far end (negative z).

const VILLAGES = [
  {
    id: 'village1',
    name: 'Sunny Hex Village',
    chief: 'tiffany',
    topic: 'placevalue',
    theme: 'hexagon',
    skyTop: '#ffe29a', skyBottom: '#ffb703',
    groundColor: '#e8c15a',
    badgeIcon: '🔢',
    introText: "Welcome, hero! I'm Tiffany. Before you can pass, show me you know your place values!",
    obbyLength: 46
  },
  {
    id: 'village2',
    name: 'Whispering Forest',
    chief: 'grey',
    topic: 'addsub',
    theme: 'forest',
    skyTop: '#bfe3c0', skyBottom: '#5a9e6f',
    groundColor: '#6b8f4e',
    badgeIcon: '➕',
    introText: "Hoo there! I'm Grey. The forest path is guarded by adding and subtracting riddles!",
    obbyLength: 50
  },
  {
    id: 'village3',
    name: 'Nayah\'s Bakery Plaza',
    chief: 'nayah',
    topic: 'muldiv',
    theme: 'restaurant',
    skyTop: '#ffe0c2', skyBottom: '#ff9a5a',
    groundColor: '#d8a35a',
    badgeIcon: '✖️',
    introText: "Welcome to my plaza! I'm Nayah. Help me sort groups of yummy treats with multiplying and dividing!",
    obbyLength: 46
  },
  {
    id: 'village4',
    name: 'Naomi\'s Hex Keep',
    chief: 'naomi',
    topic: 'orderops',
    theme: 'hexagon2',
    skyTop: '#c7ecff', skyBottom: '#4fa8d8',
    groundColor: '#4fae6e',
    badgeIcon: '🧮',
    introText: "I'm Naomi! Step the hex stones in the RIGHT ORDER -- just like solving math step by step!",
    obbyLength: 50
  },
  {
    id: 'village5',
    name: 'Carmela\'s Treasure Cave',
    chief: 'carmela',
    topic: 'mixed',
    theme: 'dungeon',
    skyTop: '#3a2e5c', skyBottom: '#1b1330',
    groundColor: '#6b5a4a',
    badgeIcon: '💎',
    introText: "Careful in here! I'm Carmela. This cave holds tricky mixed-up math treasure puzzles!",
    obbyLength: 50
  }
];

const MATHLORD = {
  id: 'mathlord',
  name: "Math Master's Castle",
  chief: 'jasz',
  theme: 'castle',
  skyTop: '#2b1055', skyBottom: '#0d0620',
  groundColor: '#4a3a5a',
  introText: "So... five heroes seek the Crown of Math. Prove yourselves in my Final Gauntlet!",
  obbyLength: 58
};
