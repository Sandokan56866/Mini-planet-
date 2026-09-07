// O que faz: Gerencia a progressão por metas de abates, avanço orgânico de ondas, alternância de chefes (Bruto / Carniceiro a cada 10 ondas), curva de XP (+55%) e melhorias.
// Exporta: initProgression, updateProgression, addXp, triggerLevelUp, applyUpgrade, restartGame, advanceWave, onZombieKilled, getWaveTargetKills, getMaxSimultaneousZombies.
// Depende de: js/config.js, js/state.js, js/entities/enemies.js

import {
  WAVE_KILLS_TARGETS,
  WAVE_MAX_SIMULTANEOUS_ZOMBIES,
  BASE_SPAWN_INTERVAL,
  MIN_SPAWN_INTERVAL,
  SPAWN_INTERVAL_DECAY,
  MAX_ACTIVE_ZOMBIES_LIMIT,
  BASE_XP_NEEDED,
  XP_GROWTH_FACTOR,
  INITIAL_PLAYER_HP,
  INITIAL_MAX_HP,
  UPGRADES_CONFIG
} from "../config.js";
import { state } from "../state.js";
import { spawnZombie } from "../entities/enemies.js";
import { resetPickups } from "./pickups.js";
import { applyMetaToGameStart } from "./meta.js";

// ==========================================
// 1. CÁLCULO DE METAS DE ABATES POR ONDA
// ==========================================
export function getWaveTargetKills(wave) {
  var inCycle = ((wave - 1) % 10);
  var cycle = Math.floor((wave - 1) / 10);

  // Onda de chefe a cada 10 ondas (10, 20, 30...)
  if ((wave % 10) === 0) {
    return 1; // Derrotar o chefe
  }

  var baseKills = WAVE_KILLS_TARGETS[inCycle] || 30;
  if (cycle > 0) {
    return Math.round(baseKills * Math.pow(1.3, cycle));
  }
  return baseKills;
}

// Limite de zumbis simultâneos por onda
export function getMaxSimultaneousZombies(wave) {
  var inCycle = ((wave - 1) % 10);
  var cycle = Math.floor((wave - 1) / 10);
  var baseMax = WAVE_MAX_SIMULTANEOUS_ZOMBIES[inCycle] || 25;
  var scaled = baseMax + cycle * 4;
  return Math.min(scaled, MAX_ACTIVE_ZOMBIES_LIMIT);
}

// ==========================================
// 2. AVANÇO IMEDIATO DE ONDA (COM CHEFES ALTERNADOS)
// ==========================================
export function advanceWave() {
  state.currentWave++;
  state.waveKills = 0;
  state.waveTargetKills = getWaveTargetKills(state.currentWave);

  state.ui.updateWaveUI?.(state.currentWave);
  state.ui.updateWaveProgressUI?.(state.waveKills, state.waveTargetKills);

  if ((state.currentWave % 10) === 0) {
    // Alternância entre chefes a cada 10 ondas:
    // Onda 10: O Bruto (cycle 1)
    // Onda 20: O Carniceiro (cycle 2)
    // Onda 30: O Bruto (cycle 3)
    // Onda 40: O Carniceiro (cycle 4)
    var bossCycle = Math.floor(state.currentWave / 10);
    var isButcher = (bossCycle % 2 === 0);

    if (isButcher) {
      state.ui.showBigAnnouncement?.(
        "ONDA " + state.currentWave + " - O CARNICEIRO!",
        "AVALANCHE DE CARNE E INVESTIDAS MORTAIS",
        2400
      );
      spawnZombie(state.playerLocalDir || new THREE.Vector3(0, 1, 0), true, "boss_butcher");
    } else {
      state.ui.showBigAnnouncement?.(
        "ONDA " + state.currentWave + " - O BRUTO!",
        "UM COLOSSO IMPLACÁVEL SURGIU",
        2200
      );
      spawnZombie(state.playerLocalDir || new THREE.Vector3(0, 1, 0), true, "boss_brute");
    }
  } else {
    state.ui.showBigAnnouncement?.("ONDA " + state.currentWave, "META: " + state.waveTargetKills + " ABATES", 2000);
  }

  state.sounds.playWaveSound?.();
}

// ==========================================
// 3. EVENTO DE ABATE DE ZUMBI
// ==========================================
export function onZombieKilled(type) {
  state.waveKills++;
  state.killsCount++;
  state.ui.updateKillsUI?.(state.killsCount);
  state.ui.updateWaveProgressUI?.(state.waveKills, state.waveTargetKills);

  if ((state.currentWave % 10) === 0) {
    // Na onda de chefe, avanço imediato ao abater o chefe (Bruto ou Carniceiro)
    if (type === "boss" || type === "boss_brute" || type === "boss_butcher") {
      advanceWave();
    }
  } else {
    if (state.waveKills >= state.waveTargetKills) {
      advanceWave();
    }
  }
}

// ==========================================
// 4. EXPERIÊNCIA E LEVEL UP (+55% POR NÍVEL)
// ==========================================
export function addXp(amount) {
  var xpBonus = (state.metaBonus && state.metaBonus.xpBonus) ? state.metaBonus.xpBonus : 1.0;
  var earnedXp = Math.round(amount * xpBonus);
  state.playerXp += earnedXp;
  while (state.playerXp >= state.xpNeeded) {
    state.playerXp -= state.xpNeeded;
    state.playerLevel++;
    state.xpNeeded = Math.floor(state.xpNeeded * XP_GROWTH_FACTOR);
    triggerLevelUp();
  }
  state.ui.updateXpUI?.();
}

export function triggerLevelUp() {
  state.isLevelUpPaused = true;
  state.sounds.playLevelUpSound?.();

  if (state.charLevelLight) {
    state.charLevelLight.intensity = 4.5;
  }

  var available = [];
  for (var k in state.upgrades) {
    if (k === "machinegun") {
      // Metralhadora só entra na lista a partir da onda 8 e apenas uma vez se não foi oferecida ainda
      if (state.currentWave >= 8 && !state.machineGunOffered && state.permanentWeapon !== "machinegun") {
        available.push(k);
      }
      continue;
    }
    if (state.upgrades[k].level < state.upgrades[k].max) {
      available.push(k);
    }
  }

  // Sorteia melhorias aleatórias (4 se possuir bônus de Dilema Tático no primeiro level-up, senão 3)
  var cardCount = (state.metaBonus?.extraStartingCard && !state.firstLevelUpDone) ? 4 : 3;
  state.firstLevelUpDone = true;

  for (var i = available.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = available[i];
    available[i] = available[j];
    available[j] = temp;
  }
  var selected = available.slice(0, cardCount);

  // Se a metralhadora foi oferecida nesta rolagem:
  state.machineGunOfferedThisRoll = selected.indexOf("machinegun") !== -1;

  state.ui.showLevelUpModal?.(selected, applyUpgrade);
}

export function applyUpgrade(key) {
  if (!state.upgrades[key]) return;
  state.upgrades[key].level++;

  if (key === "maxHp") {
    state.maxPlayerHp += 25;
    state.playerHp = state.maxPlayerHp;
    state.ui.updateHpUI?.();
  } else if (key === "instantHeal") {
    state.playerHp = Math.min(state.maxPlayerHp, state.playerHp + 50);
    state.ui.updateHpUI?.();
  } else if (key === "bombRadius") {
    var bLvl = state.upgrades.bombRadius.level;
    state.ui.showWeaponNotification?.("💣 Carga Ampliada Nv." + bLvl + " (+25% Raio de Explosão)!");
  } else if (key === "machinegun") {
    state.permanentWeapon = "machinegun";
    if (!state.temporaryWeapon) {
      state.currentWeapon = "machinegun";
    }
    state.machineGunOffered = true;
    state.ui.updateWeaponUI?.();
    state.ui.showWeaponNotification?.("🔫 Metralhadora equipada como arma permanente!");
  } else if (key === "droneDuration") {
    if (state.droneActive && state.droneTimer > 0) {
      state.droneTimer += 15.0;
      state.ui.updateDroneUI?.(state.droneTimer);
    }
    state.ui.showWeaponNotification?.("🛸 Bateria do Drone Estendida (+15s)!");
  } else if (key === "droneDamage") {
    state.ui.showWeaponNotification?.("🛸 Dano do Drone Aprimorado (+35%)!");
  } else if (key === "droneCadence") {
    state.ui.showWeaponNotification?.("🛸 Cadência do Drone Aprimorada (+25%)!");
  }

  if (state.machineGunOfferedThisRoll && key !== "machinegun") {
    // Jogador recusou a metralhadora: nunca mais aparece
    state.machineGunOffered = true;
  }
  state.machineGunOfferedThisRoll = false;

  state.isLevelUpPaused = false;
  state.ui.hideLevelUpModal?.();
}

// ==========================================
// 5. REINÍCIO COMPLETO DA PARTIDA (DELEGAÇÃO)
// ==========================================
export function restartGame() {
  if (state.resetGame) {
    state.resetGame();
  }
}

// ==========================================
// 6. INICIALIZAÇÃO E LOOP DE SPAWN
// ==========================================
export function initProgression() {
  state.upgrades = JSON.parse(JSON.stringify(UPGRADES_CONFIG));
  state.waveKills = 0;
  state.waveTargetKills = getWaveTargetKills(1);
  state.targetLockTime = 0;
  state.targetSearchFrameCounter = 0;
  state.screamerSpawnBoostTimer = 0;
  state.machineGunOffered = false;
  state.machineGunOfferedThisRoll = false;

  state.progression = {
    addXp: addXp,
    triggerLevelUp: triggerLevelUp,
    applyUpgrade: applyUpgrade,
    restartGame: restartGame,
    onZombieKilled: onZombieKilled,
    advanceWave: advanceWave
  };
}

export function updateProgression(dt) {
  if (state.isGameOver || state.isLevelUpPaused) return;

  // Regeneração passiva de vida adquirida na árvore de habilidades permanente
  if (state.metaBonus?.hpRegen > 0 && state.playerHp > 0 && state.playerHp < state.maxPlayerHp) {
    state.playerHp = Math.min(state.maxPlayerHp, state.playerHp + state.metaBonus.hpRegen * dt);
    state.ui.updateHpUI?.();
  }

  // Contagem de zumbis vivos
  var activeZombiesCount = 0;
  for (var zi = 0; zi < state.zombiePool.length; zi++) {
    if (state.zombiePool[zi].active && state.zombiePool[zi].state !== "die") {
      activeZombiesCount++;
    }
  }

  var maxSimultaneous = getMaxSimultaneousZombies(state.currentWave);

  // Intervalo de spawn escalonado com o avanço de ondas
  var currentSpawnInterval = Math.max(
    MIN_SPAWN_INTERVAL,
    BASE_SPAWN_INTERVAL * Math.pow(SPAWN_INTERVAL_DECAY, Math.min(12, state.currentWave - 1))
  );

  // Aceleração temporária de spawns disparada pelo chamado do Ululante
  if (state.screamerSpawnBoostTimer > 0) {
    state.screamerSpawnBoostTimer -= dt;
    currentSpawnInterval *= 0.45;
  }

  state.spawnCooldown -= dt;
  if (state.spawnCooldown <= 0) {
    state.spawnCooldown = currentSpawnInterval;
    if (activeZombiesCount < maxSimultaneous) {
      spawnZombie(state.playerLocalDir || new THREE.Vector3(0, 1, 0), false);
    }
  }
}
