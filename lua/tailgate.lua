--author ACM | BEAMNG for Rivian R1 S/T Kenemation Mods

local M = {}

local function ctrlR()
    electrics.values.gatedeck = 0
end

local function R()
    electrics.values.gatedeck = 0
end 

local function updateGFX(dt)
    if electrics.values.lowergateCoupler_notAttached == 1 then
		electrics.values.gatedeck = 1
	else
		electrics.values.gatedeck = 0
    end
end

-- public interface
M.onInit    = ctrlR
M.onReset   = R
M.updateGFX = updateGFX

return M