// Console-specific heuristic rule tables for the generated home-console catalogs.
// Keep vocabulary here, not in catalog-shared/heuristics.mjs; that module only
// owns matching mechanics and stable output helpers.

export const catalogConfigs = {
  sms: {
    difficultSignals: ["alien soldier", "battletoads", "castlevania", "contra", "demon", "ghouls", "ghosts", "gradius", "last resort", "mega man", "metal slug", "ninja gaiden", "r-type", "shinobi", "splatterhouse", "thunder force", "zillion"],
    casualSignals: ["casino", "chess", "columns", "fishing", "golf", "jeopardy", "mahjong", "monopoly", "pac-man", "pachi", "pinball", "puzzle", "solitaire", "tetris", "wheel of fortune", "alex kidd"],
    richStorySignals: ["beyond oasis", "breath of fire", "chrono", "dragon", "earthbound", "fantasy star", "final fantasy", "fire emblem", "lunar", "mana", "miracle warriors", "monster world", "neutopia", "phantasy star", "shadowrun", "shining", "snatcher", "star ocean", "ultima", "ys", "golvellius", "spellcaster"],
    someStorySignals: ["adventure", "alex kidd", "batman", "castlevania", "comix zone", "demon", "dragon ball", "gaiden", "golden axe", "indiana jones", "jurassic park", "legend", "metroid", "ninja", "quest", "robocop", "shinobi", "star wars", "wonder boy"],
    playStyleRules: [
      {
        playStyle: "puzzle",
        tags: ["puzzle"],
        patterns: ["arkanoid", "columns", "klax", "lolo", "mahjong", "othello", "picross", "puyo", "puzzle", "shogi", "sudoku", "tetris"],
      },
      {
        playStyle: "action-adventure",
        tags: ["adventure"],
        patterns: ["beyond oasis", "breath of fire", "chrono", "dragon", "earthbound", "fantasy star", "final fantasy", "fire emblem", "lunar", "mana", "miracle warriors", "monster world", "neutopia", "phantasy star", "shadowrun", "shining", "snatcher", "star ocean", "ultima", "ys", "golvellius", "spellcaster", "adventure", "landstalker", "metroid", "quest", "rpg", "wonder boy", "zelda"],
      },
      {
        playStyle: "top-down",
        tags: ["overhead"],
        patterns: ["baseball", "basketball", "bomberman", "football", "golf", "hockey", "nobunaga", "soccer", "strategy", "tennis", "volleyball", "war"],
      },
      {
        playStyle: "platformer",
        tags: ["platformer"],
        patterns: ["alex kidd", "bonk", "bubsy", "castle of illusion", "donkey kong", "earthworm", "kid chameleon", "mega man", "mickey", "shinobi", "sonic", "sparkster", "wonder boy"],
      },
    ],
    tagRules: [
      {
        tag: "sports",
        patterns: ["baseball", "basketball", "boxing", "football", "golf", "hockey", "olympic", "soccer", "tennis", "volleyball", "wrestl"],
      },
      {
        tag: "racing",
        patterns: ["f-1", "formula", "grand prix", "kart", "racer", "racing", "speedway"],
      },
      {
        tag: "shooter",
        patterns: ["after burner", "contra", "darius", "fantasy zone", "gradius", "gun", "metal slug", "r-type", "shoot", "space harrier", "star soldier", "thunder force", "zaxxon"],
      },
      {
        tag: "licensed character",
        patterns: ["addams", "batman", "bugs bunny", "captain america", "disney", "dragon ball", "flintstones", "godzilla", "mickey", "ninja turtles", "robocop", "simpsons", "star wars", "superman", "x-men"],
      },
      {
        tag: "board and card",
        patterns: ["blackjack", "casino", "chess", "mahjong", "monopoly", "poker", "shogi", "solitaire"],
      },
      {
        tag: "rpg",
        patterns: ["beyond oasis", "breath of fire", "chrono", "dragon", "earthbound", "fantasy star", "final fantasy", "fire emblem", "lunar", "mana", "miracle warriors", "monster world", "neutopia", "phantasy star", "shadowrun", "shining", "snatcher", "star ocean", "ultima", "ys", "golvellius", "spellcaster"],
      },
      {
        tag: "horror",
        patterns: ["castlevania", "demon", "dracula", "ghost", "ghoul", "horror", "monster", "nightmare", "splatterhouse", "zombie"],
      },
      {
        tag: "strategy",
        patterns: ["a-train", "civilization", "nobunaga", "romance of the three kingdoms", "simcity", "strategy"],
      },
      {
        tag: "arcade port",
        patterns: ["after burner", "altered beast", "arkanoid", "bubble bobble", "galaga", "golden axe", "mortal kombat", "pac-man", "space harrier", "street fighter"],
      },
    ],
    moodRules: [
      {
        mood: "ominous",
        patterns: ["alien", "castle", "castlevania", "dark", "dead", "demon", "devil", "dragon", "ghost", "ghoul", "horror", "monster", "nightmare", "shadow", "splatterhouse", "zombie"],
      },
      {
        mood: "heroic",
        patterns: ["adventure", "alex kidd", "batman", "captain", "dragon", "fantasy star", "golden axe", "hero", "legend", "ninja", "phantasy star", "quest", "shinobi", "sonic", "star wars", "warrior", "wonder boy"],
      },
      {
        mood: "weird",
        patterns: ["alex kidd", "bonk", "bubble", "clayfighter", "comix", "fantasy zone", "kid chameleon", "magic", "mutant", "parodius", "toe jam", "weird"],
      },
      {
        mood: "arcade",
        patterns: ["arcade", "baseball", "battle", "bomberman", "columns", "contra", "golden axe", "metal slug", "pac-man", "pinball", "racing", "sports", "street fighter", "tetris"],
      },
      {
        mood: "contemplative",
        patterns: ["a-train", "chess", "civilization", "mahjong", "mystery", "othello", "puzzle", "shadowrun", "shogi", "simcity", "solitaire"],
      },
    ],
    scriptName: "scripts/generate-sms-catalog.mjs",
    platform: "sms",
    platformLabel: "Sega Master System",
    typePrefix: "Sms",
    sourceExportName: "smsCatalogSource",
    gamesExportName: "generatedSmsGames",
    sourceName: "Wikipedia Sega Master System catalog tables",
    sources: [
      {
        name: "Wikipedia: List of Master System games",
        url: "https://en.wikipedia.org/wiki/List_of_Master_System_games",
      },
    ],
    sourceTables: [
      {
        url: "https://en.wikipedia.org/wiki/List_of_Master_System_games",
        index: 0,
        category: "licensed",
        minCells: 6,
        columns: {
          title: 0,
          developer: 1,
          publisher: 2,
          dates: [
            {
              region: "JP",
              index: 3,
            },
            {
              region: "NA",
              index: 4,
            },
            {
              region: "PAL",
              index: 5,
            },
            {
              region: "BR",
              index: 6,
            },
          ],
        },
      },
      {
        url: "https://en.wikipedia.org/wiki/List_of_Master_System_games",
        index: 1,
        category: "compilation",
        minCells: 6,
        columns: {
          title: 0,
          developer: 1,
          publisher: 2,
          dates: [
            {
              region: "JP",
              index: 3,
            },
            {
              region: "NA",
              index: 4,
            },
            {
              region: "PAL",
              index: 5,
            },
          ],
        },
      },
    ],
    regionLabels: {
      JP: "Japan",
      NA: "North America",
      PAL: "Europe/PAL",
      BR: "Brazil",
    },
    classicTitles: new Set(["Alex Kidd in Miracle World", "Fantasy Zone", "Phantasy Star", "Sonic the Hedgehog", "Wonder Boy III: The Dragon's Trap"]),
    categoryTags: {
      compilation: ["compilation"],
    },
    categoryPhrases: {
      licensed: "a Sega Master System release",
      compilation: "a Sega Master System compilation cartridge",
    },
    strangeCategories: ["compilation"],
    outputPath: new URL("../../src/data/sms-catalog.generated.ts", import.meta.url),
  },
  "atari-7800": {
    difficultSignals: ["alien soldier", "battletoads", "castlevania", "contra", "demon", "ghouls", "ghosts", "gradius", "last resort", "mega man", "metal slug", "ninja gaiden", "r-type", "shinobi", "splatterhouse", "thunder force", "zillion", "ninja golf"],
    casualSignals: ["casino", "chess", "columns", "fishing", "golf", "jeopardy", "mahjong", "monopoly", "pac-man", "pachi", "pinball", "puzzle", "solitaire", "tetris", "wheel of fortune", "food fight"],
    richStorySignals: ["beyond oasis", "breath of fire", "chrono", "dragon", "earthbound", "fantasy star", "final fantasy", "fire emblem", "lunar", "mana", "miracle warriors", "monster world", "neutopia", "phantasy star", "shadowrun", "shining", "snatcher", "star ocean", "ultima", "ys", "tower toppler"],
    someStorySignals: ["adventure", "alex kidd", "batman", "castlevania", "comix zone", "demon", "dragon ball", "gaiden", "golden axe", "indiana jones", "jurassic park", "legend", "metroid", "ninja", "quest", "robocop", "shinobi", "star wars", "wonder boy", "ninja golf"],
    playStyleRules: [
      {
        playStyle: "puzzle",
        tags: ["puzzle"],
        patterns: ["arkanoid", "columns", "klax", "lolo", "mahjong", "othello", "picross", "puyo", "puzzle", "shogi", "sudoku", "tetris"],
      },
      {
        playStyle: "action-adventure",
        tags: ["adventure"],
        patterns: ["beyond oasis", "breath of fire", "chrono", "dragon", "earthbound", "fantasy star", "final fantasy", "fire emblem", "lunar", "mana", "miracle warriors", "monster world", "neutopia", "phantasy star", "shadowrun", "shining", "snatcher", "star ocean", "ultima", "ys", "tower toppler", "adventure", "landstalker", "metroid", "quest", "rpg", "wonder boy", "zelda"],
      },
      {
        playStyle: "top-down",
        tags: ["overhead"],
        patterns: ["baseball", "basketball", "bomberman", "football", "golf", "hockey", "nobunaga", "soccer", "strategy", "tennis", "volleyball", "war"],
      },
      {
        playStyle: "platformer",
        tags: ["platformer"],
        patterns: ["alex kidd", "bonk", "bubsy", "castle of illusion", "donkey kong", "earthworm", "kid chameleon", "mega man", "mickey", "shinobi", "sonic", "sparkster", "wonder boy"],
      },
    ],
    tagRules: [
      {
        tag: "sports",
        patterns: ["baseball", "basketball", "boxing", "football", "golf", "hockey", "olympic", "soccer", "tennis", "volleyball", "wrestl"],
      },
      {
        tag: "racing",
        patterns: ["f-1", "formula", "grand prix", "kart", "racer", "racing", "speedway"],
      },
      {
        tag: "shooter",
        patterns: ["after burner", "contra", "darius", "fantasy zone", "gradius", "gun", "metal slug", "r-type", "shoot", "space harrier", "star soldier", "thunder force", "zaxxon"],
      },
      {
        tag: "licensed character",
        patterns: ["addams", "batman", "bugs bunny", "captain america", "disney", "dragon ball", "flintstones", "godzilla", "mickey", "ninja turtles", "robocop", "simpsons", "star wars", "superman", "x-men"],
      },
      {
        tag: "board and card",
        patterns: ["blackjack", "casino", "chess", "mahjong", "monopoly", "poker", "shogi", "solitaire"],
      },
      {
        tag: "rpg",
        patterns: ["beyond oasis", "breath of fire", "chrono", "dragon", "earthbound", "fantasy star", "final fantasy", "fire emblem", "lunar", "mana", "miracle warriors", "monster world", "neutopia", "phantasy star", "shadowrun", "shining", "snatcher", "star ocean", "ultima", "ys", "tower toppler"],
      },
      {
        tag: "horror",
        patterns: ["castlevania", "demon", "dracula", "ghost", "ghoul", "horror", "monster", "nightmare", "splatterhouse", "zombie"],
      },
      {
        tag: "strategy",
        patterns: ["a-train", "civilization", "nobunaga", "romance of the three kingdoms", "simcity", "strategy"],
      },
      {
        tag: "arcade port",
        patterns: ["after burner", "altered beast", "arkanoid", "bubble bobble", "galaga", "golden axe", "mortal kombat", "pac-man", "space harrier", "street fighter"],
      },
    ],
    moodRules: [
      {
        mood: "ominous",
        patterns: ["alien", "castle", "castlevania", "dark", "dead", "demon", "devil", "dragon", "ghost", "ghoul", "horror", "monster", "nightmare", "shadow", "splatterhouse", "zombie"],
      },
      {
        mood: "heroic",
        patterns: ["adventure", "alex kidd", "batman", "captain", "dragon", "fantasy star", "golden axe", "hero", "legend", "ninja", "phantasy star", "quest", "shinobi", "sonic", "star wars", "warrior", "wonder boy"],
      },
      {
        mood: "weird",
        patterns: ["alex kidd", "bonk", "bubble", "clayfighter", "comix", "fantasy zone", "kid chameleon", "magic", "mutant", "parodius", "toe jam", "weird"],
      },
      {
        mood: "arcade",
        patterns: ["arcade", "baseball", "battle", "bomberman", "columns", "contra", "golden axe", "metal slug", "pac-man", "pinball", "racing", "sports", "street fighter", "tetris"],
      },
      {
        mood: "contemplative",
        patterns: ["a-train", "chess", "civilization", "mahjong", "mystery", "othello", "puzzle", "shadowrun", "shogi", "simcity", "solitaire"],
      },
    ],
    scriptName: "scripts/generate-atari-7800-catalog.mjs",
    platform: "atari-7800",
    platformLabel: "Atari 7800",
    typePrefix: "Atari7800",
    sourceExportName: "atari7800CatalogSource",
    gamesExportName: "generatedAtari7800Games",
    sourceName: "Wikipedia Atari 7800 catalog tables",
    sources: [
      {
        name: "Wikipedia: List of Atari 7800 games",
        url: "https://en.wikipedia.org/wiki/List_of_Atari_7800_games",
      },
    ],
    sourceTables: [
      {
        url: "https://en.wikipedia.org/wiki/List_of_Atari_7800_games",
        index: 1,
        category: "licensed",
        minCells: 4,
        columns: {
          title: 0,
          developer: 1,
          publisher: 2,
          date: 3,
          regions: 4,
        },
      },
      {
        url: "https://en.wikipedia.org/wiki/List_of_Atari_7800_games",
        index: 2,
        category: "homebrew",
        minCells: 4,
        columns: {
          title: 0,
          developer: 1,
          publisher: 2,
          date: 3,
          regions: 4,
        },
      },
      {
        url: "https://en.wikipedia.org/wiki/List_of_Atari_7800_games",
        index: 3,
        category: "modern",
        minCells: 4,
        columns: {
          title: 0,
          developer: 1,
          publisher: 2,
          date: 3,
          regions: 4,
        },
      },
      {
        url: "https://en.wikipedia.org/wiki/List_of_Atari_7800_games",
        index: 4,
        category: "prototype",
        minCells: 4,
        columns: {
          title: 0,
          developer: 1,
          publisher: 2,
          date: 3,
          regions: 4,
        },
      },
      {
        url: "https://en.wikipedia.org/wiki/List_of_Atari_7800_games",
        index: 5,
        category: "unreleased",
        minCells: 3,
        constantRegions: ["unreleased"],
        columns: {
          title: 0,
          developer: 1,
          publisher: 2,
        },
      },
    ],
    regionLabels: {
      NA: "North America",
      PAL: "Europe/PAL",
      unreleased: "Unreleased",
    },
    classicTitles: new Set(["Asteroids", "Centipede", "Food Fight", "Joust", "Ms. Pac-Man", "Ninja Golf"]),
    categoryTags: {
      homebrew: ["homebrew"],
      modern: ["modern release"],
      prototype: ["prototype"],
      unreleased: ["unreleased"],
    },
    categoryPhrases: {
      licensed: "an Atari 7800 release",
      homebrew: "an Atari 7800 homebrew release",
      modern: "a modern Atari 7800 release",
      prototype: "an Atari 7800 prototype",
      unreleased: "an unreleased Atari 7800 project",
    },
    strangeCategories: ["homebrew", "modern", "prototype", "unreleased"],
    outputPath: new URL("../../src/data/atari-7800-catalog.generated.ts", import.meta.url),
  },
  "atari-5200": {
    difficultSignals: ["alien soldier", "battletoads", "castlevania", "contra", "demon", "ghouls", "ghosts", "gradius", "last resort", "mega man", "metal slug", "ninja gaiden", "r-type", "shinobi", "splatterhouse", "thunder force", "zillion", "defender", "missile command", "star raiders"],
    casualSignals: ["casino", "chess", "columns", "fishing", "golf", "jeopardy", "mahjong", "monopoly", "pac-man", "pachi", "pinball", "puzzle", "solitaire", "tetris", "wheel of fortune", "pac-man", "qix"],
    richStorySignals: ["beyond oasis", "breath of fire", "chrono", "dragon", "earthbound", "fantasy star", "final fantasy", "fire emblem", "lunar", "mana", "miracle warriors", "monster world", "neutopia", "phantasy star", "shadowrun", "shining", "snatcher", "star ocean", "ultima", "ys", "star raiders"],
    someStorySignals: ["adventure", "alex kidd", "batman", "castlevania", "comix zone", "demon", "dragon ball", "gaiden", "golden axe", "indiana jones", "jurassic park", "legend", "metroid", "ninja", "quest", "robocop", "shinobi", "star wars", "wonder boy"],
    playStyleRules: [
      {
        playStyle: "puzzle",
        tags: ["puzzle"],
        patterns: ["arkanoid", "columns", "klax", "lolo", "mahjong", "othello", "picross", "puyo", "puzzle", "shogi", "sudoku", "tetris"],
      },
      {
        playStyle: "action-adventure",
        tags: ["adventure"],
        patterns: ["beyond oasis", "breath of fire", "chrono", "dragon", "earthbound", "fantasy star", "final fantasy", "fire emblem", "lunar", "mana", "miracle warriors", "monster world", "neutopia", "phantasy star", "shadowrun", "shining", "snatcher", "star ocean", "ultima", "ys", "star raiders", "adventure", "landstalker", "metroid", "quest", "rpg", "wonder boy", "zelda"],
      },
      {
        playStyle: "top-down",
        tags: ["overhead"],
        patterns: ["baseball", "basketball", "bomberman", "football", "golf", "hockey", "nobunaga", "soccer", "strategy", "tennis", "volleyball", "war"],
      },
      {
        playStyle: "platformer",
        tags: ["platformer"],
        patterns: ["alex kidd", "bonk", "bubsy", "castle of illusion", "donkey kong", "earthworm", "kid chameleon", "mega man", "mickey", "shinobi", "sonic", "sparkster", "wonder boy"],
      },
    ],
    tagRules: [
      {
        tag: "sports",
        patterns: ["baseball", "basketball", "boxing", "football", "golf", "hockey", "olympic", "soccer", "tennis", "volleyball", "wrestl"],
      },
      {
        tag: "racing",
        patterns: ["f-1", "formula", "grand prix", "kart", "racer", "racing", "speedway"],
      },
      {
        tag: "shooter",
        patterns: ["after burner", "contra", "darius", "fantasy zone", "gradius", "gun", "metal slug", "r-type", "shoot", "space harrier", "star soldier", "thunder force", "zaxxon"],
      },
      {
        tag: "licensed character",
        patterns: ["addams", "batman", "bugs bunny", "captain america", "disney", "dragon ball", "flintstones", "godzilla", "mickey", "ninja turtles", "robocop", "simpsons", "star wars", "superman", "x-men"],
      },
      {
        tag: "board and card",
        patterns: ["blackjack", "casino", "chess", "mahjong", "monopoly", "poker", "shogi", "solitaire"],
      },
      {
        tag: "rpg",
        patterns: ["beyond oasis", "breath of fire", "chrono", "dragon", "earthbound", "fantasy star", "final fantasy", "fire emblem", "lunar", "mana", "miracle warriors", "monster world", "neutopia", "phantasy star", "shadowrun", "shining", "snatcher", "star ocean", "ultima", "ys", "star raiders"],
      },
      {
        tag: "horror",
        patterns: ["castlevania", "demon", "dracula", "ghost", "ghoul", "horror", "monster", "nightmare", "splatterhouse", "zombie"],
      },
      {
        tag: "strategy",
        patterns: ["a-train", "civilization", "nobunaga", "romance of the three kingdoms", "simcity", "strategy"],
      },
      {
        tag: "arcade port",
        patterns: ["after burner", "altered beast", "arkanoid", "bubble bobble", "galaga", "golden axe", "mortal kombat", "pac-man", "space harrier", "street fighter"],
      },
    ],
    moodRules: [
      {
        mood: "ominous",
        patterns: ["alien", "castle", "castlevania", "dark", "dead", "demon", "devil", "dragon", "ghost", "ghoul", "horror", "monster", "nightmare", "shadow", "splatterhouse", "zombie"],
      },
      {
        mood: "heroic",
        patterns: ["adventure", "alex kidd", "batman", "captain", "dragon", "fantasy star", "golden axe", "hero", "legend", "ninja", "phantasy star", "quest", "shinobi", "sonic", "star wars", "warrior", "wonder boy"],
      },
      {
        mood: "weird",
        patterns: ["alex kidd", "bonk", "bubble", "clayfighter", "comix", "fantasy zone", "kid chameleon", "magic", "mutant", "parodius", "toe jam", "weird"],
      },
      {
        mood: "arcade",
        patterns: ["arcade", "baseball", "battle", "bomberman", "columns", "contra", "golden axe", "metal slug", "pac-man", "pinball", "racing", "sports", "street fighter", "tetris"],
      },
      {
        mood: "contemplative",
        patterns: ["a-train", "chess", "civilization", "mahjong", "mystery", "othello", "puzzle", "shadowrun", "shogi", "simcity", "solitaire"],
      },
    ],
    scriptName: "scripts/generate-atari-5200-catalog.mjs",
    platform: "atari-5200",
    platformLabel: "Atari 5200",
    typePrefix: "Atari5200",
    sourceExportName: "atari5200CatalogSource",
    gamesExportName: "generatedAtari5200Games",
    sourceName: "Wikipedia Atari 5200 catalog tables",
    sources: [
      {
        name: "Wikipedia: List of Atari 5200 games",
        url: "https://en.wikipedia.org/wiki/List_of_Atari_5200_games",
      },
    ],
    sourceTables: [
      {
        url: "https://en.wikipedia.org/wiki/List_of_Atari_5200_games",
        index: 0,
        category: "licensed",
        minCells: 3,
        constantRegions: ["NA"],
        columns: {
          title: 0,
          developer: 1,
          publisher: 2,
          date: 3,
        },
      },
      {
        url: "https://en.wikipedia.org/wiki/List_of_Atari_5200_games",
        index: 1,
        category: "unreleased",
        minCells: 2,
        constantRegions: ["unreleased"],
        columns: {
          title: 0,
          publisher: 1,
          date: 2,
        },
      },
    ],
    regionLabels: {
      NA: "North America",
      unreleased: "Unreleased",
    },
    classicTitles: new Set(["Centipede", "Defender", "Missile Command", "Pac-Man", "Qix", "Star Raiders"]),
    categoryTags: {
      unreleased: ["unreleased"],
    },
    categoryPhrases: {
      licensed: "an Atari 5200 release",
      unreleased: "an unreleased Atari 5200 project",
    },
    strangeCategories: ["unreleased"],
    outputPath: new URL("../../src/data/atari-5200-catalog.generated.ts", import.meta.url),
  },
  genesis: {
    difficultSignals: ["alien soldier", "battletoads", "castlevania", "contra", "demon", "ghouls", "ghosts", "gradius", "last resort", "mega man", "metal slug", "ninja gaiden", "r-type", "shinobi", "splatterhouse", "thunder force", "zillion", "gunstar heroes", "contra hard corps"],
    casualSignals: ["casino", "chess", "columns", "fishing", "golf", "jeopardy", "mahjong", "monopoly", "pac-man", "pachi", "pinball", "puzzle", "solitaire", "tetris", "wheel of fortune", "sonic"],
    richStorySignals: ["beyond oasis", "breath of fire", "chrono", "dragon", "earthbound", "fantasy star", "final fantasy", "fire emblem", "lunar", "mana", "miracle warriors", "monster world", "neutopia", "phantasy star", "shadowrun", "shining", "snatcher", "star ocean", "ultima", "ys", "crusader of centy", "landstalker", "phantasy star", "shining force", "shining in the darkness", "soleil"],
    someStorySignals: ["adventure", "alex kidd", "batman", "castlevania", "comix zone", "demon", "dragon ball", "gaiden", "golden axe", "indiana jones", "jurassic park", "legend", "metroid", "ninja", "quest", "robocop", "shinobi", "star wars", "wonder boy", "streets of rage", "gunstar heroes"],
    playStyleRules: [
      {
        playStyle: "puzzle",
        tags: ["puzzle"],
        patterns: ["arkanoid", "columns", "klax", "lolo", "mahjong", "othello", "picross", "puyo", "puzzle", "shogi", "sudoku", "tetris"],
      },
      {
        playStyle: "action-adventure",
        tags: ["adventure"],
        patterns: ["beyond oasis", "breath of fire", "chrono", "dragon", "earthbound", "fantasy star", "final fantasy", "fire emblem", "lunar", "mana", "miracle warriors", "monster world", "neutopia", "phantasy star", "shadowrun", "shining", "snatcher", "star ocean", "ultima", "ys", "crusader of centy", "landstalker", "phantasy star", "shining force", "shining in the darkness", "soleil", "adventure", "landstalker", "metroid", "quest", "rpg", "wonder boy", "zelda"],
      },
      {
        playStyle: "top-down",
        tags: ["overhead"],
        patterns: ["baseball", "basketball", "bomberman", "football", "golf", "hockey", "nobunaga", "soccer", "strategy", "tennis", "volleyball", "war"],
      },
      {
        playStyle: "platformer",
        tags: ["platformer"],
        patterns: ["alex kidd", "bonk", "bubsy", "castle of illusion", "donkey kong", "earthworm", "kid chameleon", "mega man", "mickey", "shinobi", "sonic", "sparkster", "wonder boy"],
      },
    ],
    tagRules: [
      {
        tag: "sports",
        patterns: ["baseball", "basketball", "boxing", "football", "golf", "hockey", "olympic", "soccer", "tennis", "volleyball", "wrestl"],
      },
      {
        tag: "racing",
        patterns: ["f-1", "formula", "grand prix", "kart", "racer", "racing", "speedway"],
      },
      {
        tag: "shooter",
        patterns: ["after burner", "contra", "darius", "fantasy zone", "gradius", "gun", "metal slug", "r-type", "shoot", "space harrier", "star soldier", "thunder force", "zaxxon"],
      },
      {
        tag: "licensed character",
        patterns: ["addams", "batman", "bugs bunny", "captain america", "disney", "dragon ball", "flintstones", "godzilla", "mickey", "ninja turtles", "robocop", "simpsons", "star wars", "superman", "x-men"],
      },
      {
        tag: "board and card",
        patterns: ["blackjack", "casino", "chess", "mahjong", "monopoly", "poker", "shogi", "solitaire"],
      },
      {
        tag: "rpg",
        patterns: ["beyond oasis", "breath of fire", "chrono", "dragon", "earthbound", "fantasy star", "final fantasy", "fire emblem", "lunar", "mana", "miracle warriors", "monster world", "neutopia", "phantasy star", "shadowrun", "shining", "snatcher", "star ocean", "ultima", "ys", "crusader of centy", "landstalker", "phantasy star", "shining force", "shining in the darkness", "soleil"],
      },
      {
        tag: "horror",
        patterns: ["castlevania", "demon", "dracula", "ghost", "ghoul", "horror", "monster", "nightmare", "splatterhouse", "zombie"],
      },
      {
        tag: "strategy",
        patterns: ["a-train", "civilization", "nobunaga", "romance of the three kingdoms", "simcity", "strategy"],
      },
      {
        tag: "arcade port",
        patterns: ["after burner", "altered beast", "arkanoid", "bubble bobble", "galaga", "golden axe", "mortal kombat", "pac-man", "space harrier", "street fighter"],
      },
    ],
    moodRules: [
      {
        mood: "ominous",
        patterns: ["alien", "castle", "castlevania", "dark", "dead", "demon", "devil", "dragon", "ghost", "ghoul", "horror", "monster", "nightmare", "shadow", "splatterhouse", "zombie"],
      },
      {
        mood: "heroic",
        patterns: ["adventure", "alex kidd", "batman", "captain", "dragon", "fantasy star", "golden axe", "hero", "legend", "ninja", "phantasy star", "quest", "shinobi", "sonic", "star wars", "warrior", "wonder boy"],
      },
      {
        mood: "weird",
        patterns: ["alex kidd", "bonk", "bubble", "clayfighter", "comix", "fantasy zone", "kid chameleon", "magic", "mutant", "parodius", "toe jam", "weird"],
      },
      {
        mood: "arcade",
        patterns: ["arcade", "baseball", "battle", "bomberman", "columns", "contra", "golden axe", "metal slug", "pac-man", "pinball", "racing", "sports", "street fighter", "tetris"],
      },
      {
        mood: "contemplative",
        patterns: ["a-train", "chess", "civilization", "mahjong", "mystery", "othello", "puzzle", "shadowrun", "shogi", "simcity", "solitaire"],
      },
    ],
    scriptName: "scripts/generate-genesis-catalog.mjs",
    platform: "genesis",
    platformLabel: "Sega Genesis/Mega Drive",
    typePrefix: "Genesis",
    sourceExportName: "genesisCatalogSource",
    gamesExportName: "generatedGenesisGames",
    sourceName: "Wikipedia Sega Genesis/Mega Drive catalog tables",
    sources: [
      {
        name: "Wikipedia: List of Sega Genesis games",
        url: "https://en.wikipedia.org/wiki/List_of_Sega_Genesis_games",
      },
    ],
    sourceTables: [
      {
        url: "https://en.wikipedia.org/wiki/List_of_Sega_Genesis_games",
        index: 1,
        category: "licensed",
        minCells: 5,
        columns: {
          title: 0,
          developer: 1,
          publisher: 2,
          dates: [
            {
              region: "JP",
              index: 3,
            },
            {
              region: "NA",
              index: 4,
            },
            {
              region: "PAL",
              index: 5,
            },
          ],
        },
      },
      {
        url: "https://en.wikipedia.org/wiki/List_of_Sega_Genesis_games",
        index: 2,
        category: "compilation",
        minCells: 3,
        columns: {
          title: 0,
          developer: 1,
          publisher: 2,
          date: 3,
        },
      },
      {
        url: "https://en.wikipedia.org/wiki/List_of_Sega_Genesis_games",
        index: 3,
        category: "unlicensed",
        minCells: 5,
        columns: {
          title: 0,
          developer: 1,
          publisher: 2,
          dates: [
            {
              region: "JP",
              index: 3,
            },
            {
              region: "NA",
              index: 4,
            },
            {
              region: "PAL",
              index: 5,
            },
          ],
        },
      },
    ],
    regionLabels: {
      JP: "Japan",
      NA: "North America",
      PAL: "Europe/PAL",
    },
    classicTitles: new Set(["Gunstar Heroes", "Phantasy Star IV", "Sonic the Hedgehog", "Sonic the Hedgehog 2", "Streets of Rage 2", "Shining Force"]),
    categoryTags: {
      compilation: ["compilation"],
      unlicensed: ["unlicensed"],
    },
    categoryPhrases: {
      licensed: "a Sega Genesis/Mega Drive release",
      compilation: "a Sega Genesis/Mega Drive compilation cartridge",
      unlicensed: "an unlicensed Sega Genesis/Mega Drive release",
    },
    strangeCategories: ["compilation", "unlicensed"],
    outputPath: new URL("../../src/data/genesis-catalog.generated.ts", import.meta.url),
  },
  "pc-engine": {
    difficultSignals: ["alien soldier", "battletoads", "castlevania", "contra", "demon", "ghouls", "ghosts", "gradius", "last resort", "mega man", "metal slug", "ninja gaiden", "r-type", "shinobi", "splatterhouse", "thunder force", "zillion", "splatterhouse", "r-type"],
    casualSignals: ["casino", "chess", "columns", "fishing", "golf", "jeopardy", "mahjong", "monopoly", "pac-man", "pachi", "pinball", "puzzle", "solitaire", "tetris", "wheel of fortune", "bomberman", "bonk"],
    richStorySignals: ["beyond oasis", "breath of fire", "chrono", "dragon", "earthbound", "fantasy star", "final fantasy", "fire emblem", "lunar", "mana", "miracle warriors", "monster world", "neutopia", "phantasy star", "shadowrun", "shining", "snatcher", "star ocean", "ultima", "ys", "cosmic fantasy", "dragon slayer", "legendary axe", "neutopia", "ys"],
    someStorySignals: ["adventure", "alex kidd", "batman", "castlevania", "comix zone", "demon", "dragon ball", "gaiden", "golden axe", "indiana jones", "jurassic park", "legend", "metroid", "ninja", "quest", "robocop", "shinobi", "star wars", "wonder boy", "bonk", "splatterhouse"],
    playStyleRules: [
      {
        playStyle: "puzzle",
        tags: ["puzzle"],
        patterns: ["arkanoid", "columns", "klax", "lolo", "mahjong", "othello", "picross", "puyo", "puzzle", "shogi", "sudoku", "tetris"],
      },
      {
        playStyle: "action-adventure",
        tags: ["adventure"],
        patterns: ["beyond oasis", "breath of fire", "chrono", "dragon", "earthbound", "fantasy star", "final fantasy", "fire emblem", "lunar", "mana", "miracle warriors", "monster world", "neutopia", "phantasy star", "shadowrun", "shining", "snatcher", "star ocean", "ultima", "ys", "cosmic fantasy", "dragon slayer", "legendary axe", "neutopia", "ys", "adventure", "landstalker", "metroid", "quest", "rpg", "wonder boy", "zelda"],
      },
      {
        playStyle: "top-down",
        tags: ["overhead"],
        patterns: ["baseball", "basketball", "bomberman", "football", "golf", "hockey", "nobunaga", "soccer", "strategy", "tennis", "volleyball", "war"],
      },
      {
        playStyle: "platformer",
        tags: ["platformer"],
        patterns: ["alex kidd", "bonk", "bubsy", "castle of illusion", "donkey kong", "earthworm", "kid chameleon", "mega man", "mickey", "shinobi", "sonic", "sparkster", "wonder boy"],
      },
    ],
    tagRules: [
      {
        tag: "sports",
        patterns: ["baseball", "basketball", "boxing", "football", "golf", "hockey", "olympic", "soccer", "tennis", "volleyball", "wrestl"],
      },
      {
        tag: "racing",
        patterns: ["f-1", "formula", "grand prix", "kart", "racer", "racing", "speedway"],
      },
      {
        tag: "shooter",
        patterns: ["after burner", "contra", "darius", "fantasy zone", "gradius", "gun", "metal slug", "r-type", "shoot", "space harrier", "star soldier", "thunder force", "zaxxon"],
      },
      {
        tag: "licensed character",
        patterns: ["addams", "batman", "bugs bunny", "captain america", "disney", "dragon ball", "flintstones", "godzilla", "mickey", "ninja turtles", "robocop", "simpsons", "star wars", "superman", "x-men"],
      },
      {
        tag: "board and card",
        patterns: ["blackjack", "casino", "chess", "mahjong", "monopoly", "poker", "shogi", "solitaire"],
      },
      {
        tag: "rpg",
        patterns: ["beyond oasis", "breath of fire", "chrono", "dragon", "earthbound", "fantasy star", "final fantasy", "fire emblem", "lunar", "mana", "miracle warriors", "monster world", "neutopia", "phantasy star", "shadowrun", "shining", "snatcher", "star ocean", "ultima", "ys", "cosmic fantasy", "dragon slayer", "legendary axe", "neutopia", "ys"],
      },
      {
        tag: "horror",
        patterns: ["castlevania", "demon", "dracula", "ghost", "ghoul", "horror", "monster", "nightmare", "splatterhouse", "zombie"],
      },
      {
        tag: "strategy",
        patterns: ["a-train", "civilization", "nobunaga", "romance of the three kingdoms", "simcity", "strategy"],
      },
      {
        tag: "arcade port",
        patterns: ["after burner", "altered beast", "arkanoid", "bubble bobble", "galaga", "golden axe", "mortal kombat", "pac-man", "space harrier", "street fighter"],
      },
    ],
    moodRules: [
      {
        mood: "ominous",
        patterns: ["alien", "castle", "castlevania", "dark", "dead", "demon", "devil", "dragon", "ghost", "ghoul", "horror", "monster", "nightmare", "shadow", "splatterhouse", "zombie"],
      },
      {
        mood: "heroic",
        patterns: ["adventure", "alex kidd", "batman", "captain", "dragon", "fantasy star", "golden axe", "hero", "legend", "ninja", "phantasy star", "quest", "shinobi", "sonic", "star wars", "warrior", "wonder boy"],
      },
      {
        mood: "weird",
        patterns: ["alex kidd", "bonk", "bubble", "clayfighter", "comix", "fantasy zone", "kid chameleon", "magic", "mutant", "parodius", "toe jam", "weird"],
      },
      {
        mood: "arcade",
        patterns: ["arcade", "baseball", "battle", "bomberman", "columns", "contra", "golden axe", "metal slug", "pac-man", "pinball", "racing", "sports", "street fighter", "tetris"],
      },
      {
        mood: "contemplative",
        patterns: ["a-train", "chess", "civilization", "mahjong", "mystery", "othello", "puzzle", "shadowrun", "shogi", "simcity", "solitaire"],
      },
    ],
    scriptName: "scripts/generate-pc-engine-catalog.mjs",
    platform: "pc-engine",
    platformLabel: "PC Engine/TurboGrafx-16",
    typePrefix: "PcEngine",
    sourceExportName: "pcEngineCatalogSource",
    gamesExportName: "generatedPcEngineGames",
    sourceName: "Wikipedia PC Engine/TurboGrafx-16 catalog tables",
    sources: [
      {
        name: "Wikipedia: List of TurboGrafx-16 games",
        url: "https://en.wikipedia.org/wiki/List_of_TurboGrafx-16_games",
      },
    ],
    sourceTables: [
      {
        url: "https://en.wikipedia.org/wiki/List_of_TurboGrafx-16_games",
        index: 1,
        category: "licensed",
        minCells: 4,
        columns: {
          title: 0,
          publisher: 1,
          dates: [
            {
              region: "JP",
              index: 2,
            },
            {
              region: "NA",
              index: 3,
            },
          ],
          format: 4,
        },
      },
      {
        url: "https://en.wikipedia.org/wiki/List_of_TurboGrafx-16_games",
        index: 2,
        category: "promotional",
        minCells: 4,
        columns: {
          title: 0,
          publisher: 1,
          dates: [
            {
              region: "JP",
              index: 2,
            },
            {
              region: "NA",
              index: 3,
            },
          ],
          format: 4,
        },
      },
      {
        url: "https://en.wikipedia.org/wiki/List_of_TurboGrafx-16_games",
        index: 3,
        category: "unlicensed",
        minCells: 4,
        columns: {
          title: 0,
          publisher: 1,
          dates: [
            {
              region: "JP",
              index: 2,
            },
            {
              region: "NA",
              index: 3,
            },
          ],
          format: 4,
        },
      },
      {
        url: "https://en.wikipedia.org/wiki/List_of_TurboGrafx-16_games",
        index: 4,
        category: "homebrew",
        minCells: 3,
        columns: {
          title: 0,
          publisher: 1,
          date: 2,
          format: 3,
        },
      },
    ],
    regionLabels: {
      JP: "Japan",
      NA: "North America",
    },
    classicTitles: new Set(["Bonk's Adventure", "Bomberman '93", "Castlevania: Rondo of Blood", "Neutopia", "R-Type", "Splatterhouse"]),
    categoryTags: {
      promotional: ["promotional"],
      unlicensed: ["unlicensed"],
      homebrew: ["homebrew"],
    },
    categoryPhrases: {
      licensed: "a PC Engine/TurboGrafx-16 release",
      promotional: "a promotional PC Engine/TurboGrafx-16 release",
      unlicensed: "an unlicensed PC Engine/TurboGrafx-16 release",
      homebrew: "a homebrew PC Engine/TurboGrafx-16 release",
    },
    strangeCategories: ["promotional", "unlicensed", "homebrew"],
    outputPath: new URL("../../src/data/pc-engine-catalog.generated.ts", import.meta.url),
  },
  "neo-geo": {
    difficultSignals: ["alien soldier", "battletoads", "castlevania", "contra", "demon", "ghouls", "ghosts", "gradius", "last resort", "mega man", "metal slug", "ninja gaiden", "r-type", "shinobi", "splatterhouse", "thunder force", "zillion", "metal slug", "last blade", "king of fighters"],
    casualSignals: ["casino", "chess", "columns", "fishing", "golf", "jeopardy", "mahjong", "monopoly", "pac-man", "pachi", "pinball", "puzzle", "solitaire", "tetris", "wheel of fortune", "neo turf masters"],
    richStorySignals: ["beyond oasis", "breath of fire", "chrono", "dragon", "earthbound", "fantasy star", "final fantasy", "fire emblem", "lunar", "mana", "miracle warriors", "monster world", "neutopia", "phantasy star", "shadowrun", "shining", "snatcher", "star ocean", "ultima", "ys", "samurai shodown", "last blade", "king of fighters"],
    someStorySignals: ["adventure", "alex kidd", "batman", "castlevania", "comix zone", "demon", "dragon ball", "gaiden", "golden axe", "indiana jones", "jurassic park", "legend", "metroid", "ninja", "quest", "robocop", "shinobi", "star wars", "wonder boy", "fatal fury", "metal slug", "samurai shodown"],
    playStyleRules: [
      {
        playStyle: "puzzle",
        tags: ["puzzle"],
        patterns: ["arkanoid", "columns", "klax", "lolo", "mahjong", "othello", "picross", "puyo", "puzzle", "shogi", "sudoku", "tetris"],
      },
      {
        playStyle: "action-adventure",
        tags: ["adventure"],
        patterns: ["beyond oasis", "breath of fire", "chrono", "dragon", "earthbound", "fantasy star", "final fantasy", "fire emblem", "lunar", "mana", "miracle warriors", "monster world", "neutopia", "phantasy star", "shadowrun", "shining", "snatcher", "star ocean", "ultima", "ys", "samurai shodown", "last blade", "king of fighters", "adventure", "landstalker", "metroid", "quest", "rpg", "wonder boy", "zelda"],
      },
      {
        playStyle: "top-down",
        tags: ["overhead"],
        patterns: ["baseball", "basketball", "bomberman", "football", "golf", "hockey", "nobunaga", "soccer", "strategy", "tennis", "volleyball", "war"],
      },
      {
        playStyle: "platformer",
        tags: ["platformer"],
        patterns: ["alex kidd", "bonk", "bubsy", "castle of illusion", "donkey kong", "earthworm", "kid chameleon", "mega man", "mickey", "shinobi", "sonic", "sparkster", "wonder boy"],
      },
    ],
    tagRules: [
      {
        tag: "sports",
        patterns: ["baseball", "basketball", "boxing", "football", "golf", "hockey", "olympic", "soccer", "tennis", "volleyball", "wrestl"],
      },
      {
        tag: "racing",
        patterns: ["f-1", "formula", "grand prix", "kart", "racer", "racing", "speedway"],
      },
      {
        tag: "shooter",
        patterns: ["after burner", "contra", "darius", "fantasy zone", "gradius", "gun", "metal slug", "r-type", "shoot", "space harrier", "star soldier", "thunder force", "zaxxon"],
      },
      {
        tag: "licensed character",
        patterns: ["addams", "batman", "bugs bunny", "captain america", "disney", "dragon ball", "flintstones", "godzilla", "mickey", "ninja turtles", "robocop", "simpsons", "star wars", "superman", "x-men"],
      },
      {
        tag: "board and card",
        patterns: ["blackjack", "casino", "chess", "mahjong", "monopoly", "poker", "shogi", "solitaire"],
      },
      {
        tag: "rpg",
        patterns: ["beyond oasis", "breath of fire", "chrono", "dragon", "earthbound", "fantasy star", "final fantasy", "fire emblem", "lunar", "mana", "miracle warriors", "monster world", "neutopia", "phantasy star", "shadowrun", "shining", "snatcher", "star ocean", "ultima", "ys", "samurai shodown", "last blade", "king of fighters"],
      },
      {
        tag: "horror",
        patterns: ["castlevania", "demon", "dracula", "ghost", "ghoul", "horror", "monster", "nightmare", "splatterhouse", "zombie"],
      },
      {
        tag: "strategy",
        patterns: ["a-train", "civilization", "nobunaga", "romance of the three kingdoms", "simcity", "strategy"],
      },
      {
        tag: "arcade port",
        patterns: ["after burner", "altered beast", "arkanoid", "bubble bobble", "galaga", "golden axe", "mortal kombat", "pac-man", "space harrier", "street fighter"],
      },
    ],
    moodRules: [
      {
        mood: "ominous",
        patterns: ["alien", "castle", "castlevania", "dark", "dead", "demon", "devil", "dragon", "ghost", "ghoul", "horror", "monster", "nightmare", "shadow", "splatterhouse", "zombie"],
      },
      {
        mood: "heroic",
        patterns: ["adventure", "alex kidd", "batman", "captain", "dragon", "fantasy star", "golden axe", "hero", "legend", "ninja", "phantasy star", "quest", "shinobi", "sonic", "star wars", "warrior", "wonder boy"],
      },
      {
        mood: "weird",
        patterns: ["alex kidd", "bonk", "bubble", "clayfighter", "comix", "fantasy zone", "kid chameleon", "magic", "mutant", "parodius", "toe jam", "weird"],
      },
      {
        mood: "arcade",
        patterns: ["arcade", "baseball", "battle", "bomberman", "columns", "contra", "golden axe", "metal slug", "pac-man", "pinball", "racing", "sports", "street fighter", "tetris"],
      },
      {
        mood: "contemplative",
        patterns: ["a-train", "chess", "civilization", "mahjong", "mystery", "othello", "puzzle", "shadowrun", "shogi", "simcity", "solitaire"],
      },
    ],
    scriptName: "scripts/generate-neo-geo-catalog.mjs",
    platform: "neo-geo",
    platformLabel: "Neo Geo AES",
    typePrefix: "NeoGeo",
    sourceExportName: "neoGeoCatalogSource",
    gamesExportName: "generatedNeoGeoGames",
    sourceName: "Wikipedia Neo Geo catalog tables",
    sources: [
      {
        name: "Wikipedia: List of Neo Geo games",
        url: "https://en.wikipedia.org/wiki/List_of_Neo_Geo_games",
      },
    ],
    sourceTables: [
      {
        url: "https://en.wikipedia.org/wiki/List_of_Neo_Geo_games",
        index: 1,
        category: "aes-mvs",
        minCells: 5,
        columns: {
          title: 0,
          developer: 1,
          publisher: 2,
          dates: [
            {
              region: "JP",
              index: 3,
            },
            {
              region: "NA",
              index: 4,
            },
            {
              region: "AES",
              index: 5,
            },
          ],
        },
      },
    ],
    regionLabels: {
      JP: "Japan",
      NA: "North America",
      AES: "Neo Geo AES",
    },
    classicTitles: new Set(["3 Count Bout", "Fatal Fury", "Metal Slug", "Neo Turf Masters", "Samurai Shodown", "The King of Fighters '94"]),
    categoryTags: {
      "aes-mvs": ["arcade", "AES cartridge"],
    },
    categoryPhrases: {
      "aes-mvs": "a Neo Geo AES/MVS release",
    },
    strangeCategories: [],
    outputPath: new URL("../../src/data/neo-geo-catalog.generated.ts", import.meta.url),
  }
};
