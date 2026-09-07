// O que faz: Gerencia baús de itens pelo mapa (armas, dispositivos, consumíveis), orbes de XP com halo pulsante e atração por ímã, minas automáticas, torretas de defesa e barreiras táticas.
// Exporta: initPickups, updatePickups, spawnChest, spawnXpOrb, spawnMine, spawnTurret, spawnBarrier, resetPickups, cleanUpPickups.
// Depende de: js/config.js, js/state.js, js/core/math.js

import {
  PLANET_BASE_RADIUS,
  SEA_LEVEL,
  XP_ORB_SIZE,
  XP_ORB_RADIUS,
  XP_ORB_COLOR,
  XP_ORB_EMISSIVE,
  BASE_XP_MAGNET_RAD,
  XP_MAGNET_STEP_PER_LEVEL,
  XP_ORB_COLLECT_RAD,
  CHEST_RESPAWN_INTERVAL,
  MAX_SIMULTANEOUS_CHESTS,
  INITIAL_CHESTS_COUNT,
  CHEST_COLLECT_RADIUS,
  CHEST_TYPES_WEIGHTS,
  BIOME_CHEST_DROPS,
  MACHINEGUN_MIN_WAVE,
  MACHINEGUN_CHANCE,
  MAX_MINES_CARRIED,
  MINE_TRIGGER_RADIUS,
  MINE_EXPLOSION_RADIUS,
  MINE_DAMAGE,
  MAX_ACTIVE_TURRETS,
  TURRET_LIFETIME,
  TURRET_FIRE_RATE,
  TURRET_RANGE,
  TURRET_DAMAGE,
  BARRIER_LIFETIME,
  BARRIER_RADIUS,
  WEAPONS_CONFIG,
  BULLET_COLOR_NORMAL,
  MEDKIT_HEAL_AMOUNT,
  MEDKIT_MIN_INTERVAL,
  DEBUG_ANCHOR
} from "../config.js";
import { state } from "../state.js";
import { radiusAt } from "../core/math.js";
import { getBiomeAt } from "../world/terrain.js";

// Pools e estados de objetos (armazenados em state para permitir reset completo)
var indicatorsContainer = null;

export function cleanUpPickups() {
  function disposeObj(obj) {
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

  var pools = [
    state.chestPool,
    state.xpOrbPool,
    state.minePool,
    state.turretPool,
    state.barrierPool
  ];
  for (var p = 0; p < pools.length; p++) {
    var pool = pools[p];
    if (pool && pool.length) {
      for (var i = 0; i < pool.length; i++) {
        var item = pool[i];
        if (item && item.mesh) {
          disposeObj(item.mesh);
        }
      }
      pool.length = 0;
    }
  }

  var activeLists = [state.activeMines, state.activeTurrets, state.activeBarriers];
  for (var a = 0; a < activeLists.length; a++) {
    var list = activeLists[a];
    if (list && list.length) {
      for (var j = 0; j < list.length; j++) {
        var actItem = list[j];
        if (actItem && actItem.mesh) {
          disposeObj(actItem.mesh);
        }
      }
      list.length = 0;
    }
  }

  state.chestPool = [];
  state.xpOrbPool = [];
  state.minePool = [];
  state.turretPool = [];
  state.barrierPool = [];
  state.activeMines = [];
  state.activeTurrets = [];
  state.activeBarriers = [];
  state.chestRespawnTimer = 0;

  if (indicatorsContainer) {
    indicatorsContainer.innerHTML = "";
  } else {
    var indEl = document.getElementById("chest-indicators-container");
    if (indEl) indEl.innerHTML = "";
  }
}

// Reutilizáveis
var tempVecA = new THREE.Vector3();
var tempVecB = new THREE.Vector3();
var tempScreenVec = new THREE.Vector3();
var upAxis = new THREE.Vector3(0, 1, 0);
var orbRaycaster = new THREE.Raycaster();

// Cores temáticas dos baús
var CHEST_COLORS = {
  weapon: 0xf97316,      // Laranja
  device: 0x38bdf8,      // Azul
  consumable: 0x22c55e   // Verde
};

// ==========================================
// 1. CRIAÇÃO DE MODELOS PROCEDURAIS LOW-POLY
// ==========================================

function createChestMesh(category) {
  var group = new THREE.Group();
  var colorHex = CHEST_COLORS[category] || 0xf97316;

  // Base do baú (madeira escura com ferragem)
  var woodMat = new THREE.MeshLambertMaterial({ color: 0x543d2b, flatShading: true });
  var bandMat = new THREE.MeshLambertMaterial({
    color: colorHex,
    emissive: colorHex,
    emissiveIntensity: 0.35,
    flatShading: true
  });

  var baseGeo = new THREE.BoxGeometry(0.34, 0.18, 0.24);
  var baseMesh = new THREE.Mesh(baseGeo, woodMat);
  baseMesh.position.y = 0.09;
  baseMesh.castShadow = true;
  group.add(baseMesh);

  // Faixa colorida central na base
  var bandGeo = new THREE.BoxGeometry(0.35, 0.09, 0.25);
  var bandMesh = new THREE.Mesh(bandGeo, bandMat);
  bandMesh.position.y = 0.09;
  group.add(bandMesh);

  // Tampa articulada (pivotada no topo traseiro)
  var lidGroup = new THREE.Group();
  lidGroup.position.set(0, 0.18, 0.12);

  var lidGeo = new THREE.BoxGeometry(0.34, 0.09, 0.24);
  var lidMesh = new THREE.Mesh(lidGeo, woodMat);
  lidMesh.position.set(0, 0.045, -0.12);
  lidMesh.castShadow = true;
  lidGroup.add(lidMesh);

  var lidBandGeo = new THREE.BoxGeometry(0.35, 0.095, 0.07);
  var lidBandMesh = new THREE.Mesh(lidBandGeo, bandMat);
  lidBandMesh.position.set(0, 0.045, -0.12);
  lidGroup.add(lidBandMesh);

  group.add(lidGroup);

  // Halo suave no chão
  var glowGeo = new THREE.RingGeometry(0.12, 0.32, 12);
  var glowMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.35,
    depthWrite: false
  });
  var glowMesh = new THREE.Mesh(glowGeo, glowMat);
  glowMesh.rotation.x = -Math.PI / 2;
  glowMesh.position.y = 0.01;
  group.add(glowMesh);

  group.userData = {
    lidGroup: lidGroup,
    bandMat: bandMat,
    glowMat: glowMat
  };

  return group;
}

function createXpOrbMesh() {
  var group = new THREE.Group();

  // Cubo pequeno no formato quadrado
  var boxGeo = new THREE.BoxGeometry(XP_ORB_SIZE, XP_ORB_SIZE, XP_ORB_SIZE);
  var boxMat = new THREE.MeshBasicMaterial({
    color: XP_ORB_COLOR
  });
  var boxMesh = new THREE.Mesh(boxGeo, boxMat);
  group.add(boxMesh);

  // Bordas destacadas para reforçar o formato quadrado nítido
  var edgesGeo = new THREE.EdgesGeometry(boxGeo);
  var edgesMat = new THREE.LineBasicMaterial({
    color: 0xbae6fd
  });
  var edges = new THREE.LineSegments(edgesGeo, edgesMat);
  group.add(edges);

  group.userData = {
    boxMesh: boxMesh,
    edges: edges
  };

  return group;
}

function createMineMesh() {
  var group = new THREE.Group();

  // Base circular da mina
  var baseGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.06, 12);
  var baseMat = new THREE.MeshLambertMaterial({ color: 0x27272a, flatShading: true });
  var baseMesh = new THREE.Mesh(baseGeo, baseMat);
  baseMesh.position.y = 0.03;
  group.add(baseMesh);

  // LED vermelho no centro
  var ledGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.04, 8);
  var ledMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  var ledMesh = new THREE.Mesh(ledGeo, ledMat);
  ledMesh.position.y = 0.07;
  group.add(ledMesh);

  // Luz do LED
  var light = new THREE.PointLight(0xef4444, 0.7, 1.5, 2);
  light.position.y = 0.12;
  group.add(light);

  group.userData = {
    ledMesh: ledMesh,
    light: light
  };

  return group;
}

function createTurretMesh() {
  var group = new THREE.Group();

  // Tripé da base
  var baseGeo = new THREE.CylinderGeometry(0.12, 0.28, 0.18, 5);
  var metalMat = new THREE.MeshLambertMaterial({ color: 0x3f3f46, flatShading: true });
  var baseMesh = new THREE.Mesh(baseGeo, metalMat);
  baseMesh.position.y = 0.09;
  group.add(baseMesh);

  // Cabeça rotatória
  var headGroup = new THREE.Group();
  headGroup.position.set(0, 0.24, 0);

  var headGeo = new THREE.BoxGeometry(0.20, 0.14, 0.24);
  var headMat = new THREE.MeshLambertMaterial({ color: 0x0284c7, flatShading: true });
  var headMesh = new THREE.Mesh(headGeo, headMat);
  headGroup.add(headMesh);

  // Cano duplo de disparo
  var barrelMat = new THREE.MeshLambertMaterial({ color: 0x18181b });
  var barrelLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 6), barrelMat);
  barrelLeft.rotation.x = Math.PI / 2;
  barrelLeft.position.set(-0.06, 0, -0.16);
  headGroup.add(barrelLeft);

  var barrelRight = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 6), barrelMat);
  barrelRight.rotation.x = Math.PI / 2;
  barrelRight.position.set(0.06, 0, -0.16);
  headGroup.add(barrelRight);

  group.add(headGroup);

  group.userData = {
    headGroup: headGroup
  };

  return group;
}

function createBarrierMesh() {
  var group = new THREE.Group();
  var woodMat = new THREE.MeshLambertMaterial({ color: 0x6b4f3b, flatShading: true });
  var wireMat = new THREE.MeshLambertMaterial({ color: 0x94a3b8, flatShading: true });

  // 3 postes com espaçamento horizontal
  var offsets = [-0.28, 0, 0.28];
  for (var i = 0; i < offsets.length; i++) {
    var postGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.46, 5);
    var postMesh = new THREE.Mesh(postGeo, woodMat);
    postMesh.position.set(offsets[i], 0.23, 0);
    postMesh.castShadow = true;
    group.add(postMesh);
  }

  // Vigas horizontais conectando os postes
  var barGeo = new THREE.BoxGeometry(0.68, 0.04, 0.03);
  var bar1 = new THREE.Mesh(barGeo, wireMat);
  bar1.position.set(0, 0.32, 0);
  group.add(bar1);

  var bar2 = new THREE.Mesh(barGeo, wireMat);
  bar2.position.set(0, 0.15, 0);
  group.add(bar2);

  return group;
}

// ==========================================
// 2. INICIALIZAÇÃO DOS POOLS
// ==========================================
export function initPickups() {
  cleanUpPickups();
  var parentGroup = state.planetGroup;
  if (!parentGroup) return;

  // Pool de Baús (adicionados ao planetGroup)
  state.chestPool = [];
  for (var c = 0; c < 16; c++) {
    var cat = (c % 3 === 0) ? "weapon" : (c % 3 === 1 ? "device" : "consumable");
    var cMesh = createChestMesh(cat);
    cMesh.visible = false;
    parentGroup.add(cMesh);
    if (DEBUG_ANCHOR && c === 0) {
      console.log("[DEBUG_ANCHOR] Chest parent:", cMesh.parent === state.planetGroup ? "planetGroup (CORRETO)" : "scene (ERRO)");
    }
    state.chestPool.push({
      mesh: cMesh,
      active: false,
      category: cat,
      dirLocal: new THREE.Vector3(),
      openingTimer: 0,
      isOpening: false,
      worldPos: new THREE.Vector3()
    });
  }

  // Pool de Orbes de XP (adicionados ao planetGroup)
  state.xpOrbPool = [];
  for (var x = 0; x < 80; x++) {
    var xMesh = createXpOrbMesh();
    xMesh.visible = false;
    parentGroup.add(xMesh);
    if (DEBUG_ANCHOR && x === 0) {
      console.log("[DEBUG_ANCHOR] XP Orb parent:", xMesh.parent === state.planetGroup ? "planetGroup (CORRETO)" : "scene (ERRO)");
    }
    state.xpOrbPool.push({
      mesh: xMesh,
      active: false,
      value: 10,
      dirLocal: new THREE.Vector3(),
      life: 0,
      phaseOffset: Math.random() * Math.PI * 2
    });
  }

  // Pool de Minas (adicionados ao planetGroup)
  state.minePool = [];
  for (var m = 0; m < 14; m++) {
    var mMesh = createMineMesh();
    mMesh.visible = false;
    parentGroup.add(mMesh);
    if (DEBUG_ANCHOR && m === 0) {
      console.log("[DEBUG_ANCHOR] Mine parent:", mMesh.parent === state.planetGroup ? "planetGroup (CORRETO)" : "scene (ERRO)");
    }
    state.minePool.push({
      mesh: mMesh,
      active: false,
      dirLocal: new THREE.Vector3(),
      plantTime: 0
    });
  }

  // Pool de Torretas (adicionados ao planetGroup)
  state.turretPool = [];
  for (var t = 0; t < 4; t++) {
    var tMesh = createTurretMesh();
    tMesh.visible = false;
    parentGroup.add(tMesh);
    if (DEBUG_ANCHOR && t === 0) {
      console.log("[DEBUG_ANCHOR] Turret parent:", tMesh.parent === state.planetGroup ? "planetGroup (CORRETO)" : "scene (ERRO)");
    }
    state.turretPool.push({
      mesh: tMesh,
      active: false,
      dirLocal: new THREE.Vector3(),
      life: 0,
      shootCooldown: 0
    });
  }

  // Pool de Barreiras (adicionados ao planetGroup)
  state.barrierPool = [];
  for (var b = 0; b < 4; b++) {
    var bMesh = createBarrierMesh();
    bMesh.visible = false;
    parentGroup.add(bMesh);
    if (DEBUG_ANCHOR && b === 0) {
      console.log("[DEBUG_ANCHOR] Barrier parent:", bMesh.parent === state.planetGroup ? "planetGroup (CORRETO)" : "scene (ERRO)");
    }
    state.barrierPool.push({
      mesh: bMesh,
      active: false,
      dirLocal: new THREE.Vector3(),
      life: 0
    });
  }

  // Container DOM para as setas indicadoras de borda de tela
  indicatorsContainer = document.getElementById("chest-indicators-container");
  if (!indicatorsContainer) {
    indicatorsContainer = document.createElement("div");
    indicatorsContainer.id = "chest-indicators-container";
    indicatorsContainer.className = "chest-indicators-container";
    document.body.appendChild(indicatorsContainer);
  }

  // Estado inicial do jogador
  state.permanentWeapon = "pistol";
  state.currentWeapon = "pistol";
  state.temporaryWeapon = null;
  state.temporaryWeaponAmmo = 0;
  state.hasFoundMachinegun = false;
  state.minesCount = state.minesCount !== undefined ? state.minesCount : MAX_MINES_CARRIED / 2;
  state.playerStationaryTimer = 0;
  state.lastMedkitDropTime = -999;

  // Spawna os baús iniciais distribuídos equilibradamente entre os 6 biomas
  var initialBiomes = ["suburb", "forest", "industrial", "desert", "swamp", "frozen"];
  for (var i = 0; i < INITIAL_CHESTS_COUNT; i++) {
    var bTarget = initialBiomes[i % initialBiomes.length];
    var initDir = findDryLandDir(bTarget);
    spawnChest(initDir);
  }
}

// ==========================================
// 3. SPAWNS DE OBJETOS
// ==========================================

// Verifica se uma coordenada angular está dentro da colisão de algum objeto do cenário
function isPointBlockedByColliders(dir) {
  if (!state.colliders) return false;
  for (var c = 0; c < state.colliders.length; c++) {
    var col = state.colliders[c];
    if (col.dir && dir.dot(col.dir) > col.cosRad + 0.005) {
      return true;
    }
  }
  return false;
}

// Encontra direção aleatória em solo seco (fora d'água) e livre de colisores, opcionalmente filtrado por bioma
function findDryLandDir(preferredBiomeId) {
  var fallback = null;
  for (var tries = 0; tries < 50; tries++) {
    var v = new THREE.Vector3(
      Math.random() - 0.5,
      Math.random() - 0.5,
      Math.random() - 0.5
    ).normalize();
    var r = radiusAt(v);
    if (r < PLANET_BASE_RADIUS + SEA_LEVEL + 0.06) continue;
    if (isPointBlockedByColliders(v)) continue;

    if (!fallback) fallback = v.clone();

    if (preferredBiomeId) {
      var b = getBiomeAt(v);
      if (b && b.id === preferredBiomeId) {
        return v;
      }
    } else {
      return v;
    }
  }
  return fallback || new THREE.Vector3(0, 1, 0);
}

export function spawnChest(forcedDir, forcedCategory) {
  var pool = state.chestPool || [];
  var freeChest = null;
  for (var i = 0; i < pool.length; i++) {
    if (!pool[i].active) {
      freeChest = pool[i];
      break;
    }
  }
  if (!freeChest) return;

  var dir = forcedDir || findDryLandDir();
  var biome = getBiomeAt(dir);
  var biomeDrops = BIOME_CHEST_DROPS[biome.id] || BIOME_CHEST_DROPS.suburb;

  var cat = forcedCategory;
  if (!cat) {
    var rand = Math.random();
    var wWeapon = biomeDrops.weights.weapon;
    var wDevice = biomeDrops.weights.device;
    if (rand < wWeapon) cat = "weapon";
    else if (rand < wWeapon + wDevice) cat = "device";
    else cat = "consumable";
  }

  freeChest.active = true;
  freeChest.category = cat;
  freeChest.biomeId = biome.id;
  freeChest.dirLocal.copy(dir);
  freeChest.isOpening = false;
  freeChest.openingTimer = 0;

  var colorHex = CHEST_COLORS[cat];
  var uData = freeChest.mesh.userData;
  if (uData.bandMat) {
    uData.bandMat.color.setHex(colorHex);
    uData.bandMat.emissive.setHex(colorHex);
  }
  if (uData.glowMat) {
    uData.glowMat.color.setHex(colorHex);
  }
  if (uData.lidGroup) {
    uData.lidGroup.rotation.x = 0;
  }

  var r = radiusAt(dir);
  freeChest.mesh.position.copy(dir).multiplyScalar(r);
  freeChest.mesh.quaternion.setFromUnitVectors(upAxis, dir);
  freeChest.mesh.scale.set(1, 1, 1);
  freeChest.mesh.visible = true;
}

export function spawnXpOrb(posOrDir, value) {
  var pool = state.xpOrbPool || [];
  var freeOrb = null;
  for (var i = 0; i < pool.length; i++) {
    if (!pool[i].active) {
      freeOrb = pool[i];
      break;
    }
  }
  if (!freeOrb) return;

  var worldDeathPos = tempVecA;
  if (posOrDir instanceof THREE.Vector3) {
    if (Math.abs(posOrDir.lengthSq() - 1.0) < 0.15) {
      // Se for uma direção unitária
      var rInit = radiusAt(posOrDir);
      var localPoint = tempVecB.copy(posOrDir).multiplyScalar(rInit);
      if (state.planetGroup) {
        worldDeathPos.copy(localPoint).applyMatrix4(state.planetGroup.matrixWorld);
      } else {
        worldDeathPos.copy(localPoint);
      }
    } else {
      // Já é uma posição de mundo
      worldDeathPos.copy(posOrDir);
    }
  } else {
    worldDeathPos.set(0, PLANET_BASE_RADIUS, 0);
  }

  // A altura vem de um raycast feito UMA ÚNICA VEZ na criação, não todo frame
  var rayOrigin = tempVecB.copy(worldDeathPos).normalize().multiplyScalar(PLANET_BASE_RADIUS + 10);
  var rayDir = tempScreenVec.copy(rayOrigin).negate().normalize();
  orbRaycaster.set(rayOrigin, rayDir);
  var hits = state.terrainMesh ? orbRaycaster.intersectObject(state.terrainMesh, false) : null;
  var surfacePoint = (hits && hits.length > 0) ? hits[0].point : worldDeathPos;

  // Converte com planetGroup.worldToLocal(pontoMundial.clone()) e nunca mais atualiza essa posição
  var localPos = state.planetGroup ? state.planetGroup.worldToLocal(surfacePoint.clone()) : surfacePoint.clone();
  var localNorm = localPos.clone().normalize();
  localPos.addScaledVector(localNorm, 0.04);

  freeOrb.active = true;
  freeOrb.value = value || 10;
  freeOrb.life = 0;
  freeOrb.mesh.position.copy(localPos);
  freeOrb.mesh.quaternion.setFromUnitVectors(upAxis, localNorm);
  freeOrb.mesh.visible = true;
}

export function spawnMine(dirLocal) {
  var pool = state.minePool || [];
  var freeMine = null;
  for (var i = 0; i < pool.length; i++) {
    if (!pool[i].active) {
      freeMine = pool[i];
      break;
    }
  }
  if (!freeMine) return;

  freeMine.active = true;
  freeMine.dirLocal.copy(dirLocal);
  freeMine.plantTime = 0;

  var r = radiusAt(dirLocal);
  freeMine.mesh.position.copy(dirLocal).multiplyScalar(r);
  freeMine.mesh.quaternion.setFromUnitVectors(upAxis, dirLocal);
  freeMine.mesh.visible = true;

  state.sounds.playMinePlantSound?.();
}

export function spawnTurret(dirLocal) {
  var pool = state.turretPool || [];
  var freeTurret = null;
  for (var i = 0; i < pool.length; i++) {
    if (!pool[i].active) {
      freeTurret = pool[i];
      break;
    }
  }
  if (!freeTurret) return;

  freeTurret.active = true;
  freeTurret.dirLocal.copy(dirLocal);
  freeTurret.life = TURRET_LIFETIME;
  freeTurret.shootCooldown = 0.2;

  var r = radiusAt(dirLocal);
  freeTurret.mesh.position.copy(dirLocal).multiplyScalar(r);
  freeTurret.mesh.quaternion.setFromUnitVectors(upAxis, dirLocal);
  freeTurret.mesh.visible = true;

  state.sounds.playDeploySound?.();
}

export function spawnBarrier(dirLocal, faceDir) {
  var pool = state.barrierPool || [];
  var freeBarrier = null;
  for (var i = 0; i < pool.length; i++) {
    if (!pool[i].active) {
      freeBarrier = pool[i];
      break;
    }
  }
  if (!freeBarrier) return;

  freeBarrier.active = true;
  freeBarrier.dirLocal.copy(dirLocal);
  freeBarrier.life = BARRIER_LIFETIME;

  var r = radiusAt(dirLocal);
  freeBarrier.mesh.position.copy(dirLocal).multiplyScalar(r);
  freeBarrier.mesh.quaternion.setFromUnitVectors(upAxis, dirLocal);
  freeBarrier.mesh.visible = true;

  state.sounds.playDeploySound?.();
}

// ==========================================
// 4. ATUALIZAÇÃO E INTERAÇÃO
// ==========================================
export function updatePickups(dt) {
  var playerDir = state.playerLocalDir || upAxis;
  var now = performance.now() * 0.001;

  // ----------------------------------------------------
  // A. REPOVOAMENTO DE BAÚS (a cada 20s, até o teto de 12)
  // Distribuição equilibrada entre os diferentes biomas
  // ----------------------------------------------------
  var curChestPool = state.chestPool || [];
  state.chestRespawnTimer = (state.chestRespawnTimer || 0) + dt;
  if (state.chestRespawnTimer >= CHEST_RESPAWN_INTERVAL) {
    state.chestRespawnTimer = 0;
    var activeChests = 0;
    var biomeKeys = ["suburb", "forest", "industrial", "desert", "swamp", "frozen"];
    var countsPerBiome = { suburb: 0, forest: 0, industrial: 0, desert: 0, swamp: 0, frozen: 0 };

    for (var ci = 0; ci < curChestPool.length; ci++) {
      if (curChestPool[ci].active) {
        activeChests++;
        var bId = curChestPool[ci].biomeId || "suburb";
        countsPerBiome[bId] = (countsPerBiome[bId] || 0) + 1;
      }
    }

    if (activeChests < MAX_SIMULTANEOUS_CHESTS) {
      // Prioriza os biomas com menor número de caixas ativas para evitar concentração
      var minCount = 999;
      var candidateBiomes = [];
      for (var bk = 0; bk < biomeKeys.length; bk++) {
        var key = biomeKeys[bk];
        if (countsPerBiome[key] < minCount) {
          minCount = countsPerBiome[key];
          candidateBiomes = [key];
        } else if (countsPerBiome[key] === minCount) {
          candidateBiomes.push(key);
        }
      }
      var targetBiome = candidateBiomes[Math.floor(Math.random() * candidateBiomes.length)];

      // Gera afastado do jogador (dot < 0.65) e no bioma alvo
      for (var tries = 0; tries < 25; tries++) {
        var candDir = findDryLandDir(targetBiome);
        if (candDir.dot(playerDir) < 0.65) {
          spawnChest(candDir);
          break;
        }
      }
    }
  }

  // ----------------------------------------------------
  // B. ATUALIZAÇÃO E COLETA DOS BAÚS
  // ----------------------------------------------------
  for (var c2 = 0; c2 < curChestPool.length; c2++) {
    var chest = curChestPool[c2];
    if (!chest.active) continue;

    // Converte posição para coordenadas de mundo do planeta
    chest.mesh.getWorldPosition(chest.worldPos);

    if (chest.isOpening) {
      chest.openingTimer += dt;
      var lid = chest.mesh.userData.lidGroup;
      if (lid) {
        lid.rotation.x = -Math.min(1.4, chest.openingTimer * 4.5);
      }
      chest.mesh.scale.multiplyScalar(Math.max(0, 1.0 - dt * 2.2));
      if (chest.openingTimer >= 0.45) {
        chest.active = false;
        chest.mesh.visible = false;
      }
      continue;
    }

    var cDot = chest.dirLocal.dot(playerDir);
    var cDistAng = Math.acos(Math.max(-1, Math.min(1, cDot)));

    if (cDistAng < CHEST_COLLECT_RADIUS) {
      chest.isOpening = true;
      chest.openingTimer = 0;

      var bDrops = BIOME_CHEST_DROPS[chest.biomeId] || BIOME_CHEST_DROPS.suburb;

      // Executa o sorteio do conteúdo do baú com base no bioma onde o baú nasceu
      if (chest.category === "weapon") {
        // Metralhadora permanente: pode nascer na ZONA INDUSTRIAL a partir da onda 8
        var canMg = (bDrops.canSpawnMachinegun && state.currentWave >= MACHINEGUN_MIN_WAVE && !state.hasFoundMachinegun && Math.random() < MACHINEGUN_CHANCE);
        if (canMg) {
          state.hasFoundMachinegun = true;
          state.permanentWeapon = "machinegun";
          state.currentWeapon = "machinegun";
          state.temporaryWeapon = null;
          state.temporaryWeaponAmmo = 0;
          state.ui.showWeaponNotification?.("METRALHADORA (PERMANENTE!) [ZONA INDUSTRIAL]");
        } else {
          // Sorteio por peso entre armas daquele bioma
          var wList = bDrops.weapons || [];
          var totalWeight = 0;
          for (var wi = 0; wi < wList.length; wi++) totalWeight += wList[wi].weight;
          var wRoll = Math.random() * totalWeight;
          var selectedWeapon = wList[0];
          var accW = 0;
          for (var wj = 0; wj < wList.length; wj++) {
            accW += wList[wj].weight;
            if (wRoll <= accW) {
              selectedWeapon = wList[wj];
              break;
            }
          }

          if (selectedWeapon.id === "pistol_upgraded") {
            state.permanentWeapon = "pistol";
            state.currentWeapon = "pistol";
            state.temporaryWeapon = null;
            state.temporaryWeaponAmmo = 0;
            state.pistolDamageBonus = (state.pistolDamageBonus || 0) + 1;
            state.ui.showWeaponNotification?.("PISTOLA APRIMORADA (+DANO) [SUBÚRBIO]");
          } else {
            var wConfig = WEAPONS_CONFIG[selectedWeapon.id];
            var mult = selectedWeapon.extraAmmoMult || 1.0;
            var finalAmmo = Math.round((wConfig.ammo || 20) * mult);
            state.temporaryWeapon = selectedWeapon.id;
            state.temporaryWeaponAmmo = finalAmmo;
            state.currentWeapon = selectedWeapon.id;
            state.ui.showWeaponNotification?.(wConfig.name + " (" + finalAmmo + " TIROS) [" + bDrops.name.toUpperCase() + "]");
          }
        }
        state.ui.updateWeaponUI?.();
        state.sounds.playWeaponPickupSound?.();
      } else if (chest.category === "device") {
        var dList = bDrops.devices || [{ type: "mines", count: 3, weight: 1.0 }];
        var totalDWeight = 0;
        for (var di = 0; di < dList.length; di++) totalDWeight += dList[di].weight;
        var dRoll = Math.random() * totalDWeight;
        var selectedDev = dList[0];
        var accD = 0;
        for (var dj = 0; dj < dList.length; dj++) {
          accD += dList[dj].weight;
          if (dRoll <= accD) {
            selectedDev = dList[dj];
            break;
          }
        }

        if (selectedDev.type === "drone") {
          var droneDur = selectedDev.duration || 45;
          state.combat?.activateDrone?.(droneDur);
          state.ui.showItemNotification?.("🛸 DRONE DE COMBATE ATIVADO! [" + bDrops.name + "]", "#38bdf8");
        } else if (selectedDev.type === "turret") {
          var curTurretPool = state.turretPool || [];
          var activeTurretsCount = 0;
          for (var tCheck = 0; tCheck < curTurretPool.length; tCheck++) {
            if (curTurretPool[tCheck].active) activeTurretsCount++;
          }
          if (activeTurretsCount < MAX_ACTIVE_TURRETS) {
            spawnTurret(playerDir);
            state.ui.showItemNotification?.("TORRETA DE COMBATE INSTALADA! [" + bDrops.name + "]", "#38bdf8");
          } else {
            state.minesCount = Math.min(MAX_MINES_CARRIED, state.minesCount + 3);
            state.ui.updateMinesUI?.();
            state.ui.showItemNotification?.("+3 MINAS RECARREGADAS", "#38bdf8");
          }
        } else if (selectedDev.type === "barrier") {
          spawnBarrier(playerDir);
          state.ui.showItemNotification?.("BARREIRA DEFENSIVA ATIVA! [" + bDrops.name + "]", "#38bdf8");
        } else {
          var mAdd = selectedDev.count || 3;
          state.minesCount = Math.min(MAX_MINES_CARRIED, state.minesCount + mAdd);
          state.ui.updateMinesUI?.();
          state.ui.showItemNotification?.("+" + mAdd + " MINAS COLETADAS [" + bDrops.name + "]", "#38bdf8");
        }
        state.sounds.playItemPickupSound?.();
      } else {
        // Consumíveis por bioma com regra de compensação dinâmica de vida
        var nowSec = performance.now() * 0.001;
        var hpRatio = (state.maxPlayerHp > 0) ? (state.playerHp / state.maxPlayerHp) : 1.0;
        var timeSinceLastMedkit = nowSec - (state.lastMedkitDropTime || -999);

        // Regra de vida:
        // - Intervalo mínimo de 25s entre dois drops de vida
        // - Evita gerar com vida cheia (>= 98%)
        // - Abaixo de 30% HP: chance boa
        // - Acima de 80% HP: chance quase nula
        var medkitAllowed = timeSinceLastMedkit >= MEDKIT_MIN_INTERVAL && hpRatio < 0.98;
        var medkitMultiplier = 1.0;
        if (!medkitAllowed) {
          medkitMultiplier = 0.0;
        } else if (hpRatio <= 0.30) {
          medkitMultiplier = 2.8; // Chance boa em emergência
        } else if (hpRatio >= 0.80) {
          medkitMultiplier = 0.02; // Chance quase nula perto de estar cheio
        } else {
          // Interpolação suave entre 30% e 80%
          var tHp = (hpRatio - 0.30) / 0.50;
          medkitMultiplier = 2.8 * (1.0 - tHp) + 0.02 * tHp;
        }

        var cList = bDrops.consumables || [{ type: "medkit", hp: MEDKIT_HEAL_AMOUNT, weight: 0.20 }, { type: "bomb", count: 1, weight: 0.45 }, { type: "stamina", weight: 0.35 }];
        var totalCWeight = 0;
        var adjWeights = [];
        for (var ci3 = 0; ci3 < cList.length; ci3++) {
          var w = cList[ci3].weight;
          if (cList[ci3].type === "medkit") {
            w *= medkitMultiplier;
          }
          adjWeights.push(w);
          totalCWeight += w;
        }

        // Fallback seguro se pesos somarem zero
        if (totalCWeight <= 0.0001) {
          adjWeights[0] = 0;
          adjWeights[1] = 1.0;
          totalCWeight = 1.0;
        }

        var cRoll = Math.random() * totalCWeight;
        var selectedCon = cList[0];
        var accC = 0;
        for (var cj = 0; cj < cList.length; cj++) {
          accC += adjWeights[cj];
          if (cRoll <= accC) {
            selectedCon = cList[cj];
            break;
          }
        }

        if (selectedCon.type === "bomb") {
          var bCount = selectedCon.count || 1;
          state.bombsCount = Math.min(state.maxBombs || 5, (state.bombsCount || 0) + bCount);
          state.ui.updateBombsUI?.();
          state.ui.showItemNotification?.("💣 +" + bCount + " BOMBA" + (bCount > 1 ? "S" : "") + " [" + bDrops.name + "]", "#f97316");
        } else if (selectedCon.type === "medkit") {
          state.lastMedkitDropTime = nowSec;
          var heal = selectedCon.hp || MEDKIT_HEAL_AMOUNT;
          state.playerHp = Math.min(state.maxPlayerHp, state.playerHp + heal);
          state.ui.updateHpUI?.();
          state.ui.showItemNotification?.("+" + heal + " DE VIDA RECUPERADA [" + bDrops.name + "]", "#22c55e");
        } else {
          state.stamina = 100;
          state.isStaminaExhausted = false;
          state.ui.updateStaminaUI?.();
          state.ui.showItemNotification?.("STAMINA 100% RECARREGADA [" + bDrops.name + "]", "#22c55e");
        }
        state.sounds.playItemPickupSound?.();
      }
    }
  }

  // ----------------------------------------------------
  // C. ATUALIZAÇÃO DOS CUBOS DE XP (fixos na posição onde foram dropados)
  // ----------------------------------------------------
  var playerWorldPos = state.characterGroup ? state.characterGroup.position : tempVecB.set(0, 0, 0);
  var playerLocalPos = state.planetGroup ? state.planetGroup.worldToLocal(playerWorldPos.clone()) : tempVecB;

  var magnetLevel = state.upgrades?.magnet ? state.upgrades.magnet.level : 0;
  var magnetDist = 0.95 * (1.0 + magnetLevel * XP_MAGNET_STEP_PER_LEVEL);
  var collectDist = 0.50;
  var curXpOrbPool = state.xpOrbPool || [];

  for (var xi = 0; xi < curXpOrbPool.length; xi++) {
    var orb = curXpOrbPool[xi];
    if (!orb.active) continue;

    orb.life += dt;

    // Rotação suave no próprio eixo no local da queda (NÃO recalcular posição do orbe a cada frame)
    orb.mesh.rotateY(dt * 2.2);

    var distToPlayer = orb.mesh.position.distanceTo(playerLocalPos);

    // A ÚNICA exceção é a fase de atração: move em direção à posição LOCAL do jogador
    if (distToPlayer < magnetDist) {
      var pullDir = tempVecA.subVectors(playerLocalPos, orb.mesh.position).normalize();
      var pullSpeed = 7.5 + magnetLevel * 2.0;
      orb.mesh.position.addScaledVector(pullDir, pullSpeed * dt);
    }

    // Coleta do cubo de XP ao colidir com o jogador
    if (distToPlayer < collectDist) {
      orb.active = false;
      orb.mesh.visible = false;
      state.progression.addXp?.(orb.value);
      state.sounds.playXpSound?.();
    }
  }

  // ----------------------------------------------------
  // D. ATUALIZAÇÃO DAS MINAS NO CHÃO
  // ----------------------------------------------------
  var curMinePool = state.minePool || [];
  for (var mi = 0; mi < curMinePool.length; mi++) {
    var mine = curMinePool[mi];
    if (!mine.active) continue;

    mine.plantTime += dt;
    // Pisca-pisca vermelho lento no LED da mina
    var blink = Math.sin(now * 5.0) > 0;
    if (mine.mesh.userData.ledMesh) {
      mine.mesh.userData.ledMesh.material.color.setHex(blink ? 0xff2222 : 0x550000);
    }
    if (mine.mesh.userData.light) {
      mine.mesh.userData.light.intensity = blink ? 0.9 : 0.15;
    }

    // Verifica proximidade de zumbis para detonação
    for (var zi = 0; zi < state.zombiePool.length; zi++) {
      var z = state.zombiePool[zi];
      if (!z.active || z.state !== "walk") continue;

      var mDotZ = mine.dirLocal.dot(z.dirLocal);
      var mDistZ = Math.acos(Math.max(-1, Math.min(1, mDotZ)));

      if (mDistZ < MINE_TRIGGER_RADIUS) {
        // DETONAÇÃO EM ÁREA DA MINA
        mine.active = false;
        mine.mesh.visible = false;

        state.camShake += 0.045;
        state.sounds.playExplosionSound?.();

        // Causa dano em área a todos os zumbis no raio
        for (var bzi = 0; bzi < state.zombiePool.length; bzi++) {
          var bz = state.zombiePool[bzi];
          if (!bz.active || bz.state !== "walk") continue;

          var bDot = mine.dirLocal.dot(bz.dirLocal);
          var bDist = Math.acos(Math.max(-1, Math.min(1, bDot)));

          if (bDist < MINE_EXPLOSION_RADIUS) {
            bz.hp -= MINE_DAMAGE;
            bz.flashTimer = 0.12;
            state.combat?.showDamagePopup?.(bz.mesh.position, MINE_DAMAGE.toString(), true);

            if (bz.type === "boss") {
              state.ui.updateBossHp?.(bz.hp, bz.maxHp);
            }

            if (bz.hp <= 0) {
              bz.state = "die";
              state.combat?.triggerDeathDust?.(bz.mesh.position, 16);
              state.progression.onZombieKilled?.(bz.type);
              bz.mesh.getWorldPosition(tempVecA);
              spawnXpOrb(tempVecA, bz.xpValue);
            }
          }
        }
        break;
      }
    }
  }

  // ----------------------------------------------------
  // E. ATUALIZAÇÃO DAS TORRETAS
  // ----------------------------------------------------
  var curTurrets = state.turretPool || [];
  for (var ti = 0; ti < curTurrets.length; ti++) {
    var turret = curTurrets[ti];
    if (!turret.active) continue;

    turret.life -= dt;
    if (turret.life <= 0) {
      turret.active = false;
      turret.mesh.visible = false;
      continue;
    }

    turret.shootCooldown -= dt;

    // Localiza o zumbi mais próximo dentro do alcance da torreta
    var closestZ = null;
    var minZDist = TURRET_RANGE;
    for (var zti = 0; zti < state.zombiePool.length; zti++) {
      var tz = state.zombiePool[zti];
      if (!tz.active || tz.state !== "walk") continue;

      var tDot = turret.dirLocal.dot(tz.dirLocal);
      var tDist = Math.acos(Math.max(-1, Math.min(1, tDot)));
      if (tDist < minZDist) {
        minZDist = tDist;
        closestZ = tz;
      }
    }

    if (closestZ) {
      // Gira a cabeça da torreta em direção ao alvo
      var head = turret.mesh.userData.headGroup;
      if (head) {
        tempVecA.copy(closestZ.mesh.position).sub(turret.mesh.position);
        head.rotation.y = Math.atan2(tempVecA.x, tempVecA.z);
      }

      // Disparo automático da torreta
      if (turret.shootCooldown <= 0) {
        turret.shootCooldown = TURRET_FIRE_RATE;

        // Pega projétil livre do bulletPool
        var freeBullet = null;
        for (var bti = 0; bti < state.bulletPool.length; bti++) {
          if (!state.bulletPool[bti].active) {
            freeBullet = state.bulletPool[bti];
            break;
          }
        }

        if (freeBullet) {
          tempVecB.crossVectors(turret.dirLocal, closestZ.dirLocal).normalize();
          freeBullet.active = true;
          freeBullet.dirLocal.copy(turret.dirLocal);
          freeBullet.travelAxis.copy(tempVecB);
          freeBullet.life = 0;
          freeBullet.maxLife = 0.9;
          freeBullet.speed = 1.1;
          freeBullet.damage = TURRET_DAMAGE;
          freeBullet.pierceLeft = 0;
          freeBullet.ricochetsLeft = 0;
          freeBullet.hitZombies = [];
          freeBullet.mesh.visible = true;
          freeBullet.mesh.material.color.setHex(BULLET_COLOR_NORMAL);

          state.sounds.playShootSound?.();
        }
      }
    }
  }

  // ----------------------------------------------------
  // F. ATUALIZAÇÃO DAS BARREIRAS (bloqueio ou quebra por Brutos)
  // ----------------------------------------------------
  var curBarriers = state.barrierPool || [];
  for (var bi = 0; bi < curBarriers.length; bi++) {
    var barrier = curBarriers[bi];
    if (!barrier.active) continue;

    barrier.life -= dt;
    if (barrier.life <= 0) {
      barrier.active = false;
      barrier.mesh.visible = false;
      continue;
    }

    for (var zbi = 0; zbi < state.zombiePool.length; zbi++) {
      var zb = state.zombiePool[zbi];
      if (!zb.active || zb.state !== "walk") continue;

      var bDot2 = barrier.dirLocal.dot(zb.dirLocal);
      var bDist2 = Math.acos(Math.max(-1, Math.min(1, bDot2)));

      if (bDist2 < BARRIER_RADIUS) {
        // Se for chefe / Bruto, quebra a barreira imediatamente!
        if (zb.type === "boss" || zb.type === "boss_brute" || zb.type === "boss_butcher") {
          barrier.active = false;
          barrier.mesh.visible = false;
          state.camShake += 0.04;
          state.combat?.triggerDeathDust?.(barrier.mesh.position, 20);
          state.sounds.playWoodBreakSound?.();
          break;
        } else {
          // Zumbis normais são repelidos e contornam a barreira
          tempVecA.copy(zb.dirLocal).sub(barrier.dirLocal).normalize();
          zb.dirLocal.addScaledVector(tempVecA, dt * 0.08).normalize();
        }
      }
    }
  }

  // ----------------------------------------------------
  // G. ATUALIZAÇÃO DOS INDICADORES DE TELA (BORDAS)
  // ----------------------------------------------------
  updateScreenEdgeIndicators();
}

// ==========================================
// 5. INDICADORES VISUAIS DE BORDA DE TELA
// ==========================================
function updateScreenEdgeIndicators() {
  if (!indicatorsContainer || !state.camera) return;

  var camera = state.camera;
  var width = window.innerWidth;
  var height = window.innerHeight;
  var activeChests = [];
  var curChestPool = state.chestPool || [];

  for (var i = 0; i < curChestPool.length; i++) {
    var chest = curChestPool[i];
    if (chest.active && !chest.isOpening) {
      activeChests.push(chest);
    }
  }

  // Garante elementos DOM suficientes no pool de indicadores
  var domIndicators = indicatorsContainer.children;
  while (domIndicators.length < activeChests.length) {
    var indEl = document.createElement("div");
    indEl.className = "chest-edge-indicator";
    indEl.innerHTML = '<div class="indicator-arrow">▶</div><div class="indicator-dist">0m</div>';
    indicatorsContainer.appendChild(indEl);
  }

  for (var k = 0; k < domIndicators.length; k++) {
    var el = domIndicators[k];
    if (k >= activeChests.length) {
      el.style.display = "none";
      continue;
    }

    var cTarget = activeChests[k];
    tempScreenVec.copy(cTarget.mesh.position).project(camera);

    var isBehind = tempScreenVec.z > 1.0;
    var screenX = (tempScreenVec.x * 0.5 + 0.5) * width;
    var screenY = (-(tempScreenVec.y * 0.5) + 0.5) * height;

    var margin = 32;
    var isOffscreen = isBehind || screenX < margin || screenX > width - margin || screenY < margin || screenY > height - margin;

    if (isOffscreen) {
      el.style.display = "flex";

      // Calcula direção do centro da tela para a borda
      var cx = width * 0.5;
      var cy = height * 0.5;
      var dirX = screenX - cx;
      var dirY = screenY - cy;

      if (isBehind) {
        dirX = -dirX;
        dirY = -dirY;
      }

      var angle = Math.atan2(dirY, dirX);

      // Clampa na borda da tela com margem
      var edgeX = Math.max(margin, Math.min(width - margin, cx + Math.cos(angle) * (width * 0.44)));
      var edgeY = Math.max(margin, Math.min(height - margin, cy + Math.sin(angle) * (height * 0.44)));

      el.style.left = edgeX + "px";
      el.style.top = edgeY + "px";

      var arrowEl = el.querySelector(".indicator-arrow");
      if (arrowEl) {
        arrowEl.style.transform = "rotate(" + (angle * (180 / Math.PI)) + "deg)";
        var col = CHEST_COLORS[cTarget.category] || 0xf97316;
        arrowEl.style.color = "#" + col.toString(16).padStart(6, "0");
      }

      var distEl = el.querySelector(".indicator-dist");
      if (distEl) {
        var angDist = Math.acos(Math.max(-1, Math.min(1, cTarget.dirLocal.dot(state.playerLocalDir || upAxis))));
        var distMeters = Math.round(angDist * PLANET_BASE_RADIUS);
        distEl.textContent = distMeters + "m";
      }
    } else {
      el.style.display = "none";
    }
  }
}

// ==========================================
// 6. REINICIALIZAÇÃO DO ESTADO DE ITENS
// ==========================================
export function resetPickups() {
  cleanUpPickups();
  initPickups();
}

export function clearXpOrbs() {
  var pool = state.xpOrbPool || [];
  for (var j = 0; j < pool.length; j++) {
    pool[j].active = false;
    pool[j].mesh.visible = false;
  }
}
