window.map = new bngNavigator({
  container: "#mapContainer",
  backgroundRgb: [100, 100, 100],
  roadColors: ["#D8D8D8FF", "#969678FF", "#967864FF"],
  rotate: true,
  scale: 1,
  offsetX: 512,
  offsetY: 256,
  pitch: 3,
  speedPitch: 5,
  hideBootscreen: true
});

var map = window.map;
var dashboardNightMode = 0;
var dashboardNightModeThemeOverride = false;
var pendingDashboardNightMode = null;
var pendingDashboardNightModeUntil = 0;
var rearCam = 0;
var forceNaviScreen = false;
var suspensionState = {
  height: "standard",
  feel: "medium",
  auto: 1
};
var dseMode = "SPORT";
var musicMenuVisible = false;
var musicMenuActualVisible = false;
var musicMenuHideTimer = null;
var powertrainMenuVisible = false;
var powertrainMenuActualVisible = false;
var settingsMenuVisible = false;
var settingsMenuActualVisible = false;
var settingsMenuGroupVisible = false;
var displayAndLightingMenuVisible = false;
var systemInfoMenuVisible = false;
var supportMenuVisible = false;
var settingsSection = "";
var displayThemeMode = "auto";
var screenBrightness = 1;
var displayedScreenBrightness = 1;
var systemInfoOdometerKm = 0;
var systemInfoUnit = "km";
var ambientBrightness = 1;
var ambientColorHue = 0.52;
var ambientColor = { r: 0.01, g: 0.82, b: 1 };
var lastBrightnessLuaSendTime = 0;
var lastAmbientBrightnessLuaSendTime = 0;
var lastAmbientColorLuaSendTime = 0;
var lastThemeLuaSendTime = 0;
var brightnessSliderDragging = false;
var ambientBrightnessSliderDragging = false;
var ambientColorSliderDragging = false;
var ambientInteractionLockUntil = 0;
var brightnessSliderBase = null;
var ambientBrightnessSliderBase = null;
var ambientColorSliderBase = null;
var MIN_SCREEN_BRIGHTNESS = 0.15;
var settingsMenuHideTimer = null;
var settingsMenuGroupTimer = null;
var autoRearCamActive = false;
var modeBeforeAutoRearCam = "navi";
var powertrainDetailsVisible = false;
var powertrainMenuHideTimer = null;
var powertrainMenuGroupTimer = null;
var screenMode = "navi";
var MODE_SELECT_NAVI_X = 0;
var MODE_SELECT_MUSIC_X = 51.667;
var MODE_SELECT_POWERTRAIN_X = 103.333;
var MODE_SELECT_REARCAMERA_X = 155;
var MODE_SELECT_SETTINGS_X = 235;
var POWERTRAIN_BG_ANIM_MS = 420;
var POWERTRAIN_GROUP_DELAY_MS = 650;
var POWERTRAIN_GROUP_FADE_MS = 360;
var SETTINGS_MENU_ANIM_MS = 280;
var POWERTRAIN_DETAIL_IDS = [
  "powertrain_menu_bg_group",
  "suspension_feel_soft",
  "suspension_feel_medium",
  "suspension_feel_hard",
  "suspension_auto_mode_txt",
  "suspension_auto_mode_bg",
  "suspension_feel_txt",
  "suspension_height_txt",
  "suspension_mode_high",
  "suspension_mode_medium",
  "suspension_mode_low",
  "dse_off_txt",
  "dse_offroad_txt",
  "dse_sport_txt",
  "dse_conserve_txt",
  "dse_offroad_bg",
  "dse_off_bg",
  "dse_conserve_bg",
  "dse_sport_bg"
];
var clockStarted = false;
var rafId = null;
var screenInputStarted = false;
var touchCircleInstalled = false;
var lastTouchTime = 0;
var lastTouchX = -9999;
var lastTouchY = -9999;
var DEBUG_SUSPENSION = false;
var debugPanel = null;
var debugLines = [];
var startScreenVisible = false;
var startScreenSaveStateLoaded = false;
var startScreenClosedThisSession = false;
var startScreenDontShow = false;
var startScreenDisabled = false;
var startScreenShownAt = 0;
var START_SCREEN_GOT_IT_DELAY_MS = 3600;
var START_SCREEN_ANIM_DELAY_MS = 1000;
var START_SCREEN_GOT_IT_BLUE = "#001d6e";
var START_SCREEN_GOT_IT_HOVER_BLUE = "#002f9e";
var startScreenGotItHover = false;
var startScreenGotItButtonBox = null;
var lastLoggedAirDebug = "";
var lastLoggedNaviDebug = "";

function debugLog(message) {
  if (!DEBUG_SUSPENSION) return;
  const text = new Date().toLocaleTimeString() + " " + String(message);
  debugLines.push(text);
  while (debugLines.length > 9) debugLines.shift();
  console.log("ACMRIVIAN_DEBUG " + text);
  if (!debugPanel) {
    debugPanel = document.createElement("div");
    debugPanel.style.position = "absolute";
    debugPanel.style.left = "6px";
    debugPanel.style.top = "6px";
    debugPanel.style.maxWidth = "1000px";
    debugPanel.style.padding = "6px 8px";
    debugPanel.style.background = "rgba(0,0,0,0.72)";
    debugPanel.style.color = "#00ff66";
    debugPanel.style.font = "12px monospace";
    debugPanel.style.lineHeight = "15px";
    debugPanel.style.zIndex = "99999";
    debugPanel.style.pointerEvents = "none";
    debugPanel.style.whiteSpace = "pre";
    document.body.appendChild(debugPanel);
  }
  debugPanel.textContent = debugLines.join("\n");
}

function getStartScreenNow() {
  return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
}

function getStartScreenGotItProgress() {
  if (!startScreenVisible) return 1;
  if (!startScreenShownAt) return 0;
  return clampValue((getStartScreenNow() - startScreenShownAt - START_SCREEN_ANIM_DELAY_MS) / START_SCREEN_GOT_IT_DELAY_MS, 0, 1);
}

function isStartScreenGotItReady() {
  return getStartScreenGotItProgress() >= 1;
}

function setStartScreenGotItFill(svgDoc, ratio) {
  if (!svgDoc) return;

  const bg = svgDoc.getElementById("got_in_button_bg");
  if (!bg || typeof bg.getBBox !== "function") return;

  ratio = clampValue(ratio, 0, 1);

  let defs = svgDoc.querySelector("defs");
  if (!defs) {
    const svgRoot = svgDoc.querySelector("svg");
    if (!svgRoot) return;
    defs = svgDoc.createElementNS("http://www.w3.org/2000/svg", "defs");
    svgRoot.insertBefore(defs, svgRoot.firstChild);
  }

  let clip = svgDoc.getElementById("got_in_button_bg_fill_clip_runtime");
  let clipRect = svgDoc.getElementById("got_in_button_bg_fill_clip_rect_runtime");

  if (!clip) {
    clip = svgDoc.createElementNS("http://www.w3.org/2000/svg", "clipPath");
    clip.setAttribute("id", "got_in_button_bg_fill_clip_runtime");
    clip.setAttribute("clipPathUnits", "userSpaceOnUse");

    clipRect = svgDoc.createElementNS("http://www.w3.org/2000/svg", "rect");
    clipRect.setAttribute("id", "got_in_button_bg_fill_clip_rect_runtime");

    clip.appendChild(clipRect);
    defs.appendChild(clip);
  }

  let fill = svgDoc.getElementById("got_in_button_bg_fill_runtime");
  if (!fill) {
    fill = bg.cloneNode(true);
    fill.setAttribute("id", "got_in_button_bg_fill_runtime");
    fill.removeAttribute("style");
    fill.style.pointerEvents = "none";
    fill.style.transition = "none";
    fill.setAttribute("clip-path", "url(#got_in_button_bg_fill_clip_runtime)");

    if (bg.parentNode) {
      bg.parentNode.insertBefore(fill, bg.nextSibling);
    }
  }

  if (!startScreenGotItButtonBox || startScreenGotItButtonBox.bg !== bg) {
    const box = bg.getBBox();
    startScreenGotItButtonBox = {
      bg: bg,
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height
    };

    clipRect.setAttribute("x", String(startScreenGotItButtonBox.x));
    clipRect.setAttribute("y", String(startScreenGotItButtonBox.y));
    clipRect.setAttribute("height", String(startScreenGotItButtonBox.height));
  }

  const width = Math.max(0, startScreenGotItButtonBox.width * ratio);
  clipRect.setAttribute("width", width.toFixed(3));

  const ready = ratio >= 1;
  const color = ready && startScreenGotItHover ? START_SCREEN_GOT_IT_HOVER_BLUE : START_SCREEN_GOT_IT_BLUE;

  fill.style.fill = color;
  fill.setAttribute("fill", color);
  fill.style.opacity = ready && startScreenGotItHover ? "1" : "0.9";
  fill.setAttribute("opacity", ready && startScreenGotItHover ? "1" : "0.9");

  setElementVisibility(fill, startScreenVisible && ratio > 0.001);
}


function updateStartScreenHover(x, y) {
  const svgDoc = getSvgDoc();

  if (!svgDoc || !startScreenVisible || !isStartScreenGotItReady()) {
    if (startScreenGotItHover) {
      startScreenGotItHover = false;
      applyStartScreen(svgDoc);
    }
    return;
  }

  const wasHover = startScreenGotItHover;
  startScreenGotItHover = getSvgHitboxId(x, y) === "hitbox_got_it";

  if (wasHover !== startScreenGotItHover) {
    applyStartScreen(svgDoc);
  }
}

function applyStartScreen(svgDoc) {
  if (!svgDoc) return;

  if (!startScreenSaveStateLoaded) {
    const group = svgDoc.getElementById("start_screen_menu");
    if (group) setElementVisibility(group, false);
    setStartScreenGotItFill(svgDoc, 0);
    return;
  }

  if (startScreenDisabled) {
    const group = svgDoc.getElementById("start_screen_menu");
    if (group) setElementVisibility(group, false);
    setStartScreenGotItFill(svgDoc, 0);
    return;
  }

  const group = svgDoc.getElementById("start_screen_menu");
  const ind = svgDoc.getElementById("dont_show_again_ind");

  if (startScreenVisible && !startScreenShownAt) {
    startScreenShownAt = getStartScreenNow();
  }

  if (group) {
    setElementVisibility(group, startScreenVisible);
  }

  if (ind) {
    if (!ind.dataset.startScreenFillSaved) {
      ind.dataset.startScreenFillSaved = "1";
      ind.dataset.startScreenStyleFill = ind.style.fill || "";
      ind.dataset.startScreenAttrFill = ind.getAttribute("fill") || "";
    }

    if (startScreenDontShow) {
      ind.style.fill = "#ffffff";
      ind.setAttribute("fill", "#ffffff");
    } else {
      ind.style.fill = ind.dataset.startScreenStyleFill || "none";
      if (ind.dataset.startScreenAttrFill) {
        ind.setAttribute("fill", ind.dataset.startScreenAttrFill);
      } else {
        ind.setAttribute("fill", "none");
      }
    }
  }

  setStartScreenGotItFill(svgDoc, getStartScreenGotItProgress());
}


function getSvgDoc() {
  const obj = document.getElementById("naviSvg");
  if (!obj) return null;
  return obj.contentDocument || null;
}

function formatTime(num) {
  return num < 10 ? "0" + num : String(num);
}

function setSvgText(el, value) {
  if (!el) return;
  const tspans = el.querySelectorAll("tspan");
  if (tspans.length > 0) {
    tspans[0].textContent = value;
  } else {
    el.textContent = value;
  }
}

function setElementVisibility(el, isVisible) {
  if (!el) return;

  if (isVisible) {
    el.setAttribute("visibility", "visible");
    el.setAttribute("display", "inline");
  } else {
    el.setAttribute("visibility", "hidden");
    el.setAttribute("display", "none");
  }
}

function setElementTranslateX(el, x) {
  if (!el) return;
  el.style.transformBox = "fill-box";
  el.style.transformOrigin = "center center";
  el.style.transform = "translate(" + x + "px, 0)";
  el.setAttribute("transform", "translate(" + x + ", 0)");
}

function isDisplayThemeDark() {
  if (displayThemeMode === "black") return true;
  if (displayThemeMode === "white") return false;
  return !!dashboardNightMode;
}

function normalizeDisplayTheme(value) {
  if (value === undefined || value === null || value === "") return displayThemeMode || "auto";
  const theme = String(value).toLowerCase().replace(/[\s_\-]/g, "");

  if (theme === "white" || theme === "light") return "white";
  if (theme === "black" || theme === "dark") return "black";
  return "auto";
}

function applyNightMode(svgDoc) {
  if (!svgDoc) return;
  const el = svgDoc.getElementById("main_gps_bg_txt");
  if (!el) return;

  setElementVisibility(el, isDisplayThemeDark() || (!!rearCam && screenMode === "rearcamera"));
}


function applySettingsNightInvert(svgDoc) {
  if (!svgDoc) return;

  const dark = isDisplayThemeDark();

  const ids = [
    "settings_menu_bg_txt",
    "settings_menu_lines_group",
    "display_and_lighting_bg_group",
    "display_and_lighting_bg",
    "vehicle_bg",
    "display_brightness_bar",
    "display_and_lighting_menu_txt_group",
    "vehicle_txt",
    "display_and_lighting_txt",
    "system_info_bg",
    "system_info_txt",
    "system_info_menu_group",
    "system_info_menu_lines_group",
    "system_info_menu_txt_group",
    "system_info_menu_odometer_txt",
    "support_menu_group",
    "support_menu_lines_group",
    "support_menu_txt_group",
    "support_txt",
    "support_bg",
    "music_menu_bg_txt",
    "music_menu_lines_group",
    "music_menu_txt_group",
    "display_theme_select"
  ];

  const saveOriginal = function (el) {
    if (!el || el.dataset.nightColorSaved) return;

    el.dataset.nightColorSaved = "1";
    el.dataset.nightStyleFill = el.style.fill || "";
    el.dataset.nightAttrFill = el.getAttribute("fill") || "";
    el.dataset.nightStyleFilter = el.style.filter || "";
    el.dataset.nightStyleWebkitFilter = el.style.webkitFilter || "";

    const nodes = el.querySelectorAll ? el.querySelectorAll("*") : [];
    for (let i = 0; i < nodes.length; i++) {
      nodes[i].dataset.nightColorSaved = "1";
      nodes[i].dataset.nightStyleFill = nodes[i].style.fill || "";
      nodes[i].dataset.nightAttrFill = nodes[i].getAttribute("fill") || "";
      nodes[i].dataset.nightStyleFilter = nodes[i].style.filter || "";
      nodes[i].dataset.nightStyleWebkitFilter = nodes[i].style.webkitFilter || "";
    }
  };

  const restoreOriginal = function (el) {
    if (!el || !el.dataset.nightColorSaved) return;

    el.style.fill = el.dataset.nightStyleFill || "";
    if (el.dataset.nightAttrFill) {
      el.setAttribute("fill", el.dataset.nightAttrFill);
    } else {
      el.removeAttribute("fill");
    }

    el.style.filter = el.dataset.nightStyleFilter || "";
    el.style.webkitFilter = el.dataset.nightStyleWebkitFilter || "";

    const nodes = el.querySelectorAll ? el.querySelectorAll("*") : [];
    for (let i = 0; i < nodes.length; i++) {
      if (!nodes[i].dataset.nightColorSaved) continue;

      nodes[i].style.fill = nodes[i].dataset.nightStyleFill || "";
      if (nodes[i].dataset.nightAttrFill) {
        nodes[i].setAttribute("fill", nodes[i].dataset.nightAttrFill);
      } else {
        nodes[i].removeAttribute("fill");
      }

      nodes[i].style.filter = nodes[i].dataset.nightStyleFilter || "";
      nodes[i].style.webkitFilter = nodes[i].dataset.nightStyleWebkitFilter || "";
    }
  };

  const setFill = function (el, color) {
    if (!el) return;

    saveOriginal(el);

    el.style.filter = "none";
    el.style.webkitFilter = "none";
    el.style.fill = color;
    el.setAttribute("fill", color);

    const nodes = el.querySelectorAll ? el.querySelectorAll("*") : [];
    for (let i = 0; i < nodes.length; i++) {
      nodes[i].style.filter = "none";
      nodes[i].style.webkitFilter = "none";
      nodes[i].style.fill = color;
      nodes[i].setAttribute("fill", color);
    }
  };

  if (!dark) {
    for (let i = 0; i < ids.length; i++) {
      restoreOriginal(svgDoc.getElementById(ids[i]));
    }
    return;
  }

  setFill(svgDoc.getElementById("settings_menu_bg_txt"), "#000000");

  setFill(svgDoc.getElementById("settings_menu_lines_group"), "hsl(0, 0%, 7%)");
  setFill(svgDoc.getElementById("display_and_lighting_bg_group"), "hsl(0, 0%, 7%)");
  setFill(svgDoc.getElementById("display_and_lighting_bg"), "hsl(0, 0%, 7%)");
  setFill(svgDoc.getElementById("vehicle_bg"), "hsl(0, 0%, 7%)");

  setFill(svgDoc.getElementById("display_brightness_bar"), "hsl(0, 0%, 7%)");
  setFill(svgDoc.getElementById("ambient_brightness_bar"), "hsl(0, 0%, 7%)");

  setFill(svgDoc.getElementById("display_and_lighting_menu_txt_group"), "#ffffff");
  setFill(svgDoc.getElementById("vehicle_txt"), "#ffffff");
  setFill(svgDoc.getElementById("display_and_lighting_txt"), "#ffffff");
  setFill(svgDoc.getElementById("system_info_bg"), "hsl(0, 0%, 7%)");
  setFill(svgDoc.getElementById("system_info_txt"), "#ffffff");
  setFill(svgDoc.getElementById("system_info_menu_lines_group"), "hsl(0, 0%, 7%)");
  setFill(svgDoc.getElementById("system_info_menu_txt_group"), "#ffffff");
  setFill(svgDoc.getElementById("system_info_menu_odometer_txt"), "#ffffff");
  setFill(svgDoc.getElementById("support_menu_group"), "hsl(0, 0%, 7%)");
  setFill(svgDoc.getElementById("support_menu_lines_group"), "hsl(0, 0%, 7%)");
  setFill(svgDoc.getElementById("support_menu_txt_group"), "#ffffff");
  setFill(svgDoc.getElementById("support_txt"), "#ffffff");
  setFill(svgDoc.getElementById("support_bg"), "hsl(0, 0%, 7%)");
  setFill(svgDoc.getElementById("music_menu_bg_txt"), "#000000");
  setFill(svgDoc.getElementById("music_menu_lines_group"), "hsl(0, 0%, 7%)");
  setFill(svgDoc.getElementById("music_menu_txt_group"), "#ffffff");
  setFill(svgDoc.getElementById("display_theme_select"), "#ffffff");
  const themeTexts = [
    "display_theme_auto_txt",
    "display_theme_black_txt",
    "display_theme_white_txt"
  ];

  for (let i = 0; i < themeTexts.length; i++) {
    const el = svgDoc.getElementById(themeTexts[i]);
    if (!el) continue;

    saveOriginal(el);

    const isActive =
      (themeTexts[i] === "display_theme_auto_txt" && displayThemeMode === "auto") ||
      (themeTexts[i] === "display_theme_white_txt" && displayThemeMode === "white") ||
      (themeTexts[i] === "display_theme_black_txt" && displayThemeMode === "black");

    const color = isActive ? "#000000" : "#ffffff";

    el.style.fill = color;
    el.setAttribute("fill", color);

    const nodes = el.querySelectorAll ? el.querySelectorAll("*") : [];
    for (let j = 0; j < nodes.length; j++) {
      nodes[j].style.fill = color;
      nodes[j].setAttribute("fill", color);
    }
  }

}




function applyPowertrainNightInvert(svgDoc) {
  if (!svgDoc) return;

  const dark = isDisplayThemeDark();

  const saveOriginal = function (el) {
    if (!el || el.dataset.powertrainNightColorSaved) return;

    el.dataset.powertrainNightColorSaved = "1";
    el.dataset.powertrainNightStyleFill = el.style.fill || "";
    el.dataset.powertrainNightAttrFill = el.getAttribute("fill") || "";
    el.dataset.powertrainNightStyleFilter = el.style.filter || "";
    el.dataset.powertrainNightStyleWebkitFilter = el.style.webkitFilter || "";

    const nodes = el.querySelectorAll ? el.querySelectorAll("*") : [];
    for (let i = 0; i < nodes.length; i++) {
      nodes[i].dataset.powertrainNightColorSaved = "1";
      nodes[i].dataset.powertrainNightStyleFill = nodes[i].style.fill || "";
      nodes[i].dataset.powertrainNightAttrFill = nodes[i].getAttribute("fill") || "";
      nodes[i].dataset.powertrainNightStyleFilter = nodes[i].style.filter || "";
      nodes[i].dataset.powertrainNightStyleWebkitFilter = nodes[i].style.webkitFilter || "";
    }
  };

  const restoreOriginal = function (el) {
    if (!el || !el.dataset.powertrainNightColorSaved) return;

    el.style.fill = el.dataset.powertrainNightStyleFill || "";
    if (el.dataset.powertrainNightAttrFill) {
      el.setAttribute("fill", el.dataset.powertrainNightAttrFill);
    } else {
      el.removeAttribute("fill");
    }

    el.style.filter = el.dataset.powertrainNightStyleFilter || "";
    el.style.webkitFilter = el.dataset.powertrainNightStyleWebkitFilter || "";

    const nodes = el.querySelectorAll ? el.querySelectorAll("*") : [];
    for (let i = 0; i < nodes.length; i++) {
      if (!nodes[i].dataset.powertrainNightColorSaved) continue;

      nodes[i].style.fill = nodes[i].dataset.powertrainNightStyleFill || "";
      if (nodes[i].dataset.powertrainNightAttrFill) {
        nodes[i].setAttribute("fill", nodes[i].dataset.powertrainNightAttrFill);
      } else {
        nodes[i].removeAttribute("fill");
      }

      nodes[i].style.filter = nodes[i].dataset.powertrainNightStyleFilter || "";
      nodes[i].style.webkitFilter = nodes[i].dataset.powertrainNightStyleWebkitFilter || "";
    }
  };

  const setFill = function (el, color) {
    if (!el) return;

    saveOriginal(el);

    el.style.filter = "none";
    el.style.webkitFilter = "none";
    el.style.fill = color;
    el.setAttribute("fill", color);

    const nodes = el.querySelectorAll ? el.querySelectorAll("*") : [];
    for (let i = 0; i < nodes.length; i++) {
      nodes[i].style.filter = "none";
      nodes[i].style.webkitFilter = "none";
      nodes[i].style.fill = color;
      nodes[i].setAttribute("fill", color);
    }
  };

  const ids = [
    "powertrain_menu_bg_txt",
    "powertrain_menu_bg_group",
    "suspension_feel_txt",
    "suspension_height_txt"
  ];

  if (!dark) {
    for (let i = 0; i < ids.length; i++) {
      restoreOriginal(svgDoc.getElementById(ids[i]));
    }
    return;
  }

  setFill(svgDoc.getElementById("powertrain_menu_bg_txt"), "#000000");
  setFill(svgDoc.getElementById("powertrain_menu_bg_group"), "#ffffff");
  setFill(svgDoc.getElementById("suspension_feel_txt"), "#ffffff");
  setFill(svgDoc.getElementById("suspension_height_txt"), "#ffffff");
}

function setElementFill(el, color) {
  if (!el) return;

  if (el.id === "display_brightness_knob" || el.id === "ambient_brightness_knob" || el.id === "ambient_color_knob") return;

  el.style.fill = color;
  el.setAttribute("fill", color);

  const children = el.querySelectorAll ? el.querySelectorAll("tspan, text, path, rect") : [];
  for (let i = 0; i < children.length; i++) {
    if (children[i].id === "display_brightness_knob" || children[i].id === "ambient_brightness_knob" || children[i].id === "ambient_color_knob") continue;
    children[i].style.fill = color;
    children[i].setAttribute("fill", color);
  }
}


function clampValue(value, min, max) {
  value = Number(value);
  if (!isFinite(value)) value = min;
  return Math.max(min, Math.min(max, value));
}

function normalizeBrightness(value) {
  return clampValue(value, MIN_SCREEN_BRIGHTNESS, 1);
}

function getNumberAttr(el, name, fallback) {
  if (!el) return fallback;
  const value = parseFloat(el.getAttribute(name));
  return isFinite(value) ? value : fallback;
}

function getBrightnessSliderBase(svgDoc) {
  if (!svgDoc) return null;

  const hitbox = svgDoc.getElementById("hitbox_brightness_slider");
  const bar = svgDoc.getElementById("display_brightness_bar");
  const knob = svgDoc.getElementById("display_brightness_knob");

  if (!hitbox || !bar || !knob || typeof bar.getBBox !== "function") return null;

  if (!brightnessSliderBase || brightnessSliderBase.hitbox !== hitbox || brightnessSliderBase.bar !== bar || brightnessSliderBase.knob !== knob) {
    const hitboxBox = typeof hitbox.getBBox === "function" ? hitbox.getBBox() : bar.getBBox();
    const knobBox = typeof knob.getBBox === "function" ? knob.getBBox() : { x: hitboxBox.x, width: 0 };
    const barBox = bar.getBBox();
    const barX = getNumberAttr(bar, "x", barBox.x);
    const rawBarWidth = getNumberAttr(bar, "width", barBox.width || 196.5);
    const barWidth = isFinite(rawBarWidth) && rawBarWidth > 0 ? rawBarWidth : 196.5;
    const knobBaseCenter = getNumberAttr(knob, "cx", knobBox.x + knobBox.width * 0.5);

    const knobWidth = knobBox.width || getNumberAttr(knob, "width", 0) || 0;
    const knobHalf = knobWidth * 0.5;

    brightnessSliderBase = {
      hitbox: hitbox,
      bar: bar,
      knob: knob,
      hitboxX: hitboxBox.x,
      hitboxWidth: hitboxBox.width || barWidth || 1,
      barX: barX,
      barWidth: barWidth,
      knobHalf: knobHalf,
      knobBaseCenter: knobBaseCenter,
      knobBaseTransform: knob.getAttribute("transform") || ""
    };
  }

  return brightnessSliderBase;
}


function getAmbientBrightnessSliderBase(svgDoc) {
  if (!svgDoc) return null;

  const hitbox = svgDoc.getElementById("hitbox_ambient_brightness_slider");
  const bar = svgDoc.getElementById("ambient_brightness_bar");
  const knob = svgDoc.getElementById("ambient_brightness_knob");

  if (!hitbox || !bar || !knob || typeof bar.getBBox !== "function") return null;

  if (!ambientBrightnessSliderBase || ambientBrightnessSliderBase.hitbox !== hitbox || ambientBrightnessSliderBase.bar !== bar || ambientBrightnessSliderBase.knob !== knob) {
    const hitboxBox = typeof hitbox.getBBox === "function" ? hitbox.getBBox() : bar.getBBox();
    const knobBox = typeof knob.getBBox === "function" ? knob.getBBox() : { x: hitboxBox.x, width: 0 };
    const barBox = bar.getBBox();
    const barX = getNumberAttr(bar, "x", barBox.x);
    const rawBarWidth = getNumberAttr(bar, "width", barBox.width || 196.5);
    const barWidth = isFinite(rawBarWidth) && rawBarWidth > 0 ? rawBarWidth : 196.5;
    const knobBaseCenter = getNumberAttr(knob, "cx", knobBox.x + knobBox.width * 0.5);
    const knobWidth = knobBox.width || getNumberAttr(knob, "width", 0) || 0;
    const knobHalf = knobWidth * 0.5;

    ambientBrightnessSliderBase = {
      hitbox: hitbox,
      bar: bar,
      knob: knob,
      hitboxX: hitboxBox.x,
      hitboxWidth: hitboxBox.width || barWidth || 1,
      barX: barX,
      barWidth: barWidth,
      knobHalf: knobHalf,
      knobBaseCenter: knobBaseCenter,
      knobBaseTransform: knob.getAttribute("transform") || ""
    };
  }

  return ambientBrightnessSliderBase;
}

function getAmbientColorSliderBase(svgDoc) {
  if (!svgDoc) return null;

  const hitbox = svgDoc.getElementById("hitbox_ambient_color_slider");
  const bar = svgDoc.getElementById("ambient_color_bar");
  const knob = svgDoc.getElementById("ambient_color_knob");

  if (!hitbox || !bar || !knob || typeof bar.getBBox !== "function") return null;

  if (!ambientColorSliderBase || ambientColorSliderBase.hitbox !== hitbox || ambientColorSliderBase.bar !== bar || ambientColorSliderBase.knob !== knob) {
    const hitboxBox = typeof hitbox.getBBox === "function" ? hitbox.getBBox() : bar.getBBox();
    const knobBox = typeof knob.getBBox === "function" ? knob.getBBox() : { x: hitboxBox.x, width: 0 };
    const barBox = bar.getBBox();
    const barX = getNumberAttr(bar, "x", barBox.x);
    const rawBarWidth = getNumberAttr(bar, "width", hitboxBox.width || barBox.width || 414);
    const barWidth = isFinite(rawBarWidth) && rawBarWidth > 0 ? rawBarWidth : 414;
    const knobBaseCenter = getNumberAttr(knob, "cx", knobBox.x + knobBox.width * 0.5);

    ambientColorSliderBase = {
      hitbox: hitbox,
      bar: bar,
      knob: knob,
      hitboxX: hitboxBox.x,
      hitboxWidth: hitboxBox.width || barWidth || 1,
      barX: barX,
      barWidth: barWidth,
      knobBaseCenter: knobBaseCenter,
      knobBaseTransform: knob.getAttribute("transform") || ""
    };
  }

  return ambientColorSliderBase;
}

function hsvToRgb(h, s, v) {
  h = ((Number(h) || 0) % 1 + 1) % 1;
  s = clampValue(s, 0, 1);
  v = clampValue(v, 0, 1);

  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  let r = v;
  let g = t;
  let b = p;

  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }

  return { r: r, g: g, b: b };
}

function rgbToCss(color) {
  const r = Math.round(clampValue(color.r, 0, 1) * 255);
  const g = Math.round(clampValue(color.g, 0, 1) * 255);
  const b = Math.round(clampValue(color.b, 0, 1) * 255);
  return "rgb(" + r + "," + g + "," + b + ")";
}

function rgbToHue(color) {
  const r = clampValue(color.r, 0, 1);
  const g = clampValue(color.g, 0, 1);
  const b = clampValue(color.b, 0, 1);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = ambientColorHue;

  if (d < 0.0001) return h;

  if (max === r) {
    h = ((g - b) / d) % 6;
  } else if (max === g) {
    h = (b - r) / d + 2;
  } else {
    h = (r - g) / d + 4;
  }

  h = h / 6;
  if (h < 0) h += 1;
  return clampValue(h, 0, 1);
}

function setAmbientColorFromHue(hue) {
  ambientColorHue = clampValue(hue, 0, 1);
  ambientColor = hsvToRgb(ambientColorHue, 1, 1);
}

function applyAmbientCurrentColor(svgDoc) {
  if (!svgDoc) return;
  const el = svgDoc.getElementById("ambient_current_color");
  if (!el) return;

  const color = rgbToCss(ambientColor);
  el.style.fill = color;
  el.setAttribute("fill", color);
}

function applyAmbientColorSlider(svgDoc) {
  applyAmbientCurrentColor(svgDoc);

  const base = getAmbientColorSliderBase(svgDoc);
  if (!base) return;

  ambientColorHue = clampValue(ambientColorHue, 0, 1);
  const sliderVisible = !!settingsMenuVisible && !!settingsMenuGroupVisible && settingsSection === "display_and_lighting" && !!displayAndLightingMenuVisible;

  setElementVisibility(base.bar, sliderVisible);

  const targetCenter = base.barX + base.barWidth * ambientColorHue;
  const dx = targetCenter - base.knobBaseCenter;
  const transform = (base.knobBaseTransform ? base.knobBaseTransform + " " : "") + "translate(" + dx + ",0)";
  base.knob.setAttribute("transform", transform);
  setElementVisibility(base.knob, sliderVisible);
}

function sendAmbientColorToLua(force) {
  const now = Date.now();
  if (!force && now - lastAmbientColorLuaSendTime < 90) return;
  lastAmbientColorLuaSendTime = now;
  ambientInteractionLockUntil = now + 900;

  if (typeof window.callVehicleLua === "function") {
    window.callVehicleLua("acmrivianNaviAmbientColor", {
      hue: ambientColorHue,
      r: clampValue(ambientColor.r, 0, 1),
      g: clampValue(ambientColor.g, 0, 1),
      b: clampValue(ambientColor.b, 0, 1)
    });
  } else {
    debugLog("AMBIENT COLOR FAIL JS callVehicleLua missing");
  }
}

function handleAmbientColorSliderPosition(clientX, sendToLua, forceSend) {
  const svgDoc = getSvgDoc();
  if (!svgDoc) return;

  const base = getAmbientColorSliderBase(svgDoc);
  if (!base || !base.hitbox || typeof base.hitbox.getBoundingClientRect !== "function") return;

  const rect = base.hitbox.getBoundingClientRect();
  if (!rect || rect.width <= 0) return;

  ambientInteractionLockUntil = Date.now() + 900;
  const localX = clampValue(clientX - rect.left, 0, rect.width);
  setAmbientColorFromHue(localX / rect.width);
  applyAmbientColorSlider(svgDoc);

  if (sendToLua) sendAmbientColorToLua(!!forceSend);
}

function getBrightnessFillElement(svgDoc, base) {
  if (!svgDoc || !base || !base.bar) return null;

  let fill = svgDoc.getElementById("display_brightness_fill_runtime");
  if (!fill) {
    fill = base.bar.cloneNode(true);
    fill.setAttribute("id", "display_brightness_fill_runtime");
    fill.removeAttribute("style");
    fill.style.pointerEvents = "none";
    fill.style.transition = "none";
    base.bar.parentNode.insertBefore(fill, base.bar.nextSibling);
  }

  if (isDisplayThemeDark()) {
    fill.style.fill = "#ffffff";
    fill.setAttribute("fill", "#ffffff");
  } else {
    fill.style.fill = "#000000";
    fill.setAttribute("fill", "#000000");
  }
  fill.style.transition = "none";
  fill.style.opacity = "1";
  fill.setAttribute("opacity", "1");
  return fill;
}


function getAmbientBrightnessFillElement(svgDoc, base) {
  if (!svgDoc || !base || !base.bar) return null;

  let fill = svgDoc.getElementById("ambient_brightness_fill_runtime");
  if (!fill) {
    fill = base.bar.cloneNode(true);
    fill.setAttribute("id", "ambient_brightness_fill_runtime");
    fill.removeAttribute("style");
    fill.style.pointerEvents = "none";
    fill.style.transition = "none";
    base.bar.parentNode.insertBefore(fill, base.bar.nextSibling);
  }

  if (isDisplayThemeDark()) {
    fill.style.fill = "#ffffff";
    fill.setAttribute("fill", "#ffffff");
  } else {
    fill.style.fill = "#000000";
    fill.setAttribute("fill", "#000000");
  }
  fill.style.transition = "none";
  fill.style.opacity = "1";
  fill.setAttribute("opacity", "1");
  return fill;
}

function applyAmbientLight(svgDoc) {
  if (!svgDoc) return;

  const ids = [
    "ambient_light_group",
    "ambient_light_1",
    "ambient_light_2",
    "ambient_light_3",
    "ambient_light_4",
    "ambient_light_5"
  ];

  const value = clampValue(ambientBrightness, 0, 1);

  for (let i = 0; i < ids.length; i++) {
    const el = svgDoc.getElementById(ids[i]);
    if (!el) continue;
    el.style.opacity = String(value);
    el.setAttribute("opacity", String(value));
  }
}

function applyAmbientBrightnessSlider(svgDoc) {
  const base = getAmbientBrightnessSliderBase(svgDoc);
  if (!base) {
    applyAmbientLight(svgDoc);
    return;
  }

  ambientBrightness = clampValue(ambientBrightness, 0, 1);
  const ratio = ambientBrightness;
  const sliderVisible = !!settingsMenuVisible && !!settingsMenuGroupVisible && settingsSection === "display_and_lighting" && !!displayAndLightingMenuVisible;
  const fill = getAmbientBrightnessFillElement(svgDoc, base);

  if (fill) {
    fill.setAttribute("x", String(base.barX));
    fill.setAttribute("width", String(base.barWidth * ratio));
    setElementVisibility(fill, sliderVisible);
  }

  base.bar.setAttribute("x", String(base.barX));
  base.bar.setAttribute("width", String(base.barWidth));
  setElementVisibility(base.bar, sliderVisible);

  const knobTravelHalf = 70;
  const targetCenter = base.knobBaseCenter + (ratio - 0.5) * knobTravelHalf * 2;
  const dx = targetCenter - base.knobBaseCenter;
  const transform = (base.knobBaseTransform ? base.knobBaseTransform + " " : "") + "translate(" + dx + ",0)";
  base.knob.setAttribute("transform", transform);
  setElementVisibility(base.knob, sliderVisible);
  applyAmbientLight(svgDoc);
}

function sendAmbientBrightnessToLua(value, force) {
  const now = Date.now();
  if (!force && now - lastAmbientBrightnessLuaSendTime < 90) return;
  lastAmbientBrightnessLuaSendTime = now;
  ambientInteractionLockUntil = now + 900;

  const v = clampValue(value, 0, 1);
  debugLog("AMBIENT SEND JS value=" + v.toFixed(3) + " force=" + (!!force));

  if (typeof window.callVehicleLua === "function") {
    window.callVehicleLua("acmrivianNaviAmbientBrightness", { value: v });
  } else {
    debugLog("AMBIENT FAIL JS callVehicleLua missing");
  }
}

function handleAmbientBrightnessSliderPosition(clientX, sendToLua, forceSend) {
  const svgDoc = getSvgDoc();
  if (!svgDoc) return;

  const base = getAmbientBrightnessSliderBase(svgDoc);
  if (!base || !base.bar || typeof base.bar.getBoundingClientRect !== "function") return;

  const rect = base.bar.getBoundingClientRect();
  if (!rect || rect.width <= 0) return;

  ambientInteractionLockUntil = Date.now() + 900;
  const localX = clampValue(clientX - rect.left, 0, rect.width);
  ambientBrightness = clampValue(localX / rect.width, 0, 1);
  applyAmbientBrightnessSlider(svgDoc);

  if (sendToLua) sendAmbientBrightnessToLua(ambientBrightness, !!forceSend);
}

function applyScreenBrightness(svgDoc) {
  if (!svgDoc) return;

  const bg = svgDoc.getElementById("screen_brightness_bg");
  if (!bg) return;

  const target = normalizeBrightness(screenBrightness);
  displayedScreenBrightness = normalizeBrightness(displayedScreenBrightness);

  const diff = target - displayedScreenBrightness;
  if (Math.abs(diff) < 0.002) {
    displayedScreenBrightness = target;
  } else {
    displayedScreenBrightness += diff * 0.16;
  }

  const opacity = clampValue((1 - displayedScreenBrightness) * 0.85, 0, 0.85);

  bg.style.transition = "none";
  bg.style.opacity = String(opacity);
  bg.setAttribute("opacity", String(opacity));
  setElementVisibility(bg, opacity > 0.001);
}

function applyBrightnessSlider(svgDoc) {
  applyScreenBrightness(svgDoc);

  const base = getBrightnessSliderBase(svgDoc);
  if (!base) return;

  const value = normalizeBrightness(screenBrightness);
  screenBrightness = value;
  const ratio = clampValue((value - MIN_SCREEN_BRIGHTNESS) / (1 - MIN_SCREEN_BRIGHTNESS), 0, 1);
  const sliderVisible = !!settingsMenuVisible && !!settingsMenuGroupVisible && settingsSection === "display_and_lighting" && !!displayAndLightingMenuVisible;
  const fill = getBrightnessFillElement(svgDoc, base);

  if (fill) {
    fill.setAttribute("x", String(base.barX));
    fill.setAttribute("width", String(base.barWidth * ratio));
    setElementVisibility(fill, sliderVisible);
  }

  base.bar.setAttribute("x", String(base.barX));
  base.bar.setAttribute("width", String(base.barWidth));
  setElementVisibility(base.bar, sliderVisible);

  const knobTravelHalf = 70;
  const targetCenter = base.knobBaseCenter + (ratio - 0.5) * knobTravelHalf * 2;
  const dx = targetCenter - base.knobBaseCenter;
  const transform = (base.knobBaseTransform ? base.knobBaseTransform + " " : "") + "translate(" + dx + ",0)";
  base.knob.setAttribute("transform", transform);
  setElementVisibility(base.knob, sliderVisible);
}

function sendBrightnessToLua(value, force) {
  const now = Date.now();
  if (!force && now - lastBrightnessLuaSendTime < 90) return;
  lastBrightnessLuaSendTime = now;

  if (typeof window.callVehicleLua === "function") {
    window.callVehicleLua("acmrivianNaviBrightness", { value: normalizeBrightness(value) });
  }
}

function handleBrightnessSliderPosition(clientX, sendToLua, forceSend) {
  const svgDoc = getSvgDoc();
  if (!svgDoc) return;

  const base = getBrightnessSliderBase(svgDoc);
  if (!base || !base.bar || typeof base.bar.getBoundingClientRect !== "function") return;

  const rect = base.bar.getBoundingClientRect();
  if (!rect || rect.width <= 0) return;

  const localX = clampValue(clientX - rect.left, 0, rect.width);
  const ratio = clampValue(localX / rect.width, 0, 1);
  screenBrightness = normalizeBrightness(MIN_SCREEN_BRIGHTNESS + ratio * (1 - MIN_SCREEN_BRIGHTNESS));
  applyBrightnessSlider(svgDoc);

  if (sendToLua) sendBrightnessToLua(screenBrightness, !!forceSend);
}

function getDisplayThemeSelectX(mode) {
  if (mode === "white") return 80;
  if (mode === "black") return 160;
  return 0;
}

function setDisplayThemeText(svgDoc, name, active) {
  if (!svgDoc) return;

  const txt = svgDoc.getElementById("display_theme_" + name + "_txt");
  if (!txt) return;

  setElementFill(txt, active ? "#ffffff" : "#000000");
}

function applyDisplayThemeControls(svgDoc) {
  if (!svgDoc) return;

  displayThemeMode = normalizeDisplayTheme(displayThemeMode);

  const select = svgDoc.getElementById("display_theme_select");
  if (select) {
    select.style.transition = "transform 0.18s ease";
    setElementTranslateX(select, getDisplayThemeSelectX(displayThemeMode));
  }

  setDisplayThemeText(svgDoc, "auto", displayThemeMode === "auto");
  setDisplayThemeText(svgDoc, "white", displayThemeMode === "white");
  setDisplayThemeText(svgDoc, "black", displayThemeMode === "black");
  applyNightMode(svgDoc);
  applySettingsNightInvert(svgDoc);
  applyDisplayAndLightingButton(svgDoc);
  applySystemInfoButton(svgDoc);
  applySupportButton(svgDoc);
}

function sendDisplayThemeToLua(mode, force) {
  const now = Date.now();
  if (!force && now - lastThemeLuaSendTime < 90) return;
  lastThemeLuaSendTime = now;

  if (typeof window.callVehicleLua === "function") {
    window.callVehicleLua("acmrivianNaviDisplayTheme", { value: normalizeDisplayTheme(mode) });
  }
}

function setDisplayThemeMode(mode, sendToLua) {
  displayThemeMode = normalizeDisplayTheme(mode);

  if (displayThemeMode === "black") {
    dashboardNightMode = 1;
    pendingDashboardNightMode = 1;
    pendingDashboardNightModeUntil = Date.now() + 900;
  } else if (displayThemeMode === "white") {
    dashboardNightMode = 0;
    pendingDashboardNightMode = 0;
    pendingDashboardNightModeUntil = Date.now() + 900;
  } else {
    pendingDashboardNightMode = null;
    pendingDashboardNightModeUntil = 0;
  }

  const svgDoc = getSvgDoc();
  applyDisplayThemeControls(svgDoc);

  if (sendToLua) sendDisplayThemeToLua(displayThemeMode, true);
}


function getElementFill(el) {
  if (!el) return "";
  return el.style.fill || el.getAttribute("fill") || "";
}

function cacheOriginalFill(el) {
  if (!el) return;
  if (!el.dataset.originalFill) {
    el.dataset.originalFill = getElementFill(el) || "#d99a22";
  }
}

function setSuspensionIndicatorActive(el, active) {
  if (!el) return;
  cacheOriginalFill(el);
  setElementFill(el, active ? el.dataset.originalFill : "hsl(0, 0%, 25%)");
}

function normalizeSuspensionState(data) {
  if (!data) return;

  if (typeof data.height !== "undefined" && data.height !== null) {
    suspensionState.height = String(data.height).toLowerCase();
  }

  if (typeof data.feel !== "undefined" && data.feel !== null) {
    suspensionState.feel = String(data.feel).toLowerCase();
  }

  if (typeof data.auto !== "undefined" && data.auto !== null) {
    suspensionState.auto = Number(data.auto) ? 1 : 0;
  }
}

function applySuspension(svgDoc) {
  if (!svgDoc) return;

  const height = String(suspensionState.height || "standard").toLowerCase();
  const feel = String(suspensionState.feel || "medium").toLowerCase();
  const autoEnabled = !!Number(suspensionState.auto);

  const heightIsLow = height === "low";
  const heightIsMedium = height === "standard" || height === "medium";
  const heightIsHigh = height === "high";

  setSuspensionIndicatorActive(svgDoc.getElementById("suspension_mode_low"), heightIsLow);
  setSuspensionIndicatorActive(svgDoc.getElementById("suspension_mode_medium"), heightIsMedium);
  setSuspensionIndicatorActive(svgDoc.getElementById("suspension_mode_high"), heightIsHigh);

  setSuspensionIndicatorActive(svgDoc.getElementById("suspension_feel_hard"), feel === "hard");
  setSuspensionIndicatorActive(svgDoc.getElementById("suspension_feel_medium"), feel === "medium");
  setSuspensionIndicatorActive(svgDoc.getElementById("suspension_feel_soft"), feel === "soft");

  const heightText = height === "low" ? "LOW" : (height === "high" ? "HIGH" : "STANDARD");
  const feelText = feel === "hard" ? "HARD" : (feel === "soft" ? "SOFT" : "MEDIUM");

  setSvgText(svgDoc.getElementById("suspension_height_txt"), heightText);
  setSvgText(svgDoc.getElementById("suspension_feel_txt"), feelText);

  const autoTxt = svgDoc.getElementById("suspension_auto_mode_txt");
  const autoBg = svgDoc.getElementById("suspension_auto_mode_bg");
  const dark = isDisplayThemeDark();

  if (dark) {
    setElementFill(autoTxt, autoEnabled ? "#000000" : "#ffffff");
    setElementFill(autoBg, autoEnabled ? "#ffffff" : "#000000");
  } else {
    setElementFill(autoTxt, autoEnabled ? "#ffffff" : "#000000");
    setElementFill(autoBg, autoEnabled ? "#000000" : "#ffffff");
  }
}

function normalizeDseMode(value) {
  if (value === undefined || value === null || value === "") return dseMode || "SPORT";
  const mode = String(value).toUpperCase().replace(/[\s_\-]/g, "");

  if (mode === "CONSERVE") return "CONSERVE";
  if (mode === "OFFROAD") return "OFFROAD";
  if (mode === "ESCOFF" || mode === "OFF") return "OFF";
  return "SPORT";
}

function setDsePair(svgDoc, name, active, visible) {
  if (!svgDoc) return;

  const txt = svgDoc.getElementById("dse_" + name + "_txt");
  const bg = svgDoc.getElementById("dse_" + name + "_bg");
  const dark = isDisplayThemeDark();

  if (txt) {
    setElementVisibility(txt, !!visible);
    txt.style.opacity = visible ? "1" : "0";
    setElementFill(txt, dark ? (active ? "#000000" : "#ffffff") : (active ? "#ffffff" : "#000000"));
  }

  if (bg) {
    setElementVisibility(bg, !!visible && !!active);
    bg.style.opacity = (visible && active) ? "1" : "0";
    setElementFill(bg, dark ? "#ffffff" : "#000000");
  }
}


function applyDseMode(svgDoc) {
  if (!svgDoc) return;

  const mode = normalizeDseMode(dseMode);
  dseMode = mode;
  const visible = !!powertrainMenuVisible && !!powertrainDetailsVisible;

  setDsePair(svgDoc, "conserve", mode === "CONSERVE", visible);
  setDsePair(svgDoc, "sport", mode === "SPORT", visible);
  setDsePair(svgDoc, "offroad", mode === "OFFROAD", visible);
  setDsePair(svgDoc, "off", mode === "OFF", visible);
}



function setupMusicMenuElement(el) {
  if (!el) return;
  el.style.transition = "opacity 0.18s ease";
}

function setMusicMenuVisible(svgDoc, isVisible, animated) {
  if (!svgDoc) return;

  const group = svgDoc.getElementById("music_menu");
  if (!group) return;

  setupMusicMenuElement(group);

  if (musicMenuHideTimer) {
    clearTimeout(musicMenuHideTimer);
    musicMenuHideTimer = null;
  }

  if (isVisible && musicMenuActualVisible) {
    setElementVisibility(group, true);
    group.style.opacity = "1";
    return;
  }

  musicMenuActualVisible = !!isVisible;

  if (isVisible) {
    setElementVisibility(group, true);

    if (animated) {
      group.style.opacity = "0";
      group.getBoundingClientRect();
      requestAnimationFrame(function () {
        group.style.opacity = "1";
      });
    } else {
      group.style.opacity = "1";
    }
  } else {
    group.style.opacity = "0";

    if (animated) {
      const hideGroup = group;
      musicMenuHideTimer = setTimeout(function () {
        if (!musicMenuActualVisible) setElementVisibility(hideGroup, false);
        musicMenuHideTimer = null;
      }, 210);
    } else {
      setElementVisibility(group, false);
    }
  }
}

function applyMusicMenu(svgDoc, animated) {
  setMusicMenuVisible(svgDoc, musicMenuVisible, !!animated);
}

function setDisplayAndLightingMenuVisible(svgDoc, isVisible, animated) {
  if (!svgDoc) return;

  const group = svgDoc.getElementById("display_and_lighting_menu_group");
  displayAndLightingMenuVisible = !!isVisible;

  if (!group) return;

  group.style.transition = "opacity " + (POWERTRAIN_GROUP_FADE_MS / 1000) + "s ease";

  if (isVisible) {
    setElementVisibility(group, true);

    if (animated) {
      group.style.opacity = "0";
      group.getBoundingClientRect();
      requestAnimationFrame(function () {
        group.style.opacity = "1";
      });
    } else {
      group.style.opacity = "1";
    }
  } else {
    group.style.opacity = "0";

    if (animated) {
      const hideGroup = group;
      setTimeout(function () {
        if (!displayAndLightingMenuVisible) setElementVisibility(hideGroup, false);
      }, POWERTRAIN_GROUP_FADE_MS + 30);
    } else {
      setElementVisibility(group, false);
    }
  }
}

function setSystemInfoMenuVisible(svgDoc, isVisible, animated) {
  if (!svgDoc) return;

  const group = svgDoc.getElementById("system_info_menu_group");
  systemInfoMenuVisible = !!isVisible;

  if (!group) return;

  group.style.transition = "opacity " + (POWERTRAIN_GROUP_FADE_MS / 1000) + "s ease";

  if (isVisible) {
    setElementVisibility(group, true);

    if (animated) {
      group.style.opacity = "0";
      group.getBoundingClientRect();
      requestAnimationFrame(function () {
        group.style.opacity = "1";
      });
    } else {
      group.style.opacity = "1";
    }
  } else {
    group.style.opacity = "0";

    if (animated) {
      const hideGroup = group;
      setTimeout(function () {
        if (!systemInfoMenuVisible) setElementVisibility(hideGroup, false);
      }, POWERTRAIN_GROUP_FADE_MS + 30);
    } else {
      setElementVisibility(group, false);
    }
  }
}

function setSupportMenuVisible(svgDoc, isVisible, animated) {
  if (!svgDoc) return;

  const group = svgDoc.getElementById("support_menu_group");
  supportMenuVisible = !!isVisible;

  if (!group) return;

  group.style.transition = "opacity " + (POWERTRAIN_GROUP_FADE_MS / 1000) + "s ease";

  if (isVisible) {
    setElementVisibility(group, true);

    if (animated) {
      group.style.opacity = "0";
      group.getBoundingClientRect();
      requestAnimationFrame(function () {
        group.style.opacity = "1";
      });
    } else {
      group.style.opacity = "1";
    }
  } else {
    group.style.opacity = "0";

    if (animated) {
      const hideGroup = group;
      setTimeout(function () {
        if (!supportMenuVisible) setElementVisibility(hideGroup, false);
      }, POWERTRAIN_GROUP_FADE_MS + 30);
    } else {
      setElementVisibility(group, false);
    }
  }
}

function normalizeSystemInfoUnit(data) {
  if (!data) return systemInfoUnit || "km";

  const raw = String(
    data.distance_unit ||
    data.distanceUnit ||
    data.odometer_unit ||
    data.odometerUnit ||
    data.speed_unit ||
    data.speedUnit ||
    data.units ||
    data.unitSystem ||
    data.uiUnitSystem ||
    data.uiUnitLength ||
    systemInfoUnit ||
    "km"
  ).toLowerCase();

  if (raw.indexOf("mi") >= 0 || raw.indexOf("mile") >= 0 || raw.indexOf("imperial") >= 0 || raw.indexOf("mph") >= 0) return "mi";
  return "km";
}

function applySystemInfo(svgDoc, data) {
  if (!svgDoc) return;

  if (data) {
    const rawOdometer =
      data.acmrivianken_odometer !== undefined ? data.acmrivianken_odometer :
      data.odometer !== undefined ? data.odometer :
      data.odo !== undefined ? data.odo :
      systemInfoOdometerKm;

    const parsed = Number(rawOdometer);
    if (isFinite(parsed)) systemInfoOdometerKm = Math.max(0, parsed);
    systemInfoUnit = normalizeSystemInfoUnit(data);
  }

  const el = svgDoc.getElementById("system_info_menu_odometer_txt");
  if (!el) return;

  const value = systemInfoUnit === "mi" ? systemInfoOdometerKm * 0.621371 : systemInfoOdometerKm;
  setSvgText(el, Math.floor(Math.max(0, value)) + " " + systemInfoUnit);
}

function applySystemInfoButton(svgDoc) {
  if (!svgDoc) return;

  const dark = isDisplayThemeDark();
  const menuOpen = !!settingsMenuVisible;
  const groupOpen = !!settingsMenuGroupVisible;
  const active = menuOpen && groupOpen && settingsSection === "system_info";

  const txt = svgDoc.getElementById("system_info_txt");
  const bg = svgDoc.getElementById("system_info_bg");

  if (txt) {
    setElementVisibility(txt, menuOpen);
    if (dark) {
      setFillSelfAndTspans(txt, "#ffffff");
    } else {
      setFillSelfAndTspans(txt, active ? "#ffffff" : "#000000");
    }
  }

  if (bg) {
    setElementVisibility(bg, active);
    if (dark) {
      setFillSelfAndTspans(bg, "hsl(0, 0%, 7%)");
    } else {
      setElementFill(bg, active ? "#000000" : "#ffffff");
    }
  }
}

function applySupportButton(svgDoc) {
  if (!svgDoc) return;

  const dark = isDisplayThemeDark();
  const menuOpen = !!settingsMenuVisible;
  const groupOpen = !!settingsMenuGroupVisible;
  const active = menuOpen && groupOpen && settingsSection === "support";

  const txt = svgDoc.getElementById("support_txt");
  const bg = svgDoc.getElementById("support_bg");

  if (txt) {
    setElementVisibility(txt, menuOpen);
    if (dark) {
      setFillSelfAndTspans(txt, "#ffffff");
    } else {
      setFillSelfAndTspans(txt, active ? "#ffffff" : "#000000");
    }
  }

  if (bg) {
    setElementVisibility(bg, active);
    if (dark) {
      setFillSelfAndTspans(bg, "hsl(0, 0%, 7%)");
    } else {
      setFillSelfAndTspans(bg, active ? "#000000" : "#ffffff");
    }
  }
}

function setFillSelfAndTspans(el, color) {
  if (!el) return;
  el.style.fill = color;
  el.setAttribute("fill", color);

  const children = el.querySelectorAll ? el.querySelectorAll("*") : [];
  for (let i = 0; i < children.length; i++) {
    children[i].style.fill = color;
    children[i].setAttribute("fill", color);
  }
}

function clearFillSelfAndTspans(el) {
  if (!el) return;
  el.style.fill = "";
  el.removeAttribute("fill");

  const children = el.querySelectorAll ? el.querySelectorAll("*") : [];
  for (let i = 0; i < children.length; i++) {
    children[i].style.fill = "";
    children[i].removeAttribute("fill");
  }
}

function applyDisplayAndLightingButton(svgDoc) {
  if (!svgDoc) return;

  const dark = isDisplayThemeDark();
  const menuOpen = !!settingsMenuVisible;
  const groupOpen = !!settingsMenuGroupVisible;
  const active = menuOpen && groupOpen && settingsSection === "display_and_lighting";

  const txt = svgDoc.getElementById("display_and_lighting_txt");
  const bg = svgDoc.getElementById("display_and_lighting_bg");
  const vehicleTxt = svgDoc.getElementById("vehicle_txt");
  const vehicleBg = svgDoc.getElementById("vehicle_bg");

  if (txt) {
    setElementVisibility(txt, menuOpen);
    if (dark) {
      setFillSelfAndTspans(txt, "#ffffff");
    } else {
      setFillSelfAndTspans(txt, active ? "#ffffff" : "#000000");
    }
  }

  if (bg) {
    setElementVisibility(bg, active);
    if (dark) {
      setFillSelfAndTspans(bg, "hsl(0, 0%, 7%)");
    } else {
      setElementFill(bg, active ? "#000000" : "#ffffff");
    }
  }

  if (vehicleTxt) {
    setElementVisibility(vehicleTxt, menuOpen);
    if (dark) {
      setFillSelfAndTspans(vehicleTxt, "#ffffff");
    } else {
      setFillSelfAndTspans(vehicleTxt, "#ffffff");
    }
  }

  if (vehicleBg) {
    setElementVisibility(vehicleBg, menuOpen);
    if (dark) {
      setFillSelfAndTspans(vehicleBg, "hsl(0, 0%, 7%)");
    } else {
      clearFillSelfAndTspans(vehicleBg);
    }
  }
}




function applySettingsSection(svgDoc, animated) {
  if (!svgDoc) return;

  const showDisplayAndLighting = !!settingsMenuVisible && !!settingsMenuGroupVisible && settingsSection === "display_and_lighting";
  const showSystemInfo = !!settingsMenuVisible && !!settingsMenuGroupVisible && settingsSection === "system_info";
  const showSupport = !!settingsMenuVisible && !!settingsMenuGroupVisible && settingsSection === "support";

  setDisplayAndLightingMenuVisible(svgDoc, showDisplayAndLighting, !!animated);
  setSystemInfoMenuVisible(svgDoc, showSystemInfo, !!animated);
  setSupportMenuVisible(svgDoc, showSupport, !!animated);
  applyDisplayAndLightingButton(svgDoc);
  applySystemInfoButton(svgDoc);
  applySupportButton(svgDoc);
  applySystemInfo(svgDoc, null);
  applyBrightnessSlider(svgDoc);
  applyAmbientBrightnessSlider(svgDoc);
  applyAmbientColorSlider(svgDoc);
}


function setupSettingsMenuElement(el) {
  if (!el) return;
  el.style.transformBox = "fill-box";
  el.style.transformOrigin = "center center";
  el.style.transition = "opacity " + (SETTINGS_MENU_ANIM_MS / 1000) + "s ease";
}

function setSettingsMenuGroupVisible(svgDoc, isVisible, animated) {
  if (!svgDoc) return;

  const group = svgDoc.getElementById("settings_menu_bg_group");
  if (!group) return;

  group.style.transition = "opacity " + (POWERTRAIN_GROUP_FADE_MS / 1000) + "s ease";
  settingsMenuGroupVisible = !!isVisible;

  if (!isVisible) {
    setDisplayAndLightingMenuVisible(svgDoc, false, animated);
    setSystemInfoMenuVisible(svgDoc, false, animated);
    setSupportMenuVisible(svgDoc, false, animated);
  }

  if (isVisible) {
    setElementVisibility(group, true);

    if (animated) {
      group.style.opacity = "0";
      group.getBoundingClientRect();
      requestAnimationFrame(function () {
        group.style.opacity = "1";
        applySettingsSection(svgDoc, false);
      });
    } else {
      group.style.opacity = "1";
      applySettingsSection(svgDoc, false);
    }
  } else {
    group.style.opacity = "0";

    if (animated) {
      const hideGroup = group;
      setTimeout(function () {
        if (!settingsMenuGroupVisible) setElementVisibility(hideGroup, false);
      }, POWERTRAIN_GROUP_FADE_MS + 30);
    } else {
      setElementVisibility(group, false);
    }
  }
}

function setSettingsMenuVisible(svgDoc, isVisible, animated) {
  if (!svgDoc) return;

  const el = svgDoc.getElementById("settings_menu_bg_txt");
  const group = svgDoc.getElementById("settings_menu_bg_group");

  if (!el) {
    if (group) setSettingsMenuGroupVisible(svgDoc, isVisible, animated);
    settingsMenuActualVisible = !!isVisible;
    return;
  }

  setupSettingsMenuElement(el);

  if (settingsMenuHideTimer) {
    clearTimeout(settingsMenuHideTimer);
    settingsMenuHideTimer = null;
  }

  if (settingsMenuGroupTimer) {
    clearTimeout(settingsMenuGroupTimer);
    settingsMenuGroupTimer = null;
  }

  if (isVisible && settingsMenuActualVisible) {
    setElementVisibility(el, true);
    el.style.opacity = "1";
    setSettingsMenuGroupVisible(svgDoc, true, false);
    return;
  }

  settingsMenuActualVisible = !!isVisible;

  if (isVisible) {
    setSettingsMenuGroupVisible(svgDoc, false, false);
    setElementVisibility(el, true);

    if (animated) {
      el.style.opacity = "0";
      el.getBoundingClientRect();
      requestAnimationFrame(function () {
        el.style.opacity = "1";
      });
      settingsMenuGroupTimer = setTimeout(function () {
        setSettingsMenuGroupVisible(svgDoc, true, true);
        settingsMenuGroupTimer = null;
      }, SETTINGS_MENU_ANIM_MS + 120);
    } else {
      el.style.opacity = "1";
      setSettingsMenuGroupVisible(svgDoc, true, false);
    }
  } else {
    setSettingsMenuGroupVisible(svgDoc, false, animated);
    el.style.opacity = "0";

    if (animated) {
      settingsMenuHideTimer = setTimeout(function () {
        if (!settingsMenuActualVisible) setElementVisibility(el, false);
        settingsMenuHideTimer = null;
      }, SETTINGS_MENU_ANIM_MS + 30);
    } else {
      setElementVisibility(el, false);
    }
  }
}

function applySettingsMenu(svgDoc, animated) {
  setSettingsMenuVisible(svgDoc, settingsMenuVisible, !!animated);
}

function setupPowertrainMenuElement(el) {
  if (!el) return;
  el.style.transformBox = "fill-box";
  el.style.transformOrigin = "center center";
  el.style.transition = "transform " + (POWERTRAIN_BG_ANIM_MS / 1000) + "s ease, opacity " + (POWERTRAIN_BG_ANIM_MS / 1000) + "s ease";
}

function setPowertrainDetailsVisible(svgDoc, isVisible, animated) {
  if (!svgDoc) return;

  powertrainDetailsVisible = !!isVisible;

  for (let i = 0; i < POWERTRAIN_DETAIL_IDS.length; i++) {
    const el = svgDoc.getElementById(POWERTRAIN_DETAIL_IDS[i]);
    if (!el) continue;

    el.style.transition = "opacity " + (POWERTRAIN_GROUP_FADE_MS / 1000) + "s ease";

    if (isVisible) {
      setElementVisibility(el, true);

      if (animated) {
        el.style.opacity = "0";
        el.getBoundingClientRect();

        requestAnimationFrame(function () {
          el.style.opacity = "1";
        });
      } else {
        el.style.opacity = "1";
      }
    } else {
      el.style.opacity = "0";

      if (animated) {
        const hideEl = el;
        setTimeout(function () {
          setElementVisibility(hideEl, false);
        }, POWERTRAIN_GROUP_FADE_MS + 30);
      } else {
        setElementVisibility(el, false);
      }
    }
  }
}

function setPowertrainMenuGroupVisible(svgDoc, isVisible, animated) {
  if (!svgDoc) return;

  if (powertrainMenuGroupTimer) {
    clearTimeout(powertrainMenuGroupTimer);
    powertrainMenuGroupTimer = null;
  }

  if (isVisible) applySuspension(svgDoc);
  setPowertrainDetailsVisible(svgDoc, isVisible, animated);
  applyDseMode(svgDoc);
  applyStartScreen(svgDoc);
  applyStartScreen(svgDoc);
}

function setPowertrainMenuVisible(svgDoc, isVisible, animated) {
  if (!svgDoc) return;

  const el = svgDoc.getElementById("powertrain_menu_bg_txt");
  if (!el) return;

  setupPowertrainMenuElement(el);

  if (isVisible && powertrainMenuActualVisible) {
    if (powertrainMenuHideTimer) {
      clearTimeout(powertrainMenuHideTimer);
      powertrainMenuHideTimer = null;
    }
    setElementVisibility(el, true);
    el.style.transform = "scaleX(1)";
    el.style.opacity = "1";
    if (!powertrainDetailsVisible && !powertrainMenuGroupTimer) {
      setPowertrainMenuGroupVisible(svgDoc, true, false);
    } else {
      applySuspension(svgDoc);
      applyDseMode(svgDoc);
    }
    return;
  }

  if (powertrainMenuHideTimer) {
    clearTimeout(powertrainMenuHideTimer);
    powertrainMenuHideTimer = null;
  }

  if (powertrainMenuGroupTimer) {
    clearTimeout(powertrainMenuGroupTimer);
    powertrainMenuGroupTimer = null;
  }

  if (isVisible) {
    powertrainMenuActualVisible = true;
    setPowertrainMenuGroupVisible(svgDoc, false, false);
    setElementVisibility(el, true);

    if (animated) {
      el.style.transform = "scaleX(0)";
      el.style.opacity = "0";
      el.getBoundingClientRect();

      requestAnimationFrame(function () {
        el.style.transform = "scaleX(1)";
        el.style.opacity = "1";
      });

      powertrainMenuGroupTimer = setTimeout(function () {
        setPowertrainMenuGroupVisible(svgDoc, true, true);
      }, POWERTRAIN_GROUP_DELAY_MS);
    } else {
      el.style.transform = "scaleX(1)";
      el.style.opacity = "1";
      setPowertrainMenuGroupVisible(svgDoc, true, false);
    }
  } else {
    powertrainMenuActualVisible = false;
    setPowertrainMenuGroupVisible(svgDoc, false, animated);

    if (animated) {
      const hideBgEl = el;
      powertrainMenuHideTimer = setTimeout(function () {
        if (powertrainMenuActualVisible) return;

        hideBgEl.style.transform = "scaleX(0)";
        hideBgEl.style.opacity = "0";

        powertrainMenuHideTimer = setTimeout(function () {
          if (!powertrainMenuActualVisible) setElementVisibility(hideBgEl, false);
          powertrainMenuHideTimer = null;
        }, POWERTRAIN_BG_ANIM_MS + 30);
      }, 90);
    } else {
      el.style.transform = "scaleX(0)";
      el.style.opacity = "0";
      setElementVisibility(el, false);
    }
  }
}

function applyPowertrainMenu(svgDoc, animated) {
  setPowertrainMenuVisible(svgDoc, powertrainMenuVisible, !!animated);
}

function getModeSelectX(mode) {
  if (mode === "music") return MODE_SELECT_MUSIC_X;
  if (mode === "powertrain") return MODE_SELECT_POWERTRAIN_X;
  if (mode === "rearcamera") return MODE_SELECT_REARCAMERA_X;
  if (mode === "settings") return MODE_SELECT_SETTINGS_X;
  return MODE_SELECT_NAVI_X;
}

function applyModeSelect(svgDoc) {
  if (!svgDoc) return;

  const modeSelect = svgDoc.getElementById("mode_select_txt");
  if (!modeSelect) return;

  modeSelect.style.transition = "transform 0.18s ease";
  setElementTranslateX(modeSelect, getModeSelectX(screenMode));
}

function setScreenMode(mode) {
  screenMode = mode || "navi";
  applyModeSelect(getSvgDoc());
}

function switchScreenMode(mode, animated) {
  const svgDoc = getSvgDoc();
  const nextMode = mode || "navi";
  const wasMode = screenMode;
  const wasMusicVisible = musicMenuVisible;
  const wasPowertrainVisible = powertrainMenuVisible;
  const wasSettingsVisible = settingsMenuVisible;
  const nextMusicVisible = nextMode === "music";
  const nextPowertrainVisible = nextMode === "powertrain";
  const nextSettingsVisible = nextMode === "settings";

  screenMode = nextMode;
  musicMenuVisible = nextMusicVisible;
  powertrainMenuVisible = nextPowertrainVisible;
  settingsMenuVisible = nextSettingsVisible;
  if (!nextSettingsVisible) settingsSection = "";
  forceNaviScreen = nextMode !== "rearcamera";

  if (nextMode !== "rearcamera") {
    autoRearCamActive = false;
  }

  if (nextMode === "rearcamera") {
    rearCam = 1;
  } else {
    rearCam = 0;
  }

  applyModeSelect(svgDoc);

  if (nextMode !== "rearcamera") {
    setCameraLayerVisibility(svgDoc, false);
  }

  if (nextMusicVisible !== wasMusicVisible || nextMode !== wasMode) {
    applyMusicMenu(svgDoc, !!animated);
  } else if (nextMusicVisible) {
    applyMusicMenu(svgDoc, false);
  }

  if (nextPowertrainVisible !== wasPowertrainVisible || nextMode !== wasMode) {
    applyPowertrainMenu(svgDoc, !!animated);
  } else if (nextPowertrainVisible) {
    applyPowertrainMenu(svgDoc, false);
  }

  if (nextSettingsVisible !== wasSettingsVisible || nextMode !== wasMode) {
    applySettingsMenu(svgDoc, !!animated);
  } else if (nextSettingsVisible) {
    applySettingsMenu(svgDoc, false);
  }

  applySettingsSection(svgDoc, false);
  applyRearCam(svgDoc);
}


function setCameraLayerVisibility(svgDoc, isVisible) {
  if (!svgDoc) return;

  const ids = [
    "main_reverse_bg_txt",
    "main_reverse_bg_group",
    "reverse_bg_txt",
    "reverse_bg_group",
    "rearcam_bg_txt",
    "rearcam_bg_group",
    "rearCam_bg_txt",
    "rearCam_bg_group",
    "rear_camera_bg_txt",
    "rear_camera_bg_group"
  ];

  for (let i = 0; i < ids.length; i++) {
    const el = svgDoc.getElementById(ids[i]);
    if (el) setElementVisibility(el, isVisible);
  }
}

function applyRearCam(svgDoc) {
  if (!svgDoc) return;

  const showRearCam = !!rearCam && !forceNaviScreen && screenMode === "rearcamera";

  setCameraLayerVisibility(svgDoc, showRearCam);
  applyModeSelect(svgDoc);
}

function isAmbientUserInputActive() {
  return ambientBrightnessSliderDragging || ambientColorSliderDragging || Date.now() < ambientInteractionLockUntil;
}

function applyData(data) {
  if (!data) return;

  if (typeof data.start_screen_dont_show_again !== "undefined") {
    const savedDontShow = Number(data.start_screen_dont_show_again) || 0;
    startScreenSaveStateLoaded = true;

    if (savedDontShow >= 1) {
      startScreenDisabled = true;
      startScreenVisible = false;
      startScreenDontShow = true;
      startScreenGotItHover = false;
      applyStartScreen(getSvgDoc());
    } else if (!startScreenDisabled && !startScreenClosedThisSession && !startScreenVisible) {
      startScreenVisible = true;
      startScreenShownAt = 0;
      applyStartScreen(getSvgDoc());
    }
  }

  if (typeof data.dashboard_night_mode !== "undefined") {
    const newDashboardNightMode = Number(data.dashboard_night_mode) || 0;
    const now = Date.now();

    if (pendingDashboardNightMode !== null) {
      if (newDashboardNightMode === pendingDashboardNightMode || now > pendingDashboardNightModeUntil) {
        pendingDashboardNightMode = null;
        pendingDashboardNightModeUntil = 0;
      }
    }

    if (displayThemeMode === "auto") {
      dashboardNightMode = newDashboardNightMode;
    } else if (displayThemeMode === "black") {
      dashboardNightMode = 1;
    } else if (displayThemeMode === "white") {
      dashboardNightMode = 0;
    }
  }

  if (typeof data.rearCam !== "undefined") {
    const newRearCam = Number(data.rearCam) || 0;
    const oldRearCam = rearCam;
    rearCam = newRearCam;

    if (newRearCam && !oldRearCam && screenMode !== "rearcamera") {
      modeBeforeAutoRearCam = screenMode || "navi";
      switchScreenMode("rearcamera", true);
      autoRearCamActive = true;
      rearCam = newRearCam;
      forceNaviScreen = false;
    } else if (!newRearCam && oldRearCam && autoRearCamActive) {
      const restoreMode = modeBeforeAutoRearCam || "navi";
      autoRearCamActive = false;
      switchScreenMode(restoreMode, true);
      rearCam = 0;
    }
  }

  if (typeof data.screen_brightness !== "undefined") {
    screenBrightness = normalizeBrightness(data.screen_brightness);
  }

  const ambientInputActive = isAmbientUserInputActive();

  if (typeof data.ambient_brightness !== "undefined" && !ambientBrightnessSliderDragging) {
    ambientBrightness = clampValue(data.ambient_brightness, 0, 1);
  }

  if (!ambientInputActive && typeof data.ambient_color_hue !== "undefined") {
    ambientColorHue = clampValue(data.ambient_color_hue, 0, 1);
    if (typeof data.ambient_color === "undefined") {
      setAmbientColorFromHue(ambientColorHue);
    }
  }

  if (!ambientInputActive && typeof data.ambient_color !== "undefined" && data.ambient_color) {
    ambientColor = {
      r: clampValue(data.ambient_color.r, 0, 1),
      g: clampValue(data.ambient_color.g, 0, 1),
      b: clampValue(data.ambient_color.b, 0, 1)
    };

    ambientColorHue = rgbToHue(ambientColor);
  }

  if (pendingDashboardNightMode === null) {
    if (typeof data.display_theme !== "undefined") {
      displayThemeMode = normalizeDisplayTheme(data.display_theme);
    } else if (typeof data.screen_theme !== "undefined") {
      displayThemeMode = normalizeDisplayTheme(data.screen_theme);
    } else if (typeof data.displayThemeMode !== "undefined") {
      displayThemeMode = normalizeDisplayTheme(data.displayThemeMode);
    }

    if (displayThemeMode === "black") {
      dashboardNightMode = 1;
    } else if (displayThemeMode === "white") {
      dashboardNightMode = 0;
    }
  }

  if (typeof data.modeNameCustom !== "undefined") {
    dseMode = normalizeDseMode(data.modeNameCustom);
  } else if (typeof data.dseMode !== "undefined") {
    dseMode = normalizeDseMode(data.dseMode);
  }

  if (typeof data.suspension !== "undefined") {
    normalizeSuspensionState(data.suspension);
  }

  if (typeof data.suspension_height !== "undefined" || typeof data.suspension_feel !== "undefined" || typeof data.suspension_auto !== "undefined") {
    normalizeSuspensionState({
      height: data.suspension_height,
      feel: data.suspension_feel,
      auto: data.suspension_auto
    });
  }

  if (typeof data.airSuspensionDebug !== "undefined" && data.airSuspensionDebug !== lastLoggedAirDebug) {
    lastLoggedAirDebug = data.airSuspensionDebug;
    debugLog("AIR " + data.airSuspensionDebug);
  }
  if (typeof data.naviHitboxDebug !== "undefined" && data.naviHitboxDebug !== lastLoggedNaviDebug) {
    lastLoggedNaviDebug = data.naviHitboxDebug;
    debugLog("NAVI " + data.naviHitboxDebug);
  }

  applyNightMode(getSvgDoc());
  applySettingsNightInvert(getSvgDoc());
  applyPowertrainNightInvert(getSvgDoc());
  applyMusicMenu(getSvgDoc(), false);
  applyRearCam(getSvgDoc());
  applySettingsMenu(getSvgDoc(), false);
  applySettingsSection(getSvgDoc(), false);
  applyBrightnessSlider(getSvgDoc());
  applyAmbientBrightnessSlider(getSvgDoc());
  applyAmbientColorSlider(getSvgDoc());
  applyDisplayThemeControls(getSvgDoc());
  applySystemInfo(getSvgDoc(), data);
  applySuspension(getSvgDoc());
  applyDseMode(getSvgDoc());
  applyStartScreen(getSvgDoc());
}

function updateClock() {
  const svgDoc = getSvgDoc();
  if (!svgDoc) {
    rafId = requestAnimationFrame(updateClock);
    return;
  }

  const timeTxt = svgDoc.getElementById("time_txt");
  const now = new Date();
  const digital = formatTime(now.getHours()) + ":" + formatTime(now.getMinutes());

  setSvgText(timeTxt, digital);
  applyNightMode(svgDoc);
  applySettingsNightInvert(svgDoc);
  applyPowertrainNightInvert(svgDoc);
  applyMusicMenu(svgDoc, false);
  applyRearCam(svgDoc);
  applySettingsMenu(svgDoc, false);
  applySettingsSection(svgDoc, false);
  applyBrightnessSlider(svgDoc);
  applyAmbientBrightnessSlider(svgDoc);
  applyAmbientColorSlider(svgDoc);
  applyDisplayThemeControls(svgDoc);
  applySystemInfo(svgDoc, null);
  applySuspension(svgDoc);
  applyDseMode(svgDoc);

  rafId = requestAnimationFrame(updateClock);
}

function startClock() {
  if (clockStarted) return;
  clockStarted = true;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(updateClock);
}

function showTouchCircle(x, y) {
  if (!isFinite(x) || !isFinite(y)) return;

  const circle = document.createElement("div");
  const size = 15;

  circle.style.position = "absolute";
  circle.style.left = (x - size / 2) + "px";
  circle.style.top = (y - size / 2) + "px";
  circle.style.width = size + "px";
  circle.style.height = size + "px";
  circle.style.borderRadius = "50%";
  circle.style.background = "white";
  circle.style.border = "1px solid rgba(0,0,0,0.55)";
  circle.style.pointerEvents = "none";
  circle.style.zIndex = "999";
  circle.style.boxSizing = "border-box";
  circle.style.opacity = "0";
  circle.style.transition = "opacity 0.16s ease";

  document.body.appendChild(circle);

  requestAnimationFrame(function () {
    circle.style.opacity = "1";
  });

  setTimeout(function () {
    circle.style.opacity = "0";

    setTimeout(function () {
      if (circle.parentNode) circle.parentNode.removeChild(circle);
    }, 160);
  }, 80);
}

function isHitboxAllowedForCurrentScreen(hitboxId) {
  if (!hitboxId) return false;

  if (startScreenVisible) {
    return hitboxId === "hitbox_got_it" || hitboxId === "hitbox_dont_show_again";
  }

  if (hitboxId === "hitbox_got_it" || hitboxId === "hitbox_dont_show_again") return false;

  if (hitboxId === "hitbox_navi" || hitboxId === "hitbox_music" || hitboxId === "hitbox_powertrain" || hitboxId === "hitbox_rearcamera" || hitboxId === "hitbox_settings") return true;

  if (hitboxId === "hitbox_conserve" || hitboxId === "hitbox_sport" || hitboxId === "hitbox_offroad" || hitboxId === "hitbox_dse_off") {
    return !!powertrainMenuVisible && !!powertrainDetailsVisible;
  }

  if (hitboxId === "hitbox_suspension_down" || hitboxId === "hitbox_suspension_up" || hitboxId === "hitbox_suspension_auto") {
    return !!powertrainMenuVisible && !!powertrainDetailsVisible;
  }

  if (hitboxId === "hitbox_display_and_lighting" || hitboxId === "hitbox_system_info" || hitboxId === "hitbox_support") {
    return !!settingsMenuVisible && !!settingsMenuGroupVisible;
  }

  if (hitboxId === "hitbox_display_theme_auto" || hitboxId === "hitbox_display_theme_white" || hitboxId === "hitbox_display_theme_light" || hitboxId === "hitbox_display_theme_black" || hitboxId === "hitbox_display_theme_dark" || hitboxId === "hitbox_theme_auto" || hitboxId === "hitbox_theme_white" || hitboxId === "hitbox_theme_light" || hitboxId === "hitbox_theme_black" || hitboxId === "hitbox_theme_dark") {
    return !!settingsMenuVisible && !!settingsMenuGroupVisible && settingsSection === "display_and_lighting" && !!displayAndLightingMenuVisible;
  }

  if (hitboxId === "hitbox_brightness_slider" || hitboxId === "hitbox_ambient_color_slider" || hitboxId === "hitbox_ambient_brightness_slider") {
    return !!settingsMenuVisible && !!settingsMenuGroupVisible && settingsSection === "display_and_lighting" && !!displayAndLightingMenuVisible;
  }

  return true;
}

function getSvgHitboxId(x, y) {
  const svgDoc = getSvgDoc();
  if (!svgDoc) return "";

  const all = svgDoc.querySelectorAll('[id^="hitbox_"]');
  let fallbackHitboxId = "";

  for (let i = all.length - 1; i >= 0; i--) {
    const el = all[i];
    if (!el || typeof el.getBoundingClientRect !== "function") continue;

    const rect = el.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      const id = el.id || "";
      if (!fallbackHitboxId) fallbackHitboxId = id;
      if (isHitboxAllowedForCurrentScreen(id)) return id;
    }
  }

  return "";
}

function sendHitboxToLua(hitboxId, extraData) {
  if (!hitboxId) return false;

  const luaHitboxId =
    hitboxId === "hitbox_theme_auto" ? "hitbox_display_theme_auto" :
    hitboxId === "hitbox_theme_white" ? "hitbox_display_theme_white" :
    hitboxId === "hitbox_theme_light" ? "hitbox_display_theme_white" :
    hitboxId === "hitbox_theme_black" ? "hitbox_display_theme_black" :
    hitboxId === "hitbox_theme_dark" ? "hitbox_display_theme_black" :
    hitboxId;

  if (typeof window.callVehicleLua === "function") {
    const payload = extraData || {};
    payload.id = luaHitboxId;
    window.callVehicleLua("acmrivianNaviHitbox", payload);
    console.log("NAVI_SCREEN sent hitbox " + luaHitboxId);
    return true;
  }

  console.log("NAVI_SCREEN callVehicleLua missing for " + luaHitboxId);
  return false;
}

function isDuplicateTouch(x, y) {
  const now = Date.now();
  const duplicate = now - lastTouchTime < 35 && Math.abs(x - lastTouchX) < 2 && Math.abs(y - lastTouchY) < 2;
  lastTouchTime = now;
  lastTouchX = x;
  lastTouchY = y;
  return duplicate;
}

function handleTouchInput(x, y) {
  if (!isFinite(x) || !isFinite(y)) return;
  if (isDuplicateTouch(x, y)) return;

  showTouchCircle(x, y);
  const hitboxId = getSvgHitboxId(x, y);
  debugLog("TOUCH x=" + Math.round(x) + " y=" + Math.round(y) + " hitbox=" + (hitboxId || "none") + " menu=" + powertrainMenuVisible);

  if (startScreenVisible && hitboxId !== "hitbox_got_it" && hitboxId !== "hitbox_dont_show_again") {
    debugLog("BLOCK hitbox because start screen active");
    return;
  }

  if (hitboxId === "hitbox_got_it") {
    if (!isStartScreenGotItReady()) {
      applyStartScreen(getSvgDoc());
      return;
    }

    startScreenVisible = false;
    startScreenClosedThisSession = true;
    if (startScreenDontShow) startScreenDisabled = true;
    startScreenGotItHover = false;
    applyStartScreen(getSvgDoc());
    sendHitboxToLua(hitboxId, { dont_show_again: startScreenDontShow ? 1 : 0 });
    return;
  }

  if (hitboxId === "hitbox_dont_show_again") {
    startScreenDontShow = !startScreenDontShow;
    applyStartScreen(getSvgDoc());
    sendHitboxToLua(hitboxId);
    return;
  }

  if (hitboxId === "hitbox_navi") {
    switchScreenMode("navi", true);
    sendHitboxToLua(hitboxId);
    return;
  }

  if (hitboxId === "hitbox_music") {
    switchScreenMode("music", true);
    sendHitboxToLua(hitboxId);
    return;
  }

  if (hitboxId === "hitbox_powertrain") {
    switchScreenMode("powertrain", true);
    sendHitboxToLua(hitboxId);
    return;
  }

  if (hitboxId === "hitbox_rearcamera") {
    switchScreenMode("rearcamera", true);
    sendHitboxToLua(hitboxId);
    return;
  }

  if (hitboxId === "hitbox_settings") {
    switchScreenMode("settings", true);
    sendHitboxToLua(hitboxId);
    return;
  }

  if (hitboxId === "hitbox_display_and_lighting") {
    if (!settingsMenuVisible) { debugLog("BLOCK settings section hitbox because settings menu hidden"); return; }
    settingsSection = "display_and_lighting";
    applySettingsSection(getSvgDoc(), true);
    sendHitboxToLua(hitboxId);
    return;
  }

  if (hitboxId === "hitbox_system_info") {
    if (!settingsMenuVisible) { debugLog("BLOCK settings section hitbox because settings menu hidden"); return; }
    settingsSection = "system_info";
    applySettingsSection(getSvgDoc(), true);
    sendHitboxToLua(hitboxId);
    return;
  }

  if (hitboxId === "hitbox_support") {
    if (!settingsMenuVisible) { debugLog("BLOCK settings section hitbox because settings menu hidden"); return; }
    settingsSection = "support";
    applySettingsSection(getSvgDoc(), true);
    sendHitboxToLua(hitboxId);
    return;
  }

  if (hitboxId === "hitbox_display_theme_auto" || hitboxId === "hitbox_theme_auto") {
    if (!settingsMenuVisible || settingsSection !== "display_and_lighting") { debugLog("BLOCK theme hitbox because display settings hidden"); return; }
    setDisplayThemeMode("auto", true);
    return;
  }

  if (hitboxId === "hitbox_display_theme_white" || hitboxId === "hitbox_display_theme_light" || hitboxId === "hitbox_theme_white" || hitboxId === "hitbox_theme_light") {
    if (!settingsMenuVisible || settingsSection !== "display_and_lighting") { debugLog("BLOCK theme hitbox because display settings hidden"); return; }
    setDisplayThemeMode("white", true);
    return;
  }

  if (hitboxId === "hitbox_display_theme_black" || hitboxId === "hitbox_display_theme_dark" || hitboxId === "hitbox_theme_black" || hitboxId === "hitbox_theme_dark") {
    if (!settingsMenuVisible || settingsSection !== "display_and_lighting") { debugLog("BLOCK theme hitbox because display settings hidden"); return; }
    setDisplayThemeMode("black", true);
    return;
  }

  if (hitboxId === "hitbox_brightness_slider") {
    if (!settingsMenuVisible || settingsSection !== "display_and_lighting") { debugLog("BLOCK brightness slider because display settings hidden"); return; }
    brightnessSliderDragging = true;
    handleBrightnessSliderPosition(x, true, true);
    return;
  }

  if (hitboxId === "hitbox_ambient_color_slider") {
    if (!settingsMenuVisible || settingsSection !== "display_and_lighting") { debugLog("BLOCK ambient color slider because display settings hidden"); return; }
    ambientColorSliderDragging = true;
    handleAmbientColorSliderPosition(x, true, true);
    return;
  }

  if (hitboxId === "hitbox_ambient_brightness_slider") {
    if (!settingsMenuVisible || settingsSection !== "display_and_lighting") { debugLog("BLOCK ambient brightness slider because display settings hidden"); return; }
    ambientBrightnessSliderDragging = true;
    handleAmbientBrightnessSliderPosition(x, true, true);
    return;
  }

  if (hitboxId === "hitbox_conserve" || hitboxId === "hitbox_sport" || hitboxId === "hitbox_offroad" || hitboxId === "hitbox_dse_off") {
    if (!powertrainMenuVisible) { debugLog("BLOCK DSE hitbox because powertrain menu hidden"); return; }

    if (hitboxId === "hitbox_conserve") dseMode = "CONSERVE";
    if (hitboxId === "hitbox_sport") dseMode = "SPORT";
    if (hitboxId === "hitbox_offroad") dseMode = "OFFROAD";
    if (hitboxId === "hitbox_dse_off") dseMode = "OFF";

    applyDseMode(getSvgDoc());
    sendHitboxToLua(hitboxId);
    return;
  }

  if (hitboxId === "hitbox_suspension_down" || hitboxId === "hitbox_suspension_up" || hitboxId === "hitbox_suspension_auto") {
    if (!powertrainMenuVisible) { debugLog("BLOCK suspension hitbox because powertrain menu hidden"); return; }
    sendHitboxToLua(hitboxId);
    return;
  }

  if (hitboxId) sendHitboxToLua(hitboxId);
}

function installTouchCircle() {
  if (touchCircleInstalled) return;
  touchCircleInstalled = true;

  document.addEventListener("mousedown", function (e) {
    if (e.button !== 0) return;
    handleTouchInput(e.clientX, e.clientY);
  });

  document.addEventListener("mousemove", function (e) {
    updateStartScreenHover(e.clientX, e.clientY);
    if (brightnessSliderDragging) handleBrightnessSliderPosition(e.clientX, true, false);
    if (ambientBrightnessSliderDragging) handleAmbientBrightnessSliderPosition(e.clientX, true, false);
    if (ambientColorSliderDragging) handleAmbientColorSliderPosition(e.clientX, true, false);
  });

  document.addEventListener("mouseup", function (e) {
    if (brightnessSliderDragging) {
      brightnessSliderDragging = false;
      handleBrightnessSliderPosition(e.clientX, true, true);
    }

    if (ambientBrightnessSliderDragging) {
      ambientBrightnessSliderDragging = false;
      handleAmbientBrightnessSliderPosition(e.clientX, true, true);
    }

    if (ambientColorSliderDragging) {
      ambientColorSliderDragging = false;
      handleAmbientColorSliderPosition(e.clientX, true, true);
    }
  });
}

function installHooks() {
  if (!window.map || typeof window.map.updateData !== "function" || window.map._dashboardNightModeInstalled) return;

  const originalUpdateData = window.map.updateData.bind(window.map);

  window.map.updateData = function (data) {
    applyData(data);
    return originalUpdateData(data);
  };

  window.map._dashboardNightModeInstalled = true;
}

function flushEarlyScreenInputQueue() {
  if (!window.__screenInputEarlyQueue || !window.screenInput || typeof window.screenInput.onInput !== "function") return;

  const queue = window.__screenInputEarlyQueue;
  window.__screenInputEarlyQueue = [];

  for (let i = 0; i < queue.length; i++) {
    window.screenInput.onInput(queue[i]);
  }
}

function startScreenInput(config) {
  if (screenInputStarted) return;

  if (!window.initScreenInput) {
    setTimeout(function () {
      startScreenInput(config);
    }, 100);
    return;
  }

  screenInputStarted = true;
  window.initScreenInput(
    config.displayWidth || 1024,
    config.displayHeight || 512,
    config.screenInputId || "acmrivian_navi",
    { enableHover: true }
  );

  installScreenInputTouchHook();
  flushEarlyScreenInputQueue();
}

function installScreenInputTouchHook() {
  if (!window.screenInput || typeof window.screenInput.onInput !== "function" || window.screenInput._touchCircleHooked) return;

  const originalOnInput = window.screenInput.onInput;

  window.screenInput.onInput = function (eventData) {
    if (eventData) {
      const x = eventData.pixelX !== undefined ? eventData.pixelX : eventData.x * 1024;
      const y = eventData.pixelY !== undefined ? eventData.pixelY : eventData.y * 512;

      if (eventData.type === "mousedown" || eventData.type === "click") {
        handleTouchInput(x, y);
      } else if (eventData.type === "mousemove" || eventData.type === "drag" || eventData.type === "move") {
        updateStartScreenHover(x, y);
        if (brightnessSliderDragging) handleBrightnessSliderPosition(x, true, false);
        if (ambientBrightnessSliderDragging) handleAmbientBrightnessSliderPosition(x, true, false);
        if (ambientColorSliderDragging) handleAmbientColorSliderPosition(x, true, false);
      } else if (eventData.type === "mouseup" || eventData.type === "release") {
        if (brightnessSliderDragging) {
          brightnessSliderDragging = false;
          handleBrightnessSliderPosition(x, true, true);
        }
        if (ambientBrightnessSliderDragging) {
          ambientBrightnessSliderDragging = false;
          handleAmbientBrightnessSliderPosition(x, true, true);
        }
        if (ambientColorSliderDragging) {
          ambientColorSliderDragging = false;
          handleAmbientColorSliderPosition(x, true, true);
        }
      }
    }

    return originalOnInput.call(window.screenInput, eventData);
  };

  window.screenInput._touchCircleHooked = true;
}

function waitForSvg() {
  installTouchCircle();

  const obj = document.getElementById("naviSvg");
  if (!obj) return;

  const tryStart = function () {
    const svgDoc = getSvgDoc();
    if (!svgDoc) return false;
    debugLog("JS loaded, svg ok");
    installHooks();
    applyNightMode(svgDoc);
    applyPowertrainNightInvert(svgDoc);
    applyMusicMenu(svgDoc, false);
    applyRearCam(svgDoc);
    applyPowertrainMenu(svgDoc, false);
    applySettingsMenu(svgDoc, false);
    applyBrightnessSlider(svgDoc);
    applyAmbientBrightnessSlider(svgDoc);
    applyAmbientColorSlider(svgDoc);
    applySuspension(svgDoc);
    applyDseMode(svgDoc);
    applyDisplayThemeControls(svgDoc);
    applySystemInfo(svgDoc, null);
    applyStartScreen(svgDoc);
    startClock();
    return true;
  };

  obj.addEventListener("load", tryStart);

  if (tryStart()) return;

  let attempts = 0;
  const poll = setInterval(function () {
    attempts++;
    if (tryStart() || attempts >= 100) clearInterval(poll);
  }, 200);
}

window.setup = function (config) {
  config = config || {};
  startScreenInput(config);
  installTouchCircle();
  installScreenInputTouchHook();
};

window.updateData = function (data) {
  installHooks();
  applyData(data);

  if (window.map && typeof window.map.updateData === "function") {
    window.map.updateData(data);
  }
};

window.updateMode = function () {};

installHooks();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", waitForSvg);
} else {
  waitForSvg();
}
