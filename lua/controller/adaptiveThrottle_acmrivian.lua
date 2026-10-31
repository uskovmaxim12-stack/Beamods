local M = {}

local powertrainVariant = "quad"

local filteredRawThrottle = 0
local limiterThrottle = 1
local reverseLimiterThrottle = 1

local reverseSpeedLimit = 50 / 3.6
local reverseLimiterFadeStart = 6 / 3.6
local reverseLimiterFadeEnd = 1 / 3.6
local reverseLimiterTauUp = 0.28
local reverseLimiterTauDown = 0.12

local conserveKickdownTimer = 0
local conserveKickdownActive = false
local conserveLimiterBypassActive = false

local sportKickdownTimer = 0
local sportKickdownActive = false
local sportLimiterBypassActive = false

local kickdownBlend = 0

local variantProfiles = {
  dual_standard = {
    conserveSpeedLimit = 110 / 2.237,
    conserveLimiterResumeSpeed = 105 / 2.237,
    conserveLimiterFadeStart = 12 / 3.6,
    conserveLimiterFadeEnd = 2 / 3.6,
    conserveLimiterTauUp = 0.45,
    conserveLimiterTauDown = 0.18,
    conserveFilterTauUp = 0.12,
    conserveFilterTauDown = 0.06,
    conserveBaseCap = 1.0,
    conserveExtraCap = 0.0,
    conserveBoostStart = 1.1,
    conserveKickdownHold = 99.0,
    conserveKickdownThreshold = 1.1,
    conserveKickdownBlendSpeed = 6.0,

    offroadSpeedLimit = 110 / 2.237,
    offroadLimiterFadeStart = 12 / 3.6,
    offroadLimiterFadeEnd = 2 / 3.6,
    offroadLimiterTauUp = 0.42,
    offroadLimiterTauDown = 0.18,

    sportSpeedLimit = 130 / 2.237,
    sportLimiterResumeSpeed = 125 / 2.237,
    sportLimiterFadeStart = 12 / 3.6,
    sportLimiterFadeEnd = 2 / 3.6,
    sportLimiterTauUp = 0.35,
    sportLimiterTauDown = 0.14,
    sportKickdownHold = 0.35,
    sportKickdownThreshold = 0.97
  },
  dual = {
    conserveSpeedLimit = 110 / 2.237,
    conserveLimiterResumeSpeed = 105 / 2.237,
    conserveLimiterFadeStart = 12 / 3.6,
    conserveLimiterFadeEnd = 2 / 3.6,
    conserveLimiterTauUp = 0.50,
    conserveLimiterTauDown = 0.20,
    conserveFilterTauUp = 0.18,
    conserveFilterTauDown = 0.07,
    conserveBaseCap = 1.0,
    conserveExtraCap = 0.0,
    conserveBoostStart = 1.1,
    conserveKickdownHold = 99.0,
    conserveKickdownThreshold = 1.1,
    conserveKickdownBlendSpeed = 6.0,

    offroadSpeedLimit = 110 / 2.237,
    offroadLimiterFadeStart = 12 / 3.6,
    offroadLimiterFadeEnd = 2 / 3.6,
    offroadLimiterTauUp = 0.42,
    offroadLimiterTauDown = 0.18,

    sportSpeedLimit = 130 / 2.237,
    sportLimiterResumeSpeed = 125 / 2.237,
    sportLimiterFadeStart = 12 / 3.6,
    sportLimiterFadeEnd = 2 / 3.6,
    sportLimiterTauUp = 0.38,
    sportLimiterTauDown = 0.16,
    sportKickdownHold = 0.35,
    sportKickdownThreshold = 0.97
  },
  tri = {
    conserveSpeedLimit = 110 / 2.237,
    conserveLimiterResumeSpeed = 105 / 2.237,
    conserveLimiterFadeStart = 12 / 3.6,
    conserveLimiterFadeEnd = 2 / 3.6,
    conserveLimiterTauUp = 0.55,
    conserveLimiterTauDown = 0.22,
    conserveFilterTauUp = 0.16,
    conserveFilterTauDown = 0.06,
    conserveBaseCap = 0.42,
    conserveExtraCap = 0.22,
    conserveBoostStart = 0.60,
    conserveKickdownHold = 0.5,
    conserveKickdownThreshold = 0.97,
    conserveKickdownBlendSpeed = 6.0,

    offroadSpeedLimit = 110 / 2.237,
    offroadLimiterFadeStart = 12 / 3.6,
    offroadLimiterFadeEnd = 2 / 3.6,
    offroadLimiterTauUp = 0.42,
    offroadLimiterTauDown = 0.18,

    sportSpeedLimit = 130 / 2.237,
    sportLimiterResumeSpeed = 125 / 2.237,
    sportLimiterFadeStart = 12 / 3.6,
    sportLimiterFadeEnd = 2 / 3.6,
    sportLimiterTauUp = 0.40,
    sportLimiterTauDown = 0.18,
    sportKickdownHold = 0.35,
    sportKickdownThreshold = 0.97
  },
  quad = {
    conserveSpeedLimit = 110 / 2.237,
    conserveLimiterResumeSpeed = 105 / 2.237,
    conserveLimiterFadeStart = 12 / 3.6,
    conserveLimiterFadeEnd = 2 / 3.6,
    conserveLimiterTauUp = 0.60,
    conserveLimiterTauDown = 0.24,
    conserveFilterTauUp = 0.12,
    conserveFilterTauDown = 0.045,
    conserveBaseCap = 0.40,
    conserveExtraCap = 0.24,
    conserveBoostStart = 0.60,
    conserveKickdownHold = 0.5,
    conserveKickdownThreshold = 0.97,
    conserveKickdownBlendSpeed = 6.0,

    offroadSpeedLimit = 110 / 2.237,
    offroadLimiterFadeStart = 12 / 3.6,
    offroadLimiterFadeEnd = 2 / 3.6,
    offroadLimiterTauUp = 0.42,
    offroadLimiterTauDown = 0.18,

    sportSpeedLimit = 130 / 2.237,
    sportLimiterResumeSpeed = 125 / 2.237,
    sportLimiterFadeStart = 12 / 3.6,
    sportLimiterFadeEnd = 2 / 3.6,
    sportLimiterTauUp = 0.42,
    sportLimiterTauDown = 0.18,
    sportKickdownHold = 0.35,
    sportKickdownThreshold = 0.97
  }
}

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

local function normalizeVariant(name)
  if not name then return "quad" end
  name = tostring(name):lower()
  name = name:gsub("%s+", "_")
  name = name:gsub("%-", "_")
  if variantProfiles[name] then return name end
  return "quad"
end

local function getProfile()
  return variantProfiles[normalizeVariant(powertrainVariant)] or variantProfiles.quad
end

local function getSpeed()
  return electrics.values.wheelspeed or electrics.values.airspeed or 0
end

local function isReverseGear()
  local reverse = electrics.values.reverse
  if reverse == true or reverse == 1 then return true end

  local gear = electrics.values.gear
  if gear ~= nil then
    gear = tostring(gear):upper()
    if gear == "R" or gear == "REVERSE" then return true end
  end

  local gearName = electrics.values.gearName
  if gearName ~= nil then
    gearName = tostring(gearName):upper()
    if gearName == "R" or gearName == "REVERSE" then return true end
  end

  local gearIndex = tonumber(electrics.values.gearIndex)
  if gearIndex and gearIndex < 0 then return true end

  return false
end

local function smoothThrottle(raw, dt, tauUp, tauDown)
  raw = clamp(raw, 0, 1)
  local tau = raw > filteredRawThrottle and (tauUp or 0) or (tauDown or 0)
  tau = math.max(tau, 0)

  if tau <= 0 then
    filteredRawThrottle = raw
    return raw
  end

  local alpha = clamp(dt / (tau + dt), 0, 1)
  filteredRawThrottle = filteredRawThrottle + (raw - filteredRawThrottle) * alpha

  if raw <= 0.001 and filteredRawThrottle < 0.01 then
    filteredRawThrottle = 0
  end

  return filteredRawThrottle
end

local function getLimiterTarget(speed, limit, fadeStart, fadeEnd)
  if not limit or limit <= 0 then
    return 1
  end

  local startSpeed = limit - math.max(fadeStart or 0, 0)
  local endSpeed = limit + math.max(fadeEnd or 0, 0)

  if speed <= startSpeed then
    return 1
  end

  if speed >= endSpeed then
    return 0
  end

  local t = (speed - startSpeed) / math.max(endSpeed - startSpeed, 0.001)
  return 1 - smoothstep(t)
end

local function smoothLimiter(target, dt, tauUp, tauDown)
  target = clamp(target, 0, 1)
  local tau = target > limiterThrottle and (tauUp or 0) or (tauDown or 0)
  tau = math.max(tau, 0)

  if tau <= 0 then
    limiterThrottle = target
    return limiterThrottle
  end

  local alpha = clamp(dt / (tau + dt), 0, 1)
  limiterThrottle = limiterThrottle + (target - limiterThrottle) * alpha
  return limiterThrottle
end

local function smoothReverseLimiter(target, dt)
  target = clamp(target, 0, 1)
  local tau = target > reverseLimiterThrottle and reverseLimiterTauUp or reverseLimiterTauDown
  local alpha = clamp(dt / (tau + dt), 0, 1)
  reverseLimiterThrottle = reverseLimiterThrottle + (target - reverseLimiterThrottle) * alpha
  return reverseLimiterThrottle
end

local function applyReverseLimiter(target, dt)
  if not isReverseGear() then
    reverseLimiterThrottle = 1
    return target
  end

  local speed = math.abs(getSpeed())
  local limiterTarget = getLimiterTarget(speed, reverseSpeedLimit, reverseLimiterFadeStart, reverseLimiterFadeEnd)
  local limiterFactor = smoothReverseLimiter(limiterTarget, dt)
  return clamp(target * limiterFactor, 0, 1)
end

local function updateConserveKickdown(raw, dt, p)
  if raw >= (p.conserveKickdownThreshold or 1.1) then
    conserveKickdownTimer = conserveKickdownTimer + dt
    if conserveKickdownTimer >= (p.conserveKickdownHold or 99) then
      conserveKickdownActive = true
      conserveLimiterBypassActive = true
    end
  else
    conserveKickdownTimer = 0
    if raw < 0.90 then
      conserveKickdownActive = false
    end
  end
end

local function updateSportKickdown(raw, dt, p)
  if raw >= (p.sportKickdownThreshold or 1.1) then
    sportKickdownTimer = sportKickdownTimer + dt
    if sportKickdownTimer >= (p.sportKickdownHold or 99) then
      sportKickdownActive = true
      sportLimiterBypassActive = true
    end
  else
    sportKickdownTimer = 0
    if raw < 0.90 then
      sportKickdownActive = false
    end
  end
end

local function applyConserve(raw, dt, p)
  local speed = getSpeed()
  updateConserveKickdown(raw, dt, p)

  if conserveLimiterBypassActive and speed <= (p.conserveLimiterResumeSpeed or p.conserveSpeedLimit or 0) then
    conserveLimiterBypassActive = false
  end

  local filtered = smoothThrottle(raw, dt, p.conserveFilterTauUp, p.conserveFilterTauDown)
  local target = filtered

  if p.conserveBaseCap < 1.0 then
    local base = math.min(filtered, p.conserveBaseCap)
    if filtered > p.conserveBoostStart and base >= p.conserveBaseCap then
      local extraSpan = math.max(1.0 - p.conserveBoostStart, 0.001)
      local boostTarget = ((filtered - p.conserveBoostStart) / extraSpan) * p.conserveExtraCap
      target = clamp(base + boostTarget, 0, 1)
    else
      target = base
    end
  end

  if conserveKickdownActive then
    kickdownBlend = math.min(kickdownBlend + dt * (p.conserveKickdownBlendSpeed or 6.0), 1)
  else
    kickdownBlend = math.max(kickdownBlend - dt * 10, 0)
  end

  target = target * (1 - kickdownBlend) + kickdownBlend

  if conserveLimiterBypassActive then
    limiterThrottle = 1
    return target
  end

  local limiterTarget = getLimiterTarget(speed, p.conserveSpeedLimit, p.conserveLimiterFadeStart, p.conserveLimiterFadeEnd)
  local limiterFactor = smoothLimiter(limiterTarget, dt, p.conserveLimiterTauUp, p.conserveLimiterTauDown)
  return clamp(target * limiterFactor, 0, 1)
end

local function applySport(raw, dt, p)
  filteredRawThrottle = clamp(raw, 0, 1)
  updateSportKickdown(raw, dt, p)

  if sportLimiterBypassActive and getSpeed() <= (p.sportLimiterResumeSpeed or p.sportSpeedLimit or 0) then
    sportLimiterBypassActive = false
  end

  if sportLimiterBypassActive then
    limiterThrottle = 1
    return clamp(raw, 0, 1)
  end

  local speed = getSpeed()
  local limiterTarget = getLimiterTarget(speed, p.sportSpeedLimit, p.sportLimiterFadeStart, p.sportLimiterFadeEnd)
  local limiterFactor = smoothLimiter(limiterTarget, dt, p.sportLimiterTauUp, p.sportLimiterTauDown)
  return clamp(raw, 0, 1) * limiterFactor
end

local function applyOffroad(raw, dt, p)
  filteredRawThrottle = clamp(raw, 0, 1)
  conserveKickdownTimer = 0
  conserveKickdownActive = false
  conserveLimiterBypassActive = false
  sportKickdownTimer = 0
  sportKickdownActive = false
  sportLimiterBypassActive = false
  kickdownBlend = 0

  local speed = getSpeed()
  local limiterTarget = getLimiterTarget(speed, p.offroadSpeedLimit, p.offroadLimiterFadeStart, p.offroadLimiterFadeEnd)
  local limiterFactor = smoothLimiter(limiterTarget, dt, p.offroadLimiterTauUp, p.offroadLimiterTauDown)
  return clamp(raw, 0, 1) * limiterFactor
end

local function applyEscOff(raw)
  filteredRawThrottle = clamp(raw, 0, 1)
  limiterThrottle = 1
  conserveKickdownTimer = 0
  conserveKickdownActive = false
  conserveLimiterBypassActive = false
  sportKickdownTimer = 0
  sportKickdownActive = false
  sportLimiterBypassActive = false
  kickdownBlend = 0
  return clamp(raw, 0, 1)
end

local function isCruiseActive()
  return electrics.values.cruiseControlActive == true or electrics.values.cruiseControlActive == 1
end

local function getInputValue(name)
  if input and input[name] ~= nil then
    return tonumber(input[name]) or 0
  end
  if electrics.values[name] ~= nil then
    return tonumber(electrics.values[name]) or 0
  end
  if electrics.values[name .. "_input"] ~= nil then
    return tonumber(electrics.values[name .. "_input"]) or 0
  end
  return 0
end

local function isArcadeReverseInput(raw)
  local inputThrottle = getInputValue("throttle")
  local inputBrake = getInputValue("brake")
  local throttleInput = tonumber(electrics.values.throttle_input) or 0
  local brakeInput = tonumber(electrics.values.brake_input) or 0

  if raw and raw < -0.001 then return true end
  if inputThrottle < -0.001 then return true end
  if throttleInput < -0.001 then return true end

  if isReverseGear() and (inputBrake > 0.001 or brakeInput > 0.001) then
    return true
  end

  return false
end
local function updateGFX(dt)
  if isReverseGear() then
    filteredRawThrottle = 0
    limiterThrottle = 1
    reverseLimiterThrottle = 1
    conserveKickdownTimer = 0
    conserveKickdownActive = false
    conserveLimiterBypassActive = false
    sportKickdownTimer = 0
    sportKickdownActive = false
    sportLimiterBypassActive = false
    kickdownBlend = 0
    return
  end

  local raw = electrics.values.throttle_input or input.throttle or 0

  local mode = normalizeMode(electrics.values.modeNameCustom)
  local p = getProfile()
  local target = clamp(raw, 0, 1)

  if isCruiseActive() then
    filteredRawThrottle = clamp(raw, 0, 1)
    limiterThrottle = 1
    conserveKickdownTimer = 0
    conserveKickdownActive = false
    conserveLimiterBypassActive = false
    sportKickdownTimer = 0
    sportKickdownActive = false
    sportLimiterBypassActive = false
    kickdownBlend = 0
    if isReverseGear() then
      electrics.values.throttle = applyReverseLimiter(target, dt)
    end
    return
  end

  if mode == "CONSERVE" then
    sportKickdownTimer = 0
    sportKickdownActive = false
    sportLimiterBypassActive = false
    target = applyConserve(raw, dt, p)
  elseif mode == "SPORT" then
    conserveKickdownTimer = 0
    conserveKickdownActive = false
    conserveLimiterBypassActive = false
    kickdownBlend = 0
    target = applySport(raw, dt, p)
  elseif mode == "OFFROAD" then
    target = applyOffroad(raw, dt, p)
  elseif mode == "ESCOFF" then
    target = applyEscOff(raw)
  else
    conserveKickdownTimer = 0
    conserveKickdownActive = false
    conserveLimiterBypassActive = false
    kickdownBlend = 0
    target = applySport(raw, dt, p)
  end

  target = applyReverseLimiter(target, dt)
  electrics.values.throttle = clamp(target, 0, 1)
end

local function init(jbeamData)
  if jbeamData and jbeamData.powertrainVariant then
    powertrainVariant = normalizeVariant(jbeamData.powertrainVariant)
  else
    powertrainVariant = normalizeVariant(powertrainVariant)
  end
end

local function reset()
  filteredRawThrottle = 0
  limiterThrottle = 1
  reverseLimiterThrottle = 1

  conserveKickdownTimer = 0
  conserveKickdownActive = false
  conserveLimiterBypassActive = false

  sportKickdownTimer = 0
  sportKickdownActive = false
  sportLimiterBypassActive = false

  kickdownBlend = 0
end

M.init = init
M.reset = reset
M.updateGFX = updateGFX

return M
