/* ==========================================================================
   Roster of selectable character models (Assets/characters).
   file:   model path relative to the Game/ folder
   fbx:    true for the one FBX-format model (needs THREE.FBXLoader)
   thumb:  pre-rendered PNG used in the slider strip
   ========================================================================== */

(function () {
  'use strict';

  window.CHARACTER_ROSTER = [
    { id: 'kid', label: 'Kid', file: 'assets/characters/kid.glb', thumb: 'assets/characters/thumbs/kid.png' },
    { id: 'adventurer-man', label: 'Adventurer Man', file: 'assets/characters/adventurer-man.glb', thumb: 'assets/characters/thumbs/adventurer-man.png' },
    { id: 'adventurer-woman', label: 'Adventurer Woman', file: 'assets/characters/adventurer-woman.glb', thumb: 'assets/characters/thumbs/adventurer-woman.png' },
    { id: 'business-man', label: 'Business Man', file: 'assets/characters/business-man.glb', thumb: 'assets/characters/thumbs/business-man.png' },
    { id: 'business-woman', label: 'Business Woman', file: 'assets/characters/business-woman.glb', thumb: 'assets/characters/thumbs/business-woman.png' },
    { id: 'casual-man', label: 'Casual Man', file: 'assets/characters/casual-man.glb', thumb: 'assets/characters/thumbs/casual-man.png' },
    { id: 'formal-woman', label: 'Formal Woman', file: 'assets/characters/formal-woman.glb', thumb: 'assets/characters/thumbs/formal-woman.png' },
    { id: 'mr-hoodie', label: 'Mr. Hoodie', file: 'assets/characters/mr-hoodie.glb', thumb: 'assets/characters/thumbs/mr-hoodie.png' },
    { id: 'punk-man', label: 'Punk Man', file: 'assets/characters/punk-man.glb', thumb: 'assets/characters/thumbs/punk-man.png' },
    { id: 'simple-man', label: 'Simple Man', file: 'assets/characters/simple-man.glb', thumb: 'assets/characters/thumbs/simple-man.png' },
    { id: 'simple-woman', label: 'Simple Woman', file: 'assets/characters/simple-woman.glb', thumb: 'assets/characters/thumbs/simple-woman.png' },
    { id: 'king', label: 'King', file: 'assets/characters/king.fbx', fbx: true, thumb: 'assets/characters/thumbs/king.png' },
    { id: 'robot', label: 'Robot', file: 'assets/characters/robot.glb', thumb: 'assets/characters/thumbs/robot.png' },
    { id: 'panda', label: 'Panda', file: 'assets/characters/panda.glb', thumb: 'assets/characters/thumbs/panda.png' },
    { id: 'rabbit', label: 'Rabbit', file: 'assets/characters/rabbit.glb', thumb: 'assets/characters/thumbs/rabbit.png' }
  ];

  // Only the Hero is picked here now. The Musician, Inventor and Guide are
  // fixed characters (Baloo/Sprocket/Hopper -- see npc-data.js RECRUIT_NPCS)
  // met and recruited later as the story unfolds, so their looks are
  // reserved out of the pickable roster below.
  window.PARTY_ROLES = [
    { key: 'hero', title: 'Choose your Curious Hero', subtitle: 'The heart of the story — curiosity, courage, and a love of learning.', icon: '⭐', promptLabel: "the Hero's" }
  ];

  window.RESERVED_COMPANION_IDS = ['robot', 'panda', 'rabbit'];
  window.HERO_ROSTER = window.CHARACTER_ROSTER.filter(function (c) {
    return window.RESERVED_COMPANION_IDS.indexOf(c.id) === -1;
  });
})();
