-- This Source Code Form is subject to the terms of the bCDDL, v. 1.1.
-- If a copy of the bCDDL was not distributed with this
-- file, You can obtain one at http://beamng.com/bCDDL-1.1.txt

local M = {}
M.type = "auxiliary"

local htmlTexture = require("htmlTexture")

local screenMaterialName = nil
local screenInputId = nil
local htmlFilePath = nil
local textureWidth = 0
local textureHeight = 0
local textureFPS = 0
local updateTimer = 0
local invFPS = 1 / 30
local displayData = nil
local hitboxes = nil
local customModuleCache = {}
local screenInputRegistered = false
local luaCallbackRegistered = false
local screenInputProxy = nil
local configureTimer = 0
local configureTimeLeft = 5
local unpackFn = table.unpack or unpack
local debugLast = "init"
local debugCounter = 0
local autoNightModeState = nil
local autoNightModeTimer = 0
local autoNightExpectedValue = nil
local gameTimeOfDayObjectId = nil
local AUTO_NIGHT_UPDATE_INTERVAL = 0.5
local AUTO_NIGHT_ON_MORNING = 0.22
local AUTO_NIGHT_OFF_MORNING = 0.27
local AUTO_NIGHT_OFF_EVENING = 0.73
local AUTO_NIGHT_ON_EVENING = 0.78
local ambientColorR = 0.01
local ambientColorG = 0.82
local ambientColorB = 1.0
local ambientColorHue = 0.52
local ambientPalettePollTimer = 0
local ambientPaletteSyncSuppressTimer = 0
local ambientPaletteSyncRequestId = 0
local ambientLastIgnitionLit = nil
local startScreenDontShowAgainPending = false


local gpsData = {
  x = 0,
  y = 0,
  rotation = 0,
  zoom = 1,
  speed = 0,
  ignitionLevel = 0,
  dashboard_night_mode = 0,
  rearCam = 0,
  screen_brightness = 1,
  ambient_brightness = 1,
  ambient_color_hue = 0.52,
  ambient_color = {r = 0.01, g = 0.82, b = 1.0},
  display_theme = "auto",
  suspension = nil
}

local function setNaviDebug(message)
  debugCounter = debugCounter + 1
  debugLast = tostring(debugCounter) .. " " .. tostring(message)
  electrics.values.naviHitboxDebug = debugLast
  log("I", "ACMRIVIAN_NAVI_DEBUG", debugLast)
end


local function getOdometerController()
  if controller and type(controller.getController) == "function" then
    return controller.getController("odometer_acmrivian")
  end

  return nil
end

local function getStartScreenDontShowAgain()
  local module = getOdometerController()
  if module and type(module.getStartScreenDontShowAgain) == "function" then
    local ok, value = pcall(module.getStartScreenDontShowAgain)
    if ok then return value == true or value == 1 end
  end

  return (tonumber(electrics.values.start_screen_dont_show_again) or 0) >= 1
end

local function setStartScreenDontShowAgain(value)
  local state = value == true or value == 1
  local module = getOdometerController()

  if module and type(module.setStartScreenDontShowAgain) == "function" then
    local ok, err = pcall(module.setStartScreenDontShowAgain, state)
    if not ok then
      log("E", "NAVI_HITBOX", "odometer_acmrivian.setStartScreenDontShowAgain error: " .. tostring(err))
      return false
    end
  else
    log("E", "NAVI_HITBOX", "controller missing/function missing: odometer_acmrivian.setStartScreenDontShowAgain")
    return false
  end

  electrics.values.start_screen_dont_show_again = state and 1 or 0
  if type(electrics.setValue) == "function" then
    pcall(electrics.setValue, "start_screen_dont_show_again", state and 1 or 0)
  end

  return true
end

local function stripAt(value)
  if not value then return nil end
  if value:sub(1, 1) == "@" then
    return value:sub(2)
  end
  return value
end

local function configureScreenService()
  if not screenInputId then return end

  obj:queueGameEngineLua([[
    if screenService and screenService.configureScreen then
      screenService.configureScreen("]] .. screenInputId .. [[", {
        width = ]] .. tostring(textureWidth) .. [[,
        height = ]] .. tostring(textureHeight) .. [[
      })
    end
  ]])
end

local function registerWithScreenInput()
  if screenInputRegistered then return end
  if not screenInput or not screenInput.addScreen then return end
  if not screenMaterialName then return end

  screenInputProxy = {
    callJS = function(_, funcName, data)
      htmlTexture.call(screenMaterialName, funcName, data)
    end
  }

  screenInput.addScreen(screenInputProxy)
  screenInputRegistered = true
end

local function getCustomModule(moduleName)
  if not moduleName then return nil end

  local cached = customModuleCache[moduleName]
  if cached ~= nil then
    return cached
  end

  local module = nil

  if controller and controller.getControllerSafe then
    module = controller.getControllerSafe(moduleName)
  elseif controller and controller.getController then
    module = controller.getController(moduleName)
  end

  if (not module or module == false) and extensions then
    module = extensions[moduleName]
  end

  if module and module ~= false then
    customModuleCache[moduleName] = module
    return module
  end

  return nil
end

local function readCustomModuleProperty(moduleName, property)
  local module = getCustomModule(moduleName)
  if not module then return nil end

  if type(module.getData) == "function" then
    local ok, data = pcall(module.getData)
    if ok and data then
      return data[property]
    end
  end

  if type(module.get) == "function" then
    local ok, value = pcall(module.get, property)
    if ok then
      return value
    end
  end

  if type(module[property]) == "function" then
    local ok, value = pcall(module[property])
    if ok then
      return value
    end
  end

  return module[property]
end

local function updateConfiguredData()
  if not displayData then return end

  if displayData.electrics then
    for _, name in ipairs(displayData.electrics) do
      gpsData[name] = electrics.values[name]
    end
  end

  if displayData.customModules then
    for _, entry in ipairs(displayData.customModules) do
      local moduleName = entry[1]
      local property = entry[2]
      if moduleName and property and moduleName ~= "moduleName" then
        gpsData[property] = readCustomModuleProperty(moduleName, property)
      end
    end
  end

  if displayData.powertrain and powertrain then
    for _, name in ipairs(displayData.powertrain) do
      local device = powertrain.getDevice and powertrain.getDevice(name)
      if device then
        gpsData[name] = device
      end
    end
  end
end

local function updateSuspensionData()
  local module = getCustomModule("air_suspension") or getCustomModule("airSuspension") or getCustomModule("airSuspension_acmrivian")

  if module and type(module.getState) == "function" then
    local ok, data = pcall(module.getState)
    if ok and data then
      gpsData.suspension = data
      return
    end
  end

  local height = electrics.values.suspension_height
  local feel = electrics.values.suspension_feel
  local auto = electrics.values.suspension_auto

  gpsData.suspension = {
    height = height or "standard",
    feel = feel or "medium",
    auto = auto or electrics.values.airSuspensionAuto or 0,
    value = electrics.values.airSuspension or 0,
    target = electrics.values.airSuspensionTarget or electrics.values.airSuspension or 0
  }
end

local function makeArgs(action)
  if type(action.args) == "table" then
    return action.args
  end

  if action.value ~= nil then
    return {action.value}
  end

  return {}
end

local function runAction(action)
  if type(action) ~= "table" then return false end

  local controllerTarget = action.controller
  local functionName = action.func or action["function"]

  if not controllerTarget or not functionName then
    log("E", "NAVI_HITBOX", "bad action config")
    return false
  end

  local targetController = getCustomModule(controllerTarget)
  if not targetController then
    log("E", "NAVI_HITBOX", "controller missing: " .. tostring(controllerTarget))
    return false
  end

  local targetFunc = targetController[functionName]
  if type(targetFunc) ~= "function" then
    log("E", "NAVI_HITBOX", "function missing: " .. tostring(controllerTarget) .. "." .. tostring(functionName))
    return false
  end

  local args = makeArgs(action)
  local ok, err = pcall(targetFunc, unpackFn(args))
  if not ok then
    log("E", "NAVI_HITBOX", "action error: " .. tostring(err))
    return false
  end

  log("I", "NAVI_HITBOX", "action ok: " .. tostring(controllerTarget) .. "." .. tostring(functionName))
  return true
end

local function normalizeDseModeForUi(modeName)
  local key = tostring(modeName or ""):upper():gsub("[%s_%-]", "")
  if key == "CONSERVE" then return "CONSERVE" end
  if key == "SPORT" then return "SPORT" end
  if key == "OFFROAD" then return "OFF-ROAD" end
  if key == "ESCOFF" or key == "OFF" or key == "DSEOFF" then return "ESC OFF" end
  return tostring(modeName or "SPORT")
end

local function getDriveModeCandidates(modeName)
  local key = tostring(modeName or ""):upper():gsub("[%s_%-]", "")
  if key == "CONSERVE" then return {"conserve", "CONSERVE", "Conserve"} end
  if key == "SPORT" then return {"sport", "SPORT", "Sport"} end
  if key == "OFFROAD" then return {"offroad", "offRoad", "off_road", "OFFROAD", "OFF-ROAD", "Off-Road"} end
  if key == "ESCOFF" or key == "OFF" or key == "DSEOFF" then return {"escOff", "esc_off", "escoff", "off", "OFF", "ESC OFF", "ESC_OFF"} end
  return {modeName}
end

local function trySetDriveModesController(modeName)
  local drive = getCustomModule("driveModes")
  if not drive or type(drive.setDriveMode) ~= "function" then
    log("E", "NAVI_HITBOX", "controller missing/function missing: driveModes.setDriveMode")
    return false
  end

  for _, candidate in ipairs(getDriveModeCandidates(modeName)) do
    local canTry = true
    if type(drive.getDriveModeData) == "function" then
      local okData, data = pcall(drive.getDriveModeData, candidate)
      canTry = okData and data ~= nil
    end
    if canTry then
      local ok, err = pcall(drive.setDriveMode, candidate)
      if ok then
        log("I", "NAVI_HITBOX", "driveModes.setDriveMode ok: " .. tostring(candidate))
        return true
      end
      log("E", "NAVI_HITBOX", "driveModes.setDriveMode error for " .. tostring(candidate) .. ": " .. tostring(err))
    end
  end

  log("E", "NAVI_HITBOX", "drive mode key not found for: " .. tostring(modeName))
  return false
end

local function setDseMode(modeName)
  if not modeName then return false end
  local uiMode = normalizeDseModeForUi(modeName)
  electrics.values.modeNameCustom = uiMode
  electrics.values.dseMode = uiMode
  if type(electrics.setValue) == "function" then
    pcall(electrics.setValue, "modeNameCustom", uiMode)
    pcall(electrics.setValue, "dseMode", uiMode)
  end
  local realOk = trySetDriveModesController(uiMode)
  setNaviDebug("DSE mode " .. tostring(uiMode) .. (realOk and " real=driveModes" or " real=FAILED"))
  log("I", "NAVI_HITBOX", "DSE mode set: " .. tostring(uiMode) .. " realOk=" .. tostring(realOk))
  return true
end

local function noop()
  setNaviDebug("noop")
  return true
end

local function onDseHitbox(hitboxId)
  if hitboxId == "hitbox_conserve" then
    return setDseMode("CONSERVE")
  end

  if hitboxId == "hitbox_sport" then
    return setDseMode("SPORT")
  end

  if hitboxId == "hitbox_offroad" then
    return setDseMode("OFF-ROAD")
  end

  if hitboxId == "hitbox_dse_off" then
    return setDseMode("ESC OFF")
  end

  return false
end


local function setRearCamFromNavi(enabled)
  local state = enabled == true or enabled == 1

  electrics.values.rearCam = state and 1 or 0
  if type(electrics.setValue) == "function" then
    pcall(electrics.setValue, "rearCam", state and 1 or 0)
  end

  local rear = getCustomModule("rearCam") or getCustomModule("rearcam") or getCustomModule("rear_camera")
  if rear and type(rear.setRearCam) == "function" then
    local ok, err = pcall(rear.setRearCam, state)
    if ok then
      setNaviDebug("rearCam " .. (state and "ON" or "OFF"))
      log("I", "NAVI_HITBOX", "rearCam.setRearCam " .. tostring(state))
      return true
    end
    log("E", "NAVI_HITBOX", "rearCam.setRearCam error: " .. tostring(err))
  end

  setNaviDebug("rearCam value " .. (state and "ON" or "OFF"))
  return false
end

local function onScreenHitbox(hitboxId)
  if not hitboxId then return false end

  log("I", "NAVI_HITBOX", "hitbox: " .. tostring(hitboxId))
  setNaviDebug("received " .. tostring(hitboxId))

  if hitboxId == "hitbox_navi" or hitboxId == "hitbox_music" or hitboxId == "hitbox_powertrain" or hitboxId == "hitbox_settings" then
    setRearCamFromNavi(false)
  elseif hitboxId == "hitbox_rearcamera" then
    setRearCamFromNavi(true)
  end

  if hitboxId == "hitbox_dont_show_again" then
    startScreenDontShowAgainPending = not startScreenDontShowAgainPending
    electrics.values.start_screen_dont_show_again_pending = startScreenDontShowAgainPending and 1 or 0
    if type(electrics.setValue) == "function" then
      pcall(electrics.setValue, "start_screen_dont_show_again_pending", startScreenDontShowAgainPending and 1 or 0)
    end
    setNaviDebug("start screen dont show pending " .. tostring(startScreenDontShowAgainPending))
    return true
  end

  if hitboxId == "hitbox_got_it" then
    local finalDontShow = startScreenDontShowAgainPending

    if type(data) == "table" and data.dont_show_again ~= nil then
      finalDontShow = (tonumber(data.dont_show_again) or 0) >= 1
      startScreenDontShowAgainPending = finalDontShow
    end

    if finalDontShow then
      if setStartScreenDontShowAgain(true) then
        setNaviDebug("start screen disabled permanently")
      else
        setNaviDebug("start screen save failed")
      end
    else
      setNaviDebug("start screen got it")
    end

    return true
  end

  if hitboxId == "hitbox_settings" then
    setNaviDebug("settings")
    return true
  end

  if hitboxId == "hitbox_display_and_lighting" then
    setNaviDebug("display and lighting")
    return true
  end

  if hitboxId == "hitbox_system_info" then
    setNaviDebug("system info")
    return true
  end

  if hitboxId == "hitbox_support" then
    setNaviDebug("support")
    return true
  end

  if hitboxId == "hitbox_conserve" or hitboxId == "hitbox_sport" or hitboxId == "hitbox_offroad" or hitboxId == "hitbox_dse_off" then
    return onDseHitbox(hitboxId)
  end

  if hitboxId == "hitbox_suspension_down" or hitboxId == "hitbox_suspension_up" or hitboxId == "hitbox_suspension_auto" then
    local air = getCustomModule("airSuspension_acmrivian")
    if not air then
      setNaviDebug("airSuspension_acmrivian NOT FOUND")
      log("E", "NAVI_HITBOX", "controller missing: airSuspension_acmrivian")
      return false
    end

    local funcName = nil
    if hitboxId == "hitbox_suspension_down" then
      funcName = "suspensionDown"
    elseif hitboxId == "hitbox_suspension_up" then
      funcName = "suspensionUp"
    elseif hitboxId == "hitbox_suspension_auto" then
      funcName = "suspensionAuto"
    end

    if not funcName or type(air[funcName]) ~= "function" then
      setNaviDebug("function missing: airSuspension_acmrivian." .. tostring(funcName))
      log("E", "NAVI_HITBOX", "function missing: airSuspension_acmrivian." .. tostring(funcName))
      return false
    end

    local ok, err = pcall(air[funcName], true)
    if not ok then
      setNaviDebug("call error: " .. tostring(err))
      log("E", "NAVI_HITBOX", "call error: " .. tostring(err))
      return false
    end

    setNaviDebug("called airSuspension_acmrivian." .. funcName)
    log("I", "NAVI_HITBOX", "direct action ok: airSuspension_acmrivian." .. funcName)
    return true
  end

  if not hitboxes then
    log("E", "NAVI_HITBOX", "hitboxes config missing")
    return false
  end

  local action = hitboxes[hitboxId]
  if not action then
    log("E", "NAVI_HITBOX", "hitbox action missing: " .. tostring(hitboxId))
    return false
  end

  if type(action[1]) == "table" then
    local result = false
    for _, entry in ipairs(action) do
      if runAction(entry) then
        result = true
      end
    end
    return result
  end

  return runAction(action)
end


local function clampBrightness(value)
  value = tonumber(value) or 1
  if value < 0.15 then return 0.15 end
  if value > 1 then return 1 end
  return value
end

local function setScreenBrightness(value)
  local brightness = clampBrightness(value)
  electrics.values.screen_brightness = brightness
  if type(electrics.setValue) == "function" then
    pcall(electrics.setValue, "screen_brightness", brightness)
  end
  setNaviDebug("brightness " .. tostring(math.floor(brightness * 100 + 0.5)) .. "%")
  return true
end

local function onVehicleBrightnessCallback(args)
  if type(args) == "table" then
    return setScreenBrightness(args.value or args[1])
  end
  return setScreenBrightness(args)
end

local function clampAmbientBrightness(value)
  value = tonumber(value) or 1
  if value < 0 then return 0 end
  if value > 1 then return 1 end
  return value
end

local function clamp01(value, fallback)
  value = tonumber(value)
  if value == nil then value = fallback or 0 end
  if value < 0 then return 0 end
  if value > 1 then return 1 end
  return value
end

local function isAmbientIgnitionOn()
  return (tonumber(electrics.values.ignitionLevel or gpsData.ignitionLevel or 0) or 0) > 0
end

local function applyAmbientPalette()
  local brightness = clampAmbientBrightness(electrics.values.ambient_brightness or gpsData.ambient_brightness or 1)
  local ignitionOn = isAmbientIgnitionOn()
  local vehicleId = nil

  if obj and type(obj.getID) == "function" then
    local ok, id = pcall(function() return obj:getID() end)
    if ok and id ~= nil then vehicleId = tonumber(id) end
  end

  local colorString
  if ignitionOn then
    colorString = string.format("%.6f %.6f %.6f 1.200000", ambientColorR * brightness, ambientColorG * brightness, ambientColorB * brightness)
    setNaviDebug(string.format("ambient color %.0f%% brightness %.0f%%", ambientColorHue * 100, brightness * 100))
  else
    colorString = "0.000000 0.000000 0.000000 1.200000"
    setNaviDebug("ambient OFF ignitionLevel 0")
  end

  if not obj or type(obj.queueGameEngineLua) ~= "function" then
    setNaviDebug("ambient palette FAIL: queueGameEngineLua missing")
    return
  end

  local script
  if vehicleId then
    script = string.format([[
      local veh = be:getObjectByID(%d)
      if not veh then veh = be:getPlayerVehicle(0) end
      if not veh then
        log("E", "ACMRIVIAN_AMBIENT", "vehicle nil")
      elseif not veh.setField then
        log("E", "ACMRIVIAN_AMBIENT", "setField missing")
      else
        local ok, err = pcall(function()
          veh:setField("colorPalette1", "", %q)
        end)
        log(ok and "I" or "E", "ACMRIVIAN_AMBIENT", "set colorPalette1=" .. %q .. " ok=" .. tostring(ok) .. " err=" .. tostring(err))
      end
    ]], vehicleId, colorString, colorString)
  else
    script = string.format([[
      local veh = be:getPlayerVehicle(0)
      if not veh then
        log("E", "ACMRIVIAN_AMBIENT", "vehicle nil fallback")
      elseif not veh.setField then
        log("E", "ACMRIVIAN_AMBIENT", "setField missing fallback")
      else
        local ok, err = pcall(function()
          veh:setField("colorPalette1", "", %q)
        end)
        log(ok and "I" or "E", "ACMRIVIAN_AMBIENT", "set colorPalette1=" .. %q .. " ok=" .. tostring(ok) .. " err=" .. tostring(err))
      end
    ]], colorString, colorString)
  end

  obj:queueGameEngineLua(script)
end

local function syncAmbientColorFromPaletteValues()
  local seq = tonumber(electrics.values.ambient_palette1_seq)
  if seq ~= ambientPaletteSyncRequestId then return end

  local r = tonumber(electrics.values.ambient_palette1_r)
  local g = tonumber(electrics.values.ambient_palette1_g)
  local b = tonumber(electrics.values.ambient_palette1_b)
  if not r or not g or not b then return end

  local brightness = clampAmbientBrightness(electrics.values.ambient_brightness or gpsData.ambient_brightness or 1)
  if brightness < 0.001 then brightness = 1 end

  ambientColorR = clamp01(r / brightness, ambientColorR)
  ambientColorG = clamp01(g / brightness, ambientColorG)
  ambientColorB = clamp01(b / brightness, ambientColorB)

  electrics.values.ambient_color_r = ambientColorR
  electrics.values.ambient_color_g = ambientColorG
  electrics.values.ambient_color_b = ambientColorB
  gpsData.ambient_color = {r = ambientColorR, g = ambientColorG, b = ambientColorB}
end

local function requestAmbientPaletteSync()
  if not obj or type(obj.queueGameEngineLua) ~= "function" then return end
  if not isAmbientIgnitionOn() then return end

  local vehicleId = nil
  if obj and type(obj.getID) == "function" then
    local ok, id = pcall(function() return obj:getID() end)
    if ok and id ~= nil then vehicleId = tonumber(id) end
  end
  if not vehicleId then return end

  ambientPaletteSyncRequestId = ambientPaletteSyncRequestId + 1
  local syncRequestId = ambientPaletteSyncRequestId

  obj:queueGameEngineLua(string.format([[
    local veh = be:getObjectByID(%d)
    if veh and veh.getField then
      local raw = veh:getField("colorPalette1", "") or ""
      local r, g, b, w = raw:match("([^%%s]+)%%s+([^%%s]+)%%s+([^%%s]+)%%s+([^%%s]+)")
      if r and g and b then
        veh:queueLuaCommand(string.format("electrics.values.ambient_palette1_r=%%s electrics.values.ambient_palette1_g=%%s electrics.values.ambient_palette1_b=%%s electrics.values.ambient_palette1_w=%%s electrics.values.ambient_palette1_seq=%d", r, g, b, w or "1"))
      end
    end
  ]], vehicleId, syncRequestId))
end

local function setAmbientBrightness(value)
  local brightness = clampAmbientBrightness(value)
  ambientPaletteSyncSuppressTimer = 2.0
  ambientPaletteSyncRequestId = ambientPaletteSyncRequestId + 1
  electrics.values.ambient_palette1_seq = -1
  electrics.values.ambient_brightness = brightness
  if type(electrics.setValue) == "function" then
    pcall(electrics.setValue, "ambient_brightness", brightness)
  end
  applyAmbientPalette()
  setNaviDebug("ambient brightness " .. tostring(math.floor(brightness * 100 + 0.5)) .. "%")
  return true
end

local function onVehicleAmbientBrightnessCallback(args)
  if type(args) == "table" then
    return setAmbientBrightness(args.value or args[1])
  end
  return setAmbientBrightness(args)
end

local function setAmbientColor(data)
  if type(data) ~= "table" then return false end

  ambientPaletteSyncSuppressTimer = 2.0
  ambientPaletteSyncRequestId = ambientPaletteSyncRequestId + 1
  electrics.values.ambient_palette1_seq = -1
  ambientColorR = clamp01(data.r, ambientColorR)
  ambientColorG = clamp01(data.g, ambientColorG)
  ambientColorB = clamp01(data.b, ambientColorB)
  ambientColorHue = clamp01(data.hue, ambientColorHue)

  electrics.values.ambient_color_hue = ambientColorHue
  electrics.values.ambient_color_r = ambientColorR
  electrics.values.ambient_color_g = ambientColorG
  electrics.values.ambient_color_b = ambientColorB

  gpsData.ambient_color_hue = ambientColorHue
  gpsData.ambient_color = {r = ambientColorR, g = ambientColorG, b = ambientColorB}

  applyAmbientPalette()
  return true
end

local function onVehicleAmbientColorCallback(args)
  return setAmbientColor(args)
end

local function setDashboardNightMode(value, source)
  local val = tonumber(value) or 0
  val = val >= 1 and 1 or 0
  electrics.values.dashboard_night_mode = val
  if source == "auto" then
    autoNightExpectedValue = val
  end
  if type(electrics.setValue) == "function" then
    pcall(electrics.setValue, "dashboard_night_mode", val)
  end
  return val
end

local function getVehicleObjectId()
  if gameTimeOfDayObjectId ~= nil then return gameTimeOfDayObjectId end

  local ok, id = pcall(function()
    if obj and type(obj.getID) == "function" then return obj:getID() end
    if obj and type(obj.getId) == "function" then return obj:getId() end
    return nil
  end)

  if ok and id ~= nil then
    gameTimeOfDayObjectId = tonumber(id)
    return gameTimeOfDayObjectId
  end

  return nil
end

local function requestGameTimeOfDay()
  local objectId = getVehicleObjectId()
  if not objectId then return end

  obj:queueGameEngineLua([[
    local ok, data = pcall(function()
      if core_environment and core_environment.getTimeOfDay then
        return core_environment.getTimeOfDay()
      end
      return nil
    end)

    if ok and data and data.time then
      local veh = be:getObjectByID(]] .. tostring(objectId) .. [[)
      if veh then
        veh:queueLuaCommand("electrics.values.acmrivian_game_tod = " .. tostring(data.time))
      end
    end
  ]])
end

local function getGameTimeOfDay()
  local t = tonumber(electrics.values.acmrivian_game_tod)
  if not t then return nil end
  if t < 0 then t = 0 end
  if t > 1 then t = t % 1 end
  return t
end

local function calculateAutoNightMode(t)
  return (t >= 0.25 and t <= 0.75)
end

local function detectManualDashboardNightModeBind()
  local theme = tostring(electrics.values.display_theme or "auto"):lower():gsub("[%s_%-]", "")
  local currentVal = tonumber(electrics.values.dashboard_night_mode) or 0
  currentVal = currentVal >= 1 and 1 or 0

  if theme == "black" and currentVal == 0 then
    electrics.values.display_theme = "white"
    if type(electrics.setValue) == "function" then
      pcall(electrics.setValue, "display_theme", "white")
    end
    autoNightModeState = nil
    autoNightModeTimer = 0
    autoNightExpectedValue = nil
    setNaviDebug("manual dashboard_night_mode bind detected display_theme white")
    return true
  end

  if theme == "white" and currentVal == 1 then
    electrics.values.display_theme = "black"
    if type(electrics.setValue) == "function" then
      pcall(electrics.setValue, "display_theme", "black")
    end
    autoNightModeState = nil
    autoNightModeTimer = 0
    autoNightExpectedValue = nil
    setNaviDebug("manual dashboard_night_mode bind detected display_theme black")
    return true
  end

  return false
end

local function updateAutoNightMode(dt, force)
  if detectManualDashboardNightModeBind() then return end

  local theme = tostring(electrics.values.display_theme or "auto"):lower():gsub("[%s_%-]", "")
  if theme ~= "auto" then
    autoNightModeState = nil
    autoNightModeTimer = 0
    return
  end

  autoNightModeTimer = autoNightModeTimer + (tonumber(dt) or 0)
  if not force and autoNightModeTimer < AUTO_NIGHT_UPDATE_INTERVAL then return end
  autoNightModeTimer = 0

  requestGameTimeOfDay()

  local tod = getGameTimeOfDay()
  if tod == nil then
    setNaviDebug("auto theme waiting game tod")
    return
  end

  local night = calculateAutoNightMode(tod)
  autoNightModeState = night

  local val = night and 1 or 0
  local currentVal = tonumber(electrics.values.dashboard_night_mode) or 0

  if not force and autoNightExpectedValue ~= nil and currentVal ~= autoNightExpectedValue then
    local manualTheme = currentVal >= 1 and "black" or "white"
    electrics.values.display_theme = manualTheme
    if type(electrics.setValue) == "function" then
      pcall(electrics.setValue, "display_theme", manualTheme)
    end
    autoNightModeState = nil
    autoNightModeTimer = 0
    autoNightExpectedValue = nil
    setNaviDebug("manual dashboard_night_mode bind detected display_theme " .. tostring(manualTheme))
    return
  end

  if currentVal ~= val then
    setDashboardNightMode(val, "auto")
    setNaviDebug("auto theme tod " .. tostring(tod) .. " dashboard_night_mode " .. tostring(val))
  else
    autoNightExpectedValue = val
  end
end

local function normalizeDisplayTheme(value)
  local theme = tostring(value or "auto"):lower():gsub("[%s_%-]", "")
  if theme == "white" or theme == "light" then return "white" end
  if theme == "black" or theme == "dark" then return "black" end
  return "auto"
end

local function setDisplayTheme(value)
  local theme = normalizeDisplayTheme(value)
  electrics.values.display_theme = theme

  if theme == "black" then
    autoNightModeState = nil
    autoNightModeTimer = 0
    autoNightExpectedValue = nil
    setDashboardNightMode(1, "manual")
  elseif theme == "white" then
    autoNightModeState = nil
    autoNightModeTimer = 0
    autoNightExpectedValue = nil
    setDashboardNightMode(0, "manual")
  elseif theme == "auto" then
    autoNightExpectedValue = nil
    updateAutoNightMode(0, true)
  end

  if type(electrics.setValue) == "function" then
    pcall(electrics.setValue, "display_theme", theme)
  end

  setNaviDebug("display theme " .. tostring(theme) .. " dashboard_night_mode " .. tostring(electrics.values.dashboard_night_mode or 0))
  return true
end

local function onVehicleDisplayThemeCallback(args)
  if type(args) == "table" then
    return setDisplayTheme(args.value or args[1])
  end
  return setDisplayTheme(args)
end

local function onVehicleHitboxCallback(args)
  if type(args) == "table" then
    return onScreenHitbox(args.id or args.hitboxId or args[1])
  end

  return onScreenHitbox(args)
end

local function registerLuaCallback()
  if luaCallbackRegistered then return end
  if not screenInput then return end
  if type(screenInput.registerLuaCallback) ~= "function" then return end

  screenInput.registerLuaCallback("acmrivianNaviHitbox", onVehicleHitboxCallback)
  screenInput.registerLuaCallback("acmrivianNaviBrightness", onVehicleBrightnessCallback)
  screenInput.registerLuaCallback("acmrivianNaviAmbientBrightness", onVehicleAmbientBrightnessCallback)
  screenInput.registerLuaCallback("acmrivianNaviAmbientColor", onVehicleAmbientColorCallback)
  screenInput.registerLuaCallback("acmrivianNaviDisplayTheme", onVehicleDisplayThemeCallback)
  luaCallbackRegistered = true
  log("I", "NAVI_HITBOX", "registered callback: acmrivianNaviHitbox")
end

local function getUserDistanceUnit()
  local candidates = {"uiUnitLength", "uiUnitSystem", "unitSystem", "units"}

  if settings and type(settings.getValue) == "function" then
    for _, name in ipairs(candidates) do
      local ok, value = pcall(settings.getValue, name)
      if ok and value ~= nil then
        local text = tostring(value):lower()
        if text:find("mi") or text:find("mile") or text:find("imperial") or text:find("mph") then
          return "mi"
        end
        if text:find("km") or text:find("metric") then
          return "km"
        end
      end
    end
  end

  return "km"
end

local function getOdometerKm()
  local value = tonumber(electrics.values.acmrivianken_odometer)
  if value ~= nil then return value end

  local module = getOdometerController()
  if module and type(module.getValue) == "function" then
    local ok, moduleValue = pcall(module.getValue)
    if ok and tonumber(moduleValue) ~= nil then
      return tonumber(moduleValue)
    end
  end

  return tonumber(gpsData.acmrivianken_odometer) or 0
end

local function updateGFX(dt)
  registerWithScreenInput()
  registerLuaCallback()

  if configureTimeLeft > 0 then
    configureTimer = configureTimer + dt
    if configureTimer >= 0.25 then
      configureTimer = 0
      configureTimeLeft = configureTimeLeft - 0.25
      configureScreenService()
    end
  end

  updateTimer = updateTimer + dt
  if updateTimer <= invFPS then return end
  updateTimer = 0

  local ambientIgnitionLit = isAmbientIgnitionOn()
  if ambientLastIgnitionLit == nil then
    ambientLastIgnitionLit = ambientIgnitionLit
    ambientPaletteSyncSuppressTimer = 1.0
    ambientPaletteSyncRequestId = ambientPaletteSyncRequestId + 1
    electrics.values.ambient_palette1_seq = -1
    applyAmbientPalette()
  elseif ambientLastIgnitionLit ~= ambientIgnitionLit then
    ambientLastIgnitionLit = ambientIgnitionLit
    ambientPaletteSyncSuppressTimer = 1.0
    ambientPaletteSyncRequestId = ambientPaletteSyncRequestId + 1
    electrics.values.ambient_palette1_seq = -1
    applyAmbientPalette()
  end

  if not playerInfo.anyPlayerSeated then return end

  updateAutoNightMode(dt, false)

  if ambientPaletteSyncSuppressTimer > 0 then
    ambientPaletteSyncSuppressTimer = math.max(0, ambientPaletteSyncSuppressTimer - dt)
    ambientPalettePollTimer = 0
  else
    ambientPalettePollTimer = ambientPalettePollTimer + dt
    if ambientPalettePollTimer >= 0.5 then
      ambientPalettePollTimer = 0
      requestAmbientPaletteSync()
    end
    syncAmbientColorFromPaletteValues()
  end

  local pos = obj:getPosition()
  local rotation = math.deg(obj:getDirection()) + 180
  local speed = (electrics.values.airspeed or 0) * 3.6
  local zoom = math.min(150 + speed * 1.5, 250)

  gpsData.x = pos.x
  gpsData.y = pos.y
  gpsData.rotation = rotation
  gpsData.speed = speed
  gpsData.zoom = zoom
  gpsData.ignitionLevel = electrics.values.ignitionLevel or 0
  gpsData.dashboard_night_mode = electrics.values.dashboard_night_mode or 0
  gpsData.rearCam = electrics.values.rearCam or 0
  gpsData.modeNameCustom = electrics.values.modeNameCustom or "SPORT"
  gpsData.screen_brightness = electrics.values.screen_brightness or 1
  gpsData.ambient_brightness = electrics.values.ambient_brightness or 1
  gpsData.ambient_color_hue = electrics.values.ambient_color_hue or ambientColorHue
  gpsData.ambient_color = {r = ambientColorR, g = ambientColorG, b = ambientColorB}
  gpsData.display_theme = electrics.values.display_theme or "auto"
  gpsData.acmrivianken_odometer = getOdometerKm()
  gpsData.odometer = gpsData.acmrivianken_odometer
  gpsData.odometer_unit = getUserDistanceUnit()
  gpsData.distance_unit = gpsData.odometer_unit
  gpsData.start_screen_dont_show_again = getStartScreenDontShowAgain() and 1 or 0
  gpsData.naviHitboxDebug = electrics.values.naviHitboxDebug or debugLast
  gpsData.airSuspensionDebug = electrics.values.airSuspensionDebug or "no air debug"

  updateSuspensionData()
  updateConfiguredData()
  updateSuspensionData()

  htmlTexture.call(screenMaterialName, "map.updateData", gpsData)
  htmlTexture.call(screenMaterialName, "updateData", gpsData)
end

local function init(jbeamData)
  screenMaterialName = jbeamData.screenMaterialName or "@screen_gps"
  screenInputId = jbeamData.screenInputId or jbeamData.name or stripAt(screenMaterialName)
  htmlFilePath = jbeamData.htmlFilePath or "local://local/vehicles/common/navi_screen.html"
  textureWidth = jbeamData.textureWidth or 256
  textureHeight = jbeamData.textureHeight or 128
  textureFPS = jbeamData.textureFPS or 30
  displayData = jbeamData.displayData
  hitboxes = jbeamData.hitboxes
  invFPS = 1 / textureFPS
  updateTimer = 0
  configureTimer = 0
  configureTimeLeft = 5
  screenInputRegistered = false
  customModuleCache = {}

  luaCallbackRegistered = false
  registerLuaCallback()

  setNaviDebug("navigator init material=" .. tostring(screenMaterialName) .. " input=" .. tostring(screenInputId))

  htmlTexture.create(screenMaterialName, htmlFilePath, textureWidth, textureHeight, textureFPS, "automatic")
  htmlTexture.call(screenMaterialName, "setup", {
    displayWidth = textureWidth,
    displayHeight = textureHeight,
    screenInputId = screenInputId
  })

  configureScreenService()
  registerWithScreenInput()

  obj:queueGameEngineLua(string.format("extensions.ui_uinavi.requestVehicleDashboardMap(%q, nil, %d)", screenMaterialName, obj:getID()))

  if jbeamData.bootscreenImage then
    htmlTexture.call(screenMaterialName, "map.setBootscreenImage", {url = jbeamData.bootscreenImage})
  end
end

M.init = init
M.reset = nop
M.updateGFX = updateGFX
M.onScreenHitbox = onScreenHitbox
M.setDseMode = setDseMode
M.noop = noop
M.setScreenBrightness = setScreenBrightness
M.setAmbientBrightness = setAmbientBrightness
M.setAmbientColor = setAmbientColor
M.setDisplayTheme = setDisplayTheme

return M
