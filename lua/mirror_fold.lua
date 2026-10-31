--author ACM | BEAMNG for Rivian R1 S/T Kenemation Mods

local M = {}

local foldDelay = 2
local ignitionOffTime = nil
local mirrorsFolded = false

local function updateGFX(dt)
  local ignition = electrics.values.ignitionLevel or 0

  if ignition == 0 then
    if not ignitionOffTime then
      ignitionOffTime = os.clock()
    end

    if not mirrorsFolded and (os.clock() - ignitionOffTime) >= foldDelay then
      mirrorsFolded = true
      electrics.values.mirror_fold = 1
    end
  else
    ignitionOffTime = nil
    mirrorsFolded = false
    electrics.values.mirror_fold = 0
  end
end

M.updateGFX = updateGFX

return M