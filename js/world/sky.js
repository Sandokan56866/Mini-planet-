// O que faz: Gerencia iluminação dinâmica (ciclo de dia e noite de 200s), sol, névoa, estrelas e fade da lanterna.
// Exporta: initSky, updateSky.
// Depende de: js/config.js, js/state.js, js/core/math.js

import {
  DAY_CYCLE_TOTAL,
  DAY_PHASE_DURATION,
  SUNSET_PHASE_DURATION,
  NIGHT_PHASE_DURATION,
  DAWN_PHASE_DURATION,
  FLASHLIGHT_INTENSITY,
  FLASHLIGHT_FADE_DURATION,
  ASH_COUNT,
  ASH_COLOR,
  ASH_OPACITY,
  ASH_SIZE,
  SMOKE_COLOR,
  SMOKE_OPACITY,
  SMOKE_CLUSTERS_COUNT,
  SMOKE_PUFFS_PER_CLUSTER
} from "../config.js";
import { state } from "../state.js";

// Definição das paletas de cada fase do dia
var colorDaySun = new THREE.Color(0xffeedd);
var colorDayHemiSky = new THREE.Color(0xffeedd);
var colorDayHemiGround = new THREE.Color(0x5a4a3a);
var colorDayBg = new THREE.Color(0xd8cfbc); // Bege-sujo do dia
var colorDayFog = new THREE.Color(0xd8cfbc);

var colorSunsetSun = new THREE.Color(0xff6622); // Sol alaranjado forte no entardecer
var colorSunsetHemiSky = new THREE.Color(0x994433);
var colorSunsetHemiGround = new THREE.Color(0x2a1a14);
var colorSunsetBg = new THREE.Color(0x2d1418);
var colorSunsetFog = new THREE.Color(0x3d2018);

var colorNightSun = new THREE.Color(0x4aa3df); // Lua / luz azulada noturna
var colorNightHemiSky = new THREE.Color(0x223348);
var colorNightHemiGround = new THREE.Color(0x121722);
var colorNightBg = new THREE.Color(0x0e121a); // Fundo noturno que preserva silhuetas
var colorNightFog = new THREE.Color(0x0e121a);

var colorDawnSun = new THREE.Color(0xf59e0b);
var colorDawnHemiSky = new THREE.Color(0xd97706);
var colorDawnHemiGround = new THREE.Color(0x332211);
var colorDawnBg = new THREE.Color(0x451a03);
var colorDawnFog = new THREE.Color(0x6b4226);

// Posições orbitais do sol/lua nas fases
var posDaySun = new THREE.Vector3(24, 45, 28);
var posSunsetSun = new THREE.Vector3(40, 10, -15);
var posNightSun = new THREE.Vector3(-20, 32, -30);
var posDawnSun = new THREE.Vector3(-35, 14, 20);

// Cores temporárias para interpolação contínua
var curSunColor = new THREE.Color();
var curHemiSkyColor = new THREE.Color();
var curHemiGroundColor = new THREE.Color();
var curBgColor = new THREE.Color();
var curFogColor = new THREE.Color();
var curSunPos = new THREE.Vector3();

var starfieldEl = null;

export function initSky() {
  starfieldEl = document.querySelector(".space-starfield");

  // Ativa tone mapping fílmico ACES com compressão de realces
  if (state.renderer) {
    state.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    state.renderer.toneMappingExposure = 1.0;
  }

  // Luz direcional (Sol / Lua)
  var sunLight = new THREE.DirectionalLight(0xffeedd, 1.15);
  sunLight.position.copy(posDaySun);
  sunLight.target.position.set(0, 0, 0);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 1024;
  sunLight.shadow.mapSize.height = 1024;
  sunLight.shadow.camera.near = 15;
  sunLight.shadow.camera.far = 85;
  sunLight.shadow.camera.left = -22;
  sunLight.shadow.camera.right = 22;
  sunLight.shadow.camera.top = 22;
  sunLight.shadow.camera.bottom = -22;
  sunLight.shadow.bias = -0.0006;
  state.scene.add(sunLight);
  state.scene.add(sunLight.target);
  state.sunLight = sunLight;

  // Luz hemisférica ambiente
  var hemiLight = new THREE.HemisphereLight(0xffeedd, 0x5a4a3a, 0.70);
  state.scene.add(hemiLight);
  state.hemiLight = hemiLight;

  // Inicializa a névoa da cena
  state.scene.fog = new THREE.FogExp2(0xd8cfbc, 0.010);
  state.scene.background = new THREE.Color(0xd8cfbc);

  // Partículas de cinzas suspensas na atmosfera
  var ashGeo = new THREE.BufferGeometry();
  var ashPositions = new Float32Array(ASH_COUNT * 3);
  for (var ai = 0; ai < ASH_COUNT; ai++) {
    var ar = 70 + Math.random() * 50;
    var atheta = Math.random() * Math.PI * 2;
    var aphi = Math.acos(Math.random() * 2 - 1);
    ashPositions[ai * 3] = ar * Math.sin(aphi) * Math.cos(atheta);
    ashPositions[ai * 3 + 1] = ar * Math.sin(aphi) * Math.sin(atheta);
    ashPositions[ai * 3 + 2] = ar * Math.cos(aphi);
  }
  ashGeo.setAttribute("position", new THREE.BufferAttribute(ashPositions, 3));
  var ashMat = new THREE.PointsMaterial({
    color: ASH_COLOR,
    size: ASH_SIZE,
    transparent: true,
    opacity: ASH_OPACITY
  });
  var ashPoints = new THREE.Points(ashGeo, ashMat);
  state.scene.add(ashPoints);
  state.ashPoints = ashPoints;

  // Nuvens densas de fumaça e fuligem
  var smokeGroup = new THREE.Group();
  state.scene.add(smokeGroup);
  state.smokeGroup = smokeGroup;

  var smokeMat = new THREE.MeshLambertMaterial({
    color: SMOKE_COLOR,
    flatShading: true,
    transparent: true,
    opacity: SMOKE_OPACITY
  });

  state.smokeClusters = [];
  for (var sci = 0; sci < SMOKE_CLUSTERS_COUNT; sci++) {
    var sGroup = new THREE.Group();
    var sAngle = (sci / SMOKE_CLUSTERS_COUNT) * Math.PI * 2;
    var sRadius = 26.5 + (sci % 2) * 1.2;
    var sElevation = Math.sin(sci * 1.8) * 0.35;
    var sPos = new THREE.Vector3(
      Math.cos(sAngle) * Math.sqrt(1 - sElevation * sElevation),
      sElevation,
      Math.sin(sAngle) * Math.sqrt(1 - sElevation * sElevation)
    ).multiplyScalar(sRadius);

    sGroup.position.copy(sPos);
    for (var pfi = 0; pfi < SMOKE_PUFFS_PER_CLUSTER; pfi++) {
      var puffMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85 + Math.random() * 0.6, 1), smokeMat);
      puffMesh.position.set((Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 1.4);
      sGroup.add(puffMesh);
    }
    smokeGroup.add(sGroup);
    state.smokeClusters.push({ group: sGroup, basePosY: sPos.y, phase: sci * 1.1 });
  }
}

export function updateSky(dt) {
  // 3. Ciclo de Dia e Noite de 200 segundos
  // 70s dia, 20s entardecer, 90s noite, 20s amanhecer
  state.dayNightTimer = (state.dayNightTimer + dt) % DAY_CYCLE_TOTAL;
  var t = state.dayNightTimer;

  var sunIntensity = 1.15;
  var hemiIntensity = 0.70;
  var fogDensity = 0.010;
  var starOpacity = 0.04;
  var phaseName = "day";
  var phaseIcon = "☀️";
  var phaseLabel = "Dia";
  var targetFlashlight = 0.0;

  var tPhase = 0;

  if (t < DAY_PHASE_DURATION) {
    // FASE 1: DIA (0s a 70s)
    phaseName = "day";
    phaseIcon = "☀️";
    phaseLabel = "Dia";
    curSunColor.copy(colorDaySun);
    curHemiSkyColor.copy(colorDayHemiSky);
    curHemiGroundColor.copy(colorDayHemiGround);
    curBgColor.copy(colorDayBg);
    curFogColor.copy(colorDayFog);
    curSunPos.copy(posDaySun);

    sunIntensity = 1.15;
    hemiIntensity = 0.70;
    fogDensity = 0.010;
    starOpacity = 0.04;
    targetFlashlight = 0.0;
  } else if (t < DAY_PHASE_DURATION + SUNSET_PHASE_DURATION) {
    // FASE 2: ENTARDECER (70s a 90s - 20s)
    tPhase = (t - DAY_PHASE_DURATION) / SUNSET_PHASE_DURATION;
    phaseName = "sunset";
    phaseIcon = "🌅";
    phaseLabel = "Ocaso";

    curSunColor.copy(colorDaySun).lerp(colorSunsetSun, tPhase);
    curHemiSkyColor.copy(colorDayHemiSky).lerp(colorSunsetHemiSky, tPhase);
    curHemiGroundColor.copy(colorDayHemiGround).lerp(colorSunsetHemiGround, tPhase);
    curBgColor.copy(colorDayBg).lerp(colorSunsetBg, tPhase);
    curFogColor.copy(colorDayFog).lerp(colorSunsetFog, tPhase);
    curSunPos.copy(posDaySun).lerp(posSunsetSun, tPhase);

    sunIntensity = THREE.MathUtils.lerp(1.15, 0.40, tPhase);
    hemiIntensity = THREE.MathUtils.lerp(0.70, 0.35, tPhase);
    fogDensity = THREE.MathUtils.lerp(0.010, 0.022, tPhase);
    starOpacity = THREE.MathUtils.lerp(0.04, 0.65, tPhase);

    // Lanterna acende suavemente no entardecer
    targetFlashlight = FLASHLIGHT_INTENSITY;
  } else if (t < DAY_PHASE_DURATION + SUNSET_PHASE_DURATION + NIGHT_PHASE_DURATION) {
    // FASE 3: NOITE (90s a 180s - 90s, bem mais longa)
    phaseName = "night";
    phaseIcon = "🌙";
    phaseLabel = "Noite";

    curSunColor.copy(colorNightSun);
    curHemiSkyColor.copy(colorNightHemiSky);
    curHemiGroundColor.copy(colorNightHemiGround);
    curBgColor.copy(colorNightBg);
    curFogColor.copy(colorNightFog);
    curSunPos.copy(posNightSun);

    // Luz azulada lunar suave (0.16) e iluminação ambiente que preserva silhuetas e relevo à distância
    sunIntensity = 0.16;
    hemiIntensity = 0.30;
    fogDensity = 0.015;
    starOpacity = 0.95;

    targetFlashlight = FLASHLIGHT_INTENSITY;
  } else {
    // FASE 4: AMANHECER (180s a 200s - 20s)
    tPhase = (t - (DAY_PHASE_DURATION + SUNSET_PHASE_DURATION + NIGHT_PHASE_DURATION)) / DAWN_PHASE_DURATION;
    phaseName = "dawn";
    phaseIcon = "🌄";
    phaseLabel = "Aurora";

    curSunColor.copy(colorDawnSun).lerp(colorDaySun, tPhase);
    curHemiSkyColor.copy(colorDawnHemiSky).lerp(colorDayHemiSky, tPhase);
    curHemiGroundColor.copy(colorDawnHemiGround).lerp(colorDayHemiGround, tPhase);
    curBgColor.copy(colorDawnBg).lerp(colorDayBg, tPhase);
    curFogColor.copy(colorDawnFog).lerp(colorDayFog, tPhase);
    curSunPos.copy(posDawnSun).lerp(posDaySun, tPhase);

    sunIntensity = THREE.MathUtils.lerp(0.20, 1.15, tPhase);
    hemiIntensity = THREE.MathUtils.lerp(0.18, 0.70, tPhase);
    fogDensity = THREE.MathUtils.lerp(0.035, 0.010, tPhase);
    starOpacity = THREE.MathUtils.lerp(0.85, 0.04, tPhase);

    // Lanterna apaga suavemente no amanhecer
    targetFlashlight = 0.0;
  }

  state.dayNightPhase = phaseName;

  // Aplicação contínua sem saltos
  if (state.sunLight) {
    state.sunLight.color.copy(curSunColor);
    state.sunLight.intensity = sunIntensity;
    state.sunLight.position.copy(curSunPos);
  }

  if (state.hemiLight) {
    state.hemiLight.color.copy(curHemiSkyColor);
    state.hemiLight.groundColor.copy(curHemiGroundColor);
    state.hemiLight.intensity = hemiIntensity;
  }

  if (state.scene) {
    if (state.scene.background) state.scene.background.copy(curBgColor);
    if (state.scene.fog) {
      state.scene.fog.color.copy(curFogColor);
      state.scene.fog.density = fogDensity;
    }
  }

  // Reduz drasticamente qualquer componente especular da água à noite
  if (state.waterMesh && state.waterMesh.material && state.waterMesh.material.specular) {
    if (phaseName === "night") {
      state.waterMesh.material.specular.setHex(0x000000);
      state.waterMesh.material.shininess = 0;
    } else {
      state.waterMesh.material.specular.setHex(0x11221a);
      state.waterMesh.material.shininess = 5;
    }
  }

  // Fade suave de 2 segundos na lanterna
  var fadeSpeed = dt / FLASHLIGHT_FADE_DURATION;
  state.flashlightIntensity = THREE.MathUtils.lerp(state.flashlightIntensity, targetFlashlight, fadeSpeed * 3.5);
  if (state.playerSpotLight) {
    state.playerSpotLight.intensity = state.flashlightIntensity;
  }
  if (state.flashlightHalo && state.flashlightHalo.material) {
    state.flashlightHalo.material.opacity = (state.flashlightIntensity / FLASHLIGHT_INTENSITY) * 0.16;
  }
  state.flashlightEnabled = state.flashlightIntensity > 0.8;

  // Visibilidade das estrelas no fundo
  if (starfieldEl) {
    starfieldEl.style.opacity = starOpacity.toFixed(2);
  }

  // Notifica HUD para indicador compacto de horário no topo
  if (state.ui && state.ui.updateDayNightUI) {
    state.ui.updateDayNightUI(phaseIcon, phaseLabel);
  }

  // Animação da fumaça
  var time = performance.now() * 0.001;
  if (state.smokeGroup) {
    state.smokeGroup.rotation.y += 0.0004;
  }
  for (var c = 0; c < state.smokeClusters.length; c++) {
    var cl = state.smokeClusters[c];
    cl.group.position.y = cl.basePosY + Math.sin(time * 0.8 + cl.phase) * 0.25;
  }
}
