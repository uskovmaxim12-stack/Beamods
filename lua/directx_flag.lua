--author ACM | BEAMNG for Tesla Model 3 Kenemation Mods

local M = {}

local loadedGE = false
local printed = false

local function ensureGERenderDetectLoaded()
  if loadedGE then return end
  loadedGE = true
  obj:queueGameEngineLua('extensions.load("rendererdetect")')
end

local function tick()
  ensureGERenderDetectLoaded()

  if electrics and electrics.values then
    if electrics.values.directx_on == nil then
      electrics.values.directx_on = 1
    end

    if not printed then
      printed = true
      local dx = electrics.values.directx_on
      local api = (dx == 1) and "DirectX" or "Vulkan"
      --print(string.format("[ACM VEH] electrics.values.directx_on=%d (%s)", dx, api))--
    end
  end
end

function M.onExtensionLoaded()
  tick()
end

function M.updateGFX(dt)
  tick()
end

return M