local M = {}
M.type = "auxiliary"

local MIN_RIDE_HEIGHT = -0.3
local DEFAULT_RIDE_HEIGHT = 0
local MAX_RIDE_HEIGHT = 0.4

local CONSERVE_LOWER_START = 100 / 3.6
local CONSERVE_LOWER_END = 180 / 3.6
local SPORT_LOWER_START = 50 / 3.6
local SPORT_LOWER_END = 100 / 3.6
local OFFROAD_RIDE_HEIGHT = 0.2

local currentRideHeight = DEFAULT_RIDE_HEIGHT
local selectedRideHeight = DEFAULT_RIDE_HEIGHT
local targetRideHeight = DEFAULT_RIDE_HEIGHT
local lastMode = nil
local smoothTau = 0.65
local autoMode = true
local lastPresetInput = "standard"
local currentHeightName = "standard"
local currentFeelName = "medium"
local debugLast = "init"
local debugCounter = 0

local function setDebug(message)
  debugCounter = debugCounter + 1
  debugLast = tostring(debugCounter) .. " " .. tostring(message)
  electrics.values.airSuspensionDebug = debugLast
  log("I", "ACMRIVIAN_AIRSUSP_DEBUG", debugLast)
end

local function clamp(x, a, b)
  return (x < a) and a or ((x > b) and b or x)
end

local function smoothstep(x)
  x = clamp(x, 0, 1)
  return x * x * (3 - 2 * x)
end

local function normalizeMode(mode)
  if not mode then return "SPORT" end
  mode = tostring(mode):upper()
  mode = mode:gsub("_", "")
  mode = mode:gsub("%-", "")
  mode = mode:gsub(" ", "")
  return mode
end

local function getSpeed()
  return math.abs(electrics.values.wheelspeed or electrics.values.airspeed or 0)
end

local function readPresetInput()
  if electrics.values.min_rideHeight == 1 then
    return "low", MIN_RIDE_HEIGHT
  elseif electrics.values.max_rideHeight == 1 then
    return "high", MAX_RIDE_HEIGHT
  elseif electrics.values.default_rideHeight == 1 then
    return "standard", DEFAULT_RIDE_HEIGHT
  end

  return nil, selectedRideHeight
end

local function getLoweringTarget(baseHeight, speed, startSpeed, endSpeed)
  if speed <= startSpeed then
    return baseHeight
  end

  if speed >= endSpeed then
    return MIN_RIDE_HEIGHT
  end

  local t = smoothstep((speed - startSpeed) / math.max(endSpeed - startSpeed, 0.001))
  return baseHeight + (MIN_RIDE_HEIGHT - baseHeight) * t
end

local function getHeightName(height)
  if height <= -0.2 then
    return "low"
  elseif height >= 0.15 then
    return "high"
  end

  return "standard"
end

local function getFeelName(height)
  if height <= -0.2 then
    return "hard"
  elseif height >= 0.15 then
    return "soft"
  end

  return "medium"
end

local function writeElectrics()
  currentHeightName = getHeightName(targetRideHeight)
  currentFeelName = getFeelName(targetRideHeight)
  electrics.values.airSuspension = currentRideHeight
  electrics.values.airSuspensionTarget = targetRideHeight
  electrics.values.airSuspensionAuto = autoMode and 1 or 0
  electrics.values.suspension_auto = autoMode and 1 or 0
  electrics.values.suspension_height = currentHeightName
  electrics.values.suspension_feel = currentFeelName
  electrics.values.airSuspensionDebug = debugLast
end

local function getHeightIndexByName(name)
  if name == "low" then return 1 end
  if name == "high" then return 3 end
  return 2
end

local function getHeightByIndex(index)
  if index <= 1 then return "low", MIN_RIDE_HEIGHT end
  if index >= 3 then return "high", MAX_RIDE_HEIGHT end
  return "standard", DEFAULT_RIDE_HEIGHT
end

local function getActiveHeightIndex()
  if autoMode then
    return getHeightIndexByName(getHeightName(targetRideHeight))
  end

  return getHeightIndexByName(getHeightName(selectedRideHeight))
end

local function setManualHeightIndex(index)
  setDebug("setManualHeightIndex raw=" .. tostring(index))
  local presetName, height = getHeightByIndex(index)
  selectedRideHeight = clamp(height, MIN_RIDE_HEIGHT, MAX_RIDE_HEIGHT)
  targetRideHeight = selectedRideHeight
  lastPresetInput = presetName
  autoMode = false
  writeElectrics()
end

local function suspensionUp(value)
  setDebug("suspensionUp value=" .. tostring(value))
  if value == false then return end
  setManualHeightIndex(getActiveHeightIndex() + 1)
end

local function suspensionDown(value)
  setDebug("suspensionDown value=" .. tostring(value))
  if value == false then return end
  setManualHeightIndex(getActiveHeightIndex() - 1)
end

local function suspensionPresetUp(value)
  setDebug("suspensionPresetUp value=" .. tostring(value))
  if value == false then return end
  setManualHeightIndex(getActiveHeightIndex() + 1)
end

local function suspensionPresetDown(value)
  setDebug("suspensionPresetDown value=" .. tostring(value))
  if value == false then return end
  setManualHeightIndex(getActiveHeightIndex() - 1)
end

local function suspensionAuto(value)
  setDebug("suspensionAuto value=" .. tostring(value))
  if value == false then return end
  autoMode = true
  writeElectrics()
end

local function setAutoMode(state)
  setDebug("setAutoMode state=" .. tostring(state))
  autoMode = state and true or false
  writeElectrics()
end

local function setRideHeight(value)
  setDebug("setRideHeight value=" .. tostring(value))
  local height = tonumber(value)
  if not height then return end
  selectedRideHeight = clamp(height, MIN_RIDE_HEIGHT, MAX_RIDE_HEIGHT)
  targetRideHeight = selectedRideHeight
  lastPresetInput = getHeightName(selectedRideHeight)
  autoMode = false
  writeElectrics()
end

local function setLow()
  setManualHeightIndex(1)
end

local function setStandard()
  setManualHeightIndex(2)
end

local function setHigh()
  setManualHeightIndex(3)
end

local function getState()
  return {
    auto = autoMode and 1 or 0,
    height = currentHeightName,
    feel = currentFeelName,
    value = currentRideHeight,
    target = targetRideHeight
  }
end

local function init(jbeamData)
  jbeamData = jbeamData or {}

  MIN_RIDE_HEIGHT = tonumber(jbeamData.minRideHeight) or MIN_RIDE_HEIGHT
  DEFAULT_RIDE_HEIGHT = tonumber(jbeamData.defaultRideHeight) or DEFAULT_RIDE_HEIGHT
  MAX_RIDE_HEIGHT = tonumber(jbeamData.maxRideHeight) or MAX_RIDE_HEIGHT
  OFFROAD_RIDE_HEIGHT = tonumber(jbeamData.offroadRideHeight) or OFFROAD_RIDE_HEIGHT
  smoothTau = tonumber(jbeamData.smoothTau) or smoothTau

  if jbeamData.conserveLowerStartKmh then CONSERVE_LOWER_START = tonumber(jbeamData.conserveLowerStartKmh) / 3.6 end
  if jbeamData.conserveLowerEndKmh then CONSERVE_LOWER_END = tonumber(jbeamData.conserveLowerEndKmh) / 3.6 end
  if jbeamData.sportLowerStartKmh then SPORT_LOWER_START = tonumber(jbeamData.sportLowerStartKmh) / 3.6 end
  if jbeamData.sportLowerEndKmh then SPORT_LOWER_END = tonumber(jbeamData.sportLowerEndKmh) / 3.6 end

  currentRideHeight = DEFAULT_RIDE_HEIGHT
  selectedRideHeight = DEFAULT_RIDE_HEIGHT
  targetRideHeight = DEFAULT_RIDE_HEIGHT
  lastMode = nil
  autoMode = true
  lastPresetInput = "standard"
  currentHeightName = "standard"
  currentFeelName = "medium"
  setDebug("init complete")
  writeElectrics()
end

local function reset()
  currentRideHeight = DEFAULT_RIDE_HEIGHT
  selectedRideHeight = DEFAULT_RIDE_HEIGHT
  targetRideHeight = DEFAULT_RIDE_HEIGHT
  lastMode = nil
  autoMode = true
  lastPresetInput = "standard"
  currentHeightName = "standard"
  currentFeelName = "medium"
  setDebug("reset complete")
  writeElectrics()
end

local function updateGFX(dt)
  local mode = normalizeMode(electrics.values.modeNameCustom)
  local speed = getSpeed()
  local presetName, inputRideHeight = readPresetInput()

  if presetName and presetName ~= lastPresetInput then
    lastPresetInput = presetName
    selectedRideHeight = clamp(inputRideHeight, MIN_RIDE_HEIGHT, MAX_RIDE_HEIGHT)
    autoMode = false
  end

  if lastMode ~= mode then
    lastMode = mode
  end

  local targetHeight = selectedRideHeight

  if autoMode then
    targetHeight = DEFAULT_RIDE_HEIGHT

    if mode == "OFFROAD" then
      targetHeight = OFFROAD_RIDE_HEIGHT
    elseif mode == "CONSERVE" then
      targetHeight = getLoweringTarget(DEFAULT_RIDE_HEIGHT, speed, CONSERVE_LOWER_START, CONSERVE_LOWER_END)
    elseif mode == "SPORT" then
      targetHeight = getLoweringTarget(DEFAULT_RIDE_HEIGHT, speed, SPORT_LOWER_START, SPORT_LOWER_END)
    end
  end

  targetRideHeight = clamp(targetHeight, MIN_RIDE_HEIGHT, MAX_RIDE_HEIGHT)

  local alpha = clamp(dt / (smoothTau + dt), 0, 1)
  currentRideHeight = currentRideHeight + (targetRideHeight - currentRideHeight) * alpha

  if math.abs(currentRideHeight - targetRideHeight) < 0.0005 then
    currentRideHeight = targetRideHeight
  end

  writeElectrics()
end

M.init = init
M.onInit = init
M.reset = reset
M.onReset = reset
M.updateGFX = updateGFX
M.setAutoMode = setAutoMode
M.setRideHeight = setRideHeight
M.setLow = setLow
M.setStandard = setStandard
M.setHigh = setHigh
M.suspensionAuto = suspensionAuto
M.suspensionUp = suspensionUp
M.suspensionDown = suspensionDown
M.suspensionPresetUp = suspensionPresetUp
M.suspensionPresetDown = suspensionPresetDown
M.getState = getState
M.getData = getState

return M
