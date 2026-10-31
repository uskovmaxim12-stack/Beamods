
(function (global) {
"use strict";

global.setup = global.setup || function () {};
global.updateMode = global.updateMode || function () {};
global.updateMap = global.updateMap || function () {};

angular.module('gaugesScreen', [])
.controller('GaugesScreenController', function ($scope, $element, $window, $timeout) {
  let svgDoc = null;
  let mapVisible = true;
  let lastGpsSwitch = 0;

  let powerStrokeGas = null;
  let powerStrokeRegen = null;
  let powerPathLength = 0;
  let powerHalfLength = 0;
  let powerCenterOffset = 0;
  let powerCalPosPeak = 1;
  let powerCalNegPeak = 1;
  let powerTargetNorm = 0;
  let powerDisplayNorm = 0;
  let powerDisplayVel = 0;
  let powerAnimRaf = 0;
  let powerAnimLastTs = 0;

  let navigatorReady = false;
  let navigatorInitAttempts = 0;
  let currentDriveMode = '';
  let gearSelectBaseCX = null;
  let gearSelectBaseCY = null;
  let speedWarningTriggered = false;
  let speedWarningRaf = 0;
  let speedWarningAnimStart = 0;
  let speedWarningBaseTransform = null;
  let speedWarningLastOpacity = -1;
  let batteryBarBaseWidth = null;
  let fadeNodesInitialized = false;
  let speedDisplayValue = null;
  let speedDisplayLastTs = 0;
  let speedDisplayUnitMode = '';
  let rangeDisplayValueKm = null;
  let rangeDisplayLastTs = 0;
  let rangeRawLastKm = null;
  let displayedGaugesBrightness = 1;
  let gaugesBrightnessInitialized = false;
  let nightModeMainBgOriginalFill = null;
  let nightModeNodeOriginalStyles = {};


  const KM_TO_MI = 0.62137119223733;
  const MS_TO_KMH = 3.6;
  const MS_TO_MPH = 2.2369362920544;

  const POWER_POS_SENS = 2.0;
  const POWER_NEG_SENS = 1.0;
  const REGEN_COLOR = '#005b00';
  const GAS_COLOR = '#db6d00';
  const POWER_CENTER_SHIFT_RATIO = 0.42;
  const POWER_POS_LENGTH_MULT = 1.0;
  const POWER_NEG_LENGTH_MULT = 1.0;
  const POWER_SPRING = 34;
  const POWER_DAMPING = 8.5;
  const POWER_MAX_DT = 0.04;
  const GEAR_SELECT_STEP = 21.75;
  const GEAR_INACTIVE_COLOR = '#000000';
  const GEAR_ACTIVE_COLOR = '#ffffff';
  const SPEED_WARNING_THRESHOLD_KMH = 190;
  const SPEED_WARNING_SHIFT_Y = -60;
  const SPEED_WARNING_MOVE_DURATION = 500;
  const SPEED_WARNING_FADE_IN_DURATION = 450;
  const SPEED_WARNING_HOLD_DURATION = 4000;
  const SPEED_WARNING_BLINK_CYCLES = 3;
  const SPEED_WARNING_BLINK_CYCLE_DURATION = 650;
  const SPEED_WARNING_FADE_OUT_DURATION = 700;
  const SPEED_WARNING_TOTAL_DURATION =
    SPEED_WARNING_MOVE_DURATION +
    SPEED_WARNING_FADE_IN_DURATION +
    SPEED_WARNING_HOLD_DURATION +
    (SPEED_WARNING_BLINK_CYCLES * SPEED_WARNING_BLINK_CYCLE_DURATION) +
    SPEED_WARNING_FADE_OUT_DURATION +
    SPEED_WARNING_MOVE_DURATION;
  const AUTOHOLD_FADE_TRANSITION = 'opacity 760ms cubic-bezier(0.22, 1, 0.36, 1)';
  const READY_PRND_FADE_TRANSITION = AUTOHOLD_FADE_TRANSITION;
  const SPEED_SMOOTH_TAU_ACCEL = 0.22;
  const SPEED_SMOOTH_TAU_DECEL = 0.16;
  const SPEED_SMOOTH_MAX_DT = 0.05;
  const RANGE_SMOOTH_MAX_DT = 0.10;
  const RANGE_TAU_RISE = 120.0;
  const RANGE_TAU_DROP = 220.0;
  const RANGE_STEP_DROP_MAX_KM_PER_SEC = 0.10;
  const RANGE_STEP_RISE_MAX_KM_PER_SEC = 0.35;
  const RANGE_HIDE_BELOW_KM = 1;
  const MIN_SCREEN_BRIGHTNESS = 0.15;
  const GAUGES_BRIGHTNESS_MAX_OPACITY = 0.85;


  function findSvgRoot() {
    const root = document.getElementById('gaugesRoot');
    if (!root) return null;
    return root.querySelector('svg');
  }

  function ensureSvg() {
    if (svgDoc && svgDoc.querySelector) return svgDoc;
    svgDoc = findSvgRoot();
    return svgDoc;
  }

  function getNode(id) {
    const svg = ensureSvg();
    if (!svg) return null;
    return svg.getElementById ? svg.getElementById(id) : svg.querySelector('#' + id);
  }

  function setTextById(id, value) {
    const node = getNode(id);
    if (!node) return;
    node.textContent = String(value);
  }

  function setOpacity(id, on) {
    const node = getNode(id);
    if (!node) return;
    node.style.opacity = on ? '1' : '0';
  }

  function toNumber(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function clamp01(v) {
    return Math.max(0, Math.min(1, Number(v) || 0));
  }

  function clampValue(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function normalizeScreenBrightness(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return 1;
    return clampValue(n, MIN_SCREEN_BRIGHTNESS, 1);
  }

  function hideGaugesBrightnessOverlay() {
    const node = getNode('gauges_brightness_bg');
    if (!node) return;

    node.style.transition = 'none';
    node.style.pointerEvents = 'none';
    node.style.fill = '#000000';
    node.setAttribute('fill', '#000000');
    node.style.opacity = '0';
    node.setAttribute('opacity', '0');
    node.style.visibility = 'hidden';
  }

  function updateGaugesBrightness(data) {
    const node = getNode('gauges_brightness_bg');
    if (!node) return;

    const electrics = data?.electrics || {};
    const target = normalizeScreenBrightness(electrics.screen_brightness);

    if (!gaugesBrightnessInitialized) {
      displayedGaugesBrightness = target;
      gaugesBrightnessInitialized = true;
    } else {
      displayedGaugesBrightness = normalizeScreenBrightness(displayedGaugesBrightness);
      const diff = target - displayedGaugesBrightness;

      if (Math.abs(diff) < 0.002) {
        displayedGaugesBrightness = target;
      } else {
        displayedGaugesBrightness += diff * 0.16;
      }
    }

    const opacity = clampValue((1 - displayedGaugesBrightness) * GAUGES_BRIGHTNESS_MAX_OPACITY, 0, GAUGES_BRIGHTNESS_MAX_OPACITY);

    node.style.transition = 'none';
    node.style.pointerEvents = 'none';
    node.style.fill = '#000000';
    node.setAttribute('fill', '#000000');
    node.style.opacity = String(opacity);
    node.setAttribute('opacity', String(opacity));
    node.style.visibility = opacity > 0.001 ? 'visible' : 'hidden';
  }

  function easeInOutCubic(t) {
    const x = clamp01(t);
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }

  function easeOutCubic(t) {
    const x = clamp01(t);
    return 1 - Math.pow(1 - x, 3);
  }

  function ensureSpeedWarningBaseTransform() {
    const group = getNode('speed_module_group');
    if (!group) return null;
    if (speedWarningBaseTransform === null) {
      speedWarningBaseTransform = group.getAttribute('transform') || '';
    }
    return group;
  }

  function applySpeedModuleOffset(offsetY) {
    const group = ensureSpeedWarningBaseTransform();
    if (!group) return;

    const y = Number(offsetY) || 0;
    const translate = Math.abs(y) < 0.001 ? '' : ' translate(0 ' + y.toFixed(3) + ')';
    group.setAttribute('transform', (speedWarningBaseTransform || '') + translate);
  }

  function setSpeedWarningOpacity(opacity) {
    const node = getNode('speed_warning_txt');
    if (!node) return;

    const o = clamp01(opacity);
    if (Math.abs(o - speedWarningLastOpacity) < 0.001) return;
    speedWarningLastOpacity = o;

    node.style.opacity = String(o);
    node.setAttribute('opacity', String(o));
    node.style.visibility = o > 0.001 ? 'visible' : 'hidden';
  }

  function resetSpeedWarningState() {
    if (speedWarningRaf) {
      cancelAnimationFrame(speedWarningRaf);
      speedWarningRaf = 0;
    }

    speedWarningAnimStart = 0;
    speedWarningTriggered = false;
    speedWarningLastOpacity = -1;

    ensureSpeedWarningBaseTransform();
    applySpeedModuleOffset(0);
    setSpeedWarningOpacity(0);
  }

  function stepSpeedWarningAnimation(ts) {
    if (!speedWarningAnimStart) speedWarningAnimStart = ts;

    const elapsed = ts - speedWarningAnimStart;
    const blinkDuration = SPEED_WARNING_BLINK_CYCLES * SPEED_WARNING_BLINK_CYCLE_DURATION;

    let offsetY = 0;
    let opacity = 0;

    if (elapsed < SPEED_WARNING_MOVE_DURATION) {
      const p = easeInOutCubic(elapsed / SPEED_WARNING_MOVE_DURATION);
      offsetY = SPEED_WARNING_SHIFT_Y * p;
      opacity = 0;
    } else if (elapsed < SPEED_WARNING_MOVE_DURATION + SPEED_WARNING_FADE_IN_DURATION) {
      const p = easeOutCubic((elapsed - SPEED_WARNING_MOVE_DURATION) / SPEED_WARNING_FADE_IN_DURATION);
      offsetY = SPEED_WARNING_SHIFT_Y;
      opacity = p;
    } else if (elapsed < SPEED_WARNING_MOVE_DURATION + SPEED_WARNING_FADE_IN_DURATION + SPEED_WARNING_HOLD_DURATION) {
      offsetY = SPEED_WARNING_SHIFT_Y;
      opacity = 1;
    } else if (elapsed < SPEED_WARNING_MOVE_DURATION + SPEED_WARNING_FADE_IN_DURATION + SPEED_WARNING_HOLD_DURATION + blinkDuration) {
      const phaseElapsed = elapsed - SPEED_WARNING_MOVE_DURATION - SPEED_WARNING_FADE_IN_DURATION - SPEED_WARNING_HOLD_DURATION;
      const cycleProgress = (phaseElapsed % SPEED_WARNING_BLINK_CYCLE_DURATION) / SPEED_WARNING_BLINK_CYCLE_DURATION;
      offsetY = SPEED_WARNING_SHIFT_Y;
      opacity = 0.35 + (0.65 * (0.5 - 0.5 * Math.cos(cycleProgress * Math.PI * 2)));
    } else if (elapsed < SPEED_WARNING_MOVE_DURATION + SPEED_WARNING_FADE_IN_DURATION + SPEED_WARNING_HOLD_DURATION + blinkDuration + SPEED_WARNING_FADE_OUT_DURATION) {
      const p = (elapsed - SPEED_WARNING_MOVE_DURATION - SPEED_WARNING_FADE_IN_DURATION - SPEED_WARNING_HOLD_DURATION - blinkDuration) / SPEED_WARNING_FADE_OUT_DURATION;
      offsetY = SPEED_WARNING_SHIFT_Y;
      opacity = 1 - easeInOutCubic(p);
    } else if (elapsed < SPEED_WARNING_TOTAL_DURATION) {
      const p = (elapsed - (SPEED_WARNING_TOTAL_DURATION - SPEED_WARNING_MOVE_DURATION)) / SPEED_WARNING_MOVE_DURATION;
      offsetY = SPEED_WARNING_SHIFT_Y * (1 - easeInOutCubic(p));
      opacity = 0;
    } else {
      applySpeedModuleOffset(0);
      setSpeedWarningOpacity(0);
      speedWarningRaf = 0;
      speedWarningAnimStart = 0;
      return;
    }

    applySpeedModuleOffset(offsetY);
    setSpeedWarningOpacity(opacity);
    speedWarningRaf = requestAnimationFrame(stepSpeedWarningAnimation);
  }

  function triggerSpeedWarning() {
    if (speedWarningTriggered) return;
    speedWarningTriggered = true;

    if (speedWarningRaf) cancelAnimationFrame(speedWarningRaf);
    speedWarningRaf = 0;
    speedWarningAnimStart = 0;
    ensureSpeedWarningBaseTransform();
    setSpeedWarningOpacity(0);
    applySpeedModuleOffset(0);
    speedWarningRaf = requestAnimationFrame(stepSpeedWarningAnimation);
  }

  function updateSpeedWarning(data) {
    const electrics = data?.electrics || {};
    const speedKmh = (Number(electrics.wheelspeed) || 0) * MS_TO_KMH;
    if (speedKmh >= SPEED_WARNING_THRESHOLD_KMH) {
      triggerSpeedWarning();
    }
  }

  function ensureBatteryBarBaseWidth() {
    const node = getNode('battery_bar');
    if (!node) return null;
    if (batteryBarBaseWidth === null) {
      batteryBarBaseWidth = toNumber(node.getAttribute('width'));
    }
    return node;
  }

  function updateBatteryBar(data) {
    const node = ensureBatteryBarBaseWidth();
    if (!node || batteryBarBaseWidth === null) return;

    const fuel = clamp01(data?.electrics?.fuel);
    const width = batteryBarBaseWidth * fuel;

    node.setAttribute('width', String(width));
  }


  function isLiteralDriveDorR(electrics) {
    const gear = String(electrics?.gear ?? '').trim().toUpperCase();
    return gear === 'D' || gear === 'R';
  }

  function ensureFadeNodes() {
    if (fadeNodesInitialized) return;
    const ids = ['autohold_txt', 'speed_txt', 'speed_unit_txt', 'powerslide_needle_circle_txt', 'powerslide_needle', 'ready_txt'];
    for (let i = 0; i < ids.length; i++) {
      const node = getNode(ids[i]);
      if (!node) continue;
      node.style.transition = AUTOHOLD_FADE_TRANSITION;
      node.style.willChange = 'opacity';
    }
    fadeNodesInitialized = true;
  }

  function setNodeOpacity(id, opacity) {
    const node = getNode(id);
    if (!node) return;
    const o = clamp01(opacity);
    node.style.opacity = String(o);
    node.setAttribute('opacity', String(o));
    node.style.visibility = o > 0.001 ? 'visible' : 'hidden';
  }

  function isAutoHoldActive(electrics) {
    return (Number(electrics?.autohold) || 0) >= 1;
  }

  function isPrndReadyState(electrics) {
    const prnd = getActivePrnd(electrics);
    return prnd === 'P' || prnd === 'N';
  }

  function updateDriveDisplayState(data) {
    const electrics = data?.electrics || {};
    const readyActive = isPrndReadyState(electrics);
    const autoholdActive = !readyActive && isAutoHoldActive(electrics) && isLiteralDriveDorR(electrics);

    ensureFadeNodes();

    setNodeOpacity('ready_txt', readyActive ? 1 : 0);
    setNodeOpacity('autohold_txt', autoholdActive ? 1 : 0);

    const speedVisible = !readyActive && !autoholdActive;
    setNodeOpacity('speed_txt', speedVisible ? 1 : 0);
    setNodeOpacity('speed_unit_txt', speedVisible ? 1 : 0);

    const powerVisible = !readyActive;
    setNodeOpacity('powerslide_needle_circle_txt', powerVisible ? 1 : 0);
    setNodeOpacity('powerslide_needle', powerVisible ? 1 : 0);

    if (readyActive) {
      renderPowerNorm(0);
    }
  }


  function resetSpeedDisplayState() {
    speedDisplayValue = null;
    speedDisplayLastTs = 0;
    speedDisplayUnitMode = '';
  }


  function getUnitLengthFromData(data) {
    const cached = (typeof window !== 'undefined') ? window._gaugesUnitLength : null;
    const direct = data?.uiUnitLength || data?.uiState?.unitSystem || data?.electrics?.uiUnitLength;
    const u = direct || cached || 'metric';
    return String(u).toLowerCase();
  }

  function isImperialUnits(data) {
    const u = getUnitLengthFromData(data);
    return u === 'imperial' || u === 'us' || u === 'usa';
  }

  function kmToMi(km) {
    return km * KM_TO_MI;
  }

  function normalizeDriveModeName(v) {
    const s = String(v == null ? '' : v).trim().toUpperCase();
    if (!s) return '';
    const compact = s.replace(/[^A-Z0-9+]/g, '');

    if (compact === 'CONSERVE') return 'CONSERVE';
    if (compact === 'SPORT') return 'SPORT';
    if (compact === 'OFFROAD') return 'OFF-ROAD';
    if (compact === 'ESCOFF' || compact === 'ESCTCOFF') return 'ESC OFF';

    return '';
  }

  function getDriveModeCandidates(data, electrics) {
    if (typeof data === 'string') return [data];
    return [
      data?.modeName,
      data?.driveModeName,
      data?.mode,
      data?.driveMode,
      data?.name,
      data?.value,
      electrics?.modeName,
      electrics?.driveModeName,
      electrics?.mode,
      electrics?.driveMode
    ];
  }

  function getActivePrnd(electrics) {
    const gear = String(electrics?.gear ?? '').trim().toUpperCase();
    const gi = toNumber(electrics?.gearIndex);

    if (gear === 'P') return 'P';
    if (gear === 'R' || (gi !== null && gi < 0)) return 'R';
    if (gear === 'N' || (gi !== null && gi === 0)) return 'N';
    if (gear === 'D' || gear === 'S' || gear === 'M' || /^D\d+$/.test(gear) || /^S\d+$/.test(gear) || /^M\d+$/.test(gear) || /^\d+$/.test(gear) || (gi !== null && gi > 0)) return 'D';

    return 'N';
  }

  function ensureGearSelectBaseTransform() {
    const node = getNode('gear_select_txt');
    if (!node) return null;
    if (gearSelectBaseCX === null) {
      gearSelectBaseCX = toNumber(node.getAttribute('cx'));
    }
    if (gearSelectBaseCY === null) {
      gearSelectBaseCY = toNumber(node.getAttribute('cy'));
    }
    return node;
  }

  function setGearTextColor(id, active, forceWhite) {
    const node = getNode(id);
    if (!node) return;

    const color = forceWhite ? '#ffffff' : (active ? GEAR_ACTIVE_COLOR : GEAR_INACTIVE_COLOR);
    node.style.fill = color;
    node.setAttribute('fill', color);

    if (node.querySelectorAll) {
      const tspans = node.querySelectorAll('tspan');
      for (let i = 0; i < tspans.length; i++) {
        tspans[i].style.fill = color;
        tspans[i].setAttribute('fill', color);
      }
    }
  }

  function updateGearPrnd(data) {
    const electrics = data?.electrics || {};
    const prnd = getActivePrnd(electrics);
    const forceWhite = isNightModeActive(data);

    setGearTextColor('gearP_txt', prnd === 'P', forceWhite);
    setGearTextColor('gearR_txt', prnd === 'R', forceWhite);
    setGearTextColor('gearN_txt', prnd === 'N', forceWhite);
    setGearTextColor('gearD_txt', prnd === 'D', forceWhite);

    const node = ensureGearSelectBaseTransform();
    if (!node) return;

    let dx = 0;
    let dy = 0;

    if (prnd === 'P') dx = GEAR_SELECT_STEP;
    else if (prnd === 'R') dy = -GEAR_SELECT_STEP;
    else if (prnd === 'D') dy = GEAR_SELECT_STEP;

    if (gearSelectBaseCX !== null) node.setAttribute('cx', String(gearSelectBaseCX + dx));
    if (gearSelectBaseCY !== null) node.setAttribute('cy', String(gearSelectBaseCY + dy));
  }

  function updateSpeedUnit(data) {
    const isImperial = isImperialUnits(data);
    setTextById('speed_unit_txt', isImperial ? 'MPH' : 'KM/H');
  }

  function updateSpeedText(data) {
    const electrics = data?.electrics || {};
    const ms = Number(electrics.wheelspeed) || 0;
    const isImperial = isImperialUnits(data);
    const unitMode = isImperial ? 'imperial' : 'metric';
    const target = Math.max(0, ms * (isImperial ? MS_TO_MPH : MS_TO_KMH));
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

    if (speedDisplayValue === null || speedDisplayUnitMode !== unitMode) {
      speedDisplayValue = target;
      speedDisplayLastTs = now;
      speedDisplayUnitMode = unitMode;
      setTextById('speed_txt', Math.round(target));
      return;
    }

    let dt = (now - speedDisplayLastTs) / 1000;
    speedDisplayLastTs = now;

    if (!Number.isFinite(dt) || dt <= 0) dt = 1 / 60;
    if (dt > SPEED_SMOOTH_MAX_DT) dt = SPEED_SMOOTH_MAX_DT;

    const tau = target >= speedDisplayValue ? SPEED_SMOOTH_TAU_ACCEL : SPEED_SMOOTH_TAU_DECEL;
    const alpha = 1 - Math.exp(-dt / Math.max(0.0001, tau));

    speedDisplayValue += (target - speedDisplayValue) * alpha;

    if (Math.abs(target - speedDisplayValue) < 0.08) {
      speedDisplayValue = target;
    }

    setTextById('speed_txt', Math.round(speedDisplayValue));
  }

  function updateTemp(data) {
    const temp = data?.customModules?.environmentData?.temperatureEnv;
    if (temp == null) {
      setTextById('temp_txt', '--°C');
      return;
    }
    setTextById('temp_txt', Math.round(temp) + '°C');
  }

  function updateTimeText(data) {
    const time = data?.customModules?.environmentData?.time;
    if (typeof time === 'string' && time.includes(':')) {
      const parts = time.split(':');
      setTextById('time_txt', parts.slice(0, 2).join(':'));
      return;
    }
    setTextById('time_txt', '--:--');
  }

  function updateOdometer(data) {
    const isImperial = isImperialUnits(data);
    const odo = toNumber(
      data?.customModules?.acmrivianken_odometer ??
      data?.electrics?.acmrivianken_odometer
    );

    if (odo === null) return;

    const value = isImperial ? kmToMi(odo) : odo;
    const unit = isImperial ? ' MI' : ' KM';
    setTextById('odometer_txt', Math.round(value) + unit);
  }

  function resetRemainingRangeState() {
    rangeDisplayValueKm = null;
    rangeDisplayLastTs = 0;
    rangeRawLastKm = null;
  }

  function updateRemainingRange(data) {
    const isImperial = isImperialUnits(data);
    let valueKm = toNumber(
      data?.customModules?.combustionEngineData?.remainingRange ??
      data?.customModules?.electricMotorData?.remainingRange ??
      data?.customModules?.remainingRange ??
      data?.electrics?.remainingRange
    );

    const fuel = clamp01(data?.electrics?.fuel);
    const startupKm = fuel * 500;
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

    if (rangeDisplayValueKm === null) {
      rangeDisplayValueKm = startupKm;
      rangeRawLastKm = valueKm === null ? startupKm : valueKm;
      rangeDisplayLastTs = now;
    }

    if (valueKm === null || !Number.isFinite(valueKm) || valueKm < RANGE_HIDE_BELOW_KM || valueKm > 800) {
      valueKm = rangeDisplayValueKm;
    }

    let dt = (now - rangeDisplayLastTs) / 1000;
    rangeDisplayLastTs = now;

    if (!Number.isFinite(dt) || dt <= 0) dt = 1 / 60;
    if (dt > RANGE_SMOOTH_MAX_DT) dt = RANGE_SMOOTH_MAX_DT;

    const rawDrop = rangeRawLastKm === null ? 0 : Math.max(0, rangeRawLastKm - valueKm);
    rangeRawLastKm = valueKm;

    let targetKm = valueKm;

    if (rawDrop > 150) {
      targetKm = rangeDisplayValueKm - 0.02;
    } else if (rawDrop > 80) {
      targetKm = rangeDisplayValueKm + (valueKm - rangeDisplayValueKm) * 0.01;
    } else if (rawDrop > 40) {
      targetKm = rangeDisplayValueKm + (valueKm - rangeDisplayValueKm) * 0.02;
    } else if (rawDrop > 15) {
      targetKm = rangeDisplayValueKm + (valueKm - rangeDisplayValueKm) * 0.04;
    } else {
      targetKm = rangeDisplayValueKm + (valueKm - rangeDisplayValueKm) * 0.06;
    }

    const desiredDelta = targetKm - rangeDisplayValueKm;
    const maxStepDown = RANGE_STEP_DROP_MAX_KM_PER_SEC * dt;
    const maxStepUp = RANGE_STEP_RISE_MAX_KM_PER_SEC * dt;

    if (desiredDelta < 0) {
      rangeDisplayValueKm += Math.max(desiredDelta, -maxStepDown);
    } else {
      rangeDisplayValueKm += Math.min(desiredDelta, maxStepUp);
    }

    const maxAllowedByFuel = fuel * 500;
    if (rangeDisplayValueKm > maxAllowedByFuel) rangeDisplayValueKm = maxAllowedByFuel;
    if (rangeDisplayValueKm < 0) rangeDisplayValueKm = 0;

    const out = isImperial ? kmToMi(rangeDisplayValueKm) : rangeDisplayValueKm;
    const displayMax = isImperial ? kmToMi(500) : 500;
    const clamped = Math.max(0, Math.min(displayMax, Math.round(out)));
    setTextById('remaining_range_txt', clamped + (isImperial ? ' MI' : ' KM'));
  }

  function updateEscMode(data) {
    const node = getNode('esc_mode_txt');
    if (!node) return currentDriveMode;

    const electrics = (data && typeof data === 'object') ? (data.electrics || {}) : {};
    const candidates = getDriveModeCandidates(data, electrics);

    let resolved = '';
    for (let i = 0; i < candidates.length; i++) {
      const mode = normalizeDriveModeName(candidates[i]);
      if (mode) {
        resolved = mode;
        break;
      }
    }

    if (resolved) currentDriveMode = resolved;
    node.textContent = currentDriveMode || '';
    return currentDriveMode;
  }

  function isNightModeActive(data) {
    return (Number(data?.electrics?.dashboard_night_mode) || 0) >= 1;
  }

  function setNodeFillDeep(id, fill) {
    const node = getNode(id);
    if (!node) return;
    node.style.fill = fill;
    node.setAttribute('fill', fill);
    if (node.querySelectorAll) {
      const tspans = node.querySelectorAll('tspan');
      for (let i = 0; i < tspans.length; i++) {
        tspans[i].style.fill = fill;
        tspans[i].setAttribute('fill', fill);
      }
    }
  }

  function captureNightModeNodeStyle(id) {
    if (nightModeNodeOriginalStyles[id]) return nightModeNodeOriginalStyles[id];
    const node = getNode(id);
    if (!node) return null;
    const style = {
      fill: node.getAttribute('fill') || node.style.fill || '',
      stroke: node.getAttribute('stroke') || node.style.stroke || '',
      opacity: node.getAttribute('opacity') || node.style.opacity || '',
      visibility: node.style.visibility || ''
    };
    nightModeNodeOriginalStyles[id] = style;
    return style;
  }

  function restoreNightModeNodeFill(id) {
    const node = getNode(id);
    const style = captureNightModeNodeStyle(id);
    if (!node || !style) return;
    if (style.fill) {
      node.style.fill = style.fill;
      node.setAttribute('fill', style.fill);
    } else {
      node.style.fill = '';
      node.removeAttribute('fill');
    }
    if (node.querySelectorAll) {
      const tspans = node.querySelectorAll('tspan');
      for (let i = 0; i < tspans.length; i++) {
        if (style.fill) {
          tspans[i].style.fill = style.fill;
          tspans[i].setAttribute('fill', style.fill);
        } else {
          tspans[i].style.fill = '';
          tspans[i].removeAttribute('fill');
        }
      }
    }
  }


  function setNodeStroke(id, stroke) {
    const node = getNode(id);
    if (!node) return;
    node.style.stroke = stroke;
    node.setAttribute('stroke', stroke);
  }

  function restoreNightModeNodeStroke(id) {
    const node = getNode(id);
    const style = captureNightModeNodeStyle(id);
    if (!node || !style) return;

    if (style.stroke) {
      node.style.stroke = style.stroke;
      node.setAttribute('stroke', style.stroke);
    } else {
      node.style.stroke = '';
      node.removeAttribute('stroke');
    }
  }

  function restoreNightModeNodeVisibility(id) {
    const node = getNode(id);
    const style = captureNightModeNodeStyle(id);
    if (!node || !style) return;

    if (style.opacity !== '') {
      node.style.opacity = style.opacity;
      node.setAttribute('opacity', style.opacity);
    } else {
      node.style.opacity = '';
      node.removeAttribute('opacity');
    }

    if (style.visibility !== '') node.style.visibility = style.visibility;
    else node.style.visibility = '';
  }

  function updateNightMode(data) {
    const active = isNightModeActive(data);

    const mainBgNode = getNode('main_bg_txt');
    if (mainBgNode) {
      if (nightModeMainBgOriginalFill === null) {
        nightModeMainBgOriginalFill = mainBgNode.getAttribute('fill') || mainBgNode.style.fill || '';
      }

      const fill = active ? '#030303' : nightModeMainBgOriginalFill;
      mainBgNode.style.fill = fill;
      if (fill) mainBgNode.setAttribute('fill', fill);
    }

	const gpsBgNode = getNode('main_gps_bg_txt');
	if (gpsBgNode) {
	if (active) {
		gpsBgNode.style.visibility = 'visible';
	} else {
		gpsBgNode.style.visibility = 'hidden';
	}
	}

    const whiteIds = [
      'ready_txt',
      'autohold_txt',
      'speed_txt',
      'speed_unit_txt',
      'battery_outline_txt',
      'esc_mode_txt',
      'temp_txt',
      'time_txt',
      'remaining_range_txt',
      'odometer_txt',
      'gearD_txt',
      'gearN_txt',
      'gearR_txt',
      'gearP_txt'
    ];

    for (let i = 0; i < whiteIds.length; i++) {
      captureNightModeNodeStyle(whiteIds[i]);
      if (active) setNodeFillDeep(whiteIds[i], '#ffffff');
      else restoreNightModeNodeFill(whiteIds[i]);
    }

    captureNightModeNodeStyle('gear_select_txt');
    if (active) setNodeFillDeep('gear_select_txt', 'hsl(0, 0%, 5%)');
    else restoreNightModeNodeFill('gear_select_txt');

    captureNightModeNodeStyle('powerslide_needle');
    if (active) setNodeStroke('powerslide_needle', 'hsl(0, 0%, 5%)');
    else restoreNightModeNodeStroke('powerslide_needle');
  }

  function updateIndicators(data) {
    const electrics = data?.electrics || {};
    setOpacity('parkingbrake_txt', (electrics.parkingbrake || 0) >= 1);
    setOpacity('lowbeam_txt', (electrics.lights || 0) >= 1);
    setOpacity('highbeam_txt', (electrics.highbeam || 0) >= 1);
    setOpacity('signal_L_txt', (electrics.signal_L || 0) >= 1);
    setOpacity('signal_R_txt', (electrics.signal_R || 0) >= 1);
    setOpacity('hazard_txt', (electrics.hazard || 0) >= 1);
  }

  function initPowerIfNeeded() {
    if (!ensureSvg() || (powerStrokeGas && powerStrokeRegen)) return;

    const base = getNode('powerslide_needle');
    if (!base) return;

    let totalLength = 0;
    try { totalLength = base.getTotalLength(); } catch (_) { totalLength = 0; }
    if (!Number.isFinite(totalLength) || totalLength <= 0) return;

    powerPathLength = totalLength;
    powerHalfLength = totalLength / 2;
    powerCenterOffset = powerHalfLength + (powerHalfLength * POWER_CENTER_SHIFT_RATIO);

    const ns = 'http://www.w3.org/2000/svg';
    const d = base.getAttribute('d') || '';
    const transform = base.getAttribute('transform') || '';
    const strokeWidth = base.getAttribute('stroke-width') || '19.188';
    const linecap = base.getAttribute('stroke-linecap') || 'round';
    const linejoin = base.getAttribute('stroke-linejoin') || 'round';
    const paintOrder = base.getAttribute('paint-order') || 'stroke fill markers';

    powerStrokeGas = document.createElementNS(ns, 'path');
    powerStrokeGas.setAttribute('id', 'powerslide_overlay_gas');
    powerStrokeGas.setAttribute('d', d);
    powerStrokeGas.setAttribute('fill', 'none');
    powerStrokeGas.setAttribute('stroke', GAS_COLOR);
    powerStrokeGas.setAttribute('stroke-width', strokeWidth);
    powerStrokeGas.setAttribute('stroke-linecap', linecap);
    powerStrokeGas.setAttribute('stroke-linejoin', linejoin);
    powerStrokeGas.setAttribute('stroke-dasharray', '0 ' + powerPathLength);
    powerStrokeGas.setAttribute('stroke-dashoffset', String(-powerCenterOffset));
    powerStrokeGas.setAttribute('paint-order', paintOrder);
    if (transform) powerStrokeGas.setAttribute('transform', transform);
    powerStrokeGas.style.pointerEvents = 'none';
    powerStrokeGas.style.opacity = '0';

    powerStrokeRegen = document.createElementNS(ns, 'path');
    powerStrokeRegen.setAttribute('id', 'powerslide_overlay_regen');
    powerStrokeRegen.setAttribute('d', d);
    powerStrokeRegen.setAttribute('fill', 'none');
    powerStrokeRegen.setAttribute('stroke', REGEN_COLOR);
    powerStrokeRegen.setAttribute('stroke-width', strokeWidth);
    powerStrokeRegen.setAttribute('stroke-linecap', linecap);
    powerStrokeRegen.setAttribute('stroke-linejoin', linejoin);
    powerStrokeRegen.setAttribute('stroke-dasharray', '0 ' + powerPathLength);
    powerStrokeRegen.setAttribute('stroke-dashoffset', String(-powerCenterOffset));
    powerStrokeRegen.setAttribute('paint-order', paintOrder);
    if (transform) powerStrokeRegen.setAttribute('transform', transform);
    powerStrokeRegen.style.pointerEvents = 'none';
    powerStrokeRegen.style.opacity = '0';

    base.parentNode.insertBefore(powerStrokeGas, base.nextSibling);
    base.parentNode.insertBefore(powerStrokeRegen, powerStrokeGas.nextSibling);
  }

  function getPowerScaled(data) {
    let p = data?.customModules?.electricMotorData?.electricPowerDisplay;
    p = (p === undefined || p === null) ? null : Number(p);

    if (p !== null && Number.isFinite(p)) return p * (p > 0 ? 2 : 1);

    const electrics = data?.electrics || {};
    const thr = Number(electrics.throttle) || 0;
    const brk = Number(electrics.brake) || 0;
    return thr - brk;
  }

  function renderPowerNorm(norm) {
    if (!powerStrokeGas || !powerStrokeRegen || !powerPathLength || !powerHalfLength) return;

    const v = Math.max(-1, Math.min(1, Number(norm) || 0));

    if (Math.abs(v) < 0.001) {
      powerStrokeGas.setAttribute('stroke-dasharray', '0 ' + powerPathLength);
      powerStrokeGas.setAttribute('stroke-dashoffset', String(-powerCenterOffset));
      powerStrokeGas.style.opacity = '0';
      powerStrokeRegen.setAttribute('stroke-dasharray', '0 ' + powerPathLength);
      powerStrokeRegen.setAttribute('stroke-dashoffset', String(-powerCenterOffset));
      powerStrokeRegen.style.opacity = '0';
      return;
    }

    if (v > 0) {
      const maxGasLength = Math.max(0, powerCenterOffset);
      const seg = Math.min(maxGasLength, v * maxGasLength * POWER_POS_LENGTH_MULT);
      const startOffset = powerCenterOffset - seg;

      powerStrokeGas.setAttribute('stroke-dasharray', seg + ' ' + powerPathLength);
      powerStrokeGas.setAttribute('stroke-dashoffset', String(-startOffset));
      powerStrokeGas.style.opacity = seg > 0.001 ? '1' : '0';

      powerStrokeRegen.setAttribute('stroke-dasharray', '0 ' + powerPathLength);
      powerStrokeRegen.setAttribute('stroke-dashoffset', String(-powerCenterOffset));
      powerStrokeRegen.style.opacity = '0';
      return;
    }

    const maxRegenLength = Math.max(0, powerPathLength - powerCenterOffset);
    const seg = Math.min(maxRegenLength, Math.abs(v) * maxRegenLength * POWER_NEG_LENGTH_MULT);

    powerStrokeRegen.setAttribute('stroke-dasharray', seg + ' ' + powerPathLength);
    powerStrokeRegen.setAttribute('stroke-dashoffset', String(-powerCenterOffset));
    powerStrokeRegen.style.opacity = seg > 0.001 ? '1' : '0';

    powerStrokeGas.setAttribute('stroke-dasharray', '0 ' + powerPathLength);
    powerStrokeGas.setAttribute('stroke-dashoffset', String(-powerCenterOffset));
    powerStrokeGas.style.opacity = '0';
  }

  function stepPowerAnimation(ts) {
    if (!powerAnimLastTs) powerAnimLastTs = ts;
    let dt = (ts - powerAnimLastTs) / 1000;
    powerAnimLastTs = ts;
    if (!Number.isFinite(dt) || dt <= 0) dt = 1 / 60;
    if (dt > POWER_MAX_DT) dt = POWER_MAX_DT;

    const error = powerTargetNorm - powerDisplayNorm;
    const accel = error * POWER_SPRING - powerDisplayVel * POWER_DAMPING;
    powerDisplayVel += accel * dt;
    powerDisplayNorm += powerDisplayVel * dt;

    renderPowerNorm(powerDisplayNorm);

    if (Math.abs(error) < 0.0015 && Math.abs(powerDisplayVel) < 0.0015) {
      powerDisplayNorm = powerTargetNorm;
      powerDisplayVel = 0;
      renderPowerNorm(powerDisplayNorm);
      powerAnimRaf = 0;
      powerAnimLastTs = 0;
      return;
    }

    powerAnimRaf = requestAnimationFrame(stepPowerAnimation);
  }

  function startPowerAnimation() {
    if (powerAnimRaf) return;
    powerAnimRaf = requestAnimationFrame(stepPowerAnimation);
  }

  function setPowerTargetNorm(norm) {
    powerTargetNorm = Math.max(-1, Math.min(1, Number(norm) || 0));
    startPowerAnimation();
  }

  function updatePowerSlide(data) {
    if (!ensureSvg()) return;
    initPowerIfNeeded();
    if (!powerStrokeGas || !powerStrokeRegen || !powerPathLength || !powerHalfLength) return;

    const electrics = data?.electrics || {};
    if (isPrndReadyState(electrics)) {
      powerTargetNorm = 0;
      powerDisplayNorm = 0;
      powerDisplayVel = 0;
      if (powerAnimRaf) {
        cancelAnimationFrame(powerAnimRaf);
        powerAnimRaf = 0;
      }
      powerAnimLastTs = 0;
      renderPowerNorm(0);
      return;
    }
    const throttle = Number(electrics.throttle) || 0;
    const brake = Number(electrics.brake) || 0;
    const pScaled = getPowerScaled(data);

    if (!Number.isFinite(pScaled)) {
      powerTargetNorm = 0;
      powerDisplayNorm = 0;
      powerDisplayVel = 0;
      if (powerAnimRaf) {
        cancelAnimationFrame(powerAnimRaf);
        powerAnimRaf = 0;
      }
      powerAnimLastTs = 0;
      renderPowerNorm(0);
      return;
    }

    if (throttle > 0.95 && pScaled > 0) powerCalPosPeak = Math.max(powerCalPosPeak, pScaled);
    if (brake > 0.2 && pScaled < 0) powerCalNegPeak = Math.max(powerCalNegPeak, Math.abs(pScaled));

    const posDen = Math.max(0.0001, powerCalPosPeak) * POWER_POS_SENS;
    const negDen = Math.max(0.0001, powerCalNegPeak) * POWER_NEG_SENS;
    const deadZone = 0.01;

    if (Math.abs(pScaled) < deadZone) {
      setPowerTargetNorm(0);
      return;
    }

    if (pScaled > 0) {
      setPowerTargetNorm(Math.min(1, pScaled / posDen));
      return;
    }

    setPowerTargetNorm(-Math.min(1, Math.abs(pScaled) / negDen));
  }

  function ensureMapSvgVisible() {
    const mapContainer = document.getElementById('mapContainer');
    if (!mapContainer) return;

    mapContainer.style.display = mapVisible ? 'block' : 'none';
    mapContainer.style.visibility = mapVisible ? 'visible' : 'hidden';

    const mapSvg = mapContainer.querySelector('svg');
    if (mapSvg) {
      mapSvg.style.display = mapVisible ? 'block' : 'none';
      mapSvg.style.visibility = mapVisible ? 'visible' : 'hidden';
      mapSvg.style.width = '100%';
      mapSvg.style.height = '100%';
      mapSvg.style.overflow = 'visible';
    }
  }

  function initNavigator() {
    if (navigatorReady) return true;

    const mapContainer = document.getElementById('mapContainer');
    if (!mapContainer) return false;
    if (typeof global.bngNavigator !== 'function') return false;

    try {
      $window.map = new global.bngNavigator({
        container: '#mapContainer',
        backgroundRgb: [100, 100, 100],
        roadColors: ['#D8D8D8FF', '#969678FF', '#967864FF'],
        rotate: true,
        scale: 1,
        offsetX: 179.959,
        offsetY: 331.123,
        pitch: 3,
        speedPitch: 5,
        hideBootscreen: true
      });

      navigatorReady = true;
      ensureMapSvgVisible();
      return true;
    } catch (_) {
      navigatorReady = false;
      return false;
    }
  }

  function scheduleNavigatorInit() {
    if (navigatorReady) return;

    navigatorInitAttempts++;
    if (initNavigator()) return;
    if (navigatorInitAttempts > 40) return;

    $timeout(function () {
      scheduleNavigatorInit();
    }, 100);
  }

  function updateNavigatorToggle(data) {
    const electrics = data?.electrics || {};
    const gpsSwitch = electrics.dashboard_gps_switch ?? 0;

    if (gpsSwitch && !lastGpsSwitch) {
      mapVisible = !mapVisible;
      const naviContainer = document.getElementById('navi-container');
      if (naviContainer) naviContainer.style.display = mapVisible ? 'block' : 'none';
      ensureMapSvgVisible();
    }

    lastGpsSwitch = gpsSwitch;
  }

  function updateData(data) {
    if (!data) return;

    try {
      if (data.uiUnitLength) {
        $window._gaugesUnitLength = data.uiUnitLength;
        window._gaugesUnitLength = data.uiUnitLength;
      }
      if (data.uiState && data.uiState.unitSystem) {
        $window._gaugesUnitLength = data.uiState.unitSystem;
        window._gaugesUnitLength = data.uiState.unitSystem;
      }
    } catch (_) {}

    ensureSvg();

    if (!navigatorReady) initNavigator();
    if ($window.map && $window.map.updateData) {
      try { $window.map.updateData(data); } catch (_) {}
    }

    updateNightMode(data);
    updateGaugesBrightness(data);
    updateIndicators(data);
    updateGearPrnd(data);
    updateSpeedUnit(data);
    updateTemp(data);
    updateSpeedText(data);
    updateDriveDisplayState(data);
    updateSpeedWarning(data);
    updateTimeText(data);
    updateOdometer(data);
    updateRemainingRange(data);
    updateBatteryBar(data);
    updateEscMode(data);
    updatePowerSlide(data);
    updateNavigatorToggle(data);
  }

  this.onSVGLoaded = function () {
    svgDoc = findSvgRoot();

    $timeout(function () {
      svgDoc = findSvgRoot();
      if (svgDoc) {
        initPowerIfNeeded();
        ensureGearSelectBaseTransform();
        ensureBatteryBarBaseWidth();
        ensureFadeNodes();
        hideGaugesBrightnessOverlay();
        updateNightMode({ electrics: { dashboard_night_mode: 0 } });
        updateGaugesBrightness({ electrics: { screen_brightness: 1 } });
        resetSpeedWarningState();
        resetSpeedDisplayState();
        resetRemainingRangeState();
        setNodeOpacity('autohold_txt', 0);
        setNodeOpacity('ready_txt', 0);
        setNodeOpacity('speed_txt', 1);
        setNodeOpacity('speed_unit_txt', 1);
        setNodeOpacity('powerslide_needle_circle_txt', 1);
        setNodeOpacity('powerslide_needle', 1);
      }
      scheduleNavigatorInit();
    }, 0);
  };

  $scope.onSVGLoaded = this.onSVGLoaded;

  $window.setup = function (data) {
    try {
      if (data && data.uiUnitLength) {
        $window._gaugesUnitLength = data.uiUnitLength;
        window._gaugesUnitLength = data.uiUnitLength;
      }
      if (data && data.uiState && data.uiState.unitSystem) {
        $window._gaugesUnitLength = data.uiState.unitSystem;
        window._gaugesUnitLength = data.uiState.unitSystem;
      }
    } catch (_) {}
    resetSpeedWarningState();
    resetSpeedDisplayState();
    resetRemainingRangeState();
    setNodeOpacity('autohold_txt', 0);
    setNodeOpacity('ready_txt', 0);
    setNodeOpacity('speed_txt', 1);
    setNodeOpacity('speed_unit_txt', 1);
    setNodeOpacity('powerslide_needle_circle_txt', 1);
    setNodeOpacity('powerslide_needle', 1);
    ensureFadeNodes();
    updateNightMode(data || { electrics: { dashboard_night_mode: 0 } });
    updateGaugesBrightness(data || { electrics: { screen_brightness: 1 } });
    updateEscMode(data);
    ensureBatteryBarBaseWidth();
    updateBatteryBar(data);
    updateDriveDisplayState(data);
    scheduleNavigatorInit();
  };

  $window.updateData = function (data) {
    updateData(data);
  };

  $window.updateMode = function (data) {
    updateEscMode(data);
  };

  $window.updateMap = function () {};
  $window.map = $window.map || { updateData: function () {} };

  scheduleNavigatorInit();
});

})(window);
