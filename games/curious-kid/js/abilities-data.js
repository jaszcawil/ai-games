/* ==========================================================================
   Abilities, leveling & XP -- taken verbatim from the story bible.
   Each party role has one or more abilities. Active abilities have a
   cooldown and (for some) an activation window; both scale with the
   ability's "points" the way the PDF specifies. Points rise automatically
   as that character levels up from XP earned in NPC challenges.
   ========================================================================== */

(function () {
  'use strict';

  // ---- Ability definitions, keyed by role ----
  // formula(points) -> { cooldown, activation } in seconds (activation omitted if n/a)
  var ABILITIES = {
    hero: [
      {
        key: 'curiosity', name: 'Curiosity', icon: '🔍', type: 'active',
        desc: 'Reveals hidden clues, secrets, chests and the way forward.',
        formula: function (pts) {
          return { cooldown: Math.max(5, 45 - pts * 2), activation: 15 + pts * 2 };
        }
      },
      {
        key: 'quickThinker', name: 'Quick Thinker', icon: '🧠', type: 'active',
        desc: 'Gives a hint on the current question or challenge.',
        formula: function (pts) { return { cooldown: Math.max(6, 60 - pts * 2) }; }
      },
      {
        key: 'goodHeart', name: 'Good Heart', icon: '❤️', type: 'active',
        desc: 'Reveals the correct answer to the current challenge.',
        formula: function (pts) { return { cooldown: Math.max(20, 300 - pts * 2) }; }
      },
      {
        key: 'eureka', name: 'Eureka!', icon: '💡', type: 'passive',
        desc: '+1 to Curiosity and Quick Thinker (once unlocked).'
      },
      {
        key: 'teamwork', name: 'Teamwork', icon: '🤝', type: 'passive',
        desc: "+1 to all teammates' active abilities (once unlocked)."
      }
    ],
    musician: [
      {
        key: 'harmony', name: 'Harmony', icon: '🎵', type: 'active',
        desc: 'Plays a magical melody to open doors, move objects and reveal paths.',
        formula: function (pts) { return { cooldown: Math.max(6, 30 - pts * 2) }; }
      }
    ],
    inventor: [
      {
        key: 'inventorsEureka', name: "Inventor's Eureka", icon: '🔬', type: 'active',
        desc: 'Builds gadgets from salvaged parts to explore new areas.',
        formula: function (pts) { return { cooldown: Math.max(6, 30 - pts * 2) }; }
      }
    ],
    guide: [
      {
        key: 'heartOfWisdom', name: 'Heart of Wisdom', icon: '🕊️', type: 'active',
        desc: 'Understands feelings, resolves conflicts, finds peaceful solutions.',
        formula: function (pts) { return { cooldown: Math.max(6, 30 - pts * 2) }; }
      }
    ]
  };

  // XP curve: how much XP is needed to reach the NEXT level, per current level (1-based)
  function xpToNext(level) { return 40 + (level - 1) * 25; }

  // Fresh per-character progress record
  function newProgress() {
    return { level: 1, xp: 0, points: {} }; // points: abilityKey -> point count
  }

  // Apply XP; returns { leveledUp, newLevel, unlocked: [abilityKey,...] } for UI toasts.
  // Every level-up grants +1 point to that role's FIRST active ability, and unlocks/boosts
  // passives (hero only) at set milestones, matching the "higher ability points" language
  // in the PDF (points accrue with practice/leveling rather than a manual spend screen --
  // simplest, friendliest system for a grade-school audience).
  function addXP(progress, role, amount) {
    var result = { leveledUp: false, newLevel: progress.level, unlocked: [] };
    progress.xp += amount;
    var need = xpToNext(progress.level);
    while (progress.xp >= need) {
      progress.xp -= need;
      progress.level++;
      result.leveledUp = true;
      result.newLevel = progress.level;

      var defs = ABILITIES[role] || [];
      var actives = defs.filter(function (d) { return d.type === 'active'; });
      if (actives.length) {
        // spread points round-robin across this role's active abilities
        var pick = actives[(progress.level - 2) % actives.length];
        progress.points[pick.key] = (progress.points[pick.key] || 0) + 1;
      }

      if (role === 'hero') {
        if (progress.level === 3 && !progress.points.eureka) {
          progress.points.eureka = 1;
          progress.points.curiosity = (progress.points.curiosity || 0) + 1;
          progress.points.quickThinker = (progress.points.quickThinker || 0) + 1;
          result.unlocked.push('eureka');
        }
        if (progress.level === 5 && !progress.points.teamwork) {
          progress.points.teamwork = 1;
          result.unlocked.push('teamwork');
        }
      }
      need = xpToNext(progress.level);
    }
    return result;
  }

  function getAbility(role, key) {
    var defs = ABILITIES[role] || [];
    for (var i = 0; i < defs.length; i++) if (defs[i].key === key) return defs[i];
    return null;
  }

  function abilityStats(role, key, progress) {
    var def = getAbility(role, key);
    if (!def || def.type !== 'active') return null;
    var pts = (progress && progress.points[key]) || 0;
    // Teamwork passive (hero) grants +1 to every OTHER active ability across the party
    if (progress && progress.teamworkBonus) pts += 1;
    return Object.assign({}, def, def.formula(pts), { points: pts });
  }

  window.AbilitiesData = {
    ABILITIES: ABILITIES,
    xpToNext: xpToNext,
    newProgress: newProgress,
    addXP: addXP,
    getAbility: getAbility,
    abilityStats: abilityStats
  };
})();
