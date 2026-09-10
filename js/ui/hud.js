// O que faz: Gerencia a interface do jogo: anéis circulares de Vida e Stamina, barra fina de XP de 3px com toast de nível,
// pílula central compacta com onda/abates e ícone do bioma (nome temporário de 3s), pílula de arma equipada, botões de áudio e pausa,
// barra de slots de módulos/passivos nos modais de pausa e level-up, tela de início, árvore de habilidades e tela de fim de jogo.
// Exporta: initHUD, updateHUD, updateHpUI, updateStaminaUI, updateXpUI, updateKillsUI, updateWaveUI, updateWaveProgressUI,
// showBigAnnouncement, triggerDamageFlash, showStartScreen, hideStartScreen, showSkillTreeModal, hideSkillTreeModal, updateMuteButtonUI, updateBiomeUI,
// showPauseModal, hidePauseModal, togglePauseGame, createEquipmentSlotsHTML.
// Depende de: js/config.js, js/state.js, js/systems/audio.js, js/systems/meta.js

import {
  CAM_LERP_FACTOR,
  CAM_LOOKAT_OFFSET_Y,
  STAMINA_MAX,
  STAMINA_RECOVERY_MIN,
  HUD_RING_CIRCUMFERENCE,
  WEAPONS_CONFIG,
  DRONE_TYPES,
  MODULES_CONFIG,
  PASSIVES_CONFIG,
  RARITY_CONFIG,
  MAX_ACTIVE_TURRETS,
  MAX_ACTIVE_MINES,
  PLANET_BASE_RADIUS,
  SEA_LEVEL
} from "../config.js";
import { state } from "../state.js";
import { toggleMute, isMuted } from "../systems/audio.js";
import { getFragments, addFragments, calculateRunFragments, renderSkillTreeUI } from "../systems/meta.js";
import { getStepIndex, radiusAt } from "../core/math.js";
import { spawnMine, spawnTurret, isPointBlockedByColliders, triggerPlacementPulse } from "../systems/pickups.js";

// Elementos dos Anéis Circulares (Canto superior esquerdo)
var hpRingContainer = null;
var hpRingProgress = null;
var staminaRingContainer = null;
var staminaRingProgress = null;

// Elementos de Nível e Barra de XP (3px)
var xpBarContainerEl = null;
var xpBarFillEl = null;
var levelToastEl = null;
var levelToastTimer = null;
var lastReportedLevel = 1;

// Elementos de Arma Equipada (Abaixo dos anéis)
var weaponPillEl = null;
var weaponIconEl = null;
var weaponNameEl = null;
var weaponAmmoEl = null;
var weaponToastEl = null;
var weaponToastTimer = null;

// Elementos da Pílula Central Compacta (Onda e Abates + Bioma)
var compactPillEl = null;
var waveProgressTextEl = null;
var biomeDisplayEl = null;
var biomeIconEl = null;
var biomeNameEl = null;
var biomeToastTimer = null;
var lastBiomeName = "";

// Elementos do Canto Superior Direito
var fpsCounterEl = null;
var audioMuteBtnEl = null;
var pauseBtnEl = null;

// Efeitos visuais e modais
var lowHpVignetteEl = null;
var damageFlashEl = null;
var levelFlashEl = null;
var frenzyPillEl = null;
var frenzyTimerValEl = null;
var bossHudEl = null;
var bossHpValEl = null;
var bossHpFillEl = null;
var bigAnnouncerEl = null;
var bigWaveTitleEl = null;
var bigWaveSubEl = null;
var levelupModal = null;
var upgradeCardsGrid = null;
var gameoverModal = null;
var finalKillsEl = null;
var finalWavesEl = null;
var finalLevelEl = null;
var finalTimeEl = null;
var gameoverFragBlockEl = null;

// Modais: Tela de Início e Árvore de Habilidades
var startScreenModal = null;
var startPlayBtn = null;
var startSkillsBtn = null;
var startFragValEl = null;
var skillsTreeModal = null;
var skillsTreeContent = null;
var skillsTreeCloseBtn = null;

// Modal de Pausa
var pauseModal = null;
var pauseTimeValEl = null;
var pauseWaveValEl = null;
var pauseKillsValEl = null;
var pauseLevelValEl = null;
var pauseFragsValEl = null;

var announceTimer = null;
var lastFpsTime = 0;
var frameCounter = 0;
var currentFpsDisplay = 60;
var wasStaminaExhausted = false;

// ==========================================
// 1. ANEL CIRCULAR DE VIDA (#e04a4a)
// ==========================================
export function updateHpUI() {
  if (!hpRingProgress || !hpRingContainer) return;

  var hpClamped = Math.max(0, state.playerHp);
  var maxHp = state.maxPlayerHp || 100;
  var pct = Math.min(1, Math.max(0, hpClamped / maxHp));

  var offset = HUD_RING_CIRCUMFERENCE * (1 - pct);
  hpRingProgress.style.strokeDashoffset = offset.toFixed(1);

  if (pct < 0.30) {
    hpRingContainer.classList.add("low-hp");
    if (lowHpVignetteEl) lowHpVignetteEl.classList.add("active");
  } else {
    hpRingContainer.classList.remove("low-hp");
    if (lowHpVignetteEl) lowHpVignetteEl.classList.remove("active");
  }
}

// ==========================================
// 2. ANEL CIRCULAR DE STAMINA (#f0a53a)
// ==========================================
export function updateStaminaUI() {
  if (!staminaRingProgress || !staminaRingContainer) return;

  var currentStamina = Math.max(0, state.stamina !== undefined ? state.stamina : STAMINA_MAX);
  var pct = Math.min(1, Math.max(0, currentStamina / STAMINA_MAX));

  var offset = HUD_RING_CIRCUMFERENCE * (1 - pct);
  staminaRingProgress.style.strokeDashoffset = offset.toFixed(1);

  if (state.isStaminaExhausted) {
    if (!wasStaminaExhausted) {
      staminaRingContainer.classList.add("exhausted");
      wasStaminaExhausted = true;
    }
  } else {
    if (wasStaminaExhausted) {
      staminaRingContainer.classList.remove("exhausted");
      wasStaminaExhausted = false;
    }
  }
}

// ==========================================
// 3. BARRA DE XP (3px) E NÍVEL (TOAST DE 2s)
// ==========================================
export function showLevelUpToast(level) {
  if (!levelToastEl) {
    levelToastEl = document.getElementById("level-toast");
  }
  if (!levelToastEl) return;

  levelToastEl.textContent = "Nv. " + level;
  levelToastEl.classList.remove("show");
  void levelToastEl.offsetWidth;
  levelToastEl.classList.add("show");

  if (levelToastTimer) clearTimeout(levelToastTimer);
  levelToastTimer = setTimeout(function () {
    if (levelToastEl) levelToastEl.classList.remove("show");
  }, 2000);
}

export function updateXpUI() {
  var curXp = state.playerXp || 0;
  var needXp = state.xpNeeded || 100;
  var pct = Math.min(1, Math.max(0, curXp / needXp));

  if (!xpBarFillEl) {
    xpBarFillEl = document.getElementById("xp-bar-fill");
  }
  if (xpBarFillEl) {
    xpBarFillEl.style.width = (pct * 100).toFixed(1) + "%";
  }

  var curLvl = state.playerLevel || 1;
  if (curLvl > lastReportedLevel) {
    showLevelUpToast(curLvl);
    lastReportedLevel = curLvl;
  }
}

// ==========================================
// 4. PÍLULA CENTRAL: ONDA E PROGRESSO DE ABATES
// ==========================================
export function updateWaveProgressUI(currentKills, targetKills) {
  var wave = state.currentWave || 1;
  var kills = (currentKills !== undefined) ? currentKills : (state.waveKills !== undefined ? state.waveKills : (state.killsCount || 0));
  var target = (targetKills !== undefined) ? targetKills : (state.waveTargetKills || 30);

  if (!waveProgressTextEl) {
    waveProgressTextEl = document.getElementById("pill-wave-progress");
  }
  if (waveProgressTextEl) {
    waveProgressTextEl.textContent = "Onda " + wave + " · " + kills + "/" + target;
  }
}

export function updateWaveUI() {
  updateWaveProgressUI();
}

export function updateKillsUI() {
  updateWaveProgressUI();
}

export function updateCompactPill() {
  updateWaveProgressUI();
  updateEquipmentSlotsUI();
}

// ==========================================
// 5. ATUALIZAÇÃO DO BIOMA (ÍCONE + NOME 3s)
// ==========================================
export function updateBiomeUI(icon, name, color) {
  if (!biomeIconEl) biomeIconEl = document.getElementById("biome-icon");
  if (!biomeNameEl) biomeNameEl = document.getElementById("biome-name");

  var curIcon = icon || "🏙️";
  var curName = name || "Subúrbio";

  if (biomeIconEl) {
    biomeIconEl.textContent = curIcon;
    if (color) biomeIconEl.style.color = color;
  }

  if (biomeNameEl) {
    biomeNameEl.textContent = curName;
    if (color) biomeNameEl.style.color = color;

    if (curName !== lastBiomeName) {
      lastBiomeName = curName;
      biomeNameEl.classList.remove("show-name");
      void biomeNameEl.offsetWidth;
      biomeNameEl.classList.add("show-name");

      if (biomeToastTimer) clearTimeout(biomeToastTimer);
      biomeToastTimer = setTimeout(function () {
        if (biomeNameEl) biomeNameEl.classList.remove("show-name");
      }, 3000);
    }
  }
}

// ==========================================
// 6. SLOTS DE EQUIPAMENTO (MODAIS DE PAUSA E LEVEL-UP)
// ==========================================
export function createEquipmentSlotsHTML() {
  return (
    '<div class="equipment-slots-bar in-modal">' +
      '<div class="slots-section slots-section-modules" title="Módulos Equipados (3 slots)">' +
        '<span class="slots-header-tag mod-tag">MOD</span>' +
        '<div class="slot-box slot-module empty" data-slot="mod-0"></div>' +
        '<div class="slot-box slot-module empty" data-slot="mod-1"></div>' +
        '<div class="slot-box slot-module empty" data-slot="mod-2"></div>' +
      '</div>' +
      '<div class="slots-divider"></div>' +
      '<div class="slots-section slots-section-passives" title="Passivos Equipados (4 slots)">' +
        '<span class="slots-header-tag pas-tag">PAS</span>' +
        '<div class="slot-box slot-passive empty" data-slot="pas-0"></div>' +
        '<div class="slot-box slot-passive empty" data-slot="pas-1"></div>' +
        '<div class="slot-box slot-passive empty" data-slot="pas-2"></div>' +
        '<div class="slot-box slot-passive empty" data-slot="pas-3"></div>' +
      '</div>' +
    '</div>'
  );
}

export function updateEquipmentSlotsUI() {
  var bars = document.querySelectorAll(".equipment-slots-bar");
  if (!bars || bars.length === 0) return;

  var equippedMods = state.equippedModules || [];
  var equippedPass = state.equippedPassives || [];

  bars.forEach(function (bar) {
    for (var m = 0; m < 3; m++) {
      var slotEl = bar.querySelector('[data-slot="mod-' + m + '"]') || bar.querySelector("#mod-slot-" + m);
      if (!slotEl) continue;
      if (m < equippedMods.length) {
        var mKey = equippedMods[m];
        var mUpg = (state.upgrades && state.upgrades[mKey]) || MODULES_CONFIG[mKey];
        var mRank = mUpg ? (mUpg.rank !== undefined ? mUpg.rank : (mUpg.level || 1)) : 1;
        var mIcon = (mUpg && mUpg.icon) || "⚙️";
        slotEl.className = "slot-box slot-module filled";
        slotEl.innerHTML = '<span class="slot-icon">' + mIcon + '</span><span class="slot-rank">' + mRank + '</span>';
        slotEl.title = (mUpg ? mUpg.name : mKey) + " (Nv." + mRank + ")";
      } else {
        slotEl.className = "slot-box slot-module empty";
        slotEl.innerHTML = "";
        slotEl.title = "Slot de Módulo Vazio (" + (3 - equippedMods.length) + " restantes)";
      }
    }

    for (var p = 0; p < 4; p++) {
      var pSlotEl = bar.querySelector('[data-slot="pas-' + p + '"]') || bar.querySelector("#pas-slot-" + p);
      if (!pSlotEl) continue;
      if (p < equippedPass.length) {
        var pKey = equippedPass[p];
        var pUpg = (state.upgrades && state.upgrades[pKey]) || PASSIVES_CONFIG[pKey];
        var pRank = pUpg ? (pUpg.rank !== undefined ? pUpg.rank : (pUpg.level || 1)) : 1;
        var pIcon = (pUpg && pUpg.icon) || "⚡";
        pSlotEl.className = "slot-box slot-passive filled";
        pSlotEl.innerHTML = '<span class="slot-icon">' + pIcon + '</span><span class="slot-rank">' + pRank + '</span>';
        pSlotEl.title = (pUpg ? pUpg.name : pKey) + " (Nv." + pRank + ")";
      } else {
        pSlotEl.className = "slot-box slot-passive empty";
        pSlotEl.innerHTML = "";
        pSlotEl.title = "Slot de Passivo Vazio (" + (4 - equippedPass.length) + " restantes)";
      }
    }
  });
}

export function updateDayNightUI() {}

// ==========================================
// 7. PÍLULA DE ARMA EQUIPADA COM MUNIÇÃO
// ==========================================
export function updateWeaponUI() {
  var currentKey = state.currentWeapon || "pistol";
  var wConfig = WEAPONS_CONFIG[currentKey] || WEAPONS_CONFIG.pistol;

  if (!weaponIconEl) weaponIconEl = document.getElementById("weapon-icon");
  if (!weaponNameEl) weaponNameEl = document.getElementById("weapon-name");
  if (!weaponAmmoEl) weaponAmmoEl = document.getElementById("weapon-ammo");

  if (weaponIconEl) weaponIconEl.textContent = wConfig.icon || "🔫";
  if (weaponNameEl) weaponNameEl.textContent = wConfig.name || "Pistola";

  if (weaponAmmoEl) {
    if (wConfig.slot === "temporary") {
      var ammo = state.temporaryWeaponAmmo !== undefined ? state.temporaryWeaponAmmo : (wConfig.ammo || 0);
      weaponAmmoEl.textContent = ammo;
      weaponAmmoEl.className = "weapon-ammo-badge temporary" + (ammo <= 5 ? " low-ammo" : "");
    } else {
      weaponAmmoEl.textContent = "∞";
      weaponAmmoEl.className = "weapon-ammo-badge infinite";
    }
  }

  updateDevicesUI();
}

// ==========================================
// 8. DISPOSITIVOS: MINAS E TORRETAS (CANTO INFERIOR DIREITO)
// ==========================================
var lastDeployMineTime = 0;
export function deployMine() {
  var now = performance.now();
  if (now - lastDeployMineTime < 150) return;
  lastDeployMineTime = now;

  if (state.isPaused || state.isGameOver || state.isLevelUpPaused || !state.gameStarted) {
    return;
  }

  var btn = document.getElementById("btn-mine");
  var count = (state.playerMinesCount !== undefined) ? state.playerMinesCount : (state.minesCount || 0);

  if (count <= 0) {
    if (btn) {
      btn.classList.add("shake-error");
      setTimeout(function () { btn.classList.remove("shake-error"); }, 380);
    }
    state.sounds?.playHitSound?.();
    return;
  }

  var playerDir = state.playerLocalDir;
  if (!playerDir) return;

  var isWater = (getStepIndex(playerDir) < 0) || (radiusAt(playerDir) < PLANET_BASE_RADIUS + SEA_LEVEL + 0.05);
  var isBlocked = isPointBlockedByColliders(playerDir);

  if (isWater || isBlocked) {
    if (btn) {
      btn.classList.add("shake-error");
      setTimeout(function () { btn.classList.remove("shake-error"); }, 380);
    }
    state.sounds?.playHitSound?.();
    showWeaponNotification(isWater ? "TERRENO INVÁLIDO (ÁGUA)!" : "OBSTÁCULO NO PONTO DE PLANTIO!");
    return;
  }

  var activeMines = 0;
  var pool = state.minePool || [];
  for (var i = 0; i < pool.length; i++) {
    if (pool[i].active) activeMines++;
  }
  if (activeMines >= MAX_ACTIVE_MINES) {
    if (btn) {
      btn.classList.add("shake-error");
      setTimeout(function () { btn.classList.remove("shake-error"); }, 380);
    }
    state.sounds?.playHitSound?.();
    showWeaponNotification("MÁXIMO DE MINAS EM CAMPO (" + MAX_ACTIVE_MINES + ")!");
    return;
  }

  spawnMine(playerDir.clone());
  triggerPlacementPulse(playerDir.clone(), 0xef4444);

  state.playerMinesCount = Math.max(0, count - 1);
  state.minesCount = state.playerMinesCount;

  state.sounds?.playMinePlantSound?.();
  updateDevicesUI();
}

var lastDeployTurretTime = 0;
export function deployTurret() {
  var now = performance.now();
  if (now - lastDeployTurretTime < 150) return;
  lastDeployTurretTime = now;

  if (state.isPaused || state.isGameOver || state.isLevelUpPaused || !state.gameStarted) {
    return;
  }

  var btn = document.getElementById("btn-turret");
  var count = (state.playerTurretsCount !== undefined) ? state.playerTurretsCount : 0;

  if (count <= 0) {
    if (btn) {
      btn.classList.add("shake-error");
      setTimeout(function () { btn.classList.remove("shake-error"); }, 380);
    }
    state.sounds?.playHitSound?.();
    return;
  }

  var playerDir = state.playerLocalDir;
  if (!playerDir) return;

  var isWater = (getStepIndex(playerDir) < 0) || (radiusAt(playerDir) < PLANET_BASE_RADIUS + SEA_LEVEL + 0.05);
  var isBlocked = isPointBlockedByColliders(playerDir);

  if (isWater || isBlocked) {
    if (btn) {
      btn.classList.add("shake-error");
      setTimeout(function () { btn.classList.remove("shake-error"); }, 380);
    }
    state.sounds?.playHitSound?.();
    showWeaponNotification(isWater ? "TERRENO INVÁLIDO (ÁGUA)!" : "OBSTÁCULO NO PONTO DE INSTALAÇÃO!");
    return;
  }

  var activeTurrets = 0;
  var pool = state.turretPool || [];
  for (var i = 0; i < pool.length; i++) {
    if (pool[i].active) activeTurrets++;
  }
  if (activeTurrets >= MAX_ACTIVE_TURRETS) {
    if (btn) {
      btn.classList.add("shake-error");
      setTimeout(function () { btn.classList.remove("shake-error"); }, 380);
    }
    state.sounds?.playHitSound?.();
    showWeaponNotification("MÁXIMO DE TORRETAS EM CAMPO (" + MAX_ACTIVE_TURRETS + ")!");
    return;
  }

  spawnTurret(playerDir.clone());
  triggerPlacementPulse(playerDir.clone(), 0x38bdf8);

  state.playerTurretsCount = Math.max(0, count - 1);

  state.sounds?.playDeploySound?.();
  updateDevicesUI();
}

export function updateDevicesUI() {
  var mineCount = (state.playerMinesCount !== undefined) ? state.playerMinesCount : (state.minesCount || 0);
  var mineBadge = document.getElementById("mine-badge");
  if (mineBadge) mineBadge.textContent = mineCount;

  var mineBtn = document.getElementById("btn-mine");
  if (mineBtn) {
    var activeMines = 0;
    var mPool = state.minePool || [];
    for (var m = 0; m < mPool.length; m++) {
      if (mPool[m].active) activeMines++;
    }
    var isMineFull = activeMines >= MAX_ACTIVE_MINES;

    if (mineCount <= 0) {
      mineBtn.classList.add("disabled");
      mineBtn.classList.remove("limit-reached");
      mineBtn.setAttribute("disabled", "true");
    } else {
      mineBtn.classList.remove("disabled");
      mineBtn.removeAttribute("disabled");
      if (isMineFull) {
        mineBtn.classList.add("limit-reached");
        mineBtn.setAttribute("title", "Limite de minas em campo (" + MAX_ACTIVE_MINES + ")");
      } else {
        mineBtn.classList.remove("limit-reached");
        mineBtn.setAttribute("title", "Plantar Mina de Proximidade [M]");
      }
    }
  }

  var turretCount = (state.playerTurretsCount !== undefined) ? state.playerTurretsCount : 0;
  var turretBadge = document.getElementById("turret-badge");
  if (turretBadge) turretBadge.textContent = turretCount;

  var turretBtn = document.getElementById("btn-turret");
  if (turretBtn) {
    var activeTurrets = 0;
    var tPool = state.turretPool || [];
    for (var t = 0; t < tPool.length; t++) {
      if (tPool[t].active) activeTurrets++;
    }
    var isTurretFull = activeTurrets >= MAX_ACTIVE_TURRETS;

    if (turretCount <= 0) {
      turretBtn.classList.add("disabled");
      turretBtn.classList.remove("limit-reached");
      turretBtn.setAttribute("disabled", "true");
    } else {
      turretBtn.classList.remove("disabled");
      turretBtn.removeAttribute("disabled");
      if (isTurretFull) {
        turretBtn.classList.add("limit-reached");
        turretBtn.setAttribute("title", "Máximo de torretas em campo (" + MAX_ACTIVE_TURRETS + ")");
      } else {
        turretBtn.classList.remove("limit-reached");
        turretBtn.setAttribute("title", "Instalar Torreta Automática [T]");
      }
    }
  }

  updateBombsUI();
}

export function updateBombsUI() {
  var count = (state.bombsCount !== undefined) ? state.bombsCount : 0;
  var badge = document.getElementById("bomb-badge");
  if (badge) badge.textContent = count;

  var bombBtn = document.getElementById("btn-bomb");
  if (bombBtn) {
    if (count <= 0) {
      bombBtn.classList.add("disabled");
      bombBtn.setAttribute("disabled", "true");
    } else {
      bombBtn.classList.remove("disabled");
      bombBtn.removeAttribute("disabled");
    }
  }
}

export function updateDroneIndicatorUI() {
  var indicator = document.getElementById("drone-indicator");
  if (!indicator) return;

  if (state.droneActive) {
    var dTypeKey = state.droneType || "sentinela";
    var dCfg = DRONE_TYPES[dTypeKey] || DRONE_TYPES.sentinela;
    var dIcon = dCfg.icon || "🛸";
    var dName = dCfg.name || "Sentinela";

    indicator.innerHTML =
      '<span class="drone-icon">' + dIcon + '</span>' +
      '<span class="drone-name">' + dName + '</span>';
    indicator.className = "drone-indicator active type-" + dTypeKey;
    indicator.style.display = "inline-flex";
  } else {
    indicator.style.display = "none";
    indicator.className = "drone-indicator";
  }
}

export function showWeaponNotification(text) {
  if (!weaponToastEl) weaponToastEl = document.getElementById("weapon-toast");
  if (!weaponToastEl) return;
  weaponToastEl.textContent = text;
  weaponToastEl.classList.remove("show");
  void weaponToastEl.offsetWidth;
  weaponToastEl.classList.add("show");

  if (weaponToastTimer) clearTimeout(weaponToastTimer);
  weaponToastTimer = setTimeout(function () {
    if (weaponToastEl) weaponToastEl.classList.remove("show");
  }, 2400);
}

export function showItemNotification(text, color) {
  showWeaponNotification(text);
  if (weaponToastEl && color) {
    weaponToastEl.style.borderColor = color;
  }
}

// ==========================================
// 9. ANÚNCIOS GRANDES E EFEITOS DE TELA
// ==========================================
export function showBigAnnouncement(title, subtitle, durationMs) {
  if (!bigAnnouncerEl || !bigWaveTitleEl || !bigWaveSubEl) return;
  bigWaveTitleEl.textContent = title;
  bigWaveSubEl.textContent = subtitle || "";

  bigAnnouncerEl.classList.remove("show");
  void bigAnnouncerEl.offsetWidth;
  bigAnnouncerEl.classList.add("show");

  if (announceTimer) clearTimeout(announceTimer);
  announceTimer = setTimeout(function () {
    if (bigAnnouncerEl) bigAnnouncerEl.classList.remove("show");
  }, durationMs || 2200);
}

export function triggerDamageFlash() {
  if (!damageFlashEl) return;
  damageFlashEl.classList.remove("flash");
  void damageFlashEl.offsetWidth;
  damageFlashEl.classList.add("flash");
  setTimeout(function () {
    if (damageFlashEl) damageFlashEl.classList.remove("flash");
  }, 120);
}

export function updateFrenzyUI(timer, isActive) {
  if (!frenzyPillEl) return;
  if (isActive && timer > 0) {
    frenzyPillEl.classList.add("active");
    if (frenzyTimerValEl) frenzyTimerValEl.textContent = timer.toFixed(1) + "s";
  } else {
    frenzyPillEl.classList.remove("active");
  }
}

export function showBossBar(name, maxHp) {
  if (!bossHudEl) return;
  var title = bossHudEl.querySelector(".boss-title");
  if (title) title.textContent = "⚠️ " + (name || "CHEFE");
  if (bossHpValEl) bossHpValEl.textContent = maxHp + " / " + maxHp;
  if (bossHpFillEl) bossHpFillEl.style.width = "100%";
  bossHudEl.classList.add("active");
}

export function updateBossHp(currentHp, maxHp) {
  if (!bossHudEl) return;
  var cur = Math.max(0, currentHp);
  if (bossHpValEl) bossHpValEl.textContent = cur + " / " + maxHp;
  if (bossHpFillEl) {
    var pct = Math.min(1, Math.max(0, cur / maxHp)) * 100;
    bossHpFillEl.style.width = pct.toFixed(1) + "%";
  }
}

export function hideBossBar() {
  if (bossHudEl) bossHudEl.classList.remove("active");
}

// ==========================================
// 10. MODAL DE LEVEL UP E SELEÇÃO DE DRONE
// ==========================================
export function showLevelUpModal(cards, onSelect) {
  hidePauseModal();
  if (!levelupModal || !upgradeCardsGrid) return;
  upgradeCardsGrid.innerHTML = "";

  var badgeEl = levelupModal.querySelector(".levelup-badge");
  var titleEl = levelupModal.querySelector(".levelup-title");
  var subEl = levelupModal.querySelector(".levelup-sub");
  if (badgeEl) badgeEl.textContent = "⭐ Subiu de Nível!";
  if (titleEl) titleEl.textContent = "Escolha uma Melhoria";
  if (subEl) subEl.textContent = "Selecione para expandir seus módulos ou aprimorar passivos:";

  if (levelFlashEl) {
    levelFlashEl.classList.remove("flash");
    void levelFlashEl.offsetWidth;
    levelFlashEl.classList.add("flash");
    setTimeout(function () {
      if (levelFlashEl) levelFlashEl.classList.remove("flash");
    }, 200);
  }

  // Garante que os slots de equipamento apareçam no modal de level-up
  var lvlContainer = levelupModal.querySelector(".levelup-container");
  if (lvlContainer && !lvlContainer.querySelector("#levelup-equipment-slots")) {
    var lvlSlotsSec = document.createElement("div");
    lvlSlotsSec.id = "levelup-equipment-slots";
    lvlSlotsSec.className = "modal-equipment-section";
    lvlSlotsSec.innerHTML =
      '<div class="modal-slots-label">MÓDULOS E PASSIVOS EQUIPADOS</div>' +
      createEquipmentSlotsHTML();
    lvlContainer.insertBefore(lvlSlotsSec, upgradeCardsGrid);
  }

  cards.forEach(function (key) {
    var upg = state.upgrades[key];
    if (!upg) return;

    var rarity = (state.offeredRarities && state.offeredRarities[key]) || "comum";
    var isModule = Boolean(MODULES_CONFIG[key] || upg.category === "module");
    var categoryKey = isModule ? "module" : "passive";
    var categoryName = isModule ? "MÓDULO" : "PASSIVO";
    var categoryIcon = isModule ? "⚙️" : "⚡";

    var isEquipped = false;
    if (isModule) {
      isEquipped = (state.equippedModules || []).indexOf(key) !== -1;
    } else {
      isEquipped = (state.equippedPassives || []).indexOf(key) !== -1;
    }

    var currentRank = upg.rank !== undefined ? upg.rank : (upg.level || 0);
    var nextRank = currentRank + 1;

    var rawName = upg.name || key;
    var cleanName = rawName.replace(/<[^>]*>/g, "").replace(/✦.*/g, "").replace(/★.*/g, "").trim();
    var cleanDesc = (upg.desc || "").replace(/<[^>]*>/g, "").trim();

    var statusClass = isEquipped ? "status-upgrade" : "status-new";
    var statusText = isEquipped ? "EQUIPADO" : "NOVO " + categoryName;
    var progressionText = isEquipped
      ? (cleanName + " Nv." + currentRank + " → Nv." + nextRank)
      : ("Novo " + categoryName + " → Nv.1");

    var rarityLabel = rarity === "prototipica" ? "PROTOTÍPICA" : (rarity === "rara" ? "RARA" : "COMUM");
    var rarityIcon = rarity === "prototipica" ? "★" : (rarity === "rara" ? "✦" : "▫");

    var btn = document.createElement("button");
    btn.className = "upgrade-card-btn cat-" + categoryKey + " rarity-" + rarity;
    btn.setAttribute("type", "button");
    btn.innerHTML =
      '<div class="card-side-accent"></div>' +
      '<div class="card-inner">' +
        '<div class="card-badges-row">' +
          '<div class="card-category-badge cat-' + categoryKey + '">' +
            '<span class="cat-icon">' + categoryIcon + '</span>' +
            '<span class="cat-name">' + categoryName + '</span>' +
          '</div>' +
          '<div class="card-status-pill ' + statusClass + '">' + statusText + '</div>' +
          '<div class="card-rarity-pill rarity-' + rarity + '">' +
            '<span class="rarity-icon">' + rarityIcon + '</span>' +
            '<span class="rarity-name">' + rarityLabel + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="card-content-row">' +
          '<div class="upg-icon-frame cat-' + categoryKey + '">' +
            '<span class="upg-big-icon">' + (upg.icon || "⭐") + '</span>' +
          '</div>' +
          '<div class="upg-details-col">' +
            '<div class="upg-header-line">' +
              '<span class="upg-title">' + cleanName + '</span>' +
              '<span class="upg-progression-pill">' + progressionText + '</span>' +
            '</div>' +
            '<div class="upg-description">' + cleanDesc + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    btn.onclick = function () {
      onSelect(key);
      updateEquipmentSlotsUI();
    };
    upgradeCardsGrid.appendChild(btn);
  });

  updateEquipmentSlotsUI();
  levelupModal.style.display = "flex";
}

export function showDroneSelectionModal(onSelect) {
  if (!levelupModal || !upgradeCardsGrid) return;
  upgradeCardsGrid.innerHTML = "";

  var badgeEl = levelupModal.querySelector(".levelup-badge");
  var titleEl = levelupModal.querySelector(".levelup-title");
  var subEl = levelupModal.querySelector(".levelup-sub");
  if (badgeEl) badgeEl.textContent = "🛸 Companheiro de Combate";
  if (titleEl) titleEl.textContent = "Escolha o Modelo de Drone";
  if (subEl) subEl.textContent = "Selecione a doutrina permanente do seu drone de suporte orbital:";

  var typesKeys = ["sentinela", "artilheiro", "batedor"];
  typesKeys.forEach(function (tipo) {
    var dCfg = DRONE_TYPES[tipo];
    if (!dCfg) return;

    var btn = document.createElement("button");
    btn.className = "upgrade-card-btn cat-module rarity-rara drone-type-card";
    btn.setAttribute("type", "button");
    btn.innerHTML =
      '<div class="card-side-accent"></div>' +
      '<div class="card-inner">' +
        '<div class="card-badges-row">' +
          '<div class="card-category-badge cat-module"><span class="cat-icon">🛸</span> MÓDULO</div>' +
          '<div class="card-status-pill status-new">COMPANHEIRO</div>' +
          '<div class="card-rarity-pill rarity-rara"><span class="rarity-icon">✦</span> ESPECIAL</div>' +
        '</div>' +
        '<div class="card-content-row">' +
          '<div class="upg-icon-frame cat-module"><span class="upg-big-icon">' + (dCfg.icon || "🛸") + '</span></div>' +
          '<div class="upg-details-col">' +
            '<div class="upg-header-line">' +
              '<span class="upg-title">' + dCfg.name + '</span>' +
              '<span class="upg-progression-pill">Novo Módulo</span>' +
            '</div>' +
            '<div class="upg-description">' + dCfg.desc + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    btn.onclick = function () {
      onSelect(tipo);
      updateEquipmentSlotsUI();
    };
    upgradeCardsGrid.appendChild(btn);
  });

  updateEquipmentSlotsUI();
  levelupModal.style.display = "flex";
}

export function hideLevelUpModal() {
  if (levelupModal) levelupModal.style.display = "none";
  updateEquipmentSlotsUI();
}

// ==========================================
// 11. CONTROLE DE MUDO (ÁUDIO)
// ==========================================
export function updateMuteButtonUI(muted) {
  if (!audioMuteBtnEl) audioMuteBtnEl = document.getElementById("audio-mute-btn");
  if (!audioMuteBtnEl) return;
  audioMuteBtnEl.textContent = muted ? "🔇" : "🔊";
  audioMuteBtnEl.setAttribute("aria-label", muted ? "Ativar som" : "Desativar som");
  audioMuteBtnEl.classList.toggle("is-muted", muted);
}

// ==========================================
// 12. TELA DE INÍCIO ("JOGAR" / "HABILIDADES")
// ==========================================
export function showStartScreen(isRestart) {
  hidePauseModal();
  if (!startScreenModal) return;
  if (startFragValEl) {
    startFragValEl.textContent = getFragments();
  }

  var subtitle = startScreenModal.querySelector(".start-subtitle");
  if (subtitle) {
    subtitle.textContent = isRestart
      ? "Pronto para outra tentativa? Aprimore seus atributos e enfrente o planeta."
      : "Sobreviva às hordas e expanda seu arsenal no relevo dinâmico do planeta.";
  }

  if (startPlayBtn) {
    startPlayBtn.textContent = isRestart ? "NOVA PARTIDA" : "JOGAR";
  }

  startScreenModal.style.display = "flex";
}

export function hideStartScreen() {
  if (startScreenModal) {
    startScreenModal.style.display = "none";
  }
}

// ==========================================
// 13. MODAL DA ÁRVORE DE HABILIDADES PERMANENTES
// ==========================================
export function showSkillTreeModal() {
  if (!skillsTreeModal || !skillsTreeContent) return;
  renderSkillTreeUI(skillsTreeContent, function () {
    if (startFragValEl) {
      startFragValEl.textContent = getFragments();
    }
  });
  skillsTreeModal.style.display = "flex";
}

export function hideSkillTreeModal() {
  if (skillsTreeModal) {
    skillsTreeModal.style.display = "none";
  }
  if (startFragValEl) {
    startFragValEl.textContent = getFragments();
  }
}

// ==========================================
// 14. TELA DE GAME OVER (FIM DE JOGO)
// ==========================================
export function formatSurvivalTime(seconds) {
  var sec = Math.floor(seconds || 0);
  var m = Math.floor(sec / 60);
  var s = sec % 60;
  return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
}

export function showGameOverModal(kills, waves, level, timeStr) {
  hidePauseModal();
  if (!gameoverModal) return;

  if (finalKillsEl) finalKillsEl.textContent = kills;
  if (finalWavesEl) finalWavesEl.textContent = waves;
  if (finalLevelEl) finalLevelEl.textContent = level;
  if (finalTimeEl) finalTimeEl.textContent = timeStr;

  var earnedFragments = calculateRunFragments(waves, kills);
  addFragments(earnedFragments);

  if (gameoverFragBlockEl) {
    gameoverFragBlockEl.innerHTML =
      '<div class="gameover-frag-row">' +
        '<span class="frag-icon">💎</span>' +
        '<span class="frag-text">+' + earnedFragments + ' Fragmentos Meta Coletados!</span>' +
        '<span class="frag-total">(Total: ' + getFragments() + ')</span>' +
      '</div>';
  }

  gameoverModal.style.display = "flex";
}

export function hideGameOverModal() {
  if (gameoverModal) {
    gameoverModal.style.display = "none";
  }
}

// ==========================================
// 15. MODAL DE MENU DE PAUSA (PAUSE)
// ==========================================
export function showPauseModal() {
  if (!pauseModal) return;
  if (!state.gameStarted || state.isGameOver || state.isLevelUpPaused) return;

  state.isPaused = true;
  state.pauseStartTime = Date.now();
  document.body.classList.add("game-paused");

  if (state.attenuateAmbience) {
    state.attenuateAmbience(true);
  }

  state.joyTouchId = null;
  state.isJoystickActive = false;
  state.joyX = 0;
  state.joyY = 0;
  var knob = document.getElementById("joystick-knob");
  if (knob) knob.style.transform = "translate(0px, 0px)";

  var elapsedSec = Math.max(0, Math.floor((Date.now() - (state.gameStartTime || Date.now())) / 1000));
  if (pauseTimeValEl) pauseTimeValEl.textContent = formatSurvivalTime(elapsedSec);
  if (pauseWaveValEl) pauseWaveValEl.textContent = state.currentWave || 1;
  if (pauseLevelValEl) pauseLevelValEl.textContent = "Nv. " + (state.playerLevel || 1);
  if (pauseKillsValEl) pauseKillsValEl.textContent = (state.killsCount || 0) + " 💀";

  var earnedFrags = calculateRunFragments(state.currentWave || 1, state.killsCount || 0);
  if (pauseFragsValEl) pauseFragsValEl.textContent = "+" + earnedFrags + " 🔷";

  // Garante que a barra de slots exista e esteja atualizada no modal de pausa
  var pauseCard = pauseModal.querySelector(".pause-card");
  if (pauseCard && !pauseCard.querySelector("#pause-equipment-slots")) {
    var pauseSlotsSec = document.createElement("div");
    pauseSlotsSec.id = "pause-equipment-slots";
    pauseSlotsSec.className = "modal-equipment-section";
    pauseSlotsSec.innerHTML =
      '<div class="modal-slots-label">MÓDULOS E PASSIVOS EQUIPADOS</div>' +
      createEquipmentSlotsHTML();
    var actionsCol = pauseCard.querySelector(".pause-actions-col");
    if (actionsCol) {
      pauseCard.insertBefore(pauseSlotsSec, actionsCol);
    } else {
      pauseCard.appendChild(pauseSlotsSec);
    }
  }

  updateEquipmentSlotsUI();
  pauseModal.style.display = "flex";
}

export function hidePauseModal() {
  if (pauseModal) {
    pauseModal.style.display = "none";
  }
  document.body.classList.remove("game-paused");

  if (state.pauseStartTime) {
    var pausedDuration = Date.now() - state.pauseStartTime;
    state.gameStartTime = (state.gameStartTime || Date.now()) + pausedDuration;
    state.pauseStartTime = null;
  }

  state.isPaused = false;
  state.joyTouchId = null;
  state.isJoystickActive = false;
  state.joyX = 0;
  state.joyY = 0;

  if (state.attenuateAmbience) {
    state.attenuateAmbience(false);
  }
}

export function togglePauseGame() {
  if (!state.gameStarted || state.isGameOver || state.isLevelUpPaused) return;
  if (state.isPaused) {
    hidePauseModal();
  } else {
    showPauseModal();
  }
}

// ==========================================
// 16. INICIALIZAÇÃO DO HUD E ELEMENTOS DE UI
// ==========================================
export function initHUD() {
  if (state.hudInitialized) {
    updateHpUI();
    updateStaminaUI();
    updateXpUI();
    updateWaveProgressUI();
    updateWeaponUI();
    updateDevicesUI();
    updateBombsUI();
    updateDroneIndicatorUI();
    updateEquipmentSlotsUI();
    return;
  }
  state.hudInitialized = true;

  // 1. Elementos da Barra Superior (Top Bar)
  hpRingContainer = document.getElementById("hp-ring-container");
  hpRingProgress = document.getElementById("hp-ring-progress");
  staminaRingContainer = document.getElementById("stamina-ring-container");
  staminaRingProgress = document.getElementById("stamina-ring-progress");

  xpBarContainerEl = document.getElementById("xp-bar-container");
  xpBarFillEl = document.getElementById("xp-bar-fill");
  levelToastEl = document.getElementById("level-toast");

  compactPillEl = document.getElementById("compact-stats-pill");
  waveProgressTextEl = document.getElementById("pill-wave-progress");
  biomeDisplayEl = document.getElementById("biome-display");
  biomeIconEl = document.getElementById("biome-icon");
  biomeNameEl = document.getElementById("biome-name");

  fpsCounterEl = document.getElementById("fps-counter");
  audioMuteBtnEl = document.getElementById("audio-mute-btn");
  if (audioMuteBtnEl && !audioMuteBtnEl.dataset.bound) {
    audioMuteBtnEl.dataset.bound = "true";
    audioMuteBtnEl.addEventListener("click", function (e) {
      e.stopPropagation();
      var nowMuted = toggleMute();
      updateMuteButtonUI(nowMuted);
    });
  }

  pauseBtnEl = document.getElementById("pause-btn");
  if (pauseBtnEl && !pauseBtnEl.dataset.bound) {
    pauseBtnEl.dataset.bound = "true";
    pauseBtnEl.addEventListener("click", function (e) {
      e.stopPropagation();
      e.preventDefault();
      togglePauseGame();
    });
  }

  weaponPillEl = document.getElementById("weapon-hud-pill");
  weaponIconEl = document.getElementById("weapon-icon");
  weaponNameEl = document.getElementById("weapon-name");
  weaponAmmoEl = document.getElementById("weapon-ammo");

  // 2. Elementos fora de fluxo (Overlay Absolutos)
  bossHudEl = document.getElementById("boss-hud");
  bossHpValEl = document.getElementById("boss-hp-val");
  bossHpFillEl = document.getElementById("boss-hp-fill");
  frenzyPillEl = document.getElementById("frenzy-pill");
  frenzyTimerValEl = document.getElementById("frenzy-timer-val");
  weaponToastEl = document.getElementById("weapon-toast");
  bigAnnouncerEl = document.getElementById("big-announcer");
  bigWaveTitleEl = document.getElementById("big-wave-title");
  bigWaveSubEl = document.getElementById("big-wave-sub");
  var droneIndicator = document.getElementById("drone-indicator");

  // 3. Efeitos visuais de tela
  lowHpVignetteEl = document.getElementById("low-hp-vignette");
  damageFlashEl = document.getElementById("damage-flash");
  levelFlashEl = document.getElementById("level-flash");

  // 4. Botões de Dispositivos na Barra Inferior
  var turretBtn = document.getElementById("btn-turret");
  if (turretBtn && !turretBtn.dataset.boundHud) {
    turretBtn.dataset.boundHud = "true";
    turretBtn.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      e.stopPropagation();
      deployTurret();
    });
  }

  var mineBtn = document.getElementById("btn-mine");
  if (mineBtn && !mineBtn.dataset.boundHud) {
    mineBtn.dataset.boundHud = "true";
    mineBtn.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      e.stopPropagation();
      deployMine();
    });
  }

  var bombBtn = document.getElementById("btn-bomb");
  if (bombBtn && !bombBtn.dataset.boundHud) {
    bombBtn.dataset.boundHud = "true";
    bombBtn.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (state.combat && state.combat.triggerBomb) {
        state.combat.triggerBomb();
      }
    });
  }

  // 5. Modal de Level Up
  levelupModal = document.getElementById("levelup-modal");
  upgradeCardsGrid = document.getElementById("upgrade-cards-grid");

  // 6. Modal de Game Over
  gameoverModal = document.getElementById("gameover-modal");
  finalKillsEl = document.getElementById("final-kills");
  finalWavesEl = document.getElementById("final-waves");
  finalLevelEl = document.getElementById("final-level");
  finalTimeEl = document.getElementById("final-time");
  gameoverFragBlockEl = document.getElementById("gameover-frag-block");

  var restartBtn = document.getElementById("restart-btn");
  if (restartBtn && !restartBtn.dataset.bound) {
    restartBtn.dataset.bound = "true";
    restartBtn.addEventListener("click", function (e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      hideGameOverModal();
      if (state.resetGame) {
        state.resetGame();
      } else if (state.progression && state.progression.restartGame) {
        state.progression.restartGame();
      }
    });
  }

  var menuBtn = document.getElementById("gameover-menu-btn");
  if (menuBtn && !menuBtn.dataset.bound) {
    menuBtn.dataset.bound = "true";
    menuBtn.addEventListener("click", function (e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      hideGameOverModal();
      showStartScreen(true);
    });
  }

  // 7. Modal de Início (Start Screen)
  startScreenModal = document.getElementById("start-screen-modal");
  if (startScreenModal) {
    startPlayBtn = startScreenModal.querySelector("#start-play-btn");
    startSkillsBtn = startScreenModal.querySelector("#start-skills-btn");
    startFragValEl = startScreenModal.querySelector("#start-frag-count");

    if (startPlayBtn && !startPlayBtn.dataset.bound) {
      startPlayBtn.dataset.bound = "true";
      startPlayBtn.addEventListener("click", function (e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        hideStartScreen();
        if (state.onUserStartGame) {
          state.onUserStartGame();
        } else if (state.resetGame) {
          state.resetGame();
        }
      });
    }

    if (startSkillsBtn && !startSkillsBtn.dataset.bound) {
      startSkillsBtn.dataset.bound = "true";
      startSkillsBtn.addEventListener("click", function () {
        showSkillTreeModal();
      });
    }
  }

  // 8. Modal da Árvore de Habilidades
  skillsTreeModal = document.getElementById("skills-tree-modal");
  if (skillsTreeModal) {
    skillsTreeContent = skillsTreeModal.querySelector("#skills-tree-scroll-container");
    skillsTreeCloseBtn = skillsTreeModal.querySelector("#skills-tree-close-btn");

    if (skillsTreeCloseBtn && !skillsTreeCloseBtn.dataset.bound) {
      skillsTreeCloseBtn.dataset.bound = "true";
      skillsTreeCloseBtn.addEventListener("click", function () {
        hideSkillTreeModal();
      });
    }
  }

  // 9. Modal de Pausa
  pauseModal = document.getElementById("pause-modal");
  if (pauseModal) {
    pauseTimeValEl = pauseModal.querySelector("#pause-stat-time");
    pauseWaveValEl = pauseModal.querySelector("#pause-stat-wave");
    pauseKillsValEl = pauseModal.querySelector("#pause-stat-kills");
    pauseLevelValEl = pauseModal.querySelector("#pause-stat-level");
    pauseFragsValEl = pauseModal.querySelector("#pause-stat-frags");

    var btnResume = pauseModal.querySelector("#btn-pause-resume");
    if (btnResume && !btnResume.dataset.bound) {
      btnResume.dataset.bound = "true";
      btnResume.addEventListener("click", function (e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        hidePauseModal();
      });
    }

    var btnRestart = pauseModal.querySelector("#btn-pause-restart");
    if (btnRestart && !btnRestart.dataset.bound) {
      btnRestart.dataset.bound = "true";
      btnRestart.addEventListener("click", function (e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        hidePauseModal();
        if (state.resetGame) {
          state.resetGame();
        } else if (state.progression && state.progression.restartGame) {
          state.progression.restartGame();
        }
      });
    }

    var btnSkills = pauseModal.querySelector("#btn-pause-skills");
    if (btnSkills && !btnSkills.dataset.bound) {
      btnSkills.dataset.bound = "true";
      btnSkills.addEventListener("click", function (e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        showSkillTreeModal();
      });
    }

    var btnMenu = pauseModal.querySelector("#btn-pause-menu");
    if (btnMenu && !btnMenu.dataset.bound) {
      btnMenu.dataset.bound = "true";
      btnMenu.addEventListener("click", function (e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        hidePauseModal();
        state.gameStarted = false;
        if (state.sounds && state.sounds.stopMusic) {
          state.sounds.stopMusic();
        }
        showStartScreen(true);
      });
    }
  }

  // Registra métodos de UI no state global
  state.ui.updateHpUI = updateHpUI;
  state.ui.updateStaminaUI = updateStaminaUI;
  state.ui.updateXpUI = updateXpUI;
  state.ui.updateKillsUI = updateKillsUI;
  state.ui.updateWaveUI = updateWaveUI;
  state.ui.updateWaveProgressUI = updateWaveProgressUI;
  state.ui.updateDayNightUI = updateDayNightUI;
  state.ui.showBossBar = showBossBar;
  state.ui.updateBossHp = updateBossHp;
  state.ui.hideBossBar = hideBossBar;
  state.ui.showBigAnnouncement = showBigAnnouncement;
  state.ui.triggerDamageFlash = triggerDamageFlash;
  state.ui.updateFrenzyUI = updateFrenzyUI;
  state.ui.showLevelUpModal = showLevelUpModal;
  state.ui.hideLevelUpModal = hideLevelUpModal;
  state.ui.showGameOverModal = showGameOverModal;
  state.ui.hideGameOverModal = hideGameOverModal;
  state.ui.updateWeaponUI = updateWeaponUI;
  state.ui.showWeaponNotification = showWeaponNotification;
  state.ui.showItemNotification = showItemNotification;
  state.ui.updateMuteButtonUI = updateMuteButtonUI;
  state.ui.showStartScreen = showStartScreen;
  state.ui.hideStartScreen = hideStartScreen;
  state.ui.showPauseModal = showPauseModal;
  state.ui.hidePauseModal = hidePauseModal;
  state.ui.togglePauseGame = togglePauseGame;
  state.ui.showSkillTreeModal = showSkillTreeModal;
  state.ui.hideSkillTreeModal = hideSkillTreeModal;
  state.ui.updateBombsUI = updateBombsUI;
  state.ui.updateDevicesUI = updateDevicesUI;
  state.ui.updateMinesUI = updateDevicesUI;
  state.ui.deployMine = deployMine;
  state.ui.deployTurret = deployTurret;
  state.ui.updateDroneIndicatorUI = updateDroneIndicatorUI;
  state.ui.showDroneSelectionModal = showDroneSelectionModal;
  state.ui.updateBiomeUI = updateBiomeUI;
  state.ui.updateEquipmentSlotsUI = updateEquipmentSlotsUI;

  // Atualização inicial
  updateHpUI();
  updateStaminaUI();
  updateXpUI();
  updateWaveProgressUI();
  updateWeaponUI();
  updateDevicesUI();
  updateBombsUI();
  updateDroneIndicatorUI();
  updateEquipmentSlotsUI();
  updateMuteButtonUI(isMuted());
}

// ==========================================
// 17. ATUALIZAÇÃO CONTÍNUA DO HUD
// ==========================================
export function updateHUD(dt) {
  updateStaminaUI();

  if (pauseBtnEl) {
    var canPause = Boolean(state.gameStarted && !state.isGameOver && !state.isLevelUpPaused);
    pauseBtnEl.style.display = canPause ? "flex" : "none";
    pauseBtnEl.disabled = !canPause;
  }

  frameCounter++;
  var now = performance.now();
  if (now - lastFpsTime >= 500) {
    currentFpsDisplay = Math.round((frameCounter * 1000) / (now - lastFpsTime));
    state.currentFps = currentFpsDisplay;
    if (fpsCounterEl) fpsCounterEl.textContent = currentFpsDisplay + " FPS";
    frameCounter = 0;
    lastFpsTime = now;
  }

  state.camShake *= 0.88;
  state.currentCamDistance += (state.targetCamDistance - state.currentCamDistance) * CAM_LERP_FACTOR;
  var camHeight = 3.2 * (state.currentCamDistance / 7.5);
  var camDistXZ = Math.sqrt(Math.max(1.0, state.currentCamDistance * state.currentCamDistance - camHeight * camHeight));

  var camOffsetX = Math.sin(state.currentCamYaw) * camDistXZ;
  var camOffsetZ = Math.cos(state.currentCamYaw) * camDistXZ;

  state.desiredCamPos.set(camOffsetX, state.currentGroundY + camHeight, camOffsetZ);
  state.currentCamPos.lerp(state.desiredCamPos, CAM_LERP_FACTOR);
  state.camera.position.copy(state.currentCamPos);

  if (state.camShake > 0.001) {
    state.camera.position.x += (Math.random() - 0.5) * state.camShake * 2.2;
    state.camera.position.y += (Math.random() - 0.5) * state.camShake * 2.2;
    state.camera.position.z += (Math.random() - 0.5) * state.camShake * 2.2;
  }

  state.desiredLookTarget.set(0, state.currentGroundY + CAM_LOOKAT_OFFSET_Y, 0);
  state.currentLookTarget.lerp(state.desiredLookTarget, CAM_LERP_FACTOR);
  state.camera.lookAt(state.currentLookTarget);
}
