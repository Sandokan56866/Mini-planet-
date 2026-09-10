// O que faz: Gerencia a interface do jogo: anéis circulares de Vida e Stamina, pílula compacta de progresso,
// tela de início com botão JOGAR, tela de árvore de habilidades permanente, botão de mudo, menu de pausa e tela de fim de jogo com fragmentos.
// Exporta: initHUD, updateHUD, updateHpUI, updateStaminaUI, updateXpUI, updateKillsUI, updateWaveUI, updateWaveProgressUI,
// showBigAnnouncement, triggerDamageFlash, showStartScreen, hideStartScreen, showSkillTreeModal, hideSkillTreeModal, updateMuteButtonUI, updateBiomeUI,
// showPauseModal, hidePauseModal, togglePauseGame.
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
  RARITY_CONFIG
} from "../config.js";
import { state } from "../state.js";
import { toggleMute, isMuted } from "../systems/audio.js";
import { getFragments, addFragments, calculateRunFragments, renderSkillTreeUI } from "../systems/meta.js";

// Elementos dos Anéis Circulares (Canto superior esquerdo)
var hpRingContainer = null;
var hpRingProgress = null;
var staminaRingContainer = null;
var staminaRingProgress = null;

// Elementos de Armas e Itens (Centro Superior)
var weaponPillEl = null;
var weaponIconEl = null;
var weaponNameEl = null;
var weaponAmmoEl = null;
var devicePillEl = null;
var deviceCountEl = null;
var weaponToastEl = null;
var weaponToastTimer = null;

// Elementos da Pílula Compacta e FPS (Canto superior direito)
var compactPillEl = null;
var pillWaveEl = null;
var pillKillsEl = null;
var pillLevelEl = null;
var pillXpEl = null;
var biomeDisplayEl = null;
var fpsCounterEl = null;
var audioMuteBtnEl = null;

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

// Novos Modais: Tela de Início e Árvore de Habilidades
var startScreenModal = null;
var startPlayBtn = null;
var startSkillsBtn = null;
var startFragValEl = null;
var skillsTreeModal = null;
var skillsTreeContent = null;
var skillsTreeCloseBtn = null;

// Modal de Pausa e Botão de Pausa
var pauseBtnEl = null;
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
// 3. PÍLULA COMPACTA DE INFORMAÇÕES E ARMAS
// ==========================================
export function updateCompactPill() {
  if (pillWaveEl) pillWaveEl.textContent = "Onda " + (state.currentWave || 1);
  if (pillKillsEl) pillKillsEl.textContent = (state.killsCount || 0) + " 💀";
  if (pillLevelEl) pillLevelEl.textContent = "N" + (state.playerLevel || 1);
  if (pillXpEl) pillXpEl.textContent = Math.floor(state.playerXp || 0) + "/" + (state.xpNeeded || 100);
  updateEquipmentSlotsUI();
}

export function updateEquipmentSlotsUI() {
  var bar = document.getElementById("equipment-slots-bar");
  if (!bar) return;

  var equippedMods = state.equippedModules || [];
  var equippedPass = state.equippedPassives || [];

  for (var m = 0; m < 3; m++) {
    var slotEl = document.getElementById("mod-slot-" + m);
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
    var pSlotEl = document.getElementById("pas-slot-" + p);
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
}

export function updateXpUI() {
  updateCompactPill();
}

export function updateKillsUI() {
  updateCompactPill();
}

export function updateWaveUI() {
  updateCompactPill();
}

export function updateWaveProgressUI() {
  updateCompactPill();
}

export function updateDayNightUI() {}

export function updateWeaponUI() {
  var currentKey = state.currentWeapon || "pistol";
  var wConfig = WEAPONS_CONFIG[currentKey] || WEAPONS_CONFIG.pistol;

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

  if (deviceCountEl) {
    var mines = state.playerMinesCount !== undefined ? state.playerMinesCount : 3;
    deviceCountEl.textContent = mines;
    if (devicePillEl) {
      if (mines === 0) devicePillEl.classList.add("empty");
      else devicePillEl.classList.remove("empty");
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

// ==========================================
// 4. ANÚNCIOS GRANDES E EFEITOS DE TELA
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
// 5. MODAL DE LEVEL UP E SELEÇÃO DE DRONE
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

  levelupModal.style.display = "flex";
}

export function hideLevelUpModal() {
  if (levelupModal) levelupModal.style.display = "none";
  updateEquipmentSlotsUI();
}

// ==========================================
// 6. CONTROLE DE MUDO (ÁUDIO)
// ==========================================
export function updateMuteButtonUI(muted) {
  if (!audioMuteBtnEl) return;
  audioMuteBtnEl.textContent = muted ? "🔇" : "🔊";
  audioMuteBtnEl.setAttribute("aria-label", muted ? "Ativar som" : "Desativar som");
  audioMuteBtnEl.classList.toggle("is-muted", muted);
}

// ==========================================
// 7. TELA DE INÍCIO ("JOGAR" / "HABILIDADES")
// ==========================================
export function showStartScreen(isRestart) {
  hidePauseModal();
  if (!startScreenModal) return;
  if (startFragValEl) {
    startFragValEl.textContent = getFragments();
  }
  if (startPlayBtn) {
    startPlayBtn.textContent = isRestart ? "JOGAR NOVAMENTE" : "JOGAR";
  }
  startScreenModal.style.display = "flex";
}

export function hideStartScreen() {
  if (startScreenModal) startScreenModal.style.display = "none";
}

// ==========================================
// 8. TELA DA ÁRVORE DE HABILIDADES PERMANENTE
// ==========================================
export function showSkillTreeModal() {
  if (!skillsTreeModal || !skillsTreeContent) return;
  renderSkillTreeUI(skillsTreeContent, function () {
    if (startFragValEl) startFragValEl.textContent = getFragments();
  });
  skillsTreeModal.style.display = "flex";
}

export function hideSkillTreeModal() {
  if (skillsTreeModal) skillsTreeModal.style.display = "none";
}

// ==========================================
// 9. MODAL DE FIM DE JOGO COM FRAGMENTOS
// ==========================================
export function showGameOverModal() {
  hidePauseModal();
  if (!gameoverModal) return;
  if (finalKillsEl) finalKillsEl.textContent = state.killsCount || 0;
  if (finalWavesEl) finalWavesEl.textContent = state.currentWave || 1;
  if (finalLevelEl) finalLevelEl.textContent = state.playerLevel || 1;
  if (finalTimeEl) {
    var survivedSec = Math.floor((Date.now() - (state.gameStartTime || Date.now())) / 1000);
    finalTimeEl.textContent = survivedSec + "s";
  }

  // Calcula os fragmentos obtidos nesta partida
  var earnedFragments = calculateRunFragments(state.currentWave || 1, state.killsCount || 0);
  addFragments(earnedFragments);

  if (gameoverFragBlockEl) {
    gameoverFragBlockEl.innerHTML =
      '<div class="gameover-frag-card">' +
        '<div class="gameover-frag-row">' +
          '<span class="gameover-frag-icon">💎</span>' +
          '<span class="gameover-frag-earned">+' + earnedFragments + ' Fragmentos</span>' +
        '</div>' +
        '<div class="gameover-frag-total">Total acumulado: ' + getFragments() + ' 💎</div>' +
      '</div>';
  }

  gameoverModal.style.display = "flex";
}

export function hideGameOverModal() {
  if (gameoverModal) gameoverModal.style.display = "none";
}

// ==========================================
// 10. MODAL E CONTROLE DO MENU DE PAUSA
// ==========================================
function formatSurvivalTime(seconds) {
  var mins = Math.floor(seconds / 60);
  var secs = seconds % 60;
  return (mins < 10 ? "0" : "") + mins + ":" + (secs < 10 ? "0" : "") + secs;
}

export function showPauseModal() {
  if (!pauseModal) return;
  if (!state.gameStarted || state.isGameOver || state.isLevelUpPaused) return;

  state.isPaused = true;
  state.pauseStartTime = Date.now();
  document.body.classList.add("game-paused");

  // Atenua áudio de ambiente
  if (state.attenuateAmbience) {
    state.attenuateAmbience(true);
  }

  // Desativa joystick imediatamente
  state.joyTouchId = null;
  state.isJoystickActive = false;
  state.joyX = 0;
  state.joyY = 0;
  var knob = document.getElementById("joystick-knob");
  if (knob) knob.style.transform = "translate(0px, 0px)";

  // Atualiza dados e estatísticas no painel de status da run
  var elapsedSec = Math.max(0, Math.floor((Date.now() - (state.gameStartTime || Date.now())) / 1000));
  if (pauseTimeValEl) pauseTimeValEl.textContent = formatSurvivalTime(elapsedSec);
  if (pauseWaveValEl) pauseWaveValEl.textContent = state.currentWave || 1;
  if (pauseLevelValEl) pauseLevelValEl.textContent = "Nv. " + (state.playerLevel || 1);
  if (pauseKillsValEl) pauseKillsValEl.textContent = (state.killsCount || 0) + " 💀";

  // Fragmentos acumulados nesta run
  var earnedFrags = calculateRunFragments(state.currentWave || 1, state.killsCount || 0);
  if (pauseFragsValEl) pauseFragsValEl.textContent = "+" + earnedFrags + " 🔷";

  pauseModal.style.display = "flex";
}

export function hidePauseModal() {
  if (pauseModal) {
    pauseModal.style.display = "none";
  }
  document.body.classList.remove("game-paused");

  // Congelamento de tempo: compensa o tempo decorrido durante a pausa para que nenhum temporizador avance
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

  // Restaura áudio de ambiente
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
// 10. INICIALIZAÇÃO DO HUD E ELEMENTOS DE UI
// ==========================================
export function initHUD() {
  if (state.hudInitialized) {
    updateHpUI();
    updateStaminaUI();
    updateCompactPill();
    updateWeaponUI();
    updateBombsUI();
    updateDroneIndicatorUI();
    return;
  }
  state.hudInitialized = true;

  // Limpa elementos obsoletos
  var oldDashContainer = document.getElementById("dash-btn-container");
  if (oldDashContainer) oldDashContainer.remove();

  var hintPills = document.querySelectorAll(".hint-pill");
  hintPills.forEach(function (el) { el.remove(); });

  var oldCrosshair = document.getElementById("target-crosshair");
  if (oldCrosshair) oldCrosshair.remove();

  var oldDronePill = document.getElementById("drone-pill");
  if (oldDronePill) oldDronePill.remove();

  var oldZoomBtn = document.getElementById("cam-zoom-btn");
  if (oldZoomBtn) oldZoomBtn.remove();

  // Garante que o elemento de clarão branco da bomba exista
  var whiteFlashEl = document.getElementById("white-flash");
  if (!whiteFlashEl) {
    whiteFlashEl = document.createElement("div");
    whiteFlashEl.id = "white-flash";
    whiteFlashEl.className = "white-flash";
    document.body.appendChild(whiteFlashEl);
  }

  // Cria o botão de Bomba no lugar da antiga lupa no bottom-bar
  var bombBtn = document.getElementById("btn-bomb");
  if (!bombBtn) {
    var bottomBar = document.querySelector(".bottom-bar");
    var rightControls = bottomBar ? (bottomBar.children[1] || bottomBar) : document.body;
    bombBtn = document.createElement("button");
    bombBtn.id = "btn-bomb";
    bombBtn.className = "btn-bomb";
    bombBtn.setAttribute("title", "Lançar Bomba de Área [B]");
    bombBtn.innerHTML =
      '<span class="bomb-icon">💣</span>' +
      '<span class="bomb-badge" id="bomb-badge">' + (state.bombsCount !== undefined ? state.bombsCount : 2) + '</span>';

    bombBtn.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      e.stopPropagation();
      state.combat?.triggerBomb?.();
    });

    rightControls.appendChild(bombBtn);
  }

  // Cria o indicador estático e discreto do Drone Permanente
  var droneIndicator = document.getElementById("drone-indicator");
  if (!droneIndicator) {
    droneIndicator = document.createElement("div");
    droneIndicator.id = "drone-indicator";
    droneIndicator.className = "drone-indicator";
    droneIndicator.style.display = "none";
    var uiOverlay = document.getElementById("ui-overlay") || document.body;
    uiOverlay.appendChild(droneIndicator);
  }

  // Constrói Anéis Circulares e Pílula Compacta na Top Bar
  var topBar = document.querySelector(".top-bar");
  if (topBar) {
    topBar.innerHTML = "";

    // Linha Principal Superior: Anéis de status na esquerda e Estatísticas/Som na direita
    var mainRow = document.createElement("div");
    mainRow.className = "top-bar-main-row";

    var ringsGroup = document.createElement("div");
    ringsGroup.className = "rings-group";
    ringsGroup.id = "rings-group";

    // ANEL 1: VIDA
    var hpWrap = document.createElement("div");
    hpWrap.className = "ring-container ring-hp";
    hpWrap.id = "hp-ring-container";
    hpWrap.innerHTML =
      '<svg class="ring-svg" viewBox="0 0 40 40">' +
        '<circle class="ring-bg" cx="20" cy="20" r="16"></circle>' +
        '<circle class="ring-progress ring-progress-hp" id="hp-ring-progress" cx="20" cy="20" r="16"></circle>' +
      '</svg>' +
      '<div class="ring-icon ring-icon-hp">' +
        '<svg viewBox="0 0 24 24" width="16" height="16">' +
          '<path fill="#ffffff" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>' +
        '</svg>' +
      '</div>';
    ringsGroup.appendChild(hpWrap);

    // ANEL 2: STAMINA
    var staminaWrap = document.createElement("div");
    staminaWrap.className = "ring-container ring-stamina";
    staminaWrap.id = "stamina-ring-container";
    staminaWrap.innerHTML =
      '<svg class="ring-svg" viewBox="0 0 40 40">' +
        '<circle class="ring-bg" cx="20" cy="20" r="16"></circle>' +
        '<circle class="ring-progress ring-progress-stamina" id="stamina-ring-progress" cx="20" cy="20" r="16"></circle>' +
      '</svg>' +
      '<div class="ring-icon ring-icon-stamina">' +
        '<svg viewBox="0 0 24 24" width="16" height="16">' +
          '<path fill="#ffffff" d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>' +
        '</svg>' +
      '</div>';
    ringsGroup.appendChild(staminaWrap);
    mainRow.appendChild(ringsGroup);

    // Estatísticas Compactas, Áudio e Barra de Equipamentos (Canto Superior Direito)
    var statsCompactContainer = document.createElement("div");
    statsCompactContainer.className = "stats-compact-container";

    var statsTopRow = document.createElement("div");
    statsTopRow.className = "stats-top-row";

    var compactPill = document.createElement("div");
    compactPill.className = "compact-pill";
    compactPill.id = "compact-stats-pill";
    compactPill.innerHTML =
      '<span class="pill-item" id="pill-wave">Onda 1</span>' +
      '<span class="pill-dot">•</span>' +
      '<span class="pill-item" id="pill-kills">0 💀</span>' +
      '<span class="pill-dot">•</span>' +
      '<span class="pill-item" id="pill-level">N1</span>' +
      '<span class="pill-dot">•</span>' +
      '<span class="pill-item" id="pill-xp">0/120</span>' +
      '<span class="pill-dot">•</span>' +
      '<span class="pill-item" id="biome-display" style="color: #e2e8f0;">🏙️ Subúrbio</span>';
    statsTopRow.appendChild(compactPill);

    var fpsEl = document.createElement("div");
    fpsEl.className = "fps-tiny";
    fpsEl.id = "fps-counter";
    fpsEl.textContent = "60 FPS";
    statsTopRow.appendChild(fpsEl);

    // Botão de Alternância de Som (Mudo)
    var muteBtn = document.createElement("button");
    muteBtn.className = "audio-mute-btn";
    muteBtn.id = "audio-mute-btn";
    muteBtn.textContent = isMuted() ? "🔇" : "🔊";
    muteBtn.title = "Alternar Áudio";
    muteBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      var nowMuted = toggleMute();
      updateMuteButtonUI(nowMuted);
    });
    statsTopRow.appendChild(muteBtn);

    // Botão de Pausa no Topo Direito
    var pauseBtn = document.createElement("button");
    pauseBtn.className = "pause-btn";
    pauseBtn.id = "pause-btn";
    pauseBtn.textContent = "⏸️";
    pauseBtn.title = "Pausar o jogo (Esc ou P)";
    pauseBtn.setAttribute("aria-label", "Pausar jogo");
    pauseBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      e.preventDefault();
      togglePauseGame();
    });
    statsTopRow.appendChild(pauseBtn);
    pauseBtnEl = pauseBtn;

    statsCompactContainer.appendChild(statsTopRow);

    // Barra Permanente de Equipamentos: 3 Módulos + 4 Passivos
    var equipmentSlotsBar = document.createElement("div");
    equipmentSlotsBar.className = "equipment-slots-bar";
    equipmentSlotsBar.id = "equipment-slots-bar";
    equipmentSlotsBar.innerHTML =
      '<div class="slots-section slots-section-modules" title="Módulos Equipados (3 slots)">' +
        '<span class="slots-header-tag mod-tag">MOD</span>' +
        '<div class="slot-box slot-module empty" id="mod-slot-0"></div>' +
        '<div class="slot-box slot-module empty" id="mod-slot-1"></div>' +
        '<div class="slot-box slot-module empty" id="mod-slot-2"></div>' +
      '</div>' +
      '<div class="slots-divider"></div>' +
      '<div class="slots-section slots-section-passives" title="Passivos Equipados (4 slots)">' +
        '<span class="slots-header-tag pas-tag">PAS</span>' +
        '<div class="slot-box slot-passive empty" id="pas-slot-0"></div>' +
        '<div class="slot-box slot-passive empty" id="pas-slot-1"></div>' +
        '<div class="slot-box slot-passive empty" id="pas-slot-2"></div>' +
        '<div class="slot-box slot-passive empty" id="pas-slot-3"></div>' +
      '</div>';
    statsCompactContainer.appendChild(equipmentSlotsBar);

    mainRow.appendChild(statsCompactContainer);
    topBar.appendChild(mainRow);

    // Sub-linha: Armas e Minas (abaixo dos anéis, alinhado à esquerda)
    var subRow = document.createElement("div");
    subRow.className = "top-bar-sub-row";

    var weaponsContainer = document.createElement("div");
    weaponsContainer.className = "weapons-hud-container";
    weaponsContainer.id = "weapons-hud-container";

    var weaponPill = document.createElement("div");
    weaponPill.className = "weapon-pill";
    weaponPill.id = "weapon-hud-pill";
    weaponPill.innerHTML =
      '<span class="weapon-icon" id="weapon-icon">🔫</span>' +
      '<span class="weapon-name" id="weapon-name">Pistola</span>' +
      '<span class="weapon-ammo-badge infinite" id="weapon-ammo">∞</span>';
    weaponsContainer.appendChild(weaponPill);

    var devicePill = document.createElement("div");
    devicePill.className = "device-pill";
    devicePill.id = "device-hud-pill";
    devicePill.innerHTML =
      '<span class="device-icon">💣</span>' +
      '<span class="device-count" id="device-count">0</span>';
    weaponsContainer.appendChild(devicePill);

    subRow.appendChild(weaponsContainer);
    topBar.appendChild(subRow);
  }

  // Captura referências aos elementos criados
  hpRingContainer = document.getElementById("hp-ring-container");
  hpRingProgress = document.getElementById("hp-ring-progress");
  staminaRingContainer = document.getElementById("stamina-ring-container");
  staminaRingProgress = document.getElementById("stamina-ring-progress");

  compactPillEl = document.getElementById("compact-stats-pill");
  pillWaveEl = document.getElementById("pill-wave");
  pillKillsEl = document.getElementById("pill-kills");
  pillLevelEl = document.getElementById("pill-level");
  pillXpEl = document.getElementById("pill-xp");
  biomeDisplayEl = document.getElementById("biome-display");
  fpsCounterEl = document.getElementById("fps-counter");
  audioMuteBtnEl = document.getElementById("audio-mute-btn");

  weaponPillEl = document.getElementById("weapon-hud-pill");
  weaponIconEl = document.getElementById("weapon-icon");
  weaponNameEl = document.getElementById("weapon-name");
  weaponAmmoEl = document.getElementById("weapon-ammo");
  devicePillEl = document.getElementById("device-hud-pill");
  deviceCountEl = document.getElementById("device-count");

  var uiOverlay = document.getElementById("ui-overlay");
  weaponToastEl = document.getElementById("weapon-toast");
  if (!weaponToastEl && uiOverlay) {
    weaponToastEl = document.createElement("div");
    weaponToastEl.id = "weapon-toast";
    uiOverlay.appendChild(weaponToastEl);
  }

  lowHpVignetteEl = document.getElementById("low-hp-vignette");
  damageFlashEl = document.getElementById("damage-flash");
  levelFlashEl = document.getElementById("level-flash");
  bossHudEl = document.getElementById("boss-hud");
  bossHpValEl = document.getElementById("boss-hp-val");
  bossHpFillEl = document.getElementById("boss-hp-fill");
  bigAnnouncerEl = document.getElementById("big-announcer");
  bigWaveTitleEl = document.getElementById("big-wave-title");
  bigWaveSubEl = document.getElementById("big-wave-sub");
  frenzyPillEl = document.getElementById("frenzy-pill");
  frenzyTimerValEl = document.getElementById("frenzy-timer-val");
  levelupModal = document.getElementById("levelup-modal");
  upgradeCardsGrid = document.getElementById("upgrade-cards-grid");

  // Customização do Game Over Modal para suportar exibição de fragmentos e retorno ao menu
  gameoverModal = document.getElementById("gameover-modal");
  finalKillsEl = document.getElementById("final-kills");
  finalWavesEl = document.getElementById("final-waves");
  finalLevelEl = document.getElementById("final-level");
  finalTimeEl = document.getElementById("final-time");

  if (gameoverModal) {
    var goCard = gameoverModal.querySelector(".gameover-card");
    if (goCard) {
      gameoverFragBlockEl = document.getElementById("gameover-frag-block");
      if (!gameoverFragBlockEl) {
        gameoverFragBlockEl = document.createElement("div");
        gameoverFragBlockEl.id = "gameover-frag-block";
        var statsEl = goCard.querySelector(".gameover-stats");
        if (statsEl) {
          goCard.insertBefore(gameoverFragBlockEl, statsEl.nextSibling);
        } else {
          goCard.appendChild(gameoverFragBlockEl);
        }
      }

      // Adiciona botão "HABILIDADES & MENU" ao lado do botão de reiniciar
      var actionsRow = goCard.querySelector(".gameover-actions-row");
      if (!actionsRow) {
        actionsRow = document.createElement("div");
        actionsRow.className = "gameover-actions-row";

        var oldBtn = goCard.querySelector("#restart-btn");
        if (oldBtn) oldBtn.remove();

        actionsRow.innerHTML =
          '<button class="gameover-restart-btn" id="restart-btn">JOGAR NOVAMENTE</button>' +
          '<button class="gameover-menu-btn" id="gameover-menu-btn">HABILIDADES & MENU</button>';
        goCard.appendChild(actionsRow);

        var newRestartBtn = actionsRow.querySelector("#restart-btn");
        newRestartBtn.addEventListener("click", function (e) {
          if (e) { e.preventDefault(); e.stopPropagation(); }
          hideGameOverModal();
          if (state.resetGame) {
            state.resetGame();
          } else if (state.progression && state.progression.restartGame) {
            state.progression.restartGame();
          }
        });

        var menuBtn = actionsRow.querySelector("#gameover-menu-btn");
        menuBtn.addEventListener("click", function (e) {
          if (e) { e.preventDefault(); e.stopPropagation(); }
          hideGameOverModal();
          showStartScreen(true);
        });
      }
    }
  }

  // CRIAÇÃO DA TELA DE INÍCIO (START SCREEN)
  startScreenModal = document.getElementById("start-screen-modal");
  if (!startScreenModal) {
    startScreenModal = document.createElement("div");
    startScreenModal.id = "start-screen-modal";
    startScreenModal.className = "start-screen-overlay";
    startScreenModal.innerHTML =
      '<div class="start-screen-card">' +
        '<div class="start-logo-badge">LITTLE PLANET 3D</div>' +
        '<h1 class="start-title">APOCALIPSE ZUMBI</h1>' +
        '<p class="start-subtitle">Sobreviva às hordas e expanda seu arsenal no relevo dinâmico do planeta.</p>' +
        '<div class="start-fragments-pill">' +
          '<span class="start-frag-icon">💎</span>' +
          '<span class="start-frag-count" id="start-frag-count">' + getFragments() + '</span>' +
          '<span class="start-frag-text">Fragmentos Disponíveis</span>' +
        '</div>' +
        '<div class="start-actions-group">' +
          '<button class="start-play-btn" id="start-play-btn">JOGAR</button>' +
          '<button class="start-skills-btn" id="start-skills-btn">⚡ HABILIDADES</button>' +
        '</div>' +
        '<div class="start-audio-note">' +
          '<span>🔊 Efeitos sonoros gerados via Web Audio API pura</span>' +
        '</div>' +
      '</div>';
    document.body.appendChild(startScreenModal);

    startPlayBtn = startScreenModal.querySelector("#start-play-btn");
    startSkillsBtn = startScreenModal.querySelector("#start-skills-btn");
    startFragValEl = startScreenModal.querySelector("#start-frag-count");

    startPlayBtn.addEventListener("click", function (e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      hideStartScreen();
      if (state.onUserStartGame) {
        state.onUserStartGame();
      } else if (state.resetGame) {
        state.resetGame();
      }
    });

    startSkillsBtn.addEventListener("click", function () {
      showSkillTreeModal();
    });
  }

  // CRIAÇÃO DO MODAL DA ÁRVORE DE HABILIDADES PERMANENTE
  skillsTreeModal = document.getElementById("skills-tree-modal");
  if (!skillsTreeModal) {
    skillsTreeModal = document.createElement("div");
    skillsTreeModal.id = "skills-tree-modal";
    skillsTreeModal.className = "skills-tree-overlay";
    skillsTreeModal.innerHTML =
      '<div class="skills-tree-modal-card">' +
        '<button class="skills-tree-close-btn" id="skills-tree-close-btn" title="Voltar">✕</button>' +
        '<div class="skills-tree-scroll-container" id="skills-tree-scroll-container"></div>' +
      '</div>';
    document.body.appendChild(skillsTreeModal);

    skillsTreeContent = skillsTreeModal.querySelector("#skills-tree-scroll-container");
    skillsTreeCloseBtn = skillsTreeModal.querySelector("#skills-tree-close-btn");

    skillsTreeCloseBtn.addEventListener("click", function () {
      hideSkillTreeModal();
      if (startFragValEl) startFragValEl.textContent = getFragments();
    });
  }

  // CRIAÇÃO DO MODAL DE MENU DE PAUSA (PAUSE OVERLAY)
  pauseModal = document.getElementById("pause-modal");
  if (!pauseModal) {
    pauseModal = document.createElement("div");
    pauseModal.id = "pause-modal";
    pauseModal.className = "pause-overlay";
    pauseModal.innerHTML =
      '<div class="pause-card">' +
        '<div class="pause-badge">MODO DE PAUSA</div>' +
        '<h2 class="pause-title">Pausado</h2>' +
        '<p class="pause-subtitle">Partida suspensa. Consulte seu progresso ou escolha uma ação.</p>' +
        '<div class="pause-stats-grid">' +
          '<div class="pause-stat-box span-2">' +
            '<span class="pause-stat-label">Onda Atual</span>' +
            '<span class="pause-stat-val cyan" id="pause-stat-wave">1</span>' +
          '</div>' +
          '<div class="pause-stat-box span-2">' +
            '<span class="pause-stat-label">Nível</span>' +
            '<span class="pause-stat-val" id="pause-stat-level">Nv. 1</span>' +
          '</div>' +
          '<div class="pause-stat-box span-2">' +
            '<span class="pause-stat-label">Total de Abates</span>' +
            '<span class="pause-stat-val" id="pause-stat-kills">0 💀</span>' +
          '</div>' +
          '<div class="pause-stat-box span-3">' +
            '<span class="pause-stat-label">Tempo de Sobrevivência</span>' +
            '<span class="pause-stat-val" id="pause-stat-time">00:00</span>' +
          '</div>' +
          '<div class="pause-stat-box span-3">' +
            '<span class="pause-stat-label">Fragmentos Acumulados</span>' +
            '<span class="pause-stat-val gold" id="pause-stat-frags">+0 🔷</span>' +
          '</div>' +
        '</div>' +
        '<div class="pause-actions-col">' +
          '<button class="pause-action-btn pause-resume-btn" id="btn-pause-resume" title="Continuar partida">' +
            '<span class="btn-icon">▶️</span>' +
            '<span class="btn-text">Continuar</span>' +
          '</button>' +
          '<button class="pause-action-btn pause-restart-btn" id="btn-pause-restart" title="Reiniciar partida">' +
            '<span class="btn-icon">🔄</span>' +
            '<span class="btn-text">Reiniciar Partida</span>' +
          '</button>' +
          '<button class="pause-action-btn pause-skills-btn" id="btn-pause-skills" title="Ver árvore de habilidades">' +
            '<span class="btn-icon">🌳</span>' +
            '<span class="btn-text">Ver Habilidades</span>' +
          '</button>' +
          '<button class="pause-action-btn pause-menu-btn" id="btn-pause-menu" title="Voltar à tela inicial">' +
            '<span class="btn-icon">🏠</span>' +
            '<span class="btn-text">Voltar ao Início</span>' +
          '</button>' +
        '</div>' +
        '<div class="pause-hotkey-footer">' +
          'Pressione <kbd>ESC</kbd> ou <kbd>P</kbd> para alternar a pausa' +
        '</div>' +
      '</div>';
    document.body.appendChild(pauseModal);
  }

  pauseTimeValEl = pauseModal.querySelector("#pause-stat-time");
  pauseWaveValEl = pauseModal.querySelector("#pause-stat-wave");
  pauseKillsValEl = pauseModal.querySelector("#pause-stat-kills");
  pauseLevelValEl = pauseModal.querySelector("#pause-stat-level");
  pauseFragsValEl = pauseModal.querySelector("#pause-stat-frags");

  var btnResume = pauseModal.querySelector("#btn-pause-resume");
  if (btnResume) {
    btnResume.addEventListener("click", function (e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      hidePauseModal();
    });
  }

  var btnRestart = pauseModal.querySelector("#btn-pause-restart");
  if (btnRestart) {
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
  if (btnSkills) {
    btnSkills.addEventListener("click", function (e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      showSkillTreeModal();
    });
  }

  var btnMenu = pauseModal.querySelector("#btn-pause-menu");
  if (btnMenu) {
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
  state.ui.updateMuteButtonUI = updateMuteButtonUI;
  state.ui.showStartScreen = showStartScreen;
  state.ui.hideStartScreen = hideStartScreen;
  state.ui.showPauseModal = showPauseModal;
  state.ui.hidePauseModal = hidePauseModal;
  state.ui.togglePauseGame = togglePauseGame;
  state.ui.showSkillTreeModal = showSkillTreeModal;
  state.ui.hideSkillTreeModal = hideSkillTreeModal;
  state.ui.updateBombsUI = updateBombsUI;
  state.ui.updateDroneIndicatorUI = updateDroneIndicatorUI;
  state.ui.showDroneSelectionModal = showDroneSelectionModal;
  state.ui.updateBiomeUI = updateBiomeUI;
  state.ui.updateEquipmentSlotsUI = updateEquipmentSlotsUI;

  updateHpUI();
  updateStaminaUI();
  updateCompactPill();
  updateWeaponUI();
  updateBombsUI();
  updateDroneIndicatorUI();
  updateEquipmentSlotsUI();
  updateMuteButtonUI(isMuted());
}

// ==========================================
// 11. ATUALIZAÇÃO CONTÍNUA DO HUD
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

// ==========================================
// 12. ATUALIZAÇÃO DO BIOMA NO HUD
// ==========================================
export function updateBiomeUI(icon, name, color) {
  if (!biomeDisplayEl) {
    biomeDisplayEl = document.getElementById("biome-display");
  }
  if (biomeDisplayEl) {
    biomeDisplayEl.textContent = (icon ? icon + " " : "") + (name || "");
    if (color) {
      biomeDisplayEl.style.color = color;
    }
  }
}

