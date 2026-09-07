// O que faz: Gerencia a interface do jogo: anéis circulares de Vida e Stamina, pílula compacta de progresso,
// tela de início com botão JOGAR, tela de árvore de habilidades permanente, botão de mudo e tela de fim de jogo com fragmentos.
// Exporta: initHUD, updateHUD, updateHpUI, updateStaminaUI, updateXpUI, updateKillsUI, updateWaveUI, updateWaveProgressUI,
// showBigAnnouncement, triggerDamageFlash, showStartScreen, hideStartScreen, showSkillTreeModal, hideSkillTreeModal, updateMuteButtonUI, updateBiomeUI.
// Depende de: js/config.js, js/state.js, js/systems/audio.js, js/systems/meta.js

import {
  CAM_LERP_FACTOR,
  CAM_LOOKAT_OFFSET_Y,
  STAMINA_MAX,
  STAMINA_RECOVERY_MIN,
  HUD_RING_CIRCUMFERENCE,
  WEAPONS_CONFIG
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

export function updateDroneUI(remainingTime) {
  var pill = document.getElementById("drone-pill");
  var val = document.getElementById("drone-timer-val");
  if (!pill) return;

  if (remainingTime > 0) {
    pill.style.display = "inline-flex";
    pill.classList.add("active");
    if (val) val.textContent = Math.ceil(remainingTime) + "s";
  } else {
    pill.style.display = "none";
    pill.classList.remove("active");
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
// 5. MODAL DE LEVEL UP
// ==========================================
export function showLevelUpModal(cards, onSelect) {
  if (!levelupModal || !upgradeCardsGrid) return;
  upgradeCardsGrid.innerHTML = "";

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

    var btn = document.createElement("button");
    btn.className = "upgrade-card-btn";
    btn.innerHTML =
      '<div class="upg-icon-col">' + upg.icon + '</div>' +
      '<div class="upg-info-col">' +
      '<div class="upg-level-pill">Nvl ' + upg.level + ' ➔ ' + (upg.level + 1) + '</div>' +
      '<div class="upg-name">' + upg.name + '</div>' +
      '<div class="upg-desc">' + upg.desc + '</div>' +
      '</div>';

    btn.onclick = function () {
      onSelect(key);
    };
    upgradeCardsGrid.appendChild(btn);
  });

  levelupModal.style.display = "flex";
}

export function hideLevelUpModal() {
  if (levelupModal) levelupModal.style.display = "none";
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
// 10. INICIALIZAÇÃO DO HUD E ELEMENTOS DE UI
// ==========================================
export function initHUD() {
  if (state.hudInitialized) {
    updateHpUI();
    updateStaminaUI();
    updateCompactPill();
    updateWeaponUI();
    updateBombsUI();
    updateDroneUI(state.droneTimer || 0);
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

  // Cria o pill de tempo restante do Drone
  var dronePill = document.getElementById("drone-pill");
  if (!dronePill) {
    dronePill = document.createElement("div");
    dronePill.id = "drone-pill";
    dronePill.className = "drone-pill";
    dronePill.style.display = "none";
    dronePill.innerHTML =
      '<span class="drone-icon">🛸</span>' +
      '<span class="drone-text">Drone <strong id="drone-timer-val">45s</strong></span>';
    var uiOverlay = document.getElementById("ui-overlay") || document.body;
    uiOverlay.appendChild(dronePill);
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

    // Estatísticas Compactas e Áudio
    var statsCompactContainer = document.createElement("div");
    statsCompactContainer.className = "stats-compact-container";

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
    statsCompactContainer.appendChild(compactPill);

    var fpsEl = document.createElement("div");
    fpsEl.className = "fps-tiny";
    fpsEl.id = "fps-counter";
    fpsEl.textContent = "60 FPS";
    statsCompactContainer.appendChild(fpsEl);

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
    statsCompactContainer.appendChild(muteBtn);

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
  state.ui.showSkillTreeModal = showSkillTreeModal;
  state.ui.hideSkillTreeModal = hideSkillTreeModal;
  state.ui.updateBombsUI = updateBombsUI;
  state.ui.updateDroneUI = updateDroneUI;
  state.ui.updateBiomeUI = updateBiomeUI;

  updateHpUI();
  updateStaminaUI();
  updateCompactPill();
  updateWeaponUI();
  updateBombsUI();
  updateDroneUI(state.droneTimer || 0);
  updateMuteButtonUI(isMuted());
}

// ==========================================
// 11. ATUALIZAÇÃO CONTÍNUA DO HUD
// ==========================================
export function updateHUD(dt) {
  updateStaminaUI();

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

