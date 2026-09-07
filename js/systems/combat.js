// O que faz: Gerencia mira automática 360° com trava anti-tremor (temporal, histerese e espaçada), disparo alinhado (<12°), projéteis, partículas, itens e síntese de áudio.
// Exporta: initCombat, updateCombat, showDamagePopup, spawnPickup, triggerDeathDust, initAudio, getAimRange.
// Depende de: js/config.js, js/state.js, js/core/math.js

import {
  MAX_BULLETS,
  MAX_PICKUPS,
  BASE_SHOOT_INTERVAL,
  BULLET_BASE_SPEED,
  BULLET_MAX_LIFE,
  FRENZY_DURATION,
  BOMB_RADIUS,
  BOMB_BASE_RADIUS,
  BOMB_RADIUS_STEP,
  BOMB_DAMAGE,
  BOMB_KNOCKBACK,
  INITIAL_BOMBS,
  MAX_BOMBS,
  DRONE_BASE_DURATION,
  DRONE_BASE_DAMAGE,
  DRONE_BASE_FIRE_RATE,
  DRONE_RANGE,
  DRONE_ORBIT_RADIUS,
  DRONE_HEIGHT,
  DRONE_ORBIT_SPEED,
  PICKUP_COLLECT_RADIUS,
  BASE_AIM_RANGE_DAY,
  AIM_RANGE_NIGHT_FACTOR,
  RANGE_UPGRADE_STEP,
  AIM_ALIGN_TOLERANCE_RAD,
  TARGET_LOCK_MIN_TIME,
  TARGET_HYSTERESIS_MARGIN,
  TARGET_SEARCH_FRAME_INTERVAL,
  SPREAD_ANGLE_STEP,
  CRIT_CHANCE,
  CRIT_MULTIPLIER,
  BOSS_FREEZE_FRAME_DURATION,
  DAY_PHASE_DURATION,
  SUNSET_PHASE_DURATION,
  NIGHT_PHASE_DURATION,
  DAWN_PHASE_DURATION,
  BULLET_COLOR_NORMAL,
  BULLET_COLOR_FRENZY,
  PICKUP_DROP_CHANCE,
  PICKUP_MAGNET_RAD,
  MEDKIT_HEAL_AMOUNT,
  BOMB_BOSS_DAMAGE,
  WEAPONS_CONFIG,
  WEAPONS
} from "../config.js";
import { state } from "../state.js";
import { radiusAt } from "../core/math.js";
import { initPickups, updatePickups, spawnXpOrb } from "./pickups.js";
import { resolveZombieMove } from "../entities/enemies.js";

// Vetores temporários reutilizáveis para evitar alocação de memória
var tempAimVec = new THREE.Vector3();
var tempAimTargetPos = new THREE.Vector3();
var tempProjVec = new THREE.Vector3();
var tempDeathWorldPos = new THREE.Vector3();
var tempPushAxis = new THREE.Vector3();
var tempKnockbackCand = new THREE.Vector3();

// Acumulador de tempo de combate para cooldowns de efeitos e armas
var combatTime = 0;

// ==========================================
// 1. SÍNTESE DE ÁUDIO PROCEDURAL (WEB AUDIO)
// ==========================================
var audioCtx = null;
export function initAudio() {
  if (!audioCtx) {
    var AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function playShootSound(weaponId) {
  var ctx = initAudio();
  if (!ctx) return;
  var now = ctx.currentTime;
  var osc = ctx.createOscillator();
  var gain = ctx.createGain();

  if (weaponId === "shotgun") {
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.18);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.19);
  } else if (weaponId === "flamethrower") {
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(140 + Math.random() * 60, now);
    osc.frequency.linearRampToValueAtTime(80, now + 0.08);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  } else if (weaponId === "rifle") {
    osc.type = "square";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.22);
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.23);
  } else if (weaponId === "grenadelauncher") {
    osc.type = "sine";
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.25);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  } else if (weaponId === "saw") {
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.linearRampToValueAtTime(220, now + 0.14);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  } else if (weaponId === "machinegun") {
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(740, now);
    osc.frequency.exponentialRampToValueAtTime(130, now + 0.08);
    gain.gain.setValueAtTime(0.13, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  } else if (weaponId === "smg") {
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(680, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.07);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  } else if (weaponId === "ricochet" || weaponId === "perforator") {
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(360, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.16);
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  } else if (weaponId === "blades") {
    osc.type = "triangle";
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.linearRampToValueAtTime(880, now + 0.09);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.10);
  } else {
    // Pistola padrão
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }
}

function playBombSound() {
  var ctx = initAudio();
  if (!ctx) return;
  var now = ctx.currentTime;
  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(24, now + 0.55);
  gain.gain.setValueAtTime(0.55, now);
  gain.gain.linearRampToValueAtTime(0.001, now + 0.55);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.58);
}

function playWeaponPickupSound() {
  var ctx = initAudio();
  if (!ctx) return;
  var notes = [440, 660, 880, 1100];
  notes.forEach(function (f, i) {
    var now = ctx.currentTime + i * 0.05;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(f, now);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  });
}

function playItemPickupSound() {
  var ctx = initAudio();
  if (!ctx) return;
  var notes = [523.25, 659.25, 783.99];
  notes.forEach(function (f, i) {
    var now = ctx.currentTime + i * 0.06;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(f, now);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  });
}

function playExplosionSound() {
  var ctx = initAudio();
  if (!ctx) return;
  var now = ctx.currentTime;
  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(140, now);
  osc.frequency.exponentialRampToValueAtTime(25, now + 0.35);
  gain.gain.setValueAtTime(0.35, now);
  gain.gain.linearRampToValueAtTime(0.001, now + 0.38);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.40);
}

function playMinePlantSound() {
  var ctx = initAudio();
  if (!ctx) return;
  var now = ctx.currentTime;
  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.setValueAtTime(1320, now + 0.05);
  gain.gain.setValueAtTime(0.15, now);
  gain.gain.linearRampToValueAtTime(0.001, now + 0.12);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.13);
}

function playDeploySound() {
  var ctx = initAudio();
  if (!ctx) return;
  var now = ctx.currentTime;
  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(320, now);
  osc.frequency.exponentialRampToValueAtTime(640, now + 0.15);
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.linearRampToValueAtTime(0.001, now + 0.16);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.18);
}

function playWoodBreakSound() {
  var ctx = initAudio();
  if (!ctx) return;
  var now = ctx.currentTime;
  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.22);
  gain.gain.setValueAtTime(0.3, now);
  gain.gain.linearRampToValueAtTime(0.001, now + 0.24);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.25);
}

function playXpSound() {
  var ctx = initAudio();
  if (!ctx) return;
  var now = ctx.currentTime;
  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(1046.5, now);
  gain.gain.setValueAtTime(0.16, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.13);
}

function playHitSound() {
  var ctx = initAudio();
  if (!ctx) return;
  var now = ctx.currentTime;
  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(160, now);
  osc.frequency.exponentialRampToValueAtTime(45, now + 0.15);
  gain.gain.setValueAtTime(0.16, now);
  gain.gain.linearRampToValueAtTime(0.001, now + 0.15);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.16);
}

function playDashSound() {
  var ctx = initAudio();
  if (!ctx) return;
  var now = ctx.currentTime;
  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(320, now);
  osc.frequency.exponentialRampToValueAtTime(740, now + 0.2);
  gain.gain.setValueAtTime(0.2, now);
  gain.gain.linearRampToValueAtTime(0.001, now + 0.22);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.23);
}

function playLevelUpSound() {
  var ctx = initAudio();
  if (!ctx) return;
  var notes = [261.63, 329.63, 392.0, 523.25];
  notes.forEach(function (freq, index) {
    var now = ctx.currentTime + index * 0.08;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  });
}

function playWaveSound() {
  var ctx = initAudio();
  if (!ctx) return;
  var now = ctx.currentTime;
  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(440, now + 0.4);
  gain.gain.setValueAtTime(0.25, now);
  gain.gain.linearRampToValueAtTime(0.001, now + 0.5);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.55);
}

function playBossRoarSound() {
  var ctx = initAudio();
  if (!ctx) return;
  var now = ctx.currentTime;
  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(90, now);
  osc.frequency.exponentialRampToValueAtTime(35, now + 0.75);
  gain.gain.setValueAtTime(0.35, now);
  gain.gain.linearRampToValueAtTime(0.001, now + 0.8);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.82);
}

function playBossStepSound() {
  var ctx = initAudio();
  if (!ctx) return;
  var now = ctx.currentTime;
  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(70, now);
  osc.frequency.exponentialRampToValueAtTime(25, now + 0.18);
  gain.gain.setValueAtTime(0.28, now);
  gain.gain.linearRampToValueAtTime(0.001, now + 0.2);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.22);
}

function playZombieHitPlayerSound() {
  var ctx = initAudio();
  if (!ctx) return;
  var now = ctx.currentTime;
  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(120, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
  gain.gain.setValueAtTime(0.3, now);
  gain.gain.linearRampToValueAtTime(0.001, now + 0.22);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.24);
}

// ==========================================
// 2. POPUPS FLUTUANTES DE DANO
// ==========================================
var damageContainer = null;

export function showDamagePopup(worldPos, damageText, isCrit) {
  // Desativado: números de dano removidos para manter a tela limpa e sem poluição visual
  return;
}

// ==========================================
// 3. EFEITOS DE MORTE E PARTÍCULAS
// ==========================================
export function triggerDeathDust(originPos, count) {
  var pCount = count || 12;
  for (var i = 0; i < pCount; i++) {
    for (var di = 0; di < state.darkParticles.length; di++) {
      var dp = state.darkParticles[di];
      if (!dp.active) {
        dp.active = true;
        dp.life = 0.55 + Math.random() * 0.25;
        dp.maxLife = dp.life;
        dp.mesh.position.copy(originPos);
        dp.mesh.position.x += (Math.random() - 0.5) * 0.3;
        dp.mesh.position.y += (Math.random() - 0.5) * 0.3;
        dp.mesh.position.z += (Math.random() - 0.5) * 0.3;

        var v = new THREE.Vector3(
          (Math.random() - 0.5) * 1.8,
          Math.random() * 1.5 + 0.4,
          (Math.random() - 0.5) * 1.8
        );
        dp.vel.copy(v);
        dp.mesh.visible = true;
        break;
      }
    }
  }
}

// ==========================================
// 4. ITENS COLETÁVEIS (PICKUPS)
// ==========================================
export function spawnPickup(dirLocal) {
  var freePickup = null;
  for (var pi = 0; pi < state.pickupPool.length; pi++) {
    if (!state.pickupPool[pi].active) {
      freePickup = state.pickupPool[pi];
      break;
    }
  }
  if (!freePickup) return;

  var roll = Math.random();
  var type = "medkit";
  if (roll < 0.40) type = "medkit";
  else if (roll < 0.75) type = "frenzy";
  else type = "bomb";

  freePickup.active = true;
  freePickup.type = type;
  freePickup.dirLocal.copy(dirLocal);
  freePickup.life = 16.0;

  var r = radiusAt(dirLocal) + 0.35;
  freePickup.group.position.copy(dirLocal).multiplyScalar(r);
  freePickup.group.visible = true;

  if (type === "medkit") {
    freePickup.mesh.material = medkitMat;
  } else if (type === "frenzy") {
    freePickup.mesh.material = frenzyMat;
  } else {
    freePickup.mesh.material = bombMat;
  }
}

// ==========================================
// 5. CÁLCULO DE ALCANCE DIURNO / NOTURNO
// ==========================================
export function getAimRange() {
  var t = state.dayNightTimer || 0;
  var nightFactor = 1.0;

  if (t < DAY_PHASE_DURATION) {
    nightFactor = 1.0;
  } else if (t < DAY_PHASE_DURATION + SUNSET_PHASE_DURATION) {
    var p = (t - DAY_PHASE_DURATION) / SUNSET_PHASE_DURATION;
    nightFactor = 1.0 - (1.0 - AIM_RANGE_NIGHT_FACTOR) * p;
  } else if (t < DAY_PHASE_DURATION + SUNSET_PHASE_DURATION + NIGHT_PHASE_DURATION) {
    nightFactor = AIM_RANGE_NIGHT_FACTOR;
  } else {
    var p2 = (t - (DAY_PHASE_DURATION + SUNSET_PHASE_DURATION + NIGHT_PHASE_DURATION)) / DAWN_PHASE_DURATION;
    nightFactor = AIM_RANGE_NIGHT_FACTOR + (1.0 - AIM_RANGE_NIGHT_FACTOR) * p2;
  }

  var curW = state.currentWeapon || "pistol";
  var wConfig = WEAPONS_CONFIG[curW] || WEAPONS_CONFIG.pistol;
  var baseRange = wConfig.range || BASE_AIM_RANGE_DAY;
  var rangeLevel = state.upgrades?.range ? state.upgrades.range.level : 0;
  return (baseRange + rangeLevel * RANGE_UPGRADE_STEP) * nightFactor;
}

// Materiais reutilizáveis de projéteis e coletáveis
var bulletMat = new THREE.MeshBasicMaterial({ color: BULLET_COLOR_NORMAL });
var bulletFrenzyMat = new THREE.MeshBasicMaterial({ color: BULLET_COLOR_FRENZY });
var medkitMat = new THREE.MeshLambertMaterial({ color: 0x22c55e, emissive: 0x15803d });
var frenzyMat = new THREE.MeshLambertMaterial({ color: 0xef4444, emissive: 0xb91c1c });
var bombMat = new THREE.MeshLambertMaterial({ color: 0x1e293b, emissive: 0xf97316 });

// ==========================================
// 5.1 COMPANION DRONE E LÂMINAS ORBITAIS
// ==========================================
function createDroneCompanionMesh() {
  var droneGroup = new THREE.Group();

  // Chassi central
  var bodyMat = new THREE.MeshLambertMaterial({ color: 0x0f172a, flatShading: true });
  var body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.24), bodyMat);
  droneGroup.add(body);

  // Visor frontal ciano brilhante
  var eyeMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
  var eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), eyeMat);
  eye.position.set(0, 0.02, 0.12);
  droneGroup.add(eye);

  // Braços diagonais e hélices
  var armMat = new THREE.MeshLambertMaterial({ color: 0x334155, flatShading: true });
  var rotorMat = new THREE.MeshLambertMaterial({ color: 0x94a3b8, flatShading: true });
  var rotorBlades = [];

  var armOffsets = [
    { x: 0.14, z: 0.14 },
    { x: -0.14, z: 0.14 },
    { x: 0.14, z: -0.14 },
    { x: -0.14, z: -0.14 }
  ];

  for (var i = 0; i < armOffsets.length; i++) {
    var arm = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.02, 0.12), armMat);
    arm.position.set(armOffsets[i].x * 0.6, 0, armOffsets[i].z * 0.6);
    arm.rotation.y = (armOffsets[i].x * armOffsets[i].z > 0) ? Math.PI / 4 : -Math.PI / 4;
    droneGroup.add(arm);

    var rotor = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.008, 0.024), rotorMat);
    rotor.position.set(armOffsets[i].x, 0.045, armOffsets[i].z);
    droneGroup.add(rotor);
    rotorBlades.push(rotor);
  }

  // Mini metralhadora inferior
  var gunMat = new THREE.MeshLambertMaterial({ color: 0x0284c7, flatShading: true });
  var gun = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.12, 6), gunMat);
  gun.rotation.x = Math.PI / 2;
  gun.position.set(0, -0.05, 0.06);
  droneGroup.add(gun);

  droneGroup.userData.rotorBlades = rotorBlades;
  droneGroup.visible = false;
  return droneGroup;
}

function createOrbitalBlades() {
  var bladesGroup = new THREE.Group();
  var bladeGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.018, 12);
  var bladeMat = new THREE.MeshLambertMaterial({ color: 0xe2e8f0, flatShading: true });
  var edgeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

  var blades = [];
  for (var i = 0; i < 3; i++) {
    var bCont = new THREE.Group();
    var disc = new THREE.Mesh(bladeGeo, bladeMat);
    disc.rotation.x = Math.PI / 2;
    bCont.add(disc);

    var edgeRing = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.012, 6, 12), edgeMat);
    bCont.add(edgeRing);

    bladesGroup.add(bCont);
    blades.push(bCont);
  }

  bladesGroup.userData.blades = blades;
  bladesGroup.visible = false;
  return bladesGroup;
}

export function activateDrone(customDuration) {
  var durationBonus = (state.upgrades.droneDuration?.level || 0) * 15.0;
  var dur = (customDuration || DRONE_BASE_DURATION) + durationBonus;
  state.droneActive = true;
  state.droneTimer = (state.droneTimer > 0) ? state.droneTimer + dur : dur;
  state.droneShootTimer = 0;
  if (state.droneMesh) {
    state.droneMesh.visible = true;
  }
  state.ui.updateDroneUI?.(state.droneTimer);
  state.ui.showWeaponNotification?.("🛸 Drone de Combate Ativado (" + Math.round(state.droneTimer) + "s)!");
}

export function triggerBomb() {
  if (state.isGameOver || state.isLevelUpPaused) return false;
  if (!state.bombsCount || state.bombsCount <= 0) return false;

  state.bombsCount--;
  state.ui.updateBombsUI?.();

  // Efeito sonoro de impacto e tremor forte
  playBombSound();
  state.camShake += 0.16;

  // Clarão branco breve
  var wf = document.getElementById("white-flash");
  if (wf) {
    wf.classList.add("active");
    setTimeout(function () {
      wf.classList.remove("active");
    }, 110);
  }

  // Partículas densas ao redor do jogador
  triggerDeathDust(state.characterGroup.position, 40);

  // Dano em área e empurrão radial nos sobreviventes (raio escalado por Carga Ampliada)
  var bRadiusLevel = (state.upgrades && state.upgrades.bombRadius) ? state.upgrades.bombRadius.level : 0;
  var bombRadius = BOMB_BASE_RADIUS * (1.0 + bRadiusLevel * BOMB_RADIUS_STEP);
  var bombDamage = BOMB_DAMAGE;
  var knockbackDist = BOMB_KNOCKBACK;

  for (var zi = 0; zi < state.zombiePool.length; zi++) {
    var z = state.zombiePool[zi];
    if (!z.active || z.state !== "walk" || z.hp <= 0) continue;

    var zDot = z.dirLocal.dot(state.playerLocalDir);
    var distAng = Math.acos(Math.max(-1, Math.min(1, zDot)));

    if (distAng <= bombRadius) {
      var isBoss = (z.type === "boss");
      var dmg = isBoss ? BOMB_BOSS_DAMAGE : bombDamage;
      z.hp -= dmg;
      z.flashTimer = 0.15;
      showDamagePopup(z.mesh.position, dmg.toString() + "💣", true);

      if (isBoss) {
        state.ui.updateBossHp?.(z.hp, z.maxHp);
      }

      if (z.hp <= 0) {
        z.state = "die";
        z.dieTimer = 0;
        if (state.currentTargetZombie === z) {
          state.currentTargetZombie = null;
          state.targetLockTime = 0;
        }
        z.mesh.getWorldPosition(tempDeathWorldPos);
        spawnXpOrb(tempDeathWorldPos, z.xpValue);
        if (isBoss) {
          state.freezeFrameTimer = BOSS_FREEZE_FRAME_DURATION;
          state.camShake += 0.08;
          triggerDeathDust(z.mesh.position, 35);
          state.sounds.playBossRoarSound?.();
          state.ui.hideBossBar?.();
          state.progression.triggerLevelUp?.();
          state.progression.onZombieKilled?.("boss");
        } else {
          triggerDeathDust(z.mesh.position, 16);
          state.progression.onZombieKilled?.(z.type);
          if (Math.random() < PICKUP_DROP_CHANCE) {
            spawnPickup(z.dirLocal);
          }
        }
      } else {
        // Empurra os sobreviventes para longe da posição do jogador
        tempPushAxis.crossVectors(state.playerLocalDir, z.dirLocal).normalize();
        if (tempPushAxis.lengthSq() > 0.001) {
          tempKnockbackCand.copy(z.dirLocal).applyAxisAngle(tempPushAxis, knockbackDist).normalize();
          var resolvedDir = resolveZombieMove(z, z.dirLocal, tempKnockbackCand, true);
          z.dirLocal.copy(resolvedDir);
          var zr = radiusAt(z.dirLocal) + 0.35;
          z.mesh.position.copy(z.dirLocal).multiplyScalar(zr);
        }
      }
    }
  }

  return true;
}

// ==========================================
// 6. INICIALIZAÇÃO DO SISTEMA DE COMBATE
// ==========================================
export function initCombat() {
  damageContainer = document.getElementById("damage-container");
  combatTime = 0;

  // Esconde e desativa qualquer retículo de tela remanescente
  var crosshairEl = document.getElementById("target-crosshair");
  if (crosshairEl) {
    crosshairEl.style.display = "none";
  }

  // Inicializa contagem de bombas (começa com 2, máximo de 5)
  if (state.bombsCount === undefined) state.bombsCount = INITIAL_BOMBS;
  state.maxBombs = MAX_BOMBS;

  // Inicializa meshes do Drone Companion e Lâminas Orbitais
  if (!state.droneMesh) {
    state.droneMesh = createDroneCompanionMesh();
    state.planetGroup.add(state.droneMesh);
  }
  state.droneActive = false;
  state.droneTimer = 0;
  state.droneShootTimer = 0;
  state.droneAngle = 0;

  if (!state.orbitalBladesGroup) {
    state.orbitalBladesGroup = createOrbitalBlades();
    state.planetGroup.add(state.orbitalBladesGroup);
  }
  state.bladesAngle = 0;

  // Registra sons no state
  state.sounds = {
    playShootSound: playShootSound,
    playHitSound: playHitSound,
    playDashSound: playDashSound,
    playLevelUpSound: playLevelUpSound,
    playWaveSound: playWaveSound,
    playBossRoarSound: playBossRoarSound,
    playBossStepSound: playBossStepSound,
    playZombieHitPlayerSound: playZombieHitPlayerSound,
    playWeaponPickupSound: playWeaponPickupSound,
    playItemPickupSound: playItemPickupSound,
    playExplosionSound: playExplosionSound,
    playBombSound: playBombSound,
    playMinePlantSound: playMinePlantSound,
    playDeploySound: playDeploySound,
    playWoodBreakSound: playWoodBreakSound,
    playXpSound: playXpSound
  };

  state.combat = {
    showDamagePopup: showDamagePopup,
    triggerDeathDust: triggerDeathDust,
    triggerBomb: triggerBomb,
    activateDrone: activateDrone
  };

  // Inicializa baús, orbes de XP, minas, torretas e barreiras
  initPickups();

  // Pool de projéteis
  state.bulletPool = [];
  var bulletGeo = new THREE.SphereGeometry(0.07, 5, 5);
  for (var bi = 0; bi < MAX_BULLETS; bi++) {
    var bMesh = new THREE.Mesh(bulletGeo, bulletMat);
    bMesh.visible = false;
    state.planetGroup.add(bMesh);
    state.bulletPool.push({
      mesh: bMesh,
      active: false,
      dirLocal: new THREE.Vector3(),
      travelAxis: new THREE.Vector3(),
      speed: BULLET_BASE_SPEED,
      life: 0,
      maxLife: BULLET_MAX_LIFE,
      damage: 1,
      pierceLeft: 0,
      ricochetsLeft: 0,
      hitZombies: []
    });
  }

  // Pool de coletáveis
  state.pickupPool = [];
  var pickupGeo = new THREE.BoxGeometry(0.24, 0.24, 0.24);
  for (var pi = 0; pi < MAX_PICKUPS; pi++) {
    var pGroup = new THREE.Group();
    var pMesh = new THREE.Mesh(pickupGeo, medkitMat);
    pGroup.add(pMesh);
    pGroup.visible = false;
    state.planetGroup.add(pGroup);
    state.pickupPool.push({
      group: pGroup,
      mesh: pMesh,
      active: false,
      type: "medkit",
      dirLocal: new THREE.Vector3(),
      life: 0
    });
  }

  // Pool de partículas de cinza/poeira de morte
  state.darkParticles = [];
  var pGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
  var pMat = new THREE.MeshBasicMaterial({ color: 0x221c1a, transparent: true, opacity: 0.8 });
  for (var dpi = 0; dpi < 40; dpi++) {
    var dpm = new THREE.Mesh(pGeo, pMat);
    dpm.visible = false;
    state.planetGroup.add(dpm);
    state.darkParticles.push({
      mesh: dpm,
      active: false,
      vel: new THREE.Vector3(),
      life: 0,
      maxLife: 1.0
    });
  }
}

function detonateExplosiveBullet(bullet) {
  state.camShake += 0.04;
  playExplosionSound();
  triggerDeathDust(bullet.mesh.position, 20);

  var radius = bullet.explosionRadius || 0.14;
  for (var exZi = 0; exZi < state.zombiePool.length; exZi++) {
    var ez = state.zombiePool[exZi];
    if (!ez.active || ez.state !== "walk" || ez.hp <= 0) continue;

    var ezDist = Math.acos(Math.max(-1, Math.min(1, bullet.dirLocal.dot(ez.dirLocal))));
    if (ezDist <= radius) {
      ez.hp -= bullet.damage;
      ez.flashTimer = 0.1;
      showDamagePopup(ez.mesh.position, bullet.damage.toString() + "💥", true);

      if (ez.type === "boss") {
        state.ui.updateBossHp?.(ez.hp, ez.maxHp);
      }

      if (ez.hp <= 0) {
        ez.state = "die";
        ez.dieTimer = 0;
        if (state.currentTargetZombie === ez) {
          state.currentTargetZombie = null;
          state.targetLockTime = 0;
        }
        ez.mesh.getWorldPosition(tempDeathWorldPos);
        spawnXpOrb(tempDeathWorldPos, ez.xpValue);
        if (ez.type === "boss") {
          state.freezeFrameTimer = BOSS_FREEZE_FRAME_DURATION;
          state.camShake += 0.06;
          triggerDeathDust(ez.mesh.position, 35);
          state.sounds.playBossRoarSound?.();
          state.ui.hideBossBar?.();
          state.progression.triggerLevelUp?.();
          state.progression.onZombieKilled?.("boss");
        } else {
          triggerDeathDust(ez.mesh.position, 12);
          state.progression.onZombieKilled?.(ez.type);
          if (Math.random() < PICKUP_DROP_CHANCE) {
            spawnPickup(ez.dirLocal);
          }
        }
      }
    }
  }
}

// ==========================================
// 7. ATUALIZAÇÃO DO COMBATE E DISPARO
// ==========================================
export function updateCombat(dt) {
  combatTime += dt;
  // 0. Atualização de pickups, baús, minas, torretas e barreiras
  updatePickups(dt);

  // 1. Temporizador de Frenesi
  if (state.frenzyDurationTimer > 0) {
    state.frenzyDurationTimer -= dt;
    state.ui.updateFrenzyUI?.(state.frenzyDurationTimer);
  }

  // 2. Cooldown de disparo e flash do cano
  state.shootCooldown -= dt;
  if (state.muzzleTimer > 0) {
    state.muzzleTimer -= dt;
    if (state.muzzleFlashMat && state.muzzleTimer <= 0) {
      state.muzzleFlashMat.opacity = 0;
    }
  }

  // 3. SELEÇÃO DE ALVO COM AS TRÊS TRAVAS ANTI-TREMOR
  state.targetLockTime = (state.targetLockTime || 0) + dt;
  state.targetSearchFrameCounter = (state.targetSearchFrameCounter || 0) + 1;

  var currentAimRange = getAimRange();

  // Validação contínua do alvo atual
  // Só é liberado antes do tempo se o alvo morrer ou sair do alcance
  if (state.currentTargetZombie) {
    var curZ = state.currentTargetZombie;
    if (!curZ.active || curZ.state !== "walk" || curZ.hp <= 0) {
      state.currentTargetZombie = null;
      state.targetLockTime = 0;
    } else {
      var curDot = curZ.dirLocal.dot(state.playerLocalDir);
      var curAng = Math.acos(Math.max(-1, Math.min(1, curDot)));
      if (curAng > currentAimRange) {
        state.currentTargetZombie = null;
        state.targetLockTime = 0;
      }
    }
  }

  // c) REAVALIAÇÃO ESPAÇADA: a busca pelo alvo roda a cada 6 frames, não todo frame
  var shouldRunSearch = (state.targetSearchFrameCounter % TARGET_SEARCH_FRAME_INTERVAL === 0);

  if (shouldRunSearch) {
    // a) TRAVA TEMPORAL: ao escolher um alvo, ele fica fixo por no mínimo 0,4s
    // Durante esse tempo o alvo NÃO muda, mesmo que outro fique mais perto
    var canChangeTarget = (!state.currentTargetZombie) || (state.targetLockTime >= TARGET_LOCK_MIN_TIME);

    if (canChangeTarget) {
      var bestCandidate = null;
      var bestAng = 999999;

      // Alvo: zumbi vivo mais próximo em distância angular, em qualquer direção (360°)
      for (var zi = 0; zi < state.zombiePool.length; zi++) {
        var candZ = state.zombiePool[zi];
        if (!candZ.active || candZ.state !== "walk" || candZ.hp <= 0) continue;

        var pDot = candZ.dirLocal.dot(state.playerLocalDir);
        var ang = Math.acos(Math.max(-1, Math.min(1, pDot)));
        if (ang <= currentAimRange && ang < bestAng) {
          bestAng = ang;
          bestCandidate = candZ;
        }
      }

      if (bestCandidate) {
        if (!state.currentTargetZombie) {
          state.currentTargetZombie = bestCandidate;
          state.targetLockTime = 0;
        } else if (bestCandidate !== state.currentTargetZombie) {
          // b) HISTERESE DE MARGEM: passado o tempo mínimo, só troca se o novo candidato
          // estiver pelo menos 25% mais próximo que o atual. Empates mantêm o alvo atual.
          var curDotVal = state.currentTargetZombie.dirLocal.dot(state.playerLocalDir);
          var curAngVal = Math.acos(Math.max(-1, Math.min(1, curDotVal)));
          if (bestAng <= curAngVal * (1.0 - TARGET_HYSTERESIS_MARGIN)) {
            state.currentTargetZombie = bestCandidate;
            state.targetLockTime = 0;
          }
        }
      }
    }
  }

  // 4. AUTORIZAÇÃO DE DISPARO ALINHADO AO ALVO (< 12 GRAUS)
  var canShoot = false;
  var targetZombie = state.currentTargetZombie;

  if (targetZombie && targetZombie.active && targetZombie.hp > 0 && targetZombie.state === "walk") {
    // Calcula o ângulo em yaw do sobrevivente para o alvo
    tempAimTargetPos.copy(targetZombie.mesh.position).sub(state.characterGroup.position);
    var targetYaw = Math.atan2(-tempAimTargetPos.x, -tempAimTargetPos.z);
    var diffAngle = targetYaw - state.playerCurrentAimYaw;

    while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;
    while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;

    // O tiro só sai quando o personagem estiver alinhado ao alvo dentro de ~12 graus de tolerância
    if (Math.abs(diffAngle) <= AIM_ALIGN_TOLERANCE_RAD) {
      canShoot = true;
    }
  }

  // Obtenção da arma ativa e seus parâmetros
  var currentWeaponKey = state.currentWeapon || "pistol";
  var wConfig = WEAPONS_CONFIG[currentWeaponKey] || WEAPONS_CONFIG.pistol;

  // Intervalo de tiro com melhorias e frenesi
  var fireRateLevel = state.upgrades.fireRate ? state.upgrades.fireRate.level : 0;
  var baseRate = wConfig.fireRate || BASE_SHOOT_INTERVAL;
  var currentShootInterval = baseRate / (1.0 + fireRateLevel * 0.25);
  if (state.frenzyDurationTimer > 0) currentShootInterval *= 0.5;

  // Disparo automático condicional ao alinhamento
  if (state.shootCooldown <= 0 && canShoot && !state.isGameOver && !state.isLevelUpPaused) {
    state.shootCooldown = currentShootInterval;
    playShootSound(wConfig.id);

    // Consumo de munição se for arma temporária
    if (wConfig.slot === "temporary") {
      state.temporaryWeaponAmmo = Math.max(0, (state.temporaryWeaponAmmo || 0) - 1);
      state.ui.updateWeaponUI?.();

      if (state.temporaryWeaponAmmo <= 0) {
        state.currentWeapon = state.permanentWeapon || "pistol";
        state.temporaryWeapon = null;
        state.temporaryWeaponAmmo = 0;
        var fallbackName = WEAPONS_CONFIG[state.currentWeapon]?.name || "Pistola";
        state.ui.showWeaponNotification?.("Munição Esgotada! Voltando para " + fallbackName);
        state.ui.updateWeaponUI?.();
      }
    }

    if (state.muzzleFlashMat) {
      state.muzzleFlashMat.opacity = 0.9;
      state.muzzleTimer = 0.05;
    }
    state.recoilOffset = (wConfig.id === "shotgun" || wConfig.id === "rifle" || wConfig.id === "grenadelauncher") ? 0.65 : 0.35;

    var spreadLevel = state.upgrades.spread ? state.upgrades.spread.level : 0;
    var numProjectiles = (wConfig.projectiles || 1) + (wConfig.id === "shotgun" ? spreadLevel : (spreadLevel > 0 ? spreadLevel : 0));
    var damageLevel = state.upgrades.damage ? state.upgrades.damage.level : 0;
    var bulletDamage = (wConfig.damage || 1) + damageLevel;
    var rangeLevel2 = state.upgrades.range ? state.upgrades.range.level : 0;
    var bulletSpeed = (wConfig.bulletSpeed || BULLET_BASE_SPEED) + rangeLevel2 * 0.18;
    var ricochetLevel = (wConfig.ricochets || 0) + (state.upgrades.ricochet ? state.upgrades.ricochet.level : 0);
    var pierceLevel = (wConfig.pierce || 0) + (state.upgrades.piercing ? state.upgrades.piercing.level : 0);
    var isExplosive = !!wConfig.isExplosive;
    var explosionRadius = wConfig.explosionRadius || 0;
    var isPerforator = !!wConfig.isPerforator;
    var damageDecayPerHit = wConfig.damageDecayPerHit || 0;

    // Eixo principal de rotação na esfera em direção ao alvo
    var baseAimAxis = new THREE.Vector3().crossVectors(state.playerLocalDir, targetZombie.dirLocal).normalize();
    var spreadStep = wConfig.spread || SPREAD_ANGLE_STEP;
    var startOffset = -((numProjectiles - 1) * spreadStep) / 2;

    for (var p = 0; p < numProjectiles; p++) {
      var freeBullet = null;
      for (var b = 0; b < state.bulletPool.length; b++) {
        if (!state.bulletPool[b].active) {
          freeBullet = state.bulletPool[b];
          break;
        }
      }
      if (!freeBullet) break;

      var curOffset = startOffset + p * spreadStep;
      var pAxis = baseAimAxis.clone();
      if (numProjectiles > 1) {
        pAxis.applyAxisAngle(state.playerLocalDir, curOffset);
      }

      freeBullet.active = true;
      freeBullet.dirLocal.copy(state.playerLocalDir);
      freeBullet.travelAxis.copy(pAxis);
      freeBullet.life = 0;
      freeBullet.maxLife = (wConfig.bulletLife || BULLET_MAX_LIFE) + rangeLevel2 * 0.15;
      freeBullet.speed = bulletSpeed;
      freeBullet.damage = bulletDamage;
      freeBullet.pierceLeft = pierceLevel;
      freeBullet.ricochetsLeft = ricochetLevel;
      freeBullet.isExplosive = isExplosive;
      freeBullet.explosionRadius = explosionRadius;
      freeBullet.isPerforator = isPerforator;
      freeBullet.damageDecayPerHit = damageDecayPerHit;
      freeBullet.isArc = !!wConfig.isArc;
      freeBullet.burnDuration = wConfig.burnDuration || 0;
      freeBullet.burnDamage = wConfig.burnDamage || 0;
      freeBullet.hitZombies = [];
      freeBullet.mesh.visible = true;

      if (state.frenzyDurationTimer > 0) {
        freeBullet.mesh.material = bulletFrenzyMat;
      } else {
        freeBullet.mesh.material = bulletMat;
        freeBullet.mesh.material.color.setHex(wConfig.color || BULLET_COLOR_NORMAL);
      }

      if (wConfig.id === "saw") {
        freeBullet.mesh.scale.set(1.6, 1.6, 1.6);
      } else if (wConfig.id === "flamethrower") {
        freeBullet.mesh.scale.set(1.4, 1.4, 1.4);
      } else if (wConfig.id === "grenadelauncher") {
        freeBullet.mesh.scale.set(1.5, 1.5, 1.5);
      } else if (wConfig.id === "perforator") {
        freeBullet.mesh.scale.set(1.4, 1.4, 2.2);
      } else if (wConfig.id === "rifle") {
        freeBullet.mesh.scale.set(0.85, 0.85, 1.5);
      } else {
        freeBullet.mesh.scale.set(1, 1, 1);
      }
    }
  }

  // 4.1 ATUALIZAÇÃO DO DRONE COMPANION (ORBITA ACIMA DO JOGADOR E DISPARA TIROS DE PISTOLA)
  if (state.droneActive && state.droneMesh) {
    state.droneTimer -= dt;
    state.ui.updateDroneUI?.(state.droneTimer);

    if (state.droneTimer <= 0) {
      state.droneActive = false;
      state.droneTimer = 0;
      state.droneMesh.visible = false;
      state.ui.updateDroneUI?.(0);
    } else {
      state.droneMesh.visible = true;
      state.droneAngle = (state.droneAngle || 0) + dt * DRONE_ORBIT_SPEED;

      // Animação das hélices
      var rotors = state.droneMesh.userData.rotorBlades || [];
      for (var ri = 0; ri < rotors.length; ri++) {
        rotors[ri].rotation.y += dt * 32.0;
      }

      // Posição orbital acima da cabeça do sobrevivente
      var pPos = state.characterGroup.position;
      var upNorm = state.playerLocalDir.clone().normalize();
      var tangentRef = new THREE.Vector3(0, 1, 0);
      if (Math.abs(upNorm.dot(tangentRef)) > 0.95) tangentRef.set(1, 0, 0);
      var rightVec = new THREE.Vector3().crossVectors(upNorm, tangentRef).normalize();
      var forwardVec = new THREE.Vector3().crossVectors(rightVec, upNorm).normalize();

      var orbitX = Math.cos(state.droneAngle) * DRONE_ORBIT_RADIUS;
      var orbitZ = Math.sin(state.droneAngle) * DRONE_ORBIT_RADIUS;

      state.droneMesh.position.copy(pPos)
        .addScaledVector(rightVec, orbitX)
        .addScaledVector(forwardVec, orbitZ)
        .addScaledVector(upNorm, DRONE_HEIGHT);

      // Busca do zumbi vivo mais próximo do drone
      state.droneShootTimer = (state.droneShootTimer || 0) - dt;
      var droneFireRate = DRONE_BASE_FIRE_RATE / (1.0 + (state.upgrades.droneCadence?.level || 0) * 0.25);

      var nearestZ = null;
      var nearestZDist = DRONE_RANGE;
      for (var dzi = 0; dzi < state.zombiePool.length; dzi++) {
        var dz = state.zombiePool[dzi];
        if (!dz.active || dz.state !== "walk" || dz.hp <= 0) continue;
        var dDist = Math.acos(Math.max(-1, Math.min(1, dz.dirLocal.dot(state.playerLocalDir))));
        if (dDist < nearestZDist) {
          nearestZDist = dDist;
          nearestZ = dz;
        }
      }

      if (nearestZ) {
        state.droneMesh.lookAt(nearestZ.mesh.position);

        if (state.droneShootTimer <= 0) {
          state.droneShootTimer = droneFireRate;
          playShootSound("pistol");

          // Dispara projétil auxiliar do drone
          for (var dbi = 0; dbi < state.bulletPool.length; dbi++) {
            var db = state.bulletPool[dbi];
            if (!db.active) {
              var dAimAxis = new THREE.Vector3().crossVectors(state.playerLocalDir, nearestZ.dirLocal).normalize();
              var dDmg = DRONE_BASE_DAMAGE * (1.0 + (state.upgrades.droneDamage?.level || 0) * 0.35);

              db.active = true;
              db.dirLocal.copy(state.playerLocalDir);
              db.travelAxis.copy(dAimAxis);
              db.life = 0;
              db.maxLife = 0.9;
              db.speed = 1.35;
              db.damage = Math.max(1, Math.round(dDmg));
              db.pierceLeft = 0;
              db.ricochetsLeft = 0;
              db.isExplosive = false;
              db.hitZombies = [];
              db.mesh.material = bulletMat;
              db.mesh.material.color.setHex(0x38bdf8);
              db.mesh.scale.set(0.9, 0.9, 0.9);
              db.mesh.visible = true;
              break;
            }
          }
        }
      }
    }
  }

  // 4.2 ATUALIZAÇÃO DAS LÂMINAS ORBITAIS (3 DISCOS EM ÓRBITA DO JOGADOR)
  if (state.orbitalBladesGroup) {
    var isBladesEquipped = (state.currentWeapon === "blades");
    state.orbitalBladesGroup.visible = isBladesEquipped;

    if (isBladesEquipped) {
      state.bladesAngle = (state.bladesAngle || 0) + dt * WEAPONS.blades.orbitSpeed;
      var bMeshes = state.orbitalBladesGroup.userData.blades || [];
      var bRadiusOrbit = WEAPONS.blades.orbitRadius;

      var bUp = state.playerLocalDir.clone().normalize();
      var bRef = new THREE.Vector3(0, 1, 0);
      if (Math.abs(bUp.dot(bRef)) > 0.95) bRef.set(1, 0, 0);
      var bRight = new THREE.Vector3().crossVectors(bUp, bRef).normalize();
      var bFwd = new THREE.Vector3().crossVectors(bRight, bUp).normalize();

      for (var bi_b = 0; bi_b < bMeshes.length; bi_b++) {
        var angleOffset = state.bladesAngle + bi_b * ((Math.PI * 2) / 3);
        var bx = Math.cos(angleOffset) * bRadiusOrbit;
        var bz = Math.sin(angleOffset) * bRadiusOrbit;

        var bWorldP = state.characterGroup.position.clone()
          .addScaledVector(bRight, bx)
          .addScaledVector(bFwd, bz)
          .addScaledVector(bUp, 0.35);

        bMeshes[bi_b].position.copy(bWorldP);
        bMeshes[bi_b].rotation.y += dt * 14.0;

        // Dano por contato com zumbis
        for (var bzi_c = 0; bzi_c < state.zombiePool.length; bzi_c++) {
          var bzc = state.zombiePool[bzi_c];
          if (!bzc.active || bzc.state !== "walk" || bzc.hp <= 0) continue;

          var distBladeZ = bWorldP.distanceTo(bzc.mesh.position);
          if (distBladeZ < 0.38) {
            // Cooldown por zumbi: cada zumbi só pode ser atingido a cada 0.35s
            if (bzc.lastBladeHit !== undefined && (combatTime - bzc.lastBladeHit) < 0.35) {
              continue;
            }
            bzc.lastBladeHit = combatTime;

            var bladeDmg = WEAPONS.blades.contactDamage;
            bzc.hp -= bladeDmg;
            bzc.flashTimer = 0.08;
            showDamagePopup(bzc.mesh.position, bladeDmg + "⚔️", true);

            // Consumo de 1 munição só quando o dano é realmente aplicado
            state.temporaryWeaponAmmo = Math.max(0, (state.temporaryWeaponAmmo || 0) - 1);
            state.ui.updateWeaponUI?.();

            if (state.temporaryWeaponAmmo <= 0) {
              state.currentWeapon = state.permanentWeapon || "pistol";
              state.temporaryWeapon = null;
              state.temporaryWeaponAmmo = 0;
              state.ui.showWeaponNotification?.("Lâminas Esgotadas! Voltando para Pistola");
              state.ui.updateWeaponUI?.();
            }

            if (bzc.hp <= 0) {
              bzc.lastBladeHit = undefined;
              bzc.state = "die";
              bzc.dieTimer = 0;
              bzc.mesh.getWorldPosition(tempDeathWorldPos);
              spawnXpOrb(tempDeathWorldPos, bzc.xpValue);
              triggerDeathDust(bzc.mesh.position, 14);
              state.progression.onZombieKilled?.(bzc.type);
            }
          }
        }
      }
    }
  }

  // 4.3 QUEIMADURA CONTÍNUA POR LANÇA-CHAMAS (BURN OVER TIME)
  for (var bzi2 = 0; bzi2 < state.zombiePool.length; bzi2++) {
    var bz2 = state.zombiePool[bzi2];
    if (!bz2.active || bz2.state !== "walk" || bz2.hp <= 0) continue;
    if (bz2.burnTimer > 0) {
      bz2.burnTimer -= dt;
      bz2.burnTickTimer = (bz2.burnTickTimer || 0.4) - dt;
      if (bz2.burnTickTimer <= 0) {
        bz2.burnTickTimer = 0.45;
        bz2.hp -= (bz2.burnDamage || 0.8);
        bz2.flashTimer = 0.06;
        showDamagePopup(bz2.mesh.position, (bz2.burnDamage || 0.8).toFixed(1) + "🔥", false);
        if (bz2.hp <= 0) {
          bz2.state = "die";
          bz2.dieTimer = 0;
          if (state.currentTargetZombie === bz2) {
            state.currentTargetZombie = null;
            state.targetLockTime = 0;
          }
          bz2.mesh.getWorldPosition(tempDeathWorldPos);
          spawnXpOrb(tempDeathWorldPos, bz2.xpValue);
          triggerDeathDust(bz2.mesh.position, 12);
          state.progression.onZombieKilled?.(bz2.type);
        }
      }
    }
  }

  // 5. ATUALIZAÇÃO DOS PROJÉTEIS
  for (var bi = 0; bi < state.bulletPool.length; bi++) {
    var bullet = state.bulletPool[bi];
    if (!bullet.active) continue;

    bullet.life += dt;
    if (bullet.life >= bullet.maxLife) {
      if (bullet.isExplosive) {
        detonateExplosiveBullet(bullet);
      }
      bullet.active = false;
      bullet.mesh.visible = false;
      continue;
    }

    var arcHeight = 0;
    if (bullet.isArc) {
      var arcP = Math.min(1.0, bullet.life / bullet.maxLife);
      arcHeight = Math.sin(arcP * Math.PI) * 0.45;
    }

    bullet.dirLocal.applyAxisAngle(bullet.travelAxis, bullet.speed * dt);
    var bRadius = radiusAt(bullet.dirLocal) + 0.35 + arcHeight;
    bullet.mesh.position.copy(bullet.dirLocal).multiplyScalar(bRadius);

    // Colisão do projétil contra obstáculos sólidos do cenário
    if (state.colliders && state.colliders.length > 0) {
      var hitSolidProp = false;
      for (var ciB = 0; ciB < state.colliders.length; ciB++) {
        var colB = state.colliders[ciB];
        if (!colB.blocksProjectiles) continue;
        var dotB = bullet.dirLocal.dot(colB.dir);
        if (dotB < 0.985) continue;
        if (dotB > colB.cosRad) {
          hitSolidProp = true;
          break;
        }
      }
      if (hitSolidProp) {
        if (bullet.isExplosive) {
          detonateExplosiveBullet(bullet);
        } else {
          triggerDeathDust(bullet.mesh.position, 12);
        }
        playHitSound();
        bullet.active = false;
        bullet.mesh.visible = false;
        continue;
      }
    }

    // Colisão projétil x zumbis
    for (var zi2 = 0; zi2 < state.zombiePool.length; zi2++) {
      var z2 = state.zombiePool[zi2];
      if (!z2.active || z2.state !== "walk") continue;
      if (bullet.hitZombies.indexOf(z2) !== -1) continue;

      var bDotZ = bullet.dirLocal.dot(z2.dirLocal);
      var bDistAng = Math.acos(Math.max(-1, Math.min(1, bDotZ)));
      var hitThreshold = z2.type === "boss" ? 0.08 : (z2.type === "tank" ? 0.055 : 0.04);

      if (bDistAng < hitThreshold) {
        bullet.hitZombies.push(z2);

        // Aplica queimadura se o projétil tiver propriedade de fogo
        if (bullet.burnDuration > 0) {
          z2.burnTimer = bullet.burnDuration;
          z2.burnDamage = bullet.burnDamage || 0.8;
          z2.burnTickTimer = 0.4;
        }

        if (bullet.isExplosive) {
          detonateExplosiveBullet(bullet);
          bullet.active = false;
          bullet.mesh.visible = false;
          break;
        }

        var isCrit = Math.random() < CRIT_CHANCE;
        var finalDmg = bullet.damage * (isCrit ? CRIT_MULTIPLIER : 1);
        z2.hp -= finalDmg;
        z2.flashTimer = 0.08;
        playHitSound();

        // Popup de dano flutuante
        showDamagePopup(z2.mesh.position, finalDmg.toString() + (isCrit ? "!" : ""), isCrit);

        if (z2.type === "boss") {
          state.ui.updateBossHp?.(z2.hp, z2.maxHp);
        }

        // Zumbi abatido
        if (z2.hp <= 0) {
          z2.state = "die";
          z2.dieTimer = 0;
          if (state.currentTargetZombie === z2) {
            state.currentTargetZombie = null;
            state.targetLockTime = 0;
          }

          z2.mesh.getWorldPosition(tempDeathWorldPos);
          spawnXpOrb(tempDeathWorldPos, z2.xpValue);

          if (z2.type === "boss") {
            state.freezeFrameTimer = BOSS_FREEZE_FRAME_DURATION;
            state.camShake += 0.06;
            triggerDeathDust(z2.mesh.position, 35);
            state.sounds.playBossRoarSound?.();
            state.ui.hideBossBar?.();
            state.progression.triggerLevelUp?.();
            state.progression.onZombieKilled?.("boss");
          } else {
            triggerDeathDust(z2.mesh.position, 12);
            state.progression.onZombieKilled?.(z2.type);

            if (Math.random() < PICKUP_DROP_CHANCE) {
              spawnPickup(z2.dirLocal);
            }
          }
        }

        // Perfuração
        if (bullet.isPerforator) {
          // Perfuradora: atravessa TODOS os inimigos em linha reta sem se destruir,
          // sofrendo decaimento percentual de dano a cada impacto sucessivo (ex: 15%)
          if (bullet.damageDecayPerHit > 0) {
            bullet.damage = Math.max(1, Math.round(bullet.damage * (1.0 - bullet.damageDecayPerHit)));
          }
        } else if (bullet.pierceLeft > 0) {
          bullet.pierceLeft--;
        } else if (bullet.ricochetsLeft > 0) {
          // Ricochete em outro zumbi próximo
          bullet.ricochetsLeft--;
          var nextTarget = null;
          var nextMinDist = 999999;
          for (var rzi = 0; rzi < state.zombiePool.length; rzi++) {
            var rz = state.zombiePool[rzi];
            if (!rz.active || rz.state !== "walk" || rz === z2) continue;
            var rDot = bullet.dirLocal.dot(rz.dirLocal);
            var rDist = Math.acos(Math.max(-1, Math.min(1, rDot)));
            if (rDist < 0.22 && rDist < nextMinDist) {
              nextMinDist = rDist;
              nextTarget = rz;
            }
          }
          if (nextTarget) {
            bullet.travelAxis.crossVectors(bullet.dirLocal, nextTarget.dirLocal).normalize();
            bullet.hitZombies = [z2];
          } else {
            bullet.active = false;
            bullet.mesh.visible = false;
            break;
          }
        } else {
          bullet.active = false;
          bullet.mesh.visible = false;
          break;
        }
      }
    }
  }

  // 6. ATUALIZAÇÃO DOS ITENS COLETÁVEIS (PICKUPS)
  for (var pi2 = 0; pi2 < state.pickupPool.length; pi2++) {
    var pickup = state.pickupPool[pi2];
    if (!pickup.active) continue;

    pickup.life -= dt;
    if (pickup.life <= 0) {
      pickup.active = false;
      pickup.group.visible = false;
      continue;
    }

    pickup.mesh.rotation.y += dt * 3.0;
    pickup.mesh.position.y = Math.sin(performance.now() * 0.005 + pi2) * 0.08;

    var pDotPlayer = pickup.dirLocal.dot(state.playerLocalDir);
    var pDistPlayer = Math.acos(Math.max(-1, Math.min(1, pDotPlayer)));

    // Efeito de atração magnética
    if (pDistPlayer < PICKUP_MAGNET_RAD) {
      var magnetAxis = new THREE.Vector3().crossVectors(pickup.dirLocal, state.playerLocalDir).normalize();
      if (magnetAxis.lengthSq() > 0.0001) {
        pickup.dirLocal.applyAxisAngle(magnetAxis, dt * 1.8);
        var pr = radiusAt(pickup.dirLocal) + 0.35;
        pickup.group.position.copy(pickup.dirLocal).multiplyScalar(pr);
      }
    }

    // Coleta do item
    if (pDistPlayer < PICKUP_COLLECT_RADIUS) {
      pickup.active = false;
      pickup.group.visible = false;

      if (pickup.type === "medkit") {
        state.playerHp = Math.min(state.maxPlayerHp, state.playerHp + MEDKIT_HEAL_AMOUNT);
        state.ui.updateHpUI?.();
      } else if (pickup.type === "frenzy") {
        state.frenzyDurationTimer = FRENZY_DURATION;
      } else if (pickup.type === "bomb") {
        state.bombsCount = Math.min(state.maxBombs || MAX_BOMBS, (state.bombsCount || 0) + 1);
        state.ui.updateBombsUI?.();
        state.sounds.playItemPickupSound?.();
        state.ui.showWeaponNotification?.("💣 +1 Bomba Coletada! (" + state.bombsCount + "/" + (state.maxBombs || MAX_BOMBS) + ")");
      }
    }
  }

  // 7. ATUALIZAÇÃO DAS PARTÍCULAS DE MORTE
  for (var dpi2 = 0; dpi2 < state.darkParticles.length; dpi2++) {
    var part = state.darkParticles[dpi2];
    if (!part.active) continue;

    part.life -= dt;
    if (part.life <= 0) {
      part.active = false;
      part.mesh.visible = false;
      continue;
    }

    part.mesh.position.addScaledVector(part.vel, dt);
    part.vel.y -= dt * 3.5; // Gravidade
    part.mesh.scale.multiplyScalar(0.97);
  }
}
