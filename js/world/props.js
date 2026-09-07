// O que faz: Distribui objetos temáticos por bioma com silhuetas low-poly distintas, colisores físicos e raycast de assentamento no relevo.
// Exporta: initProps, updateProps, verifyPropPlacement.
// Depende de: js/config.js, js/state.js, js/core/math.js, js/world/terrain.js

import {
  PLANET_BASE_RADIUS,
  SEA_LEVEL,
  PROP_CANDIDATES,
  MIN_PROP_GAP,
  MAX_HOUSES,
  MAX_CARS,
  MAX_POLES,
  MAX_FENCES,
  MAX_WATER_TANKS,
  MAX_STREET_SIGNS,
  MAX_DEAD_TREES,
  MAX_STUMPS,
  MAX_FALLEN_LOGS,
  MAX_BARBED_WIRE,
  MAX_CAMPFIRES,
  MAX_INDUSTRIAL_TANKS,
  MAX_PIPES,
  MAX_CONTAINERS,
  MAX_FORKLIFTS,
  MAX_SCAFFOLDS,
  MAX_BURNING_BARRELS,
  MAX_BUSES,
  MAX_GIANT_BONES,
  MAX_BURIED_DEBRIS,
  MAX_POWER_PYLONS,
  MAX_STILT_SHACKS,
  MAX_SWAMP_LOGS,
  MAX_TOXIC_BARRELS,
  MAX_DEAD_REEDS,
  MAX_PINES,
  MAX_SNOW_CARS,
  MAX_CABINS,
  MAX_ICE_BLOCKS,
  MAX_SNOW_FENCES,
  PROP_COLORS,
  BARREL_FIRE_LIGHT_COLOR,
  BARREL_FIRE_LIGHT_DISTANCE
} from "../config.js";
import { state } from "../state.js";
import { getRawElevation, fibonacciPoint } from "../core/math.js";
import { getBiomeAt } from "./terrain.js";
import { updateBiomeUI } from "../ui/hud.js";

// Garante matematicamente que a base da geometria fique exatamente em y = 0
function alignBaseToZero(geo) {
  geo.computeBoundingBox();
  geo.translate(0, -geo.boundingBox.min.y, 0);
  geo.computeBoundingBox();
  return geo;
}

// -------------------------------------------------------------
// CONSTRUTORES DE GEOMETRIAS LOW-POLY PARA CADA TIPO DE OBJETO
// -------------------------------------------------------------

function createWaterTankGeo() {
  var geo = new THREE.CylinderGeometry(0.48, 0.48, 1.15, 6);
  geo.rotateZ(Math.PI / 2);
  return alignBaseToZero(geo);
}

function createFallenLogGeo() {
  var geo = new THREE.CylinderGeometry(0.14, 0.17, 1.5, 5);
  geo.rotateZ(Math.PI / 2);
  return alignBaseToZero(geo);
}

function createPipeGeo() {
  var geo = new THREE.CylinderGeometry(0.18, 0.18, 1.7, 6);
  geo.rotateZ(Math.PI / 2);
  return alignBaseToZero(geo);
}

function createGiantBoneGeo() {
  var geo = new THREE.TorusGeometry(0.65, 0.09, 4, 8, Math.PI * 0.7);
  geo.rotateZ(Math.PI * 0.15);
  return alignBaseToZero(geo);
}

function createSwampLogGeo() {
  var geo = new THREE.CylinderGeometry(0.13, 0.15, 1.3, 5);
  geo.rotateZ(Math.PI / 2);
  return alignBaseToZero(geo);
}

// -------------------------------------------------------------
// ESTRUTURAS GRANDES E ÚNICAS (LANDMARKS)
// -------------------------------------------------------------

function createCrashedPlaneMesh() {
  var group = new THREE.Group();
  var planeMat = new THREE.MeshLambertMaterial({ color: PROP_COLORS.crashedPlane, flatShading: true });
  var glassMat = new THREE.MeshLambertMaterial({ color: 0x223344, flatShading: true });

  // Fuselagem
  var bodyGeo = alignBaseToZero(new THREE.CylinderGeometry(0.24, 0.32, 2.2, 6));
  bodyGeo.rotateX(Math.PI / 2);
  var bodyMesh = new THREE.Mesh(bodyGeo, planeMat);
  bodyMesh.castShadow = true;
  group.add(bodyMesh);

  // Asa esquerda quebrada
  var wingGeo = alignBaseToZero(new THREE.BoxGeometry(1.6, 0.06, 0.45));
  wingGeo.rotateZ(0.15);
  var wingMesh = new THREE.Mesh(wingGeo, planeMat);
  wingMesh.position.set(-0.9, 0.25, -0.1);
  wingMesh.castShadow = true;
  group.add(wingMesh);

  // Asa direita caída na areia
  var wingRGeo = alignBaseToZero(new THREE.BoxGeometry(1.2, 0.06, 0.42));
  wingRGeo.rotateZ(-0.25);
  var wingRMesh = new THREE.Mesh(wingRGeo, planeMat);
  wingRMesh.position.set(0.7, 0.15, 0.1);
  wingRMesh.castShadow = true;
  group.add(wingRMesh);

  // Cockpit
  var cockpitGeo = alignBaseToZero(new THREE.BoxGeometry(0.32, 0.25, 0.45));
  var cockpitMesh = new THREE.Mesh(cockpitGeo, glassMat);
  cockpitMesh.position.set(0, 0.35, -0.4);
  group.add(cockpitMesh);

  return group;
}

function createAbandonedTrailerMesh() {
  var group = new THREE.Group();
  var trailerMat = new THREE.MeshLambertMaterial({ color: PROP_COLORS.trailer, flatShading: true });
  var rustMat = new THREE.MeshLambertMaterial({ color: 0x4a3628, flatShading: true });

  // Corpo do trailer
  var bodyGeo = alignBaseToZero(new THREE.BoxGeometry(1.2, 0.85, 2.0));
  var bodyMesh = new THREE.Mesh(bodyGeo, trailerMat);
  bodyMesh.castShadow = true;
  group.add(bodyMesh);

  // Teto abaulado
  var roofGeo = alignBaseToZero(new THREE.CylinderGeometry(0.6, 0.6, 1.95, 6));
  roofGeo.rotateZ(Math.PI / 2);
  var roofMesh = new THREE.Mesh(roofGeo, rustMat);
  roofMesh.position.set(0, 0.82, 0);
  group.add(roofMesh);

  // Engate
  var hitchGeo = alignBaseToZero(new THREE.BoxGeometry(0.15, 0.1, 0.6));
  var hitchMesh = new THREE.Mesh(hitchGeo, rustMat);
  hitchMesh.position.set(0, 0.05, 1.2);
  group.add(hitchMesh);

  return group;
}

// -------------------------------------------------------------
// VERIFICAÇÃO E REPOSICIONAMENTO DE PROPS (SEM OBJETOS FLUTUANDO)
// -------------------------------------------------------------
export function verifyPropPlacement() {
  state.terrainMesh.updateMatrixWorld(true);
  var checkRay = new THREE.Raycaster();
  var pDir = new THREE.Vector3();
  var origin = new THREE.Vector3();
  var dummyMat = new THREE.Matrix4();

  for (var i = 0; i < state.propsList.length; i++) {
    var p = state.propsList[i];
    pDir.copy(p.dir).normalize();
    // Raycast de cima para baixo em direção ao centro do planeta
    origin.copy(pDir).multiplyScalar(PLANET_BASE_RADIUS + 10.0);
    checkRay.set(origin, pDir.clone().negate());
    var hits = checkRay.intersectObject(state.terrainMesh, false);

    if (hits && hits.length > 0) {
      var terrainHitPoint = hits[0].point;
      var dist = p.basePos.distanceTo(terrainHitPoint);

      if (dist > 0.06) {
        // Reposiciona a base exatamente no ponto de impacto do relevo, com folga de assentamento
        p.basePos.copy(terrainHitPoint).addScaledVector(pDir, -0.04);
        dummyMat.compose(p.basePos, p.quat, p.scale);
        p.mesh.setMatrixAt(p.index, dummyMat);
        p.mesh.instanceMatrix.needsUpdate = true;
      }
    }
  }
}

// -------------------------------------------------------------
// INICIALIZAÇÃO DE TODOS OS PROPS DOS 6 BIOMAS
// -------------------------------------------------------------
export function initProps() {
  // Posicionamento com planetGroup.quaternion em IDENTIDADE estrita
  state.planetGroup.quaternion.identity();
  state.planetGroup.position.set(0, 0, 0);
  state.planetGroup.updateMatrixWorld(true);
  state.terrainMesh.updateMatrixWorld(true);

  var propRaycaster = new THREE.Raycaster();

  // 1. SUBÚRBIO ARRASADO
  var houseGeo = alignBaseToZero(new THREE.BoxGeometry(1.4, 0.95, 1.3));
  var houseMat = new THREE.MeshLambertMaterial({ color: PROP_COLORS.ruinedHouse, flatShading: true });
  var instHouses = new THREE.InstancedMesh(houseGeo, houseMat, MAX_HOUSES);
  instHouses.castShadow = true;
  instHouses.receiveShadow = true;
  state.planetGroup.add(instHouses);

  var carGeo = alignBaseToZero(new THREE.BoxGeometry(0.78, 0.35, 1.35));
  var carMat = new THREE.MeshLambertMaterial({ color: PROP_COLORS.carWreck, flatShading: true });
  var instCars = new THREE.InstancedMesh(carGeo, carMat, MAX_CARS);
  instCars.castShadow = true;
  instCars.receiveShadow = true;
  state.planetGroup.add(instCars);

  var poleGeo = alignBaseToZero(new THREE.CylinderGeometry(0.045, 0.06, 2.1, 5));
  var poleMat = new THREE.MeshLambertMaterial({ color: PROP_COLORS.pole, flatShading: true });
  var instPoles = new THREE.InstancedMesh(poleGeo, poleMat, MAX_POLES);
  instPoles.castShadow = true;
  state.planetGroup.add(instPoles);

  var fenceGeo = alignBaseToZero(new THREE.BoxGeometry(1.15, 0.26, 0.09));
  var fenceMat = new THREE.MeshLambertMaterial({ color: PROP_COLORS.fence, flatShading: true });
  var instFences = new THREE.InstancedMesh(fenceGeo, fenceMat, MAX_FENCES);
  instFences.receiveShadow = true;
  state.planetGroup.add(instFences);

  var waterTankGeo = createWaterTankGeo();
  var waterTankMat = new THREE.MeshLambertMaterial({ color: PROP_COLORS.waterTank, flatShading: true });
  var instWaterTanks = new THREE.InstancedMesh(waterTankGeo, waterTankMat, MAX_WATER_TANKS);
  instWaterTanks.castShadow = true;
  instWaterTanks.receiveShadow = true;
  state.planetGroup.add(instWaterTanks);

  var streetSignGeo = alignBaseToZero(new THREE.CylinderGeometry(0.025, 0.03, 1.1, 4));
  var streetSignMat = new THREE.MeshLambertMaterial({ color: PROP_COLORS.streetSign, flatShading: true });
  var instStreetSigns = new THREE.InstancedMesh(streetSignGeo, streetSignMat, MAX_STREET_SIGNS);
  instStreetSigns.receiveShadow = true;
  state.planetGroup.add(instStreetSigns);

  // 2. FLORESTA MORTA
  var deadTreeGeo = alignBaseToZero(new THREE.CylinderGeometry(0.08, 0.16, 1.45, 5));
  var deadTreeMat = new THREE.MeshLambertMaterial({ color: PROP_COLORS.deadTree, flatShading: true });
  var instDeadTrees = new THREE.InstancedMesh(deadTreeGeo, deadTreeMat, MAX_DEAD_TREES);
  instDeadTrees.castShadow = true;
  instDeadTrees.receiveShadow = true;
  state.planetGroup.add(instDeadTrees);

  var stumpGeo = alignBaseToZero(new THREE.CylinderGeometry(0.18, 0.24, 0.38, 5));
  var stumpMat = new THREE.MeshLambertMaterial({ color: PROP_COLORS.stump, flatShading: true });
  var instStumps = new THREE.InstancedMesh(stumpGeo, stumpMat, MAX_STUMPS);
  instStumps.receiveShadow = true;
  state.planetGroup.add(instStumps);

  var fallenLogGeo = createFallenLogGeo();
  var fallenLogMat = new THREE.MeshLambertMaterial({ color: PROP_COLORS.fallenLog, flatShading: true });
  var instFallenLogs = new THREE.InstancedMesh(fallenLogGeo, fallenLogMat, MAX_FALLEN_LOGS);
  instFallenLogs.castShadow = true;
  instFallenLogs.receiveShadow = true;
  state.planetGroup.add(instFallenLogs);

  var barbedWireGeo = alignBaseToZero(new THREE.BoxGeometry(1.0, 0.30, 0.1));
  var barbedWireMat = new THREE.MeshLambertMaterial({ color: PROP_COLORS.barbedWire, flatShading: true });
  var instBarbedWire = new THREE.InstancedMesh(barbedWireGeo, barbedWireMat, MAX_BARBED_WIRE);
  instBarbedWire.receiveShadow = true;
  state.planetGroup.add(instBarbedWire);

  var campfireGeo = alignBaseToZero(new THREE.CylinderGeometry(0.28, 0.32, 0.12, 6));
  var campfireMat = new THREE.MeshLambertMaterial({ color: PROP_COLORS.campfire, flatShading: true });
  var instCampfires = new THREE.InstancedMesh(campfireGeo, campfireMat, MAX_CAMPFIRES);
  instCampfires.receiveShadow = true;
  state.planetGroup.add(instCampfires);

  // 3. ZONA INDUSTRIAL
  var tankGeo = alignBaseToZero(new THREE.CylinderGeometry(0.85, 0.85, 1.8, 8));
  var tankMat = new THREE.MeshLambertMaterial({ color: PROP_COLORS.industrialTank, flatShading: true });
  var instIndustrialTanks = new THREE.InstancedMesh(tankGeo, tankMat, MAX_INDUSTRIAL_TANKS);
  instIndustrialTanks.castShadow = true;
  instIndustrialTanks.receiveShadow = true;
  state.planetGroup.add(instIndustrialTanks);

  var pipeGeo = createPipeGeo();
  var pipeMat = new THREE.MeshLambertMaterial({ color: PROP_COLORS.pipe, flatShading: true });
  var instPipes = new THREE.InstancedMesh(pipeGeo, pipeMat, MAX_PIPES);
  instPipes.castShadow = true;
  instPipes.receiveShadow = true;
  state.planetGroup.add(instPipes);

  var containerGeo = alignBaseToZero(new THREE.BoxGeometry(0.95, 0.72, 2.0));
  var containerMat = new THREE.MeshLambertMaterial({ color: PROP_COLORS.containerA, flatShading: true });
  var instContainers = new THREE.InstancedMesh(containerGeo, containerMat, MAX_CONTAINERS);
  instContainers.castShadow = true;
  instContainers.receiveShadow = true;
  state.planetGroup.add(instContainers);

  var forkliftGeo = alignBaseToZero(new THREE.BoxGeometry(0.65, 0.55, 1.05));
  var forkliftMat = new THREE.MeshLambertMaterial({ color: PROP_COLORS.forklift, flatShading: true });
  var instForklifts = new THREE.InstancedMesh(forkliftGeo, forkliftMat, MAX_FORKLIFTS);
  instForklifts.castShadow = true;
  instForklifts.receiveShadow = true;
  state.planetGroup.add(instForklifts);

  var scaffoldGeo = alignBaseToZero(new THREE.BoxGeometry(0.85, 1.6, 0.85));
  var scaffoldMat = new THREE.MeshLambertMaterial({ color: PROP_COLORS.scaffold, flatShading: true });
  var instScaffolds = new THREE.InstancedMesh(scaffoldGeo, scaffoldMat, MAX_SCAFFOLDS);
  instScaffolds.castShadow = true;
  state.planetGroup.add(instScaffolds);

  var barrelGeo = alignBaseToZero(new THREE.CylinderGeometry(0.22, 0.22, 0.55, 6));
  var barrelMat = new THREE.MeshLambertMaterial({ color: PROP_COLORS.barrel, flatShading: true });
  var instBurningBarrels = new THREE.InstancedMesh(barrelGeo, barrelMat, MAX_BURNING_BARRELS);
  instBurningBarrels.castShadow = true;
  instBurningBarrels.receiveShadow = true;
  state.planetGroup.add(instBurningBarrels);

  // 4. DESERTO DE CINZAS
  var busGeo = alignBaseToZero(new THREE.BoxGeometry(1.05, 0.72, 2.5));
  var busMat = new THREE.MeshLambertMaterial({ color: PROP_COLORS.busWreck, flatShading: true });
  var instBuses = new THREE.InstancedMesh(busGeo, busMat, MAX_BUSES);
  instBuses.castShadow = true;
  instBuses.receiveShadow = true;
  state.planetGroup.add(instBuses);

  var giantBoneGeo = createGiantBoneGeo();
  var boneMat = new THREE.MeshLambertMaterial({ color: PROP_COLORS.giantBone, flatShading: true });
  var instGiantBones = new THREE.InstancedMesh(giantBoneGeo, boneMat, MAX_GIANT_BONES);
  instGiantBones.castShadow = true;
  instGiantBones.receiveShadow = true;
  state.planetGroup.add(instGiantBones);

  var buriedDebrisGeo = alignBaseToZero(new THREE.DodecahedronGeometry(0.35, 0));
  var buriedMat = new THREE.MeshLambertMaterial({ color: PROP_COLORS.buriedDebris, flatShading: true });
  var instBuriedDebris = new THREE.InstancedMesh(buriedDebrisGeo, buriedMat, MAX_BURIED_DEBRIS);
  instBuriedDebris.receiveShadow = true;
  state.planetGroup.add(instBuriedDebris);

  var powerPylonGeo = alignBaseToZero(new THREE.CylinderGeometry(0.12, 0.32, 2.5, 4));
  var pylonMat = new THREE.MeshLambertMaterial({ color: PROP_COLORS.powerPylon, flatShading: true });
  var instPowerPylons = new THREE.InstancedMesh(powerPylonGeo, pylonMat, MAX_POWER_PYLONS);
  instPowerPylons.castShadow = true;
  state.planetGroup.add(instPowerPylons);

  // 5. PÂNTANO TÓXICO
  var stiltShackGeo = alignBaseToZero(new THREE.BoxGeometry(1.05, 0.8, 1.05));
  var stiltShackMat = new THREE.MeshLambertMaterial({ color: PROP_COLORS.stiltShack, flatShading: true });
  var instStiltShacks = new THREE.InstancedMesh(stiltShackGeo, stiltShackMat, MAX_STILT_SHACKS);
  instStiltShacks.castShadow = true;
  instStiltShacks.receiveShadow = true;
  state.planetGroup.add(instStiltShacks);

  var swampLogGeo = createSwampLogGeo();
  var swampLogMat = new THREE.MeshLambertMaterial({ color: PROP_COLORS.swampLog, flatShading: true });
  var instSwampLogs = new THREE.InstancedMesh(swampLogGeo, swampLogMat, MAX_SWAMP_LOGS);
  instSwampLogs.receiveShadow = true;
  state.planetGroup.add(instSwampLogs);

  var toxicBarrelGeo = alignBaseToZero(new THREE.CylinderGeometry(0.22, 0.22, 0.55, 6));
  var toxicBarrelMat = new THREE.MeshLambertMaterial({ color: PROP_COLORS.toxicBarrel, flatShading: true });
  var instToxicBarrels = new THREE.InstancedMesh(toxicBarrelGeo, toxicBarrelMat, MAX_TOXIC_BARRELS);
  instToxicBarrels.castShadow = true;
  instToxicBarrels.receiveShadow = true;
  state.planetGroup.add(instToxicBarrels);

  var reedGeo = alignBaseToZero(new THREE.ConeGeometry(0.24, 0.75, 4));
  var reedMat = new THREE.MeshLambertMaterial({ color: PROP_COLORS.deadReeds, flatShading: true });
  var instDeadReeds = new THREE.InstancedMesh(reedGeo, reedMat, MAX_DEAD_REEDS);
  instDeadReeds.receiveShadow = true;
  state.planetGroup.add(instDeadReeds);

  // 6. ZONA GELADA
  var pineGeo = alignBaseToZero(new THREE.ConeGeometry(0.46, 1.35, 5));
  var pineMat = new THREE.MeshLambertMaterial({ color: PROP_COLORS.driedPine, flatShading: true });
  var instPines = new THREE.InstancedMesh(pineGeo, pineMat, MAX_PINES);
  instPines.castShadow = true;
  instPines.receiveShadow = true;
  state.planetGroup.add(instPines);

  var snowCarGeo = alignBaseToZero(new THREE.BoxGeometry(0.82, 0.42, 1.4));
  var snowCarMat = new THREE.MeshLambertMaterial({ color: PROP_COLORS.snowCar, flatShading: true });
  var instSnowCars = new THREE.InstancedMesh(snowCarGeo, snowCarMat, MAX_SNOW_CARS);
  instSnowCars.castShadow = true;
  instSnowCars.receiveShadow = true;
  state.planetGroup.add(instSnowCars);

  var cabinGeo = alignBaseToZero(new THREE.BoxGeometry(1.25, 0.9, 1.25));
  var cabinMat = new THREE.MeshLambertMaterial({ color: PROP_COLORS.brokenCabin, flatShading: true });
  var instCabins = new THREE.InstancedMesh(cabinGeo, cabinMat, MAX_CABINS);
  instCabins.castShadow = true;
  instCabins.receiveShadow = true;
  state.planetGroup.add(instCabins);

  var iceBlockGeo = alignBaseToZero(new THREE.DodecahedronGeometry(0.52, 0));
  var iceBlockMat = new THREE.MeshLambertMaterial({ color: PROP_COLORS.iceBlock, flatShading: true });
  var instIceBlocks = new THREE.InstancedMesh(iceBlockGeo, iceBlockMat, MAX_ICE_BLOCKS);
  instIceBlocks.castShadow = true;
  instIceBlocks.receiveShadow = true;
  state.planetGroup.add(instIceBlocks);

  var snowFenceGeo = alignBaseToZero(new THREE.BoxGeometry(1.05, 0.22, 0.08));
  var snowFenceMat = new THREE.MeshLambertMaterial({ color: PROP_COLORS.snowFence, flatShading: true });
  var instSnowFences = new THREE.InstancedMesh(snowFenceGeo, snowFenceMat, MAX_SNOW_FENCES);
  instSnowFences.receiveShadow = true;
  state.planetGroup.add(instSnowFences);

  // Contadores de instâncias ativas
  var counts = {
    house: 0, car: 0, pole: 0, fence: 0, waterTank: 0, streetSign: 0,
    deadTree: 0, stump: 0, fallenLog: 0, barbedWire: 0, campfire: 0,
    industrialTank: 0, pipe: 0, container: 0, forklift: 0, scaffold: 0, burningBarrel: 0,
    bus: 0, giantBone: 0, buriedDebris: 0, powerPylon: 0,
    stiltShack: 0, swampLog: 0, toxicBarrel: 0, deadReed: 0,
    pine: 0, snowCar: 0, cabin: 0, iceBlock: 0, snowFence: 0
  };

  var dummyPos = new THREE.Vector3();
  var dummyQuat = new THREE.Quaternion();
  var dummyScale = new THREE.Vector3(1, 1, 1);
  var dummyMat4 = new THREE.Matrix4();
  var upVec = new THREE.Vector3(0, 1, 0);

  state.colliders = [];
  state.burningBarrels = [];
  state.propsList = [];
  state.swampVapors = [];

  var acceptedProps = [];

  function isCandidateTooClose(candidateDir, candidateAngR) {
    for (var a = 0; a < acceptedProps.length; a++) {
      var acc = acceptedProps[a];
      var dot = candidateDir.dot(acc.dir);
      if (dot <= 0.97) continue;
      var distAng = Math.acos(Math.max(-1, Math.min(1, dot)));
      if (distAng < candidateAngR + acc.angRad + MIN_PROP_GAP) {
        return true;
      }
    }
    return false;
  }

  var landmarkPlanePlaced = false;
  var landmarkTrailerPlaced = false;

  for (var i = 0; i < PROP_CANDIDATES; i++) {
    var pDir = fibonacciPoint(i, PROP_CANDIDATES);

    // Evita nascer na posição de spawn inicial do jogador
    if (pDir.y > 0.96) continue;

    // Raycast isolado no terrainMesh
    propRaycaster.set(pDir.clone().multiplyScalar(PLANET_BASE_RADIUS + 12), pDir.clone().negate());
    var hits = propRaycaster.intersectObject(state.terrainMesh, false);
    if (!hits || hits.length === 0) continue;

    var elev = getRawElevation(pDir);
    if (elev < SEA_LEVEL) continue;

    var hitPoint = hits[0].point;
    var biome = getBiomeAt(pDir);

    // Variação de densidade por bioma (Industrial denso, Deserto aberto)
    if (Math.random() > (biome.propDensity !== undefined ? biome.propDensity : 0.45)) {
      continue;
    }

    dummyQuat.setFromUnitVectors(upVec, pDir);
    var spinAngle = Math.random() * Math.PI * 2;
    var spinQuat = new THREE.Quaternion().setFromAxisAngle(upVec, spinAngle);
    dummyQuat.multiply(spinQuat);

    var roll = Math.random();

    // ---------------------------------------------------------
    // BIOMA 1: SUBÚRBIO ARRASADO
    // ---------------------------------------------------------
    if (biome.id === "suburb") {
      if (roll < 0.26 && counts.house < MAX_HOUSES) {
        var sH = 0.9 + Math.random() * 0.4;
        var angR = (0.75 * sH) / PLANET_BASE_RADIUS;
        if (isCandidateTooClose(pDir, angR)) continue;

        dummyScale.set(sH, sH, sH);
        dummyPos.copy(hitPoint).addScaledVector(pDir, -0.04);
        dummyMat4.compose(dummyPos, dummyQuat, dummyScale);
        instHouses.setMatrixAt(counts.house, dummyMat4);
        state.propsList.push({ mesh: instHouses, index: counts.house, dir: pDir.clone(), basePos: dummyPos.clone(), scale: dummyScale.clone(), quat: dummyQuat.clone() });
        counts.house++;

        state.colliders.push({ dir: pDir.clone(), pos: dummyPos.clone(), angRad: angR, cosRad: Math.cos(angR), type: "house", blocksProjectiles: true });
        acceptedProps.push({ dir: pDir.clone(), angRad: angR });
      } else if (roll < 0.48 && counts.car < MAX_CARS) {
        var sC = 0.85 + Math.random() * 0.35;
        var angR = (0.70 * sC) / PLANET_BASE_RADIUS;
        if (isCandidateTooClose(pDir, angR)) continue;

        dummyScale.set(sC, sC, sC);
        var tiltQuatC = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), (Math.random() - 0.5) * 0.28);
        var finalQuatC = dummyQuat.clone().multiply(tiltQuatC);
        var boxC = carGeo.boundingBox.clone().applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(tiltQuatC));
        var sinkC = -boxC.min.y * sC + 0.04;
        dummyPos.copy(hitPoint).addScaledVector(pDir, -sinkC);
        dummyMat4.compose(dummyPos, finalQuatC, dummyScale);
        instCars.setMatrixAt(counts.car, dummyMat4);
        state.propsList.push({ mesh: instCars, index: counts.car, dir: pDir.clone(), basePos: dummyPos.clone(), scale: dummyScale.clone(), quat: finalQuatC.clone() });
        counts.car++;

        state.colliders.push({ dir: pDir.clone(), pos: dummyPos.clone(), angRad: angR, cosRad: Math.cos(angR), type: "car", blocksProjectiles: true });
        acceptedProps.push({ dir: pDir.clone(), angRad: angR });
      } else if (roll < 0.68 && counts.pole < MAX_POLES) {
        var sP = 0.85 + Math.random() * 0.35;
        var angR = (0.28 * sP) / PLANET_BASE_RADIUS;
        if (isCandidateTooClose(pDir, angR)) continue;

        dummyScale.set(sP, sP, sP);
        var tiltQuatP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (Math.random() - 0.5) * 0.32);
        var finalQuatP = dummyQuat.clone().multiply(tiltQuatP);
        var boxP = poleGeo.boundingBox.clone().applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(tiltQuatP));
        var sinkP = -boxP.min.y * sP + 0.04;
        dummyPos.copy(hitPoint).addScaledVector(pDir, -sinkP);
        dummyMat4.compose(dummyPos, finalQuatP, dummyScale);
        instPoles.setMatrixAt(counts.pole, dummyMat4);
        state.propsList.push({ mesh: instPoles, index: counts.pole, dir: pDir.clone(), basePos: dummyPos.clone(), scale: dummyScale.clone(), quat: finalQuatP.clone() });
        counts.pole++;

        state.colliders.push({ dir: pDir.clone(), pos: dummyPos.clone(), angRad: angR, cosRad: Math.cos(angR), type: "pole", blocksProjectiles: true });
        acceptedProps.push({ dir: pDir.clone(), angRad: angR });
      } else if (roll < 0.82 && counts.waterTank < MAX_WATER_TANKS) {
        var sWT = 0.8 + Math.random() * 0.35;
        var angR = (0.55 * sWT) / PLANET_BASE_RADIUS;
        if (isCandidateTooClose(pDir, angR)) continue;

        dummyScale.set(sWT, sWT, sWT);
        dummyPos.copy(hitPoint).addScaledVector(pDir, -0.04);
        dummyMat4.compose(dummyPos, dummyQuat, dummyScale);
        instWaterTanks.setMatrixAt(counts.waterTank, dummyMat4);
        state.propsList.push({ mesh: instWaterTanks, index: counts.waterTank, dir: pDir.clone(), basePos: dummyPos.clone(), scale: dummyScale.clone(), quat: dummyQuat.clone() });
        counts.waterTank++;

        state.colliders.push({ dir: pDir.clone(), pos: dummyPos.clone(), angRad: angR, cosRad: Math.cos(angR), type: "watertank", blocksProjectiles: true });
        acceptedProps.push({ dir: pDir.clone(), angRad: angR });
      } else if (roll < 0.92 && counts.fence < MAX_FENCES) {
        var sF = 0.85 + Math.random() * 0.35;
        var angR = (0.40 * sF) / PLANET_BASE_RADIUS;
        if (isCandidateTooClose(pDir, angR)) continue;

        dummyScale.set(sF, sF, sF);
        dummyPos.copy(hitPoint).addScaledVector(pDir, -0.03);
        dummyMat4.compose(dummyPos, dummyQuat, dummyScale);
        instFences.setMatrixAt(counts.fence, dummyMat4);
        counts.fence++;
        acceptedProps.push({ dir: pDir.clone(), angRad: angR });
      } else if (counts.streetSign < MAX_STREET_SIGNS) {
        var sSS = 0.8 + Math.random() * 0.3;
        var angR = (0.25 * sSS) / PLANET_BASE_RADIUS;
        if (isCandidateTooClose(pDir, angR)) continue;

        dummyScale.set(sSS, sSS, sSS);
        dummyPos.copy(hitPoint).addScaledVector(pDir, -0.03);
        dummyMat4.compose(dummyPos, dummyQuat, dummyScale);
        instStreetSigns.setMatrixAt(counts.streetSign, dummyMat4);
        counts.streetSign++;
        acceptedProps.push({ dir: pDir.clone(), angRad: angR });
      }
    }

    // ---------------------------------------------------------
    // BIOMA 2: FLORESTA MORTA
    // ---------------------------------------------------------
    else if (biome.id === "forest") {
      // Landmark único: Trailer abandonado no meio da floresta
      if (!landmarkTrailerPlaced && Math.random() < 0.12) {
        var angR = 0.95 / PLANET_BASE_RADIUS;
        if (isCandidateTooClose(pDir, angR)) continue;

        var trailerMesh = createAbandonedTrailerMesh();
        trailerMesh.position.copy(hitPoint).addScaledVector(pDir, -0.04);
        trailerMesh.quaternion.copy(dummyQuat);
        state.planetGroup.add(trailerMesh);
        landmarkTrailerPlaced = true;

        state.colliders.push({ dir: pDir.clone(), pos: hitPoint.clone(), angRad: angR, cosRad: Math.cos(angR), type: "trailer", blocksProjectiles: true });
        acceptedProps.push({ dir: pDir.clone(), angRad: angR });
        continue;
      }

      if (roll < 0.44 && counts.deadTree < MAX_DEAD_TREES) {
        var sT = 0.85 + Math.random() * 0.5;
        var angR = (0.40 * sT) / PLANET_BASE_RADIUS;
        if (isCandidateTooClose(pDir, angR)) continue;

        dummyScale.set(sT, sT, sT);
        dummyPos.copy(hitPoint).addScaledVector(pDir, -0.04);
        dummyMat4.compose(dummyPos, dummyQuat, dummyScale);
        instDeadTrees.setMatrixAt(counts.deadTree, dummyMat4);
        state.propsList.push({ mesh: instDeadTrees, index: counts.deadTree, dir: pDir.clone(), basePos: dummyPos.clone(), scale: dummyScale.clone(), quat: dummyQuat.clone() });
        counts.deadTree++;

        state.colliders.push({ dir: pDir.clone(), pos: dummyPos.clone(), angRad: angR, cosRad: Math.cos(angR), type: "tree", blocksProjectiles: true });
        acceptedProps.push({ dir: pDir.clone(), angRad: angR });
      } else if (roll < 0.65 && counts.fallenLog < MAX_FALLEN_LOGS) {
        var sL = 0.85 + Math.random() * 0.4;
        var angR = (0.45 * sL) / PLANET_BASE_RADIUS;
        if (isCandidateTooClose(pDir, angR)) continue;

        dummyScale.set(sL, sL, sL);
        dummyPos.copy(hitPoint).addScaledVector(pDir, -0.04);
        dummyMat4.compose(dummyPos, dummyQuat, dummyScale);
        instFallenLogs.setMatrixAt(counts.fallenLog, dummyMat4);
        state.propsList.push({ mesh: instFallenLogs, index: counts.fallenLog, dir: pDir.clone(), basePos: dummyPos.clone(), scale: dummyScale.clone(), quat: dummyQuat.clone() });
        counts.fallenLog++;

        state.colliders.push({ dir: pDir.clone(), pos: dummyPos.clone(), angRad: angR, cosRad: Math.cos(angR), type: "log", blocksProjectiles: false });
        acceptedProps.push({ dir: pDir.clone(), angRad: angR });
      } else if (roll < 0.80 && counts.stump < MAX_STUMPS) {
        var sStump = 0.8 + Math.random() * 0.4;
        var angR = (0.30 * sStump) / PLANET_BASE_RADIUS;
        if (isCandidateTooClose(pDir, angR)) continue;

        dummyScale.set(sStump, sStump, sStump);
        dummyPos.copy(hitPoint).addScaledVector(pDir, -0.03);
        dummyMat4.compose(dummyPos, dummyQuat, dummyScale);
        instStumps.setMatrixAt(counts.stump, dummyMat4);
        counts.stump++;

        state.colliders.push({ dir: pDir.clone(), pos: dummyPos.clone(), angRad: angR, cosRad: Math.cos(angR), type: "stump", blocksProjectiles: false });
        acceptedProps.push({ dir: pDir.clone(), angRad: angR });
      } else if (roll < 0.92 && counts.barbedWire < MAX_BARBED_WIRE) {
        var sBW = 0.85 + Math.random() * 0.3;
        var angR = (0.35 * sBW) / PLANET_BASE_RADIUS;
        if (isCandidateTooClose(pDir, angR)) continue;

        dummyScale.set(sBW, sBW, sBW);
        dummyPos.copy(hitPoint).addScaledVector(pDir, -0.03);
        dummyMat4.compose(dummyPos, dummyQuat, dummyScale);
        instBarbedWire.setMatrixAt(counts.barbedWire, dummyMat4);
        counts.barbedWire++;
        acceptedProps.push({ dir: pDir.clone(), angRad: angR });
      } else if (counts.campfire < MAX_CAMPFIRES) {
        var sCF = 0.8 + Math.random() * 0.3;
        var angR = (0.35 * sCF) / PLANET_BASE_RADIUS;
        if (isCandidateTooClose(pDir, angR)) continue;

        dummyScale.set(sCF, sCF, sCF);
        dummyPos.copy(hitPoint).addScaledVector(pDir, -0.02);
        dummyMat4.compose(dummyPos, dummyQuat, dummyScale);
        instCampfires.setMatrixAt(counts.campfire, dummyMat4);
        counts.campfire++;
        acceptedProps.push({ dir: pDir.clone(), angRad: angR });
      }
    }

    // ---------------------------------------------------------
    // BIOMA 3: ZONA INDUSTRIAL (Denso e Claustrofóbico)
    // ---------------------------------------------------------
    else if (biome.id === "industrial") {
      if (roll < 0.28 && counts.industrialTank < MAX_INDUSTRIAL_TANKS) {
        var sIT = 0.85 + Math.random() * 0.45;
        var angR = (0.85 * sIT) / PLANET_BASE_RADIUS;
        if (isCandidateTooClose(pDir, angR)) continue;

        dummyScale.set(sIT, sIT, sIT);
        dummyPos.copy(hitPoint).addScaledVector(pDir, -0.04);
        dummyMat4.compose(dummyPos, dummyQuat, dummyScale);
        instIndustrialTanks.setMatrixAt(counts.industrialTank, dummyMat4);
        state.propsList.push({ mesh: instIndustrialTanks, index: counts.industrialTank, dir: pDir.clone(), basePos: dummyPos.clone(), scale: dummyScale.clone(), quat: dummyQuat.clone() });
        counts.industrialTank++;

        state.colliders.push({ dir: pDir.clone(), pos: dummyPos.clone(), angRad: angR, cosRad: Math.cos(angR), type: "tank", blocksProjectiles: true });
        acceptedProps.push({ dir: pDir.clone(), angRad: angR });
      } else if (roll < 0.52 && counts.container < MAX_CONTAINERS) {
        var sCont = 0.85 + Math.random() * 0.35;
        var angR = (0.82 * sCont) / PLANET_BASE_RADIUS;
        if (isCandidateTooClose(pDir, angR)) continue;

        dummyScale.set(sCont, sCont, sCont);
        dummyPos.copy(hitPoint).addScaledVector(pDir, -0.04);
        dummyMat4.compose(dummyPos, dummyQuat, dummyScale);
        instContainers.setMatrixAt(counts.container, dummyMat4);
        state.propsList.push({ mesh: instContainers, index: counts.container, dir: pDir.clone(), basePos: dummyPos.clone(), scale: dummyScale.clone(), quat: dummyQuat.clone() });
        counts.container++;

        state.colliders.push({ dir: pDir.clone(), pos: dummyPos.clone(), angRad: angR, cosRad: Math.cos(angR), type: "container", blocksProjectiles: true });
        acceptedProps.push({ dir: pDir.clone(), angRad: angR });
      } else if (roll < 0.70 && counts.pipe < MAX_PIPES) {
        var sPipe = 0.85 + Math.random() * 0.35;
        var angR = (0.50 * sPipe) / PLANET_BASE_RADIUS;
        if (isCandidateTooClose(pDir, angR)) continue;

        dummyScale.set(sPipe, sPipe, sPipe);
        dummyPos.copy(hitPoint).addScaledVector(pDir, -0.04);
        dummyMat4.compose(dummyPos, dummyQuat, dummyScale);
        instPipes.setMatrixAt(counts.pipe, dummyMat4);
        state.propsList.push({ mesh: instPipes, index: counts.pipe, dir: pDir.clone(), basePos: dummyPos.clone(), scale: dummyScale.clone(), quat: dummyQuat.clone() });
        counts.pipe++;

        state.colliders.push({ dir: pDir.clone(), pos: dummyPos.clone(), angRad: angR, cosRad: Math.cos(angR), type: "pipe", blocksProjectiles: true });
        acceptedProps.push({ dir: pDir.clone(), angRad: angR });
      } else if (roll < 0.82 && counts.forklift < MAX_FORKLIFTS) {
        var sFL = 0.8 + Math.random() * 0.3;
        var angR = (0.45 * sFL) / PLANET_BASE_RADIUS;
        if (isCandidateTooClose(pDir, angR)) continue;

        dummyScale.set(sFL, sFL, sFL);
        dummyPos.copy(hitPoint).addScaledVector(pDir, -0.04);
        dummyMat4.compose(dummyPos, dummyQuat, dummyScale);
        instForklifts.setMatrixAt(counts.forklift, dummyMat4);
        counts.forklift++;

        state.colliders.push({ dir: pDir.clone(), pos: dummyPos.clone(), angRad: angR, cosRad: Math.cos(angR), type: "forklift", blocksProjectiles: true });
        acceptedProps.push({ dir: pDir.clone(), angRad: angR });
      } else if (roll < 0.91 && counts.scaffold < MAX_SCAFFOLDS) {
        var sScaff = 0.85 + Math.random() * 0.35;
        var angR = (0.55 * sScaff) / PLANET_BASE_RADIUS;
        if (isCandidateTooClose(pDir, angR)) continue;

        dummyScale.set(sScaff, sScaff, sScaff);
        dummyPos.copy(hitPoint).addScaledVector(pDir, -0.04);
        dummyMat4.compose(dummyPos, dummyQuat, dummyScale);
        instScaffolds.setMatrixAt(counts.scaffold, dummyMat4);
        counts.scaffold++;

        state.colliders.push({ dir: pDir.clone(), pos: dummyPos.clone(), angRad: angR, cosRad: Math.cos(angR), type: "scaffold", blocksProjectiles: true });
        acceptedProps.push({ dir: pDir.clone(), angRad: angR });
      } else if (counts.burningBarrel < MAX_BURNING_BARRELS) {
        var sBB = 0.85 + Math.random() * 0.3;
        var angR = (0.35 * sBB) / PLANET_BASE_RADIUS;
        if (isCandidateTooClose(pDir, angR)) continue;

        dummyScale.set(sBB, sBB, sBB);
        dummyPos.copy(hitPoint).addScaledVector(pDir, -0.04);
        dummyMat4.compose(dummyPos, dummyQuat, dummyScale);
        instBurningBarrels.setMatrixAt(counts.burningBarrel, dummyMat4);
        counts.burningBarrel++;

        var fireLight = new THREE.PointLight(BARREL_FIRE_LIGHT_COLOR, 1.4, BARREL_FIRE_LIGHT_DISTANCE);
        fireLight.position.copy(dummyPos).addScaledVector(pDir, 0.45);
        state.planetGroup.add(fireLight);
        state.burningBarrels.push({ light: fireLight, basePos: dummyPos.clone(), dir: pDir.clone() });

        state.colliders.push({ dir: pDir.clone(), pos: dummyPos.clone(), angRad: angR, cosRad: Math.cos(angR), type: "barrel", blocksProjectiles: true });
        acceptedProps.push({ dir: pDir.clone(), angRad: angR });
      }
    }

    // ---------------------------------------------------------
    // BIOMA 4: DESERTO DE CINZAS (Aberto e Exposto)
    // ---------------------------------------------------------
    else if (biome.id === "desert") {
      // Landmark único: Avião pequeno destroçado na areia
      if (!landmarkPlanePlaced && Math.random() < 0.15) {
        var angR = 1.1 / PLANET_BASE_RADIUS;
        if (isCandidateTooClose(pDir, angR)) continue;

        var planeMesh = createCrashedPlaneMesh();
        planeMesh.position.copy(hitPoint).addScaledVector(pDir, -0.04);
        planeMesh.quaternion.copy(dummyQuat);
        state.planetGroup.add(planeMesh);
        landmarkPlanePlaced = true;

        state.colliders.push({ dir: pDir.clone(), pos: hitPoint.clone(), angRad: angR, cosRad: Math.cos(angR), type: "plane", blocksProjectiles: true });
        acceptedProps.push({ dir: pDir.clone(), angRad: angR });
        continue;
      }

      if (roll < 0.28 && counts.giantBone < MAX_GIANT_BONES) {
        var sGB = 0.9 + Math.random() * 0.5;
        var angR = (0.50 * sGB) / PLANET_BASE_RADIUS;
        if (isCandidateTooClose(pDir, angR)) continue;

        dummyScale.set(sGB, sGB, sGB);
        dummyPos.copy(hitPoint).addScaledVector(pDir, -0.04);
        dummyMat4.compose(dummyPos, dummyQuat, dummyScale);
        instGiantBones.setMatrixAt(counts.giantBone, dummyMat4);
        state.propsList.push({ mesh: instGiantBones, index: counts.giantBone, dir: pDir.clone(), basePos: dummyPos.clone(), scale: dummyScale.clone(), quat: dummyQuat.clone() });
        counts.giantBone++;

        state.colliders.push({ dir: pDir.clone(), pos: dummyPos.clone(), angRad: angR, cosRad: Math.cos(angR), type: "bone", blocksProjectiles: false });
        acceptedProps.push({ dir: pDir.clone(), angRad: angR });
      } else if (roll < 0.52 && counts.bus < MAX_BUSES) {
        var sBus = 0.85 + Math.random() * 0.35;
        var angR = (0.95 * sBus) / PLANET_BASE_RADIUS;
        if (isCandidateTooClose(pDir, angR)) continue;

        dummyScale.set(sBus, sBus, sBus);
        dummyPos.copy(hitPoint).addScaledVector(pDir, -0.04);
        dummyMat4.compose(dummyPos, dummyQuat, dummyScale);
        instBuses.setMatrixAt(counts.bus, dummyMat4);
        state.propsList.push({ mesh: instBuses, index: counts.bus, dir: pDir.clone(), basePos: dummyPos.clone(), scale: dummyScale.clone(), quat: dummyQuat.clone() });
        counts.bus++;

        state.colliders.push({ dir: pDir.clone(), pos: dummyPos.clone(), angRad: angR, cosRad: Math.cos(angR), type: "bus", blocksProjectiles: true });
        acceptedProps.push({ dir: pDir.clone(), angRad: angR });
      } else if (roll < 0.74 && counts.powerPylon < MAX_POWER_PYLONS) {
        var sPyl = 0.85 + Math.random() * 0.35;
        var angR = (0.45 * sPyl) / PLANET_BASE_RADIUS;
        if (isCandidateTooClose(pDir, angR)) continue;

        dummyScale.set(sPyl, sPyl, sPyl);
        var tiltQuatPyl = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (Math.random() - 0.5) * 0.45);
        var finalQuatPyl = dummyQuat.clone().multiply(tiltQuatPyl);
        dummyPos.copy(hitPoint).addScaledVector(pDir, -0.05);
        dummyMat4.compose(dummyPos, finalQuatPyl, dummyScale);
        instPowerPylons.setMatrixAt(counts.powerPylon, dummyMat4);
        counts.powerPylon++;

        state.colliders.push({ dir: pDir.clone(), pos: dummyPos.clone(), angRad: angR, cosRad: Math.cos(angR), type: "pylon", blocksProjectiles: true });
        acceptedProps.push({ dir: pDir.clone(), angRad: angR });
      } else if (counts.buriedDebris < MAX_BURIED_DEBRIS) {
        var sBD = 0.75 + Math.random() * 0.5;
        var angR = (0.40 * sBD) / PLANET_BASE_RADIUS;
        if (isCandidateTooClose(pDir, angR)) continue;

        dummyScale.set(sBD, sBD * 0.6, sBD);
        dummyPos.copy(hitPoint).addScaledVector(pDir, -0.05);
        dummyMat4.compose(dummyPos, dummyQuat, dummyScale);
        instBuriedDebris.setMatrixAt(counts.buriedDebris, dummyMat4);
        counts.buriedDebris++;
        acceptedProps.push({ dir: pDir.clone(), angRad: angR });
      }
    }

    // ---------------------------------------------------------
    // BIOMA 5: PÂNTANO TÓXICO
    // ---------------------------------------------------------
    else if (biome.id === "swamp") {
      if (roll < 0.28 && counts.stiltShack < MAX_STILT_SHACKS) {
        var sStilt = 0.85 + Math.random() * 0.4;
        var angR = (0.65 * sStilt) / PLANET_BASE_RADIUS;
        if (isCandidateTooClose(pDir, angR)) continue;

        dummyScale.set(sStilt, sStilt, sStilt);
        dummyPos.copy(hitPoint).addScaledVector(pDir, -0.04);
        dummyMat4.compose(dummyPos, dummyQuat, dummyScale);
        instStiltShacks.setMatrixAt(counts.stiltShack, dummyMat4);
        state.propsList.push({ mesh: instStiltShacks, index: counts.stiltShack, dir: pDir.clone(), basePos: dummyPos.clone(), scale: dummyScale.clone(), quat: dummyQuat.clone() });
        counts.stiltShack++;

        state.colliders.push({ dir: pDir.clone(), pos: dummyPos.clone(), angRad: angR, cosRad: Math.cos(angR), type: "stilt", blocksProjectiles: true });
        acceptedProps.push({ dir: pDir.clone(), angRad: angR });
      } else if (roll < 0.52 && counts.swampLog < MAX_SWAMP_LOGS) {
        var sSL = 0.85 + Math.random() * 0.35;
        var angR = (0.42 * sSL) / PLANET_BASE_RADIUS;
        if (isCandidateTooClose(pDir, angR)) continue;

        dummyScale.set(sSL, sSL, sSL);
        dummyPos.copy(hitPoint).addScaledVector(pDir, -0.04);
        dummyMat4.compose(dummyPos, dummyQuat, dummyScale);
        instSwampLogs.setMatrixAt(counts.swampLog, dummyMat4);
        counts.swampLog++;

        state.colliders.push({ dir: pDir.clone(), pos: dummyPos.clone(), angRad: angR, cosRad: Math.cos(angR), type: "swamplog", blocksProjectiles: false });
        acceptedProps.push({ dir: pDir.clone(), angRad: angR });
      } else if (roll < 0.76 && counts.toxicBarrel < MAX_TOXIC_BARRELS) {
        var sTB = 0.85 + Math.random() * 0.35;
        var angR = (0.35 * sTB) / PLANET_BASE_RADIUS;
        if (isCandidateTooClose(pDir, angR)) continue;

        dummyScale.set(sTB, sTB, sTB);
        dummyPos.copy(hitPoint).addScaledVector(pDir, -0.04);
        dummyMat4.compose(dummyPos, dummyQuat, dummyScale);
        instToxicBarrels.setMatrixAt(counts.toxicBarrel, dummyMat4);
        counts.toxicBarrel++;

        state.colliders.push({ dir: pDir.clone(), pos: dummyPos.clone(), angRad: angR, cosRad: Math.cos(angR), type: "toxicbarrel", blocksProjectiles: true });
        acceptedProps.push({ dir: pDir.clone(), angRad: angR });

        // Partículas de vapor esverdeado subindo sobre o pântano
        if (state.swampVapors.length < 16 && Math.random() < 0.30) {
          var vaporMesh = new THREE.Mesh(
            new THREE.DodecahedronGeometry(0.08, 0),
            new THREE.MeshBasicMaterial({ color: 0x86efac, transparent: true, opacity: 0.45 })
          );
          vaporMesh.position.copy(dummyPos).addScaledVector(pDir, 0.25);
          state.planetGroup.add(vaporMesh);
          state.swampVapors.push({
            mesh: vaporMesh,
            basePos: dummyPos.clone().addScaledVector(pDir, 0.25),
            dir: pDir.clone(),
            life: Math.random() * 2.5,
            maxLife: 3.0
          });
        }
      } else if (counts.deadReed < MAX_DEAD_REEDS) {
        var sReed = 0.8 + Math.random() * 0.4;
        var angR = (0.30 * sReed) / PLANET_BASE_RADIUS;
        if (isCandidateTooClose(pDir, angR)) continue;

        dummyScale.set(sReed, sReed, sReed);
        dummyPos.copy(hitPoint).addScaledVector(pDir, -0.02);
        dummyMat4.compose(dummyPos, dummyQuat, dummyScale);
        instDeadReeds.setMatrixAt(counts.deadReed, dummyMat4);
        counts.deadReed++;
        acceptedProps.push({ dir: pDir.clone(), angRad: angR });
      }
    }

    // ---------------------------------------------------------
    // BIOMA 6: ZONA GELADA
    // ---------------------------------------------------------
    else if (biome.id === "frozen") {
      if (roll < 0.34 && counts.pine < MAX_PINES) {
        var sPine = 0.85 + Math.random() * 0.5;
        var angR = (0.38 * sPine) / PLANET_BASE_RADIUS;
        if (isCandidateTooClose(pDir, angR)) continue;

        dummyScale.set(sPine, sPine, sPine);
        dummyPos.copy(hitPoint).addScaledVector(pDir, -0.04);
        dummyMat4.compose(dummyPos, dummyQuat, dummyScale);
        instPines.setMatrixAt(counts.pine, dummyMat4);
        state.propsList.push({ mesh: instPines, index: counts.pine, dir: pDir.clone(), basePos: dummyPos.clone(), scale: dummyScale.clone(), quat: dummyQuat.clone() });
        counts.pine++;

        state.colliders.push({ dir: pDir.clone(), pos: dummyPos.clone(), angRad: angR, cosRad: Math.cos(angR), type: "pine", blocksProjectiles: true });
        acceptedProps.push({ dir: pDir.clone(), angRad: angR });
      } else if (roll < 0.55 && counts.cabin < MAX_CABINS) {
        var sCab = 0.85 + Math.random() * 0.4;
        var angR = (0.75 * sCab) / PLANET_BASE_RADIUS;
        if (isCandidateTooClose(pDir, angR)) continue;

        dummyScale.set(sCab, sCab, sCab);
        dummyPos.copy(hitPoint).addScaledVector(pDir, -0.04);
        dummyMat4.compose(dummyPos, dummyQuat, dummyScale);
        instCabins.setMatrixAt(counts.cabin, dummyMat4);
        state.propsList.push({ mesh: instCabins, index: counts.cabin, dir: pDir.clone(), basePos: dummyPos.clone(), scale: dummyScale.clone(), quat: dummyQuat.clone() });
        counts.cabin++;

        state.colliders.push({ dir: pDir.clone(), pos: dummyPos.clone(), angRad: angR, cosRad: Math.cos(angR), type: "cabin", blocksProjectiles: true });
        acceptedProps.push({ dir: pDir.clone(), angRad: angR });
      } else if (roll < 0.74 && counts.iceBlock < MAX_ICE_BLOCKS) {
        var sIce = 0.8 + Math.random() * 0.5;
        var angR = (0.50 * sIce) / PLANET_BASE_RADIUS;
        if (isCandidateTooClose(pDir, angR)) continue;

        dummyScale.set(sIce, sIce, sIce);
        dummyPos.copy(hitPoint).addScaledVector(pDir, -0.04);
        dummyMat4.compose(dummyPos, dummyQuat, dummyScale);
        instIceBlocks.setMatrixAt(counts.iceBlock, dummyMat4);
        state.propsList.push({ mesh: instIceBlocks, index: counts.iceBlock, dir: pDir.clone(), basePos: dummyPos.clone(), scale: dummyScale.clone(), quat: dummyQuat.clone() });
        counts.iceBlock++;

        state.colliders.push({ dir: pDir.clone(), pos: dummyPos.clone(), angRad: angR, cosRad: Math.cos(angR), type: "ice", blocksProjectiles: true });
        acceptedProps.push({ dir: pDir.clone(), angRad: angR });
      } else if (roll < 0.88 && counts.snowCar < MAX_SNOW_CARS) {
        var sSCar = 0.85 + Math.random() * 0.35;
        var angR = (0.65 * sSCar) / PLANET_BASE_RADIUS;
        if (isCandidateTooClose(pDir, angR)) continue;

        dummyScale.set(sSCar, sSCar, sSCar);
        dummyPos.copy(hitPoint).addScaledVector(pDir, -0.04);
        dummyMat4.compose(dummyPos, dummyQuat, dummyScale);
        instSnowCars.setMatrixAt(counts.snowCar, dummyMat4);
        counts.snowCar++;

        state.colliders.push({ dir: pDir.clone(), pos: dummyPos.clone(), angRad: angR, cosRad: Math.cos(angR), type: "snowcar", blocksProjectiles: true });
        acceptedProps.push({ dir: pDir.clone(), angRad: angR });
      } else if (counts.snowFence < MAX_SNOW_FENCES) {
        var sSF = 0.8 + Math.random() * 0.35;
        var angR = (0.40 * sSF) / PLANET_BASE_RADIUS;
        if (isCandidateTooClose(pDir, angR)) continue;

        dummyScale.set(sSF, sSF, sSF);
        dummyPos.copy(hitPoint).addScaledVector(pDir, -0.03);
        dummyMat4.compose(dummyPos, dummyQuat, dummyScale);
        instSnowFences.setMatrixAt(counts.snowFence, dummyMat4);
        counts.snowFence++;
        acceptedProps.push({ dir: pDir.clone(), angRad: angR });
      }
    }
  }

  // Notifica atualizações nas matrizes instanciadas
  var allInsts = [
    instHouses, instCars, instPoles, instFences, instWaterTanks, instStreetSigns,
    instDeadTrees, instStumps, instFallenLogs, instBarbedWire, instCampfires,
    instIndustrialTanks, instPipes, instContainers, instForklifts, instScaffolds, instBurningBarrels,
    instBuses, instGiantBones, instBuriedDebris, instPowerPylons,
    instStiltShacks, instSwampLogs, instToxicBarrels, instDeadReeds,
    instPines, instSnowCars, instCabins, instIceBlocks, instSnowFences
  ];

  for (var k = 0; k < allInsts.length; k++) {
    allInsts[k].instanceMatrix.needsUpdate = true;
  }

  // Verificação pós-posicionamento para nivelamento estrito
  verifyPropPlacement();
}

// -------------------------------------------------------------
// ATUALIZAÇÃO CONTÍNUA DOS PROPS E HUD DE BIOMA
// -------------------------------------------------------------
export function updateProps(dt) {
  var time = performance.now() * 0.001;

  // Animação das luzes dos barris industriais em chamas
  if (state.burningBarrels) {
    for (var bIdx = 0; bIdx < state.burningBarrels.length; bIdx++) {
      var bb = state.burningBarrels[bIdx];
      bb.light.intensity = 1.3 + Math.sin(time * 16.0 + bIdx * 2.0) * 0.45 + (Math.random() - 0.5) * 0.15;
    }
  }

  // Animação das partículas de vapor esverdeado no pântano
  if (state.swampVapors) {
    for (var vi = 0; vi < state.swampVapors.length; vi++) {
      var vp = state.swampVapors[vi];
      vp.life += dt;
      vp.mesh.position.addScaledVector(vp.dir, 0.002);
      var scale = 1.0 + Math.sin(vp.life * 2.0) * 0.3;
      vp.mesh.scale.set(scale, scale, scale);
      if (vp.life >= vp.maxLife) {
        vp.life = 0;
        vp.mesh.position.copy(vp.basePos);
      }
    }
  }

  // Atualização do Bioma Atual no HUD (disparada só quando state.currentBiome mudar)
  var playerDir = state.playerLocalDir || new THREE.Vector3(0, 1, 0);
  var curBiome = getBiomeAt(playerDir);
  if (state.currentBiome !== curBiome.id) {
    state.currentBiome = curBiome.id;
    state.currentBiomeName = curBiome.name;
    var biomeColor = curBiome.id === "frozen" ? "#93c5fd" :
                     curBiome.id === "swamp" ? "#86efac" :
                     curBiome.id === "desert" ? "#fde047" :
                     curBiome.id === "industrial" ? "#fb923c" :
                     curBiome.id === "forest" ? "#a3e635" : "#e2e8f0";
    updateBiomeUI(curBiome.icon, curBiome.name, biomeColor);
  }
}
