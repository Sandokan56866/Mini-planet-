// O que faz: Sistema de áudio com motor de efeitos sonoros procedural (Web Audio API pura) e ambiência sutil de vento.
// Não possui trilha musical. Sons curtos, discretos, sem sustain, com limite estrito de 8 vozes e controle de mudo.
// Exporta: initAudioSystem, startMusic, stopMusic, startAmbience, stopAmbience, updateAudio, toggleMute, isMuted, setMuted,
// playShootSound, playHitSound, playEnemyDeathSound, playXpSound, playLevelUpSound, playChestOpenSound, playPlayerHurtSound,
// playBossSpawnSound, playExplosionSound, playMinePlantSound, playDeploySound, playWoodBreakSound.
// Depende de: js/config.js, js/state.js

import {
  AUDIO_MASTER_VOLUME,
  AUDIO_SFX_VOLUME,
  AUDIO_MAX_SIMULTANEOUS_SFX,
  AMBIENT_DAY_VOLUME,
  AMBIENT_NIGHT_VOLUME,
  AMBIENT_DAY_FILTER_FREQ,
  AMBIENT_NIGHT_FILTER_FREQ,
  SHOOT_SOUND_CONFIG
} from "../config.js";
import { state } from "../state.js";

// ==========================================
// 1. ESTADO INTERNO DO SISTEMA DE ÁUDIO
// ==========================================
var audioCtx = null;
var masterGainNode = null;
var sfxMasterGain = null;

var isAudioMuted = false;
var activeSfxCount = 0;

// Ambiência contínua de vento (ruído rosa sintetizado)
var ambientSource = null;
var ambientFilter = null;
var ambientGain = null;
var isAmbienceRunning = false;
var ambientNoiseBuffer = null;

// Controle de intervalo mínimo entre tiros
var lastShootTimeMs = 0;

// Cache de ruídos sintéticos curtos para performance
var whiteNoiseBufferCache = null;

// Escala suave para orbes de XP consecutivos
var XP_SCALE = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66, 1318.51];
var xpChainCount = 0;
var lastXpTime = 0;

// ==========================================
// 2. INICIALIZAÇÃO DO AUDIOCONTEXT
// ==========================================
export function initAudioSystem() {
  if (!audioCtx) {
    var AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }

  if (audioCtx) {
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    if (!masterGainNode) {
      masterGainNode = audioCtx.createGain();
      masterGainNode.gain.setValueAtTime(isAudioMuted ? 0.0001 : AUDIO_MASTER_VOLUME, audioCtx.currentTime);
      masterGainNode.connect(audioCtx.destination);

      // Barramento de Efeitos Sonoros
      sfxMasterGain = audioCtx.createGain();
      sfxMasterGain.gain.setValueAtTime(AUDIO_SFX_VOLUME, audioCtx.currentTime);
      sfxMasterGain.connect(masterGainNode);
    }
  }

  state.audioCtx = audioCtx;

  // Carrega preferência de mudo salva
  try {
    var savedMute = localStorage.getItem("lp3d_audio_muted");
    if (savedMute !== null) {
      setMuted(savedMute === "true");
    }
  } catch (e) {}

  return audioCtx;
}

export function isMuted() {
  return isAudioMuted;
}

export function setMuted(mute) {
  isAudioMuted = !!mute;
  if (masterGainNode && audioCtx) {
    var targetVol = isAudioMuted ? 0.0001 : AUDIO_MASTER_VOLUME;
    masterGainNode.gain.setTargetAtTime(targetVol, audioCtx.currentTime, 0.04);
  }
  try {
    localStorage.setItem("lp3d_audio_muted", isAudioMuted ? "true" : "false");
  } catch (e) {}

  if (state.ui?.updateMuteButtonUI) {
    state.ui.updateMuteButtonUI(isAudioMuted);
  }
}

export function toggleMute() {
  setMuted(!isAudioMuted);
  return isAudioMuted;
}

// ==========================================
// 3. AMBIÊNCIA SUTIL (VENTO VIA RUÍDO ROSA)
// ==========================================

// Gerador procedural de Ruído Rosa (algoritmo de Paul Kellet)
function createPinkNoiseBuffer(ctx, duration) {
  var sampleRate = ctx.sampleRate;
  var bufferSize = Math.floor(sampleRate * duration);
  var buffer = ctx.createBuffer(1, bufferSize, sampleRate);
  var data = buffer.getChannelData(0);

  var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (var i = 0; i < bufferSize; i++) {
    var white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.06;
    b6 = white * 0.115926;
  }
  return buffer;
}

// Gerador de ruído branco curto reutilizável
function getWhiteNoiseBuffer(ctx) {
  if (whiteNoiseBufferCache) return whiteNoiseBufferCache;
  var sampleRate = ctx.sampleRate;
  var bufferSize = Math.floor(sampleRate * 0.12);
  var buffer = ctx.createBuffer(1, bufferSize, sampleRate);
  var data = buffer.getChannelData(0);
  for (var i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  whiteNoiseBufferCache = buffer;
  return buffer;
}

export function startAmbience() {
  initAudioSystem();
  if (!audioCtx || isAmbienceRunning) return;

  var now = audioCtx.currentTime;

  if (!ambientNoiseBuffer) {
    ambientNoiseBuffer = createPinkNoiseBuffer(audioCtx, 4.0);
  }

  ambientSource = audioCtx.createBufferSource();
  ambientSource.buffer = ambientNoiseBuffer;
  ambientSource.loop = true;

  // Filtro passa-baixa para o vento suave
  ambientFilter = audioCtx.createBiquadFilter();
  ambientFilter.type = "lowpass";
  ambientFilter.frequency.setValueAtTime(AMBIENT_DAY_FILTER_FREQ, now);
  ambientFilter.Q.setValueAtTime(0.7, now);

  // Ganho da ambiência: bem discreto, quase subliminar
  ambientGain = audioCtx.createGain();
  ambientGain.gain.setValueAtTime(0.0001, now);
  ambientGain.gain.linearRampToValueAtTime(AMBIENT_DAY_VOLUME, now + 2.5);

  ambientSource.connect(ambientFilter);
  ambientFilter.connect(ambientGain);
  ambientGain.connect(masterGainNode);

  try {
    ambientSource.start(now);
    isAmbienceRunning = true;
  } catch (e) {}
}

export function stopAmbience() {
  if (!isAmbienceRunning || !ambientGain || !audioCtx) return;
  var now = audioCtx.currentTime;
  try {
    ambientGain.gain.linearRampToValueAtTime(0.0001, now + 0.8);
    setTimeout(function () {
      try {
        if (ambientSource) ambientSource.stop();
      } catch (e) {}
      ambientSource = null;
      ambientFilter = null;
      ambientGain = null;
      isAmbienceRunning = false;
    }, 900);
  } catch (e) {
    isAmbienceRunning = false;
  }
}

// Aliases para compatibilidade total com chamadas existentes
export const startMusic = startAmbience;
export const stopMusic = stopAmbience;

// Atualização suave da ambiência de vento (sem música)
export function updateAudio(dt) {
  if (!audioCtx || !isAmbienceRunning || !ambientGain || !ambientFilter) return;

  var now = audioCtx.currentTime;
  var isNight = (state.dayNightPhase === "night" || state.dayNightPhase === "sunset");

  // Modulação lenta de volume para simular rajadas suaves de brisa sem soar estático
  var slowLfo = Math.sin(now * 0.22) * 0.004 + Math.cos(now * 0.09) * 0.002;
  var baseVol = isNight ? AMBIENT_NIGHT_VOLUME : AMBIENT_DAY_VOLUME;
  var targetVol = Math.max(0.001, baseVol + slowLfo);
  ambientGain.gain.setTargetAtTime(targetVol, now, 0.8);

  // À noite: levemente mais grave e abafado
  var targetCutoff = isNight ? AMBIENT_NIGHT_FILTER_FREQ : AMBIENT_DAY_FILTER_FREQ;
  ambientFilter.frequency.setTargetAtTime(targetCutoff, now, 1.2);
}

// ==========================================
// 4. MOTOR DE EFEITOS SONOROS (MÁXIMO 8 VOZES)
// ==========================================
function beginSfxVoice() {
  if (!audioCtx || isAudioMuted) return false;
  if (activeSfxCount >= AUDIO_MAX_SIMULTANEOUS_SFX) {
    return false; // Descarta sons excedentes para prevenir sobreposição incômoda
  }
  activeSfxCount++;
  return true;
}

function releaseSfxVoice(duration) {
  setTimeout(function () {
    activeSfxCount = Math.max(0, activeSfxCount - 1);
  }, Math.max(20, (duration || 0.08) * 1000));
}

// =========================================================================
// 4.1. SOM DE TIRO: 3 CAMADAS CURTAS (<90ms total, sem sustain, envelope seco)
// =========================================================================
export function playShootSound(weaponId) {
  var nowMs = performance.now();
  // Se dois disparos ocorrerem em menos de 40ms, toca apenas um
  if (nowMs - lastShootTimeMs < SHOOT_SOUND_CONFIG.minIntervalMs) {
    return;
  }
  lastShootTimeMs = nowMs;

  if (!beginSfxVoice()) return;

  var now = audioCtx.currentTime;
  var cfg = SHOOT_SOUND_CONFIG;

  // Variação aleatória de ±8% no tom a cada disparo
  var pitchMod = 1.0 + (Math.random() * (cfg.pitchVariation * 2) - cfg.pitchVariation);

  // Multiplicador de volume geral do tiro (~0.18 do volume de efeitos)
  var shotVolMult = cfg.volumeRatio;
  if (weaponId === "machinegun") {
    shotVolMult *= cfg.machinegunVolumeMult; // Mais baixo por tiro devido à alta cadência
  } else if (weaponId === "rifle") {
    shotVolMult *= 1.15;
  } else if (weaponId === "shotgun") {
    shotVolMult *= 1.20;
  }

  var shotBus = audioCtx.createGain();
  shotBus.gain.setValueAtTime(shotVolMult, now);
  shotBus.connect(sfxMasterGain);

  var noiseBuf = getWhiteNoiseBuffer(audioCtx);

  // CAMADA A: ESTALO INICIAL (~15ms)
  // Ruído branco muito curto com ataque de 2ms e decaimento exponencial rápido
  var snapSource = audioCtx.createBufferSource();
  snapSource.buffer = noiseBuf;

  var snapGain = audioCtx.createGain();
  snapGain.gain.setValueAtTime(0.0001, now);
  snapGain.gain.linearRampToValueAtTime(cfg.snapVolume, now + 0.002);
  snapGain.gain.exponentialRampToValueAtTime(0.0001, now + cfg.snapDuration);

  snapSource.connect(snapGain);
  snapGain.connect(shotBus);
  snapSource.start(now);
  snapSource.stop(now + cfg.snapDuration + 0.005);

  // CAMADA B: CORPO GRAVE (~60ms)
  // Oscilador senoidal caindo de ~180Hz para ~40Hz com ataque de 2ms e decaimento exponencial
  var bodyOsc = audioCtx.createOscillator();
  bodyOsc.type = "sine";
  var startF = cfg.bodyStartFreq * pitchMod;
  var endF = cfg.bodyEndFreq * pitchMod;
  bodyOsc.frequency.setValueAtTime(startF, now);
  bodyOsc.frequency.exponentialRampToValueAtTime(Math.max(10, endF), now + cfg.bodyDuration);

  var bodyGain = audioCtx.createGain();
  bodyGain.gain.setValueAtTime(0.0001, now);
  bodyGain.gain.linearRampToValueAtTime(cfg.bodyVolume, now + 0.002);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + cfg.bodyDuration);

  bodyOsc.connect(bodyGain);
  bodyGain.connect(shotBus);
  bodyOsc.start(now);
  bodyOsc.stop(now + cfg.bodyDuration + 0.005);

  // CAMADA C: CAUDA (~80ms)
  // Ruído filtrado por passa-baixa, bem mais baixo que as outras camadas, sem sustain
  var tailSource = audioCtx.createBufferSource();
  tailSource.buffer = noiseBuf;

  var tailFilter = audioCtx.createBiquadFilter();
  tailFilter.type = "lowpass";
  tailFilter.frequency.setValueAtTime(cfg.tailFilterFreq * pitchMod, now);

  var tailGain = audioCtx.createGain();
  tailGain.gain.setValueAtTime(0.0001, now);
  tailGain.gain.linearRampToValueAtTime(cfg.tailVolume, now + 0.002);
  tailGain.gain.exponentialRampToValueAtTime(0.0001, now + cfg.tailDuration);

  tailSource.connect(tailFilter);
  tailFilter.connect(tailGain);
  tailGain.connect(shotBus);
  tailSource.start(now);
  tailSource.stop(now + cfg.tailDuration + 0.005);

  // Total do tiro < 90ms (libera a voz em 85ms)
  releaseSfxVoice(0.085);
}

// =========================================================================
// 4.2. DEMAIS EFEITOS SONOROS (Curtos, discretos e sem sustain)
// =========================================================================

// Impacto no zumbi: estalo seco e abafado (~35ms)
export function playHitSound() {
  if (!beginSfxVoice()) return;
  var now = audioCtx.currentTime;

  var osc = audioCtx.createOscillator();
  var gain = audioCtx.createGain();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(210, now);
  osc.frequency.exponentialRampToValueAtTime(60, now + 0.035);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.10, now + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

  osc.connect(gain);
  gain.connect(sfxMasterGain);
  osc.start(now);
  osc.stop(now + 0.04);
  releaseSfxVoice(0.04);
}

// Morte do zumbi: dissipação grave rápida (~65ms)
export function playEnemyDeathSound() {
  if (!beginSfxVoice()) return;
  var now = audioCtx.currentTime;

  var osc = audioCtx.createOscillator();
  var gain = audioCtx.createGain();

  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(115, now);
  osc.frequency.exponentialRampToValueAtTime(32, now + 0.065);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.11, now + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);

  osc.connect(gain);
  gain.connect(sfxMasterGain);
  osc.start(now);
  osc.stop(now + 0.07);
  releaseSfxVoice(0.07);
}

// Coleta de XP: estalo cristalino muito curto (~45ms)
export function playXpSound() {
  if (!beginSfxVoice()) return;
  var now = audioCtx.currentTime;

  if (now - lastXpTime > 0.8) {
    xpChainCount = 0;
  } else {
    xpChainCount++;
  }
  lastXpTime = now;

  var freq = XP_SCALE[Math.min(xpChainCount, XP_SCALE.length - 1)];

  var osc = audioCtx.createOscillator();
  var gain = audioCtx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.09, now + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

  osc.connect(gain);
  gain.connect(sfxMasterGain);
  osc.start(now);
  osc.stop(now + 0.05);
  releaseSfxVoice(0.05);
}

// Subida de nível: fanfarra curta (~140ms total)
export function playLevelUpSound() {
  if (!beginSfxVoice()) return;
  var now = audioCtx.currentTime;
  var notes = [440, 554.37, 659.25];

  for (var i = 0; i < notes.length; i++) {
    var t = now + i * 0.045;
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(notes[i], t);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);

    osc.connect(gain);
    gain.connect(sfxMasterGain);
    osc.start(t);
    osc.stop(t + 0.06);
  }
  releaseSfxVoice(0.16);
}

// Abertura de baú / Coleta de arma (~70ms)
export function playChestOpenSound() {
  if (!beginSfxVoice()) return;
  var now = audioCtx.currentTime;

  var osc = audioCtx.createOscillator();
  var gain = audioCtx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(440, now);
  osc.frequency.exponentialRampToValueAtTime(880, now + 0.065);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.12, now + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);

  osc.connect(gain);
  gain.connect(sfxMasterGain);
  osc.start(now);
  osc.stop(now + 0.07);
  releaseSfxVoice(0.07);
}

// Dano sofrido pelo jogador: impacto seco grave (~75ms)
export function playPlayerHurtSound() {
  if (!beginSfxVoice()) return;
  var now = audioCtx.currentTime;

  var osc = audioCtx.createOscillator();
  var gain = audioCtx.createGain();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(140, now);
  osc.frequency.exponentialRampToValueAtTime(35, now + 0.075);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.16, now + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);

  osc.connect(gain);
  gain.connect(sfxMasterGain);
  osc.start(now);
  osc.stop(now + 0.08);
  releaseSfxVoice(0.08);
}

// Rugido de chefe: impacto grave contido (~240ms)
export function playBossSpawnSound() {
  if (!beginSfxVoice()) return;
  var now = audioCtx.currentTime;

  var osc = audioCtx.createOscillator();
  var filter = audioCtx.createBiquadFilter();
  var gain = audioCtx.createGain();

  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(75, now);
  osc.frequency.linearRampToValueAtTime(40, now + 0.22);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(260, now);
  filter.frequency.linearRampToValueAtTime(90, now + 0.22);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.20, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.23);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(sfxMasterGain);
  osc.start(now);
  osc.stop(now + 0.24);
  releaseSfxVoice(0.24);
}

// Explosão de mina / bomba (~150ms)
export function playExplosionSound() {
  if (!beginSfxVoice()) return;
  var now = audioCtx.currentTime;

  var osc = audioCtx.createOscillator();
  var gain = audioCtx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(130, now);
  osc.frequency.exponentialRampToValueAtTime(25, now + 0.14);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.22, now + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

  osc.connect(gain);
  gain.connect(sfxMasterGain);
  osc.start(now);
  osc.stop(now + 0.15);
  releaseSfxVoice(0.15);
}

// Plantio de mina (~40ms)
export function playMinePlantSound() {
  if (!beginSfxVoice()) return;
  var now = audioCtx.currentTime;

  var osc = audioCtx.createOscillator();
  var gain = audioCtx.createGain();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(320, now);
  osc.frequency.exponentialRampToValueAtTime(480, now + 0.04);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.09, now + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

  osc.connect(gain);
  gain.connect(sfxMasterGain);
  osc.start(now);
  osc.stop(now + 0.045);
  releaseSfxVoice(0.045);
}

// Instalação de dispositivo / torreta (~50ms)
export function playDeploySound() {
  if (!beginSfxVoice()) return;
  var now = audioCtx.currentTime;

  var osc = audioCtx.createOscillator();
  var gain = audioCtx.createGain();

  osc.type = "square";
  osc.frequency.setValueAtTime(200, now);
  osc.frequency.exponentialRampToValueAtTime(310, now + 0.05);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.08, now + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

  osc.connect(gain);
  gain.connect(sfxMasterGain);
  osc.start(now);
  osc.stop(now + 0.055);
  releaseSfxVoice(0.055);
}

// Quebra de barreira (~65ms)
export function playWoodBreakSound() {
  if (!beginSfxVoice()) return;
  var now = audioCtx.currentTime;

  var osc = audioCtx.createOscillator();
  var gain = audioCtx.createGain();

  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(95, now);
  osc.frequency.exponentialRampToValueAtTime(30, now + 0.065);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.10, now + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);

  osc.connect(gain);
  gain.connect(sfxMasterGain);
  osc.start(now);
  osc.stop(now + 0.07);
  releaseSfxVoice(0.07);
}
