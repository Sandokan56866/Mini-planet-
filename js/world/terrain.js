// O que faz: Constrói a malha de relevo planetário escalonado, biomas apocalípticos e o oceano tóxico.
// Exporta: initTerrain, getApocalypseBiomeColor, getBiomeAt.
// Depende de: js/config.js, js/state.js, js/core/math.js

import {
  PLANET_BASE_RADIUS,
  WATER_RADIUS,
  BIOME_COLORS,
  BIOMES_CONFIG,
  SECTOR_FREQ,
  SECTOR_OFFSET_X,
  SECTOR_OFFSET_Y,
  SECTOR_OFFSET_Z,
  CLIFF_SLOPE_THRESHOLD,
  CLIFF_DARKEN_FACTOR
} from "../config.js";
import { state } from "../state.js";
import {
  getRawElevation,
  getMoisture,
  getStepIndex,
  radiusAt,
  fbm3D
} from "../core/math.js";

// Determina com precisão o bioma em qualquer coordenada esférica normalizada
export function getBiomeAt(dir) {
  var lat = Math.abs(dir.y);
  // Zona Gelada nas regiões polares contínuas
  if (lat > 0.58) {
    return BIOMES_CONFIG.frozen;
  }

  var moist = getMoisture(dir);
  var rawElev = getRawElevation(dir);
  var step = getStepIndex(rawElev);

  // Pântano Tóxico em baixadas úmidas e margens
  if (step <= 1 && moist > 0.44) {
    return BIOMES_CONFIG.swamp;
  }

  // Deserto de Cinzas em regiões áridas amplas
  if (moist < 0.36) {
    return BIOMES_CONFIG.desert;
  }

  // Setorização ampla por ruído de baixa frequência para continentes contínuos
  var sector = fbm3D(
    dir.x * SECTOR_FREQ + SECTOR_OFFSET_X,
    dir.y * SECTOR_FREQ + SECTOR_OFFSET_Y,
    dir.z * SECTOR_FREQ + SECTOR_OFFSET_Z
  );

  if (sector < 0.38) {
    return BIOMES_CONFIG.industrial;
  } else if (sector < 0.68) {
    return BIOMES_CONFIG.suburb;
  } else {
    return BIOMES_CONFIG.forest;
  }
}

export function getApocalypseBiomeColor(dir, step) {
  if (step < 0) {
    return new THREE.Color(BIOME_COLORS.waterBed);
  }

  var lat = Math.abs(dir.y);
  var moist = getMoisture(dir);
  var sector = fbm3D(
    dir.x * SECTOR_FREQ + SECTOR_OFFSET_X,
    dir.y * SECTOR_FREQ + SECTOR_OFFSET_Y,
    dir.z * SECTOR_FREQ + SECTOR_OFFSET_Z
  );

  // 1. Zona Gelada: neve suja e cinza-azulada com transição gradual na borda polar
  if (lat > 0.54) {
    var snowCol = new THREE.Color(BIOME_COLORS.snow);
    if (lat < 0.60) {
      var blend = (lat - 0.54) / 0.06;
      var neighborCol = (sector < 0.5) ? new THREE.Color(BIOME_COLORS.asphalt) : new THREE.Color(BIOME_COLORS.darkEarth);
      return neighborCol.lerp(snowCol, blend);
    }
    return snowCol;
  }

  // 2. Pântano Tóxico: lodo esverdeado e poças escuras em depressões e degraus baixos
  if (step <= 1 && moist > 0.44) {
    var sludgeCol = new THREE.Color(BIOME_COLORS.sludge);
    if (step === 0) {
      sludgeCol.lerp(new THREE.Color(BIOME_COLORS.toxicGreen), 0.32);
    }
    return sludgeCol;
  }

  // 3. Deserto de Cinzas: areia acinzentada e estéril com transição suave
  if (moist < 0.38) {
    var ashCol = new THREE.Color(BIOME_COLORS.ashSand);
    if (moist > 0.34) {
      var desertBlend = (moist - 0.34) / 0.04;
      var targetNeighbor = (sector < 0.5) ? new THREE.Color(BIOME_COLORS.rustConcrete) : new THREE.Color(BIOME_COLORS.asphalt);
      return ashCol.lerp(targetNeighbor, desertBlend);
    }
    return ashCol;
  }

  // 4. Zona Industrial: concreto manchado, tons de ferrugem
  if (sector < 0.38) {
    var indCol = new THREE.Color(BIOME_COLORS.rustConcrete);
    if (sector > 0.34) {
      var indBlend = (sector - 0.34) / 0.04;
      indCol.lerp(new THREE.Color(BIOME_COLORS.asphalt), indBlend);
    }
    return indCol;
  }

  // 5. Subúrbio Arrasado: asfalto rachado e concreto cinza
  if (sector < 0.68) {
    var subCol = new THREE.Color(BIOME_COLORS.asphalt);
    if (sector > 0.64) {
      var subBlend = (sector - 0.64) / 0.04;
      subCol.lerp(new THREE.Color(BIOME_COLORS.darkEarth), subBlend);
    }
    return subCol;
  }

  // 6. Floresta Morta: solo de terra escura com folhas secas
  var forestCol = new THREE.Color(BIOME_COLORS.darkEarth);
  if (moist > 0.52) {
    forestCol.lerp(new THREE.Color(BIOME_COLORS.dryLeaves), 0.35);
  }
  return forestCol;
}

export function initTerrain() {
  // Ativa tone mapping fílmico para comprimir realces e eliminar pontos brancos estourados
  if (state.renderer) {
    state.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    state.renderer.toneMappingExposure = 1.0;
  }

  var planetBaseGeo = new THREE.IcosahedronGeometry(PLANET_BASE_RADIUS, 5);
  var planetNonIndexed = planetBaseGeo.toNonIndexed();
  var posAttr = planetNonIndexed.attributes.position;
  var vertexCount = posAttr.count;

  var colorsArr = new Float32Array(vertexCount * 3);
  var tempV = new THREE.Vector3();
  var tempFaceCentroid = new THREE.Vector3();

  // 1º Passo: Deslocamento escalonado (terraced) dos vértices
  for (var vi = 0; vi < vertexCount; vi++) {
    tempV.fromBufferAttribute(posAttr, vi);
    var uDir = tempV.clone().normalize();
    var r = radiusAt(uDir);
    tempV.copy(uDir.multiplyScalar(r));
    posAttr.setXYZ(vi, tempV.x, tempV.y, tempV.z);
  }
  planetNonIndexed.computeVertexNormals();

  // 2º Passo: Cor plana por face baseada no bioma e inclinação do degrau
  for (var fi = 0; fi < vertexCount; fi += 3) {
    var v0 = new THREE.Vector3().fromBufferAttribute(posAttr, fi);
    var v1 = new THREE.Vector3().fromBufferAttribute(posAttr, fi + 1);
    var v2 = new THREE.Vector3().fromBufferAttribute(posAttr, fi + 2);

    tempFaceCentroid.copy(v0).add(v1).add(v2).multiplyScalar(1 / 3);
    var faceUnit = tempFaceCentroid.clone().normalize();
    var rawElev = getRawElevation(faceUnit);
    var step = getStepIndex(rawElev);
    var fColor = getApocalypseBiomeColor(faceUnit, step);

    var edge1 = v1.clone().sub(v0);
    var edge2 = v2.clone().sub(v0);
    var geoNormal = edge1.cross(edge2).normalize();
    var slope = faceUnit.dot(geoNormal);

    if (slope < CLIFF_SLOPE_THRESHOLD && step >= 0) {
      fColor.multiplyScalar(CLIFF_DARKEN_FACTOR);
    }

    for (var k = 0; k < 3; k++) {
      colorsArr[(fi + k) * 3] = fColor.r;
      colorsArr[(fi + k) * 3 + 1] = fColor.g;
      colorsArr[(fi + k) * 3 + 2] = fColor.b;
    }
  }
  planetNonIndexed.setAttribute("color", new THREE.BufferAttribute(colorsArr, 3));

  var planetMat = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true
  });
  var planetMesh = new THREE.Mesh(planetNonIndexed, planetMat);
  planetMesh.castShadow = true;
  planetMesh.receiveShadow = true;
  state.planetGroup.add(planetMesh);
  state.terrainMesh = planetMesh;

  // Esfera de água turva e tóxica sem reflexo especular para não estourar o PointLight
  var waterGeo = new THREE.SphereGeometry(WATER_RADIUS, 54, 40);
  var waterMat = new THREE.MeshLambertMaterial({
    color: BIOME_COLORS.water,
    transparent: true,
    opacity: 0.88,
    flatShading: false
  });
  var waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.receiveShadow = true;
  state.planetGroup.add(waterMesh);
  state.waterMesh = waterMesh;
}
