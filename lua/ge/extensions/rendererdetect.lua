--author ACM | BEAMNG for Mercedes-Benz A45 Kenemation Mods
local M = {}

local cached_dx = nil
local cached_dev = nil
local inited = false

local function safeGetCVar(name)
  local ok, v = pcall(getConsoleVariable, name)
  if not ok or v == nil then return "" end
  v = tostring(v)
  return v
end

local function firstNonEmpty(...)
  for i = 1, select("#", ...) do
    local s = select(i, ...)
    if s and s ~= "" then return s end
  end
  return ""
end

local function pushToVehicle(vid, dx)
  local veh = be:getObjectByID(vid)
  if not veh then return end

  local cmd = string.format([[
    if electrics and electrics.values then
      electrics.values.directx_on = %d
    end
  ]], dx)

  veh:queueLuaCommand(cmd)
end

local function pushToPlayerAndCurrent(dx)
  local pvid = be:getPlayerVehicleID(0)
  if pvid then pushToVehicle(pvid, dx) end

  local cvid = be:getPlayerVehicleID(0)
  if cvid then pushToVehicle(cvid, dx) end
end

local function compute()
  local a1 = safeGetCVar("pref::Video::displayDevice")
  local a2 = safeGetCVar("$pref::Video::displayDevice")
  local b1 = safeGetCVar("pref::Video::renderer")
  local b2 = safeGetCVar("$pref::Video::renderer")
  local c1 = safeGetCVar("pref::Video::gfxApi")
  local c2 = safeGetCVar("$pref::Video::gfxApi")

  local dev = firstNonEmpty(a1, a2, b1, b2, c1, c2)
  local devL = dev:lower()

  local dx = 1
  if devL:find("vk", 1, true) or devL:find("vulkan", 1, true) then
    dx = 0
  end

  cached_dx = dx
  cached_dev = dev

  TorqueScript.eval("$acm::directx_on = " .. tostring(dx) .. ";")
  TorqueScript.eval("$acm::displayDevice = \"" .. tostring(dev):gsub("\"", "\\\"") .. "\";")

  pushToPlayerAndCurrent(dx)

  --print(string.format("[ACM GE] picked='%s' directx_on=%d (pushed to vehicle)", tostring(dev), dx))--
  return dx, dev
end

function M.onExtensionLoaded()
  if inited then return end
  inited = true
  compute()
end

function M.onUpdate(dtReal, dtSim, dtRaw)
end

function M.onVehicleSpawned(vid)
  if cached_dx == nil then compute() end
  if cached_dx ~= nil then
    pushToVehicle(vid, cached_dx)
    --print(string.format("[ACM GE] pushed directx_on=%d to spawned vehicle id=%s", cached_dx, tostring(vid)))--
  end
end

return M
