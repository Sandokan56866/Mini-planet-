// O que faz: Contêiner central de dados mutáveis e referências globais do jogo.
// Exporta: O objeto singleton state com todas as variáveis de estado de jogo.
// Depende de: Nenhum (módulo independente).

export const state = {
  // Referências Three.js e cena
  renderer: null,
  scene: null,
  camera: null,
  canvas: null,
  planetGroup: null,
  terrainMesh: null,
  waterMesh: null,
  characterGroup: null,
  characterModel: null,
  charLegLeft: null,
  charLegRight: null,
  charArmLeft: null,
  charArmRight: null,
  charLevelLight: null,
  muzzleFlashMat: null,
  sunLight: null,
  hemiLight: null,
  ashPoints: null,
  smokeGroup: null,
  smokeClusters: [],
  burningBarrels: [],

  // Orientação e navegação esférica
  planetQuat: null, // THREE.Quaternion instanciado no init
  playerLocalDir: null, // THREE.Vector3 instanciado no init
  currentGroundY: 22.0,
  targetGroundY: 22.0,
  currentForwardVel: 0,
  currentTurnVel: 0,
  targetForwardVel: 0,
  targetTurnVel: 0,

  // Câmera orbital
  baseCamDistance: 7.5,
  currentCamDistance: 7.5,
  targetCamDistance: 7.5,
  targetCamYaw: 0,
  currentCamYaw: 0,
  currentCamPos: null,
  desiredCamPos: null,
  currentLookTarget: null,
  desiredLookTarget: null,
  camShake: 0,

  // Mira e animações do sobrevivente
  playerTargetAimYaw: 0,
  playerCurrentAimYaw: 0,
  walkCycle: 0,
  recoilOffset: 0,
  flashlightEnabled: false,
  flashlightIntensity: 0,
  playerSpotLight: null,
  flashlightHalo: null,
  currentTargetZombie: null,
  targetMarkerEl: null,
  targetLockTime: 0,
  targetSearchFrameCounter: 0,
  dayNightTimer: 0,
  dayNightPhase: "day", // "day", "sunset", "night", "dawn"

  // Dash e movimentação
  isDashing: false,
  dashDurationTimer: 0,
  dashCooldownTimer: 0,
  dashDir: null,
  dashGhostPool: [],
  stamina: 100,
  isStaminaExhausted: false,
  staminaRegenDelayTimer: 0,
  isSprinting: false,

  // Tiro e combate
  shootCooldown: 0,
  muzzleTimer: 0,
  frenzyDurationTimer: 0,
  freezeFrameTimer: 0,
  currentWeapon: "pistol",
  permanentWeapon: "pistol",
  temporaryWeapon: null,
  temporaryWeaponAmmo: 0,
  hasFoundMachinegun: false,
  machineGunOffered: false,
  machineGunOfferedThisRoll: false,
  equippedModules: [],
  equippedPassives: [],
  offeredRarities: {},
  lastOfferedCards: [],
  minesCount: 3,
  playerMinesCount: 3,
  playerStationaryTimer: 0,
  droneActive: false,
  droneType: "sentinela",
  droneShootTimer: 0,
  droneMesh: null,

  // Estatísticas e progresso
  playerHp: 100,
  maxPlayerHp: 100,
  killsCount: 0,
  currentWave: 1,
  waveKills: 0,
  waveTargetKills: 30,
  playerLevel: 1,
  playerXp: 0,
  xpNeeded: 120,
  firstLevelUpDone: false,
  isGameOver: false,
  isLevelUpPaused: false,
  isPaused: false,
  gameStarted: false,
  gameStartTime: 0,
  animationFrameId: null,
  hudInitialized: false,

  // Ciclo de ondas e inimigos
  spawnCooldown: 0.5,
  activeBossZombie: null,
  screamerSpawnBoostTimer: 0,
  currentClusterAngle: 0,
  clusterSpawnsLeft: 0,

  // Melhorias (upgrades)
  upgrades: null,
  metaBonus: null,

  // Coleções e pools de objetos da partida
  colliders: [],
  propsList: [],
  zombiePool: [],
  spitPool: [],
  acidPuddles: [],
  screamerWaves: [],
  poolsByType: {},
  bulletPool: [],
  pickupPool: [],
  darkParticles: [],
  chestPool: [],
  xpOrbPool: [],
  minePool: [],
  turretPool: [],
  barrierPool: [],
  activeMines: [],
  activeTurrets: [],
  activeBarriers: [],
  chestRespawnTimer: 0,

  // Entradas (Input)
  joyX: 0,
  joyY: 0,
  isJoystickActive: false,
  joyTouchId: null,
  joyCenter: { x: 0, y: 0 },
  isCanvasDragging: false,
  prevDragX: 0,
  isZoomedOut: false,
  keys: {},

  // Sistema de áudio Web Audio
  audioCtx: null,
  sounds: {},

  // Funções de controle e UI
  resetGame: null,
  onUserStartGame: null,
  progression: null,
  combat: null,
  ui: {}
};
