local M = {}
M.type = "auxiliary"

local saveInterval = 10
local saveTimer = 0
local odometerValue = 0
local startScreenDontShowAgain = false

local function getSaveFilePath()
  local folderName = "vehicle"
  if v and v.vehicleDirectory then
    folderName = string.sub(v.vehicleDirectory, 10, -2)
  end
  return "settings/kenemation_mods_odometers/" .. folderName .. ".json"
end

local function saveOdometer()
  local path = getSaveFilePath()
  local data = {
    odometer = odometerValue,
    start_screen_dont_show_again = startScreenDontShowAgain
  }
  jsonWriteFile(path, data, true)
end

local function loadOdometer()
  local path = getSaveFilePath()
  local data = jsonReadFile(path)

  if data and type(data.odometer) == "number" then
    odometerValue = data.odometer
  end

  if data and data.start_screen_dont_show_again ~= nil then
    startScreenDontShowAgain = data.start_screen_dont_show_again == true or data.start_screen_dont_show_again == 1
  end

  electrics.values.acmrivianken_odometer = odometerValue
  electrics.values.start_screen_dont_show_again = startScreenDontShowAgain and 1 or 0
end

local function setStartScreenDontShowAgain(value)
  startScreenDontShowAgain = value == true or value == 1
  electrics.values.start_screen_dont_show_again = startScreenDontShowAgain and 1 or 0
  saveOdometer()
end

local function getStartScreenDontShowAgain()
  return startScreenDontShowAgain
end

local function getValue()
  return odometerValue
end

local function setValue(value)
  local parsed = tonumber(value)
  if parsed then
    odometerValue = math.max(0, parsed)
    electrics.values.acmrivianken_odometer = odometerValue
    saveOdometer()
  end
end

local function updateGFX(dt)
  saveTimer = saveTimer + dt

  local speed = electrics.values.wheelspeed or 0
  local engineRunning = (electrics.values.engineRunning or 0) > 0.5

  if speed > 0.5 and speed < 600 and engineRunning then
    odometerValue = odometerValue + (speed * dt * 0.001)
    electrics.values.acmrivianken_odometer = odometerValue
  end

  electrics.values.start_screen_dont_show_again = startScreenDontShowAgain and 1 or 0

  if saveTimer >= saveInterval then
    saveOdometer()
    saveTimer = 0
  end
end

local function init()
  loadOdometer()
end

local function reset()
  loadOdometer()
end

M.init = init
M.reset = reset
M.updateGFX = updateGFX
M.getValue = getValue
M.setValue = setValue
M.saveOdometer = saveOdometer
M.getStartScreenDontShowAgain = getStartScreenDontShowAgain
M.setStartScreenDontShowAgain = setStartScreenDontShowAgain

return M
