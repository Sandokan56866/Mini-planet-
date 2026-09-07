// O que faz: Gerencia a progressão permanente (Meta Progressão), fragmentos obtidos ao fim de jogo e a árvore de habilidades.
// Três ramos (Sobrevivência, Armamento e Fortuna) com 4 níveis cada, melhorando o COMEÇO da partida sem alterar o teto das cartas.
// Exporta: initMetaSystem, getFragments, addFragments, calculateRunFragments, getMetaUpgrades, getSkillLevel, buySkillUpgrade,
// resetMetaProgress, applyMetaToGameStart, renderSkillTreeUI.
// Depende de: js/config.js, js/state.js

import {
  META_STORAGE_KEY,
  META_FRAGMENTS_BASE,
  META_FRAGMENTS_PER_WAVE,
  META_FRAGMENTS_KILLS_DIVISOR,
  META_SKILL_BRANCHES,
  INITIAL_MAX_HP,
  WEAPONS_CONFIG,
  BASE_PISTOL_DAMAGE,
  BASE_PISTOL_FIRE_RATE,
  setStaminaRegenRate,
  STAMINA_REGEN_RATE
} from "../config.js";
import { state } from "../state.js";

// ==========================================
// 1. ESTADO PERSISTENTE DA META PROGRESSÃO
// ==========================================
var metaData = {
  fragments: 0,
  totalEarned: 0,
  upgrades: {
    // Sobrevivência
    maxHp: 0,
    hpRegen: 0,
    staminaRegen: 0,
    damageReduction: 0,
    // Armamento
    pistolDamage: 0,
    fireRate: 0,
    startingTempWeapon: 0,
    startingMines: 0,
    // Fortuna
    magnetRadius: 0,
    xpBonus: 0,
    betterChests: 0,
    extraStartingCard: 0
  }
};

var isStorageAvailable = true;

// ==========================================
// 2. CARREGAMENTO E SALVAMENTO SEGURO
// ==========================================
export function initMetaSystem() {
  try {
    var raw = localStorage.getItem(META_STORAGE_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (typeof parsed.fragments === "number") metaData.fragments = parsed.fragments;
      if (typeof parsed.totalEarned === "number") metaData.totalEarned = parsed.totalEarned;
      if (parsed.upgrades && typeof parsed.upgrades === "object") {
        for (var k in metaData.upgrades) {
          if (typeof parsed.upgrades[k] === "number") {
            metaData.upgrades[k] = Math.max(0, Math.min(4, parsed.upgrades[k]));
          }
        }
      }
    }
  } catch (err) {
    isStorageAvailable = false;
    console.warn("Armazenamento local desativado ou indisponível. O progresso será mantido apenas na sessão atual.", err);
  }

  // Compartilha no state global para leitura simplificada
  state.meta = {
    getFragments: getFragments,
    addFragments: addFragments,
    calculateRunFragments: calculateRunFragments,
    applyMetaToGameStart: applyMetaToGameStart,
    getSkillLevel: getSkillLevel
  };

  return metaData;
}

function saveMetaState() {
  if (!isStorageAvailable) return;
  try {
    localStorage.setItem(META_STORAGE_KEY, JSON.stringify(metaData));
  } catch (err) {
    console.warn("Falha ao persistir dados de meta-progressão no localStorage:", err);
  }
}

export function getFragments() {
  return metaData.fragments;
}

export function addFragments(amount) {
  if (typeof amount !== "number" || amount <= 0) return 0;
  metaData.fragments += amount;
  metaData.totalEarned += amount;
  saveMetaState();
  return metaData.fragments;
}

// Cálculo da recompensa de fragmentos ao final da partida
// Garante que mesmo morrer cedo ainda rende algo útil
export function calculateRunFragments(wave, kills) {
  var w = Math.max(1, wave || 1);
  var k = Math.max(0, kills || 0);

  var fromBase = META_FRAGMENTS_BASE;
  var fromWave = (w - 1) * META_FRAGMENTS_PER_WAVE;
  var fromKills = Math.floor(k / META_FRAGMENTS_KILLS_DIVISOR);

  var total = fromBase + fromWave + fromKills;
  return Math.max(META_FRAGMENTS_BASE, total);
}

export function getMetaUpgrades() {
  return metaData.upgrades;
}

export function getSkillLevel(skillId) {
  return metaData.upgrades[skillId] || 0;
}

// Compra de nível de habilidade
export function buySkillUpgrade(skillId) {
  var currentLvl = getSkillLevel(skillId);
  if (currentLvl >= 4) return { success: false, reason: "max_level" };

  // Localiza a configuração da habilidade
  var skillCfg = null;
  for (var b = 0; b < META_SKILL_BRANCHES.length; b++) {
    var branch = META_SKILL_BRANCHES[b];
    for (var s = 0; s < branch.skills.length; s++) {
      if (branch.skills[s].id === skillId) {
        skillCfg = branch.skills[s];
        break;
      }
    }
    if (skillCfg) break;
  }

  if (!skillCfg) return { success: false, reason: "invalid_skill" };

  var cost = skillCfg.costs[currentLvl];
  if (metaData.fragments < cost) {
    return { success: false, reason: "not_enough_fragments", cost: cost };
  }

  metaData.fragments -= cost;
  metaData.upgrades[skillId] = currentLvl + 1;
  saveMetaState();

  return { success: true, newLevel: metaData.upgrades[skillId], remainingFragments: metaData.fragments };
}

// Redefinição de todo o progresso (com reembolso opcional ou reset puro)
export function resetMetaProgress() {
  metaData.fragments = metaData.totalEarned; // Devolve todos os fragmentos já conquistados para reinvestimento!
  for (var k in metaData.upgrades) {
    metaData.upgrades[k] = 0;
  }
  saveMetaState();
  return metaData.fragments;
}

// ==========================================
// 3. APLICAÇÃO DOS EFEITOS NA PARTIDA (APENAS NO INÍCIO)
// ==========================================
export function applyMetaToGameStart() {
  var upg = metaData.upgrades;

  // 1. Sobrevivência
  var hpBonusPct = upg.maxHp * 0.08; // +8% por nível (máx +32%)
  var calculatedMaxHp = Math.round(INITIAL_MAX_HP * (1.0 + hpBonusPct));
  state.maxPlayerHp = calculatedMaxHp;
  state.playerHp = calculatedMaxHp;

  // Regeneração passiva lenta de vida (+0.25 HP/s por nível, máx 1.0 HP/s)
  var hpRegenRate = upg.hpRegen * 0.25;

  // Regeneração de stamina (+8% por nível)
  var staminaRegenMult = 1.0 + (upg.staminaRegen * 0.08);
  if (setStaminaRegenRate) {
    setStaminaRegenRate(18.0 * staminaRegenMult);
  }

  // Redução de dano recebido (-3% por nível, máx 12%)
  var damageReduction = Math.min(0.12, upg.damageReduction * 0.03);

  // Instalação de mitigação de dano sem violar a integridade de entities/enemies.js
  var currentRawHp = state.playerHp;
  Object.defineProperty(state, "playerHp", {
    get: function () {
      return currentRawHp;
    },
    set: function (newVal) {
      if (newVal < currentRawHp && damageReduction > 0) {
        var dmg = currentRawHp - newVal;
        var mitigatedDmg = dmg * (1.0 - damageReduction);
        currentRawHp = Math.max(0, currentRawHp - mitigatedDmg);
      } else {
        currentRawHp = newVal;
      }
    },
    configurable: true
  });

  // 2. Armamento
  // Dano inicial da pistola (+8% por nível)
  var pistolDmgMultiplier = 1.0 + (upg.pistolDamage * 0.08);
  if (WEAPONS_CONFIG.pistol) {
    WEAPONS_CONFIG.pistol.damage = Math.round((BASE_PISTOL_DAMAGE || 1) * pistolDmgMultiplier);
    // Cadência inicial (+6% por nível)
    var fireRateMult = 1.0 + (upg.fireRate * 0.06);
    WEAPONS_CONFIG.pistol.fireRate = (BASE_PISTOL_FIRE_RATE || 0.32) / fireRateMult;
  }

  // Número inicial de minas (+1 por nível além das 3 padrão)
  state.playerMinesCount = 3 + (upg.startingMines || 0);

  // Chance de começar com arma temporária (5% por nível, até 20% no nível 4)
  var startingTempChance = upg.startingTempWeapon * 0.05;
  if (startingTempChance > 0 && Math.random() < startingTempChance) {
    var candidateWeapons = ["shotgun", "machinegun", "rifle"];
    var chosenWeapon = candidateWeapons[Math.floor(Math.random() * candidateWeapons.length)];
    var wCfg = WEAPONS_CONFIG[chosenWeapon];
    if (wCfg) {
      state.temporaryWeapon = chosenWeapon;
      state.currentWeapon = chosenWeapon;
      state.temporaryWeaponAmmo = Math.round(wCfg.maxAmmo * 0.75); // 75% do pente inicial
      setTimeout(function () {
        state.ui?.showWeaponNotification?.("🎁 Bônus de Armamento: " + wCfg.name + " equipada!");
        state.ui?.updateWeaponUI?.();
      }, 800);
    }
  }

  // 3. Fortuna
  // Raio inicial de atração de XP (+10% por nível)
  var magnetBonus = upg.magnetRadius * 0.10;

  // XP bônus por abate (+8% por nível)
  var xpMultiplier = 1.0 + (upg.xpBonus * 0.08);

  // Chance de caixas melhores (+10% por nível)
  var betterChestsChance = upg.betterChests * 0.10;

  // Carta de melhoria extra na primeira subida de nível
  var extraStartingCard = upg.extraStartingCard >= 1;
  state.firstLevelUpDone = false;

  // Guarda bônus consolidados no state
  state.metaBonus = {
    hpRegen: hpRegenRate,
    damageReduction: damageReduction,
    magnetRadiusBonus: magnetBonus,
    xpBonus: xpMultiplier,
    betterChestsChance: betterChestsChance,
    extraStartingCard: extraStartingCard
  };
}

// ==========================================
// 4. RENDERIZAÇÃO DA TELA DA ÁRVORE (UI)
// ==========================================
export function renderSkillTreeUI(containerEl, onUpgradeCallback) {
  if (!containerEl) return;
  containerEl.innerHTML = "";

  var header = document.createElement("div");
  header.className = "meta-tree-header";
  header.innerHTML =
    '<div class="meta-tree-title-group">' +
      '<div class="meta-tree-badge">HABILIDADES PERMANENTES</div>' +
      '<h2 class="meta-tree-title">Reforço de Sobrevivência</h2>' +
      '<p class="meta-tree-sub">Melhore suas condições iniciais em cada tentativa. As cartas de run mantêm o teto.</p>' +
    '</div>' +
    '<div class="meta-fragments-badge">' +
      '<span class="meta-frag-icon">💎</span>' +
      '<span class="meta-frag-val" id="meta-fragments-val">' + metaData.fragments + '</span>' +
      '<span class="meta-frag-lbl">Fragmentos</span>' +
    '</div>';
  containerEl.appendChild(header);

  var branchesContainer = document.createElement("div");
  branchesContainer.className = "meta-branches-list";

  META_SKILL_BRANCHES.forEach(function (branch) {
    var branchSection = document.createElement("div");
    branchSection.className = "meta-branch-section";

    var branchHeader = document.createElement("div");
    branchHeader.className = "meta-branch-header";
    branchHeader.innerHTML =
      '<span class="meta-branch-icon">' + branch.icon + '</span>' +
      '<div class="meta-branch-info">' +
        '<h3 class="meta-branch-name">' + branch.name + '</h3>' +
        '<span class="meta-branch-desc">' + branch.desc + '</span>' +
      '</div>';
    branchSection.appendChild(branchHeader);

    var grid = document.createElement("div");
    grid.className = "meta-nodes-grid";

    branch.skills.forEach(function (skill) {
      var currentLevel = getSkillLevel(skill.id);
      var isMax = currentLevel >= 4;
      var nextCost = isMax ? null : skill.costs[currentLevel];
      var canAfford = !isMax && metaData.fragments >= nextCost;

      var card = document.createElement("div");
      card.className = "meta-node-card" + (isMax ? " is-max" : (canAfford ? " can-buy" : " cannot-buy"));

      // Barrinhas de nível (4 pips)
      var pipsHtml = '<div class="meta-pips-row">';
      for (var p = 0; p < 4; p++) {
        pipsHtml += '<span class="meta-pip ' + (p < currentLevel ? 'active' : '') + '"></span>';
      }
      pipsHtml += '</div>';

      card.innerHTML =
        '<div class="meta-node-top">' +
          '<div class="meta-node-identity">' +
            '<span class="meta-node-icon">' + skill.icon + '</span>' +
            '<div>' +
              '<h4 class="meta-node-name">' + skill.name + '</h4>' +
              '<div class="meta-node-level-text">Nível ' + currentLevel + ' / 4</div>' +
            '</div>' +
          '</div>' +
          pipsHtml +
        '</div>' +
        '<p class="meta-node-effect">' + skill.desc + '</p>' +
        '<div class="meta-node-bottom">' +
          (isMax
            ? '<button class="meta-buy-btn maxed" disabled>NÍVEL MÁXIMO</button>'
            : '<button class="meta-buy-btn ' + (canAfford ? 'affordable' : 'locked') + '" data-skill="' + skill.id + '">' +
                '<span class="btn-text">Evoluir</span>' +
                '<span class="btn-cost">💎 ' + nextCost + '</span>' +
              '</button>') +
        '</div>';

      var buyBtn = card.querySelector(".meta-buy-btn[data-skill]");
      if (buyBtn) {
        buyBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          var res = buySkillUpgrade(skill.id);
          if (res.success) {
            state.sounds?.playChestOpenSound?.();
            renderSkillTreeUI(containerEl, onUpgradeCallback);
            if (onUpgradeCallback) onUpgradeCallback();
          } else {
            state.sounds?.playHitSound?.();
          }
        });
      }

      grid.appendChild(card);
    });

    branchSection.appendChild(grid);
    branchesContainer.appendChild(branchSection);
  });

  containerEl.appendChild(branchesContainer);

  // Rodapé com botão discreto de redefinição
  var footer = document.createElement("div");
  footer.className = "meta-tree-footer";
  footer.innerHTML =
    '<button class="meta-reset-btn" id="meta-reset-btn">' +
      '🔄 Redefinir Habilidades (Recupera todos os fragmentos)' +
    '</button>';

  var resetBtn = footer.querySelector("#meta-reset-btn");
  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      if (confirm("Deseja redefinir todas as habilidades permanentes? Todos os seus fragmentos gastos serão devolvidos para redistribuição.")) {
        resetMetaProgress();
        state.sounds?.playDeploySound?.();
        renderSkillTreeUI(containerEl, onUpgradeCallback);
        if (onUpgradeCallback) onUpgradeCallback();
      }
    });
  }

  containerEl.appendChild(footer);
}
