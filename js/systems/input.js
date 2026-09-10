// O que faz: Captura toques na tela, arrasto de câmera orbital monotoque (sem pinça), joystick virtual, bomba [B] e teclado.
// Exporta: initInput, updateInput.
// Depende de: js/config.js, js/state.js

import {
  JOYSTICK_MAX_RADIUS,
  CAM_TOUCH_SENSITIVITY,
  CAM_PITCH_SENSITIVITY,
  CAM_PITCH_MIN,
  CAM_PITCH_MAX,
  CAM_FIXED_DISTANCE,
  INVERT_MOVE_X,
  INVERT_MOVE_Y
} from "../config.js";
import { state } from "../state.js";

var joystickArea = null;
var joystickKnob = null;
var bombBtn = null;

// ==========================================
// 1. INICIALIZAÇÃO DE EVENTOS DE ENTRADA
// ==========================================
export function initInput() {
  joystickArea = document.getElementById("joystick-area");
  joystickKnob = document.getElementById("joystick-knob");
  bombBtn = document.getElementById("btn-bomb");

  // Distância fixa da câmera (sem zoom)
  state.targetCamDistance = CAM_FIXED_DISTANCE;
  state.currentCamDistance = CAM_FIXED_DISTANCE;

  // Teclado (WASD / Setas + Shift para correr, B para lançar Bomba, Esc/P para Pausar)
  window.addEventListener("keydown", function (e) {
    state.keys[e.code] = true;

    // Pausar / Despausar com Esc ou P
    if ((e.code === "Escape" || e.code === "KeyP") && !e.repeat) {
      if (state.ui && state.ui.togglePauseGame) {
        state.ui.togglePauseGame();
      }
    }

    if (e.code === "KeyB" && !e.repeat) {
      if (state.combat && state.combat.triggerBomb) {
        state.combat.triggerBomb();
      }
    }
  });

  window.addEventListener("keyup", function (e) {
    state.keys[e.code] = false;
  });

  // Botão circular da Bomba
  function bindBombButton() {
    bombBtn = document.getElementById("btn-bomb");
    if (bombBtn && !bombBtn.dataset.bound) {
      bombBtn.dataset.bound = "true";
      var onBombTrigger = function (e) {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        if (state.isPaused || state.isGameOver || state.isLevelUpPaused || !state.gameStarted) {
          return;
        }
        if (state.combat && state.combat.triggerBomb) {
          state.combat.triggerBomb();
        }
      };
      bombBtn.addEventListener("click", onBombTrigger);
      bombBtn.addEventListener("touchstart", onBombTrigger, { passive: false });
    }
  }

  bindBombButton();
  // Se o botão for recriado pelo HUD, tenta re-vincular
  setTimeout(bindBombButton, 200);

  // Toques no Joystick Virtual (Touch)
  if (joystickArea) {
    joystickArea.addEventListener("touchstart", onJoyTouchStart, { passive: false });
  }
  window.addEventListener("touchmove", onJoyTouchMove, { passive: false });
  window.addEventListener("touchend", onJoyTouchEnd, { passive: false });
  window.addEventListener("touchcancel", onJoyTouchEnd, { passive: false });

  // Arrasto no Canvas para rotacionar a Câmera Orbital (Touch & Mouse)
  var canvas = state.canvas || document.getElementById("webgl-canvas");
  if (canvas) {
    canvas.addEventListener("touchstart", onCanvasTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onCanvasTouchMove, { passive: false });
    canvas.addEventListener("touchend", onCanvasTouchEnd, { passive: false });
    canvas.addEventListener("touchcancel", onCanvasTouchEnd, { passive: false });

    canvas.addEventListener("mousedown", onCanvasMouseDown);
    window.addEventListener("mousemove", onCanvasMouseMove);
    window.addEventListener("mouseup", onCanvasMouseUp);
  }
}

// ==========================================
// 2. CONTROLE DO JOYSTICK VIRTUAL
// ==========================================
function onJoyTouchStart(e) {
  if (state.isPaused || state.isGameOver || state.isLevelUpPaused || !state.gameStarted) return;
  if (state.joyTouchId !== null) return;
  var touch = e.changedTouches[0];
  state.joyTouchId = touch.identifier;
  state.isJoystickActive = true;

  var rect = joystickArea.getBoundingClientRect();
  state.joyCenter = {
    x: rect.left + rect.width * 0.5,
    y: rect.top + rect.height * 0.5
  };

  handleJoyPosition(touch.clientX, touch.clientY);
  e.preventDefault();
}

function onJoyTouchMove(e) {
  if (state.joyTouchId === null) return;
  if (state.isPaused || state.isGameOver || state.isLevelUpPaused || !state.gameStarted) {
    state.joyTouchId = null;
    state.isJoystickActive = false;
    state.joyX = 0;
    state.joyY = 0;
    if (joystickKnob) {
      joystickKnob.style.transform = "translate(0px, 0px)";
    }
    return;
  }
  for (var i = 0; i < e.changedTouches.length; i++) {
    if (e.changedTouches[i].identifier === state.joyTouchId) {
      handleJoyPosition(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
      e.preventDefault();
      break;
    }
  }
}

function onJoyTouchEnd(e) {
  if (state.joyTouchId === null) return;
  for (var i = 0; i < e.changedTouches.length; i++) {
    if (e.changedTouches[i].identifier === state.joyTouchId) {
      state.joyTouchId = null;
      state.isJoystickActive = false;
      state.joyX = 0;
      state.joyY = 0;
      if (joystickKnob) {
        joystickKnob.style.transform = "translate(0px, 0px)";
      }
      e.preventDefault();
      break;
    }
  }
}

function handleJoyPosition(clientX, clientY) {
  var dx = clientX - state.joyCenter.x;
  var dy = clientY - state.joyCenter.y;
  var dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > JOYSTICK_MAX_RADIUS) {
    dx = (dx / dist) * JOYSTICK_MAX_RADIUS;
    dy = (dy / dist) * JOYSTICK_MAX_RADIUS;
    dist = JOYSTICK_MAX_RADIUS;
  }

  state.joyX = dx / JOYSTICK_MAX_RADIUS;
  state.joyY = dy / JOYSTICK_MAX_RADIUS;

  if (joystickKnob) {
    joystickKnob.style.transform = "translate(" + dx.toFixed(1) + "px, " + dy.toFixed(1) + "px)";
  }
}

// ==========================================
// 3. ARRASTO DE CÂMERA (TOUCH & MOUSE - SEM PINÇA)
// ==========================================
var canvasTouchId = null;
var prevTouchX = 0;
var prevTouchY = 0;

function isInteractiveUI(target) {
  if (!target) return false;
  return target.closest("#joystick-area") ||
         target.closest("#btn-bomb") ||
         target.closest("#pause-btn") ||
         target.closest("#pause-modal") ||
         target.closest(".pause-card") ||
         target.closest("#restart-btn") ||
         target.closest(".upgrade-card-btn") ||
         target.closest("#start-play-btn") ||
         target.closest("#start-skills-btn") ||
         target.closest("#skills-tree-modal");
}

function onCanvasTouchStart(e) {
  // Ignora dedos secundários (sem gesto de pinça nem múltiplos toques)
  if (canvasTouchId !== null) return;

  for (var i = 0; i < e.changedTouches.length; i++) {
    var touch = e.changedTouches[i];
    if (touch.identifier === state.joyTouchId) continue;
    if (isInteractiveUI(e.target)) continue;

    canvasTouchId = touch.identifier;
    prevTouchX = touch.clientX;
    prevTouchY = touch.clientY;
    e.preventDefault();
    break;
  }
}

function onCanvasTouchMove(e) {
  if (canvasTouchId === null) return;
  for (var i = 0; i < e.changedTouches.length; i++) {
    var touch = e.changedTouches[i];
    if (touch.identifier === canvasTouchId) {
      var dx = touch.clientX - prevTouchX;
      var dy = touch.clientY - prevTouchY;
      prevTouchX = touch.clientX;
      prevTouchY = touch.clientY;

      state.targetCamYaw -= dx * CAM_TOUCH_SENSITIVITY;

      if (state.targetCamPitch !== undefined) {
        state.targetCamPitch = Math.max(
          CAM_PITCH_MIN,
          Math.min(CAM_PITCH_MAX, state.targetCamPitch + dy * CAM_PITCH_SENSITIVITY)
        );
      }

      e.preventDefault();
      break;
    }
  }
}

function onCanvasTouchEnd(e) {
  if (canvasTouchId === null) return;
  for (var i = 0; i < e.changedTouches.length; i++) {
    if (e.changedTouches[i].identifier === canvasTouchId) {
      canvasTouchId = null;
      e.preventDefault();
      break;
    }
  }
}

function onCanvasMouseDown(e) {
  if (isInteractiveUI(e.target)) return;
  state.isCanvasDragging = true;
  state.prevDragX = e.clientX;
  state.prevDragY = e.clientY;
}

function onCanvasMouseMove(e) {
  if (!state.isCanvasDragging) return;
  var dx = e.clientX - state.prevDragX;
  var dy = e.clientY - (state.prevDragY || e.clientY);
  state.prevDragX = e.clientX;
  state.prevDragY = e.clientY;

  state.targetCamYaw -= dx * 0.007;

  if (state.targetCamPitch !== undefined) {
    state.targetCamPitch = Math.max(
      CAM_PITCH_MIN,
      Math.min(CAM_PITCH_MAX, state.targetCamPitch + dy * 0.005)
    );
  }
}

function onCanvasMouseUp() {
  state.isCanvasDragging = false;
}

// ==========================================
// 4. ATUALIZAÇÃO DE ENTRADA POR FRAME
// ==========================================
export function updateInput(dt) {
  // Se o joystick touch não estiver ativo, processa teclado WASD / Setas
  if (!state.isJoystickActive) {
    var kx = 0;
    var ky = 0;

    if (state.keys["KeyW"] || state.keys["ArrowUp"]) ky -= 1;
    if (state.keys["KeyS"] || state.keys["ArrowDown"]) ky += 1;
    if (state.keys["KeyA"] || state.keys["ArrowLeft"]) kx -= 1;
    if (state.keys["KeyD"] || state.keys["ArrowRight"]) kx += 1;

    if (kx !== 0 || ky !== 0) {
      var len = Math.sqrt(kx * kx + ky * ky);
      var isShift = !!(state.keys["ShiftLeft"] || state.keys["ShiftRight"]);

      // Com Shift pressionado: intensidade máxima 1.0 (> 0.85, ativa corrida)
      // Sem Shift: passo normal de caminhada 0.70 (< 0.85)
      var targetMag = isShift ? 1.0 : 0.70;

      state.joyX = (kx / len) * targetMag;
      state.joyY = (ky / len) * targetMag;
    } else {
      state.joyX = 0;
      state.joyY = 0;
    }
  }

  // Rotação manual de câmera via teclas Q e E
  if (state.keys["KeyQ"]) state.targetCamYaw += 2.0 * dt;
  if (state.keys["KeyE"]) state.targetCamYaw -= 2.0 * dt;

  // Interpolação suave do yaw e pitch da câmera
  var dyaw = state.targetCamYaw - state.currentCamYaw;
  while (dyaw > Math.PI) dyaw -= Math.PI * 2;
  while (dyaw < -Math.PI) dyaw += Math.PI * 2;
  state.currentCamYaw += dyaw * 0.14;

  if (state.targetCamPitch !== undefined && state.currentCamPitch !== undefined) {
    state.currentCamPitch += (state.targetCamPitch - state.currentCamPitch) * 0.14;
  }
}
