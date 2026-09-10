// O que faz: Fornece utilitários matemáticos, geração de ruído 3D procedural, relevo e distribuição na esfera.
// Exporta: hash3D, smooth, valueNoise3D, fbm3D, getRawElevation, getMoisture, getStepIndex, radiusAt, sphDir, fibonacciPoint.
// Depende de: js/config.js

import {
  PLANET_BASE_RADIUS,
  WATER_RADIUS,
  SEA_LEVEL,
  STEP_HEIGHT,
  TOTAL_STEPS,
  ELEV_FREQ,
  ELEV_OFFSET_X,
  ELEV_OFFSET_Y,
  ELEV_OFFSET_Z,
  MOIST_FREQ,
  MOIST_OFFSET_X,
  MOIST_OFFSET_Y,
  MOIST_OFFSET_Z
} from "../config.js";

export function hash3D(x, y, z) {
  var n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

export function smooth(t) {
  return t * t * (3 - 2 * t);
}

export function valueNoise3D(x, y, z) {
  var ix = Math.floor(x);
  var iy = Math.floor(y);
  var iz = Math.floor(z);
  var fx = x - ix;
  var fy = y - iy;
  var fz = z - iz;

  var ux = smooth(fx);
  var uy = smooth(fy);
  var uz = smooth(fz);

  var n000 = hash3D(ix, iy, iz);
  var n100 = hash3D(ix + 1, iy, iz);
  var n010 = hash3D(ix, iy + 1, iz);
  var n110 = hash3D(ix + 1, iy + 1, iz);
  var n001 = hash3D(ix, iy, iz + 1);
  var n101 = hash3D(ix + 1, iy, iz + 1);
  var n011 = hash3D(ix, iy + 1, iz + 1);
  var n111 = hash3D(ix + 1, iy + 1, iz + 1);

  var nx00 = n000 * (1 - ux) + n100 * ux;
  var nx10 = n010 * (1 - ux) + n110 * ux;
  var nx01 = n001 * (1 - ux) + n101 * ux;
  var nx11 = n011 * (1 - ux) + n111 * ux;

  var nxy0 = nx00 * (1 - uy) + nx10 * uy;
  var nxy1 = nx01 * (1 - uy) + nx11 * uy;

  return nxy0 * (1 - uz) + nxy1 * uz;
}

export function fbm3D(x, y, z) {
  var total = 0;
  var amp = 0.52;
  var freq = 1.0;
  for (var i = 0; i < 3; i++) {
    total += amp * valueNoise3D(x * freq, y * freq, z * freq);
    freq *= 2.0;
    amp *= 0.5;
  }
  return total;
}

export function getRawElevation(dir) {
  return fbm3D(
    dir.x * ELEV_FREQ + ELEV_OFFSET_X,
    dir.y * ELEV_FREQ + ELEV_OFFSET_Y,
    dir.z * ELEV_FREQ + ELEV_OFFSET_Z
  );
}

export function getMoisture(dir) {
  return fbm3D(
    dir.x * MOIST_FREQ + MOIST_OFFSET_X,
    dir.y * MOIST_FREQ + MOIST_OFFSET_Y,
    dir.z * MOIST_FREQ + MOIST_OFFSET_Z
  );
}

export function getStepIndex(input) {
  var rawElev = (input && typeof input === "object" && ("x" in input || "isVector3" in input)) ? getRawElevation(input) : input;
  if (rawElev < SEA_LEVEL) return -1;
  var h = Math.max(0, Math.min(1, (rawElev - SEA_LEVEL) / 0.44));
  var step = Math.floor(h * TOTAL_STEPS);
  if (step >= TOTAL_STEPS) step = TOTAL_STEPS - 1;
  return step;
}

export function radiusAt(dir) {
  var rawElev = getRawElevation(dir);
  var step = getStepIndex(rawElev);
  if (step < 0) {
    return WATER_RADIUS;
  }
  return PLANET_BASE_RADIUS + step * STEP_HEIGHT;
}

export function sphDir(theta, phi) {
  return new THREE.Vector3(
    Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta)
  ).normalize();
}

export function fibonacciPoint(i, total) {
  var goldenRatio = (1 + Math.sqrt(5)) / 2;
  var theta = 2 * Math.PI * i / goldenRatio;
  var phi = Math.acos(1 - 2 * (i + 0.5) / total);
  return sphDir(theta, phi);
}
