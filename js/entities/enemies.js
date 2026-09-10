// O que faz: Gerencia a criação, pools separados por tipo, levas direcionais de spawn, resistências progressivas (+8% composto, fração reforçada 0-55%), novos tipos de inimigos (Cuspidor, Enxame, Blindado, Ululante, Rastejante), novo chefe Carniceiro alternado e otimização dinâmica para 35+ FPS no Android.
// Exporta: initEnemies, updateEnemies, spawnZombie, applyZombieTypeStyles, cleanUpEnemies, disposeHierarchy.
// Depende de: js/config.js, js/state.js, js/core/math.js

import {
  PLANET_BASE_RADIUS,
  SEA_LEVEL,
  WATER_SPEED_FACTOR,
  MAX_ZOMBIES,
  INITIAL_ZOMBIES_COUNT,
  ZOMBIE_ATTACK_RADIUS,
  ZOMBIE_ATTACK_INTERVAL,
  ZOMBIE_ATTACK_WINDUP_DURATION,
  ZOMBIE_ATTACK_INTERVALS,
  ZOMBIE_ATTACK_WINDUP_DURATIONS,
  getZombieAttackInterval,
  getZombieAttackWindup,
  ZOMBIE_DIE_DURATION,
  ZOMBIE_BASE_SPEED,
  ZOMBIE_SPEED_RATIOS,
  ZOMBIE_SPEED_VARIATION,
  ZOMBIE_SPEED_GROWTH_PER_WAVE,
  ZOMBIE_SPEED_MAX_MULTIPLIER,
  ZOMBIE_TERRAIN_LERP_FACTOR,
  ZOMBIE_MODEL_ROTATION_Y_OFFSET,
  ZOMBIE_ROTATION_SLERP_FACTOR,
  ZOMBIE_WALK_CONFIG,
  ZOMBIE_TYPES,
  WAVE_HP_GROWTH_RATE,
  WAVE_HP_GROWTH_CAP,
  REINFORCED_HP_MULTIPLIER,
  REINFORCED_SCALE_MULTIPLIER,
  getReinforcedChance,
  getSpawnTypeForWave,
  SPITTER_STOP_DISTANCE_RAD,
  SPITTER_SHOOT_COOLDOWN,
  SPITTER_WINDUP_DURATION,
  SPITTER_PROJECTILE_SPEED,
  SPITTER_PROJECTILE_DAMAGE,
  SPITTER_MAX_COUNT_EARLY,
  SPITTER_MAX_COUNT_LATE,
  SPITTER_AIM_ERROR_DEG,
  SPITTER_MIN_SPAWN_DIST_RAD,
  SPITTER_STAGGER_DELAY,
  SWARM_SPAWN_COUNT_MIN,
  SWARM_SPAWN_COUNT_MAX,
  ARMORED_FRONTAL_DOT_THRESHOLD,
  ARMORED_FRONTAL_DAMAGE_FACTOR,
  SCREAMER_TRIGGER_DISTANCE_RAD,
  SCREAMER_DURATION,
  SCREAMER_CALL_BOOST_SPEED_MULTIPLIER,
  SCREAMER_CALL_BOOST_DURATION,
  SCREAMER_SPAWN_ACCEL_DURATION,
  CRAWLER_HIT_THRESHOLD,
  BUTCHER_CHARGE_INTERVAL,
  BUTCHER_WINDUP_DURATION,
  BUTCHER_CHARGE_DURATION,
  BUTCHER_REST_DURATION,
  BUTCHER_CHARGE_SPEED_MULTIPLIER,
  BUTCHER_SPAWN_SWARM_CHANCE_ON_HIT,
  BOSS_SCALE,
  BUTCHER_SCALE,
  ZOMBIE_BODY_RADII,
  ZOMBIE_AVOIDANCE_ANGLES,
  BUTCHER_TRAMPLE_COLLIDER_TYPES,
  ZOMBIE_COLLIDER_PREFILTER_DOT,
  ZOMBIE_STUCK_TIME_THRESHOLD,
  ZOMBIE_STUCK_MIN_TRAVEL,
  ZOMBIE_UNSTUCK_MAX_DISTANCE,
  ZOMBIE_UNSTUCK_MAX_ANG_RAD,
  ZOMBIE_SAFE_SPAWN_ATTEMPTS
} from "../config.js";
import { state } from "../state.js";
import { getRawElevation, radiusAt, getStepIndex } from "../core/math.js";
import { triggerWaterSplash } from "../systems/combat.js";

// Vetores temporários reutilizáveis para orientação e física sem alocação de memória
var upVec = new THREE.Vector3(0, 1, 0);
var zAxis = new THREE.Vector3();
var zUp = new THREE.Vector3();
var zForward = new THREE.Vector3();
var zRight = new THREE.Vector3();
var zRotMatrix = new THREE.Matrix4();
var zTargetQuat = new THREE.Quaternion();
var zModelOffsetQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ZOMBIE_MODEL_ROTATION_Y_OFFSET);

// Vetores reutilizáveis para resolução de movimento e contorno de obstáculos dos zumbis
var zCandDir = new THREE.Vector3();
var zResolveCand = new THREE.Vector3();
var zResolvedOut = new THREE.Vector3();

// ========================================================
// RESOLUÇÃO DE COLISÃO E CONTORNO CONTRA PROPS DO CENÁRIO
// ========================================================
function getZombieBodyRadius(z) {
  if (z.type === "boss") {
    if (z.bossSubtype === "butcher" || z.isButcher) return ZOMBIE_BODY_RADII.butcher;
    return ZOMBIE_BODY_RADII.boss;
  }
  return ZOMBIE_BODY_RADII[z.type] || ZOMBIE_BODY_RADII.default;
}

function isDirectionBlocked(z, testDir) {
  if (!state.colliders || state.colliders.length === 0) return false;

  var bodyRad = getZombieBodyRadius(z);
  var isButcherCharging = (z.type === "boss" && (z.bossSubtype === "butcher" || z.isButcher) && z.chargeState === "charge");

  for (var i = 0; i < state.colliders.length; i++) {
    var col = state.colliders[i];
    var dot = testDir.dot(col.dir);
    // Pré-filtro largo rápido como primeira linha de descarte
    if (dot < ZOMBIE_COLLIDER_PREFILTER_DOT) continue;

    // Carniceiro em investida ignora/atropela pequenos obstáculos
    if (isButcherCharging && BUTCHER_TRAMPLE_COLLIDER_TYPES.indexOf(col.type) !== -1) {
      continue;
    }

    var colAngRad = col.angRad !== undefined ? col.angRad : Math.acos(Math.max(-1, Math.min(1, col.cosRad || 0.99)));
    var totalAngRad = colAngRad + bodyRad;
    var minCos = Math.cos(totalAngRad);

    if (dot > minCos) {
      return true; // Bloqueado
    }
  }

  return false; // Desimpedido
}

export function resolveZombieMove(z, currentDir, desiredDir, forceCheck = false) {
  if (!state.colliders || state.colliders.length === 0) {
    return zResolvedOut.copy(desiredDir);
  }

  var isCheckFrame = forceCheck || ((state.frameCount + (z.frameOffset || 0)) % 2 === 0);

  if (isCheckFrame) {
    // 1. Testa a direção desejada diretamente
    if (!isDirectionBlocked(z, desiredDir)) {
      z.lastAvoidAngle = 0;
      z.lastMoveBlocked = false;
      return zResolvedOut.copy(desiredDir);
    }

    // 2. Contorno por tentativa de ângulos: ±20°, ±40°, ±65° e ±90° em torno de currentDir (z.dirLocal)
    for (var ai = 0; ai < ZOMBIE_AVOIDANCE_ANGLES.length; ai++) {
      var angle = ZOMBIE_AVOIDANCE_ANGLES[ai];
      zResolveCand.copy(desiredDir).applyAxisAngle(currentDir, angle).normalize();
      if (!isDirectionBlocked(z, zResolveCand)) {
        z.lastAvoidAngle = angle;
        z.lastMoveBlocked = false;
        return zResolvedOut.copy(zResolveCand);
      }
    }

    // 3. Se todas as tentativas falharem, o zumbi fica parado naquele frame
    z.lastAvoidAngle = null;
    z.lastMoveBlocked = true;
    return zResolvedOut.copy(currentDir);
  } else {
    // Frames intermediários: reaproveita a última direção/ângulo resolvido
    if (z.lastMoveBlocked) {
      return zResolvedOut.copy(currentDir);
    }
    if (z.lastAvoidAngle !== undefined && z.lastAvoidAngle !== null && z.lastAvoidAngle !== 0) {
      zResolveCand.copy(desiredDir).applyAxisAngle(currentDir, z.lastAvoidAngle).normalize();
      return zResolvedOut.copy(zResolveCand);
    }
    return zResolvedOut.copy(desiredDir);
  }
}

// ========================================================
// REPOSICIONAMENTO SEGURO E DESTRAVAMENTO CONTRA OBSTÁCULOS
// ========================================================
export function findClosestFreeDirection(baseDir, z, maxAngRad) {
  if (!state.colliders || state.colliders.length === 0) {
    return baseDir.clone();
  }

  var limitAng = maxAngRad || ZOMBIE_UNSTUCK_MAX_ANG_RAD;
  var bodyRad = getZombieBodyRadius(z);

  // 1. Tenta empurrar diretamente para fora de qualquer collider que contenha ou encoste em baseDir
  var bestDir = null;
  var bestDist = Infinity;

  for (var c = 0; c < state.colliders.length; c++) {
    var col = state.colliders[c];
    var dot = baseDir.dot(col.dir);
    if (dot < ZOMBIE_COLLIDER_PREFILTER_DOT) continue;

    var colAngRad = col.angRad !== undefined ? col.angRad : Math.acos(Math.max(-1, Math.min(1, col.cosRad || 0.99)));
    var totalAngRad = colAngRad + bodyRad;

    // Se baseDir estiver dentro ou muito próximo da borda deste collider
    if (dot > Math.cos(totalAngRad + 0.02)) {
      var pushAxis = new THREE.Vector3().crossVectors(col.dir, baseDir);
      if (pushAxis.lengthSq() < 1e-6) {
        var ortho = Math.abs(col.dir.x) > 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
        pushAxis.crossVectors(col.dir, ortho);
      }
      pushAxis.normalize();

      // Posição além da borda externa com margem de segurança
      var safePushDir = col.dir.clone().applyAxisAngle(pushAxis, totalAngRad + 0.03).normalize();
      var angDist = Math.acos(Math.max(-1, Math.min(1, baseDir.dot(safePushDir))));

      if (angDist <= limitAng && getRawElevation(safePushDir) >= SEA_LEVEL && !isDirectionBlocked(z, safePushDir)) {
        if (angDist < bestDist) {
          bestDist = angDist;
          bestDir = safePushDir.clone();
        }
      }
    }
  }

  if (bestDir) {
    return bestDir;
  }

  // 2. Busca radial em anéis concêntricos em torno de baseDir
  var orthoRef = Math.abs(baseDir.x) > 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  var tX = new THREE.Vector3().crossVectors(baseDir, orthoRef).normalize();
  var tY = new THREE.Vector3().crossVectors(baseDir, tX).normalize();
  var sampleDir = new THREE.Vector3();

  var ringDistances = [0.035, 0.065, 0.095, 0.125, limitAng];
  for (var r = 0; r < ringDistances.length; r++) {
    var ringDist = ringDistances[r];
    if (ringDist > limitAng) continue;

    for (var a = 0; a < 16; a++) {
      var angle = (a / 16) * Math.PI * 2;
      sampleDir.copy(baseDir)
        .addScaledVector(tX, Math.cos(angle) * ringDist)
        .addScaledVector(tY, Math.sin(angle) * ringDist)
        .normalize();

      if (getRawElevation(sampleDir) >= SEA_LEVEL && !isDirectionBlocked(z, sampleDir)) {
        var d = Math.acos(Math.max(-1, Math.min(1, baseDir.dot(sampleDir))));
        if (d < bestDist) {
          bestDist = d;
          bestDir = sampleDir.clone();
        }
      }
    }
    if (bestDir) {
      return bestDir;
    }
  }

  return baseDir.clone();
}

export function getSafeSpawnDir(candidateDir, z) {
  if (!state.colliders || state.colliders.length === 0) {
    return candidateDir.clone();
  }

  // Se o candidato inicial não colide e está acima da água, aceita diretamente
  if (!isDirectionBlocked(z, candidateDir) && getRawElevation(candidateDir) >= SEA_LEVEL) {
    return candidateDir.clone();
  }

  var testDir = new THREE.Vector3();
  var randAxis = new THREE.Vector3();

  // Sorteia outra direção, até 8 tentativas
  for (var attempt = 1; attempt <= ZOMBIE_SAFE_SPAWN_ATTEMPTS; attempt++) {
    if (attempt < ZOMBIE_SAFE_SPAWN_ATTEMPTS) {
      // Tentativas 1 a 7: sorteia nova direção com espalhamento angular progressivo
      randAxis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      var spread = 0.05 + attempt * 0.03; // ~0.08 a ~0.23 radianos
      testDir.copy(candidateDir).applyAxisAngle(randAxis, spread).normalize();

      if (getRawElevation(testDir) >= SEA_LEVEL && !isDirectionBlocked(z, testDir)) {
        return testDir.clone();
      }
    } else {
      // Na 8ª tentativa (última): aceita a direção livre mais próxima fora de qualquer collider
      return findClosestFreeDirection(candidateDir, z, ZOMBIE_UNSTUCK_MAX_ANG_RAD * 1.5);
    }
  }

  return candidateDir.clone();
}

// Raycaster reutilizável para determinação exata da elevação no terreno
var zRaycaster = new THREE.Raycaster();
var zRayOrigin = new THREE.Vector3();
var zRayDir = new THREE.Vector3();
var zWorldNormal = new THREE.Vector3();
var zRayHits = [];

function getTerrainRadiusAtDir(dirLocal, fallbackRadius) {
  if (!state.terrainMesh) return fallbackRadius || radiusAt(dirLocal);

  zWorldNormal.copy(dirLocal).applyQuaternion(state.planetQuat).normalize();
  zRayOrigin.copy(zWorldNormal).multiplyScalar(PLANET_BASE_RADIUS + 8.0);
  zRayDir.copy(zWorldNormal).negate();

  zRaycaster.set(zRayOrigin, zRayDir);
  zRayHits.length = 0;
  zRaycaster.intersectObject(state.terrainMesh, false, zRayHits);

  if (zRayHits.length > 0) {
    return zRayHits[0].point.length();
  }
  return fallbackRadius || radiusAt(dirLocal);
}

// ==========================================
// 1. ÁUDIO WEB AUDIO PROCEDURAL ESPECÍFICO
// ==========================================
function getAudioContext() {
  if (state.audioCtx) return state.audioCtx;
  var AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (AudioContextClass) {
    state.audioCtx = new AudioContextClass();
  }
  return state.audioCtx;
}

function playSpitSound() {
  var ctx = getAudioContext();
  if (!ctx || ctx.state === "suspended") return;
  var now = ctx.currentTime;
  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(380, now);
  osc.frequency.exponentialRampToValueAtTime(140, now + 0.16);
  gain.gain.setValueAtTime(0.18, now);
  gain.gain.linearRampToValueAtTime(0.001, now + 0.16);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.17);
}

function playSpitHitSound() {
  var ctx = getAudioContext();
  if (!ctx || ctx.state === "suspended") return;
  var now = ctx.currentTime;
  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(60, now + 0.22);
  gain.gain.setValueAtTime(0.25, now);
  gain.gain.linearRampToValueAtTime(0.001, now + 0.22);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.23);
}

function playMetalHitSound() {
  var ctx = getAudioContext();
  if (!ctx || ctx.state === "suspended") return;
  var now = ctx.currentTime;
  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(1400, now);
  osc.frequency.exponentialRampToValueAtTime(450, now + 0.12);
  gain.gain.setValueAtTime(0.28, now);
  gain.gain.linearRampToValueAtTime(0.001, now + 0.12);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.13);
}

function playScreamerHowlSound() {
  var ctx = getAudioContext();
  if (!ctx || ctx.state === "suspended") return;
  var now = ctx.currentTime;
  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(420, now);
  osc.frequency.linearRampToValueAtTime(860, now + 0.45);
  osc.frequency.linearRampToValueAtTime(320, now + 1.2);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.32, now + 0.2);
  gain.gain.linearRampToValueAtTime(0.001, now + 1.25);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 1.26);
}

function playButcherRoarSound() {
  var ctx = getAudioContext();
  if (!ctx || ctx.state === "suspended") return;
  var now = ctx.currentTime;
  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(120, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.9);
  gain.gain.setValueAtTime(0.38, now);
  gain.gain.linearRampToValueAtTime(0.001, now + 0.95);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.96);
}

// ==========================================
// 2. MATERIAIS DOS ZUMBIS E VARIAÇÕES REFORÇADAS
// ==========================================
// Materiais padrão por tipo (apenas primitivas com flatShading)
var matCommonSkin, matCommonCloth;
var matRunnerSkin, matRunnerCloth;
var matTankSkin, matTankCloth;
var matSpitterSkin, matSpitterCloth, matSpitterBubble;
var matCrawlerSkin, matCrawlerCloth;
var matSwarmSkin, matSwarmCloth;
var matArmoredSkin, matArmoredCloth, matArmoredPlates;
var matScreamerSkin, matScreamerCloth, matScreamerMouth;
var matBossBruteSkin, matBossBruteCloth;
var matBossButcherSkin, matBossButcherCloth, matButcherCleaver;

// Materiais REFORÇADOS: visivelmente mais escuros e ameaçadores
var matReinforcedCommonSkin, matReinforcedCommonCloth;
var matReinforcedRunnerSkin, matReinforcedRunnerCloth;
var matReinforcedTankSkin, matReinforcedTankCloth;
var matReinforcedSpitterSkin, matReinforcedSpitterCloth;
var matReinforcedCrawlerSkin, matReinforcedCrawlerCloth;
var matReinforcedArmoredSkin, matReinforcedArmoredCloth;

var matEyeWhite, matEyeRed, matEyeToxic, matHitFlash, matSpitterWindup;

export function initZombieMaterials() {
  matCommonSkin = new THREE.MeshLambertMaterial({ color: 0x6b8f5a, flatShading: true });
  matCommonCloth = new THREE.MeshLambertMaterial({ color: 0x43403a, flatShading: true });

  matRunnerSkin = new THREE.MeshLambertMaterial({ color: 0xb91c1c, flatShading: true });
  matRunnerCloth = new THREE.MeshLambertMaterial({ color: 0x3b1818, flatShading: true });

  matTankSkin = new THREE.MeshLambertMaterial({ color: 0x22381f, flatShading: true });
  matTankCloth = new THREE.MeshLambertMaterial({ color: 0x1c2118, flatShading: true });

  matSpitterSkin = new THREE.MeshLambertMaterial({ color: 0x7fae32, flatShading: true });
  matSpitterCloth = new THREE.MeshLambertMaterial({ color: 0x475e1b, flatShading: true });
  matSpitterBubble = new THREE.MeshBasicMaterial({ color: 0xd4e12e });
  matSpitterWindup = new THREE.MeshBasicMaterial({ color: 0xa3e635 });

  matCrawlerSkin = new THREE.MeshLambertMaterial({ color: 0x5c3a21, flatShading: true });
  matCrawlerCloth = new THREE.MeshLambertMaterial({ color: 0x3a2414, flatShading: true });

  matSwarmSkin = new THREE.MeshLambertMaterial({ color: 0x27272a, flatShading: true });
  matSwarmCloth = new THREE.MeshLambertMaterial({ color: 0x18181b, flatShading: true });

  matArmoredSkin = new THREE.MeshLambertMaterial({ color: 0x4b5563, flatShading: true });
  matArmoredCloth = new THREE.MeshLambertMaterial({ color: 0x374151, flatShading: true });
  matArmoredPlates = new THREE.MeshLambertMaterial({ color: 0x9ca3af, flatShading: true });

  matScreamerSkin = new THREE.MeshLambertMaterial({ color: 0x9ca3af, flatShading: true });
  matScreamerCloth = new THREE.MeshLambertMaterial({ color: 0x4b5563, flatShading: true });
  matScreamerMouth = new THREE.MeshBasicMaterial({ color: 0x18181b });

  matBossBruteSkin = new THREE.MeshLambertMaterial({ color: 0x1b221a, flatShading: true });
  matBossBruteCloth = new THREE.MeshLambertMaterial({ color: 0x141614, flatShading: true });

  matBossButcherSkin = new THREE.MeshLambertMaterial({ color: 0x4a1515, flatShading: true });
  matBossButcherCloth = new THREE.MeshLambertMaterial({ color: 0x2b1414, flatShading: true });
  matButcherCleaver = new THREE.MeshLambertMaterial({ color: 0x52525b, flatShading: true });

  matReinforcedCommonSkin = new THREE.MeshLambertMaterial({ color: 0x3e5434, flatShading: true });
  matReinforcedCommonCloth = new THREE.MeshLambertMaterial({ color: 0x22201d, flatShading: true });

  matReinforcedRunnerSkin = new THREE.MeshLambertMaterial({ color: 0x6e1010, flatShading: true });
  matReinforcedRunnerCloth = new THREE.MeshLambertMaterial({ color: 0x200c0c, flatShading: true });

  matReinforcedTankSkin = new THREE.MeshLambertMaterial({ color: 0x121e10, flatShading: true });
  matReinforcedTankCloth = new THREE.MeshLambertMaterial({ color: 0x0c0e0a, flatShading: true });

  matReinforcedSpitterSkin = new THREE.MeshLambertMaterial({ color: 0x48631c, flatShading: true });
  matReinforcedSpitterCloth = new THREE.MeshLambertMaterial({ color: 0x26330e, flatShading: true });

  matReinforcedCrawlerSkin = new THREE.MeshLambertMaterial({ color: 0x332012, flatShading: true });
  matReinforcedCrawlerCloth = new THREE.MeshLambertMaterial({ color: 0x1c1109, flatShading: true });

  matReinforcedArmoredSkin = new THREE.MeshLambertMaterial({ color: 0x2b3038, flatShading: true });
  matReinforcedArmoredCloth = new THREE.MeshLambertMaterial({ color: 0x1e232b, flatShading: true });

  matEyeWhite = new THREE.MeshBasicMaterial({ color: 0xfee2e2 });
  matEyeRed = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  matEyeToxic = new THREE.MeshBasicMaterial({ color: 0xd4e12e });
  matHitFlash = new THREE.MeshBasicMaterial({ color: 0xffffff });
}

initZombieMaterials();

export function disposeHierarchy(obj) {
  if (!obj) return;
  obj.traverse(function (child) {
    if (child.geometry) {
      child.geometry.dispose();
    }
    if (child.material) {
      if (Array.isArray(child.material)) {
        for (var mi = 0; mi < child.material.length; mi++) {
          if (child.material[mi] && child.material[mi].dispose) {
            child.material[mi].dispose();
          }
        }
      } else if (child.material.dispose) {
        child.material.dispose();
      }
    }
  });
  if (obj.parent) {
    obj.parent.remove(obj);
  }
}

export function applyZombieTypeStyles(z) {
  var isFlash = z.flashTimer > 0;
  if (isFlash) {
    z.head.material = matHitFlash;
    z.torso.material = matHitFlash;
    z.armL.material = matHitFlash;
    z.armR.material = matHitFlash;
    z.legL.material = matHitFlash;
    z.legR.material = matHitFlash;
    if (z.armorPlate) z.armorPlate.material = matHitFlash;
    return;
  }

  var reinf = z.isReinforced;
  var sMat = reinf ? matReinforcedCommonSkin : matCommonSkin;
  var cMat = reinf ? matReinforcedCommonCloth : matCommonCloth;

  if (z.type === "boss") {
    if (z.bossSubtype === "butcher") {
      sMat = matBossButcherSkin;
      cMat = matBossButcherCloth;
    } else {
      sMat = matBossBruteSkin;
      cMat = matBossBruteCloth;
    }
  } else if (z.type === "tank") {
    sMat = reinf ? matReinforcedTankSkin : matTankSkin;
    cMat = reinf ? matReinforcedTankCloth : matTankCloth;
  } else if (z.type === "runner") {
    sMat = reinf ? matReinforcedRunnerSkin : matRunnerSkin;
    cMat = reinf ? matReinforcedRunnerCloth : matRunnerCloth;
  } else if (z.type === "spitter") {
    sMat = reinf ? matReinforcedSpitterSkin : matSpitterSkin;
    cMat = reinf ? matReinforcedSpitterCloth : matSpitterCloth;
    if (z.isSpitWindingUp) {
      z.head.material = matSpitterWindup;
      if (z.spitterBubbles) {
        for (var sbi = 0; sbi < z.spitterBubbles.length; sbi++) {
          z.spitterBubbles[sbi].material = matSpitterWindup;
        }
      }
      z.torso.material = cMat;
      z.armL.material = sMat;
      z.armR.material = sMat;
      z.legL.material = cMat;
      z.legR.material = cMat;
      return;
    } else if (z.spitterBubbles) {
      for (var sbi2 = 0; sbi2 < z.spitterBubbles.length; sbi2++) {
        z.spitterBubbles[sbi2].material = matSpitterBubble;
      }
    }
  } else if (z.type === "crawler") {
    sMat = reinf ? matReinforcedCrawlerSkin : matCrawlerSkin;
    cMat = reinf ? matReinforcedCrawlerCloth : matCrawlerCloth;
  } else if (z.type === "swarm") {
    sMat = matSwarmSkin;
    cMat = matSwarmCloth;
  } else if (z.type === "armored") {
    sMat = reinf ? matReinforcedArmoredSkin : matArmoredSkin;
    cMat = reinf ? matReinforcedArmoredCloth : matArmoredCloth;
    if (z.armorPlate) z.armorPlate.material = matArmoredPlates;
  } else if (z.type === "screamer") {
    sMat = matScreamerSkin;
    cMat = matScreamerCloth;
  }

  z.head.material = sMat;
  z.torso.material = cMat;
  z.armL.material = sMat;
  z.armR.material = sMat;
  z.legL.material = cMat;
  z.legR.material = cMat;
}

// ==========================================
// 3. CONSTRUÇÃO DO MODELO HIERÁRQUICO POR TIPO
// ==========================================
function createZombieMesh(type) {
  var root = new THREE.Group();
  root.visible = false;

  var legMat = matCommonCloth;
  var skinMat = matCommonSkin;

  var legW = 0.08;
  var legH = 0.26;
  var legD = 0.08;
  var torsoW = 0.24;
  var torsoH = 0.24;
  var torsoD = 0.12;
  var headSize = 0.14;
  var armW = 0.06;
  var armH = 0.22;
  var armD = 0.06;

  // Proporções morfológicas distintas por tipo
  if (type === "tank") {
    torsoW = 0.36; torsoH = 0.30; torsoD = 0.20;
    legW = 0.12; legH = 0.28; legD = 0.12;
    armW = 0.10; armH = 0.26; armD = 0.10;
    headSize = 0.16;
  } else if (type === "runner") {
    torsoW = 0.18; torsoH = 0.22; torsoD = 0.10;
    legW = 0.06; legH = 0.28; legD = 0.06;
    armW = 0.05; armH = 0.24; armD = 0.05;
    headSize = 0.13;
  } else if (type === "spitter") {
    torsoW = 0.30; torsoH = 0.28; torsoD = 0.22; // Tronco inchado
    headSize = 0.15;
  } else if (type === "screamer") {
    torsoW = 0.14; torsoH = 0.28; torsoD = 0.08; // Corpo muito fino
    headSize = 0.18; // Cabeça grande
    legW = 0.05; legH = 0.30; legD = 0.05;
  } else if (type === "crawler") {
    torsoW = 0.26; torsoH = 0.08; torsoD = 0.28; // Rente ao solo
    headSize = 0.12;
  }

  // Pernas
  var legL = new THREE.Mesh(new THREE.BoxGeometry(legW, legH, legD), legMat);
  legL.position.set(-torsoW * 0.28, legH * 0.5, 0);
  root.add(legL);

  var legR = new THREE.Mesh(new THREE.BoxGeometry(legW, legH, legD), legMat);
  legR.position.set(torsoW * 0.28, legH * 0.5, 0);
  root.add(legR);

  // Tronco
  var torsoPosY = (type === "crawler") ? 0.10 : (legH + torsoH * 0.5);
  var torso = new THREE.Mesh(new THREE.BoxGeometry(torsoW, torsoH, torsoD), legMat);
  torso.position.set(0, torsoPosY, 0);
  root.add(torso);

  // Cabeça
  var head = new THREE.Mesh(new THREE.BoxGeometry(headSize, headSize, headSize), skinMat);
  head.position.set(0, torsoH * 0.5 + headSize * 0.5, (type === "crawler" ? 0.12 : 0));
  torso.add(head);

  // Olhos
  var eyeColorMat = (type === "runner" || type === "tank" || type === "swarm" || type === "boss") ? matEyeRed :
                    (type === "spitter" ? matEyeToxic : matEyeWhite);
  var eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.02), eyeColorMat);
  eyeL.position.set(-headSize * 0.26, 0.02, headSize * 0.5 + 0.005);
  head.add(eyeL);

  var eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.02), eyeColorMat);
  eyeR.position.set(headSize * 0.26, 0.02, headSize * 0.5 + 0.005);
  head.add(eyeR);

  // Braços
  var armL = new THREE.Mesh(new THREE.BoxGeometry(armW, armH, armD), skinMat);
  armL.position.set(-torsoW * 0.5 - armW * 0.5, torsoH * 0.25, 0);
  torso.add(armL);

  var armR = new THREE.Mesh(new THREE.BoxGeometry(armW, armH, armD), skinMat);
  armR.position.set(torsoW * 0.5 + armW * 0.5, torsoH * 0.25, 0);
  torso.add(armR);

  var armorPlate = null;
  var spitterBubbles = null;

  // DETALHES VISUAIS CARACTERÍSTICOS POR TIPO:
  if (type === "spitter") {
    // Bolhas/pústulas esféricas no dorso e ombros
    var bGeom = new THREE.SphereGeometry(0.045, 6, 6);
    var b1 = new THREE.Mesh(bGeom, matSpitterBubble);
    b1.position.set(-0.08, 0.08, -0.10);
    torso.add(b1);
    var b2 = new THREE.Mesh(bGeom, matSpitterBubble);
    b2.position.set(0.06, 0.10, -0.09);
    torso.add(b2);
    var b3 = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 5), matSpitterBubble);
    b3.position.set(0.11, 0.05, 0.08);
    torso.add(b3);
    spitterBubbles = [b1, b2, b3];
  } else if (type === "armored") {
    // Placas de metal (caixas cinzas presas ao tronco frontal)
    armorPlate = new THREE.Mesh(new THREE.BoxGeometry(torsoW * 1.05, torsoH * 0.90, 0.04), matArmoredPlates);
    armorPlate.position.set(0, 0, torsoD * 0.5 + 0.02);
    torso.add(armorPlate);
  } else if (type === "screamer") {
    // Boca aberta grande com interior oco escuro
    var mouth = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.03), matScreamerMouth);
    mouth.position.set(0, -0.04, headSize * 0.5 + 0.005);
    head.add(mouth);
  }

  state.planetGroup.add(root);

  var zObj = {
    mesh: root,
    head: head,
    torso: torso,
    armL: armL,
    armR: armR,
    legL: legL,
    legR: legR,
    armorPlate: armorPlate,
    spitterBubbles: spitterBubbles,
    active: false,
    type: type,
    bossSubtype: "brute",
    dirLocal: new THREE.Vector3(),
    _rawHp: 1,
    maxHp: 1,
    speed: 0.1,
    baseSpeed: 0.1,
    baseScale: 1.0,
    isReinforced: false,
    dieTimer: 0,
    flashTimer: 0,
    walkPhase: 0,
    phaseOffset: Math.random() * Math.PI * 2,
    frameOffset: Math.floor(Math.random() * 8),
    lastAvoidAngle: 0,
    lastMoveBlocked: false,
    surfaceRadius: PLANET_BASE_RADIUS,
    targetRadius: PLANET_BASE_RADIUS,
    isTargetVisual: false,
    hasCastShadow: false,
    state: "walk",
    // Mecanismo de segurança contra travamento em obstáculos
    accumTravelAngle: 0,
    stuckTimer: 0,
    lastDirSample: new THREE.Vector3(),
    isUnstucking: false,
    unstuckStartDir: new THREE.Vector3(),
    unstuckTargetDir: new THREE.Vector3(),
    unstuckStartRadius: PLANET_BASE_RADIUS,
    unstuckTargetRadius: PLANET_BASE_RADIUS,
    unstuckElapsed: 0,
    unstuckDuration: 0.35,
    // Comportamento do Cuspidor
    spitCooldown: 1.5 + Math.random() * 2.0,
    isSpitWindingUp: false,
    spitWindupTimer: 0,
    // Comportamento do Ululante
    hasScreamed: false,
    isScreaming: false,
    screamTimer: 0,
    speedBoostTimer: 0,
    // Comportamento de Ataque por Contato (Ciclo com Ritmo: Windup -> Dano -> Recuperação)
    attackCooldown: 1.1,
    attackInterval: 1.1,
    attackWindupDuration: 0.35,
    attackPhase: "ready", // "ready" | "windup" | "recovery"
    attackWindupTimer: 0,
    // Comportamento do Carniceiro
    chargeState: "stalk",
    chargeTimer: 0,
    stalkTimer: 3.5,
    windupTimer: 0,
    restTimer: 0,
    chargeTravelAxis: new THREE.Vector3(),
    lastSwarmSpawnTime: 0,

    getFacingToPlayerDot: function () {
      // Produto escalar entre a direção que o zumbi encara e a direção de onde vem o tiro do jogador
      // zUp = zObj.dirLocal, zForward = tangente zumbi -> jogador
      var toPlayer = new THREE.Vector3().subVectors(state.playerLocalDir, this.dirLocal);
      toPlayer.addScaledVector(this.dirLocal, -toPlayer.dot(this.dirLocal)).normalize();
      return toPlayer.lengthSq() > 0 ? 1.0 : 0.0;
    },

    checkCrawlerNearMiss: function () {
      // Verifica se o projétil ativo mais próximo passou por cima da silhueta rasteira
      var closestDist = 999;
      for (var bi = 0; bi < state.bulletPool.length; bi++) {
        var b = state.bulletPool[bi];
        if (!b.active) continue;
        var dotVal = b.dirLocal.dot(this.dirLocal);
        var dist = Math.acos(Math.max(-1, Math.min(1, dotVal)));
        if (dist < closestDist) {
          closestDist = dist;
        }
      }
      return closestDist > CRAWLER_HIT_THRESHOLD;
    }
  };

  // Interceptador reativo de dano no HP para Blindado, Rastejante e Carniceiro
  Object.defineProperty(zObj, "hp", {
    get: function () {
      return this._rawHp;
    },
    set: function (newVal) {
      var oldHp = this._rawHp;
      var dmg = oldHp - newVal;

      if (dmg > 0) {
        // 1. BLINDADO: Se atingido de frente, reduz dano pela metade
        if (this.type === "armored") {
          var dot = this.getFacingToPlayerDot();
          if (dot > ARMORED_FRONTAL_DOT_THRESHOLD) {
            dmg = Math.max(1, Math.round(dmg * ARMORED_FRONTAL_DAMAGE_FACTOR));
            newVal = oldHp - dmg;
            playMetalHitSound();
          }
        }
        // 2. RASTEJANTE: Silhueta baixa reduz raio de acerto
        else if (this.type === "crawler") {
          if (this.checkCrawlerNearMiss()) {
            newVal = oldHp; // Projétil passou por cima da silhueta
            return;
          }
        }
        // 3. CARNICEIRO: Ocasionalmente cospe 3 ou 4 inimigos Enxame ao ser ferido
        else if (this.type === "boss" && this.bossSubtype === "butcher") {
          var now = performance.now();
          if (Math.random() < BUTCHER_SPAWN_SWARM_CHANCE_ON_HIT && (now - this.lastSwarmSpawnTime > 1800)) {
            this.lastSwarmSpawnTime = now;
            var swarmCount = 3 + Math.floor(Math.random() * 2);
            spawnSwarmGroup(this.dirLocal, swarmCount);
          }
        }
      }

      this._rawHp = newVal;
    }
  });

  return zObj;
}

// ==========================================
// 4. POOLS DE PROJÉTEIS DE CUSPE E ONDAS DE CHOQUE
// ==========================================
function initSpitPool() {
  state.spitPool = [];
  var spitGeom = new THREE.SphereGeometry(0.08, 8, 8);
  var spitMat = new THREE.MeshBasicMaterial({ color: 0x4ade80 });

  for (var i = 0; i < 16; i++) {
    var mesh = new THREE.Mesh(spitGeom, spitMat);
    mesh.visible = false;
    state.planetGroup.add(mesh);
    state.spitPool.push({
      mesh: mesh,
      active: false,
      dirLocal: new THREE.Vector3(),
      targetDir: new THREE.Vector3(),
      travelAxis: new THREE.Vector3(),
      speed: SPITTER_PROJECTILE_SPEED,
      life: 0,
      totalAngle: 0,
      currentAngle: 0
    });
  }
}

function spawnSpit(startDir, targetDir) {
  var pool = state.spitPool || [];
  var freeSpit = null;
  for (var i = 0; i < pool.length; i++) {
    if (!pool[i].active) {
      freeSpit = pool[i];
      break;
    }
  }
  if (!freeSpit) return;

  // Imprecisão de mira de ±8 graus para permitir desvio ativo e habilidoso do jogador
  var aimTarget = targetDir.clone();
  var errDeg = (Math.random() * 2 - 1) * SPITTER_AIM_ERROR_DEG;
  var errRad = errDeg * (Math.PI / 180);
  var perpAxis = new THREE.Vector3().crossVectors(startDir, targetDir).normalize();
  if (perpAxis.lengthSq() < 0.001) {
    perpAxis.set(1, 0, 0);
  }
  aimTarget.applyAxisAngle(perpAxis, errRad).normalize();

  freeSpit.active = true;
  freeSpit.dirLocal.copy(startDir);
  freeSpit.targetDir.copy(aimTarget);
  freeSpit.travelAxis.crossVectors(startDir, aimTarget).normalize();
  if (freeSpit.travelAxis.lengthSq() < 0.001) freeSpit.travelAxis.set(1, 0, 0);

  var dot = Math.max(-1, Math.min(1, startDir.dot(aimTarget)));
  freeSpit.totalAngle = Math.acos(dot);
  freeSpit.currentAngle = 0;
  freeSpit.speed = SPITTER_PROJECTILE_SPEED;
  freeSpit.life = 0;
  freeSpit.mesh.visible = true;

  playSpitSound();
}

function initScreamerWave() {
  state.screamerWaves = [];
  var ringGeom = new THREE.RingGeometry(0.1, 0.22, 24);
  var ringMat = new THREE.MeshBasicMaterial({ color: 0xf87171, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });

  for (var i = 0; i < 4; i++) {
    var waveMesh = new THREE.Mesh(ringGeom, ringMat.clone());
    waveMesh.visible = false;
    state.planetGroup.add(waveMesh);
    state.screamerWaves.push({
      mesh: waveMesh,
      active: false,
      timer: 0,
      dirLocal: new THREE.Vector3()
    });
  }
}

function triggerScreamerWave(posDir) {
  var pool = state.screamerWaves || [];
  var wave = null;
  for (var i = 0; i < pool.length; i++) {
    if (!pool[i].active) {
      wave = pool[i];
      break;
    }
  }
  if (!wave) return;

  wave.active = true;
  wave.timer = 0;
  wave.dirLocal.copy(posDir);
  wave.mesh.visible = true;
  wave.mesh.scale.set(1, 1, 1);
  wave.mesh.material.opacity = 0.85;

  var r = radiusAt(posDir) + 0.15;
  wave.mesh.position.copy(posDir).multiplyScalar(r);
  wave.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), posDir);
}

function initAcidPuddles() {
  state.acidPuddles = [];
  var puddleGeom = new THREE.CircleGeometry(0.24, 16);
  var puddleMat = new THREE.MeshBasicMaterial({
    color: 0x4ade80,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.75,
    depthWrite: false
  });

  for (var i = 0; i < 16; i++) {
    var puddleMesh = new THREE.Mesh(puddleGeom, puddleMat.clone());
    puddleMesh.visible = false;
    puddleMesh.renderOrder = 2;
    state.planetGroup.add(puddleMesh);
    state.acidPuddles.push({
      mesh: puddleMesh,
      active: false,
      timer: 0,
      maxLife: 3.5,
      dirLocal: new THREE.Vector3()
    });
  }
}

function createAcidPuddle(posDir) {
  var pool = state.acidPuddles || [];
  var puddle = null;
  for (var i = 0; i < pool.length; i++) {
    if (!pool[i].active) {
      puddle = pool[i];
      break;
    }
  }
  if (!puddle && pool.length > 0) {
    puddle = pool[0];
  }
  if (!puddle) return;

  puddle.active = true;
  puddle.timer = 0;
  puddle.maxLife = 3.5;
  puddle.dirLocal.copy(posDir);
  puddle.mesh.visible = true;
  puddle.mesh.material.opacity = 0.75;
  puddle.mesh.scale.set(1, 1, 1);

  var r = radiusAt(posDir) + 0.04;
  puddle.mesh.position.copy(posDir).multiplyScalar(r);
  puddle.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), posDir);
}

// ==========================================
// 5. INICIALIZAÇÃO E POOLS SEPARADOS POR TIPO
// ==========================================
export function cleanUpEnemies() {
  if (state.zombiePool && state.zombiePool.length > 0) {
    for (var i = 0; i < state.zombiePool.length; i++) {
      var z = state.zombiePool[i];
      if (z && z.mesh) {
        disposeHierarchy(z.mesh);
      }
    }
    state.zombiePool.length = 0;
  }
  if (state.spitPool && state.spitPool.length > 0) {
    for (var j = 0; j < state.spitPool.length; j++) {
      var sp = state.spitPool[j];
      if (sp && sp.mesh) {
        disposeHierarchy(sp.mesh);
      }
    }
    state.spitPool.length = 0;
  }
  if (state.screamerWaves && state.screamerWaves.length > 0) {
    for (var w = 0; w < state.screamerWaves.length; w++) {
      var sw = state.screamerWaves[w];
      if (sw && sw.mesh) {
        disposeHierarchy(sw.mesh);
      }
    }
    state.screamerWaves.length = 0;
  }
  if (state.acidPuddles && state.acidPuddles.length > 0) {
    for (var a = 0; a < state.acidPuddles.length; a++) {
      var ap = state.acidPuddles[a];
      if (ap && ap.mesh) {
        disposeHierarchy(ap.mesh);
      }
    }
    state.acidPuddles.length = 0;
  }
  state.poolsByType = {
    common: [],
    runner: [],
    tank: [],
    spitter: [],
    crawler: [],
    swarm: [],
    armored: [],
    screamer: [],
    boss: []
  };
  state.activeBossZombie = null;
  state.currentTargetZombie = null;
  state.currentClusterAngle = Math.random() * Math.PI * 2;
  state.clusterSpawnsLeft = 0;
}

export function initEnemies() {
  cleanUpEnemies();
  initZombieMaterials();

  state.zombiePool = [];
  state.poolsByType = {
    common: [],
    runner: [],
    tank: [],
    spitter: [],
    crawler: [],
    swarm: [],
    armored: [],
    screamer: [],
    boss: []
  };

  // Aloca pools específicos por tipo para desempenho máximo sem alocação contínua
  var typeCounts = {
    common: 34,
    runner: 22,
    tank: 14,
    spitter: 14,
    crawler: 16,
    swarm: 46, // Enxames nascem em grupos de 5-8
    armored: 14,
    screamer: 10,
    boss: 4 // Suporta Bruto e Carniceiro
  };

  for (var t in typeCounts) {
    var count = typeCounts[t];
    for (var i = 0; i < count; i++) {
      var z = createZombieMesh(t);
      state.poolsByType[t].push(z);
      state.zombiePool.push(z);
    }
  }

  initSpitPool();
  initScreamerWave();
  initAcidPuddles();

  // Spawna a leva inicial de abertura na onda 1
  for (var k = 0; k < INITIAL_ZOMBIES_COUNT; k++) {
    spawnZombie(new THREE.Vector3(0, 1, 0), false, "common");
  }
}

// Spawna um grupo compacto de enxames (5 a 8 unidades juntas) com spawn seguro
function spawnSwarmGroup(centerDir, count) {
  var dummySwarm = { type: "swarm" };
  var safeCenter = getSafeSpawnDir(centerDir, dummySwarm);

  for (var i = 0; i < count; i++) {
    var offsetDir = safeCenter.clone();
    var jitterAxis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    offsetDir.applyAxisAngle(jitterAxis, (Math.random() * 0.08)).normalize();
    var safeOffset = getSafeSpawnDir(offsetDir, dummySwarm);
    spawnSingleZombie(safeOffset, "swarm", false);
  }
}

// ==========================================
// 6. SPAWN DE ZUMBIS COM MISTURA PROGRESSIVA
// ==========================================
export function spawnZombie(playerLocalDir, forceBoss, typeOverride) {
  var wave = state.currentWave || 1;

  if (state.clusterSpawnsLeft <= 0) {
    state.currentClusterAngle = Math.random() * Math.PI * 2;
    state.clusterSpawnsLeft = 4 + Math.floor(Math.random() * 4);
  }
  state.clusterSpawnsLeft--;

  // Encontra posição de spawn válida na direção da leva
  var candidateDir = new THREE.Vector3();
  var attempts = 0;
  var found = false;

  while (attempts++ < 30) {
    var randTheta = state.currentClusterAngle + (Math.random() - 0.5) * 0.70;
    var randDot = 0.76 + Math.random() * 0.16;
    var sinVal = Math.sqrt(Math.max(0, 1 - randDot * randDot));

    var ortho = new THREE.Vector3(1, 0, 0);
    if (Math.abs(playerLocalDir.x) > 0.9) ortho.set(0, 1, 0);
    var tanX = new THREE.Vector3().crossVectors(playerLocalDir, ortho).normalize();
    var tanY = new THREE.Vector3().crossVectors(playerLocalDir, tanX).normalize();

    candidateDir.copy(playerLocalDir).multiplyScalar(randDot)
      .addScaledVector(tanX, sinVal * Math.cos(randTheta))
      .addScaledVector(tanY, sinVal * Math.sin(randTheta))
      .normalize();

    var elev = getRawElevation(candidateDir);
    if (elev >= SEA_LEVEL) {
      found = true;
      break;
    }
  }

  if (!found) return;

  // Determina o tipo de zumbi
  var targetType = "common";
  var isBoss = false;

  if (forceBoss || (wave % 10 === 0)) {
    targetType = "boss";
    isBoss = true;
  } else if (typeOverride) {
    targetType = typeOverride;
  } else {
    targetType = getSpawnTypeForWave(wave);
  }

  // Teto máximo de cuspidores simultâneos para evitar sobrecarga de projéteis (4 até onda 10, 7 depois)
  if (targetType === "spitter") {
    var maxSpitters = (wave <= 10) ? SPITTER_MAX_COUNT_EARLY : SPITTER_MAX_COUNT_LATE;
    var activeSpitters = 0;
    for (var szi = 0; szi < state.zombiePool.length; szi++) {
      var sz = state.zombiePool[szi];
      if (sz.active && sz.type === "spitter" && sz.state !== "die") {
        activeSpitters++;
      }
    }
    if (activeSpitters >= maxSpitters) {
      targetType = "common";
    }
  }

  // Distância mínima de spawn para Cuspidores (não nascem a menos de 0.55 rad do sobrevivente)
  if (targetType === "spitter") {
    var pDotCandidate = candidateDir.dot(playerLocalDir);
    var distToP = Math.acos(Math.max(-1, Math.min(1, pDotCandidate)));
    if (distToP < SPITTER_MIN_SPAWN_DIST_RAD) {
      var repAttempts = 0;
      var newCandidate = new THREE.Vector3();
      while (repAttempts++ < 20) {
        var rTheta = Math.random() * Math.PI * 2;
        var rDot = 0.55 + Math.random() * 0.28;
        var sVal = Math.sqrt(Math.max(0, 1 - rDot * rDot));
        var oRef = (Math.abs(playerLocalDir.x) > 0.9) ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
        var tX = new THREE.Vector3().crossVectors(playerLocalDir, oRef).normalize();
        var tY = new THREE.Vector3().crossVectors(playerLocalDir, tX).normalize();
        newCandidate.copy(playerLocalDir).multiplyScalar(rDot)
          .addScaledVector(tX, sVal * Math.cos(rTheta))
          .addScaledVector(tY, sVal * Math.sin(rTheta))
          .normalize();
        if (getRawElevation(newCandidate) >= SEA_LEVEL) {
          candidateDir.copy(newCandidate);
          break;
        }
      }
    }
  }

  // Se o tipo sorteado for Enxame, gera um grupo coordenado de 5 a 8 unidades
  if (targetType === "swarm") {
    var count = SWARM_SPAWN_COUNT_MIN + Math.floor(Math.random() * (SWARM_SPAWN_COUNT_MAX - SWARM_SPAWN_COUNT_MIN + 1));
    spawnSwarmGroup(candidateDir, count);
    return;
  }

  spawnSingleZombie(candidateDir, targetType, isBoss, typeOverride);
}

function spawnSingleZombie(candidateDir, targetType, isBoss, typeOverride) {
  var wave = state.currentWave || 1;
  var pool = (state.poolsByType && state.poolsByType[targetType]) || state.zombiePool;
  var freeZombie = null;

  for (var i = 0; i < pool.length; i++) {
    if (!pool[i].active) {
      freeZombie = pool[i];
      break;
    }
  }
  // Fallback no pool geral se o pool específico estiver momentaneamente esgotado
  if (!freeZombie) {
    for (var j = 0; j < state.zombiePool.length; j++) {
      if (!state.zombiePool[j].active && state.zombiePool[j].type === targetType) {
        freeZombie = state.zombiePool[j];
        break;
      }
    }
  }
  if (!freeZombie) return;

  var typeConfig = ZOMBIE_TYPES[targetType] || ZOMBIE_TYPES.common;

  // 1. CRESCIMENTO COMPOSTO NA VIDA BASE (+8% por onda, teto de 3x o valor inicial)
  var hpGrowthFactor = Math.min(WAVE_HP_GROWTH_CAP, Math.pow(1.0 + WAVE_HP_GROWTH_RATE, Math.max(0, wave - 1)));
  var calculatedBaseHp = Math.max(1, Math.round(typeConfig.hp * hpGrowthFactor));

  // 2. FRAÇÃO CRESCENTE DE REFORÇADOS (0% na onda 1 até ~55% na onda 12)
  var reinforcedChance = getReinforcedChance(wave);
  var isReinforced = (!isBoss && targetType !== "swarm") && (Math.random() < reinforcedChance);

  var finalHp = calculatedBaseHp;
  var finalScale = typeConfig.scale;

  // O reforçado tem 1,8x a vida base, é visivelmente mais escuro e levemente maior (1,15x)
  if (isReinforced) {
    finalHp = Math.max(2, Math.round(calculatedBaseHp * REINFORCED_HP_MULTIPLIER));
    finalScale = typeConfig.scale * REINFORCED_SCALE_MULTIPLIER;
  }

  var waveSpeedMultiplier = Math.min(
    ZOMBIE_SPEED_MAX_MULTIPLIER,
    1.0 + (wave - 1) * ZOMBIE_SPEED_GROWTH_PER_WAVE
  );
  var individualVariation = 1.0 + (Math.random() * 2 - 1) * ZOMBIE_SPEED_VARIATION;

  freeZombie.active = true;
  freeZombie.type = targetType;
  freeZombie.isReinforced = isReinforced;

  // Validação segura contra state.colliders antes de aceitar a posição de spawn
  var safeSpawnDir = getSafeSpawnDir(candidateDir, freeZombie);
  freeZombie.dirLocal.copy(safeSpawnDir);
  freeZombie.accumTravelAngle = 0;
  freeZombie.stuckTimer = 0;
  freeZombie.lastDirSample.copy(safeSpawnDir);
  freeZombie.isUnstucking = false;

  freeZombie.state = "walk";
  freeZombie.dieTimer = 0;
  freeZombie.flashTimer = 0;
  freeZombie.walkPhase = Math.random() * Math.PI * 2;
  freeZombie.phaseOffset = Math.random() * Math.PI * 2;
  freeZombie.spitCooldown = 2.0 + Math.random() * 2.0;
  freeZombie.isSpitWindingUp = false;
  freeZombie.spitWindupTimer = 0;
  if (freeZombie.head) freeZombie.head.scale.set(1, 1, 1);
  if (freeZombie.spitterBubbles) {
    for (var rbi0 = 0; rbi0 < freeZombie.spitterBubbles.length; rbi0++) {
      freeZombie.spitterBubbles[rbi0].scale.set(1, 1, 1);
    }
  }
  freeZombie.hasScreamed = false;
  freeZombie.isScreaming = false;
  freeZombie.screamTimer = 0;
  freeZombie.speedBoostTimer = 0;
  freeZombie.chargeState = "stalk";
  freeZombie.stalkTimer = 3.5;
  freeZombie.windupTimer = 0;
  freeZombie.chargeTimer = 0;
  freeZombie.restTimer = 0;
  freeZombie.lastAvoidAngle = 0;
  freeZombie.lastMoveBlocked = false;

  var spawnRadius = getTerrainRadiusAtDir(freeZombie.dirLocal, radiusAt(freeZombie.dirLocal));
  freeZombie.surfaceRadius = spawnRadius;
  freeZombie.targetRadius = spawnRadius;
  freeZombie.isTargetVisual = false;

  // Configuração individual de cada chefe
  if (isBoss) {
    var bossCycle = Math.floor(wave / 10);
    var isButcher = (typeOverride === "boss_butcher") || (bossCycle % 2 === 0);
    freeZombie.bossSubtype = isButcher ? "butcher" : "brute";

    if (isButcher) {
      freeZombie.maxHp = Math.round(125 * Math.pow(1.25, Math.max(0, bossCycle - 1)));
      freeZombie.hp = freeZombie.maxHp;
      freeZombie.baseSpeed = ZOMBIE_BASE_SPEED * ZOMBIE_SPEED_RATIOS.butcher * waveSpeedMultiplier;
      freeZombie.baseScale = BUTCHER_SCALE;
      freeZombie.xpValue = 300;
      playButcherRoarSound();
    } else {
      freeZombie.maxHp = Math.round(90 * Math.pow(1.25, Math.max(0, bossCycle - 1)));
      freeZombie.hp = freeZombie.maxHp;
      freeZombie.baseSpeed = ZOMBIE_BASE_SPEED * ZOMBIE_SPEED_RATIOS.boss * waveSpeedMultiplier;
      freeZombie.baseScale = BOSS_SCALE;
      freeZombie.xpValue = 220;
      state.sounds.playBossRoarSound?.();
    }

    state.activeBossZombie = freeZombie;
    state.ui.showBossBar?.(freeZombie.hp, freeZombie.maxHp);
  } else {
    freeZombie.maxHp = finalHp;
    freeZombie.hp = freeZombie.maxHp;
    freeZombie.baseSpeed = ZOMBIE_BASE_SPEED * typeConfig.speedRatio * waveSpeedMultiplier * individualVariation;
    freeZombie.baseScale = finalScale;
    freeZombie.xpValue = typeConfig.xp || 10;
  }

  freeZombie.speed = freeZombie.baseSpeed;
  var atkInterval = getZombieAttackInterval(targetType, freeZombie.bossSubtype);
  var atkWindup = getZombieAttackWindup(targetType, freeZombie.bossSubtype);
  freeZombie.attackInterval = atkInterval;
  freeZombie.attackCooldown = atkInterval; // Começa pronto para desferir ataque ao tocar o sobrevivente
  freeZombie.attackWindupDuration = atkWindup;
  freeZombie.attackPhase = "ready";
  freeZombie.attackWindupTimer = 0;
  freeZombie.mesh.visible = true;
  freeZombie.mesh.scale.set(freeZombie.baseScale, freeZombie.baseScale, freeZombie.baseScale);
  freeZombie.mesh.position.copy(candidateDir).multiplyScalar(freeZombie.surfaceRadius);

  // Alinhamento tangencial inicial exato com orientação para o sobrevivente
  zUp.copy(candidateDir).normalize();
  zForward.copy(state.playerLocalDir).addScaledVector(zUp, -state.playerLocalDir.dot(zUp));
  if (zForward.lengthSq() < 1e-6) zForward.set(0, 0, 1).addScaledVector(zUp, -zUp.z);
  zForward.normalize();
  zRight.crossVectors(zUp, zForward).normalize();
  zRotMatrix.makeBasis(zRight, zUp, zForward);
  zTargetQuat.setFromRotationMatrix(zRotMatrix);
  if (ZOMBIE_MODEL_ROTATION_Y_OFFSET !== 0) zTargetQuat.multiply(zModelOffsetQuat);
  freeZombie.mesh.quaternion.copy(zTargetQuat);

  applyZombieTypeStyles(freeZombie);
}

// ==========================================
// 7. ATUALIZAÇÃO DA IA, MOVIMENTO E COMPORTAMENTOS
// ==========================================
export function updateEnemies(dt) {
  state.frameCount = (state.frameCount || 0) + 1;

  // Medição contínua de FPS para manter 35+ FPS garantidos no Android
  var instantFps = dt > 0.0001 ? (1.0 / dt) : 60;
  state.currentFps = (state.currentFps || 60) * 0.92 + instantFps * 0.08;
  var isLowFps = state.currentFps < 35;

  for (var zi = 0; zi < state.zombiePool.length; zi++) {
    var z = state.zombiePool[zi];
    if (!z.active) continue;

    var isCurrentTarget = (state.currentTargetZombie === z);
    if (z.isTargetVisual !== isCurrentTarget) {
      z.isTargetVisual = isCurrentTarget;
      applyZombieTypeStyles(z);
    }

    // Estado de morte
    if (z.state === "die") {
      if (z.isSpitWindingUp) {
        z.isSpitWindingUp = false;
        z.head.scale.set(1, 1, 1);
        if (z.spitterBubbles) {
          for (var dieBi = 0; dieBi < z.spitterBubbles.length; dieBi++) {
            z.spitterBubbles[dieBi].scale.set(1, 1, 1);
          }
        }
      }
      if (state.currentTargetZombie === z) {
        state.currentTargetZombie = null;
        state.targetLockTime = 0;
      }
      z.dieTimer += dt;
      z.mesh.position.addScaledVector(z.dirLocal, -dt * 0.9);
      z.mesh.rotation.z += dt * 2.5;
      if (z.dieTimer >= ZOMBIE_DIE_DURATION) {
        z.active = false;
        z.mesh.visible = false;
      }
      continue;
    }

    if (z.flashTimer > 0) {
      z.flashTimer -= dt;
      if (z.flashTimer <= 0) applyZombieTypeStyles(z);
    }

    // Mecanismo de segurança: reposicionamento suave para zumbis destravados
    if (z.isUnstucking) {
      z.unstuckElapsed += dt;
      var t = Math.min(1.0, z.unstuckElapsed / z.unstuckDuration);
      var smoothT = t * t * (3 - 2 * t);

      z.dirLocal.copy(z.unstuckStartDir).lerp(z.unstuckTargetDir, smoothT).normalize();
      z.surfaceRadius = THREE.MathUtils.lerp(z.unstuckStartRadius, z.unstuckTargetRadius, smoothT);
      z.mesh.position.copy(z.dirLocal).multiplyScalar(z.surfaceRadius);

      // Mantém orientação coerente com a superfície e encarando o sobrevivente
      zUp.copy(z.dirLocal).normalize();
      zForward.copy(state.playerLocalDir).addScaledVector(zUp, -state.playerLocalDir.dot(zUp));
      if (zForward.lengthSq() < 1e-6) zForward.set(0, 0, 1).addScaledVector(zUp, -zUp.z);
      zForward.normalize();
      zRight.crossVectors(zUp, zForward).normalize();
      zRotMatrix.makeBasis(zRight, zUp, zForward);
      zTargetQuat.setFromRotationMatrix(zRotMatrix);
      if (ZOMBIE_MODEL_ROTATION_Y_OFFSET !== 0) zTargetQuat.multiply(zModelOffsetQuat);
      z.mesh.quaternion.copy(zTargetQuat);

      if (t >= 1.0) {
        z.isUnstucking = false;
        z.lastDirSample.copy(z.dirLocal);
        z.accumTravelAngle = 0;
        z.stuckTimer = 0;
      }
      continue;
    }

    // Boost temporário de velocidade concedido pelo chamado do Ululante
    if (z.speedBoostTimer > 0) {
      z.speedBoostTimer -= dt;
      if (z.speedBoostTimer <= 0) {
        z.speed = z.baseSpeed;
      }
    }

    var pDot = z.dirLocal.dot(state.playerLocalDir);
    var isDistant = pDot < 0.78;

    // DESEMPENHO NO ANDROID: Simplifica animação dos distantes
    if ((isLowFps || state.zombiePool.length > 50) && isDistant && z.type !== "boss") {
      var shouldSkipAnim = ((state.frameCount + z.frameOffset) % 3 !== 0);
      if (shouldSkipAnim) {
        zAxis.crossVectors(z.dirLocal, state.playerLocalDir).normalize();
        if (zAxis.lengthSq() > 0.0001) {
          var zWaterSpeedMulSkip = (getStepIndex(z.dirLocal) < 0) ? WATER_SPEED_FACTOR : 1.0;
          zCandDir.copy(z.dirLocal).applyAxisAngle(zAxis, z.speed * zWaterSpeedMulSkip * dt).normalize();
          var resolvedDir = resolveZombieMove(z, z.dirLocal, zCandDir);
          z.dirLocal.copy(resolvedDir);
        }
        z.mesh.position.copy(z.dirLocal).multiplyScalar(z.surfaceRadius);
        var stepDistSkip = Math.acos(Math.max(-1, Math.min(1, z.dirLocal.dot(z.lastDirSample))));
        z.accumTravelAngle += stepDistSkip;
        z.lastDirSample.copy(z.dirLocal);
        continue;
      }
    }

    var angToPlayer = Math.acos(Math.max(-1, Math.min(1, pDot)));

    // ========================================================
    // COOLDOWN E CICLO RÍTMICO DE ATAQUE POR CONTATO CORPORAL
    // ========================================================
    if (z.attackInterval === undefined) {
      z.attackInterval = getZombieAttackInterval(z.type, z.bossSubtype);
    }
    if (z.attackWindupDuration === undefined) {
      z.attackWindupDuration = getZombieAttackWindup(z.type, z.bossSubtype);
    }
    if (z.attackCooldown === undefined) {
      z.attackCooldown = z.attackInterval;
    }
    if (z.attackPhase === undefined) {
      z.attackPhase = "ready";
    }
    if (z.attackWindupTimer === undefined) {
      z.attackWindupTimer = 0;
    }

    // 1. Cooldown por zumbi: recarrega ao longo de ZOMBIE_ATTACK_INTERVAL (ou específico por tipo)
    if (z.attackCooldown < z.attackInterval) {
      z.attackCooldown = Math.min(z.attackInterval, z.attackCooldown + dt);
    }

    var isAttackingStationary = false;
    var effectiveAttackRadius = ZOMBIE_ATTACK_RADIUS;
    if (z.type === "boss") {
      effectiveAttackRadius = (z.bossSubtype === "butcher") ? 0.042 : 0.038;
    } else if (z.type === "tank") {
      effectiveAttackRadius = 0.028;
    }

    if (!state.isGameOver) {
      if (z.attackPhase === "windup") {
        // Fase 1: Antecipação visível (Windup ~0.35s). Durante o windup o zumbi não se move
        isAttackingStationary = true;
        z.attackWindupTimer -= dt;

        if (z.attackWindupTimer <= 0) {
          // Fase 2: Ao fim do windup o dano é aplicado
          // Janela de reação: se o jogador conseguiu sair do alcance durante o windup, o golpe erra
          var hitReach = effectiveAttackRadius * 1.35;
          if (angToPlayer <= hitReach) {
            var zDmg = 10;
            if (z.type === "boss") {
              zDmg = (z.bossSubtype === "butcher") ? 32 : 25;
            } else if (z.type === "tank") {
              zDmg = 16;
            } else if (z.type === "swarm") {
              zDmg = 6;
            } else if (z.type === "spitter") {
              zDmg = 12;
            } else if (z.type === "crawler") {
              zDmg = 14;
            } else if (z.type === "armored") {
              zDmg = 15;
            } else if (z.type === "screamer") {
              zDmg = 8;
            }

            state.playerHp -= zDmg;
            state.ui.triggerDamageFlash?.();
            state.camShake += 0.04;
            state.sounds.playZombieHitPlayerSound?.();
            state.ui.updateHpUI?.();

            if (state.playerHp <= 0) {
              state.isGameOver = true;
              state.ui.showGameOverModal?.();
            }
          }

          // Fase 3: Ao atacar, o cooldown é zerado e inicia a recuperação
          z.attackCooldown = 0;
          z.attackPhase = "recovery";
        }
      } else if (z.attackPhase === "recovery") {
        // Durante a recuperação até o cooldown terminar, o zumbi não se move
        isAttackingStationary = true;

        if (z.attackCooldown >= z.attackInterval) {
          // Cooldown terminou de recarregar
          if (angToPlayer < effectiveAttackRadius) {
            // Continua encostado: repete o ciclo entrando em novo windup
            z.attackPhase = "windup";
            z.attackWindupTimer = z.attackWindupDuration;
          } else {
            // Jogador se afastou: retoma perseguição normal
            z.attackPhase = "ready";
            isAttackingStationary = false;
          }
        }
      } else {
        // Fase Pronta: ao entrar no alcance (< ZOMBIE_ATTACK_RADIUS), para e entra em windup
        // Sem cooldown disponível, nenhum dano é aplicado
        if (angToPlayer < effectiveAttackRadius && z.attackCooldown >= z.attackInterval) {
          z.attackPhase = "windup";
          z.attackWindupTimer = z.attackWindupDuration;
          isAttackingStationary = true;
        }
      }
    } else {
      z.attackPhase = "ready";
    }

    // ========================================================
    // COMPORTAMENTOS ESPECÍFICOS DE CADA INIMIGO
    // ========================================================

    // 1. CUSPIDOR: Mantém distância média, telegrafa disparo (0.9s) com inflação visual e cospe projéteis verdes em arco
    var isSpitterHolding = false;
    if (z.type === "spitter") {
      if (angToPlayer <= SPITTER_STOP_DISTANCE_RAD) {
        isSpitterHolding = true; // Para e mantém distância
      }

      if (z.isSpitWindingUp) {
        isSpitterHolding = true;
        z.spitWindupTimer -= dt;

        // Efeito de telegrafia visual: cabeça e pústulas inflam ritmicamente avisando o sobrevivente
        var windupRatio = 1.0 - Math.max(0, z.spitWindupTimer / SPITTER_WINDUP_DURATION);
        var swellFactor = 1.0 + Math.sin(windupRatio * Math.PI) * 0.40;
        z.head.scale.set(swellFactor, swellFactor, swellFactor);
        if (z.spitterBubbles) {
          for (var sbi = 0; sbi < z.spitterBubbles.length; sbi++) {
            z.spitterBubbles[sbi].scale.set(swellFactor * 1.3, swellFactor * 1.3, swellFactor * 1.3);
          }
        }

        if (z.spitWindupTimer <= 0) {
          z.isSpitWindingUp = false;
          z.head.scale.set(1, 1, 1);
          if (z.spitterBubbles) {
            for (var rbi = 0; rbi < z.spitterBubbles.length; rbi++) {
              z.spitterBubbles[rbi].scale.set(1, 1, 1);
            }
          }
          applyZombieTypeStyles(z);
          z.spitCooldown = SPITTER_SHOOT_COOLDOWN + Math.random() * 0.8;
          spawnSpit(z.dirLocal, state.playerLocalDir);
        }
      } else {
        z.spitCooldown -= dt;
        if (z.spitCooldown <= 0 && angToPlayer <= SPITTER_STOP_DISTANCE_RAD * 1.6) {
          // Escalonamento entre múltiplos cuspidores para evitar salvas simultâneas injustas
          var nowSec = performance.now() * 0.001;
          var timeSinceLastSpitterWindup = nowSec - (state.lastSpitterWindupTime || 0);

          if (timeSinceLastSpitterWindup < SPITTER_STAGGER_DELAY) {
            z.spitCooldown = SPITTER_STAGGER_DELAY + Math.random() * 0.35;
          } else {
            state.lastSpitterWindupTime = nowSec;
            z.isSpitWindingUp = true;
            z.spitWindupTimer = SPITTER_WINDUP_DURATION;
            applyZombieTypeStyles(z);
          }
        }
      }
    }

    // 2. ULULANTE: Ao avistar o jogador, grita, atrai horda e acelera spawns
    if (z.type === "screamer") {
      if (!z.hasScreamed && angToPlayer < SCREAMER_TRIGGER_DISTANCE_RAD) {
        z.hasScreamed = true;
        z.isScreaming = true;
        z.screamTimer = SCREAMER_DURATION;
        playScreamerHowlSound();
        triggerScreamerWave(z.dirLocal);

        // Atrai todos os zumbis e acelera spawns
        state.screamerSpawnBoostTimer = SCREAMER_SPAWN_ACCEL_DURATION;
        state.spawnCooldown = Math.min(state.spawnCooldown, 0.12);

        for (var si = 0; si < state.zombiePool.length; si++) {
          var sz = state.zombiePool[si];
          if (sz.active && sz.state === "walk") {
            sz.speed = sz.baseSpeed * SCREAMER_CALL_BOOST_SPEED_MULTIPLIER;
            sz.speedBoostTimer = SCREAMER_CALL_BOOST_DURATION;
          }
        }
      }

      if (z.isScreaming) {
        z.screamTimer -= dt;
        // Cabeça inclinada para trás durante o chamado
        z.head.rotation.x = -0.55;
        if (z.screamTimer <= 0) {
          z.isScreaming = false;
          z.head.rotation.x = 0;
        }
        continue; // Permanece parado enquanto uiva
      }
    }

    // 3. CARNICEIRO: Anda -> Acumula 1,5s -> Investida rápida 2s (com tremor) -> Descanso 1,5s
    var isButcherCharging = false;
    if (z.type === "boss" && z.bossSubtype === "butcher") {
      if (z.chargeState === "stalk") {
        z.stalkTimer -= dt;
        if (z.stalkTimer <= 0) {
          z.chargeState = "windup";
          z.windupTimer = BUTCHER_WINDUP_DURATION;
          playButcherRoarSound();
        }
      } else if (z.chargeState === "windup") {
        z.windupTimer -= dt;
        // Vibração visual no lugar acumulando energia
        z.mesh.position.x += (Math.random() - 0.5) * 0.06;
        if (z.windupTimer <= 0) {
          z.chargeState = "charge";
          z.chargeTimer = BUTCHER_CHARGE_DURATION;
          // Trava a linha reta da investida
          z.chargeTravelAxis.crossVectors(z.dirLocal, state.playerLocalDir).normalize();
        }
        continue;
      } else if (z.chargeState === "charge") {
        z.chargeTimer -= dt;
        isButcherCharging = true;
        // Tremor contínuo de câmera durante a investida
        state.camShake += 0.015;
        if (z.chargeTimer <= 0) {
          z.chargeState = "rest";
          z.restTimer = BUTCHER_REST_DURATION;
        }
      } else if (z.chargeState === "rest") {
        z.restTimer -= dt;
        z.torso.position.y = 0.25 + Math.sin(performance.now() * 0.008) * 0.04;
        if (z.restTimer <= 0) {
          z.chargeState = "stalk";
          z.stalkTimer = BUTCHER_CHARGE_INTERVAL;
        }
        continue; // Descansa vulnerável
      }
    }

    // ========================================================
    // ANIMAÇÃO PROCEDURAL (CAMINHADA OU ATAQUE COM RITMO)
    // Aplica WATER_SPEED_FACTOR na água para terreno tático equilibrado
    // ========================================================
    var isZombieInWater = getStepIndex(z.dirLocal) < 0;
    var zWaterSpeedMul = isZombieInWater ? WATER_SPEED_FACTOR : 1.0;

    var effectiveSpeed = z.speed * zWaterSpeedMul;
    if (isButcherCharging) {
      effectiveSpeed = z.baseSpeed * BUTCHER_CHARGE_SPEED_MULTIPLIER * zWaterSpeedMul;
    }
    if (isAttackingStationary) {
      effectiveSpeed = 0;
    }

    if (isAttackingStationary) {
      // Durante windup e recuperação o zumbi não se move e mantém pernas firmes
      z.legL.rotation.x = THREE.MathUtils.lerp(z.legL.rotation.x, 0, 0.25);
      z.legR.rotation.x = THREE.MathUtils.lerp(z.legR.rotation.x, 0, 0.25);

      if (z.attackPhase === "windup") {
        // Antecipação visível: ergue os braços acima da cabeça preparando o golpe
        var windupT = 1.0 - Math.max(0, z.attackWindupTimer / Math.max(0.01, z.attackWindupDuration));
        var raiseAngle = -Math.PI * 0.5 - windupT * 1.15; // De horizontal (-1.57) até alto (~-2.72)
        z.armL.rotation.x = raiseAngle;
        z.armR.rotation.x = raiseAngle;
        z.armL.rotation.z = 0.25 * windupT;
        z.armR.rotation.z = -0.25 * windupT;
        z.torso.position.y = (z.type === "crawler" ? 0.12 : 0.29) + windupT * 0.04;
        z.torso.rotation.x = -0.15 * windupT;
        z.head.rotation.x = -0.15 * windupT;
      } else if (z.attackPhase === "recovery") {
        // Recuperação pós-ataque: braços descem no golpe e retornam gradualmente à postura inicial
        var recProgress = Math.min(1.0, z.attackCooldown / Math.max(0.01, z.attackInterval * 0.45));
        var recAngle = THREE.MathUtils.lerp(-0.35, -Math.PI * 0.5, recProgress);
        z.armL.rotation.x = recAngle;
        z.armR.rotation.x = recAngle;
        z.armL.rotation.z = THREE.MathUtils.lerp(0.18, 0, recProgress);
        z.armR.rotation.z = THREE.MathUtils.lerp(-0.18, 0, recProgress);
        z.torso.position.y = THREE.MathUtils.lerp(0.26, (z.type === "crawler" ? 0.07 : 0.29), recProgress);
        z.torso.rotation.x = THREE.MathUtils.lerp(0.10, 0, recProgress);
        z.head.rotation.x = THREE.MathUtils.lerp(0.10, 0, recProgress);
      }
    } else {
      var distTraveled = effectiveSpeed * PLANET_BASE_RADIUS * dt;
      var strideLen = (ZOMBIE_WALK_CONFIG.strideLength && ZOMBIE_WALK_CONFIG.strideLength[z.type]) || 0.26;
      var prevWalkPhase = z.walkPhase;
      z.walkPhase += (distTraveled / strideLen) * (Math.PI * 2);

      // Efeito de respingo d'água ao caminhar na água
      if (isZombieInWater && effectiveSpeed > 0.01) {
        var prevStep = Math.floor(prevWalkPhase / Math.PI);
        var curStep = Math.floor(z.walkPhase / Math.PI);
        if (prevStep !== curStep && ((state.frameCount + z.frameOffset) % 2 === 0)) {
          triggerWaterSplash(z.dirLocal, 2);
        }
      }

      var phase = z.walkPhase + z.phaseOffset;
      var speedRatio = Math.min(2.5, effectiveSpeed / ZOMBIE_BASE_SPEED);

      if (z.type === "crawler") {
        // Rastejante: corpo colado ao solo, ondulação sinuosa lateral
        z.torso.position.y = 0.07 + Math.sin(phase) * 0.02;
        z.torso.rotation.y = Math.sin(phase) * 0.35;
        z.armL.rotation.y = Math.sin(phase) * 0.45;
        z.armR.rotation.y = -Math.sin(phase) * 0.45;
        z.legL.rotation.y = -Math.sin(phase) * 0.40;
        z.legR.rotation.y = Math.sin(phase) * 0.40;
      } else {
        z.legL.rotation.x = Math.sin(phase) * (ZOMBIE_WALK_CONFIG.legAmplitude * speedRatio);
        z.legR.rotation.x = -Math.sin(phase) * (ZOMBIE_WALK_CONFIG.legAmplitude * speedRatio);

        z.armL.rotation.x = -Math.PI / 2 + Math.sin(phase * 0.95) * (ZOMBIE_WALK_CONFIG.armSwingBase * speedRatio);
        z.armR.rotation.x = -Math.PI / 2 - Math.sin(phase * 1.05 + 0.35) * (ZOMBIE_WALK_CONFIG.armSwingBase * speedRatio);
        z.torso.position.y = 0.29 + Math.abs(Math.sin(phase)) * (ZOMBIE_WALK_CONFIG.bobAmplitude * speedRatio);
        z.torso.rotation.x = 0;
      }
    }

    // ========================================================
    // DESLOCAMENTO NA ESFERA
    // ========================================================
    if (!isSpitterHolding && !isAttackingStationary) {
      if (isButcherCharging && z.chargeTravelAxis.lengthSq() > 0.001) {
        // Ponto 2: Investida do Carniceiro (com exceção de atropelar pequenos obstáculos tratada em resolveZombieMove)
        zCandDir.copy(z.dirLocal).applyAxisAngle(z.chargeTravelAxis, effectiveSpeed * dt).normalize();
        var resolvedDir = resolveZombieMove(z, z.dirLocal, zCandDir);
        z.dirLocal.copy(resolvedDir);
      } else {
        zAxis.crossVectors(z.dirLocal, state.playerLocalDir).normalize();
        if (z.type === "swarm") {
          // Enxame: movimento nervoso e irregular em zigue-zague
          zAxis.applyAxisAngle(z.dirLocal, Math.sin(phase * 1.8) * 0.25);
        }
        if (zAxis.lengthSq() > 0.0001) {
          // Ponto 3: Caminhada normal e avanço alternativo
          zCandDir.copy(z.dirLocal).applyAxisAngle(zAxis, effectiveSpeed * dt).normalize();
          var resolvedDir = resolveZombieMove(z, z.dirLocal, zCandDir);
          z.dirLocal.copy(resolvedDir);
        }
      }
    }

    // Raycast de terreno suave
    var shouldRaycast = (pDot > 0.90) || ((state.frameCount + z.frameOffset) % 3 === 0);
    if (shouldRaycast) {
      z.targetRadius = getTerrainRadiusAtDir(z.dirLocal, z.targetRadius || z.surfaceRadius);
    }
    z.surfaceRadius += (z.targetRadius - z.surfaceRadius) * ZOMBIE_TERRAIN_LERP_FACTOR;
    z.mesh.position.copy(z.dirLocal).multiplyScalar(z.surfaceRadius);

    // Orientação tangencial
    zUp.copy(z.dirLocal).normalize();
    zForward.copy(state.playerLocalDir).addScaledVector(zUp, -state.playerLocalDir.dot(zUp));
    if (zForward.lengthSq() < 1e-6) zForward.set(0, 0, 1).addScaledVector(zUp, -zUp.z);
    zForward.normalize();

    zRight.crossVectors(zUp, zForward).normalize();
    zRotMatrix.makeBasis(zRight, zUp, zForward);
    zTargetQuat.setFromRotationMatrix(zRotMatrix);
    if (ZOMBIE_MODEL_ROTATION_Y_OFFSET !== 0) zTargetQuat.multiply(zModelOffsetQuat);
    z.mesh.quaternion.slerp(zTargetQuat, ZOMBIE_ROTATION_SLERP_FACTOR);

    // Acumula a distância angular percorrida no frame
    var stepDist = Math.acos(Math.max(-1, Math.min(1, z.dirLocal.dot(z.lastDirSample))));
    z.accumTravelAngle += stepDist;
    z.lastDirSample.copy(z.dirLocal);

    // Destravamento por inatividade ao longo de 2,5 segundos
    var isIntentionallyStationary = isSpitterHolding || z.isScreaming || isAttackingStationary ||
      (z.type === "boss" && z.bossSubtype === "butcher" && (z.chargeState === "windup" || z.chargeState === "rest"));

    if (isIntentionallyStationary) {
      z.stuckTimer = 0;
      z.accumTravelAngle = 0;
    } else {
      z.stuckTimer += dt;
      if (z.stuckTimer >= ZOMBIE_STUCK_TIME_THRESHOLD) {
        if (z.accumTravelAngle < ZOMBIE_STUCK_MIN_TRAVEL) {
          // Zumbi preso! Reposiciona suavemente para a direção livre mais próxima fora de qualquer collider
          var freeUnstuckDir = findClosestFreeDirection(z.dirLocal, z, ZOMBIE_UNSTUCK_MAX_ANG_RAD);
          var angDiff = Math.acos(Math.max(-1, Math.min(1, z.dirLocal.dot(freeUnstuckDir))));

          if (angDiff > 0.005) {
            z.isUnstucking = true;
            z.unstuckElapsed = 0;
            z.unstuckDuration = 0.35;
            z.unstuckStartDir.copy(z.dirLocal);
            z.unstuckStartRadius = z.surfaceRadius;
            z.unstuckTargetDir.copy(freeUnstuckDir);
            z.unstuckTargetRadius = getTerrainRadiusAtDir(freeUnstuckDir, radiusAt(freeUnstuckDir));
          }
        }
        z.accumTravelAngle = 0;
        z.stuckTimer = 0;
      }
    }
  }

  // ========================================================
  // ATUALIZAÇÃO DOS PROJÉTEIS DE CUSPE (EM ARCO)
  // ========================================================
  var activeSpitPool = state.spitPool || [];
  for (var pi = 0; pi < activeSpitPool.length; pi++) {
    var spit = activeSpitPool[pi];
    if (!spit.active) continue;

    spit.currentAngle += spit.speed * dt;
    spit.dirLocal.applyAxisAngle(spit.travelAxis, spit.speed * dt);

    var travelPct = Math.min(1.0, spit.currentAngle / (spit.totalAngle || 0.01));
    var arcHeight = Math.sin(travelPct * Math.PI) * 0.75;
    var spitR = radiusAt(spit.dirLocal) + 0.35 + arcHeight;
    spit.mesh.position.copy(spit.dirLocal).multiplyScalar(spitR);

    // Colisão do cuspe contra obstáculos sólidos do cenário (props altos)
    if (state.colliders && state.colliders.length > 0) {
      var hitSolidProp = false;
      for (var ciS = 0; ciS < state.colliders.length; ciS++) {
        var colS = state.colliders[ciS];
        if (!colS.blocksProjectiles) continue;
        var dotS = spit.dirLocal.dot(colS.dir);
        if (dotS < 0.985) continue;
        if (dotS > colS.cosRad) {
          hitSolidProp = true;
          break;
        }
      }
      if (hitSolidProp) {
        spit.active = false;
        spit.mesh.visible = false;
        createAcidPuddle(spit.dirLocal);
        playSpitHitSound();
        continue;
      }
    }

    // Colisão do projétil de cuspe com o jogador
    var sDotP = spit.dirLocal.dot(state.playerLocalDir);
    var sDistAng = Math.acos(Math.max(-1, Math.min(1, sDotP)));

    if (sDistAng < 0.050 && !state.isGameOver) {
      spit.active = false;
      spit.mesh.visible = false;
      createAcidPuddle(spit.dirLocal);
      state.playerHp -= SPITTER_PROJECTILE_DAMAGE;
      state.ui.triggerDamageFlash?.();
      state.camShake += 0.035;
      playSpitHitSound();
      state.ui.updateHpUI?.();

      if (state.playerHp <= 0) {
        state.isGameOver = true;
        state.ui.showGameOverModal?.();
      }
      continue;
    }

    if (travelPct >= 1.0) {
      spit.active = false;
      spit.mesh.visible = false;
      createAcidPuddle(spit.dirLocal);
    }
  }

  // ========================================================
  // ATUALIZAÇÃO DAS POÇAS DE ÁCIDO NO SOLO
  // ========================================================
  var activePuddles = state.acidPuddles || [];
  for (var api = 0; api < activePuddles.length; api++) {
    var ap = activePuddles[api];
    if (!ap.active) continue;

    ap.timer += dt;
    var pPct = ap.timer / (ap.maxLife || 3.5);
    if (pPct >= 1.0) {
      ap.active = false;
      ap.mesh.visible = false;
      continue;
    }

    var fade = Math.max(0, 1.0 - pPct);
    ap.mesh.material.opacity = 0.75 * fade;
    var pScale = 1.0 + Math.sin(pPct * Math.PI) * 0.12;
    ap.mesh.scale.set(pScale, pScale, 1.0);
  }

  // ========================================================
  // ATUALIZAÇÃO DAS ONDAS DE CHOQUE DO ULULANTE
  // ========================================================
  var activeWavePool = state.screamerWaves || [];
  for (var wi = 0; wi < activeWavePool.length; wi++) {
    var wave = activeWavePool[wi];
    if (!wave.active) continue;

    wave.timer += dt;
    var wavePct = wave.timer / 0.85;
    if (wavePct >= 1.0) {
      wave.active = false;
      wave.mesh.visible = false;
      continue;
    }

    var waveScale = 1.0 + wavePct * 5.0;
    wave.mesh.scale.set(waveScale, waveScale, 1.0);
    wave.mesh.material.opacity = (1.0 - wavePct) * 0.8;
  }
}
