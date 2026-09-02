/* ==========================================================================
   Chapter 1 NPC roster -- Pokemon-style "walk up and they stop you" cast.
   type: 'quiz'    -> asks a grade-school question before letting you pass
         'flavor'  -> just a friendly one-liner, always passable
         'recruit' -> a future party member waiting to be met (joins on approach)
   Positions are world-space (x,z), matching WorldTerrain's zone layout.
   ========================================================================== */

(function () {
  'use strict';

  var NPC_MODEL_DIR = 'assets/npcs/';

  function q(category, prompt, choices, correctIndex, hint, fact) {
    return { category: category, prompt: prompt, choices: choices, correctIndex: correctIndex, hint: hint, fact: fact };
  }

  // ---------------- The three future party members ----------------
  // Fixed look (per design decision), reuse the existing playable roster models
  // so they look identical once recruited and made controllable.
  window.RECRUIT_NPCS = [
    {
      id: 'recruit-inventor', role: 'inventor', name: 'Sprocket', character: 'robot',
      model: 'assets/characters/robot.glb',
      x: -14, z: -58, radius: 4,
      greet: "Beep-boop! I'm Sprocket. I've been studying strange readings coming from deep in this forest -- some kind of abandoned laboratory! Want to team up and find out what's inside?",
      joinLine: "🔧 Sprocket the Inventor has joined your party! Press 3 or click their icon to take control."
    },
    {
      id: 'recruit-musician', role: 'musician', name: 'Baloo', character: 'panda',
      model: 'assets/characters/panda.glb',
      x: 0, z: 48, radius: 4,
      greet: "Oh, hello there! I'm Baloo -- I love music more than bamboo, and that's saying something. The fairgrounds have gone awfully quiet lately. Care for a travelling companion?",
      joinLine: "🎵 Baloo the Musician has joined your party! Press 2 or click their icon to take control."
    },
    {
      id: 'recruit-guide', role: 'guide', name: 'Hopper', character: 'rabbit',
      model: 'assets/characters/rabbit.glb',
      x: -58, z: 22, radius: 4,
      greet: "Hi! I'm Hopper. I try to help folks in the garden sort out their squabbles. A kind heart opens more doors than you'd think. Mind if I hop along with you?",
      joinLine: "🕊️ Hopper the Guide has joined your party! Press 4 or click their icon to take control."
    }
  ];

  // ---------------- The 21 open-world quiz / flavor NPCs ----------------
  window.WORLD_NPCS = [
    // ---- Plaza (near home base) -- logic / curiosity, any hero can answer ----
    {
      id: 'npc-ro', name: 'Ro', model: NPC_MODEL_DIR + '100Avatars_017_Ro.fbx', x: 14, z: 15, radius: 3.2, type: 'quiz',
      greet: "Hold it! I collect number patterns. Can you finish this one?",
      question: q('logic', 'What comes next in the pattern: 2, 4, 6, 8, __?', ['9', '10', '12', '16'], 1,
        'Try adding the same amount each time.', 'Patterns like this are called "sequences" -- each number goes up by 2!')
    },
    {
      id: 'npc-circleboi', name: 'Circle Boi', model: NPC_MODEL_DIR + '100Avatars_173_CircleBoi.fbx', x: -14, z: 15, radius: 3.2, type: 'quiz',
      greet: "Roll on in! Quick shape question for ya:",
      question: q('logic', 'How many sides does a hexagon have?', ['5', '6', '7', '8'], 1,
        '"Hex" is a hint -- think of a bee\'s honeycomb.', 'A hexagon has 6 sides -- honeycomb cells are hexagons!')
    },

    // ---- Forest zone -- science, near the Inventor and the lab ----
    {
      id: 'npc-crimsom', name: 'Crimsom', model: NPC_MODEL_DIR + '100Avatars_001_Crimsom.fbx', x: -30, z: -72, radius: 3.2, type: 'quiz',
      greet: "Shh, don't step on the moss! Science question first:",
      question: q('science', 'What do plants need, along with water and air, to make their own food?', ['Moonlight', 'Sunlight', 'Music', 'Snow'], 1,
        'Think about where plants like to grow best.', 'Plants use sunlight to make food in a process called photosynthesis!')
    },
    {
      id: 'npc-mushy', name: 'Mushy', model: NPC_MODEL_DIR + '100Avatars_025_Mushy.fbx', x: 4, z: -88, radius: 3.2, type: 'quiz',
      greet: "Fungi fact time before you pass through my patch:",
      question: q('science', 'Are mushrooms plants?', ['Yes, they are plants', 'No, they are fungi', 'No, they are rocks', 'Yes, they are trees'], 1,
        'They don\'t make their own food from sunlight like plants do.', 'Mushrooms are fungi -- a whole different kingdom of living things!')
    },
    {
      id: 'npc-snowy', name: 'Snowy', model: NPC_MODEL_DIR + '100Avatars_097_Snowy.fbx', x: -22, z: -98, radius: 3.2, type: 'quiz',
      greet: "Brrr! Answer this before you melt my fun:",
      question: q('science', 'Why does ice float on water?', ['Ice is warmer than water', 'Ice is less dense than water', 'Ice is magnetic', 'Water is not wet'], 1,
        'Think about which one takes up more space for the same amount.', 'Ice is less dense than liquid water, so it floats!')
    },
    {
      id: 'npc-coolbattery', name: 'Battery', model: NPC_MODEL_DIR + '100Avatars_126_CoolBattery.fbx', x: 10, z: -66, radius: 3.2, type: 'quiz',
      greet: "Zzzt! Charged up with a question for you:",
      question: q('science', 'What kind of energy is stored inside a battery?', ['Chemical energy', 'Sound energy', 'Wind energy', 'Light energy'], 0,
        'It\'s a reaction happening inside, not light or sound.', 'Batteries store chemical energy and turn it into electricity!')
    },
    {
      id: 'npc-coolcandle', name: 'Candle', model: NPC_MODEL_DIR + '100Avatars_165_CoolCandle.fbx', x: -42, z: -88, radius: 3.2, type: 'quiz',
      greet: "Careful, don't blow me out yet! One question:",
      question: q('science', 'What does a flame need to keep burning?', ['Water', 'Oxygen', 'Darkness', 'Ice'], 1,
        'It\'s something in the air all around you.', 'Fire needs oxygen -- that\'s why blowing it out (or covering it) works!')
    },

    // ---- Fairgrounds zone -- music, morals, flavor ----
    {
      id: 'npc-pepo', name: 'Pepo', model: NPC_MODEL_DIR + '100Avatars_073_Pepo.fbx', x: -20, z: 78, radius: 3.2, type: 'quiz',
      greet: "The band's warming up! Musical question for ya:",
      question: q('music', 'Which of these is a musical instrument?', ['Xylophone', 'Telescope', 'Umbrella', 'Compass'], 0,
        'Think of something you\'d hit with mallets to make notes.', 'A xylophone makes music when you tap its bars!')
    },
    {
      id: 'npc-coolfries', name: 'Fries', model: NPC_MODEL_DIR + '100Avatars_118_COOLFRIES.fbx', x: 18, z: 58, radius: 3.2, type: 'quiz',
      greet: "Hey, got a snack-sized question for you:",
      question: q('morals', 'Two friends both want the last snack. What\'s the fairest thing to do?', ['Grab it first', 'Split it evenly', 'Hide it', 'Argue about it'], 1,
        'Fair means everyone gets a bit.', 'Sharing evenly is a great way to be fair to a friend!')
    },
    {
      id: 'npc-saintclaus', name: 'Saint Claus', model: NPC_MODEL_DIR + '100Avatars_100_SaintClaus.fbx', x: -10, z: 92, radius: 3.2, type: 'quiz',
      greet: "Ho ho -- before your gift, answer this kindly:",
      question: q('morals', 'You accidentally bump into someone. What should you say?', ['Nothing', '"Watch where you\'re going!"', '"I\'m sorry, are you okay?"', 'Walk away fast'], 2,
        'A good apology checks if the other person is alright.', 'Saying sorry and checking on others shows real kindness!')
    },
    {
      id: 'npc-coolpan', name: 'Pan', model: NPC_MODEL_DIR + '100Avatars_142_CoolPan.fbx', x: -5, z: 55, radius: 3.2, type: 'quiz',
      greet: "Sizzle sizzle! Kitchen science for you:",
      question: q('science', 'What happens to water when you heat it enough?', ['It freezes', 'It turns to gas (steam)', 'It turns purple', 'It disappears forever'], 1,
        'You\'ve seen this happen when water boils.', 'Water boils into steam -- a gas -- when it gets hot enough!')
    },
    { id: 'npc-samuela', name: 'Samuela', model: NPC_MODEL_DIR + '100Avatars_050_Samuela.fbx', x: 22, z: 84, radius: 3.2, type: 'flavor',
      greet: "Welcome to the fair! Isn't it a lovely, if quiet, day?" },
    { id: 'npc-watermelon', name: 'Melon', model: NPC_MODEL_DIR + '100Avatars_089_Watermelon.fbx', x: 10, z: 98, radius: 3.2, type: 'flavor',
      greet: "Fresh and juicy thoughts only around here. Enjoy the fair!" },
    { id: 'npc-coolketchup', name: 'Ketchup', model: NPC_MODEL_DIR + '100Avatars_134_CoolKetchup.fbx', x: -26, z: 62, radius: 3.2, type: 'flavor',
      greet: "Squeeze by anytime, friend! No hard feelings here." },
    { id: 'npc-coolpancake', name: 'Pancake', model: NPC_MODEL_DIR + '100Avatars_161_CoolPancake.fbx', x: 2, z: 74, radius: 3.2, type: 'flavor',
      greet: "Stacked high with good vibes today!" },
    { id: 'npc-tastysandwich', name: 'Sandwich', model: NPC_MODEL_DIR + '100Avatars_185_TastySandwich.fbx', x: 26, z: 68, radius: 3.2, type: 'flavor',
      greet: "Layers of fun at every turn of this fair, huh?" },

    // ---- Ruins zone -- ancient mechanisms, flavor ----
    { id: 'npc-coolbarrel', name: 'Barrel', model: NPC_MODEL_DIR + '100Avatars_153_CoolBarrel.fbx', x: 55, z: 6, radius: 3.2, type: 'flavor',
      greet: "These ruins hold a lot of history. Mind your step!" },

    // ---- Garden zone -- morals, flavor, near the Guide ----
    { id: 'npc-cactusboy', name: 'Cactus Boy', model: NPC_MODEL_DIR + '100Avatars_009_CactusBoy.fbx', x: -90, z: 10, radius: 3.2, type: 'flavor',
      greet: "Careful, I'm a little prickly! But welcome to the garden." },
    {
      id: 'npc-rose', name: 'Rose', model: NPC_MODEL_DIR + '100Avatars_057_Rose.fbx', x: -96, z: 32, radius: 3.2, type: 'quiz',
      greet: "A garden riddle of the heart for you:",
      question: q('morals', 'Your friend drops their lunch by accident. What\'s the kind thing to do?', ['Laugh at them', 'Ignore it', 'Help them clean up and offer to share', 'Tell everyone'], 2,
        'Think of what a good friend would do.', 'Helping and sharing turns a bad moment into a kind one!')
    },
    { id: 'npc-unicornperson', name: 'Unicorn', model: NPC_MODEL_DIR + '100Avatars_110_UniconPerson.fbx', x: -70, z: 42, radius: 3.2, type: 'flavor',
      greet: "Sparkles and good wishes to you, traveler!" },
    {
      id: 'npc-coolcola', name: 'Cola', model: NPC_MODEL_DIR + '100Avatars_193_CoolCola.fbx', x: -86, z: 16, radius: 3.2, type: 'quiz',
      greet: "Fizzy question incoming! Don't shake me up:",
      question: q('morals', 'You see someone sitting alone, left out of a game. What should you do?', ['Ignore them', 'Point and laugh', 'Invite them to join', 'Walk away'], 2,
        'Think about how you\'d want to be treated.', 'Inviting someone in is a simple way to be a good friend!')
    }
  ];

  // ---------------- Skill-gated obstacles (task: "requires the skill of one of the characters") ----------------
  window.WORLD_OBSTACLES = [
    {
      id: 'obstacle-lab-rubble', requiredRole: 'inventor', abilityKey: 'inventorsEureka',
      x: -14, z: -100, radius: 5, colliderRadius: 4.5,
      lockedMsg: "🪨 A pile of tangled, rusted machinery blocks the path. This looks like a job for the Inventor's clever hands...",
      needMsg: "You'll need Sprocket the Inventor in your party to clear this wreckage.",
      clearMsg: "🔧 Sprocket pulls a Super Tool from their satchel and clears the wreckage! The path to the Abandoned Laboratory is open."
    },
    {
      id: 'obstacle-ruins-gate', requiredRole: 'musician', abilityKey: 'harmony',
      x: 72, z: -32, radius: 5, colliderRadius: 4.5,
      lockedMsg: "🚪 An ancient stone gate, carved with musical notes, won't budge. Perhaps a song could stir it...",
      needMsg: "You'll need Baloo the Musician in your party to play the gate open.",
      clearMsg: "🎵 Baloo hums an old melody and the gate rumbles open, revealing a hidden crystal alcove!"
    },
    {
      id: 'obstacle-garden-quarrel', requiredRole: 'guide', abilityKey: 'heartOfWisdom',
      x: -100, z: 46, radius: 5, colliderRadius: 4.5,
      lockedMsg: "😟 Two garden critters are in the middle of a squabble, blocking the path. Someone with a gentle heart could sort this out...",
      needMsg: "You'll need Hopper the Guide in your party to help them make peace.",
      clearMsg: "🕊️ Hopper listens patiently to both sides, and the critters shake hands (well, paws). The path is clear!"
    }
  ];

  // derive a thumbnail path for every world NPC from its model filename
  window.WORLD_NPCS.forEach(function (npc) {
    var base = npc.model.slice(npc.model.lastIndexOf('/') + 1).replace(/\.fbx$/i, '.png');
    npc.thumb = NPC_MODEL_DIR + 'thumbs/' + base;
  });

  // ---------------- Boss (Abandoned Laboratory finale) ----------------
  window.BOSS_DATA = {
    id: 'professor-glitch', name: 'Professor Glitch',
    model: NPC_MODEL_DIR + '100Avatars_105_GoldfishBagPerson.fbx',
    thumb: NPC_MODEL_DIR + 'thumbs/100Avatars_105_GoldfishBagPerson.png',
    tint: 0x8fd6ff,
    intro: "BZZT-ZZT! UNAUTHORIZED VISITORS! I am Professor Glitch, keeper of this laboratory. Everything here is an EXPERIMENT, and experiments must not be disturbed! Prove your curiosity is worth something, or turn back!",
    outro: "BZZT... recalibrating... You've shown real curiosity, patience, and careful observation. Those... those are the true tools of science. You may proceed. The Crystal of Science is yours!",
    questions: [
      q('science', 'What is it called when you test an idea to see if it\'s true?', ['A guess', 'An experiment', 'A nap', 'A song'], 1,
        'Scientists do this to check their ideas.', 'An experiment is a careful test of an idea!'),
      q('science', 'Before you experiment, what do you make called a "hypothesis"?', ['A prediction you want to test', 'A type of rock', 'A musical note', 'A kind of cloud'], 0,
        'It\'s a guess you can test.', 'A hypothesis is an educated guess you test with an experiment!'),
      q('science', 'What should a good scientist do when their experiment doesn\'t work as expected?', ['Give up', 'Cheat on the results', 'Observe carefully and try again', 'Get angry'], 2,
        'Mistakes teach us something -- look closely!', 'Careful observation, even after a mistake, is real science!'),
      q('science', 'Why do scientists write down their observations?', ['To remember and share what they found', 'To make the lab messy', 'It\'s a rule with no reason', 'To confuse people'], 0,
        'Think about sharing discoveries with others.', 'Writing observations down helps scientists remember and share their findings!')
    ]
  };
})();
