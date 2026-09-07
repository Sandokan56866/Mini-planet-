// O que faz: Centraliza todas as constantes, configurações, tabelas de tipos de zumbis, resistências progressivas e parâmetros do jogo sem números mágicos.
// Exporta: Constantes numéricas, paletas visuais, estatísticas de zumbis, upgrades e limites de pools.
// Depende de: Nenhum (módulo independente).

// ==========================================
// 1. PLANETA E TERRENO (R = 22)
// ==========================================
export const PLANET_BASE_RADIUS = 22.0;
export const WATER_RADIUS = 21.84;
export const SEA_LEVEL = 0.32;
export const STEP_HEIGHT = 0.28;
export const TOTAL_STEPS = 7;
export const DEBUG = false;
export const DEBUG_RESET = false;

export const ELEV_FREQ = 0.83;
export const ELEV_OFFSET_X = 14.2;
export const ELEV_OFFSET_Y = 37.8;
export const ELEV_OFFSET_Z = 81.5;

export const MOIST_FREQ = 0.42;
export const MOIST_OFFSET_X = 72.3;
export const MOIST_OFFSET_Y = 19.6;
export const MOIST_OFFSET_Z = 53.1;

export const SECTOR_FREQ = 0.45;
export const SECTOR_OFFSET_X = 54.7;
export const SECTOR_OFFSET_Y = 28.3;
export const SECTOR_OFFSET_Z = 92.1;

export const BIOMES = {
  SUBURB: "suburb",
  FOREST: "forest",
  INDUSTRIAL: "industrial",
  DESERT: "desert",
  SWAMP: "swamp",
  FROZEN: "frozen"
};

export const BIOMES_CONFIG = {
  suburb: {
    id: "suburb",
    name: "Subúrbio Arrasado",
    icon: "🏚️",
    baseColor: 0x424245,
    secondaryColor: 0x545458,
    cliffColor: 0x2e2e30,
    propDensity: 0.85
  },
  forest: {
    id: "forest",
    name: "Floresta Morta",
    icon: "🌲",
    baseColor: 0x34281e,
    secondaryColor: 0x443628,
    cliffColor: 0x241c15,
    propDensity: 1.10
  },
  industrial: {
    id: "industrial",
    name: "Zona Industrial",
    icon: "🏭",
    baseColor: 0x5c4a3e,
    secondaryColor: 0x4a3d34,
    cliffColor: 0x382c25,
    propDensity: 1.35
  },
  desert: {
    id: "desert",
    name: "Deserto de Cinzas",
    icon: "🏜️",
    baseColor: 0xa6a092,
    secondaryColor: 0x918a7c,
    cliffColor: 0x6e685c,
    propDensity: 0.40
  },
  swamp: {
    id: "swamp",
    name: "Pântano Tóxico",
    icon: "☣️",
    baseColor: 0x3e4a2e,
    secondaryColor: 0x4f6336,
    cliffColor: 0x28331d,
    propDensity: 0.90
  },
  frozen: {
    id: "frozen",
    name: "Zona Gelada",
    icon: "❄️",
    baseColor: 0xc2cbd6,
    secondaryColor: 0xb0bcc9,
    cliffColor: 0x7a8794,
    propDensity: 0.75
  }
};

export const BIOME_COLORS = {
  waterBed: 0x223028,
  water: 0x253830,
  waterSpecular: 0x000000,
  asphalt: 0x424245,
  crackedAsphalt: 0x545458,
  darkEarth: 0x34281e,
  dryLeaves: 0x443628,
  rustConcrete: 0x5c4a3e,
  stainedConcrete: 0x4a3d34,
  ashSand: 0xa6a092,
  ashSandDark: 0x918a7c,
  sludge: 0x3e4a2e,
  toxicGreen: 0x4f6336,
  snow: 0xc2cbd6,
  snowSub: 0xb0bcc9,
  sand: 0xa6a092,
  crackedMud: 0x5c4a3e,
  dryGrass: 0x443628
};

export const CLIFF_SLOPE_THRESHOLD = 0.82;
export const CLIFF_DARKEN_FACTOR = 0.78;

// ==========================================
// 2. ILUMINAÇÃO, CÉU E ATMOSFERA
// ==========================================
export const SKY_BG_COLOR = 0xd8cfbc;
export const FOG_COLOR = 0xd8cfbc;
export const FOG_DENSITY = 0.010;

export const SUN_COLOR = 0xffeedd;
export const SUN_INTENSITY = 1.15;
export const SUN_POSITION = { x: 24, y: 45, z: 28 };

export const HEMI_SKY_COLOR = 0xffeedd;
export const HEMI_GROUND_COLOR = 0x5a4a3a;
export const HEMI_INTENSITY = 0.70;

// Ciclo Dia e Noite (Total: 200s - 70s dia, 20s entardecer, 90s noite, 20s amanhecer)
export const DAY_CYCLE_TOTAL = 200.0;
export const DAY_PHASE_DURATION = 70.0;
export const SUNSET_PHASE_DURATION = 20.0;
export const NIGHT_PHASE_DURATION = 90.0;
export const DAWN_PHASE_DURATION = 20.0;

// Lanterna de peito (PointLight preso ao peito, alcance ~4.40, cor quente alaranjada)
export const CHEST_LIGHT_COLOR = 0xffaa5e;
export const CHEST_LIGHT_DISTANCE = 4.40;
export const CHEST_LIGHT_INTENSITY = 1.70;
export const CHEST_LIGHT_DECAY = 1;
export const CHEST_LIGHT_FADE_DURATION = 2.0;

// Piso de luz ambiente noturna e controle de névoa
export const NIGHT_HEMI_INTENSITY_FLOOR = 0.38;
export const NIGHT_HEMI_SKY_COLOR = 0x2e3c54;
export const NIGHT_HEMI_GROUND_COLOR = 0x1a202c;
export const NIGHT_FOG_MAX_DENSITY = 0.018;
export const NIGHT_FOG_COLOR = 0x161e2c;

export const FLASHLIGHT_INTENSITY = 0;
export const FLASHLIGHT_FADE_DURATION = 2.0;

export const ASH_COUNT = 350;
export const ASH_COLOR = 0xff8855;
export const ASH_OPACITY = 0.5;
export const ASH_SIZE = 0.8;

export const SMOKE_COLOR = 0x2a2024;
export const SMOKE_OPACITY = 0.45;
export const SMOKE_CLUSTERS_COUNT = 8;
export const SMOKE_PUFFS_PER_CLUSTER = 5;

export const BARREL_FIRE_LIGHT_COLOR = 0xff6611;
export const BARREL_FIRE_LIGHT_BASE_INTENSITY = 1.4;
export const BARREL_FIRE_LIGHT_DISTANCE = 8;

// ==========================================
// 3. CÂMERA EM TERCEIRA PESSOA E ARRASTO
// ==========================================
export const CAM_FOV = 45;
export const CAM_NEAR = 0.1;
export const CAM_FAR = 180;
// Distância FIXA da câmera no valor mais distante (zoom e pinça removidos)
export const CAM_FIXED_DISTANCE = 11.2;
export const CAM_DISTANCE = CAM_FIXED_DISTANCE;
export const BASE_CAM_DISTANCE = CAM_FIXED_DISTANCE;
export const ZOOMED_CAM_DISTANCE = CAM_FIXED_DISTANCE;
export const MIN_CAM_DISTANCE = CAM_FIXED_DISTANCE;
export const MAX_CAM_DISTANCE = CAM_FIXED_DISTANCE;
export const CAM_HEIGHT_RATIO = 3.2 / 7.5;
export const CAM_LOOKAT_OFFSET_Y = 0.9;

export const CAM_LERP_FACTOR = 0.12;
export const CAM_YAW_LERP_FACTOR = 0.12;
export const CAM_PITCH_LERP_FACTOR = 0.12;

export const CAM_TOUCH_SENSITIVITY = 0.007;
export const CAM_PITCH_SENSITIVITY = 0.005;

export const CAM_PITCH_MIN = 15.0 * (Math.PI / 180.0);
export const CAM_PITCH_MAX = 55.0 * (Math.PI / 180.0);
export const CAM_PITCH_DEFAULT = 24.0 * (Math.PI / 180.0);

// ==========================================
// 4. ELEMENTOS DE CENÁRIO (PROPS) E LIMITES
// ==========================================
export const PROP_CANDIDATES = 2400;

// Limites de InstancedMesh para os 6 Biomas
export const MAX_HOUSES = 60;
export const MAX_CARS = 60;
export const MAX_POLES = 70;
export const MAX_FENCES = 80;
export const MAX_WATER_TANKS = 30;
export const MAX_STREET_SIGNS = 60;

export const MAX_DEAD_TREES = 180;
export const MAX_STUMPS = 80;
export const MAX_FALLEN_LOGS = 70;
export const MAX_BARBED_WIRE = 60;
export const MAX_CAMPFIRES = 30;

export const MAX_INDUSTRIAL_TANKS = 50;
export const MAX_PIPES = 70;
export const MAX_CONTAINERS = 90;
export const MAX_FORKLIFTS = 30;
export const MAX_SCAFFOLDS = 40;
export const MAX_BURNING_BARRELS = 12;

export const MAX_BUSES = 20;
export const MAX_GIANT_BONES = 50;
export const MAX_BURIED_DEBRIS = 70;
export const MAX_POWER_PYLONS = 30;

export const MAX_STILT_SHACKS = 50;
export const MAX_SWAMP_LOGS = 60;
export const MAX_TOXIC_BARRELS = 80;
export const MAX_DEAD_REEDS = 100;

export const MAX_PINES = 120;
export const MAX_SNOW_CARS = 40;
export const MAX_CABINS = 40;
export const MAX_ICE_BLOCKS = 60;
export const MAX_SNOW_FENCES = 50;

// Cores temáticas dos Props Low-Poly com FlatShading
export const PROP_COLORS = {
  // Subúrbio
  ruinedHouse: 0x56534e,
  houseRoof: 0x3d3935,
  carWreck: 0x6e3b38,
  pole: 0x3d3a36,
  fence: 0x5a432e,
  waterTank: 0x525c62,
  streetSign: 0x2e523e,
  rubble: 0x545458,

  // Floresta
  deadTree: 0x423428,
  stump: 0x382c20,
  fallenLog: 0x3f3123,
  barbedWire: 0x484848,
  campfire: 0x1e1c1a,
  trailer: 0x7e786d,

  // Industrial
  industrialTank: 0x584c42,
  pipe: 0x423e38,
  containerA: 0x8a452a,
  containerB: 0x2d4b68,
  forklift: 0xa67c1e,
  scaffold: 0x383a3d,
  barrel: 0x7a3e26,

  // Deserto
  busWreck: 0x746d5f,
  giantBone: 0xd8d3c5,
  buriedDebris: 0x615c54,
  powerPylon: 0x444648,
  crashedPlane: 0x888b90,

  // Pântano
  stiltShack: 0x38352b,
  swampLog: 0x242820,
  toxicBarrel: 0x3d5c2e,
  toxicSludgePuddle: 0x4f6632,
  deadReeds: 0x4e5032,

  // Gelada
  driedPine: 0x4a544c,
  snowCar: 0x8fa3b0,
  brokenCabin: 0x4a3c30,
  iceBlock: 0xa8bed0,
  snowFence: 0x5c4d3d
};

// ==========================================
// 5. JOGADOR (SOBREVIVENTE) E STAMINA / CORRIDA
// ==========================================
export const INITIAL_PLAYER_HP = 100;
export const INITIAL_MAX_HP = 100;
export const MAX_FORWARD_SPEED = 0.12;
export const MAX_TURN_SPEED = 2.4;

export const STAMINA_MAX = 100.0;
export const STAMINA_DRAIN_RATE = 28.0;
export let STAMINA_REGEN_RATE = 18.0;
export function setStaminaRegenRate(rate) {
  STAMINA_REGEN_RATE = rate;
}
export const STAMINA_REGEN_DELAY = 0.8;
export const STAMINA_RECOVERY_MIN = 25.0;
export const SPRINT_THRESHOLD = 0.85;
export const SPRINT_SPEED_MULTIPLIER = 1.6;

export const PLAYER_COLORS = {
  skin: 0xffd8b0,
  jacket: 0x3d6840,
  pants: 0x2e3532,
  backpack: 0x5c4033,
  cap: 0xb91c1c,
  rifle: 0x222222,
  arms: 0x3d6840,
  eye: 0x111111,
  muzzle: 0xffe066,
  levelLight: 0xfacc15
};

// ==========================================
// 6. RESISTÊNCIA PROGRESSIVA POR ONDA
// ==========================================
// Crescimento composto suave de vida base por onda (+8% por onda, teto de 3.0x)
export const WAVE_HP_GROWTH_RATE = 0.08;
export const WAVE_HP_GROWTH_CAP = 3.0;

// Bônus do inimigo reforçado
export const REINFORCED_HP_MULTIPLIER = 1.8;
export const REINFORCED_SCALE_MULTIPLIER = 1.15;
export const REINFORCED_DARKEN_FACTOR = 0.65; // Escurecimento nítido dos tons de pele e roupa

// Proporção de inimigos reforçados por onda (0% na onda 1, escalando suavemente até ~55% na onda 12)
export const REINFORCED_FRACTION_BY_WAVE = [
  0.00, // Onda 1: 0%
  0.04, // Onda 2: ~4%
  0.08, // Onda 3: ~8%
  0.13, // Onda 4: ~13%
  0.18, // Onda 5: ~18%
  0.24, // Onda 6: ~24%
  0.30, // Onda 7: ~30%
  0.36, // Onda 8: ~36%
  0.42, // Onda 9: ~42%
  0.47, // Onda 10: ~47%
  0.51, // Onda 11: ~51%
  0.55  // Onda 12+: 55%
];

export function getReinforcedChance(wave) {
  if (wave <= 1) return 0.0;
  if (wave <= REINFORCED_FRACTION_BY_WAVE.length) {
    return REINFORCED_FRACTION_BY_WAVE[wave - 1];
  }
  // Após a onda 12, sobe lentamente com teto em 65%
  return Math.min(0.65, 0.55 + (wave - 12) * 0.012);
}

// ==========================================
// 7. INIMIGOS: CONFIGURAÇÃO DE TIPOS E ATRIBUTOS BASE
// ==========================================
export const MAX_ZOMBIES = 150; // Capacidade ampliada do pool para suportar 90 simultâneos e levas de enxames
export const MAX_ACTIVE_ZOMBIES_LIMIT = 90;
export const INITIAL_ZOMBIES_COUNT = 12;
export const ZOMBIE_HIT_FLASH_DURATION = 0.08;
export const ZOMBIE_DIE_DURATION = 0.8;
export const ZOMBIE_ATTACK_RADIUS = 0.045; // radianos na esfera (~1 unidade)

export const BASE_SPAWN_INTERVAL = 0.68;
export const MIN_SPAWN_INTERVAL = 0.14;
export const SPAWN_INTERVAL_DECAY = 0.90;

export const ZOMBIE_BASE_SPEED = 0.040;

export const ZOMBIE_SPEED_RATIOS = {
  common: 1.00,
  runner: 1.70,
  tank: 0.45,
  spitter: 0.55,
  swarm: 1.55,
  armored: 0.78,
  screamer: 1.60,
  crawler: 0.50,
  boss: 0.35,
  butcher: 0.42
};

export const ZOMBIE_SPEED_VARIATION = 0.18;
export const ZOMBIE_SPEED_GROWTH_PER_WAVE = 0.025;
export const ZOMBIE_SPEED_MAX_MULTIPLIER = 1.60;
export const ZOMBIE_TERRAIN_LERP_FACTOR = 0.25;

export const ZOMBIE_MODEL_ROTATION_Y_OFFSET = Math.PI;
export const ZOMBIE_ROTATION_SLERP_FACTOR = 0.20;

export const ZOMBIE_WALK_CONFIG = {
  legAmplitude: 0.50,
  bobAmplitude: 0.025,
  swayAmplitude: 0.08,
  armSwingBase: 0.15,
  strideLength: {
    common: 0.26,
    runner: 0.16,
    tank: 0.40,
    spitter: 0.28,
    swarm: 0.12,
    armored: 0.32,
    screamer: 0.18,
    crawler: 0.20,
    boss: 0.48
  }
};

// Vidas base em config.js
export const COMMON_ZOMBIE_BASE_HP = 3;
export const RUNNER_ZOMBIE_HP = 2;
export const TANK_ZOMBIE_HP = 16;
export const SPITTER_ZOMBIE_HP = 4;
export const SWARM_ZOMBIE_HP = 1;
export const ARMORED_ZOMBIE_HP = 14;
export const SCREAMER_ZOMBIE_HP = 3;
export const CRAWLER_ZOMBIE_HP = 6;
export const BOSS_ZOMBIE_BASE_HP = 90;
export const BUTCHER_ZOMBIE_BASE_HP = 125;

export const BOSS_SCALE = 2.5;
export const BUTCHER_SCALE = 3.0;
export const BOSS_FREEZE_FRAME_DURATION = 0.06;
export const BOSS_ANNOUNCEMENT_DURATION_MS = 2200;

// Paleta visual e especificações completas de cada tipo
export const ZOMBIE_TYPES = {
  common: {
    minWave: 1,
    hp: COMMON_ZOMBIE_BASE_HP,
    speedRatio: ZOMBIE_SPEED_RATIOS.common,
    scale: 1.0,
    xp: 10,
    damage: 10,
    skinColor: 0x6b8f5a,
    clothColor: 0x43403a,
    eyeColor: 0xfee2e2
  },
  runner: {
    minWave: 3,
    hp: RUNNER_ZOMBIE_HP,
    speedRatio: ZOMBIE_SPEED_RATIOS.runner,
    scale: 0.92,
    xp: 14,
    damage: 10,
    skinColor: 0xb91c1c,
    clothColor: 0x3b1818,
    eyeColor: 0xfee2e2
  },
  tank: {
    minWave: 4,
    hp: TANK_ZOMBIE_HP,
    speedRatio: ZOMBIE_SPEED_RATIOS.tank,
    scale: 1.6,
    xp: 40,
    damage: 16,
    skinColor: 0x22381f,
    clothColor: 0x1c2118,
    eyeColor: 0xff2222
  },
  spitter: {
    minWave: 5,
    hp: SPITTER_ZOMBIE_HP,
    speedRatio: ZOMBIE_SPEED_RATIOS.spitter,
    scale: 1.12,
    xp: 22,
    damage: 12,
    skinColor: 0x7fae32,
    clothColor: 0x475e1b,
    bubbleColor: 0xd4e12e,
    eyeColor: 0xd4e12e
  },
  crawler: {
    minWave: 6,
    hp: CRAWLER_ZOMBIE_HP,
    speedRatio: ZOMBIE_SPEED_RATIOS.crawler,
    scale: 0.85,
    hitRadiusMultiplier: 0.68, // Silhueta muito baixa: raio de acerto reduzido
    xp: 24,
    damage: 14,
    skinColor: 0x5c3a21,
    clothColor: 0x3a2414,
    eyeColor: 0xff4422
  },
  swarm: {
    minWave: 7,
    hp: SWARM_ZOMBIE_HP,
    speedRatio: ZOMBIE_SPEED_RATIOS.swarm,
    scale: 0.60,
    xp: 4,
    damage: 6,
    skinColor: 0x27272a,
    clothColor: 0x18181b,
    eyeColor: 0xef4444
  },
  armored: {
    minWave: 8,
    hp: ARMORED_ZOMBIE_HP,
    speedRatio: ZOMBIE_SPEED_RATIOS.armored,
    scale: 1.25,
    xp: 35,
    damage: 15,
    skinColor: 0x4b5563,
    clothColor: 0x374151,
    armorColor: 0x9ca3af,
    eyeColor: 0xef4444
  },
  screamer: {
    minWave: 9,
    hp: SCREAMER_ZOMBIE_HP,
    speedRatio: ZOMBIE_SPEED_RATIOS.screamer,
    scale: 0.95,
    xp: 30,
    damage: 8,
    skinColor: 0x9ca3af,
    clothColor: 0x4b5563,
    mouthColor: 0x18181b,
    eyeColor: 0xffffff
  },
  boss: {
    hp: BOSS_ZOMBIE_BASE_HP,
    baseSpeed: ZOMBIE_BASE_SPEED * ZOMBIE_SPEED_RATIOS.boss,
    scale: BOSS_SCALE,
    xp: 220,
    damage: 25,
    skinColor: 0x1b221a,
    clothColor: 0x141614,
    eyeColor: 0xff2222
  }
};

export const ZOMBIE_COLORS = {
  hitFlash: 0xffffff
};

// ==========================================
// 8. COMPOSIÇÃO DAS ONDAS (TABELA ÚNICA DE PESOS POR FAIXA)
// ==========================================
// Nenhuma onda normal é composta por um tipo só.
// Cada tipo entra a partir da sua onda mínima e ganha presença progressiva.
export const WAVE_SPAWN_COMPOSITION = [
  // Faixa 1: Ondas 1 a 2 (Comuns e primeiros Corredores para ritmo)
  {
    maxWave: 2,
    weights: {
      common: 82,
      runner: 18
    }
  },
  // Faixa 2: Ondas 3 a 4 (Introdução de Tanques)
  {
    maxWave: 4,
    weights: {
      common: 58,
      runner: 28,
      tank: 14
    }
  },
  // Faixa 3: Onda 5 (Estreia do Cuspidor)
  {
    maxWave: 5,
    weights: {
      common: 42,
      runner: 24,
      tank: 16,
      spitter: 18
    }
  },
  // Faixa 4: Onda 6 (Estreia do Rastejante)
  {
    maxWave: 6,
    weights: {
      common: 34,
      runner: 20,
      tank: 15,
      spitter: 16,
      crawler: 15
    }
  },
  // Faixa 5: Onda 7 (Estreia do Enxame em grupos de 5-8)
  {
    maxWave: 7,
    weights: {
      common: 25,
      runner: 18,
      tank: 14,
      spitter: 15,
      crawler: 14,
      swarm: 14
    }
  },
  // Faixa 6: Onda 8 (Estreia do Blindado com placas frontais)
  {
    maxWave: 8,
    weights: {
      common: 18,
      runner: 16,
      tank: 12,
      spitter: 14,
      crawler: 13,
      swarm: 14,
      armored: 13
    }
  },
  // Faixa 7: Onda 9 (Estreia do Ululante que atrai a horda)
  {
    maxWave: 9,
    weights: {
      common: 14,
      runner: 14,
      tank: 11,
      spitter: 13,
      crawler: 13,
      swarm: 13,
      armored: 12,
      screamer: 10
    }
  },
  // Faixa 8: Ondas 11+ (Hordas avançadas com todos os tipos em alta densidade)
  {
    maxWave: Infinity,
    weights: {
      common: 11,
      runner: 15,
      tank: 12,
      spitter: 14,
      crawler: 13,
      swarm: 14,
      armored: 12,
      screamer: 9
    }
  }
];

export function getSpawnTypeForWave(wave) {
  for (var i = 0; i < WAVE_SPAWN_COMPOSITION.length; i++) {
    var tier = WAVE_SPAWN_COMPOSITION[i];
    if (wave <= tier.maxWave) {
      var weights = tier.weights;
      var totalWeight = 0;
      for (var t in weights) {
        totalWeight += weights[t];
      }
      var rand = Math.random() * totalWeight;
      var acc = 0;
      for (var typeName in weights) {
        acc += weights[typeName];
        if (rand <= acc) {
          return typeName;
        }
      }
      return "common";
    }
  }
  return "common";
}

// Parâmetros de mecânica específicos dos inimigos
export const SPITTER_STOP_DISTANCE_RAD = 0.25; // Para a ~5.5 unidades de distância
export const SPITTER_SHOOT_COOLDOWN = 4.0;     // Mínimo de 4 segundos entre cuspidas do mesmo inimigo
export const SPITTER_WINDUP_DURATION = 0.9;    // 0,9s de telegrafia visível antes de cuspir
export const SPITTER_PROJECTILE_SPEED = 0.168; // Redução de 40% (esquivável a pé)
export const SPITTER_PROJECTILE_DAMAGE = 7;    // Dano reduzido pela metade (de 14 para 7)
export const SPITTER_MAX_COUNT_EARLY = 4;      // No máximo 4 Cuspidores simultâneos até a onda 10
export const SPITTER_MAX_COUNT_LATE = 7;       // No máximo 7 Cuspidores simultâneos depois da onda 10
export const SPITTER_AIM_ERROR_DEG = 8.0;      // Erro aleatório de mira de ±8 graus
export const SPITTER_MIN_SPAWN_DIST_RAD = 0.55;// Cuspidores nascem longe do jogador
export const SPITTER_STAGGER_DELAY = 0.5;      // Adia em 0.5s se dois cuspidores tentarem preparar juntos

export const SWARM_SPAWN_COUNT_MIN = 5;
export const SWARM_SPAWN_COUNT_MAX = 8;

export const ARMORED_FRONTAL_DOT_THRESHOLD = 0.20; // Encarando o tiro: produto escalar > 0.2
export const ARMORED_FRONTAL_DAMAGE_FACTOR = 0.50; // Recebe metade do dano pela frente

export const SCREAMER_TRIGGER_DISTANCE_RAD = 0.38;
export const SCREAMER_DURATION = 1.3;
export const SCREAMER_CALL_BOOST_SPEED_MULTIPLIER = 1.40;
export const SCREAMER_CALL_BOOST_DURATION = 5.0;
export const SCREAMER_SPAWN_ACCEL_DURATION = 4.0;

export const CRAWLER_HIT_THRESHOLD = 0.027; // Raio de acerto reduzido em relação a 0.040

// Chefe Carniceiro (Butcher)
export const BUTCHER_CHARGE_INTERVAL = 5.5;
export const BUTCHER_WINDUP_DURATION = 1.5;
export const BUTCHER_CHARGE_DURATION = 2.0;
export const BUTCHER_REST_DURATION = 1.5;
export const BUTCHER_CHARGE_SPEED_MULTIPLIER = 3.4;
export const BUTCHER_SPAWN_SWARM_CHANCE_ON_HIT = 0.18;

// ==========================================
// 9. SISTEMA DE MIRA AUTOMÁTICA E COMBATE
// ==========================================
export const BASE_AIM_RANGE_DAY = 0.38;
export const AIM_RANGE_NIGHT_FACTOR = 0.55;
export const RANGE_UPGRADE_STEP = 0.04;

export const AUTO_AIM_TURN_SPEED = 6.0;
export const AIM_ALIGN_TOLERANCE_DEG = 12.0;
export const AIM_ALIGN_TOLERANCE_RAD = 12.0 * (Math.PI / 180.0);

export const TARGET_LOCK_MIN_TIME = 0.40;
export const TARGET_HYSTERESIS_MARGIN = 0.25;
export const TARGET_SEARCH_FRAME_INTERVAL = 6;

export const MAX_BULLETS = 60;
export const BASE_SHOOT_INTERVAL = 0.38;
export const BASE_BULLET_SPEED = 0.95;
export const BASE_BULLET_LIFE = 1.4;
export const BASE_BULLET_DAMAGE = 1;
export const BULLET_COLOR_NORMAL = 0xffdf55;
export const BULLET_COLOR_FRENZY = 0xff4422;
export const SPREAD_ANGLE_STEP = 0.07;
export const CRIT_CHANCE = 0.18;
export const CRIT_MULTIPLIER = 2;
export const FREEZE_FRAME_DURATION = 0.04;
export const BULLET_BASE_SPEED = BASE_BULLET_SPEED;
export const BULLET_MAX_LIFE = BASE_BULLET_LIFE;

// ==========================================
// 10. ITENS COLETÁVEIS (PICKUPS) E ORBES DE XP
// ==========================================
export const MAX_PICKUPS = 25;
export const PICKUP_DROP_CHANCE = 0.14;
// APENAS orbes de XP têm atração. Demais itens ficam 100% estáticos (0.0).
export const PICKUP_MAGNET_RAD = 0.0;
export const PICKUP_COLLECT_RAD = 0.045;
export const PICKUP_COLLECT_RADIUS = PICKUP_COLLECT_RAD;
export const FRENZY_DURATION = 8.0;
export const MEDKIT_HEAL_AMOUNT = 20; // Reduzido de 35 para 20 de vida por kit
export const MEDKIT_MIN_INTERVAL = 25.0; // Intervalo mínimo de 25 segundos entre drops de vida
export const BOMB_BOSS_DAMAGE = 25;
export const PICKUP_BOMB_RADIUS = 0.15;

export const PICKUP_COLORS = {
  medkit: 0x22c55e,
  medkitEmissive: 0x15803d,
  frenzy: 0xef4444,
  frenzyEmissive: 0xb91c1c,
  bomb: 0x1e293b,
  bombEmissive: 0xf97316
};

// Cubos de XP (formato quadrado, tamanho reduzido e fixos no local onde foram dropados)
export const XP_ORB_SIZE = 0.065;
export const XP_ORB_RADIUS = 0.065;
export const XP_ORB_COLOR = 0x38bdf8;
export const XP_ORB_EMISSIVE = 0x0284c7;
export const BASE_XP_MAGNET_RAD = 0.030;
export const XP_MAGNET_STEP_PER_LEVEL = 0.35;
export const XP_ORB_COLLECT_RAD = 0.032;

// Baús de Itens pelo Mapa (coletados por contato fixo)
export const CHEST_RESPAWN_INTERVAL = 20.0;
export const MAX_SIMULTANEOUS_CHESTS = 12;
export const INITIAL_CHESTS_COUNT = 6;
export const CHEST_COLLECT_RADIUS = 0.045;
export const CHEST_TYPES_WEIGHTS = {
  weapon: 0.40,
  device: 0.35,
  consumable: 0.25
};
export const MACHINEGUN_MIN_WAVE = 8;
export const MACHINEGUN_CHANCE = 0.10;

// Configurações do Sistema de Bombas e Drones
export const INITIAL_BOMBS = 2;
export const MAX_BOMBS = 5;
export const BOMB_DAMAGE = 25;
export const BOMB_BASE_RADIUS = 0.16; // Raio inicial reduzido para ~1/3 do anterior (limpa entorno imediato)
export const BOMB_RADIUS_STEP = 0.25; // +25% no raio por nível (Carga Ampliada)
export const BOMB_MAX_RADIUS_LEVEL = 4;
export const BOMB_RADIUS = BOMB_BASE_RADIUS;
export const BOMB_KNOCKBACK = 0.18;

export const DRONE_BASE_DURATION = 45.0;
export const DRONE_BASE_DAMAGE = 1;
export const DRONE_BASE_FIRE_RATE = 0.50;
export const DRONE_RANGE = 0.45;
export const DRONE_ORBIT_RADIUS = 0.85;
export const DRONE_HEIGHT = 1.10;
export const DRONE_ORBIT_SPEED = 2.2;

// Tabela de Drops de Baú por Bioma (arma, dispositivos e consumíveis temáticos)
export const BIOME_CHEST_DROPS = {
  suburb: {
    id: "suburb",
    name: "Subúrbio Arrasado",
    chestWeight: 1.0,
    weights: {
      weapon: 0.45,
      device: 0.25,
      consumable: 0.30
    },
    weapons: [
      { id: "pistol_upgraded", weight: 0.35, name: "Pistola Aprimorada", ammoBonus: 0, damageBonus: 1 },
      { id: "shotgun", weight: 0.35, extraAmmoMult: 1.0 },
      { id: "smg", weight: 0.30, extraAmmoMult: 1.0 }
    ],
    devices: [
      { type: "drone", duration: 45, weight: 0.40 },
      { type: "mines", count: 3, weight: 0.35 },
      { type: "barrier", weight: 0.25 }
    ],
    consumables: [
      { type: "medkit", hp: 20, weight: 0.20 },
      { type: "bomb", count: 1, weight: 0.45 },
      { type: "stamina", weight: 0.35 }
    ]
  },
  forest: {
    id: "forest",
    name: "Floresta Morta",
    chestWeight: 1.0,
    weights: {
      weapon: 0.40,
      device: 0.40,
      consumable: 0.20
    },
    weapons: [
      { id: "shotgun", weight: 0.40, extraAmmoMult: 1.1 },
      { id: "blades", weight: 0.35, extraAmmoMult: 1.0 },
      { id: "rifle", weight: 0.25, extraAmmoMult: 1.0 }
    ],
    devices: [
      { type: "drone", duration: 45, weight: 0.40 },
      { type: "mines", count: 4, weight: 0.35 },
      { type: "barrier", weight: 0.25 }
    ],
    consumables: [
      { type: "medkit", hp: 20, weight: 0.20 },
      { type: "bomb", count: 1, weight: 0.45 },
      { type: "stamina", weight: 0.35 }
    ]
  },
  industrial: {
    id: "industrial",
    name: "Zona Industrial",
    chestWeight: 1.1,
    weights: {
      weapon: 0.55,
      device: 0.30,
      consumable: 0.15
    },
    weapons: [
      { id: "flamethrower", weight: 0.40, extraAmmoMult: 1.1 },
      { id: "smg", weight: 0.35, extraAmmoMult: 1.1 },
      { id: "grenadelauncher", weight: 0.25, extraAmmoMult: 1.0 }
    ],
    canSpawnMachinegun: true,
    devices: [
      { type: "turret", weight: 0.40 },
      { type: "drone", duration: 45, weight: 0.35 },
      { type: "mines", count: 3, weight: 0.25 }
    ],
    consumables: [
      { type: "bomb", count: 1, weight: 0.50 },
      { type: "stamina", weight: 0.35 },
      { type: "medkit", hp: 20, weight: 0.15 }
    ]
  },
  desert: {
    id: "desert",
    name: "Deserto de Cinzas",
    chestWeight: 0.55, // Caixas mais raras porém de alto poder
    weights: {
      weapon: 0.65,     // Alto foco em armas de longo alcance
      device: 0.20,
      consumable: 0.15
    },
    weapons: [
      { id: "rifle", weight: 0.40, extraAmmoMult: 1.3 },
      { id: "perforator", weight: 0.35, extraAmmoMult: 1.0 },
      { id: "grenadelauncher", weight: 0.25, extraAmmoMult: 1.3 }
    ],
    devices: [
      { type: "drone", duration: 45, weight: 0.45 },
      { type: "turret", weight: 0.30 },
      { type: "mines", count: 5, weight: 0.25 }
    ],
    consumables: [
      { type: "bomb", count: 1, weight: 0.50 },
      { type: "medkit", hp: 20, weight: 0.15 },
      { type: "stamina", weight: 0.35 }
    ]
  },
  swamp: {
    id: "swamp",
    name: "Pântano Tóxico",
    chestWeight: 1.0,
    weights: {
      weapon: 0.25,
      device: 0.35,
      consumable: 0.40 // Foco em bombas, lâminas defensivas e consumíveis
    },
    weapons: [
      { id: "shotgun", weight: 0.35, extraAmmoMult: 1.0 },
      { id: "flamethrower", weight: 0.35, extraAmmoMult: 1.0 },
      { id: "blades", weight: 0.30, extraAmmoMult: 1.0 }
    ],
    devices: [
      { type: "drone", duration: 45, weight: 0.40 },
      { type: "barrier", weight: 0.35 },
      { type: "mines", count: 3, weight: 0.25 }
    ],
    consumables: [
      { type: "medkit", hp: 20, weight: 0.25 },
      { type: "bomb", count: 1, weight: 0.45 },
      { type: "stamina", weight: 0.30 }
    ]
  },
  frozen: {
    id: "frozen",
    name: "Zona Gelada",
    chestWeight: 0.60, // Caixas raras com munição extra
    weights: {
      weapon: 0.60,
      device: 0.25,
      consumable: 0.15
    },
    weapons: [
      { id: "rifle", weight: 0.30, extraAmmoMult: 1.5 },
      { id: "perforator", weight: 0.30, extraAmmoMult: 1.0 },
      { id: "smg", weight: 0.20, extraAmmoMult: 1.4 },
      { id: "blades", weight: 0.20, extraAmmoMult: 1.4 }
    ],
    devices: [
      { type: "drone", duration: 45, weight: 0.45 },
      { type: "turret", weight: 0.30 },
      { type: "barrier", weight: 0.25 }
    ],
    consumables: [
      { type: "bomb", count: 1, weight: 0.50 },
      { type: "medkit", hp: 20, weight: 0.15 },
      { type: "stamina", weight: 0.35 }
    ]
  }
};

// Dispositivos (Minas, Torreta, Barreira)
export const MAX_MINES_CARRIED = 6;
export const INITIAL_MINES_COUNT = 3;
export const MINE_PLANT_STATIONARY_DELAY = 1.2;
export const MINE_PLANT_ENEMY_DISTANCE_FACTOR = 0.50; // < metade do alcance de mira
export const MINE_TRIGGER_RADIUS = 0.045;
export const MINE_EXPLOSION_RADIUS = 0.14;
export const MINE_DAMAGE = 18;

export const MAX_ACTIVE_TURRETS = 2;
export const TURRET_LIFETIME = 25.0;
export const TURRET_FIRE_RATE = 0.32;
export const TURRET_RANGE = 0.35;
export const TURRET_DAMAGE = 1;

export const BARRIER_LIFETIME = 15.0;
export const BARRIER_POSTS_COUNT = 3;
export const BARRIER_RADIUS = 0.11;

// ==========================================
// 10.1 SISTEMA DE ARMAS (PERMANENTES E TEMPORÁRIAS)
// ==========================================
export const BASE_PISTOL_DAMAGE = 1;
export const BASE_PISTOL_FIRE_RATE = 0.38;

export const WEAPONS_CONFIG = {
  pistol: {
    id: "pistol",
    name: "Pistola",
    icon: "🔫",
    slot: "permanent",
    damage: BASE_PISTOL_DAMAGE,
    fireRate: BASE_PISTOL_FIRE_RATE,
    bulletSpeed: 1.15,
    bulletLife: 1.3,
    range: 0.38,
    spread: 0,
    projectiles: 1,
    pierce: 0,
    ricochets: 0,
    ammo: Infinity,
    maxAmmo: Infinity,
    color: 0xffdf55
  },
  machinegun: {
    id: "machinegun",
    name: "Metralhadora",
    icon: "⚡",
    slot: "permanent",
    damage: 1,
    fireRate: 0.11,
    bulletSpeed: 1.45,
    bulletLife: 1.4,
    range: 0.42,
    spread: 0.045,
    projectiles: 1,
    pierce: 0,
    ricochets: 0,
    ammo: Infinity,
    maxAmmo: Infinity,
    color: 0xfacc15
  },
  shotgun: {
    id: "shotgun",
    name: "Espingarda",
    icon: "💥",
    slot: "temporary",
    damage: 2,
    fireRate: 0.60,
    bulletSpeed: 1.25,
    bulletLife: 0.35, // Curto alcance
    range: 0.28,
    spread: 0.07,     // Leque de 5 projéteis
    projectiles: 5,
    pierce: 0,
    ricochets: 0,
    ammo: 25,
    maxAmmo: 25,
    color: 0xf97316
  },
  rifle: {
    id: "rifle",
    name: "Rifle de Precisão",
    icon: "🎯",
    slot: "temporary",
    damage: 5,
    fireRate: 0.65,
    bulletSpeed: 2.50, // Projétil rápido
    bulletLife: 1.1,
    range: 0.55,
    spread: 0,
    projectiles: 1,
    pierce: 4,         // Perfura até 4 inimigos
    ricochets: 0,
    ammo: 24,
    maxAmmo: 24,
    color: 0x38bdf8
  },
  flamethrower: {
    id: "flamethrower",
    name: "Lança-Chamas",
    icon: "🔥",
    slot: "temporary",
    damage: 0.6,
    fireRate: 0.05,    // Cone contínuo
    bulletSpeed: 0.75,
    bulletLife: 0.28,
    range: 0.22,
    spread: 0.12,
    projectiles: 2,
    pierce: 5,
    ricochets: 0,
    burnDuration: 3.0, // Aplica queimadura contínua
    burnDamage: 0.8,
    burnInterval: 0.5,
    ammo: 150,
    maxAmmo: 150,
    color: 0xef4444
  },
  grenadelauncher: {
    id: "grenadelauncher",
    name: "Lança-Granadas",
    icon: "💣",
    slot: "temporary",
    damage: 2,
    fireRate: 0.85,
    bulletSpeed: 0.70,
    bulletLife: 1.2,
    range: 0.42,
    spread: 0,
    projectiles: 1,
    isArc: true,         // Projétil em arco parabólico
    isExplosive: true,   // Explosão em área ao impactar/terminar
    explosionRadius: 0.26,
    explosionDamage: 14,
    ammo: 15,
    maxAmmo: 15,
    color: 0xa855f7
  },
  smg: {
    id: "smg",
    name: "Submetralhadora",
    icon: "🔫",
    slot: "temporary",
    damage: 1,
    fireRate: 0.08,    // Alta cadência de tiro
    bulletSpeed: 1.45,
    bulletLife: 0.85,
    range: 0.38,
    spread: 0.08,      // Espalhamento de rajada
    projectiles: 1,
    pierce: 0,
    ricochets: 0,
    ammo: 80,
    maxAmmo: 80,
    color: 0x22c55e
  },
  perforator: {
    id: "perforator",
    name: "Perfuradora",
    icon: "🔩",
    slot: "temporary",
    damage: 6,         // Dano pesado por disparo
    fireRate: 0.75,     // Cadência baixa
    bulletSpeed: 0.70,  // Projétil pesado e lento
    bulletLife: 1.6,
    range: 0.58,
    spread: 0,
    projectiles: 1,
    isPerforator: true, // Atravessa TODOS os inimigos em linha reta sem limite de alvos
    damageDecayPerHit: 0.15, // Perde 15% de dano a cada corpo atravessado
    ammo: 35,          // 35 tiros
    maxAmmo: 35,
    color: 0xf59e0b
  },
  blades: {
    id: "blades",
    name: "Lâminas Orbitais",
    icon: "⚔️",
    slot: "temporary",
    damage: 2.2,
    fireRate: 0.1,
    isOrbital: true,   // 3 discos orbitando o jogador com dano por contato
    bladeCount: 3,
    orbitRadius: 1.15,
    orbitSpeed: 3.8,
    contactDamage: 2.2,
    ammo: 50,
    maxAmmo: 50,
    color: 0xe2e8f0
  }
};
export const WEAPONS = WEAPONS_CONFIG;

// ==========================================
// 11. PROGRESSÃO E ONDAS
// ==========================================
export const WAVE_KILLS_TARGETS = [
  18, // Onda 1
  26, // Onda 2
  36, // Onda 3
  48, // Onda 4
  62, // Onda 5
  78, // Onda 6
  96, // Onda 7
  115, // Onda 8
  140, // Onda 9
  1   // Onda 10 (Derrotar o Chefe)
];

export const WAVE_MAX_SIMULTANEOUS_ZOMBIES = [
  12, // Onda 1
  16, // Onda 2
  20, // Onda 3
  24, // Onda 4
  28, // Onda 5
  35, // Onda 6
  46, // Onda 7
  58, // Onda 8
  70, // Onda 9
  22  // Onda 10/20/30 (Chefe + suporte)
];

export const BASE_XP_NEEDED = 120;
export const XP_GROWTH_FACTOR = 1.55;

export const UPGRADES_CONFIG = {
  fireRate: { level: 0, max: 8, name: "Cadência de Tiro", icon: "⚡", desc: "+25% velocidade de disparo" },
  damage: { level: 0, max: 8, name: "Dano de Tiro", icon: "💥", desc: "+1 de dano por tiro" },
  spread: { level: 0, max: 5, name: "Projéteis Extras", icon: "🏹", desc: "+1 projétil em leque" },
  range: { level: 0, max: 6, name: "Alcance", icon: "🎯", desc: "+30% alcance de mira e projétil" },
  moveSpeed: { level: 0, max: 6, name: "Velocidade", icon: "👟", desc: "+15% velocidade ao andar" },
  maxHp: { level: 0, max: 8, name: "Vida Máxima", icon: "💖", desc: "+25 HP máximo e cura total" },
  instantHeal: { level: 0, max: 8, name: "Cura Instantânea", icon: "🧪", desc: "Cura +50 HP imediatamente" },
  bombRadius: { level: 0, max: 4, name: "Carga Ampliada", icon: "💣", desc: "+25% no raio de explosão da bomba" },
  piercing: { level: 0, max: 4, name: "Tiro Perfurante", icon: "🗡️", desc: "+1 penetração de zumbi" },
  magnet: { level: 0, max: 5, name: "Ímã de XP", icon: "🧲", desc: "+35% raio de atração de XP" },
  droneDamage: { level: 0, max: 4, name: "Drone: Canhão Pesado", icon: "🎯", desc: "+35% de dano nos tiros do drone" },
  droneCadence: { level: 0, max: 4, name: "Drone: Tiro Rápido", icon: "⚡", desc: "+25% de cadência do drone" },
  droneCount: { level: 0, max: 2, name: "Drone: Esquadrão", icon: "🛸", desc: "+1 drone auxiliar adicional" },
  droneDuration: { level: 0, max: 3, name: "Drone: Bateria Estendida", icon: "🔋", desc: "+15s na duração do drone ao coletar" },
  machinegun: { level: 0, max: 1, name: "Metralhadora Permanente", icon: "🔫", desc: "Substitui a pistola com 4x cadência de tiro" }
};

// ==========================================
// 12. CONTROLES E ENTRADAS
// ==========================================
export const JOYSTICK_MAX_RADIUS = 42;
export const INVERT_MOVE_X = false;
export const INVERT_MOVE_Y = false;
export const DEBUG_FACING = false;
export const DEBUG_ANCHOR = false;

// ==========================================
// 13. HUD E ANÉIS CIRCULARES
// ==========================================
export const HUD_RING_SIZE = 40;
export const HUD_RING_CIRCUMFERENCE = 100.5;
export const HUD_COLORS = {
  hpRing: "#e04a4a",
  staminaRing: "#f0a53a"
};

// ==========================================
// 14. ÁUDIO PROCEDURAL E AMBIÊNCIA SUTIL
// ==========================================
export const AUDIO_MASTER_VOLUME = 0.70;
export const AUDIO_MUSIC_VOLUME = 0.0; // Sem trilha musical
export const AUDIO_SFX_VOLUME = 0.35;
export const AUDIO_MAX_SIMULTANEOUS_SFX = 8; // Limite de 8 vozes simultâneas

// Ambiência sutil contínua (ruído rosa / vento suave, quase subliminar)
export const AMBIENT_DAY_VOLUME = 0.022;
export const AMBIENT_NIGHT_VOLUME = 0.038;
export const AMBIENT_DAY_FILTER_FREQ = 400;
export const AMBIENT_NIGHT_FILTER_FREQ = 250;

// Parâmetros do som de tiro (3 camadas curtas < 90ms, envelope seco sem sustain)
export const SHOOT_SOUND_CONFIG = {
  volumeRatio: 0.18,          // ~0.18 do volume de efeitos
  machinegunVolumeMult: 0.62, // Metralhadora ainda mais discreta por tiro (muitos disparos por segundo)
  pitchVariation: 0.08,       // Variação aleatória de ±8% no tom
  minIntervalMs: 40,          // Intervalo mínimo de 40ms entre disparos (descarta se < 40ms)
  // Camada A: Estalo inicial
  snapDuration: 0.015,        // Ruído branco muito curto ~15ms, decaimento rápido
  snapVolume: 0.22,
  // Camada B: Corpo grave
  bodyStartFreq: 180,         // Caindo de ~180Hz
  bodyEndFreq: 40,            // Para ~40Hz
  bodyDuration: 0.060,        // em ~60ms
  bodyVolume: 0.28,
  // Camada C: Cauda de ruído filtrado
  tailDuration: 0.080,        // Decaindo em ~80ms
  tailFilterFreq: 620,        // Passa-baixa
  tailVolume: 0.07            // Bem mais baixo que as outras camadas
};

// ==========================================
// 15. META-PROGRESSÃO E ÁRVORE DE HABILIDADES
// ==========================================
export const META_STORAGE_KEY = "little_planet_meta_v1";
export const META_FRAGMENTS_BASE = 4;
export const META_FRAGMENTS_PER_WAVE = 5;
export const META_FRAGMENTS_KILLS_DIVISOR = 4;

export const META_SKILL_BRANCHES = [
  {
    id: "survival",
    name: "Sobrevivência",
    icon: "🛡️",
    desc: "Melhorias de resistência e durabilidade para suportar os primeiros minutos da infecção.",
    skills: [
      {
        id: "maxHp",
        name: "Vitalidade Inicial",
        icon: "❤️",
        desc: "+8% de vida máxima inicial por nível (máx +32%).",
        costs: [15, 35, 75, 130]
      },
      {
        id: "hpRegen",
        name: "Regeneração Celular",
        icon: "💉",
        desc: "+0.25 de vida regenerada por segundo (máx 1.0 HP/s).",
        costs: [20, 45, 90, 160]
      },
      {
        id: "staminaRegen",
        name: "Fôlego Rápido",
        icon: "⚡",
        desc: "+8% na velocidade de recuperação de stamina por nível.",
        costs: [15, 35, 75, 130]
      },
      {
        id: "damageReduction",
        name: "Carapaça Protetora",
        icon: "🛡️",
        desc: "-3% de dano recebido por nível (máx -12%).",
        costs: [25, 55, 110, 190]
      }
    ]
  },
  {
    id: "weaponry",
    name: "Armamento",
    icon: "⚔️",
    desc: "Otimização de poder bélico e arsenal para o início de cada expedição.",
    skills: [
      {
        id: "pistolDamage",
        name: "Calibre da Pistola",
        icon: "🔫",
        desc: "+8% de dano inicial com a pistola de serviço por nível.",
        costs: [15, 35, 75, 130]
      },
      {
        id: "fireRate",
        name: "Gatilho Rápido",
        icon: "⏱️",
        desc: "+6% na cadência de tiro da pistola inicial por nível.",
        costs: [20, 45, 90, 160]
      },
      {
        id: "startingTempWeapon",
        name: "Suprimento Inicial",
        icon: "🎁",
        desc: "+5% de chance de começar equipado com arma especial.",
        costs: [25, 55, 110, 190]
      },
      {
        id: "startingMines",
        name: "Bolsa de Minas",
        icon: "💣",
        desc: "+1 mina terrestre inicial no inventário por nível.",
        costs: [15, 35, 75, 130]
      }
    ]
  },
  {
    id: "fortune",
    name: "Fortuna",
    icon: "🍀",
    desc: "Vantagens táticas e atração de recursos para acelerar o desenvolvimento na partida.",
    skills: [
      {
        id: "magnetRadius",
        name: "Atração Magnética",
        icon: "🧲",
        desc: "+10% no raio inicial de atração de orbes de XP por nível.",
        costs: [15, 35, 75, 130]
      },
      {
        id: "xpBonus",
        name: "Sabedoria de Combate",
        icon: "✨",
        desc: "+8% de XP ganho ao eliminar zumbis por nível.",
        costs: [20, 45, 90, 160]
      },
      {
        id: "betterChests",
        name: "Caixotes Fortificados",
        icon: "📦",
        desc: "+10% de chance de equipamentos superiores em baús espalhados.",
        costs: [20, 45, 90, 160]
      },
      {
        id: "extraStartingCard",
        name: "Dilema Tático",
        icon: "🃏",
        desc: "Oferece 4 opções de cartas em vez de 3 na 1ª subida de nível.",
        costs: [30, 70, 130, 220]
      }
    ]
  }
];

