// O que faz: Gerencia a progressão por metas de abates, avanço orgânico de ondas, alternância de chefes,
//           curva de XP (+55%), escassez por slots (3 Módulos, 4 Passivos), sistema de raridade por onda e sorteio balanceado.
// Exporta: initProgression, updateProgression, addXp, triggerLevelUp, applyUpgrade, restartGame, advanceWave, onZombieKilled, getWaveTargetKills, getMaxSimultaneousZombies, updateModuleAndPassiveDescriptions.
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
  MODULES_CONFIG,
  PASSIVES_CONFIG,
  MAX_MODULE_SLOTS,
  MAX_PASSIVE_SLOTS,
  MACHINEGUN_MIN_WAVE,
  RARITY_CONFIG,
  RARITY_MULTIPLIERS,
  getRarityForWave,
  DRONE_TYPES,
  MAX_MINES_CARRIED,
  MAX_TURRETS_CARRIED,
  WEAPONS_CONFIG
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
// 4. ATUALIZAÇÃO DINÂMICA DE TEXTOS E NÍVEIS
// ==========================================
export function updateModuleAndPassiveDescriptions() {
  if (!state.upgrades) return;

  var dTypeKey = state.droneType || "sentinela";
  var dCfg = DRONE_TYPES[dTypeKey] || DRONE_TYPES.sentinela;

  // 1. MÓDULO DRONE
  if (state.upgrades.drone) {
    var dRank = state.upgrades.drone.rank !== undefined ? state.upgrades.drone.rank : state.upgrades.drone.level;
    state.upgrades.drone.icon = "🛸";
    if (dRank === 0) {
      state.upgrades.drone.name = "Drone de Combate";
      state.upgrades.drone.desc = "Aprimoramentos do drone orbital (bloqueado até ser resgatado em um baú)";
    } else if (dRank === 1) {
      state.upgrades.drone.name = "Drone: Canhão (" + dCfg.name + ")";
      state.upgrades.drone.desc = "+35% de dano nos disparos do drone orbital";
    } else if (dRank === 2) {
      state.upgrades.drone.name = "Drone: Tiro Rápido (" + dCfg.name + ")";
      state.upgrades.drone.desc = "+25% de cadência de disparo do drone orbital";
    } else if (dRank === 3) {
      state.upgrades.drone.name = "Drone: Esquadrão (" + dCfg.name + ")";
      state.upgrades.drone.desc = "+1 drone auxiliar permanente em órbita do planeta";
    }
  }

  // 2. MÓDULO LÂMINAS ORBITAIS
  if (state.upgrades.blades) {
    var bRank = state.upgrades.blades.rank !== undefined ? state.upgrades.blades.rank : state.upgrades.blades.level;
    state.upgrades.blades.icon = "⚔️";
    if (bRank === 0) {
      state.upgrades.blades.name = "Lâminas Orbitais";
      state.upgrades.blades.desc = "3 discos serrilhados permanentes orbitam o jogador causando dano por contato";
    } else if (bRank === 1) {
      state.upgrades.blades.name = "Lâminas: Fio Cortante";
      state.upgrades.blades.desc = "+40% de dano de contato e rotação acelerada";
    } else if (bRank === 2) {
      state.upgrades.blades.name = "Lâminas: Anel Expandido";
      state.upgrades.blades.desc = "+1 lâmina adicional em órbita (total 4) e raio de corte ampliado";
    } else if (bRank === 3) {
      state.upgrades.blades.name = "Lâminas: Vórtice Mortal";
      state.upgrades.blades.desc = "+50% de dano brutal com repulsão de impacto";
    }
  }

  // 3. MÓDULO MINAS TERRESTRES
  if (state.upgrades.mines) {
    var mRank = state.upgrades.mines.rank !== undefined ? state.upgrades.mines.rank : state.upgrades.mines.level;
    state.upgrades.mines.icon = "💣";
    if (mRank === 0) {
      state.upgrades.mines.name = "Minas Terrestres";
      state.upgrades.mines.desc = "Adiciona minas explosivas ao inventário com detonação por aproximação";
    } else if (mRank === 1) {
      state.upgrades.mines.name = "Minas: Carga Estabilizada";
      state.upgrades.mines.desc = "+40% no dano das explosões e +3 minas ao inventário";
    } else if (mRank === 2) {
      state.upgrades.mines.name = "Minas: Carga Dupla";
      state.upgrades.mines.desc = "+4 minas ao inventário e raio de detonação ampliado";
    } else if (mRank === 3) {
      state.upgrades.mines.name = "Minas: Carga Termobárica";
      state.upgrades.mines.desc = "+60% de dano devastador, onda de choque e +4 minas";
    }
  }

  // 4. MÓDULO TORRETA AUTOMÁTICA
  if (state.upgrades.turret) {
    var tRank = state.upgrades.turret.rank !== undefined ? state.upgrades.turret.rank : state.upgrades.turret.level;
    state.upgrades.turret.icon = "📡";
    if (tRank === 0) {
      state.upgrades.turret.name = "Torreta Automática";
      state.upgrades.turret.desc = "Concede torretas sentinelas ao inventário para posicionamento tático";
    } else if (tRank === 1) {
      state.upgrades.turret.name = "Torreta: Disparo Rápido";
      state.upgrades.turret.desc = "+1 torreta ao inventário e +35% na cadência de tiro";
    } else if (tRank === 2) {
      state.upgrades.turret.name = "Torreta: Suporte Tático";
      state.upgrades.turret.desc = "+1 torreta ao inventário e maior tempo de atividade em campo";
    } else if (tRank === 3) {
      state.upgrades.turret.name = "Torreta: Calibre Pesado";
      state.upgrades.turret.desc = "+2 torretas ao inventário e disparos perfurantes contra a horda";
    }
  }

  // 5. MÓDULO METRALHADORA
  if (state.upgrades.machinegun) {
    var mgRank = state.upgrades.machinegun.rank !== undefined ? state.upgrades.machinegun.rank : state.upgrades.machinegun.level;
    state.upgrades.machinegun.icon = "⚡";
    if (mgRank === 0) {
      state.upgrades.machinegun.name = "Metralhadora Permanente";
      state.upgrades.machinegun.desc = "Equipa a Metralhadora como arma permanente com alta cadência";
    } else if (mgRank === 1) {
      state.upgrades.machinegun.name = "Metralhadora: Cano Duplo";
      state.upgrades.machinegun.desc = "+25% de cadência de disparo contínuo";
    } else if (mgRank === 2) {
      state.upgrades.machinegun.name = "Metralhadora: Alta Velocidade";
      state.upgrades.machinegun.desc = "+1 de dano por projétil e balas ultrarrápidas";
    } else if (mgRank === 3) {
      state.upgrades.machinegun.name = "Metralhadora: Fogo Devastador";
      state.upgrades.machinegun.desc = "+30% de cadência contínua e penetração";
    }
  }
}

// ==========================================
// 5. EXPERIÊNCIA E LEVEL UP COM ESCOLHA
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

// Embaralhamento com anti-repetição priorizando cartas não mostradas na rolagem anterior
function shuffleWithAntiRepetition(arr, lastOffered) {
  if (arr.length <= 1) return arr.slice();
  var fresh = [];
  var repeated = [];
  for (var i = 0; i < arr.length; i++) {
    if (lastOffered && lastOffered.indexOf(arr[i]) !== -1) {
      repeated.push(arr[i]);
    } else {
      fresh.push(arr[i]);
    }
  }
  for (var f = fresh.length - 1; f > 0; f--) {
    var jf = Math.floor(Math.random() * (f + 1));
    var tmp = fresh[f]; fresh[f] = fresh[jf]; fresh[jf] = tmp;
  }
  for (var r = repeated.length - 1; r > 0; r--) {
    var jr = Math.floor(Math.random() * (r + 1));
    var tmpR = repeated[r]; repeated[r] = repeated[jr]; repeated[jr] = tmpR;
  }
  return fresh.concat(repeated);
}

export function triggerLevelUp() {
  state.isLevelUpPaused = true;
  state.sounds.playLevelUpSound?.();

  if (state.charLevelLight) {
    state.charLevelLight.intensity = 4.5;
  }

  // Atualiza descrições dinâmicas
  updateModuleAndPassiveDescriptions();

  // 1. Filtragem da Pool de Módulos (com regra estrita de slots)
  var availModules = [];
  var equippedModules = state.equippedModules || [];
  for (var mk in MODULES_CONFIG) {
    var mUpg = state.upgrades[mk];
    if (!mUpg) continue;

    var curRank = mUpg.rank !== undefined ? mUpg.rank : mUpg.level;
    if (curRank >= mUpg.max) continue;

    // BLOQUEIO DO DRONE NA ÁRVORE DE LEVEL-UP:
    // O módulo drone deixa de ser adquirível por level-up: seus níveis só aparecem na pool
    // depois que o jogador pegou um drone em um baú. Antes disso, fica estritamente bloqueado.
    if (mk === "drone" && !state.droneActive) {
      continue;
    }

    var isEquipped = equippedModules.indexOf(mk) !== -1;
    if (!isEquipped) {
      // Regra de escassez: novo módulo só pode ser oferecido com slot vago
      if (equippedModules.length >= MAX_MODULE_SLOTS) {
        continue;
      }
      // Filtro de contexto: Metralhadora a partir da onda 8 e só uma vez se ignorada
      if (mk === "machinegun") {
        if (state.currentWave < MACHINEGUN_MIN_WAVE || state.machineGunOffered) {
          continue;
        }
      }
    }
    availModules.push(mk);
  }

  // 2. Filtragem da Pool de Passivos (com regra estrita de slots)
  var availPassives = [];
  var equippedPassives = state.equippedPassives || [];
  for (var pk in PASSIVES_CONFIG) {
    var pUpg = state.upgrades[pk];
    if (!pUpg) continue;

    var curPRank = pUpg.rank !== undefined ? pUpg.rank : pUpg.level;
    if (curPRank >= pUpg.max) continue;

    var isPEquipped = equippedPassives.indexOf(pk) !== -1;
    if (!isPEquipped) {
      // Regra de escassez: novo passivo só pode ser oferecido com slot vago
      if (equippedPassives.length >= MAX_PASSIVE_SLOTS) {
        continue;
      }
    }
    availPassives.push(pk);
  }

  // 3. Aplica anti-repetição em relação à rolagem anterior
  var lastOffered = state.lastOfferedCards || [];
  var shuffledModules = shuffleWithAntiRepetition(availModules, lastOffered);
  var shuffledPassives = shuffleWithAntiRepetition(availPassives, lastOffered);

  // 4. Sorteio Equilibrado (Garante ao menos 1 Módulo e 1 Passivo, nunca 3 do mesmo tipo se houver opção)
  var cardCount = (state.metaBonus?.extraStartingCard && !state.firstLevelUpDone) ? 4 : 3;
  state.firstLevelUpDone = true;

  var selected = [];

  if (cardCount === 3) {
    if (shuffledModules.length > 0 && shuffledPassives.length > 0) {
      // 1 de cada garantido
      selected.push(shuffledModules[0]);
      selected.push(shuffledPassives[0]);

      var hasExtraModule = shuffledModules.length >= 2;
      var hasExtraPassive = shuffledPassives.length >= 2;

      if (hasExtraModule && hasExtraPassive) {
        // Alternância aleatória para a 3ª carta: (2 Módulos + 1 Passivo) OU (1 Módulo + 2 Passivos)
        if (Math.random() < 0.5) {
          selected.push(shuffledModules[1]);
        } else {
          selected.push(shuffledPassives[1]);
        }
      } else if (hasExtraModule) {
        selected.push(shuffledModules[1]);
      } else if (hasExtraPassive) {
        selected.push(shuffledPassives[1]);
      }
    } else if (shuffledModules.length > 0) {
      selected = shuffledModules.slice(0, 3);
    } else if (shuffledPassives.length > 0) {
      selected = shuffledPassives.slice(0, 3);
    }
  } else {
    // Caso de 4 cartas (bônus Dilema Tático no 1º level-up)
    if (shuffledModules.length > 0 && shuffledPassives.length > 0) {
      var mTake = Math.min(2, shuffledModules.length);
      var pTake = Math.min(2, shuffledPassives.length);
      for (var mi = 0; mi < mTake; mi++) selected.push(shuffledModules[mi]);
      for (var pi = 0; pi < pTake; pi++) selected.push(shuffledPassives[pi]);

      var mIdx = mTake;
      var pIdx = pTake;
      while (selected.length < cardCount && (mIdx < shuffledModules.length || pIdx < shuffledPassives.length)) {
        if (mIdx < shuffledModules.length && selected.length < cardCount) {
          selected.push(shuffledModules[mIdx++]);
        }
        if (pIdx < shuffledPassives.length && selected.length < cardCount) {
          selected.push(shuffledPassives[pIdx++]);
        }
      }
    } else if (shuffledModules.length > 0) {
      selected = shuffledModules.slice(0, cardCount);
    } else {
      selected = shuffledPassives.slice(0, cardCount);
    }
  }

  // Embaralha as posições visuais no grid para variedade natural
  for (var si = selected.length - 1; si > 0; si--) {
    var sj = Math.floor(Math.random() * (si + 1));
    var sTmp = selected[si]; selected[si] = selected[sj]; selected[sj] = sTmp;
  }

  state.lastOfferedCards = selected.slice();

  // 5. Atribui Raridade para cada carta sorteada e formata dados para o HUD
  state.offeredRarities = {};

  for (var ci = 0; ci < selected.length; ci++) {
    var cKey = selected[ci];
    var cRarity = getRarityForWave(state.currentWave);
    state.offeredRarities[cKey] = cRarity;

    var rCfg = RARITY_CONFIG[cRarity] || RARITY_CONFIG.comum;
    var rMult = RARITY_MULTIPLIERS[cRarity] || 1.0;

    var cardUpg = state.upgrades[cKey];
    if (!cardUpg) continue;

    // Garante que o HUD exiba a transição com números inteiros limpos: Nvl 0 ➔ 1
    var displayRank = cardUpg.rank !== undefined ? cardUpg.rank : (cardUpg.level || 0);
    cardUpg.level = displayRank;

    // Nome base limpo de rolagens anteriores
    var cleanName = (cardUpg.name || cKey).replace(/<span.*<\/span>/gi, "").replace(/✦.*/g, "").replace(/★.*/g, "").trim();

    // Aplicação da etiqueta visual de raridade no título da carta
    if (cRarity === "rara") {
      cardUpg.name = cleanName + ' <span style="color:#38bdf8;font-weight:700;font-size:11px;letter-spacing:0.5px;margin-left:4px;">✦ RARA 1.6x</span>';
    } else if (cRarity === "prototipica") {
      cardUpg.name = cleanName + ' <span style="color:#f59e0b;font-weight:700;font-size:11px;letter-spacing:0.5px;margin-left:4px;">★ PROTOTÍPICA 2.5x</span>';
    } else {
      cardUpg.name = cleanName;
    }

    // Aplicação do descritor de bônus de raridade
    var cleanDesc = (cardUpg.desc || "").replace(/<span.*<\/span>/gi, "").trim();
    if (rMult > 1.0) {
      var bonusPercent = Math.round((rMult - 1.0) * 100);
      cardUpg.desc = cleanDesc + ' <span style="color:' + rCfg.color + ';font-weight:600;">(+' + bonusPercent + '% eficácia)</span>';
    } else {
      cardUpg.desc = cleanDesc;
    }
  }

  // Notação de metralhadora oferecida
  state.machineGunOfferedThisRoll = selected.indexOf("machinegun") !== -1;

  state.ui.showLevelUpModal?.(selected, applyUpgrade);
}

// ==========================================
// 6. APLICAÇÃO DE MELHORIA COM RARIDADE
// ==========================================
export function applyUpgrade(key, rarity) {
  if (!state.upgrades || !state.upgrades[key]) return;

  if (!rarity) {
    rarity = (state.offeredRarities && state.offeredRarities[key]) || "comum";
  }

  var rMult = RARITY_MULTIPLIERS[rarity] || 1.0;
  var rCfg = RARITY_CONFIG[rarity] || RARITY_CONFIG.comum;
  var rarityLabel = rCfg.name;

  var upg = state.upgrades[key];

  // 1. Registro em Slots Limitados
  if (MODULES_CONFIG[key]) {
    if (state.equippedModules.indexOf(key) === -1) {
      state.equippedModules.push(key);
    }
  } else if (PASSIVES_CONFIG[key]) {
    if (state.equippedPassives.indexOf(key) === -1) {
      state.equippedPassives.push(key);
    }
  }

  // 2. Incremento de Rank e Nível Efetivo com Multiplicador
  upg.rank = (upg.rank !== undefined ? upg.rank : (upg.level || 0)) + 1;
  upg.effectiveLevel = (upg.effectiveLevel || 0) + 1 * rMult;
  upg.level = upg.effectiveLevel;

  var currentRank = upg.rank;

  // 3. Aplicação dos Efeitos Específicos
  if (key === "drone") {
    // Aquisição ou aprimoramento do drone
    if (currentRank === 1) {
      // Submodal de doutrina tática
      if (state.ui.showDroneSelectionModal) {
        state.ui.showDroneSelectionModal(function (chosenType) {
          state.droneType = chosenType;
          state.droneActive = true;
          state.combat?.setDroneType?.(chosenType);
          state.combat?.activateDrone?.(chosenType);
          state.ui.updateDroneIndicatorUI?.();

          // Aplicação do multiplicador sobre dano ou cadência inicial se Rara/Prototípica
          if (rMult > 1.0) {
            state.upgrades.droneDamage.level = Math.max(1, Math.round(1 * (rMult - 1.0)));
          }

          var dCfg = DRONE_TYPES[chosenType] || DRONE_TYPES.sentinela;
          state.ui.showWeaponNotification?.("🛸 Drone " + dCfg.name + " Ativado (" + rarityLabel + ")!");

          if (state.machineGunOfferedThisRoll) {
            state.machineGunOffered = true;
          }
          state.machineGunOfferedThisRoll = false;

          syncEffectiveLevels();
          state.isLevelUpPaused = false;
          state.ui.hideLevelUpModal?.();
        });
        return; // Mantém pausa durante escolha da doutrina
      } else {
        state.droneType = "sentinela";
        state.droneActive = true;
        state.combat?.activateDrone?.("sentinela");
        state.ui.updateDroneIndicatorUI?.();
        state.ui.showWeaponNotification?.("🛸 Drone Sentinela Ativado (" + rarityLabel + ")!");
      }
    } else if (currentRank === 2) {
      // Nível 2: Dano do Drone (+35% base)
      var dmgBoost = Math.max(1, Math.round(1 * rMult));
      state.upgrades.droneDamage.level = (state.upgrades.droneDamage.level || 0) + dmgBoost;
      var curType = state.droneType || "sentinela";
      var dCfg = DRONE_TYPES[curType] || DRONE_TYPES.sentinela;
      var pctDmg = Math.round(35 * rMult);
      state.ui.showWeaponNotification?.("🛸 Dano do " + dCfg.name + " +" + pctDmg + "% (" + rarityLabel + ")!");
    } else if (currentRank === 3) {
      // Nível 3: Cadência do Drone (+25% base)
      var cadBoost = Math.max(1, Math.round(1 * rMult));
      state.upgrades.droneCadence.level = (state.upgrades.droneCadence.level || 0) + cadBoost;
      var curType2 = state.droneType || "sentinela";
      var dCfg2 = DRONE_TYPES[curType2] || DRONE_TYPES.sentinela;
      var pctCad = Math.round(25 * rMult);
      state.ui.showWeaponNotification?.("🛸 Cadência do " + dCfg2.name + " +" + pctCad + "% (" + rarityLabel + ")!");
    } else if (currentRank === 4) {
      // Nível 4: Esquadrão (+1 drone em órbita, ou +2 se Prototípica)
      var extraDrones = rMult >= 2.0 ? 2 : 1;
      state.upgrades.droneCount.level = (state.upgrades.droneCount.level || 0) + extraDrones;
      var curType3 = state.droneType || "sentinela";
      var dCfg3 = DRONE_TYPES[curType3] || DRONE_TYPES.sentinela;
      state.ui.showWeaponNotification?.("🛸 +" + extraDrones + " Drone " + dCfg3.name + " em Órbita (" + rarityLabel + ")!");
    }
  } else if (key === "blades") {
    state.orbitalBladesActive = true;
    if (state.combat?.activateBlades) {
      state.combat.activateBlades();
    }
    if (state.orbitalBladesGroup) {
      state.orbitalBladesGroup.visible = true;
    }
    state.ui.showWeaponNotification?.("⚔️ Lâminas Orbitais Nv." + currentRank + " (" + rarityLabel + ")!");
  } else if (key === "mines") {
    state.minesModuleActive = true;
    var minesGained = Math.round(3 * rMult);
    state.playerMinesCount = Math.min(MAX_MINES_CARRIED, (state.playerMinesCount !== undefined ? state.playerMinesCount : 3) + minesGained);
    state.minesCount = state.playerMinesCount;
    state.ui.updateWeaponUI?.();
    state.ui.showWeaponNotification?.("💣 Minas Terrestres Nv." + currentRank + " +" + minesGained + " (" + rarityLabel + ")!");
  } else if (key === "turret") {
    state.turretModuleActive = true;
    var turretsGained = Math.max(1, Math.round(1 * rMult));
    state.playerTurretsCount = Math.min(MAX_TURRETS_CARRIED, (state.playerTurretsCount || 0) + turretsGained);
    state.ui.updateWeaponUI?.();
    state.ui.showWeaponNotification?.("📡 Torreta Sentinela Nv." + currentRank + " +" + turretsGained + " (" + rarityLabel + ")!");
  } else if (key === "machinegun") {
    state.permanentWeapon = "machinegun";
    if (!state.temporaryWeapon) {
      state.currentWeapon = "machinegun";
    }
    state.machineGunOffered = true;
    state.ui.updateWeaponUI?.();
    state.ui.showWeaponNotification?.("⚡ Metralhadora Nv." + currentRank + " (" + rarityLabel + ")!");
  } else if (key === "maxHp") {
    var hpIncrement = Math.round(25 * rMult);
    state.maxPlayerHp += hpIncrement;
    state.playerHp = state.maxPlayerHp;
    state.ui.updateHpUI?.();
    state.ui.showWeaponNotification?.("💖 Vida Máxima +" + hpIncrement + " HP (" + rarityLabel + ")!");
  } else if (key === "damage") {
    state.ui.showWeaponNotification?.("💥 Dano +" + (1 * rMult).toFixed(1) + " (" + rarityLabel + ")!");
  } else if (key === "fireRate") {
    state.ui.showWeaponNotification?.("⚡ Cadência +" + Math.round(25 * rMult) + "% (" + rarityLabel + ")!");
  } else if (key === "spread") {
    state.ui.showWeaponNotification?.("🏹 Projéteis Extras (" + rarityLabel + ")!");
  } else if (key === "range") {
    state.ui.showWeaponNotification?.("🎯 Alcance +" + (0.055 * rMult).toFixed(3) + " (" + rarityLabel + ")!");
  } else if (key === "moveSpeed") {
    state.ui.showWeaponNotification?.("👟 Velocidade +" + Math.round(15 * rMult) + "% (" + rarityLabel + ")!");
  } else if (key === "piercing") {
    state.ui.showWeaponNotification?.("🗡️ Tiro Perfurante (" + rarityLabel + ")!");
  } else if (key === "magnet") {
    state.ui.showWeaponNotification?.("🧲 Ímã de XP +" + Math.round(35 * rMult) + "% (" + rarityLabel + ")!");
  } else if (key === "bombRadius") {
    state.ui.showWeaponNotification?.("💣 Carga Ampliada +" + Math.round(25 * rMult) + "% (" + rarityLabel + ")!");
  }

  // Finalização do flag de oferta da metralhadora
  if (state.machineGunOfferedThisRoll && key !== "machinegun") {
    state.machineGunOffered = true;
  }
  state.machineGunOfferedThisRoll = false;

  syncEffectiveLevels();
  state.isLevelUpPaused = false;
  state.ui.hideLevelUpModal?.();
}

// Sincroniza level com effectiveLevel para cálculos de física e combate
function syncEffectiveLevels() {
  for (var k in state.upgrades) {
    if (state.upgrades[k] && state.upgrades[k].effectiveLevel !== undefined) {
      state.upgrades[k].level = state.upgrades[k].effectiveLevel;
    }
  }
}

// ==========================================
// 7. REINÍCIO COMPLETO DA PARTIDA
// ==========================================
export function restartGame() {
  if (state.resetGame) {
    state.resetGame();
  }
  initProgression();
}

// ==========================================
// 8. INICIALIZAÇÃO E LOOP DE SPAWN
// ==========================================
export function initProgression() {
  state.equippedModules = [];
  state.equippedPassives = [];
  state.offeredRarities = {};
  state.lastOfferedCards = [];

  state.upgrades = {};
  for (var mk in MODULES_CONFIG) {
    state.upgrades[mk] = JSON.parse(JSON.stringify(MODULES_CONFIG[mk]));
    state.upgrades[mk].rank = 0;
    state.upgrades[mk].effectiveLevel = 0;
    state.upgrades[mk].level = 0;
  }
  for (var pk in PASSIVES_CONFIG) {
    state.upgrades[pk] = JSON.parse(JSON.stringify(PASSIVES_CONFIG[pk]));
    state.upgrades[pk].rank = 0;
    state.upgrades[pk].effectiveLevel = 0;
    state.upgrades[pk].level = 0;
  }

  // Compatibilidade com nós legados que outros sistemas possam verificar
  state.upgrades.droneUnlock = { level: 0, max: 1 };
  state.upgrades.droneDamage = { level: 0, max: 4 };
  state.upgrades.droneCadence = { level: 0, max: 4 };
  state.upgrades.droneCount = { level: 0, max: 2 };

  state.waveKills = 0;
  state.waveTargetKills = getWaveTargetKills(1);
  state.targetLockTime = 0;
  state.targetSearchFrameCounter = 0;
  state.screamerSpawnBoostTimer = 0;
  state.machineGunOffered = false;
  state.machineGunOfferedThisRoll = false;

  updateModuleAndPassiveDescriptions();

  state.progression = {
    addXp: addXp,
    triggerLevelUp: triggerLevelUp,
    applyUpgrade: applyUpgrade,
    restartGame: restartGame,
    onZombieKilled: onZombieKilled,
    advanceWave: advanceWave,
    awardDroneLevel: awardDroneLevel,
    updateDroneUpgradeDescriptions: updateModuleAndPassiveDescriptions
  };
}

export function awardDroneLevel() {
  if (!state.droneActive) {
    if (state.ui?.showDroneSelectionModal) {
      state.ui.showDroneSelectionModal(function (chosenType) {
        state.droneType = chosenType;
        state.droneActive = true;
        state.combat?.setDroneType?.(chosenType);
        state.combat?.activateDrone?.(chosenType);
        state.ui.updateDroneIndicatorUI?.();

        var upg = state.upgrades?.drone;
        if (upg) {
          upg.rank = 1;
          upg.level = 1;
          upg.effectiveLevel = 1;
          if (!state.equippedModules) state.equippedModules = [];
          if (state.equippedModules.indexOf("drone") === -1) {
            state.equippedModules.push("drone");
          }
        }
        var dCfg = DRONE_TYPES[chosenType] || DRONE_TYPES.sentinela;
        state.ui.showWeaponNotification?.("🛸 Drone " + dCfg.name + " Permanente Ativado!");
        state.ui.hideLevelUpModal?.();
        updateModuleAndPassiveDescriptions();
      });
    } else {
      state.droneType = "sentinela";
      state.droneActive = true;
      state.combat?.activateDrone?.("sentinela");
      state.ui?.updateDroneIndicatorUI?.();
    }
  } else {
    var dUpg = state.upgrades?.drone;
    if (dUpg) {
      var maxRank = dUpg.max || 4;
      var curRank = dUpg.rank !== undefined ? dUpg.rank : (dUpg.level || 1);
      if (curRank < maxRank) {
        dUpg.rank = curRank + 1;
        dUpg.effectiveLevel = (dUpg.effectiveLevel || curRank) + 1;
        dUpg.level = dUpg.effectiveLevel;

        var curType = state.droneType || "sentinela";
        var dCfg = DRONE_TYPES[curType] || DRONE_TYPES.sentinela;

        if (dUpg.rank === 2) {
          state.upgrades.droneDamage.level = (state.upgrades.droneDamage.level || 0) + 1;
          state.ui?.showWeaponNotification?.("🛸 Dano do " + dCfg.name + " +35% (Nv. 2)!");
        } else if (dUpg.rank === 3) {
          state.upgrades.droneCadence.level = (state.upgrades.droneCadence.level || 0) + 1;
          state.ui?.showWeaponNotification?.("🛸 Cadência do " + dCfg.name + " +25% (Nv. 3)!");
        } else if (dUpg.rank >= 4) {
          state.upgrades.droneCount.level = (state.upgrades.droneCount.level || 0) + 1;
          state.ui?.showWeaponNotification?.("🛸 +1 Drone " + dCfg.name + " em Órbita (Nv. 4)!");
        }
        updateModuleAndPassiveDescriptions();
      } else {
        state.ui?.showWeaponNotification?.("🛸 Drone " + (DRONE_TYPES[state.droneType]?.name || "") + " no nível MÁXIMO!");
      }
    }
  }
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
