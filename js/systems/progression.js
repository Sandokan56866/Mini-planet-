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
  UPGRADES_CONFIG,
  DRONE_TYPES
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
// 4. ATUALIZAÇÃO DINÂMICA DE UPGRADES DO DRONE
// ==========================================
export function updateDroneUpgradeDescriptions() {
  if (!state.upgrades) return;
  var dTypeKey = state.droneType || "sentinela";
  var dCfg = DRONE_TYPES[dTypeKey] || DRONE_TYPES.sentinela;

  // Drone Unlock (aquisição)
  if (state.upgrades.droneUnlock) {
    state.upgrades.droneUnlock.name = "Drone de Combate";
    state.upgrades.droneUnlock.icon = "🛸";
    state.upgrades.droneUnlock.desc = "Ativa um drone de suporte orbital permanente com especialização";
  }

  // droneDamage: calcula sobre os valores base do tipo ativo
  if (state.upgrades.droneDamage) {
    var dmgLvl = state.upgrades.droneDamage.level || 0;
    var baseDmg = dCfg.damage;
    var curDmg = Math.max(1, Math.round(baseDmg * (1.0 + dmgLvl * 0.35)));
    var nextDmg = Math.max(1, Math.round(baseDmg * (1.0 + (dmgLvl + 1) * 0.35)));
    state.upgrades.droneDamage.name = "Drone: Canhão (" + dCfg.name + ")";
    state.upgrades.droneDamage.icon = "🎯";
    if (dTypeKey === "artilheiro") {
      var nextSplash = Math.max(1, Math.round((dCfg.splashDamage || 4) * (1.0 + (dmgLvl + 1) * 0.35)));
      state.upgrades.droneDamage.desc = "+35% de dano do " + dCfg.name + " (" + curDmg + " ➔ " + nextDmg + " direto, " + nextSplash + " em área)";
    } else {
      state.upgrades.droneDamage.desc = "+35% de dano nos tiros do " + dCfg.name + " (" + curDmg + " ➔ " + nextDmg + ")";
    }
  }

  // droneCadence: calcula sobre a cadência base do tipo ativo
  if (state.upgrades.droneCadence) {
    var cadLvl = state.upgrades.droneCadence.level || 0;
    var curInterval = (dCfg.fireRate / (1.0 + cadLvl * 0.25)).toFixed(2);
    var nextInterval = (dCfg.fireRate / (1.0 + (cadLvl + 1) * 0.25)).toFixed(2);
    state.upgrades.droneCadence.name = "Drone: Tiro Rápido (" + dCfg.name + ")";
    state.upgrades.droneCadence.icon = "⚡";
    state.upgrades.droneCadence.desc = "+25% de cadência do " + dCfg.name + " (" + curInterval + "s ➔ " + nextInterval + "s)";
  }

  // droneCount: cita o tipo ativo
  if (state.upgrades.droneCount) {
    var countLvl = state.upgrades.droneCount.level || 0;
    var curDrones = 1 + countLvl;
    var nextDrones = 1 + countLvl + 1;
    state.upgrades.droneCount.name = "Drone: Esquadrão (" + dCfg.name + ")";
    state.upgrades.droneCount.icon = "🛸";
    state.upgrades.droneCount.desc = "+1 drone auxiliar " + dCfg.name + " em órbita (" + curDrones + " ➔ " + nextDrones + ")";
  }
}

// ==========================================
// 5. EXPERIÊNCIA E LEVEL UP (+55% POR NÍVEL)
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

  // Atualiza as descrições dos upgrades do drone conforme o tipo ativo
  updateDroneUpgradeDescriptions();

  var available = [];
  for (var k in state.upgrades) {
    if (k === "machinegun") {
      // Metralhadora só entra na lista a partir da onda 8 e apenas uma vez se não foi oferecida ainda
      if (state.currentWave >= 8 && !state.machineGunOffered && state.permanentWeapon !== "machinegun") {
        available.push(k);
      }
      continue;
    }

    // Upgrades condicionais do drone: droneDamage, droneCadence e droneCount só podem aparecer após o drone ser adquirido
    if (k === "droneDamage" || k === "droneCadence" || k === "droneCount") {
      if (!state.droneActive) {
        continue;
      }
    }

    // Melhoria de aquisição: se o drone já foi adquirido, droneUnlock sai definitivamente do sorteio
    if (k === "droneUnlock") {
      if (state.droneActive || state.upgrades[k].level >= state.upgrades[k].max) {
        continue;
      }
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

  // 1. Melhoria de Aquisição: "Drone de Combate"
  if (key === "droneUnlock") {
    state.upgrades.droneUnlock.level = 1;

    // Abre segunda seleção com os três tipos de DRONE_TYPES
    if (state.ui.showDroneSelectionModal) {
      state.ui.showDroneSelectionModal(function (chosenType) {
        state.droneType = chosenType;
        state.droneActive = true;
        state.combat?.setDroneType?.(chosenType);
        state.combat?.activateDrone?.(chosenType);
        state.ui.updateDroneIndicatorUI?.();
        updateDroneUpgradeDescriptions();

        var dCfg = DRONE_TYPES[chosenType] || DRONE_TYPES.sentinela;
        state.ui.showWeaponNotification?.("🛸 Drone Ativado: " + dCfg.name + " (" + (dCfg.icon || "🛸") + ")!");

        if (state.machineGunOfferedThisRoll) {
          state.machineGunOffered = true;
        }
        state.machineGunOfferedThisRoll = false;

        state.isLevelUpPaused = false;
        state.ui.hideLevelUpModal?.();
      });
      return; // Mantém a pausa enquanto escolhe o tipo no submenu
    } else {
      state.droneType = "sentinela";
      state.droneActive = true;
      state.combat?.activateDrone?.("sentinela");
      state.ui.updateDroneIndicatorUI?.();
      updateDroneUpgradeDescriptions();
      state.ui.showWeaponNotification?.("🛸 Drone de Combate Sentinela Ativado!");
    }
  } else {
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
    } else if (key === "droneDamage") {
      var curType = state.droneType || "sentinela";
      var dCfg = DRONE_TYPES[curType] || DRONE_TYPES.sentinela;
      state.ui.showWeaponNotification?.("🛸 Dano do " + dCfg.name + " Aprimorado (+35%)!");
    } else if (key === "droneCadence") {
      var curType = state.droneType || "sentinela";
      var dCfg = DRONE_TYPES[curType] || DRONE_TYPES.sentinela;
      state.ui.showWeaponNotification?.("🛸 Cadência do " + dCfg.name + " Aprimorada (+25%)!");
    } else if (key === "droneCount") {
      var curType = state.droneType || "sentinela";
      var dCfg = DRONE_TYPES[curType] || DRONE_TYPES.sentinela;
      state.ui.showWeaponNotification?.("🛸 Esquadrão " + dCfg.name + " Aprimorado (+1 Drone)!");
    }
  }

  if (state.machineGunOfferedThisRoll && key !== "machinegun") {
    state.machineGunOffered = true;
  }
  state.machineGunOfferedThisRoll = false;

  state.isLevelUpPaused = false;
  state.ui.hideLevelUpModal?.();
}

// ==========================================
// 6. REINÍCIO COMPLETO DA PARTIDA (DELEGAÇÃO)
// ==========================================
export function restartGame() {
  if (state.resetGame) {
    state.resetGame();
  }
}

// ==========================================
// 7. INICIALIZAÇÃO E LOOP DE SPAWN
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

  // Atualiza as descrições iniciais com o tipo de drone padrão
  updateDroneUpgradeDescriptions();

  state.progression = {
    addXp: addXp,
    triggerLevelUp: triggerLevelUp,
    applyUpgrade: applyUpgrade,
    restartGame: restartGame,
    onZombieKilled: onZombieKilled,
    advanceWave: advanceWave,
    updateDroneUpgradeDescriptions: updateDroneUpgradeDescriptions
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
