local M = {}
M.type = "auxiliary"

local htmlTexture = require("htmlTexture")

local gaugeHTMLTexture
local screenMaterialName
local updateTimerGauges = 0
local updateTimerNav = 0
local gpsData = {x = 0, y = 0, rotation = 0, zoom = 1, ignitionLevel = 0}
local invFPS = 1 / 45
local updateFPS = 45
local currentModeName = "SPORT"

local gaugeData = {electrics = {}, powertrain = {}, customModules = {}}
local electricsConfig = {}
local powertrainConfig = {}
local customModuleConfig = {}

local electricsUpdate = nop
local powertrainUpdate = nop
local customModuleUpdate = nop

local function updateElectricsData(dt)
  for _, v in ipairs(electricsConfig) do
    gaugeData.electrics[v] = electrics.values[v] or 0
  end
end

local function updatePowertrainData(dt)
  for _, v in ipairs(powertrainConfig) do
    for _, n in ipairs(v.properties) do
      gaugeData.powertrain[v.device.name][n] = v.device[n] or 0
    end
  end
end

local function updateCustomModuleData(dt)
  for _, module in ipairs(customModuleConfig) do
    module.controller.updateGaugeData(gaugeData.customModules[module.name], dt)
  end
end

local function updateGFX(dt)
  electrics.values.modeNameCustom = currentModeName

  if playerInfo.anyPlayerSeated then
    updateTimerGauges = updateTimerGauges + dt
    if obj:getUpdateUIflag() then
      electricsUpdate(updateTimerGauges)
      powertrainUpdate(updateTimerGauges)
      customModuleUpdate(updateTimerGauges)
      gaugeHTMLTexture:streamJS("updateData", "updateData", gaugeData)
      updateTimerGauges = 0
    end

    updateTimerNav = updateTimerNav + dt
    if updateTimerNav > invFPS then
      updateTimerNav = 0
      local pos = obj:getPosition()
      local rotation = math.deg(obj:getDirection()) + 180
      local speed = electrics.values.airspeed * 3.6
      local zoom = math.min(150 + speed * 1.5, 250)
      gpsData.x = pos.x
      gpsData.y = pos.y
      gpsData.rotation = rotation
      gpsData.speed = speed
      gpsData.zoom = zoom
      gpsData.ignitionLevel = electrics.values.ignitionLevel
      htmlTexture.call(screenMaterialName, "map.updateData", gpsData)
    end
  end
end

local function initSecondStage(jbeamData)
  local configData = jbeamData.configuration or {}
  for k, v in pairs(jbeamData) do
    if k:sub(1, 14) == "configuration_" then
      tableMergeRecursive(configData, v)
    end
  end

  screenMaterialName = configData.materialName
  local htmlPath = configData.htmlPath
  local width = configData.displayWidth or 1024
  local height = configData.displayHeight or 512
  updateFPS = configData.textureFPS or 45

  if not screenMaterialName or not htmlPath then
    log("E", "gaugesAndNav.initSecondStage", "Missing materialName or htmlPath in configuration")
    return
  end

  gaugeHTMLTexture = htmlTexture.new(screenMaterialName, htmlPath, width, height, updateFPS)
  htmlTexture.create(screenMaterialName, htmlPath, width, height, updateFPS, "automatic")
  obj:queueGameEngineLua(string.format("extensions.ui_uinavi.requestVehicleDashboardMap(%q, nil, %d)", screenMaterialName, obj:getID()))

  local displayData = jbeamData.displayData or {}
  electricsConfig = displayData.electrics or {}
  local mergedPowertrain = {}
  for _, v in pairs(tableFromHeaderTable(displayData.powertrain or {})) do
    mergedPowertrain[v.deviceName] = mergedPowertrain[v.deviceName] or {}
    table.insert(mergedPowertrain[v.deviceName], v.property)
  end
  powertrainConfig = {}
  for k, v in pairs(mergedPowertrain) do
    local device = powertrain.getDevice(k)
    if device then
      table.insert(powertrainConfig, {device = device, properties = v})
      gaugeData.powertrain[k] = {}
    end
  end
  local mergedModules = {}
  for _, v in pairs(tableFromHeaderTable(displayData.customModules or {})) do
    mergedModules[v.moduleName] = mergedModules[v.moduleName] or {}
    if v.property then mergedModules[v.moduleName][v.property] = true end
  end
  customModuleConfig = {}
  for k, v in pairs(mergedModules) do
    local c = controller.getController("gauges/customModules/" .. k)
    if c and c.setupGaugeData and c.updateGaugeData then
      c.setupGaugeData(v, gaugeHTMLTexture)
      table.insert(customModuleConfig, {controller = c, name = k, properties = v})
      gaugeData.customModules[k] = {}
    else
      log("E", "gaugesAndNav", "Missing or invalid custom module: " .. k)
    end
  end

  electricsUpdate = updateElectricsData
  powertrainUpdate = updatePowertrainData
  customModuleUpdate = updateCustomModuleData

  local settingsConfig = {
    uiUnitLength = settings.getValue("uiUnitLength") or "metric",
    uiUnitTemperature = settings.getValue("uiUnitTemperature") or "c",
    uiUnitWeight = settings.getValue("uiUnitWeight") or "kg",
    uiUnitTorque = settings.getValue("uiUnitTorque") or "metric",
    uiUnitPower = settings.getValue("uiUnitPower") or "hp",
    uiUnitEnergy = settings.getValue("uiUnitEnergy") or "metric",
    uiUnitConsumptionRate = settings.getValue("uiUnitConsumptionRate") or "metric",
    uiUnitVolume = settings.getValue("uiUnitVolume") or "l",
    uiUnitPressure = settings.getValue("uiUnitPressure") or "bar",
    uiUnitDate = settings.getValue("uiUnitDate") or "ger"
  }

  tableMerge(settingsConfig, configData)
  gaugeHTMLTexture:callJS("setup", settingsConfig)
end

local function setUIMode(parameters)
  gaugeHTMLTexture:callJS("updateMode", parameters)
end

local function setParameters(parameters)
  if parameters.modeName then
    currentModeName = tostring(parameters.modeName):upper()
  end

  if parameters.modeName and parameters.modeColor then
    setUIMode(parameters)
  end
end

M.init = nop
M.reset = nop
M.initSecondStage = initSecondStage
M.updateGFX = updateGFX
M.setParameters = setParameters

return M
