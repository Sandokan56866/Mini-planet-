// O que faz: Ponto de entrada do jogo, inicializa Three.js, áudio procedural, meta-progressão e orquestra o loop de jogo e reinício completo (resetGame).
// Exporta: resetGame.
// Depende de: js/config.js, js/state.js, js/core/math.js, js/world/terrain.js, js/world/props.js, js/world/sky.js,
// js/entities/player.js, js/entities/enemies.js, js/systems/combat.js, js/systems/progression.js, js/systems/input.js,
// js/systems/audio.js, js/systems/meta.js, js/ui/hud.js

import {
  DEBUG_RESET,
  PLANET_BASE_RADIUS,
  SKY_BG_COLOR,
  FOG_COLOR,
  FOG_DENSITY,
  CAM_FOV,
  CAM_NEAR,
  CAM_FAR,
  BASE_CAM_DISTANCE,
  CAM_PITCH_DEFAULT,
  INITIAL_PLAYER_HP,
  INITIAL_MAX_HP,
  BASE_XP_NEEDED,
  MAX_BULLETS,
  MAX_PICKUPS,
  BULLET_BASE_SPEED,
  BULLET_MAX_LIFE,
  BULLET_COLOR_NORMAL
} from "./config.js";
import { state } from "./state.js";
import { initTerrain } from "./world/terrain.js";
import { initProps, updateProps } from "./world/props.js";
import { initSky, updateSky } from "./world/sky.js";
import { initPlayer, updatePlayer } from "./entities/player.js";
import { initEnemies, updateEnemies, spawnZombie, cleanUpEnemies } from "./entities/enemies.js";
import { initCombat, updateCombat } from "./systems/combat.js";
import { initProgression, updateProgression, getWaveTargetKills } from "./systems/progression.js";
import { initInput, updateInput } from "./systems/input.js";
import {
  initAudioSystem,
  startAmbience,
  stopAmbience,
  updateAudio,
  playShootSound,
  playHitSound,
  playEnemyDeathSound,
  playXpSound,
  playLevelUpSound,
  playChestOpenSound,
  playPlayerHurtSound,
  playBossSpawnSound,
  playExplosionSound,
  playMinePlantSound,
  playDeploySound,
  playWoodBreakSound
} from "./systems/audio.js";
import { initMetaSystem, applyMetaToGameStart } from "./systems/meta.js";
import { initHUD, updateHUD, showBigAnnouncement, showStartScreen, hideStartScreen, hideGameOverModal } from "./ui/hud.js";
import { initPickups, cleanUpPickups } from "./systems/pickups.js";

// ==========================================
// 1. INICIALIZAÇÃO DA CENA THREE.JS
// ==========================================
var canvas = document.getElementById("webgl-canvas");
var scene = new THREE.Scene();
scene.background = new THREE.Color(SKY_BG_COLOR);
scene.fog = new THREE.FogExp2(FOG_COLOR, FOG_DENSITY);

var camera = new THREE.PerspectiveCamera(CAM_FOV, window.innerWidth / window.innerHeight, CAM_NEAR, CAM_FAR);

var renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

var planetGroup = new THREE.Group();
scene.add(planetGroup);

// Conecta as referências principais ao state compartilhado
state.scene = scene;
state.camera = camera;
state.renderer = renderer;
state.canvas = canvas;
state.planetGroup = planetGroup;
state.planetQuat = new THREE.Quaternion();
state.playerLocalDir = new THREE.Vector3(0, 1, 0);
state.currentCamPos = new THREE.Vector3(0, 25, BASE_CAM_DISTANCE);
state.desiredCamPos = new THREE.Vector3();
state.currentLookTarget = new THREE.Vector3(0, 22.9, 0);
state.desiredLookTarget = new THREE.Vector3();
state.gameStartTime = Date.now();
state.gameStarted = false;

// ==========================================
// 2. CONEXÃO DE EFEITOS DE ÁUDIO NO STATE
// ==========================================
state.sounds = {
  playShootSound: playShootSound,
  playHitSound: playHitSound,
  playDashSound: playDeploySound,
  playLevelUpSound: playLevelUpSound,
  playWaveSound: playLevelUpSound,
  playBossRoarSound: playBossSpawnSound,
  playBossStepSound: playHitSound,
  playZombieHitPlayerSound: playPlayerHurtSound,
  playWeaponPickupSound: playChestOpenSound,
  playItemPickupSound: playChestOpenSound,
  playExplosionSound: playExplosionSound,
  playMinePlantSound: playMinePlantSound,
  playDeploySound: playDeploySound,
  playWoodBreakSound: playWoodBreakSound,
  playXpSound: playXpSound,
  playChestOpenSound: playChestOpenSound,
  playPlayerHurtSound: playPlayerHurtSound,
  playEnemyDeathSound: playEnemyDeathSound,
  playBossSpawnSound: playBossSpawnSound
};

// ==========================================
// 3. INICIALIZAÇÃO ÚNICA DOS MÓDULOS NO CARREGAMENTO DA PÁGINA
// (Listeners de toque e eventos são registrados aqui UMA ÚNICA VEZ)
// ==========================================
initMetaSystem();
initAudioSystem();
initHUD();
initProgression();
initInput();
initCombat();
initTerrain();
initProps();
initSky();
initPlayer();
initEnemies();

// ==========================================
// 4. FUNÇÃO DE DESCARTE DE OBJETOS 3D
// ==========================================
function dispose3DObject(obj) {
  if (!obj) return;
  obj.traverse(function (child) {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) {
        for (var i = 0; i < child.material.length; i++) {
          if (child.material[i] && child.material[i].dispose) child.material[i].dispose();
        }
      } else if (child.material.dispose) {
        child.material.dispose();
      }
    }
  });
  if (obj.parent) obj.parent.remove(obj);
}

// ==========================================
// 5. FUNÇÃO resetGame() ÚNICA E ROBUSTA
// Executada tanto no clique em "JOGAR" quanto no reinício de "JOGAR NOVAMENTE"
// ==========================================
export function resetGame() {
  if (DEBUG_RESET) {
    console.log("[DEBUG_RESET] Iniciando resetGame");
    console.log("[DEBUG_RESET] Filhos em planetGroup antes:", planetGroup.children.length);
    console.log("[DEBUG_RESET] Filhos em scene antes:", scene.children.length);
    var activeZBefore = (state.zombiePool || []).filter(function (z) { return z.active; }).length;
    var activeBBefore = (state.bulletPool || []).filter(function (b) { return b.active; }).length;
    console.log("[DEBUG_RESET] Ativos antes - Zumbis:", activeZBefore, "Projéteis:", activeBBefore);
  }

  // 1. Cancela o loop de animação antigo
  if (state.animationFrameId) {
    cancelAnimationFrame(state.animationFrameId);
    state.animationFrameId = null;
  }

  // 2. Limpeza profunda dos pools: remove do parent, chama dispose() na geometria e material, e esvazia arrays
  cleanUpEnemies();
  cleanUpPickups();

  // Limpa projéteis do combate
  if (state.bulletPool) {
    for (var bi = 0; bi < state.bulletPool.length; bi++) {
      var b = state.bulletPool[bi];
      if (b && b.mesh) dispose3DObject(b.mesh);
    }
    state.bulletPool.length = 0;
  }

  // Limpa coletáveis rápidos do combate
  if (state.pickupPool) {
    for (var pi = 0; pi < state.pickupPool.length; pi++) {
      var pk = state.pickupPool[pi];
      if (pk && pk.group) dispose3DObject(pk.group);
      else if (pk && pk.mesh) dispose3DObject(pk.mesh);
    }
    state.pickupPool.length = 0;
  }

  // Limpa partículas
  if (state.darkParticles) {
    for (var dpi = 0; dpi < state.darkParticles.length; dpi++) {
      var dp = state.darkParticles[dpi];
      if (dp && dp.mesh) dispose3DObject(dp.mesh);
    }
    state.darkParticles.length = 0;
  }

  // 3. Reseta contadores e flags de estado da partida
  state.playerHp = INITIAL_PLAYER_HP;
  state.maxPlayerHp = INITIAL_MAX_HP;
  state.stamina = 100;
  state.isSprinting = false;
  state.isStaminaExhausted = false;
  state.staminaRegenDelayTimer = 0;
  state.staminaJustDepleted = false;

  state.currentWave = 1;
  state.waveKills = 0;
  state.waveTargetKills = getWaveTargetKills(1);
  state.killsCount = 0;
  state.playerLevel = 1;
  state.playerXp = 0;
  state.xpNeeded = BASE_XP_NEEDED;

  state.isGameOver = false;
  state.isPaused = false;
  state.isLevelUpPaused = false;
  state.freezeFrameTimer = 0;

  // Armas voltam para pistola (a menos que metralhadora permanente tenha sido desbloqueada)
  var perm = state.permanentWeapon === "machinegun" ? "machinegun" : "pistol";
  state.permanentWeapon = perm;
  state.currentWeapon = perm;
  state.temporaryWeapon = null;
  state.temporaryWeaponAmmo = 0;
  state.hasFoundMachinegun = perm === "machinegun";
  state.playerMinesCount = 3;
  state.minesCount = 3;
  state.playerStationaryTimer = 0;

  // Reseta níveis de melhoria da partida em andamento
  if (state.upgrades) {
    for (var uk in state.upgrades) {
      state.upgrades[uk].level = 0;
    }
  }

  // Dispositivos e listas ativas zerados
  state.activeMines = [];
  state.activeTurrets = [];
  state.activeBarriers = [];

  // Reset de bosses, mira e timers
  state.activeBossZombie = null;
  state.currentTargetZombie = null;
  state.targetLockTime = 0;
  state.targetSearchFrameCounter = 0;
  state.screamerSpawnBoostTimer = 0;
  state.frenzyDurationTimer = 0;
  state.gameStartTime = Date.now();
  state.gameStarted = true;

  // 4. Reaplica bônus permanentes da meta-progressão sobre os valores base recém-zerados
  applyMetaToGameStart();

  // 5. Recria os pools limpos chamando as funções de inicialização
  initEnemies();
  initPickups();

  // Recria pool de projéteis
  var bulletGeo = new THREE.SphereGeometry(0.07, 5, 5);
  var bulletMat = new THREE.MeshBasicMaterial({ color: BULLET_COLOR_NORMAL });
  state.bulletPool = [];
  for (var nbi = 0; nbi < MAX_BULLETS; nbi++) {
    var nbMesh = new THREE.Mesh(bulletGeo, bulletMat);
    nbMesh.visible = false;
    planetGroup.add(nbMesh);
    state.bulletPool.push({
      mesh: nbMesh,
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

  // Recria pool de coletáveis
  var pickupGeo = new THREE.BoxGeometry(0.24, 0.24, 0.24);
  var medkitMat = new THREE.MeshLambertMaterial({ color: 0x22c55e, emissive: 0x15803d });
  state.pickupPool = [];
  for (var npi = 0; npi < MAX_PICKUPS; npi++) {
    var npGroup = new THREE.Group();
    var npMesh = new THREE.Mesh(pickupGeo, medkitMat);
    npGroup.add(npMesh);
    npGroup.visible = false;
    planetGroup.add(npGroup);
    state.pickupPool.push({
      group: npGroup,
      mesh: npMesh,
      active: false,
      type: "medkit",
      dirLocal: new THREE.Vector3(),
      life: 0
    });
  }

  // Recria partículas
  var pGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
  var pMat = new THREE.MeshBasicMaterial({ color: 0x221c1a, transparent: true, opacity: 0.8 });
  state.darkParticles = [];
  for (var ndpi = 0; ndpi < 40; ndpi++) {
    var ndpm = new THREE.Mesh(pGeo, pMat);
    ndpm.visible = false;
    planetGroup.add(ndpm);
    state.darkParticles.push({
      mesh: ndpm,
      active: false,
      vel: new THREE.Vector3(),
      life: 0,
      maxLife: 1.0
    });
  }

  // Reconstrói modelo 3D da arma do jogador
  if (state.rebuildPlayerWeapon) {
    state.rebuildPlayerWeapon(state.currentWeapon);
  }

  // 6. Reposiciona o jogador na posição inicial (topo do planeta, rotação zerada)
  if (state.characterGroup) {
    state.characterGroup.position.set(0, PLANET_BASE_RADIUS, 0);
    state.characterGroup.rotation.set(0, 0, 0);
    state.characterGroup.quaternion.identity();
  }
  if (state.characterModel) {
    state.characterModel.rotation.set(0, 0, 0);
    state.characterModel.quaternion.identity();
  }
  state.playerLocalDir.set(0, 1, 0);
  state.targetGroundY = PLANET_BASE_RADIUS;
  state.currentGroundY = PLANET_BASE_RADIUS;
  state.walkCycle = 0;
  state.recoilOffset = 0;
  state.currentForwardVel = 0;

  // 7. Zera a rotação do planetGroup
  planetGroup.quaternion.identity();
  planetGroup.rotation.set(0, 0, 0);
  state.planetQuat.identity();
  state.targetCamPitch = CAM_PITCH_DEFAULT;
  state.currentCamPitch = CAM_PITCH_DEFAULT;
  state.targetCamYaw = 0;
  state.currentCamYaw = 0;
  state.currentCamPos.set(0, 25, BASE_CAM_DISTANCE);
  state.currentLookTarget.set(0, 22.9, 0);

  // 8. Spawna os zumbis iniciais da onda 1
  for (var szi = 0; szi < 4; szi++) {
    spawnZombie(state.playerLocalDir, false);
  }

  // 9. Spawna os baús/itens iniciais (já executado por initPickups())

  // 10. Atualiza o HUD imediatamente
  state.ui.updateHpUI?.();
  state.ui.updateStaminaUI?.();
  state.ui.updateKillsUI?.(0);
  state.ui.updateWaveUI?.(1);
  state.ui.updateWaveProgressUI?.(0, state.waveTargetKills);
  state.ui.updateCompactPill?.();
  state.ui.updateWeaponUI?.();
  state.ui.updateMinesUI?.();
  state.ui.hideBossBar?.();

  // 11. Esconde qualquer modal aberto
  hideGameOverModal();
  hideStartScreen();
  var lvlModal = document.getElementById("levelup-modal");
  if (lvlModal) lvlModal.style.display = "none";
  var skillModal = document.getElementById("skilltree-modal");
  if (skillModal) skillModal.style.display = "none";

  if (DEBUG_RESET) {
    console.log("[DEBUG_RESET] resetGame concluído com sucesso");
    console.log("[DEBUG_RESET] Filhos em planetGroup depois:", planetGroup.children.length);
    console.log("[DEBUG_RESET] Filhos em scene depois:", scene.children.length);
    console.log(
      "[DEBUG_RESET] Tamanho dos pools - Zumbis:",
      (state.zombiePool || []).length,
      "Baús:",
      (state.chestPool || []).length,
      "Projéteis:",
      (state.bulletPool || []).length
    );
  }

  // 12. Inicia um NOVO loop de animação e guarda o novo id em state.animationFrameId
  clock.start();
  state.animationFrameId = requestAnimationFrame(animate);
}

state.resetGame = resetGame;

// ==========================================
// 6. FLUXO DA TELA DE INÍCIO
// ==========================================
state.onUserStartGame = function () {
  initAudioSystem();
  startAmbience();
  resetGame();
  showBigAnnouncement("ONDA 1", "SOBREVIVA ÀS HORDAS!", 3000);
};

// Exibe a tela de início com botão JOGAR e HABILIDADES
showStartScreen(false);

// ==========================================
// 7. REDIMENSIONAMENTO RESPONSIVO
// ==========================================
window.addEventListener("resize", function () {
  var w = window.innerWidth;
  var h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});

// ==========================================
// 8. LOOP PRINCIPAL DE ANIMAÇÃO
// ==========================================
var clock = new THREE.Clock();

function animate() {
  state.animationFrameId = requestAnimationFrame(animate);

  var dt = Math.min(clock.getDelta(), 0.1);

  // Antes de tocar em JOGAR: renderiza o planeta girando suavemente em modo atmosférico
  if (!state.gameStarted) {
    planetGroup.rotation.y += 0.0016;
    updateSky(dt);
    updateProps(dt);
    updateHUD(dt);
    renderer.render(scene, camera);
    return;
  }

  // Parada momentânea de impacto (Freeze Frame)
  if (state.freezeFrameTimer > 0) {
    state.freezeFrameTimer -= dt;
    renderer.render(scene, camera);
    return;
  }

  // Jogo pausado durante seleção de melhorias ou fim de jogo
  if (state.isLevelUpPaused || state.isPaused || state.isGameOver) {
    renderer.render(scene, camera);
    return;
  }

  // ORDEM FIXA E EXPLÍCITA DOS UPDATES:
  // input, player, enemies, combat, progression, sky, audio, hud
  updateInput(dt);
  updatePlayer(dt);
  updateEnemies(dt);
  updateCombat(dt);
  updateProgression(dt);
  updateProps(dt);
  updateSky(dt);
  updateAudio(dt);
  updateHUD(dt);

  renderer.render(scene, camera);
}

// Inicia loop de exibição do planeta giratório no menu inicial
state.animationFrameId = requestAnimationFrame(animate);
