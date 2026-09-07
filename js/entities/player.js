// O que faz: Constrói a malha 3D do sobrevivente com modelo visualmente distinto para cada arma (pistola pequena, metralhadora, espingarda de cano duplo, rifle longo com mira, lança-chamas com tanque nas costas, lança-granadas largo e serra com disco rotativo).
// Gerencia movimentação esférica com sistema de stamina/corrida, rotação, alinhamento de mira e animação de passos.
// Exporta: initPlayer, updatePlayer, rebuildPlayerWeapon.
// Depende de: js/config.js, js/state.js, js/core/math.js

import {
  PLANET_BASE_RADIUS,
  SEA_LEVEL,
  MAX_FORWARD_SPEED,
  MAX_TURN_SPEED,
  CAM_YAW_LERP_FACTOR,
  CAM_PITCH_LERP_FACTOR,
  INVERT_MOVE_X,
  INVERT_MOVE_Y,
  DEBUG_FACING,
  PLAYER_COLORS,
  STAMINA_MAX,
  STAMINA_DRAIN_RATE,
  STAMINA_REGEN_RATE,
  STAMINA_REGEN_DELAY,
  STAMINA_RECOVERY_MIN,
  SPRINT_THRESHOLD,
  SPRINT_SPEED_MULTIPLIER,
  CHEST_LIGHT_COLOR,
  CHEST_LIGHT_DISTANCE,
  CHEST_LIGHT_INTENSITY,
  CHEST_LIGHT_DECAY,
  CHEST_LIGHT_FADE_DURATION,
  DAY_CYCLE_TOTAL,
  DAY_PHASE_DURATION,
  SUNSET_PHASE_DURATION,
  NIGHT_PHASE_DURATION,
  NIGHT_HEMI_INTENSITY_FLOOR,
  NIGHT_FOG_MAX_DENSITY,
  CAM_PITCH_DEFAULT
} from "../config.js";
import { state } from "../state.js";
import { getRawElevation } from "../core/math.js";

// Vetores e Quaternions reutilizáveis para evitar alocações de lixo por frame
var upVec = new THREE.Vector3(0, 1, 0);
var curLocalDir = new THREE.Vector3();
var candLocalDir = new THREE.Vector3();
var resolvedLocalDir = new THREE.Vector3();
var moveVec = new THREE.Vector3();
var toColVec = new THREE.Vector3();
var rotAxis = new THREE.Vector3();
var candPitchQuat = new THREE.Quaternion();
var candPlanetQuat = new THREE.Quaternion();
var invCandPlanetQuat = new THREE.Quaternion();
var invPlanetQuat = new THREE.Quaternion();
var alignQuat = new THREE.Quaternion();
var worldPtVec = new THREE.Vector3();

// Raycaster de altura do jogador em relação ao relevo terraceado
var charRaycaster = new THREE.Raycaster();
var charRayOrigin = new THREE.Vector3(0, 30, 0);
var charRayDir = new THREE.Vector3(0, -1, 0);

// =========================================================================
// 1. CONSTRUÇÃO PROCEDURAL DE MODELOS VISUALMENTE DISTINTOS DE ARMAS
// =========================================================================

export function rebuildPlayerWeapon(weaponId) {
  if (!state.characterModel || !state.playerWeaponGroup) return;

  var wGroup = state.playerWeaponGroup;
  var tankGroup = state.playerBackTankGroup;

  // Limpa malhas anteriores da arma
  while (wGroup.children.length > 0) {
    var child = wGroup.children[0];
    wGroup.remove(child);
    if (child.geometry) child.geometry.dispose();
  }

  // Limpa o tanque das costas
  if (tankGroup) {
    while (tankGroup.children.length > 0) {
      var tChild = tankGroup.children[0];
      tankGroup.remove(tChild);
      if (tChild.geometry) tChild.geometry.dispose();
    }
  }

  state.characterModel.userData.sawBladeMesh = null;
  state.characterModel.userData.currentWeaponModelId = weaponId;

  // Materiais compartilhados para as armas
  var darkMetalMat = new THREE.MeshLambertMaterial({ color: 0x242424, flatShading: true });
  var steelMat = new THREE.MeshLambertMaterial({ color: 0x5a5a5c, flatShading: true });
  var shinySteelMat = new THREE.MeshLambertMaterial({ color: 0xd6d9db, flatShading: true });
  var woodMat = new THREE.MeshLambertMaterial({ color: 0x5a361e, flatShading: true });
  var brassMat = new THREE.MeshLambertMaterial({ color: 0xb8860b, flatShading: true });
  var orangeTankMat = new THREE.MeshLambertMaterial({ color: 0xef4444, flatShading: true });
  var yellowStripeMat = new THREE.MeshLambertMaterial({ color: 0xfacc15, flatShading: true });

  var muzzleFlashPos = new THREE.Vector3(0.10, 0.24, -0.25);

  if (weaponId === "pistol") {
    // ==========================================================
    // PISTOLA: Pequena, cano curto, empunhadura compacta.
    // Claramente menor que todas as outras armas.
    // ==========================================================
    // Empunhadura compacta (levemente inclinada para trás)
    var gripMat = new THREE.MeshLambertMaterial({ color: 0x2e2722, flatShading: true });
    var pGrip = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.065, 0.034), gripMat);
    pGrip.rotation.x = -0.22;
    pGrip.position.set(0.10, 0.20, -0.11);
    pGrip.castShadow = true;
    wGroup.add(pGrip);

    // Slide / Corpo pequeno
    var pSlide = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.040, 0.10), darkMetalMat);
    pSlide.position.set(0.10, 0.24, -0.14);
    pSlide.castShadow = true;
    wGroup.add(pSlide);

    // Cano curto
    var pBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.035, 6), steelMat);
    pBarrel.rotation.x = Math.PI / 2;
    pBarrel.position.set(0.10, 0.24, -0.20);
    pBarrel.castShadow = true;
    wGroup.add(pBarrel);

    muzzleFlashPos.set(0.10, 0.24, -0.23);

  } else if (weaponId === "machinegun") {
    // ==========================================================
    // METRALHADORA: Cano longo, carregador banana visível, corpo alongado.
    // ==========================================================
    // Caixa de culatra alongada
    var mgBody = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.065, 0.28), darkMetalMat);
    mgBody.position.set(0.10, 0.23, -0.16);
    mgBody.castShadow = true;
    wGroup.add(mgBody);

    // Coronha militar
    var mgStock = new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.075, 0.10), darkMetalMat);
    mgStock.position.set(0.10, 0.21, 0.01);
    mgStock.castShadow = true;
    wGroup.add(mgStock);

    // Cano longo
    var mgBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.22, 6), steelMat);
    mgBarrel.rotation.x = Math.PI / 2;
    mgBarrel.position.set(0.10, 0.24, -0.38);
    mgBarrel.castShadow = true;
    wGroup.add(mgBarrel);

    // Manga perfurada de refrigeração
    var mgShroud = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.12, 6), darkMetalMat);
    mgShroud.rotation.x = Math.PI / 2;
    mgShroud.position.set(0.10, 0.24, -0.34);
    wGroup.add(mgShroud);

    // Carregador curvo tipo banana bem visível
    var mgMag = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.11, 0.045), darkMetalMat);
    mgMag.rotation.x = -0.32;
    mgMag.position.set(0.10, 0.14, -0.13);
    wGroup.add(mgMag);

    muzzleFlashPos.set(0.10, 0.24, -0.50);

  } else if (weaponId === "shotgun") {
    // ==========================================================
    // ESPINGARDA: Cano grosso e duplo, coronha larga de madeira.
    // ==========================================================
    // Coronha larga em madeira marrom
    var sgStock = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.088, 0.16), woodMat);
    sgStock.position.set(0.10, 0.21, 0.02);
    sgStock.castShadow = true;
    wGroup.add(sgStock);

    // Culatra resistente
    var sgReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.068, 0.14), darkMetalMat);
    sgReceiver.position.set(0.10, 0.24, -0.13);
    sgReceiver.castShadow = true;
    wGroup.add(sgReceiver);

    // Telha de bombeamento (pump slide)
    var sgPump = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.045, 0.09), woodMat);
    sgPump.position.set(0.10, 0.21, -0.28);
    wGroup.add(sgPump);

    // Cano duplo e grosso: dois cilindros paralelos lado a lado
    var sgBarrelL = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.25, 6), steelMat);
    sgBarrelL.rotation.x = Math.PI / 2;
    sgBarrelL.position.set(0.087, 0.245, -0.32);
    sgBarrelL.castShadow = true;
    wGroup.add(sgBarrelL);

    var sgBarrelR = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.25, 6), steelMat);
    sgBarrelR.rotation.x = Math.PI / 2;
    sgBarrelR.position.set(0.113, 0.245, -0.32);
    sgBarrelR.castShadow = true;
    wGroup.add(sgBarrelR);

    muzzleFlashPos.set(0.10, 0.245, -0.46);

  } else if (weaponId === "rifle") {
    // ==========================================================
    // RIFLE: Cano muito longo e fino, com mira telescópica no topo.
    // ==========================================================
    // Corpo fino e coronha ergonômica
    var rfStock = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.058, 0.28), darkMetalMat);
    rfStock.position.set(0.10, 0.23, -0.12);
    rfStock.castShadow = true;
    wGroup.add(rfStock);

    // Cano muito longo e fino
    var rfBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.38, 6), steelMat);
    rfBarrel.rotation.x = Math.PI / 2;
    rfBarrel.position.set(0.10, 0.24, -0.42);
    rfBarrel.castShadow = true;
    wGroup.add(rfBarrel);

    // Mira telescópica cilíndrica elevada
    var rfScope = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.15, 8), darkMetalMat);
    rfScope.rotation.x = Math.PI / 2;
    rfScope.position.set(0.10, 0.285, -0.15);
    wGroup.add(rfScope);

    // Suportes da mira
    var rfMount1 = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.02, 0.015), steelMat);
    rfMount1.position.set(0.10, 0.265, -0.11);
    wGroup.add(rfMount1);
    var rfMount2 = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.02, 0.015), steelMat);
    rfMount2.position.set(0.10, 0.265, -0.19);
    wGroup.add(rfMount2);

    // Lente frontal da mira
    var lensMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    var rfLens = new THREE.Mesh(new THREE.CircleGeometry(0.014, 8), lensMat);
    rfLens.position.set(0.10, 0.285, -0.226);
    wGroup.add(rfLens);

    // Carregador reto pequeno
    var rfMag = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.07, 0.035), darkMetalMat);
    rfMag.position.set(0.10, 0.16, -0.12);
    wGroup.add(rfMag);

    muzzleFlashPos.set(0.10, 0.24, -0.62);

  } else if (weaponId === "flamethrower") {
    // ==========================================================
    // LANÇA-CHAMAS: Bocal cônico e tanque cilíndrico nas costas.
    // ==========================================================
    // Tubo principal do lança-chamas
    var flBody = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.26, 6), darkMetalMat);
    flBody.rotation.x = Math.PI / 2;
    flBody.position.set(0.10, 0.23, -0.20);
    flBody.castShadow = true;
    wGroup.add(flBody);

    // Bocal cônico aberto na ponta
    var flNozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.040, 0.018, 0.09, 8), brassMat);
    flNozzle.rotation.x = -Math.PI / 2;
    flNozzle.position.set(0.10, 0.23, -0.37);
    flNozzle.castShadow = true;
    wGroup.add(flNozzle);

    // Ponta do tubo piloto de ignição
    var flPilot = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.05), steelMat);
    flPilot.position.set(0.10, 0.265, -0.35);
    wGroup.add(flPilot);

    // Empunhaduras duplas
    var flGripF = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.07, 0.024), darkMetalMat);
    flGripF.position.set(0.10, 0.16, -0.27);
    wGroup.add(flGripF);

    var flGripR = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.07, 0.024), darkMetalMat);
    flGripR.position.set(0.10, 0.16, -0.12);
    wGroup.add(flGripR);

    // TANQUE NAS COSTAS: Adicionado ao tankGroup do peito/costas
    if (tankGroup) {
      // Dois cilindros de combustível vermelhos com faixa amarela
      var tankLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.26, 8), orangeTankMat);
      tankLeft.position.set(-0.06, 0.25, 0.17);
      tankLeft.castShadow = true;
      tankGroup.add(tankLeft);

      var stripeL = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.054, 0.04, 8), yellowStripeMat);
      stripeL.position.set(-0.06, 0.25, 0.17);
      tankGroup.add(stripeL);

      var tankRight = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.26, 8), orangeTankMat);
      tankRight.position.set(0.06, 0.25, 0.17);
      tankRight.castShadow = true;
      tankGroup.add(tankRight);

      var stripeR = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.054, 0.04, 8), yellowStripeMat);
      stripeR.position.set(0.06, 0.25, 0.17);
      tankGroup.add(stripeR);

      // Conector metálico superior entre os tanques
      var manifold = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.04), steelMat);
      manifold.position.set(0, 0.38, 0.17);
      tankGroup.add(manifold);

      // Mangueira de borracha conectando o tanque à arma
      var hoseMat = new THREE.MeshBasicMaterial({ color: 0x181818 });
      var hose = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.22, 5), hoseMat);
      hose.rotation.z = -Math.PI / 4;
      hose.rotation.x = Math.PI / 6;
      hose.position.set(0.08, 0.18, 0.06);
      tankGroup.add(hose);
    }

    muzzleFlashPos.set(0.10, 0.23, -0.43);

  } else if (weaponId === "grenadelauncher") {
    // ==========================================================
    // LANÇA-GRANADAS: Cano curto e muito largo, corpo robusto.
    // ==========================================================
    // Corpo robusto
    var glBody = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.085, 0.19), darkMetalMat);
    glBody.position.set(0.10, 0.23, -0.14);
    glBody.castShadow = true;
    wGroup.add(glBody);

    // Tambor rotativo de granadas (cilindro horizontal bojudo)
    var glDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.11, 8), steelMat);
    glDrum.rotation.z = Math.PI / 2;
    glDrum.position.set(0.10, 0.23, -0.14);
    glDrum.castShadow = true;
    wGroup.add(glDrum);

    // Cano curto e muito largo (grande abertura frontal)
    var glBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.14, 8), darkMetalMat);
    glBarrel.rotation.x = Math.PI / 2;
    glBarrel.position.set(0.10, 0.24, -0.28);
    glBarrel.castShadow = true;
    wGroup.add(glBarrel);

    // Interior oco / boca do cano escura
    var glMouthMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
    var glMouth = new THREE.Mesh(new THREE.CircleGeometry(0.032, 8), glMouthMat);
    glMouth.position.set(0.10, 0.24, -0.352);
    wGroup.add(glMouth);

    // Empunhadura vertical frontal
    var glGrip = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.07, 0.032), darkMetalMat);
    glGrip.position.set(0.10, 0.16, -0.26);
    wGroup.add(glGrip);

    muzzleFlashPos.set(0.10, 0.24, -0.37);

  } else if (weaponId === "smg") {
    // ==========================================================
    // SUBMETRALHADORA: Caixa tática compacta, pente vertical longo
    // ==========================================================
    var smgBodyMat = new THREE.MeshLambertMaterial({ color: 0x1e293b, flatShading: true });
    var smgBody = new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.058, 0.18), smgBodyMat);
    smgBody.position.set(0.10, 0.23, -0.15);
    smgBody.castShadow = true;
    wGroup.add(smgBody);

    var smgMagMat = new THREE.MeshLambertMaterial({ color: 0x475569, flatShading: true });
    var smgMag = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.10, 0.035), smgMagMat);
    smgMag.position.set(0.10, 0.15, -0.13);
    wGroup.add(smgMag);

    var smgBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 6), steelMat);
    smgBarrel.rotation.x = Math.PI / 2;
    smgBarrel.position.set(0.10, 0.23, -0.26);
    wGroup.add(smgBarrel);

    var smgSight = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.016, 0.035), darkMetalMat);
    smgSight.position.set(0.10, 0.265, -0.18);
    wGroup.add(smgSight);

    muzzleFlashPos.set(0.10, 0.23, -0.31);

  } else if (weaponId === "ricochet") {
    // ==========================================================
    // REPETIDOR RICOCHETE: Emissor sci-fi com anéis de bobina ciano
    // ==========================================================
    var rcBody = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.062, 0.24), darkMetalMat);
    rcBody.position.set(0.10, 0.23, -0.15);
    rcBody.castShadow = true;
    wGroup.add(rcBody);

    var rcBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.26, 6), steelMat);
    rcBarrel.rotation.x = Math.PI / 2;
    rcBarrel.position.set(0.10, 0.23, -0.33);
    wGroup.add(rcBarrel);

    var cyanCoilMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
    for (var rci = 0; rci < 3; rci++) {
      var coil = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.007, 6, 12), cyanCoilMat);
      coil.position.set(0.10, 0.23, -0.24 - rci * 0.06);
      wGroup.add(coil);
    }

    muzzleFlashPos.set(0.10, 0.23, -0.47);

  } else if (weaponId === "blades") {
    // ==========================================================
    // LÂMINAS ORBITAIS: Manopla emissora de campos magnéticos
    // ==========================================================
    var gauntMat = new THREE.MeshLambertMaterial({ color: 0x334155, flatShading: true });
    var gauntlet = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.16), gauntMat);
    gauntlet.position.set(0.10, 0.23, -0.14);
    wGroup.add(gauntlet);

    var emitterMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });
    var emitterCore = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), emitterMat);
    emitterCore.position.set(0.10, 0.24, -0.23);
    wGroup.add(emitterCore);

    var ringMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
    var ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 12), ringMat);
    ring1.rotation.x = Math.PI / 2;
    ring1.position.set(0.10, 0.24, -0.23);
    wGroup.add(ring1);

    muzzleFlashPos.set(0.10, 0.24, -0.28);

  } else if (weaponId === "saw") {
    // ==========================================================
    // SERRA: Disco circular na ponta girando em alta rotação.
    // ==========================================================
    // Caixa de motor industrial
    var sawMotorMat = new THREE.MeshLambertMaterial({ color: 0xeab308, flatShading: true });
    var sawMotor = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.085, 0.22), sawMotorMat);
    sawMotor.position.set(0.10, 0.23, -0.14);
    sawMotor.castShadow = true;
    wGroup.add(sawMotor);

    // Eixo de transmissão estendido
    var sawShaft = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.038, 0.17), steelMat);
    sawShaft.position.set(0.10, 0.24, -0.28);
    sawShaft.castShadow = true;
    wGroup.add(sawShaft);

    // Disco circular de serra na ponta (lâmina de aço afiada)
    var sawBlade = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.012, 16), shinySteelMat);
    sawBlade.rotation.x = Math.PI / 2;
    sawBlade.position.set(0.10, 0.24, -0.38);
    sawBlade.castShadow = true;
    wGroup.add(sawBlade);

    // Guarda-pó de proteção semicircular sobre a lâmina
    var sawGuard = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.020, 8, 1, false, 0, Math.PI), darkMetalMat);
    sawGuard.rotation.x = Math.PI / 2;
    sawGuard.position.set(0.10, 0.25, -0.37);
    wGroup.add(sawGuard);

    state.characterModel.userData.sawBladeMesh = sawBlade;
    muzzleFlashPos.set(0.10, 0.24, -0.42);
  }

  // Posiciona o flash de tiro na ponta do cano do modelo atual
  if (state.muzzleFlash) {
    state.muzzleFlash.position.copy(muzzleFlashPos);
  }
}

// =========================================================================
// 2. INICIALIZAÇÃO DO PERSONAGEM E SOBREVIVENTE
// =========================================================================

export function initPlayer() {
  var characterGroup = new THREE.Group();
  state.scene.add(characterGroup);
  state.characterGroup = characterGroup;

  var characterModel = new THREE.Group();
  characterGroup.add(characterModel);
  state.characterModel = characterModel;

  // Pernas
  var legGeo = new THREE.BoxGeometry(0.09, 0.28, 0.09);
  var legMat = new THREE.MeshLambertMaterial({ color: PLAYER_COLORS.pants, flatShading: true });

  var legLeft = new THREE.Mesh(legGeo, legMat);
  legLeft.position.set(-0.06, 0.14, 0);
  legLeft.castShadow = true;
  characterModel.add(legLeft);
  state.charLegLeft = legLeft;

  var legRight = new THREE.Mesh(legGeo, legMat);
  legRight.position.set(0.06, 0.14, 0);
  legRight.castShadow = true;
  characterModel.add(legRight);
  state.charLegRight = legRight;

  // Tronco (Jaqueta)
  var torsoGeo = new THREE.BoxGeometry(0.24, 0.26, 0.15);
  var jacketMat = new THREE.MeshLambertMaterial({ color: PLAYER_COLORS.jacket, flatShading: true });
  var torso = new THREE.Mesh(torsoGeo, jacketMat);
  torso.position.set(0, 0.39, 0);
  torso.castShadow = true;
  characterModel.add(torso);
  state.charTorso = torso;

  // Mochila padrão nas costas
  var backpackGeo = new THREE.BoxGeometry(0.18, 0.20, 0.08);
  var backpackMat = new THREE.MeshLambertMaterial({ color: PLAYER_COLORS.backpack, flatShading: true });
  var backpack = new THREE.Mesh(backpackGeo, backpackMat);
  backpack.position.set(0, 0.39, 0.11);
  backpack.castShadow = true;
  characterModel.add(backpack);

  // Cabeça
  var headGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
  var skinMat = new THREE.MeshLambertMaterial({ color: PLAYER_COLORS.skin, flatShading: true });
  var head = new THREE.Mesh(headGeo, skinMat);
  head.position.set(0, 0.58, 0);
  head.castShadow = true;
  characterModel.add(head);
  state.charHead = head;

  // Olhos
  var eyeGeo = new THREE.BoxGeometry(0.03, 0.02, 0.02);
  var eyeMat = new THREE.MeshBasicMaterial({ color: PLAYER_COLORS.eye });
  var eyeLeft = new THREE.Mesh(eyeGeo, eyeMat);
  eyeLeft.position.set(-0.04, 0.59, -0.085);
  characterModel.add(eyeLeft);

  var eyeRight = new THREE.Mesh(eyeGeo, eyeMat);
  eyeRight.position.set(0.04, 0.59, -0.085);
  characterModel.add(eyeRight);

  // Boné
  var capMat = new THREE.MeshLambertMaterial({ color: PLAYER_COLORS.cap, flatShading: true });
  var capCrown = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.06, 0.17), capMat);
  capCrown.position.set(0, 0.67, 0);
  characterModel.add(capCrown);

  var capBrim = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.02, 0.10), capMat);
  capBrim.position.set(0, 0.65, -0.10);
  characterModel.add(capBrim);

  // Braços
  var armGeo = new THREE.BoxGeometry(0.08, 0.24, 0.08);
  var armMat = new THREE.MeshLambertMaterial({ color: PLAYER_COLORS.arms, flatShading: true });

  var armLeft = new THREE.Mesh(armGeo, armMat);
  armLeft.position.set(-0.16, 0.37, 0);
  armLeft.castShadow = true;
  characterModel.add(armLeft);
  state.charArmLeft = armLeft;

  var armRight = new THREE.Mesh(armGeo, armMat);
  armRight.position.set(0.16, 0.37, 0);
  armRight.castShadow = true;
  characterModel.add(armRight);
  state.charArmRight = armRight;

  // ==========================================================
  // GRUPO DA ARMA E GRUPO DO TANQUE DAS COSTAS
  // ==========================================================
  var playerWeaponGroup = new THREE.Group();
  characterModel.add(playerWeaponGroup);
  state.playerWeaponGroup = playerWeaponGroup;

  var playerBackTankGroup = new THREE.Group();
  characterModel.add(playerBackTankGroup);
  state.playerBackTankGroup = playerBackTankGroup;

  // Clarão de tiro (Muzzle flash)
  var muzzleFlashMat = new THREE.MeshBasicMaterial({ color: PLAYER_COLORS.muzzle, transparent: true, opacity: 0 });
  var muzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), muzzleFlashMat);
  muzzleFlash.position.set(0.10, 0.24, -0.23);
  characterModel.add(muzzleFlash);
  state.muzzleFlash = muzzleFlash;
  state.muzzleFlashMat = muzzleFlashMat;

  // Luz pulsante ao subir de nível
  var charLevelLight = new THREE.PointLight(PLAYER_COLORS.levelLight, 0, 10);
  characterGroup.add(charLevelLight);
  charLevelLight.position.set(0, 0.8, 0);
  state.charLevelLight = charLevelLight;

  // Lanterna de peito (PointLight preso ao peito, alcance ~4.40, luz alaranjada quente)
  var chestLight = new THREE.PointLight(CHEST_LIGHT_COLOR, 0, CHEST_LIGHT_DISTANCE, CHEST_LIGHT_DECAY);
  chestLight.position.set(0, 0.32, -0.06);
  chestLight.castShadow = false;
  characterModel.add(chestLight);
  state.chestLight = chestLight;
  state.chestLightIntensity = 0;
  state.facingDebugLine = null;

  // Sistema de Stamina e Corrida (sem dash)
  state.stamina = STAMINA_MAX;
  state.isSprinting = false;
  state.isStaminaExhausted = false;
  state.staminaRegenDelayTimer = 0;
  state.staminaJustDepleted = false;

  // Estado de armas e minas: SEMPRE inicia com a Pistola!
  state.currentWeapon = "pistol";
  state.permanentWeapon = "pistol";
  state.temporaryWeapon = null;
  state.temporaryWeaponAmmo = 0;
  if (state.playerMinesCount === undefined) state.playerMinesCount = 3;
  state.playerStationaryTimer = 0;

  // Monta imediatamente o modelo 3D distinto da Pistola
  state.rebuildPlayerWeapon = rebuildPlayerWeapon;
  rebuildPlayerWeapon("pistol");

  // Inicialização do controle de Pitch e Yaw da câmera
  if (state.targetCamPitch === undefined) state.targetCamPitch = CAM_PITCH_DEFAULT;
  if (state.currentCamPitch === undefined) state.currentCamPitch = CAM_PITCH_DEFAULT;
  if (state.targetCamYaw === undefined) state.targetCamYaw = 0;
  if (state.currentCamYaw === undefined) state.currentCamYaw = 0;

  // Posição inicial no topo do planeta (Y = R)
  state.targetGroundY = PLANET_BASE_RADIUS;
  state.currentGroundY = PLANET_BASE_RADIUS;
  characterGroup.position.set(0, PLANET_BASE_RADIUS, 0);

  // Inicializa variáveis de estado de movimentação
  state.walkCycle = 0;
  state.recoilOffset = 0;
  state.currentForwardVel = 0;
  state.joyX = 0;
  state.joyY = 0;
  state.lastFaceDir = new THREE.Vector3(0, 0, -1);
}

// =========================================================================
// 3. ATUALIZAÇÃO DO JOGADOR A CADA FRAME
// =========================================================================

export function updatePlayer(dt) {
  var time = performance.now() * 0.001;

  // =========================================================================
  // SINCRONIZAÇÃO DINÂMICA DO MODELO DA ARMA (Troca conforme arma equipada)
  // =========================================================================
  var activeWeaponId = state.currentWeapon || "pistol";
  if (state.characterModel && state.characterModel.userData.currentWeaponModelId !== activeWeaponId) {
    rebuildPlayerWeapon(activeWeaponId);
  }

  // Animação de rotação contínua da lâmina da serra
  if (state.characterModel && state.characterModel.userData.sawBladeMesh) {
    state.characterModel.userData.sawBladeMesh.rotation.y += dt * 32.0;
  }

  // 1. Suavização de Yaw e Pitch da câmera orbital
  state.currentCamYaw += (state.targetCamYaw - state.currentCamYaw) * CAM_YAW_LERP_FACTOR;
  state.currentCamPitch += (state.targetCamPitch - state.currentCamPitch) * CAM_PITCH_LERP_FACTOR;

  // 2. Vetores de orientação relativos à câmera no plano horizontal tangente
  var camDir = new THREE.Vector3();
  state.camera.getWorldDirection(camDir);
  var forward = camDir.clone().sub(upVec.clone().multiplyScalar(camDir.dot(upVec))).normalize();
  var right = new THREE.Vector3().crossVectors(forward, upVec).normalize();

  var effJoyX = (INVERT_MOVE_X ? -state.joyX : state.joyX);
  var effJoyY = (INVERT_MOVE_Y ? -state.joyY : state.joyY);

  var joyMag = Math.sqrt(state.joyX * state.joyX + state.joyY * state.joyY);
  var isMoving = joyMag > 0.05;

  // Atualização do temporizador de jogador parado (para plantio de minas)
  if (!isMoving && !state.isGameOver) {
    state.playerStationaryTimer = (state.playerStationaryTimer || 0) + dt;
  } else {
    state.playerStationaryTimer = 0;
  }
  state.playerStationaryTime = state.playerStationaryTimer;

  // =========================================================================
  // SISTEMA DE STAMINA E CORRIDA (Substitui o Dash)
  // =========================================================================
  var wantsToSprint = isMoving && (joyMag >= SPRINT_THRESHOLD);

  if (wantsToSprint && !state.isStaminaExhausted && !state.isGameOver) {
    state.isSprinting = true;
    state.stamina = Math.max(0, state.stamina - STAMINA_DRAIN_RATE * dt);
    state.staminaRegenDelayTimer = STAMINA_REGEN_DELAY;

    if (state.stamina <= 0) {
      state.stamina = 0;
      state.isStaminaExhausted = true;
      state.staminaJustDepleted = true;
      state.isSprinting = false;
    }
  } else {
    state.isSprinting = false;
    if (state.staminaRegenDelayTimer > 0) {
      state.staminaRegenDelayTimer = Math.max(0, state.staminaRegenDelayTimer - dt);
    } else {
      state.stamina = Math.min(STAMINA_MAX, state.stamina + STAMINA_REGEN_RATE * dt);
      if (state.isStaminaExhausted && state.stamina >= STAMINA_RECOVERY_MIN) {
        state.isStaminaExhausted = false;
      }
    }
  }

  // =========================================================================
  // PASSO 1: CALCULE moveDir E APLIQUE A ROTAÇÃO DO PLANETA
  // =========================================================================
  var moveDir = new THREE.Vector3();
  if (isMoving) {
    moveDir.copy(forward).multiplyScalar(-effJoyY).addScaledVector(right, effJoyX);
    if (moveDir.lengthSq() > 0.0001) {
      moveDir.normalize();
    }
  }

  var sprintSpeedMul = state.isSprinting ? SPRINT_SPEED_MULTIPLIER : 1.0;
  var moveSpeedUpgradeMul = 1 + (state.upgrades?.moveSpeed?.level || 0) * 0.15;
  var targetVel = isMoving ? Math.min(1.0, joyMag) * MAX_FORWARD_SPEED * moveSpeedUpgradeMul * sprintSpeedMul : 0;

  state.currentForwardVel += (targetVel - state.currentForwardVel) * (state.isSprinting ? 0.25 : 0.15);

  invPlanetQuat.copy(state.planetQuat).invert();
  curLocalDir.set(0, 1, 0).applyQuaternion(invPlanetQuat).normalize();
  state.playerLocalDir.copy(curLocalDir);

  var moveAngle = state.currentForwardVel * dt;
  if (Math.abs(moveAngle) > 0.000001 && moveDir.lengthSq() > 0.0001 && !state.isGameOver) {
    rotAxis.crossVectors(upVec, moveDir).normalize();

    candPitchQuat.setFromAxisAngle(rotAxis, -moveAngle);
    candPlanetQuat.copy(state.planetQuat).premultiply(candPitchQuat).normalize();
    invCandPlanetQuat.copy(candPlanetQuat).invert();

    candLocalDir.set(0, 1, 0).applyQuaternion(invCandPlanetQuat).normalize();
    moveVec.copy(candLocalDir).sub(curLocalDir);
    resolvedLocalDir.copy(candLocalDir);

    // Colisão com obstáculos do relevo e deslizamento tangencial
    for (var ci = 0; ci < state.colliders.length; ci++) {
      var col = state.colliders[ci];
      var dotCandidate = resolvedLocalDir.dot(col.dir);
      if (dotCandidate < 0.985) continue;

      if (dotCandidate > col.cosRad) {
        toColVec.copy(col.dir).addScaledVector(curLocalDir, -col.dir.dot(curLocalDir));
        var toColLen = toColVec.length();
        if (toColLen > 0.00001) {
          toColVec.divideScalar(toColLen);
          var proj = moveVec.dot(toColVec);
          if (proj > 0) {
            moveVec.addScaledVector(toColVec, -proj);
            resolvedLocalDir.copy(curLocalDir).add(moveVec).normalize();
          }
        }
      }
    }

    var rawElev = getRawElevation(resolvedLocalDir);
    if (rawElev < SEA_LEVEL) {
      resolvedLocalDir.copy(curLocalDir);
    }

    worldPtVec.copy(resolvedLocalDir).applyQuaternion(state.planetQuat);
    alignQuat.setFromUnitVectors(worldPtVec, upVec);
    state.planetQuat.premultiply(alignQuat);
    state.planetQuat.normalize();
    state.planetGroup.quaternion.copy(state.planetQuat);
  }

  invPlanetQuat.copy(state.planetQuat).invert();
  state.playerLocalDir.set(0, 1, 0).applyQuaternion(invPlanetQuat).normalize();

  // Raycast de altura para ajustar ao relevo terraceado
  charRaycaster.set(charRayOrigin, charRayDir);
  var charHits = charRaycaster.intersectObject(state.terrainMesh, false);
  if (charHits && charHits.length > 0) {
    state.targetGroundY = charHits[0].point.y;
  }
  state.currentGroundY += (state.targetGroundY - state.currentGroundY) * 0.25;
  state.characterGroup.position.set(0, state.currentGroundY, 0);

  // =========================================================================
  // PASSO 2: DEPOIS DEFINA faceDir
  // =========================================================================
  var hasActiveTarget = state.currentTargetZombie &&
    state.currentTargetZombie.active &&
    state.currentTargetZombie.hp > 0 &&
    state.currentTargetZombie.state === "walk";

  var faceDir = new THREE.Vector3();

  if (hasActiveTarget) {
    var targetWorldPos = new THREE.Vector3();
    state.currentTargetZombie.mesh.getWorldPosition(targetWorldPos);
    faceDir.subVectors(targetWorldPos, state.characterGroup.position);
    faceDir.y = 0;
    if (faceDir.lengthSq() > 0.0001) {
      faceDir.normalize();
    } else {
      faceDir.copy(state.lastFaceDir || forward);
    }
  } else if (isMoving) {
    faceDir.copy(moveDir);
  } else {
    faceDir.copy(state.lastFaceDir || forward);
  }

  if (!state.lastFaceDir) state.lastFaceDir = new THREE.Vector3(0, 0, -1);
  state.lastFaceDir.copy(faceDir);

  // =========================================================================
  // PASSO 3: APLIQUE A ORIENTAÇÃO DO MESH DO SOBREVIVENTE
  // =========================================================================
  var fwdBasis = faceDir.clone().normalize();
  var backBasis = fwdBasis.clone().negate();
  var rightBasis = new THREE.Vector3().crossVectors(fwdBasis, upVec).normalize();
  var orientMat = new THREE.Matrix4().makeBasis(rightBasis, upVec, backBasis);
  var targetQuat = new THREE.Quaternion().setFromRotationMatrix(orientMat);

  state.characterModel.quaternion.slerp(targetQuat, 0.25);

  // Alinhamento para disparo de mira
  var curModelFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(state.characterModel.quaternion);
  var curWorldYaw = Math.atan2(-curModelFwd.x, -curModelFwd.z);

  if (hasActiveTarget) {
    var realTargetYaw = Math.atan2(-faceDir.x, -faceDir.z);
    var realDiff = realTargetYaw - curWorldYaw;
    while (realDiff > Math.PI) realDiff -= Math.PI * 2;
    while (realDiff < -Math.PI) realDiff += Math.PI * 2;

    var tempAimPos = new THREE.Vector3().copy(state.currentTargetZombie.mesh.position).sub(state.characterGroup.position);
    var combatTargetYaw = Math.atan2(-tempAimPos.x, -tempAimPos.z);
    state.playerCurrentAimYaw = combatTargetYaw - realDiff;
  } else {
    state.playerCurrentAimYaw = curWorldYaw;
  }

  // Depuração visual de orientação
  if (DEBUG_FACING) {
    if (!state.facingDebugLine) {
      var lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 2.0)
      ]);
      var lineMat = new THREE.LineBasicMaterial({ color: 0x00ff88, depthTest: false, transparent: true });
      var debugLine = new THREE.Line(lineGeo, lineMat);
      debugLine.renderOrder = 999;
      state.scene.add(debugLine);
      state.facingDebugLine = debugLine;
    }
    state.facingDebugLine.visible = true;
    var chestPos = new THREE.Vector3(0, state.currentGroundY + 0.35, 0);
    var endPos = chestPos.clone().addScaledVector(faceDir, 2.2);
    var posArr = state.facingDebugLine.geometry.attributes.position.array;
    posArr[0] = chestPos.x;
    posArr[1] = chestPos.y;
    posArr[2] = chestPos.z;
    posArr[3] = endPos.x;
    posArr[4] = endPos.y;
    posArr[5] = endPos.z;
    state.facingDebugLine.geometry.attributes.position.needsUpdate = true;
  } else if (state.facingDebugLine) {
    state.facingDebugLine.visible = false;
  }

  // =========================================================================
  // ANIMAÇÃO DE PASSOS: Acelera proporcionalmente ao correr
  // =========================================================================
  var speedMag = Math.abs(state.currentForwardVel);
  if (speedMag > 0.010 && !state.isGameOver) {
    var charFace = new THREE.Vector3(0, 0, -1).applyQuaternion(state.characterModel.quaternion);
    var charRight = new THREE.Vector3(1, 0, 0).applyQuaternion(state.characterModel.quaternion);

    var forwardComp = moveDir.dot(charFace);
    var strafeComp = moveDir.dot(charRight);

    var walkDirSign = (forwardComp >= 0) ? 1 : -1;
    var strideAmplitude = 0.60 * Math.abs(forwardComp) + 0.35 * Math.abs(strafeComp);
    if (state.isSprinting) strideAmplitude *= 1.15;
    strideAmplitude = Math.max(0.30, Math.min(0.75, strideAmplitude));

    state.walkCycle += walkDirSign * dt * (speedMag / MAX_FORWARD_SPEED) * 16.0;
    state.charLegLeft.rotation.x = Math.sin(state.walkCycle) * strideAmplitude;
    state.charLegRight.rotation.x = -Math.sin(state.walkCycle) * strideAmplitude;
    state.charArmLeft.rotation.x = -Math.sin(state.walkCycle) * 0.45;
    state.charArmRight.rotation.x = Math.sin(state.walkCycle) * 0.45;
    state.characterModel.position.y = Math.abs(Math.sin(state.walkCycle)) * 0.045;
  } else {
    state.charLegLeft.rotation.x *= 0.85;
    state.charLegRight.rotation.x *= 0.85;
    state.charArmLeft.rotation.x *= 0.85;
    state.charArmRight.rotation.x *= 0.85;
    state.characterModel.position.y = Math.sin(time * 2.5) * 0.015;
  }

  state.recoilOffset = Math.max(0, state.recoilOffset - dt * 3.8);
  state.characterModel.position.z = state.recoilOffset * 0.12;

  if (state.charLevelLight && state.charLevelLight.intensity > 0) {
    state.charLevelLight.intensity = Math.max(0, state.charLevelLight.intensity - dt * 5.0);
  }

  // =========================================================================
  // LANTERNA DE PEITO (PointLight preso ao peito, alcance ~4.40, tremor suave)
  // =========================================================================
  if (state.chestLight) {
    var cycleTime = (state.dayNightTimer || 0) % DAY_CYCLE_TOTAL;
    var isNightOrSunset = (cycleTime >= DAY_PHASE_DURATION && cycleTime < (DAY_PHASE_DURATION + SUNSET_PHASE_DURATION + NIGHT_PHASE_DURATION));
    var targetChestIntensity = isNightOrSunset ? CHEST_LIGHT_INTENSITY : 0;

    var chestFadeSpeed = CHEST_LIGHT_INTENSITY / CHEST_LIGHT_FADE_DURATION;
    if (state.chestLightIntensity < targetChestIntensity) {
      state.chestLightIntensity = Math.min(targetChestIntensity, state.chestLightIntensity + chestFadeSpeed * dt);
    } else if (state.chestLightIntensity > targetChestIntensity) {
      state.chestLightIntensity = Math.max(targetChestIntensity, state.chestLightIntensity - chestFadeSpeed * dt);
    }

    var flicker = Math.sin(time * 3.7) * 0.035 + Math.sin(time * 8.5) * 0.025;
    state.chestLight.intensity = state.chestLightIntensity * (1.0 + flicker);
  }

  // Reforço de visibilidade ambiente noturna
  if (state.dayNightPhase === "night") {
    if (state.hemiLight && state.hemiLight.intensity < NIGHT_HEMI_INTENSITY_FLOOR) {
      state.hemiLight.intensity = NIGHT_HEMI_INTENSITY_FLOOR;
    }
    if (state.scene && state.scene.fog && state.scene.fog.density > NIGHT_FOG_MAX_DENSITY) {
      state.scene.fog.density = NIGHT_FOG_MAX_DENSITY;
    }
  }
}
